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
import { auth, db, functions, formatFirestorePermissionError, OperationType } from '../lib/firebase';
import {
  DOMAIN_REGISTRY,
  UCC_DEPARTMENTS,
  UCC_FACULTIES,
  UCC_HALLS,
  categoryToDomainId,
} from '../data/uccStructure';
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
import { convertTimestamp } from './firebaseDbService';

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
  if (criteria.faculties && criteria.faculties.length > 0) {
    checks.facultyMatch = criteria.faculties.some(
      (f) => f.toLowerCase() === student.faculty.toLowerCase()
    );
  }
  if (criteria.departments && criteria.departments.length > 0) {
    checks.departmentMatch = criteria.departments.some(
      (d) => d.toLowerCase() === student.department.toLowerCase()
    );
  }
  if (criteria.levels && criteria.levels.length > 0) {
    checks.levelMatch = criteria.levels.some(
      (l) => l.toLowerCase() === String(student.level).toLowerCase()
    );
  }
  if (criteria.halls && criteria.halls.length > 0) {
    checks.hallMatch = criteria.halls.some(
      (h) => h.toLowerCase() === student.hall.toLowerCase()
    );
  }

  if (election.category === 'GRASAG' && student.level !== 'Postgraduate') {
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
  if (!checks.hallMatch) failedReasons.push(`Restricted to hall: ${criteria.halls?.join(', ')}`);

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
      const [domainsSnap, hallsSnap, facSnap, deptSnap, electionsSnap, posSnap, candSnap] =
        await Promise.all([
          getDocs(collection(db, 'domains')).catch(() => null),
          getDocs(collection(db, 'halls')).catch(() => null),
          getDocs(collection(db, 'faculties')).catch(() => null),
          getDocs(collection(db, 'departments')).catch(() => null),
          getDocs(collection(db, 'elections')),
          getDocs(collection(db, 'positions')),
          getDocs(collection(db, 'candidates')),
        ]);

      const rawDomains: DomainRegistryItem[] =
        domainsSnap && !domainsSnap.empty
          ? domainsSnap.docs.map((d) => mapDoc<DomainRegistryItem>(d.id, d.data()))
          : DOMAIN_REGISTRY;

      const halls: HallUnit[] =
        hallsSnap && !hallsSnap.empty
          ? hallsSnap.docs.map((d) => mapDoc<HallUnit>(d.id, d.data()))
          : UCC_HALLS;

      const faculties: FacultyUnit[] =
        facSnap && !facSnap.empty
          ? facSnap.docs.map((d) => mapDoc<FacultyUnit>(d.id, d.data()))
          : UCC_FACULTIES;

      const departments: DepartmentUnit[] =
        deptSnap && !deptSnap.empty
          ? deptSnap.docs.map((d) => mapDoc<DepartmentUnit>(d.id, d.data()))
          : UCC_DEPARTMENTS;

      const elections = electionsSnap.docs.map((d) => mapDoc<Election>(d.id, d.data()));
      const candidates = candSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()));

      const positionsByElection: Record<string, Position[]> = {};
      posSnap.docs.forEach((d) => {
        const pos = mapDoc<Position>(d.id, d.data());
        if (!pos.electionId) return;
        if (!positionsByElection[pos.electionId]) positionsByElection[pos.electionId] = [];
        positionsByElection[pos.electionId].push(pos);
      });
      Object.values(positionsByElection).forEach((arr) =>
        arr.sort((a, b) => (a.order || 0) - (b.order || 0))
      );

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
    const electionsSnap = await getDocs(collection(db, 'elections'));
    const candidatesSnap = await getDocs(collection(db, 'candidates'));

    let elections = electionsSnap.docs
      .map((d) => mapDoc<Election>(d.id, d.data()))
      .filter((e) => (e.domainId || categoryToDomainId(e.category)) === domainId);

    if (filters?.hallId) elections = elections.filter((e) => e.hallId === filters.hallId);
    if (filters?.facultyId) elections = elections.filter((e) => e.facultyId === filters.facultyId);
    if (filters?.departmentId) {
      elections = elections.filter((e) => e.departmentId === filters.departmentId);
    }
    if (filters?.status) elections = elections.filter((e) => e.status === filters.status);

    const electionIds = new Set(elections.map((e) => e.id));
    const candidates = candidatesSnap.docs
      .map((d) => mapDoc<Candidate>(d.id, d.data()))
      .filter((c) => electionIds.has(c.electionId));

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
      const snap = await getDocs(collection(db, 'elections'));
      let items = snap.docs.map((d) => mapDoc<Election>(d.id, d.data()));
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
      const [eSnap, pSnap] = await Promise.all([
        getDoc(doc(db, 'elections', id)),
        getDocs(query(collection(db, 'positions'), where('electionId', '==', id))),
      ]);
      if (!eSnap.exists()) {
        return { success: false, error: 'Election not found.' };
      }
      const positions = pSnap.docs
        .map((d) => mapDoc<Position>(d.id, d.data()))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      return {
        success: true,
        election: mapDoc<Election>(eSnap.id, eSnap.data()),
        positions,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to fetch election.' };
    }
  }

  async checkEligibility(electionId: string, studentIdOrUid?: string) {
    try {
      const eSnap = await getDoc(doc(db, 'elections', electionId));
      if (!eSnap.exists()) {
        return { success: false, error: 'Election record not found.' };
      }
      const election = mapDoc<Election>(eSnap.id, eSnap.data());

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
      const snap = await getDocs(collection(db, 'candidates'));
      let items = snap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()));
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
      const snap = await getDoc(doc(db, 'candidates', id));
      if (!snap.exists()) return { success: false, error: 'Candidate not found.' };
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
      return { success: false, error: 'You must be signed in to submit a candidate nomination.' };
    }

    const candId = payload.id || `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const status = payload.isDraft ? 'Draft' : payload.applicationStatus || 'Submitted';

    const docPayload = {
      ...payload,
      id: candId,
      submittedByUid: user.uid,
      applicationStatus: status,
      photoUrl: payload.photoUrl || '',
      submittedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'candidates', candId), docPayload);
      return {
        success: true,
        candidate: { ...docPayload, id: candId } as unknown as Candidate,
        message: 'Candidate record saved to Cloud Firestore.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: formatFirestorePermissionError(err, OperationType.CREATE, `candidates/${candId}`),
      };
    }
  }

  async updateCandidate(
    id: string,
    updates: Partial<Candidate> & { resubmit?: boolean }
  ): Promise<{
    success: boolean;
    candidate?: Candidate;
    message?: string;
    error?: string;
  }> {
    try {
      const payload: Record<string, any> = {
        ...updates,
        updatedAt: serverTimestamp(),
      };
      if (updates.resubmit) {
        payload.applicationStatus = 'Submitted';
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
        error: formatFirestorePermissionError(err, OperationType.UPDATE, `candidates/${id}`),
      };
    }
  }

  async getPublishedResults(electionId: string) {
    try {
      const [eSnap, rSnap] = await Promise.all([
        getDoc(doc(db, 'elections', electionId)),
        getDoc(doc(db, 'election_results', electionId)),
      ]);

      if (!eSnap.exists()) {
        return { success: false, error: 'Election not found.' };
      }

      const election = mapDoc<Election>(eSnap.id, eSnap.data());
      if (!rSnap.exists()) {
        return {
          success: false,
          error: 'Election results have not been published.',
        };
      }

      const results = mapDoc<ElectionResultsPayload>(rSnap.id, rSnap.data());
      if (!results.isPublished && !election.resultsCertified && election.status !== 'results_published') {
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
