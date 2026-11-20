import { AdminProfile, Election, ElectionStatus } from '../types';

export const VALID_ELECTION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidElectionId(id: string | undefined | null): boolean {
  if (typeof id !== 'string') return false;
  return VALID_ELECTION_ID_PATTERN.test(id.trim());
}

export interface ElectionParticipationSignals {
  ballotsCount?: number;
  authorisationsCount?: number;
  confirmationsCount?: number;
  candidateVotesTotal?: number;
  hasPublishedResults?: boolean;
  hasExistingResultsDoc?: boolean;
  resultsCertified?: boolean;
}

export interface ElectionRemovalEligibility {
  electionId: string;
  canPermanentlyDelete: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canCancel: boolean;
  canCloseFirst: boolean;
  isLive: boolean;
  isHistoricalProtected: boolean;
  hasVotesOrParticipation: boolean;
  recommendedAction: 'permanent_delete' | 'archive' | 'close_first' | 'none';
  blockedReason: string | null;
  summaryMessage: string;
  voteEvidence: {
    electionTotalVotesCast: number;
    ballotsCount: number;
    authorisationsCount: number;
    confirmationsCount: number;
    candidateVotesTotal: number;
    hasPublishedResults: boolean;
    resultsCertified: boolean;
  };
}

const PERMANENT_DELETE_ALLOWED_STATUSES = new Set<ElectionStatus>([
  'draft',
  'pending_approval',
  'scheduled',
  'upcoming',
  'suspended',
  'closed',
  'cancelled',
  'archived',
]);

export function assessElectionRemovalEligibility(
  election: Election,
  signals: ElectionParticipationSignals = {}
): ElectionRemovalEligibility {
  const electionVotes = Math.max(0, Number(election.totalVotesCast) || 0);
  const ballotsCount = Math.max(0, Number(signals.ballotsCount) || 0);
  const authorisationsCount = Math.max(0, Number(signals.authorisationsCount) || 0);
  const confirmationsCount = Math.max(0, Number(signals.confirmationsCount) || 0);
  const candidateVotesTotal = Math.max(0, Number(signals.candidateVotesTotal) || 0);
  const hasPublishedResults =
    Boolean(signals.hasPublishedResults) || election.status === 'results_published';
  const resultsCertified =
    Boolean(election.resultsCertified) || Boolean(signals.resultsCertified);

  const isLive = election.status === 'live';
  const isHistoricalProtected = Boolean(election.isHistorical);
  const hasVotesOrParticipation =
    electionVotes > 0 ||
    ballotsCount > 0 ||
    authorisationsCount > 0 ||
    confirmationsCount > 0 ||
    candidateVotesTotal > 0 ||
    hasPublishedResults ||
    resultsCertified;

  const voteEvidence = {
    electionTotalVotesCast: electionVotes,
    ballotsCount,
    authorisationsCount,
    confirmationsCount,
    candidateVotesTotal,
    hasPublishedResults,
    resultsCertified,
  };

  const canCancel =
    !isHistoricalProtected &&
    election.status !== 'cancelled' &&
    election.status !== 'archived' &&
    election.status !== 'results_published';

  const canRestore = election.status === 'archived' && !isHistoricalProtected;

  if (!isValidElectionId(election.id)) {
    return {
      electionId: election.id,
      canPermanentlyDelete: false,
      canArchive: false,
      canRestore: false,
      canCancel: false,
      canCloseFirst: false,
      isLive,
      isHistoricalProtected,
      hasVotesOrParticipation,
      recommendedAction: 'none',
      blockedReason: 'Invalid election identifier format.',
      summaryMessage: 'Election identifier failed validation.',
      voteEvidence,
    };
  }

  if (isHistoricalProtected) {
    return {
      electionId: election.id,
      canPermanentlyDelete: false,
      canArchive: false,
      canRestore: false,
      canCancel: false,
      canCloseFirst: false,
      isLive: false,
      isHistoricalProtected: true,
      hasVotesOrParticipation: true,
      recommendedAction: 'none',
      blockedReason:
        'Historical 2026 University of Cape Coast election records are permanently protected and cannot be removed.',
      summaryMessage: 'Protected historical archive.',
      voteEvidence,
    };
  }

  if (isLive) {
    return {
      electionId: election.id,
      canPermanentlyDelete: false,
      canArchive: false,
      canRestore: false,
      canCancel: true,
      canCloseFirst: true,
      isLive: true,
      isHistoricalProtected: false,
      hasVotesOrParticipation,
      recommendedAction: 'close_first',
      blockedReason:
        'This election is currently LIVE. Voting must be closed or cancelled before it can be archived or removed.',
      summaryMessage: 'Close or cancel active voting before removing or archiving this election.',
      voteEvidence,
    };
  }

  if (hasVotesOrParticipation) {
    const canArchive = election.status !== 'archived';
    return {
      electionId: election.id,
      canPermanentlyDelete: false,
      canArchive,
      canRestore,
      canCancel: false,
      canCloseFirst: false,
      isLive: false,
      isHistoricalProtected: false,
      hasVotesOrParticipation: true,
      recommendedAction: canArchive ? 'archive' : 'none',
      blockedReason:
        'Permanent deletion is blocked because ballots, voter authorisations, vote confirmations, candidate tallies, or published results already exist. Archive this election instead so audit and receipt records stay intact.',
      summaryMessage: canArchive
        ? 'Votes or official records exist. Archive election safely while preserving ballots and receipts.'
        : 'Already archived with official voting records preserved.',
      voteEvidence,
    };
  }

  if (!PERMANENT_DELETE_ALLOWED_STATUSES.has(election.status)) {
    return {
      electionId: election.id,
      canPermanentlyDelete: false,
      canArchive: true,
      canRestore: false,
      canCancel: true,
      canCloseFirst: false,
      isLive: false,
      isHistoricalProtected: false,
      hasVotesOrParticipation: false,
      recommendedAction: 'archive',
      blockedReason: `Elections in "${election.status.replace(/_/g, ' ')}" status must be closed, cancelled, or reverted to draft before permanent deletion.`,
      summaryMessage: 'Transition status to closed, cancelled, or draft before permanent removal.',
      voteEvidence,
    };
  }

  return {
    electionId: election.id,
    canPermanentlyDelete: true,
    canArchive: election.status !== 'archived',
    canRestore,
    canCancel,
    canCloseFirst: false,
    isLive: false,
    isHistoricalProtected: false,
    hasVotesOrParticipation: false,
    recommendedAction: 'permanent_delete',
    blockedReason: null,
    summaryMessage:
      'Zero votes, authorisations, confirmations, and published results recorded. Eligible for permanent removal (with protected master student, contestant, and audit records preserved).',
    voteEvidence,
  };
}

