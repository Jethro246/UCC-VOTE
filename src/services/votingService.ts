/**
 * TEMPORARY FRONTEND-ONLY VOTING INTERFACE SERVICE
 *
 * Implements IVotingService against temporary browser memory and localStorage
 * for frontend UI demonstration only. No backend API is connected and NO real
 * votes are transmitted, encrypted, or permanently recorded.
 *
 * Replace method bodies with real backend voting API calls in the future.
 */

import type {
  BallotSelectionMap,
  Candidate,
  Position,
  StudentProfile,
  VoteConfirmationReceipt
} from '../types';
import { evaluateTempStudentEligibility } from '../data/temporaryMockRegistry';
import { authClient } from './authClient';
import { mockStateStore } from './mockStateStore';
import type { IVotingService } from './interfaces';

function buildSeededDemoReceipt(
  studentId: string,
  electionId: string
): VoteConfirmationReceipt | null {
  const election = mockStateStore.elections.find((e) => e.id === electionId);
  if (!election) return null;
  const positions = mockStateStore.positionsByElection[electionId] || [];
  return {
    confirmationRef: `DEMO-SEEDED-${election.code.replace(/[^A-Z0-9]/gi, '').slice(0, 8)}`,
    receiptHash: 'LOCAL-DEMO-ONLY',
    electionId: election.id,
    electionTitle: election.title,
    electionCategory: election.category,
    domainId: election.domainId,
    submittedAt: election.endDate || new Date().toISOString(),
    positionsCompleted: positions.map((p) => ({
      id: p.id,
      title: p.title,
      status: 'VOTED'
    })),
    message:
      'Sample demonstration participation entry (temporary frontend preview data — no backend connected).'
  };
}

function getApprovedCandidatesForPosition(electionId: string, pos: Position): Candidate[] {
  const seen = new Set<string>();
  const result: Candidate[] = [];

  pos.candidateIds.forEach((cid) => {
    const c = mockStateStore.candidates.find((cand) => cand.id === cid);
    if (c && c.applicationStatus === 'Approved' && !seen.has(c.id)) {
      seen.add(c.id);
      result.push(c);
    }
  });

  mockStateStore.candidates.forEach((c) => {
    if (
      c.electionId === electionId &&
      c.positionId === pos.id &&
      c.applicationStatus === 'Approved' &&
      !seen.has(c.id)
    ) {
      seen.add(c.id);
      result.push(c);
    }
  });

  return result;
}

