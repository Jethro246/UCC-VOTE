import { 
  StudentProfile, 
  AdminProfile, 
  Election, 
  Position, 
  Candidate, 
  NotificationItem, 
  CalendarEvent, 
  ComplaintTicket, 
  AuditLogItem 
} from '../types';

export const UCC_HERO_IMAGE = '/src/assets/images/hero_ucc_campus_1794352938030.jpg';
export const CANDIDATE_MALE_IMAGE = '/src/assets/images/candidate_male_1794352938747.jpg';
export const CANDIDATE_FEMALE_IMAGE = '/src/assets/images/candidate_female_1794352938475.jpg';

export const DEMO_STUDENT: StudentProfile = {
  id: 'stu-001',
  studentId: 'PS/CSC/22/0089',
  indexNumber: '10982341',
  fullName: 'Kofi Mensah Sarbah',
  email: 'kofi.sarbah@st.ucc.edu.gh',
  phone: '+233 24 555 0192',
  department: 'Computer Science & Information Technology',
  faculty: 'School of Physical Sciences',
  programme: 'B.Sc. Computer Science',
  level: '300',
  hall: 'Casely Hayford Hall',
  isEligible: true,
  avatarUrl: CANDIDATE_MALE_IMAGE,
  hasVotedElections: ['UCC-GRA-2025', 'UCC-VAL-2025']
};

export const DEMO_ADMIN: AdminProfile = {
  id: 'adm-001',
  staffId: 'UCC/EC/ST/2019/04',
  fullName: 'Dr. Joseph E. Tetteh',
  email: 'j.tetteh@ucc.edu.gh',
  role: 'Electoral Commissioner',
  department: 'University Electoral Commission',
  permissions: ['manage_elections', 'certify_results', 'audit_ballots', 'verify_students']
};

