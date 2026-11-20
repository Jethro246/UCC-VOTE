import { Candidate, Election, Position } from '../types';

export const SRC_2027_ELECTION_ID = 'elec_2027_src';
export const SRC_2027_ELECTION_CODE = 'UCC-SRC-2027';

export const SRC_2027_ELECTION: Election = {
  id: SRC_2027_ELECTION_ID,
  title: 'UCC SRC General Elections 2027',
  code: SRC_2027_ELECTION_CODE,
  description:
    'Official University of Cape Coast Students’ Representative Council (SRC) General Elections for 2027 covering seven executive portfolios and 17 contestants.',
  category: 'SRC',
  domainId: 'src',
  subdomainLabel: 'University-Wide Undergraduate Executive',
  academicYear: '2027',
  status: 'draft',
  isPublished: true,
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  totalEligibleVoters: 0,
  totalVotesCast: 0,
  turnoutPercentage: 0,
  organizingBody: 'UCC Electoral Commission',
  eligibilityCriteria: {
    levels: ['100', '200', '300', '400'],
  },
  rules: [
    'One verified UCC undergraduate student, one anonymous electronic ballot.',
    'Voting opens only after polling dates and activation are authorised by the UCC Electoral Commission.',
    'All seven SRC executive portfolios and 17 contestants start with zero votes.',
  ],
  positionsCount: 7,
  resultsCertified: false,
  provisionalResultsReady: false,
  isHistorical: false,
  candidateListStatus: 'complete',
  tallyAvailable: true,
  createdAt: '2026-11-19T00:00:00.000Z',
  updatedAt: '2026-11-19T00:00:00.000Z',
};

export const SRC_2027_POSITIONS: Position[] = [
  {
    id: 'pos_2027_src_president',
    electionId: SRC_2027_ELECTION_ID,
    domainId: 'src',
    title: 'SRC President',
    description:
      'Executive Head and Chief Spokesperson of the UCC Students’ Representative Council.',
    maxSelections: 1,
    allowsSkip: true,
    order: 1,
    candidateIds: [
      'cand_2027_src_emmanuel_acheampong_nana_adjei',
      'cand_2027_src_richard_agyemang',
    ],
  },
  {
    id: 'pos_2027_src_vice_president',
    electionId: SRC_2027_ELECTION_ID,
    domainId: 'src',
    title: 'SRC Vice President',
    description:
      'Deputy Executive Officer of the UCC Students’ Representative Council.',
    maxSelections: 1,
    allowsSkip: true,
    order: 2,
    candidateIds: ['cand_2027_src_regina_yayra_adenyo'],
  },
  {
    id: 'pos_2027_src_general_secretary',
    electionId: SRC_2027_ELECTION_ID,
    domainId: 'src',
    title: 'SRC General Secretary',
    description:
      'Chief Administrative and Records Officer of the UCC Students’ Representative Council.',
    maxSelections: 1,
    allowsSkip: true,
    order: 3,
    candidateIds: [
      'cand_2027_src_benedicta_tiwaa_danso',
      'cand_2027_src_hawawu_abdulai_kiejembu',
    ],
  },
  {
    id: 'pos_2027_src_treasurer',
    electionId: SRC_2027_ELECTION_ID,
    domainId: 'src',
    title: 'SRC Treasurer',
    description:
      'Chief Financial Custodian of the UCC Students’ Representative Council.',
    maxSelections: 1,
    allowsSkip: true,
    order: 4,
    candidateIds: [
      'cand_2027_src_nuhu_dauda',
      'cand_2027_src_isaac_aidoo',
      'cand_2027_src_emmanuel_wonders_koku',
    ],
  },
  {
    id: 'pos_2027_src_pro',
    electionId: SRC_2027_ELECTION_ID,
    domainId: 'src',
    title: 'SRC Public Relations Officer',
    description:
      'Official Communications and Student Information Officer of the UCC Students’ Representative Council.',
    maxSelections: 1,
    allowsSkip: true,
    order: 5,
    candidateIds: [
      'cand_2027_src_elisha_mensah_kojo_jnr',
      'cand_2027_src_gideon_kwadwo_adade',
      'cand_2027_src_eric_darlington_anku',
    ],
  },
  {
    id: 'pos_2027_src_coordinating_secretary',
    electionId: SRC_2027_ELECTION_ID,
    domainId: 'src',
    title: 'SRC Coordinating Secretary',
    description:
      'Inter-Hall, Faculty, and Welfare Coordination Executive of the UCC Students’ Representative Council.',
    maxSelections: 1,
    allowsSkip: true,
    order: 6,
    candidateIds: [
      'cand_2027_src_adwoa_asima_agbehiam',
      'cand_2027_src_winnifred_cobbinah',
      'cand_2027_src_bridget_amoah',
      'cand_2027_src_ernestina_netty',
    ],
  },
  {
    id: 'pos_2027_src_sports_secretary',
    electionId: SRC_2027_ELECTION_ID,
    domainId: 'src',
    title: 'SRC General Sports Secretary',
    description:
      'Director of Student Athletics, Sports, and Intramural Competitions of the UCC Students’ Representative Council.',
    maxSelections: 1,
    allowsSkip: true,
    order: 7,
    candidateIds: [
      'cand_2027_src_emmanuel_essel',
      'cand_2027_src_felix_kwabla_akpakli',
    ],
  },
];

