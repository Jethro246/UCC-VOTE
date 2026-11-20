import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Stage 1B Firestore Security Rules Verification Suite
 *
 * Because the container runtime does not include Java (required to launch the
 * local Firebase Firestore Emulator), this suite verifies two complementary layers:
 *   1. Direct static inspection of `/firestore.rules` on disk to verify all
 *      required helpers, removal of the bootstrap email allowlist, strict
 *      active `/admins/{uid}` verification, domain scoping, `resource != null`
 *      delete guards, malformed-ID rejection, and immutable collection locks.
 *   2. Exact rule-expression simulation mirroring every helper and match rule in
 *      `/firestore.rules` (including strict path validation inside `exists()` /
 *      `get()` so any missing or malformed `electionId` dereference throws,
 *      just as the Firestore Rules runtime does).
 */

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

type DocData = Record<string, unknown>;

interface AuthContext {
  uid: string;
  token: {
    admin?: unknown;
    email?: unknown;
    email_verified?: unknown;
  };
}

interface MockDatabase {
  admins: Record<string, DocData>;
  students: Record<string, DocData>;
  voter_eligibility: Record<string, DocData>;
  voter_authorisations: Record<string, DocData>;
  ballots: Record<string, DocData>;
  vote_confirmations: Record<string, DocData>;
  elections: Record<string, DocData>;
  positions: Record<string, DocData>;
  contestants: Record<string, DocData>;
  candidate_assignments: Record<string, DocData>;
  candidates: Record<string, DocData>;
  election_results: Record<string, DocData>;
  domains: Record<string, DocData>;
  audit_logs: Record<string, DocData>;
}

const VALID_ADMIN_ROLES = new Set([
  'Super Administrator',
  'Electoral Commissioner',
  'SRC Election Administrator',
  'Hall Election Administrator',
  'GRASAG Election Administrator',
  'Local NUGS Election Administrator',
  'Departmental Election Administrator',
  'Faculty/School Election Administrator',
  'Returning Officer',
  'Results Auditor',
]);

const UNSCOPED_ELECTION_GOVERNANCE_ROLES = new Set([
  'Super Administrator',
  'Electoral Commissioner',
  'Returning Officer',
]);

const DELETABLE_ELECTION_STATUSES = new Set([
  'draft',
  'pending_approval',
  'scheduled',
  'upcoming',
  'suspended',
  'closed',
  'cancelled',
  'archived',
]);

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function getField(data: DocData, key: string, fallback: unknown): unknown {
  return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback;
}

class FirestoreRulesSimulator {
  constructor(private db: MockDatabase) {}

  private docExists(collection: keyof MockDatabase, docId: unknown): boolean {
    if (!isValidId(docId)) {
      throw new Error(`Rules runtime evaluation error: invalid document ID ${String(docId)} in exists(${collection})`);
    }
    return Object.prototype.hasOwnProperty.call(this.db[collection], docId);
  }

  private docGet(collection: keyof MockDatabase, docId: unknown): { data: DocData } {
    if (!isValidId(docId)) {
      throw new Error(`Rules runtime evaluation error: invalid document ID ${String(docId)} in get(${collection})`);
    }
    const doc = this.db[collection][docId];
    if (!doc) {
      throw new Error(`Rules runtime evaluation error: missing document ${collection}/${docId} in get()`);
    }
    return { data: doc };
  }

  private isSignedIn(auth: AuthContext | null): auth is AuthContext {
    return auth !== null;
  }

  private hasTrustedAdminClaim(auth: AuthContext): boolean {
    return auth.token.admin === true;
  }

  private isAdminRecordActive(auth: AuthContext): boolean {
    if (!this.docExists('admins', auth.uid)) {
      return false;
    }
    const adminData = this.docGet('admins', auth.uid).data;
    const isActive = getField(adminData, 'isActive', false) === true;
    const hasRole = Object.prototype.hasOwnProperty.call(adminData, 'role');
    return isActive && hasRole && typeof adminData.role === 'string' && VALID_ADMIN_ROLES.has(adminData.role);
  }

  private isAdmin(auth: AuthContext | null): boolean {
    if (!this.isSignedIn(auth)) return false;
    return this.hasTrustedAdminClaim(auth) && this.isAdminRecordActive(auth);
  }

  private isGlobalGovernanceAdmin(auth: AuthContext | null): boolean {
    if (!this.isAdmin(auth) || !auth) return false;
    const data = this.docGet('admins', auth.uid).data;
    const validRole = data.role === 'Super Administrator' || data.role === 'Electoral Commissioner';
    const noManagedDomains =
      !Object.prototype.hasOwnProperty.call(data, 'managedDomainIds') ||
      data.managedDomainIds === null ||
      (Array.isArray(data.managedDomainIds) && data.managedDomainIds.length === 0);
    const noManagedHalls =
      !Object.prototype.hasOwnProperty.call(data, 'managedHalls') ||
      data.managedHalls === null ||
      (Array.isArray(data.managedHalls) && data.managedHalls.length === 0);
    return validRole && noManagedDomains && noManagedHalls;
  }

  private isUnscopedElectionGovernanceAdmin(auth: AuthContext): boolean {
    const adminData = this.docGet('admins', auth.uid).data;
    const validRole =
      typeof adminData.role === 'string' && UNSCOPED_ELECTION_GOVERNANCE_ROLES.has(adminData.role);
    const noManagedDomains =
      !Object.prototype.hasOwnProperty.call(adminData, 'managedDomainIds') ||
      adminData.managedDomainIds === null ||
      (Array.isArray(adminData.managedDomainIds) && adminData.managedDomainIds.length === 0);
    return validRole && noManagedDomains;
  }

