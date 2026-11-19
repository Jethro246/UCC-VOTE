import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAssignmentUniquenessKey,
  buildContestantId,
  evaluateElectionCandidateActionAllowed,
  findDuplicateAssignment,
  mergeContestantDirectory,
  normalizeStudentId,
  resolveCandidatePhotoUrl,
  searchContestants,
} from './contestantUtils.ts';

test('normalizeStudentId treats empty and unverified markers as blank and normalizes IDs', () => {
  assert.equal(normalizeStudentId('  ps/csc/22/0041 '), 'PS/CSC/22/0041');
  assert.equal(normalizeStudentId('Not verified'), '');
  assert.equal(normalizeStudentId('UNVERIFIED'), '');
  assert.equal(normalizeStudentId('N/A'), '');
  assert.equal(normalizeStudentId(''), '');
});

test('buildContestantId generates deterministic IDs from studentId or fallback name', () => {
  assert.equal(buildContestantId('PS/CSC/22/0041', 'Kwame Mensah'), 'cont_sid_PS_CSC_22_0041');
  assert.equal(buildContestantId('Not verified', 'Ama Serwaa'), 'cont_name_ama_serwaa');
});

test('resolveCandidatePhotoUrl prioritizes electionPhotoUrl over permanent photoUrl', () => {
  assert.equal(
    resolveCandidatePhotoUrl({
      photoUrl: 'https://example.com/default.jpg',
      electionPhotoUrl: 'https://example.com/election-override.jpg',
    }),
    'https://example.com/election-override.jpg'
  );
  assert.equal(
    resolveCandidatePhotoUrl({
      photoUrl: 'https://example.com/default.jpg',
      electionPhotoUrl: '',
    }),
    'https://example.com/default.jpg'
  );
  assert.equal(resolveCandidatePhotoUrl(null), '');
});

test('mergeContestantDirectory merges persisted and historical candidates cleanly without duplicates', () => {
  const stored = [
    {
      id: 'cont_sid_PS_CSC_22_0041',
      fullName: 'Kwame Boateng',
      studentId: 'PS/CSC/22/0041',
      department: 'Computer Science & IT',
      faculty: 'School of Physical Sciences',
      programme: 'B.Sc. Computer Science',
      level: '400',
      hall: 'Casely Hayford Hall',
      photoUrl: 'https://example.com/kwame.jpg',
      biography: 'Former class rep',
      leadershipExperience: ['Class Rep'],
    },
  ];

  const candidates = [
    {
      id: 'cand_1',
      contestantId: 'cont_sid_PS_CSC_22_0041',
      electionId: 'el_src_2025',
      positionId: 'pos_pres',
      fullName: 'Kwame Boateng',
      studentId: 'ps/csc/22/0041',
      department: 'Computer Science & IT',
      faculty: 'School of Physical Sciences',
      programme: 'B.Sc. Computer Science',
      level: '400',
      hall: 'Casely Hayford Hall',
      photoUrl: 'https://example.com/kwame.jpg',
      manifestoSummary: 'Digital SRC',
      fullManifesto: [],
      keyPromises: [],
      leadershipExperience: [],
      applicationStatus: 'Approved',
      eligibilityVerified: true,
    },
    {
      id: 'cand_hist_1',
      electionId: 'el_src_2026',
      positionId: 'pos_sec',
      fullName: 'Abena Korkor',
      studentId: 'ED/BAE/22/0010',
      department: 'Arts Education',
      faculty: 'Faculty of Humanities',
      programme: 'B.Ed. Arts',
      level: '300',
      hall: 'Adehye Hall',
      photoUrl: '',
      manifestoSummary: '',
      fullManifesto: [],
      keyPromises: [],
      leadershipExperience: [],
      applicationStatus: 'Approved',
      eligibilityVerified: true,
    },
  ];

  const elections = [
    { id: 'el_src_2025', title: '2025 SRC Election' },
    { id: 'el_src_2026', title: '2026 SRC Historical Election' },
  ];

  const positionsByElection = {
    el_src_2025: [{ id: 'pos_pres', electionId: 'el_src_2025', title: 'SRC President' }],
    el_src_2026: [{ id: 'pos_sec', electionId: 'el_src_2026', title: 'General Secretary' }],
  };

  const merged = mergeContestantDirectory(stored, candidates, elections, positionsByElection);
  assert.equal(merged.length, 2);

  const kwame = merged.find((c) => c.studentId === 'PS/CSC/22/0041');
  assert.ok(kwame);
  assert.equal(kwame.participations.length, 1);
  assert.equal(kwame.participations[0].electionTitle, '2025 SRC Election');
  assert.equal(kwame.participations[0].positionTitle, 'SRC President');

  const abena = merged.find((c) => c.studentId === 'ED/BAE/22/0010');
  assert.ok(abena);
  assert.equal(abena.sourceType, 'derived_from_candidates');
  assert.equal(searchContestants(merged, 'Arts Education').length, 1);
  assert.equal(searchContestants(merged, '2025 SRC').length, 1);
});

