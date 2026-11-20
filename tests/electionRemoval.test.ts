import assert from 'node:assert/strict';
import {
  BULK_REMOVE_CONFIRMATION_PHRASE,
  BulkElectionInspectionItem,
  applyDirectoryVisibilityFilter,
  assessElectionRemovalEligibility,
  buildBulkRemovalPlan,
  classifyElectionForBulkRemoval,
  collectProtectedRecordLabels,
  isGlobalGovernanceAdmin,
  matchesBulkRemovalConfirmation,
} from '../src/utils/electionRemovalUtils';
import { isElectionVisibleInDirectory } from '../src/utils/electionStatus';
import { HISTORICAL_2026_ELECTIONS } from '../src/data/historical2026Elections';
import { SRC_2027_ELECTION } from '../src/data/src2027Election';
import type { AdminProfile, Election } from '../src/types';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

function makeAdmin(overrides: Partial<AdminProfile> = {}): AdminProfile {
  return {
    id: 'adm-1',
    uid: 'adm-1',
    staffId: 'UCC-EC-001',
    fullName: 'Electoral Commissioner',
    email: 'ec@ucc.edu.gh',
    role: 'Electoral Commissioner',
    department: 'Electoral Commission',
    permissions: ['manage_elections'],
    isActive: true,
    ...overrides,
  };
}

function makeInspectionItem(
  election: Election,
  overrides: Partial<BulkElectionInspectionItem> = {}
): BulkElectionInspectionItem {
  const ballotsCount = overrides.ballotsCount ?? Math.max(0, Number(election.totalVotesCast) || 0);
  const authorisationsCount = overrides.authorisationsCount ?? 0;
  const confirmationsCount = overrides.confirmationsCount ?? 0;
  const candidateVotesTotal = overrides.candidateVotesTotal ?? 0;
  const hasPublishedResults =
    overrides.hasPublishedResults ?? election.status === 'results_published';
  const hasExistingResultsDoc = overrides.hasExistingResultsDoc ?? false;
  const resultsCertified =
    overrides.resultsCertified ?? Boolean(election.resultsCertified);
  const votingRecordsExist =
    overrides.votingRecordsExist ??
    (ballotsCount > 0 ||
      authorisationsCount > 0 ||
      confirmationsCount > 0 ||
      candidateVotesTotal > 0 ||
      hasPublishedResults ||
      resultsCertified);

  const eligibility =
    overrides.eligibility ??
    assessElectionRemovalEligibility(election, {
      ballotsCount,
      authorisationsCount,
      confirmationsCount,
      candidateVotesTotal,
      hasPublishedResults,
      hasExistingResultsDoc,
      resultsCertified,
    });

  const item: BulkElectionInspectionItem = {
    election,
    source: overrides.source ?? 'firestore',
    positionsCount: overrides.positionsCount ?? (election.positionsCount || 0),
    candidatesCount: overrides.candidatesCount ?? 0,
    assignmentsCount: overrides.assignmentsCount ?? 0,
    authorisationsCount,
    confirmationsCount,
    ballotsCount,
    candidateVotesTotal,
    hasExistingResultsDoc,
    hasPublishedResults,
    resultsCertified,
    votingRecordsExist,
    eligibility,
    protectedRecords: [],
  };
  item.protectedRecords = overrides.protectedRecords ?? collectProtectedRecordLabels(item);
  return item;
}

// 1. Verbatim confirmation phrase validation
runTest('Bulk removal confirmation requires exact REMOVE ALL ELECTIONS phrase', () => {
  assert.equal(matchesBulkRemovalConfirmation(BULK_REMOVE_CONFIRMATION_PHRASE), true);
  assert.equal(matchesBulkRemovalConfirmation('  REMOVE ALL ELECTIONS  '), true);
  assert.equal(matchesBulkRemovalConfirmation('remove all elections'), false);
  assert.equal(matchesBulkRemovalConfirmation('REMOVE ALL'), false);
  assert.equal(matchesBulkRemovalConfirmation(''), false);
});

// 2. Global Governance RBAC enforcement
runTest('Only unrestricted active Super Administrators and Electoral Commissioners are global governance admins', () => {
  assert.equal(isGlobalGovernanceAdmin(makeAdmin({ role: 'Super Administrator' })), true);
  assert.equal(isGlobalGovernanceAdmin(makeAdmin({ role: 'Electoral Commissioner' })), true);

  assert.equal(
    isGlobalGovernanceAdmin(makeAdmin({ role: 'Super Administrator', isActive: false })),
    false
  );
  assert.equal(
    isGlobalGovernanceAdmin(
      makeAdmin({ role: 'Electoral Commissioner', managedDomainIds: ['src'] })
    ),
    false
  );
  assert.equal(
    isGlobalGovernanceAdmin(
      makeAdmin({ role: 'Hall Election Administrator', managedHalls: ['Oguaa Hall'] })
    ),
    false
  );
  assert.equal(isGlobalGovernanceAdmin(null), false);
});

