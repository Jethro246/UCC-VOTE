import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import { requireAdminRole } from './adminRoutes.ts';
import { ELECTIONS_STORE } from './electionStore.ts';
import { ACTIVE_SESSIONS, logAuditEvent } from './authStore.ts';
import {
  computeElectionResults,
  transitionResultsWorkflow,
  recordBallotCast
} from './resultsStore.ts';
import {
  generateElectionReportPdf,
  generateElectionReportCsv
} from './pdfGenerator.ts';
import type { ReportType } from './pdfGenerator.ts';
import type { ResultsWorkflowStage } from '../types/index.ts';

export const resultsRouter = Router();

function getOptionalSession(req: Request) {
  let token = req.headers.authorization?.replace(/^Bearer\s+/, '');
  if (!token && req.cookies && req.cookies.ucc_session) {
    token = req.cookies.ucc_session;
  }
  if (!token) return null;
  const session = ACTIVE_SESSIONS.get(token);
  if (!session || Date.now() > session.expiresAt) return null;
  return session;
}

/**
 * GET /api/results
 * Overview of all elections with publication status & participation summaries
 */
resultsRouter.get('/', (req: Request, res: Response) => {
  const session = getOptionalSession(req);
  const isAdmin = session && session.userType === 'admin';

  const list = Array.from(ELECTIONS_STORE.values())
    .map((el) => computeElectionResults(el.id, Boolean(isAdmin)))
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
 * Protected Administrator endpoint for full tallies across all 6 workflow stages
 */
resultsRouter.get(
  '/:electionId/admin',
  authenticateToken,
  requireAdminRole(['Super Administrator', 'Electoral Commissioner', 'Returning Officer', 'Results Auditor']),
  (req: Request, res: Response) => {
    const { electionId } = req.params;
    const results = computeElectionResults(electionId, true);

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
  }
);

/**
 * POST /api/results/:electionId/workflow
 * Advances results through the 6-stage verification, audit, approval, certification & publication workflow
 */
resultsRouter.post(
  '/:electionId/workflow',
  authenticateToken,
  requireAdminRole(['Super Administrator', 'Electoral Commissioner', 'Returning Officer', 'Results Auditor']),
  (req: Request, res: Response) => {
    const { electionId } = req.params;
    const { targetStage, notes, actorName } = req.body;
    const session = (req as any).session;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

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
  const session = getOptionalSession(req);
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

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
  const reportType: ReportType = validTypes.includes(rawType as ReportType) ? (rawType as ReportType) : 'full';

  const session = getOptionalSession(req);
  const isAdmin = Boolean(session && session.userType === 'admin');

  // Check publication vs admin clearance
  const publicPreview = computeElectionResults(electionId, false);
  if (!publicPreview) {
    return res.status(404).json({ success: false, error: 'Election not found.' });
  }

  if (!isAdmin && !publicPreview.isPublished) {
    return res.status(403).json({
      success: false,
      error: 'Unpublished election reports are restricted to authorized Electoral Commission officials.'
    });
  }

  const results = computeElectionResults(electionId, isAdmin);
  if (!results) {
    return res.status(404).json({ success: false, error: 'Election results unavailable.' });
  }

  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
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
