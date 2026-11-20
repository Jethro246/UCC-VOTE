import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  auth,
  db,
  formatFirestorePermissionError,
  functions,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { formatNumber } from '../utils/numberFormat';
import {
  UCC_HALLS,
  categoryToDomainId,
  domainIdToCategory,
  getPermissionsForRole,
} from '../data/uccStructure';
import {
  HISTORICAL_2026_CANDIDATES,
  HISTORICAL_2026_ELECTIONS,
  HISTORICAL_2026_POSITIONS,
  HISTORICAL_2026_RESULTS,
  getHistoricalCandidateById,
  getHistoricalElectionById,
  getHistoricalPositionsByElectionId,
  getHistoricalResultsByElectionId,
  mergeHistoricalCandidates,
  mergeHistoricalElections,
  mergeHistoricalPositions,
} from '../data/historical2026Elections';
import {
  SRC_2027_CANDIDATES,
  SRC_2027_ELECTION,
  SRC_2027_ELECTION_ID,
  SRC_2027_POSITIONS,
  getSrc2027CandidateById,
  getSrc2027ElectionById,
  getSrc2027PositionsByElectionId,
  mergeSrc2027Candidates,
  mergeSrc2027Elections,
  mergeSrc2027Positions,
} from '../data/src2027Election';
import {
  AdminProfile,
  AdminRoleType,
  AuditLogItem,
  BallotAccountingSummary,
  Candidate,
  CandidateResultRow,
  ContestantProfile,
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionCategory,
  ElectionResultsPayload,
  ElectionStatus,
  HallUnit,
  Position,
  PositionResultSummary,
  ResultsWorkflowStage,
} from '../types';
import { CreateElectionPayload } from './interfaces';
import { convertTimestamp, getDirectoryConfig, writeAuditLog } from './firebaseDbService';
import {
  buildAssignmentUniquenessKey,
  buildContestantId,
  evaluateElectionCandidateActionAllowed,
  findDuplicateAssignment,
  normalizeStudentId,
} from '../utils/contestantUtils';
import {
  BULK_REMOVE_CONFIRMATION_PHRASE,
  BulkElectionInspectionItem,
  BulkRemovalPlanSummary,
  DIRECTORY_CONFIG_DOC_ID,
  ElectionRemovalEligibility,
  assessElectionRemovalEligibility,
  buildBulkRemovalPlan,
  collectProtectedRecordLabels,
  isGlobalGovernanceAdmin,
  isValidElectionId,
  matchesBulkRemovalConfirmation,
  matchesRemovalConfirmation,
} from '../utils/electionRemovalUtils';
import { findMatchingHallUnit, isOfficialHallAffiliation } from '../utils/hallUtils';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      clean[key] = val.filter((item) => item !== undefined);
    } else if (
      val !== null &&
      typeof val === 'object' &&
      !(val instanceof Date) &&
      typeof val?.toDate !== 'function' &&
      !('_methodName' in val)
    ) {
      clean[key] = stripUndefined(val);
    } else {
      clean[key] = val;
    }
  }
  return clean as T;
}

function mapDoc<T>(id: string, data: Record<string, any>): T {
  const out: Record<string, any> = { id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v?.toDate === 'function' ? convertTimestamp(v) : v;
  }
  return out as T;
}

async function getCurrentAdminContext(): Promise<{ name: string; role: string; uid: string }> {
  const user = auth.currentUser;
  if (!user) return { name: 'Administrator', role: 'Admin', uid: '' };
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    if (snap.exists()) {
      const a = snap.data() as AdminProfile;
      return { name: a.fullName || user.email || 'Administrator', role: a.role, uid: user.uid };
    }
  } catch {
    // Fallback to Firebase Auth display name / email
  }
  return { name: user.displayName || user.email || 'Administrator', role: 'Admin', uid: user.uid };
}

const VALID_GOVERNANCE_ROLES = new Set<AdminRoleType>([
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

const UNSCOPED_ELECTION_GOVERNANCE_ROLES = new Set<AdminRoleType>([
  'Super Administrator',
  'Electoral Commissioner',
  'Returning Officer',
]);

async function assertActiveAdminContext(election?: Election): Promise<
  | {
      ok: true;
      actor: {
        name: string;
        role: string;
        uid: string;
        managedDomainIds?: DomainId[];
        adminProfile: AdminProfile;
      };
    }
  | { ok: false; error: string }
> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, error: 'Authentication required. Please sign in as an administrator.' };
  }

  let claims: Record<string, any> = {};
  try {
    let tokenRes = await user.getIdTokenResult();
    if (tokenRes.claims?.admin !== true) {
      tokenRes = await user.getIdTokenResult(true);
    }
    claims = tokenRes.claims || {};
  } catch {
    claims = {};
  }

  if (claims.admin !== true) {
    return {
      ok: false,
      error:
        'Administrator custom claims (admin: true) are required. Ordinary student or candidate accounts cannot manage or remove elections.',
    };
  }

  const adminSnap = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
  const adminData = adminSnap?.exists()
    ? ({ ...adminSnap.data(), id: adminSnap.id, uid: user.uid } as AdminProfile)
    : null;

  if (!adminData) {
    return {
      ok: false,
      error:
        'An active administrator profile document (/admins/{uid}) is required before managing or deleting elections.',
    };
  }
  if (adminData.isActive !== true) {
    return { ok: false, error: 'Your administrator account is inactive or has been deactivated.' };
  }
  if (!adminData.role || !VALID_GOVERNANCE_ROLES.has(adminData.role)) {
    return {
      ok: false,
      error: 'Your administrator record does not hold a recognized Electoral Commission role.',
    };
  }

  if (election) {
    if (adminData.role === 'Results Auditor') {
      return {
        ok: false,
        error: 'Results Auditors have read-only audit access and cannot modify or remove elections.',
      };
    }
    const managedDomains = Array.isArray(adminData.managedDomainIds) ? adminData.managedDomainIds : [];
    const isUnscopedGlobal =
      UNSCOPED_ELECTION_GOVERNANCE_ROLES.has(adminData.role) && managedDomains.length === 0;
    if (!isUnscopedGlobal) {
      if (
        managedDomains.length === 0 ||
        !election.domainId ||
        !managedDomains.includes(election.domainId)
      ) {
        return {
          ok: false,
          error: 'You do not have administrative authority over this election domain.',
        };
      }
    }
  }

  const resolvedProfile: AdminProfile = {
    ...adminData,
    id: user.uid,
    uid: user.uid,
    permissions:
      Array.isArray(adminData.permissions) && adminData.permissions.length > 0
        ? adminData.permissions
        : getPermissionsForRole(adminData.role),
  };

  return {
    ok: true,
    actor: {
      name: resolvedProfile.fullName || user.displayName || user.email || 'Electoral Administrator',
      role: resolvedProfile.role,
      uid: user.uid,
      managedDomainIds: resolvedProfile.managedDomainIds,
      adminProfile: resolvedProfile,
    },
  };
}

function isCallableDomainRejection(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  return (
    code === 'functions/unauthenticated' ||
    code === 'functions/permission-denied' ||
    code === 'functions/failed-precondition' ||
    code === 'functions/invalid-argument' ||
    code === 'functions/not-found' ||
    code === 'unauthenticated' ||
    code === 'permission-denied' ||
    code === 'failed-precondition' ||
    code === 'invalid-argument' ||
    code === 'not-found'
  );
}

async function ensureBuiltInElectionInFirestore(id: string): Promise<void> {
  const builtInElection = getSrc2027ElectionById(id) || getHistoricalElectionById(id);
  if (!builtInElection) return;

  const ref = doc(db, 'elections', id);
  const snap = await getDoc(ref).catch(() => null);
  if (snap && !snap.exists()) {
    await setDoc(ref, stripUndefined({ ...builtInElection, updatedAt: serverTimestamp() }));
  }

  const builtInPositions =
    id === SRC_2027_ELECTION_ID
      ? getSrc2027PositionsByElectionId(id)
      : getHistoricalPositionsByElectionId(id);
  for (const pos of builtInPositions) {
    const pRef = doc(db, 'positions', pos.id);
    const pSnap = await getDoc(pRef).catch(() => null);
    if (pSnap && !pSnap.exists()) {
      await setDoc(pRef, stripUndefined(pos));
    }
  }

  if (id === SRC_2027_ELECTION_ID) {
    for (const cand of SRC_2027_CANDIDATES) {
      const cRef = doc(db, 'candidates', cand.id);
      const cSnap = await getDoc(cRef).catch(() => null);
      if (cSnap && !cSnap.exists()) {
        await setDoc(cRef, stripUndefined({ ...cand, updatedAt: serverTimestamp() }));
      }
    }
  }
}

async function ensureBuiltInPositionInFirestore(posId: string): Promise<void> {
  const builtIn =
    SRC_2027_POSITIONS.find((p) => p.id === posId) ||
    HISTORICAL_2026_POSITIONS.find((p) => p.id === posId);
  if (!builtIn) return;
  await ensureBuiltInElectionInFirestore(builtIn.electionId);
  const ref = doc(db, 'positions', posId);
  const snap = await getDoc(ref).catch(() => null);
  if (snap && !snap.exists()) {
    await setDoc(ref, stripUndefined(builtIn));
  }
}

async function ensureBuiltInCandidateInFirestore(id: string): Promise<void> {
  const builtIn = getSrc2027CandidateById(id) || getHistoricalCandidateById(id);
  if (!builtIn) return;
  await ensureBuiltInElectionInFirestore(builtIn.electionId);
  const ref = doc(db, 'candidates', id);
  const snap = await getDoc(ref).catch(() => null);
  if (snap && !snap.exists()) {
    await setDoc(ref, stripUndefined({ ...builtIn, updatedAt: serverTimestamp() }));
  }
}

class FirebaseAdminService {
  async seedSrc2027Election(): Promise<{
    success: boolean;
    createdElections: number;
    createdPositions: number;
    createdCandidates: number;
    error?: string;
  }> {
    let createdElections = 0;
    let createdPositions = 0;
    let createdCandidates = 0;

    try {
      const eRef = doc(db, 'elections', SRC_2027_ELECTION.id);
      const eSnap = await getDoc(eRef);
      if (!eSnap.exists()) {
        await setDoc(eRef, stripUndefined({ ...SRC_2027_ELECTION, updatedAt: serverTimestamp() }));
        createdElections++;
      }

      for (const pos of SRC_2027_POSITIONS) {
        const pRef = doc(db, 'positions', pos.id);
        const pSnap = await getDoc(pRef);
        if (!pSnap.exists()) {
          await setDoc(pRef, stripUndefined(pos));
          createdPositions++;
        }
      }

      for (const cand of SRC_2027_CANDIDATES) {
        const cRef = doc(db, 'candidates', cand.id);
        const cSnap = await getDoc(cRef);
        if (!cSnap.exists()) {
          await setDoc(cRef, stripUndefined({ ...cand, updatedAt: serverTimestamp() }));
          createdCandidates++;
        }
      }

      await setDoc(
        doc(db, 'domains', DIRECTORY_CONFIG_DOC_ID),
        {
          hiddenBuiltInElectionIds: arrayRemove(SRC_2027_ELECTION.id),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Synchronised UCC SRC General Elections 2027 (Draft) to Firestore',
        target: `${SRC_2027_ELECTION.code} · elections(${createdElections}), positions(${createdPositions}), candidates(${createdCandidates})`,
      });

      return {
        success: true,
        createdElections,
        createdPositions,
        createdCandidates,
      };
    } catch (err: any) {
      return {
        success: false,
        createdElections,
        createdPositions,
        createdCandidates,
        error: err?.message || 'Unable to synchronise UCC SRC 2027 election to Firestore.',
      };
    }
  }
  async seedHistorical2026Elections(): Promise<{
    success: boolean;
    createdElections: number;
    createdPositions: number;
    createdCandidates: number;
    createdResults: number;
    error?: string;
  }> {
    let createdElections = 0;
    let createdPositions = 0;
    let createdCandidates = 0;
    let createdResults = 0;

    try {
      await this.syncOfficialHallsToFirestore().catch(() => {});

      for (const elec of HISTORICAL_2026_ELECTIONS) {
        const ref = doc(db, 'elections', elec.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, stripUndefined({ ...elec, updatedAt: serverTimestamp() }));
          createdElections++;
        }
      }

      for (const pos of HISTORICAL_2026_POSITIONS) {
        const ref = doc(db, 'positions', pos.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, stripUndefined(pos));
          createdPositions++;
        }
      }