export const MOCK_ELECTIONS: Election[] = [
  {
    id: 'UCC-SRC-2026',
    title: '64th Students\' Representative Council (SRC) General Elections',
    code: 'SRC-2026-MAIN',
    description: 'General election to elect executive leadership for the UCC SRC for the 2026/2027 academic year. Open to all registered undergraduate students in good standing.',
    category: 'SRC',
    academicYear: '2026/2027',
    status: 'live',
    startDate: '2026-11-10T08:00:00Z',
    endDate: '2026-11-11T17:00:00Z',
    totalEligibleVoters: 24850,
    totalVotesCast: 14620,
    turnoutPercentage: 58.8,
    organizingBody: 'UCC Electoral Commission (EC-UCC)',
    eligibilityCriteria: {
      levels: ['100', '200', '300', '400']
    },
    rules: [
      'Each eligible student has exactly one vote per contested portfolio.',
      'Ballot selections are encrypted and decoupled from voter identification to ensure complete voter secrecy.',
      'Voting closes strictly at 17:00 GMT on election day.',
      'Unofficial results will not be recognized; only results signed by the Electoral Commissioner are certified.'
    ],
    positionsCount: 4,
    resultsCertified: false,
    provisionalResultsReady: false
  },
  {
    id: 'UCC-CAS-2026',
    title: 'Casely Hayford Hall (Casford) JCR Annual Executive Elections',
    code: 'JCR-CAS-2026',
    description: 'Election of hall executives for the Gentlemen of Casely Hayford Hall for the upcoming academic year. Only resident and affiliate members of Casford Hall are eligible.',
    category: 'JCR / Hall',
    academicYear: '2026/2027',
    status: 'live',
    startDate: '2026-11-10T09:00:00Z',
    endDate: '2026-11-11T16:00:00Z',
    totalEligibleVoters: 3200,
    totalVotesCast: 2180,
    turnoutPercentage: 68.1,
    organizingBody: 'Casely Hayford Hall Electoral Board',
    eligibilityCriteria: {
      halls: ['Casely Hayford Hall']
    },
    rules: [
      'Strictly restricted to registered Casford affiliates and hall residents.',
      'One ballot submission per student.',
      'Hall identification verified against the Dean of Students residential registry.'
    ],
    positionsCount: 3,
    resultsCertified: false,
    provisionalResultsReady: false
  },
  {
    id: 'UCC-DCS-2026',
    title: 'Department of Computer Science & IT (NACOS) Executive Elections',
    code: 'DEPT-CSC-2026',
    description: 'Departmental elections for the National Association of Computer Science Students (NACOS-UCC Chapter) leadership for the next academic year.',
    category: 'Departmental',
    academicYear: '2026/2027',
    status: 'upcoming',
    startDate: '2026-11-18T08:00:00Z',
    endDate: '2026-11-18T18:00:00Z',
    totalEligibleVoters: 1150,
    totalVotesCast: 0,
    turnoutPercentage: 0,
    organizingBody: 'Departmental Electoral Board - DCIT',
    eligibilityCriteria: {
      departments: ['Computer Science & Information Technology']
    },
    rules: [
      'Voters must be enrolled in B.Sc. Computer Science or B.Sc. Information Technology.',
      'Voting is held online from 08:00 to 18:00.'
    ],
    positionsCount: 3,
    resultsCertified: false,
    provisionalResultsReady: false
  },
  {
    id: 'UCC-SPS-2026',
    title: 'School of Physical Sciences (SPS-ESA) Annual Elections',
    code: 'FAC-SPS-2026',
    description: 'Faculty-wide executive leadership elections for the School of Physical Sciences Executive Students Association.',
    category: 'Faculty / School',
    academicYear: '2026/2027',
    status: 'upcoming',
    startDate: '2026-11-22T08:00:00Z',
    endDate: '2026-11-22T17:00:00Z',
    totalEligibleVoters: 4600,
    totalVotesCast: 0,
    turnoutPercentage: 0,
    organizingBody: 'SPS Electoral Committee',
    eligibilityCriteria: {
      faculties: ['School of Physical Sciences']
    },
    rules: [
      'Open to all students within Physics, Chemistry, Mathematics, Computer Science, and Statistics.'
    ],
    positionsCount: 4,
    resultsCertified: false,
    provisionalResultsReady: false
  },
  {
    id: 'UCC-GRA-2025',
    title: 'GRASAG-UCC 2025/2026 Executive Council Elections',
    code: 'GRA-2025-PUB',
    description: 'Graduate Students Association of Ghana, University of Cape Coast Chapter elections for Masters and PhD student governance.',
    category: 'GRASAG',
    academicYear: '2025/2026',
    status: 'results_published',
    startDate: '2026-10-15T08:00:00Z',
    endDate: '2026-10-15T18:00:00Z',
    totalEligibleVoters: 5400,
    totalVotesCast: 4120,
    turnoutPercentage: 76.3,
    organizingBody: 'GRASAG-UCC Electoral Commission',
    eligibilityCriteria: {
      levels: ['Postgraduate']
    },
    rules: [
      'Official results certified by Dean of School of Graduate Studies and Commission Chairperson.'
    ],
    positionsCount: 2,
    resultsCertified: true,
    provisionalResultsReady: true
  },
  {
    id: 'UCC-VAL-2025',
    title: 'Valco Hall JCR 2025/2026 Annual Elections',
    code: 'JCR-VAL-2025',
    description: 'Annual election for the executive committee of Industrialists of Valco Hall.',
    category: 'JCR / Hall',
    academicYear: '2025/2026',
    status: 'results_published',
    startDate: '2026-09-28T09:00:00Z',
    endDate: '2026-09-28T17:00:00Z',
    totalEligibleVoters: 2850,
    totalVotesCast: 2210,
    turnoutPercentage: 77.5,
    organizingBody: 'Valco Hall Electoral Committee',
    eligibilityCriteria: {
      halls: ['Valco Hall']
    },
    rules: [
      'Certified and declared at Valco Hall Forecourt.'
    ],
    positionsCount: 2,
    resultsCertified: true,
    provisionalResultsReady: true
  }
];

