/**
 * TEMPORARY FRONTEND-ONLY ADMIN & GOVERNANCE SERVICE
 *
 * Implements IAdminDataService against temporary browser memory (mockStateStore)
 * for frontend UI demonstration only. No backend API or database is connected.
 *
 * Replace method bodies with real backend admin API calls in the future.
 */

import type {
  AdminProfile,
  AdminRoleType,
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionCategory,
  ElectionResultsPayload,
  ElectionStatus,
  Position,
  ResultsWorkflowStage
} from '../types';
import {
  categoryToDomainId,
  domainIdToCategory,
  getPermissionsForRole
} from '../data/temporaryMockRegistry';
import { authClient } from './authClient';
import { mockStateStore } from './mockStateStore';
import type { CreateElectionPayload, IAdminDataService } from './interfaces';

function getCurrentAdminActor() {
  const user = authClient.getStoredUser();
  const role = authClient.getStoredRole();
  return {
    isAdmin: role === 'admin',
    id: user?.id || 'demo-admin',
    name: user?.fullName || 'Demo Administrator',
    roleName: user?.role || 'Electoral Commissioner',
    staffId: user?.staffId || 'DEMO-STAFF'
  };
}

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvReport(
  results: ElectionResultsPayload,
  reportType: 'full' | 'results' | 'turnout' | 'candidates' | 'positions'
): string {
  const lines: string[] = [];
  lines.push('UCC VOTE - TEMPORARY FRONTEND DEMO REPORT (NOT OFFICIAL ELECTION DATA)');
  lines.push(`Election,${escapeCsv(results.electionTitle)}`);
  lines.push(`Code,${escapeCsv(results.electionCode)}`);
  lines.push(`Category,${escapeCsv(results.category)}`);
  lines.push(`Status,${escapeCsv(results.status)}`);
  lines.push(`Workflow Stage,${escapeCsv(results.workflowStage)}`);
  lines.push(`Total Eligible Voters,${results.ballotSummary.totalEligibleVoters}`);
  lines.push(`Total Ballots Cast,${results.ballotSummary.totalBallotsCast}`);
  lines.push(`Turnout Percentage,${results.ballotSummary.turnoutPercentage}%`);
  lines.push('');

  if (reportType === 'full' || reportType === 'results' || reportType === 'candidates' || reportType === 'positions') {
    lines.push('Position,Rank,Candidate,Student ID,Department,Votes,Valid Vote %,Status');
    results.positions.forEach((pos) => {
      pos.candidates.forEach((c) => {
        const status = c.isWinner ? 'Winner' : c.isTied ? 'Tied' : c.isLeading ? 'Leading' : 'Candidate';
        lines.push(
          [
            escapeCsv(pos.title),
            c.rank,
            escapeCsv(c.fullName),
            escapeCsv(c.studentId),
            escapeCsv(c.department),
            c.votesReceived,
            `${c.percentageOfValidVotes}%`,
            status
          ].join(',')
        );
      });
    });
    lines.push('');
  }

  if (reportType === 'full' || reportType === 'turnout') {
    lines.push('Cohort Dimension,Cohort Label,Eligible Voters,Ballots Cast,Turnout %,Privacy Status');
    const appendGroup = (label: string, rows: typeof results.turnoutAnalytics.byFaculty) => {
      rows.forEach((r) => {
        lines.push(
          [
            label,
            escapeCsv(r.label),
            r.eligibleVoters,
            r.suppressed ? 'Suppressed' : r.ballotsCast ?? 0,
            r.suppressed ? 'Suppressed' : `${r.turnoutPercentage ?? 0}%`,
            r.suppressed ? 'Suppressed (< threshold)' : 'Visible'
          ].join(',')
        );
      });
    };
    appendGroup('Faculty', results.turnoutAnalytics.byFaculty);
    appendGroup('Department', results.turnoutAnalytics.byDepartment);
    appendGroup('Level', results.turnoutAnalytics.byLevel);
    appendGroup('Hall', results.turnoutAnalytics.byHall);
  }

  return lines.join('\n');
}