      for (const cand of HISTORICAL_2026_CANDIDATES) {
        const ref = doc(db, 'candidates', cand.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, stripUndefined({ ...cand, updatedAt: serverTimestamp() }));
          createdCandidates++;
        }
      }

      for (const [elecId, resPayload] of Object.entries(HISTORICAL_2026_RESULTS)) {
        const ref = doc(db, 'election_results', elecId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, stripUndefined({ ...resPayload, updatedAt: serverTimestamp() }));
          createdResults++;
        }
      }

      const histIds = HISTORICAL_2026_ELECTIONS.map((e) => e.id);
      if (histIds.length > 0) {
        await setDoc(
          doc(db, 'domains', DIRECTORY_CONFIG_DOC_ID),
          {
            hiddenBuiltInElectionIds: arrayRemove(...histIds),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Synchronised 2026 Historical Elections Archive to Firestore',
        target: `elections(${createdElections}), positions(${createdPositions}), candidates(${createdCandidates}), results(${createdResults})`,
      });

      return {
        success: true,
        createdElections,
        createdPositions,
        createdCandidates,
        createdResults,
      };
    } catch (err: any) {
      return {
        success: false,
        createdElections,
        createdPositions,
        createdCandidates,
        createdResults,
        error: err?.message || 'Unable to seed 2026 historical elections into Firestore.',
      };
    }
  }
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
    const id =
      payload.id?.trim() ||
      payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

    const domain: DomainRegistryItem = {
      id,
      name: payload.name.trim(),
      shortName: payload.shortName?.trim() || payload.name.trim(),
      category: payload.category || 'Other',
      description: payload.description.trim(),
      governanceScope: payload.governanceScope || 'Configured UCC electoral scope',
      eligibilityRuleSummary: payload.eligibilityRuleSummary || 'Verified active UCC students.',
      positionsPolicyNote: payload.positionsPolicyNote || 'Standard domain positions policy.',
      adminRole: 'Electoral Commissioner',
      supportsSubdomains: Boolean(payload.supportsSubdomains),
      subdomainType: payload.subdomainType || 'none',
      isBuiltIn: false,
      displayOrder: 50,
    };

    try {
      await setDoc(doc(db, 'domains', id), { ...domain, updatedAt: serverTimestamp() });
      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Created Election Domain',
        target: domain.name,
      });
      return { success: true, domain, message: 'Domain created in Cloud Firestore.' };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, `domains/${id}`);
    }
  }

  async createSubdomain(
    _domainId: DomainId,
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
    const subType = payload.type || 'hall';
    const colName =
      subType === 'faculty' ? 'faculties' : subType === 'department' ? 'departments' : 'halls';
    const id = `${subType}-${Date.now().toString(36)}`;
    const record = {
      id,
      name: payload.name.trim(),
      shortName: payload.shortName?.trim() || payload.name.trim(),
      code: payload.code?.trim() || id.toUpperCase(),
      college: payload.college || '',
      facultyId: payload.facultyId || '',
      facultyName: payload.facultyName || '',
      programmes: payload.programmes || [],
    };
    try {
      await setDoc(doc(db, colName, id), record);
      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: `Created ${subType} Sub-Domain`,
        target: record.name,
      });
      return { success: true, subdomain: record };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, `${colName}/${id}`);
    }
  }

  async syncOfficialHallsToFirestore(): Promise<{
    success: boolean;
    syncedCount: number;
    error?: string;
  }> {
    try {
      const existingSnap = await getDocs(collection(db, 'halls'));
      const existingMap = new Map<string, Record<string, any>>();
      existingSnap.docs.forEach((d) => existingMap.set(d.id, d.data()));

      for (const hall of UCC_HALLS) {
        const existing = existingMap.get(hall.id) || {};
        await setDoc(
          doc(db, 'halls', hall.id),
          stripUndefined({
            ...hall,
            logoUrl: existing.logoUrl || hall.logoUrl,
            motto: existing.motto || hall.motto,
            affiliationNote: existing.affiliationNote || hall.affiliationNote,
            isOfficial: true,
            updatedAt: serverTimestamp(),
          }),
          { merge: true }
        );
      }

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Synchronised 8 Official UCC Halls to Firestore',
        target: 'halls',
      });

      return { success: true, syncedCount: UCC_HALLS.length };
    } catch (err: any) {
      return {
        success: false,
        syncedCount: 0,
        error: err?.message || 'Unable to synchronise official halls to Firestore.',
      };
    }
  }

  async updateHallRecord(
    hallId: string,
    updates: Partial<HallUnit>
  ): Promise<{ success: boolean; hall?: HallUnit; error?: string }> {
    try {
      const base = UCC_HALLS.find((h) => h.id === hallId);
      const payload = stripUndefined({
        ...(base || {}),
        ...updates,
        id: hallId,
        isOfficial: base ? true : updates.isOfficial,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'halls', hallId), payload, { merge: true });
      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Updated Hall Record Metadata',
        target: base?.name || hallId,
      });
      return { success: true, hall: payload as HallUnit };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to update hall record.',
      };
    }
  }

  async createElection(payload: CreateElectionPayload): Promise<{
    success: boolean;
    election?: Election;
    positions?: Position[];
    createdCandidatesCount?: number;
    candidateWarnings?: string[];
    message?: string;
    error?: string;
  }> {
    const electionId = `elec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const domainId = payload.domainId || categoryToDomainId(payload.category);
    const category = payload.category || domainIdToCategory(domainId);
    const code =
      payload.code?.trim() ||
      `UCC-${category.replace(/[^A-Z]/gi, '').slice(0, 4).toUpperCase()}-${new Date().getFullYear()}`;

    const positionsInput = payload.positions || [];
    const nowIso = new Date().toISOString();

    const electionData: Election = stripUndefined({
      id: electionId,
      title: payload.title.trim(),
      code,
      description: payload.description.trim(),
      category,
      domainId,
      hallId: payload.hallId || undefined,
      facultyId: payload.facultyId || undefined,
      departmentId: payload.departmentId || undefined,
      subdomainLabel: payload.subdomainLabel || undefined,
      academicYear: payload.academicYear,
      status: 'draft',
      startDate: payload.startDate,
      endDate: payload.endDate,
      startTime: payload.startTime || '08:00',
      endTime: payload.endTime || '17:00',
      totalEligibleVoters: 0,
      totalVotesCast: 0,
      turnoutPercentage: 0,
      organizingBody: payload.organizingBody.trim(),
      eligibilityCriteria: payload.eligibilityCriteria || {},
      rules: payload.rules || [],
      positionsCount: positionsInput.length,
      resultsCertified: false,
      provisionalResultsReady: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    try {
      await setDoc(doc(db, 'elections', electionId), stripUndefined({
        ...electionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      const createdPositions: Position[] = [];
      for (let i = 0; i < positionsInput.length; i++) {
        const p = positionsInput[i];
        const posId = `pos_${electionId}_${i + 1}_${Date.now().toString(36)}`;
        const posDoc: Position = stripUndefined({
          id: posId,
          electionId,
          domainId,
          hallId: electionData.hallId || undefined,
          facultyId: electionData.facultyId || undefined,
          departmentId: electionData.departmentId || undefined,
          title: p.title.trim(),
          description: p.description?.trim() || '',
          maxSelections: p.maxSelections || 1,
          allowsSkip: p.allowsSkip ?? true,
          order: i + 1,
          candidateIds: [],
          candidateEligibilityRules: p.candidateEligibilityRules || '',
          votingRules: p.votingRules || '',
        });
        await setDoc(doc(db, 'positions', posId), posDoc);
        createdPositions.push(posDoc);
      }

      let createdCandidatesCount = 0;
      const candidateWarnings: string[] = [];

      if (Array.isArray(payload.candidateAssignments) && payload.candidateAssignments.length > 0) {
        for (const assignment of payload.candidateAssignments) {
          let targetPos: Position | undefined =
            typeof assignment.positionIndex === 'number'
              ? createdPositions[assignment.positionIndex]
              : undefined;
          if (!targetPos && assignment.positionTitle) {
            targetPos = createdPositions.find(
              (p) => p.title.toLowerCase() === assignment.positionTitle!.trim().toLowerCase()
            );
          }
          if (!targetPos) {
            candidateWarnings.push(
              `Skipped "${assignment.fullName}": selected position does not belong to this election.`
            );
            continue;
          }

          const profileSnapshot: Partial<ContestantProfile> = stripUndefined({
            fullName: assignment.fullName,
            studentId: assignment.studentId,
            nickname: assignment.nickname,
            email: assignment.email,
            phone: assignment.phone,
            department: assignment.department,
            faculty: assignment.faculty,
            programme: assignment.programme,
            level: assignment.level,
            hall: assignment.hall,
            photoUrl: assignment.photoUrl,
            photoStoragePath: assignment.photoStoragePath,
            biography: assignment.biography,
            leadershipExperience: assignment.leadershipExperience,
          });

          const res = await this.assignContestantToElection({
            electionId,
            positionId: targetPos.id,
            contestantId: assignment.contestantId,
            mode: assignment.isNewContestant || !assignment.contestantId ? 'new' : 'existing',
            updatePermanentProfile: Boolean(assignment.updatePermanentProfile),
            permanentProfileUpdates: assignment.updatePermanentProfile
              ? profileSnapshot
              : undefined,
            profileSnapshot,
            electionParticipation: {
              manifestoSummary: assignment.manifestoSummary,
              fullManifesto: assignment.fullManifesto,
              keyPromises: assignment.keyPromises,
              campaignStatement: assignment.campaignStatement,
              electionPhotoUrl: assignment.electionPhotoUrl,
              videoUrl: assignment.videoUrl,
              applicationStatus: assignment.applicationStatus || 'Approved',
            },
          });
          if (res.success) {
            createdCandidatesCount++;
          } else {
            candidateWarnings.push(
              `${assignment.fullName}: ${res.error || 'Could not assign contestant.'}`
            );
          }
        }
      }

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action:
          createdCandidatesCount > 0
            ? `Created Election with ${createdCandidatesCount} Initial Candidate(s)`
            : 'Created Election',
        target: `${electionData.title} (${electionData.code})`,
      });

      return {
        success: true,
        election: electionData,
        positions: createdPositions,
        createdCandidatesCount,
        candidateWarnings: candidateWarnings.length > 0 ? candidateWarnings : undefined,
        message:
          createdCandidatesCount > 0
            ? `Election saved to Cloud Firestore with ${createdCandidatesCount} candidate(s) assigned.`
            : 'Election saved to Cloud Firestore.',
      };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, `elections/${electionId}`);
    }
  }

  async updateElection(
    id: string,
    updates: Partial<Election>
  ): Promise<{ success: boolean; election?: Election; message?: string; error?: string }> {
    try {
      await ensureBuiltInElectionInFirestore(id);
      const cleanUpdates = stripUndefined({
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'elections', id), cleanUpdates);
      const updatedSnap = await getDoc(doc(db, 'elections', id)).catch(() => null);
      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Updated Election Configuration',
        target: id,
      });
      return {
        success: true,
        election: updatedSnap?.exists()
          ? mapDoc<Election>(updatedSnap.id, updatedSnap.data())
          : undefined,
        message: 'Election updated in Cloud Firestore.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to update election configuration.',
      };
    }
  }

  async changeStatus(
    id: string,
    newStatus: ElectionStatus,
    justification?: string
  ): Promise<{ success: boolean; election?: Election; message?: string; error?: string }> {
    if (newStatus === 'archived') {
      return this.archiveElection(id, justification);
    }
    if (newStatus === 'cancelled') {
      return this.cancelElection(id, justification);
    }

    try {
      const actor = await getCurrentAdminContext();
      const statusUpdate: Record<string, any> = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };
      if (newStatus === 'scheduled' || newStatus === 'live') {
        statusUpdate.approvedBy = actor.name;
      }
      if (newStatus === 'results_published') {
        statusUpdate.resultsCertified = true;
      } else if (newStatus === 'draft' || newStatus === 'scheduled' || newStatus === 'closed') {
        statusUpdate.resultsCertified = false;
      }

      await ensureBuiltInElectionInFirestore(id);
      await updateDoc(doc(db, 'elections', id), statusUpdate);

      // Keep published state of election_results synced when unpublishing results (never strip archived results)
      if (newStatus !== 'results_published') {
        const resDocRef = doc(db, 'election_results', id);
        const resSnap = await getDoc(resDocRef).catch(() => null);
        if (resSnap?.exists() && resSnap.data()?.isPublished) {
          await updateDoc(resDocRef, {
            isPublished: false,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }

      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        adminUid: actor.uid,
        electionId: id,
        reason: justification,
        action: `Transitioned Election Status -> ${newStatus}`,
        target: justification ? `${id} (${justification})` : id,
      });
      const updated = await getDoc(doc(db, 'elections', id));
      return {
        success: true,
        election: updated.exists() ? mapDoc<Election>(updated.id, updated.data()) : undefined,
        message: `Election status updated to ${newStatus.replace(/_/g, ' ')}.`,
      };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `elections/${id}`);
    }
  }

  async inspectElectionRemovalEligibility(electionId: string): Promise<{
    success: boolean;
    election?: Election;
    eligibility?: ElectionRemovalEligibility;
    counts?: {
      positionsCount: number;
      candidatesCount: number;
      authorisationsCount: number;
      confirmationsCount: number;
    };
    error?: string;
  }> {
    if (!isValidElectionId(electionId)) {
      return { success: false, error: 'Invalid election ID format.' };
    }

    try {
      const electionSnap = await getDoc(doc(db, 'elections', electionId));
      const election: Election | null = electionSnap.exists()
        ? mapDoc<Election>(electionSnap.id, electionSnap.data())
        : getHistoricalElectionById(electionId) || null;

      if (!election) {
        return { success: false, error: 'Election record not found.' };
      }

      const [posSnap, candSnap, authSnap, confirmSnap, resSnap, ballotsSnap] = await Promise.all([
        getDocs(query(collection(db, 'positions'), where('electionId', '==', electionId))).catch(() => null),
        getDocs(query(collection(db, 'candidates'), where('electionId', '==', electionId))).catch(() => null),
        getDocs(query(collection(db, 'voter_authorisations'), where('electionId', '==', electionId))).catch(
          () => null
        ),
        getDocs(query(collection(db, 'vote_confirmations'), where('electionId', '==', electionId))).catch(
          () => null
        ),
        getDoc(doc(db, 'election_results', electionId)).catch(() => null),
        getDocs(query(collection(db, 'ballots'), where('electionId', '==', electionId), limit(1))).catch(
          () => null
        ),
      ]);

      const candidateVotesTotal = candSnap
        ? candSnap.docs.reduce((sum, d) => sum + (Number(d.data()?.votesReceived) || 0), 0)
        : 0;
      const authorisationsCount = authSnap?.size || 0;
      const confirmationsCount = confirmSnap?.size || 0;
      const ballotsCount = ballotsSnap?.size || 0;
      const resData = resSnap?.exists() ? resSnap.data() : null;

      const eligibility = assessElectionRemovalEligibility(election, {
        ballotsCount,
        authorisationsCount,
        confirmationsCount,
        candidateVotesTotal,
        hasPublishedResults: Boolean(resData?.isPublished),
        hasExistingResultsDoc: Boolean(resSnap?.exists()),
        resultsCertified: Boolean(resData?.resultsCertified),
      });

      return {
        success: true,
        election,
        eligibility,
        counts: {
          positionsCount: posSnap?.size || election.positionsCount || 0,
          candidatesCount: candSnap?.size || 0,
          authorisationsCount,
          confirmationsCount,
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to inspect election removal eligibility.' };
    }
  }

  async removeElectionPermanently(
    electionId: string,
    confirmationText: string,
    reason?: string
  ): Promise<{
    success: boolean;
    mode?: 'deleted';
    deletedDocumentsCount?: number;
    message?: string;
    error?: string;
    code?: string;
  }> {
    if (!isValidElectionId(electionId)) {
      return { success: false, error: 'Invalid election ID format.' };
    }

    const inspection = await this.inspectElectionRemovalEligibility(electionId);
    if (!inspection.success || !inspection.election || !inspection.eligibility) {
      return { success: false, error: inspection.error || 'Election record not found.' };
    }

    const authCheck = await assertActiveAdminContext(inspection.election);
    if (authCheck.ok === false) {
      return { success: false, error: authCheck.error, code: 'PERMISSION_DENIED' };
    }

    if (!matchesRemovalConfirmation(confirmationText, inspection.election)) {
      return {
        success: false,
        error: 'Explicit confirmation text did not match the election title or required deletion phrase.',
        code: 'CONFIRMATION_MISMATCH',
      };
    }

    if (!inspection.eligibility.canPermanentlyDelete) {
      return {
        success: false,
        error:
          inspection.eligibility.blockedReason ||
          'This election cannot be permanently deleted.',
        code: inspection.eligibility.isLive ? 'ELECTION_LIVE' : 'REMOVAL_BLOCKED',
      };
    }

    // Attempt trusted Cloud Function first when deployed
    try {
      const fn = httpsCallable(functions, 'removeElection');
      const res = await fn({ electionId, confirmationText, reason });
      const data = res.data as any;
      if (data?.success) {
        return {
          success: true,
          mode: 'deleted',
          deletedDocumentsCount: data.deletedDocumentsCount,
          message: data.message || `Election "${inspection.election.title}" permanently removed.`,
        };
      }
    } catch (err: any) {
      if (isCallableDomainRejection(err)) {
        return { success: false, error: err?.message || 'Server rejected election removal.' };
      }
      // Fall back to rules-enforced admin Firestore removal when Cloud Functions are unavailable
    }

    try {
      const [posSnap, candSnap, assignSnap, resSnap] = await Promise.all([
        getDocs(query(collection(db, 'positions'), where('electionId', '==', electionId))),
        getDocs(query(collection(db, 'candidates'), where('electionId', '==', electionId))),
        getDocs(query(collection(db, 'candidate_assignments'), where('electionId', '==', electionId))),
        getDoc(doc(db, 'election_results', electionId)).catch(() => null),
      ]);

      // Final pre-delete safeguard on fresh reads
      const candHasVotes = candSnap.docs.some((d) => (Number(d.data()?.votesReceived) || 0) > 0);
      const resPublishedOrCertified =
        resSnap?.exists() &&
        (resSnap.data()?.isPublished === true || resSnap.data()?.resultsCertified === true);

      if (candHasVotes || resPublishedOrCertified) {
        return {
          success: false,
          error:
            'Candidate votes or certified results were detected. Permanent deletion aborted; archive the election instead.',
          code: 'VOTES_EXIST',
        };
      }

      const refsToDelete = [
        ...posSnap.docs.map((d) => d.ref),
        ...candSnap.docs.map((d) => d.ref),
        ...assignSnap.docs.map((d) => d.ref),
      ];
      if (resSnap?.exists() && !resPublishedOrCertified) {
        refsToDelete.push(resSnap.ref);
      }
      refsToDelete.push(doc(db, 'elections', electionId));

      const CHUNK_SIZE = 400;
      for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        refsToDelete.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      if (electionId === SRC_2027_ELECTION_ID) {
        await setDoc(
          doc(db, 'domains', DIRECTORY_CONFIG_DOC_ID),
          {
            hiddenBuiltInElectionIds: arrayUnion(electionId),
            updatedAt: serverTimestamp(),
            updatedBy: authCheck.actor.name,
          },
          { merge: true }
        ).catch(() => {});
      }

      await writeAuditLog({
        adminName: authCheck.actor.name,
        adminRole: authCheck.actor.role,
        adminUid: authCheck.actor.uid,
        electionId,
        reason: reason?.trim() || 'Draft/unused election permanently removed by administrator',
        action: 'Permanently Removed Election',
        target: `${inspection.election.title} (${inspection.election.code})`,
        status: 'warning',
      });

      return {
        success: true,
        mode: 'deleted',
        deletedDocumentsCount: refsToDelete.length,
        message: `Election "${inspection.election.title}" and its ${refsToDelete.length - 1} associated unpublished record(s) were permanently removed.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.DELETE, `elections/${electionId}`),
      };
    }
  }

  async inspectAllElectionsForRemoval(): Promise<{
    success: boolean;
    items: BulkElectionInspectionItem[];
    summary?: BulkRemovalPlanSummary;
    error?: string;
    code?: string;
  }> {
    const authCheck = await assertActiveAdminContext();
    if (authCheck.ok === false) {
      return { success: false, items: [], error: authCheck.error, code: 'PERMISSION_DENIED' };
    }
    if (!isGlobalGovernanceAdmin(authCheck.actor.adminProfile)) {
      return {
        success: false,
        items: [],
        error:
          'Only unrestricted Super Administrators or Electoral Commissioners can inspect and execute platform-wide election removal.',
        code: 'GLOBAL_ADMIN_REQUIRED',
      };
    }

    try {
      const [
        electionsSnap,
        posSnap,
        candSnap,
        assignSnap,
        resSnap,
        authSnap,
        confirmSnap,
        dirConfig,
      ] = await Promise.all([
        getDocs(collection(db, 'elections')),
        getDocs(collection(db, 'positions')),
        getDocs(collection(db, 'candidates')),
        getDocs(collection(db, 'candidate_assignments')).catch(() => null),
        getDocs(collection(db, 'election_results')).catch(() => null),
        getDocs(collection(db, 'voter_authorisations')).catch(() => null),
        getDocs(collection(db, 'vote_confirmations')).catch(() => null),
        getDirectoryConfig(),
      ]);

      const firestoreElections = electionsSnap.docs.map((d) => mapDoc<Election>(d.id, d.data()));
      const firestoreElectionIds = new Set(firestoreElections.map((e) => e.id));
      const hiddenBuiltInSet = new Set(dirConfig.hiddenBuiltInElectionIds);

      // Include all non-detached Firestore elections + any unsuppressed built-in elections
      const mergedElectionsRaw = mergeSrc2027Elections(
        mergeHistoricalElections(firestoreElections)
      );
      const activeInventoryElections = mergedElectionsRaw.filter((el) => {
        if (el.hiddenFromDirectory === true) return false;
        if (!firestoreElectionIds.has(el.id) && hiddenBuiltInSet.has(el.id)) return false;
        return true;
      });

      const firestorePosByElection: Record<string, Position[]> = {};
      posSnap.docs.forEach((d) => {
        const pos = mapDoc<Position>(d.id, d.data());
        if (!pos.electionId) return;
        if (!firestorePosByElection[pos.electionId]) {
          firestorePosByElection[pos.electionId] = [];
        }
        firestorePosByElection[pos.electionId].push(pos);
      });
      const mergedPositions = mergeSrc2027Positions(
        mergeHistoricalPositions(firestorePosByElection)
      );

      const mergedCandidates = mergeSrc2027Candidates(
        mergeHistoricalCandidates(candSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data())))
      );

      const assignCountByElection: Record<string, number> = {};
      assignSnap?.docs.forEach((d) => {
        const eid = String(d.data()?.electionId || '');
        if (eid) assignCountByElection[eid] = (assignCountByElection[eid] || 0) + 1;
      });

      const authCountByElection: Record<string, number> = {};
      authSnap?.docs.forEach((d) => {
        const eid = String(d.data()?.electionId || '');
        if (eid) authCountByElection[eid] = (authCountByElection[eid] || 0) + 1;
      });

      const confirmCountByElection: Record<string, number> = {};
      confirmSnap?.docs.forEach((d) => {
        const eid = String(d.data()?.electionId || '');
        if (eid) confirmCountByElection[eid] = (confirmCountByElection[eid] || 0) + 1;
      });

      const resultsDocByElection: Record<string, Record<string, any>> = {};
      resSnap?.docs.forEach((d) => {
        resultsDocByElection[d.id] = d.data();
      });

      const items: BulkElectionInspectionItem[] = activeInventoryElections.map((election) => {
        const inFirestore = firestoreElectionIds.has(election.id);
        const posList = inFirestore
          ? firestorePosByElection[election.id] || []
          : mergedPositions[election.id] || [];
        const candList = mergedCandidates.filter((c) => c.electionId === election.id);
        const candidateVotesTotal = candList.reduce(
          (sum, c) => sum + Math.max(0, Number(c.votesReceived) || 0),
          0
        );
        const authorisationsCount = authCountByElection[election.id] || 0;
        const confirmationsCount = confirmCountByElection[election.id] || 0;
        const assignmentsCount = assignCountByElection[election.id] || 0;
        const resData = resultsDocByElection[election.id];
        const hasExistingResultsDoc = Boolean(resData);
        const hasPublishedResults =
          Boolean(resData?.isPublished) || election.status === 'results_published';
        const resultsCertified =
          Boolean(election.resultsCertified) || Boolean(resData?.resultsCertified);
        const ballotsCount = Math.max(0, Number(election.totalVotesCast) || 0);

        const eligibility = assessElectionRemovalEligibility(election, {
          ballotsCount,
          authorisationsCount,
          confirmationsCount,
          candidateVotesTotal,
          hasPublishedResults,
          hasExistingResultsDoc,
          resultsCertified,
        });

        const votingRecordsExist =
          ballotsCount > 0 ||
          authorisationsCount > 0 ||
          confirmationsCount > 0 ||
          candidateVotesTotal > 0 ||
          hasPublishedResults ||
          resultsCertified;

        const baseItem: BulkElectionInspectionItem = {
          election,
          source: inFirestore ? 'firestore' : 'builtin_only',
          positionsCount: posList.length || election.positionsCount || 0,
          candidatesCount: candList.length,
          assignmentsCount,
          authorisationsCount,
          confirmationsCount,
          ballotsCount,
          candidateVotesTotal,
          hasExistingResultsDoc,
          hasPublishedResults,
          resultsCertified,
          votingRecordsExist,
          eligibility,
          protectedRecords: [],
        };
        baseItem.protectedRecords = collectProtectedRecordLabels(baseItem);
        return baseItem;
      });

      return {
        success: true,
        items,
        summary: buildBulkRemovalPlan(items, { includeHistorical: false }),
      };
    } catch (err: any) {
      return {
        success: false,
        items: [],
        error: err?.message || 'Unable to inspect elections for bulk removal.',
      };
    }
  }

  async executeRemoveAllElections(options: {
    confirmationText: string;
    includeHistorical?: boolean;
    detachProtectedElections?: boolean;
    reason?: string;
  }): Promise<{
    success: boolean;
    code?: string;
    error?: string;
    message?: string;
    plan?: BulkRemovalPlanSummary;
    blockedReport?: Array<{
      electionId: string;
      title: string;
      code: string;
      status: string;
      protectedRecords: string[];
      reason: string;
    }>;
    removedElectionsCount?: number;
    removedRelatedDocsCount?: number;
    archivedDetachedCount?: number;
    preservedHistoricalCount?: number;
    preservedCollections?: string[];
  }> {
    const authCheck = await assertActiveAdminContext();
    if (authCheck.ok === false) {
      return { success: false, code: 'PERMISSION_DENIED', error: authCheck.error };
    }
    if (!isGlobalGovernanceAdmin(authCheck.actor.adminProfile)) {
      return {
        success: false,
        code: 'GLOBAL_ADMIN_REQUIRED',
        error:
          'Only unrestricted Super Administrators or Electoral Commissioners can execute REMOVE ALL ELECTIONS.',
      };
    }

    if (!matchesBulkRemovalConfirmation(options.confirmationText)) {
      return {
        success: false,
        code: 'CONFIRMATION_MISMATCH',
        error: `Confirmation text did not match the exact required phrase "${BULK_REMOVE_CONFIRMATION_PHRASE}".`,
      };
    }

    const inspection = await this.inspectAllElectionsForRemoval();
    if (!inspection.success) {
      return {
        success: false,
        code: inspection.code || 'INSPECTION_FAILED',
        error: inspection.error || 'Could not inspect existing elections.',
      };
    }

    const includeHistorical = Boolean(options.includeHistorical);
    const detachProtected = Boolean(options.detachProtectedElections);
    const plan = buildBulkRemovalPlan(inspection.items, { includeHistorical });

    if (plan.totalFound === 0) {
      return {
        success: true,
        message: 'No existing elections remain in the active election directory.',
        plan,
        removedElectionsCount: 0,
        removedRelatedDocsCount: 0,
        archivedDetachedCount: 0,
        preservedHistoricalCount: 0,
        preservedCollections: [
          'ballots',
          'voter_authorisations',
          'vote_confirmations',
          'election_results (certified)',
          'audit_logs',
          'students',
          'voter_eligibility',
          'admins',
          'contestants',
        ],
      };
    }

    // Safety Gate 1: Never delete or detach active LIVE elections in bulk
    const liveBlockers = plan.items.filter((i) => i.disposition === 'blocked_live');
    if (liveBlockers.length > 0) {
      return {
        success: false,
        code: 'LIVE_ELECTIONS_BLOCK_REMOVAL',
        plan,
        blockedReport: liveBlockers.map((b) => ({
          electionId: b.election.id,
          title: b.election.title,
          code: b.election.code,
          status: b.election.status,
          protectedRecords: b.protectedRecords,
          reason: b.reason,
        })),
        error: `${liveBlockers.length} LIVE election(s) prevent bulk removal. Close or cancel live voting before removing or detaching elections.`,
      };
    }

    // Safety Gate 2: Stop and report if protected voting/historical records prevent safe permanent deletion
    const detachTargets = plan.items.filter((i) => i.disposition === 'detach_archive');
    if (!detachProtected && detachTargets.some((t) => t.votingRecordsExist || t.election.isHistorical)) {
      return {
        success: false,
        code: 'PROTECTED_VOTING_RECORDS_EXIST',
        plan,
        blockedReport: detachTargets.map((b) => ({
          electionId: b.election.id,
          title: b.election.title,
          code: b.election.code,
          status: b.election.status,
          protectedRecords: b.protectedRecords,
          reason: b.reason,
        })),
        error:
          'Complete permanent deletion stopped because protected voting, result, or historical records exist. Approve archival & detachment to clear those elections from the active directory while preserving all protected records.',
      };
    }

    const builtInIdsSet = new Set<string>([
      SRC_2027_ELECTION_ID,
      ...HISTORICAL_2026_ELECTIONS.map((e) => e.id),
    ]);

    // Attempt trusted Cloud Function first when deployed
    try {
      const fn = httpsCallable(functions, 'removeAllElections');
      const res = await fn({
        confirmationText: options.confirmationText,
        includeHistorical,
        detachProtectedElections: detachProtected,
        reason: options.reason,
        builtInElectionIds: plan.items
          .filter((i) => i.disposition !== 'skip_historical' && builtInIdsSet.has(i.election.id))
          .map((i) => i.election.id),
      });
      const data = res.data as any;
      if (data?.success) {
        return {
          success: true,
          plan,
          removedElectionsCount: data.removedElectionsCount ?? 0,
          removedRelatedDocsCount: data.removedRelatedDocsCount ?? 0,
          archivedDetachedCount: data.archivedDetachedCount ?? 0,
          preservedHistoricalCount: data.preservedHistoricalCount ?? plan.skippedHistoricalCount,
          preservedCollections: data.preservedCollections || [
            'ballots',
            'voter_authorisations',
            'vote_confirmations',
            'election_results (certified / published)',
            'audit_logs',
            'students',
            'voter_eligibility',
            'admins',
            'contestants',
          ],
          message: data.message,
        };
      }
    } catch (err: any) {
      if (isCallableDomainRejection(err)) {
        return {
          success: false,
          code: 'SERVER_REJECTED',
          error: err?.message || 'Server rejected bulk election removal.',
        };
      }
      // Fall back to rules-enforced client Firestore cleanup when Cloud Functions are unavailable (e.g. Spark plan)
    }

    try {
      let removedElectionsCount = 0;
      let removedRelatedDocsCount = 0;
      let archivedDetachedCount = 0;
      const hiddenBuiltInIdsToAdd = new Set<string>();

      // 1. Permanently delete zero-vote / non-live / non-historical elections
      for (const item of plan.items.filter((i) => i.disposition === 'delete')) {
        const eid = item.election.id;
        if (builtInIdsSet.has(eid)) {
          hiddenBuiltInIdsToAdd.add(eid);
        }
        if (item.source === 'firestore') {
          const [pSnap, cSnap, aSnap, rSnap, authCheckSnap, confCheckSnap] = await Promise.all([
            getDocs(query(collection(db, 'positions'), where('electionId', '==', eid))),
            getDocs(query(collection(db, 'candidates'), where('electionId', '==', eid))),
            getDocs(query(collection(db, 'candidate_assignments'), where('electionId', '==', eid))),
            getDoc(doc(db, 'election_results', eid)).catch(() => null),
            getDocs(query(collection(db, 'voter_authorisations'), where('electionId', '==', eid), limit(1))).catch(() => null),
            getDocs(query(collection(db, 'vote_confirmations'), where('electionId', '==', eid), limit(1))).catch(() => null),
          ]);

          const freshHasVotes =
            cSnap.docs.some((d) => (Number(d.data()?.votesReceived) || 0) > 0) ||
            (authCheckSnap?.size || 0) > 0 ||
            (confCheckSnap?.size || 0) > 0 ||
            (rSnap?.exists() &&
              (rSnap.data()?.isPublished === true || rSnap.data()?.resultsCertified === true));

          if (freshHasVotes) {
            // Dynamically downgrade to safe archive & detach rather than deleting protected records
            await updateDoc(doc(db, 'elections', eid), {
              previousStatus: item.election.status,
              status: 'archived',
              isPublished: false,
              hiddenFromDirectory: true,
              archivedAt: new Date().toISOString(),
              archivedBy: authCheck.actor.name,
              archivedByUid: authCheck.actor.uid,
              archiveReason:
                options.reason?.trim() ||
                'Archived & detached during bulk directory clearance (voting records detected)',
              detachedAt: new Date().toISOString(),
              detachedBy: authCheck.actor.name,
              updatedAt: serverTimestamp(),
            });
            archivedDetachedCount++;
            continue;
          }

          const refsToDelete = [
            ...pSnap.docs.map((d) => d.ref),
            ...cSnap.docs.map((d) => d.ref),
            ...aSnap.docs.map((d) => d.ref),
          ];
          if (rSnap?.exists() && rSnap.data()?.isPublished !== true && rSnap.data()?.resultsCertified !== true) {
            refsToDelete.push(rSnap.ref);
          }
          refsToDelete.push(doc(db, 'elections', eid));

          const CHUNK_SIZE = 400;
          for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
            const batch = writeBatch(db);
            refsToDelete.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
            await batch.commit();
          }
          removedElectionsCount++;
          removedRelatedDocsCount += Math.max(0, refsToDelete.length - 1);
        } else {
          removedElectionsCount++;
        }
      }

      // 2. Archive & detach protected/historical elections without deleting voting or result records
      for (const item of detachTargets) {
        const eid = item.election.id;
        if (builtInIdsSet.has(eid)) {
          hiddenBuiltInIdsToAdd.add(eid);
        }
        if (item.source === 'firestore') {
          await updateDoc(doc(db, 'elections', eid), {
            previousStatus: item.election.status,
            status: 'archived',
            isPublished: false,
            hiddenFromDirectory: true,
            archivedAt: item.election.archivedAt || new Date().toISOString(),
            archivedBy: item.election.archivedBy || authCheck.actor.name,
            archivedByUid: item.election.archivedByUid || authCheck.actor.uid,
            archiveReason:
              options.reason?.trim() ||
              item.election.archiveReason ||
              'Archived & detached from active directory while preserving ballots, receipts, and results',
            detachedAt: new Date().toISOString(),
            detachedBy: authCheck.actor.name,
            updatedAt: serverTimestamp(),
          });
        }
        archivedDetachedCount++;
      }

      // 3. Persist suppressed built-in IDs so built-ins do not re-appear until re-synced
      if (hiddenBuiltInIdsToAdd.size > 0) {
        await setDoc(
          doc(db, 'domains', DIRECTORY_CONFIG_DOC_ID),
          {
            hiddenBuiltInElectionIds: arrayUnion(...Array.from(hiddenBuiltInIdsToAdd)),
            updatedAt: serverTimestamp(),
            updatedBy: authCheck.actor.name,
          },
          { merge: true }
        );
      }

      const preservedHistoricalCount = plan.skippedHistoricalCount;
      const preservedCollections = [
        'ballots',
        'voter_authorisations',
        'vote_confirmations',
        'election_results (certified / published)',
        'audit_logs',
        'students',
        'voter_eligibility',
        'admins',
        'contestants',
      ];

      await writeAuditLog({
        adminName: authCheck.actor.name,
        adminRole: authCheck.actor.role,
        adminUid: authCheck.actor.uid,
        reason: options.reason?.trim() || 'Bulk election directory clearance executed',
        action: 'REMOVE ALL ELECTIONS Executed',
        target: `Removed ${removedElectionsCount} election(s) (+${removedRelatedDocsCount} related docs); Archived/Detached ${archivedDetachedCount}; Preserved Historical ${preservedHistoricalCount}`,
        status: 'warning',
      });

      return {
        success: true,
        plan,
        removedElectionsCount,
        removedRelatedDocsCount,
        archivedDetachedCount,
        preservedHistoricalCount,
        preservedCollections,
        message: `Removed ${removedElectionsCount} election(s) and archived/detached ${archivedDetachedCount} protected election(s). All ballots, voter authorisations, confirmation receipts, student accounts, admin accounts, permanent contestant profiles, and audit logs remain preserved.`,
      };
    } catch (err: any) {
      return {
        success: false,
        code: 'BULK_REMOVAL_FAILED',
        error: formatFirestorePermissionError(err, OperationType.DELETE, 'elections'),
      };
    }
  }

  async archiveElection(
    electionId: string,
    reason?: string
  ): Promise<{ success: boolean; election?: Election; message?: string; error?: string }> {
    if (!isValidElectionId(electionId)) {
      return { success: false, error: 'Invalid election ID format.' };
    }

    try {
      await ensureBuiltInElectionInFirestore(electionId);
      const eSnap = await getDoc(doc(db, 'elections', electionId));
      if (!eSnap.exists()) {
        return { success: false, error: 'Election record not found.' };
      }
      const currentElection = mapDoc<Election>(eSnap.id, eSnap.data());

      const authCheck = await assertActiveAdminContext(currentElection);
      if (authCheck.ok === false) {
        return { success: false, error: authCheck.error };
      }

      if (currentElection.status === 'live') {
        return {
          success: false,
          error: 'Active (live) elections must be closed or cancelled before archiving.',
        };
      }
      if (currentElection.status === 'archived') {
        return { success: false, error: 'This election is already archived.' };
      }

      try {
        const fn = httpsCallable(functions, 'archiveElection');
        const res = await fn({ electionId, reason });
        const data = res.data as any;
        if (data?.success) {
          return {
            success: true,
            election: data.election as Election,
            message:
              data.message ||
              `Election "${currentElection.title}" archived with ballots and results preserved.`,
          };
        }
      } catch (err: any) {
        if (isCallableDomainRejection(err)) {
          return { success: false, error: err?.message || 'Server rejected election archive.' };
        }
      }

      const archivedAt = new Date().toISOString();
      await updateDoc(doc(db, 'elections', electionId), {
        previousStatus: currentElection.status,
        status: 'archived',
        archivedAt,
        archivedBy: authCheck.actor.name,
        archivedByUid: authCheck.actor.uid,
        archiveReason: reason?.trim() || 'Archived by Electoral Commission administrator',
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        adminName: authCheck.actor.name,
        adminRole: authCheck.actor.role,
        adminUid: authCheck.actor.uid,
        electionId,
        reason: reason?.trim() || 'Archived by Electoral Commission administrator',
        action: 'Archived Election',
        target: `${currentElection.title} (${currentElection.code})`,
        status: 'success',
      });

      const updated = await getDoc(doc(db, 'elections', electionId));
      return {
        success: true,
        election: updated.exists() ? mapDoc<Election>(updated.id, updated.data()) : undefined,
        message: `Election "${currentElection.title}" has been archived. All ballots, confirmations, receipts, and results remain preserved.`,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to archive election.' };
    }
  }

  async restoreArchivedElection(
    electionId: string,
    targetStatus?: ElectionStatus,
    reason?: string
  ): Promise<{ success: boolean; election?: Election; message?: string; error?: string }> {
    if (!isValidElectionId(electionId)) {
      return { success: false, error: 'Invalid election ID format.' };
    }

    try {
      const eSnap = await getDoc(doc(db, 'elections', electionId));
      if (!eSnap.exists()) {
        return { success: false, error: 'Election record not found.' };
      }
      const currentElection = mapDoc<Election>(eSnap.id, eSnap.data());

      const authCheck = await assertActiveAdminContext(currentElection);
      if (authCheck.ok === false) {
        return { success: false, error: authCheck.error };
      }

      if (currentElection.isHistorical) {
        return {
          success: false,
          error: 'Built-in historical 2026 archives cannot be restored from archive.',
        };
      }
      if (currentElection.status !== 'archived') {
        return { success: false, error: 'Only archived elections can be restored.' };
      }

      try {
        const fn = httpsCallable(functions, 'restoreArchivedElection');
        const res = await fn({ electionId, targetStatus, reason });
        const data = res.data as any;
        if (data?.success) {
          return {
            success: true,
            election: data.election as Election,
            message: data.message || 'Archived election restored.',
          };
        }
      } catch (err: any) {
        if (isCallableDomainRejection(err)) {
          return { success: false, error: err?.message || 'Server rejected restore request.' };
        }
      }

      const safeRestoreStatuses = new Set<ElectionStatus>([
        'draft',
        'pending_approval',
        'scheduled',
        'suspended',
        'closed',
        'cancelled',
        'results_pending_certification',
        'results_published',
      ]);
      const candidateStatus = (targetStatus || currentElection.previousStatus) as ElectionStatus | undefined;
      const restoredStatus: ElectionStatus =
        candidateStatus && safeRestoreStatuses.has(candidateStatus) ? candidateStatus : 'closed';

      await updateDoc(doc(db, 'elections', electionId), {
        status: restoredStatus,
        restoredAt: new Date().toISOString(),
        restoredBy: authCheck.actor.name,
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        adminName: authCheck.actor.name,
        adminRole: authCheck.actor.role,
        adminUid: authCheck.actor.uid,
        electionId,
        reason: reason?.trim() || `Restored from archive to ${restoredStatus}`,
        action: `Restored Archived Election -> ${restoredStatus}`,
        target: `${currentElection.title} (${currentElection.code})`,
        status: 'success',
      });

      const updated = await getDoc(doc(db, 'elections', electionId));
      return {
        success: true,
        election: updated.exists() ? mapDoc<Election>(updated.id, updated.data()) : undefined,
        message: `Election "${currentElection.title}" restored to ${restoredStatus.replace(/_/g, ' ')}.`,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to restore archived election.' };
    }
  }

  async cancelElection(
    electionId: string,
    reason?: string
  ): Promise<{ success: boolean; election?: Election; message?: string; error?: string }> {
    if (!isValidElectionId(electionId)) {
      return { success: false, error: 'Invalid election ID format.' };
    }

    try {
      await ensureBuiltInElectionInFirestore(electionId);
      const eSnap = await getDoc(doc(db, 'elections', electionId));
      if (!eSnap.exists()) {
        return { success: false, error: 'Election record not found.' };
      }
      const currentElection = mapDoc<Election>(eSnap.id, eSnap.data());

      const authCheck = await assertActiveAdminContext(currentElection);
      if (authCheck.ok === false) {
        return { success: false, error: authCheck.error };
      }

      if (currentElection.isHistorical) {
        return { success: false, error: 'Historical 2026 records cannot be cancelled.' };
      }
      if (
        currentElection.status === 'cancelled' ||
        currentElection.status === 'archived' ||
        currentElection.status === 'results_published'
      ) {
        return {
          success: false,
          error: `Elections in "${currentElection.status.replace(/_/g, ' ')}" status cannot be cancelled.`,
        };
      }

      try {
        const fn = httpsCallable(functions, 'cancelElection');
        const res = await fn({ electionId, reason });
        const data = res.data as any;
        if (data?.success) {
          return {
            success: true,
            election: data.election as Election,
            message: data.message || `Election "${currentElection.title}" cancelled.`,
          };
        }
      } catch (err: any) {
        if (isCallableDomainRejection(err)) {
          return { success: false, error: err?.message || 'Server rejected election cancellation.' };
        }
      }

      await updateDoc(doc(db, 'elections', electionId), {
        previousStatus: currentElection.status,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: authCheck.actor.name,
        cancellationReason: reason?.trim() || 'Cancelled by Electoral Commission administrator',
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        adminName: authCheck.actor.name,
        adminRole: authCheck.actor.role,
        adminUid: authCheck.actor.uid,
        electionId,
        reason: reason?.trim() || 'Cancelled by Electoral Commission administrator',
        action: 'Cancelled Election',
        target: `${currentElection.title} (${currentElection.code})`,
        status: 'warning',
      });

      const updated = await getDoc(doc(db, 'elections', electionId));
      return {
        success: true,
        election: updated.exists() ? mapDoc<Election>(updated.id, updated.data()) : undefined,
        message: `Election "${currentElection.title}" has been cancelled.`,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to cancel election.' };
    }
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
    const posId = `pos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await ensureBuiltInElectionInFirestore(electionId);
      const [existingSnap, electionSnap] = await Promise.all([
        getDocs(query(collection(db, 'positions'), where('electionId', '==', electionId))),
        getDoc(doc(db, 'elections', electionId)).catch(() => null),
      ]);
      const electionData = electionSnap?.exists() ? (electionSnap.data() as Election) : null;
      const posDoc: Position = stripUndefined({
        id: posId,
        electionId,
        domainId: electionData?.domainId,
        hallId: electionData?.hallId,
        facultyId: electionData?.facultyId,
        departmentId: electionData?.departmentId,
        title: position.title.trim(),
        description: position.description?.trim() || '',
        maxSelections: position.maxSelections || 1,
        allowsSkip: position.allowsSkip ?? true,
        order: existingSnap.size + 1,
        candidateIds: [],
        candidateEligibilityRules: position.candidateEligibilityRules || '',
        votingRules: position.votingRules || '',
      });
      await setDoc(doc(db, 'positions', posId), posDoc);
      await updateDoc(doc(db, 'elections', electionId), {
        positionsCount: existingSnap.size + 1,
        updatedAt: serverTimestamp(),
      });
      return { success: true, position: posDoc, message: 'Position added.' };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, `positions/${posId}`);
    }
  }

  async updatePosition(
    _electionId: string,
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
    try {
      await ensureBuiltInPositionInFirestore(posId);
      await updateDoc(doc(db, 'positions', posId), stripUndefined(updates));
      return { success: true, message: 'Position updated.' };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `positions/${posId}`);
    }
  }

  async deletePosition(electionId: string, posId: string) {
    try {
      await ensureBuiltInElectionInFirestore(electionId);
      await ensureBuiltInPositionInFirestore(posId);
      await deleteDoc(doc(db, 'positions', posId));
      const remaining = await getDocs(
        query(collection(db, 'positions'), where('electionId', '==', electionId))
      );
      await updateDoc(doc(db, 'elections', electionId), {
        positionsCount: remaining.size,
        updatedAt: serverTimestamp(),
      });
      return {
        success: true,
        remainingPositions: remaining.docs.map((d) => mapDoc<Position>(d.id, d.data())),
        message: 'Position removed.',
      };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `positions/${posId}`);
    }
  }

  async verifyCandidateEligibility(id: string) {
    try {
      await ensureBuiltInCandidateInFirestore(id);
      const cSnap = await getDoc(doc(db, 'candidates', id));
      if (!cSnap.exists()) return { success: false, error: 'Candidate not found.' };
      const cand = mapDoc<Candidate>(cSnap.id, cSnap.data());

      // Check whether a matching student record exists in students collection
      const studQ = query(
        collection(db, 'students'),
        where('studentId', '==', cand.studentId.trim().toUpperCase())
      );
      const studSnap = await getDocs(studQ);
      const matchedStudent = studSnap.empty ? null : studSnap.docs[0].data();
      const isEnrolled = Boolean(matchedStudent);
      const levelMatch = matchedStudent ? matchedStudent.level === cand.level : true;
      const facultyMatch = matchedStudent ? matchedStudent.faculty === cand.faculty : true;
      const hallMatch = matchedStudent ? matchedStudent.hall === cand.hall : true;

      const details = {
        isEnrolled,
        cgpaQualified: true,
        levelMatch,
        facultyMatch,
        hallMatch,
        summary: isEnrolled
          ? 'Student record verified against registered UCC VOTE profiles.'
          : 'No matching activated student profile found; verify manually against Academic Affairs roll.',
      };

      await updateDoc(doc(db, 'candidates', id), {
        eligibilityVerified: isEnrolled && levelMatch && facultyMatch && hallMatch,
        eligibilityDetails: details,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        isEligible: details.isEnrolled && levelMatch && facultyMatch && hallMatch,
        reason: details.summary,
        details,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Eligibility check failed.' };
    }
  }

  async approveCandidate(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await ensureBuiltInCandidateInFirestore(id);
      const actor = await getCurrentAdminContext();
      const cSnap = await getDoc(doc(db, 'candidates', id));
      if (!cSnap.exists()) return { success: false, error: 'Candidate not found.' };
      const cand = cSnap.data() as Candidate;

      await updateDoc(doc(db, 'candidates', id), {
        applicationStatus: 'Approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: actor.name,
        eligibilityVerified: true,
        updatedAt: serverTimestamp(),
      });

      if (cand.positionId) {
        await ensureBuiltInPositionInFirestore(cand.positionId);
        await updateDoc(doc(db, 'positions', cand.positionId), {
          candidateIds: arrayUnion(id),
        }).catch(() => {});
      }

      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Approved Candidate Nomination',
        target: `${cand.fullName} (${cand.studentId})`,
      });
      return { success: true, message: 'Candidate approved for digital ballot.' };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `candidates/${id}`);
    }
  }

  async rejectCandidate(
    id: string,
    reason: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await ensureBuiltInCandidateInFirestore(id);
      const actor = await getCurrentAdminContext();
      await updateDoc(doc(db, 'candidates', id), {
        applicationStatus: 'Rejected',
        rejectionReason: reason.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: actor.name,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Rejected Candidate Nomination',
        target: `${id}: ${reason.trim()}`,
      });
      return { success: true, message: 'Candidate nomination rejected.' };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `candidates/${id}`);
    }
  }

  async requestCandidateCorrections(
    id: string,
    notes: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await ensureBuiltInCandidateInFirestore(id);
      const actor = await getCurrentAdminContext();
      await updateDoc(doc(db, 'candidates', id), {
        applicationStatus: 'Under review',
        correctionNotes: notes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: actor.name,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Requested Candidate Nomination Corrections',
        target: id,
      });
      return { success: true, message: 'Correction request recorded.' };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `candidates/${id}`);
    }
  }

  async withdrawCandidate(
    id: string,
    _reason?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await ensureBuiltInCandidateInFirestore(id);
      const actor = await getCurrentAdminContext();
      await updateDoc(doc(db, 'candidates', id), {
        applicationStatus: 'Withdrawn',
        reviewedAt: new Date().toISOString(),
        reviewedBy: actor.name,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Marked Candidate Withdrawn',
        target: id,
      });
      return { success: true, message: 'Candidate withdrawn.' };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `candidates/${id}`);
    }
  }

  async assignCandidatePosition(
    id: string,
    electionId: string,
    positionId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await ensureBuiltInCandidateInFirestore(id);
      await ensureBuiltInElectionInFirestore(electionId);
      await ensureBuiltInPositionInFirestore(positionId);
      const [cSnap, eSnap, pSnap] = await Promise.all([
        getDoc(doc(db, 'candidates', id)),
        getDoc(doc(db, 'elections', electionId)),
        getDoc(doc(db, 'positions', positionId)),
      ]);
      if (!cSnap.exists()) return { success: false, error: 'Candidate record not found.' };
      if (!eSnap.exists()) return { success: false, error: 'Election record not found.' };
      if (!pSnap.exists()) return { success: false, error: 'Target position not found.' };

      const cand = mapDoc<Candidate>(cSnap.id, cSnap.data());
      const election = mapDoc<Election>(eSnap.id, eSnap.data());
      const targetPos = mapDoc<Position>(pSnap.id, pSnap.data());

      if (targetPos.electionId !== electionId) {
        return {
          success: false,
          error: 'Selected position does not belong to this election.',
        };
      }

      const guard = evaluateElectionCandidateActionAllowed(election, 'change_position', cand);
      if (!guard.allowed) {
        return { success: false, error: guard.reason || 'Position change blocked.' };
      }

      const existingSamePosSnap = await getDocs(
        query(
          collection(db, 'candidates'),
          where('electionId', '==', electionId),
          where('positionId', '==', positionId)
        )
      );
      const existingSamePos = existingSamePosSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()));
      const duplicate = findDuplicateAssignment(existingSamePos, {
        electionId,
        positionId,
        contestantId: cand.contestantId,
        studentId: cand.studentId,
        ignoreCandidateId: id,
      });
      if (duplicate) {
        return {
          success: false,
          error: `${cand.fullName} is already assigned to ${targetPos.title} in ${election.title}.`,
        };
      }

      const batch = writeBatch(db);
      const prevPosId = cand.positionId;
      const keySegment = normalizeStudentId(cand.studentId) || cand.contestantId || id;
      if (prevPosId && prevPosId !== positionId) {
        const oldLockKey = buildAssignmentUniquenessKey(electionId, prevPosId, keySegment);
        batch.delete(doc(db, 'candidate_assignments', oldLockKey));
        batch.update(doc(db, 'positions', prevPosId), {
          candidateIds: arrayRemove(id),
        });
      }

      const newLockKey = buildAssignmentUniquenessKey(electionId, positionId, keySegment);
      batch.set(
        doc(db, 'candidate_assignments', newLockKey),
        stripUndefined({
          electionId,
          positionId,
          contestantId: cand.contestantId || buildContestantId(cand.studentId, cand.fullName),
          candidateId: id,
          studentIdNormalized: normalizeStudentId(cand.studentId),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      batch.update(doc(db, 'candidates', id), {
        electionId,
        positionId,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'positions', positionId), {
        candidateIds: arrayUnion(id),
      });
      await batch.commit();

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: `Changed Candidate Position -> ${targetPos.title}`,
        target: `${cand.fullName} (${election.title})`,
      });
      return { success: true, message: `Candidate assigned to ${targetPos.title}.` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to assign candidate position.' };
    }
  }

  async findContestantByStudentId(studentId: string): Promise<ContestantProfile | null> {
    const normSid = normalizeStudentId(studentId);
    if (!normSid) return null;

    const deterministicId = buildContestantId(normSid);
    const directSnap = await getDoc(doc(db, 'contestants', deterministicId)).catch(() => null);
    if (directSnap?.exists()) {
      return mapDoc<ContestantProfile>(directSnap.id, directSnap.data());
    }

    const qSnap = await getDocs(
      query(collection(db, 'contestants'), where('studentId', '==', normSid))
    ).catch(() => null);
    if (qSnap && !qSnap.empty) {
      return mapDoc<ContestantProfile>(qSnap.docs[0].id, qSnap.docs[0].data());
    }

    const candSnap = await getDocs(
      query(collection(db, 'candidates'), where('studentId', '==', normSid))
    ).catch(() => null);
    if (candSnap && !candSnap.empty) {
      const c = mapDoc<Candidate>(candSnap.docs[0].id, candSnap.docs[0].data());
      return {
        id: c.contestantId || deterministicId,
        fullName: c.fullName,
        studentId: normSid,
        nickname: c.nickname,
        email: c.email,
        phone: c.phone,
        department: c.department,
        faculty: c.faculty,
        programme: c.programme || '',
        level: c.level,
        hall: c.hall,
        photoUrl: c.photoUrl || c.electionPhotoUrl || '',
        photoStoragePath: c.photoStoragePath,
        biography: c.biography || '',
        leadershipExperience: c.leadershipExperience || [],
      };
    }

    const histMatch = HISTORICAL_2026_CANDIDATES.find(
      (c) => normalizeStudentId(c.studentId) === normSid
    );
    if (histMatch) {
      return {
        id: buildContestantId(histMatch.studentId, histMatch.fullName),
        fullName: histMatch.fullName,
        studentId: normSid,
        nickname: histMatch.nickname,
        email: histMatch.email,
        department: histMatch.department,
        faculty: histMatch.faculty,
        programme: histMatch.programme || '',
        level: histMatch.level,
        hall: histMatch.hall,
        photoUrl: histMatch.photoUrl || '',
        biography: histMatch.biography || '',
        leadershipExperience: histMatch.leadershipExperience || [],
      };
    }
    return null;
  }

  async createContestantProfile(payload: {
    fullName: string;
    studentId?: string;
    nickname?: string;
    email?: string;
    phone?: string;
    department: string;
    faculty: string;
    programme?: string;
    level: string;
    hall: string;
    photoUrl?: string;
    photoStoragePath?: string;
    biography?: string;
    leadershipExperience?: string[];
  }): Promise<{
    success: boolean;
    contestant?: ContestantProfile;
    duplicateContestant?: ContestantProfile;
    error?: string;
  }> {
    try {
      const fullName = payload.fullName?.trim();
      if (!fullName || fullName.length < 2) {
        return { success: false, error: 'Contestant full name is required.' };
      }

      const normSid = normalizeStudentId(payload.studentId);
      if (normSid) {
        const duplicate = await this.findContestantByStudentId(normSid);
        if (duplicate) {
          return {
            success: false,
            duplicateContestant: duplicate,
            error: `A permanent contestant profile already exists for Student ID ${normSid} (${duplicate.fullName}). Select the existing contestant instead of creating a duplicate.`,
          };
        }
      }

      const contestantId = buildContestantId(normSid, fullName);
      const existingSnap = await getDoc(doc(db, 'contestants', contestantId)).catch(() => null);
      if (existingSnap?.exists()) {
        const existing = mapDoc<ContestantProfile>(existingSnap.id, existingSnap.data());
        return {
          success: false,
          duplicateContestant: existing,
          error: `A permanent contestant profile already exists for ${existing.fullName}. Select the existing contestant instead.`,
        };
      }

      const nowIso = new Date().toISOString();
      const profileDoc: ContestantProfile = stripUndefined({
        id: contestantId,
        fullName,
        studentId: normSid || payload.studentId?.trim() || 'Not verified',
        nickname: payload.nickname?.trim() || undefined,
        email: payload.email?.trim() || undefined,
        phone: payload.phone?.trim() || undefined,
        department: payload.department?.trim() || 'Not verified',
        faculty: payload.faculty?.trim() || 'Not verified',
        programme: payload.programme?.trim() || '',
        level: payload.level?.trim() || 'Not verified',
        hall: payload.hall?.trim() || 'Not verified',
        photoUrl: payload.photoUrl?.trim() || '',
        photoStoragePath: payload.photoStoragePath?.trim() || undefined,
        biography: payload.biography?.trim() || '',
        leadershipExperience: Array.isArray(payload.leadershipExperience)
          ? payload.leadershipExperience.filter(Boolean)
          : [],
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      await setDoc(
        doc(db, 'contestants', contestantId),
        stripUndefined({
          ...profileDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Created Permanent Contestant Profile',
        target: `${profileDoc.fullName} (${profileDoc.studentId})`,
      });

      return { success: true, contestant: profileDoc };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to create contestant profile.' };
    }
  }

  async updateContestantPermanentProfile(
    contestantId: string,
    updates: Partial<ContestantProfile>,
    reason?: string
  ): Promise<{
    success: boolean;
    contestant?: ContestantProfile;
    syncedCandidateCount?: number;
    error?: string;
  }> {
    try {
      const ref = doc(db, 'contestants', contestantId);
      const existingSnap = await getDoc(ref).catch(() => null);
      const existingData = existingSnap?.exists()
        ? mapDoc<ContestantProfile>(existingSnap.id, existingSnap.data())
        : null;

      const normNewSid = normalizeStudentId(updates.studentId ?? existingData?.studentId);
      if (normNewSid) {
        const collision = await this.findContestantByStudentId(normNewSid);
        if (collision && collision.id !== contestantId) {
          return {
            success: false,
            error: `Student ID ${normNewSid} already belongs to permanent contestant "${collision.fullName}".`,
          };
        }
      }

      const prevNormSid = normalizeStudentId(existingData?.studentId);
      const cleanedUpdates: Partial<ContestantProfile> = stripUndefined({
        fullName: updates.fullName?.trim() ?? existingData?.fullName,
        studentId:
          normNewSid ||
          updates.studentId?.trim() ||
          existingData?.studentId ||
          'Not verified',
        nickname: updates.nickname !== undefined ? updates.nickname.trim() : existingData?.nickname,
        email: updates.email !== undefined ? updates.email.trim() : existingData?.email,
        phone: updates.phone !== undefined ? updates.phone.trim() : existingData?.phone,
        department: updates.department?.trim() ?? existingData?.department ?? 'Not verified',
        faculty: updates.faculty?.trim() ?? existingData?.faculty ?? 'Not verified',
        programme: updates.programme !== undefined ? updates.programme.trim() : existingData?.programme ?? '',
        level: updates.level?.trim() ?? existingData?.level ?? 'Not verified',
        hall: updates.hall?.trim() ?? existingData?.hall ?? 'Not verified',
        photoUrl: updates.photoUrl !== undefined ? updates.photoUrl.trim() : existingData?.photoUrl ?? '',
        photoStoragePath:
          updates.photoStoragePath !== undefined
            ? updates.photoStoragePath
            : existingData?.photoStoragePath,
        biography: updates.biography !== undefined ? updates.biography.trim() : existingData?.biography ?? '',
        leadershipExperience:
          updates.leadershipExperience !== undefined
            ? updates.leadershipExperience.filter(Boolean)
            : existingData?.leadershipExperience ?? [],
      });

      if (!cleanedUpdates.fullName || cleanedUpdates.fullName.length < 2) {
        return { success: false, error: 'Contestant full name is required.' };
      }

      const changedFields: string[] = [];
      if (existingData) {
        (Object.keys(cleanedUpdates) as (keyof ContestantProfile)[]).forEach((k) => {
          if (JSON.stringify(cleanedUpdates[k]) !== JSON.stringify(existingData[k])) {
            changedFields.push(String(k));
          }
        });
      } else {
        changedFields.push('initial_profile_materialization');
      }

      const writePayload: Record<string, any> = stripUndefined({
        ...cleanedUpdates,
        id: contestantId,
        updatedAt: serverTimestamp(),
      });
      if (!existingSnap?.exists()) {
        writePayload.createdAt = serverTimestamp();
      }
      await setDoc(ref, writePayload, { merge: true });

      // Fan out shared permanent fields (NEVER phone PII, NEVER votesReceived, NEVER election-specific fields)
      const byContestantSnap = await getDocs(
        query(collection(db, 'candidates'), where('contestantId', '==', contestantId))
      ).catch(() => null);
      const candidateDocsMap = new Map<string, Candidate>();
      byContestantSnap?.docs.forEach((d) =>
        candidateDocsMap.set(d.id, mapDoc<Candidate>(d.id, d.data()))
      );

      if (prevNormSid || normNewSid) {
        const sidToSearch = prevNormSid || normNewSid;
        const bySidSnap = await getDocs(
          query(collection(db, 'candidates'), where('studentId', '==', sidToSearch))
        ).catch(() => null);
        bySidSnap?.docs.forEach((d) => {
          if (!candidateDocsMap.has(d.id)) {
            candidateDocsMap.set(d.id, mapDoc<Candidate>(d.id, d.data()));
          }
        });
      }

      let syncedCandidateCount = 0;
      if (candidateDocsMap.size > 0) {
        const fanOutBatch = writeBatch(db);
        const hallId =
          cleanedUpdates.hall && isOfficialHallAffiliation(cleanedUpdates.hall, UCC_HALLS)
            ? findMatchingHallUnit(cleanedUpdates.hall, UCC_HALLS)?.id
            : undefined;

        candidateDocsMap.forEach((cand, candDocId) => {
          const sharedUpdate = stripUndefined({
            contestantId,
            fullName: cleanedUpdates.fullName,
            studentId: cleanedUpdates.studentId,
            nickname: cleanedUpdates.nickname,
            email: cleanedUpdates.email,
            department: cleanedUpdates.department,
            faculty: cleanedUpdates.faculty,
            programme: cleanedUpdates.programme,
            level: cleanedUpdates.level,
            hall: cleanedUpdates.hall,
            ...(hallId ? { hallId } : {}),
            biography: cleanedUpdates.biography,
            leadershipExperience: cleanedUpdates.leadershipExperience,
            // Preserve election-specific portrait override if present; otherwise sync default portrait
            photoUrl: cand.electionPhotoUrl ? cand.photoUrl : cleanedUpdates.photoUrl,
            ...(cand.electionPhotoUrl ? {} : { photoStoragePath: cleanedUpdates.photoStoragePath }),
            updatedAt: serverTimestamp(),
          });
          fanOutBatch.update(doc(db, 'candidates', candDocId), sharedUpdate);
          syncedCandidateCount++;
        });
        await fanOutBatch.commit();
      }

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: `Updated Permanent Contestant Profile [${changedFields.join(', ') || 'saved'}]`,
        target: `${cleanedUpdates.fullName} (${cleanedUpdates.studentId})${reason ? ` — ${reason}` : ''}`,
      });

      const refreshed = await getDoc(ref).catch(() => null);
      return {
        success: true,
        contestant: refreshed?.exists()
          ? mapDoc<ContestantProfile>(refreshed.id, refreshed.data())
          : ({ ...cleanedUpdates, id: contestantId } as ContestantProfile),
        syncedCandidateCount,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to update permanent contestant profile.' };
    }
  }

  async assignContestantToElection(payload: {
    electionId: string;
    positionId: string;
    contestantId?: string;
    mode: 'existing' | 'new';
    updatePermanentProfile?: boolean;
    permanentProfileUpdates?: Partial<ContestantProfile>;
    profileSnapshot: Partial<ContestantProfile>;
    electionParticipation: {
      manifestoSummary?: string;
      fullManifesto?: string[];
      keyPromises?: string[];
      campaignStatement?: string;
      electionPhotoUrl?: string;
      videoUrl?: string;
      applicationStatus?: Candidate['applicationStatus'];
    };
  }): Promise<{
    success: boolean;
    candidate?: Candidate;
    contestantId?: string;
    duplicateContestant?: ContestantProfile;
    message?: string;
    error?: string;
  }> {
    try {
      await ensureBuiltInElectionInFirestore(payload.electionId);
      await ensureBuiltInPositionInFirestore(payload.positionId);

      const [eSnap, pSnap] = await Promise.all([
        getDoc(doc(db, 'elections', payload.electionId)),
        getDoc(doc(db, 'positions', payload.positionId)),
      ]);

      if (!eSnap.exists()) {
        return { success: false, error: 'Target election could not be found in Firestore.' };
      }
      if (!pSnap.exists()) {
        return { success: false, error: 'Selected position could not be found in Firestore.' };
      }

      const election = mapDoc<Election>(eSnap.id, eSnap.data());
      const position = mapDoc<Position>(pSnap.id, pSnap.data());

      // Enforce election status safeguards
      const guard = evaluateElectionCandidateActionAllowed(election, 'add');
      if (!guard.allowed) {
        return { success: false, error: guard.reason || 'Election is locked against adding candidates.' };
      }

      // Strictly bind position to the target election
      if (position.electionId !== election.id) {
        return {
          success: false,
          error: `Position "${position.title}" does not belong to "${election.title}".`,
        };
      }

      const mergedProfile: Partial<ContestantProfile> = {
        ...payload.profileSnapshot,
        ...(payload.updatePermanentProfile ? payload.permanentProfileUpdates || {} : {}),
      };

      const fullName = mergedProfile.fullName?.trim() || '';
      if (fullName.length < 2) {
        return { success: false, error: 'Contestant full name must be at least 2 characters.' };
      }

      const normSid = normalizeStudentId(mergedProfile.studentId);

      if (payload.mode === 'new' && normSid) {
        const duplicateProfile = await this.findContestantByStudentId(normSid);
        if (duplicateProfile) {
          return {
            success: false,
            duplicateContestant: duplicateProfile,
            error: `Student ID ${normSid} already exists for "${duplicateProfile.fullName}". Select them via "Add Existing Contestant" instead of creating a duplicate profile.`,
          };
        }
      }

      const contestantId =
        payload.contestantId || buildContestantId(normSid, fullName);

      // Duplicate assignment check in target (electionId, positionId)
      const samePosSnap = await getDocs(
        query(
          collection(db, 'candidates'),
          where('electionId', '==', election.id),
          where('positionId', '==', position.id)
        )
      );
      const samePosCandidates = samePosSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()));
      const duplicateAssignment = findDuplicateAssignment(samePosCandidates, {
        electionId: election.id,
        positionId: position.id,
        contestantId,
        studentId: normSid || mergedProfile.studentId,
      });

      const assignmentKey = buildAssignmentUniquenessKey(
        election.id,
        position.id,
        normSid || contestantId
      );
      const lockSnap = await getDoc(doc(db, 'candidate_assignments', assignmentKey)).catch(() => null);

      if (duplicateAssignment || lockSnap?.exists()) {
        return {
          success: false,
          error: `${fullName} is already registered for "${position.title}" in "${election.title}".`,
        };
      }

      // Persist / update permanent profile before or inside batch
      const contestantRef = doc(db, 'contestants', contestantId);
      const existingContestantSnap = await getDoc(contestantRef).catch(() => null);
      const shouldWriteContestant =
        !existingContestantSnap?.exists() || Boolean(payload.updatePermanentProfile);

      if (payload.updatePermanentProfile && existingContestantSnap?.exists()) {
        const permRes = await this.updateContestantPermanentProfile(
          contestantId,
          mergedProfile,
          `Confirmed update while adding to ${election.title}`
        );
        if (!permRes.success) {
          return { success: false, error: permRes.error };
        }
      }

      const candidateId = `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const actor = await getCurrentAdminContext();
      const nowIso = new Date().toISOString();

      const permanentPhotoUrl = mergedProfile.photoUrl?.trim() || '';
      const electionPhotoUrl = payload.electionParticipation.electionPhotoUrl?.trim() || '';
      const effectivePhotoUrl = electionPhotoUrl || permanentPhotoUrl;

      const resolvedHall = mergedProfile.hall?.trim() || 'Not verified';
      const resolvedHallId =
        election.hallId ||
        (isOfficialHallAffiliation(resolvedHall, UCC_HALLS)
          ? findMatchingHallUnit(resolvedHall, UCC_HALLS)?.id
          : undefined);

      const candidateDoc: Candidate = stripUndefined({
        id: candidateId,
        contestantId,
        electionId: election.id,
        positionId: position.id,
        domainId: election.domainId || categoryToDomainId(election.category),
        hallId: resolvedHallId,
        facultyId: election.facultyId,
        departmentId: election.departmentId,
        submittedByUid: actor.uid || undefined,
        fullName,
        nickname: mergedProfile.nickname?.trim() || undefined,
        studentId: normSid || mergedProfile.studentId?.trim() || 'Not verified',
        email: mergedProfile.email?.trim() || undefined,
        // NOTE: Never copy phone PII onto public candidates documents
        department: mergedProfile.department?.trim() || 'Not verified',
        faculty: mergedProfile.faculty?.trim() || 'Not verified',
        programme: mergedProfile.programme?.trim() || '',
        level: mergedProfile.level?.trim() || 'Not verified',
        hall: resolvedHall,
        photoUrl: permanentPhotoUrl || effectivePhotoUrl,
        electionPhotoUrl: electionPhotoUrl || undefined,
        photoStoragePath: mergedProfile.photoStoragePath || undefined,
        videoUrl: payload.electionParticipation.videoUrl?.trim() || undefined,
        manifestoSummary:
          payload.electionParticipation.manifestoSummary?.trim() ||
          payload.electionParticipation.campaignStatement?.trim() ||
          '',
        campaignStatement: payload.electionParticipation.campaignStatement?.trim() || undefined,
        fullManifesto: (payload.electionParticipation.fullManifesto || [])
          .map((s) => s.trim())
          .filter(Boolean),
        keyPromises: (payload.electionParticipation.keyPromises || [])
          .map((s) => s.trim())
          .filter(Boolean),
        biography: mergedProfile.biography?.trim() || '',
        leadershipExperience: Array.isArray(mergedProfile.leadershipExperience)
          ? mergedProfile.leadershipExperience.filter(Boolean)
          : [],
        applicationStatus: payload.electionParticipation.applicationStatus || 'Approved',
        eligibilityVerified: true,
        submittedAt: nowIso,
        reviewedAt: nowIso,
        reviewedBy: actor.name,
        votesReceived: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const batch = writeBatch(db);

      if (shouldWriteContestant && !existingContestantSnap?.exists()) {
        batch.set(
          contestantRef,
          stripUndefined({
            id: contestantId,
            fullName,
            studentId: normSid || mergedProfile.studentId?.trim() || 'Not verified',
            nickname: mergedProfile.nickname?.trim() || undefined,
            email: mergedProfile.email?.trim() || undefined,
            phone: mergedProfile.phone?.trim() || undefined,
            department: mergedProfile.department?.trim() || 'Not verified',
            faculty: mergedProfile.faculty?.trim() || 'Not verified',
            programme: mergedProfile.programme?.trim() || '',
            level: mergedProfile.level?.trim() || 'Not verified',
            hall: resolvedHall,
            photoUrl: permanentPhotoUrl,
            photoStoragePath: mergedProfile.photoStoragePath || undefined,
            biography: mergedProfile.biography?.trim() || '',
            leadershipExperience: Array.isArray(mergedProfile.leadershipExperience)
              ? mergedProfile.leadershipExperience.filter(Boolean)
              : [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }

      batch.set(
        doc(db, 'candidates', candidateId),
        stripUndefined({
          ...candidateDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      batch.set(
        doc(db, 'candidate_assignments', assignmentKey),
        stripUndefined({
          electionId: election.id,
          positionId: position.id,
          contestantId,
          candidateId,
          studentIdNormalized: normSid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      batch.update(doc(db, 'positions', position.id), {
        candidateIds: arrayUnion(candidateId),
      });

      await batch.commit();

      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action:
          payload.mode === 'existing'
            ? `Added Existing Contestant to "${position.title}"`
            : `Registered & Added New Contestant to "${position.title}"`,
        target: `${fullName} (${candidateDoc.studentId}) -> ${election.title}`,
      });

      return {
        success: true,
        candidate: candidateDoc,
        contestantId,
        message: `${fullName} added to ${position.title} in ${election.title}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to assign contestant to election.',
      };
    }
  }

  async updateElectionCandidateParticipation(
    candidateId: string,
    payload: {
      positionId?: string;
      manifestoSummary?: string;
      fullManifesto?: string[];
      keyPromises?: string[];
      campaignStatement?: string;
      electionPhotoUrl?: string;
      videoUrl?: string;
      applicationStatus?: Candidate['applicationStatus'];
      confirmPermanentUpdate?: boolean;
      permanentProfileUpdates?: Partial<ContestantProfile>;
    }
  ): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      await ensureBuiltInCandidateInFirestore(candidateId);
      const cSnap = await getDoc(doc(db, 'candidates', candidateId));
      if (!cSnap.exists()) {
        return { success: false, error: 'Candidate record not found.' };
      }

      const existing = mapDoc<Candidate>(cSnap.id, cSnap.data());
      await ensureBuiltInElectionInFirestore(existing.electionId);
      const eSnap = await getDoc(doc(db, 'elections', existing.electionId));
      const election = eSnap.exists() ? mapDoc<Election>(eSnap.id, eSnap.data()) : null;

      const isChangingPosition =
        Boolean(payload.positionId) && payload.positionId !== existing.positionId;

      const editGuard = evaluateElectionCandidateActionAllowed(
        election,
        isChangingPosition ? 'change_position' : 'edit_info',
        existing
      );
      if (!editGuard.allowed) {
        return { success: false, error: editGuard.reason || 'Action blocked by election safeguards.' };
      }

      if (payload.confirmPermanentUpdate && payload.permanentProfileUpdates) {
        const targetContestantId =
          existing.contestantId || buildContestantId(existing.studentId, existing.fullName);
        const permRes = await this.updateContestantPermanentProfile(
          targetContestantId,
          payload.permanentProfileUpdates,
          `Confirmed update while editing candidate in ${election?.title || existing.electionId}`
        );
        if (!permRes.success) {
          return { success: false, error: permRes.error };
        }
      }

      const nextPosId = payload.positionId || existing.positionId;
      if (isChangingPosition) {
        await ensureBuiltInPositionInFirestore(nextPosId);
        const targetPosSnap = await getDoc(doc(db, 'positions', nextPosId));
        if (!targetPosSnap.exists()) {
          return { success: false, error: 'Selected position does not exist.' };
        }
        const targetPos = mapDoc<Position>(targetPosSnap.id, targetPosSnap.data());
        if (targetPos.electionId !== existing.electionId) {
          return { success: false, error: 'Target position does not belong to this election.' };
        }

        const samePosSnap = await getDocs(
          query(
            collection(db, 'candidates'),
            where('electionId', '==', existing.electionId),
            where('positionId', '==', nextPosId)
          )
        );
        const dup = findDuplicateAssignment(
          samePosSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data())),
          {
            electionId: existing.electionId,
            positionId: nextPosId,
            contestantId: existing.contestantId,
            studentId: existing.studentId,
            ignoreCandidateId: candidateId,
          }
        );
        if (dup) {
          return {
            success: false,
            error: `${existing.fullName} is already assigned to "${targetPos.title}" in this election.`,
          };
        }
      }

      const electionUpdates: Record<string, any> = stripUndefined({
        positionId: nextPosId,
        manifestoSummary: payload.manifestoSummary?.trim(),
        fullManifesto: payload.fullManifesto?.map((s) => s.trim()).filter(Boolean),
        keyPromises: payload.keyPromises?.map((s) => s.trim()).filter(Boolean),
        campaignStatement: payload.campaignStatement?.trim(),
        electionPhotoUrl:
          payload.electionPhotoUrl !== undefined ? payload.electionPhotoUrl.trim() : undefined,
        videoUrl: payload.videoUrl !== undefined ? payload.videoUrl.trim() : undefined,
        applicationStatus: payload.applicationStatus,
        updatedAt: serverTimestamp(),
      });

      const changedFields: string[] = [];
      (Object.keys(electionUpdates) as string[]).forEach((k) => {
        if (k === 'updatedAt') return;
        if (JSON.stringify(electionUpdates[k]) !== JSON.stringify((existing as any)[k])) {
          changedFields.push(k);
        }
      });

      const batch = writeBatch(db);
      if (isChangingPosition) {
        const keySegment =
          normalizeStudentId(existing.studentId) || existing.contestantId || candidateId;
        const oldLockKey = buildAssignmentUniquenessKey(
          existing.electionId,
          existing.positionId,
          keySegment
        );
        const newLockKey = buildAssignmentUniquenessKey(
          existing.electionId,
          nextPosId,
          keySegment
        );
        batch.delete(doc(db, 'candidate_assignments', oldLockKey));
        batch.set(
          doc(db, 'candidate_assignments', newLockKey),
          stripUndefined({
            electionId: existing.electionId,
            positionId: nextPosId,
            contestantId:
              existing.contestantId || buildContestantId(existing.studentId, existing.fullName),
            candidateId,
            studentIdNormalized: normalizeStudentId(existing.studentId),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        if (existing.positionId) {
          batch.update(doc(db, 'positions', existing.positionId), {
            candidateIds: arrayRemove(candidateId),
          });
        }
        batch.update(doc(db, 'positions', nextPosId), {
          candidateIds: arrayUnion(candidateId),
        });
      }

      batch.update(doc(db, 'candidates', candidateId), electionUpdates);
      await batch.commit();

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: `Updated Election Candidate Record [${changedFields.join(', ') || 'synced'}]`,
        target: `${existing.fullName} (${election?.title || existing.electionId})`,
      });

      const refreshed = await getDoc(doc(db, 'candidates', candidateId));
      return {
        success: true,
        candidate: refreshed.exists()
          ? mapDoc<Candidate>(refreshed.id, refreshed.data())
          : undefined,
        message: 'Candidate participation information updated.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to update candidate information.',
      };
    }
  }

  async removeCandidateFromElection(
    candidateId: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const cSnap = await getDoc(doc(db, 'candidates', candidateId));
      if (!cSnap.exists()) {
        const hist = getHistoricalCandidateById(candidateId);
        if (hist) {
          return {
            success: false,
            error:
              'Archived 2026 historical election records cannot have candidates removed.',
          };
        }
        return { success: false, error: 'Candidate record not found.' };
      }

      const cand = mapDoc<Candidate>(cSnap.id, cSnap.data());
      const eSnap = await getDoc(doc(db, 'elections', cand.electionId)).catch(() => null);
      const election = eSnap?.exists() ? mapDoc<Election>(eSnap.id, eSnap.data()) : null;

      const guard = evaluateElectionCandidateActionAllowed(election, 'remove', cand);
      if (!guard.allowed) {
        return { success: false, error: guard.reason || 'Removal blocked by election safeguards.' };
      }

      const batch = writeBatch(db);
      batch.delete(doc(db, 'candidates', candidateId));

      if (cand.positionId) {
        const lockKeys = new Set<string>();
        const normSid = normalizeStudentId(cand.studentId);
        if (normSid) {
          lockKeys.add(buildAssignmentUniquenessKey(cand.electionId, cand.positionId, normSid));
        }
        if (cand.contestantId) {
          lockKeys.add(
            buildAssignmentUniquenessKey(cand.electionId, cand.positionId, cand.contestantId)
          );
        }
        lockKeys.add(buildAssignmentUniquenessKey(cand.electionId, cand.positionId, candidateId));

        lockKeys.forEach((lk) => {
          batch.delete(doc(db, 'candidate_assignments', lk));
        });

        batch.update(doc(db, 'positions', cand.positionId), {
          candidateIds: arrayRemove(candidateId),
        });
      }

      await batch.commit();

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Removed Candidate from Election (Permanent Profile Preserved)',
        target: `${cand.fullName} (${cand.studentId}) <- ${election?.title || cand.electionId}${reason ? ` [${reason}]` : ''}`,
      });

      return {
        success: true,
        message: `${cand.fullName} removed from this election. Their permanent contestant profile remains preserved.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to remove candidate from election.',
      };
    }
  }

  async getAdminElectionResults(electionId: string) {
    try {
      const [eSnap, rSnap, pSnap, cSnap] = await Promise.all([
        getDoc(doc(db, 'elections', electionId)),
        getDoc(doc(db, 'election_results', electionId)),
        getDocs(query(collection(db, 'positions'), where('electionId', '==', electionId))),
        getDocs(
          query(
            collection(db, 'candidates'),
            where('electionId', '==', electionId),
            where('applicationStatus', '==', 'Approved')
          )
        ),
      ]);

      if (!eSnap.exists()) {
        const histResults = getHistoricalResultsByElectionId(electionId);
        if (histResults) {
          return { success: true, results: histResults };
        }
        const histElection = getHistoricalElectionById(electionId);
        if (histElection) {
          return {
            success: true,
            results: {
              electionId: histElection.id,
              electionTitle: histElection.title,
              electionCode: histElection.code,
              category: histElection.category,
              domainId: histElection.domainId,
              subdomainLabel: histElection.subdomainLabel,
              status: histElection.status,
              academicYear: histElection.academicYear,
              organizingBody: histElection.organizingBody,
              startDate: histElection.startDate,
              endDate: histElection.endDate,
              workflowStage: 'archived' as any,
              workflowHistory: [],
              isPublished: false,
              resultsCertified: false,
              isHistorical: true,
              tallyAvailable: false,
              historicalNote: histElection.historicalNote,
              ballotSummary: {
                totalEligibleVoters: 0,
                totalBallotsCast: 0,
                validBallots: 0,
                invalidBallots: 0,
                blankBallots: 0,
                uncastBallots: 0,
                turnoutPercentage: 0,
                validBallotRate: 0,
                invalidBallotRate: 0,
                blankBallotRate: 0,
              },
              positions: [],
              turnoutAnalytics: {
                privacyThreshold: 5,
                byFaculty: [],
                byDepartment: [],
                byLevel: [],
                byHall: [],
              },
            } as ElectionResultsPayload,
          };
        }
        return { success: false, error: 'Election not found.' };
      }

      if (rSnap.exists()) {
        return {
          success: true,
          results: mapDoc<ElectionResultsPayload>(rSnap.id, rSnap.data()),
        };
      }

      const histResults = getHistoricalResultsByElectionId(electionId);
      if (histResults) {
        return { success: true, results: histResults };
      }

      // Construct real zero-tallied shell from actual Firestore election/positions/candidates
      const election = mapDoc<Election>(eSnap.id, eSnap.data());
      const positionsList = pSnap.docs
        .map((d) => mapDoc<Position>(d.id, d.data()))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const candidates = cSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()));

      const totalCast = Number(election.totalVotesCast) || 0;
      const totalEligible = Number(election.totalEligibleVoters) || 0;

      const positionSummaries: PositionResultSummary[] = positionsList.map((pos) => {
        const posCandidates = candidates.filter((c) => c.positionId === pos.id);
        const totalValidVotes = posCandidates.reduce(
          (sum, c) => sum + (Number(c.votesReceived) || 0),
          0
        );
        const sorted = [...posCandidates].sort(
          (a, b) => (Number(b.votesReceived) || 0) - (Number(a.votesReceived) || 0)
        );
        const topVotes = sorted.length > 0 ? Number(sorted[0].votesReceived) || 0 : 0;
        const leaders =
          topVotes > 0 ? sorted.filter((c) => (Number(c.votesReceived) || 0) === topVotes) : [];
        const isTie = leaders.length > 1;

        const rows: CandidateResultRow[] = sorted.map((c, idx) => {
          const votes = Number(c.votesReceived) || 0;
          const pctValid = totalValidVotes > 0 ? Math.round((votes / totalValidVotes) * 1000) / 10 : 0;
          const pctTotal = totalCast > 0 ? Math.round((votes / totalCast) * 1000) / 10 : 0;
          const isTop = topVotes > 0 && votes === topVotes;
          return {
            candidateId: c.id,
            fullName: c.fullName,
            nickname: c.nickname,
            studentId: c.studentId,
            photoUrl: c.electionPhotoUrl || c.photoUrl || '',
            department: c.department,
            faculty: c.faculty,
            hall: c.hall,
            votesReceived: votes,
            percentageOfValidVotes: pctValid,
            percentageOfTotalBallots: pctTotal,
            rank: idx + 1,
            isLeading: isTop && !isTie,
            isWinner: isTop && !isTie && election.resultsCertified,
            isTied: isTop && isTie,
          };
        });

        return {
          positionId: pos.id,
          title: pos.title,
          description: pos.description,
          order: pos.order,
          totalValidVotes,
          blankVotes: Math.max(0, totalCast - totalValidVotes),
          invalidVotes: 0,
          totalBallotsProcessed: totalCast,
          isTie,
          tiedCandidateIds: isTie ? leaders.map((l) => l.id) : [],
          winnerCandidateIds: !isTie ? leaders.map((l) => l.id) : [],
          candidates: rows,
        };
      });

      const ballotSummary: BallotAccountingSummary = {
        totalEligibleVoters: totalEligible,
        totalBallotsCast: totalCast,
        validBallots: totalCast,
        invalidBallots: 0,
        blankBallots: 0,
        uncastBallots: Math.max(0, totalEligible - totalCast),
        turnoutPercentage:
          totalEligible > 0 ? Math.round((totalCast / totalEligible) * 1000) / 10 : 0,
        validBallotRate: totalCast > 0 ? 100 : 0,
        invalidBallotRate: 0,
        blankBallotRate: 0,
      };

      const payload: ElectionResultsPayload = {
        electionId: election.id,
        electionTitle: election.title,
        electionCode: election.code,
        category: election.category,
        domainId: election.domainId,
        subdomainLabel: election.subdomainLabel,
        status: election.status,
        academicYear: election.academicYear,
        organizingBody: election.organizingBody,
        startDate: election.startDate,
        endDate: election.endDate,
        workflowStage: election.resultsCertified
          ? 'published'
          : 'preliminary',
        workflowHistory: [],
        isPublished: election.status === 'results_published',
        resultsCertified: Boolean(election.resultsCertified),
        ballotSummary,
        positions: positionSummaries,
        turnoutAnalytics: {
          privacyThreshold: 5,
          byFaculty: [],
          byDepartment: [],
          byLevel: [],
          byHall: [],
        },
      };

      return { success: true, results: payload };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to load election results.' };
    }
  }

  async advanceResultsWorkflow(
    electionId: string,
    targetStage: ResultsWorkflowStage,
    notes?: string,
    actorNameOverride?: string
  ) {
    try {
      // Try Cloud Function tallying & certification first
      try {
        const fn = httpsCallable(functions, 'certifyAndPublishResults');
        const res = await fn({ electionId, targetStage, notes });
        const data = res.data as any;
        if (data?.success && data?.results) {
          return {
            success: true,
            results: data.results as ElectionResultsPayload,
            message: data.message || `Results advanced to ${targetStage}.`,
          };
        }
      } catch {
        // Fallback to direct Firestore workflow state update by verified admin
      }

      const actor = await getCurrentAdminContext();
      const actorName = actorNameOverride || actor.name;
      const currentRes = await this.getAdminElectionResults(electionId);
      if (!currentRes.success || !currentRes.results) {
        return { success: false, error: currentRes.error || 'Election results unavailable.' };
      }

      const prev = currentRes.results;
      const isPublished = targetStage === 'published';
      const isCertified = targetStage === 'certified' || isPublished;
      const nextAction = {
        stage: targetStage,
        actorId: actor.uid,
        actorName,
        actorRole: actor.role,
        timestamp: new Date().toISOString(),
        notes: notes || `Advanced to ${targetStage}`,
      };

      const nextPayload: ElectionResultsPayload = {
        ...prev,
        workflowStage: targetStage,
        workflowHistory: [...(prev.workflowHistory || []), nextAction],
        isPublished,
        resultsCertified: isCertified,
        certifiedBy: isCertified ? actorName : prev.certifiedBy,
        publishedAt: isPublished ? new Date().toISOString() : prev.publishedAt,
      };

      await setDoc(
        doc(db, 'election_results', electionId),
        {
          ...nextPayload,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateDoc(doc(db, 'elections', electionId), {
        status: isPublished ? 'results_published' : 'results_pending_certification',
        resultsCertified: isCertified,
        provisionalResultsReady: true,
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        adminName: actorName,
        adminRole: actor.role,
        action: `Results Workflow -> ${targetStage}`,
        target: electionId,
      });

      return {
        success: true,
        results: nextPayload,
        message: `Results workflow updated to ${targetStage}.`,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to advance workflow stage.' };
    }
  }

  async downloadElectionReport(
    electionId: string,
    format: 'pdf' | 'csv',
    _reportType: 'full' | 'results' | 'turnout' | 'candidates' | 'positions'
  ) {
    const res = await this.getAdminElectionResults(electionId);
    if (!res.success || !res.results) {
      return { success: false, error: res.error || 'Results unavailable for export.' };
    }
    const r = res.results;

    if (format === 'pdf') {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
      return { success: true, filename: `${r.electionCode}_Report.pdf` };
    }

    const lines: string[] = [
      'Position,Candidate,Student ID,Department,Hall,Votes Received,Valid Vote Share (%),Historical Outcome',
    ];
    r.positions.forEach((p) => {
      p.candidates.forEach((c) => {
        const outcomeLabel =
          c.historicalRole || (c.isWinner ? 'Winner' : r.tallyAvailable === false ? 'Recorded' : '');
        lines.push(
          [
            `"${p.title.replace(/"/g, '""')}"`,
            `"${c.fullName.replace(/"/g, '""')}"`,
            `"${c.studentId}"`,
            `"${c.department.replace(/"/g, '""')}"`,
            `"${c.hall.replace(/"/g, '""')}"`,
            r.tallyAvailable === false ? 'Not tallied' : c.votesReceived,
            r.tallyAvailable === false ? 'Not tallied' : formatNumber(c.percentageOfValidVotes, { maximumFractionDigits: 1, useGrouping: false }),
            `"${outcomeLabel.replace(/"/g, '""')}"`,
          ].join(',')
        );
      });
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `${r.electionCode || electionId}_official_results.csv`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  }

  async getAdminAccounts() {
    try {
      const snap = await getDocs(collection(db, 'admins'));
      return {
        success: true,
        admins: snap.docs.map((d) => mapDoc<AdminProfile>(d.id, d.data())),
      };
    } catch (err: any) {
      return { success: false, admins: [], error: err?.message || 'Unable to load administrators.' };
    }
  }

  async createAdminAccount(payload: {
    staffId: string;
    fullName: string;
    email: string;
    role: AdminRoleType;
    department: string;
    uid?: string;
    managedDomainIds?: DomainId[];
    managedHalls?: string[];
    managedFaculties?: string[];
    managedDepartments?: string[];
  }) {
    try {
      const fn = httpsCallable(functions, 'setAdminRole');
      const res = await fn(payload);
      const data = res.data as any;
      if (data?.success) {
        return {
          success: true,
          admin: data.admin as AdminProfile,
          message: 'Administrator privileges assigned via Cloud Functions.',
        };
      }
      return { success: false, error: data?.error || 'Unable to assign administrator role.' };
    } catch (err: any) {
      return {
        success: false,
        error:
          err?.message ||
          'Assigning custom Firebase Auth claims requires the setAdminRole Cloud Function to be deployed on ucc-vote.',
      };
    }
  }

  async updateAdminScope(
    idOrStaffId: string,
    payload: {
      role?: AdminRoleType;
      managedDomainIds?: DomainId[];
      managedHalls?: string[];
      managedFaculties?: string[];
      managedDepartments?: string[];
    }
  ) {
    try {
      const directSnap = await getDoc(doc(db, 'admins', idOrStaffId));
      let targetDocId = directSnap.exists() ? directSnap.id : '';
      if (!targetDocId) {
        const q = query(collection(db, 'admins'), where('staffId', '==', idOrStaffId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) targetDocId = qSnap.docs[0].id;
      }
      if (!targetDocId) {
        return { success: false, error: 'Administrator record not found in Firestore.' };
      }

      const fn = httpsCallable(functions, 'updateAdminScope');
      const res = await fn({
        uid: targetDocId,
        ...payload,
        permissions: payload.role ? getPermissionsForRole(payload.role) : undefined,
      });
      const data = res.data as any;
      if (data?.success) {
        return {
          success: true,
          admin: data.admin as AdminProfile | undefined,
          message: data.message || 'Administrator governance scope updated.',
        };
      }
      return { success: false, error: data?.error || 'Unable to update administrator scope.' };
    } catch (err: any) {
      return {
        success: false,
        error:
          err?.message ||
          'Updating administrator permissions requires the updateAdminScope Cloud Function and verified admin custom claims.',
      };
    }
  }

  async getAuditLogs() {
    try {
      const snap = await getDocs(
        query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100))
      );
      return {
        success: true,
        logs: snap.docs.map((d) => mapDoc<AuditLogItem>(d.id, d.data())),
      };
    } catch {
      return { success: true, logs: [] };
    }
  }

  async updateStudentStatus(uid: string, status: 'active' | 'suspended') {
    try {
      const actor = await getCurrentAdminContext();
      await updateDoc(doc(db, 'students', uid), {
        status,
        isEligible: status === 'active',
        eligibilityStatus: status === 'active' ? 'eligible' : 'suspended',
        updatedAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, 'voter_eligibility', uid),
        {
          uid,
          isEligible: status === 'active',
          status: status === 'active' ? 'eligible' : 'suspended',
          verifiedBy: actor.name,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: `Updated Student Account Status -> ${status}`,
        target: uid,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to update student status.' };
    }
  }

  async attemptAdminBallotInspect(targetStudentId: string) {
    const actor = await getCurrentAdminContext();
    await writeAuditLog({
      adminName: actor.name,
      adminRole: actor.role,
      action: 'SECURITY VIOLATION: Blocked Ballot De-anonymisation Attempt',
      target: targetStudentId,
      status: 'flagged',
    });
    return {
      success: false,
      code: 'BALLOT_SECRECY_VIOLATION',
      error:
        'ZERO-TRUST BLOCK: Ballot choices are strictly separated from voter identity. No administrator can inspect an individual student’s selections.',
      targetStudentId,
      audited: true,
    };
  }

  async getVotingAuditSummary(electionId: string) {
    try {
      const eSnap = await getDoc(doc(db, 'elections', electionId));
      if (!eSnap.exists()) return { success: false, error: 'Election not found.' };
      const e = mapDoc<Election>(eSnap.id, eSnap.data());
      return {
        success: true,
        summary: {
          electionId: e.id,
          title: e.title,
          totalEligibleVoters: e.totalEligibleVoters || 0,
          totalVotesCast: e.totalVotesCast || 0,
          turnoutPercentage: e.turnoutPercentage || 0,
          secrecyGuarantee: 'Voter authorisations do not store candidate selections.',
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }
}

export const adminService = new FirebaseAdminService();
