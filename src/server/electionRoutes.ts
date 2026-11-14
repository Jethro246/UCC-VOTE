import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import {
  ALL_MANAGING_ADMIN_ROLES,
  canAdminAccessDomain,
  canAdminManageElection,
  requireAdminRole
} from './adminRoutes.ts';
import {
  ELECTIONS_STORE,
  POSITIONS_STORE,
  CANDIDATES_STORE,
  isElectionPublished,
  isElectionVisibleToSession,
  isValidTransition,
  VALID_STATUS_TRANSITIONS,
  verifyStudentEligibility,
  calculateEligibleVoterCount
} from './electionStore.ts';
import {
  categoryToDomainId,
  domainIdToCategory,
  enrichElectionDomainRelations,
  matchesHallName,
  normalizeText
} from './domainStore.ts';
import {
  getOptionalSessionFromRequest,
  getRegisteredAndVerifiedStudentCounts,
  logAuditEvent,
  OFFICIAL_UCC_STUDENT_REGISTRY,
  STUDENT_ACCOUNTS
} from './authStore.ts';
import type { SessionData } from './authStore.ts';
import { BALLOT_LEDGER_STORE } from './resultsStore.ts';
import { ANONYMOUS_BALLOT_VAULT, VOTER_PARTICIPATION_VAULT } from './votingStore.ts';
import { broadcastSyncEvent } from './realtimeBus.ts';
import { persistPlatformState } from './statePersistence.ts';
import { pushPlatformNotification } from './notificationStore.ts';
import type {
  DomainId,
  Election,
  ElectionCategory,
  ElectionStatus,
  Position,
  PublicPlatformStats
} from '../types/index.ts';

export const electionRouter = Router();

// ==========================================
// PUBLIC & STUDENT READ ROUTES
// ==========================================

/**
 * GET /api/elections
 * Returns list of elections with optional domainId, subdomain, category, and status filtering
 */
electionRouter.get('/', (req: Request, res: Response) => {
  const { domainId, hallId, facultyId, departmentId, category, status, search } = req.query;
  const session = getOptionalSessionFromRequest(req);
  let list = Array.from(ELECTIONS_STORE.values()).filter((e) =>
    isElectionVisibleToSession(e, session)
  );

  if (domainId && typeof domainId === 'string' && domainId !== 'All') {
    list = list.filter((e) => (e.domainId || categoryToDomainId(e.category)) === domainId);
  }

  if (hallId && typeof hallId === 'string' && hallId !== 'All') {
    list = list.filter(
      (e) =>
        e.hallId === hallId ||
        e.eligibilityCriteria?.halls?.some((h) => matchesHallName(h, hallId))
    );
  }

  if (facultyId && typeof facultyId === 'string' && facultyId !== 'All') {
    list = list.filter(
      (e) =>
        e.facultyId === facultyId ||
        e.eligibilityCriteria?.faculties?.some((f) => normalizeText(f).includes(normalizeText(facultyId)))
    );
  }

  if (departmentId && typeof departmentId === 'string' && departmentId !== 'All') {
    list = list.filter(
      (e) =>
        e.departmentId === departmentId ||
        e.eligibilityCriteria?.departments?.some((d) =>
          normalizeText(d).includes(normalizeText(departmentId))
        )
    );
  }

  if (category && category !== 'All') {
    list = list.filter((e) => e.category === category);
  }

  if (status && status !== 'All') {
    list = list.filter((e) => e.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.subdomainLabel && e.subdomainLabel.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return res.json({
    success: true,
    total: list.length,
    elections: list
  });
});

/**
 * GET /api/elections/stats/public
 * Authoritative public statistics computed strictly from live database stores
 */
electionRouter.get('/stats/public', (_req: Request, res: Response) => {
  const { registeredStudents, verifiedStudents } = getRegisteredAndVerifiedStudentCounts();
  const publishedElections = Array.from(ELECTIONS_STORE.values()).filter((e) =>
    isElectionPublished(e)
  );
  const uniqueVoters = new Set(
    Array.from(VOTER_PARTICIPATION_VAULT.values()).map((v) => v.studentAccountId)
  );

  const stats: PublicPlatformStats = {
    registeredStudents,
    verifiedStudents,
    totalElections: publishedElections.length,
    activeElections: publishedElections.filter((e) => e.status === 'live').length,
    upcomingElections: publishedElections.filter(
      (e) => e.status === 'scheduled' || e.status === 'upcoming'
    ).length,
    closedElections: publishedElections.filter(
      (e) =>
        e.status === 'closed' ||
        e.status === 'results_pending_certification' ||
        e.status === 'results_published'
    ).length,
    publishedResultsCount: publishedElections.filter(
      (e) => e.status === 'results_published'
    ).length,
    totalVotesCast: ANONYMOUS_BALLOT_VAULT.length,
    uniqueVotersVoted: uniqueVoters.size
  };

  return res.json({
    success: true,
    stats
  });
});

/**
 * GET /api/elections/:id
 * Returns a single election by ID along with its positions
 */
electionRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = getOptionalSessionFromRequest(req);
  const election = ELECTIONS_STORE.get(id);

  if (!election || !isElectionVisibleToSession(election, session)) {
    return res.status(404).json({
      success: false,
      error: `Election with ID '${id}' was not found or is not yet published.`
    });
  }

  const positions = [...(POSITIONS_STORE.get(id) || [])].sort((a, b) => a.order - b.order);

  return res.json({
    success: true,
    election,
    positions
  });
});

