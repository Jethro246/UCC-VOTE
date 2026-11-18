import type { Candidate, Election, HallUnit, StudentProfile, VoterEligibilityRecord } from '../types';
import { UCC_HALLS } from '../data/uccStructure';

export const UNVERIFIED_HALL_MESSAGE =
  'Your hall affiliation could not be verified. Please contact the appropriate administrator.';

export const NON_RESIDENT_HALL_LABEL = 'Non-Resident / Off-Campus';

export function normalizeHallText(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Matches a student's or candidate's registered hall against a target hall name, ID, code, or recognized alias.
 * Carefully isolates 'SRC Hall' / 'SRC Hostel' so university-wide 'SRC' never falsely matches a residential hall,
 * and ensures unverified affiliations (e.g., 'Off-Campus Private Hostel', 'Non-Resident / Off-Campus') never resolve to an official hall.
 */
export function matchesHallAffiliation(
  studentHall: string | undefined,
  targetHall: string | undefined,
  hallUnit?: Pick<HallUnit, 'id' | 'code' | 'name' | 'shortName' | 'displayName'>
): boolean {
  const s = normalizeHallText(studentHall);
  const t = normalizeHallText(targetHall);
  if (!s) return false;

  if (hallUnit) {
    if (s === normalizeHallText(hallUnit.id)) return true;
    if (hallUnit.code && s === normalizeHallText(hallUnit.code)) return true;
    if (hallUnit.displayName && s === normalizeHallText(hallUnit.displayName)) return true;
  }

  if (!t) return false;
  if (s === t) return true;

  if (hallUnit) {
    if (t === normalizeHallText(hallUnit.id) && matchesHallAffiliation(studentHall, hallUnit.name)) {
      return true;
    }
    if (hallUnit.code && t === normalizeHallText(hallUnit.code) && matchesHallAffiliation(studentHall, hallUnit.name)) {
      return true;
    }
  }

  const sClean = s.replace(/\bhall\b/g, '').trim();
  const tClean = t.replace(/\bhall\b/g, '').trim();
  if (sClean && tClean && sClean === tClean && sClean !== 'src' && sClean !== 'non-resident / off-campus') {
    return true;
  }

  // 1. Adehye Hall
  const isAdehye = (val: string) =>
    val.includes('adehye') || val === 'adh' || val === 'hall-adehye' || val === 'hall-ade';
  if (isAdehye(s) && isAdehye(t)) {
    return true;
  }

  // 2. Atlantic Hall (ATL)
  const isAtlantic = (val: string) =>
    val.includes('atlantic') || val === 'atl' || val === 'hall-atlantic' || val === 'hall-atl';
  if (isAtlantic(s) && isAtlantic(t)) {
    return true;
  }

  // 3. Casely Hayford Hall (Casford)
  const isCasford = (val: string) =>
    val.includes('casford') ||
    val.includes('casely hayford') ||
    val === 'chf' ||
    val === 'hall-casford' ||
    val === 'hall-cas';
  if (isCasford(s) && isCasford(t)) {
    return true;
  }

  // 4. Kwame Nkrumah Hall (KNH)
  const isNkrumah = (val: string) =>
    val.includes('kwame nkrumah') ||
    val === 'knh' ||
    val === 'hall-knh' ||
    val === 'hall-nkrumah';
  if (isNkrumah(s) && isNkrumah(t)) {
    return true;
  }

  // 5. Oguaa Hall
  const isOguaa = (val: string) =>
    val.includes('oguaa') || val === 'ogu' || val === 'hall-oguaa' || val === 'hall-ogu';
  if (isOguaa(s) && isOguaa(t)) {
    return true;
  }

  // 6. Valco Hall
  const isValco = (val: string) =>
    val.includes('valco') || val === 'vlc' || val === 'hall-valco' || val === 'hall-val';
  if (isValco(s) && isValco(t)) {
    return true;
  }

  // 7. SRC Hall (explicitly require 'src hall', 'src hostel', 'srh', 'hall-src' — never bare 'src')
  const isSrcHall = (val: string) =>
    val === 'src hall' ||
    val === 'src hostel' ||
    val === 'srh' ||
    val === 'hall-src' ||
    val === 'hall_src';
  if (isSrcHall(s) && isSrcHall(t)) {
    return true;
  }

  // 8. Superannuation Hall (Super Hall) — also maps legacy 'Superannuation Hostel'
  const isSuperHall = (val: string) =>
    val.includes('superannuation') ||
    val === 'super hall' ||
    val === 'super' ||
    val === 'sup' ||
    val === 'hall-superannuation' ||
    val === 'hall-super' ||
    val === 'hall-sup';
  if (isSuperHall(s) && isSuperHall(t)) {
    return true;
  }

  return false;
}

export function findMatchingHallUnit(
  hallNameOrId: string | undefined,
  halls: HallUnit[] = UCC_HALLS
): HallUnit | undefined {
  if (!hallNameOrId || !hallNameOrId.trim()) return undefined;
  const q = normalizeHallText(hallNameOrId);
  return halls.find(
    (h) =>
      normalizeHallText(h.id) === q ||
      (h.code && normalizeHallText(h.code) === q) ||
      (h.displayName && normalizeHallText(h.displayName) === q) ||
      matchesHallAffiliation(hallNameOrId, h.name, h) ||
      matchesHallAffiliation(hallNameOrId, h.shortName, h)
  );
}

export function isOfficialHallAffiliation(
  hallNameOrId: string | undefined,
  halls: HallUnit[] = UCC_HALLS
): boolean {
  if (!hallNameOrId || !hallNameOrId.trim()) return false;
  const norm = normalizeHallText(hallNameOrId);
  if (norm === 'non-resident / off-campus' || norm === 'non-resident' || norm === 'off-campus') {
    return false;
  }
  return Boolean(findMatchingHallUnit(hallNameOrId, halls));
}

export function getHallDisplayName(hall?: Pick<HallUnit, 'name' | 'shortName' | 'displayName'>): string {
  if (!hall) return '';
  if (hall.displayName) return hall.displayName;
  if (
    hall.shortName &&
    normalizeHallText(hall.shortName) !== normalizeHallText(hall.name) &&
    !normalizeHallText(hall.name).includes(normalizeHallText(hall.shortName))
  ) {
    return `${hall.name} (${hall.shortName})`;
  }
  return hall.name;
}

export function resolveElectionHallUnit(
  election: Pick<Election, 'domainId' | 'category' | 'hallId' | 'subdomainLabel' | 'eligibilityCriteria' | 'title'>,
  halls: HallUnit[] = UCC_HALLS
): HallUnit | undefined {
  if (election.hallId) {
    const byId = findMatchingHallUnit(election.hallId, halls);
    if (byId) return byId;
  }
  const criteriaHalls = election.eligibilityCriteria?.halls || [];
  for (const h of criteriaHalls) {
    const found = findMatchingHallUnit(h, halls);
    if (found) return found;
  }
  if (election.subdomainLabel) {
    const bySubdomain = findMatchingHallUnit(election.subdomainLabel, halls);
    if (bySubdomain) return bySubdomain;
  }
  return undefined;
}

export function isElectionForHall(
  election: Pick<Election, 'domainId' | 'category' | 'hallId' | 'subdomainLabel' | 'eligibilityCriteria' | 'title'>,
  hall: HallUnit,
  allHalls: HallUnit[] = UCC_HALLS
): boolean {
  const isHallDomain = election.domainId === 'jcrc_hall' || election.category === 'JCR / Hall';
  if (!isHallDomain) return false;
  if (election.hallId && matchesHallAffiliation(election.hallId, hall.name, hall)) return true;
  if (election.subdomainLabel && matchesHallAffiliation(election.subdomainLabel, hall.name, hall)) return true;
  const criteriaHalls = election.eligibilityCriteria?.halls || [];
  if (criteriaHalls.some((h) => matchesHallAffiliation(h, hall.name, hall))) return true;
  const resolved = resolveElectionHallUnit(election, allHalls);
  return Boolean(resolved && resolved.id === hall.id);
}

export interface HallMetricsSummary {
  electionsCount: number;
  liveElectionsCount: number;
  scheduledElectionsCount: number;
  publishedResultsCount: number;
  approvedCandidatesCount: number;
  totalCandidatesCount: number;
  eligibleVotersCount: number;
  votesCast: number;
  turnoutPercentage: number;
}

export function computeHallMetrics(
  hall: HallUnit,
  allHalls: HallUnit[],
  elections: Election[],
  candidates: Candidate[],
  students: StudentProfile[] = [],
  eligibilityRecords: VoterEligibilityRecord[] = []
): HallMetricsSummary {
  const hallElections = elections.filter((el) => isElectionForHall(el, hall, allHalls));
  const hallElectionIds = new Set(hallElections.map((e) => e.id));

  const hallCandidates = candidates.filter(
    (c) =>
      hallElectionIds.has(c.electionId) ||
      (c.hallId ? matchesHallAffiliation(c.hallId, hall.name, hall) : false)
  );
  const approvedCandidatesCount = hallCandidates.filter(
    (c) => c.applicationStatus === 'Approved'
  ).length;

  // Compute genuine votes cast strictly from election records; default to 0 when unused
  const votesCast = hallElections.reduce((acc, el) => acc + (Number(el.totalVotesCast) || 0), 0);

  // Eligible voters: use max across hall voter_eligibility records, verified students, or election totalEligibleVoters
  const eligIds = new Set<string>();
  eligibilityRecords.forEach((rec) => {
    if (
      rec.isEligible &&
      rec.status === 'eligible' &&
      matchesHallAffiliation(rec.hall, hall.name, hall)
    ) {
      eligIds.add(rec.uid || rec.studentId || rec.id);
    }
  });
  students.forEach((st) => {
    if (
      st.isEligible &&
      st.eligibilityStatus !== 'suspended' &&
      st.eligibilityStatus !== 'ineligible' &&
      matchesHallAffiliation(st.hall, hall.name, hall)
    ) {
      eligIds.add(st.uid || st.studentId || st.id);
    }
  });
  const electionReportedEligible = hallElections.reduce(
    (max, el) => Math.max(max, Number(el.totalEligibleVoters) || 0),
    0
  );
  const eligibleVotersCount = Math.max(eligIds.size, electionReportedEligible);

  const turnoutPercentage =
    eligibleVotersCount > 0 && votesCast > 0
      ? Number(Math.min(100, (votesCast / eligibleVotersCount) * 100).toFixed(1))
      : 0;

  return {
    electionsCount: hallElections.length,
    liveElectionsCount: hallElections.filter((e) => e.status === 'live').length,
    scheduledElectionsCount: hallElections.filter(
      (e) => e.status === 'scheduled' || e.status === 'upcoming'
    ).length,
    publishedResultsCount: hallElections.filter((e) => e.status === 'results_published').length,
    approvedCandidatesCount,
    totalCandidatesCount: hallCandidates.length,
    eligibleVotersCount,
    votesCast,
    turnoutPercentage,
  };
}

