import { Election, ElectionCategory, ElectionStatus, Position } from '../types';
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
  }
};
