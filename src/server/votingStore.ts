import crypto from 'crypto';
import type {
  Candidate,
  Election,
  Position,
  VoteConfirmationReceipt
} from '../types/index.ts';
import {
  STUDENT_ACCOUNTS,
  logAuditEvent
} from './authStore.ts';
import type { SessionData, StoredStudentAccount } from './authStore.ts';
import {
  ELECTIONS_STORE,
  POSITIONS_STORE,
  CANDIDATES_STORE,
  verifyStudentEligibility
} from './electionStore.ts';

/**
 * VAULT 1: VOTER PARTICIPATION VAULT (Identity-linked eligibility & participation only)
 * Strictly stores ONLY whether a student has voted in a given election, confirmation reference,
 * timestamp, and which portfolios were completed.
 * NEVER stores candidate IDs, ballot choices, or links to ANONYMOUS_BALLOT_VAULT.
 */
export interface VoterParticipationRecord {
  participationKey: string; // `${electionId}::${studentAccountId}`
  electionId: string;
  electionTitle: string;
  electionCategory: Election['category'];
  studentAccountId: string;
  studentId: string;
  votedAt: string;
  confirmationRef: string;
  receiptHash: string;
  positionsCompleted: {
    id: string;
    title: string;
    status: 'VOTED' | 'ABSTAINED';
  }[];
}

/**
 * VAULT 2: ANONYMOUS BALLOT VAULT (Ballot contents only)
 * Strictly decoupled from student identity, session tokens, IP addresses, or confirmation references.
 */
export interface AnonymousBallotRecord {
  ballotId: string;
  electionId: string;
  recordedAtBucket: string; // Coarse 5-minute bucket to mitigate timestamp correlation
  selections: {
    positionId: string;
    candidateIds: string[];
  }[];
  ballotIntegrityDigest: string;
}

export const VOTER_PARTICIPATION_VAULT: Map<string, VoterParticipationRecord> = new Map();
export const ANONYMOUS_BALLOT_VAULT: AnonymousBallotRecord[] = [];

// Mutex lock set to prevent concurrent/race-condition duplicate ballot submissions
export const IN_FLIGHT_VOTE_LOCKS: Set<string> = new Set();

// Idempotency store keyed by `${electionId}::${studentAccountId}::${idempotencyKey}`
export const USED_IDEMPOTENCY_KEYS: Map<string, string> = new Map();

// Sliding-window rate limiter for ballot submission attempts: key -> timestamps[]
const VOTE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const VOTE_RATE_LIMIT_MAX_ATTEMPTS = 15;
const VOTE_SUBMIT_RATE_LIMIT: Map<string, number[]> = new Map();

