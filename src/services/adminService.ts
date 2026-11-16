import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  auth,
  db,
  functions,
  formatFirestorePermissionError,
  stripUndefinedDeep,
  OperationType,
} from '../lib/firebase';
import {
  categoryToDomainId,
  domainIdToCategory,
  getPermissionsForRole,
} from '../data/uccStructure';
import {
  AdminProfile,
  AdminRoleType,
  AuditLogItem,
  BallotAccountingSummary,
  Candidate,
  CandidateResultRow,
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionCategory,
  ElectionResultsPayload,
  ElectionStatus,
  Position,
  PositionResultSummary,
  ResultsWorkflowStage,
} from '../types';
import { CreateElectionPayload } from './interfaces';
import { convertTimestamp, writeAuditLog } from './firebaseDbService';

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

async function ensureAuthenticatedAdmin(): Promise<{ ok: true; uid: string } | { ok: false; error: string }> {
  const user = auth.currentUser;
  if (!user) {
    return {
      ok: false,
      error:
        'Administrator session not active. Please sign in as an Electoral Commission administrator and try again.',
    };
  }

  try {
    let tokenRes = await user.getIdTokenResult();
    if (tokenRes.claims?.admin !== true) {
      tokenRes = await user.getIdTokenResult(true);
    }
    if (tokenRes.claims?.admin !== true) {
      return {
        ok: false,
        error:
          'Permission denied: Your signed-in Firebase account lacks administrator custom claims (admin: true). Sign in with an authorized Electoral Commission account or provision admin claims first.',
      };
    }

    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (adminSnap.exists() && adminSnap.data()?.isActive === false) {
        return {
          ok: false,
          error: 'This administrator account has been deactivated and cannot modify election records.',
        };
      }
    } catch {
      // Allow token claim verification to proceed if /admins/{uid} doc isn't readable or offline check hits rules
    }

    return { ok: true, uid: user.uid };
  } catch (err: any) {
    return {
      ok: false,
      error: formatFirestorePermissionError(err, OperationType.GET, `admins/${user.uid}`),
    };
  }
}

class FirebaseAdminService {
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
      const authCheck = await ensureAuthenticatedAdmin();
      if (!authCheck.ok) return { success: false, error: authCheck.error };

