import {
  Candidate,
  CandidateResultRow,
  Election,
  ElectionResultsPayload,
  Position,
  PositionResultSummary,
} from '../types';
import { UCC_HALLS } from './uccStructure';

export const HISTORICAL_2026_ELECTIONS: Election[] = [
  {
    id: 'elec_2026_src',
    title: 'UCC SRC General Elections 2026',
    code: 'UCC-SRC-2026',
    description:
      'Historical 2026 University of Cape Coast Students’ Representative Council (SRC) General Elections archive covering 7 executive portfolios, 17 contestants, and the 7 declared portfolio winners.',
    category: 'SRC',
    domainId: 'src',
    subdomainLabel: 'University-Wide Undergraduate Executive',
    academicYear: '2026',
    status: 'archived',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    totalEligibleVoters: 0,
    totalVotesCast: 0,
    turnoutPercentage: 0,
    organizingBody: 'UCC Electoral Commission (Historical 2026 Archive)',
    eligibilityCriteria: {
      levels: ['100', '200', '300', '400'],
    },
    rules: [
      'Historical 2026 election archive — preserved in read-only non-votable state.',
      'All 7 SRC portfolios, 17 verified contestants, and 7 portfolio winners are recorded from available 2026 electoral records.',
      'Detailed ballot vote tallies, timestamps, and candidate biographies/manifestos are pending historical verification or admin input.',
    ],
    positionsCount: 7,
    resultsCertified: false,
    provisionalResultsReady: true,
    isHistorical: true,
    candidateListStatus: 'complete',
    tallyAvailable: false,
    historicalNote:
      'Complete 2026 SRC portfolio winners and contestant list verified (7 positions, 17 contestants, 7 winners). Vote count breakdown, election dates, photos, and manifestos were not recorded in the source archive.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'elec_2026_grasag',
    title: 'GRASAG-UCC Elections 2026/2027',
    code: 'GRASAG-UCC-2026',
    description:
      'Historical 2026/2027 Graduate Students’ Association of Ghana (GRASAG-UCC) election record listing the 8 elected postgraduate executive officers.',
    category: 'GRASAG',
    domainId: 'grasag',
    subdomainLabel: 'Postgraduate Student Governance',
    academicYear: '2026/2027',
    status: 'archived',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    totalEligibleVoters: 0,
    totalVotesCast: 0,
    turnoutPercentage: 0,
    organizingBody: 'GRASAG-UCC Electoral Committee (Historical 2026/2027 Archive)',
    eligibilityCriteria: {
      levels: ['Postgraduate'],
    },
    rules: [
      'Historical 2026/2027 election archive — preserved in read-only non-votable state.',
      'Important Historical Notice: This record lists the 8 elected GRASAG-UCC executives only; the complete list of losing/other contestants has not been verified.',
      'Authorized administrators may add verified contestants, photographs, manifestos, and tallies if official archive documents become available.',
    ],
    positionsCount: 8,
    resultsCertified: false,
    provisionalResultsReady: true,
    isHistorical: true,
    candidateListStatus: 'elected_executives_only',
    tallyAvailable: false,
    historicalNote:
      'Elected executives only: These 8 names represent the elected GRASAG-UCC executive officers for 2026/2027, NOT a verified full contestant list.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'elec_2026_local_nugs',
    title: 'Local NUGS Elections 2026',
    code: 'LOCAL-NUGS-2026',
    description:
      'Historical 2026 Local National Union of Ghana Students (Local NUGS–UCC) election record with incomplete contestant history noted transparently.',
    category: 'Local NUGS',
    domainId: 'local_nugs',
    subdomainLabel: 'UCC Local Secretariat',
    academicYear: '2026',
    status: 'archived',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    totalEligibleVoters: 0,
    totalVotesCast: 0,
    turnoutPercentage: 0,
    organizingBody: 'Local NUGS-UCC Electoral Committee (Historical 2026 Archive)',
    eligibilityCriteria: {
      levels: ['100', '200', '300', '400', 'Postgraduate'],
    },
    rules: [
      'Historical 2026 election archive — preserved in read-only non-votable state.',
      'Presidential contest note: Samuel Adjei Anderson was elected President; five additional contestants were reportedly involved, but their names have not been verified.',
      'Women’s Commissioner note: Christabel Adjokatcher was elected unopposed.',
    ],
    positionsCount: 2,
    resultsCertified: false,
    provisionalResultsReady: true,
    isHistorical: true,
    candidateListStatus: 'partial_contestants_unverified',
    unverifiedContestantsCount: 5,
    tallyAvailable: false,
    historicalNote:
      'Incomplete contestant list: Samuel Adjei Anderson was elected President alongside 5 additional unverified contestants (names omitted rather than fabricated); Christabel Adjokatcher was elected unopposed as Women’s Commissioner.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'elec_2026_jcrc_hall_2026',
    title: 'UCC Hall / JCRC Elections 2026',
    code: 'UCC-JCRC-2026',
    description:
      'Historical 2026 Junior Common Room (JCRC) Hall Elections framework across all 8 official UCC halls of residence, ready for administrators to record verified hall positions, candidates, manifestos, photos, and outcomes.',
    category: 'JCR / Hall',
    domainId: 'jcrc_hall',
    subdomainLabel: 'All 8 Official UCC Halls (Awaiting Hall Records)',
    academicYear: '2026',
    status: 'archived',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    totalEligibleVoters: 0,
    totalVotesCast: 0,
    turnoutPercentage: 0,
    organizingBody: 'Hall Electoral Committees & UCC Electoral Commission (2026 Framework)',
    eligibilityCriteria: {
      levels: ['100', '200', '300', '400'],
      halls: UCC_HALLS.map((h) => h.name),
    },
    rules: [
      'Historical 2026 framework record covering all 8 official UCC halls: Adehye Hall, Atlantic Hall, Casely Hayford Hall (Casford), Kwame Nkrumah Hall (KNH), Oguaa Hall, Valco Hall, SRC Hall, and Superannuation Hall (Super Hall).',
      'No candidate names or contested positions have been invented for any hall.',
      'Authorized administrators can create separate hall-specific elections or add hall positions, candidate names, photos, manifestos, eligibility requirements, nomination/approval status, and results.',
    ],
    positionsCount: 0,
    resultsCertified: false,
    provisionalResultsReady: false,
    isHistorical: true,
    candidateListStatus: 'hall_records_pending_admin_input',
    tallyAvailable: false,
    historicalNote:
      'Zero fabricated hall data: No 2026 JCRC hall candidates or positions were provided in the source record. Authorized administrators can add verified hall elections, positions, and candidates through Hall Management.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const HISTORICAL_2026_POSITIONS: Position[] = [
  // UCC SRC General Elections 2026 (7 positions)
  {
    id: 'pos_2026_src_president',
    electionId: 'elec_2026_src',
    domainId: 'src',
    title: 'SRC President',
    description: 'Executive Head and Chief Spokesperson of the UCC Students’ Representative Council (2026 Historical Record).',
    maxSelections: 1,
    allowsSkip: true,
    order: 1,
    candidateIds: ['cand_2026_src_emmanuel_acheampong_nana_adjei', 'cand_2026_src_richard_agyemang'],
  },
  {
    id: 'pos_2026_src_vice_president',
    electionId: 'elec_2026_src',
    domainId: 'src',
    title: 'SRC Vice President',
    description: 'Deputy Executive Officer of the UCC Students’ Representative Council (2026 Historical Record).',
    maxSelections: 1,
    allowsSkip: true,
    order: 2,
    candidateIds: ['cand_2026_src_regina_yayra_adenyo'],
  },
  {
    id: 'pos_2026_src_general_secretary',
    electionId: 'elec_2026_src',
    domainId: 'src',
    title: 'SRC General Secretary',
    description: 'Chief Administrative and Records Officer of the UCC SRC (2026 Historical Record).',
    maxSelections: 1,
    allowsSkip: true,
    order: 3,
    candidateIds: ['cand_2026_src_benedicta_tiwaa_danso', 'cand_2026_src_hawawu_abdulai_kiejembu'],
  },
  {
    id: 'pos_2026_src_treasurer',
    electionId: 'elec_2026_src',
    domainId: 'src',
    title: 'SRC Treasurer',
    description: 'Chief Financial Custodian of the UCC SRC (2026 Historical Record).',
    maxSelections: 1,
    allowsSkip: true,
    order: 4,
    candidateIds: [
      'cand_2026_src_nuhu_dauda',
      'cand_2026_src_isaac_aidoo',
      'cand_2026_src_emmanuel_wonders_koku',
    ],
  },
  {
    id: 'pos_2026_src_pro',
    electionId: 'elec_2026_src',
    domainId: 'src',
    title: 'SRC Public Relations Officer',
    description: 'Official Communications and Student Information Officer of the UCC SRC (2026 Historical Record).',
    maxSelections: 1,
    allowsSkip: true,
    order: 5,
    candidateIds: [
      'cand_2026_src_elisha_mensah_kojo_jnr',
      'cand_2026_src_gideon_kwadwo_adade',
      'cand_2026_src_eric_darlington_anku',
    ],
  },
  {
    id: 'pos_2026_src_coordinating_secretary',
    electionId: 'elec_2026_src',
    domainId: 'src',
    title: 'SRC Coordinating Secretary',
    description: 'Inter-Hall, Faculty, and Welfare Coordination Executive of the UCC SRC (2026 Historical Record).',
    maxSelections: 1,
    allowsSkip: true,
    order: 6,
    candidateIds: [
      'cand_2026_src_adwoa_asima_agbehiam',
      'cand_2026_src_winnifred_cobbinah',
      'cand_2026_src_bridget_amoah',
      'cand_2026_src_ernestina_netty',
    ],
  },
  {
    id: 'pos_2026_src_sports_secretary',
    electionId: 'elec_2026_src',
    domainId: 'src',
    title: 'SRC General Sports Secretary',
    description: 'Director of Student Athletics, Sports, and Intramural Competitions of the UCC SRC (2026 Historical Record).',
    maxSelections: 1,
    allowsSkip: true,
    order: 7,
    candidateIds: ['cand_2026_src_emmanuel_essel', 'cand_2026_src_felix_kwabla_akpakli'],
  },

  // GRASAG-UCC Elections 2026/2027 (8 positions — elected executives recorded)
  {
    id: 'pos_2026_grasag_president',
    electionId: 'elec_2026_grasag',
    domainId: 'grasag',
    title: 'President',
    description: 'President of GRASAG-UCC (2026/2027 Elected Executive Record — full contestant list not verified).',
    maxSelections: 1,
    allowsSkip: true,
    order: 1,
    candidateIds: ['cand_2026_grasag_abdullah_muniru'],
  },
  {
    id: 'pos_2026_grasag_vice_president',
    electionId: 'elec_2026_grasag',
    domainId: 'grasag',
    title: 'Vice President',
    description: 'Vice President of GRASAG-UCC (2026/2027 Elected Executive Record — full contestant list not verified).',
    maxSelections: 1,
    allowsSkip: true,
    order: 2,
    candidateIds: ['cand_2026_grasag_sandra_awolousor'],
  },
  {
    id: 'pos_2026_grasag_treasurer',
    electionId: 'elec_2026_grasag',
    domainId: 'grasag',
    title: 'Treasurer',
    description: 'Treasurer of GRASAG-UCC (2026/2027 Elected Executive Record — full contestant list not verified).',
    maxSelections: 1,
    allowsSkip: true,
    order: 3,
    candidateIds: ['cand_2026_grasag_juliana_serebour_quiacoe'],
  },
  {
    id: 'pos_2026_grasag_secretary',
    electionId: 'elec_2026_grasag',
    domainId: 'grasag',
    title: 'Secretary',
    description: 'Secretary of GRASAG-UCC (2026/2027 Elected Executive Record — full contestant list not verified).',
    maxSelections: 1,
    allowsSkip: true,
    order: 4,
    candidateIds: ['cand_2026_grasag_editha_kwakyewaa_boafo'],
  },
  {
    id: 'pos_2026_grasag_financial_secretary',
    electionId: 'elec_2026_grasag',
    domainId: 'grasag',
    title: 'Financial Secretary',
    description: 'Financial Secretary of GRASAG-UCC (2026/2027 Elected Executive Record — full contestant list not verified).',
    maxSelections: 1,
    allowsSkip: true,
    order: 5,
    candidateIds: ['cand_2026_grasag_patrick_ackah_arthur'],
  },
  {
    id: 'pos_2026_grasag_organising_secretary',
    electionId: 'elec_2026_grasag',
    domainId: 'grasag',
    title: 'Organising Secretary',
    description: 'Organising Secretary of GRASAG-UCC (2026/2027 Elected Executive Record — full contestant list not verified).',
    maxSelections: 1,
    allowsSkip: true,
    order: 6,
    candidateIds: ['cand_2026_grasag_kelvin_baah'],
  },
  {
    id: 'pos_2026_grasag_womens_commissioner',
    electionId: 'elec_2026_grasag',
    domainId: 'grasag',
    title: "Women's Commissioner",
    description: "Women's Commissioner of GRASAG-UCC (2026/2027 Elected Executive Record — full contestant list not verified).",
    maxSelections: 1,
    allowsSkip: true,
    order: 7,
    candidateIds: ['cand_2026_grasag_maame_aba_b_essilfie'],
  },
  {
    id: 'pos_2026_grasag_pro',
    electionId: 'elec_2026_grasag',
    domainId: 'grasag',
    title: 'Public Relations Officer',
    description: 'Public Relations Officer of GRASAG-UCC (2026/2027 Elected Executive Record — full contestant list not verified).',
    maxSelections: 1,
    allowsSkip: true,
    order: 8,
    candidateIds: ['cand_2026_grasag_papa_ekow_orhin'],
  },

  // Local NUGS Elections 2026 (2 positions)
  {
    id: 'pos_2026_local_nugs_president',
    electionId: 'elec_2026_local_nugs',
    domainId: 'local_nugs',
    title: 'President',
    description:
      'Local NUGS-UCC President. Samuel Adjei Anderson was elected; five additional contestants were reportedly involved, but their names have not been verified.',
    maxSelections: 1,
    allowsSkip: true,
    order: 1,
    candidateIds: ['cand_2026_local_nugs_samuel_adjei_anderson'],
    candidateEligibilityRules:
      'Historical 2026 Record: 5 additional presidential contestants were reportedly involved, but their identities remain unverified.',
  },
  {
    id: 'pos_2026_local_nugs_womens_commissioner',
    electionId: 'elec_2026_local_nugs',
    domainId: 'local_nugs',
    title: "Women's Commissioner",
    description:
      "Local NUGS-UCC Women's Commissioner. Christabel Adjokatcher was elected unopposed.",
    maxSelections: 1,
    allowsSkip: true,
    order: 2,
    candidateIds: ['cand_2026_local_nugs_christabel_adjokatcher'],
    candidateEligibilityRules: 'Historical 2026 Record: Elected unopposed.',
  },
];

interface HistoricalCandidateSeed {
  id: string;
  electionId: string;
  positionId: string;
  domainId: 'src' | 'grasag' | 'local_nugs';
  fullName: string;
  historicalRole: 'Winner' | 'Contestant' | 'Elected' | 'Elected Unopposed';
  historicalOutcomeNote: string;
  level: string;
  faculty: string;
  department: string;
  hall: string;
}

const SRC_SEEDS: HistoricalCandidateSeed[] = [
  {
    id: 'cand_2026_src_emmanuel_acheampong_nana_adjei',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_president',
    domainId: 'src',
    fullName: 'Emmanuel Acheampong Nana Adjei',
    historicalRole: 'Winner',
    historicalOutcomeNote: 'Winner — UCC SRC General Elections 2026 (SRC President).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_richard_agyemang',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_president',
    domainId: 'src',
    fullName: 'Richard Agyemang',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC President).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_regina_yayra_adenyo',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_vice_president',
    domainId: 'src',
    fullName: 'Regina Yayra Adenyo',
    historicalRole: 'Winner',
    historicalOutcomeNote: 'Winner — UCC SRC General Elections 2026 (SRC Vice President).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_benedicta_tiwaa_danso',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_general_secretary',
    domainId: 'src',
    fullName: 'Benedicta Tiwaa Danso',
    historicalRole: 'Winner',
    historicalOutcomeNote: 'Winner — UCC SRC General Elections 2026 (SRC General Secretary).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_hawawu_abdulai_kiejembu',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_general_secretary',
    domainId: 'src',
    fullName: 'Hawawu Abdulai Kiejembu',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC General Secretary).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_nuhu_dauda',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_treasurer',
    domainId: 'src',
    fullName: 'Nuhu Dauda',
    historicalRole: 'Winner',
    historicalOutcomeNote: 'Winner — UCC SRC General Elections 2026 (SRC Treasurer).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_isaac_aidoo',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_treasurer',
    domainId: 'src',
    fullName: 'Isaac Aidoo',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC Treasurer).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_emmanuel_wonders_koku',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_treasurer',
    domainId: 'src',
    fullName: 'Emmanuel Wonders Koku',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC Treasurer).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_elisha_mensah_kojo_jnr',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_pro',
    domainId: 'src',
    fullName: 'Elisha Mensah Kojo Jnr',
    historicalRole: 'Winner',
    historicalOutcomeNote: 'Winner — UCC SRC General Elections 2026 (SRC Public Relations Officer).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_gideon_kwadwo_adade',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_pro',
    domainId: 'src',
    fullName: 'Gideon Kwadwo Adade',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC Public Relations Officer).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_eric_darlington_anku',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_pro',
    domainId: 'src',
    fullName: 'Eric Darlington Anku',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC Public Relations Officer).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_adwoa_asima_agbehiam',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_coordinating_secretary',
    domainId: 'src',
    fullName: 'Adwoa Asima Agbehiam',
    historicalRole: 'Winner',
    historicalOutcomeNote: 'Winner — UCC SRC General Elections 2026 (SRC Coordinating Secretary).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_winnifred_cobbinah',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_coordinating_secretary',
    domainId: 'src',
    fullName: 'Winnifred Cobbinah',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC Coordinating Secretary).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_bridget_amoah',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_coordinating_secretary',
    domainId: 'src',
    fullName: 'Bridget Amoah',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC Coordinating Secretary).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_ernestina_netty',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_coordinating_secretary',
    domainId: 'src',
    fullName: 'Ernestina Netty',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC Coordinating Secretary).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_emmanuel_essel',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_sports_secretary',
    domainId: 'src',
    fullName: 'Emmanuel Essel',
    historicalRole: 'Winner',
    historicalOutcomeNote: 'Winner — UCC SRC General Elections 2026 (SRC General Sports Secretary).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_src_felix_kwabla_akpakli',
    electionId: 'elec_2026_src',
    positionId: 'pos_2026_src_sports_secretary',
    domainId: 'src',
    fullName: 'Felix Kwabla Akpakli',
    historicalRole: 'Contestant',
    historicalOutcomeNote: 'Contestant — UCC SRC General Elections 2026 (SRC General Sports Secretary).',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
];

