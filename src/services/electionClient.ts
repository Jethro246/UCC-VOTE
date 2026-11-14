/**
 * TEMPORARY FRONTEND-ONLY ELECTION DATA CLIENT
 *
 * Implements IElectionDataService using temporary browser mock data
 * (mockStateStore) and delegates voting and admin operations to
 * votingService and adminService. No backend API calls are made.
 *
 * Replace with real backend HTTP/GraphQL calls when integrating a backend.
 */

import type { Candidate, DomainId, Election, Position } from '../types';
import {
  categoryToDomainId,
  evaluateTempStudentEligibility
} from '../data/temporaryMockRegistry';
import { authClient } from './authClient';
import { mockStateStore } from './mockStateStore';
import { votingService } from './votingService';
import { adminService } from './adminService';
import type {
  CreateElectionPayload,
  DomainWithStats,
  EligibilityResult,
  IElectionDataService
} from './interfaces';

export type { CreateElectionPayload, DomainWithStats, EligibilityResult } from './interfaces';

function computeDomainStats(domainId: DomainId): DomainWithStats['stats'] {
  const domElections = mockStateStore.elections.filter(
    (e) => (e.domainId || categoryToDomainId(e.category, mockStateStore.domains)) === domainId
  );
  const domElectionIds = new Set(domElections.map((e) => e.id));
  const approvedCandidatesCount = mockStateStore.candidates.filter(
    (c) => domElectionIds.has(c.electionId) && c.applicationStatus === 'Approved'
  ).length;

  return {
    totalElections: domElections.length,
    activeElections: domElections.filter((e) => e.status === 'live').length,
    upcomingElections: domElections.filter(
      (e) => e.status === 'upcoming' || e.status === 'scheduled'
    ).length,
    completedElections: domElections.filter(
      (e) => e.status === 'closed' || e.status === 'results_published'
    ).length,
    pendingCertification: domElections.filter(
      (e) => e.status === 'results_pending_certification'
    ).length,
    totalVotesCast: domElections.reduce((acc, e) => acc + (e.totalVotesCast || 0), 0),
    approvedCandidatesCount
  };
}

class FrontendDemoElectionService implements IElectionDataService {
  async getDomains() {
    const domains: DomainWithStats[] = mockStateStore.domains
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((d) => ({
        ...d,
        stats: computeDomainStats(d.id)
      }));

    return {
      success: true,
      domains,
      halls: [...mockStateStore.halls],
      faculties: [...mockStateStore.faculties],
      departments: [...mockStateStore.departments],
      positionsByElection: { ...mockStateStore.positionsByElection }
    };
  }

  async getDomainById(
    domainId: DomainId,
    filters?: { hallId?: string; facultyId?: string; departmentId?: string; status?: string }
  ) {
    const domain = mockStateStore.domains.find((d) => d.id === domainId);
    if (!domain) {
      return {
        success: false,
        elections: [],
        positionsByElection: {},
        candidates: [],
        error: `Domain "${domainId}" not found.`
      };
    }

    let elections = mockStateStore.elections.filter(
      (e) => (e.domainId || categoryToDomainId(e.category, mockStateStore.domains)) === domainId
    );
    if (filters?.hallId) elections = elections.filter((e) => e.hallId === filters.hallId);
    if (filters?.facultyId) elections = elections.filter((e) => e.facultyId === filters.facultyId);
    if (filters?.departmentId)
      elections = elections.filter((e) => e.departmentId === filters.departmentId);
    if (filters?.status) elections = elections.filter((e) => e.status === filters.status);

    const electionIds = new Set(elections.map((e) => e.id));
    const positionsByElection: Record<string, Position[]> = {};
    elections.forEach((e) => {
      positionsByElection[e.id] = mockStateStore.positionsByElection[e.id] || [];
    });

    const candidates = mockStateStore.candidates.filter((c) => electionIds.has(c.electionId));

    return {
      success: true,
      domain,
      elections,
      positionsByElection,
      candidates,
      subdomains: {
        halls: [...mockStateStore.halls],
        faculties: [...mockStateStore.faculties],
        departments: [...mockStateStore.departments]
      }
    };
  }

  async getElections(params?: {
    category?: string;
    domainId?: string;
    hallId?: string;
    facultyId?: string;
    departmentId?: string;
    status?: string;
    search?: string;
  }) {
    let list = [...mockStateStore.elections];
    if (params?.category && params.category !== 'All') {
      list = list.filter((e) => e.category === params.category);
    }
    if (params?.domainId && params.domainId !== 'all') {
      list = list.filter((e) => e.domainId === params.domainId);
    }
    if (params?.hallId) list = list.filter((e) => e.hallId === params.hallId);
    if (params?.facultyId) list = list.filter((e) => e.facultyId === params.facultyId);
    if (params?.departmentId) list = list.filter((e) => e.departmentId === params.departmentId);
    if (params?.status && params.status !== 'All') {
      list = list.filter((e) => e.status === params.status);
    }
    if (params?.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      total: list.length,
      elections: list
    };
  }