/**
 * POST /api/elections/:id/check-eligibility
 * Tests an authenticated student or provided student ID against this election's rules
 */
electionRouter.post('/:id/check-eligibility', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const election = ELECTIONS_STORE.get(id);

  if (!election) {
    return res.status(404).json({ success: false, error: 'Election not found.' });
  }

  const session = (req as any).session as SessionData;
  let targetStudent: any = null;

  if (req.body && req.body.studentId) {
    const rawId = req.body.studentId.trim();
    for (const s of STUDENT_ACCOUNTS.values()) {
      if (s.studentId.toLowerCase() === rawId.toLowerCase() || s.id === rawId) {
        targetStudent = { ...s };
        break;
      }
    }
    if (!targetStudent) {
      targetStudent = STUDENT_ACCOUNTS.get(rawId) || OFFICIAL_UCC_STUDENT_REGISTRY[rawId];
    }
  }

  if (!targetStudent && session && session.userType === 'student') {
    targetStudent = STUDENT_ACCOUNTS.get(session.userId);
    if (!targetStudent) {
      for (const s of STUDENT_ACCOUNTS.values()) {
        if (s.id === session.userId || s.studentId === session.userId) {
          targetStudent = { ...s };
          break;
        }
      }
    }
    if (!targetStudent && session.userId) {
      targetStudent = OFFICIAL_UCC_STUDENT_REGISTRY[session.userId];
    }
  }

  if (!targetStudent && session && session.userType === 'student') {
    targetStudent = STUDENT_ACCOUNTS.get('PS/CSC/22/0089');
  }

  if (!targetStudent) {
    return res.status(400).json({
      success: false,
      error: 'Student profile could not be located for eligibility evaluation.'
    });
  }

  const liveAccount = Array.from(STUDENT_ACCOUNTS.values()).find(
    (s) => s.studentId === targetStudent.studentId || s.id === targetStudent.id
  );
  if (liveAccount && liveAccount.status) {
    targetStudent = { ...targetStudent, status: liveAccount.status };
  }

  const result = verifyStudentEligibility(targetStudent, election);

  return res.json({
    success: true,
    electionId: id,
    studentId: targetStudent.studentId,
    studentName: targetStudent.fullName,
    result
  });
});

