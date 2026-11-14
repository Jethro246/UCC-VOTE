import fs from 'fs';
import os from 'os';
import path from 'path';
import { hashPassword } from './cryptoUtils.ts';
import type { AdminRoleType, DomainId } from '../types/index.ts';

export interface OfficialRegistryStudent {
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

export interface StoredStudentAccount {
  id: string;
  studentId: string;
  indexNumber: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContact?: string;
  department: string;
  faculty: string;
  programme: string;
  level: '100' | '200' | '300' | '400' | 'Postgraduate';
  hall: string;
  passwordHash: string;
  passwordSalt: string;
  status: 'active' | 'suspended' | 'pending_verification';
  isEligible: boolean;
  emailVerified: boolean;
  notificationPreferences: {
    emailAlerts: boolean;
    smsBulletins: boolean;
    resultsAnnouncements: boolean;
  };
  hasVotedElections: string[];
  createdAt: string;
  lastLogin?: string;
}

export interface StoredAdminAccount {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  role: AdminRoleType;
  department: string;
  permissions: string[];
  managedDomainIds?: DomainId[];
  managedHalls?: string[];
  managedFaculties?: string[];
  managedDepartments?: string[];
  isDemoAccount?: boolean;
  passwordHash: string;
  passwordSalt: string;
  status: 'active' | 'suspended';
  lastLogin?: string;
}

export interface SessionData {
  token: string;
  userId: string;
  role: string;
  userType: 'student' | 'admin';
  managedDomainIds?: DomainId[];
  managedHalls?: string[];
  managedFaculties?: string[];
  managedDepartments?: string[];
  expiresAt: number; // timestamp
  createdAt: number;
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
  rememberMe?: boolean;
}

export interface RefreshSessionData {
  refreshToken: string;
  userId: string;
  role: string;
  userType: 'student' | 'admin';
  expiresAt: number;
  createdAt: number;
  rememberMe?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: 
    | 'LOGIN_SUCCESS' 
    | 'LOGIN_FAILED' 
    | 'ACCOUNT_LOCKED' 
    | 'REGISTRATION' 
    | 'PASSWORD_RESET' 
    | 'UNAUTHORIZED_ACCESS' 
    | 'STATUS_CHANGE'
    | 'CREATE_ELECTION'
    | 'UPDATE_ELECTION'
    | 'DELETE_ELECTION'
    | 'ELECTION_STATUS_CHANGE'
    | 'CREATE_POSITION'
    | 'DELETE_POSITION'
    | 'UPDATE_POSITION'
    | 'CREATE_DOMAIN'
    | 'CREATE_SUBDOMAIN'
    | 'UPDATE_HALL_BRANDING'
    | 'UPDATE_ADMIN_SCOPE'
    | 'SUBMIT_CANDIDATE_APPLICATION'
    | 'UPDATE_CANDIDATE_PROFILE'
    | 'APPROVE_CANDIDATE_NOMINATION'
    | 'REJECT_CANDIDATE_NOMINATION'
    | 'REQUEST_CANDIDATE_CORRECTIONS'
    | 'WITHDRAW_CANDIDATE_NOMINATION'
    | 'ASSIGN_CANDIDATE_POSITION'
    | 'VOTE_CAST'
    | 'BALLOT_CAST'
    | 'DUPLICATE_VOTE_BLOCKED'
    | 'CONCURRENT_VOTE_BLOCKED'
    | 'VOTING_ACCESS_DENIED'
    | 'BALLOT_SECRECY_VIOLATION_BLOCKED'
    | 'BALLOT_SUBMISSION_REJECTED'
    | 'RESULTS_REPORT_EXPORTED'
    | 'RESULTS_CERTIFIED'
    | 'RESULTS_PUBLISHED'
    | 'RESULTS_WORKFLOW_ADVANCE';
  userId?: string;
  identifier: string;
  role?: string;
  ipAddress: string;
  status: 'SUCCESS' | 'FLAGGED' | 'WARNING';
  details: string;
}

// Authoritative UCC Student Information System Registry (Mock of DAA / SIS)
export const OFFICIAL_UCC_STUDENT_REGISTRY: Record<string, OfficialRegistryStudent> = {
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
  // Test Account: Unactivated Student waiting to test account activation
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
  // Test Account: Inactive / Suspended Student
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
    isEnrolled: false, // suspended enrollment
    cgpaQualified: false
  },
  // Test Account: Level 100 Medical Freshman (Off-campus, eligible for SRC but ineligible for Hall/CS/SPS races)
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
  // Test Account: Postgraduate Student (Eligible for GRASAG & Local NUGS, restricted from SRC undergraduate ballot)
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

// Initial default password hash for demonstration accounts ("Vote@UCC2026")
const defaultPwd = hashPassword('Vote@UCC2026');

export const STUDENT_ACCOUNTS: Map<string, StoredStudentAccount> = new Map([
  [
    'PS/CSC/22/0089',
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
      passwordHash: defaultPwd.hash,
      passwordSalt: defaultPwd.salt,
      status: 'active',
      isEligible: true,
      emailVerified: true,
      notificationPreferences: {
        emailAlerts: true,
        smsBulletins: true,
        resultsAnnouncements: true
      },
      hasVotedElections: [],
      createdAt: '2026-10-01T08:00:00Z',
      lastLogin: new Date().toISOString()
    }
  ],
  [
    'ED/EPS/21/0034',
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
      passwordHash: defaultPwd.hash,
      passwordSalt: defaultPwd.salt,
      status: 'active',
      isEligible: true,
      emailVerified: true,
      notificationPreferences: {
        emailAlerts: true,
        smsBulletins: false,
        resultsAnnouncements: true
      },
      hasVotedElections: [],
      createdAt: '2026-10-02T10:00:00Z'
    }
  ],
  // Test Account: Suspended Student Account for Security Testing
  [
    'AS/HIS/22/0055',
    {
      id: 'stu-003',
      studentId: 'AS/HIS/22/0055',
      indexNumber: '10985512',
      fullName: 'Kojo Adomako Danquah (Suspended Test Account)',
      email: 'kojo.danquah@st.ucc.edu.gh',
      phone: '+233 26 123 9988',
      department: 'History',
      faculty: 'Faculty of Arts',
      programme: 'B.A. History',
      level: '300',
      hall: 'Casely Hayford Hall',
      passwordHash: defaultPwd.hash,
      passwordSalt: defaultPwd.salt,
      status: 'suspended', // Account administratively frozen
      isEligible: false,
      emailVerified: true,
      notificationPreferences: {
        emailAlerts: false,
        smsBulletins: false,
        resultsAnnouncements: false
      },
      hasVotedElections: [],
      createdAt: '2026-10-05T12:00:00Z'
    }
  ],
  [
    'MED/SMS/24/0012',
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
      passwordHash: defaultPwd.hash,
      passwordSalt: defaultPwd.salt,
      status: 'active',
      isEligible: true,
      emailVerified: true,
      notificationPreferences: {
        emailAlerts: true,
        smsBulletins: true,
        resultsAnnouncements: true
      },
      hasVotedElections: [],
      createdAt: '2026-10-06T09:00:00Z'
    }
  ],
  [
    'PG/CSC/25/0018',
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
      passwordHash: defaultPwd.hash,
      passwordSalt: defaultPwd.salt,
      status: 'active',
      isEligible: true,
      emailVerified: true,
      notificationPreferences: {
        emailAlerts: true,
        smsBulletins: true,
        resultsAnnouncements: true
      },
      hasVotedElections: [],
      createdAt: '2026-10-06T10:00:00Z'
    }
  ]
]);

