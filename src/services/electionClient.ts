import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, OperationType } from '../lib/firebase';
import {
  DOMAIN_REGISTRY,
  UCC_DEPARTMENTS,
  UCC_FACULTIES,
  UCC_HALLS,
  categoryToDomainId,
  mergeOfficialHalls,
} from '../data/uccStructure';
import {
  getHistoricalCandidateById,
  getHistoricalElectionById,
  getHistoricalPositionsByElectionId,
  getHistoricalResultsByElectionId,
  mergeHistoricalCandidates,
  mergeHistoricalElections,
  mergeHistoricalPositions,
} from '../data/historical2026Elections';
import {
  getSrc2027CandidateById,
  getSrc2027ElectionById,
  getSrc2027PositionsByElectionId,
  mergeSrc2027Candidates,
  mergeSrc2027Elections,
  mergeSrc2027Positions,
} from '../data/src2027Election';
import {
  UNVERIFIED_HALL_MESSAGE,
  findMatchingHallUnit,
  isOfficialHallAffiliation,
  matchesHallAffiliation,
  resolveElectionHallUnit,
} from '../utils/hallUtils';
import {
  Candidate,
  DepartmentUnit,
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionResultsPayload,
  FacultyUnit,
  HallUnit,
  Position,
  StudentProfile,
  VoterEligibilityRecord,
} from '../types';
import { DomainWithStats, EligibilityResult } from './interfaces';
import { convertTimestamp, getDirectoryConfig } from './firebaseDbService';
import {
  DIRECTORY_CONFIG_DOC_ID,
  applyDirectoryVisibilityFilter,
} from '../utils/electionRemovalUtils';
import {
  formatCandidateSubmissionError,
  generateCandidateDocId,
} from '../utils/candidateApplicationUtils';

function mapDoc<T>(id: string, data: Record<string, any>): T {
  const out: Record<string, any> = { id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v?.toDate === 'function' ? convertTimestamp(v) : v;
  }
  return out as T;
}

