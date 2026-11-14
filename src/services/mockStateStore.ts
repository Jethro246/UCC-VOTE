/**
 * TEMPORARY FRONTEND MOCK STATE STORE (NO BACKEND CONNECTED)
 *
 * Holds mutable demonstration state in browser memory (with optional localStorage
 * for temporary session preview continuity). This is NOT a secure database and
 * must be replaced by real backend API services before production deployment.
 */

import type {
  BallotAccountingSummary,
  Candidate,
  CandidateResultRow,
  DepartmentUnit,
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionResultsPayload,
  FacultyUnit,
  HallUnit,
  Position,
  PositionResultSummary,
  ResultsWorkflowStage,
  TurnoutBreakdownRow,
  VoteConfirmationReceipt
} from '../types';
import {
  MOCK_CANDIDATES,
  MOCK_ELECTIONS,
  MOCK_POSITIONS
} from '../data/mockData';
import {
  categoryToDomainId,
  TEMP_DEMO_ADMIN_ACCOUNTS,
  TEMP_DEMO_STUDENT_ACCOUNTS,
  TEMP_DEPARTMENTS_REGISTRY,
  TEMP_DOMAINS_REGISTRY,
  TEMP_FACULTIES_REGISTRY,
  TEMP_HALLS_REGISTRY,
  TEMP_INITIAL_LEDGER_DATA,
  TEMP_OFFICIAL_STUDENT_REGISTRY
} from '../data/temporaryMockRegistry';
import type {
  TempAuditLogEntry,
  TempDemoAdminAccount,
  TempDemoStudentAccount,
  TempElectionBallotLedger,
  TempOfficialStudentRecord,
  TempPositionRawTally,
  TempRawCohortCount
} from '../data/temporaryMockRegistry';

export const TEMP_PRIVACY_COHORT_THRESHOLD = 25;
const TEMP_RECEIPTS_STORAGE_KEY = 'ucc_vote_temp_demo_receipts';

function cloneDeep<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

class TemporaryMockStateStore {
  domains: DomainRegistryItem[] = cloneDeep(TEMP_DOMAINS_REGISTRY);
  halls: HallUnit[] = cloneDeep(TEMP_HALLS_REGISTRY);
  faculties: FacultyUnit[] = cloneDeep(TEMP_FACULTIES_REGISTRY);
  departments: DepartmentUnit[] = cloneDeep(TEMP_DEPARTMENTS_REGISTRY);

  elections: Election[] = cloneDeep(MOCK_ELECTIONS);
  positionsByElection: Record<string, Position[]> = cloneDeep(MOCK_POSITIONS);
  candidates: Candidate[] = cloneDeep(Object.values(MOCK_CANDIDATES));

  officialRegistry: Record<string, TempOfficialStudentRecord> = cloneDeep(
    TEMP_OFFICIAL_STUDENT_REGISTRY
  );
  studentAccounts: TempDemoStudentAccount[] = cloneDeep(TEMP_DEMO_STUDENT_ACCOUNTS);
  adminAccounts: TempDemoAdminAccount[] = cloneDeep(TEMP_DEMO_ADMIN_ACCOUNTS);

  ledgers: Map<string, TempElectionBallotLedger> = new Map(
    cloneDeep(TEMP_INITIAL_LEDGER_DATA).map((l) => [l.electionId, l])
  );

  // Temporary demo participation receipts keyed by `${studentId}::${electionId}`
  demoReceipts: Map<string, VoteConfirmationReceipt> = new Map();

  // Temporary demo password reset tokens
  demoResetTokens: Map<string, { studentId: string; code: string; expiresAt: number }> = new Map();

  // Temporary demo failed login counters
  demoFailedAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();

  auditLogs: TempAuditLogEntry[] = [
    {
      id: 'demo-log-1',
      timestamp: new Date().toISOString(),
      eventType: 'FRONTEND_PREVIEW_INIT',
      identifier: 'UCC VOTE Frontend',
      role: 'Preview Mode',
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details:
        'Initialized temporary frontend demonstration store (no backend or database connected).'
    }
  ];

