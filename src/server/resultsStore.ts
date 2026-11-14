import crypto from 'crypto';
import type {
  ElectionResultsPayload,
  ResultsWorkflowStage,
  WorkflowAuditAction,
  PositionResultSummary,
  CandidateResultRow,
  TurnoutBreakdownRow,
  BallotAccountingSummary,
  Candidate
} from '../types/index.ts';
import {
  ELECTIONS_STORE,
  POSITIONS_STORE,
  CANDIDATES_STORE,
  calculateEligibleVoterCount,
  verifyStudentEligibility
} from './electionStore.ts';
import { categoryToDomainId } from './domainStore.ts';
import { getCombinedStudentDirectory, logAuditEvent } from './authStore.ts';

export const PRIVACY_COHORT_THRESHOLD = 25;

export interface RawCohortCount {
  label: string;
  eligibleVoters: number;
  ballotsCast: number;
}

export interface PositionRawTally {
  candidateVotes: Record<string, number>;
  blankVotes: number;
  invalidVotes: number;
}

export interface ElectionBallotLedger {
  electionId: string;
  workflowStage: ResultsWorkflowStage;
  workflowHistory: WorkflowAuditAction[];
  publishedAt?: string;
  certificationHash?: string;
  certifiedBy?: string;
  invalidBallots: number;
  blankOverallBallots: number;
  positionTallies: Record<string, PositionRawTally>;
  cohorts: {
    byFaculty: RawCohortCount[];
    byDepartment: RawCohortCount[];
    byLevel: RawCohortCount[];
    byHall: RawCohortCount[];
  };
}

export const WORKFLOW_ORDER: ResultsWorkflowStage[] = [
  'preliminary',
  'verification',
  'audit',
  'approved',
  'certified',
  'published'
];

export const BALLOT_LEDGER_STORE: Map<string, ElectionBallotLedger> = new Map();

function roundPct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function generateCertificationSignature(electionId: string, totalCast: number, validBallots: number): string {
  const seed = `${electionId}|${totalCast}|${validBallots}|UCC-EC-SEAL|${Date.now()}`;
  return 'SHA256:' + crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24).toUpperCase();
}

/**
 * Initialize clean zero-vote ledgers for seeded elections.
 * Real tallies and cohorts populate exclusively from committed verified ballots.
 */
function initializeBallotLedgers() {
  for (const election of ELECTIONS_STORE.values()) {
    getOrCreateLedger(election.id);
  }
}

initializeBallotLedgers();

/**
 * Ensures any dynamically created election has an authoritative ledger entry
 */