export const MOCK_POSITIONS: Record<string, Position[]> = {
  'UCC-SRC-2026': [
    {
      id: 'pos-src-pres',
      electionId: 'UCC-SRC-2026',
      title: 'SRC President & Vice President',
      description: 'The chief executive officers and primary advocates for the entire student body before University Council and Academic Board.',
      maxSelections: 1,
      allowsSkip: false,
      order: 1,
      candidateIds: ['cand-01', 'cand-02']
    },
    {
      id: 'pos-src-sec',
      electionId: 'UCC-SRC-2026',
      title: 'SRC General Secretary',
      description: 'Custodian of council records, secretariat operations, and primary communication officer for student congress.',
      maxSelections: 1,
      allowsSkip: true,
      order: 2,
      candidateIds: ['cand-03', 'cand-04']
    },
    {
      id: 'pos-src-treas',
      electionId: 'UCC-SRC-2026',
      title: 'SRC Treasurer',
      description: 'Manages student funds, prepares annual budget allocations, and supervises financial disbursement.',
      maxSelections: 1,
      allowsSkip: true,
      order: 3,
      candidateIds: ['cand-05']
    },
    {
      id: 'pos-src-pro',
      electionId: 'UCC-SRC-2026',
      title: 'SRC Public Relations Officer (PRO)',
      description: 'Liaises with university media, student press, and external media platforms.',
      maxSelections: 1,
      allowsSkip: true,
      order: 4,
      candidateIds: ['cand-06', 'cand-07']
    }
  ],
  'UCC-CAS-2026': [
    {
      id: 'pos-cas-pres',
      electionId: 'UCC-CAS-2026',
      title: 'JCR President',
      description: 'Chief gentleman representing Casely Hayford Hall in all university and hall deliberations.',
      maxSelections: 1,
      allowsSkip: false,
      order: 1,
      candidateIds: ['cand-cas-01', 'cand-cas-02']
    },
    {
      id: 'pos-cas-sec',
      electionId: 'UCC-CAS-2026',
      title: 'JCR Secretary',
      description: 'Secretariat lead for Casford Hall administration.',
      maxSelections: 1,
      allowsSkip: true,
      order: 2,
      candidateIds: ['cand-cas-03']
    }
  ],
  'UCC-GRA-2025': [
    {
      id: 'pos-gra-pres',
      electionId: 'UCC-GRA-2025',
      title: 'GRASAG President',
      description: 'President of the Graduate Students Association of Ghana (UCC).',
      maxSelections: 1,
      allowsSkip: false,
      order: 1,
      candidateIds: ['cand-gra-01', 'cand-gra-02']
    }
  ]
};

