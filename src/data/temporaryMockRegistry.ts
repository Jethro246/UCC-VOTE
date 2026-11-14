/**
 * TEMPORARY FRONTEND DEMONSTRATION DATA ONLY — NOT PRODUCTION DATA.
 *
 * This module stores temporary mock institutional data (domains, halls, faculties,
 * departments, sample student/admin accounts, and sample election ledgers) solely
 * to keep the UCC VOTE frontend interactive while no backend or database is connected.
 *
 * Do NOT treat any credentials, eligibility checks, or tallies here as production-ready
 * or cryptographically secure. Replace these lookups with real backend API calls later.
 */

import type {
  AdminProfile,
  AdminRoleType,
  DepartmentUnit,
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionCategory,
  FacultyUnit,
  HallUnit,
  ResultsWorkflowStage,
  StudentProfile,
  WorkflowAuditAction
} from '../types';
import {
  CANDIDATE_FEMALE_IMAGE,
  CANDIDATE_MALE_IMAGE
} from './mockData';

export interface TempOfficialStudentRecord {
  studentId: string;
  indexNumber: string;
  fullName: string;
  officialEmail: string;
  faculty: string;
  department: string;
  programme: string;
  level: '100' | '200' | '300' | '400' | 'Postgraduate';
  hall: string;
  isEnrolled: boolean;
  cgpaQualified: boolean;
}

export interface TempDemoStudentAccount extends StudentProfile {
  /** Temporary demo-only password (NOT for production use) */
  demoPassword: string;
  status: 'active' | 'suspended' | 'unverified';
  emailVerified: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface TempDemoAdminAccount extends AdminProfile {
  /** Temporary demo-only password (NOT for production use) */
  demoPassword: string;
  status: 'active' | 'suspended';
  lastLogin?: string;
}

export interface TempAuditLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  userId?: string;
  identifier: string;
  role?: string;
  ipAddress: string;
  status: 'SUCCESS' | 'FLAGGED' | 'WARNING';
  details: string;
}

export interface TempRawCohortCount {
  label: string;
  eligibleVoters: number;
  ballotsCast: number;
}

export interface TempPositionRawTally {
  candidateVotes: Record<string, number>;
  blankVotes: number;
  invalidVotes: number;
}

export interface TempElectionBallotLedger {
  electionId: string;
  workflowStage: ResultsWorkflowStage;
  workflowHistory: WorkflowAuditAction[];
  publishedAt?: string;
  certificationHash?: string;
  certifiedBy?: string;
  invalidBallots: number;
  blankOverallBallots: number;
  positionTallies: Record<string, TempPositionRawTally>;
  cohorts: {
    byFaculty: TempRawCohortCount[];
    byDepartment: TempRawCohortCount[];
    byLevel: TempRawCohortCount[];
    byHall: TempRawCohortCount[];
  };
}

export const TEMP_DOMAINS_REGISTRY: DomainRegistryItem[] = [
  {
    id: 'src',
    name: 'SRC General Elections',
    shortName: 'SRC',
    category: 'SRC',
    description:
      "Central Students' Representative Council elections governing all undergraduate student welfare, campus transit, and academic board representation.",
    governanceScope: 'University-wide undergraduate student body',
    eligibilityRuleSummary: 'Registered undergraduate students (Levels 100 – 400) in good standing',
    positionsPolicyNote:
      'Standard executive portfolios include SRC President & Vice President, General Secretary, Treasurer, Coordinating Secretary, and Public Relations Officer (admin-extensible).',
    adminRole: 'SRC Election Administrator',
    supportsSubdomains: false,
    subdomainType: 'none',
    isBuiltIn: true,
    displayOrder: 1
  },
  {
    id: 'jcrc_hall',
    name: 'JCRC / Hall Elections',
    shortName: 'Halls / JCRC',
    category: 'JCR / Hall',
    description:
      'Independent residential hall elections across participating UCC halls. Each hall manages its own constitution-defined positions, contestants, ballots, and results.',
    governanceScope: 'Individual UCC Halls of Residence (hall-by-hall subdomain isolation)',
    eligibilityRuleSummary:
      'Verified residents and affiliated members of the specific participating Hall only',
    positionsPolicyNote:
      'Hall-constitution specific: different halls may configure distinct JCRC offices (e.g., President, Welfare & Sanitation, Financial Controller, Organizing Secretary).',
    adminRole: 'Hall Election Administrator',
    supportsSubdomains: true,
    subdomainType: 'hall',
    isBuiltIn: true,
    displayOrder: 2
  },
  {
    id: 'grasag',
    name: 'GRASAG Elections',
    shortName: 'GRASAG',
    category: 'GRASAG',
    description:
      'Graduate Students Association of Ghana (UCC Chapter) elections exclusively for Masters (M.Phil./M.Sc./M.A./MBA) and Ph.D. students under the School of Graduate Studies.',
    governanceScope: 'School of Graduate Studies (Postgraduate community)',
    eligibilityRuleSummary:
      'Strictly restricted to accredited Postgraduate students (strictly separated from SRC/undergraduate voting)',
    positionsPolicyNote:
      'GRASAG-UCC constitutional portfolios configurable by the GRASAG Electoral Board.',
    adminRole: 'GRASAG Election Administrator',
    supportsSubdomains: false,
    subdomainType: 'none',
    isBuiltIn: true,
    displayOrder: 3
  },
  {
    id: 'local_nugs',
    name: 'Local NUGS Elections',
    shortName: 'Local NUGS',
    category: 'Local NUGS',
    description:
      'University of Cape Coast Local National Union of Ghana Students (Local NUGS) executive elections representing UCC students on national student policy and bursaries.',
    governanceScope: 'UCC Local NUGS Chapter',
    eligibilityRuleSummary: 'Active registered UCC students matching Local NUGS chapter criteria',
    positionsPolicyNote:
      'Dynamic & constitutional: Local NUGS portfolios are not rigidly fixed and can be added, updated, or removed per UCC Local NUGS constitutional approvals.',
    adminRole: 'Local NUGS Election Administrator',
    supportsSubdomains: false,
    subdomainType: 'none',
    isBuiltIn: true,
    displayOrder: 4
  },
  {
    id: 'departmental',
    name: 'Departmental Elections',
    shortName: 'Departmental',
    category: 'Departmental',
    description:
      'Department-level student association elections (e.g., NACOS, ChemSA, EduSA, Accounting Society) organized cleanly under UCC Colleges, Schools, Departments, and Academic Programmes.',
    governanceScope: 'Faculty / School -> Department -> Academic Programme',
    eligibilityRuleSummary:
      'Strictly restricted to enrolled students in the sponsoring Department (and Programme where specified)',
    positionsPolicyNote: 'Configured per departmental student association constitution.',
    adminRole: 'Departmental Election Administrator',
    supportsSubdomains: true,
    subdomainType: 'department',
    isBuiltIn: true,
    displayOrder: 5
  },
  {
    id: 'faculty_school',
    name: 'Faculty / School Elections',
    shortName: 'Faculty / School',
    category: 'Faculty / School',
    description:
      'Faculty- and School-wide student association governance elections (e.g., SPS-ESA, BUSA-UCC, EdSA, SoLSA) restricted to enrolled students within each School or Faculty.',
    governanceScope: 'Academic Faculties and Schools across UCC Colleges',
    eligibilityRuleSummary:
      'Strictly restricted to enrolled students belonging to the participating Faculty or School',
    positionsPolicyNote: 'Configured per Faculty/School association bye-laws.',
    adminRole: 'Faculty/School Election Administrator',
    supportsSubdomains: true,
    subdomainType: 'faculty',
    isBuiltIn: true,
    displayOrder: 6
  }
];