  async getElectionById(id: string) {
    const election = mockStateStore.elections.find((e) => e.id === id);
    if (!election) {
      return { success: false, error: 'Election not found in temporary mock store.' };
    }
    return {
      success: true,
      election,
      positions: mockStateStore.positionsByElection[id] || []
    };
  }

  async checkEligibility(electionId: string, studentId?: string) {
    const election = mockStateStore.elections.find((e) => e.id === electionId);
    if (!election) {
      return { success: false, error: 'Election not found.' };
    }

    const targetId = studentId?.trim() || authClient.getStoredUser()?.studentId;
    if (!targetId) {
      return { success: false, error: 'Provide a Student ID to test eligibility.' };
    }

    const account = mockStateStore.findStudentById(targetId);
    if (account) {
      const result = evaluateTempStudentEligibility(account, election);
      return {
        success: true,
        result,
        studentId: account.studentId,
        studentName: account.fullName
      };
    }

    const reg = mockStateStore.officialRegistry[targetId.toUpperCase()];
    if (reg) {
      const result = evaluateTempStudentEligibility(
        {
          isEligible: reg.isEnrolled,
          status: reg.isEnrolled ? 'active' : 'suspended',
          level: reg.level,
          faculty: reg.faculty,
          department: reg.department,
          programme: reg.programme,
          hall: reg.hall
        },
        election
      );
      return {
        success: true,
        result,
        studentId: reg.studentId,
        studentName: reg.fullName
      };
    }

    return {
      success: false,
      error: `Student ID "${targetId}" was not found in the temporary mock student registry.`
    };
  }

