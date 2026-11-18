import type { Election } from '../types';

export function formatElectionDate(
  isoOrDate: string | undefined,
  fallback = 'Not recorded',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  if (!isoOrDate || !isoOrDate.trim()) return fallback;
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString('en-GB', options);
}

export function formatElectionWindow(
  election: Pick<Election, 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'isHistorical' | 'status'>
): string {
  const hasStart = Boolean(election.startDate && !Number.isNaN(new Date(election.startDate).getTime()));
  const hasEnd = Boolean(election.endDate && !Number.isNaN(new Date(election.endDate).getTime()));
  if (!hasStart && !hasEnd) {
    return election.isHistorical || election.status === 'archived'
      ? 'Historical Record · Polling dates not recorded'
      : 'Dates pending schedule';
  }
  const startLabel = hasStart
    ? formatElectionDate(election.startDate, 'Not recorded', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not recorded';
  const endLabel = hasEnd
    ? formatElectionDate(election.endDate, 'Not recorded', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not recorded';
  return `${startLabel} – ${endLabel}`;
}