// ==========================================
// PROTECTED ADMINISTRATIVE MANAGEMENT ROUTES
// ==========================================

/**
 * POST /api/elections
 * Create a new election (Global admins OR authorized Domain/Subdomain admins for their own scope)
 */
electionRouter.post(
  '/',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const body = req.body || {};

    const {
      title,
      code,
      description,
      category,
      domainId,
      hallId,
      facultyId,
      departmentId,
      subdomainLabel,
      academicYear,
      startDate,
      endDate,
      organizingBody,
      rules,
      eligibilityCriteria,
      positions
    } = body;

    const resolvedDomainId: DomainId = domainId || categoryToDomainId(category);
    const resolvedCategory: ElectionCategory = category || domainIdToCategory(resolvedDomainId);

    if (!title || (!category && !domainId) || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: Title, domain/category, start date, and end date are mandatory.'
      });
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start or closing date format. Use ISO timestamp (YYYY-MM-DD).'
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schedule: Election closing date/time must be strictly after the opening date/time.'
      });
    }

    const parsedCriteria = {
      faculties: Array.isArray(eligibilityCriteria?.faculties) ? eligibilityCriteria.faculties : [],
      departments: Array.isArray(eligibilityCriteria?.departments)
        ? eligibilityCriteria.departments
        : [],
      programmes: Array.isArray(eligibilityCriteria?.programmes) ? eligibilityCriteria.programmes : [],
      levels: Array.isArray(eligibilityCriteria?.levels) ? eligibilityCriteria.levels : [],
      halls: Array.isArray(eligibilityCriteria?.halls) ? eligibilityCriteria.halls : []
    };

    // Enforce GRASAG Postgraduate-only constitutional isolation
    if (resolvedDomainId === 'grasag') {
      parsedCriteria.levels = ['Postgraduate'];
    }

    // Domain & Subdomain RBAC Guard
    const accessCheck = canAdminAccessDomain(session, resolvedDomainId, {
      hall: parsedCriteria.halls[0] || subdomainLabel,
      faculty: parsedCriteria.faculties[0] || subdomainLabel,
      department: parsedCriteria.departments[0] || subdomainLabel
    });

    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: resolvedDomainId,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked election creation in '${resolvedDomainId}': ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const electionId =
      body.id ||
      `UCC-${resolvedCategory.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    if (ELECTIONS_STORE.has(electionId)) {
      return res.status(409).json({
        success: false,
        error: `An election with identifier '${electionId}' already exists.`
      });
    }

    const now = Date.now();
    const explicitDraft = body.isDraft === true || body.isPublished === false || body.status === 'draft';
    let initialStatus: ElectionStatus = body.status || (explicitDraft ? 'draft' : 'scheduled');
    if (!body.status && !explicitDraft) {
      if (start > now) initialStatus = 'scheduled';
      else if (start <= now && end > now) initialStatus = 'live';
      else initialStatus = 'closed';
    }
    const isPublished =
      body.isPublished !== undefined
        ? Boolean(body.isPublished)
        : initialStatus !== 'draft' && initialStatus !== 'pending_approval';

    const calculatedEligible = calculateEligibleVoterCount(parsedCriteria, resolvedDomainId);

    const baseElection: Election = {
      id: electionId,
      title: title.trim(),
      code: code
        ? code.trim().toUpperCase()
        : `${resolvedCategory.replace(/[^A-Z]/gi, '').substring(0, 4).toUpperCase()}-${academicYear || '2026'}-${Date.now().toString().slice(-3)}`,
      description: description ? description.trim() : 'Officially sanctioned UCC election.',
      category: resolvedCategory,
      domainId: resolvedDomainId,
      hallId,
      facultyId,
      departmentId,
      subdomainLabel,
      academicYear: academicYear || '2026/2027',
      status: initialStatus,
      isPublished,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      startTime: body.startTime || '08:00',
      endTime: body.endTime || '17:00',
      totalEligibleVoters: calculatedEligible,
      totalVotesCast: 0,
      turnoutPercentage: 0,
      organizingBody: organizingBody ? organizingBody.trim() : 'UCC Electoral Commission (EC-UCC)',
      eligibilityCriteria: parsedCriteria,
      rules:
        Array.isArray(rules) && rules.length > 0
          ? rules
          : [
              'One verified vote per accredited student per contested portfolio.',
              'Ballot secrecy is cryptographically preserved; votes are decoupled from voter identities.',
              'Voting closes automatically at official scheduled time.'
            ],
      positionsCount: Array.isArray(positions) ? positions.length : body.positionsCount || 0,
      allowsEmptyBallot: Boolean(body.allowsEmptyBallot),
      resultsCertified: false,
      provisionalResultsReady: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: session.userId
    };

    const newElection = enrichElectionDomainRelations(baseElection);
    ELECTIONS_STORE.set(electionId, newElection);

    if (Array.isArray(positions) && positions.length > 0) {
      const formattedPositions: Position[] = positions.map((p: any, idx: number) => ({
        id: p.id || `pos-${electionId}-${idx + 1}`,
        electionId,
        domainId: newElection.domainId,
        hallId: newElection.hallId,
        facultyId: newElection.facultyId,
        departmentId: newElection.departmentId,
        title: p.title,
        description: p.description || `Contested portfolio for ${p.title}`,
        maxSelections: p.maxSelections || 1,
        allowsSkip: p.allowsSkip ?? false,
        order: p.order || idx + 1,
        candidateIds: p.candidateIds || [],
        candidateEligibilityRules:
          p.candidateEligibilityRules || 'Registered student in good standing.',
        votingRules: p.votingRules || 'Single choice vote'
      }));
      POSITIONS_STORE.set(electionId, formattedPositions);
      newElection.positionsCount = formattedPositions.length;
    } else {
      POSITIONS_STORE.set(electionId, []);
    }

    logAuditEvent({
      eventType: 'CREATE_ELECTION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Created new ${newElection.category} (${newElection.domainId}) election: "${title}" (ID: ${electionId}, Status: ${initialStatus}, Published: ${isPublished}).`
    });

    if (isElectionPublished(newElection)) {
      pushPlatformNotification({
        title: `${newElection.title} ${newElection.status === 'live' ? 'Polling Now Live' : 'Published'}`,
        message: `${newElection.category}${newElection.subdomainLabel ? ` (${newElection.subdomainLabel})` : ''} election has been published by the Electoral Commission.`,
        category: 'election',
        domainId: newElection.domainId,
        linkAction: 'domain_elections'
      });
    }

    persistPlatformState();
    broadcastSyncEvent('election:created', {
      electionId,
      domainId: newElection.domainId
    });

    return res.status(201).json({
      success: true,
      message: `Election '${title}' created successfully.`,
      election: newElection,
      positions: POSITIONS_STORE.get(electionId) || []
    });
  }
);