export interface AvailableElectionActions {
  view: boolean;
  edit: boolean;
  close: boolean;
  cancel: boolean;
  archive: boolean;
  restore: boolean;
  remove: boolean;
  statusManage: boolean;
}

export function getAvailableElectionActions(
  election: Election,
  isAuthorisedAdmin = false
): AvailableElectionActions {
  const isHistorical = Boolean(election.isHistorical);
  const isLive = election.status === 'live';
  const isArchived = election.status === 'archived';
  const isCancelled = election.status === 'cancelled';

  return {
    view: true,
    edit: isAuthorisedAdmin && !isArchived && !isCancelled && !isHistorical,
    close: isAuthorisedAdmin && isLive,
    cancel:
      isAuthorisedAdmin &&
      !isHistorical &&
      !isCancelled &&
      !isArchived &&
      election.status !== 'results_published',
    archive: isAuthorisedAdmin && !isLive && !isArchived,
    restore: isAuthorisedAdmin && isArchived && !isHistorical,
    remove: isAuthorisedAdmin && !isHistorical,
    statusManage: isAuthorisedAdmin && !isHistorical,
  };
}

export function getRequiredRemovalConfirmationHint(
  election: Pick<Election, 'title' | 'code'>
): string {
  return election.title.trim() || `DELETE ${election.code.trim()}`;
}

export function matchesRemovalConfirmation(
  input: string,
  election: Pick<Election, 'title' | 'code'>
): boolean {
  const trimmed = String(input || '').trim();
  if (!trimmed) return false;
  const expectedTitle = String(election.title || '').trim();
  const expectedCodePhrase = election.code ? `DELETE ${String(election.code).trim()}` : '';
  return (Boolean(expectedTitle) && trimmed === expectedTitle) || (Boolean(expectedCodePhrase) && trimmed === expectedCodePhrase);
}

const UNSCOPED_ELECTION_ROLES = new Set<string>([
  'Super Administrator',
  'Electoral Commissioner',
  'Returning Officer',
]);

