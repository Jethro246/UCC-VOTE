import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import { requireAdminRole } from './adminRoutes.ts';
import { logAuditEvent } from './authStore.ts';
import type { SessionData } from './authStore.ts';
import { ELECTIONS_STORE, POSITIONS_STORE } from './electionStore.ts';
import {
  ANONYMOUS_BALLOT_VAULT,
  VOTER_PARTICIPATION_VAULT,
  buildParticipationKey,
  buildReceiptFromParticipation,
  executeAtomicVoteSubmission,
  getAuthorizedBallotForStudent,
  resolveStudentFromSession
} from './votingStore.ts';

export const votingRouter = Router();

/**
 * GET /api/voting/ballot/:electionId
 * Loads dynamic election ballot (positions + approved candidates only) after verifying
 * student identity, eligibility, voting status, and active election period.
 */
votingRouter.get('/ballot/:electionId', authenticateToken, (req: Request, res: Response) => {
  const { electionId } = req.params;
  const session: SessionData = (req as any).session;
  const ipAddress =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  const result = getAuthorizedBallotForStudent(electionId, session, ipAddress);

  return res.status(result.httpStatus).json({
    success: result.success,
    code: result.code,
    error: result.error,
    alreadyVoted: result.alreadyVoted,
    receipt: result.receipt,
    election: result.election,
    eligibility: result.eligibility,
    positions: result.positions
  });
});

/**
 * POST /api/voting/submit
 * Atomically validates and records a student's digital ballot while enforcing
 * duplicate prevention, concurrency locks, and voter-ballot separation.
 */
votingRouter.post('/submit', authenticateToken, (req: Request, res: Response) => {
  const session: SessionData = (req as any).session;
  const ipAddress =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const { electionId, selections, idempotencyKey } = req.body || {};

  const result = executeAtomicVoteSubmission({
    electionId,
    rawSelections: selections,
    session,
    ipAddress,
    idempotencyKey
  });

  return res.status(result.httpStatus).json(result);
});

/**
 * GET /api/voting/confirmation/:electionId
 * Returns the authenticated student's submission confirmation receipt (without candidate choices).
 */
votingRouter.get('/confirmation/:electionId', authenticateToken, (req: Request, res: Response) => {
  const { electionId } = req.params;
  const session: SessionData = (req as any).session;

  if (!session || session.userType !== 'student') {
    return res.status(403).json({
      success: false,
      error: 'Only authenticated students can retrieve personal vote participation confirmations.'
    });
  }

  const student = resolveStudentFromSession(session);
  if (!student) {
    return res.status(404).json({ success: false, error: 'Student account not found.' });
  }

  const record = VOTER_PARTICIPATION_VAULT.get(buildParticipationKey(electionId, student.id));
  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'No vote confirmation record found for this election.'
    });
  }

  return res.json({
    success: true,
    receipt: buildReceiptFromParticipation(record)
  });
});

/**
 * GET /api/voting/my-confirmations
 * Returns all participation confirmations for the authenticated student (zero candidate choices).
 */
votingRouter.get('/my-confirmations', authenticateToken, (req: Request, res: Response) => {
  const session: SessionData = (req as any).session;

  if (!session || session.userType !== 'student') {
    return res.status(403).json({
      success: false,
      error: 'Only student accounts have personal voting confirmations.'
    });
  }

  const student = resolveStudentFromSession(session);
  if (!student) {
    return res.status(404).json({ success: false, error: 'Student account not found.' });
  }

  const receipts = Array.from(VOTER_PARTICIPATION_VAULT.values())
    .filter((r) => r.studentAccountId === student.id)
    .map(buildReceiptFromParticipation);

  return res.json({
    success: true,
    receipts
  });
});

/**
 * GET /api/voting/admin/inspect-ballot/:studentId
 * Security enforcement & privacy audit endpoint:
 * Explicitly blocks and logs any administrator attempt to inspect an individual student's ballot choices.
 */
votingRouter.get(
  '/admin/inspect-ballot/:studentId',
  authenticateToken,
  requireAdminRole(),
  (req: Request, res: Response) => {
    const { studentId } = req.params;
    const session: SessionData = (req as any).session;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    logAuditEvent({
      eventType: 'BALLOT_SECRECY_VIOLATION_BLOCKED',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'FLAGGED',
      details: `PRIVACY GUARD TRIGGERED: Administrator ${session.userId} (${session.role}) attempted to inspect individual ballot choices for student "${decodeURIComponent(studentId)}". Request blocked; no voter-to-ballot mapping exists.`
    });

    return res.status(403).json({
      success: false,
      code: 'BALLOT_SECRECY_VIOLATION_BLOCKED',
      error:
        'Access Denied: Ballot secrecy architecture strictly prohibits inspecting individual voter choices. Voter participation records and anonymous ballot contents are stored separately with no identity-to-candidate mapping.',
      targetStudentId: decodeURIComponent(studentId),
      audited: true
    });
  }
);

/**
 * GET /api/voting/audit-summary/:electionId
 * Returns aggregate participation vs anonymous ballot vault counts for Electoral Commission auditing.
 * Never exposes individual voter identities paired with candidate selections.
 */
votingRouter.get(
  '/audit-summary/:electionId',
  authenticateToken,
  requireAdminRole(),
  (req: Request, res: Response) => {
    const { electionId } = req.params;
    const election = ELECTIONS_STORE.get(electionId);

    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const positions = POSITIONS_STORE.get(electionId) || [];
    const participationCount = Array.from(VOTER_PARTICIPATION_VAULT.values()).filter(
      (r) => r.electionId === electionId
    ).length;
    const anonymousBallotsCount = ANONYMOUS_BALLOT_VAULT.filter(
      (b) => b.electionId === electionId
    ).length;

    return res.json({
      success: true,
      summary: {
        electionId: election.id,
        electionTitle: election.title,
        status: election.status,
        positionsCount: positions.length,
        totalEligibleVoters: election.totalEligibleVoters,
        totalVotesCast: election.totalVotesCast,
        turnoutPercentage: election.turnoutPercentage,
        sessionParticipationRecords: participationCount,
        sessionAnonymousBallots: anonymousBallotsCount,
        vaultCountBalanced: participationCount === anonymousBallotsCount,
        secrecyArchitectureNote:
          'Voter participation records and anonymous ballot contents are decoupled; individual choices cannot be linked to student identities.'
      }
    });
  }
);
