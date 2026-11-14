import {
  Election,
  ElectionCategory,
  ElectionStatus,
  Position,
  Candidate,
  BallotSelectionMap,
  VoteConfirmationReceipt,
  ElectionResultsPayload,
  ResultsWorkflowStage,
  DomainId,
  DomainRegistryItem,
  HallUnit,
  FacultyUnit,
  DepartmentUnit,
  AdminProfile,
  AdminRoleType,
  NotificationItem,
  CalendarEvent,
  PublicPlatformStats,
  AdminOverviewStats
} from '../types';
import { authClient } from './authClient';

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
  isDraft?: boolean;
  isPublished?: boolean;
  allowsEmptyBallot?: boolean;
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

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const electionClient = {
  /**
   * Fetch all institutional election domains, halls, faculties, departments, and positions
   */
  async getDomains(): Promise<{
    success: boolean;
    domains: DomainWithStats[];
    halls: HallUnit[];
    faculties: FacultyUnit[];
    departments: DepartmentUnit[];
    positionsByElection: Record<string, Position[]>;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/domains');
      return (
        (await safeJson(res)) || {
          success: false,
          domains: [],
          halls: [],
          faculties: [],
          departments: [],
          positionsByElection: {},
          error: `Server error (${res.status})`
        }
      );
    } catch (err: any) {
      return {
        success: false,
        domains: [],
        halls: [],
        faculties: [],
        departments: [],
        positionsByElection: {},
        error: err.message
      };
    }
  },

  /**
   * Fetch a single domain with filtered elections, positions, candidates, and subdomain units
   */
  async getDomainById(
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
  }> {
    try {
      const query = new URLSearchParams();
      if (filters?.hallId) query.append('hallId', filters.hallId);
      if (filters?.facultyId) query.append('facultyId', filters.facultyId);
      if (filters?.departmentId) query.append('departmentId', filters.departmentId);
      if (filters?.status) query.append('status', filters.status);

      const res = await authClient.authorizedFetch(
        `/api/domains/${encodeURIComponent(domainId)}?${query.toString()}`
      );
      return (
        (await safeJson(res)) || {
          success: false,
          elections: [],
          positionsByElection: {},
          candidates: [],
          error: `Server error (${res.status})`
        }
      );
    } catch (err: any) {
      return {
        success: false,
        elections: [],
        positionsByElection: {},
        candidates: [],
        error: err.message
      };
    }
  },

  /**
   * Super Admin: Create a new university election domain dynamically
   */
  async createDomain(payload: {
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
  }): Promise<{ success: boolean; domain?: DomainRegistryItem; message?: string; error?: string }> {
    try {
      const res = await authClient.authorizedFetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Super Admin / EC: Add a new Hall, Faculty/School, or Department subdomain
   */
  async createSubdomain(
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
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/domains/${encodeURIComponent(domainId)}/subdomains`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch all elections with optional domain/subdomain filters
   */
  async getElections(params?: {
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
  }> {
    try {
      const query = new URLSearchParams();
      if (params?.category) query.append('category', params.category);
      if (params?.domainId) query.append('domainId', params.domainId);
      if (params?.hallId) query.append('hallId', params.hallId);
      if (params?.facultyId) query.append('facultyId', params.facultyId);
      if (params?.departmentId) query.append('departmentId', params.departmentId);
      if (params?.status) query.append('status', params.status);
      if (params?.search) query.append('search', params.search);

      const res = await authClient.authorizedFetch(`/api/elections?${query.toString()}`);
      return (await safeJson(res)) || { success: false, total: 0, elections: [], error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, total: 0, elections: [], error: err.message };
    }
  },

  /**
   * Get single election with positions
   */
  async getElectionById(id: string): Promise<{
    success: boolean;
    election?: Election;
    positions?: Position[];
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/elections/${encodeURIComponent(id)}`);
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Check eligibility for a student
   */
  async checkEligibility(electionId: string, studentId?: string): Promise<{
    success: boolean;
    result?: EligibilityResult;
    studentId?: string;
    studentName?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/elections/${encodeURIComponent(electionId)}/check-eligibility`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId })
        }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Create a new election (Admin)
   */
  async createElection(payload: CreateElectionPayload): Promise<{
    success: boolean;
    election?: Election;
    positions?: Position[];
    error?: string;
    message?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Update election parameters (Admin)
   */
  async updateElection(id: string, updates: Partial<Election>): Promise<{
    success: boolean;
    election?: Election;
    error?: string;
    message?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/elections/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete draft/unvoted election (Admin)
   */
  async deleteElection(id: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/elections/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Change election status (State Machine transition)
   */
  async changeStatus(id: string, newStatus: ElectionStatus, justification?: string): Promise<{
    success: boolean;
    election?: Election;
    error?: string;
    message?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/elections/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus, justification })
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Add a position to an election
   */
  async addPosition(electionId: string, position: {
    title: string;
    description?: string;
    maxSelections?: number;
    allowsSkip?: boolean;
    candidateEligibilityRules?: string;
    votingRules?: string;
  }): Promise<{
    success: boolean;
    position?: Position;
    allPositions?: Position[];
    error?: string;
    message?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/elections/${encodeURIComponent(electionId)}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(position)
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Update a position within an election dynamically
   */
  async updatePosition(
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
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/elections/${encodeURIComponent(electionId)}/positions/${encodeURIComponent(posId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a position from an election
   */
  async deletePosition(electionId: string, posId: string): Promise<{
    success: boolean;
    remainingPositions?: Position[];
    error?: string;
    message?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/elections/${encodeURIComponent(electionId)}/positions/${encodeURIComponent(posId)}`,
        { method: 'DELETE' }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch candidates with optional filters
   */
  async getCandidates(params?: {
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
  }> {
    try {
      const query = new URLSearchParams();
      if (params?.electionId) query.append('electionId', params.electionId);
      if (params?.positionId) query.append('positionId', params.positionId);
      if (params?.domainId) query.append('domainId', params.domainId);
      if (params?.status) query.append('status', params.status);
      if (params?.approvedOnly) query.append('approvedOnly', 'true');
      if (params?.department) query.append('department', params.department);
      if (params?.faculty) query.append('faculty', params.faculty);
      if (params?.search) query.append('search', params.search);

      const res = await authClient.authorizedFetch(`/api/candidates?${query.toString()}`);
      return (await safeJson(res)) || { success: false, total: 0, candidates: [], error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, total: 0, candidates: [], error: err.message };
    }
  },

  /**
   * Fetch single candidate by ID
   */
  async getCandidateById(id: string): Promise<{
    success: boolean;
    candidate?: Candidate;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/candidates/${encodeURIComponent(id)}`);
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Submit / Register Candidate Application
   */
  async registerCandidate(payload: Partial<Candidate> & { isDraft?: boolean }): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Update candidate profile / details
   */
  async updateCandidate(id: string, updates: Partial<Candidate> & { resubmit?: boolean }): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/candidates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Automated Student Registry & Eligibility Verification
   */
  async verifyCandidateEligibility(id: string): Promise<{
    success: boolean;
    isEligible?: boolean;
    reason?: string;
    details?: any;
    candidate?: Candidate;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/candidates/${encodeURIComponent(id)}/verify-eligibility`,
        { method: 'POST' }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Admin approves candidate nomination
   */
  async approveCandidate(id: string): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/candidates/${encodeURIComponent(id)}/approve`, {
        method: 'POST'
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Admin rejects candidate nomination with stated reason
   */
  async rejectCandidate(id: string, reason: string): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/candidates/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Admin requests corrections from candidate
   */
  async requestCandidateCorrections(id: string, notes: string): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/candidates/${encodeURIComponent(id)}/request-corrections`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes })
        }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Candidate or Admin voluntary withdrawal
   */
  async withdrawCandidate(id: string, reason?: string): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(`/api/candidates/${encodeURIComponent(id)}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Admin assigns candidate to position
   */
  async assignCandidatePosition(id: string, electionId: string, positionId: string): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/candidates/${encodeURIComponent(id)}/assign-position`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ electionId, positionId })
        }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // SECURE DIGITAL VOTING ENGINE
  // ==========================================

  /**
   * Load dynamic authorized digital ballot for an election
   */
  async getBallot(electionId: string): Promise<{
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
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/voting/ballot/${encodeURIComponent(electionId)}`
      );
      const data = await safeJson(res);

      if (!data) {
        return {
          success: false,
          httpStatus: res.status,
          code: res.status >= 500 ? 'SERVER_ERROR' : 'BALLOT_LOAD_FAILED',
          error:
            res.status >= 500
              ? 'The election voting service is temporarily unavailable. Please try again.'
              : `Unable to load ballot (HTTP ${res.status}).`
        };
      }

      if (res.status >= 500) {
        return {
          ...data,
          success: false,
          httpStatus: res.status,
          code: data.code || 'SERVER_ERROR',
          error:
            data.error ||
            'The election voting service encountered a temporary server error. Please retry.'
        };
      }

      if (res.status === 401) {
        return {
          ...data,
          success: false,
          httpStatus: 401,
          code: data.code || 'SESSION_EXPIRED',
          error:
            data.code === 'AUTH_REQUIRED'
              ? data.error
              : 'Your session has expired. Please log in again to continue.'
        };
      }

      return { ...data, httpStatus: res.status };
    } catch (err: any) {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        error: err.message || 'Network connection lost while loading ballot.'
      };
    }
  },

  /**
   * Submit digital ballot atomically to the server
   */
  async submitBallot(
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
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/voting/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ electionId, selections, idempotencyKey })
      });
      const data = await safeJson(res);

      if (!data) {
        return {
          success: false,
          httpStatus: res.status,
          code: res.status >= 500 ? 'SERVER_ERROR' : 'SUBMISSION_FAILED',
          error:
            res.status >= 500
              ? 'Server error during ballot submission. Please verify your participation status before retrying.'
              : `Ballot submission failed (HTTP ${res.status}).`
        };
      }

      if (res.status === 401) {
        return {
          ...data,
          success: false,
          httpStatus: 401,
          code: data.code || 'SESSION_EXPIRED',
          error: 'Your session has expired. Please log in again to continue.'
        };
      }

      return { ...data, httpStatus: res.status };
    } catch (err: any) {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        error:
          err.message ||
          'Network error during ballot transmission. Your vote has NOT been confirmed — please check status or retry.'
      };
    }
  },

  /**
   * Retrieve student's vote confirmation receipt (no candidate choices exposed)
   */
  async getVoteConfirmation(electionId: string): Promise<{
    success: boolean;
    receipt?: VoteConfirmationReceipt;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/voting/confirmation/${encodeURIComponent(electionId)}`
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Retrieve all participation confirmations for authenticated student
   */
  async getMyConfirmations(): Promise<{
    success: boolean;
    receipts?: VoteConfirmationReceipt[];
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/voting/my-confirmations');
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Admin Ballot Secrecy Verification Check (Expected 403 BALLOT_SECRECY_VIOLATION_BLOCKED)
   */
  async attemptAdminBallotInspect(studentId: string): Promise<{
    success: boolean;
    code?: string;
    error?: string;
    targetStudentId?: string;
    audited?: boolean;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/voting/admin/inspect-ballot/${encodeURIComponent(studentId)}`
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Admin aggregate vault balance summary
   */
  async getVotingAuditSummary(electionId: string): Promise<{
    success: boolean;
    summary?: any;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/voting/audit-summary/${encodeURIComponent(electionId)}`
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch authoritative election results for admin certification console
   */
  async getAdminElectionResults(electionId: string): Promise<{
    success: boolean;
    results?: ElectionResultsPayload;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/results/${encodeURIComponent(electionId)}/admin`
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Advance election results through the 6-stage verification & publication workflow
   */
  async advanceResultsWorkflow(
    electionId: string,
    targetStage: ResultsWorkflowStage,
    notes?: string,
    actorName?: string
  ): Promise<{
    success: boolean;
    message?: string;
    results?: ElectionResultsPayload;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/results/${encodeURIComponent(electionId)}/workflow`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetStage, notes, actorName })
        }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Download official PDF or CSV election report
   */
  async downloadElectionReport(
    electionId: string,
    format: 'pdf' | 'csv',
    reportType: 'full' | 'results' | 'turnout' | 'candidates' | 'positions'
  ): Promise<{
    success: boolean;
    filename?: string;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/results/${encodeURIComponent(electionId)}/export?format=${encodeURIComponent(format)}&type=${encodeURIComponent(reportType)}`
      );

      if (!res.ok) {
        let errorMessage = `Export failed with status ${res.status}`;
        const errJson = await safeJson(res);
        if (errJson?.error) errorMessage = errJson.error;
        return { success: false, error: errorMessage };
      }

      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename = filenameMatch?.[1] || `UCC_VOTE_${electionId}_${reportType}.${format}`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true, filename };
    } catch (err: any) {
      return { success: false, error: err.message || 'Report export failed.' };
    }
  },

  /**
   * Super Admin: Fetch all administrator accounts with domain scopes
   */
  async getAdminAccounts(): Promise<{
    success: boolean;
    admins: AdminProfile[];
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/admin/admins');
      return (await safeJson(res)) || { success: false, admins: [], error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, admins: [], error: err.message };
    }
  },

  /**
   * Super Admin: Create a new domain-scoped or global administrator account
   */
  async createAdminAccount(payload: {
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
  }): Promise<{ success: boolean; admin?: AdminProfile; message?: string; error?: string }> {
    try {
      const res = await authClient.authorizedFetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Super Admin: Update administrator domain/subdomain scopes
   */
  async updateAdminScope(
    staffId: string,
    payload: {
      role?: AdminRoleType;
      managedDomainIds?: DomainId[];
      managedHalls?: string[];
      managedFaculties?: string[];
      managedDepartments?: string[];
    }
  ): Promise<{ success: boolean; admin?: AdminProfile; message?: string; error?: string }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/admin/admins/${encodeURIComponent(staffId)}/scope`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getNotifications(): Promise<{
    success: boolean;
    notifications: NotificationItem[];
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/notifications');
      return (
        (await safeJson(res)) || {
          success: false,
          notifications: [],
          error: `Server error (${res.status})`
        }
      );
    } catch (err: any) {
      return { success: false, notifications: [], error: err.message };
    }
  },

  async markNotificationRead(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await authClient.authorizedFetch(
        `/api/notifications/${encodeURIComponent(id)}/read`,
        { method: 'POST' }
      );
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async markAllNotificationsRead(): Promise<{
    success: boolean;
    notifications?: NotificationItem[];
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/notifications/read-all', {
        method: 'POST'
      });
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getCalendarEvents(domainId?: string): Promise<{
    success: boolean;
    events: CalendarEvent[];
    error?: string;
  }> {
    try {
      const query = domainId ? `?domainId=${encodeURIComponent(domainId)}` : '';
      const res = await authClient.authorizedFetch(`/api/calendar${query}`);
      return (
        (await safeJson(res)) || {
          success: false,
          events: [],
          error: `Server error (${res.status})`
        }
      );
    } catch (err: any) {
      return { success: false, events: [], error: err.message };
    }
  },

  async getPublicStats(): Promise<{
    success: boolean;
    stats?: PublicPlatformStats;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/elections/stats/public');
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getAdminOverview(): Promise<{
    success: boolean;
    stats?: AdminOverviewStats;
    error?: string;
  }> {
    try {
      const res = await authClient.authorizedFetch('/api/admin/overview');
      return (await safeJson(res)) || { success: false, error: `Server error (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