  private canAdminManageElectionDomain(auth: AuthContext, electionData: DocData): boolean {
    if (!this.docExists('admins', auth.uid)) return false;
    const adminData = this.docGet('admins', auth.uid).data;
    if (adminData.role === 'Results Auditor') return false;
    if (this.isUnscopedElectionGovernanceAdmin(auth)) return true;
    return (
      Object.prototype.hasOwnProperty.call(adminData, 'managedDomainIds') &&
      Array.isArray(adminData.managedDomainIds) &&
      adminData.managedDomainIds.length > 0 &&
      Object.prototype.hasOwnProperty.call(electionData, 'domainId') &&
      typeof electionData.domainId === 'string' &&
      adminData.managedDomainIds.includes(electionData.domainId)
    );
  }

  private hasZeroCount(data: DocData, field: string): boolean {
    if (!Object.prototype.hasOwnProperty.call(data, field)) return true;
    const val = data[field];
    if (val === null) return true;
    return typeof val === 'number' && !Number.isNaN(val) && val === 0;
  }

  private isFlagTrue(data: DocData, field: string): boolean {
    return Object.prototype.hasOwnProperty.call(data, field) && data[field] === true;
  }

  private hasProtectedElectionResults(electionId: unknown): boolean {
    if (!isValidId(electionId) || !this.docExists('election_results', electionId)) {
      return false;
    }
    const resultData = this.docGet('election_results', electionId).data;
    return this.isFlagTrue(resultData, 'isPublished') || this.isFlagTrue(resultData, 'resultsCertified');
  }

  private electionAllowsDeletion(auth: AuthContext, electionId: unknown, electionData: DocData): boolean {
    return (
      isValidId(electionId) &&
      this.canAdminManageElectionDomain(auth, electionData) &&
      Object.prototype.hasOwnProperty.call(electionData, 'status') &&
      typeof electionData.status === 'string' &&
      DELETABLE_ELECTION_STATUSES.has(electionData.status) &&
      !this.isFlagTrue(electionData, 'isHistorical') &&
      this.hasZeroCount(electionData, 'totalVotesCast') &&
      !this.isFlagTrue(electionData, 'resultsCertified') &&
      !this.hasProtectedElectionResults(electionId)
    );
  }

  private electionAllowsChildDeletion(auth: AuthContext, electionId: unknown): boolean {
    return (
      isValidId(electionId) &&
      this.docExists('elections', electionId) &&
      this.electionAllowsDeletion(auth, electionId, this.docGet('elections', electionId).data)
    );
  }

  private positionBelongsToElection(positionId: unknown, electionId: unknown): boolean {
    return (
      isValidId(positionId) &&
      isValidId(electionId) &&
      this.docExists('positions', positionId) &&
      this.docGet('positions', positionId).data.electionId === electionId
    );
  }

  // --- Simulated Collection Rules ---

  canReadBallot(_auth: AuthContext | null): boolean {
    return false;
  }
  canWriteBallot(_auth: AuthContext | null): boolean {
    return false;
  }

  canReadVoterAuthorisation(auth: AuthContext | null, authDocId: string): boolean {
    const resource = this.db.voter_authorisations[authDocId] ?? null;
    return this.isSignedIn(auth) && ((resource !== null && resource.uid === auth.uid) || this.isAdmin(auth));
  }
  canWriteVoterAuthorisation(_auth: AuthContext | null): boolean {
    return false;
  }

  canReadVoteConfirmation(auth: AuthContext | null, receiptId: string): boolean {
    const resource = this.db.vote_confirmations[receiptId] ?? null;
    return this.isSignedIn(auth) && ((resource !== null && resource.uid === auth.uid) || this.isAdmin(auth));
  }
  canWriteVoteConfirmation(_auth: AuthContext | null): boolean {
    return false;
  }

  canReadAdmin(auth: AuthContext | null, uid: string): boolean {
    return (this.isSignedIn(auth) && auth.uid === uid) || this.isAdmin(auth);
  }
  canWriteAdmin(_auth: AuthContext | null): boolean {
    return false;
  }

  canReadAuditLog(auth: AuthContext | null): boolean {
    return this.isAdmin(auth);
  }
  canCreateAuditLog(auth: AuthContext | null): boolean {
    return this.isAdmin(auth);
  }
  canUpdateOrDeleteAuditLog(_auth: AuthContext | null): boolean {
    return false;
  }

  canReadStudent(auth: AuthContext | null, uid: string): boolean {
    return (this.isSignedIn(auth) && auth.uid === uid) || this.isAdmin(auth);
  }
  canCreateStudent(auth: AuthContext | null, uid: string, reqData: DocData): boolean {
    const forbiddenKeys = ['role', 'isAdmin', 'admin', 'permissions'];
    return (
      this.isSignedIn(auth) &&
      auth.uid === uid &&
      reqData.uid === auth.uid &&
      reqData.isEligible === false &&
      reqData.eligibilityStatus === 'pending_verification' &&
      !forbiddenKeys.some((k) => Object.prototype.hasOwnProperty.call(reqData, k))
    );
  }
  canDeleteStudent(auth: AuthContext | null, uid: string): boolean {
    const resource = this.db.students[uid] ?? null;
    return resource !== null && this.isAdmin(auth);
  }

