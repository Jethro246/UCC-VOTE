export type UserRole = 'guest' | 'student' | 'admin';

export type AdminRoleType = 'Super Administrator' | 'Electoral Commissioner' | 'Returning Officer' | 'Results Auditor';

export interface StudentProfile {
  id: string;
  studentId: string; // e.g. PS/CSC/21/0042
  indexNumber: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  faculty: string;
  programme: string;
  level: '100' | '200' | '300' | '400' | 'Postgraduate';
  hall: string; // e.g. Casely Hayford Hall, Valco Hall, Oguaa Hall, Kwame Nkrumah Hall, Atlantic Hall, Adehye Hall
  isEligible: boolean;
  status?: 'active' | 'suspended' | 'unverified';
  avatarUrl?: string;
  emergencyContact?: string;
  notificationPreferences?: {
    emailAlerts: boolean;
    smsBulletins: boolean;
    resultsAnnouncements: boolean;
  };
  hasVotedElections: string[]; // election IDs
}

export interface AdminProfile {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  role: AdminRoleType;
  department: string;
  permissions: string[];
}

export type ElectionCategory = 'SRC' | 'JCR / Hall' | 'Departmental' | 'Faculty / School' | 'GRASAG' | 'Other';

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
}

export type BallotSelectionMap = Record<string, string[]>;

export interface VoteConfirmationReceipt {
  confirmationRef: string;
  receiptHash: string;
  electionId: string;
  electionTitle: string;
  electionCategory: ElectionCategory;
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
  timestamp: string;
  read: boolean;
  linkAction?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  electionCategory: ElectionCategory;
  startDate: string;
  endDate: string;
  type: 'nomination' | 'vetting' | 'campaign' | 'voting' | 'results';
  location: string;
  description: string;
}

export interface ComplaintTicket {
  id: string;
  ticketNumber: string;
  studentName: string;
  studentId: string;
  category: 'technical' | 'eligibility' | 'irregularity' | 'general';
  subject: string;
  description: string;
  status: 'pending' | 'in_review' | 'resolved';
  submittedAt: string;
  response?: string;
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