test('findDuplicateAssignment blocks same (election, position, contestant) and allows different elections/positions', () => {
  const existing = [
    {
      id: 'cand_existing',
      contestantId: 'cont_sid_PS_CSC_22_0041',
      electionId: 'el_1',
      positionId: 'pos_1',
      studentId: 'PS/CSC/22/0041',
      fullName: 'Kwame Boateng',
    },
  ];

  assert.ok(
    findDuplicateAssignment(existing, {
      electionId: 'el_1',
      positionId: 'pos_1',
      contestantId: 'cont_sid_PS_CSC_22_0041',
      studentId: 'ps/csc/22/0041',
    })
  );

  // Allowed when updating self
  assert.equal(
    findDuplicateAssignment(existing, {
      electionId: 'el_1',
      positionId: 'pos_1',
      contestantId: 'cont_sid_PS_CSC_22_0041',
      studentId: 'PS/CSC/22/0041',
      ignoreCandidateId: 'cand_existing',
    }),
    null
  );

  // Allowed for different position or different election
  assert.equal(
    findDuplicateAssignment(existing, {
      electionId: 'el_1',
      positionId: 'pos_2',
      contestantId: 'cont_sid_PS_CSC_22_0041',
    }),
    null
  );
  assert.equal(
    findDuplicateAssignment(existing, {
      electionId: 'el_2',
      positionId: 'pos_1',
      contestantId: 'cont_sid_PS_CSC_22_0041',
    }),
    null
  );

  assert.equal(
    buildAssignmentUniquenessKey('el_1', 'pos_1', 'PS/CSC/22/0041'),
    'el_1__pos_1__PS_CSC_22_0041'
  );
});

test('evaluateElectionCandidateActionAllowed enforces locked election and recorded vote safeguards', () => {
  const lockedElection = { id: 'el_closed', status: 'closed' };
  assert.equal(evaluateElectionCandidateActionAllowed(lockedElection, 'add').allowed, false);
  assert.equal(evaluateElectionCandidateActionAllowed(lockedElection, 'remove').allowed, false);
  assert.equal(
    evaluateElectionCandidateActionAllowed(lockedElection, 'change_position').allowed,
    false
  );
  assert.equal(evaluateElectionCandidateActionAllowed(lockedElection, 'edit_info').allowed, true);

  const liveElection = { id: 'el_live', status: 'live' };
  const candidateWithVotes = { id: 'c1', votesReceived: 14 };
  assert.equal(
    evaluateElectionCandidateActionAllowed(liveElection, 'remove', candidateWithVotes).allowed,
    false
  );
  assert.equal(
    evaluateElectionCandidateActionAllowed(liveElection, 'change_position', candidateWithVotes)
      .allowed,
    false
  );
  assert.equal(
    evaluateElectionCandidateActionAllowed(liveElection, 'edit_info', candidateWithVotes).allowed,
    true
  );

  const candidateZeroVotes = { id: 'c2', votesReceived: 0 };
  const removeLiveZero = evaluateElectionCandidateActionAllowed(
    liveElection,
    'remove',
    candidateZeroVotes
  );
  assert.equal(removeLiveZero.allowed, true);
  assert.ok(removeLiveZero.warning);
});