function buildPrintableHtmlReport(results: ElectionResultsPayload, reportType: string): string {
  const positionRows = results.positions
    .map(
      (pos) => `
      <h3>${pos.title} (Valid: ${pos.totalValidVotes})</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th>Rank</th><th>Candidate</th><th>Student ID</th><th>Votes</th><th>% Valid</th>
          </tr>
        </thead>
        <tbody>
          ${pos.candidates
            .map(
              (c) =>
                `<tr><td>#${c.rank}</td><td>${c.fullName}</td><td>${c.studentId}</td><td>${c.votesReceived}</td><td>${c.percentageOfValidVotes}%</td></tr>`
            )
            .join('')}
        </tbody>
      </table>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>UCC VOTE Demo Report - ${results.electionTitle}</title></head>
<body style="font-family:Arial,sans-serif;max-width:900px;margin:24px auto;color:#0f172a;">
  <div style="padding:12px;background:#fef3c7;border:1px solid #f59e0b;margin-bottom:16px;font-size:12px;">
    <strong>TEMPORARY FRONTEND DEMO EXPORT:</strong> Generated locally in the browser with mock data (no backend connected).
  </div>
  <h1>${results.electionTitle} (${results.electionCode})</h1>
  <p>Category: ${results.category} | Stage: ${results.workflowStage.toUpperCase()} | Report Type: ${reportType.toUpperCase()}</p>
  <p>Eligible Voters: ${results.ballotSummary.totalEligibleVoters} | Ballots Cast: ${results.ballotSummary.totalBallotsCast} | Turnout: ${results.ballotSummary.turnoutPercentage}%</p>
  <hr />
  ${positionRows || '<p>Candidate tallies are currently withheld prior to publication.</p>'}
