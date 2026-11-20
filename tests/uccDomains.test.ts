import assert from 'node:assert/strict';
import { DOMAIN_REGISTRY, DOMAIN_STARTER_POSITIONS, UCC_HALLS } from '../src/data/uccStructure';
import {
  getElectionDomainId,
  getElectionStatusMeta,
  isElectionPublishedToStudents,
} from '../src/utils/electionStatus';
import {
  getHallDisplayName,
  matchesHallAffiliation,
  normalizeCanonicalHalls,
} from '../src/utils/hallUtils';
import { evaluateStudentEligibilityLocal } from '../src/services/electionClient';
import type { Election, StudentProfile, VoterEligibilityRecord } from '../src/types';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

const baseStudent: StudentProfile = {
  id: 'stu-1',
  uid: 'stu-1',
  studentId: 'UCC/2026/001',
  indexNumber: 'PS/CSC/22/0001',
  fullName: 'Kwame Mensah',
  email: 'kwame.mensah@stu.ucc.edu.gh',
  emailVerified: true,
  phone: '0240000000',
  faculty: 'Faculty of Science & Technology',
  department: 'Computer Science & Information Technology',
  programme: 'BSc. Computer Science',
  level: '300',
  hall: 'Casely Hayford Hall (Casford)',
  status: 'active',
  isEligible: true,
  eligibilityStatus: 'eligible',
  hasVotedElections: [],
  createdAt: '2026-01-01T00:00:00Z',
};

const baseEligibilityRecord: VoterEligibilityRecord = {
  id: 'stu-1',
  uid: 'stu-1',
  studentId: 'UCC/2026/001',
  fullName: 'Kwame Mensah',
  email: 'kwame.mensah@stu.ucc.edu.gh',
  faculty: 'Faculty of Science & Technology',
  department: 'Computer Science & Information Technology',
  programme: 'BSc. Computer Science',
  level: '300',
  hall: 'Casely Hayford Hall (Casford)',
  isEligible: true,
  status: 'eligible',
};

function makeElection(overrides: Partial<Election>): Election {
  const { eligibilityCriteria, ...rest } = overrides;
  return {
    id: 'elec-test',
    code: 'UCC-2026-TEST',
    title: 'Test Election',
    description: 'Test',
    category: 'SRC',
    domainId: 'src',
    academicYear: '2025/2026',
    status: 'live',
    isPublished: true,
    startDate: '2026-04-01T08:00:00Z',
    endDate: '2026-04-01T17:00:00Z',
    totalEligibleVoters: 1000,
    totalVotesCast: 0,
    turnoutPercentage: 0,
    positionsCount: 1,
    organizingBody: 'UCC Electoral Commission',
    rules: ['One student, one ballot'],
    resultsCertified: false,
    provisionalResultsReady: false,
    eligibilityCriteria: eligibilityCriteria || {},
    ...rest,
  };
}

// 1. All 6 domain IDs & starter positions
runTest('All 6 official UCC election domains and starter positions exist', () => {
  const expectedDomains = [
    'src',
    'jcrc_hall',
    'grasag',
    'local_nugs',
    'departmental',
    'faculty_school',
  ] as const;
  assert.deepEqual(
    DOMAIN_REGISTRY.map((d) => d.id),
    [...expectedDomains]
  );
  for (const domId of expectedDomains) {
    assert.ok(
      Array.isArray(DOMAIN_STARTER_POSITIONS[domId]) && DOMAIN_STARTER_POSITIONS[domId].length >= 3,
      `Starter positions missing for domain: ${domId}`
    );
  }
});

