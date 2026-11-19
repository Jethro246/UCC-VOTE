import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDerivedContestants,
  diffPermanentProfileFields,
  evaluateElectionCandidateMutationAllowed,
  findDuplicateContestant,
  findDuplicateParticipationInElection,
  searchContestants,
} from './contestantUtils';
import { Candidate, ContestantProfile, Election } from '../types';

const mockContestants: ContestantProfile[] = [
  {
    id: 'cont_ps_csc_22_0014',
    studentId: 'PS/CSC/22/0014',
    fullName: 'Kwame Boateng Mensah',
    nickname: 'The Catalyst',
    email: 'kwame.mensah@st.ucc.edu.gh',
    phone: '+233240000111',
    department: 'Computer Science & Information Technology',
    faculty: 'School of Physical Sciences',
    programme: 'B.Sc. Computer Science',
    level: '300',
    hall: 'Casely Hayford Hall',
    photoUrl: 'https://example.com/kwame.jpg',
    biography: 'Student software architect and former hall rep.',
    leadershipExperience: ['Casford IT Coordinator'],
  },
];

const mockCandidates: Candidate[] = [
  {
    id: 'cand_1',
    contestantId: 'cont_ps_csc_22_0014',
    electionId: 'elec_src_2026',
    positionId: 'pos_src_pres',
    fullName: 'Kwame Boateng Mensah',
    studentId: 'PS/CSC/22/0014',
    department: 'Computer Science & Information Technology',
    faculty: 'School of Physical Sciences',
    programme: 'B.Sc. Computer Science',
    level: '300',
    hall: 'Casely Hayford Hall',
    photoUrl: 'https://example.com/kwame.jpg',
    leadershipExperience: ['Casford IT Coordinator'],
    manifestoSummary: 'Digital Campus Transformation',
    fullManifesto: ['Campus Wi-Fi Upgrade'],
    keyPromises: ['24/7 Study Hubs'],
    applicationStatus: 'Approved',
    eligibilityVerified: true,
    votesReceived: 1200,
  },
  {
    id: 'cand_2',
    electionId: 'elec_oguaa_2026',
    positionId: 'pos_oguaa_sec',
    fullName: 'Abena Serwaa Osei',
    studentId: 'ED/EPS/22/0088',
    email: 'abena.osei@st.ucc.edu.gh',
    department: 'Education & Psychology',
    faculty: 'Faculty of Educational Foundations',
    programme: 'B.Ed. Psychology',
    level: '300',
    hall: 'Oguaa Hall',
    photoUrl: 'https://example.com/abena.jpg',
    leadershipExperience: ['Oguaa Hall Secretary'],
    manifestoSummary: 'Transparent Hall Governance',
    fullManifesto: ['Weekly Hall Briefings'],
    keyPromises: ['Open Budget Portal'],
    applicationStatus: 'Approved',
    eligibilityVerified: true,
    votesReceived: 0,
  },
];

const baseElection: Election = {
  id: 'elec_2027',
  title: 'UCC SRC Elections 2027',
  code: 'SRC-2027',
  description: 'Annual SRC elections',
  category: 'SRC',
  academicYear: '2026/2027',
  status: 'scheduled',
  startDate: '2027-04-01T08:00:00Z',
  endDate: '2027-04-01T17:00:00Z',
  totalEligibleVoters: 1000,
  totalVotesCast: 0,
  turnoutPercentage: 0,
  organizingBody: 'EC-UCC',
  eligibilityCriteria: {},
  rules: [],
  positionsCount: 2,
  resultsCertified: false,
  provisionalResultsReady: false,
};

test('buildDerivedContestants merges master contestants and historical candidates without duplication', () => {
  const derived = buildDerivedContestants(mockContestants, mockCandidates);
  assert.equal(derived.length, 2);

  const kwame = derived.find((c) => c.id === 'cont_ps_csc_22_0014');
  assert.ok(kwame);
  assert.equal(kwame.isMaterializedInDb, true);
  assert.equal(kwame.participations.length, 1);
  assert.equal(kwame.phone, '+233240000111');

  const abena = derived.find((c) => c.studentId === 'ED/EPS/22/0088');
  assert.ok(abena);
  assert.equal(abena.isMaterializedInDb, false);
  assert.equal(abena.participations.length, 1);
});

