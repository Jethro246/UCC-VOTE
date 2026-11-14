import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import {
  ALL_MANAGING_ADMIN_ROLES,
  canAdminManageElection,
  requireAdminRole
} from './adminRoutes.ts';
import { ELECTIONS_STORE, isElectionVisibleToSession } from './electionStore.ts';
import { categoryToDomainId } from './domainStore.ts';
import { getOptionalSessionFromRequest, logAuditEvent } from './authStore.ts';
import type { SessionData } from './authStore.ts';
import {
  computeElectionResults,
  transitionResultsWorkflow,
  recordBallotCast
} from './resultsStore.ts';
import { generateElectionReportPdf, generateElectionReportCsv } from './pdfGenerator.ts';
import type { ReportType } from './pdfGenerator.ts';
import { broadcastSyncEvent } from './realtimeBus.ts';
import { persistPlatformState } from './statePersistence.ts';
import { pushPlatformNotification } from './notificationStore.ts';
import type { ResultsWorkflowStage } from '../types/index.ts';

export const resultsRouter = Router();

const RESULTS_VIEWING_ROLES = [
  ...ALL_MANAGING_ADMIN_ROLES,
  'Returning Officer',
  'Results Auditor'
];

/**
 * GET /api/results
 * Overview of all elections with publication status & participation summaries.
 * Supports optional ?domainId= filtering; unpublished tallies are revealed only for admin's authorized scope.
 */
resultsRouter.get('/', (req: Request, res: Response) => {
  const { domainId } = req.query;
  const session = getOptionalSessionFromRequest(req);
  const isAdmin = Boolean(session && session.userType === 'admin');

  let elections = Array.from(ELECTIONS_STORE.values()).filter((el) =>
    isElectionVisibleToSession(el, session)
  );
  if (domainId && typeof domainId === 'string' && domainId !== 'All') {
    elections = elections.filter(
      (el) => (el.domainId || categoryToDomainId(el.category)) === domainId
    );
  }

  const list = elections
    .map((el) => {
      const canSeePrivate =
        isAdmin && canAdminManageElection(session!, el, { allowAuditorRead: true }).allowed;
      return computeElectionResults(el.id, canSeePrivate);
    })
    .filter(Boolean);

  return res.json({
    success: true,
    total: list.length,
    elections: list
  });
});

/**
 * GET /api/results/:electionId
 * Public/Student results endpoint: strictly enforces that unpublished results do not reveal candidate tallies
 */
resultsRouter.get('/:electionId', (req: Request, res: Response) => {
  const { electionId } = req.params;
  const session = getOptionalSessionFromRequest(req);
  const election = ELECTIONS_STORE.get(electionId);

  if (!election || !isElectionVisibleToSession(election, session)) {
    return res.status(404).json({
      success: false,
      error: `Election '${electionId}' was not found.`
    });
  }

  const results = computeElectionResults(electionId, false);

  if (!results) {
    return res.status(404).json({
      success: false,
      error: `Election '${electionId}' was not found.`
    });
  }

  return res.json({
    success: true,
    results
  });
});

/**
 * GET /api/results/:electionId/admin
 * Protected Administrator endpoint for full tallies across all 6 workflow stages (Domain-RBAC scoped)
 */
resultsRouter.get(
  '/:electionId/admin',
  authenticateToken,
  requireAdminRole(RESULTS_VIEWING_ROLES),
  (req: Request, res: Response) => {
    const { electionId } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(electionId);
    if (!election) {
      return res.status(404).json({
        success: false,
        error: `Election '${electionId}' was not found.`
      });
    }

    const accessCheck = canAdminManageElection(session, election, { allowAuditorRead: true });
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: electionId,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked admin results access for ${electionId}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const results = computeElectionResults(electionId, true);

    return res.json({
      success: true,
      results
    });
  }
);

/**
 * POST /api/results/:electionId/workflow
 * Advances results through verification, audit, approval, certification & publication (Domain-RBAC scoped)
 */
