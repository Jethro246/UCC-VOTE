/**
 * FRONTEND SERVICE INTERFACES FOR FUTURE BACKEND INTEGRATION
 *
 * These TypeScript interfaces define the clean boundary between the UCC VOTE
 * React UI/Pages and any future backend API (REST, GraphQL, etc.).
 * Currently implemented solely by temporary frontend-only mock services.
 */

import type {
  AdminProfile,
  AdminRoleType,
  BallotSelectionMap,
  Candidate,
  DepartmentUnit,
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionCategory,
  ElectionResultsPayload,
  ElectionStatus,
  FacultyUnit,
  HallUnit,
  Position,
  ResultsWorkflowStage,
  VoteConfirmationReceipt
} from '../types';

export interface AuthResponse<T = any> {
  success: boolean;
  code?: string;
  httpStatus?: number;
  message?: string;
  error?: string;
  token?: string;
  refreshToken?: string;
  user?: T;
  userRole?: 'student' | 'admin' | 'guest';
  expiresAt?: number;
  attemptsRemaining?: number;
  lockedUntilSeconds?: number;
  canActivate?: boolean;
  demoResetToken?: string;
  demoRecoveryCode?: string;
  found?: boolean;
  isAlreadyRegistered?: boolean;
  student?: any;
  email?: string;
}

export interface DomainWithStats extends DomainRegistryItem {
  stats: {
    totalElections: number;
    activeElections: number;
    upcomingElections: number;
    completedElections: number;
    pendingCertification: number;
    totalVotesCast: number;
    approvedCandidatesCount: number;
  };
}

export interface CreateElectionPayload {
  title: string;
  code?: string;
  description: string;
  category: ElectionCategory;
  domainId?: DomainId;
  hallId?: string;
  facultyId?: string;
  departmentId?: string;
  subdomainLabel?: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  organizingBody: string;
  rules: string[];
  eligibilityCriteria: {
    faculties?: string[];
    departments?: string[];
    programmes?: string[];
    levels?: string[];
    halls?: string[];
  };
  positions?: {
    title: string;
    description?: string;
    maxSelections?: number;
    allowsSkip?: boolean;
    candidateEligibilityRules?: string;
    votingRules?: string;
  }[];
}

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
  checks: Record<string, boolean>;
}

/**
 * Authentication Interface (Ready for future backend auth integration)
 */