// Seed historical participation confirmations for demonstration student who voted in 2025 elections
function seedHistoricalParticipation() {
  const kofi = STUDENT_ACCOUNTS.get('PS/CSC/22/0089');
  if (!kofi) return;

  const historicalIds = kofi.hasVotedElections || [];
  for (const elId of historicalIds) {
    const election = ELECTIONS_STORE.get(elId);
    if (!election) continue;
    const key = buildParticipationKey(elId, kofi.id);
    if (VOTER_PARTICIPATION_VAULT.has(key)) continue;

    const positions = POSITIONS_STORE.get(elId) || [];
    const confirmationRef = `UCC-VOTE-2025-${elId.slice(-4)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const votedAt = election.endDate;
    const receiptHash = crypto
      .createHash('sha256')
      .update(`${confirmationRef}:${elId}:${votedAt}:historical`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();

    VOTER_PARTICIPATION_VAULT.set(key, {
      participationKey: key,
      electionId: elId,
      electionTitle: election.title,
      electionCategory: election.category,
      studentAccountId: kofi.id,
      studentId: kofi.studentId,
      votedAt,
      confirmationRef,
      receiptHash,
      positionsCompleted: positions.map((p) => ({
        id: p.id,
        title: p.title,
        status: 'VOTED' as const
      }))
    });
  }
}
seedHistoricalParticipation();

export function buildParticipationKey(electionId: string, studentAccountId: string): string {
  return `${electionId}::${studentAccountId}`;
}

export function resolveStudentFromSession(session: SessionData): StoredStudentAccount | null {
  if (!session || session.userType !== 'student') return null;
  for (const acc of STUDENT_ACCOUNTS.values()) {
    if (acc.id === session.userId || acc.studentId === session.userId) {
      return acc;
    }
  }
  return null;
}

function getCoarseTimestampBucket(date = new Date()): string {
  const ms = date.getTime();
  const fiveMinutes = 5 * 60 * 1000;
  return new Date(Math.floor(ms / fiveMinutes) * fiveMinutes).toISOString();
}

function checkVoteRateLimit(rateKey: string): boolean {
  const now = Date.now();
  const timestamps = (VOTE_SUBMIT_RATE_LIMIT.get(rateKey) || []).filter(
    (ts) => now - ts < VOTE_RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= VOTE_RATE_LIMIT_MAX_ATTEMPTS) {
    VOTE_SUBMIT_RATE_LIMIT.set(rateKey, timestamps);
    return false;
  }
  timestamps.push(now);
  VOTE_SUBMIT_RATE_LIMIT.set(rateKey, timestamps);
  return true;
}

/**
 * Resolves dynamically configured positions and ONLY Approved candidates for an election.
 * Strips tallies/vote counts so live ballots remain unbiased.
 */
export function getSanitizedBallotPositions(electionId: string): Array<{
  position: Position;
  candidates: Omit<Candidate, 'votesReceived' | 'votePercentage'>[];
}> {
  const rawPositions = [...(POSITIONS_STORE.get(electionId) || [])].sort(
    (a, b) => a.order - b.order
  );
  const allCandidates = Array.from(CANDIDATES_STORE.values());

  return rawPositions.map((pos) => {
    const approvedCandidates = allCandidates
      .filter(
        (c) =>
          c.electionId === electionId &&
          c.positionId === pos.id &&
          c.applicationStatus === 'Approved'
      )
      .map(({ votesReceived: _v, votePercentage: _p, ...publicCand }) => publicCand);

    return {
      position: pos,
      candidates: approvedCandidates
    };
  });
}

export function buildReceiptFromParticipation(
  record: VoterParticipationRecord
): VoteConfirmationReceipt {
  return {
    confirmationRef: record.confirmationRef,
    receiptHash: record.receiptHash,
    electionId: record.electionId,
    electionTitle: record.electionTitle,
    electionCategory: record.electionCategory,
    submittedAt: record.votedAt,
    positionsCompleted: record.positionsCompleted,
    message: 'YOUR VOTE HAS BEEN SUCCESSFULLY SUBMITTED.'
  };
}

export function hasStudentVoted(electionId: string, student: StoredStudentAccount): boolean {
  const key = buildParticipationKey(electionId, student.id);
  if (VOTER_PARTICIPATION_VAULT.has(key)) return true;
  if (Array.isArray(student.hasVotedElections) && student.hasVotedElections.includes(electionId)) {
    return true;
  }
  return false;
}

function getElectionStateRejection(election: Election): {
  allowed: boolean;
  code?: string;
  reason?: string;
} {
  if (election.status !== 'live') {
    const statusLabels: Record<string, { code: string; msg: string }> = {
      closed: {
        code: 'ELECTION_CLOSED',
        msg: 'Voting for this election has officially closed. No further ballots can be accepted.'
      },
      suspended: {
        code: 'ELECTION_SUSPENDED',
        msg: 'This election is currently suspended by order of the UCC Electoral Commission. Voting is temporarily disabled.'
      },
      draft: {
        code: 'ELECTION_NOT_OPEN',
        msg: 'This election is still in draft configuration and is not open for voting.'
      },
      pending_approval: {
        code: 'ELECTION_NOT_OPEN',
        msg: 'This election is pending Electoral Commission approval and is not open for voting.'
      },
      scheduled: {
        code: 'ELECTION_NOT_STARTED',
        msg: `Voting has not opened yet. Scheduled opening: ${new Date(election.startDate).toUTCString()}.`
      },
      upcoming: {
        code: 'ELECTION_NOT_STARTED',
        msg: `Voting has not opened yet. Scheduled opening: ${new Date(election.startDate).toUTCString()}.`
      },
      results_pending_certification: {
        code: 'ELECTION_CLOSED',
        msg: 'Polling has concluded and results are undergoing certification.'
      },
      results_published: {
        code: 'ELECTION_CLOSED',
        msg: 'This election has concluded and official results have already been published.'
      },
      archived: {
        code: 'ELECTION_ARCHIVED',
        msg: 'This election is archived and no longer accepts votes.'
      }
    };
    const info = statusLabels[election.status] || {
      code: 'ELECTION_NOT_LIVE',
      msg: `Election is currently "${election.status}" and is not open for voting.`
    };
    return { allowed: false, code: info.code, reason: info.msg };
  }

  const now = Date.now();
  const start = new Date(election.startDate).getTime();
  const end = new Date(election.endDate).getTime();

  if (!isNaN(start) && now < start) {
    return {
      allowed: false,
      code: 'OUTSIDE_VOTING_WINDOW',
      reason: `Official voting period has not started yet. Polling opens at ${new Date(election.startDate).toUTCString()}.`
    };
  }

  if (!isNaN(end) && now > end) {
    return {
      allowed: false,
      code: 'OUTSIDE_VOTING_WINDOW',
      reason: `Official voting period ended at ${new Date(election.endDate).toUTCString()}.`
    };
  }

  return { allowed: true };
}

export interface BallotAccessResult {
  httpStatus: number;
  success: boolean;
  code?: string;
  error?: string;
  alreadyVoted?: boolean;
  receipt?: VoteConfirmationReceipt;
  election?: Election;
  eligibility?: { isEligible: boolean; reason?: string; checks: Record<string, boolean> };
  positions?: Array<{
    position: Position;
    candidates: Omit<Candidate, 'votesReceived' | 'votePercentage'>[];
  }>;
}

/**
 * Loads an authorized digital ballot for an authenticated student after checking:
 * - Student role (blocks admin ballot access)
 * - Active student status
 * - Duplicate participation
 * - Live election status & voting time window
 * - Student eligibility rules
 */
export function getAuthorizedBallotForStudent(
  electionId: string,
  session: SessionData,
  ipAddress: string
): BallotAccessResult {
  if (!session || session.userType !== 'student') {
    logAuditEvent({
      eventType: 'VOTING_ACCESS_DENIED',
      userId: session?.userId,
      identifier: session?.userId || 'unknown',
      role: session?.role || 'Unknown',
      ipAddress,
      status: 'FLAGGED',
      details: `Non-student role (${session?.role || 'unknown'}) attempted to access voter ballot for election ${electionId}.`
    });
    return {
      httpStatus: 403,
      success: false,
      code: 'ADMIN_VOTING_FORBIDDEN',
      error: 'Only verified UCC students can access a voting ballot. Electoral Commission administrators are prohibited from casting voter ballots.'
    };
  }

  const student = resolveStudentFromSession(session);
  if (!student) {
    return {
      httpStatus: 404,
      success: false,
      code: 'STUDENT_NOT_FOUND',
      error: 'Verified student account record could not be located.'
    };
  }

  const election = ELECTIONS_STORE.get(electionId);
  if (!election) {
    return {
      httpStatus: 404,
      success: false,
      code: 'ELECTION_NOT_FOUND',
      error: `Election '${electionId}' was not found.`
    };
  }

  // Check if student already voted — return participation confirmation without candidate choices
  if (hasStudentVoted(electionId, student)) {
    const existingRecord = VOTER_PARTICIPATION_VAULT.get(
      buildParticipationKey(electionId, student.id)
    );
    return {
      httpStatus: 200,
      success: true,
      alreadyVoted: true,
      election,
      receipt: existingRecord
        ? buildReceiptFromParticipation(existingRecord)
        : {
            confirmationRef: `UCC-VOTE-RECORDED-${electionId}`,
            receiptHash: 'PARTICIPATION-CONFIRMED',
            electionId: election.id,
            electionTitle: election.title,
            electionCategory: election.category,
            submittedAt: new Date().toISOString(),
            positionsCompleted: (POSITIONS_STORE.get(electionId) || []).map((p) => ({
              id: p.id,
              title: p.title,
              status: 'VOTED' as const
            })),
            message: 'YOUR VOTE HAS BEEN SUCCESSFULLY SUBMITTED.'
          }
    };
  }

  // Check student account standing & election eligibility
  const eligibility = verifyStudentEligibility(student, election);
  if (!eligibility.isEligible || student.status !== 'active' || !student.isEligible) {
    const reason =
      student.status !== 'active'
        ? `Your student account status is "${student.status}". Only active verified students may vote.`
        : eligibility.reason || 'You do not meet the eligibility criteria for this election.';
    logAuditEvent({
      eventType: 'VOTING_ACCESS_DENIED',
      userId: student.id,
      identifier: student.studentId,
      role: 'Student',
      ipAddress,
      status: 'WARNING',
      details: `Ineligible ballot access blocked for student ${student.studentId} on election ${election.code}: ${reason}`
    });
    return {
      httpStatus: 403,
      success: false,
      code: 'INELIGIBLE_VOTER',
      error: reason,
      election,
      eligibility
    };
  }

  // Check election live state and voting period
  const stateCheck = getElectionStateRejection(election);
  if (!stateCheck.allowed) {
    return {
      httpStatus: 403,
      success: false,
      code: stateCheck.code,
      error: stateCheck.reason,
      election,
      eligibility
    };
  }

  const positions = getSanitizedBallotPositions(electionId);

  return {
    httpStatus: 200,
    success: true,
    alreadyVoted: false,
    election,
    eligibility,
    positions
  };
}

export interface VoteSubmissionResult {
  httpStatus: number;
  success: boolean;
  code: string;
  message: string;
  error?: string;
  receipt?: VoteConfirmationReceipt;
  updatedTurnout?: {
    totalVotesCast: number;
    totalEligibleVoters: number;
    turnoutPercentage: number;
  };
}

/**
 * Atomic, Mutex-Locked Digital Ballot Submission Engine.
 * Guarantees:
 * - Zero partial votes (all validations succeed before any store is mutated)
 * - Strict duplicate & concurrent submission rejection
 * - Identity-to-ballot decoupling across VOTER_PARTICIPATION_VAULT and ANONYMOUS_BALLOT_VAULT
 * - No candidate selection ever appears in receipts, participation records, or audit logs
 */
export function executeAtomicVoteSubmission(params: {
  electionId: string;
  rawSelections: unknown;
  session: SessionData;
  ipAddress: string;
  idempotencyKey?: string;
}): VoteSubmissionResult {
  const { electionId, rawSelections, session, ipAddress, idempotencyKey } = params;

  // 1. Role Check (Student only)
  if (!session || session.userType !== 'student') {
    logAuditEvent({
      eventType: 'VOTING_ACCESS_DENIED',
      userId: session?.userId,
      identifier: session?.userId || 'unknown',
      role: session?.role || 'Unknown',
      ipAddress,
      status: 'FLAGGED',
      details: `Blocked ballot submission by non-student role (${session?.role || 'unknown'}) on election ${electionId}.`
    });
    return {
      httpStatus: 403,
      success: false,
      code: 'ADMIN_VOTING_FORBIDDEN',
      message: 'Submission denied.',
      error: 'Only authenticated, verified students are permitted to cast ballots.'
    };
  }

  if (!electionId || typeof electionId !== 'string') {
    return {
      httpStatus: 400,
      success: false,
      code: 'INVALID_ELECTION_ID',
      message: 'Validation failed.',
      error: 'A valid election identifier is required.'
    };
  }

  // 2. Resolve Authoritative Student Account
  const student = resolveStudentFromSession(session);
  if (!student) {
    return {
      httpStatus: 404,
      success: false,
      code: 'STUDENT_NOT_FOUND',
      message: 'Student verification failed.',
      error: 'Authenticated student account could not be verified.'
    };
  }

  // 3. Per-student Rate Limiting
  if (!checkVoteRateLimit(`${student.id}::${ipAddress}`)) {
    logAuditEvent({
      eventType: 'BALLOT_SUBMISSION_REJECTED',
      userId: student.id,
      identifier: student.studentId,
      role: 'Student',
      ipAddress,
      status: 'FLAGGED',
      details: `Rate limit exceeded for ballot submission attempts on election ${electionId}.`
    });
    return {
      httpStatus: 429,
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many requests.',
      error: 'Too many ballot submission attempts detected. Please wait a moment and try again.'
    };
  }

  // 4. Acquire Per-(Election, Student) Mutex Lock to Block Simultaneous Submissions
  const lockKey = buildParticipationKey(electionId, student.id);
  if (IN_FLIGHT_VOTE_LOCKS.has(lockKey)) {
    logAuditEvent({
      eventType: 'CONCURRENT_VOTE_BLOCKED',
      userId: student.id,
      identifier: student.studentId,
      role: 'Student',
      ipAddress,
      status: 'FLAGGED',
      details: `Blocked simultaneous ballot submission attempt for election ${electionId} while another submission lock was active.`
    });
    return {
      httpStatus: 409,
      success: false,
      code: 'CONCURRENT_SUBMISSION_BLOCKED',
      message: 'Simultaneous submission blocked.',
      error: 'Another ballot submission for your account is currently being processed. Concurrent submissions are not allowed.'
    };
  }

  IN_FLIGHT_VOTE_LOCKS.add(lockKey);

  try {
    // 5. Idempotency / Retry Guard
    if (idempotencyKey && typeof idempotencyKey === 'string') {
      const idemComposite = `${lockKey}::${idempotencyKey.trim()}`;
      if (USED_IDEMPOTENCY_KEYS.has(idemComposite)) {
        logAuditEvent({
          eventType: 'DUPLICATE_VOTE_BLOCKED',
          userId: student.id,
          identifier: student.studentId,
          role: 'Student',
          ipAddress,
          status: 'FLAGGED',
          details: `Blocked replayed idempotency key on election ${electionId}.`
        });
        return {
          httpStatus: 409,
          success: false,
          code: 'DUPLICATE_VOTE_PREVENTED',
          message: 'Duplicate submission prevented.',
          error: 'This ballot submission request was already processed. Duplicate votes are strictly prohibited.'
        };
      }
    }

    // 6. Duplicate Vote Guard
    if (hasStudentVoted(electionId, student)) {
      logAuditEvent({
        eventType: 'DUPLICATE_VOTE_BLOCKED',
        userId: student.id,
        identifier: student.studentId,
        role: 'Student',
        ipAddress,
        status: 'FLAGGED',
        details: `Blocked duplicate vote attempt by student ${student.studentId} on election ${electionId}.`
      });
      return {
        httpStatus: 409,
        success: false,
        code: 'DUPLICATE_VOTE_PREVENTED',
        message: 'Duplicate vote rejected.',
        error: 'You have already cast your official ballot in this election. Only one vote per eligible student is allowed.'
      };
    }

    // 7. Election Existence, Active Status, and Time Window Verification
    const election = ELECTIONS_STORE.get(electionId);
    if (!election) {
      return {
        httpStatus: 404,
        success: false,
        code: 'ELECTION_NOT_FOUND',
        message: 'Election not found.',
        error: `Election '${electionId}' does not exist.`
      };
    }

    const stateCheck = getElectionStateRejection(election);
    if (!stateCheck.allowed) {
      logAuditEvent({
        eventType: 'BALLOT_SUBMISSION_REJECTED',
        userId: student.id,
        identifier: student.studentId,
        role: 'Student',
        ipAddress,
        status: 'WARNING',
        details: `Ballot rejected for election ${election.code} (${stateCheck.code}): ${stateCheck.reason}`
      });
      return {
        httpStatus: 403,
        success: false,
        code: stateCheck.code || 'ELECTION_NOT_LIVE',
        message: 'Voting unavailable.',
        error: stateCheck.reason || 'Voting is not currently open for this election.'
      };
    }

    // 8. Account Standing & Election Eligibility Check
    const eligibility = verifyStudentEligibility(student, election);
    if (student.status !== 'active' || !student.isEligible || !eligibility.isEligible) {
      const reason =
        student.status !== 'active'
          ? `Voter account status is "${student.status}".`
          : eligibility.reason || 'Student does not satisfy eligibility criteria for this election.';
      logAuditEvent({
        eventType: 'VOTING_ACCESS_DENIED',
        userId: student.id,
        identifier: student.studentId,
        role: 'Student',
        ipAddress,
        status: 'FLAGGED',
        details: `Ineligible student ${student.studentId} blocked from submitting ballot on ${election.code}: ${reason}`
      });
      return {
        httpStatus: 403,
        success: false,
        code: 'INELIGIBLE_VOTER',
        message: 'Voter ineligible.',
        error: reason
      };
    }

    // 9. Validate Ballot Payload & Dynamic Positions
    if (!rawSelections || typeof rawSelections !== 'object' || Array.isArray(rawSelections)) {
      return {
        httpStatus: 400,
        success: false,
        code: 'INVALID_BALLOT_PAYLOAD',
        message: 'Invalid ballot format.',
        error: 'Ballot selections must be provided as a position-to-candidate mapping.'
      };
    }

    const sanitizedPositions = getSanitizedBallotPositions(electionId);
    if (sanitizedPositions.length === 0) {
      return {
        httpStatus: 400,
        success: false,
        code: 'NO_BALLOT_POSITIONS',
        message: 'Invalid election configuration.',
        error: 'This election currently has no active positions configured for voting.'
      };
    }

    const positionMap = new Map<
      string,
      { position: Position; approvedCandidateIds: Set<string> }
    >();
    for (const item of sanitizedPositions) {
      positionMap.set(item.position.id, {
        position: item.position,
        approvedCandidateIds: new Set(item.candidates.map((c) => c.id))
      });
    }

    const selectionsObj = rawSelections as Record<string, unknown>;

    // Ensure every submitted position ID legitimately belongs to THIS election
    for (const submittedPosId of Object.keys(selectionsObj)) {
      if (!positionMap.has(submittedPosId)) {
        logAuditEvent({
          eventType: 'BALLOT_SUBMISSION_REJECTED',
          userId: student.id,
          identifier: student.studentId,
          role: 'Student',
          ipAddress,
          status: 'FLAGGED',
          details: `Invalid position ID "${submittedPosId}" rejected on election ${election.code}.`
        });
        return {
          httpStatus: 400,
          success: false,
          code: 'INVALID_POSITION',
          message: 'Invalid position selection.',
          error: `Position '${submittedPosId}' does not belong to election '${election.title}'.`
        };
      }
    }

    // Normalize & validate each position's selections
    const normalizedSelections: { positionId: string; positionTitle: string; candidateIds: string[] }[] = [];
    let totalSelectedCandidates = 0;

    for (const { position, candidates: approvedCandidates } of sanitizedPositions) {
      const rawValue = selectionsObj[position.id];
      let chosenIds: string[] = [];

      if (rawValue === undefined || rawValue === null) {
        chosenIds = [];
      } else if (typeof rawValue === 'string') {
        chosenIds = rawValue.trim() ? [rawValue.trim()] : [];
      } else if (Array.isArray(rawValue)) {
        for (const entry of rawValue) {
          if (typeof entry !== 'string' || !entry.trim()) {
            return {
              httpStatus: 400,
              success: false,
              code: 'INVALID_CANDIDATE_SELECTION',
              message: 'Invalid candidate entry.',
              error: `Invalid candidate selection format for position '${position.title}'.`
            };
          }
          chosenIds.push(entry.trim());
        }
      } else {
        return {
          httpStatus: 400,
          success: false,
          code: 'INVALID_CANDIDATE_SELECTION',
          message: 'Invalid selection format.',
          error: `Selections for '${position.title}' must be an array of candidate IDs.`
        };
      }

      // Check duplicate candidate IDs inside same position
      const uniqueChosen = new Set(chosenIds);
      if (uniqueChosen.size !== chosenIds.length) {
        return {
          httpStatus: 400,
          success: false,
          code: 'DUPLICATE_CANDIDATE_IN_POSITION',
          message: 'Duplicate candidate selection.',
          error: `Duplicate candidate selection detected for '${position.title}'.`
        };
      }

      // Check maximum selections rule
      const maxAllowed = Math.max(1, position.maxSelections || 1);
      if (chosenIds.length > maxAllowed) {
        logAuditEvent({
          eventType: 'BALLOT_SUBMISSION_REJECTED',
          userId: student.id,
          identifier: student.studentId,
          role: 'Student',
          ipAddress,
          status: 'WARNING',
          details: `Ballot exceeded maxSelections (${maxAllowed}) for position ${position.id} in election ${election.code}.`
        });
        return {
          httpStatus: 400,
          success: false,
          code: 'MAX_SELECTIONS_EXCEEDED',
          message: 'Too many candidates selected.',
          error: `You may select at most ${maxAllowed} candidate(s) for '${position.title}'.`
        };
      }

      // Check every chosen candidate exists, belongs to this election + position, and is Approved
      const approvedSet = positionMap.get(position.id)!.approvedCandidateIds;
      for (const candId of chosenIds) {
        const candRecord = CANDIDATES_STORE.get(candId);
        if (!candRecord) {
          return {
            httpStatus: 400,
            success: false,
            code: 'INVALID_CANDIDATE',
            message: 'Candidate not found.',
            error: `Selected candidate '${candId}' does not exist.`
          };
        }
        if (candRecord.electionId !== electionId || candRecord.positionId !== position.id) {
          logAuditEvent({
            eventType: 'BALLOT_SUBMISSION_REJECTED',
            userId: student.id,
            identifier: student.studentId,
            role: 'Student',
            ipAddress,
            status: 'FLAGGED',
            details: `Cross-position/cross-election candidate mismatch rejected on election ${election.code}.`
          });
          return {
            httpStatus: 400,
            success: false,
            code: 'CANDIDATE_POSITION_MISMATCH',
            message: 'Candidate mismatch.',
            error: `Candidate '${candRecord.fullName}' is not contesting '${position.title}' in this election.`
          };
        }
        if (candRecord.applicationStatus !== 'Approved' || !approvedSet.has(candId)) {
          logAuditEvent({
            eventType: 'BALLOT_SUBMISSION_REJECTED',
            userId: student.id,
            identifier: student.studentId,
            role: 'Student',
            ipAddress,
            status: 'FLAGGED',
            details: `Attempted vote for unapproved candidate status (${candRecord.applicationStatus}) blocked on ${election.code}.`
          });
          return {
            httpStatus: 400,
            success: false,
            code: 'UNAPPROVED_CANDIDATE',
            message: 'Unapproved candidate rejected.',
            error: `Candidate '${candRecord.fullName}' is not approved for official ballot selection (status: ${candRecord.applicationStatus}).`
          };
        }
      }

      // Enforce required (non-skippable) positions when approved candidates exist
      if (approvedCandidates.length > 0 && chosenIds.length === 0 && !position.allowsSkip) {
        return {
          httpStatus: 400,
          success: false,
          code: 'REQUIRED_POSITION_MISSING',
          message: 'Required selection missing.',
          error: `Position '${position.title}' requires a candidate selection and cannot be skipped.`
        };
      }

      totalSelectedCandidates += chosenIds.length;
      normalizedSelections.push({
        positionId: position.id,
        positionTitle: position.title,
        candidateIds: chosenIds
      });
    }

    // Enforce empty ballot rule
    if (totalSelectedCandidates === 0 && !election.allowsEmptyBallot) {
      return {
        httpStatus: 400,
        success: false,
        code: 'EMPTY_BALLOT_NOT_ALLOWED',
        message: 'Empty ballot rejected.',
        error: 'Empty ballots are not permitted for this election. Please select at least one approved candidate.'
      };
    }

    // =========================================================================
    // 10. ATOMIC COMMIT PHASE (All validations passed — commit synchronously)
    // =========================================================================
    const submittedAt = new Date().toISOString();
    const anonymousSelections = normalizedSelections.map((s) => ({
      positionId: s.positionId,
      candidateIds: [...s.candidateIds]
    }));

    // 10a. Create decoupled anonymous ballot record (ZERO student identity fields)
    const ballotId = `bal-${crypto.randomUUID()}`;
    const ballotIntegrityDigest = crypto
      .createHash('sha256')
      .update(JSON.stringify({ ballotId, electionId, selections: anonymousSelections }))
      .digest('hex');

    const anonymousRecord: AnonymousBallotRecord = {
      ballotId,
      electionId,
      recordedAtBucket: getCoarseTimestampBucket(new Date(submittedAt)),
      selections: anonymousSelections,
      ballotIntegrityDigest
    };

    // Insert at a randomized position in ANONYMOUS_BALLOT_VAULT to avoid insertion-order correlation
    if (ANONYMOUS_BALLOT_VAULT.length > 0) {
      const randomIdx = crypto.randomInt(0, ANONYMOUS_BALLOT_VAULT.length + 1);
      ANONYMOUS_BALLOT_VAULT.splice(randomIdx, 0, anonymousRecord);
    } else {
      ANONYMOUS_BALLOT_VAULT.push(anonymousRecord);
    }

    // 10b. Increment candidate tallies & recalculate position percentages
    for (const sel of normalizedSelections) {
      for (const candId of sel.candidateIds) {
        const cand = CANDIDATES_STORE.get(candId);
        if (cand) {
          cand.votesReceived = (cand.votesReceived || 0) + 1;
          CANDIDATES_STORE.set(candId, cand);
        }
      }

      // Recompute percentages across approved candidates in this position
      const posApproved = Array.from(CANDIDATES_STORE.values()).filter(
        (c) =>
          c.electionId === electionId &&
          c.positionId === sel.positionId &&
          c.applicationStatus === 'Approved'
      );
      const posTotalVotes = posApproved.reduce((sum, c) => sum + (c.votesReceived || 0), 0);
      if (posTotalVotes > 0) {
        for (const c of posApproved) {
          c.votePercentage = Number((((c.votesReceived || 0) / posTotalVotes) * 100).toFixed(1));
          CANDIDATES_STORE.set(c.id, c);
        }
      }
    }

    // 10c. Update election totalVotesCast & turnoutPercentage
    election.totalVotesCast = (election.totalVotesCast || 0) + 1;
    election.turnoutPercentage =
      election.totalEligibleVoters > 0
        ? Number(((election.totalVotesCast / election.totalEligibleVoters) * 100).toFixed(1))
        : 0;
    election.updatedAt = submittedAt;
    ELECTIONS_STORE.set(electionId, election);

    // 10d. Record identity-only participation in VOTER_PARTICIPATION_VAULT (NO candidate IDs)
    const year = new Date().getFullYear();
    const confirmationRef = `UCC-VOTE-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const receiptHash = crypto
      .createHash('sha256')
      .update(`${confirmationRef}:${electionId}:${student.id}:${submittedAt}`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();

    const positionsCompleted = normalizedSelections.map((s) => ({
      id: s.positionId,
      title: s.positionTitle,
      status: (s.candidateIds.length > 0 ? 'VOTED' : 'ABSTAINED') as 'VOTED' | 'ABSTAINED'
    }));

    const participationRecord: VoterParticipationRecord = {
      participationKey: lockKey,
      electionId,
      electionTitle: election.title,
      electionCategory: election.category,
      studentAccountId: student.id,
      studentId: student.studentId,
      votedAt: submittedAt,
      confirmationRef,
      receiptHash,
      positionsCompleted
    };

    VOTER_PARTICIPATION_VAULT.set(lockKey, participationRecord);

    if (!student.hasVotedElections.includes(electionId)) {
      student.hasVotedElections.push(electionId);
    }

    if (idempotencyKey && typeof idempotencyKey === 'string') {
      USED_IDEMPOTENCY_KEYS.set(`${lockKey}::${idempotencyKey.trim()}`, confirmationRef);
    }

    // 10e. Write privacy-preserving audit log (NEVER includes candidate choices)
    logAuditEvent({
      eventType: 'VOTE_CAST',
      userId: student.id,
      identifier: student.studentId,
      role: 'Student',
      ipAddress,
      status: 'SUCCESS',
      details: `Verified ballot participation recorded for election ${election.code} (${positionsCompleted.length} portfolio(s)). Confirmation Ref: ${confirmationRef}. Candidate choices decoupled from voter record.`
    });

    return {
      httpStatus: 201,
      success: true,
      code: 'VOTE_RECORDED',
      message: 'YOUR VOTE HAS BEEN SUCCESSFULLY SUBMITTED.',
      receipt: buildReceiptFromParticipation(participationRecord),
      updatedTurnout: {
        totalVotesCast: election.totalVotesCast,
        totalEligibleVoters: election.totalEligibleVoters,
        turnoutPercentage: election.turnoutPercentage
      }
    };
  } finally {
    IN_FLIGHT_VOTE_LOCKS.delete(lockKey);
  }
}
