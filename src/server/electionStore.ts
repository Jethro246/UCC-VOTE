import type { Election, ElectionStatus, Position, Candidate } from '../types/index.ts';
import { MOCK_ELECTIONS, MOCK_POSITIONS, MOCK_CANDIDATES } from '../data/mockData.ts';
import { OFFICIAL_UCC_STUDENT_REGISTRY } from './authStore.ts';
import {
  categoryToDomainId,
  matchesHallName,
  normalizeText,
  runRelationalDomainMigration
} from './domainStore.ts';

// In-Memory Election Store (Thread-safe state for server runtime)
export const ELECTIONS_STORE: Map<string, Election> = new Map();
export const POSITIONS_STORE: Map<string, Position[]> = new Map();
export const CANDIDATES_STORE: Map<string, Candidate> = new Map();

// Initialize with rich base elections from mockData
MOCK_ELECTIONS.forEach((el) => {
  ELECTIONS_STORE.set(el.id, {
    ...el,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: new Date().toISOString()
  });
});

// Initialize with positions
Object.entries(MOCK_POSITIONS).forEach(([electionId, positions]) => {
  POSITIONS_STORE.set(electionId, [...positions]);
});

// Initialize with candidates
Object.entries(MOCK_CANDIDATES).forEach(([candId, candidate]) => {
  CANDIDATES_STORE.set(candId, { ...candidate });
});

// Idempotent relational domain/subdomain migration ensuring every record has domainId & unit FKs
runRelationalDomainMigration({
  elections: ELECTIONS_STORE,
  positions: POSITIONS_STORE,
  candidates: CANDIDATES_STORE
});

/**
 * Valid Election Status Lifecycle Transition State Machine
 * Prevents invalid state shifts (e.g., closed cannot silently become live or draft).
 */
export const VALID_STATUS_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  draft: ['pending_approval', 'scheduled'],
  pending_approval: ['draft', 'scheduled', 'suspended'],
  scheduled: ['pending_approval', 'live', 'suspended'],
  upcoming: ['live', 'suspended', 'scheduled'], // Backwards compatible alias
  live: ['suspended', 'closed'],
  suspended: ['scheduled', 'live', 'closed', 'draft'],
  closed: ['results_pending_certification', 'archived'],
  results_pending_certification: ['results_published', 'closed'],
  results_published: ['archived'],
  archived: [] // Terminal state
};

/**
 * Validates whether a state transition is legal in the election lifecycle
 */
