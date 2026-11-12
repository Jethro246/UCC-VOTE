import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import { requireAdminRole } from './adminRoutes.ts';
import { 
  ELECTIONS_STORE, 
  POSITIONS_STORE, 
  CANDIDATES_STORE,
  verifyCandidateCandidacyEligibility 
} from './electionStore.ts';
import { logAuditEvent } from './authStore.ts';
import type { Candidate, CandidateApplicationStatus } from '../types/index.ts';

export const candidateRouter = Router();

/**
 * GET /api/candidates or /api/elections/candidates
 * Retrieve candidates list with optional filtering
 */
candidateRouter.get('/', (req: Request, res: Response) => {
  const { electionId, positionId, status, approvedOnly, search, department, faculty } = req.query;
  let list = Array.from(CANDIDATES_STORE.values());

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
    list = list.filter((c) => c.department.toLowerCase().includes((department as string).toLowerCase()));
  }

  if (faculty && faculty !== 'All') {
    list = list.filter((c) => c.faculty.toLowerCase().includes((faculty as string).toLowerCase()));
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
 * Retrieve a specific candidate's full profile
 */
candidateRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const candidate = CANDIDATES_STORE.get(id);

  if (!candidate) {
    return res.status(404).json({ success: false, error: 'Candidate record not found.' });
  }

  return res.json({
    success: true,
    candidate
  });
});

/**
 * POST /api/candidates
 * Register candidate nomination application
 */
candidateRouter.post('/', (req: Request, res: Response) => {
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
  } = req.body;

  if (!fullName || !studentId || !electionId || !positionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing mandatory candidate details: Full Name, Student ID, Election, and Position are required.'
    });
  }

  const election = ELECTIONS_STORE.get(electionId);
  if (!election) {
    return res.status(400).json({ success: false, error: 'Target election does not exist.' });
  }

  const positions = POSITIONS_STORE.get(electionId) || [];
  const pos = positions.find((p) => p.id === positionId);
  if (!pos) {
    return res.status(400).json({ success: false, error: 'Target position does not exist for this election.' });
  }

  const newId = `cand-${Date.now()}`;
  const initialStatus: CandidateApplicationStatus = isDraft ? 'Draft' : 'Submitted';

  const candidate: Candidate = {
    id: newId,
    electionId,
    positionId,
    fullName: fullName.trim(),
    studentId: studentId.trim().toUpperCase(),
    nickname: nickname ? nickname.trim() : undefined,
    email: email ? email.trim() : `${studentId.toLowerCase().replace(/\//g, '.')}@st.ucc.edu.gh`,
    department: department ? department.trim() : 'General Studies',
    faculty: faculty ? faculty.trim() : 'University of Cape Coast',
    programme: programme ? programme.trim() : 'Undergraduate Degree',
    level: level || '300',
    hall: hall || 'Casely Hayford Hall',
    photoUrl: photoUrl || '/src/assets/images/candidate_male_glasses_1794364322323.jpg',
    biography: biography ? biography.trim() : '',
    manifestoSummary: manifestoSummary ? manifestoSummary.trim() : 'Committed to student welfare and academic excellence.',
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
    submittedAt: isDraft ? undefined : new Date().toISOString()
  };

  // Run initial eligibility check against student registry
  const eligibilityResult = verifyCandidateCandidacyEligibility(candidate, election);
  candidate.eligibilityVerified = eligibilityResult.isEligible;
  candidate.eligibilityDetails = eligibilityResult.details;

  CANDIDATES_STORE.set(newId, candidate);

  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  logAuditEvent({
    eventType: 'SUBMIT_CANDIDATE_APPLICATION',
    userId: studentId,
    identifier: studentId,
    role: 'student',
    ipAddress,
    status: 'SUCCESS',
    details: `Candidate nomination registered for ${fullName} (${newId}) in election ${election.code} as ${initialStatus}.`
  });

  return res.status(201).json({
    success: true,
    message: isDraft ? 'Candidate application saved as draft.' : 'Candidate application submitted successfully for vetting.',
    candidate
  });
});

/**
 * PUT /api/candidates/:id
 * Update candidate information / photograph / manifesto details
 */
candidateRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = CANDIDATES_STORE.get(id);

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Candidate not found.' });
  }

  const updates = req.body;
  const updated: Candidate = {
    ...existing,
    ...updates,
    id, // protect immutable ID
    electionId: updates.electionId || existing.electionId,
    positionId: updates.positionId || existing.positionId
  };

  // If status is moved back to submitted from draft or rejected
  if (updates.resubmit) {
    updated.applicationStatus = 'Submitted';
    updated.submittedAt = new Date().toISOString();
    updated.correctionNotes = undefined;
    updated.rejectionReason = undefined;
  }

  CANDIDATES_STORE.set(id, updated);

  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  logAuditEvent({
    eventType: 'UPDATE_CANDIDATE_PROFILE',
    userId: updated.studentId,
    identifier: updated.studentId,
    role: 'student',
    ipAddress,
    status: 'SUCCESS',
    details: `Updated details and credentials for candidate ${updated.fullName} (${id}).`
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
 * Administrator approval of candidate nomination
 */
candidateRouter.post(
  '/:id/approve',
  authenticateToken,
  requireAdminRole(),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const candidate = CANDIDATES_STORE.get(id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const election = ELECTIONS_STORE.get(candidate.electionId);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Associated election not found.' });
    }

    // Verify position
    const positions = POSITIONS_STORE.get(candidate.electionId) || [];
    const pos = positions.find((p) => p.id === candidate.positionId);
    if (!pos) {
      return res.status(400).json({ success: false, error: 'Position not found for candidate in this election.' });
    }

    // Approve candidate
    candidate.applicationStatus = 'Approved';
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewedBy = session.fullName || session.userId || 'Electoral Commission Vetting Committee';
    candidate.rejectionReason = undefined;
    candidate.correctionNotes = undefined;
    candidate.eligibilityVerified = true;

    // Add candidate ID to position's candidateIds if not present
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
      details: `Approved candidate ${candidate.fullName} (${candidate.studentId}) for portfolio ${pos.title} in election ${election.code}. Assigned to official ballot.`
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
 * Administrator rejection of candidate nomination with stated reason
 */
candidateRouter.post(
  '/:id/reject',
  authenticateToken,
  requireAdminRole(),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const session = (req as any).session;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A specific constitutional or academic reason is required to reject a candidate application.'
      });
    }

    const candidate = CANDIDATES_STORE.get(id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    candidate.applicationStatus = 'Rejected';
    candidate.rejectionReason = reason.trim();
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewedBy = session.fullName || session.userId || 'Electoral Commission Vetting Committee';

    // Remove from position's candidateIds if previously approved
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

    return res.json({
      success: true,
      message: `Candidate application for ${candidate.fullName} has been marked as Rejected.`,
      candidate
    });
  }
);

/**
 * POST /api/candidates/:id/request-corrections
 * Request corrections from candidate
 */
candidateRouter.post(
  '/:id/request-corrections',
  authenticateToken,
  requireAdminRole(),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body;
    const session = (req as any).session;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

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

    candidate.applicationStatus = 'Under review';
    candidate.correctionNotes = notes.trim();
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewedBy = session.fullName || session.userId || 'Electoral Commission Vetting Committee';

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

    return res.json({
      success: true,
      message: 'Correction request dispatched to candidate.',
      candidate
    });
  }
);

/**
 * POST /api/candidates/:id/withdraw
 * Candidate or Admin voluntary withdrawal
 */
candidateRouter.post('/:id/withdraw', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  const candidate = CANDIDATES_STORE.get(id);
  if (!candidate) {
    return res.status(404).json({ success: false, error: 'Candidate not found.' });
  }

  candidate.applicationStatus = 'Withdrawn';
  candidate.rejectionReason = reason ? reason.trim() : 'Withdrawn at candidate request.';
  candidate.reviewedAt = new Date().toISOString();

  // Remove from ballot if present
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

  return res.json({
    success: true,
    message: 'Candidate application withdrawn.',
    candidate
  });
});

/**
 * POST /api/candidates/:id/assign-position
 * Admin assigns candidate to a specific position in an election
 */
candidateRouter.post(
  '/:id/assign-position',
  authenticateToken,
  requireAdminRole(),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { electionId, positionId } = req.body;
    const session = (req as any).session;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const candidate = CANDIDATES_STORE.get(id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const targetElection = ELECTIONS_STORE.get(electionId || candidate.electionId);
    if (!targetElection) {
      return res.status(400).json({ success: false, error: 'Target election not found.' });
    }

    const positions = POSITIONS_STORE.get(targetElection.id) || [];
    const newPos = positions.find((p) => p.id === positionId);
    if (!newPos) {
      return res.status(400).json({ success: false, error: 'Target position not found in election.' });
    }

    // Remove from old position if different
    if (candidate.electionId && candidate.positionId) {
      const oldPositions = POSITIONS_STORE.get(candidate.electionId) || [];
      const oldPos = oldPositions.find((p) => p.id === candidate.positionId);
      if (oldPos) {
        oldPos.candidateIds = oldPos.candidateIds.filter((cid) => cid !== candidate.id);
        POSITIONS_STORE.set(candidate.electionId, oldPositions);
      }
    }

    // Update candidate
    candidate.electionId = targetElection.id;
    candidate.positionId = newPos.id;

    // Add to new position if approved
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

    return res.json({
      success: true,
      message: `Candidate assigned to ${newPos.title}.`,
      candidate
    });
  }
);