export const TEMP_HALLS_REGISTRY: HallUnit[] = [
  {
    id: 'hall-atlantic',
    name: 'Atlantic Hall',
    shortName: 'ATL',
    motto: 'Marinelanders',
    affiliationNote: 'Old Site Mixed Residential Hall'
  },
  {
    id: 'hall-casford',
    name: 'Casely Hayford Hall',
    shortName: 'Casford',
    motto: 'Gentlemen of Casford',
    affiliationNote: 'New Site Gentlemen Hall'
  },
  {
    id: 'hall-adehye',
    name: 'Adehye Hall',
    shortName: 'Adehye',
    motto: 'The Royals',
    affiliationNote: 'Old Site Ladies Residential Hall'
  },
  {
    id: 'hall-oguaa',
    name: 'Oguaa Hall',
    shortName: 'Oguaa',
    motto: 'Premier Hall',
    affiliationNote: 'Old Site Premier Mixed Hall'
  },
  {
    id: 'hall-knh',
    name: 'Kwame Nkrumah Hall',
    shortName: 'KNH',
    motto: 'The Patriots',
    affiliationNote: 'New Site Mixed Residential Hall'
  },
  {
    id: 'hall-valco',
    name: 'Valco Hall',
    shortName: 'Valco',
    motto: 'Industrialists',
    affiliationNote: 'New Site Mixed Residential Hall'
  }
];

export const TEMP_FACULTIES_REGISTRY: FacultyUnit[] = [
  {
    id: 'fac-sps',
    name: 'School of Physical Sciences',
    code: 'SPS',
    college: 'College of Agriculture and Natural Sciences'
  },
  {
    id: 'fac-sbs',
    name: 'School of Biological Sciences',
    code: 'SBS',
    college: 'College of Agriculture and Natural Sciences'
  },
  {
    id: 'fac-bus',
    name: 'School of Business',
    code: 'SoB',
    college: 'College of Humanities and Legal Studies'
  },
  {
    id: 'fac-arts',
    name: 'Faculty of Arts',
    code: 'FoA',
    college: 'College of Humanities and Legal Studies'
  },
  {
    id: 'fac-soc',
    name: 'Faculty of Social Sciences',
    code: 'FSS',
    college: 'College of Humanities and Legal Studies'
  },
  {
    id: 'fac-law',
    name: 'Faculty of Law',
    code: 'FoL',
    college: 'College of Humanities and Legal Studies'
  },
  {
    id: 'fac-edu',
    name: 'Faculty of Educational Foundations',
    code: 'FEF',
    college: 'College of Education Studies'
  },
  {
    id: 'fac-sms',
    name: 'School of Medical Sciences',
    code: 'SMS',
    college: 'College of Health and Allied Sciences'
  }
];

export const TEMP_DEPARTMENTS_REGISTRY: DepartmentUnit[] = [
  {
    id: 'dept-csit',
    name: 'Computer Science & Information Technology',
    code: 'DCIT',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Computer Science', 'B.Sc. Information Technology', 'Ph.D. Computer Science']
  },
  {
    id: 'dept-chem',
    name: 'Chemistry',
    code: 'CHEM',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Chemistry', 'B.Sc. Industrial Chemistry']
  },
  {
    id: 'dept-math',
    name: 'Mathematics',
    code: 'MATH',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Mathematics', 'M.Sc. Applied Mathematics']
  },
  {
    id: 'dept-phys',
    name: 'Physics',
    code: 'PHYS',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Physics', 'B.Sc. Engineering Physics']
  },
  {
    id: 'dept-stat',
    name: 'Statistics',
    code: 'STAT',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Statistics', 'B.Sc. Actuarial Science']
  },
  {
    id: 'dept-acc',
    name: 'Accounting',
    code: 'ACC',
    facultyId: 'fac-bus',
    facultyName: 'School of Business',
    programmes: ['B.Com. Accounting', 'M.Phil. Accounting']
  },
  {
    id: 'dept-fin',
    name: 'Finance',
    code: 'FIN',
    facultyId: 'fac-bus',
    facultyName: 'School of Business',
    programmes: ['B.Com. Finance', 'M.Sc. Finance']
  },
  {
    id: 'dept-mkt',
    name: 'Marketing & Supply Chain',
    code: 'MKT',
    facultyId: 'fac-bus',
    facultyName: 'School of Business',
    programmes: ['B.Com. Marketing', 'B.Com. Procurement & Supply Chain']
  },
  {
    id: 'dept-mgt',
    name: 'Management',
    code: 'MGT',
    facultyId: 'fac-bus',
    facultyName: 'School of Business',
    programmes: ['B.Com. Human Resource Management', 'M.Phil. Management']
  },
  {
    id: 'dept-edu-found',
    name: 'Educational Foundations',
    code: 'EFD',
    facultyId: 'fac-edu',
    facultyName: 'Faculty of Educational Foundations',
    programmes: [
      'B.Ed. Psychology & Foundations',
      'B.Ed. Early Childhood Education',
      'M.Phil. Educational Psychology'
    ]
  },
  {
    id: 'dept-asse',
    name: 'Arts and Social Sciences Education',
    code: 'DASSE',
    facultyId: 'fac-edu',
    facultyName: 'Faculty of Educational Foundations',
    programmes: ['B.Ed. Social Studies', 'B.Ed. Arts', 'B.Ed. Social Sciences']
  },
  {
    id: 'dept-comm',
    name: 'Communication Studies',
    code: 'COMM',
    facultyId: 'fac-arts',
    facultyName: 'Faculty of Arts',
    programmes: ['B.A. Communication Studies', 'B.A. Communication and Public Relations']
  },
  {
    id: 'dept-hist',
    name: 'History',
    code: 'HIST',
    facultyId: 'fac-arts',
    facultyName: 'Faculty of Arts',
    programmes: ['B.A. History', 'B.A. History and Political Studies']
  },
  {
    id: 'dept-econ',
    name: 'Economics',
    code: 'ECON',
    facultyId: 'fac-soc',
    facultyName: 'Faculty of Social Sciences',
    programmes: ['B.A. Economics', 'B.Sc. Economics']
  },
  {
    id: 'dept-pol',
    name: 'Political Studies',
    code: 'POL',
    facultyId: 'fac-soc',
    facultyName: 'Faculty of Social Sciences',
    programmes: ['B.A. Political Science']
  },
  {
    id: 'dept-law',
    name: 'Law',
    code: 'LAW',
    facultyId: 'fac-law',
    facultyName: 'Faculty of Law',
    programmes: ['LL.B. Bachelor of Laws']
  },
  {
    id: 'dept-sms',
    name: 'School of Medical Sciences',
    code: 'SMS',
    facultyId: 'fac-sms',
    facultyName: 'School of Medical Sciences',
    programmes: ['MB ChB Medicine & Surgery']
  },
  {
    id: 'dept-bch',
    name: 'Biochemistry',
    code: 'BCH',
    facultyId: 'fac-sbs',
    facultyName: 'School of Biological Sciences',
    programmes: ['B.Sc. Biochemistry']
  }
];

