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
    order?: number;
    candidateEligibilityRules?: string;
    votingRules?: string;
  }[];
  initialStatus?: 'draft' | 'pending_approval' | 'scheduled' | 'live';
  idempotencyKey?: string;
  guidelinesUrl?: string;
}
