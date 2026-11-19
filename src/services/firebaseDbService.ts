import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  or,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AdminProfile,
  AnnouncementItem,
  AuditLogItem,
  CalendarEvent,
  Candidate,
  ComplaintTicket,
  ContestantProfile,
  DepartmentUnit,
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionResultsPayload,
  FacultyUnit,
  HallUnit,
  NotificationItem,
  Position,
  StudentProfile,
  VoteConfirmationReceipt,
  VoterEligibilityRecord,
} from '../types';

export function convertTimestamp(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return String(val);
}

function serializeDocData<T>(id: string, data: Record<string, any>): T {
  const result: Record<string, any> = { id };
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp || (v && typeof v?.toDate === 'function')) {
      result[k] = convertTimestamp(v);
    } else if (Array.isArray(v)) {
      result[k] = v.map((item) =>
        item && typeof item === 'object' && !(item instanceof Timestamp) && typeof item?.toDate !== 'function'
          ? item
          : item instanceof Timestamp || typeof item?.toDate === 'function'
          ? convertTimestamp(item)
          : item
      );
    } else {
      result[k] = v;
    }
  }
  return result as T;
}

// ============================================================================
// REAL-TIME ONSNAPSHOT SUBSCRIPTIONS
// ============================================================================

export function subscribeElections(
  onData: (elections: Election[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'elections'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => serializeDocData<Election>(d.id, d.data()))
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
      onData(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribePositions(
  onData: (positionsByElection: Record<string, Position[]>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'positions'));
  return onSnapshot(
    q,
    (snap) => {
      const grouped: Record<string, Position[]> = {};
      snap.docs.forEach((d) => {
        const pos = serializeDocData<Position>(d.id, d.data());
        if (!pos.electionId) return;
        if (!grouped[pos.electionId]) grouped[pos.electionId] = [];
        grouped[pos.electionId].push(pos);
      });
      Object.keys(grouped).forEach((eId) => {
        grouped[eId].sort((a, b) => (a.order || 0) - (b.order || 0));
      });
      onData(grouped);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeCandidates(
  onData: (candidates: Candidate[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'candidates'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => serializeDocData<Candidate>(d.id, d.data()));
      onData(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeContestants(
  isAdminUser: boolean,
  onData: (contestants: ContestantProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isAdminUser) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'contestants'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => serializeDocData<ContestantProfile>(d.id, d.data()));
      onData(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeAnnouncements(
  onData: (announcements: AnnouncementItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'announcements'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => serializeDocData<AnnouncementItem>(d.id, d.data()))
        .filter((a) => a.active !== false)
        .sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
          return (b.publishedAt || '').localeCompare(a.publishedAt || '');
        });
      onData(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeCalendarEvents(
  onData: (events: CalendarEvent[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'calendar_events'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => serializeDocData<CalendarEvent>(d.id, d.data()))
        .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      onData(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeNotifications(
  uid: string | undefined,
  onData: (notifications: NotificationItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'notifications'),
    or(where('targetUid', '==', null), where('targetUid', '==', uid))
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => serializeDocData<NotificationItem>(d.id, d.data()))
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      onData(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeNotificationReads(
  uid: string | undefined,
  onData: (readIds: Set<string>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!uid) {
    onData(new Set());
    return () => {};
  }
  const q = query(collection(db, 'notification_reads'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const ids = new Set<string>();
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.notificationId) ids.add(String(data.notificationId));
      });
      onData(ids);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeStudentProfile(
  uid: string,
  onData: (student: StudentProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'students', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(serializeDocData<StudentProfile>(snap.id, snap.data()));
    },
    (err) => onError?.(err)
  );
}

export function subscribeVoterEligibility(
  uid: string,
  onData: (record: VoterEligibilityRecord | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'voter_eligibility', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(serializeDocData<VoterEligibilityRecord>(snap.id, snap.data()));
    },
    (err) => onError?.(err)
  );
}

export function subscribeAdminProfile(
  uid: string,
  onData: (admin: AdminProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'admins', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(serializeDocData<AdminProfile>(snap.id, snap.data()));
    },
    (err) => onError?.(err)
  );
}

export function subscribeVoteConfirmations(
  uid: string | undefined,
  onData: (receipts: VoteConfirmationReceipt[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'vote_confirmations'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => serializeDocData<VoteConfirmationReceipt>(d.id, d.data()))
        .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      onData(items);
    },
    (err) => onError?.(err)
  );
}

export function subscribeComplaints(
  uid: string | undefined,
  isAdminUser: boolean,
  onData: (complaints: ComplaintTicket[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = isAdminUser
    ? query(collection(db, 'complaints'))
    : query(collection(db, 'complaints'), where('uid', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => serializeDocData<ComplaintTicket>(d.id, d.data()))
        .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      onData(items);
    },
    (err) => onError?.(err)
  );
}

export function subscribeAllStudents(
  isAdminUser: boolean,
  onData: (students: StudentProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isAdminUser) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'students')),
    (snap) => {
      onData(snap.docs.map((d) => serializeDocData<StudentProfile>(d.id, d.data())));
    },
    (err) => onError?.(err)
  );
}

export function subscribeAllEligibilityRecords(
  isAdminUser: boolean,
  onData: (records: VoterEligibilityRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isAdminUser) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'voter_eligibility')),
    (snap) => {
      onData(snap.docs.map((d) => serializeDocData<VoterEligibilityRecord>(d.id, d.data())));
    },
    (err) => onError?.(err)
  );
}

export function subscribeAuditLogs(
  isAdminUser: boolean,
  onData: (logs: AuditLogItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isAdminUser) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => serializeDocData<AuditLogItem>(d.id, d.data())));
    },
    (err) => onError?.(err)
  );
}