const GRASAG_SEEDS: HistoricalCandidateSeed[] = [
  {
    id: 'cand_2026_grasag_abdullah_muniru',
    electionId: 'elec_2026_grasag',
    positionId: 'pos_2026_grasag_president',
    domainId: 'grasag',
    fullName: 'Abdullah Muniru',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      'Elected Executive — GRASAG-UCC Elections 2026/2027 (President). Full contestant list not verified.',
    level: 'Postgraduate',
    faculty: 'School of Graduate Studies',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_grasag_sandra_awolousor',
    electionId: 'elec_2026_grasag',
    positionId: 'pos_2026_grasag_vice_president',
    domainId: 'grasag',
    fullName: 'Sandra Awolousor',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      'Elected Executive — GRASAG-UCC Elections 2026/2027 (Vice President). Full contestant list not verified.',
    level: 'Postgraduate',
    faculty: 'School of Graduate Studies',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_grasag_juliana_serebour_quiacoe',
    electionId: 'elec_2026_grasag',
    positionId: 'pos_2026_grasag_treasurer',
    domainId: 'grasag',
    fullName: 'Juliana Serebour Quiacoe',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      'Elected Executive — GRASAG-UCC Elections 2026/2027 (Treasurer). Full contestant list not verified.',
    level: 'Postgraduate',
    faculty: 'School of Graduate Studies',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_grasag_editha_kwakyewaa_boafo',
    electionId: 'elec_2026_grasag',
    positionId: 'pos_2026_grasag_secretary',
    domainId: 'grasag',
    fullName: 'Editha Kwakyewaa Boafo',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      'Elected Executive — GRASAG-UCC Elections 2026/2027 (Secretary). Full contestant list not verified.',
    level: 'Postgraduate',
    faculty: 'School of Graduate Studies',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_grasag_patrick_ackah_arthur',
    electionId: 'elec_2026_grasag',
    positionId: 'pos_2026_grasag_financial_secretary',
    domainId: 'grasag',
    fullName: 'Patrick Ackah Arthur',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      'Elected Executive — GRASAG-UCC Elections 2026/2027 (Financial Secretary). Full contestant list not verified.',
    level: 'Postgraduate',
    faculty: 'School of Graduate Studies',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_grasag_kelvin_baah',
    electionId: 'elec_2026_grasag',
    positionId: 'pos_2026_grasag_organising_secretary',
    domainId: 'grasag',
    fullName: 'Kelvin Baah',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      'Elected Executive — GRASAG-UCC Elections 2026/2027 (Organising Secretary). Full contestant list not verified.',
    level: 'Postgraduate',
    faculty: 'School of Graduate Studies',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_grasag_maame_aba_b_essilfie',
    electionId: 'elec_2026_grasag',
    positionId: 'pos_2026_grasag_womens_commissioner',
    domainId: 'grasag',
    fullName: 'Maame Aba B. Essilfie',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      "Elected Executive — GRASAG-UCC Elections 2026/2027 (Women's Commissioner). Full contestant list not verified.",
    level: 'Postgraduate',
    faculty: 'School of Graduate Studies',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_grasag_papa_ekow_orhin',
    electionId: 'elec_2026_grasag',
    positionId: 'pos_2026_grasag_pro',
    domainId: 'grasag',
    fullName: 'Papa Ekow Orhin',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      'Elected Executive — GRASAG-UCC Elections 2026/2027 (Public Relations Officer). Full contestant list not verified.',
    level: 'Postgraduate',
    faculty: 'School of Graduate Studies',
    department: 'Not verified',
    hall: 'Not verified',
  },
];