/**
 * Temporary mock student registry records (placeholder until a real UCC SIS/DAA API is connected)
 */
export const TEMP_OFFICIAL_STUDENT_REGISTRY: Record<string, TempOfficialStudentRecord> = {
  'PS/CSC/22/0089': {
    studentId: 'PS/CSC/22/0089',
    indexNumber: '10982341',
    fullName: 'Kofi Mensah Sarbah',
    officialEmail: 'kofi.sarbah@st.ucc.edu.gh',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science & Information Technology',
    programme: 'B.Sc. Computer Science',
    level: '300',
    hall: 'Casely Hayford Hall',
    isEnrolled: true,
    cgpaQualified: true
  },
  'ED/EPS/21/0034': {
    studentId: 'ED/EPS/21/0034',
    indexNumber: '10982405',
    fullName: 'Nana Akua Afriyie Osei',
    officialEmail: 'nana.osei@st.ucc.edu.gh',
    faculty: 'Faculty of Educational Foundations',
    department: 'Educational Foundations',
    programme: 'B.Ed. Psychology & Foundations',
    level: '400',
    hall: 'Adehye Hall',
    isEnrolled: true,
    cgpaQualified: true
  },
  'PS/CHE/21/0088': {
    studentId: 'PS/CHE/21/0088',
    indexNumber: '10981920',
    fullName: 'Kwesi Boateng Mensah',
    officialEmail: 'kwesi.mensah@st.ucc.edu.gh',
    faculty: 'School of Physical Sciences',
    department: 'Chemistry',
    programme: 'B.Sc. Chemistry',
    level: '400',
    hall: 'Casely Hayford Hall',
    isEnrolled: true,
    cgpaQualified: true
  },
  'SB/ACC/21/0112': {
    studentId: 'SB/ACC/21/0112',
    indexNumber: '10983112',
    fullName: 'Richmond Kwabena Frimpong',
    officialEmail: 'richmond.frimpong@st.ucc.edu.gh',
    faculty: 'School of Business',
    department: 'Accounting & Finance',
    programme: 'B.Com. Accounting',
    level: '400',
    hall: 'Valco Hall',
    isEnrolled: true,
    cgpaQualified: true
  },
  'AS/COM/22/0104': {
    studentId: 'AS/COM/22/0104',
    indexNumber: '10984501',
    fullName: 'Emmanuel Kofi Annan',
    officialEmail: 'emmanuel.annan@st.ucc.edu.gh',
    faculty: 'Faculty of Arts',
    department: 'Communication Studies',
    programme: 'B.A. Communication Studies',
    level: '300',
    hall: 'Valco Hall',
    isEnrolled: true,
    cgpaQualified: true
  },
  'AS/HIS/22/0055': {
    studentId: 'AS/HIS/22/0055',
    indexNumber: '10985512',
    fullName: 'Kojo Adomako Danquah',
    officialEmail: 'kojo.danquah@st.ucc.edu.gh',
    faculty: 'Faculty of Arts',
    department: 'History',
    programme: 'B.A. History',
    level: '300',
    hall: 'Casely Hayford Hall',
    isEnrolled: true,
    cgpaQualified: true
  },
  'SB/MKT/23/0142': {
    studentId: 'SB/MKT/23/0142',
    indexNumber: '10989944',
    fullName: 'Beatrice Arhin',
    officialEmail: 'beatrice.arhin@st.ucc.edu.gh',
    faculty: 'School of Business',
    department: 'Marketing',
    programme: 'B.Com. Marketing',
    level: '200',
    hall: 'Kwame Nkrumah Hall',
    isEnrolled: true,
    cgpaQualified: true
  },
  'ED/JHS/22/0063': {
    studentId: 'ED/JHS/22/0063',
    indexNumber: '10988019',
    fullName: 'Jennifer Efua Mensimah',
    officialEmail: 'jennifer.mensimah@st.ucc.edu.gh',
    faculty: 'Faculty of Educational Foundations',
    department: 'Arts and Social Sciences Education',
    programme: 'B.Ed. Junior High Education',
    level: '300',
    hall: 'Oguaa Hall',
    isEnrolled: false,
    cgpaQualified: false
  },
  'MED/SMS/24/0012': {
    studentId: 'MED/SMS/24/0012',
    indexNumber: '10991204',
    fullName: 'Kwame Osei Mensah',
    officialEmail: 'kwame.mensah@st.ucc.edu.gh',
    faculty: 'School of Medical Sciences',
    department: 'School of Medical Sciences',
    programme: 'MB ChB Medicine & Surgery',
    level: '100',
    hall: 'Off-Campus Private Hostel',
    isEnrolled: true,
    cgpaQualified: true
  },
  'PG/CSC/25/0018': {
    studentId: 'PG/CSC/25/0018',
    indexNumber: '20980018',
    fullName: 'Dr. (cand.) Ama Serwaa Darko',
    officialEmail: 'ama.darko@st.ucc.edu.gh',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science & Information Technology',
    programme: 'M.Phil. Computer Science',
    level: 'Postgraduate',
    hall: 'Casely Hayford Hall',
    isEnrolled: true,
    cgpaQualified: true
  }
};