// 2. Exact 8 canonical halls + PSI filtering
runTest('normalizeCanonicalHalls yields exact 8 official halls and strips legacy PSI Hall', () => {
  assert.equal(UCC_HALLS.length, 8);
  const normalized = normalizeCanonicalHalls([
    { id: 'hall-psi', name: 'PSI Hall', shortName: 'PSI' },
    { id: 'hall-casford', name: 'Casely Hayford Hall', shortName: 'Casford', motto: 'Gentlemen' },
  ]);
  assert.equal(normalized.length, 8);
  assert.equal(
    normalized.some((h) => h.id === 'hall-psi' || h.name.toLowerCase().includes('psi')),
    false
  );
  const names = normalized.map((h) => h.name);
  assert.deepEqual(names, [
    'Adehye Hall',
    'Atlantic Hall',
    'Casely Hayford Hall',
    'Kwame Nkrumah Hall',
    'Oguaa Hall',
    'Valco Hall',
    'SRC Hall',
    'Superannuation Hall',
  ]);
  const casford = normalized.find((h) => h.id === 'hall-casford');
  const superHall = normalized.find((h) => h.id === 'hall-superannuation');
  assert.equal(casford?.motto, 'Gentlemen');
  assert.equal(getHallDisplayName(casford), 'Casely Hayford Hall (Casford)');
  assert.equal(getHallDisplayName(superHall), 'Superannuation Hall (Super Hall)');
});

// 3. Hall matching & strict SRC vs SRC Hall isolation
runTest('matchesHallAffiliation strictly isolates SRC Hall from SRC and resolves aliases', () => {
  assert.equal(matchesHallAffiliation('Casford', 'Casely Hayford Hall'), true);
  assert.equal(matchesHallAffiliation('KNH', 'Kwame Nkrumah Hall'), true);
  assert.equal(matchesHallAffiliation('hall-nkrumah', 'Kwame Nkrumah Hall'), true);
  assert.equal(matchesHallAffiliation('Super Hall', 'Superannuation Hall'), true);
  assert.equal(matchesHallAffiliation('Superannuation Hostel', 'hall-superannuation'), true);
  assert.equal(matchesHallAffiliation('SRC Hall', 'hall-src'), true);
  assert.equal(matchesHallAffiliation('SRC', 'SRC Hall'), false);
  assert.equal(matchesHallAffiliation('SRC Hall', 'SRC'), false);
  assert.equal(matchesHallAffiliation('Oguaa Hall', 'Valco Hall'), false);
});

// 4. Publication visibility & standardized status metadata
runTest('isElectionPublishedToStudents and getElectionStatusMeta handle all statuses', () => {
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'draft', isPublished: false })), false);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'draft', isPublished: true })), false);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'pending_approval' })), false);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'cancelled' })), false);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'live', isPublished: false })), false);

  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'scheduled', isPublished: true })), true);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'live', isPublished: true })), true);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'closed', isPublished: true })), true);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'results_pending_certification' })), true);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'results_published' })), true);
  assert.equal(isElectionPublishedToStudents(makeElection({ status: 'archived' })), true);

  assert.equal(getElectionStatusMeta('draft').label, 'Draft');
  assert.equal(getElectionStatusMeta('scheduled').label, 'Upcoming');
  assert.equal(getElectionStatusMeta('live').label, 'Active');
  assert.equal(getElectionStatusMeta('closed').label, 'Closed');
  assert.equal(getElectionStatusMeta('results_pending_certification').label, 'Results Pending');
  assert.equal(getElectionStatusMeta('results_published').label, 'Results Published');
  assert.equal(getElectionStatusMeta('cancelled').label, 'Cancelled');
  assert.equal(getElectionDomainId({ domainId: 'jcrc_hall', category: 'JCR / Hall' }), 'jcrc_hall');
});

