import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import {
  ALL_MANAGING_ADMIN_ROLES,
  canAdminManageElection,
  requireAdminRole
} from './adminRoutes.ts';
import {
  ELECTIONS_STORE,
  POSITIONS_STORE,
  CANDIDATES_STORE,
  isElectionVisibleToSession,
  verifyCandidateCandidacyEligibility
} from './electionStore.ts';
import { categoryToDomainId, matchesHallName } from './domainStore.ts';
import {
  findStudentAccountByIdentifier,
  getOptionalSessionFromRequest,
  logAuditEvent
} from './authStore.ts';
import type { SessionData } from './authStore.ts';
import { broadcastSyncEvent } from './realtimeBus.ts';
import { persistPlatformState } from './statePersistence.ts';
import type { Candidate, CandidateApplicationStatus } from '../types/index.ts';

export const candidateRouter = Router();

/**
 * GET /api/candidates or /api/elections/candidates
 * Retrieve candidates list strictly tagged and filterable by domain, election, and position
 */
candidateRouter.get('/', (req: Request, res: Response) => {
  const { domainId, electionId, positionId, status, approvedOnly, search, department, faculty, hall } =
    req.query;
  const session = getOptionalSessionFromRequest(req);
  const isAdmin = Boolean(session && session.userType === 'admin');
  const sessionStudent =
    session && session.userType === 'student' ? findStudentAccountByIdentifier(session.userId) : undefined;

  let list = Array.from(CANDIDATES_STORE.values()).filter((c) => {
    const parentElection = ELECTIONS_STORE.get(c.electionId);
    if (!parentElection || !isElectionVisibleToSession(parentElection, session)) {
      return false;
    }
    if (!isAdmin) {
      const isOwnApplication =
        sessionStudent && c.studentId.toUpperCase() === sessionStudent.studentId.toUpperCase();
      if (!isOwnApplication && c.applicationStatus !== 'Approved') {
        return false;
      }
    }
    return true;
  });

  if (domainId && typeof domainId === 'string' && domainId !== 'All') {
    list = list.filter((c) => {
      const candDomain =
        c.domainId || categoryToDomainId(ELECTIONS_STORE.get(c.electionId)?.category);
      return candDomain === domainId;
    });
  }

  if (electionId && electionId !== 'All') {
    list = list.filter((c) => c.electionId === electionId);
  }

  if (positionId && positionId !== 'All') {
    list = list.filter((c) => c.positionId === positionId);
  }

  if (status && status !== 'All') {
    list = list.filter((c) => c.applicationStatus === status);
  }

  if (approvedOnly === 'true') {
    list = list.filter((c) => c.applicationStatus === 'Approved');
  }

  if (department && department !== 'All') {
    list = list.filter((c) =>
      c.department.toLowerCase().includes((department as string).toLowerCase())
    );
  }

  if (faculty && faculty !== 'All') {
    list = list.filter((c) => c.faculty.toLowerCase().includes((faculty as string).toLowerCase()));
  }

  if (hall && hall !== 'All') {
    list = list.filter((c) => matchesHallName(c.hall, hall as string));
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q)) ||
        c.studentId.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.faculty.toLowerCase().includes(q) ||
        c.manifestoSummary.toLowerCase().includes(q)
    );
  }

  return res.json({
    success: true,
    total: list.length,
    candidates: list
  });
});

/**
 * GET /api/candidates/:id
 * Retrieve a specific candidate's full profile (enforcing election & approval visibility)
 */
candidateRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = getOptionalSessionFromRequest(req);
  const candidate = CANDIDATES_STORE.get(id);

  if (!candidate) {
    return res.status(404).json({ success: false, error: 'Candidate record not found.' });
  }

  const parentElection = ELECTIONS_STORE.get(candidate.electionId);
  if (!parentElection || !isElectionVisibleToSession(parentElection, session)) {
    return res.status(404).json({ success: false, error: 'Candidate record not found.' });
  }

  const isAdmin = Boolean(session && session.userType === 'admin');
  const sessionStudent =
    session && session.userType === 'student' ? findStudentAccountByIdentifier(session.userId) : undefined;
  const isOwnApplication =
    sessionStudent && candidate.studentId.toUpperCase() === sessionStudent.studentId.toUpperCase();

  if (!isAdmin && !isOwnApplication && candidate.applicationStatus !== 'Approved') {
    return res.status(404).json({ success: false, error: 'Candidate record not found.' });
  }

  return res.json({
    success: true,
    candidate
  });
});

/**
 * POST /api/candidates
 * Register candidate nomination application (strictly bound to electionId & positionId within same election/domain)
 */