  constructor() {
    this.restoreDemoReceipts();
  }

  private restoreDemoReceipts() {
    try {
      const raw = localStorage.getItem(TEMP_RECEIPTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<[string, VoteConfirmationReceipt]>;
      if (Array.isArray(parsed)) {
        parsed.forEach(([key, val]) => {
          this.demoReceipts.set(key, val);
          const [studentId, electionId] = key.split('::');
          const stu = this.findStudentById(studentId);
          if (stu && !stu.hasVotedElections.includes(electionId)) {
            stu.hasVotedElections.push(electionId);
          }
        });
      }
    } catch {
      // ignore localStorage errors
    }
  }

  persistDemoReceipts() {
    try {
      localStorage.setItem(
        TEMP_RECEIPTS_STORAGE_KEY,
        JSON.stringify(Array.from(this.demoReceipts.entries()))
      );
    } catch {
      // ignore localStorage errors
    }
  }

  findStudentById(identifier: string): TempDemoStudentAccount | undefined {
    const clean = identifier.trim().toUpperCase();
    return this.studentAccounts.find(
      (s) =>
        s.studentId.toUpperCase() === clean ||
        s.indexNumber.toUpperCase() === clean ||
        s.id.toUpperCase() === clean
    );
  }

  findAdminByStaffId(staffId: string): TempDemoAdminAccount | undefined {
    const clean = staffId.trim().toUpperCase();
    return this.adminAccounts.find(
      (a) => a.staffId.toUpperCase() === clean || a.id.toUpperCase() === clean
    );
  }

  logAuditEvent(entry: Omit<TempAuditLogEntry, 'id' | 'timestamp'>) {
    this.auditLogs.unshift({
      ...entry,
      id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString()
    });
    if (this.auditLogs.length > 100) {
      this.auditLogs = this.auditLogs.slice(0, 100);
    }
  }

  getOrCreateLedger(electionId: string): TempElectionBallotLedger | null {
    const election = this.elections.find((e) => e.id === electionId);
    if (!election) return null;

    let ledger = this.ledgers.get(electionId);
    if (ledger) return ledger;

    const positions = this.positionsByElection[electionId] || [];
    const positionTallies: Record<string, TempPositionRawTally> = {};
    positions.forEach((pos) => {
      const candidateVotes: Record<string, number> = {};
      pos.candidateIds.forEach((cid) => {
        const c = this.candidates.find((cand) => cand.id === cid);
        if (c && c.applicationStatus === 'Approved') {
          candidateVotes[cid] = c.votesReceived || 0;
        }
      });
      positionTallies[pos.id] = {
        candidateVotes,
        blankVotes: 0,
        invalidVotes: 0
      };
    });

    const stage: ResultsWorkflowStage =
      election.status === 'results_published'
        ? 'published'
        : election.status === 'results_pending_certification'
        ? 'audit'
        : 'preliminary';

    ledger = {
      electionId,
      workflowStage: stage,
      workflowHistory: [
        {
          stage,
          actorId: 'system',
          actorName: 'Frontend Demo Store',
          actorRole: 'Preview Mode',
          timestamp: election.createdAt || new Date().toISOString(),
          notes: 'Temporary frontend tally ledger initialized.'
        }
      ],
      invalidBallots: 0,
      blankOverallBallots: 0,
      positionTallies,
      cohorts: {
        byFaculty: [],
        byDepartment: [],
        byLevel: [],
        byHall: []
      }
    };

    this.ledgers.set(electionId, ledger);
    return ledger;
  }

  private roundPct(numerator: number, denominator: number): number {
    if (!denominator || denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  }

  private applyPrivacyProtection(rows: TempRawCohortCount[]): TurnoutBreakdownRow[] {
    return rows.map((row) => {
      const smallCohort = row.eligibleVoters < TEMP_PRIVACY_COHORT_THRESHOLD;
      const remainder = row.eligibleVoters - row.ballotsCast;
      const sparseCell =
        row.eligibleVoters < 40 &&
        ((row.ballotsCast > 0 && row.ballotsCast < 5) || (remainder > 0 && remainder < 5));

      if (smallCohort || sparseCell) {
        return {
          label: row.label,
          eligibleVoters: row.eligibleVoters,
          ballotsCast: null,
          turnoutPercentage: null,
          suppressed: true,
          suppressionReason: `Suppressed under demo privacy rule (< ${TEMP_PRIVACY_COHORT_THRESHOLD} eligible cohort threshold)`
        };
      }

      return {
        label: row.label,
        eligibleVoters: row.eligibleVoters,
        ballotsCast: row.ballotsCast,
        turnoutPercentage: this.roundPct(row.ballotsCast, row.eligibleVoters),
        suppressed: false
      };
    });
  }

  computeElectionResults(
    electionId: string,
    includePrivateTallies: boolean
  ): ElectionResultsPayload | null {
    const election = this.elections.find((e) => e.id === electionId);
    if (!election) return null;

    const ledger = this.getOrCreateLedger(electionId);
    if (!ledger) return null;

    const isPublished =
      ledger.workflowStage === 'published' || election.status === 'results_published';
    const canRevealCandidateTallies = isPublished || includePrivateTallies;

    const positions = (this.positionsByElection[electionId] || [])
      .slice()
      .sort((a, b) => a.order - b.order);

    let primaryBallotsProcessed = 0;
    let primaryValidBallots = 0;

    const computedPositions: PositionResultSummary[] = positions.map((pos, idx) => {
      const rawTally = ledger.positionTallies[pos.id] || {
        candidateVotes: {},
        blankVotes: 0,
        invalidVotes: ledger.invalidBallots
      };

      const approvedCandidates: Candidate[] = [];
      pos.candidateIds.forEach((cid) => {
        const cand = this.candidates.find((c) => c.id === cid);
        if (cand && cand.applicationStatus === 'Approved') {
          approvedCandidates.push(cand);
        }
      });

      this.candidates.forEach((cand) => {
        if (
          cand.electionId === electionId &&
          cand.positionId === pos.id &&
          cand.applicationStatus === 'Approved' &&
          !approvedCandidates.some((existing) => existing.id === cand.id)
        ) {
          approvedCandidates.push(cand);
        }
      });

      const totalValidVotes = approvedCandidates.reduce((sum, cand) => {
        const count = rawTally.candidateVotes[cand.id] ?? cand.votesReceived ?? 0;
        return sum + count;
      }, 0);

      const totalBallotsProcessed = totalValidVotes + rawTally.blankVotes + rawTally.invalidVotes;

      if (idx === 0) {
        primaryValidBallots = totalValidVotes;
        primaryBallotsProcessed = totalBallotsProcessed;
      }

      const unsortedRows = approvedCandidates.map((cand) => {
        const votesReceived = rawTally.candidateVotes[cand.id] ?? cand.votesReceived ?? 0;
        return {
          cand,
          votesReceived,
          pctValid: this.roundPct(votesReceived, totalValidVotes),
          pctBallots: this.roundPct(votesReceived, totalBallotsProcessed)
        };
      });

      unsortedRows.sort((a, b) => b.votesReceived - a.votesReceived);

      const maxVotes = unsortedRows.length > 0 ? unsortedRows[0].votesReceived : 0;
      const leaders = maxVotes > 0 ? unsortedRows.filter((r) => r.votesReceived === maxVotes) : [];
      const isTie = leaders.length > 1;
      const tiedCandidateIds = isTie ? leaders.map((l) => l.cand.id) : [];
      const winnerCandidateIds =
        !isTie && leaders.length === 1 && (isPublished || ledger.workflowStage === 'certified')
          ? [leaders[0].cand.id]
          : [];

      const candidateRows: CandidateResultRow[] = unsortedRows.map((item, rIdx) => {
        const isLeader = maxVotes > 0 && item.votesReceived === maxVotes;
        return {
          candidateId: item.cand.id,
          fullName: item.cand.fullName,
          nickname: item.cand.nickname,
          studentId: item.cand.studentId,
          photoUrl: item.cand.photoUrl,
          department: item.cand.department,
          faculty: item.cand.faculty,
          hall: item.cand.hall,
          votesReceived: item.votesReceived,
          percentageOfValidVotes: item.pctValid,
          percentageOfTotalBallots: item.pctBallots,
          rank: rIdx + 1,
          isLeading: isLeader,
          isWinner: !isTie && isLeader && (isPublished || ledger.workflowStage === 'certified'),
          isTied: isTie && isLeader
        };
      });

      return {
        positionId: pos.id,
        title: pos.title,
        description: pos.description,
        order: pos.order,
        totalValidVotes,
        blankVotes: rawTally.blankVotes,
        invalidVotes: rawTally.invalidVotes,
        totalBallotsProcessed,
        isTie,
        tiedCandidateIds,
        winnerCandidateIds,
        candidates: candidateRows
      };
    });

    const totalEligibleVoters = election.totalEligibleVoters || 0;
    const validBallots = primaryValidBallots || election.totalVotesCast || 0;
    const invalidBallots = ledger.invalidBallots || 0;
    const blankBallots = ledger.blankOverallBallots || 0;
    const totalBallotsCast =
      primaryBallotsProcessed > 0
        ? primaryBallotsProcessed
        : validBallots + invalidBallots + blankBallots;
    const uncastBallots = Math.max(0, totalEligibleVoters - totalBallotsCast);

    const ballotSummary: BallotAccountingSummary = {
      totalEligibleVoters,
      totalBallotsCast,
      validBallots,
      invalidBallots,
      blankBallots,
      uncastBallots,
      turnoutPercentage: this.roundPct(totalBallotsCast, totalEligibleVoters),
      validBallotRate: this.roundPct(validBallots, totalBallotsCast),
      invalidBallotRate: this.roundPct(invalidBallots, totalBallotsCast),
      blankBallotRate: this.roundPct(blankBallots, totalBallotsCast)
    };

    election.totalVotesCast = totalBallotsCast;
    election.turnoutPercentage = ballotSummary.turnoutPercentage;

    return {
      electionId: election.id,
      electionTitle: election.title,
      electionCode: election.code,
      category: election.category,
      domainId: election.domainId || categoryToDomainId(election.category, this.domains),
      subdomainLabel: election.subdomainLabel,
      status: election.status,
      academicYear: election.academicYear,
      organizingBody: election.organizingBody,
      startDate: election.startDate,
      endDate: election.endDate,
      publishedAt: ledger.publishedAt,
      workflowStage: ledger.workflowStage,
      workflowHistory: ledger.workflowHistory,
      isPublished,
      resultsCertified:
        election.resultsCertified || ledger.workflowStage === 'certified' || isPublished,
      certificationHash: ledger.certificationHash,
      certifiedBy: ledger.certifiedBy,
      ballotSummary,
      positions: canRevealCandidateTallies ? computedPositions : [],
      turnoutAnalytics: {
        privacyThreshold: TEMP_PRIVACY_COHORT_THRESHOLD,
        byFaculty: this.applyPrivacyProtection(ledger.cohorts.byFaculty),
        byDepartment: this.applyPrivacyProtection(ledger.cohorts.byDepartment),
        byLevel: this.applyPrivacyProtection(ledger.cohorts.byLevel),
        byHall: this.applyPrivacyProtection(ledger.cohorts.byHall)
      }
    };
  }
}

export const mockStateStore = new TemporaryMockStateStore();