export const MOCK_CANDIDATES: Record<string, Candidate> = {
  'cand-01': {
    id: 'cand-01',
    electionId: 'UCC-SRC-2026',
    positionId: 'pos-src-pres',
    fullName: 'Nana Akua Afriyie Osei',
    studentId: 'ED/EPS/21/0034',
    nickname: 'Iron Lady of Cape Coast',
    department: 'Educational Foundations',
    faculty: 'Faculty of Educational Foundations',
    level: '400',
    hall: 'Adehye Hall',
    photoUrl: CANDIDATE_FEMALE_IMAGE,
    manifestoSummary: 'Empowering UCC: Modernizing shuttle transit, campus-wide Wi-Fi stability, and student entrepreneurial seed funds.',
    fullManifesto: [
      'Comprehensive overhaul and expansion of the intra-campus shuttle network with real-time tracking.',
      'Upgrading eduroam bandwidth and installing solar-powered study kiosks near Old Library and New Examination Centre.',
      'Instituting the GH₵250,000 UCC Student Enterprise Seed Grant for tech, agribusiness, and creative ventures.',
      'Strengthening legal protection and emergency healthcare response for students on off-campus private hostels (Kokoado, Amamoma, Kwesimintsim).'
    ],
    keyPromises: [
      'Solar-backed 24/7 charging zones across Old Site and New Site lecture theatres',
      'Direct Dean-Student quarterly open town halls',
      'Affordable student meal price stabilization pact with registered campus vendors',
      'Free digital textbook and lecture recording repository'
    ],
    leadershipExperience: [
      'SRC Deputy Welfare Committee Chairperson (2024/2025)',
      'Adehye Hall Academic Secretary (2023/2024)',
      'UCC Debate Society Lead Delegate at Ghana Universities Debate Championship'
    ],
    runningMate: {
      fullName: 'Richmond Kwabena Frimpong',
      studentId: 'SB/ACC/21/0112',
      department: 'Accounting & Finance',
      photoUrl: CANDIDATE_MALE_IMAGE
    },
    votesReceived: 7892,
    votePercentage: 54.0
  },
  'cand-02': {
    id: 'cand-02',
    electionId: 'UCC-SRC-2026',
    positionId: 'pos-src-pres',
    fullName: 'Kwesi Boateng Mensah',
    studentId: 'PS/CHE/21/0088',
    nickname: 'Action Kwesi',
    department: 'Chemistry',
    faculty: 'School of Physical Sciences',
    level: '400',
    hall: 'Casely Hayford Hall',
    photoUrl: CANDIDATE_MALE_IMAGE,
    manifestoSummary: 'Accountability First: Transparent student dues management, sports facilities modernization, and digital medical card access.',
    fullManifesto: [
      'Publishing quarterly audited financial statements of SRC dues on the public portal.',
      'Modernizing sports infrastructure including floodlights for the UCC Sports Stadium basketball and tennis courts.',
      'Integration of student clinic registration directly into the university student ID card system.',
      'Advocating for installment payment flexibility for academic and residential facility user fees.'
    ],
    keyPromises: [
      'Full financial transparency dashboard open to every student',
      'Renovation of communal study pavilions at Central Administration garden',
      'Emergency ambulance hotline dedicated for off-campus resident emergencies',
      'Annual Cape Coast Innovation & Tech Hackathon with industry corporate sponsors'
    ],
    leadershipExperience: [
      'Casely Hayford Hall JCR Sports Director (2023/2024)',
      'President, UCC Science Students Association (2024/2025)',
      'Executive Member, University Parliament Council'
    ],
    runningMate: {
      fullName: 'Abena Serwaa Prempeh',
      studentId: 'AS/ENG/21/0091',
      department: 'English & Communication Studies',
      photoUrl: CANDIDATE_FEMALE_IMAGE
    },
    votesReceived: 6728,
    votePercentage: 46.0
  },
  'cand-03': {
    id: 'cand-03',
    electionId: 'UCC-SRC-2026',
    positionId: 'pos-src-sec',
    fullName: 'Emmanuel Kofi Annan',
    studentId: 'AS/COM/22/0104',
    nickname: 'The Diplomat',
    department: 'Communication Studies',
    faculty: 'Faculty of Arts',
    level: '300',
    hall: 'Valco Hall',
    photoUrl: CANDIDATE_MALE_IMAGE,
    manifestoSummary: 'Digitizing the Secretariat: Instant circular dispatches, WhatsApp API notice broadcast, and searchable congress archives.',
    fullManifesto: [
      'Digitizing all official communique, congress minutes, and student policy documents into an accessible open portal.',
      'Instituting an SMS and Telegram alert system for emergency academic timetable changes.',
      'Publishing a weekly "Voice of UCC" newsletter capturing student achievements and scholarship opportunities.'
    ],
    keyPromises: [
      'Automated student request tracking for recommendation letters',
      'Public calendar of all faculty and departmental symposiums'
    ],
    leadershipExperience: [
      'Editorial Lead, Cape Coast University Student Magazine',
      'Valco Hall JCR Assistant Secretary'
    ],
    votesReceived: 8140,
    votePercentage: 59.2
  },
  'cand-04': {
    id: 'cand-04',
    electionId: 'UCC-SRC-2026',
    positionId: 'pos-src-sec',
    fullName: 'Jennifer Efua Mensimah',
    studentId: 'ED/JHS/22/0063',
    nickname: 'Jenna',
    department: 'Arts and Social Sciences Education',
    faculty: 'Faculty of Educational Foundations',
    level: '300',
    hall: 'Oguaa Hall',
    photoUrl: CANDIDATE_FEMALE_IMAGE,
    manifestoSummary: 'Speed, Precision, and Inclusion: Bridge the gap between distance learners, sandwich students, and regular campus students.',
    fullManifesto: [
      'Providing specialized liaison desks for distance and sandwich students during vacation sessions.',
      'Organizing termly town-hall style briefings with minutes published within 24 hours of congress adjournments.'
    ],
    keyPromises: [
      '24-hour turnaround on certified council letters',
      'Direct feedback inbox accessible via the student portal'
    ],
    leadershipExperience: [
      'Oguaa Hall Floor Representative',
      'Secretary, Education Students Association of Ghana (UCC Chapter)'
    ],
    votesReceived: 5610,
    votePercentage: 40.8
  },
  'cand-05': {
    id: 'cand-05',
    electionId: 'UCC-SRC-2026',
    positionId: 'pos-src-treas',
    fullName: 'Priscilla Baaba Eshun',
    studentId: 'SB/FIN/21/0019',
    nickname: 'Fiscal Guardian',
    department: 'Finance',
    faculty: 'School of Business',
    level: '400',
    hall: 'Kwame Nkrumah Hall',
    photoUrl: CANDIDATE_FEMALE_IMAGE,
    manifestoSummary: 'Zero Financial Leakage: Transparent student dues management with multi-tier digital authorization and discount cards.',
    fullManifesto: [
      'Implementing electronic multi-signatory escrow protocols for all committee disbursements.',
      'Negotiating student retail discounts with supermarkets, bookshops, and pharmacies in Cape Coast and Elmina.'
    ],
    keyPromises: [
      'Real-time expenditure tracking dashboard for student congress',
      'Timely disbursement of hall dues and subvention funds'
    ],
    leadershipExperience: [
      'Finance Committee Member, UCC SRC (2024/2025)',
      'Kwame Nkrumah Hall Audit Committee Chair'
    ],
    votesReceived: 12900,
    votePercentage: 92.4
  },
  'cand-06': {
    id: 'cand-06',
    electionId: 'UCC-SRC-2026',
    positionId: 'pos-src-pro',
    fullName: 'Kojo Adomako Danquah',
    studentId: 'AS/HIS/22/0055',
    department: 'History',
    faculty: 'Faculty of Arts',
    level: '300',
    hall: 'Casely Hayford Hall',
    photoUrl: CANDIDATE_MALE_IMAGE,
    manifestoSummary: 'Amplifying UCC Globally: Live streaming all major student assemblies and launching the UCC Student Spotlight initiative.',
    fullManifesto: [
      'Partnering with ATL FM 100.5 to produce dedicated weekly student governance airtime.',
      'Creating engaging video digests of student policies.'
    ],
    keyPromises: ['Weekly ATL FM radio segment', 'Fast-response crisis communication team'],
    leadershipExperience: ['ATL FM Student Presenter', 'Casford Hall Publicity Officer'],
    votesReceived: 7120,
    votePercentage: 51.5
  },
  'cand-07': {
    id: 'cand-07',
    electionId: 'UCC-SRC-2026',
    positionId: 'pos-src-pro',
    fullName: 'Derrick Opoku Ware',
    studentId: 'AS/COM/22/0210',
    department: 'Communication Studies',
    faculty: 'Faculty of Arts',
    level: '300',
    hall: 'Atlantic Hall',
    photoUrl: CANDIDATE_MALE_IMAGE,
    manifestoSummary: 'Interactive Media Excellence: Modernizing graphics, broadcast communications, and student grievance hotlines.',
    fullManifesto: [
      'Launching the official UCC Student App communication hub and podcast channel.'
    ],
    keyPromises: ['Podcast channel featuring campus trailblazers', 'Unified university event calendar'],
    leadershipExperience: ['Atlantic Hall Media Team Lead'],
    votesReceived: 6710,
    votePercentage: 48.5
  },
  // Casford Candidates
  'cand-cas-01': {
    id: 'cand-cas-01',
    electionId: 'UCC-CAS-2026',
    positionId: 'pos-cas-pres',
    fullName: 'Yaw Boakye Yiadom',
    studentId: 'PS/CSC/22/0031',
    nickname: 'Commander Yaw',
    department: 'Computer Science',
    faculty: 'School of Physical Sciences',
    level: '300',
    hall: 'Casely Hayford Hall',
    photoUrl: CANDIDATE_MALE_IMAGE,
    manifestoSummary: 'Casford Reborn: Modernizing the gym, installing backup water tanks, and reinstating the Casford Annual Gala.',
    fullManifesto: [
      'Refurbishing the Casford Hall gym with new barbell sets, bench presses, and air conditioning.',
      'Installing solar-powered borehole pump to permanently eliminate water shortages on Blocks A, B, and C.'
    ],
    keyPromises: ['Uninterrupted water flow project', 'Refurbished gym equipment'],
    leadershipExperience: ['Casford Hall Floor Prefect Block B'],
    votesReceived: 1240,
    votePercentage: 56.9
  },
  'cand-cas-02': {
    id: 'cand-cas-02',
    electionId: 'UCC-CAS-2026',
    positionId: 'pos-cas-pres',
    fullName: 'Michael Kwadwo Acheampong',
    studentId: 'SB/MGT/22/0047',
    nickname: 'Gentleman Mike',
    department: 'Management',
    faculty: 'School of Business',
    level: '300',
    hall: 'Casely Hayford Hall',
    photoUrl: CANDIDATE_MALE_IMAGE,
    manifestoSummary: 'Academic Excellence & Brotherhood: Mentorship schemes, Wi-Fi mesh in common rooms, and library renovation.',
    fullManifesto: [
      'Revamping the Casford Hall Reading Room with ergonomic chairs and fiber connection.'
    ],
    keyPromises: ['24/7 quiet study air-conditioned library', 'Casford brotherhood alumni mentorship network'],
    leadershipExperience: ['Casford Academic Committee Member'],
    votesReceived: 940,
    votePercentage: 43.1
  },
  'cand-cas-03': {
    id: 'cand-cas-03',
    electionId: 'UCC-CAS-2026',
    positionId: 'pos-cas-sec',
    fullName: 'David Senanu Klutse',
    studentId: 'AS/ENG/23/0014',
    department: 'English',
    faculty: 'Faculty of Arts',
    level: '200',
    hall: 'Casely Hayford Hall',
    photoUrl: CANDIDATE_MALE_IMAGE,
    manifestoSummary: 'Speed and Discipline in Hall Correspondence.',
    fullManifesto: ['Transparent notice board updates and digital bulletin.'],
    keyPromises: ['Notice boards updated every Monday morning'],
    leadershipExperience: ['Casford Editorial Board'],
    votesReceived: 1890,
    votePercentage: 91.2
  },
  // GRASAG Results Candidates
  'cand-gra-01': {
    id: 'cand-gra-01',
    electionId: 'UCC-GRA-2025',
    positionId: 'pos-gra-pres',
    fullName: 'Dr. (cand.) Bright Kwabena Amoah',
    studentId: 'PG/PHD/EDU/23/0002',
    department: 'Educational Leadership',
    faculty: 'Faculty of Educational Foundations',
    level: 'Postgraduate',
    hall: 'Superannuation Hostel',
    photoUrl: CANDIDATE_MALE_IMAGE,
    manifestoSummary: 'Empowering Postgraduate Research: Thesis grant advocacy, conference travel grants, and postgraduate study lounge.',
    fullManifesto: [
      'Liaised with SGS for timely thesis defense schedules.',
      'Secured 15 conference travel subventions from international educational partners.'
    ],
    keyPromises: ['Thesis completion emergency fund', 'Dedicated graduate quiet research center'],
    leadershipExperience: ['Former GRASAG Research Secretary'],
    votesReceived: 2450,
    votePercentage: 59.5
  },
  'cand-gra-02': {
    id: 'cand-gra-02',
    electionId: 'UCC-GRA-2025',
    positionId: 'pos-gra-pres',
    fullName: 'Grace Naa Korkoi Tetteh',
    studentId: 'PG/MPHIL/FNS/23/0011',
    department: 'Fisheries & Aquatic Sciences',
    faculty: 'School of Biological Sciences',
    level: 'Postgraduate',
    hall: 'Kwame Nkrumah Hall',
    photoUrl: CANDIDATE_FEMALE_IMAGE,
    manifestoSummary: 'Collaborative Research & Career Pathways: Industry internships and stipend increment advocacy.',
    fullManifesto: ['Expanded corporate internship tie-ups with maritime and agricultural institutions.'],
    keyPromises: ['Research publishing grant awards', 'Postgraduate healthcare package'],
    leadershipExperience: ['GRASAG Women\'s Commission Lead'],
    votesReceived: 1670,
    votePercentage: 40.5
  }
};

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Voting is Now Live: 64th SRC General Elections',
    message: 'The digital polling station for the 64th UCC SRC General Elections is now officially open. Polling will close at 17:00 GMT.',
    category: 'election',
    timestamp: '2 hours ago',
    read: false,
    linkAction: 'digital_ballot'
  },
  {
    id: 'notif-2',
    title: 'Casely Hayford Hall JCR Voting Started',
    message: 'Voting has commenced for registered gentlemen of Casely Hayford Hall. Cast your vote securely before 16:00 GMT.',
    category: 'election',
    timestamp: '3 hours ago',
    read: false,
    linkAction: 'elections_directory'
  },
  {
    id: 'notif-3',
    title: 'Electoral Commission Security Protocol Reminder',
    message: 'Your voter authentication token is strictly personal. The Electoral Commission will NEVER ask for your password or SMS verification code.',
    category: 'security',
    timestamp: 'Yesterday',
    read: true
  },
  {
    id: 'notif-4',
    title: 'Certified Results: GRASAG-UCC 2025/2026 Elections',
    message: 'The official certified declaration for the 2025/2026 GRASAG-UCC Elections has been signed and published by the Dean of Graduate Studies.',
    category: 'results',
    timestamp: '3 days ago',
    read: true,
    linkAction: 'election_results'
  },
  {
    id: 'notif-5',
    title: 'Upcoming Deadline: Department of Computer Science Nominations',
    message: 'Vetting and final candidate declarations for NACOS-UCC departmental executive elections will conclude this Friday at 16:00 GMT.',
    category: 'deadline',
    timestamp: '4 days ago',
    read: true,
    linkAction: 'election_calendar'
  }
];

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'cal-1',
    title: '64th SRC General Elections Digital Polling',
    electionCategory: 'SRC',
    startDate: '2026-11-10T08:00:00Z',
    endDate: '2026-11-11T17:00:00Z',
    type: 'voting',
    location: 'UCC VOTE Online Portal / Campus Verification Kiosks',
    description: 'General voting window for all registered UCC undergraduate students across campus.'
  },
  {
    id: 'cal-2',
    title: 'Casely Hayford Hall JCR Executive Voting',
    electionCategory: 'JCR / Hall',
    startDate: '2026-11-10T09:00:00Z',
    endDate: '2026-11-11T16:00:00Z',
    type: 'voting',
    location: 'Casford Forecourt & UCC VOTE Portal',
    description: 'Hall executive polling for all verified Casfordians.'
  },
  {
    id: 'cal-3',
    title: 'Official Certification & Declaration of SRC Results',
    electionCategory: 'SRC',
    startDate: '2026-11-11T19:00:00Z',
    endDate: '2026-11-11T21:00:00Z',
    type: 'results',
    location: 'UCC Main Auditorium & Live Web Broadcast',
    description: 'Formal announcement and signing of presidential and executive tallies by the Electoral Commissioner.'
  },
  {
    id: 'cal-4',
    title: 'NACOS-UCC (Computer Science) Presidential Debate',
    electionCategory: 'Departmental',
    startDate: '2026-11-15T16:00:00Z',
    endDate: '2026-11-15T18:30:00Z',
    type: 'campaign',
    location: 'Science Lecture Theatre (SLT 1)',
    description: 'Manifesto presentation and technology vision debate between computer science aspirants.'
  },
  {
    id: 'cal-5',
    title: 'School of Physical Sciences (SPS-ESA) Polling Day',
    electionCategory: 'Faculty / School',
    startDate: '2026-11-22T08:00:00Z',
    endDate: '2026-11-22T17:00:00Z',
    type: 'voting',
    location: 'UCC VOTE Online Portal',
    description: 'Faculty-wide voting for all students in the School of Physical Sciences.'
  }
];