test('searchContestants matches by name, studentId, programme, faculty, and hall', () => {
  const derived = buildDerivedContestants(mockContestants, mockCandidates);
  assert.equal(searchContestants(derived, 'kwame').length, 1);
  assert.equal(searchContestants(derived, 'ed/eps/22/0088').length, 1);
  assert.equal(searchContestants(derived, 'B.Ed. Psychology').length, 1);
  assert.equal(searchContestants(derived, 'Physical Sciences').length, 1);
  assert.equal(searchContestants(derived, 'Oguaa Hall').length, 1);
  assert.equal(searchContestants(derived, 'NonexistentXYZ').length, 0);
});

test('findDuplicateContestant detects matching normalized studentId or email', () => {
  const derived = buildDerivedContestants(mockContestants, mockCandidates);

  const bySid = findDuplicateContestant(derived, { studentId: ' ps/csc/22/0014 ' });
  assert.ok(bySid);
  assert.equal(bySid.fullName, 'Kwame Boateng Mensah');

  const byEmail = findDuplicateContestant(derived, { email: 'ABENA.OSEI@ST.UCC.EDU.GH' });
  assert.ok(byEmail);
  assert.equal(byEmail.fullName, 'Abena Serwaa Osei');

  const excluded = findDuplicateContestant(derived, {
    studentId: 'PS/CSC/22/0014',
    excludeContestantId: 'cont_ps_csc_22_0014',
  });
  assert.equal(excluded, null);
});

test('findDuplicateParticipationInElection prevents duplicate assignments in same election/position', () => {
  const samePos = findDuplicateParticipationInElection(
    mockCandidates,
    'elec_src_2026',
    'pos_src_pres',
    'cont_ps_csc_22_0014',
    'PS/CSC/22/0014'
  );
  assert.equal(samePos.isSamePositionDuplicate, true);

  const otherPosSameElection = findDuplicateParticipationInElection(
    mockCandidates,
    'elec_src_2026',
    'pos_src_sec',
    'cont_ps_csc_22_0014',
    'PS/CSC/22/0014'
  );
  assert.equal(otherPosSameElection.isSamePositionDuplicate, false);
  assert.ok(otherPosSameElection.existingSameElection);

  const differentElection = findDuplicateParticipationInElection(
    mockCandidates,
    'elec_2027',
    'pos_src_pres',
    'cont_ps_csc_22_0014',
    'PS/CSC/22/0014'
  );
  assert.equal(differentElection.isSamePositionDuplicate, false);
  assert.equal(differentElection.existingSameElection, undefined);
});

test('diffPermanentProfileFields accurately isolates permanent changes', () => {
  const changed = diffPermanentProfileFields(
    {
      fullName: 'Kwame Boateng Mensah',
      studentId: 'PS/CSC/22/0014',
      department: 'Computer Science & Information Technology',
      hall: 'Casely Hayford Hall',
      leadershipExperience: ['Casford IT Coordinator'],
    },
    {
      fullName: 'Kwame Boateng Mensah',
      studentId: 'PS/CSC/22/0014',
      department: 'Computer Science & IT',
      hall: 'Casely Hayford Hall',
      leadershipExperience: ['Casford IT Coordinator'],
    }
  );
  assert.deepEqual(changed, ['department']);
});

test('evaluateElectionCandidateMutationAllowed enforces safeguards on live/closed/voted elections', () => {
  // Scheduled & 0 votes -> allowed
  assert.equal(
    evaluateElectionCandidateMutationAllowed(baseElection, 'remove', mockCandidates[1]).allowed,
    true
  );
  assert.equal(
    evaluateElectionCandidateMutationAllowed(baseElection, 'change_position', mockCandidates[1])
      .allowed,
    true
  );

  // Live election -> blocks removal & position reassignment
  const liveElection: Election = { ...baseElection, status: 'live' };
  assert.equal(
    evaluateElectionCandidateMutationAllowed(liveElection, 'remove', mockCandidates[1]).allowed,
    false
  );
  assert.equal(
    evaluateElectionCandidateMutationAllowed(liveElection, 'change_position', mockCandidates[1])
      .allowed,
    false
  );

  // Candidate has votes -> blocks removal & reassignment even if status were draft/scheduled
  assert.equal(
    evaluateElectionCandidateMutationAllowed(baseElection, 'remove', mockCandidates[0]).allowed,
    false
  );
  assert.equal(
    evaluateElectionCandidateMutationAllowed(baseElection, 'change_position', mockCandidates[0])
      .allowed,
    false
  );

  // Closed election -> blocks adding candidates
  const closedElection: Election = { ...baseElection, status: 'closed' };
  assert.equal(evaluateElectionCandidateMutationAllowed(closedElection, 'add').allowed, false);
});