// Initial Administrative Accounts (Global + Domain-Scoped RBAC Demonstration Accounts)
const adminPwd = hashPassword('Admin@UCC2026');

export const ADMIN_ACCOUNTS: Map<string, StoredAdminAccount> = new Map([
  [
    'UCC/EC/ST/2019/04',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/ICT/SA/2021/01',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/EC/RO/2022/09',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/AUD/RA/2020/03',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/DOM/SRC/01',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/DOM/CAS/01',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/DOM/VAL/01',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/DOM/GRA/01',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/DOM/NUGS/01',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/DOM/DCS/01',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ],
  [
    'UCC/DOM/SPS/01',
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ]
]);

// Active Sessions Store: accessToken -> SessionData
export const ACTIVE_SESSIONS: Map<string, SessionData> = new Map();

// Refresh Sessions Store: refreshToken -> RefreshSessionData
export const REFRESH_SESSIONS: Map<string, RefreshSessionData> = new Map();

const SESSION_PERSIST_FILE = path.join(os.tmpdir(), 'ucc-vote-sessions.json');

export function loadPersistedSessions() {
  try {
    if (!fs.existsSync(SESSION_PERSIST_FILE)) return;
    const raw = fs.readFileSync(SESSION_PERSIST_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (Array.isArray(parsed?.activeSessions)) {
      for (const [token, sess] of parsed.activeSessions) {
        if (token && sess && typeof sess.expiresAt === 'number' && sess.expiresAt > now) {
          ACTIVE_SESSIONS.set(token, sess);
        }
      }
    }
    if (Array.isArray(parsed?.refreshSessions)) {
      for (const [rToken, rSess] of parsed.refreshSessions) {
        if (rToken && rSess && typeof rSess.expiresAt === 'number' && rSess.expiresAt > now) {
          REFRESH_SESSIONS.set(rToken, rSess);
        }
      }
    }
  } catch {
    // ignore corrupt/unavailable temp file
  }
}

export function persistSessions() {
  try {
    const now = Date.now();
    const activeEntries = Array.from(ACTIVE_SESSIONS.entries()).filter(([, s]) => s.expiresAt > now);
    const refreshEntries = Array.from(REFRESH_SESSIONS.entries()).filter(([, s]) => s.expiresAt > now);
    fs.writeFileSync(
      SESSION_PERSIST_FILE,
      JSON.stringify({ activeSessions: activeEntries, refreshSessions: refreshEntries }),
      'utf8'
    );
  } catch {
    // non-fatal if temp directory isn't writable
  }
}

export function revokeUserSessions(userId: string) {
  for (const [token, sess] of ACTIVE_SESSIONS.entries()) {
    if (sess.userId === userId) {
      ACTIVE_SESSIONS.delete(token);
    }
  }
  for (const [rToken, rSess] of REFRESH_SESSIONS.entries()) {
    if (rSess.userId === userId) {
      REFRESH_SESSIONS.delete(rToken);
    }
  }
  persistSessions();
}

export function findStudentAccountByIdentifier(identifier: string): StoredStudentAccount | undefined {
  const clean = identifier.trim();
  const direct = STUDENT_ACCOUNTS.get(clean);
  if (direct) return direct;
  const lower = clean.toLowerCase();
  for (const acc of STUDENT_ACCOUNTS.values()) {
    if (
      acc.studentId.toLowerCase() === lower ||
      acc.indexNumber.toLowerCase() === lower ||
      acc.id.toLowerCase() === lower
    ) {
      return acc;
    }
  }
  return undefined;
}

export function getOptionalSessionFromRequest(req: {
  headers: { authorization?: string };
  cookies?: Record<string, string>;
}): SessionData | null {
  let token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token && req.cookies && req.cookies.ucc_session) {
    token = req.cookies.ucc_session;
  }
  if (!token) return null;
  const session = ACTIVE_SESSIONS.get(token);
  if (!session || Date.now() > session.expiresAt) return null;
  return session;
}

loadPersistedSessions();

export interface CombinedStudentRecord {
  studentId: string;
  indexNumber: string;
  fullName: string;
  faculty: string;
  department: string;
  programme: string;
  level: '100' | '200' | '300' | '400' | 'Postgraduate';
  hall: string;
  status: 'active' | 'suspended' | 'pending_verification';
  isEligible: boolean;
  isEnrolled: boolean;
  isActivated: boolean;
  hasVotedElections: string[];
}

/**
 * Combines live activated STUDENT_ACCOUNTS with OFFICIAL_UCC_STUDENT_REGISTRY,
 * ensuring live status/eligibility updates take precedence over static registry entries.
 */
export function getCombinedStudentDirectory(): CombinedStudentRecord[] {
  const byId = new Map<string, CombinedStudentRecord>();

  for (const reg of Object.values(OFFICIAL_UCC_STUDENT_REGISTRY)) {
    byId.set(reg.studentId.toUpperCase(), {
      studentId: reg.studentId,
      indexNumber: reg.indexNumber,
      fullName: reg.fullName,
      faculty: reg.faculty,
      department: reg.department,
      programme: reg.programme,
      level: reg.level,
      hall: reg.hall,
      status: reg.isEnrolled ? 'active' : 'suspended',
      isEligible: reg.isEnrolled,
      isEnrolled: reg.isEnrolled,
      isActivated: false,
      hasVotedElections: []
    });
  }

  for (const acc of STUDENT_ACCOUNTS.values()) {
    const key = acc.studentId.toUpperCase();
    const reg = OFFICIAL_UCC_STUDENT_REGISTRY[acc.studentId];
    const isEnrolled = reg ? reg.isEnrolled : true;
    byId.set(key, {
      studentId: acc.studentId,
      indexNumber: acc.indexNumber,
      fullName: acc.fullName,
      faculty: acc.faculty,
      department: acc.department,
      programme: acc.programme,
      level: acc.level,
      hall: acc.hall,
      status: acc.status,
      isEligible: acc.status === 'active' && acc.isEligible && isEnrolled,
      isEnrolled,
      isActivated: true,
      hasVotedElections: acc.hasVotedElections || []
    });
  }

  return Array.from(byId.values());
}

export function getRegisteredAndVerifiedStudentCounts() {
  const directory = getCombinedStudentDirectory();
  const totalRegistryStudents = Object.keys(OFFICIAL_UCC_STUDENT_REGISTRY).length;
  const activatedStudentAccounts = STUDENT_ACCOUNTS.size;
  const registeredStudents = directory.length;
  const verifiedStudents = directory.filter(
    (s) => s.status === 'active' && s.isEligible && s.isEnrolled
  ).length;
  const suspendedAccounts = directory.filter(
    (s) => s.status === 'suspended' || !s.isEnrolled
  ).length;

  return {
    totalRegistryStudents,
    activatedStudentAccounts,
    registeredStudents,
    verifiedStudents,
    suspendedAccounts
  };
}

// Password Reset Tokens: token -> { identifier, expiresAt }
export const RESET_TOKENS: Map<string, { identifier: string; expiresAt: number; code: string }> = new Map();

// Failed login attempt tracking: identifier_or_ip -> { count: number, lockedUntil: number }
export const RATE_LIMIT_CACHE: Map<string, { count: number; lockedUntil: number }> = new Map();

// Audit logs (starts empty; records only real runtime actions)
export const AUDIT_LOGS: AuditLogEntry[] = [];

export function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
  const newEntry: AuditLogEntry = {
    id: 'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    ...entry
  };
  AUDIT_LOGS.unshift(newEntry);
  if (AUDIT_LOGS.length > 500) AUDIT_LOGS.pop();
}