export interface IAuthService {
  login(studentId: string, password: string, rememberMe?: boolean): Promise<AuthResponse>;
  adminLogin(
    staffId: string,
    password: string,
    selectedRole: string,
    securityPin?: string
  ): Promise<AuthResponse>;
  register(studentData: any): Promise<AuthResponse>;
  verifyStudentId(studentId: string): Promise<AuthResponse>;
  forgotPassword(studentId: string): Promise<AuthResponse>;
  resetPassword(payload: {
    token?: string;
    code?: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<AuthResponse>;
  getMe(): Promise<AuthResponse>;
  refreshSession(): Promise<AuthResponse>;
  logout(): Promise<void>;
  updateProfile(updates: {
    phone?: string;
    emergencyContact?: string;
    notificationPreferences?: any;
    attemptedIdentityChange?: boolean;
  }): Promise<AuthResponse>;
  changePassword(passwords: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<AuthResponse>;
  getStudentDashboard(): Promise<{
    success: boolean;
    code?: string;
    httpStatus?: number;
    data?: any;
    error?: string;
  }>;
  testAdminAccess(): Promise<AuthResponse>;
}

/**
 * Election & Candidate Data Interface (Ready for future backend integration)
 */
export interface IElectionDataService {
  getDomains(): Promise<{
    success: boolean;
    domains: DomainWithStats[];
    halls: HallUnit[];
    faculties: FacultyUnit[];
    departments: DepartmentUnit[];
    positionsByElection: Record<string, Position[]>;
    error?: string;
  }>;
  getDomainById(
    domainId: DomainId,
    filters?: { hallId?: string; facultyId?: string; departmentId?: string; status?: string }
  ): Promise<{
    success: boolean;
    domain?: DomainRegistryItem;
    elections: Election[];
    positionsByElection: Record<string, Position[]>;
    candidates: Candidate[];
    subdomains?: {
      halls: HallUnit[];
      faculties: FacultyUnit[];
      departments: DepartmentUnit[];
    };
    error?: string;
  }>;
  getElections(params?: {
    category?: string;
    domainId?: string;
    hallId?: string;
    facultyId?: string;
    departmentId?: string;
    status?: string;
    search?: string;
  }): Promise<{
    success: boolean;
    total: number;
    elections: Election[];
    error?: string;
  }>;
  getElectionById(id: string): Promise<{
    success: boolean;
    election?: Election;
    positions?: Position[];
    error?: string;
  }>;
  checkEligibility(
    electionId: string,
    studentId?: string
  ): Promise<{
    success: boolean;
    result?: EligibilityResult;
    studentId?: string;
    studentName?: string;
    error?: string;
  }>;
  getCandidates(params?: {
    electionId?: string;
    positionId?: string;
    domainId?: string;
    status?: string;
    approvedOnly?: boolean;
    department?: string;
    faculty?: string;
    search?: string;
  }): Promise<{
    success: boolean;
    total: number;
    candidates: Candidate[];
    error?: string;
  }>;
  getCandidateById(id: string): Promise<{
    success: boolean;
    candidate?: Candidate;
    error?: string;
  }>;
  registerCandidate(payload: Partial<Candidate> & { isDraft?: boolean }): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }>;
  updateCandidate(
    id: string,
    updates: Partial<Candidate> & { resubmit?: boolean }
  ): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }>;
  getPublishedResults(electionId: string): Promise<{
    success: boolean;
    results?: ElectionResultsPayload;
    error?: string;
  }>;
}

/**
 * Digital Voting Interface (Ready for future secure backend voting service)
 */
export interface IVotingService {
  getBallot(electionId: string): Promise<{
    success: boolean;
    httpStatus?: number;
    code?: string;
    error?: string;
    opensAt?: string;
    closesAt?: string;
    alreadyVoted?: boolean;
    receipt?: VoteConfirmationReceipt;
    election?: Election;
    eligibility?: EligibilityResult;
    positions?: Array<{
      position: Position;
      candidates: Candidate[];
    }>;
  }>;
  submitBallot(
    electionId: string,
    selections: BallotSelectionMap,
    idempotencyKey?: string
  ): Promise<{
    success: boolean;
    httpStatus?: number;
    code?: string;
    message?: string;
    error?: string;
    receipt?: VoteConfirmationReceipt;
    updatedTurnout?: {
      totalVotesCast: number;
      totalEligibleVoters: number;
      turnoutPercentage: number;
    };
  }>;
  getVoteConfirmation(electionId: string): Promise<{
    success: boolean;
    receipt?: VoteConfirmationReceipt;
    error?: string;
  }>;
  getMyConfirmations(): Promise<{
    success: boolean;
    receipts?: VoteConfirmationReceipt[];
    error?: string;
  }>;
}

/**
 * Admin & Governance Data Interface (Ready for future admin backend API)
 */
export interface IAdminDataService {
  createDomain(payload: {
    id?: string;
    name: string;
    shortName?: string;
    category?: ElectionCategory;
    description: string;
    governanceScope?: string;
    eligibilityRuleSummary?: string;
    positionsPolicyNote?: string;
    supportsSubdomains?: boolean;
    subdomainType?: 'hall' | 'department' | 'faculty' | 'none';
  }): Promise<{ success: boolean; domain?: DomainRegistryItem; message?: string; error?: string }>;
  createSubdomain(
    domainId: DomainId,
    payload: {
      type?: 'hall' | 'faculty' | 'department';
      name: string;
      shortName?: string;
      code?: string;
      college?: string;
      facultyId?: string;
      facultyName?: string;
      programmes?: string[];
    }
  ): Promise<{
    success: boolean;
    subdomain?: any;
    halls?: HallUnit[];
    faculties?: FacultyUnit[];
    departments?: DepartmentUnit[];
    error?: string;
  }>;
  createElection(payload: CreateElectionPayload): Promise<{
    success: boolean;
    election?: Election;
    positions?: Position[];
    error?: string;
    message?: string;
  }>;
  updateElection(
    id: string,
    updates: Partial<Election>
  ): Promise<{
    success: boolean;
    election?: Election;
    error?: string;
    message?: string;
  }>;
  changeStatus(
    id: string,
    newStatus: ElectionStatus,
    justification?: string
  ): Promise<{
    success: boolean;
    election?: Election;
    error?: string;
    message?: string;
  }>;
  addPosition(
    electionId: string,
    position: {
      title: string;
      description?: string;
      maxSelections?: number;
      allowsSkip?: boolean;
      candidateEligibilityRules?: string;
      votingRules?: string;
    }
  ): Promise<{
    success: boolean;
    position?: Position;
    allPositions?: Position[];
    error?: string;
    message?: string;
  }>;
  updatePosition(
    electionId: string,
    posId: string,
    updates: {
      title?: string;
      description?: string;
      maxSelections?: number;
      allowsSkip?: boolean;
      candidateEligibilityRules?: string;
      votingRules?: string;
    }
  ): Promise<{
    success: boolean;
    position?: Position;
    allPositions?: Position[];
    error?: string;
    message?: string;
  }>;
  deletePosition(
    electionId: string,
    posId: string
  ): Promise<{
    success: boolean;
    remainingPositions?: Position[];
    error?: string;
    message?: string;
  }>;
  verifyCandidateEligibility(id: string): Promise<{
    success: boolean;
    isEligible?: boolean;
    reason?: string;
    details?: any;
    candidate?: Candidate;
    error?: string;
  }>;
  approveCandidate(id: string): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }>;
  rejectCandidate(
    id: string,
    reason: string
  ): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }>;
  requestCandidateCorrections(
    id: string,
    notes: string
  ): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }>;
  withdrawCandidate(
    id: string,
    reason?: string
  ): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }>;
  assignCandidatePosition(
    id: string,
    electionId: string,
    positionId: string
  ): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }>;
  getAdminElectionResults(electionId: string): Promise<{
    success: boolean;
    results?: ElectionResultsPayload;
    error?: string;
  }>;
  advanceResultsWorkflow(
    electionId: string,
    targetStage: ResultsWorkflowStage,
    notes?: string,
    actorName?: string
  ): Promise<{
    success: boolean;
    message?: string;
    results?: ElectionResultsPayload;
    error?: string;
  }>;
  downloadElectionReport(
    electionId: string,
    format: 'pdf' | 'csv',
    reportType: 'full' | 'results' | 'turnout' | 'candidates' | 'positions'
  ): Promise<{
    success: boolean;
    filename?: string;
    error?: string;
  }>;
  getAdminAccounts(): Promise<{
    success: boolean;
    admins: AdminProfile[];
    error?: string;
  }>;
  createAdminAccount(payload: {
    staffId: string;
    fullName: string;
    email: string;
    role: AdminRoleType;
    department: string;
    password?: string;
    managedDomainIds?: DomainId[];
    managedHalls?: string[];
    managedFaculties?: string[];
    managedDepartments?: string[];
  }): Promise<{ success: boolean; admin?: AdminProfile; message?: string; error?: string }>;
  updateAdminScope(
    staffId: string,
    payload: {
      role?: AdminRoleType;
      managedDomainIds?: DomainId[];
      managedHalls?: string[];
      managedFaculties?: string[];
      managedDepartments?: string[];
    }
  ): Promise<{ success: boolean; admin?: AdminProfile; message?: string; error?: string }>;
  getAuditLogs(): Promise<{ success: boolean; logs: any[] }>;
  updateStudentStatus(
    studentId: string,
    status: 'active' | 'suspended'
  ): Promise<{ success: boolean; error?: string }>;
  attemptAdminBallotInspect(studentId: string): Promise<{
    success: boolean;
    code?: string;
    error?: string;
    targetStudentId?: string;
    audited?: boolean;
  }>;
  getVotingAuditSummary(electionId: string): Promise<{
    success: boolean;
    summary?: any;
    error?: string;
  }>;
}