/**
 * PUT /api/elections/:id
 * Update election details (Scoped by domain/subdomain RBAC)
 */
electionRouter.put(
  '/:id',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const existing = ELECTIONS_STORE.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, existing);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked election update for ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    if (existing.status === 'archived') {
      return res.status(400).json({
        success: false,
        error: 'Archived elections are immutable and cannot be modified.'
      });
    }

    const {
      title,
      code,
      description,
      category,
      domainId,
      hallId,
      facultyId,
      departmentId,
      subdomainLabel,
      academicYear,
      startDate,
      endDate,
      startTime,
      endTime,
      organizingBody,
      rules,
      eligibilityCriteria,
      isPublished,
      allowsEmptyBallot
    } = req.body || {};

    const nextStart = startDate ? new Date(startDate).getTime() : new Date(existing.startDate).getTime();
    const nextEnd = endDate ? new Date(endDate).getTime() : new Date(existing.endDate).getTime();

    if (isNaN(nextStart) || isNaN(nextEnd)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start or closing date format.'
      });
    }

    if (nextEnd <= nextStart) {
      return res.status(400).json({
        success: false,
        error: 'Closing date must be strictly after opening date.'
      });
    }

    const nextDomainId: DomainId =
      domainId || (category ? categoryToDomainId(category) : existing.domainId || categoryToDomainId(existing.category));
    const nextCategory: ElectionCategory =
      category || (domainId ? domainIdToCategory(domainId) : existing.category);

    const mergedCriteria = eligibilityCriteria
      ? {
          faculties: Array.isArray(eligibilityCriteria.faculties)
            ? eligibilityCriteria.faculties
            : existing.eligibilityCriteria?.faculties || [],
          departments: Array.isArray(eligibilityCriteria.departments)
            ? eligibilityCriteria.departments
            : existing.eligibilityCriteria?.departments || [],
          programmes: Array.isArray(eligibilityCriteria.programmes)
            ? eligibilityCriteria.programmes
            : existing.eligibilityCriteria?.programmes || [],
          levels: Array.isArray(eligibilityCriteria.levels)
            ? eligibilityCriteria.levels
            : existing.eligibilityCriteria?.levels || [],
          halls: Array.isArray(eligibilityCriteria.halls)
            ? eligibilityCriteria.halls
            : existing.eligibilityCriteria?.halls || []
        }
      : existing.eligibilityCriteria;

    if (nextDomainId === 'grasag') {
      mergedCriteria.levels = ['Postgraduate'];
    }

    // Check target domain RBAC if category/domain changed
    const domainAccess = canAdminAccessDomain(session, nextDomainId, {
      hall: mergedCriteria?.halls?.[0] || subdomainLabel || existing.subdomainLabel,
      faculty: mergedCriteria?.faculties?.[0] || subdomainLabel || existing.subdomainLabel,
      department: mergedCriteria?.departments?.[0] || subdomainLabel || existing.subdomainLabel
    });
    if (!domainAccess.allowed) {
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: domainAccess.reason
      });
    }

    let nextStatus = existing.status;
    let nextPublished = existing.isPublished !== false && existing.status !== 'draft' && existing.status !== 'pending_approval';
    if (typeof isPublished === 'boolean') {
      nextPublished = isPublished;
      if (!isPublished && (existing.status === 'scheduled' || existing.status === 'upcoming')) {
        nextStatus = 'draft';
      } else if (isPublished && (existing.status === 'draft' || existing.status === 'pending_approval')) {
        const now = Date.now();
        if (nextStart > now) nextStatus = 'scheduled';
        else if (nextEnd > now) nextStatus = 'live';
        else nextStatus = 'closed';
      }
    }

    const recalculatedEligible = calculateEligibleVoterCount(mergedCriteria, nextDomainId);
    const updatedTurnout =
      recalculatedEligible > 0
        ? Number(((existing.totalVotesCast / recalculatedEligible) * 100).toFixed(1))
        : existing.turnoutPercentage;

    const updated: Election = enrichElectionDomainRelations({
      ...existing,
      title: title !== undefined ? title.trim() : existing.title,
      code: code !== undefined && code.trim() ? code.trim().toUpperCase() : existing.code,
      description: description !== undefined ? description.trim() : existing.description,
      category: nextCategory,
      domainId: nextDomainId,
      hallId: hallId !== undefined ? hallId : existing.hallId,
      facultyId: facultyId !== undefined ? facultyId : existing.facultyId,
      departmentId: departmentId !== undefined ? departmentId : existing.departmentId,
      subdomainLabel: subdomainLabel !== undefined ? subdomainLabel : existing.subdomainLabel,
      academicYear: academicYear !== undefined ? academicYear : existing.academicYear,
      status: nextStatus,
      isPublished: nextPublished,
      startDate: startDate ? new Date(startDate).toISOString() : existing.startDate,
      endDate: endDate ? new Date(endDate).toISOString() : existing.endDate,
      startTime: startTime !== undefined ? startTime : existing.startTime,
      endTime: endTime !== undefined ? endTime : existing.endTime,
      organizingBody: organizingBody !== undefined ? organizingBody.trim() : existing.organizingBody,
      rules: Array.isArray(rules) ? rules : existing.rules,
      eligibilityCriteria: mergedCriteria,
      allowsEmptyBallot:
        allowsEmptyBallot !== undefined ? Boolean(allowsEmptyBallot) : existing.allowsEmptyBallot,
      totalEligibleVoters: recalculatedEligible,
      turnoutPercentage: updatedTurnout,
      updatedAt: new Date().toISOString()
    });

    ELECTIONS_STORE.set(id, updated);

    // Cascade relational domain/unit IDs to positions and candidates belonging to this election
    const elPositions = POSITIONS_STORE.get(id);
    if (elPositions) {
      elPositions.forEach((p) => {
        p.domainId = updated.domainId;
        p.hallId = updated.hallId;
        p.facultyId = updated.facultyId;
        p.departmentId = updated.departmentId;
      });
      POSITIONS_STORE.set(id, elPositions);
    }

    for (const [candId, cand] of CANDIDATES_STORE.entries()) {
      if (cand.electionId === id) {
        cand.domainId = updated.domainId;
        cand.hallId = updated.hallId;
        cand.facultyId = updated.facultyId;
        cand.departmentId = updated.departmentId;
        CANDIDATES_STORE.set(candId, cand);
      }
    }

    logAuditEvent({
      eventType: 'UPDATE_ELECTION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Updated parameters for election ${id} ("${updated.title}").`
    });

    persistPlatformState();
    broadcastSyncEvent('election:updated', {
      electionId: id,
      domainId: updated.domainId
    });

    return res.json({
      success: true,
      message: `Election '${updated.title}' updated successfully.`,
      election: updated
    });
  }
);