/**
 * Check and record failed login attempt. Returns remaining lockout seconds if locked.
 */
export function checkRateLimit(key: string): { isLocked: boolean; remainingSeconds: number; attempts: number } {
  const now = Date.now();
  const record = RATE_LIMIT_CACHE.get(key);
  if (!record) return { isLocked: false, remainingSeconds: 0, attempts: 0 };

  if (record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds, attempts: record.count };
  }

  // Lock expired
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    RATE_LIMIT_CACHE.delete(key);
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }

  return { isLocked: false, remainingSeconds: 0, attempts: record.count };
}

export function recordFailedAttempt(key: string): { isNowLocked: boolean; remainingSeconds: number; attempts: number } {
  const now = Date.now();
  const record = RATE_LIMIT_CACHE.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;

  if (record.count >= 5) {
    // Lock for 5 minutes (300,000 ms)
    record.lockedUntil = now + 5 * 60 * 1000;
    RATE_LIMIT_CACHE.set(key, record);
    return { isNowLocked: true, remainingSeconds: 300, attempts: record.count };
  }

  RATE_LIMIT_CACHE.set(key, record);
  return { isNowLocked: false, remainingSeconds: 0, attempts: record.count };
}

export function resetRateLimit(key: string) {
  RATE_LIMIT_CACHE.delete(key);
}