resultsRouter.post(
  '/:electionId/workflow',
  authenticateToken,
  requireAdminRole(RESULTS_VIEWING_ROLES),
  (req: Request, res: Response) => {
    const { electionId } = req.params;
    const { targetStage, notes, actorName } = req.body || {};
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(electionId);
    if (!election) {
      return res.status(404).json({
        success: false,
        error: `Election '${electionId}' was not found.`
      });
    }

    const accessCheck = canAdminManageElection(session, election, { allowAuditorRead: true });
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: electionId,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked workflow advancement for ${electionId}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    if (!targetStage) {
      return res.status(400).json({
        success: false,
        error: 'Target workflow stage is required.'
      });
    }

    const outcome = transitionResultsWorkflow(
      electionId,
      targetStage as ResultsWorkflowStage,
      {
        id: session.userId,
        name: actorName || session.userId,
        role: session.role,
        ipAddress
      },
      notes
    );

    if (!outcome.success) {
      return res.status(outcome.error?.includes('Unauthorized') ? 403 : 400).json({
        success: false,
        error: outcome.error
      });
    }

    if (targetStage === 'published') {
      pushPlatformNotification({
        title: `Certified Results Published: ${election.title}`,
        message: `Official Electoral Commission certified results have been released for ${election.title}.`,
        category: 'results',
        domainId: election.domainId,
        linkAction: 'election_results'
      });
    }

    persistPlatformState();
    broadcastSyncEvent(targetStage === 'published' ? 'results:published' : 'results:updated', {
      electionId,
      domainId: election.domainId
    });

    return res.json({
      success: true,
      message: outcome.message,
      results: outcome.results
    });
  }
);

/**
 * POST /api/results/:electionId/cast
 * Records an authoritative digital ballot cast into the election tally store
 */
resultsRouter.post('/:electionId/cast', (req: Request, res: Response) => {
  const { electionId } = req.params;
  const { selections, voterMeta } = req.body || {};
  const session = getOptionalSessionFromRequest(req);
  const ipAddress =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  const result = recordBallotCast(electionId, selections || {}, voterMeta);

  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: result.error
    });
  }

  logAuditEvent({
    eventType: 'BALLOT_CAST',
    userId: session?.userId || 'verified-voter',
    identifier: electionId,
    role: session?.role || 'Student',
    ipAddress,
    status: 'SUCCESS',
    details: `Encrypted ballot cast recorded for election ${electionId}. Receipt hash: ${result.receiptCode}.`
  });

  persistPlatformState();
  broadcastSyncEvent('vote:cast', { electionId });

  return res.json({
    success: true,
    receiptCode: result.receiptCode,
    electionId
  });
});

/**
 * GET /api/results/:electionId/export
 * Generates downloadable PDF or CSV reports (?format=pdf|csv&type=full|results|turnout|candidates|positions)
 */
resultsRouter.get('/:electionId/export', (req: Request, res: Response) => {
  const { electionId } = req.params;
  const format = (req.query.format as string)?.toLowerCase() === 'csv' ? 'csv' : 'pdf';
  const rawType = ((req.query.type as string) || 'full').toLowerCase();
  const validTypes: ReportType[] = ['full', 'results', 'turnout', 'candidates', 'positions'];
  const reportType: ReportType = validTypes.includes(rawType as ReportType)
    ? (rawType as ReportType)
    : 'full';

  const session = getOptionalSessionFromRequest(req);
  const election = ELECTIONS_STORE.get(electionId);
  if (!election) {
    return res.status(404).json({ success: false, error: 'Election not found.' });
  }

  const isAdmin = Boolean(session && session.userType === 'admin');
  const hasDomainClearance =
    isAdmin && canAdminManageElection(session!, election, { allowAuditorRead: true }).allowed;

  const publicPreview = computeElectionResults(electionId, false);
  if (!publicPreview) {
    return res.status(404).json({ success: false, error: 'Election not found.' });
  }

  if (!publicPreview.isPublished && !hasDomainClearance) {
    return res.status(403).json({
      success: false,
      error:
        'Unpublished election reports are restricted to authorized Electoral Commission or Domain officials for this constituency.'
    });
  }

  const results = computeElectionResults(electionId, hasDomainClearance);
  if (!results) {
    return res.status(404).json({ success: false, error: 'Election results unavailable.' });
  }

  const ipAddress =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  if (isAdmin && session) {
    logAuditEvent({
      eventType: 'RESULTS_REPORT_EXPORTED',
      userId: session.userId,
      identifier: electionId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Exported ${format.toUpperCase()} (${reportType}) report for election ${electionId}.`
    });
  }

  const safeCode = results.electionCode.replace(/[^A-Za-z0-9_-]/g, '_');
  const filename = `UCC_VOTE_${safeCode}_${reportType}_${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === 'csv') {
    const csvContent = generateElectionReportCsv(results, reportType);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } else {
    const pdfBuffer = generateElectionReportPdf(results, reportType);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  }
});
