import { categoryToDomainId } from '../data/uccStructure';
import type { DomainId, Election, ElectionStatus } from '../types';

export interface ElectionStatusMeta {
  status: ElectionStatus;
  label: string;
  tone: 'neutral' | 'amber' | 'sky' | 'emerald' | 'rose' | 'indigo' | 'slate';
  isPublishedToStudents: boolean;
  isOpenForVoting: boolean;
  hasResults: boolean;
}

const HIDDEN_STATUSES = new Set<string>(['draft', 'pending_approval', 'cancelled']);

export function getElectionDomainId(
  election?: Pick<Election, 'domainId' | 'category'> | null
): DomainId {
  if (!election) return 'src';
  return election.domainId || categoryToDomainId(election.category);
}

/**
 * Determines whether an election should be visible to ordinary students and guests.
 * Draft, pending approval, cancelled, or explicitly unpublished (`isPublished === false`)
 * elections remain hidden in the Admin Console until published.
 */
export function isElectionPublishedToStudents(
  election?: Pick<Election, 'status' | 'isPublished'> | null
): boolean {
  if (!election) return false;
  if (election.isPublished === false) return false;
  return !HIDDEN_STATUSES.has(String(election.status || 'draft'));
}

export function getElectionStatusMeta(
  electionOrStatus?: Pick<Election, 'status' | 'isPublished'> | ElectionStatus | string | null
): ElectionStatusMeta {
  const status = (
    typeof electionOrStatus === 'string'
      ? electionOrStatus
      : electionOrStatus?.status || 'draft'
  ) as ElectionStatus;

  const explicitlyUnpublished =
    typeof electionOrStatus === 'object' &&
    electionOrStatus !== null &&
    electionOrStatus.isPublished === false;

  const isPublishedToStudents = !explicitlyUnpublished && !HIDDEN_STATUSES.has(status);

  switch (status) {
    case 'draft':
      return {
        status,
        label: 'Draft',
        tone: 'slate',
        isPublishedToStudents: false,
        isOpenForVoting: false,
        hasResults: false,
      };
    case 'pending_approval':
      return {
        status,
        label: 'Pending Approval',
        tone: 'amber',
        isPublishedToStudents: false,
        isOpenForVoting: false,
        hasResults: false,
      };
    case 'scheduled':
    case 'upcoming':
      return {
        status,
        label: 'Upcoming',
        tone: 'sky',
        isPublishedToStudents,
        isOpenForVoting: false,
        hasResults: false,
      };
    case 'live':
      return {
        status,
        label: 'Active',
        tone: 'emerald',
        isPublishedToStudents,
        isOpenForVoting: isPublishedToStudents,
        hasResults: false,
      };
    case 'suspended':
      return {
        status,
        label: 'Suspended',
        tone: 'rose',
        isPublishedToStudents,
        isOpenForVoting: false,
        hasResults: false,
      };
    case 'closed':
      return {
        status,
        label: 'Closed',
        tone: 'amber',
        isPublishedToStudents,
        isOpenForVoting: false,
        hasResults: false,
      };
    case 'results_pending_certification':
      return {
        status,
        label: 'Results Pending',
        tone: 'indigo',
        isPublishedToStudents,
        isOpenForVoting: false,
        hasResults: true,
      };
    case 'results_published':
      return {
        status,
        label: 'Results Published',
        tone: 'emerald',
        isPublishedToStudents,
        isOpenForVoting: false,
        hasResults: true,
      };
    case 'cancelled':
      return {
        status,
        label: 'Cancelled',
        tone: 'rose',
        isPublishedToStudents: false,
        isOpenForVoting: false,
        hasResults: false,
      };
    case 'archived':
      return {
        status,
        label: 'Archived',
        tone: 'neutral',
        isPublishedToStudents,
        isOpenForVoting: false,
        hasResults: true,
      };
    default:
      return {
        status: 'draft',
        label: 'Draft',
        tone: 'slate',
        isPublishedToStudents: false,
        isOpenForVoting: false,
        hasResults: false,
      };
  }
}

export function getStatusBadgeClasses(tone: ElectionStatusMeta['tone']): string {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'sky':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'amber':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'rose':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'indigo':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'slate':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }
}
