import assert from 'node:assert/strict';
import {
  SRC_2027_CANDIDATES,
  SRC_2027_ELECTION,
  SRC_2027_ELECTION_CODE,
  SRC_2027_ELECTION_ID,
  SRC_2027_POSITIONS,
  getSrc2027CandidateById,
  getSrc2027ElectionById,
  getSrc2027PositionsByElectionId,
  mergeSrc2027Candidates,
  mergeSrc2027Elections,
  mergeSrc2027Positions,
} from '../src/data/src2027Election';
import {
  HISTORICAL_2026_CANDIDATES,
  HISTORICAL_2026_ELECTIONS,
  HISTORICAL_2026_POSITIONS,
  mergeHistoricalCandidates,
  mergeHistoricalElections,
  mergeHistoricalPositions,
} from '../src/data/historical2026Elections';
import {
  isElectionPublishedToStudents,
  isElectionVisibleInDirectory,
} from '../src/utils/electionStatus';
import { getAvailableElectionActions } from '../src/utils/electionRemovalUtils';
import { evaluateStudentEligibilityLocal } from '../src/services/electionClient';
import type { StudentProfile, VoterEligibilityRecord } from '../src/types';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

const verifiedUndergrad: StudentProfile = {
  id: 'stu-2027-1',
  uid: 'stu-2027-1',
  studentId: 'UCC/2027/101',
  indexNumber: 'BS/BSS/23/0101',
  fullName: 'Kofi Boateng',
  email: 'kofi.boateng@stu.ucc.edu.gh',
  emailVerified: true,
  phone: '0240000101',
  faculty: 'School of Business',
  department: 'Department of Accounting',
  programme: 'BCom Accounting',
  level: '300',
  hall: 'Oguaa Hall',
  status: 'active',
  isEligible: true,
  eligibilityStatus: 'eligible',
  hasVotedElections: [],
  createdAt: '2026-11-19T00:00:00Z',
};

const verifiedUndergradRecord: VoterEligibilityRecord = {
  id: 'stu-2027-1',
  uid: 'stu-2027-1',
  studentId: 'UCC/2027/101',
  fullName: 'Kofi Boateng',
  email: 'kofi.boateng@stu.ucc.edu.gh',
  faculty: 'School of Business',
  department: 'Department of Accounting',
  programme: 'BCom Accounting',
  level: '300',
  hall: 'Oguaa Hall',
  isEligible: true,
  status: 'eligible',
};

// 1. Metadata & non-historical draft configuration
runTest('UCC SRC General Elections 2027 metadata and draft configuration are valid', () => {
  assert.equal(SRC_2027_ELECTION_ID, 'elec_2027_src');
  assert.equal(SRC_2027_ELECTION_CODE, 'UCC-SRC-2027');
  assert.equal(SRC_2027_ELECTION.title, 'UCC SRC General Elections 2027');
  assert.equal(SRC_2027_ELECTION.code, 'UCC-SRC-2027');
  assert.equal(SRC_2027_ELECTION.academicYear, '2027');
  assert.equal(SRC_2027_ELECTION.category, 'SRC');
  assert.equal(SRC_2027_ELECTION.domainId, 'src');
  assert.equal(SRC_2027_ELECTION.subdomainLabel, 'University-Wide Undergraduate Executive');
  assert.equal(SRC_2027_ELECTION.organizingBody, 'UCC Electoral Commission');
  assert.equal(SRC_2027_ELECTION.status, 'draft');
  assert.equal(SRC_2027_ELECTION.isPublished, true);
  assert.equal(SRC_2027_ELECTION.isHistorical, false);
  assert.equal(SRC_2027_ELECTION.startDate, '');
  assert.equal(SRC_2027_ELECTION.endDate, '');
  assert.equal(SRC_2027_ELECTION.totalVotesCast, 0);
  assert.equal(SRC_2027_ELECTION.totalEligibleVoters, 0);
  assert.equal(SRC_2027_ELECTION.turnoutPercentage, 0);
  assert.equal(SRC_2027_ELECTION.positionsCount, 7);
  assert.equal(SRC_2027_ELECTION.resultsCertified, false);
  assert.equal(SRC_2027_ELECTION.provisionalResultsReady, false);
  assert.equal(SRC_2027_ELECTION.historicalNote, undefined);
});

