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
  CANDIDATES_STORE
} from './electionStore.ts';
import { logAuditEvent } from './authStore.ts';

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
 * Initialize authoritative ledgers for all seeded elections
 */
function initializeBallotLedgers() {
  // 1. UCC-GRA-2025: Officially Published & Certified
  BALLOT_LEDGER_STORE.set('UCC-GRA-2025', {
    electionId: 'UCC-GRA-2025',
    workflowStage: 'published',
    publishedAt: '2025-10-16T10:30:00Z',
    certificationHash: 'SHA256:9B2D8E41A7C4F082E7F01A91',
    certifiedBy: 'Dr. Joseph E. Tetteh (Electoral Commissioner)',
    invalidBallots: 25,
    blankOverallBallots: 40,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Tally Aggregation Engine',
        actorRole: 'Automated Ledger',
        timestamp: '2025-10-15T18:05:00Z',
        notes: 'Initial digital ballot vault aggregation completed upon poll closure.'
      },
      {
        stage: 'verification',
        actorId: 'adm-003',
        actorName: 'Mrs. Agnes Ocloo',
        actorRole: 'Returning Officer',
        timestamp: '2025-10-15T19:15:00Z',
        notes: 'Checked accredited postgraduate check-in count (4,185) against submitted encrypted envelopes (4,185).'
      },
      {
        stage: 'audit',
        actorId: 'adm-002',
        actorName: 'Ing. Kwabena Acheampong',
        actorRole: 'Super Administrator',
        timestamp: '2025-10-15T21:00:00Z',
        notes: 'Zero duplicate tokens detected; 25 spoilt/malformed external kiosk tickets isolated cleanly.'
      },
      {
        stage: 'approved',
        actorId: 'adm-001',
        actorName: 'Dr. Joseph E. Tetteh',
        actorRole: 'Electoral Commissioner',
        timestamp: '2025-10-16T08:45:00Z',
        notes: 'Approved by GRASAG-UCC Electoral Board in presence of candidate agents.'
      },
      {
        stage: 'certified',
        actorId: 'adm-001',
        actorName: 'Dr. Joseph E. Tetteh',
        actorRole: 'Electoral Commissioner',
        timestamp: '2025-10-16T10:00:00Z',
        notes: 'Cryptographic certification signature affixed.',
        signatureHash: 'SHA256:9B2D8E41A7C4F082E7F01A91'
      },
      {
        stage: 'published',
        actorId: 'adm-001',
        actorName: 'Dr. Joseph E. Tetteh',
        actorRole: 'Electoral Commissioner',
        timestamp: '2025-10-16T10:30:00Z',
        notes: 'Officially declared and published to UCC University Portal.'
      }
    ],
    positionTallies: {
      'pos-gra-pres': {
        candidateVotes: { 'cand-gra-01': 2450, 'cand-gra-02': 1670 },
        blankVotes: 40,
        invalidVotes: 25
      },
      'pos-gra-sec': {
        candidateVotes: { 'cand-gra-03': 2310, 'cand-gra-04': 1700 },
        blankVotes: 150,
        invalidVotes: 25
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'Faculty of Educational Foundations', eligibleVoters: 1450, ballotsCast: 1165 },
        { label: 'School of Physical Sciences', eligibleVoters: 980, ballotsCast: 774 },
        { label: 'School of Biological Sciences', eligibleVoters: 860, ballotsCast: 662 },
        { label: 'School of Business', eligibleVoters: 1120, ballotsCast: 851 },
        { label: 'Faculty of Arts & Social Sciences', eligibleVoters: 972, ballotsCast: 721 },
        { label: 'Institute of Marine Policy (Small Cohort)', eligibleVoters: 18, ballotsCast: 12 }
      ],
      byDepartment: [
        { label: 'Educational Leadership', eligibleVoters: 820, ballotsCast: 675 },
        { label: 'Fisheries & Aquatic Sciences', eligibleVoters: 490, ballotsCast: 392 },
        { label: 'Management & Strategy', eligibleVoters: 640, ballotsCast: 498 },
        { label: 'Mathematics & Statistics', eligibleVoters: 510, ballotsCast: 388 },
        { label: 'Computer Science & IT', eligibleVoters: 470, ballotsCast: 386 },
        { label: 'Classics & Ancient Philosophy', eligibleVoters: 16, ballotsCast: 11 }
      ],
      byLevel: [
        { label: 'M.Phil. / M.Sc. Year 1', eligibleVoters: 2450, ballotsCast: 1935 },
        { label: 'M.Phil. / M.Sc. Year 2', eligibleVoters: 1980, ballotsCast: 1510 },
        { label: 'Ph.D. Candidates', eligibleVoters: 952, ballotsCast: 728 },
        { label: 'Visiting Postgrad Fellows', eligibleVoters: 18, ballotsCast: 12 }
      ],
      byHall: [
        { label: 'Superannuation Graduate Hostel', eligibleVoters: 1850, ballotsCast: 1520 },
        { label: 'Valco Graduate Hostel', eligibleVoters: 1240, ballotsCast: 965 },
        { label: 'Kwame Nkrumah Hall Postgrad Wing', eligibleVoters: 920, ballotsCast: 702 },
        { label: 'Off-Campus Graduate Affiliates', eligibleVoters: 1390, ballotsCast: 998 }
      ]
    }
  });

  // 2. UCC-VAL-2025: Officially Published & Certified (Features Certified Tie + Invalid/Blank breakdown)
  BALLOT_LEDGER_STORE.set('UCC-VAL-2025', {
    electionId: 'UCC-VAL-2025',
    workflowStage: 'published',
    publishedAt: '2025-09-29T11:00:00Z',
    certificationHash: 'SHA256:4F1C7E20B9D11204C3A8B519',
    certifiedBy: 'Mrs. Agnes Ocloo (Returning Officer)',
    invalidBallots: 18,
    blankOverallBallots: 32,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Tally Aggregation Engine',
        actorRole: 'Automated Ledger',
        timestamp: '2025-09-28T17:02:00Z',
        notes: 'Initial count flagged exact tie on Valco Hall JCR General Secretary (1,075 vs 1,075).'
      },
      {
        stage: 'verification',
        actorId: 'adm-003',
        actorName: 'Mrs. Agnes Ocloo',
        actorRole: 'Returning Officer',
        timestamp: '2025-09-28T18:30:00Z',
        notes: 'Manual recount of ballot vault logs verified 1,075-1,075 tie; 18 rejected offline tickets verified.'
      },
      {
        stage: 'audit',
        actorId: 'adm-002',
        actorName: 'Ing. Kwabena Acheampong',
        actorRole: 'Super Administrator',
        timestamp: '2025-09-28T20:15:00Z',
        notes: 'All 2,210 cast ballot hashes reconciled against Valco resident accreditation roll.'
      },
      {
        stage: 'approved',
        actorId: 'adm-001',
        actorName: 'Dr. Joseph E. Tetteh',
        actorRole: 'Electoral Commissioner',
        timestamp: '2025-09-29T09:00:00Z',
        notes: 'Commission directed tie-break run-off for General Secretary while certifying Presidential outcome.'
      },
      {
        stage: 'certified',
        actorId: 'adm-001',
        actorName: 'Dr. Joseph E. Tetteh',
        actorRole: 'Electoral Commissioner',
        timestamp: '2025-09-29T10:15:00Z',
        notes: 'Certified with official tie declaration note on General Secretary portfolio.',
        signatureHash: 'SHA256:4F1C7E20B9D11204C3A8B519'
      },
      {
        stage: 'published',
        actorId: 'adm-001',
        actorName: 'Dr. Joseph E. Tetteh',
        actorRole: 'Electoral Commissioner',
        timestamp: '2025-09-29T11:00:00Z',
        notes: 'Gazetted and published at Valco Hall Forecourt and UCC VOTE Portal.'
      }
    ],
    positionTallies: {
      'pos-val-pres': {
        candidateVotes: { 'cand-val-01': 1120, 'cand-val-02': 690, 'cand-val-03': 350 },
        blankVotes: 32,
        invalidVotes: 18
      },
      'pos-val-sec': {
        candidateVotes: { 'cand-val-04': 1075, 'cand-val-05': 1075 },
        blankVotes: 42,
        invalidVotes: 18
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Business', eligibleVoters: 920, ballotsCast: 735 },
        { label: 'School of Physical Sciences', eligibleVoters: 640, ballotsCast: 502 },
        { label: 'Faculty of Social Sciences', eligibleVoters: 580, ballotsCast: 438 },
        { label: 'Faculty of Educational Foundations', eligibleVoters: 540, ballotsCast: 412 },
        { label: 'School of Biological Sciences', eligibleVoters: 152, ballotsCast: 112 },
        { label: 'School of Law (Hall Annex Cohort)', eligibleVoters: 18, ballotsCast: 11 }
      ],
      byDepartment: [
        { label: 'Accounting & Finance', eligibleVoters: 540, ballotsCast: 436 },
        { label: 'Computer Science & IT', eligibleVoters: 320, ballotsCast: 259 },
        { label: 'Economics', eligibleVoters: 310, ballotsCast: 241 },
        { label: 'Arts & Social Sciences Education', eligibleVoters: 380, ballotsCast: 295 },
        { label: 'Biochemistry & Molecular Bio', eligibleVoters: 152, ballotsCast: 112 },
        { label: 'Optometry Clinical Annex', eligibleVoters: 19, ballotsCast: 14 }
      ],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 710, ballotsCast: 525 },
        { label: 'Level 200', eligibleVoters: 740, ballotsCast: 582 },
        { label: 'Level 300', eligibleVoters: 730, ballotsCast: 590 },
        { label: 'Level 400', eligibleVoters: 670, ballotsCast: 513 }
      ],
      byHall: [
        { label: 'Valco Hall Main Blocks A-C', eligibleVoters: 1450, ballotsCast: 1185 },
        { label: 'Valco Hall Annex Blocks D-E', eligibleVoters: 1100, ballotsCast: 832 },
        { label: 'Valco Non-Resident Affiliates', eligibleVoters: 300, ballotsCast: 193 }
      ]
    }
  });

  // 3. UCC-BUS-2026: Closed, Results Pending Certification (In 'audit' workflow stage)
  BALLOT_LEDGER_STORE.set('UCC-BUS-2026', {
    electionId: 'UCC-BUS-2026',
    workflowStage: 'audit',
    invalidBallots: 12,
    blankOverallBallots: 38,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Tally Aggregation Engine',
        actorRole: 'Automated Ledger',
        timestamp: '2026-11-05T17:04:00Z',
        notes: 'Polls closed at 17:00 GMT. 2,940 ballots sealed in digital vault.'
      },
      {
        stage: 'verification',
        actorId: 'adm-003',
        actorName: 'Mrs. Agnes Ocloo',
        actorRole: 'Returning Officer',
        timestamp: '2026-11-05T18:10:00Z',
        notes: 'Verified accredited School of Business voter roll match (2,940 cast out of 4,200 eligible).'
      },
      {
        stage: 'audit',
        actorId: 'adm-002',
        actorName: 'Ing. Kwabena Acheampong',
        actorRole: 'Super Administrator',
        timestamp: '2026-11-05T19:25:00Z',
        notes: 'Cryptographic envelope audit complete; awaiting Electoral Commissioner formal approval & certification.'
      }
    ],
    positionTallies: {
      'pos-bus-pres': {
        candidateVotes: { 'cand-bus-01': 1680, 'cand-bus-02': 1210 },
        blankVotes: 38,
        invalidVotes: 12
      },
      'pos-bus-fin': {
        candidateVotes: { 'cand-bus-03': 1510, 'cand-bus-04': 1300 },
        blankVotes: 118,
        invalidVotes: 12
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Business', eligibleVoters: 4200, ballotsCast: 2940 }
      ],
      byDepartment: [
        { label: 'Accounting', eligibleVoters: 1350, ballotsCast: 985 },
        { label: 'Finance', eligibleVoters: 1050, ballotsCast: 762 },
        { label: 'Marketing & Supply Chain', eligibleVoters: 920, ballotsCast: 635 },
        { label: 'Human Resource Management', eligibleVoters: 860, ballotsCast: 544 },
        { label: 'Executive MBA Exchange Cohort', eligibleVoters: 20, ballotsCast: 14 }
      ],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 1120, ballotsCast: 745 },
        { label: 'Level 200', eligibleVoters: 1080, ballotsCast: 752 },
        { label: 'Level 300', eligibleVoters: 1040, ballotsCast: 765 },
        { label: 'Level 400', eligibleVoters: 960, ballotsCast: 678 }
      ],
      byHall: [
        { label: 'Casely Hayford Hall', eligibleVoters: 680, ballotsCast: 512 },
        { label: 'Valco Hall', eligibleVoters: 790, ballotsCast: 584 },
        { label: 'Adehye Hall', eligibleVoters: 620, ballotsCast: 452 },
        { label: 'Oguaa Hall', eligibleVoters: 690, ballotsCast: 486 },
        { label: 'Kwame Nkrumah Hall', eligibleVoters: 740, ballotsCast: 510 },
        { label: 'Atlantic Hall', eligibleVoters: 680, ballotsCast: 396 }
      ]
    }
  });

  // 4. UCC-SRC-2026: Live Polls Open (Preliminary tally, NOT published to students)
  BALLOT_LEDGER_STORE.set('UCC-SRC-2026', {
    electionId: 'UCC-SRC-2026',
    workflowStage: 'preliminary',
    invalidBallots: 45,
    blankOverallBallots: 125,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Live Polling Telemetry',
        actorRole: 'Automated Ledger',
        timestamp: new Date().toISOString(),
        notes: 'Polling stations open. Preliminary live count accessible strictly to Electoral Commission officials.'
      }
    ],
    positionTallies: {
      'pos-src-pres': {
        candidateVotes: { 'cand-01': 7892, 'cand-02': 6728 },
        blankVotes: 125,
        invalidVotes: 45
      },
      'pos-src-sec': {
        candidateVotes: { 'cand-03': 8140, 'cand-04': 5610 },
        blankVotes: 995,
        invalidVotes: 45
      },
      'pos-src-treas': {
        candidateVotes: { 'cand-05': 12900 },
        blankVotes: 1845,
        invalidVotes: 45
      },
      'pos-src-pro': {
        candidateVotes: { 'cand-06': 7120, 'cand-07': 6710 },
        blankVotes: 915,
        invalidVotes: 45
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Physical Sciences', eligibleVoters: 4590, ballotsCast: 3140 },
        { label: 'School of Business', eligibleVoters: 6540, ballotsCast: 4200 },
        { label: 'Faculty of Arts & Social Sciences', eligibleVoters: 8530, ballotsCast: 5100 },
        { label: 'Faculty of Educational Foundations', eligibleVoters: 3560, ballotsCast: 1620 },
        { label: 'School of Medical Sciences', eligibleVoters: 1610, ballotsCast: 718 },
        { label: 'Faculty of Law (Special Cohort)', eligibleVoters: 20, ballotsCast: 12 }
      ],
      byDepartment: [
        { label: 'Computer Science & IT', eligibleVoters: 1150, ballotsCast: 824 },
        { label: 'Accounting & Finance', eligibleVoters: 2650, ballotsCast: 1745 },
        { label: 'Communication Studies', eligibleVoters: 1420, ballotsCast: 912 },
        { label: 'Educational Foundations', eligibleVoters: 1950, ballotsCast: 1098 },
        { label: 'Medicine & Surgery', eligibleVoters: 1120, ballotsCast: 615 },
        { label: 'Archaeology & Heritage Studies', eligibleVoters: 18, ballotsCast: 9 }
      ],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 6420, ballotsCast: 3480 },
        { label: 'Level 200', eligibleVoters: 6280, ballotsCast: 3790 },
        { label: 'Level 300', eligibleVoters: 6150, ballotsCast: 3920 },
        { label: 'Level 400', eligibleVoters: 6000, ballotsCast: 3600 }
      ],
      byHall: [
        { label: 'Casely Hayford Hall', eligibleVoters: 3200, ballotsCast: 2180 },
        { label: 'Valco Hall', eligibleVoters: 2850, ballotsCast: 1890 },
        { label: 'Oguaa Hall', eligibleVoters: 3650, ballotsCast: 2210 },
        { label: 'Adehye Hall', eligibleVoters: 3100, ballotsCast: 1940 },
        { label: 'Atlantic Hall', eligibleVoters: 3450, ballotsCast: 2090 },
        { label: 'Kwame Nkrumah Hall', eligibleVoters: 3850, ballotsCast: 2380 },
        { label: 'Off-Campus Hostels (Amamoma/Kokoado)', eligibleVoters: 4750, ballotsCast: 2100 }
      ]
    }
  });

  // 5. UCC-CAS-2026: Live Polls Open (Preliminary)
  BALLOT_LEDGER_STORE.set('UCC-CAS-2026', {
    electionId: 'UCC-CAS-2026',
    workflowStage: 'preliminary',
    invalidBallots: 8,
    blankOverallBallots: 22,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Live Polling Telemetry',
        actorRole: 'Automated Ledger',
        timestamp: new Date().toISOString(),
        notes: 'Casford JCR polling underway.'
      }
    ],
    positionTallies: {
      'pos-cas-pres': {
        candidateVotes: { 'cand-cas-01': 1240, 'cand-cas-02': 940 },
        blankVotes: 22,
        invalidVotes: 8
      },
      'pos-cas-sec': {
        candidateVotes: { 'cand-cas-03': 1890 },
        blankVotes: 312,
        invalidVotes: 8
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Physical Sciences', eligibleVoters: 980, ballotsCast: 720 },
        { label: 'School of Business', eligibleVoters: 860, ballotsCast: 615 },
        { label: 'Faculty of Arts & Social Sciences', eligibleVoters: 780, ballotsCast: 520 },
        { label: 'Faculty of Educational Foundations', eligibleVoters: 580, ballotsCast: 355 }
      ],
      byDepartment: [
        { label: 'Computer Science & IT', eligibleVoters: 420, ballotsCast: 318 },
        { label: 'Management & HR', eligibleVoters: 490, ballotsCast: 344 },
        { label: 'English & Linguistics', eligibleVoters: 380, ballotsCast: 262 }
      ],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 810, ballotsCast: 520 },
        { label: 'Level 200', eligibleVoters: 820, ballotsCast: 560 },
        { label: 'Level 300', eligibleVoters: 800, ballotsCast: 590 },
        { label: 'Level 400', eligibleVoters: 770, ballotsCast: 540 }
      ],
      byHall: [
        { label: 'Casely Hayford Main Block', eligibleVoters: 2100, ballotsCast: 1520 },
        { label: 'Casely Hayford Annex / Affiliates', eligibleVoters: 1100, ballotsCast: 690 }
      ]
    }
  });
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
      const count = rawTally.candidateVotes[cand.id] ?? cand.votesReceived ?? 0;
      return sum + count;
    }, 0);

    const totalBallotsProcessed = totalValidVotes + rawTally.blankVotes + rawTally.invalidVotes;

    if (idx === 0) {
      primaryValidBallots = totalValidVotes;
      primaryBallotsProcessed = totalBallotsProcessed;
    }

    // Rank candidates strictly by valid votes descending
    const unsortedRows = approvedCandidates.map((cand) => {
      const votesReceived = rawTally.candidateVotes[cand.id] ?? cand.votesReceived ?? 0;
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
    turnoutPercentage: roundPct(totalBallotsCast, totalEligibleVoters),
    validBallotRate: roundPct(validBallots, totalBallotsCast),
    invalidBallotRate: roundPct(invalidBallots, totalBallotsCast),
    blankBallotRate: roundPct(blankBallots, totalBallotsCast)
  };

  // Sync election turnout metrics smoothly
  election.totalVotesCast = totalBallotsCast;
  election.turnoutPercentage = ballotSummary.turnoutPercentage;

  return {
    electionId: election.id,
    electionTitle: election.title,
    electionCode: election.code,
    category: election.category,
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
      byFaculty: applyPrivacyProtection(ledger.cohorts.byFaculty),
      byDepartment: applyPrivacyProtection(ledger.cohorts.byDepartment),
      byLevel: applyPrivacyProtection(ledger.cohorts.byLevel),
      byHall: applyPrivacyProtection(ledger.cohorts.byHall)
    }
  };
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
        posTally.candidateVotes[selectedCandId] = (posTally.candidateVotes[selectedCandId] ?? cand.votesReceived ?? 0) + 1;
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
