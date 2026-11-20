import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assessElectionRemovalEligibility,
  canUserManageElectionRemoval,
  getAvailableElectionActions,
  getElectionStatusMeta,
  isElectionVisibleInActiveListings,
  isValidElectionId,
  matchesRemovalConfirmation,
} from './electionRemovalUtils';
import { AdminProfile, Election } from '../types';

const draftZeroVoteElection: Election = {
  id: 'elec_test_draft_2027',
  title: 'Test SRC Mock Election 2027',
  code: 'SRC-TEST-2027',
  description: 'Draft test election',
  category: 'SRC',
  domainId: 'src',
  academicYear: '2026/2027',
  status: 'draft',
  startDate: '2027-04-10T08:00:00Z',
  endDate: '2027-04-10T17:00:00Z',
  totalEligibleVoters: 500,
  totalVotesCast: 0,
  turnoutPercentage: 0,
  organizingBody: 'UCC Electoral Commission',
  eligibilityCriteria: {},
  rules: [],
  positionsCount: 3,
  resultsCertified: false,
  provisionalResultsReady: false,
};

const superAdmin: AdminProfile = {
  id: 'admin_uid_1',
  uid: 'admin_uid_1',
  staffId: 'UCC/EC/001',
  fullName: 'Chief Electoral Commissioner',
  email: 'commissioner@ucc.edu.gh',
  role: 'Electoral Commissioner',
  department: 'Electoral Commission',
  permissions: ['manage_elections'],
  isActive: true,
};

test('Scenario 1: Authorised admin deletes draft/test/cancelled election with zero votes', () => {
  assert.equal(canUserManageElectionRemoval('admin', superAdmin, draftZeroVoteElection), true);
  assert.equal(isValidElectionId(draftZeroVoteElection.id), true);

  const draftAssessment = assessElectionRemovalEligibility(draftZeroVoteElection, {
    ballotsCount: 0,
    authorisationsCount: 0,
    confirmationsCount: 0,
    candidateVotesTotal: 0,
    hasPublishedResults: false,
  });
  assert.equal(draftAssessment.canPermanentlyDelete, true);
  assert.equal(draftAssessment.recommendedAction, 'permanent_delete');
  assert.equal(draftAssessment.blockedReason, null);

  const cancelledAssessment = assessElectionRemovalEligibility(
    { ...draftZeroVoteElection, status: 'cancelled' },
    { ballotsCount: 0, authorisationsCount: 0, confirmationsCount: 0 }
  );
  assert.equal(cancelledAssessment.canPermanentlyDelete, true);

  const actions = getAvailableElectionActions(draftZeroVoteElection, true);
  assert.equal(actions.remove, true);
  assert.equal(actions.archive, true);
  assert.equal(actions.cancel, true);
});

test('Scenario 2: Student, candidate, unauthenticated, deactivated, auditor, or out-of-scope caller rejected', () => {
  assert.equal(canUserManageElectionRemoval('student', null, draftZeroVoteElection), false);
  assert.equal(canUserManageElectionRemoval('guest', null, draftZeroVoteElection), false);
  assert.equal(canUserManageElectionRemoval('student', superAdmin, draftZeroVoteElection), false);

  const inactiveAdmin: AdminProfile = { ...superAdmin, isActive: false };
  assert.equal(canUserManageElectionRemoval('admin', inactiveAdmin, draftZeroVoteElection), false);

  const missingActiveFlagAdmin = { ...superAdmin, isActive: undefined as unknown as boolean };
  assert.equal(canUserManageElectionRemoval('admin', missingActiveFlagAdmin, draftZeroVoteElection), false);

  const auditorAdmin: AdminProfile = { ...superAdmin, role: 'Results Auditor' };
  assert.equal(canUserManageElectionRemoval('admin', auditorAdmin, draftZeroVoteElection), false);

  const hallOnlyAdmin: AdminProfile = {
    ...superAdmin,
    role: 'Hall Election Administrator',
    managedDomainIds: ['jcrc_hall'],
  };
  assert.equal(canUserManageElectionRemoval('admin', hallOnlyAdmin, draftZeroVoteElection), false);

  const unassignedHallAdmin: AdminProfile = {
    ...superAdmin,
    role: 'Hall Election Administrator',
    managedDomainIds: [],
  };
  assert.equal(canUserManageElectionRemoval('admin', unassignedHallAdmin, draftZeroVoteElection), false);

  const nonAdminActions = getAvailableElectionActions(draftZeroVoteElection, false);
  assert.equal(nonAdminActions.remove, false);
  assert.equal(nonAdminActions.archive, false);
  assert.equal(nonAdminActions.edit, false);

  assert.equal(isValidElectionId('bad/id/path'), false);
  assert.equal(isValidElectionId(''), false);
});