interface Src2027ContestantSeed {
  id: string;
  positionId: string;
  fullName: string;
}

const SRC_2027_CONTESTANT_SEEDS: Src2027ContestantSeed[] = [
  // Portfolio 1: SRC President
  {
    id: 'cand_2027_src_emmanuel_acheampong_nana_adjei',
    positionId: 'pos_2027_src_president',
    fullName: 'Emmanuel Acheampong Nana Adjei',
  },
  {
    id: 'cand_2027_src_richard_agyemang',
    positionId: 'pos_2027_src_president',
    fullName: 'Richard Agyemang',
  },
  // Portfolio 2: SRC Vice President
  {
    id: 'cand_2027_src_regina_yayra_adenyo',
    positionId: 'pos_2027_src_vice_president',
    fullName: 'Regina Yayra Adenyo',
  },
  // Portfolio 3: SRC General Secretary
  {
    id: 'cand_2027_src_benedicta_tiwaa_danso',
    positionId: 'pos_2027_src_general_secretary',
    fullName: 'Benedicta Tiwaa Danso',
  },
  {
    id: 'cand_2027_src_hawawu_abdulai_kiejembu',
    positionId: 'pos_2027_src_general_secretary',
    fullName: 'Hawawu Abdulai Kiejembu',
  },
  // Portfolio 4: SRC Treasurer
  {
    id: 'cand_2027_src_nuhu_dauda',
    positionId: 'pos_2027_src_treasurer',
    fullName: 'Nuhu Dauda',
  },
  {
    id: 'cand_2027_src_isaac_aidoo',
    positionId: 'pos_2027_src_treasurer',
    fullName: 'Isaac Aidoo',
  },
  {
    id: 'cand_2027_src_emmanuel_wonders_koku',
    positionId: 'pos_2027_src_treasurer',
    fullName: 'Emmanuel Wonders Koku',
  },
  // Portfolio 5: SRC Public Relations Officer
  {
    id: 'cand_2027_src_elisha_mensah_kojo_jnr',
    positionId: 'pos_2027_src_pro',
    fullName: 'Elisha Mensah Kojo Jnr',
  },
  {
    id: 'cand_2027_src_gideon_kwadwo_adade',
    positionId: 'pos_2027_src_pro',
    fullName: 'Gideon Kwadwo Adade',
  },
  {
    id: 'cand_2027_src_eric_darlington_anku',
    positionId: 'pos_2027_src_pro',
    fullName: 'Eric Darlington Anku',
  },
  // Portfolio 6: SRC Coordinating Secretary
  {
    id: 'cand_2027_src_adwoa_asima_agbehiam',
    positionId: 'pos_2027_src_coordinating_secretary',
    fullName: 'Adwoa Asima Agbehiam',
  },
  {
    id: 'cand_2027_src_winnifred_cobbinah',
    positionId: 'pos_2027_src_coordinating_secretary',
    fullName: 'Winnifred Cobbinah',
  },
  {
    id: 'cand_2027_src_bridget_amoah',
    positionId: 'pos_2027_src_coordinating_secretary',
    fullName: 'Bridget Amoah',
  },
  {
    id: 'cand_2027_src_ernestina_netty',
    positionId: 'pos_2027_src_coordinating_secretary',
    fullName: 'Ernestina Netty',
  },
  // Portfolio 7: SRC General Sports Secretary
  {
    id: 'cand_2027_src_emmanuel_essel',
    positionId: 'pos_2027_src_sports_secretary',
    fullName: 'Emmanuel Essel',
  },
  {
    id: 'cand_2027_src_felix_kwabla_akpakli',
    positionId: 'pos_2027_src_sports_secretary',
    fullName: 'Felix Kwabla Akpakli',
  },
];