export function getOrCreateLedger(electionId: string): ElectionBallotLedger | null {
  const election = ELECTIONS_STORE.get(electionId);
  if (!election) return null;

  let ledger = BALLOT_LEDGER_STORE.get(electionId);
  if (ledger) return ledger;

  const positions = POSITIONS_STORE.get(electionId) || [];
  const positionTallies: Record<string, PositionRawTally> = {};

  positions.forEach((pos) => {
    const candidateVotes: Record<string, number> = {};
    pos.candidateIds.forEach((cid) => {
      const c = CANDIDATES_STORE.get(cid);
      if (c && c.applicationStatus === 'Approved') {
        candidateVotes[cid] = 0;
      }
    });
    positionTallies[pos.id] = {
      candidateVotes,
      blankVotes: 0,
      invalidVotes: 0
    };
  });

  const stage: ResultsWorkflowStage =
    election.status === 'results_published' ? 'published' : 'preliminary';

  ledger = {
    electionId,
    workflowStage: stage,
    workflowHistory: [
      {
        stage,
        actorId: 'system',
        actorName: 'Commission Ledger',
        actorRole: 'System',
        timestamp: election.createdAt || new Date().toISOString(),
        notes: 'Election ledger initialized.'
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

  BALLOT_LEDGER_STORE.set(electionId, ledger);
  return ledger;
}

function buildDynamicTurnoutCohorts(electionId: string): {
  byFaculty: RawCohortCount[];
  byDepartment: RawCohortCount[];
  byLevel: RawCohortCount[];
  byHall: RawCohortCount[];
} {
  const election = ELECTIONS_STORE.get(electionId);
  if (!election) {
    return { byFaculty: [], byDepartment: [], byLevel: [], byHall: [] };
  }

  const facultyMap = new Map<string, RawCohortCount>();
  const deptMap = new Map<string, RawCohortCount>();
  const levelMap = new Map<string, RawCohortCount>();
  const hallMap = new Map<string, RawCohortCount>();

  const bump = (map: Map<string, RawCohortCount>, label: string, voted: boolean) => {
    const clean = label || 'Unspecified';
    const existing = map.get(clean) || { label: clean, eligibleVoters: 0, ballotsCast: 0 };
    existing.eligibleVoters += 1;
    if (voted) existing.ballotsCast += 1;
    map.set(clean, existing);
  };

  for (const s of getCombinedStudentDirectory()) {
    if (s.status === 'suspended' || !s.isEligible || !s.isEnrolled) continue;
    const elig = verifyStudentEligibility(s, election);
    if (!elig.isEligible) continue;

    const voted = s.hasVotedElections.includes(election.id);
    const levelLabel = s.level === 'Postgraduate' ? 'Postgraduate' : `Level ${s.level}`;

    bump(facultyMap, s.faculty, voted);
    bump(deptMap, s.department, voted);
    bump(levelMap, levelLabel, voted);
    bump(hallMap, s.hall, voted);
  }

  const sortDesc = (m: Map<string, RawCohortCount>) =>
    Array.from(m.values()).sort((a, b) => b.eligibleVoters - a.eligibleVoters);

  return {
    byFaculty: sortDesc(facultyMap),
    byDepartment: sortDesc(deptMap),
    byLevel: sortDesc(levelMap),
    byHall: sortDesc(hallMap)
  };
}

/**
 * Applies k-anonymity privacy suppression to small cohorts
 */
function applyPrivacyProtection(rows: RawCohortCount[]): TurnoutBreakdownRow[] {
  return rows.map((row) => {
    const smallCohort = row.eligibleVoters < PRIVACY_COHORT_THRESHOLD;
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
        suppressionReason: `Suppressed under student privacy rule (< ${PRIVACY_COHORT_THRESHOLD} eligible cohort threshold)`
      };
    }

    return {
      label: row.label,
      eligibleVoters: row.eligibleVoters,
      ballotsCast: row.ballotsCast,
      turnoutPercentage: roundPct(row.ballotsCast, row.eligibleVoters),
      suppressed: false
    };
  });
}

/**
 * Server-Side Authoritative Election Results & Analytics Calculator
 * @param electionId Election identifier
 * @param includePrivateTallies Must ONLY be true for authorized officials or when results are officially published
 */
export function computeElectionResults(
  electionId: string,
  includePrivateTallies: boolean
): ElectionResultsPayload | null {
  const election = ELECTIONS_STORE.get(electionId);
  if (!election) return null;

  const ledger = getOrCreateLedger(electionId);
  if (!ledger) return null;

  const isPublished =
    ledger.workflowStage === 'published' || election.status === 'results_published';

  const canRevealCandidateTallies = isPublished || includePrivateTallies;

  const positions = (POSITIONS_STORE.get(electionId) || []).slice().sort((a, b) => a.order - b.order);

  // Determine overall ballots cast from primary position or election record
  let primaryBallotsProcessed = 0;
  let primaryValidBallots = 0;

  const computedPositions: PositionResultSummary[] = positions.map((pos, idx) => {
    const rawTally = ledger.positionTallies[pos.id] || {
      candidateVotes: {},
      blankVotes: 0,
      invalidVotes: ledger.invalidBallots
    };

    // Gather ONLY Approved candidates assigned to this position
    const approvedCandidates: Candidate[] = [];
    pos.candidateIds.forEach((cid) => {
      const cand = CANDIDATES_STORE.get(cid);
      if (cand && cand.applicationStatus === 'Approved') {
        approvedCandidates.push(cand);
      }
    });

    // Also include any approved candidates registered for this position in CANDIDATES_STORE
    for (const cand of CANDIDATES_STORE.values()) {
      if (
        cand.electionId === electionId &&
        cand.positionId === pos.id &&
        cand.applicationStatus === 'Approved' &&
        !approvedCandidates.some((existing) => existing.id === cand.id)
      ) {
        approvedCandidates.push(cand);
      }
    }

    const totalValidVotes = approvedCandidates.reduce((sum, cand) => {
      const count = rawTally.candidateVotes[cand.id] ?? 0;
      return sum + count;
    }, 0);

    const totalBallotsProcessed = totalValidVotes + rawTally.blankVotes + rawTally.invalidVotes;

    if (idx === 0) {
      primaryValidBallots = totalValidVotes;
      primaryBallotsProcessed = totalBallotsProcessed;
    }

    // Rank candidates strictly by valid votes descending
    const unsortedRows = approvedCandidates.map((cand) => {
      const votesReceived = rawTally.candidateVotes[cand.id] ?? 0;
      const pctValid = roundPct(votesReceived, totalValidVotes);
      const pctBallots = roundPct(votesReceived, totalBallotsProcessed);
      return {
        cand,
        votesReceived,
        pctValid,
        pctBallots
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

  // Authoritative overall voter participation accounting
  const domId = election.domainId || categoryToDomainId(election.category);
  const totalEligibleVoters = calculateEligibleVoterCount(election.eligibilityCriteria, domId);
  const validBallots = primaryValidBallots;
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
    turnoutPercentage: roundPct(totalBallotsCast, totalEligibleVoters),
    validBallotRate: roundPct(validBallots, totalBallotsCast),
    invalidBallotRate: roundPct(invalidBallots, totalBallotsCast),
    blankBallotRate: roundPct(blankBallots, totalBallotsCast)
  };

  // Sync election turnout metrics strictly from authoritative database records
  election.totalEligibleVoters = totalEligibleVoters;
  election.totalVotesCast = totalBallotsCast;
  election.turnoutPercentage = ballotSummary.turnoutPercentage;

  const dynamicCohorts = buildDynamicTurnoutCohorts(electionId);

  return {
    electionId: election.id,
    electionTitle: election.title,
    electionCode: election.code,
    category: election.category,
    domainId: domId,
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
    resultsCertified: election.resultsCertified || ledger.workflowStage === 'certified' || isPublished,
    certificationHash: ledger.certificationHash,
    certifiedBy: ledger.certifiedBy,
    ballotSummary,
    positions: canRevealCandidateTallies ? computedPositions : [],
    turnoutAnalytics: {
      privacyThreshold: PRIVACY_COHORT_THRESHOLD,
      byFaculty: applyPrivacyProtection(dynamicCohorts.byFaculty),
      byDepartment: applyPrivacyProtection(dynamicCohorts.byDepartment),
      byLevel: applyPrivacyProtection(dynamicCohorts.byLevel),
      byHall: applyPrivacyProtection(dynamicCohorts.byHall)
    }
  };
}

/**
 * Syncs an already-validated anonymous ballot's per-position selections directly into
 * BALLOT_LEDGER_STORE without receiving any voter identity data.
 */
export function syncAnonymousSelectionsIntoLedger(
  electionId: string,
  selections: Array<{ positionId: string; candidateIds: string[] }>
): void {
  const ledger = getOrCreateLedger(electionId);
  if (!ledger) return;

  let hasAnySelection = false;
  for (const sel of selections) {
    if (!ledger.positionTallies[sel.positionId]) {
      ledger.positionTallies[sel.positionId] = {
        candidateVotes: {},
        blankVotes: 0,
        invalidVotes: 0
      };
    }
    const tally = ledger.positionTallies[sel.positionId];
    if (!sel.candidateIds || sel.candidateIds.length === 0) {
      tally.blankVotes += 1;
    } else {
      hasAnySelection = true;
      for (const cid of sel.candidateIds) {
        tally.candidateVotes[cid] = (tally.candidateVotes[cid] || 0) + 1;
      }
    }
  }

  if (!hasAnySelection && selections.length > 0) {
    ledger.blankOverallBallots += 1;
  }
}

/**
 * Records a ballot cast on the server into the authoritative election tally ledger
 */
export function recordBallotCast(
  electionId: string,
  selections: Record<string, string>,
  voterMeta?: {
    faculty?: string;
    department?: string;
    level?: string;
    hall?: string;
  }
): { success: boolean; receiptCode: string; error?: string } {
  const election = ELECTIONS_STORE.get(electionId);
  if (!election) {
    return { success: false, receiptCode: '', error: 'Election not found.' };
  }

  const ledger = getOrCreateLedger(electionId);
  if (!ledger) {
    return { success: false, receiptCode: '', error: 'Ledger unavailable.' };
  }

  const positions = POSITIONS_STORE.get(electionId) || [];
  let hasAnyValidSelection = false;

  positions.forEach((pos) => {
    if (!ledger.positionTallies[pos.id]) {
      ledger.positionTallies[pos.id] = {
        candidateVotes: {},
        blankVotes: 0,
        invalidVotes: 0
      };
    }

    const posTally = ledger.positionTallies[pos.id];
    const selectedCandId = selections[pos.id];

    if (!selectedCandId) {
      posTally.blankVotes += 1;
    } else {
      const cand = CANDIDATES_STORE.get(selectedCandId);
      if (cand && cand.applicationStatus === 'Approved' && cand.electionId === electionId) {
        posTally.candidateVotes[selectedCandId] = (posTally.candidateVotes[selectedCandId] || 0) + 1;
        cand.votesReceived = posTally.candidateVotes[selectedCandId];
        hasAnyValidSelection = true;
      } else {
        posTally.invalidVotes += 1;
      }
    }
  });

  if (!hasAnyValidSelection && positions.length > 0) {
    ledger.blankOverallBallots += 1;
  }

  // Update cohort participation counters if matching cohort exists
  if (voterMeta?.faculty) {
    const fac = ledger.cohorts.byFaculty.find((f) =>
      f.label.toLowerCase().includes(voterMeta.faculty!.toLowerCase())
    );
    if (fac) fac.ballotsCast += 1;
  }
  if (voterMeta?.level) {
    const lvl = ledger.cohorts.byLevel.find((l) => l.label.includes(voterMeta.level!));
    if (lvl) lvl.ballotsCast += 1;
  }
  if (voterMeta?.hall) {
    const h = ledger.cohorts.byHall.find((hl) =>
      hl.label.toLowerCase().includes(voterMeta.hall!.toLowerCase().split(' ')[0])
    );
    if (h) h.ballotsCast += 1;
  }

  const receiptCode =
    'UCC-' +
    crypto.randomBytes(3).toString('hex').toUpperCase() +
    '-' +
    Date.now().toString().slice(-4);

  return { success: true, receiptCode };
}

/**
 * Transitions the election results through the 6-stage verification & publication workflow
 */
export function transitionResultsWorkflow(
  electionId: string,
  targetStage: ResultsWorkflowStage,
  actor: { id: string; name: string; role: string; ipAddress: string },
  notes?: string
): { success: boolean; results?: ElectionResultsPayload; message?: string; error?: string } {
  const election = ELECTIONS_STORE.get(electionId);
  if (!election) {
    return { success: false, error: 'Election not found.' };
  }

  const ledger = getOrCreateLedger(electionId);
  if (!ledger) {
    return { success: false, error: 'Election ledger not found.' };
  }

  const currentIdx = WORKFLOW_ORDER.indexOf(ledger.workflowStage);
  const targetIdx = WORKFLOW_ORDER.indexOf(targetStage);

  if (targetIdx === -1) {
    return { success: false, error: `Invalid results workflow stage: '${targetStage}'.` };
  }

  // Enforce sequential forward progress or single-step audit return (except from published)
  if (ledger.workflowStage === 'published' && targetStage !== 'published') {
    return {
      success: false,
      error: 'Published official results are sealed and cannot be reverted.'
    };
  }

  // Strict RBAC rules for approval, certification, and publication
  const seniorRoles = ['Electoral Commissioner', 'Super Administrator'];
  if (['approved', 'certified', 'published'].includes(targetStage) && !seniorRoles.includes(actor.role)) {
    return {
      success: false,
      error: `Unauthorized: Only the Electoral Commissioner or Super Administrator can advance results to '${targetStage}'.`
    };
  }

  // Require certification before official publication (or jump certified->published via explicit action)
  if (targetIdx > currentIdx + 1) {
    return {
      success: false,
      error: `Sequential workflow violation: Cannot skip directly from '${ledger.workflowStage}' to '${targetStage}'. Complete intermediate stages first.`
    };
  }

  const computedBefore = computeElectionResults(electionId, true);
  let signatureHash: string | undefined;

  if (targetStage === 'certified' || targetStage === 'published') {
    signatureHash =
      ledger.certificationHash ||
      generateCertificationSignature(
        electionId,
        computedBefore?.ballotSummary.totalBallotsCast || election.totalVotesCast,
        computedBefore?.ballotSummary.validBallots || election.totalVotesCast
      );
    ledger.certificationHash = signatureHash;
    ledger.certifiedBy = `${actor.name} (${actor.role})`;
    election.resultsCertified = true;
  }

  if (targetStage === 'published') {
    ledger.publishedAt = new Date().toISOString();
    election.status = 'results_published';
    election.provisionalResultsReady = true;
    election.resultsCertified = true;
  } else if (targetStage === 'audit' || targetStage === 'verification' || targetStage === 'approved') {
    if (election.status === 'live' || election.status === 'closed') {
      election.status = 'results_pending_certification';
    }
    election.provisionalResultsReady = true;
  }

  ledger.workflowStage = targetStage;
  election.updatedAt = new Date().toISOString();
  ELECTIONS_STORE.set(electionId, election);

  const actionEntry: WorkflowAuditAction = {
    stage: targetStage,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    timestamp: new Date().toISOString(),
    notes: notes?.trim() || `Stage advanced to ${targetStage.toUpperCase()} by ${actor.name}.`,
    signatureHash
  };
  ledger.workflowHistory.push(actionEntry);

  const eventType =
    targetStage === 'published'
      ? 'RESULTS_PUBLISHED'
      : targetStage === 'certified'
      ? 'RESULTS_CERTIFIED'
      : 'RESULTS_WORKFLOW_ADVANCE';

  logAuditEvent({
    eventType,
    userId: actor.id,
    identifier: electionId,
    role: actor.role,
    ipAddress: actor.ipAddress,
    status: 'SUCCESS',
    details: `Election "${election.title}" results workflow transitioned to '${targetStage.toUpperCase()}'. Notes: ${actionEntry.notes}`
  });

  const updatedResults = computeElectionResults(electionId, true)!;
  return {
    success: true,
    results: updatedResults,
    message: `Election results advanced to '${targetStage.replace(/_/g, ' ').toUpperCase()}'.`
  };
}