candidateRouter.post('/', (req: Request, res: Response) => {
  const session = getOptionalSessionFromRequest(req);
  const ipAddress =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  const {
    fullName,
    studentId,
    email,
    department,
    faculty,
    programme,
    level,
    hall,
    electionId,
    positionId,
    photoUrl,
    biography,
    leadershipExperience,
    manifestoSummary,
    fullManifesto,
    keyPromises,
    videoUrl,
    isDraft,
    nickname
  } = req.body || {};

  if (!fullName || !studentId || !electionId || !positionId) {
    return res.status(400).json({
      success: false,
      error:
        'Missing mandatory candidate details: Full Name, Student ID, Election, and Position are required.'
    });
  }

  const election = ELECTIONS_STORE.get(electionId);
  if (!election) {
    return res.status(400).json({ success: false, error: 'Target election does not exist.' });
  }

  // If submitted by an admin session, enforce domain/subdomain RBAC
  if (session && session.userType === 'admin') {
    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: electionId,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked candidate nomination creation in ${electionId}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }
  }

  const positions = POSITIONS_STORE.get(electionId) || [];
  const pos = positions.find((p) => p.id === positionId && p.electionId === electionId);
  if (!pos) {
    return res.status(400).json({
      success: false,
      error: 'Target position does not exist for this election. Cross-election or cross-domain candidate assignments are prohibited.'
    });
  }

  const newId = `cand-${Date.now()}`;
  const initialStatus: CandidateApplicationStatus = isDraft ? 'Draft' : 'Submitted';
  const domId = election.domainId || categoryToDomainId(election.category);

  const candidate: Candidate = {
    id: newId,
    electionId,
    positionId,
    domainId: domId,
    hallId: election.hallId,
    facultyId: election.facultyId,
    departmentId: election.departmentId,
    fullName: fullName.trim(),
    studentId: studentId.trim().toUpperCase(),
    nickname: nickname ? nickname.trim() : undefined,
    email: email ? email.trim() : `${studentId.toLowerCase().replace(/\//g, '.')}@st.ucc.edu.gh`,
    department: department ? department.trim() : 'General Studies',
    faculty: faculty ? faculty.trim() : 'University of Cape Coast',
    programme: programme ? programme.trim() : 'Undergraduate Degree',
    level: level || (domId === 'grasag' ? 'Postgraduate' : '300'),
    hall: hall || 'Casely Hayford Hall',
    photoUrl: photoUrl || '/src/assets/images/candidate_male_glasses_1794364322323.jpg',
    biography: biography ? biography.trim() : '',
    manifestoSummary: manifestoSummary
      ? manifestoSummary.trim()
      : 'Committed to student welfare and academic excellence.',
    fullManifesto: Array.isArray(fullManifesto)
      ? fullManifesto
      : fullManifesto
      ? [fullManifesto]
      : ['Dedicated to serving the student body of UCC with integrity and transparency.'],
    keyPromises: Array.isArray(keyPromises)
      ? keyPromises
      : keyPromises
      ? [keyPromises]
      : ['Prompt response to student grievances', 'Fiscal accountability in council affairs'],
    leadershipExperience: Array.isArray(leadershipExperience)
      ? leadershipExperience
      : leadershipExperience
      ? [leadershipExperience]
      : ['Active member of UCC Student Body'],
    videoUrl: videoUrl ? videoUrl.trim() : undefined,
    applicationStatus: initialStatus,
    submittedAt: isDraft ? undefined : new Date().toISOString(),
    votesReceived: 0,
    votePercentage: 0
  };

  const eligibilityResult = verifyCandidateCandidacyEligibility(candidate, election);
  candidate.eligibilityVerified = eligibilityResult.isEligible;
  candidate.eligibilityDetails = eligibilityResult.details;

  CANDIDATES_STORE.set(newId, candidate);

  logAuditEvent({
    eventType: 'SUBMIT_CANDIDATE_APPLICATION',
    userId: session?.userId || studentId,
    identifier: studentId,
    role: session?.role || 'student',
    ipAddress,
    status: 'SUCCESS',
    details: `Candidate nomination registered for ${fullName} (${newId}) in election ${election.code} [${domId}] as ${initialStatus}.`
  });

  persistPlatformState();
  broadcastSyncEvent('candidate:created', {
    electionId,
    domainId: domId,
    candidateId: newId,
    positionId
  });

  return res.status(201).json({
    success: true,
    message: isDraft
      ? 'Candidate application saved as draft.'
      : 'Candidate application submitted successfully for vetting.',
    candidate
  });
});

/**
 * PUT /api/candidates/:id
 * Update candidate information / photograph / manifesto details
 */
candidateRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = getOptionalSessionFromRequest(req);
  const ipAddress =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const existing = CANDIDATES_STORE.get(id);

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Candidate not found.' });
  }

  const updates = req.body || {};
  const targetElectionId = updates.electionId || existing.electionId;
  const targetPositionId = updates.positionId || existing.positionId;

  const targetElection = ELECTIONS_STORE.get(targetElectionId);
  if (!targetElection) {
    return res.status(400).json({ success: false, error: 'Target election does not exist.' });
  }

  if (session?.userType === 'admin') {
    const accessCheck = canAdminManageElection(session, targetElection);
    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }
  } else if (session?.userType === 'student') {
    const studentAcc = findStudentAccountByIdentifier(session.userId);
    if (!studentAcc || studentAcc.studentId.toUpperCase() !== existing.studentId.toUpperCase()) {
      return res.status(403).json({
        success: false,
        error: 'Students can only update their own candidate nomination profile.'
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      error: 'Authentication required to modify candidate profiles.'
    });
  }

  const targetPositions = POSITIONS_STORE.get(targetElectionId) || [];
  if (!targetPositions.some((p) => p.id === targetPositionId)) {
    return res.status(400).json({
      success: false,
      error: 'Target position does not belong to the specified election.'
    });
  }

  // Keep POSITIONS_STORE candidateIds synced if election or position changed
  if (existing.electionId !== targetElectionId || existing.positionId !== targetPositionId) {
    const prevPositions = POSITIONS_STORE.get(existing.electionId) || [];
    const prevPos = prevPositions.find((p) => p.id === existing.positionId);
    if (prevPos) {
      prevPos.candidateIds = prevPos.candidateIds.filter((cid) => cid !== id);
      POSITIONS_STORE.set(existing.electionId, prevPositions);
    }
  }

  const updated: Candidate = {
    ...existing,
    ...updates,
    id,
    electionId: targetElectionId,
    positionId: targetPositionId,
    domainId: targetElection.domainId || categoryToDomainId(targetElection.category),
    hallId: targetElection.hallId,
    facultyId: targetElection.facultyId,
    departmentId: targetElection.departmentId
  };

  if (updates.resubmit) {
    updated.applicationStatus = 'Submitted';
    updated.submittedAt = new Date().toISOString();
    updated.correctionNotes = undefined;
    updated.rejectionReason = undefined;
  }

  if (updated.applicationStatus === 'Approved') {
    const nextPos = targetPositions.find((p) => p.id === targetPositionId);
    if (nextPos && !nextPos.candidateIds.includes(id)) {
      nextPos.candidateIds.push(id);
      POSITIONS_STORE.set(targetElectionId, targetPositions);
    }
  }

  CANDIDATES_STORE.set(id, updated);

  logAuditEvent({
    eventType: 'UPDATE_CANDIDATE_PROFILE',
    userId: session?.userId || updated.studentId,
    identifier: updated.studentId,
    role: session?.role || 'student',
    ipAddress,
    status: 'SUCCESS',
    details: `Updated details and credentials for candidate ${updated.fullName} (${id}).`
  });

  persistPlatformState();
  broadcastSyncEvent('candidate:updated', {
    electionId: updated.electionId,
    domainId: updated.domainId,
    candidateId: id,
    positionId: updated.positionId
  });

  return res.json({
    success: true,
    message: 'Candidate profile updated successfully.',
    candidate: updated
  });
});

/**
 * POST /api/candidates/:id/verify-eligibility
 * Run automated verification against official UCC student registry
 */
candidateRouter.post('/:id/verify-eligibility', (req: Request, res: Response) => {
  const { id } = req.params;
  const candidate = CANDIDATES_STORE.get(id);

  if (!candidate) {
    return res.status(404).json({ success: false, error: 'Candidate not found.' });
  }

  const election = ELECTIONS_STORE.get(candidate.electionId);
  if (!election) {
    return res.status(404).json({ success: false, error: 'Election not found for this candidate.' });
  }

  const result = verifyCandidateCandidacyEligibility(candidate, election);
  candidate.eligibilityVerified = result.isEligible;
  candidate.eligibilityDetails = result.details;
  CANDIDATES_STORE.set(id, candidate);

  return res.json({
    success: true,
    isEligible: result.isEligible,
    reason: result.reason,
    details: result.details,
    candidate
  });
});

/**
 * POST /api/candidates/:id/approve
 * Administrator approval of candidate nomination (Scoped by domain/subdomain RBAC)
 */