export const TEMP_DEMO_STUDENT_ACCOUNTS: TempDemoStudentAccount[] = [
  {
    id: 'stu-001',
    studentId: 'PS/CSC/22/0089',
    indexNumber: '10982341',
    fullName: 'Kofi Mensah Sarbah',
    email: 'kofi.sarbah@st.ucc.edu.gh',
    phone: '+233 24 555 0192',
    emergencyContact: '+233 20 888 1234',
    department: 'Computer Science & Information Technology',
    faculty: 'School of Physical Sciences',
    programme: 'B.Sc. Computer Science',
    level: '300',
    hall: 'Casely Hayford Hall',
    avatarUrl: CANDIDATE_MALE_IMAGE,
    demoPassword: 'Vote@UCC2026',
    status: 'active',
    isEligible: true,
    emailVerified: true,
    notificationPreferences: {
      emailAlerts: true,
      smsBulletins: true,
      resultsAnnouncements: true
    },
    hasVotedElections: ['UCC-GRA-2025', 'UCC-VAL-2025'],
    createdAt: '2026-10-01T08:00:00Z',
    isDemoAccount: true
  },
  {
    id: 'stu-002',
    studentId: 'ED/EPS/21/0034',
    indexNumber: '10982405',
    fullName: 'Nana Akua Afriyie Osei',
    email: 'nana.osei@st.ucc.edu.gh',
    phone: '+233 24 444 8821',
    department: 'Educational Foundations',
    faculty: 'Faculty of Educational Foundations',
    programme: 'B.Ed. Psychology & Foundations',
    level: '400',
    hall: 'Adehye Hall',
    avatarUrl: CANDIDATE_FEMALE_IMAGE,
    demoPassword: 'Vote@UCC2026',
    status: 'active',
    isEligible: true,
    emailVerified: true,
    notificationPreferences: {
      emailAlerts: true,
      smsBulletins: false,
      resultsAnnouncements: true
    },
    hasVotedElections: [],
    createdAt: '2026-10-02T10:00:00Z',
    isDemoAccount: true
  },
  {
    id: 'stu-003',
    studentId: 'AS/HIS/22/0055',
    indexNumber: '10985512',
    fullName: 'Kojo Adomako Danquah (Suspended Demo Account)',
    email: 'kojo.danquah@st.ucc.edu.gh',
    phone: '+233 26 123 9988',
    department: 'History',
    faculty: 'Faculty of Arts',
    programme: 'B.A. History',
    level: '300',
    hall: 'Casely Hayford Hall',
    demoPassword: 'Vote@UCC2026',
    status: 'suspended',
    isEligible: false,
    emailVerified: true,
    notificationPreferences: {
      emailAlerts: false,
      smsBulletins: false,
      resultsAnnouncements: false
    },
    hasVotedElections: [],
    createdAt: '2026-10-05T12:00:00Z',
    isDemoAccount: true
  },
  {
    id: 'stu-freshman',
    studentId: 'MED/SMS/24/0012',
    indexNumber: '10991204',
    fullName: 'Kwame Osei Mensah (Medical Freshman)',
    email: 'kwame.mensah@st.ucc.edu.gh',
    phone: '+233 24 111 2233',
    department: 'School of Medical Sciences',
    faculty: 'School of Medical Sciences',
    programme: 'MB ChB Medicine & Surgery',
    level: '100',
    hall: 'Off-Campus Private Hostel',
    demoPassword: 'Vote@UCC2026',
    status: 'active',
    isEligible: true,
    emailVerified: true,
    notificationPreferences: {
      emailAlerts: true,
      smsBulletins: true,
      resultsAnnouncements: true
    },
    hasVotedElections: [],
    createdAt: '2026-10-06T09:00:00Z',
    isDemoAccount: true
  },
  {
    id: 'stu-pg-001',
    studentId: 'PG/CSC/25/0018',
    indexNumber: '20980018',
    fullName: 'Ama Serwaa Darko (Postgraduate Demo)',
    email: 'ama.darko@st.ucc.edu.gh',
    phone: '+233 24 777 3344',
    department: 'Computer Science & Information Technology',
    faculty: 'School of Physical Sciences',
    programme: 'M.Phil. Computer Science',
    level: 'Postgraduate',
    hall: 'Casely Hayford Hall',
    demoPassword: 'Vote@UCC2026',
    status: 'active',
    isEligible: true,
    emailVerified: true,
    notificationPreferences: {
      emailAlerts: true,
      smsBulletins: true,
      resultsAnnouncements: true
    },
    hasVotedElections: [],
    createdAt: '2026-10-06T10:00:00Z',
    isDemoAccount: true
  }
];