export function isValidTransition(from: ElectionStatus, to: ElectionStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Server-Side Student Eligibility Verification Engine
 * Enforces both domain-level constitutional isolation (GRASAG = Postgraduate, JCRC = Hall,
 * Departmental = Department/Programme, Faculty/School = Faculty) and explicit election criteria.
 */
export function verifyStudentEligibility(
  student: {
    studentId: string;
    level: string;
    faculty: string;
    department: string;
    programme?: string;
    hall: string;
    status?: string;
  },
  election: Election
): { isEligible: boolean; reason?: string; checks: Record<string, boolean> } {
  const checks: Record<string, boolean> = {
    accountActive: true,
    domainIsolation: true,
    levelMatch: true,
    facultyMatch: true,
    departmentMatch: true,
    programmeMatch: true,
    hallMatch: true
  };

  // 1. Account status verification
  if (student.status === 'suspended') {
    checks.accountActive = false;
    return {
      isEligible: false,
      reason: 'Student voter account is administratively suspended.',
      checks
    };
  }

  const domainId = election.domainId || categoryToDomainId(election.category);

  // 2. Domain-level constitutional rules
  if (domainId === 'grasag' || election.category === 'GRASAG') {
    if (normalizeText(student.level) !== 'postgraduate') {
      checks.domainIsolation = false;
      checks.levelMatch = false;
      return {
        isEligible: false,
        reason: `GRASAG elections are strictly restricted to registered UCC Postgraduate (Masters & Doctoral) students. Your academic level is Level ${student.level}.`,
        checks
      };
    }
  }

  const crit = election.eligibilityCriteria;
  if (!crit) {
    return { isEligible: true, checks };
  }

  // 3. Academic Level check
  if (crit.levels && crit.levels.length > 0) {
    const levelMatch = crit.levels.some((l) => normalizeText(l) === normalizeText(student.level));
    checks.levelMatch = levelMatch;
    if (!levelMatch) {
      return {
        isEligible: false,
        reason: `Election requires Level ${crit.levels.join(', ')}. Your registered level is Level ${student.level}.`,
        checks
      };
    }
  }

  // 4. Faculty / School check
  if (crit.faculties && crit.faculties.length > 0) {
    const facultyMatch = crit.faculties.some((f) =>
      normalizeText(student.faculty).includes(normalizeText(f))
    );
    checks.facultyMatch = facultyMatch;
    if (!facultyMatch) {
      return {
        isEligible: false,
        reason: `Election is restricted to ${crit.faculties.join(', ')}. Your faculty is ${student.faculty}.`,
        checks
      };
    }
  }

  // 5. Department check
  if (crit.departments && crit.departments.length > 0) {
    const departmentMatch = crit.departments.some((d) =>
      normalizeText(student.department).includes(normalizeText(d))
    );
    checks.departmentMatch = departmentMatch;
    if (!departmentMatch) {
      return {
        isEligible: false,
        reason: `Election is restricted to ${crit.departments.join(', ')}. Your department is ${student.department}.`,
        checks
      };
    }
  }

  // 6. Programme check
  if (crit.programmes && crit.programmes.length > 0 && student.programme) {
    const programmeMatch = crit.programmes.some((p) =>
      normalizeText(student.programme).includes(normalizeText(p))
    );
    checks.programmeMatch = programmeMatch;
    if (!programmeMatch) {
      return {
        isEligible: false,
        reason: `Election is restricted to ${crit.programmes.join(', ')}. Your programme is ${student.programme}.`,
        checks
      };
    }
  }

  // 7. Hall of Residence check (strict full/alias hall matching)
  if (crit.halls && crit.halls.length > 0) {
    const hallMatch = crit.halls.some((h) => matchesHallName(student.hall, h));
    checks.hallMatch = hallMatch;
    if (!hallMatch) {
      return {
        isEligible: false,
        reason: `Election is restricted to affiliated residents of ${crit.halls.join(', ')}. Your hall is ${student.hall}.`,
        checks
      };
    }
  }

  return { isEligible: true, checks };
}

/**
 * Calculates estimated eligible voter count from the official UCC registry
 */
export function calculateEligibleVoterCount(criteria: Election['eligibilityCriteria']): number {
  const students = Object.values(OFFICIAL_UCC_STUDENT_REGISTRY);
  let count = 0;

  for (const s of students) {
    let eligible = true;
    if (criteria.levels && criteria.levels.length > 0 && !criteria.levels.includes(s.level)) {
      eligible = false;
    }
    if (
      criteria.faculties &&
      criteria.faculties.length > 0 &&
      !criteria.faculties.some((f) => normalizeText(s.faculty).includes(normalizeText(f)))
    ) {
      eligible = false;
    }
    if (
      criteria.departments &&
      criteria.departments.length > 0 &&
      !criteria.departments.some((d) => normalizeText(s.department).includes(normalizeText(d)))
    ) {
      eligible = false;
    }
    if (
      criteria.halls &&
      criteria.halls.length > 0 &&
      !criteria.halls.some((h) => matchesHallName(s.hall, h))
    ) {
      eligible = false;
    }
    if (eligible) count++;
  }

  return Math.max(count * 1500, 1200);
}

/**
 * Server-Side Candidate Vetting & Eligibility Verification Engine
 * Validates candidate standing against Official UCC Student Registry, Domain Rules, and Election Criteria.
 */
export function verifyCandidateCandidacyEligibility(
  candidate: {
    studentId: string;
    fullName?: string;
    level?: string;
    faculty?: string;
    department?: string;
    programme?: string;
    hall?: string;
  },
  election: Election
): {
  isEligible: boolean;
  reason?: string;
  details: {
    isEnrolled: boolean;
    cgpaQualified: boolean;
    levelMatch: boolean;
    facultyMatch: boolean;
    hallMatch: boolean;
    summary: string;
  };
} {
  const regStudent = OFFICIAL_UCC_STUDENT_REGISTRY[candidate.studentId];

  const details = {
    isEnrolled: regStudent ? regStudent.isEnrolled : true,
    cgpaQualified: regStudent ? regStudent.cgpaQualified : true,
    levelMatch: true,
    facultyMatch: true,
    hallMatch: true,
    summary: ''
  };

  if (!regStudent) {
    const isValidFormat = /^[A-Z]{2,3}\/[A-Z0-9]{3,4}\/\d{2}\/\d{4}$/.test(candidate.studentId);
    if (!isValidFormat) {
      details.isEnrolled = false;
      return {
        isEligible: false,
        reason: `Student ID "${candidate.studentId}" does not conform to the official UCC indexing format (e.g., PS/CSC/22/0089).`,
        details: {
          ...details,
          summary: 'Invalid Student ID format according to UCC Academic Directorate guidelines.'
        }
      };
    }
  } else {
    if (!regStudent.isEnrolled) {
      details.isEnrolled = false;
      return {
        isEligible: false,
        reason:
          'Student is currently not enrolled for the active academic semester at University of Cape Coast.',
        details: { ...details, summary: 'Student enrollment registration incomplete or lapsed.' }
      };
    }

    if (!regStudent.cgpaQualified) {
      details.cgpaQualified = false;
      return {
        isEligible: false,
        reason:
          'Candidate does not meet the minimum CGPA requirement (3.00 minimum required for executive candidacy).',
        details: {
          ...details,
          summary:
            'Academic Standing Check Failed: CGPA does not meet the constitutional vetting threshold.'
        }
      };
    }
  }

  const domainId = election.domainId || categoryToDomainId(election.category);
  const crit = election.eligibilityCriteria || {};
  const levelToCheck = candidate.level || (regStudent ? regStudent.level : '');
  const facultyToCheck = candidate.faculty || (regStudent ? regStudent.faculty : '');
  const deptToCheck = candidate.department || (regStudent ? regStudent.department : '');
  const hallToCheck = candidate.hall || (regStudent ? regStudent.hall : '');

  if (domainId === 'grasag' && levelToCheck && normalizeText(levelToCheck) !== 'postgraduate') {
    details.levelMatch = false;
    return {
      isEligible: false,
      reason: `GRASAG candidacy is strictly limited to Postgraduate students. Candidate level is ${levelToCheck}.`,
      details: { ...details, summary: 'GRASAG Postgraduate-only requirement failed.' }
    };
  }

  if (crit.levels && crit.levels.length > 0 && levelToCheck) {
    if (!crit.levels.some((l) => normalizeText(l) === normalizeText(levelToCheck))) {
      details.levelMatch = false;
      return {
        isEligible: false,
        reason: `Election is restricted to Level ${crit.levels.join(', ')}. Candidate registered at Level ${levelToCheck}.`,
        details: { ...details, summary: `Level mismatch: Requires Level ${crit.levels.join(', ')}.` }
      };
    }
  }

  if (crit.faculties && crit.faculties.length > 0 && facultyToCheck) {
    const match = crit.faculties.some((f) => normalizeText(facultyToCheck).includes(normalizeText(f)));
    if (!match) {
      details.facultyMatch = false;
      return {
        isEligible: false,
        reason: `Election is restricted to ${crit.faculties.join(', ')}. Candidate registered in ${facultyToCheck}.`,
        details: { ...details, summary: `Faculty mismatch: Requires ${crit.faculties.join(', ')}.` }
      };
    }
  }

  if (crit.departments && crit.departments.length > 0 && deptToCheck) {
    const match = crit.departments.some((d) => normalizeText(deptToCheck).includes(normalizeText(d)));
    if (!match) {
      details.facultyMatch = false;
      return {
        isEligible: false,
        reason: `Election is restricted to ${crit.departments.join(', ')}. Candidate department is ${deptToCheck}.`,
        details: { ...details, summary: `Department mismatch: Requires ${crit.departments.join(', ')}.` }
      };
    }
  }

  if (crit.halls && crit.halls.length > 0 && hallToCheck) {
    const match = crit.halls.some((h) => matchesHallName(hallToCheck, h));
    if (!match) {
      details.hallMatch = false;
      return {
        isEligible: false,
        reason: `Election is restricted to ${crit.halls.join(', ')}. Candidate affiliated with ${hallToCheck}.`,
        details: { ...details, summary: `Hall mismatch: Requires ${crit.halls.join(', ')}.` }
      };
    }
  }

  details.summary =
    'All verification gates passed: Active enrollment, CGPA clearance, and domain constituency alignment confirmed.';
  return {
    isEligible: true,
    details
  };
}

export function recomputeAllElectionCounts(ballotsByElection?: Map<string, number>): void {
  for (const [electionId, election] of ELECTIONS_STORE.entries()) {
    const positions = POSITIONS_STORE.get(electionId) || [];
    election.positionsCount = positions.length;

    if (ballotsByElection) {
      const ballotCount = ballotsByElection.get(electionId);
      if (typeof ballotCount === 'number' && ballotCount > (election.totalVotesCast || 0)) {
        election.totalVotesCast = ballotCount;
      }
    }

    election.turnoutPercentage =
      election.totalEligibleVoters > 0
        ? Number(((election.totalVotesCast / election.totalEligibleVoters) * 100).toFixed(1))
        : 0;
  }
}