export function evaluateStudentEligibilityLocal(
  student: StudentProfile,
  election: Election,
  eligibilityRecord?: VoterEligibilityRecord | null
): EligibilityResult {
  const checks: Record<string, boolean> = {
    accountActive: student.status !== 'suspended' && student.status !== 'unverified',
    emailVerified: Boolean(student.emailVerified),
    rollVerified:
      eligibilityRecord !== undefined && eligibilityRecord !== null
        ? eligibilityRecord.isEligible === true && eligibilityRecord.status === 'eligible'
        : student.isEligible === true && student.eligibilityStatus !== 'suspended' && student.eligibilityStatus !== 'pending_verification',
    facultyMatch: true,
    departmentMatch: true,
    levelMatch: true,
    hallMatch: true,
  };

  if (!checks.accountActive) {
    return {
      isEligible: false,
      reason: 'Your student account is suspended or unverified.',
      checks,
    };
  }

  if (!checks.rollVerified) {
    return {
      isEligible: false,
      reason:
        eligibilityRecord?.reason ||
        student.eligibilityNotes ||
        'Your email is verified, but your student record has not yet been confirmed on the UCC Electoral Commission voter roll.',
      checks,
    };
  }

  const criteria = election.eligibilityCriteria || {};
  const resolvedFaculty = eligibilityRecord?.faculty || student.faculty || '';
  const resolvedDepartment = eligibilityRecord?.department || student.department || '';
  const resolvedLevel = String(eligibilityRecord?.level || student.level || '');
  const resolvedHall = eligibilityRecord?.hall || student.hall || '';

  if (criteria.faculties && criteria.faculties.length > 0) {
    checks.facultyMatch = criteria.faculties.some(
      (f) => f.toLowerCase() === resolvedFaculty.toLowerCase()
    );
  }
  if (criteria.departments && criteria.departments.length > 0) {
    checks.departmentMatch = criteria.departments.some(
      (d) => d.toLowerCase() === resolvedDepartment.toLowerCase()
    );
  }
  if (criteria.levels && criteria.levels.length > 0) {
    checks.levelMatch = criteria.levels.some(
      (l) => l.toLowerCase() === resolvedLevel.toLowerCase()
    );
  }

  const isHallElection =
    election.domainId === 'jcrc_hall' ||
    election.category === 'JCR / Hall' ||
    Boolean(election.hallId) ||
    Boolean(criteria.halls && criteria.halls.length > 0);

  let unverifiedHallFailure = false;
  let targetHallLabels: string[] = [];

  if (isHallElection) {
    const resolvedElectionHall = resolveElectionHallUnit(election, UCC_HALLS);
    targetHallLabels =
      criteria.halls && criteria.halls.length > 0
        ? criteria.halls
        : resolvedElectionHall
        ? [resolvedElectionHall.name]
        : election.hallId
        ? [election.hallId]
        : election.subdomainLabel
        ? [election.subdomainLabel]
        : [];

    if (!isOfficialHallAffiliation(resolvedHall, UCC_HALLS)) {
      checks.hallMatch = false;
      unverifiedHallFailure = true;
    } else if (targetHallLabels.length > 0) {
      checks.hallMatch = targetHallLabels.some((target) => {
        const unit = findMatchingHallUnit(target, UCC_HALLS);
        return matchesHallAffiliation(resolvedHall, target, unit);
      });
    } else {
      checks.hallMatch = true;
    }
  }

  if (election.category === 'GRASAG' && resolvedLevel !== 'Postgraduate') {
    checks.levelMatch = false;
  }

  const failedReasons: string[] = [];
  if (!checks.facultyMatch) failedReasons.push(`Restricted to faculty: ${criteria.faculties?.join(', ')}`);
  if (!checks.departmentMatch) failedReasons.push(`Restricted to department: ${criteria.departments?.join(', ')}`);
  if (!checks.levelMatch) {
    failedReasons.push(
      election.category === 'GRASAG'
        ? 'GRASAG elections require Postgraduate enrolment.'
        : `Restricted to level(s): ${criteria.levels?.join(', ')}`
    );
  }
  if (!checks.hallMatch) {
    failedReasons.push(
      unverifiedHallFailure
        ? UNVERIFIED_HALL_MESSAGE
        : `Restricted to hall: ${targetHallLabels.join(', ')}`
    );
  }

  return {
    isEligible: failedReasons.length === 0,
    reason:
      failedReasons.length > 0
        ? failedReasons.join(' ')
        : 'Verified eligible UCC voter for this election.',
    checks,
  };
}

class FirebaseElectionClient {
  async getDomains() {
    try {
      const [
        domainsSnap,
        hallsSnap,
        facSnap,
        deptSnap,
        electionsSnap,
        posSnap,
        candSnap,
        dirConfig,
      ] = await Promise.all([
        getDocs(collection(db, 'domains')).catch(() => null),
        getDocs(collection(db, 'halls')).catch(() => null),
        getDocs(collection(db, 'faculties')).catch(() => null),
        getDocs(collection(db, 'departments')).catch(() => null),
        getDocs(collection(db, 'elections')),
        getDocs(collection(db, 'positions')),
        getDocs(collection(db, 'candidates')),
        getDirectoryConfig(),
      ]);

      const domainDocs =
        domainsSnap && !domainsSnap.empty
          ? domainsSnap.docs.filter((d) => d.id !== DIRECTORY_CONFIG_DOC_ID)
          : [];

      const rawDomains: DomainRegistryItem[] =
        domainDocs.length > 0
          ? domainDocs.map((d) => mapDoc<DomainRegistryItem>(d.id, d.data()))
          : DOMAIN_REGISTRY;

      const remoteHalls: HallUnit[] =
        hallsSnap && !hallsSnap.empty
          ? hallsSnap.docs.map((d) => mapDoc<HallUnit>(d.id, d.data()))
          : [];
      const halls: HallUnit[] = mergeOfficialHalls(remoteHalls);

      const faculties: FacultyUnit[] =
        facSnap && !facSnap.empty
          ? facSnap.docs.map((d) => mapDoc<FacultyUnit>(d.id, d.data()))
          : UCC_FACULTIES;

      const departments: DepartmentUnit[] =
        deptSnap && !deptSnap.empty
          ? deptSnap.docs.map((d) => mapDoc<DepartmentUnit>(d.id, d.data()))
          : UCC_DEPARTMENTS;

      const firestoreElections = electionsSnap.docs.map((d) => mapDoc<Election>(d.id, d.data()));
      const firestoreIds = new Set(firestoreElections.map((e) => e.id));
      const elections = applyDirectoryVisibilityFilter(
        mergeSrc2027Elections(mergeHistoricalElections(firestoreElections)),
        dirConfig.hiddenBuiltInElectionIds,
        firestoreIds
      );
      const visibleElectionIds = new Set(elections.map((e) => e.id));

      const candidates = mergeSrc2027Candidates(
        mergeHistoricalCandidates(
          candSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()))
        )
      ).filter((c) => visibleElectionIds.has(c.electionId));