/**
 * DELETE /api/elections/:id
 * Delete an unpublished/draft or un-voted scheduled election (Domain-RBAC scoped)
 */
electionRouter.delete(
  '/:id',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const existing = ELECTIONS_STORE.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, existing);
    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    if (existing.totalVotesCast > 0 || existing.status === 'live' || existing.status === 'results_published') {
      return res.status(400).json({
        success: false,
        error: 'Elections with live polls, cast votes, or published results cannot be deleted.'
      });
    }

    ELECTIONS_STORE.delete(id);
    POSITIONS_STORE.delete(id);
    BALLOT_LEDGER_STORE.delete(id);
    for (const [candId, cand] of CANDIDATES_STORE.entries()) {
      if (cand.electionId === id) {
        CANDIDATES_STORE.delete(candId);
      }
    }

    logAuditEvent({
      eventType: 'DELETE_ELECTION',
      userId: session.userId,
      identifier: id,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Deleted election ${id} ("${existing.title}").`
    });

    persistPlatformState();
    broadcastSyncEvent('election:deleted', {
      electionId: id,
      domainId: existing.domainId
    });

    return res.json({
      success: true,
      message: `Election '${existing.title}' deleted successfully.`
    });
  }
);

/**
 * PATCH /api/elections/:id/status
 * Perform state machine transition (Scoped by domain/subdomain RBAC)
 */
electionRouter.patch(
  '/:id/status',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { newStatus, justification } = req.body || {};
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked status transition on ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    if (!newStatus) {
      return res.status(400).json({ success: false, error: 'Target newStatus is required.' });
    }

    const currentStatus = election.status;
    if (!isValidTransition(currentStatus, newStatus as ElectionStatus)) {
      const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      return res.status(400).json({
        success: false,
        error: `Illegal state transition: Cannot change status from '${currentStatus}' to '${newStatus}'. Allowed transitions from '${currentStatus}': [${allowed.join(', ')}].`
      });
    }

    const previousPublished = isElectionPublished(election);
    election.status = newStatus as ElectionStatus;
    election.isPublished = newStatus !== 'draft' && newStatus !== 'pending_approval';
    election.updatedAt = new Date().toISOString();

    // When admin explicitly opens voting now, ensure voting window starts immediately if scheduled for future
    if (newStatus === 'live') {
      const nowMs = Date.now();
      const startMs = new Date(election.startDate).getTime();
      const endMs = new Date(election.endDate).getTime();
      if (isNaN(startMs) || startMs > nowMs) {
        election.startDate = new Date(nowMs).toISOString();
      }
      if (isNaN(endMs) || endMs <= nowMs) {
        election.endDate = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
      }
    }

    if (newStatus === 'results_published') {
      election.resultsCertified = true;
      election.provisionalResultsReady = true;
    }

    ELECTIONS_STORE.set(id, election);

    logAuditEvent({
      eventType: 'ELECTION_STATUS_CHANGE',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Transitioned election ${id} from '${currentStatus}' to '${newStatus}'. Justification: ${justification || 'Administrative order'}.`
    });

    if (newStatus === 'live') {
      pushPlatformNotification({
        title: `Voting Open: ${election.title}`,
        message: `Polls are now open for ${election.category}${election.subdomainLabel ? ` (${election.subdomainLabel})` : ''}. Cast your verified ballot before polling closes.`,
        category: 'election',
        domainId: election.domainId,
        linkAction: 'domain_elections'
      });
    } else if (newStatus === 'closed') {
      pushPlatformNotification({
        title: `Polls Closed: ${election.title}`,
        message: `Official polling has concluded for ${election.title}. Results are proceeding to Electoral Commission verification.`,
        category: 'deadline',
        domainId: election.domainId,
        linkAction: 'election_results'
      });
    } else if (!previousPublished && election.isPublished) {
      pushPlatformNotification({
        title: `Election Published: ${election.title}`,
        message: `${election.title} has been scheduled and published to eligible voters.`,
        category: 'election',
        domainId: election.domainId,
        linkAction: 'domain_elections'
      });
    }

    persistPlatformState();
    broadcastSyncEvent('election:status', {
      electionId: id,
      domainId: election.domainId
    });

    return res.json({
      success: true,
      message: `Election '${election.title}' is now ${newStatus.toUpperCase()}.`,
      election
    });
  }
);

