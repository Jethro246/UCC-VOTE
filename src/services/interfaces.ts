import {
  AdminProfile,
  DomainId,
  DomainRegistryItem,
  ElectionCategory,
  StudentProfile,
} from '../types';

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  email?: string;
  userRole?: 'student' | 'admin';
  user?: StudentProfile | AdminProfile;
}

export interface EligibilityResult {
  isEligible: boolean;
  reason: string;
  checks: Record<string, boolean>;
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

export interface ElectionCandidateAssignmentDraft {
  contestantId?: string;
  isNewContestant?: boolean;
  // Permanent profile fields
  fullName: string;
  studentId: string;
  nickname?: string;
  email?: string;
  phone?: string;
  department: string;
  faculty: string;
  programme?: string;
  level: string;
  hall: string;
  photoUrl: string;
  photoStoragePath?: string;
  biography?: string;
  leadershipExperience: string[];
  updatePermanentProfile?: boolean;
  permanentProfileFieldsChanged?: string[];
  // Election-specific fields
  positionIndex?: number;
  positionId?: string;
  positionTitle?: string;
  electionPhotoUrl?: string;
  campaignStatement?: string;
  manifestoSummary: string;
  fullManifesto: string[];
  keyPromises: string[];
  videoUrl?: string;
  applicationStatus?: 'Draft' | 'Submitted' | 'Under review' | 'Approved';
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
  rules?: string[];
  eligibilityCriteria?: {
    faculties?: string[];
    departments?: string[];
    programmes?: string[];
    levels?: string[];
    halls?: string[];
  };
  positions: {
    title: string;
    description?: string;
    maxSelections?: number;
    allowsSkip?: boolean;
    candidateEligibilityRules?: string;
    votingRules?: string;
  }[];
  candidateAssignments?: ElectionCandidateAssignmentDraft[];
  guidelinesUrl?: string;
}