  canReadVoterEligibility(auth: AuthContext | null, uid: string): boolean {
    return (this.isSignedIn(auth) && auth.uid === uid) || this.isAdmin(auth);
  }
  canWriteVoterEligibility(auth: AuthContext | null): boolean {
    return this.isAdmin(auth);
  }
  canDeleteVoterEligibility(auth: AuthContext | null, uid: string): boolean {
    const resource = this.db.voter_eligibility[uid] ?? null;
    return resource !== null && this.isAdmin(auth);
  }

  canReadElection(): boolean {
    return true;
  }
  canCreateElection(auth: AuthContext | null, electionId: string, reqData: DocData): boolean {
    return (
      isValidId(electionId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      this.canAdminManageElectionDomain(auth, reqData)
    );
  }
  canUpdateElection(auth: AuthContext | null, electionId: string, reqData: DocData): boolean {
    const resource = this.db.elections[electionId];
    if (!resource) return false;
    return (
      isValidId(electionId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      this.canAdminManageElectionDomain(auth, resource) &&
      this.canAdminManageElectionDomain(auth, reqData) &&
      (!this.isFlagTrue(resource, 'isHistorical') || this.isFlagTrue(reqData, 'isHistorical')) &&
      (this.hasZeroCount(resource, 'totalVotesCast') ||
        (Object.prototype.hasOwnProperty.call(reqData, 'totalVotesCast') &&
          typeof reqData.totalVotesCast === 'number' &&
          typeof resource.totalVotesCast === 'number' &&
          reqData.totalVotesCast >= resource.totalVotesCast))
    );
  }
  canDeleteElection(auth: AuthContext | null, electionId: string): boolean {
    const resource = this.db.elections[electionId] ?? null;
    return (
      isValidId(electionId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      resource !== null &&
      this.electionAllowsDeletion(auth, electionId, resource)
    );
  }

  canCreatePosition(auth: AuthContext | null, positionId: string, reqData: DocData): boolean {
    return (
      isValidId(positionId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      Object.prototype.hasOwnProperty.call(reqData, 'electionId') &&
      isValidId(reqData.electionId) &&
      this.docExists('elections', reqData.electionId) &&
      this.canAdminManageElectionDomain(auth, this.docGet('elections', reqData.electionId).data)
    );
  }
  canUpdatePosition(auth: AuthContext | null, positionId: string, reqData: DocData): boolean {
    const resource = this.db.positions[positionId];
    if (!resource) return false;
    return (
      isValidId(positionId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      Object.prototype.hasOwnProperty.call(resource, 'electionId') &&
      isValidId(resource.electionId) &&
      this.docExists('elections', resource.electionId) &&
      this.canAdminManageElectionDomain(auth, this.docGet('elections', resource.electionId).data) &&
      Object.prototype.hasOwnProperty.call(reqData, 'electionId') &&
      isValidId(reqData.electionId) &&
      this.docExists('elections', reqData.electionId) &&
      this.canAdminManageElectionDomain(auth, this.docGet('elections', reqData.electionId).data)
    );
  }
  canDeletePosition(auth: AuthContext | null, positionId: string): boolean {
    const resource = this.db.positions[positionId] ?? null;
    return (
      isValidId(positionId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      resource !== null &&
      Object.prototype.hasOwnProperty.call(resource, 'electionId') &&
      isValidId(resource.electionId) &&
      this.electionAllowsChildDeletion(auth, resource.electionId)
    );
  }

  canDeleteAssignment(auth: AuthContext | null, assignmentId: string): boolean {
    const resource = this.db.candidate_assignments[assignmentId] ?? null;
    return (
      isValidId(assignmentId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      resource !== null &&
      Object.prototype.hasOwnProperty.call(resource, 'electionId') &&
      isValidId(resource.electionId) &&
      this.electionAllowsChildDeletion(auth, resource.electionId)
    );
  }

  canCreateCandidate(auth: AuthContext | null, candidateId: string, reqData: DocData): boolean {
    if (!isValidId(candidateId)) return false;
    if (this.isAdmin(auth) && auth !== null) {
      return (
        Object.prototype.hasOwnProperty.call(reqData, 'electionId') &&
        isValidId(reqData.electionId) &&
        this.docExists('elections', reqData.electionId) &&
        this.canAdminManageElectionDomain(auth, this.docGet('elections', reqData.electionId).data) &&
        (!Object.prototype.hasOwnProperty.call(reqData, 'positionId') ||
          reqData.positionId === '' ||
          this.positionBelongsToElection(reqData.positionId, reqData.electionId))
      );
    }
    return (
      this.isSignedIn(auth) &&
      reqData.submittedByUid === auth.uid &&
      (reqData.applicationStatus === 'Draft' || reqData.applicationStatus === 'Submitted') &&
      !Object.prototype.hasOwnProperty.call(reqData, 'votesReceived')
    );
  }
  canDeleteCandidate(auth: AuthContext | null, candidateId: string): boolean {
    const resource = this.db.candidates[candidateId] ?? null;
    return (
      isValidId(candidateId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      resource !== null &&
      this.hasZeroCount(resource, 'votesReceived') &&
      Object.prototype.hasOwnProperty.call(resource, 'electionId') &&
      isValidId(resource.electionId) &&
      this.electionAllowsChildDeletion(auth, resource.electionId)
    );
  }

  canReadElectionResults(auth: AuthContext | null, electionId: string): boolean {
    const resource = this.db.election_results[electionId] ?? null;
    return (resource !== null && resource.isPublished === true) || this.isAdmin(auth);
  }
  canWriteElectionResults(auth: AuthContext | null, electionId: string): boolean {
    return (
      isValidId(electionId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      this.docExists('elections', electionId) &&
      this.canAdminManageElectionDomain(auth, this.docGet('elections', electionId).data)
    );
  }
  canDeleteElectionResults(auth: AuthContext | null, electionId: string): boolean {
    const resource = this.db.election_results[electionId] ?? null;
    return (
      isValidId(electionId) &&
      this.isAdmin(auth) &&
      auth !== null &&
      resource !== null &&
      !this.isFlagTrue(resource, 'isPublished') &&
      !this.isFlagTrue(resource, 'resultsCertified') &&
      this.electionAllowsChildDeletion(auth, electionId)
    );
  }

  canWriteDomain(auth: AuthContext | null, domainId: string): boolean {
    return domainId === '__directory_config' ? this.isGlobalGovernanceAdmin(auth) : this.isAdmin(auth);
  }
}

function createFixtureDb(): MockDatabase {
  return {
    admins: {
      uid_super_admin: {
        uid: 'uid_super_admin',
        email: 'commissioner@ucc.edu.gh',
        role: 'Electoral Commissioner',
        isActive: true,
        managedDomainIds: [],
        managedHalls: [],
      },
      uid_claim_plus_active_admin: {
        uid: 'uid_claim_plus_active_admin',
        email: 'fynnjethro63@gmail.com',
        role: 'Super Administrator',
        isActive: true,
        managedDomainIds: [],
      },
      uid_hall_admin: {
        uid: 'uid_hall_admin',
        email: 'halladmin@ucc.edu.gh',
        role: 'Hall Election Administrator',
        isActive: true,
        managedDomainIds: ['jcrc_oguaa'],
        managedHalls: ['Oguaa Hall'],
      },
      uid_hall_admin_unassigned: {
        uid: 'uid_hall_admin_unassigned',
        email: 'halladmin-empty@ucc.edu.gh',
        role: 'Hall Election Administrator',
        isActive: true,
        managedDomainIds: [],
      },
      uid_results_auditor: {
        uid: 'uid_results_auditor',
        email: 'auditor@ucc.edu.gh',
        role: 'Results Auditor',
        isActive: true,
        managedDomainIds: [],
      },
      uid_inactive_admin: {
        uid: 'uid_inactive_admin',
        email: 'retired@ucc.edu.gh',
        role: 'Electoral Commissioner',
        isActive: false,
      },
      uid_missing_isactive_admin: {
        uid: 'uid_missing_isactive_admin',
        email: 'omitted-flag@ucc.edu.gh',
        role: 'Electoral Commissioner',
      },
      uid_missing_role_admin: {
        uid: 'uid_missing_role_admin',
        email: 'omitted-role@ucc.edu.gh',
        isActive: true,
      },
      uid_student_role_tamper: {
        uid: 'uid_student_role_tamper',
        email: 'tamper@ucc.edu.gh',
        role: 'Student',
        isActive: true,
      },
    },
    students: {
      uid_student: { uid: 'uid_student', isEligible: true },
    },
    voter_eligibility: {
      uid_student: { uid: 'uid_student', eligible: true },
    },
    voter_authorisations: {
      auth_1: { uid: 'uid_student', electionId: 'elec_voted_closed' },
    },
    ballots: {
      ballot_1: { electionId: 'elec_voted_closed', hash: 'abc123' },
    },
    vote_confirmations: {
      rcpt_1: { uid: 'uid_student', electionId: 'elec_voted_closed' },
    },
    elections: {
      elec_draft_zero: {
        id: 'elec_draft_zero',
        domainId: 'src',
        status: 'draft',
        isHistorical: false,
        totalVotesCast: 0,
        resultsCertified: false,
      },
      elec_null_votes: {
        id: 'elec_null_votes',
        domainId: 'src',
        status: 'draft',
        isHistorical: null,
        totalVotesCast: null,
        resultsCertified: null,
      },
      elec_tampered_string_votes: {
        id: 'elec_tampered_string_votes',
        domainId: 'src',
        status: 'closed',
        isHistorical: false,
        totalVotesCast: '0',
      },
      elec_live: {
        id: 'elec_live',
        domainId: 'src',
        status: 'live',
        isHistorical: false,
        totalVotesCast: 0,
      },
      elec_historical_2026: {
        id: 'elec_historical_2026',
        domainId: 'src',
        status: 'archived',
        isHistorical: true,
        totalVotesCast: 14250,
        resultsCertified: true,
      },
      elec_voted_closed: {
        id: 'elec_voted_closed',
        domainId: 'src',
        status: 'closed',
        isHistorical: false,
        totalVotesCast: 120,
        resultsCertified: false,
      },
      elec_published_zero: {
        id: 'elec_published_zero',
        domainId: 'src',
        status: 'closed',
        isHistorical: false,
        totalVotesCast: 0,
        resultsCertified: false,
      },
      elec_oguaa_draft: {
        id: 'elec_oguaa_draft',
        domainId: 'jcrc_oguaa',
        status: 'draft',
        isHistorical: false,
        totalVotesCast: 0,
      },
    },
    positions: {
      pos_draft_ok: { id: 'pos_draft_ok', electionId: 'elec_draft_zero', title: 'SRC President' },
      pos_oguaa_ok: { id: 'pos_oguaa_ok', electionId: 'elec_oguaa_draft', title: 'JCRC President' },
      pos_missing_election: { id: 'pos_missing_election', title: 'Orphan Missing ElectionId' },
      pos_null_election: { id: 'pos_null_election', electionId: null, title: 'Orphan Null ElectionId' },
      pos_malformed_election: { id: 'pos_malformed_election', electionId: 'bad/id/path', title: 'Orphan Bad ElectionId' },
      pos_nonexistent_parent: { id: 'pos_nonexistent_parent', electionId: 'elec_deleted_parent', title: 'Detached Parent' },
      pos_voted_election: { id: 'pos_voted_election', electionId: 'elec_voted_closed', title: 'Closed With Votes' },
      pos_historical_election: { id: 'pos_historical_election', electionId: 'elec_historical_2026', title: 'Historical 2026' },
    },
    contestants: {},
    candidate_assignments: {
      assign_draft_ok: { electionId: 'elec_draft_zero', positionId: 'pos_draft_ok', candidateId: 'cand_draft_zero' },
      assign_voted: { electionId: 'elec_voted_closed', positionId: 'pos_voted_election', candidateId: 'cand_with_votes' },
      assign_malformed: { electionId: 'bad/id', positionId: 'pos_draft_ok', candidateId: 'cand_null_votes' },
    },
    candidates: {
      cand_draft_zero: { electionId: 'elec_draft_zero', positionId: 'pos_draft_ok', votesReceived: 0 },
      cand_null_votes: { electionId: 'elec_null_votes', positionId: 'pos_draft_ok', votesReceived: null },
      cand_with_votes: { electionId: 'elec_draft_zero', positionId: 'pos_draft_ok', votesReceived: 12 },
      cand_tampered_votes: { electionId: 'elec_draft_zero', positionId: 'pos_draft_ok', votesReceived: '0' },
      cand_malformed_election: { electionId: '', votesReceived: 0 },
      cand_nonexistent_parent: { electionId: 'elec_deleted_parent', votesReceived: 0 },
      cand_historical: { electionId: 'elec_historical_2026', votesReceived: 0 },
    },
    election_results: {
      elec_draft_zero: { electionId: 'elec_draft_zero', isPublished: false, resultsCertified: false },
      elec_published_zero: { electionId: 'elec_published_zero', isPublished: true, resultsCertified: true },
      elec_voted_closed: { electionId: 'elec_voted_closed', isPublished: false, resultsCertified: false },
    },
    domains: {},
    audit_logs: {
      log_1: { action: 'CREATE_ELECTION', timestamp: 12345 },
    },
  };
}

const superAdminAuth: AuthContext = {
  uid: 'uid_super_admin',
  token: { admin: true, email: 'commissioner@ucc.edu.gh', email_verified: true },
};

const claimPlusActiveAdminAuth: AuthContext = {
  uid: 'uid_claim_plus_active_admin',
  token: { admin: true, email: 'fynnjethro63@gmail.com', email_verified: true },
};

// Email-only auth without admin: true custom claim (must be DENIED in Stage 1B)
const emailOnlyNoClaimAuth: AuthContext = {
  uid: 'uid_claim_plus_active_admin',
  token: { email: 'fynnjethro63@gmail.com', email_verified: true },
};

// Stale admin: true claim whose /admins/{uid} record does NOT exist (must be DENIED in Stage 1B)
const staleClaimMissingAdminDocAuth: AuthContext = {
  uid: 'uid_no_admin_doc',
  token: { admin: true, email: 'removed-admin@ucc.edu.gh', email_verified: true },
};

const missingIsActiveAdminAuth: AuthContext = {
  uid: 'uid_missing_isactive_admin',
  token: { admin: true, email: 'omitted-flag@ucc.edu.gh', email_verified: true },
};

const missingRoleAdminAuth: AuthContext = {
  uid: 'uid_missing_role_admin',
  token: { admin: true, email: 'omitted-role@ucc.edu.gh', email_verified: true },
};

const hallAdminAuth: AuthContext = {
  uid: 'uid_hall_admin',
  token: { admin: true, email: 'halladmin@ucc.edu.gh', email_verified: true },
};

const hallAdminUnassignedAuth: AuthContext = {
  uid: 'uid_hall_admin_unassigned',
  token: { admin: true, email: 'halladmin-empty@ucc.edu.gh', email_verified: true },
};

const resultsAuditorAuth: AuthContext = {
  uid: 'uid_results_auditor',
  token: { admin: true, email: 'auditor@ucc.edu.gh', email_verified: true },
};

const deactivatedAdminAuth: AuthContext = {
  uid: 'uid_inactive_admin',
  token: { admin: true, email: 'retired@ucc.edu.gh', email_verified: true },
};

const invalidRoleAdminAuth: AuthContext = {
  uid: 'uid_student_role_tamper',
  token: { admin: true, email: 'tamper@ucc.edu.gh', email_verified: true },
};

const studentAuth: AuthContext = {
  uid: 'uid_student',
  token: { email: 'student@stu.ucc.edu.gh', email_verified: true },
};

const candidateAuth: AuthContext = {
  uid: 'uid_candidate',
  token: { email: 'candidate@stu.ucc.edu.gh', email_verified: true },
};

// 0. Direct static verification of /firestore.rules on disk
runTest('Static /firestore.rules removes email allowlist, enforces active /admins/{uid}, and forbids resource == null or missing-parent bypasses', () => {
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

  // Removed email bypass patterns
  assert.doesNotMatch(rulesText, /isAllowlistedBootstrapAdmin/);
  assert.doesNotMatch(rulesText, /fynnjethro7@gmail\.com/);
  assert.doesNotMatch(rulesText, /fynnjethro63@gmail\.com/);

  // Removed missing-doc & missing-electionId bypass patterns in deletes
  assert.doesNotMatch(rulesText, /resource\s*==\s*null/);
  assert.doesNotMatch(rulesText, /!\('electionId' in resource\.data\)/);
  assert.doesNotMatch(rulesText, /!exists\(\/databases\/\$\(database\)\/documents\/admins\/\$\(request\.auth\.uid\)\)/);
  assert.doesNotMatch(rulesText, /!exists\(\/databases\/\$\(database\)\/documents\/elections\/\$\(electionId\)\)/);

  const requiredPatterns = [
    /function isValidId\(id\)/,
    /function isValidAdminRole\(role\)/,
    /function hasTrustedAdminClaim\(\)/,
    /function isAdminRecordActive\(\)/,
    /exists\(\/databases\/\$\(database\)\/documents\/admins\/\$\(request\.auth\.uid\)\)[\s\S]*get\('isActive',\s*false\)\s*==\s*true/,
    /function isGlobalGovernanceAdmin\(\)/,
    /function isUnscopedElectionGovernanceAdmin\(\)/,
    /function canAdminManageElectionDomain\(electionData\)/,
    /function hasZeroCount\(data,\s*field\)/,
    /function isFlagTrue\(data,\s*field\)/,
    /function hasProtectedElectionResults\(electionId\)/,
    /function electionAllowsDeletion\(electionId,\s*electionData\)/,
    /function electionAllowsChildDeletion\(electionId\)/,
    /match \/ballots\/\{ballotId\}[\s\S]*allow read, write: if false;/,
    /match \/voter_authorisations\/\{authDocId\}[\s\S]*allow write: if false;/,
    /match \/vote_confirmations\/\{receiptId\}[\s\S]*allow write: if false;/,
    /match \/admins\/\{uid\}[\s\S]*allow write: if false;/,
    /match \/audit_logs\/\{logId\}[\s\S]*allow update, delete: if false;/,
    /domainId == '__directory_config'\s*\?\s*isGlobalGovernanceAdmin\(\)\s*:\s*isAdmin\(\)/,
  ];
  for (const pattern of requiredPatterns) {
    assert.match(rulesText, pattern, `Expected firestore.rules to match ${pattern}`);
  }
});

// 1. Unauthenticated access
runTest('Scenario 1: Unauthenticated access denied on all writes, deletions, and private records', () => {
  const sim = new FirestoreRulesSimulator(createFixtureDb());

  assert.equal(sim.canReadElection(), true);
  assert.equal(sim.canCreateElection(null, 'elec_new', { domainId: 'src' }), false);
  assert.equal(sim.canUpdateElection(null, 'elec_draft_zero', { status: 'closed' }), false);
  assert.equal(sim.canDeleteElection(null, 'elec_draft_zero'), false);
  assert.equal(sim.canDeletePosition(null, 'pos_draft_ok'), false);
  assert.equal(sim.canDeleteCandidate(null, 'cand_draft_zero'), false);
  assert.equal(sim.canDeleteAssignment(null, 'assign_draft_ok'), false);
  assert.equal(sim.canDeleteElectionResults(null, 'elec_draft_zero'), false);
  assert.equal(sim.canReadBallot(null), false);
  assert.equal(sim.canWriteBallot(null), false);
  assert.equal(sim.canReadVoterAuthorisation(null, 'auth_1'), false);
  assert.equal(sim.canReadVoteConfirmation(null, 'rcpt_1'), false);
  assert.equal(sim.canReadAdmin(null, 'uid_super_admin'), false);
  assert.equal(sim.canReadAuditLog(null), false);
  assert.equal(sim.canReadStudent(null, 'uid_student'), false);
  assert.equal(sim.canReadVoterEligibility(null, 'uid_student'), false);
  assert.equal(sim.canWriteDomain(null, '__directory_config'), false);
});

// 2. Ordinary student & candidate access
runTest('Scenario 2: Ordinary students and candidates cannot delete elections or elevate privileges', () => {
  const sim = new FirestoreRulesSimulator(createFixtureDb());

  assert.equal(sim.canDeleteElection(studentAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canDeleteElection(candidateAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canCreateElection(studentAuth, 'elec_new', { domainId: 'src' }), false);
  assert.equal(sim.canUpdateElection(studentAuth, 'elec_draft_zero', { status: 'live' }), false);
  assert.equal(sim.canDeletePosition(studentAuth, 'pos_draft_ok'), false);
  assert.equal(sim.canDeleteCandidate(studentAuth, 'cand_draft_zero'), false);
  assert.equal(sim.canDeleteAssignment(studentAuth, 'assign_draft_ok'), false);
  assert.equal(sim.canDeleteElectionResults(studentAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canWriteVoterEligibility(studentAuth), false);
  assert.equal(sim.canWriteAdmin(studentAuth), false);
  assert.equal(sim.canCreateAuditLog(studentAuth), false);
  assert.equal(sim.canWriteDomain(studentAuth, 'src'), false);
  assert.equal(sim.canWriteDomain(studentAuth, '__directory_config'), false);

  assert.equal(sim.canReadVoteConfirmation(studentAuth, 'rcpt_1'), true);
  assert.equal(sim.canReadVoteConfirmation(candidateAuth, 'rcpt_1'), false);
  assert.equal(sim.canReadVoterAuthorisation(studentAuth, 'auth_1'), true);
  assert.equal(sim.canReadVoterAuthorisation(candidateAuth, 'auth_1'), false);

  assert.equal(
    sim.canCreateStudent(studentAuth, 'uid_student', {
      uid: 'uid_student',
      isEligible: false,
      eligibilityStatus: 'pending_verification',
    }),
    true
  );
  assert.equal(
    sim.canCreateStudent(studentAuth, 'uid_student', {
      uid: 'uid_student',
      isEligible: true,
      eligibilityStatus: 'verified',
    }),
    false
  );
  assert.equal(
    sim.canCreateStudent(studentAuth, 'uid_student', {
      uid: 'uid_student',
      isEligible: false,
      eligibilityStatus: 'pending_verification',
      role: 'Electoral Commissioner',
    }),
    false
  );

  assert.equal(
    sim.canCreateCandidate(candidateAuth, 'cand_self_1', {
      submittedByUid: 'uid_candidate',
      applicationStatus: 'Submitted',
      electionId: 'elec_draft_zero',
    }),
    true
  );
  assert.equal(
    sim.canCreateCandidate(candidateAuth, 'cand_self_2', {
      submittedByUid: 'uid_candidate',
      applicationStatus: 'Submitted',
      votesReceived: 999,
    }),
    false
  );
});

// 3. Issue 1 & Issue 2: Strict admin claims + explicit active /admins/{uid} + domain scoping
runTest('Scenario 3 (Stage 1B Issues 1 & 2): Email-only users, missing/inactive/incomplete admin records, and out-of-scope admins are all denied', () => {
  const sim = new FirestoreRulesSimulator(createFixtureDb());

  // Valid admin: admin: true claim + active /admins/{uid} record
  assert.equal(sim.canDeleteElection(superAdminAuth, 'elec_draft_zero'), true);
  assert.equal(sim.canDeleteElection(claimPlusActiveAdminAuth, 'elec_draft_zero'), true);
  assert.equal(sim.canDeletePosition(superAdminAuth, 'pos_draft_ok'), true);
  assert.equal(sim.canDeleteCandidate(superAdminAuth, 'cand_draft_zero'), true);
  assert.equal(sim.canDeleteAssignment(superAdminAuth, 'assign_draft_ok'), true);
  assert.equal(sim.canDeleteElectionResults(superAdminAuth, 'elec_draft_zero'), true);
  assert.equal(sim.canWriteDomain(superAdminAuth, '__directory_config'), true);

  // Issue 1: Verified email WITHOUT admin: true claim is DENIED even when active /admins/{uid} exists
  assert.equal(sim.canDeleteElection(emailOnlyNoClaimAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canCreateElection(emailOnlyNoClaimAuth, 'elec_new', { domainId: 'src' }), false);
  assert.equal(sim.canWriteVoterEligibility(emailOnlyNoClaimAuth), false);
  assert.equal(sim.canCreateAuditLog(emailOnlyNoClaimAuth), false);
  assert.equal(sim.canWriteDomain(emailOnlyNoClaimAuth, '__directory_config'), false);

  // Issue 2a: Stale admin: true claim with MISSING /admins/{uid} doc is DENIED
  assert.equal(sim.canDeleteElection(staleClaimMissingAdminDocAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canCreateElection(staleClaimMissingAdminDocAuth, 'elec_new', { domainId: 'src' }), false);
  assert.equal(sim.canWriteVoterEligibility(staleClaimMissingAdminDocAuth), false);
  assert.equal(sim.canWriteDomain(staleClaimMissingAdminDocAuth, '__directory_config'), false);

  // Issue 2b: Deactivated, omitted isActive, omitted role, or invalid 'Student' role are DENIED even with admin: true claim
  assert.equal(sim.canDeleteElection(deactivatedAdminAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canDeleteElection(missingIsActiveAdminAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canDeleteElection(missingRoleAdminAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canDeleteElection(invalidRoleAdminAuth, 'elec_draft_zero'), false);

  // Issue 2c: Results Auditor cannot create, update, or delete elections or results
  assert.equal(sim.canReadAuditLog(resultsAuditorAuth), true);
  assert.equal(sim.canDeleteElection(resultsAuditorAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canCreateElection(resultsAuditorAuth, 'elec_new', { domainId: 'src' }), false);
  assert.equal(sim.canWriteElectionResults(resultsAuditorAuth, 'elec_draft_zero'), false);

  // Issue 2d: Domain-scoped Hall admin works inside assigned domain, fails outside assigned domain or if unassigned
  assert.equal(sim.canDeleteElection(hallAdminAuth, 'elec_oguaa_draft'), true);
  assert.equal(sim.canDeletePosition(hallAdminAuth, 'pos_oguaa_ok'), true);
  assert.equal(sim.canDeleteElection(hallAdminAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canDeletePosition(hallAdminAuth, 'pos_draft_ok'), false);
  assert.equal(
    sim.canUpdatePosition(hallAdminAuth, 'pos_draft_ok', { electionId: 'elec_oguaa_draft' }),
    false
  );
  assert.equal(sim.canWriteElectionResults(hallAdminAuth, 'elec_draft_zero'), false);
  assert.equal(sim.canWriteDomain(hallAdminAuth, '__directory_config'), false);
  assert.equal(sim.canDeleteElection(hallAdminUnassignedAuth, 'elec_oguaa_draft'), false);
});

// 4. Unauthorized election deletion & bypass prevention
runTest('Scenario 4: Live elections and vote-count/historical update bypass attempts are blocked', () => {
  const sim = new FirestoreRulesSimulator(createFixtureDb());

  assert.equal(sim.canDeleteElection(superAdminAuth, 'elec_live'), false);
  assert.equal(sim.canCreatePosition(hallAdminAuth, 'pos_src_new', { electionId: 'elec_draft_zero' }), false);

  assert.equal(
    sim.canUpdateElection(superAdminAuth, 'elec_historical_2026', {
      domainId: 'src',
      status: 'draft',
      isHistorical: false,
      totalVotesCast: 14250,
    }),
    false
  );
  assert.equal(
    sim.canUpdateElection(superAdminAuth, 'elec_voted_closed', {
      domainId: 'src',
      status: 'closed',
      isHistorical: false,
      totalVotesCast: 0,
    }),
    false
  );
});

// 5. Null voting fields & Stage 1B Issue 3 (resource == null denied)
runTest('Scenario 5 (Stage 1B Issue 3): Null voting counts behave as zero, while missing documents (resource == null) are strictly denied on delete', () => {
  const sim = new FirestoreRulesSimulator(createFixtureDb());

  // Existing draft election & candidate with null vote fields can be deleted by authorized admin
  assert.equal(sim.canDeleteElection(superAdminAuth, 'elec_null_votes'), true);
  assert.equal(sim.canDeleteCandidate(superAdminAuth, 'cand_null_votes'), true);

  // Issue 3: Missing document (resource == null) CANNOT be treated as an authorized deletion
  assert.equal(sim.canDeleteElection(superAdminAuth, 'elec_does_not_exist'), false);
  assert.equal(sim.canDeleteElectionResults(superAdminAuth, 'elec_does_not_exist'), false);
  assert.equal(sim.canDeletePosition(superAdminAuth, 'pos_does_not_exist'), false);
  assert.equal(sim.canDeleteCandidate(superAdminAuth, 'cand_does_not_exist'), false);
  assert.equal(sim.canDeleteAssignment(superAdminAuth, 'assign_does_not_exist'), false);
  assert.equal(sim.canDeleteStudent(superAdminAuth, 'student_does_not_exist'), false);
  assert.equal(sim.canDeleteVoterEligibility(superAdminAuth, 'elig_does_not_exist'), false);

  // Tampered non-numeric string '0' for totalVotesCast / votesReceived is rejected
  assert.equal(sim.canDeleteElection(superAdminAuth, 'elec_tampered_string_votes'), false);
  assert.equal(sim.canDeleteCandidate(superAdminAuth, 'cand_tampered_votes'), false);
});

// 6. Stage 1B Issue 3: Missing, malformed, or detached electionIds rejected
runTest('Scenario 6 (Stage 1B Issue 3): Malformed, missing, or non-existent parent electionIds are rejected on both writes and child deletes', () => {
  const sim = new FirestoreRulesSimulator(createFixtureDb());

  assert.equal(sim.canCreateElection(superAdminAuth, 'bad/id', { domainId: 'src' }), false);
  assert.equal(sim.canCreateElection(superAdminAuth, '', { domainId: 'src' }), false);
  assert.equal(sim.canDeleteElection(superAdminAuth, 'bad/id'), false);
  assert.equal(sim.canCreatePosition(superAdminAuth, 'pos_new', { electionId: 'bad/id' }), false);
  assert.equal(sim.canCreatePosition(superAdminAuth, 'pos_new', { title: 'Missing electionId' }), false);
  assert.equal(sim.canCreateCandidate(superAdminAuth, 'cand_new', { electionId: '' }), false);

  // Child deletes with missing, null, malformed, or missing-parent electionId are REJECTED (no bypass)
  assert.equal(sim.canDeletePosition(superAdminAuth, 'pos_missing_election'), false);
  assert.equal(sim.canDeletePosition(superAdminAuth, 'pos_null_election'), false);
  assert.equal(sim.canDeletePosition(superAdminAuth, 'pos_malformed_election'), false);
  assert.equal(sim.canDeletePosition(superAdminAuth, 'pos_nonexistent_parent'), false);
  assert.equal(sim.canDeleteCandidate(superAdminAuth, 'cand_malformed_election'), false);
  assert.equal(sim.canDeleteCandidate(superAdminAuth, 'cand_nonexistent_parent'), false);
  assert.equal(sim.canDeleteAssignment(superAdminAuth, 'assign_malformed'), false);
});

// 7. Protected voting, audit, admin, and result records
runTest('Scenario 7: Protected voting records, audit logs, admins, and certified/published results cannot be deleted even by Super Admin', () => {
  const sim = new FirestoreRulesSimulator(createFixtureDb());

  assert.equal(sim.canWriteBallot(superAdminAuth), false);
  assert.equal(sim.canReadBallot(superAdminAuth), false);
  assert.equal(sim.canWriteVoterAuthorisation(superAdminAuth), false);
  assert.equal(sim.canWriteVoteConfirmation(superAdminAuth), false);
  assert.equal(sim.canUpdateOrDeleteAuditLog(superAdminAuth), false);
  assert.equal(sim.canWriteAdmin(superAdminAuth), false);

  assert.equal(sim.canDeleteElection(superAdminAuth, 'elec_voted_closed'), false);
  assert.equal(sim.canDeleteElection(superAdminAuth, 'elec_historical_2026'), false);
  assert.equal(sim.canDeleteElection(superAdminAuth, 'elec_published_zero'), false);
  assert.equal(sim.canDeletePosition(superAdminAuth, 'pos_voted_election'), false);
  assert.equal(sim.canDeletePosition(superAdminAuth, 'pos_historical_election'), false);
  assert.equal(sim.canDeleteAssignment(superAdminAuth, 'assign_voted'), false);
  assert.equal(sim.canDeleteCandidate(superAdminAuth, 'cand_with_votes'), false);
  assert.equal(sim.canDeleteCandidate(superAdminAuth, 'cand_historical'), false);
  assert.equal(sim.canDeleteElectionResults(superAdminAuth, 'elec_published_zero'), false);
  assert.equal(sim.canDeleteElectionResults(superAdminAuth, 'elec_voted_closed'), false);
});