const LOCAL_NUGS_SEEDS: HistoricalCandidateSeed[] = [
  {
    id: 'cand_2026_local_nugs_samuel_adjei_anderson',
    electionId: 'elec_2026_local_nugs',
    positionId: 'pos_2026_local_nugs_president',
    domainId: 'local_nugs',
    fullName: 'Samuel Adjei Anderson',
    historicalRole: 'Elected',
    historicalOutcomeNote:
      'Elected Local NUGS President (2026). Five additional contestants were reportedly involved, but their names have not been verified.',
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
  {
    id: 'cand_2026_local_nugs_christabel_adjokatcher',
    electionId: 'elec_2026_local_nugs',
    positionId: 'pos_2026_local_nugs_womens_commissioner',
    domainId: 'local_nugs',
    fullName: 'Christabel Adjokatcher',
    historicalRole: 'Elected Unopposed',
    historicalOutcomeNote:
      "Elected unopposed as Local NUGS Women's Commissioner (2026).",
    level: 'Not verified',
    faculty: 'Not verified',
    department: 'Not verified',
    hall: 'Not verified',
  },
];

function seedToCandidate(seed: HistoricalCandidateSeed): Candidate {
  return {
    id: seed.id,
    electionId: seed.electionId,
    positionId: seed.positionId,
    domainId: seed.domainId,
    fullName: seed.fullName,
    studentId: 'Unavailable — Historical 2026 Record',
    department: seed.department,
    faculty: seed.faculty,
    programme: '',
    level: seed.level,
    hall: seed.hall,
    photoUrl: '',
    biography: '',
    manifestoSummary: '',
    fullManifesto: [],
    keyPromises: [],
    leadershipExperience: [],
    applicationStatus: 'Approved',
    eligibilityVerified: true,
    isHistoricalRecord: true,
    historicalRole: seed.historicalRole,
    historicalOutcomeNote: seed.historicalOutcomeNote,
    profileDataStatus: 'incomplete_historical',
    submittedAt: '2026-01-01T00:00:00.000Z',
  };
}

export const HISTORICAL_2026_CANDIDATES: Candidate[] = [
  ...SRC_SEEDS,
  ...GRASAG_SEEDS,
  ...LOCAL_NUGS_SEEDS,
].map(seedToCandidate);

function buildHistoricalPositionResults(
  election: Election
): PositionResultSummary[] {
  const positions = HISTORICAL_2026_POSITIONS.filter((p) => p.electionId === election.id).sort(
    (a, b) => a.order - b.order
  );

  return positions.map((pos) => {
    const posCandidates = HISTORICAL_2026_CANDIDATES.filter((c) => c.positionId === pos.id);
    const winners = posCandidates.filter(
      (c) =>
        c.historicalRole === 'Winner' ||
        c.historicalRole === 'Elected' ||
        c.historicalRole === 'Elected Unopposed'
    );

    const rows: CandidateResultRow[] = posCandidates.map((cand, idx) => {
      const isWinner =
        cand.historicalRole === 'Winner' ||
        cand.historicalRole === 'Elected' ||
        cand.historicalRole === 'Elected Unopposed';
      return {
        candidateId: cand.id,
        fullName: cand.fullName,
        studentId: cand.studentId,
        photoUrl: cand.photoUrl,
        department: cand.department,
        faculty: cand.faculty,
        hall: cand.hall,
        votesReceived: 0,
        percentageOfValidVotes: 0,
        percentageOfTotalBallots: 0,
        rank: isWinner ? 1 : idx + 1,
        isLeading: false,
        isWinner,
        isTied: false,
        historicalRole: cand.historicalRole,
        outcomeNote: cand.historicalOutcomeNote,
      };
    });

    let contestNote: string | undefined;
    let unverifiedContestantsCount: number | undefined;

    if (pos.id === 'pos_2026_local_nugs_president') {
      contestNote =
        'Samuel Adjei Anderson was elected President. Five (5) additional contestants were reportedly involved, but their names have not been verified.';
      unverifiedContestantsCount = 5;
    } else if (pos.id === 'pos_2026_local_nugs_womens_commissioner') {
      contestNote = 'Christabel Adjokatcher was elected unopposed.';
    } else if (election.id === 'elec_2026_grasag') {
      contestNote =
        'Recorded executive officer only — full list of contestants for this portfolio has not been verified.';
    }

    return {
      positionId: pos.id,
      title: pos.title,
      description: pos.description,
      order: pos.order,
      totalValidVotes: 0,
      blankVotes: 0,
      invalidVotes: 0,
      totalBallotsProcessed: 0,
      isTie: false,
      tiedCandidateIds: [],
      winnerCandidateIds: winners.map((w) => w.id),
      contestNote,
      unverifiedContestantsCount,
      candidates: rows,
    };
  });
}

function buildHistoricalResultsPayload(election: Election): ElectionResultsPayload {
  return {
    electionId: election.id,
    electionTitle: election.title,
    electionCode: election.code,
    category: election.category,
    domainId: election.domainId,
    subdomainLabel: election.subdomainLabel,
    status: election.status,
    academicYear: election.academicYear,
    organizingBody: election.organizingBody,
    startDate: election.startDate,
    endDate: election.endDate,
    workflowStage: 'archived' as any,
    workflowHistory: [],
    isPublished: true,
    resultsCertified: false,
    certificationHash: 'HISTORICAL_2026_ARCHIVE_NO_VOTE_TALLY',
    ballotSummary: {
      totalEligibleVoters: 0,
      totalBallotsCast: 0,
      validBallots: 0,
      invalidBallots: 0,
      blankBallots: 0,
      uncastBallots: 0,
      turnoutPercentage: 0,
      validBallotRate: 0,
      invalidBallotRate: 0,
      blankBallotRate: 0,
    },
    positions: buildHistoricalPositionResults(election),
    turnoutAnalytics: {
      privacyThreshold: 5,
      byFaculty: [],
      byDepartment: [],
      byLevel: [],
      byHall: [],
    },
    isHistorical: true,
    tallyAvailable: false,
    historicalNote: election.historicalNote,
    candidateListStatus: election.candidateListStatus,
    unverifiedContestantsCount: election.unverifiedContestantsCount,
  };
}

export const HISTORICAL_2026_RESULTS: Record<string, ElectionResultsPayload> = {
  elec_2026_src: buildHistoricalResultsPayload(HISTORICAL_2026_ELECTIONS[0]),
  elec_2026_grasag: buildHistoricalResultsPayload(HISTORICAL_2026_ELECTIONS[1]),
  elec_2026_local_nugs: buildHistoricalResultsPayload(HISTORICAL_2026_ELECTIONS[2]),
};

export function mergeHistoricalElections(firestoreElections: Election[]): Election[] {
  const byId = new Map<string, Election>();
  HISTORICAL_2026_ELECTIONS.forEach((e) => byId.set(e.id, e));
  firestoreElections.forEach((e) => byId.set(e.id, e));
  return Array.from(byId.values());
}

export function mergeHistoricalPositions(
  firestoreGrouped: Record<string, Position[]>
): Record<string, Position[]> {
  const merged: Record<string, Position[]> = {};
  const byId = new Map<string, Position>();

  HISTORICAL_2026_POSITIONS.forEach((p) => byId.set(p.id, p));
  Object.values(firestoreGrouped).forEach((arr) => {
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

export function mergeHistoricalCandidates(firestoreCandidates: Candidate[]): Candidate[] {
  const byId = new Map<string, Candidate>();
  HISTORICAL_2026_CANDIDATES.forEach((c) => byId.set(c.id, c));
  firestoreCandidates.forEach((c) => byId.set(c.id, c));
  return Array.from(byId.values());
}

export function getHistoricalElectionById(id: string): Election | undefined {
  return HISTORICAL_2026_ELECTIONS.find((e) => e.id === id);
}

export function getHistoricalPositionsByElectionId(electionId: string): Position[] {
  return HISTORICAL_2026_POSITIONS.filter((p) => p.electionId === electionId).sort(
    (a, b) => a.order - b.order
  );
}

export function getHistoricalCandidateById(id: string): Candidate | undefined {
  return HISTORICAL_2026_CANDIDATES.find((c) => c.id === id);
}

export function getHistoricalResultsByElectionId(
  electionId: string
): ElectionResultsPayload | undefined {
  return HISTORICAL_2026_RESULTS[electionId];
}