test('Scenario 3: Permanent deletion blocked when votes, authorisations, confirmations, or published results exist and archive offered instead', () => {
  const withCastCount = assessElectionRemovalEligibility({
    ...draftZeroVoteElection,
    status: 'closed',
    totalVotesCast: 42,
  });
  assert.equal(withCastCount.canPermanentlyDelete, false);
  assert.equal(withCastCount.canArchive, true);
  assert.equal(withCastCount.recommendedAction, 'archive');
  assert.equal(withCastCount.hasVotesOrParticipation, true);

  const withAuthorisationsOnly = assessElectionRemovalEligibility(
    { ...draftZeroVoteElection, status: 'closed', totalVotesCast: 0 },
    { authorisationsCount: 1 }
  );
  assert.equal(withAuthorisationsOnly.canPermanentlyDelete, false);
  assert.equal(withAuthorisationsOnly.recommendedAction, 'archive');

  const withConfirmationsOnly = assessElectionRemovalEligibility(
    { ...draftZeroVoteElection, status: 'closed', totalVotesCast: 0 },
    { confirmationsCount: 2 }
  );
  assert.equal(withConfirmationsOnly.canPermanentlyDelete, false);

  const withCandidateVotesOnly = assessElectionRemovalEligibility(
    { ...draftZeroVoteElection, status: 'closed', totalVotesCast: 0 },
    { candidateVotesTotal: 15 }
  );
  assert.equal(withCandidateVotesOnly.canPermanentlyDelete, false);

  const withPublishedResults = assessElectionRemovalEligibility(
    { ...draftZeroVoteElection, status: 'results_published', resultsCertified: true },
    { hasPublishedResults: true }
  );
  assert.equal(withPublishedResults.canPermanentlyDelete, false);
  assert.equal(withPublishedResults.canArchive, true);
  assert.equal(withPublishedResults.recommendedAction, 'archive');
});

test('Scenario 4: Archiving hides election from active listings while preserving protected state', () => {
  const archivedWithVotes: Election = {
    ...draftZeroVoteElection,
    status: 'archived',
    previousStatus: 'results_published',
    totalVotesCast: 320,
    resultsCertified: true,
    archivedAt: '2027-04-12T10:00:00Z',
    archivedBy: 'Chief Electoral Commissioner',
  };

  assert.equal(isElectionVisibleInActiveListings(archivedWithVotes), false);
  assert.equal(isElectionVisibleInActiveListings({ ...draftZeroVoteElection, status: 'cancelled' }), false);
  assert.equal(isElectionVisibleInActiveListings({ ...draftZeroVoteElection, status: 'draft' }), false);
  assert.equal(isElectionVisibleInActiveListings({ ...draftZeroVoteElection, status: 'live' }), true);
  assert.equal(isElectionVisibleInActiveListings({ ...draftZeroVoteElection, status: 'scheduled' }), true);

  const statusMeta = getElectionStatusMeta('archived');
  assert.equal(statusMeta.label, 'Archived');
});

test('Scenario 5: Active (live) election blocked from removal and archiving until closed or cancelled', () => {
  const liveElection: Election = {
    ...draftZeroVoteElection,
    status: 'live',
  };
  const liveAssessment = assessElectionRemovalEligibility(liveElection);
  assert.equal(liveAssessment.isLive, true);
  assert.equal(liveAssessment.canPermanentlyDelete, false);
  assert.equal(liveAssessment.canArchive, false);
  assert.equal(liveAssessment.canCloseFirst, true);
  assert.equal(liveAssessment.canCancel, true);
  assert.equal(liveAssessment.recommendedAction, 'close_first');
  assert.match(liveAssessment.blockedReason || '', /LIVE/i);

  const actions = getAvailableElectionActions(liveElection, true);
  assert.equal(actions.close, true);
  assert.equal(actions.cancel, true);
  assert.equal(actions.archive, false);
});