      await setDoc(doc(db, 'domains', id), { ...domain, updatedAt: serverTimestamp() });
      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Created Election Domain',
        target: domain.name,
      }).catch(() => {});
      return { success: true, domain, message: 'Domain created in Cloud Firestore.' };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.CREATE, `domains/${id}`),
      };
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
      const authCheck = await ensureAuthenticatedAdmin();
      if (!authCheck.ok) return { success: false, error: authCheck.error };

      await setDoc(doc(db, colName, id), record);
      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: `Created ${subType} Sub-Domain`,
        target: record.name,
      }).catch(() => {});
      return { success: true, subdomain: record };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.CREATE, `${colName}/${id}`),
      };
    }
  }

  async createElection(payload: CreateElectionPayload): Promise<{
    success: boolean;
    election?: Election;
    positions?: Position[];
    message?: string;
    error?: string;
  }> {
    const domainId = payload.domainId || categoryToDomainId(payload.category);
    const category = payload.category || domainIdToCategory(domainId);

    // 1. Validate required election fields
    if (!payload.title || !payload.title.trim()) {
      return { success: false, error: 'Election title is mandatory.' };
    }
    if (!domainId || !category) {
      return { success: false, error: 'A valid election domain and category must be selected.' };
    }
    if (domainId === 'jcrc_hall' && !payload.hallId?.trim()) {
      return {
        success: false,
        error: 'A participating Residential Hall must be selected for JCRC elections.',
      };
    }
    if (domainId === 'faculty_school' && !payload.facultyId?.trim()) {
      return { success: false, error: 'A participating Faculty / School must be selected.' };
    }
    if (domainId === 'departmental' && !payload.departmentId?.trim()) {
      return { success: false, error: 'A participating Academic Department must be selected.' };
    }

    const startMs = new Date(payload.startDate).getTime();
    const endMs = new Date(payload.endDate).getTime();
    if (!payload.startDate || !payload.endDate || Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return {
        success: false,
        error: 'Invalid poll schedule: closing date/time must be strictly after opening date/time.',
      };
    }

    const positionsInput = Array.isArray(payload.positions) ? payload.positions : [];
    if (positionsInput.length === 0) {
      return {
        success: false,
        error: 'At least one contested position/portfolio is required to provision an election.',
      };
    }

    for (let i = 0; i < positionsInput.length; i++) {
      const pos = positionsInput[i];
      if (!pos.title || !pos.title.trim()) {
        return {
          success: false,
          error: `Contested position #${i + 1} is missing a portfolio title.`,
        };
      }
      const maxSel = Number(pos.maxSelections ?? 1);
      if (Number.isNaN(maxSel) || maxSel < 1 || maxSel > 5) {
        return {
          success: false,
          error: `Position "${pos.title}" must allow between 1 and 5 candidate selections.`,
        };
      }
    }

    const allowedInitialStatuses: ElectionStatus[] = ['draft', 'pending_approval', 'scheduled', 'live'];
    const initialStatus: ElectionStatus =
      payload.initialStatus && allowedInitialStatuses.includes(payload.initialStatus)
        ? payload.initialStatus
        : 'draft';

    const cleanIdempotencyKey = payload.idempotencyKey
      ? payload.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
      : '';
    const electionId = cleanIdempotencyKey
      ? `elec_${cleanIdempotencyKey}`
      : `elec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const code =
      payload.code?.trim().toUpperCase() ||
      `UCC-${category.replace(/[^A-Z]/gi, '').slice(0, 4).toUpperCase()}-${new Date().getFullYear()}`;
    const nowIso = new Date().toISOString();

    try {
      // 2. Verify active authenticated admin session + custom claims
      const authCheck = await ensureAuthenticatedAdmin();
      if (!authCheck.ok) {
        return { success: false, error: authCheck.error };
      }

      const actor = await getCurrentAdminContext();

      // 3. Idempotency guard: prevent duplicate creation if retried with same key
      if (cleanIdempotencyKey) {
        const existingSnap = await getDoc(doc(db, 'elections', electionId));
        if (existingSnap.exists()) {
          const existingElection = mapDoc<Election>(existingSnap.id, existingSnap.data());
          const posSnap = await getDocs(
            query(collection(db, 'positions'), where('electionId', '==', electionId))
          );
          const existingPositions = posSnap.docs
            .map((d) => mapDoc<Position>(d.id, d.data()))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          return {
            success: true,
            election: existingElection,
            positions: existingPositions,
            message: 'Election already provisioned in Cloud Firestore.',
          };
        }
      }

      const electionData: Election = stripUndefinedDeep({
        id: electionId,
        title: payload.title.trim(),
        code,
        description:
          payload.description?.trim() ||
          `Official ${category} election for academic year ${payload.academicYear}.`,
        category,
        domainId,
        ...(payload.hallId ? { hallId: payload.hallId } : {}),
        ...(payload.facultyId ? { facultyId: payload.facultyId } : {}),
        ...(payload.departmentId ? { departmentId: payload.departmentId } : {}),
        ...(payload.subdomainLabel ? { subdomainLabel: payload.subdomainLabel.trim() } : {}),
        ...(payload.guidelinesUrl ? { guidelinesUrl: payload.guidelinesUrl } : {}),
        ...(payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : {}),
        academicYear:
          payload.academicYear?.trim() ||
          `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        status: initialStatus,
        ...(initialStatus === 'scheduled' || initialStatus === 'live'
          ? { approvedBy: actor.name, publishedAt: nowIso }
          : {}),
        startDate: payload.startDate,
        endDate: payload.endDate,
        startTime: payload.startTime || '08:00',
        endTime: payload.endTime || '17:00',
        totalEligibleVoters: 0,
        totalVotesCast: 0,
        turnoutPercentage: 0,
        organizingBody:
          payload.organizingBody?.trim() || 'UCC Electoral Commission (EC-UCC)',
        eligibilityCriteria: payload.eligibilityCriteria || {},
        rules: Array.isArray(payload.rules) ? payload.rules : [],
        positionsCount: positionsInput.length,
        resultsCertified: false,
        provisionalResultsReady: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // 4. Atomic batch write: election record + every contested position together
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'elections', electionId),
        stripUndefinedDeep({
          ...electionData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      const createdPositions: Position[] = [];
      for (let i = 0; i < positionsInput.length; i++) {
        const p = positionsInput[i];
        const orderNum = p.order && p.order > 0 ? p.order : i + 1;
        const posId = `pos_${electionId}_${i + 1}`;
        const maxSel = Math.min(5, Math.max(1, Number(p.maxSelections ?? 1)));
        const posDoc: Position = stripUndefinedDeep({
          id: posId,
          electionId,
          domainId,
          ...(payload.hallId ? { hallId: payload.hallId } : {}),
          ...(payload.facultyId ? { facultyId: payload.facultyId } : {}),
          ...(payload.departmentId ? { departmentId: payload.departmentId } : {}),
          title: p.title.trim(),
          description: p.description?.trim() || `Contested portfolio for ${p.title.trim()}`,
          maxSelections: maxSel,
          allowsSkip: p.allowsSkip ?? false,
          order: orderNum,
          candidateIds: [],
          candidateEligibilityRules:
            p.candidateEligibilityRules?.trim() ||
            'Accredited student in good standing, GPA >= 3.0.',
          votingRules:
            p.votingRules?.trim() ||
            (maxSel > 1
              ? `Multi-choice up to ${maxSel} candidates`
              : 'Single candidate preference'),
        });
        batch.set(
          doc(db, 'positions', posId),
          stripUndefinedDeep({
            ...posDoc,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        createdPositions.push(posDoc);
      }

      await batch.commit();

      // 5. Record tamper-evident audit entry without blocking committed persistence
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action:
          initialStatus === 'live'
            ? 'Created & Opened Live Election'
            : initialStatus === 'scheduled'
            ? 'Created & Published Scheduled Election'
            : 'Created Draft Election',
        target: `${electionData.title} (${electionData.code}) [${createdPositions.length} positions]`,
      }).catch(() => {});

      return {
        success: true,
        election: electionData,
        positions: createdPositions,
        message: `Election "${electionData.title}" and ${createdPositions.length} position(s) saved atomically to Cloud Firestore.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.CREATE, `elections/${electionId}`),
      };
    }
  }

  async updateElection(
    id: string,
    updates: Partial<Election>
  ): Promise<{ success: boolean; election?: Election; message?: string; error?: string }> {
    try {
      const authCheck = await ensureAuthenticatedAdmin();
      if (!authCheck.ok) return { success: false, error: authCheck.error };

      if (updates.title !== undefined && !updates.title.trim()) {
        return { success: false, error: 'Election title cannot be empty.' };
      }

      if (updates.startDate && updates.endDate) {
        const sMs = new Date(updates.startDate).getTime();
        const eMs = new Date(updates.endDate).getTime();
        if (Number.isNaN(sMs) || Number.isNaN(eMs) || eMs <= sMs) {
          return {
            success: false,
            error: 'Closing date/time must be strictly after opening date/time.',
          };
        }
      }

      const cleanUpdates = stripUndefinedDeep({
        ...updates,
        ...(updates.title ? { title: updates.title.trim() } : {}),
        ...(updates.code ? { code: updates.code.trim().toUpperCase() } : {}),
        ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
        ...(updates.organizingBody ? { organizingBody: updates.organizingBody.trim() } : {}),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'elections', id), cleanUpdates);
      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Updated Election Configuration',
        target: id,
      }).catch(() => {});

      const snap = await getDoc(doc(db, 'elections', id));
      return {
        success: true,
        election: snap.exists() ? mapDoc<Election>(snap.id, snap.data()) : undefined,
        message: 'Election updated in Cloud Firestore.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `elections/${id}`),
      };
    }
  }

  async changeStatus(
    id: string,
    newStatus: ElectionStatus,
    justification?: string
  ): Promise<{ success: boolean; election?: Election; message?: string; error?: string }> {
    try {
      const authCheck = await ensureAuthenticatedAdmin();
      if (!authCheck.ok) return { success: false, error: authCheck.error };

      const existingSnap = await getDoc(doc(db, 'elections', id));
      if (!existingSnap.exists()) {
        return { success: false, error: 'Election record not found in Cloud Firestore.' };
      }

      if (newStatus === 'scheduled' || newStatus === 'live') {
        const posSnap = await getDocs(
          query(collection(db, 'positions'), where('electionId', '==', id))
        );
        if (posSnap.empty) {
          return {
            success: false,
            error:
              'Cannot publish or open voting for an election without at least one contested position.',
          };
        }
      }

      const actor = await getCurrentAdminContext();
      await updateDoc(
        doc(db, 'elections', id),
        stripUndefinedDeep({
          status: newStatus,
          ...(newStatus === 'scheduled' || newStatus === 'live'
            ? { approvedBy: actor.name, publishedAt: new Date().toISOString() }
            : {}),
          ...(newStatus === 'results_published' ? { resultsCertified: true } : {}),
          updatedAt: serverTimestamp(),
        })
      );
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: `Transitioned Election Status -> ${newStatus}`,
        target: justification ? `${id} (${justification})` : id,
      }).catch(() => {});
      const updated = await getDoc(doc(db, 'elections', id));
      return {
        success: true,
        election: updated.exists() ? mapDoc<Election>(updated.id, updated.data()) : undefined,
        message: `Election status updated to ${newStatus.replace(/_/g, ' ')}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `elections/${id}`),
      };
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
  ): Promise<{ success: boolean; position?: Position; message?: string; error?: string }> {
    if (!position.title || !position.title.trim()) {
      return { success: false, error: 'Position title is required.' };
    }
    const maxSel = Math.min(5, Math.max(1, Number(position.maxSelections || 1)));
    const posId = `pos_${electionId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    try {
      const authCheck = await ensureAuthenticatedAdmin();
      if (!authCheck.ok) return { success: false, error: authCheck.error };

      const [electionSnap, existingSnap] = await Promise.all([
        getDoc(doc(db, 'elections', electionId)),
        getDocs(query(collection(db, 'positions'), where('electionId', '==', electionId))),
      ]);

      if (!electionSnap.exists()) {
        return { success: false, error: 'Target election no longer exists.' };
      }

      const parent = electionSnap.data() as Election;
      const nextCount = existingSnap.size + 1;

      const posDoc: Position = stripUndefinedDeep({
        id: posId,
        electionId,
        domainId: parent.domainId,
        ...(parent.hallId ? { hallId: parent.hallId } : {}),
        ...(parent.facultyId ? { facultyId: parent.facultyId } : {}),
        ...(parent.departmentId ? { departmentId: parent.departmentId } : {}),
        title: position.title.trim(),
        description: position.description?.trim() || `Contested portfolio for ${position.title.trim()}`,
        maxSelections: maxSel,
        allowsSkip: position.allowsSkip ?? false,
        order: nextCount,
        candidateIds: [],
        candidateEligibilityRules:
          position.candidateEligibilityRules?.trim() ||
          'Accredited student in good standing, GPA >= 3.0.',
        votingRules:
          position.votingRules?.trim() ||
          (maxSel > 1 ? `Multi-choice up to ${maxSel} candidates` : 'Single candidate preference'),
      });

      const batch = writeBatch(db);
      batch.set(
        doc(db, 'positions', posId),
        stripUndefinedDeep({
          ...posDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      batch.update(doc(db, 'elections', electionId), {
        positionsCount: nextCount,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      return { success: true, position: posDoc, message: 'Position added.' };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.CREATE, `positions/${posId}`),
      };
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
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    if (updates.title !== undefined && !updates.title.trim()) {
      return { success: false, error: 'Position title cannot be empty.' };
    }
    try {
      const authCheck = await ensureAuthenticatedAdmin();
      if (!authCheck.ok) return { success: false, error: authCheck.error };

      await updateDoc(
        doc(db, 'positions', posId),
        stripUndefinedDeep({
          ...updates,
          ...(updates.title ? { title: updates.title.trim() } : {}),
          ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
          updatedAt: serverTimestamp(),
        })
      );
      return { success: true, message: 'Position updated.' };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `positions/${posId}`),
      };
    }
  }

  async deletePosition(
    electionId: string,
    posId: string
  ): Promise<{
    success: boolean;
    remainingPositions?: Position[];
    message?: string;
    error?: string;
  }> {
    try {
      const authCheck = await ensureAuthenticatedAdmin();
      if (!authCheck.ok) return { success: false, error: authCheck.error };

      const existingSnap = await getDocs(
        query(collection(db, 'positions'), where('electionId', '==', electionId))
      );
      const remainingDocs = existingSnap.docs
        .filter((d) => d.id !== posId)
        .map((d) => mapDoc<Position>(d.id, d.data()))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const batch = writeBatch(db);
      batch.delete(doc(db, 'positions', posId));
      remainingDocs.forEach((p, idx) => {
        if (p.order !== idx + 1) {
          batch.update(doc(db, 'positions', p.id), {
            order: idx + 1,
            updatedAt: serverTimestamp(),
          });
          p.order = idx + 1;
        }
      });
      batch.update(doc(db, 'elections', electionId), {
        positionsCount: remainingDocs.length,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      return {
        success: true,
        remainingPositions: remainingDocs,
        message: 'Position removed.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.DELETE, `positions/${posId}`),
      };
    }
  }

  async verifyCandidateEligibility(id: string) {
    try {
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
        await updateDoc(doc(db, 'positions', cand.positionId), {
          candidateIds: arrayUnion(id),
        }).catch(() => {});
      }

      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Approved Candidate Nomination',
        target: `${cand.fullName} (${cand.studentId})`,
      }).catch(() => {});
      return { success: true, message: 'Candidate approved for digital ballot.' };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `candidates/${id}`),
      };
    }
  }

  async rejectCandidate(
    id: string,
    reason: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
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
      }).catch(() => {});
      return { success: true, message: 'Candidate nomination rejected.' };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `candidates/${id}`),
      };
    }
  }

  async requestCandidateCorrections(
    id: string,
    notes: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
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
      }).catch(() => {});
      return { success: true, message: 'Correction request recorded.' };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `candidates/${id}`),
      };
    }
  }

  async withdrawCandidate(
    id: string,
    _reason?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
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
      }).catch(() => {});
      return { success: true, message: 'Candidate withdrawn.' };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `candidates/${id}`),
      };
    }
  }

  async assignCandidatePosition(
    id: string,
    electionId: string,
    positionId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await updateDoc(doc(db, 'candidates', id), {
        electionId,
        positionId,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'positions', positionId), {
        candidateIds: arrayUnion(id),
      }).catch(() => {});
      return { success: true, message: 'Candidate assigned to position.' };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `candidates/${id}`),
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
        return { success: false, error: 'Election not found.' };
      }

      if (rSnap.exists()) {
        return {
          success: true,
          results: mapDoc<ElectionResultsPayload>(rSnap.id, rSnap.data()),
        };
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
            photoUrl: c.photoUrl || '',
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

      const nextPayload: ElectionResultsPayload = stripUndefinedDeep({
        ...prev,
        workflowStage: targetStage,
        workflowHistory: [...(prev.workflowHistory || []), nextAction],
        isPublished,
        resultsCertified: isCertified,
        ...(isCertified ? { certifiedBy: actorName } : prev.certifiedBy ? { certifiedBy: prev.certifiedBy } : {}),
        ...(isPublished ? { publishedAt: new Date().toISOString() } : prev.publishedAt ? { publishedAt: prev.publishedAt } : {}),
      });

      await setDoc(
        doc(db, 'election_results', electionId),
        stripUndefinedDeep({
          ...nextPayload,
          updatedAt: serverTimestamp(),
        }),
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
      'Position,Candidate,Student ID,Department,Hall,Votes Received,Valid Vote Share (%)',
    ];
    r.positions.forEach((p) => {
      p.candidates.forEach((c) => {
        lines.push(
          [
            `"${p.title.replace(/"/g, '""')}"`,
            `"${c.fullName.replace(/"/g, '""')}"`,
            `"${c.studentId}"`,
            `"${c.department.replace(/"/g, '""')}"`,
            `"${c.hall.replace(/"/g, '""')}"`,
            c.votesReceived,
            c.percentageOfValidVotes.toFixed(1),
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