// 2. Visibility rules: visible in directory/domain as draft, NOT open for ballot voting yet
runTest('2027 election is visible in directory while closed for ballot casting until admin activation', () => {
  assert.equal(isElectionVisibleInDirectory(SRC_2027_ELECTION), true);
  assert.equal(isElectionPublishedToStudents(SRC_2027_ELECTION), false);

  const liveVersion = { ...SRC_2027_ELECTION, status: 'live' as const };
  assert.equal(isElectionVisibleInDirectory(liveVersion), true);
  assert.equal(isElectionPublishedToStudents(liveVersion), true);
});

// 3. Exact 7 contested positions and exact 17 contestants
runTest('Exact 7 SRC executive portfolios and all 17 contestants match specifications', () => {
  const expectedByPortfolio: Array<{ title: string; order: number; contestants: string[] }> = [
    {
      title: 'SRC President',
      order: 1,
      contestants: ['Emmanuel Acheampong Nana Adjei', 'Richard Agyemang'],
    },
    {
      title: 'SRC Vice President',
      order: 2,
      contestants: ['Regina Yayra Adenyo'],
    },
    {
      title: 'SRC General Secretary',
      order: 3,
      contestants: ['Benedicta Tiwaa Danso', 'Hawawu Abdulai Kiejembu'],
    },
    {
      title: 'SRC Treasurer',
      order: 4,
      contestants: ['Nuhu Dauda', 'Isaac Aidoo', 'Emmanuel Wonders Koku'],
    },
    {
      title: 'SRC Public Relations Officer',
      order: 5,
      contestants: [
        'Elisha Mensah Kojo Jnr',
        'Gideon Kwadwo Adade',
        'Eric Darlington Anku',
      ],
    },
    {
      title: 'SRC Coordinating Secretary',
      order: 6,
      contestants: [
        'Adwoa Asima Agbehiam',
        'Winnifred Cobbinah',
        'Bridget Amoah',
        'Ernestina Netty',
      ],
    },
    {
      title: 'SRC General Sports Secretary',
      order: 7,
      contestants: ['Emmanuel Essel', 'Felix Kwabla Akpakli'],
    },
  ];

  assert.equal(SRC_2027_POSITIONS.length, 7);
  assert.equal(SRC_2027_CANDIDATES.length, 17);

  expectedByPortfolio.forEach((expected) => {
    const pos = SRC_2027_POSITIONS.find((p) => p.title === expected.title);
    assert.ok(pos, `Missing position: ${expected.title}`);
    assert.equal(pos.order, expected.order);
    assert.equal(pos.electionId, SRC_2027_ELECTION_ID);

    const posCandidates = SRC_2027_CANDIDATES.filter((c) => c.positionId === pos.id);
    assert.deepEqual(
      posCandidates.map((c) => c.fullName),
      expected.contestants
    );
    assert.deepEqual(
      pos.candidateIds,
      posCandidates.map((c) => c.id)
    );
  });
});

// 4. Zero historical winner labels, zero outcome notes, zero votes
runTest('All 17 contestants have zero votes, Approved status, and no historical winner labels', () => {
  SRC_2027_CANDIDATES.forEach((cand) => {
    assert.equal(cand.electionId, SRC_2027_ELECTION_ID);
    assert.equal(cand.votesReceived, 0);
    assert.equal(cand.isHistoricalRecord, false);
    assert.equal(cand.applicationStatus, 'Approved');
    assert.equal(cand.eligibilityVerified, true);
    assert.equal(cand.historicalRole, undefined);
    assert.equal(cand.historicalOutcomeNote, undefined);
  });
});