</body>
</html>`;
}

class FrontendDemoAdminService implements IAdminDataService {
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
  }) {
    if (!payload.name?.trim()) {
      return { success: false, error: 'Domain name is required.' };
    }
    const id =
      payload.id?.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') ||
      payload.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

    if (mockStateStore.domains.some((d) => d.id === id)) {
      return { success: false, error: `Domain ID "${id}" already exists in temporary registry.` };
    }

    const newDomain: DomainRegistryItem = {
      id,
      name: payload.name.trim(),
      shortName: payload.shortName?.trim() || payload.name.trim().slice(0, 14),
      category: payload.category || 'Other',
      description: payload.description.trim(),
      governanceScope: payload.governanceScope?.trim() || 'University-approved domain scope',
      eligibilityRuleSummary:
        payload.eligibilityRuleSummary?.trim() || 'Verified registered UCC students in scope.',
      positionsPolicyNote:
        payload.positionsPolicyNote?.trim() || 'Configured per domain guidelines.',
      adminRole: 'Electoral Commissioner',
      supportsSubdomains: Boolean(payload.supportsSubdomains),
      subdomainType: payload.subdomainType || 'none',
      isBuiltIn: false,
      displayOrder: mockStateStore.domains.length + 1
    };

    mockStateStore.domains.push(newDomain);
    mockStateStore.logAuditEvent({
      eventType: 'DEMO_DOMAIN_CREATED',
      identifier: getCurrentAdminActor().staffId,
      role: getCurrentAdminActor().roleName,
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details: `Created temporary election domain "${newDomain.name}".`
    });

    return { success: true, domain: newDomain, message: 'Domain added to temporary frontend store.' };
  }

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
  ) {
    if (!payload.name?.trim()) {
      return { success: false, error: 'Unit name is required.' };
    }

    const subType =
      payload.type ||
      (domainId === 'jcrc_hall'
        ? 'hall'
        : domainId === 'faculty_school'
        ? 'faculty'
        : 'department');

    let subdomain: any;
    if (subType === 'hall') {
      subdomain = {
        id: `hall-${Date.now()}`,
        name: payload.name.trim(),
        shortName: payload.shortName?.trim() || payload.name.trim().slice(0, 10),
        motto: 'UCC Residential Hall'
      };
      mockStateStore.halls.push(subdomain);
    } else if (subType === 'faculty') {
      subdomain = {
        id: `fac-${Date.now()}`,
        name: payload.name.trim(),
        code: payload.code?.trim() || payload.shortName?.trim() || 'FAC',
        college: payload.college?.trim() || 'University of Cape Coast'
      };
      mockStateStore.faculties.push(subdomain);
    } else {
      const parentFac = mockStateStore.faculties.find((f) => f.id === payload.facultyId);
      subdomain = {
        id: `dept-${Date.now()}`,
        name: payload.name.trim(),
        code: payload.code?.trim() || payload.shortName?.trim() || 'DEPT',
        facultyId: payload.facultyId || 'fac-sps',
        facultyName: payload.facultyName || parentFac?.name || 'School of Physical Sciences',
        programmes: payload.programmes || [`B.Sc. ${payload.name.trim()}`]
      };
      mockStateStore.departments.push(subdomain);
    }

    return {
      success: true,
      subdomain,
      halls: mockStateStore.halls,
      faculties: mockStateStore.faculties,
      departments: mockStateStore.departments
    };
  }

  async createElection(payload: CreateElectionPayload) {
    if (!payload.title?.trim() || !payload.startDate || !payload.endDate) {
      return { success: false, error: 'Title, start date, and end date are required.' };
    }

    const domainId = payload.domainId || categoryToDomainId(payload.category, mockStateStore.domains);
    const category = payload.category || domainIdToCategory(domainId, mockStateStore.domains);
    const id = `UCC-DEMO-${Date.now().toString().slice(-6)}`;
    const code =
      payload.code?.trim() ||
      `UCC-${category.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase()}-${new Date().getFullYear()}`;

    const initialPositions: Position[] = (payload.positions || []).map((pos, idx) => ({
      id: `pos-${id.toLowerCase()}-${idx + 1}`,
      electionId: id,
      domainId,
      hallId: payload.hallId,
      facultyId: payload.facultyId,
      departmentId: payload.departmentId,
      title: pos.title,
      description: pos.description || '',
      maxSelections: pos.maxSelections || 1,
      allowsSkip: pos.allowsSkip !== undefined ? pos.allowsSkip : true,
      order: idx + 1,
      candidateIds: [],
      candidateEligibilityRules: pos.candidateEligibilityRules,
      votingRules: pos.votingRules
    }));

    const newElection: Election = {
      id,
      title: payload.title.trim(),
      code,
      description: payload.description.trim(),
      category,
      domainId,
      hallId: payload.hallId,
      facultyId: payload.facultyId,
      departmentId: payload.departmentId,
      subdomainLabel: payload.subdomainLabel,
      academicYear: payload.academicYear || '2026/2027',
      status: 'scheduled',
      startDate: payload.startDate,
      endDate: payload.endDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      totalEligibleVoters: 1200,
      totalVotesCast: 0,
      turnoutPercentage: 0,
      organizingBody: payload.organizingBody || 'UCC Electoral Commission',
      eligibilityCriteria: payload.eligibilityCriteria || {},
      rules: payload.rules || [],
      positionsCount: initialPositions.length,
      resultsCertified: false,
      provisionalResultsReady: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemoRecord: true
    };

    mockStateStore.elections.unshift(newElection);
    mockStateStore.positionsByElection[id] = initialPositions;
    mockStateStore.logAuditEvent({
      eventType: 'DEMO_ELECTION_CREATED',
      identifier: getCurrentAdminActor().staffId,
      role: getCurrentAdminActor().roleName,
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details: `Created temporary election "${newElection.title}" (${newElection.code}).`
    });

    return {
      success: true,
      election: newElection,
      positions: initialPositions,
      message: 'Election created in temporary frontend store.'
    };
  }

  async updateElection(id: string, updates: Partial<Election>) {
    const election = mockStateStore.elections.find((e) => e.id === id);
    if (!election) {
      return { success: false, error: 'Election not found in temporary mock store.' };
    }
    Object.assign(election, updates, { updatedAt: new Date().toISOString() });
    return { success: true, election, message: 'Election updated in temporary store.' };
  }

  async changeStatus(id: string, newStatus: ElectionStatus, justification?: string) {
    const election = mockStateStore.elections.find((e) => e.id === id);
    if (!election) {
      return { success: false, error: 'Election not found in temporary mock store.' };
    }
    const prevStatus = election.status;
    election.status = newStatus;
    election.updatedAt = new Date().toISOString();
    if (newStatus === 'results_published') {
      election.resultsCertified = true;
      const ledger = mockStateStore.getOrCreateLedger(id);
      if (ledger) {
        ledger.workflowStage = 'published';
        ledger.publishedAt = new Date().toISOString();
      }
    }

    mockStateStore.logAuditEvent({
      eventType: 'DEMO_STATUS_TRANSITION',
      identifier: getCurrentAdminActor().staffId,
      role: getCurrentAdminActor().roleName,
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details: `Changed "${election.title}" status from ${prevStatus} to ${newStatus}.${
        justification ? ` Note: ${justification}` : ''
      }`
    });

    return {
      success: true,
      election,
      message: `Election status updated to ${newStatus} in temporary frontend store.`
    };
  }

  async addPosition(
    electionId: string,
    position: {
      title: string;
      description?: string;
      maxSelections?: number;
      allowsSkip?: boolean;
      candidateEligibilityRules?: string;
      votingRules?: string;
    }
  ) {
    const election = mockStateStore.elections.find((e) => e.id === electionId);
    if (!election) return { success: false, error: 'Election not found.' };

    const list = mockStateStore.positionsByElection[electionId] || [];
    const newPos: Position = {
      id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      electionId,
      domainId: election.domainId,
      hallId: election.hallId,
      facultyId: election.facultyId,
      departmentId: election.departmentId,
      title: position.title.trim(),
      description: position.description?.trim() || '',
      maxSelections: position.maxSelections || 1,
      allowsSkip: position.allowsSkip !== undefined ? position.allowsSkip : true,
      order: list.length + 1,
      candidateIds: [],
      candidateEligibilityRules: position.candidateEligibilityRules,
      votingRules: position.votingRules
    };

    const updated = [...list, newPos];
    mockStateStore.positionsByElection[electionId] = updated;
    election.positionsCount = updated.length;

    return {
      success: true,
      position: newPos,
      allPositions: updated,
      message: 'Position added in temporary frontend store.'
    };
  }

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
  ) {
    const list = mockStateStore.positionsByElection[electionId] || [];
    const pos = list.find((p) => p.id === posId);
    if (!pos) return { success: false, error: 'Position not found.' };

    Object.assign(pos, updates);
    return {
      success: true,
      position: pos,
      allPositions: list,
      message: 'Position updated in temporary frontend store.'
    };
  }

  async deletePosition(
    electionId: string,
    posId: string
  ): Promise<{
    success: boolean;
    remainingPositions?: Position[];
    error?: string;
    message?: string;
  }> {
    const list = mockStateStore.positionsByElection[electionId] || [];
    if (!list.some((p) => p.id === posId)) {
      return { success: false, error: 'Position not found in temporary store.' };
    }
    const remaining = list
      .filter((p) => p.id !== posId)
      .map((p, idx) => ({ ...p, order: idx + 1 }));
    mockStateStore.positionsByElection[electionId] = remaining;

    const election = mockStateStore.elections.find((e) => e.id === electionId);
    if (election) election.positionsCount = remaining.length;

    return {
      success: true,
      remainingPositions: remaining,
      message: 'Position removed from temporary frontend store.'
    };
  }

  async verifyCandidateEligibility(id: string) {
    const cand = mockStateStore.candidates.find((c) => c.id === id);
    if (!cand) return { success: false, error: 'Candidate not found.' };

    const reg = mockStateStore.officialRegistry[cand.studentId.toUpperCase()];
    const isEnrolled = reg ? reg.isEnrolled : true;
    const cgpaQualified = reg ? reg.cgpaQualified : true;

    const details = {
      isEnrolled,
      cgpaQualified,
      levelMatch: true,
      facultyMatch: true,
      hallMatch: true,
      summary: reg
        ? 'Matched against temporary mock student registry (demo only).'
        : 'Accepted in temporary frontend preview mode (no SIS connected).'
    };

    const isEligible = isEnrolled && cgpaQualified;
    cand.eligibilityVerified = isEligible;
    cand.eligibilityDetails = details;

    return {
      success: true,
      isEligible,
      reason: details.summary,
      details,
      candidate: cand
    };
  }

  async approveCandidate(id: string) {
    const cand = mockStateStore.candidates.find((c) => c.id === id);
    if (!cand) return { success: false, error: 'Candidate not found.' };

    cand.applicationStatus = 'Approved';
    cand.reviewedAt = new Date().toISOString();
    cand.reviewedBy = getCurrentAdminActor().name;
    cand.rejectionReason = undefined;
    cand.correctionNotes = undefined;

    const list = mockStateStore.positionsByElection[cand.electionId] || [];
    const pos = list.find((p) => p.id === cand.positionId);
    if (pos && !pos.candidateIds.includes(cand.id)) {
      pos.candidateIds.push(cand.id);
    }

    mockStateStore.logAuditEvent({
      eventType: 'DEMO_CANDIDATE_APPROVED',
      identifier: getCurrentAdminActor().staffId,
      role: getCurrentAdminActor().roleName,
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details: `Approved candidate ${cand.fullName} in temporary frontend store.`
    });

    return { success: true, candidate: cand, message: 'Candidate approved in demo store.' };
  }

  async rejectCandidate(id: string, reason: string) {
    const cand = mockStateStore.candidates.find((c) => c.id === id);
    if (!cand) return { success: false, error: 'Candidate not found.' };

    cand.applicationStatus = 'Rejected';
    cand.rejectionReason = reason;
    cand.reviewedAt = new Date().toISOString();
    cand.reviewedBy = getCurrentAdminActor().name;

    return { success: true, candidate: cand, message: 'Candidate rejected in demo store.' };
  }

  async requestCandidateCorrections(id: string, notes: string) {
    const cand = mockStateStore.candidates.find((c) => c.id === id);
    if (!cand) return { success: false, error: 'Candidate not found.' };

    cand.applicationStatus = 'Under review';
    cand.correctionNotes = notes;
    cand.reviewedAt = new Date().toISOString();
    cand.reviewedBy = getCurrentAdminActor().name;

    return { success: true, candidate: cand, message: 'Correction notes saved in demo store.' };
  }

  async withdrawCandidate(id: string, reason?: string) {
    const cand = mockStateStore.candidates.find((c) => c.id === id);
    if (!cand) return { success: false, error: 'Candidate not found.' };

    cand.applicationStatus = 'Withdrawn';
    cand.rejectionReason = reason || 'Voluntary withdrawal';
    return { success: true, candidate: cand, message: 'Candidate marked withdrawn in demo store.' };
  }

  async assignCandidatePosition(id: string, electionId: string, positionId: string) {
    const cand = mockStateStore.candidates.find((c) => c.id === id);
    if (!cand) return { success: false, error: 'Candidate not found.' };

    cand.electionId = electionId;
    cand.positionId = positionId;
    const list = mockStateStore.positionsByElection[electionId] || [];
    const pos = list.find((p) => p.id === positionId);
    if (pos && !pos.candidateIds.includes(cand.id)) {
      pos.candidateIds.push(cand.id);
    }

    return { success: true, candidate: cand, message: 'Candidate position updated in demo store.' };
  }

  async getAdminElectionResults(electionId: string) {
    const results = mockStateStore.computeElectionResults(electionId, true);
    if (!results) {
      return { success: false, error: 'Election results not found in temporary store.' };
    }
    return { success: true, results };
  }

  async advanceResultsWorkflow(
    electionId: string,
    targetStage: ResultsWorkflowStage,
    notes?: string,
    actorName?: string
  ) {
    const election = mockStateStore.elections.find((e) => e.id === electionId);
    const ledger = mockStateStore.getOrCreateLedger(electionId);
    if (!election || !ledger) {
      return { success: false, error: 'Election not found.' };
    }

    const actor = getCurrentAdminActor();
    ledger.workflowStage = targetStage;
    ledger.workflowHistory.push({
      stage: targetStage,
      actorId: actor.id,
      actorName: actorName || actor.name,
      actorRole: `${actor.roleName} (Demo)`,
      timestamp: new Date().toISOString(),
      notes: notes || `Advanced results preview stage to ${targetStage.toUpperCase()}.`,
      signatureHash: `DEMO-STAGE-${targetStage.toUpperCase()}`
    });

    if (targetStage === 'certified' || targetStage === 'published') {
      election.resultsCertified = true;
      ledger.certifiedBy = `${actorName || actor.name} (Frontend Demo)`;
      ledger.certificationHash = `DEMO-REF-${Date.now().toString(16).toUpperCase()}`;
    }

    if (targetStage === 'published') {
      election.status = 'results_published';
      election.provisionalResultsReady = true;
      ledger.publishedAt = new Date().toISOString();
    } else if (election.status === 'closed') {
      election.status = 'results_pending_certification';
    }

    mockStateStore.logAuditEvent({
      eventType: 'DEMO_RESULTS_WORKFLOW',
      identifier: actor.staffId,
      role: actor.roleName,
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details: `Advanced "${election.title}" demo results stage to ${targetStage.toUpperCase()}.`
    });

    const results = mockStateStore.computeElectionResults(electionId, true);
    return {
      success: true,
      message: `Demo results stage updated to ${targetStage.toUpperCase()}.`,
      results: results || undefined
    };
  }

  async downloadElectionReport(
    electionId: string,
    format: 'pdf' | 'csv',
    reportType: 'full' | 'results' | 'turnout' | 'candidates' | 'positions'
  ) {
    const actor = getCurrentAdminActor();
    const results = mockStateStore.computeElectionResults(electionId, actor.isAdmin);
    if (!results) {
      return { success: false, error: 'Election not found for export.' };
    }
    if (!actor.isAdmin && !results.isPublished) {
      return {
        success: false,
        error: 'Report export is available after results publication or from an admin preview session.'
      };
    }

    const isCsv = format === 'csv';
    const content = isCsv
      ? buildCsvReport(results, reportType)
      : buildPrintableHtmlReport(results, reportType);
    const mime = isCsv ? 'text/csv;charset=utf-8;' : 'text/html;charset=utf-8;';
    const ext = isCsv ? 'csv' : 'html';
    const filename = `UCC_VOTE_DEMO_${electionId}_${reportType}.${ext}`;

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  }

  async getAdminAccounts() {
    const admins: AdminProfile[] = mockStateStore.adminAccounts.map(({ demoPassword: _p, ...rest }) => ({
      ...rest,
      isDemoAccount: true
    }));
    return { success: true, admins };
  }

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
  }) {
    const cleanId = payload.staffId.trim().toUpperCase();
    if (!cleanId || !payload.fullName.trim()) {
      return { success: false, error: 'Staff ID and full name are required.' };
    }
    if (mockStateStore.findAdminByStaffId(cleanId)) {
      return { success: false, error: 'Staff ID already exists in temporary admin list.' };
    }

    const newAdmin = {
      id: `adm-demo-${Date.now()}`,
      staffId: cleanId,
      fullName: payload.fullName.trim(),
      email: payload.email.trim() || `${cleanId.toLowerCase()}@ucc.edu.gh`,
      role: payload.role,
      department: payload.department.trim() || 'Electoral Board',
      permissions: getPermissionsForRole(payload.role),
      managedDomainIds: payload.managedDomainIds,
      managedHalls: payload.managedHalls,
      managedFaculties: payload.managedFaculties,
      managedDepartments: payload.managedDepartments,
      isDemoAccount: true,
      demoPassword: payload.password || 'Admin@UCC2026',
      status: 'active' as const
    };

    mockStateStore.adminAccounts.push(newAdmin);
    const { demoPassword: _p, ...sanitized } = newAdmin;

    return {
      success: true,
      admin: sanitized,
      message: 'Temporary admin demo profile created in browser memory.'
    };
  }

  async updateAdminScope(
    staffId: string,
    payload: {
      role?: AdminRoleType;
      managedDomainIds?: DomainId[];
      managedHalls?: string[];
      managedFaculties?: string[];
      managedDepartments?: string[];
    }
  ) {
    const acc = mockStateStore.findAdminByStaffId(staffId);
    if (!acc) return { success: false, error: 'Admin account not found in temporary store.' };

    if (payload.role) {
      acc.role = payload.role;
      acc.permissions = getPermissionsForRole(payload.role);
    }
    if (payload.managedDomainIds !== undefined) acc.managedDomainIds = payload.managedDomainIds;
    if (payload.managedHalls !== undefined) acc.managedHalls = payload.managedHalls;
    if (payload.managedFaculties !== undefined) acc.managedFaculties = payload.managedFaculties;
    if (payload.managedDepartments !== undefined) acc.managedDepartments = payload.managedDepartments;

    const { demoPassword: _p, ...sanitized } = acc;
    return { success: true, admin: sanitized, message: 'Admin scope updated in temporary store.' };
  }

  async getAuditLogs() {
    return { success: true, logs: [...mockStateStore.auditLogs] };
  }

  async updateStudentStatus(studentId: string, status: 'active' | 'suspended') {
    const acc = mockStateStore.findStudentById(studentId);
    if (acc) {
      acc.status = status;
      acc.isEligible = status === 'active';
    }
    mockStateStore.logAuditEvent({
      eventType: 'DEMO_STUDENT_STATUS_CHANGED',
      identifier: getCurrentAdminActor().staffId,
      role: getCurrentAdminActor().roleName,
      ipAddress: 'Browser Local',
      status: status === 'suspended' ? 'WARNING' : 'SUCCESS',
      details: `Updated demo student ${studentId} status to ${status.toUpperCase()}.`
    });
    return { success: true };
  }

  async attemptAdminBallotInspect(studentId: string) {
    const cleanId = studentId.trim().toUpperCase() || 'UNKNOWN';
    mockStateStore.logAuditEvent({
      eventType: 'DEMO_BALLOT_SECRECY_CHECK',
      identifier: getCurrentAdminActor().staffId,
      role: getCurrentAdminActor().roleName,
      ipAddress: 'Browser Local',
      status: 'FLAGGED',
      details: `Frontend demo check: simulated lookup of candidate choices for ${cleanId} was blocked by UI policy.`
    });
    return {
      success: false,
      code: 'DEMO_BALLOT_SECRECY_GUARD',
      targetStudentId: cleanId,
      audited: true,
      error: `Frontend Demo Notice: Ballot secrecy design forbids linking ${cleanId} to candidate choices. No backend ballot repository is currently connected.`
    };
  }

  async getVotingAuditSummary(electionId: string) {
    const election = mockStateStore.elections.find((e) => e.id === electionId);
    const totalCast = election?.totalVotesCast || 0;
    return {
      success: true,
      summary: {
        electionId,
        vaultCountBalanced: true,
        sessionParticipationRecords: totalCast,
        sessionAnonymousBallots: totalCast
      }
    };
  }
}

export const adminService = new FrontendDemoAdminService();