  async getCandidates(params?: {
    electionId?: string;
    positionId?: string;
    domainId?: string;
    status?: string;
    approvedOnly?: boolean;
    department?: string;
    faculty?: string;
    search?: string;
  }) {
    let list = [...mockStateStore.candidates];
    if (params?.electionId) list = list.filter((c) => c.electionId === params.electionId);
    if (params?.positionId) list = list.filter((c) => c.positionId === params.positionId);
    if (params?.domainId) list = list.filter((c) => c.domainId === params.domainId);
    if (params?.approvedOnly) list = list.filter((c) => c.applicationStatus === 'Approved');
    if (params?.status) list = list.filter((c) => c.applicationStatus === params.status);
    if (params?.department) list = list.filter((c) => c.department === params.department);
    if (params?.faculty) list = list.filter((c) => c.faculty === params.faculty);
    if (params?.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q) ||
          c.studentId.toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      total: list.length,
      candidates: list
    };
  }

  async getCandidateById(id: string) {
    const candidate = mockStateStore.candidates.find((c) => c.id === id);
    if (!candidate) {
      return { success: false, error: 'Candidate not found.' };
    }
    return { success: true, candidate };
  }

  async registerCandidate(payload: Partial<Candidate> & { isDraft?: boolean }) {
    if (!payload.fullName?.trim() || !payload.studentId?.trim() || !payload.electionId || !payload.positionId) {
      return { success: false, error: 'Full name, student ID, election, and position are required.' };
    }

    const newCandidate: Candidate = {
      id: `cand-demo-${Date.now()}`,
      electionId: payload.electionId,
      positionId: payload.positionId,
      domainId: payload.domainId,
      fullName: payload.fullName.trim(),
      studentId: payload.studentId.trim().toUpperCase(),
      nickname: payload.nickname,
      email: payload.email,
      department: payload.department || 'Computer Science & Information Technology',
      faculty: payload.faculty || 'School of Physical Sciences',
      programme: payload.programme,
      level: payload.level || '300',
      hall: payload.hall || 'Casely Hayford Hall',
      photoUrl: payload.photoUrl || '',
      biography: payload.biography,
      manifestoSummary: payload.manifestoSummary || '',
      fullManifesto: payload.fullManifesto || [],
      keyPromises: payload.keyPromises || [],
      leadershipExperience: payload.leadershipExperience || [],
      videoUrl: payload.videoUrl,
      applicationStatus: payload.isDraft ? 'Draft' : 'Submitted',
      submittedAt: new Date().toISOString(),
      votesReceived: 0
    };

    mockStateStore.candidates.unshift(newCandidate);
    return {
      success: true,
      candidate: newCandidate,
      message: payload.isDraft
        ? 'Candidate draft saved in temporary frontend store.'
        : 'Candidate nomination saved in temporary frontend store for UI review.'
    };
  }

  async updateCandidate(id: string, updates: Partial<Candidate> & { resubmit?: boolean }) {
    const cand = mockStateStore.candidates.find((c) => c.id === id);
    if (!cand) return { success: false, error: 'Candidate not found.' };

    const { resubmit, ...rest } = updates;
    Object.assign(cand, rest);
    if (resubmit) {
      cand.applicationStatus = 'Submitted';
      cand.correctionNotes = undefined;
    }

    return {
      success: true,
      candidate: cand,
      message: 'Candidate record updated in temporary frontend store.'
    };
  }

  async getPublishedResults(electionId: string) {
    const results = mockStateStore.computeElectionResults(electionId, false);
    if (!results) {
      return { success: false, error: 'Election not found in temporary store.' };
    }
    if (!results.isPublished) {
      return {
        success: false,
        results,
        error:
          'Individual candidate tallies remain hidden until results are marked published in the demo workflow.'
      };
    }
    return { success: true, results };
  }

  // Delegated Voting Interface methods
  getBallot = (electionId: string) => votingService.getBallot(electionId);
  submitBallot = (electionId: string, selections: any, idempotencyKey?: string) =>
    votingService.submitBallot(electionId, selections, idempotencyKey);
  getVoteConfirmation = (electionId: string) => votingService.getVoteConfirmation(electionId);
  getMyConfirmations = () => votingService.getMyConfirmations();

  // Delegated Admin & Governance Interface methods
  createDomain = (payload: Parameters<typeof adminService.createDomain>[0]) =>
    adminService.createDomain(payload);
  createSubdomain = (
    domainId: DomainId,
    payload: Parameters<typeof adminService.createSubdomain>[1]
  ) => adminService.createSubdomain(domainId, payload);
  createElection = (payload: CreateElectionPayload) => adminService.createElection(payload);
  updateElection = (id: string, updates: Partial<Election>) =>
    adminService.updateElection(id, updates);
  changeStatus = (id: string, newStatus: any, justification?: string) =>
    adminService.changeStatus(id, newStatus, justification);
  addPosition = (
    electionId: string,
    position: Parameters<typeof adminService.addPosition>[1]
  ) => adminService.addPosition(electionId, position);
  updatePosition = (
    electionId: string,
    posId: string,
    updates: Parameters<typeof adminService.updatePosition>[2]
  ) => adminService.updatePosition(electionId, posId, updates);
  deletePosition = (electionId: string, posId: string) =>
    adminService.deletePosition(electionId, posId);
  verifyCandidateEligibility = (id: string) => adminService.verifyCandidateEligibility(id);
  approveCandidate = (id: string) => adminService.approveCandidate(id);
  rejectCandidate = (id: string, reason: string) => adminService.rejectCandidate(id, reason);
  requestCandidateCorrections = (id: string, notes: string) =>
    adminService.requestCandidateCorrections(id, notes);
  withdrawCandidate = (id: string, reason?: string) =>
    adminService.withdrawCandidate(id, reason);
  assignCandidatePosition = (id: string, electionId: string, positionId: string) =>
    adminService.assignCandidatePosition(id, electionId, positionId);
  getAdminElectionResults = (electionId: string) =>
    adminService.getAdminElectionResults(electionId);
  advanceResultsWorkflow = (
    electionId: string,
    targetStage: any,
    notes?: string,
    actorName?: string
  ) => adminService.advanceResultsWorkflow(electionId, targetStage, notes, actorName);
  downloadElectionReport = (
    electionId: string,
    format: 'pdf' | 'csv',
    reportType: 'full' | 'results' | 'turnout' | 'candidates' | 'positions'
  ) => adminService.downloadElectionReport(electionId, format, reportType);
  getAdminAccounts = () => adminService.getAdminAccounts();
  createAdminAccount = (payload: Parameters<typeof adminService.createAdminAccount>[0]) =>
    adminService.createAdminAccount(payload);
  updateAdminScope = (
    staffId: string,
    payload: Parameters<typeof adminService.updateAdminScope>[1]
  ) => adminService.updateAdminScope(staffId, payload);
  getAuditLogs = () => adminService.getAuditLogs();
  updateStudentStatus = (studentId: string, status: 'active' | 'suspended') =>
    adminService.updateStudentStatus(studentId, status);
  attemptAdminBallotInspect = (studentId: string) =>
    adminService.attemptAdminBallotInspect(studentId);
  getVotingAuditSummary = (electionId: string) =>
    adminService.getVotingAuditSummary(electionId);
}

export const electionClient = new FrontendDemoElectionService();
export { votingService, adminService };