/**
 * GET /api/elections/:id/positions
 * Return positions for a given election (enforcing visibility rules)
 */
electionRouter.get('/:id/positions', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = getOptionalSessionFromRequest(req);
  const election = ELECTIONS_STORE.get(id);
  if (!election || !isElectionVisibleToSession(election, session)) {
    return res.status(404).json({ success: false, error: 'Election not found.' });
  }
  const positions = [...(POSITIONS_STORE.get(id) || [])].sort((a, b) => a.order - b.order);
  return res.json({ success: true, positions });
});

/**
 * POST /api/elections/:id/positions
 * Add a new contested position to an election (Dynamic per hall / Local NUGS / domain rules)
 */
electionRouter.post(
  '/:id/positions',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked creating position on ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const {
      title,
      description,
      maxSelections,
      allowsSkip,
      candidateEligibilityRules,
      votingRules
    } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Position title is mandatory.' });
    }

    const existingPositions = POSITIONS_STORE.get(id) || [];
    const newPosition: Position = {
      id: `pos-${id}-${Date.now().toString().slice(-4)}-${existingPositions.length + 1}`,
      electionId: id,
      domainId: election.domainId || categoryToDomainId(election.category),
      hallId: election.hallId,
      facultyId: election.facultyId,
      departmentId: election.departmentId,
      title: title.trim(),
      description: description?.trim() || `Portfolio for ${title.trim()}`,
      maxSelections: maxSelections || 1,
      allowsSkip: allowsSkip ?? false,
      order: existingPositions.length + 1,
      candidateIds: [],
      candidateEligibilityRules: candidateEligibilityRules || 'Accredited student in good standing.',
      votingRules: votingRules || 'Single candidate preference'
    };

    existingPositions.push(newPosition);
    POSITIONS_STORE.set(id, existingPositions);

    election.positionsCount = existingPositions.length;
    election.updatedAt = new Date().toISOString();
    ELECTIONS_STORE.set(id, election);

    logAuditEvent({
      eventType: 'CREATE_POSITION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Added position '${newPosition.title}' to election ${id}.`
    });

    persistPlatformState();
    broadcastSyncEvent('position:updated', {
      electionId: id,
      domainId: election.domainId,
      positionId: newPosition.id
    });

    return res.status(201).json({
      success: true,
      message: `Position '${newPosition.title}' added successfully.`,
      position: newPosition,
      allPositions: existingPositions
    });
  }
);