export const TEMP_DEMO_ADMIN_ACCOUNTS: TempDemoAdminAccount[] = [
  {
    id: 'adm-001',
    staffId: 'UCC/EC/ST/2019/04',
    fullName: 'Dr. Joseph E. Tetteh',
    email: 'j.tetteh@ucc.edu.gh',
    role: 'Electoral Commissioner',
    department: 'University Electoral Commission',
    permissions: ['manage_elections', 'certify_results', 'audit_ballots', 'verify_students'],
    managedDomainIds: ['src', 'jcrc_hall', 'grasag', 'local_nugs', 'departmental', 'faculty_school'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-002',
    staffId: 'UCC/ICT/SA/2021/01',
    fullName: 'Ing. Kwabena Acheampong',
    email: 'k.acheampong@ucc.edu.gh',
    role: 'Super Administrator',
    department: 'Directorate of ICT (DoICT)',
    permissions: ['all_systems', 'manage_admins', 'manage_domains', 'system_config', 'audit_all'],
    managedDomainIds: ['src', 'jcrc_hall', 'grasag', 'local_nugs', 'departmental', 'faculty_school'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-003',
    staffId: 'UCC/EC/RO/2022/09',
    fullName: 'Mrs. Agnes Ocloo',
    email: 'agnes.ocloo@ucc.edu.gh',
    role: 'Returning Officer',
    department: 'Electoral Board - Halls & Faculties',
    permissions: ['verify_students', 'publish_provisional', 'view_turnout'],
    managedDomainIds: ['src', 'jcrc_hall', 'grasag', 'local_nugs', 'departmental', 'faculty_school'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-004',
    staffId: 'UCC/AUD/RA/2020/03',
    fullName: 'Prof. Kofi Sarpong Mensah',
    email: 'k.sarpong@ucc.edu.gh',
    role: 'Results Auditor',
    department: 'Independent Audit Council',
    permissions: ['inspect_checksums', 'validate_tallies', 'audit_logs'],
    managedDomainIds: ['src', 'jcrc_hall', 'grasag', 'local_nugs', 'departmental', 'faculty_school'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-dom-src',
    staffId: 'UCC/DOM/SRC/01',
    fullName: 'Mr. Francis K. Asante',
    email: 'src.admin@ucc.edu.gh',
    role: 'SRC Election Administrator',
    department: 'SRC Electoral Directorate',
    permissions: ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'],
    managedDomainIds: ['src'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-dom-cas',
    staffId: 'UCC/DOM/CAS/01',
    fullName: 'Dr. Emmanuel Quayson (Casford Senior Tutor)',
    email: 'casford.admin@ucc.edu.gh',
    role: 'Hall Election Administrator',
    department: 'Casely Hayford Hall Electoral Board',
    permissions: ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'],
    managedDomainIds: ['jcrc_hall'],
    managedHalls: ['Casely Hayford Hall'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-dom-val',
    staffId: 'UCC/DOM/VAL/01',
    fullName: 'Mrs. Akosua Boateng (Valco Hall Warden)',
    email: 'valco.admin@ucc.edu.gh',
    role: 'Hall Election Administrator',
    department: 'Valco Hall Electoral Board',
    permissions: ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'],
    managedDomainIds: ['jcrc_hall'],
    managedHalls: ['Valco Hall'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-dom-gra',
    staffId: 'UCC/DOM/GRA/01',
    fullName: 'Prof. Efua P. Osei-Wusu',
    email: 'grasag.admin@ucc.edu.gh',
    role: 'GRASAG Election Administrator',
    department: 'School of Graduate Studies Electoral Board',
    permissions: ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'],
    managedDomainIds: ['grasag'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-dom-nugs',
    staffId: 'UCC/DOM/NUGS/01',
    fullName: 'Mr. Bernard K. Mensah',
    email: 'nugs.admin@ucc.edu.gh',
    role: 'Local NUGS Election Administrator',
    department: 'UCC Local NUGS Electoral Committee',
    permissions: ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'],
    managedDomainIds: ['local_nugs'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-dom-dcs',
    staffId: 'UCC/DOM/DCS/01',
    fullName: 'Dr. Isaac Armah-Mensah',
    email: 'dcit.admin@ucc.edu.gh',
    role: 'Departmental Election Administrator',
    department: 'Dept. of Computer Science & Information Technology',
    permissions: ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'],
    managedDomainIds: ['departmental'],
    managedFaculties: ['School of Physical Sciences'],
    managedDepartments: ['Computer Science & Information Technology'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  },
  {
    id: 'adm-dom-sps',
    staffId: 'UCC/DOM/SPS/01',
    fullName: 'Prof. Samuel K. Donkoh',
    email: 'sps.admin@ucc.edu.gh',
    role: 'Faculty/School Election Administrator',
    department: 'School of Physical Sciences Electoral Board',
    permissions: ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'],
    managedDomainIds: ['faculty_school'],
    managedFaculties: ['School of Physical Sciences'],
    isDemoAccount: true,
    demoPassword: 'Admin@UCC2026',
    status: 'active'
  }
];

export const TEMP_INITIAL_LEDGER_DATA: TempElectionBallotLedger[] = [
  {
    electionId: 'UCC-GRA-2025',
    workflowStage: 'published',
    publishedAt: '2025-10-16T10:30:00Z',
    certificationHash: 'DEMO-REF-9B2D8E41A7C4',
    certifiedBy: 'Dr. Joseph E. Tetteh (Demo Record)',
    invalidBallots: 25,
    blankOverallBallots: 40,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Demo Tally Aggregation',
        actorRole: 'Frontend Preview',
        timestamp: '2025-10-15T18:05:00Z',
        notes: 'Sample preliminary tally record loaded for UI preview.'
      },
      {
        stage: 'published',
        actorId: 'adm-001',
        actorName: 'Dr. Joseph E. Tetteh',
        actorRole: 'Electoral Commissioner (Demo)',
        timestamp: '2025-10-16T10:30:00Z',
        notes: 'Sample published results record for frontend demonstration.'
      }
    ],
    positionTallies: {
      'pos-gra-pres': {
        candidateVotes: { 'cand-gra-01': 2450, 'cand-gra-02': 1670 },
        blankVotes: 40,
        invalidVotes: 25
      },
      'pos-gra-sec': {
        candidateVotes: { 'cand-gra-03': 2310, 'cand-gra-04': 1700 },
        blankVotes: 150,
        invalidVotes: 25
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'Faculty of Educational Foundations', eligibleVoters: 1450, ballotsCast: 1165 },
        { label: 'School of Physical Sciences', eligibleVoters: 980, ballotsCast: 774 },
        { label: 'School of Biological Sciences', eligibleVoters: 860, ballotsCast: 662 },
        { label: 'School of Business', eligibleVoters: 1120, ballotsCast: 851 },
        { label: 'Faculty of Arts & Social Sciences', eligibleVoters: 972, ballotsCast: 721 },
        { label: 'Institute of Marine Policy (Small Cohort)', eligibleVoters: 18, ballotsCast: 12 }
      ],
      byDepartment: [
        { label: 'Educational Leadership', eligibleVoters: 820, ballotsCast: 675 },
        { label: 'Fisheries & Aquatic Sciences', eligibleVoters: 490, ballotsCast: 392 },
        { label: 'Management & Strategy', eligibleVoters: 640, ballotsCast: 498 },
        { label: 'Mathematics & Statistics', eligibleVoters: 510, ballotsCast: 388 },
        { label: 'Computer Science & IT', eligibleVoters: 470, ballotsCast: 386 },
        { label: 'Classics & Ancient Philosophy', eligibleVoters: 16, ballotsCast: 11 }
      ],
      byLevel: [
        { label: 'M.Phil. / M.Sc. Year 1', eligibleVoters: 2450, ballotsCast: 1935 },
        { label: 'M.Phil. / M.Sc. Year 2', eligibleVoters: 1980, ballotsCast: 1510 },
        { label: 'Ph.D. Candidates', eligibleVoters: 952, ballotsCast: 728 },
        { label: 'Visiting Postgrad Fellows', eligibleVoters: 18, ballotsCast: 12 }
      ],
      byHall: [
        { label: 'Superannuation Graduate Hostel', eligibleVoters: 1850, ballotsCast: 1520 },
        { label: 'Valco Graduate Hostel', eligibleVoters: 1240, ballotsCast: 965 },
        { label: 'Kwame Nkrumah Hall Postgrad Wing', eligibleVoters: 920, ballotsCast: 702 },
        { label: 'Off-Campus Graduate Affiliates', eligibleVoters: 1390, ballotsCast: 998 }
      ]
    }
  },
  {
    electionId: 'UCC-VAL-2025',
    workflowStage: 'published',
    publishedAt: '2025-09-29T11:00:00Z',
    certificationHash: 'DEMO-REF-4F1C7E20B9D1',
    certifiedBy: 'Mrs. Agnes Ocloo (Demo Record)',
    invalidBallots: 18,
    blankOverallBallots: 32,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Demo Tally Aggregation',
        actorRole: 'Frontend Preview',
        timestamp: '2025-09-28T17:02:00Z',
        notes: 'Sample tie record on Valco Hall JCR General Secretary (1,075 vs 1,075).'
      },
      {
        stage: 'published',
        actorId: 'adm-001',
        actorName: 'Dr. Joseph E. Tetteh',
        actorRole: 'Electoral Commissioner (Demo)',
        timestamp: '2025-09-29T11:00:00Z',
        notes: 'Sample published results record for frontend demonstration.'
      }
    ],
    positionTallies: {
      'pos-val-pres': {
        candidateVotes: { 'cand-val-01': 1120, 'cand-val-02': 690, 'cand-val-03': 350 },
        blankVotes: 32,
        invalidVotes: 18
      },
      'pos-val-sec': {
        candidateVotes: { 'cand-val-04': 1075, 'cand-val-05': 1075 },
        blankVotes: 42,
        invalidVotes: 18
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Business', eligibleVoters: 920, ballotsCast: 735 },
        { label: 'School of Physical Sciences', eligibleVoters: 640, ballotsCast: 502 },
        { label: 'Faculty of Social Sciences', eligibleVoters: 580, ballotsCast: 438 },
        { label: 'Faculty of Educational Foundations', eligibleVoters: 540, ballotsCast: 412 },
        { label: 'School of Biological Sciences', eligibleVoters: 152, ballotsCast: 112 },
        { label: 'School of Law (Hall Annex Cohort)', eligibleVoters: 18, ballotsCast: 11 }
      ],
      byDepartment: [
        { label: 'Accounting & Finance', eligibleVoters: 540, ballotsCast: 436 },
        { label: 'Computer Science & IT', eligibleVoters: 320, ballotsCast: 259 },
        { label: 'Economics', eligibleVoters: 310, ballotsCast: 241 },
        { label: 'Arts & Social Sciences Education', eligibleVoters: 380, ballotsCast: 295 },
        { label: 'Biochemistry & Molecular Bio', eligibleVoters: 152, ballotsCast: 112 },
        { label: 'Optometry Clinical Annex', eligibleVoters: 19, ballotsCast: 14 }
      ],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 710, ballotsCast: 525 },
        { label: 'Level 200', eligibleVoters: 740, ballotsCast: 582 },
        { label: 'Level 300', eligibleVoters: 730, ballotsCast: 590 },
        { label: 'Level 400', eligibleVoters: 670, ballotsCast: 513 }
      ],
      byHall: [
        { label: 'Valco Hall Main Blocks A-C', eligibleVoters: 1450, ballotsCast: 1185 },
        { label: 'Valco Hall Annex Blocks D-E', eligibleVoters: 1100, ballotsCast: 832 },
        { label: 'Valco Non-Resident Affiliates', eligibleVoters: 300, ballotsCast: 193 }
      ]
    }
  },
  {
    electionId: 'UCC-BUS-2026',
    workflowStage: 'audit',
    invalidBallots: 12,
    blankOverallBallots: 38,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Demo Tally Aggregation',
        actorRole: 'Frontend Preview',
        timestamp: '2026-11-05T17:04:00Z',
        notes: 'Sample preliminary tally loaded for frontend review preview.'
      },
      {
        stage: 'audit',
        actorId: 'adm-002',
        actorName: 'Ing. Kwabena Acheampong',
        actorRole: 'Super Administrator (Demo)',
        timestamp: '2026-11-05T19:25:00Z',
        notes: 'Awaiting demo certification step.'
      }
    ],
    positionTallies: {
      'pos-bus-pres': {
        candidateVotes: { 'cand-bus-01': 1680, 'cand-bus-02': 1210 },
        blankVotes: 38,
        invalidVotes: 12
      },
      'pos-bus-fin': {
        candidateVotes: { 'cand-bus-03': 1510, 'cand-bus-04': 1300 },
        blankVotes: 118,
        invalidVotes: 12
      }
    },
    cohorts: {
      byFaculty: [{ label: 'School of Business', eligibleVoters: 4200, ballotsCast: 2940 }],
      byDepartment: [
        { label: 'Accounting', eligibleVoters: 1350, ballotsCast: 985 },
        { label: 'Finance', eligibleVoters: 1050, ballotsCast: 762 },
        { label: 'Marketing & Supply Chain', eligibleVoters: 920, ballotsCast: 635 },
        { label: 'Human Resource Management', eligibleVoters: 860, ballotsCast: 544 },
        { label: 'Executive MBA Exchange Cohort', eligibleVoters: 20, ballotsCast: 14 }
      ],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 1120, ballotsCast: 745 },
        { label: 'Level 200', eligibleVoters: 1080, ballotsCast: 752 },
        { label: 'Level 300', eligibleVoters: 1040, ballotsCast: 765 },
        { label: 'Level 400', eligibleVoters: 960, ballotsCast: 678 }
      ],
      byHall: [
        { label: 'Casely Hayford Hall', eligibleVoters: 680, ballotsCast: 512 },
        { label: 'Valco Hall', eligibleVoters: 790, ballotsCast: 584 },
        { label: 'Adehye Hall', eligibleVoters: 620, ballotsCast: 452 },
        { label: 'Oguaa Hall', eligibleVoters: 690, ballotsCast: 486 },
        { label: 'Kwame Nkrumah Hall', eligibleVoters: 740, ballotsCast: 510 },
        { label: 'Atlantic Hall', eligibleVoters: 680, ballotsCast: 396 }
      ]
    }
  },
  {
    electionId: 'UCC-SRC-2026',
    workflowStage: 'preliminary',
    invalidBallots: 45,
    blankOverallBallots: 125,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Frontend Demo Telemetry',
        actorRole: 'Preview Mode',
        timestamp: new Date().toISOString(),
        notes: 'Sample live election tally data for frontend admin UI demonstration.'
      }
    ],
    positionTallies: {
      'pos-src-pres': {
        candidateVotes: { 'cand-01': 7892, 'cand-02': 6728 },
        blankVotes: 125,
        invalidVotes: 45
      },
      'pos-src-sec': {
        candidateVotes: { 'cand-03': 8140, 'cand-04': 5610 },
        blankVotes: 995,
        invalidVotes: 45
      },
      'pos-src-treas': {
        candidateVotes: { 'cand-05': 12900 },
        blankVotes: 1845,
        invalidVotes: 45
      },
      'pos-src-pro': {
        candidateVotes: { 'cand-06': 7120, 'cand-07': 6710 },
        blankVotes: 915,
        invalidVotes: 45
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Physical Sciences', eligibleVoters: 4590, ballotsCast: 3140 },
        { label: 'School of Business', eligibleVoters: 6540, ballotsCast: 4200 },
        { label: 'Faculty of Arts & Social Sciences', eligibleVoters: 8530, ballotsCast: 5100 },
        { label: 'Faculty of Educational Foundations', eligibleVoters: 3560, ballotsCast: 1620 },
        { label: 'School of Medical Sciences', eligibleVoters: 1610, ballotsCast: 718 },
        { label: 'Faculty of Law (Special Cohort)', eligibleVoters: 20, ballotsCast: 12 }
      ],
      byDepartment: [
        { label: 'Computer Science & IT', eligibleVoters: 1150, ballotsCast: 824 },
        { label: 'Accounting & Finance', eligibleVoters: 2650, ballotsCast: 1745 },
        { label: 'Communication Studies', eligibleVoters: 1420, ballotsCast: 912 },
        { label: 'Educational Foundations', eligibleVoters: 1950, ballotsCast: 1098 },
        { label: 'Medicine & Surgery', eligibleVoters: 1120, ballotsCast: 615 },
        { label: 'Archaeology & Heritage Studies', eligibleVoters: 18, ballotsCast: 9 }
      ],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 6420, ballotsCast: 3480 },
        { label: 'Level 200', eligibleVoters: 6280, ballotsCast: 3790 },
        { label: 'Level 300', eligibleVoters: 6150, ballotsCast: 3920 },
        { label: 'Level 400', eligibleVoters: 6000, ballotsCast: 3600 }
      ],
      byHall: [
        { label: 'Casely Hayford Hall', eligibleVoters: 3200, ballotsCast: 2180 },
        { label: 'Valco Hall', eligibleVoters: 2850, ballotsCast: 1890 },
        { label: 'Oguaa Hall', eligibleVoters: 3650, ballotsCast: 2210 },
        { label: 'Adehye Hall', eligibleVoters: 3100, ballotsCast: 1940 },
        { label: 'Atlantic Hall', eligibleVoters: 3450, ballotsCast: 2090 },
        { label: 'Kwame Nkrumah Hall', eligibleVoters: 3850, ballotsCast: 2380 },
        { label: 'Off-Campus Hostels (Amamoma/Kokoado)', eligibleVoters: 4750, ballotsCast: 2100 }
      ]
    }
  },
  {
    electionId: 'UCC-CAS-2026',
    workflowStage: 'preliminary',
    invalidBallots: 8,
    blankOverallBallots: 22,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Frontend Demo Telemetry',
        actorRole: 'Preview Mode',
        timestamp: new Date().toISOString(),
        notes: 'Casford JCR demo tally data.'
      }
    ],
    positionTallies: {
      'pos-cas-pres': {
        candidateVotes: { 'cand-cas-01': 1240, 'cand-cas-02': 940 },
        blankVotes: 22,
        invalidVotes: 8
      },
      'pos-cas-sec': {
        candidateVotes: { 'cand-cas-03': 1890 },
        blankVotes: 312,
        invalidVotes: 8
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Physical Sciences', eligibleVoters: 980, ballotsCast: 720 },
        { label: 'School of Business', eligibleVoters: 860, ballotsCast: 615 },
        { label: 'Faculty of Arts & Social Sciences', eligibleVoters: 780, ballotsCast: 520 },
        { label: 'Faculty of Educational Foundations', eligibleVoters: 580, ballotsCast: 355 }
      ],
      byDepartment: [
        { label: 'Computer Science & IT', eligibleVoters: 420, ballotsCast: 318 },
        { label: 'Management & HR', eligibleVoters: 490, ballotsCast: 344 },
        { label: 'English & Linguistics', eligibleVoters: 380, ballotsCast: 262 }
      ],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 810, ballotsCast: 520 },
        { label: 'Level 200', eligibleVoters: 820, ballotsCast: 560 },
        { label: 'Level 300', eligibleVoters: 800, ballotsCast: 590 },
        { label: 'Level 400', eligibleVoters: 770, ballotsCast: 540 }
      ],
      byHall: [
        { label: 'Casely Hayford Main Block', eligibleVoters: 2100, ballotsCast: 1520 },
        { label: 'Casely Hayford Annex / Affiliates', eligibleVoters: 1100, ballotsCast: 690 }
      ]
    }
  },
  {
    electionId: 'UCC-ADE-2026',
    workflowStage: 'preliminary',
    invalidBallots: 4,
    blankOverallBallots: 12,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Frontend Demo Telemetry',
        actorRole: 'Preview Mode',
        timestamp: new Date().toISOString(),
        notes: 'Adehye Hall JCRC demo tally data.'
      }
    ],
    positionTallies: {
      'pos-ade-pres': {
        candidateVotes: { 'cand-ade-01': 1020, 'cand-ade-02': 820 },
        blankVotes: 12,
        invalidVotes: 4
      },
      'pos-ade-wel': {
        candidateVotes: { 'cand-ade-03': 1610 },
        blankVotes: 242,
        invalidVotes: 4
      },
      'pos-ade-fin': {
        candidateVotes: { 'cand-ade-04': 1590 },
        blankVotes: 262,
        invalidVotes: 4
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'Faculty of Educational Foundations', eligibleVoters: 1050, ballotsCast: 650 },
        { label: 'School of Business', eligibleVoters: 890, ballotsCast: 540 },
        { label: 'Faculty of Arts', eligibleVoters: 640, ballotsCast: 390 },
        { label: 'School of Biological Sciences', eligibleVoters: 520, ballotsCast: 276 }
      ],
      byDepartment: [],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 820, ballotsCast: 440 },
        { label: 'Level 200', eligibleVoters: 790, ballotsCast: 480 },
        { label: 'Level 300', eligibleVoters: 770, ballotsCast: 492 },
        { label: 'Level 400', eligibleVoters: 720, ballotsCast: 444 }
      ],
      byHall: [{ label: 'Adehye Hall Residents & Affiliates', eligibleVoters: 3100, ballotsCast: 1856 }]
    }
  },
  {
    electionId: 'UCC-GRA-2026',
    workflowStage: 'preliminary',
    invalidBallots: 6,
    blankOverallBallots: 18,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Frontend Demo Telemetry',
        actorRole: 'Preview Mode',
        timestamp: new Date().toISOString(),
        notes: 'GRASAG-UCC 2026/2027 postgraduate demo tally data.'
      }
    ],
    positionTallies: {
      'pos-gra26-pres': {
        candidateVotes: { 'cand-gra26-01': 1210, 'cand-gra26-02': 930 },
        blankVotes: 18,
        invalidVotes: 6
      },
      'pos-gra26-sec': {
        candidateVotes: { 'cand-gra26-03': 1840 },
        blankVotes: 318,
        invalidVotes: 6
      },
      'pos-gra26-fin': {
        candidateVotes: { 'cand-gra26-04': 1810 },
        blankVotes: 348,
        invalidVotes: 6
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Physical Sciences', eligibleVoters: 1120, ballotsCast: 445 },
        { label: 'School of Business', eligibleVoters: 1450, ballotsCast: 580 },
        { label: 'Faculty of Educational Foundations', eligibleVoters: 1680, ballotsCast: 642 },
        { label: 'Faculty of Arts', eligibleVoters: 740, ballotsCast: 278 },
        { label: 'School of Biological Sciences', eligibleVoters: 630, ballotsCast: 219 }
      ],
      byDepartment: [],
      byLevel: [
        { label: 'Postgraduate (M.Phil./M.Sc./M.A.)', eligibleVoters: 4480, ballotsCast: 1690 },
        { label: 'Postgraduate (Ph.D.)', eligibleVoters: 1140, ballotsCast: 474 }
      ],
      byHall: [
        { label: 'Superannuation Hostel', eligibleVoters: 1920, ballotsCast: 785 },
        { label: 'Valco Graduate Hostel', eligibleVoters: 1380, ballotsCast: 560 },
        { label: 'Off-Campus Postgraduate Affiliates', eligibleVoters: 2320, ballotsCast: 819 }
      ]
    }
  },
  {
    electionId: 'UCC-NUGS-2026',
    workflowStage: 'preliminary',
    invalidBallots: 18,
    blankOverallBallots: 44,
    workflowHistory: [
      {
        stage: 'preliminary',
        actorId: 'system',
        actorName: 'Frontend Demo Telemetry',
        actorRole: 'Preview Mode',
        timestamp: new Date().toISOString(),
        notes: 'UCC Local NUGS 2026/2027 demo tally data.'
      }
    ],
    positionTallies: {
      'pos-nugs-pres': {
        candidateVotes: { 'cand-nugs-01': 5180, 'cand-nugs-02': 4240 },
        blankVotes: 44,
        invalidVotes: 18
      },
      'pos-nugs-sec': {
        candidateVotes: { 'cand-nugs-03': 8110 },
        blankVotes: 1354,
        invalidVotes: 18
      },
      'pos-nugs-wocom': {
        candidateVotes: { 'cand-nugs-04': 8050 },
        blankVotes: 1414,
        invalidVotes: 18
      }
    },
    cohorts: {
      byFaculty: [
        { label: 'School of Physical Sciences', eligibleVoters: 5100, ballotsCast: 1820 },
        { label: 'School of Business', eligibleVoters: 6800, ballotsCast: 2390 },
        { label: 'Faculty of Arts & Social Sciences', eligibleVoters: 9200, ballotsCast: 3040 },
        { label: 'Faculty of Educational Foundations', eligibleVoters: 4900, ballotsCast: 1420 },
        { label: 'Faculty of Law', eligibleVoters: 1200, ballotsCast: 412 },
        { label: 'School of Medical & Biological Sciences', eligibleVoters: 1700, ballotsCast: 400 }
      ],
      byDepartment: [],
      byLevel: [
        { label: 'Level 100', eligibleVoters: 6900, ballotsCast: 2010 },
        { label: 'Level 200', eligibleVoters: 6600, ballotsCast: 2290 },
        { label: 'Level 300', eligibleVoters: 6500, ballotsCast: 2450 },
        { label: 'Level 400', eligibleVoters: 6300, ballotsCast: 2140 },
        { label: 'Postgraduate', eligibleVoters: 2600, ballotsCast: 592 }
      ],
      byHall: []
    }
  }
];

