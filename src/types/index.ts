export type UserRole = 'guest' | 'student' | 'admin';

export type BuiltInDomainId =
  | 'src'
  | 'jcrc_hall'
  | 'grasag'
  | 'local_nugs'
  | 'departmental'
  | 'faculty_school';

export type DomainId = BuiltInDomainId | (string & {});

export type AdminRoleType =
  | 'Super Administrator'
  | 'Electoral Commissioner'
  | 'SRC Election Administrator'
  | 'Hall Election Administrator'
  | 'GRASAG Election Administrator'
  | 'Local NUGS Election Administrator'
  | 'Departmental Election Administrator'
  | 'Faculty/School Election Administrator'
  | 'Returning Officer'
  | 'Results Auditor';

export interface StudentProfile {
  id: string;
  uid?: string;
  studentId: string; // e.g. PS/CSC/21/0042
  indexNumber: string;
  fullName: string;
  email: string;
  emailVerified?: boolean;
  phone: string;
  department: string;
  faculty: string;
  programme: string;
  level: '100' | '200' | '300' | '400' | 'Postgraduate';
  hall: string;
  isEligible: boolean;
  eligibilityStatus?: 'eligible' | 'pending_verification' | 'suspended' | 'ineligible';
  eligibilityNotes?: string;
  status?: 'active' | 'suspended' | 'unverified';
  avatarUrl?: string;
  photoUrl?: string;
  authProvider?: 'google' | 'email_link' | 'password' | string;
  emergencyContact?: string;
  notificationPreferences?: {
    emailAlerts: boolean;
    smsBulletins: boolean;
    resultsAnnouncements: boolean;
  };
  hasVotedElections: string[]; // election IDs
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface AdminProfile {
  id: string;
  uid?: string;
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
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoterEligibilityRecord {
  id: string; // usually uid or normalized studentId
  uid?: string;
  studentId: string;
  fullName?: string;
  email?: string;
  faculty: string;
  department: string;
  programme?: string;
  level: string;
  hall: string;
  isEligible: boolean;
  status: 'eligible' | 'pending_verification' | 'suspended' | 'ineligible';
  reason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  updatedAt?: string;
}

export type ElectionCategory =
  | 'SRC'
  | 'JCR / Hall'
  | 'GRASAG'
  | 'Local NUGS'
  | 'Departmental'
  | 'Faculty / School'
  | 'Other';

export interface HallUnit {
  id: string;
  code?: string;
  name: string;
  shortName: string;
  displayName?: string;
  motto?: string;
  affiliationNote?: string;
}

export interface FacultyUnit {
  id: string;
  name: string;
  code: string;
  college: string;
}

export interface DepartmentUnit {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  facultyName: string;
  programmes: string[];
}

export interface DomainRegistryItem {
  id: DomainId;
  name: string;
  shortName: string;
  category: ElectionCategory;
  description: string;
  governanceScope: string;
  eligibilityRuleSummary: string;
  positionsPolicyNote: string;
  adminRole: AdminRoleType;
  supportsSubdomains: boolean;
  subdomainType: 'hall' | 'department' | 'faculty' | 'none';
  isBuiltIn: boolean;
  displayOrder: number;
}

export type ElectionStatus =
  | 'draft'
  | 'pending_approval'
  | 'scheduled'
  | 'upcoming' // Backwards compatible alias for scheduled
  | 'live'
  | 'suspended'
  | 'closed'
  | 'results_pending_certification'
  | 'results_published'
  | 'archived';

export type CandidateApplicationStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under review'
  | 'Approved'
  | 'Rejected'
  | 'Withdrawn';

export interface Candidate {
  id: string;
  electionId: string;
  positionId: string;
  domainId?: DomainId;
  hallId?: string;
  facultyId?: string;
  departmentId?: string;
  fullName: string;
  studentId: string;
  nickname?: string;
  email?: string;
  department: string;
  faculty: string;
  programme?: string;
  level: string;
  hall: string;
  photoUrl: string;
  biography?: string;
  manifestoSummary: string;
  fullManifesto: string[];
  keyPromises: string[];
  leadershipExperience: string[];
  videoUrl?: string;
  applicationStatus: CandidateApplicationStatus;
  rejectionReason?: string;
  correctionNotes?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  eligibilityVerified?: boolean;
  eligibilityDetails?: {
    isEnrolled: boolean;
    cgpaQualified: boolean;
    levelMatch: boolean;
    facultyMatch: boolean;
    hallMatch: boolean;
    summary?: string;
  };
  runningMate?: {
    fullName: string;
    studentId: string;
    department: string;
    photoUrl?: string;
  };
  votesReceived?: number;
  votePercentage?: number;
}

export interface Position {
  id: string;
  electionId: string;
  domainId?: DomainId;
  hallId?: string;
  facultyId?: string;
  departmentId?: string;
  title: string;
  description: string;
  maxSelections: number;
  allowsSkip: boolean;
  order: number;
  candidateIds: string[];
  candidateEligibilityRules?: string;
  votingRules?: string;
}

export interface Election {
  id: string;
  title: string;
  code: string;
  description: string;
  category: ElectionCategory;
  domainId?: DomainId;
  hallId?: string;
  facultyId?: string;
  departmentId?: string;
  subdomainLabel?: string;
  academicYear: string;
  status: ElectionStatus;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  totalEligibleVoters: number;
  totalVotesCast: number;
  turnoutPercentage: number;
  organizingBody: string; // e.g. UCC Electoral Commission, Hall Electoral Committee
  eligibilityCriteria: {
    faculties?: string[];
    departments?: string[];
    programmes?: string[];
    levels?: string[];
    halls?: string[];
  };
  rules: string[];
  positionsCount: number;
  allowsEmptyBallot?: boolean;
  resultsCertified: boolean;
  provisionalResultsReady: boolean;
  createdAt?: string;
  updatedAt?: string;
  approvedBy?: string;
  guidelinesUrl?: string;
}

export type BallotSelectionMap = Record<string, string[]>;

export interface VoteConfirmationReceipt {
  confirmationRef: string;
  receiptHash: string;
  electionId: string;
  electionTitle: string;
  electionCategory: ElectionCategory;
  domainId?: DomainId;
  submittedAt: string;
  positionsCompleted: {
    id: string;
    title: string;
    status: 'VOTED' | 'ABSTAINED';
  }[];
  message: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'election' | 'security' | 'deadline' | 'results';
  domainId?: DomainId;
  targetUid?: string | null;
  timestamp: string;
  read: boolean;
  linkAction?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  category: 'general' | 'election' | 'deadline' | 'results' | 'security';
  domainId?: DomainId;
  publishedBy: string;
  publishedAt: string;
  pinned?: boolean;
  active?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  electionCategory: ElectionCategory;
  domainId?: DomainId;
  subdomainLabel?: string;
  startDate: string;
  endDate: string;
  type: 'nomination' | 'vetting' | 'campaign' | 'voting' | 'results';
  location: string;
  description: string;
}

export interface ComplaintTicket {
  id: string;
  uid?: string;
  ticketNumber: string;
  studentName: string;
  studentId: string;
  studentEmail?: string;
  domainId?: DomainId;
  category: 'technical' | 'eligibility' | 'irregularity' | 'general';
  subject: string;
  description: string;
  attachmentUrl?: string;
  status: 'pending' | 'in_review' | 'resolved';
  submittedAt: string;
  updatedAt?: string;
  response?: string;
  resolvedBy?: string;
}

export type ResultsWorkflowStage =
  | 'preliminary'
  | 'verification'
  | 'audit'
  | 'approved'
  | 'certified'
  | 'published';

export interface WorkflowAuditAction {
  stage: ResultsWorkflowStage;
  actorId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  notes: string;
  signatureHash?: string;
}

export interface CandidateResultRow {
  candidateId: string;
  fullName: string;
  nickname?: string;
  studentId: string;
  photoUrl: string;
  department: string;
  faculty: string;
  hall: string;
  votesReceived: number;
  percentageOfValidVotes: number;
  percentageOfTotalBallots: number;
  rank: number;
  isLeading: boolean;
  isWinner: boolean;
  isTied: boolean;
}

export interface PositionResultSummary {
  positionId: string;
  title: string;
  description: string;
  order: number;
  totalValidVotes: number;
  blankVotes: number;
  invalidVotes: number;
  totalBallotsProcessed: number;
  isTie: boolean;
  tiedCandidateIds: string[];
  winnerCandidateIds: string[];
  candidates: CandidateResultRow[];
}

export interface TurnoutBreakdownRow {
  label: string;
  eligibleVoters: number;
  ballotsCast: number | null;
  turnoutPercentage: number | null;
  suppressed: boolean;
  suppressionReason?: string;
}

export interface BallotAccountingSummary {
  totalEligibleVoters: number;
  totalBallotsCast: number;
  validBallots: number;
  invalidBallots: number;
  blankBallots: number;
  uncastBallots: number;
  turnoutPercentage: number;
  validBallotRate: number;
  invalidBallotRate: number;
  blankBallotRate: number;
}

export interface ElectionResultsPayload {
  electionId: string;
  electionTitle: string;
  electionCode: string;
  category: ElectionCategory;
  domainId?: DomainId;
  subdomainLabel?: string;
  status: ElectionStatus;
  academicYear: string;
  organizingBody: string;
  startDate: string;
  endDate: string;
  publishedAt?: string;
  workflowStage: ResultsWorkflowStage;
  workflowHistory: WorkflowAuditAction[];
  isPublished: boolean;
  resultsCertified: boolean;
  certificationHash?: string;
  certifiedBy?: string;
  ballotSummary: BallotAccountingSummary;
  positions: PositionResultSummary[];
  turnoutAnalytics: {
    privacyThreshold: number;
    byFaculty: TurnoutBreakdownRow[];
    byDepartment: TurnoutBreakdownRow[];
    byLevel: TurnoutBreakdownRow[];
    byHall: TurnoutBreakdownRow[];
  };
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  adminName: string;
  adminRole: string;
  action: string;
  target: string;
  ipAddress: string;
  status: 'success' | 'flagged' | 'warning';
}

export type ActiveView =
  | 'landing'
  | 'student_login'
  | 'student_register'
  | 'forgot_password'
  | 'student_dashboard'
  | 'elections_directory'
  | 'domain_elections'
  | 'election_details'
  | 'candidate_directory'
  | 'candidate_profile'
  | 'candidate_register'
  | 'digital_ballot'
  | 'election_results'
  | 'notifications'
  | 'election_calendar'
  | 'student_profile'
  | 'help_support'
  | 'admin_login'
  | 'admin_dashboard';