/**
 * PUT /api/elections/:id/positions/:posId
 * Update a position's title, description, or voting parameters dynamically
 */
electionRouter.put(
  '/:id/positions/:posId',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id, posId } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked position update on ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const positions = POSITIONS_STORE.get(id) || [];
    const target = positions.find((p) => p.id === posId);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Position not found.' });
    }

    const { title, description, maxSelections, allowsSkip, candidateEligibilityRules, votingRules } =
      req.body || {};
    if (title !== undefined && title.trim()) target.title = title.trim();
    if (description !== undefined) target.description = description.trim();
    if (typeof maxSelections === 'number' && maxSelections >= 1) target.maxSelections = maxSelections;
    if (typeof allowsSkip === 'boolean') target.allowsSkip = allowsSkip;
    if (candidateEligibilityRules !== undefined) {
      target.candidateEligibilityRules = candidateEligibilityRules;
    }
    if (votingRules !== undefined) target.votingRules = votingRules;

    POSITIONS_STORE.set(id, positions);
    election.updatedAt = new Date().toISOString();
    ELECTIONS_STORE.set(id, election);

    logAuditEvent({
      eventType: 'UPDATE_POSITION',
      userId: session.userId,
      identifier: posId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Updated position '${target.title}' in election ${id}.`
    });

    persistPlatformState();
    broadcastSyncEvent('position:updated', {
      electionId: id,
      domainId: election.domainId,
      positionId: posId
    });

    return res.json({
      success: true,
      message: `Position '${target.title}' updated successfully.`,
      position: target,
      allPositions: positions
    });
  }
);

/**
 * DELETE /api/elections/:id/positions/:posId
 * Delete a contested position from an election (Scoped by domain RBAC)
 */
electionRouter.delete(
  '/:id/positions/:posId',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id, posId } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked position deletion on ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    if (election.status === 'live' || election.status === 'closed') {
      return res.status(400).json({
        success: false,
        error: `Cannot remove positions from an election with status '${election.status}'. Ballots may have already been rendered or cast.`
      });
    }

    const existingPositions = POSITIONS_STORE.get(id) || [];
    const filtered = existingPositions.filter((p) => p.id !== posId);

    if (filtered.length === existingPositions.length) {
      return res.status(404).json({ success: false, error: 'Position not found.' });
    }

    filtered.forEach((p, idx) => {
      p.order = idx + 1;
    });

    POSITIONS_STORE.set(id, filtered);
    election.positionsCount = filtered.length;
    election.updatedAt = new Date().toISOString();
    ELECTIONS_STORE.set(id, election);

    logAuditEvent({
      eventType: 'DELETE_POSITION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Removed position ${posId} from election ${id}.`
    });

    persistPlatformState();
    broadcastSyncEvent('position:updated', {
      electionId: id,
      domainId: election.domainId,
      positionId: posId
    });

    return res.json({
      success: true,
      message: 'Position deleted successfully.',
      remainingPositions: filtered
    });
  }
);