export function normalizeText(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function categoryToDomainId(
  category?: ElectionCategory | string,
  domains: DomainRegistryItem[] = TEMP_DOMAINS_REGISTRY
): DomainId {
  switch (category) {
    case 'SRC':
      return 'src';
    case 'JCR / Hall':
      return 'jcrc_hall';
    case 'GRASAG':
      return 'grasag';
    case 'Local NUGS':
      return 'local_nugs';
    case 'Departmental':
      return 'departmental';
    case 'Faculty / School':
      return 'faculty_school';
    default:
      if (category) {
        const lower = category.toLowerCase();
        const found = domains.find(
          (d) => d.category.toLowerCase() === lower || d.id.toLowerCase() === lower
        );
        if (found) return found.id;
      }
      return 'src';
  }
}

export function domainIdToCategory(
  domainId?: DomainId,
  domains: DomainRegistryItem[] = TEMP_DOMAINS_REGISTRY
): ElectionCategory {
  if (!domainId) return 'SRC';
  const dom = domains.find((d) => d.id === domainId);
  if (dom) return dom.category;
  switch (domainId) {
    case 'src':
      return 'SRC';
    case 'jcrc_hall':
      return 'JCR / Hall';
    case 'grasag':
      return 'GRASAG';
    case 'local_nugs':
      return 'Local NUGS';
    case 'departmental':
      return 'Departmental';
    case 'faculty_school':
      return 'Faculty / School';
    default:
      return 'Other';
  }
}

export function matchesHallName(studentHall: string | undefined, targetHall: string | undefined): boolean {
  const s = normalizeText(studentHall);
  const t = normalizeText(targetHall);
  if (!s || !t) return false;
  if (s === t) return true;
  const sClean = s.replace(/\bhall\b/g, '').trim();
  const tClean = t.replace(/\bhall\b/g, '').trim();
  if (sClean && tClean && sClean === tClean) return true;
  if (
    (s.includes('casford') || s.includes('casely hayford')) &&
    (t.includes('casford') || t.includes('casely hayford'))
  ) {
    return true;
  }
  if ((s.includes('kwame nkrumah') || s === 'knh') && (t.includes('kwame nkrumah') || t === 'knh')) {
    return true;
  }
  if ((s.includes('atlantic') || s === 'atl') && (t.includes('atlantic') || t === 'atl')) {
    return true;
  }
  return false;
}

export function evaluateTempStudentEligibility(
  student: Pick<
    StudentProfile,
    'isEligible' | 'status' | 'level' | 'faculty' | 'department' | 'programme' | 'hall'
  >,
  election: Election
): { isEligible: boolean; reason: string; checks: Record<string, boolean> } {
  const isSuspended = student.status === 'suspended';
  const accountActive = !isSuspended && student.isEligible;
  const crit = election.eligibilityCriteria || {};
  const domainId = election.domainId || categoryToDomainId(election.category);

  let domainMatch = true;
  let domainReason = '';
  if (domainId === 'grasag' && student.level !== 'Postgraduate') {
    domainMatch = false;
    domainReason = 'GRASAG elections are restricted exclusively to Postgraduate students.';
  } else if (domainId === 'src' && student.level === 'Postgraduate') {
    domainMatch = false;
    domainReason = 'SRC elections are restricted to undergraduate students (Levels 100–400).';
  }

  const levelMatch =
    !crit.levels || crit.levels.length === 0 || crit.levels.includes(student.level);

  const facultyMatch =
    !crit.faculties ||
    crit.faculties.length === 0 ||
    crit.faculties.some((f) => normalizeText(student.faculty).includes(normalizeText(f)));

  const departmentMatch =
    !crit.departments ||
    crit.departments.length === 0 ||
    crit.departments.some((d) => normalizeText(student.department).includes(normalizeText(d)));

  const programmeMatch =
    !crit.programmes ||
    crit.programmes.length === 0 ||
    crit.programmes.some((p) => normalizeText(student.programme).includes(normalizeText(p)));

  const hallMatch =
    !crit.halls ||
    crit.halls.length === 0 ||
    crit.halls.some((h) => matchesHallName(student.hall, h));

  const isEligible =
    accountActive &&
    domainMatch &&
    levelMatch &&
    facultyMatch &&
    departmentMatch &&
    programmeMatch &&
    hallMatch;

  let reason = 'Verified eligible in temporary frontend mock registry.';
  if (!accountActive) {
    reason = 'Account is currently suspended or inactive in demo registry.';
  } else if (!domainMatch) {
    reason = domainReason;
  } else if (!levelMatch) {
    reason = `Restricted to Levels ${crit.levels?.join(', ')} (Your level: ${student.level}).`;
  } else if (!facultyMatch) {
    reason = `Restricted to ${crit.faculties?.join(', ')}.`;
  } else if (!departmentMatch) {
    reason = `Restricted to ${crit.departments?.join(', ')}.`;
  } else if (!programmeMatch) {
    reason = `Restricted to ${crit.programmes?.join(', ')}.`;
  } else if (!hallMatch) {
    reason = `Restricted to accredited members of ${crit.halls?.join(', ')}.`;
  }

  return {
    isEligible,
    reason,
    checks: {
      accountActive,
      domainMatch,
      levelMatch,
      facultyMatch,
      departmentMatch,
      programmeMatch,
      hallMatch
    }
  };
}

export function getPermissionsForRole(role: AdminRoleType): string[] {
  switch (role) {
    case 'Super Administrator':
      return ['all_systems', 'manage_admins', 'manage_domains', 'system_config', 'audit_all'];
    case 'Electoral Commissioner':
      return ['manage_elections', 'certify_results', 'audit_ballots', 'verify_students'];
    case 'Returning Officer':
      return ['verify_students', 'publish_provisional', 'view_turnout'];
    case 'Results Auditor':
      return ['inspect_checksums', 'validate_tallies', 'audit_logs'];
    default:
      return ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'];
  }
}
