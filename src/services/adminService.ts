import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, handleFirestoreError, OperationType } from '../lib/firebase';
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
} from '../data/historical2026Elections';
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
  HallUnit,
  Position,
  PositionResultSummary,
  ResultsWorkflowStage,
} from '../types';
import { CreateElectionPayload } from './interfaces';
import { convertTimestamp, writeAuditLog } from './firebaseDbService';

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

async function ensureHistoricalElectionInFirestore(id: string): Promise<void> {
  const hist = getHistoricalElectionById(id);
  if (!hist) return;
  const ref = doc(db, 'elections', id);
  const snap = await getDoc(ref).catch(() => null);
  if (snap && !snap.exists()) {
    await setDoc(ref, stripUndefined({ ...hist, updatedAt: serverTimestamp() }));
    const histPositions = getHistoricalPositionsByElectionId(id);
    for (const pos of histPositions) {
      const pRef = doc(db, 'positions', pos.id);
      const pSnap = await getDoc(pRef).catch(() => null);
      if (pSnap && !pSnap.exists()) {
        await setDoc(pRef, stripUndefined(pos));
      }
    }
  }
}

async function ensureHistoricalPositionInFirestore(posId: string): Promise<void> {
  const hist = HISTORICAL_2026_POSITIONS.find((p) => p.id === posId);
  if (!hist) return;
  await ensureHistoricalElectionInFirestore(hist.electionId);
  const ref = doc(db, 'positions', posId);
  const snap = await getDoc(ref).catch(() => null);
  if (snap && !snap.exists()) {
    await setDoc(ref, stripUndefined(hist));
  }
}

async function ensureHistoricalCandidateInFirestore(id: string): Promise<void> {
  const hist = getHistoricalCandidateById(id);
  if (!hist) return;
  await ensureHistoricalElectionInFirestore(hist.electionId);
  const ref = doc(db, 'candidates', id);
  const snap = await getDoc(ref).catch(() => null);
  if (snap && !snap.exists()) {
    await setDoc(ref, stripUndefined({ ...hist, updatedAt: serverTimestamp() }));
  }
}

class FirebaseAdminService {
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

      const actor = await getCurrentAdminContext();
      await writeAuditLog({
        adminName: actor.name,
        adminRole: actor.role,
        action: 'Created Election',
        target: `${electionData.title} (${electionData.code})`,
      });

      return {
        success: true,
        election: electionData,
        positions: createdPositions,
        message: 'Election saved to Cloud Firestore.',
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
      await ensureHistoricalElectionInFirestore(id);
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

      await ensureHistoricalElectionInFirestore(id);
      await updateDoc(doc(db, 'elections', id), statusUpdate);

      // Keep published state of election_results synced when unpublishing results
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
      await ensureHistoricalElectionInFirestore(electionId);
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
      await ensureHistoricalPositionInFirestore(posId);
      await updateDoc(doc(db, 'positions', posId), stripUndefined(updates));
      return { success: true, message: 'Position updated.' };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `positions/${posId}`);
    }
  }

  async deletePosition(electionId: string, posId: string) {
    try {
      await ensureHistoricalElectionInFirestore(electionId);
      await ensureHistoricalPositionInFirestore(posId);
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
      await ensureHistoricalCandidateInFirestore(id);
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
      await ensureHistoricalCandidateInFirestore(id);
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
        await ensureHistoricalPositionInFirestore(cand.positionId);
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
      await ensureHistoricalCandidateInFirestore(id);
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
      await ensureHistoricalCandidateInFirestore(id);
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
      await ensureHistoricalCandidateInFirestore(id);
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
      await ensureHistoricalCandidateInFirestore(id);
      await ensureHistoricalElectionInFirestore(electionId);
      await ensureHistoricalPositionInFirestore(positionId);
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
      handleFirestoreError(err, OperationType.UPDATE, `candidates/${id}`);
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
            r.tallyAvailable === false ? 'Not tallied' : c.percentageOfValidVotes.toFixed(1),
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