function seedTo2027Candidate(seed: Src2027ContestantSeed): Candidate {
  return {
    id: seed.id,
    electionId: SRC_2027_ELECTION_ID,
    positionId: seed.positionId,
    domainId: 'src',
    fullName: seed.fullName,
    studentId: 'Pending EC Verification',
    department: 'Not verified',
    faculty: 'Not verified',
    programme: '',
    level: 'Not verified',
    hall: 'Not verified',
    photoUrl: '',
    biography: '',
    manifestoSummary: '',
    fullManifesto: [],
    keyPromises: [],
    leadershipExperience: [],
    applicationStatus: 'Approved',
    eligibilityVerified: true,
    votesReceived: 0,
    isHistoricalRecord: false,
    profileDataStatus: 'complete',
    submittedAt: '2026-11-19T00:00:00.000Z',
  };
}

export const SRC_2027_CANDIDATES: Candidate[] =
  SRC_2027_CONTESTANT_SEEDS.map(seedTo2027Candidate);

export function mergeSrc2027Elections(elections: Election[]): Election[] {
  const byId = new Map<string, Election>();
  byId.set(SRC_2027_ELECTION.id, SRC_2027_ELECTION);
  elections.forEach((e) => byId.set(e.id, e));
  return Array.from(byId.values());
}

export function mergeSrc2027Positions(
  grouped: Record<string, Position[]>
): Record<string, Position[]> {
  const merged: Record<string, Position[]> = {};
  const byId = new Map<string, Position>();

  SRC_2027_POSITIONS.forEach((p) => byId.set(p.id, p));
  Object.values(grouped).forEach((arr) => {
    arr.forEach((p) => byId.set(p.id, p));
  });

  byId.forEach((pos) => {
    if (!merged[pos.electionId]) merged[pos.electionId] = [];
    merged[pos.electionId].push(pos);
  });

  Object.values(merged).forEach((arr) =>
    arr.sort((a, b) => (a.order || 0) - (b.order || 0))
  );

  return merged;
}

export function mergeSrc2027Candidates(candidates: Candidate[]): Candidate[] {
  const byId = new Map<string, Candidate>();
  SRC_2027_CANDIDATES.forEach((c) => byId.set(c.id, c));
  candidates.forEach((c) => byId.set(c.id, c));
  return Array.from(byId.values());
}

export function getSrc2027ElectionById(id: string): Election | undefined {
  return id === SRC_2027_ELECTION_ID ? SRC_2027_ELECTION : undefined;
}

export function getSrc2027PositionsByElectionId(electionId: string): Position[] {
  return electionId === SRC_2027_ELECTION_ID
    ? [...SRC_2027_POSITIONS].sort((a, b) => a.order - b.order)
    : [];
}

export function getSrc2027CandidateById(id: string): Candidate | undefined {
  return SRC_2027_CANDIDATES.find((c) => c.id === id);
}