// 3. Built-in elections classification: 2027 SRC draft vs 2026 historical archives
runTest('Built-in SRC 2027 draft is safely removable while 2026 historical archives preserve records', () => {
  const builtInItems: BulkElectionInspectionItem[] = [
    makeInspectionItem(SRC_2027_ELECTION, {
      source: 'builtin_only',
      positionsCount: 7,
      candidatesCount: 17,
    }),
    ...HISTORICAL_2026_ELECTIONS.map((hist) =>
      makeInspectionItem(hist, {
        source: 'builtin_only',
        positionsCount: hist.positionsCount,
      })
    ),
  ];

  // Default plan: exclude historical from removal
  const defaultPlan = buildBulkRemovalPlan(builtInItems, { includeHistorical: false });
  assert.equal(defaultPlan.totalFound, 5);
  assert.equal(defaultPlan.deletableCount, 1);
  assert.equal(defaultPlan.skippedHistoricalCount, 4);
  assert.equal(defaultPlan.detachArchiveCount, 0);
  assert.equal(defaultPlan.hasLiveBlockers, false);
  assert.equal(defaultPlan.canProceedWithoutDetachingProtected, true);

  // Explicit opt-in to clear historical listings from active directory: archives/detaches without deletion
  const includeHistPlan = buildBulkRemovalPlan(builtInItems, { includeHistorical: true });
  assert.equal(includeHistPlan.totalFound, 5);
  assert.equal(includeHistPlan.deletableCount, 1);
  assert.equal(includeHistPlan.detachArchiveCount, 4);
  assert.equal(includeHistPlan.skippedHistoricalCount, 0);
  assert.equal(includeHistPlan.canProceedWithoutDetachingProtected, false);
});

// 4. Live election blocker & protected voting records safeguards
runTest('Live elections block removal and elections with cast ballots/authorisations/receipts block permanent deletion', () => {
  const liveElection: Election = {
    ...SRC_2027_ELECTION,
    id: 'elec_live_test',
    code: 'TEST-LIVE-2027',
    title: 'Live Hall Election',
    status: 'live',
  };

  const votedClosedElection: Election = {
    ...SRC_2027_ELECTION,
    id: 'elec_voted_closed',
    code: 'TEST-CLOSED-2027',
    title: 'Closed Election With Ballots',
    status: 'closed',
    totalVotesCast: 124,
  };

  const draftTestElection: Election = {
    ...SRC_2027_ELECTION,
    id: 'elec_draft_test',
    code: 'TEST-DRAFT-2027',
    title: 'Empty Test Draft',
    status: 'draft',
    totalVotesCast: 0,
  };

  const liveClass = classifyElectionForBulkRemoval(
    makeInspectionItem(liveElection),
    { includeHistorical: false }
  );
  assert.equal(liveClass.disposition, 'blocked_live');

  const votedClass = classifyElectionForBulkRemoval(
    makeInspectionItem(votedClosedElection, {
      ballotsCount: 124,
      authorisationsCount: 124,
      confirmationsCount: 124,
      candidateVotesTotal: 124,
      hasPublishedResults: false,
    }),
    { includeHistorical: false }
  );
  assert.equal(votedClass.disposition, 'detach_archive');
  assert.ok(votedClass.protectedRecords.some((l) => l.includes('ballots')));
  assert.ok(votedClass.protectedRecords.some((l) => l.includes('Voter authorisations')));
  assert.ok(votedClass.protectedRecords.some((l) => l.includes('Vote confirmation receipts')));

  const draftClass = classifyElectionForBulkRemoval(
    makeInspectionItem(draftTestElection, { positionsCount: 3, candidatesCount: 5 }),
    { includeHistorical: false }
  );
  assert.equal(draftClass.disposition, 'delete');

  const combinedPlan = buildBulkRemovalPlan(
    [liveClass, votedClass, draftClass],
    { includeHistorical: false }
  );
  assert.equal(combinedPlan.hasLiveBlockers, true);
  assert.equal(combinedPlan.blockedLiveCount, 1);
  assert.equal(combinedPlan.detachArchiveCount, 1);
  assert.equal(combinedPlan.deletableCount, 1);
  assert.equal(combinedPlan.withVotingRecordsCount, 1);
  assert.equal(combinedPlan.canProceedWithoutDetachingProtected, false);
});

// 5. Directory clearance & preservation of newly created elections
runTest('Directory visibility filter clears removed/detached elections to zero while preserving newly created elections', () => {
  const allBuiltIns: Election[] = [SRC_2027_ELECTION, ...HISTORICAL_2026_ELECTIONS];
  const hiddenIds = allBuiltIns.map((e) => e.id);

  const cleared = applyDirectoryVisibilityFilter(allBuiltIns, hiddenIds, new Set());
  assert.equal(cleared.length, 0);

  // Detached Firestore historical/voted election with hiddenFromDirectory: true stays hidden
  const detachedFirestore: Election = {
    ...SRC_2027_ELECTION,
    id: 'elec_voted_closed',
    status: 'archived',
    hiddenFromDirectory: true,
    isPublished: false,
  };
  assert.equal(isElectionVisibleInDirectory(detachedFirestore), false);

  // Newly created election after clearance appears immediately
  const freshElection: Election = {
    ...SRC_2027_ELECTION,
    id: 'elec_fresh_2027',
    code: 'NEW-2027',
    title: 'Fresh 2027 Election',
    status: 'scheduled',
    hiddenFromDirectory: false,
  };

  const afterFreshCreate = applyDirectoryVisibilityFilter(
    [...allBuiltIns, detachedFirestore, freshElection],
    hiddenIds,
    new Set(['elec_voted_closed', 'elec_fresh_2027'])
  );
  assert.deepEqual(
    afterFreshCreate.map((e) => e.id),
    ['elec_fresh_2027']
  );
});