export function canUserManageElectionRemoval(
  userRole: string,
  adminProfile: AdminProfile | null | undefined,
  election: Election
): boolean {
  if (userRole !== 'admin' || !adminProfile) return false;
  if (adminProfile.isActive !== true) return false;
  if (adminProfile.role === 'Results Auditor') return false;

  const managedDomains = Array.isArray(adminProfile.managedDomainIds)
    ? adminProfile.managedDomainIds
    : [];
  const isUnscopedGlobal =
    UNSCOPED_ELECTION_ROLES.has(adminProfile.role) && managedDomains.length === 0;
  if (isUnscopedGlobal) return true;

  return Boolean(
    managedDomains.length > 0 && election.domainId && managedDomains.includes(election.domainId)
  );
}

export function isElectionVisibleInActiveListings(election: Election): boolean {
  if (
    election.status === 'draft' ||
    election.status === 'pending_approval' ||
    election.status === 'cancelled' ||
    election.status === 'archived'
  ) {
    return false;
  }
  return true;
}

export function getElectionStatusMeta(status: ElectionStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'live':
      return {
        label: 'Live Voting',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'scheduled':
    case 'upcoming':
      return {
        label: 'Scheduled',
        badgeClass: 'bg-blue-50 text-[#123B70] border-blue-200',
      };
    case 'draft':
      return {
        label: 'Draft',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      };
    case 'pending_approval':
      return {
        label: 'Pending Approval',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
      };
    case 'suspended':
      return {
        label: 'Suspended',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'closed':
      return {
        label: 'Closed',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-red-50 text-[#C62828] border-red-200',
      };
    case 'results_pending_certification':
      return {
        label: 'Pending Certification',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    case 'results_published':
      return {
        label: 'Results Published',
        badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      };
    case 'archived':
      return {
        label: 'Archived',
        badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
      };
    default:
      return {
        label: String(status).replace(/_/g, ' '),
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

export const DIRECTORY_CONFIG_DOC_ID = '__directory_config';
export const BULK_REMOVE_CONFIRMATION_PHRASE = 'REMOVE ALL ELECTIONS';

export function matchesBulkRemovalConfirmation(input: string): boolean {
  return String(input || '').trim() === BULK_REMOVE_CONFIRMATION_PHRASE;
}

export function isGlobalGovernanceAdmin(
  admin: AdminProfile | null | undefined
): boolean {
  if (!admin || admin.isActive === false) return false;
  if (admin.role !== 'Super Administrator' && admin.role !== 'Electoral Commissioner') {
    return false;
  }
  const hasScopedRestrictions =
    (Array.isArray(admin.managedDomainIds) && admin.managedDomainIds.length > 0) ||
    (Array.isArray(admin.managedHalls) && admin.managedHalls.length > 0) ||
    (Array.isArray(admin.managedFaculties) && admin.managedFaculties.length > 0) ||
    (Array.isArray(admin.managedDepartments) && admin.managedDepartments.length > 0);
  return !hasScopedRestrictions;
}

export type BulkElectionDisposition =
  | 'delete'
  | 'detach_archive'
  | 'blocked_live'
  | 'skip_historical';

export interface BulkElectionInspectionItem {
  election: Election;
  source: 'firestore' | 'builtin_only';
  positionsCount: number;
  candidatesCount: number;
  assignmentsCount: number;
  authorisationsCount: number;
  confirmationsCount: number;
  ballotsCount: number;
  candidateVotesTotal: number;
  hasExistingResultsDoc: boolean;
  hasPublishedResults: boolean;
  resultsCertified: boolean;
  votingRecordsExist: boolean;
  eligibility: ElectionRemovalEligibility;
  protectedRecords: string[];
}

export interface BulkPlannedElectionItem extends BulkElectionInspectionItem {
  disposition: BulkElectionDisposition;
  reason: string;
}

export interface BulkRemovalPlanSummary {
  totalFound: number;
  deletableCount: number;
  detachArchiveCount: number;
  blockedLiveCount: number;
  skippedHistoricalCount: number;
  withVotingRecordsCount: number;
  totalPositionsCount: number;
  totalCandidatesCount: number;
  canProceedWithoutDetachingProtected: boolean;
  hasLiveBlockers: boolean;
  items: BulkPlannedElectionItem[];
}

export function collectProtectedRecordLabels(
  item: Pick<
    BulkElectionInspectionItem,
    | 'election'
    | 'ballotsCount'
    | 'authorisationsCount'
    | 'confirmationsCount'
    | 'candidateVotesTotal'
    | 'hasPublishedResults'
    | 'resultsCertified'
  >
): string[] {
  const labels: string[] = [];
  const totalVotes = Math.max(0, Number(item.election.totalVotesCast) || 0);
  if (item.election.isHistorical) {
    labels.push('Historical institutional archive record');
  }
  if (totalVotes > 0 || item.ballotsCount > 0) {
    labels.push(
      item.ballotsCount > 0
        ? `Anonymous ballots (${item.ballotsCount}+ recorded)`
        : `Recorded cast ballots (${totalVotes})`
    );
  }
  if (item.authorisationsCount > 0) {
    labels.push(`Voter authorisations (${item.authorisationsCount})`);
  }
  if (item.confirmationsCount > 0) {
    labels.push(`Vote confirmation receipts (${item.confirmationsCount})`);
  }
  if (item.candidateVotesTotal > 0) {
    labels.push(`Candidate vote tallies (${item.candidateVotesTotal})`);
  }
  if (item.hasPublishedResults || item.resultsCertified) {
    labels.push(
      item.resultsCertified ? 'Certified election results' : 'Published election results'
    );
  }
  return labels;
}

export function classifyElectionForBulkRemoval(
  item: BulkElectionInspectionItem,
  options: { includeHistorical: boolean }
): BulkPlannedElectionItem {
  const protectedRecords =
    item.protectedRecords.length > 0
      ? item.protectedRecords
      : collectProtectedRecordLabels(item);

  if (item.election.isHistorical) {
    if (!options.includeHistorical) {
      return {
        ...item,
        protectedRecords,
        disposition: 'skip_historical',
        reason:
          'Historical record preserved (not selected for removal from the active directory).',
      };
    }
    return {
      ...item,
      protectedRecords,
      disposition: 'detach_archive',
      reason:
        'Historical records are preserved; election will be archived/detached from the active directory without destroying records.',
    };
  }

  if (item.election.status === 'live') {
    return {
      ...item,
      protectedRecords,
      disposition: 'blocked_live',
      reason: item.votingRecordsExist
        ? 'Election is currently LIVE and has recorded voting records. Close voting before archival/detachment.'
        : 'Election is currently LIVE. Close or cancel voting before removing or detaching this election.',
    };
  }

  if (item.votingRecordsExist) {
    return {
      ...item,
      protectedRecords,
      disposition: 'detach_archive',
      reason:
        'Protected voting records or published/certified results exist. Permanent deletion is blocked; archive and detach from active directory while preserving ballots, confirmations, receipts, and results.',
    };
  }

  return {
    ...item,
    protectedRecords,
    disposition: 'delete',
    reason:
      item.source === 'builtin_only'
        ? 'Zero voting records exist. Safe to remove from active directory configuration.'
        : 'Zero ballots, authorisations, confirmations, or published results exist. Safe to permanently remove election, positions, candidate participations, assignments, and unpublished result drafts.',
  };
}

export function buildBulkRemovalPlan(
  items: BulkElectionInspectionItem[],
  options: { includeHistorical: boolean }
): BulkRemovalPlanSummary {
  const planned = items.map((item) => classifyElectionForBulkRemoval(item, options));
  const deletableCount = planned.filter((i) => i.disposition === 'delete').length;
  const detachArchiveCount = planned.filter((i) => i.disposition === 'detach_archive').length;
  const blockedLiveCount = planned.filter((i) => i.disposition === 'blocked_live').length;
  const skippedHistoricalCount = planned.filter(
    (i) => i.disposition === 'skip_historical'
  ).length;
  const withVotingRecordsCount = planned.filter((i) => i.votingRecordsExist).length;

  return {
    totalFound: planned.length,
    deletableCount,
    detachArchiveCount,
    blockedLiveCount,
    skippedHistoricalCount,
    withVotingRecordsCount,
    totalPositionsCount: planned.reduce((sum, i) => sum + i.positionsCount, 0),
    totalCandidatesCount: planned.reduce((sum, i) => sum + i.candidatesCount, 0),
    canProceedWithoutDetachingProtected:
      blockedLiveCount === 0 &&
      planned.every((i) => i.disposition === 'delete' || i.disposition === 'skip_historical'),
    hasLiveBlockers: blockedLiveCount > 0,
    items: planned,
  };
}

export function applyDirectoryVisibilityFilter(
  elections: Election[],
  hiddenBuiltInElectionIds: string[] = [],
  firestoreElectionIds?: Set<string>
): Election[] {
  const hiddenSet = new Set(hiddenBuiltInElectionIds);
  return elections.filter((el) => {
    if (el.hiddenFromDirectory === true) return false;
    if (hiddenSet.has(el.id)) {
      if (!firestoreElectionIds || !firestoreElectionIds.has(el.id)) {
        return false;
      }
      if (el.status === 'archived') {
        return false;
      }
    }
    return true;
  });
}

