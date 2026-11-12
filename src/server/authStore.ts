import { hashPassword } from './cryptoUtils.ts';

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
  role: 'Super Administrator' | 'Electoral Commissioner' | 'Returning Officer' | 'Results Auditor';
  department: string;
  permissions: string[];
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
  expiresAt: number; // timestamp
  createdAt: number;
  ipAddress?: string;
  userAgent?: string;
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
    | 'ELECTION_STATUS_CHANGE'
    | 'CREATE_POSITION'
    | 'DELETE_POSITION'
    | 'SUBMIT_CANDIDATE_APPLICATION'
    | 'UPDATE_CANDIDATE_PROFILE'
    | 'APPROVE_CANDIDATE_NOMINATION'
    | 'REJECT_CANDIDATE_NOMINATION'
    | 'REQUEST_CANDIDATE_CORRECTIONS'
    | 'WITHDRAW_CANDIDATE_NOMINATION'
    | 'ASSIGN_CANDIDATE_POSITION';
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
      hasVotedElections: ['UCC-GRA-2025', 'UCC-VAL-2025'],
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
  ]
]);

// Initial Administrative Accounts
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
      permissions: ['all_systems', 'manage_admins', 'system_config', 'audit_all'],
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
      passwordHash: adminPwd.hash,
      passwordSalt: adminPwd.salt,
      status: 'active'
    }
  ]
]);

// Active Sessions Store: token -> SessionData
export const ACTIVE_SESSIONS: Map<string, SessionData> = new Map();

// Password Reset Tokens: token -> { identifier, expiresAt }
export const RESET_TOKENS: Map<string, { identifier: string; expiresAt: number; code: string }> = new Map();

// Failed login attempt tracking: identifier_or_ip -> { count: number, lockedUntil: number }
export const RATE_LIMIT_CACHE: Map<string, { count: number; lockedUntil: number }> = new Map();

// Audit logs
export const AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-001',
    timestamp: '2026-11-10T14:45:12Z',
    eventType: 'LOGIN_SUCCESS',
    userId: 'PS/CSC/22/0089',
    identifier: 'PS/CSC/22/0089',
    role: 'Student',
    ipAddress: '197.255.124.18',
    status: 'SUCCESS',
    details: 'Student Kofi Mensah Sarbah authenticated successfully'
  },
  {
    id: 'aud-002',
    timestamp: '2026-11-10T13:20:00Z',
    eventType: 'LOGIN_SUCCESS',
    userId: 'UCC/EC/ST/2019/04',
    identifier: 'UCC/EC/ST/2019/04',
    role: 'Electoral Commissioner',
    ipAddress: '197.255.124.33',
    status: 'SUCCESS',
    details: 'Commissioner Dr. Joseph E. Tetteh logged into Electoral Console'
  }
];

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