export const MOCK_COMPLAINTS: ComplaintTicket[] = [
  {
    id: 'comp-101',
    ticketNumber: 'UCC-EC-2026-7819',
    studentName: 'Kofi Mensah Sarbah',
    studentId: 'PS/CSC/22/0089',
    category: 'technical',
    subject: 'Verification SMS latency on Vodafone network',
    description: 'Took approximately 4 minutes to receive the two-factor authentication token on my registered university contact line.',
    status: 'resolved',
    submittedAt: '2026-11-10T08:45:00Z',
    response: 'SMS gateway provider route updated to redundant SMPP channel with instant delivery.'
  },
  {
    id: 'comp-102',
    ticketNumber: 'UCC-EC-2026-7840',
    studentName: 'Beatrice Arhin',
    studentId: 'SB/MKT/23/0142',
    category: 'eligibility',
    subject: 'Departmental affiliation query for inter-faculty transfer',
    description: 'I recently transferred from Arts to Business and need my eligible voter registry updated for the School of Business election.',
    status: 'in_review',
    submittedAt: '2026-11-10T10:15:00Z'
  }
];

export const MOCK_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'log-01',
    timestamp: '2026-11-10 14:45:12 GMT',
    adminName: 'Dr. Joseph E. Tetteh',
    adminRole: 'Electoral Commissioner',
    action: 'POLL_OPEN_CONFIRMED',
    target: 'Election: UCC-SRC-2026',
    ipAddress: '197.255.124.18 (UCC Central Admin Network)',
    status: 'success'
  },
  {
    id: 'log-02',
    timestamp: '2026-11-10 13:12:05 GMT',
    adminName: 'System Integrity Monitor',
    adminRole: 'Automated Daemon',
    action: 'BALLOT_SECRECY_INTEGRITY_CHECK',
    target: 'Partition: SRC-2026-MAIN-VOTES',
    ipAddress: 'Internal Subnet 10.0.4.12',
    status: 'success'
  },
  {
    id: 'log-03',
    timestamp: '2026-11-10 11:20:44 GMT',
    adminName: 'Mrs. Agnes Ocloo',
    adminRole: 'Returning Officer',
    action: 'ELIGIBILITY_ROLL_SYNC',
    target: 'Faculty: School of Physical Sciences',
    ipAddress: '197.255.124.33 (Faculty Office)',
    status: 'success'
  },
  {
    id: 'log-04',
    timestamp: '2026-11-10 09:05:18 GMT',
    adminName: 'Security Firewall Sentinel',
    adminRole: 'Rate Limiter',
    action: 'BRUTE_FORCE_PREVENTION_TRIGGERED',
    target: 'IP: 102.176.44.89 (Repeated failed student PIN attempts)',
    ipAddress: '102.176.44.89',
    status: 'flagged'
  }
];
