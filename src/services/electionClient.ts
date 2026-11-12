import {
  Election,
  ElectionCategory,
  ElectionStatus,
  Position,
  Candidate,
  CandidateApplicationStatus,
  BallotSelectionMap,
  VoteConfirmationReceipt,
  ElectionResultsPayload,
  ResultsWorkflowStage
} from '../types';
import { authClient } from './authClient';

export interface CreateElectionPayload {
  title: string;
  code?: string;
  description: string;
  category: ElectionCategory;
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

export const electionClient = {
  /**
   * Fetch all elections
   */
  async getElections(params?: { category?: string; status?: string; search?: string }): Promise<{
    success: boolean;
    total: number;
    elections: Election[];
    error?: string;
  }> {
    try {
      const query = new URLSearchParams();
      if (params?.category) query.append('category', params.category);
      if (params?.status) query.append('status', params.status);
      if (params?.search) query.append('search', params.search);

      const res = await fetch(`/api/elections?${query.toString()}`);
      return await res.json();
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
      const res = await fetch(`/api/elections/${encodeURIComponent(id)}`);
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/elections/${encodeURIComponent(electionId)}/check-eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ studentId })
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch('/api/elections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/elections/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(updates)
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/elections/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ newStatus, justification })
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/elections/${encodeURIComponent(electionId)}/positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(position)
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/elections/${encodeURIComponent(electionId)}/positions/${encodeURIComponent(posId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return await res.json();
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
      if (params?.status) query.append('status', params.status);
      if (params?.approvedOnly) query.append('approvedOnly', 'true');
      if (params?.department) query.append('department', params.department);
      if (params?.faculty) query.append('faculty', params.faculty);
      if (params?.search) query.append('search', params.search);

      const res = await fetch(`/api/candidates?${query.toString()}`);
      return await res.json();
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
      const res = await fetch(`/api/candidates/${encodeURIComponent(id)}`);
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/candidates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(updates)
      });
      return await res.json();
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
      const res = await fetch(`/api/candidates/${encodeURIComponent(id)}/verify-eligibility`, {
        method: 'POST'
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/candidates/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/candidates/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ reason })
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/candidates/${encodeURIComponent(id)}/request-corrections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ notes })
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/candidates/${encodeURIComponent(id)}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ reason })
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/candidates/${encodeURIComponent(id)}/assign-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ electionId, positionId })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // PHASE 6: SECURE DIGITAL VOTING ENGINE
  // ==========================================

  /**
   * Load dynamic authorized digital ballot for an election
   */
  async getBallot(electionId: string): Promise<{
    success: boolean;
    code?: string;
    error?: string;
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
      const token = authClient.getToken();
      const res = await fetch(`/api/voting/ballot/${encodeURIComponent(electionId)}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch('/api/voting/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ electionId, selections, idempotencyKey })
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/voting/confirmation/${encodeURIComponent(electionId)}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch('/api/voting/my-confirmations', {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/voting/admin/inspect-ballot/${encodeURIComponent(studentId)}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/voting/audit-summary/${encodeURIComponent(electionId)}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/results/${encodeURIComponent(electionId)}/admin`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(`/api/results/${encodeURIComponent(electionId)}/workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ targetStage, notes, actorName })
      });
      return await res.json();
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
      const token = authClient.getToken();
      const res = await fetch(
        `/api/results/${encodeURIComponent(electionId)}/export?format=${encodeURIComponent(format)}&type=${encodeURIComponent(reportType)}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );

      if (!res.ok) {
        let errorMessage = `Export failed with status ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson?.error) errorMessage = errJson.error;
        } catch {
          // ignore non-JSON error body
        }
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
  }
};