// 5. Historical 2026 SRC archive remains untouched alongside 2027 SRC
runTest('Historical 2026 SRC archive and 7 winners remain intact alongside 2027 SRC', () => {
  const mergedElections = mergeSrc2027Elections(mergeHistoricalElections([]));
  const src2026 = mergedElections.find((e) => e.id === 'elec_2026_src');
  const src2027 = mergedElections.find((e) => e.id === 'elec_2027_src');

  assert.ok(src2026, '2026 SRC election must remain present');
  assert.ok(src2027, '2027 SRC election must be present');
  assert.equal(src2026.status, 'archived');
  assert.equal(src2026.isHistorical, true);
  assert.equal(src2027.status, 'draft');
  assert.equal(src2027.isHistorical, false);

  const mergedPositions = mergeSrc2027Positions(mergeHistoricalPositions({}));
  assert.equal(mergedPositions['elec_2026_src'].length, 7);
  assert.equal(mergedPositions['elec_2027_src'].length, 7);

  const mergedCandidates = mergeSrc2027Candidates(mergeHistoricalCandidates([]));
  const cands2026 = mergedCandidates.filter((c) => c.electionId === 'elec_2026_src');
  const cands2027 = mergedCandidates.filter((c) => c.electionId === 'elec_2027_src');
  assert.equal(cands2026.length, 17);
  assert.equal(cands2027.length, 17);
  assert.equal(
    cands2026.filter((c) => c.historicalRole === 'Winner' || c.historicalRole === 'Elected Unopposed').length,
    7
  );
  assert.equal(cands2027.filter((c) => Boolean(c.historicalRole)).length, 0);

  // Also ensure original module exports remain untouched
  assert.ok(HISTORICAL_2026_ELECTIONS.some((e) => e.id === 'elec_2026_src'));
  assert.equal(HISTORICAL_2026_POSITIONS.filter((p) => p.electionId === 'elec_2026_src').length, 7);
  assert.equal(HISTORICAL_2026_CANDIDATES.filter((c) => c.electionId === 'elec_2026_src').length, 17);
});

// 6. Helper lookups, eligibility checks, and admin management capabilities
runTest('Helper lookups, student eligibility validation, and admin actions work for 2027 SRC', () => {
  assert.equal(getSrc2027ElectionById(SRC_2027_ELECTION_ID)?.code, SRC_2027_ELECTION_CODE);
  assert.equal(getSrc2027ElectionById('elec_2026_src'), undefined);
  assert.equal(getSrc2027PositionsByElectionId(SRC_2027_ELECTION_ID).length, 7);
  assert.equal(getSrc2027CandidateById('cand_2027_src_richard_agyemang')?.fullName, 'Richard Agyemang');

  // Undergraduate eligible; postgraduate blocked from 100-400 SRC scope
  assert.equal(
    evaluateStudentEligibilityLocal(verifiedUndergrad, SRC_2027_ELECTION, verifiedUndergradRecord).isEligible,
    true
  );
  const postgrad: StudentProfile = { ...verifiedUndergrad, level: 'Postgraduate' };
  const postgradRecord: VoterEligibilityRecord = { ...verifiedUndergradRecord, level: 'Postgraduate' };
  assert.equal(
    evaluateStudentEligibilityLocal(postgrad, SRC_2027_ELECTION, postgradRecord).isEligible,
    false
  );

  // Admin capabilities enabled for 2027 draft, protected for 2026 historical archive
  const actions2027 = getAvailableElectionActions(SRC_2027_ELECTION, true);
  assert.equal(actions2027.edit, true);
  assert.equal(actions2027.statusManage, true);
  assert.equal(actions2027.remove, true);

  const src2026 = HISTORICAL_2026_ELECTIONS.find((e) => e.id === 'elec_2026_src')!;
  const actions2026 = getAvailableElectionActions(src2026, true);
  assert.equal(actions2026.edit, false);
  assert.equal(actions2026.statusManage, false);
  assert.equal(actions2026.remove, false);
});

console.log('All UCC SRC 2027 election verification checks passed.');