export function subscribeDomains(
  onData: (domains: DomainRegistryItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'domains')),
    (snap) => {
      const items = snap.docs
        .map((d) => serializeDocData<DomainRegistryItem>(d.id, d.data()))
        .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
      onData(items);
    },
    (err) => onError?.(err)
  );
}

export function subscribeStructuralCollection<T>(
  collectionName: 'halls' | 'faculties' | 'departments',
  onData: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, collectionName)),
    (snap) => {
      onData(snap.docs.map((d) => serializeDocData<T>(d.id, d.data())));
    },
    (err) => onError?.(err)
  );
}

// ============================================================================
// MUTATION HELPERS
// ============================================================================

export async function markNotificationAsRead(uid: string, notificationId: string): Promise<void> {
  const docId = `${uid}_${notificationId}`;
  try {
    await setDoc(doc(db, 'notification_reads', docId), {
      uid,
      notificationId,
      readAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notification_reads/${docId}`);
  }
}

export async function markAllNotificationsAsRead(
  uid: string,
  notificationIds: string[]
): Promise<void> {
  await Promise.all(notificationIds.map((nid) => markNotificationAsRead(uid, nid)));
}

export async function createComplaintTicket(payload: {
  uid: string;
  studentName: string;
  studentId: string;
  studentEmail?: string;
  domainId?: DomainId;
  category: 'technical' | 'eligibility' | 'irregularity' | 'general';
  subject: string;
  description: string;
  attachmentUrl?: string;
}): Promise<ComplaintTicket> {
  const ticketNumber = `UCC-TKT-${Date.now().toString().slice(-6)}`;
  const nowIso = new Date().toISOString();
  const docData = {
    uid: payload.uid,
    ticketNumber,
    studentName: payload.studentName,
    studentId: payload.studentId,
    studentEmail: payload.studentEmail || '',
    domainId: payload.domainId || null,
    category: payload.category,
    subject: payload.subject.trim(),
    description: payload.description.trim(),
    attachmentUrl: payload.attachmentUrl || null,
    status: 'pending' as const,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = await addDoc(collection(db, 'complaints'), docData);
    return {
      id: ref.id,
      uid: payload.uid,
      ticketNumber,
      studentName: payload.studentName,
      studentId: payload.studentId,
      studentEmail: payload.studentEmail,
      domainId: payload.domainId,
      category: payload.category,
      subject: payload.subject.trim(),
      description: payload.description.trim(),
      attachmentUrl: payload.attachmentUrl,
      status: 'pending',
      submittedAt: nowIso,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'complaints');
  }
}

export async function updateComplaintTicket(
  complaintId: string,
  updates: {
    status: 'pending' | 'in_review' | 'resolved';
    response?: string;
    resolvedBy?: string;
  }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'complaints', complaintId), {
      status: updates.status,
      response: updates.response ?? '',
      resolvedBy: updates.resolvedBy ?? '',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `complaints/${complaintId}`);
  }
}

export async function createAnnouncement(payload: {
  title: string;
  message: string;
  category: 'general' | 'election' | 'deadline' | 'results' | 'security';
  domainId?: DomainId;
  publishedBy: string;
  pinned?: boolean;
}): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'announcements'), {
      title: payload.title.trim(),
      message: payload.message.trim(),
      category: payload.category,
      domainId: payload.domainId || null,
      publishedBy: payload.publishedBy,
      pinned: Boolean(payload.pinned),
      active: true,
      publishedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'announcements');
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'announcements', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
  }
}

export async function createNotification(payload: {
  title: string;
  message: string;
  category: 'election' | 'security' | 'deadline' | 'results';
  domainId?: DomainId;
  targetUid?: string | null;
  linkAction?: string;
}): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'notifications'), {
      title: payload.title.trim(),
      message: payload.message.trim(),
      category: payload.category,
      domainId: payload.domainId || null,
      targetUid: payload.targetUid || null,
      linkAction: payload.linkAction || null,
      timestamp: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'notifications');
  }
}

export async function createCalendarEvent(payload: Omit<CalendarEvent, 'id'>): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'calendar_events'), payload);
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'calendar_events');
  }
}

export async function writeAuditLog(payload: {
  adminName: string;
  adminRole: string;
  action: string;
  target: string;
  status?: 'success' | 'flagged' | 'warning';
}): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      adminName: payload.adminName,
      adminRole: payload.adminRole,
      action: payload.action,
      target: payload.target,
      ipAddress: 'firebase-client',
      status: payload.status || 'success',
      timestamp: serverTimestamp(),
    });
  } catch {
    // Do not block primary admin workflow if audit write fails
  }
}

export async function updateStudentEligibilityAndStatus(
  uid: string,
  payload: {
    isEligible: boolean;
    eligibilityStatus: 'eligible' | 'pending_verification' | 'suspended' | 'ineligible';
    status: 'active' | 'suspended';
    reason?: string;
    verifiedBy: string;
  }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'students', uid), {
      isEligible: payload.isEligible,
      eligibilityStatus: payload.eligibilityStatus,
      eligibilityNotes: payload.reason || '',
      status: payload.status,
      updatedAt: serverTimestamp(),
    });
    const studSnap = await getDoc(doc(db, 'students', uid));
    const stud = studSnap.exists() ? (studSnap.data() as StudentProfile) : null;
    await setDoc(
      doc(db, 'voter_eligibility', uid),
      {
        uid,
        studentId: stud?.studentId || '',
        fullName: stud?.fullName || '',
        email: stud?.email || '',
        faculty: stud?.faculty || '',
        department: stud?.department || '',
        programme: stud?.programme || '',
        level: stud?.level || '',
        hall: stud?.hall || '',
        isEligible: payload.isEligible,
        status: payload.eligibilityStatus,
        reason: payload.reason || '',
        verifiedBy: payload.verifiedBy,
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `students/${uid}`);
  }
}

export async function getPublishedElectionResultsDoc(
  electionId: string
): Promise<ElectionResultsPayload | null> {
  try {
    const snap = await getDoc(doc(db, 'election_results', electionId));
    if (!snap.exists()) return null;
    return serializeDocData<ElectionResultsPayload>(snap.id, snap.data());
  } catch (err: any) {
    if (err?.code === 'permission-denied') return null;
    handleFirestoreError(err, OperationType.GET, `election_results/${electionId}`);
  }
}

export async function getAdminsList(): Promise<AdminProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => serializeDocData<AdminProfile>(d.id, d.data()));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admins');
  }
}