candidateRouter.post(
  '/:id/approve',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const candidate = CANDIDATES_STORE.get(id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const election = ELECTIONS_STORE.get(candidate.electionId);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Associated election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: candidate.id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked candidate approval for ${candidate.id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const positions = POSITIONS_STORE.get(candidate.electionId) || [];
    const pos = positions.find((p) => p.id === candidate.positionId);
    if (!pos) {
      return res.status(400).json({
        success: false,
        error: 'Position not found for candidate in this election.'
      });
    }

    candidate.applicationStatus = 'Approved';
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewedBy = session.userId || 'Electoral Commission Vetting Committee';
    candidate.rejectionReason = undefined;
    candidate.correctionNotes = undefined;
    candidate.eligibilityVerified = true;

    if (!pos.candidateIds.includes(candidate.id)) {
      pos.candidateIds.push(candidate.id);
      POSITIONS_STORE.set(candidate.electionId, positions);
    }

    CANDIDATES_STORE.set(id, candidate);

    logAuditEvent({
      eventType: 'APPROVE_CANDIDATE_NOMINATION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Approved candidate ${candidate.fullName} (${candidate.studentId}) for portfolio ${pos.title} in election ${election.code}.`
    });

    persistPlatformState();
    broadcastSyncEvent('candidate:approved', {
      electionId: candidate.electionId,
      domainId: candidate.domainId || election.domainId,
      candidateId: id,
      positionId: candidate.positionId
    });

    return res.json({
      success: true,
      message: `Candidate ${candidate.fullName} has been approved and added to the official ballot for ${pos.title}.`,
      candidate
    });
  }
);

/**
 * POST /api/candidates/:id/reject
 * Administrator rejection of candidate nomination with stated reason (Scoped by domain RBAC)
 */
candidateRouter.post(
  '/:id/reject',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error:
          'A specific constitutional or academic reason is required to reject a candidate application.'
      });
    }

    const candidate = CANDIDATES_STORE.get(id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const election = ELECTIONS_STORE.get(candidate.electionId);
    if (election) {
      const accessCheck = canAdminManageElection(session, election);
      if (!accessCheck.allowed) {
        logAuditEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          userId: session.userId,
          identifier: candidate.id,
          role: session.role,
          ipAddress,
          status: 'FLAGGED',
          details: `Domain RBAC blocked candidate rejection for ${candidate.id}: ${accessCheck.reason}`
        });
        return res.status(403).json({
          success: false,
          code: 'DOMAIN_RBAC_DENIED',
          error: accessCheck.reason
        });
      }
    }

    candidate.applicationStatus = 'Rejected';
    candidate.rejectionReason = reason.trim();
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewedBy = session.userId || 'Electoral Commission Vetting Committee';

    const positions = POSITIONS_STORE.get(candidate.electionId) || [];
    const pos = positions.find((p) => p.id === candidate.positionId);
    if (pos) {
      pos.candidateIds = pos.candidateIds.filter((cid) => cid !== candidate.id);
      POSITIONS_STORE.set(candidate.electionId, positions);
    }

    CANDIDATES_STORE.set(id, candidate);

    logAuditEvent({
      eventType: 'REJECT_CANDIDATE_NOMINATION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Rejected candidate nomination for ${candidate.fullName} (${candidate.studentId}). Reason: ${reason.trim()}`
    });

    persistPlatformState();
    broadcastSyncEvent('candidate:rejected', {
      electionId: candidate.electionId,
      domainId: candidate.domainId,
      candidateId: id,
      positionId: candidate.positionId
    });

    return res.json({
      success: true,
      message: `Candidate application for ${candidate.fullName} has been marked as Rejected.`,
      candidate
    });
  }
);

/**
 * POST /api/candidates/:id/request-corrections
 * Request corrections from candidate (Scoped by domain RBAC)
 */