      const firestorePositionsByElection: Record<string, Position[]> = {};
      posSnap.docs.forEach((d) => {
        const pos = mapDoc<Position>(d.id, d.data());
        if (!pos.electionId) return;
        if (!firestorePositionsByElection[pos.electionId]) {
          firestorePositionsByElection[pos.electionId] = [];
        }
        firestorePositionsByElection[pos.electionId].push(pos);
      });
      const mergedPositions = mergeSrc2027Positions(
        mergeHistoricalPositions(firestorePositionsByElection)
      );
      const positionsByElection: Record<string, Position[]> = {};
      Object.entries(mergedPositions).forEach(([eid, list]) => {
        if (visibleElectionIds.has(eid)) {
          positionsByElection[eid] = list;
        }
      });

      const domains: DomainWithStats[] = rawDomains
        .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99))
        .map((dom) => {
          const domElections = elections.filter(
            (e) => (e.domainId || categoryToDomainId(e.category)) === dom.id
          );
          const domCandCount = candidates.filter(
            (c) =>
              c.applicationStatus === 'Approved' &&
              domElections.some((e) => e.id === c.electionId)
          ).length;

          return {
            ...dom,
            stats: {
              totalElections: domElections.length,
              activeElections: domElections.filter((e) => e.status === 'live').length,
              upcomingElections: domElections.filter(
                (e) => e.status === 'scheduled' || e.status === 'upcoming'
              ).length,
              completedElections: domElections.filter((e) =>
                ['closed', 'results_pending_certification', 'results_published', 'archived'].includes(
                  e.status
                )
              ).length,
              pendingCertification: domElections.filter(
                (e) => e.status === 'results_pending_certification'
              ).length,
              totalVotesCast: domElections.reduce(
                (sum, e) => sum + (Number(e.totalVotesCast) || 0),
                0
              ),
              approvedCandidatesCount: domCandCount,
            },
          };
        });

      return {
        success: true,
        domains,
        halls,
        faculties,
        departments,
        positionsByElection,
      };
    } catch (err: any) {
      return {
        success: false,
        domains: [],
        halls: UCC_HALLS,
        faculties: UCC_FACULTIES,
        departments: UCC_DEPARTMENTS,
        positionsByElection: {},
        error: err?.message || 'Unable to load domain registry.',
      };
    }
  }

  async getDomainById(
    domainId: DomainId,
    filters?: { hallId?: string; facultyId?: string; departmentId?: string; status?: string }
  ) {
    const res = await this.getDomains();
    const domain = res.domains.find((d) => d.id === domainId);
    const [electionsSnap, candidatesSnap, dirConfig] = await Promise.all([
      getDocs(collection(db, 'elections')),
      getDocs(collection(db, 'candidates')),
      getDirectoryConfig(),
    ]);

    const firestoreElections = electionsSnap.docs.map((d) => mapDoc<Election>(d.id, d.data()));
    const firestoreIds = new Set(firestoreElections.map((e) => e.id));
    let elections = applyDirectoryVisibilityFilter(
      mergeSrc2027Elections(mergeHistoricalElections(firestoreElections)),
      dirConfig.hiddenBuiltInElectionIds,
      firestoreIds
    ).filter((e) => (e.domainId || categoryToDomainId(e.category)) === domainId);

    if (filters?.hallId) elections = elections.filter((e) => e.hallId === filters.hallId);
    if (filters?.facultyId) elections = elections.filter((e) => e.facultyId === filters.facultyId);
    if (filters?.departmentId) {
      elections = elections.filter((e) => e.departmentId === filters.departmentId);
    }
    if (filters?.status) elections = elections.filter((e) => e.status === filters.status);

    const electionIds = new Set(elections.map((e) => e.id));
    const candidates = mergeSrc2027Candidates(
      mergeHistoricalCandidates(
        candidatesSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()))
      )
    ).filter((c) => electionIds.has(c.electionId));

    return {
      success: Boolean(domain),
      domain,
      elections,
      positionsByElection: res.positionsByElection,
      candidates,
      subdomains: {
        halls: res.halls,
        faculties: res.faculties,
        departments: res.departments,
      },
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
    try {
      const [snap, dirConfig] = await Promise.all([
        getDocs(collection(db, 'elections')),
        getDirectoryConfig(),
      ]);
      const firestoreElections = snap.docs.map((d) => mapDoc<Election>(d.id, d.data()));
      const firestoreIds = new Set(firestoreElections.map((e) => e.id));
      let items = applyDirectoryVisibilityFilter(
        mergeSrc2027Elections(mergeHistoricalElections(firestoreElections)),
        dirConfig.hiddenBuiltInElectionIds,
        firestoreIds
      );
      if (params?.category) items = items.filter((e) => e.category === params.category);
      if (params?.domainId) {
        items = items.filter(
          (e) => (e.domainId || categoryToDomainId(e.category)) === params.domainId
        );
      }
      if (params?.hallId) items = items.filter((e) => e.hallId === params.hallId);
      if (params?.facultyId) items = items.filter((e) => e.facultyId === params.facultyId);
      if (params?.departmentId) {
        items = items.filter((e) => e.departmentId === params.departmentId);
      }
      if (params?.status) items = items.filter((e) => e.status === params.status);
      if (params?.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.code.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q)
        );
      }
      return { success: true, total: items.length, elections: items };
    } catch (err: any) {
      return {
        success: false,
        total: 0,
        elections: [],
        error: err?.message || 'Unable to load elections from Firestore.',
      };
    }
  }

  async getElectionById(id: string) {
    try {
      const [eSnap, pSnap, dirConfig] = await Promise.all([
        getDoc(doc(db, 'elections', id)),
        getDocs(query(collection(db, 'positions'), where('electionId', '==', id))),
        getDirectoryConfig(),
      ]);
      const hiddenSet = new Set(dirConfig.hiddenBuiltInElectionIds);
      if (!eSnap.exists()) {
        if (hiddenSet.has(id)) {
          return { success: false, error: 'Election not found.' };
        }
        const src2027 = getSrc2027ElectionById(id);
        if (src2027) {
          return {
            success: true,
            election: src2027,
            positions: getSrc2027PositionsByElectionId(id),
          };
        }
        const hist = getHistoricalElectionById(id);
        if (!hist) {
          return { success: false, error: 'Election not found.' };
        }
        return {
          success: true,
          election: hist,
          positions: getHistoricalPositionsByElectionId(id),
        };
      }
      const firestoreElection = mapDoc<Election>(eSnap.id, eSnap.data());
      if (firestoreElection.hiddenFromDirectory) {
        return { success: false, error: 'Election is no longer active in directory.' };
      }
      const firestorePositions = pSnap.docs.map((d) => mapDoc<Position>(d.id, d.data()));
      const mergedPositions = mergeSrc2027Positions(
        mergeHistoricalPositions({
          [id]: firestorePositions,
        })
      )[id] || [];
      return {
        success: true,
        election: firestoreElection,
        positions: mergedPositions,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to fetch election.' };
    }
  }

  async checkEligibility(electionId: string, studentIdOrUid?: string) {
    try {
      const eSnap = await getDoc(doc(db, 'elections', electionId));
      const election: Election | undefined = eSnap.exists()
        ? mapDoc<Election>(eSnap.id, eSnap.data())
        : getSrc2027ElectionById(electionId) || getHistoricalElectionById(electionId);
      if (!election) {
        return { success: false, error: 'Election record not found.' };
      }

      // Try trusted Cloud Function first if deployed
      try {
        const fn = httpsCallable(functions, 'checkVoterEligibility');
        const res = await fn({ electionId, studentId: studentIdOrUid });
        const payload = res.data as any;
        if (payload && typeof payload.isEligible === 'boolean') {
          return {
            success: true,
            result: {
              isEligible: payload.isEligible,
              reason: payload.reason,
              checks: payload.checks || {},
            },
            studentId: payload.studentId,
            studentName: payload.studentName,
          };
        }
      } catch {
        // Fallback to direct Firestore evaluation below
      }

      let student: StudentProfile | null = null;
      let eligRecord: VoterEligibilityRecord | null = null;

      if (studentIdOrUid) {
        const q = query(
          collection(db, 'students'),
          where('studentId', '==', studentIdOrUid.trim().toUpperCase())
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          student = mapDoc<StudentProfile>(snap.docs[0].id, snap.docs[0].data());
        } else {
          const byUid = await getDoc(doc(db, 'students', studentIdOrUid.trim()));
          if (byUid.exists()) {
            student = mapDoc<StudentProfile>(byUid.id, byUid.data());
          }
        }
      } else if (auth.currentUser) {
        const byUid = await getDoc(doc(db, 'students', auth.currentUser.uid));
        if (byUid.exists()) {
          student = mapDoc<StudentProfile>(byUid.id, byUid.data());
        }
      }

      if (!student) {
        return {
          success: false,
          error: 'No matching registered student profile found in Cloud Firestore.',
        };
      }

      const eligSnap = await getDoc(doc(db, 'voter_eligibility', student.uid || student.id));
      if (eligSnap.exists()) {
        eligRecord = mapDoc<VoterEligibilityRecord>(eligSnap.id, eligSnap.data());
      }

      const result = evaluateStudentEligibilityLocal(student, election, eligRecord);
      return {
        success: true,
        result,
        studentId: student.studentId,
        studentName: student.fullName,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to verify voter eligibility.',
      };
    }
  }

  async getCandidates(params?: {
    electionId?: string;
    positionId?: string;
    domainId?: string;
    status?: string;
    approvedOnly?: boolean;
    search?: string;
  }) {
    try {
      const [snap, electionsRes] = await Promise.all([
        getDocs(collection(db, 'candidates')),
        this.getElections(),
      ]);
      const visibleElectionIds = new Set(electionsRes.elections.map((e) => e.id));
      let items = mergeSrc2027Candidates(
        mergeHistoricalCandidates(
          snap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()))
        )
      ).filter((c) => visibleElectionIds.has(c.electionId));
      if (params?.electionId) items = items.filter((c) => c.electionId === params.electionId);
      if (params?.positionId) items = items.filter((c) => c.positionId === params.positionId);
      if (params?.domainId) items = items.filter((c) => c.domainId === params.domainId);
      if (params?.approvedOnly) {
        items = items.filter((c) => c.applicationStatus === 'Approved');
      } else if (params?.status) {
        items = items.filter((c) => c.applicationStatus === params.status);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.studentId.toLowerCase().includes(q) ||
            c.department.toLowerCase().includes(q)
        );
      }
      return { success: true, total: items.length, candidates: items };
    } catch (err: any) {
      return {
        success: false,
        total: 0,
        candidates: [],
        error: err?.message || 'Unable to load candidates.',
      };
    }
  }

  async getCandidateById(id: string) {
    try {
      const [snap, dirConfig] = await Promise.all([
        getDoc(doc(db, 'candidates', id)),
        getDirectoryConfig(),
      ]);
      const hiddenSet = new Set(dirConfig.hiddenBuiltInElectionIds);
      if (!snap.exists()) {
        const src2027 = getSrc2027CandidateById(id);
        if (src2027 && !hiddenSet.has(src2027.electionId)) {
          return { success: true, candidate: src2027 };
        }
        const hist = getHistoricalCandidateById(id);
        if (hist && !hiddenSet.has(hist.electionId)) {
          return { success: true, candidate: hist };
        }
        return { success: false, error: 'Candidate not found.' };
      }
      return { success: true, candidate: mapDoc<Candidate>(snap.id, snap.data()) };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to load candidate.' };
    }
  }

  async registerCandidate(payload: Partial<Candidate> & { isDraft?: boolean }): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error:
          'You must be signed in before submitting a candidate nomination. Sign in and retry—your entered details are preserved.',
      };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        success: false,
        error:
          'Network error: You appear to be offline. Reconnect to the internet and click Submit Application to retry—your form data has been preserved.',
      };
    }

    const candId = payload.id || generateCandidateDocId();
    const status = payload.isDraft ? 'Draft' : payload.applicationStatus || 'Submitted';

    let inferredDomainId = payload.domainId;
    let inferredHallId = payload.hallId;
    let inferredFacultyId = payload.facultyId;
    let inferredDepartmentId = payload.departmentId;

    if (payload.electionId && (!inferredDomainId || !inferredHallId)) {
      const eSnap = await getDoc(doc(db, 'elections', payload.electionId)).catch(() => null);
      if (eSnap?.exists()) {
        const elec = eSnap.data() as Election;
        inferredDomainId = inferredDomainId || elec.domainId || categoryToDomainId(elec.category);
        inferredHallId = inferredHallId || elec.hallId;
        inferredFacultyId = inferredFacultyId || elec.facultyId;
        inferredDepartmentId = inferredDepartmentId || elec.departmentId;
      }
    }

    if (!inferredHallId && payload.hall && isOfficialHallAffiliation(payload.hall, UCC_HALLS)) {
      inferredHallId = findMatchingHallUnit(payload.hall, UCC_HALLS)?.id;
    }

    const nowIso = new Date().toISOString();
    const rawDoc: Record<string, any> = {
      ...payload,
      id: candId,
      domainId: inferredDomainId,
      hallId: inferredHallId,
      facultyId: inferredFacultyId,
      departmentId: inferredDepartmentId,
      submittedByUid: user.uid,
      applicationStatus: status,
      photoUrl: payload.photoUrl || payload.electionPhotoUrl || '',
      submittedAt: nowIso,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };
    delete rawDoc.phone;
    delete rawDoc.isDraft;
    if (rawDoc.votesReceived === undefined) {
      delete rawDoc.votesReceived;
    }

    const docPayload: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawDoc)) {
      if (v !== undefined) docPayload[k] = v;
    }

    try {
      await setDoc(doc(db, 'candidates', candId), docPayload);
      return {
        success: true,
        candidate: {
          ...docPayload,
          id: candId,
          createdAt: nowIso,
          updatedAt: nowIso,
        } as unknown as Candidate,
        message: 'Candidate record saved to Cloud Firestore.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: formatCandidateSubmissionError(err, OperationType.CREATE, `candidates/${candId}`),
      };
    }
  }

  async updateCandidate(
    id: string,
    updates: Partial<Candidate> & { resubmit?: boolean; isDraft?: boolean }
  ): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error:
          'You must be signed in before updating or submitting a candidate application. Sign in and retry—your entered details are preserved.',
      };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        success: false,
        error:
          'Network error: You appear to be offline. Reconnect to the internet and click Submit Application to retry—your form data has been preserved.',
      };
    }

    try {
      const payload: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };
      for (const [k, v] of Object.entries(updates)) {
        if (k === 'phone' || k === 'resubmit' || k === 'isDraft' || k === 'submittedByUid') continue;
        if (v !== undefined) payload[k] = v;
      }
      if (!payload.hallId && typeof payload.hall === 'string' && isOfficialHallAffiliation(payload.hall, UCC_HALLS)) {
        const matched = findMatchingHallUnit(payload.hall, UCC_HALLS);
        if (matched) payload.hallId = matched.id;
      }
      if (updates.resubmit) {
        payload.applicationStatus = 'Submitted';
        payload.submittedAt = new Date().toISOString();
      } else if (updates.isDraft) {
        payload.applicationStatus = 'Draft';
      }
      const existingSnap = await getDoc(doc(db, 'candidates', id)).catch(() => null);
      if (existingSnap && !existingSnap.exists()) {
        const builtIn = getSrc2027CandidateById(id) || getHistoricalCandidateById(id);
        if (builtIn) {
          const cleanSeed: Record<string, any> = {};
          for (const [k, v] of Object.entries({ ...builtIn, ...payload })) {
            if (k === 'phone' || k === 'isDraft') continue;
            if (v !== undefined) cleanSeed[k] = v;
          }
          await setDoc(doc(db, 'candidates', id), cleanSeed);
          const refreshed = await getDoc(doc(db, 'candidates', id));
          return {
            success: true,
            candidate: refreshed.exists() ? mapDoc<Candidate>(refreshed.id, refreshed.data()) : undefined,
            message: 'Candidate updated.',
          };
        }
      }
      await updateDoc(doc(db, 'candidates', id), payload);
      const updatedSnap = await getDoc(doc(db, 'candidates', id));
      return {
        success: true,
        candidate: updatedSnap.exists()
          ? mapDoc<Candidate>(updatedSnap.id, updatedSnap.data())
          : undefined,
        message: 'Candidate updated.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: formatCandidateSubmissionError(err, OperationType.UPDATE, `candidates/${id}`),
      };
    }
  }

  async getPublishedResults(electionId: string) {
    try {
      const [eSnap, rSnap, dirConfig] = await Promise.all([
        getDoc(doc(db, 'elections', electionId)),
        getDoc(doc(db, 'election_results', electionId)),
        getDirectoryConfig(),
      ]);
      const hiddenSet = new Set(dirConfig.hiddenBuiltInElectionIds);

      if (!eSnap.exists()) {
        if (hiddenSet.has(electionId) || getSrc2027ElectionById(electionId)) {
          return {
            success: false,
            error: hiddenSet.has(electionId)
              ? 'Election has been removed from the active directory.'
              : 'Election results have not been published.',
          };
        }
        const histResults = getHistoricalResultsByElectionId(electionId);
        if (histResults) {
          return { success: true, results: histResults };
        }
        return { success: false, error: 'Election not found.' };
      }

      const election = mapDoc<Election>(eSnap.id, eSnap.data());
      if (election.hiddenFromDirectory) {
        return {
          success: false,
          error: 'This election has been archived and detached from the active directory.',
        };
      }
      if (!rSnap.exists()) {
        const histResults = hiddenSet.has(electionId)
          ? undefined
          : getHistoricalResultsByElectionId(electionId);
        if (histResults) {
          return { success: true, results: histResults };
        }
        return {
          success: false,
          error: 'Election results have not been published.',
        };
      }

      const results = mapDoc<ElectionResultsPayload>(rSnap.id, rSnap.data());
      if (
        !results.isPublished &&
        !election.resultsCertified &&
        election.status !== 'results_published' &&
        !(election.status === 'archived' && election.isHistorical)
      ) {
        return {
          success: false,
          error: 'Election results have not been officially certified and published.',
        };
      }

      return { success: true, results };
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        return {
          success: false,
          error: 'Election results have not been published yet.',
        };
      }
      return {
        success: false,
        error: err?.message || 'Unable to retrieve election results.',
      };
    }
  }
}

export const electionClient = new FirebaseElectionClient();