class FrontendDemoVotingService implements IVotingService {
  async getBallot(electionId: string) {
    const role = authClient.getStoredRole();
    const storedUser = authClient.getStoredUser();

    if (role === 'admin') {
      return {
        success: false,
        httpStatus: 403,
        code: 'ADMIN_VOTING_FORBIDDEN',
        error:
          'Administrative accounts cannot enter voter ballots. Switch to a demonstration student account to preview the ballot.'
      };
    }

    if (role !== 'student' || !storedUser) {
      return {
        success: false,
        httpStatus: 401,
        code: 'AUTH_REQUIRED',
        error: 'Please sign in with a demonstration student account to preview the digital ballot.'
      };
    }

    const election = mockStateStore.elections.find((e) => e.id === electionId);
    if (!election) {
      return {
        success: false,
        httpStatus: 404,
        code: 'ELECTION_NOT_FOUND',
        error: 'The requested election was not found in the temporary mock data.'
      };
    }

    const liveAccount = mockStateStore.findStudentById(storedUser.studentId || storedUser.id);
    const student: StudentProfile = liveAccount || storedUser;

    if (liveAccount?.status === 'suspended' || student.status === 'suspended') {
      return {
        success: false,
        httpStatus: 403,
        code: 'ACCOUNT_SUSPENDED',
        election,
        error:
          'This demonstration student account is marked as suspended in temporary mock data.'
      };
    }

    const receiptKey = `${student.studentId.toUpperCase()}::${electionId}`;
    const existingReceipt =
      mockStateStore.demoReceipts.get(receiptKey) ||
      (student.hasVotedElections?.includes(electionId)
        ? buildSeededDemoReceipt(student.studentId, electionId)
        : null);

    if (existingReceipt) {
      return {
        success: false,
        httpStatus: 409,
        code: 'ALREADY_VOTED',
        alreadyVoted: true,
        receipt: existingReceipt,
        election,
        error:
          'This demonstration account already has a completed ballot preview for this election.'
      };
    }

    if (
      election.status === 'upcoming' ||
      election.status === 'scheduled' ||
      election.status === 'draft' ||
      election.status === 'pending_approval'
    ) {
      return {
        success: false,
        httpStatus: 403,
        code: 'ELECTION_NOT_OPEN',
        opensAt: election.startDate,
        election,
        error: `Voting for ${election.title} has not opened yet.`
      };
    }

    if (election.status === 'suspended') {
      return {
        success: false,
        httpStatus: 403,
        code: 'ELECTION_SUSPENDED',
        election,
        error: `${election.title} is currently suspended in temporary demo status.`
      };
    }

    if (
      election.status === 'closed' ||
      election.status === 'results_pending_certification' ||
      election.status === 'results_published' ||
      election.status === 'archived'
    ) {
      return {
        success: false,
        httpStatus: 403,
        code: 'ELECTION_CLOSED',
        closesAt: election.endDate,
        election,
        error: `Polling for ${election.title} is closed.`
      };
    }

    const eligibility = evaluateTempStudentEligibility(student, election);
    if (!eligibility.isEligible) {
      return {
        success: false,
        httpStatus: 403,
        code: 'INELIGIBLE_VOTER',
        election,
        eligibility,
        error: eligibility.reason
      };
    }

    const positions = (mockStateStore.positionsByElection[electionId] || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((position) => ({
        position,
        candidates: getApprovedCandidatesForPosition(electionId, position)
      }));

    return {
      success: true,
      httpStatus: 200,
      election,
      eligibility,
      positions
    };
  }

  async submitBallot(
    electionId: string,
    selections: BallotSelectionMap,
    _idempotencyKey?: string
  ) {
    const ballotCheck = await this.getBallot(electionId);
    if (!ballotCheck.success || !ballotCheck.election || !ballotCheck.positions) {
      return {
        success: false,
        httpStatus: ballotCheck.httpStatus || 400,
        code: ballotCheck.code || 'BALLOT_INVALID',
        error: ballotCheck.error || 'Ballot validation failed.'
      };
    }

    const election = ballotCheck.election;
    const storedUser = authClient.getStoredUser();
    const liveAccount = storedUser
      ? mockStateStore.findStudentById(storedUser.studentId || storedUser.id)
      : undefined;
    const student: StudentProfile = liveAccount || storedUser;

    // Validate selections per position
    let totalPicked = 0;
    const positionsCompleted: VoteConfirmationReceipt['positionsCompleted'] = [];

    for (const { position, candidates } of ballotCheck.positions) {
      const picked = Array.isArray(selections[position.id]) ? selections[position.id] : [];
      const maxAllowed = position.maxSelections || 1;

      if (picked.length > maxAllowed) {
        return {
          success: false,
          httpStatus: 400,
          code: 'TOO_MANY_SELECTIONS',
          error: `You may select at most ${maxAllowed} candidate(s) for ${position.title}.`
        };
      }

      const validIds = new Set(candidates.map((c) => c.id));
      for (const cid of picked) {
        if (!validIds.has(cid)) {
          return {
            success: false,
            httpStatus: 400,
            code: 'INVALID_CANDIDATE',
            error: `Selected candidate is not approved for ${position.title}.`
          };
        }
      }

      if (candidates.length > 0 && !position.allowsSkip && picked.length === 0) {
        return {
          success: false,
          httpStatus: 400,
          code: 'REQUIRED_POSITION_MISSING',
          error: `Please select a candidate for ${position.title} before completing the preview.`
        };
      }

      totalPicked += picked.length;
      positionsCompleted.push({
        id: position.id,
        title: position.title,
        status: picked.length > 0 ? 'VOTED' : 'ABSTAINED'
      });
    }

    if (totalPicked === 0 && !election.allowsEmptyBallot) {
      return {
        success: false,
        httpStatus: 400,
        code: 'EMPTY_BALLOT_FORBIDDEN',
        error: 'Empty ballots are not permitted for this election.'
      };
    }

    // Update temporary in-memory demo tally for UI preview (NOT a real/secure vote)
    const ledger = mockStateStore.getOrCreateLedger(electionId);
    if (ledger) {
      for (const { position } of ballotCheck.positions) {
        const picked = Array.isArray(selections[position.id]) ? selections[position.id] : [];
        if (!ledger.positionTallies[position.id]) {
          ledger.positionTallies[position.id] = {
            candidateVotes: {},
            blankVotes: 0,
            invalidVotes: 0
          };
        }
        if (picked.length === 0) {
          ledger.positionTallies[position.id].blankVotes += 1;
        } else {
          picked.forEach((cid) => {
            ledger.positionTallies[position.id].candidateVotes[cid] =
              (ledger.positionTallies[position.id].candidateVotes[cid] || 0) + 1;
            const cand = mockStateStore.candidates.find((c) => c.id === cid);
            if (cand) {
              cand.votesReceived = (cand.votesReceived || 0) + 1;
            }
          });
        }
      }
    }

    election.totalVotesCast = (election.totalVotesCast || 0) + 1;
    election.turnoutPercentage =
      election.totalEligibleVoters > 0
        ? Math.round((election.totalVotesCast / election.totalEligibleVoters) * 1000) / 10
        : 0;

    if (liveAccount && !liveAccount.hasVotedElections.includes(electionId)) {
      liveAccount.hasVotedElections.push(electionId);
    }
    await authClient.getMe();

    const receipt: VoteConfirmationReceipt = {
      confirmationRef: `DEMO-PREVIEW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      receiptHash: 'LOCAL-DEMO-ONLY',
      electionId: election.id,
      electionTitle: election.title,
      electionCategory: election.category,
      domainId: election.domainId,
      submittedAt: new Date().toISOString(),
      positionsCompleted,
      message:
        'Frontend ballot preview completed locally in your browser. No backend vote was transmitted or recorded.'
    };

    const receiptKey = `${student.studentId.toUpperCase()}::${electionId}`;
    mockStateStore.demoReceipts.set(receiptKey, receipt);
    mockStateStore.persistDemoReceipts();

    mockStateStore.logAuditEvent({
      eventType: 'DEMO_BALLOT_PREVIEW',
      identifier: 'Local Browser Preview',
      role: 'Student (Demo)',
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details: `Frontend ballot preview completed for ${election.title} (local demo only; no candidate choices logged).`
    });

    return {
      success: true,
      httpStatus: 200,
      message: receipt.message,
      receipt,
      updatedTurnout: {
        totalVotesCast: election.totalVotesCast,
        totalEligibleVoters: election.totalEligibleVoters,
        turnoutPercentage: election.turnoutPercentage
      }
    };
  }

  async getVoteConfirmation(electionId: string) {
    const storedUser = authClient.getStoredUser();
    if (!storedUser || authClient.getStoredRole() !== 'student') {
      return { success: false, error: 'Student sign-in required.' };
    }
    const key = `${(storedUser.studentId || '').toUpperCase()}::${electionId}`;
    const receipt =
      mockStateStore.demoReceipts.get(key) ||
      (storedUser.hasVotedElections?.includes(electionId)
        ? buildSeededDemoReceipt(storedUser.studentId, electionId)
        : null);

    if (!receipt) {
      return { success: false, error: 'No demonstration receipt found for this election.' };
    }
    return { success: true, receipt };
  }

  async getMyConfirmations() {
    const storedUser = authClient.getStoredUser();
    if (!storedUser || authClient.getStoredRole() !== 'student') {
      return { success: false, receipts: [], error: 'Student sign-in required.' };
    }
    const prefix = `${(storedUser.studentId || '').toUpperCase()}::`;
    const receipts: VoteConfirmationReceipt[] = [];

    mockStateStore.demoReceipts.forEach((val, key) => {
      if (key.startsWith(prefix)) {
        receipts.push(val);
      }
    });

    (storedUser.hasVotedElections || []).forEach((elId: string) => {
      if (!receipts.some((r) => r.electionId === elId)) {
        const seeded = buildSeededDemoReceipt(storedUser.studentId, elId);
        if (seeded) receipts.push(seeded);
      }
    });

    return { success: true, receipts };
  }
}

export const votingService = new FrontendDemoVotingService();