candidateRouter.post(
  '/:id/request-corrections',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body || {};
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!notes || !notes.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Correction notes describing required revisions are required.'
      });
    }

    const candidate = CANDIDATES_STORE.get(id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const election = ELECTIONS_STORE.get(candidate.electionId);
    if (election) {
      const accessCheck = canAdminManageElection(session, election);
      if (!accessCheck.allowed) {
        logAuditEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          userId: session.userId,
          identifier: candidate.id,
          role: session.role,
          ipAddress,
          status: 'FLAGGED',
          details: `Domain RBAC blocked correction request for ${candidate.id}: ${accessCheck.reason}`
        });
        return res.status(403).json({
          success: false,
          code: 'DOMAIN_RBAC_DENIED',
          error: accessCheck.reason
        });
      }
    }

    candidate.applicationStatus = 'Under review';
    candidate.correctionNotes = notes.trim();
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewedBy = session.userId || 'Electoral Commission Vetting Committee';

    CANDIDATES_STORE.set(id, candidate);

    logAuditEvent({
      eventType: 'REQUEST_CANDIDATE_CORRECTIONS',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Requested revisions from candidate ${candidate.fullName} (${candidate.studentId}). Notes: ${notes.trim()}`
    });

    persistPlatformState();
    broadcastSyncEvent('candidate:status', {
      electionId: candidate.electionId,
      domainId: candidate.domainId,
      candidateId: id,
      positionId: candidate.positionId
    });

    return res.json({
      success: true,
      message: 'Correction request dispatched to candidate.',
      candidate
    });
  }
);

/**
 * POST /api/candidates/:id/withdraw
 */
candidateRouter.post('/:id/withdraw', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const ipAddress =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  const candidate = CANDIDATES_STORE.get(id);
  if (!candidate) {
    return res.status(404).json({ success: false, error: 'Candidate not found.' });
  }

  candidate.applicationStatus = 'Withdrawn';
  candidate.rejectionReason = reason ? reason.trim() : 'Withdrawn at candidate request.';
  candidate.reviewedAt = new Date().toISOString();

  const positions = POSITIONS_STORE.get(candidate.electionId) || [];
  const pos = positions.find((p) => p.id === candidate.positionId);
  if (pos) {
    pos.candidateIds = pos.candidateIds.filter((cid) => cid !== candidate.id);
    POSITIONS_STORE.set(candidate.electionId, positions);
  }

  CANDIDATES_STORE.set(id, candidate);

  logAuditEvent({
    eventType: 'WITHDRAW_CANDIDATE_NOMINATION',
    userId: candidate.studentId,
    identifier: candidate.studentId,
    role: 'student',
    ipAddress,
    status: 'SUCCESS',
    details: `Candidacy nomination withdrawn for ${candidate.fullName} (${candidate.studentId}).`
  });

  persistPlatformState();
  broadcastSyncEvent('candidate:status', {
    electionId: candidate.electionId,
    domainId: candidate.domainId,
    candidateId: id,
    positionId: candidate.positionId
  });

  return res.json({
    success: true,
    message: 'Candidate application withdrawn.',
    candidate
  });
});

/**
 * POST /api/candidates/:id/assign-position
 * Admin assigns candidate to a specific position within an election in their authorized domain
 */
candidateRouter.post(
  '/:id/assign-position',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { electionId, positionId } = req.body || {};
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const candidate = CANDIDATES_STORE.get(id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const targetElection = ELECTIONS_STORE.get(electionId || candidate.electionId);
    if (!targetElection) {
      return res.status(400).json({ success: false, error: 'Target election not found.' });
    }

    const accessCheck = canAdminManageElection(session, targetElection);
    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const positions = POSITIONS_STORE.get(targetElection.id) || [];
    const newPos = positions.find((p) => p.id === positionId);
    if (!newPos) {
      return res.status(400).json({ success: false, error: 'Target position not found in election.' });
    }

    if (candidate.electionId && candidate.positionId) {
      const oldPositions = POSITIONS_STORE.get(candidate.electionId) || [];
      const oldPos = oldPositions.find((p) => p.id === candidate.positionId);
      if (oldPos) {
        oldPos.candidateIds = oldPos.candidateIds.filter((cid) => cid !== candidate.id);
        POSITIONS_STORE.set(candidate.electionId, oldPositions);
      }
    }

    candidate.electionId = targetElection.id;
    candidate.positionId = newPos.id;
    candidate.domainId = targetElection.domainId || categoryToDomainId(targetElection.category);
    candidate.hallId = targetElection.hallId;
    candidate.facultyId = targetElection.facultyId;
    candidate.departmentId = targetElection.departmentId;

    if (candidate.applicationStatus === 'Approved' && !newPos.candidateIds.includes(candidate.id)) {
      newPos.candidateIds.push(candidate.id);
      POSITIONS_STORE.set(targetElection.id, positions);
    }

    CANDIDATES_STORE.set(id, candidate);

    logAuditEvent({
      eventType: 'ASSIGN_CANDIDATE_POSITION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Reassigned candidate ${candidate.fullName} to position ${newPos.title} in election ${targetElection.code}.`
    });

    persistPlatformState();
    broadcastSyncEvent('candidate:updated', {
      electionId: candidate.electionId,
      domainId: candidate.domainId,
      candidateId: id,
      positionId: candidate.positionId
    });

    return res.json({
      success: true,
      message: `Candidate assigned to ${newPos.title}.`,
      candidate
    });
  }
);