// 5. Domain-specific eligibility across all 6 domains
runTest('evaluateStudentEligibilityLocal enforces isolation across all 6 domains', () => {
  // SRC General Election -> Eligible for verified undergraduate
  const srcElection = makeElection({ domainId: 'src', category: 'SRC' });
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, srcElection, baseEligibilityRecord).isEligible,
    true
  );

  // JCRC / Hall Isolation -> Casford eligible for Casford, blocked from Oguaa & SRC Hall
  const casfordElection = makeElection({
    domainId: 'jcrc_hall',
    category: 'JCR / Hall',
    hallId: 'hall-casford',
    subdomainLabel: 'Casely Hayford Hall',
    eligibilityCriteria: { halls: ['Casely Hayford Hall'] },
  });
  const oguaaElection = makeElection({
    domainId: 'jcrc_hall',
    category: 'JCR / Hall',
    hallId: 'hall-oguaa',
    subdomainLabel: 'Oguaa Hall',
    eligibilityCriteria: { halls: ['Oguaa Hall'] },
  });
  const srcHallElection = makeElection({
    domainId: 'jcrc_hall',
    category: 'JCR / Hall',
    hallId: 'hall-src',
    subdomainLabel: 'SRC Hall',
    eligibilityCriteria: { halls: ['SRC Hall'] },
  });
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, casfordElection, baseEligibilityRecord).isEligible,
    true
  );
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, oguaaElection, baseEligibilityRecord).isEligible,
    false
  );
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, srcHallElection, baseEligibilityRecord).isEligible,
    false
  );

  // GRASAG -> Blocked for undergraduate, allowed for Postgraduate
  const grasagElection = makeElection({
    domainId: 'grasag',
    category: 'GRASAG',
    eligibilityCriteria: { levels: ['Postgraduate'] },
  });
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, grasagElection, baseEligibilityRecord).isEligible,
    false
  );
  const postgradStudent: StudentProfile = { ...baseStudent, level: 'Postgraduate' };
  const postgradEligibility: VoterEligibilityRecord = { ...baseEligibilityRecord, level: 'Postgraduate' };
  assert.equal(
    evaluateStudentEligibilityLocal(postgradStudent, grasagElection, postgradEligibility).isEligible,
    true
  );

  // Local NUGS -> Eligible for verified student
  const nugsElection = makeElection({ domainId: 'local_nugs', category: 'Local NUGS' });
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, nugsElection, baseEligibilityRecord).isEligible,
    true
  );

  // Departmental -> Matches student dept, blocks different dept
  const cscElection = makeElection({
    domainId: 'departmental',
    category: 'Departmental',
    departmentId: 'dept-csc',
    subdomainLabel: 'Computer Science & Information Technology',
    eligibilityCriteria: {
      faculties: ['Faculty of Science & Technology'],
      departments: ['Computer Science & Information Technology'],
    },
  });
  const bioElection = makeElection({
    domainId: 'departmental',
    category: 'Departmental',
    departmentId: 'dept-bio',
    subdomainLabel: 'Department of Molecular Biology',
    eligibilityCriteria: {
      departments: ['Department of Molecular Biology'],
    },
  });
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, cscElection, baseEligibilityRecord).isEligible,
    true
  );
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, bioElection, baseEligibilityRecord).isEligible,
    false
  );

  // Faculty / School -> Matches faculty, blocks different faculty
  const scienceFacElection = makeElection({
    domainId: 'faculty_school',
    category: 'Faculty / School',
    facultyId: 'fac-sci',
    subdomainLabel: 'Faculty of Science & Technology',
    eligibilityCriteria: { faculties: ['Faculty of Science & Technology'] },
  });
  const artsFacElection = makeElection({
    domainId: 'faculty_school',
    category: 'Faculty / School',
    facultyId: 'fac-arts',
    subdomainLabel: 'Faculty of Arts',
    eligibilityCriteria: { faculties: ['Faculty of Arts'] },
  });
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, scienceFacElection, baseEligibilityRecord).isEligible,
    true
  );
  assert.equal(
    evaluateStudentEligibilityLocal(baseStudent, artsFacElection, baseEligibilityRecord).isEligible,
    false
  );

  // Suspended student rejected everywhere
  const suspendedStudent: StudentProfile = { ...baseStudent, status: 'suspended' };
  assert.equal(
    evaluateStudentEligibilityLocal(suspendedStudent, srcElection, baseEligibilityRecord).isEligible,
    false
  );
});

console.log('All UCC Domains verification checks passed.');