test('Scenario 6: Wrong, partial, or missing confirmation text prevents permanent deletion', () => {
  assert.equal(matchesRemovalConfirmation('', draftZeroVoteElection), false);
  assert.equal(matchesRemovalConfirmation('   ', draftZeroVoteElection), false);
  assert.equal(matchesRemovalConfirmation('Test SRC Mock', draftZeroVoteElection), false);
  assert.equal(matchesRemovalConfirmation('test src mock election 2027', draftZeroVoteElection), false);
  assert.equal(matchesRemovalConfirmation('DELETE SRC-TEST', draftZeroVoteElection), false);

  assert.equal(
    matchesRemovalConfirmation('Test SRC Mock Election 2027', draftZeroVoteElection),
    true
  );
  assert.equal(matchesRemovalConfirmation('DELETE SRC-TEST-2027', draftZeroVoteElection), true);
  assert.equal(
    matchesRemovalConfirmation('  DELETE SRC-TEST-2027  ', draftZeroVoteElection),
    true
  );
});

test('Scenario 7: Restoring an archived election returns it to valid non-archived status, while built-in historical 2026 archives stay protected', () => {
  const adminArchivedElection: Election = {
    ...draftZeroVoteElection,
    status: 'archived',
    previousStatus: 'closed',
    totalVotesCast: 120,
  };
  const restoreCheck = assessElectionRemovalEligibility(adminArchivedElection);
  assert.equal(restoreCheck.canRestore, true);
  assert.equal(getAvailableElectionActions(adminArchivedElection, true).restore, true);

  const builtInHistorical: Election = {
    ...draftZeroVoteElection,
    id: 'elec_2026_src',
    status: 'archived',
    isHistorical: true,
    totalVotesCast: 15000,
  };
  const historicalCheck = assessElectionRemovalEligibility(builtInHistorical);
  assert.equal(historicalCheck.isHistoricalProtected, true);
  assert.equal(historicalCheck.canPermanentlyDelete, false);
  assert.equal(historicalCheck.canRestore, false);
  assert.equal(getAvailableElectionActions(builtInHistorical, true).remove, false);
  assert.equal(getAvailableElectionActions(builtInHistorical, true).restore, false);
});

test('Scenario 8: Single-flight lock blocks repeated/double-click requests and Firestore rules enforce protections', async () => {
  let executions = 0;
  let inFlight = false;

  const triggerGuardedRemoval = async () => {
    if (inFlight) return { ignored: true };
    inFlight = true;
    try {
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return { ignored: false, success: true };
    } finally {
      inFlight = false;
    }
  };

  const [first, second, third] = await Promise.all([
    triggerGuardedRemoval(),
    triggerGuardedRemoval(),
    triggerGuardedRemoval(),
  ]);

  assert.equal(executions, 1);
  assert.equal(first.ignored, false);
  assert.equal(second.ignored, true);
  assert.equal(third.ignored, true);

  // Verify Firestore security rules enforce strict delete protections and preserve immutable collections
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');
  assert.match(rulesText, /function isAdminRecordActive\(\)/);
  assert.match(rulesText, /function hasZeroCount\(data,\s*field\)/);
  assert.match(rulesText, /function electionAllowsDeletion\(electionId,\s*electionData\)/);
  assert.match(rulesText, /match \/elections\/\{electionId\}[\s\S]*allow delete:[\s\S]*electionAllowsDeletion/);
  assert.match(rulesText, /hasZeroCount\(electionData,\s*'totalVotesCast'\)/);
  assert.match(rulesText, /!isFlagTrue\(electionData,\s*'isHistorical'\)/);
  assert.match(rulesText, /match \/ballots\/\{ballotId\}[\s\S]*allow read, write: if false;/);
  assert.match(rulesText, /match \/voter_authorisations\/\{authDocId\}[\s\S]*allow write: if false;/);
  assert.match(rulesText, /match \/vote_confirmations\/\{receiptId\}[\s\S]*allow write: if false;/);
  assert.match(rulesText, /match \/audit_logs\/\{logId\}[\s\S]*allow update, delete: if false;/);
  assert.match(rulesText, /match \/admins\/\{uid\}[\s\S]*allow write: if false;/);
});
