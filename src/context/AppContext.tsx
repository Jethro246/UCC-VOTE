import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, FIRESTORE_DATABASE_ID, testFirestoreConnection } from '../lib/firebase';
import {
  ActiveView,
  UserRole,
  StudentProfile,
  AdminProfile,
  AdminRoleType,
  Election,
  ElectionCategory,
  ElectionStatus,
  Position,
  Candidate,
  NotificationItem,
  AnnouncementItem,
  CalendarEvent,
  ComplaintTicket,
  AuditLogItem,
  BallotSelectionMap,
  VoteConfirmationReceipt,
  VoterEligibilityRecord,
  DomainId,
  DomainRegistryItem,
  HallUnit,
  FacultyUnit,
  DepartmentUnit,
} from '../types';
import {
  DOMAIN_REGISTRY,
  UCC_DEPARTMENTS,
  UCC_FACULTIES,
  UCC_HALLS,
  categoryToDomainId,
  getPermissionsForRole,
} from '../data/uccStructure';
import { authClient } from '../services/authClient';
import { electionClient } from '../services/electionClient';
import { votingService } from '../services/votingService';
import { adminService } from '../services/adminService';
import { DomainWithStats } from '../services/interfaces';
import {
  isIncomingEmailSignInLink,
  completeEmailSignInLink,
  completeGoogleRedirectResult,
} from '../services/firebaseAuthService';
import {
  subscribeElections,
  subscribePositions,
  subscribeCandidates,
  subscribeAnnouncements,
  subscribeCalendarEvents,
  subscribeNotifications,
  subscribeNotificationReads,
  subscribeStudentProfile,
  subscribeVoterEligibility,
  subscribeAdminProfile,
  subscribeVoteConfirmations,
  subscribeComplaints,
  subscribeAllStudents,
  subscribeAllEligibilityRecords,
  subscribeAuditLogs,
  subscribeDomains,
  subscribeStructuralCollection,
  markNotificationAsRead as markNotificationReadDb,
  markAllNotificationsAsRead as markAllNotificationsReadDb,
  createComplaintTicket,
} from '../services/firebaseDbService';

const ACTIVE_VIEW_STORAGE_KEY = 'ucc_vote_active_view';
const SELECTED_ELECTION_STORAGE_KEY = 'ucc_vote_selected_election';
const SELECTED_DOMAIN_STORAGE_KEY = 'ucc_vote_selected_domain';

const VALID_VIEWS: ReadonlySet<ActiveView> = new Set<ActiveView>([
  'landing',
  'student_login',
  'student_register',
  'forgot_password',
  'admin_login',
  'student_dashboard',
  'elections_directory',
  'domain_elections',
  'election_details',
  'candidate_directory',
  'candidate_profile',
  'digital_ballot',
  'election_results',
  'notifications',
  'election_calendar',
  'student_profile',
  'help_support',
  'admin_dashboard',
]);

function parseRouteFromHashOrStorage(): {
  view: ActiveView;
  electionId: string;
  domainId: DomainId;
} {
  let view: ActiveView = 'landing';
  let electionId = '';
  let domainId: DomainId = 'src';

  try {
    const storedElection = sessionStorage.getItem(SELECTED_ELECTION_STORAGE_KEY);
    if (storedElection) electionId = storedElection;

    const storedDomain = sessionStorage.getItem(SELECTED_DOMAIN_STORAGE_KEY);
    if (storedDomain) domainId = storedDomain as DomainId;

    const storedView = sessionStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) as ActiveView | null;
    if (storedView && VALID_VIEWS.has(storedView)) {
      view = storedView;
    }

    const rawHash = window.location.hash.replace(/^#/, '').trim();
    if (rawHash) {
      const [hashView, queryPart] = rawHash.split('?');
      if (hashView && VALID_VIEWS.has(hashView as ActiveView)) {
        view = hashView as ActiveView;
      }
      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        const hashElection = params.get('electionId');
        if (hashElection) electionId = hashElection;
        const hashDomain = params.get('domain');
        if (hashDomain) domainId = hashDomain as DomainId;
      }
    }
  } catch {
    // Ignore storage/hash errors
  }

  return { view, electionId, domainId };
}

function syncRouteToHashAndStorage(view: ActiveView, electionId?: string, domainId?: DomainId) {
  try {
    sessionStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, view);
    if (electionId) sessionStorage.setItem(SELECTED_ELECTION_STORAGE_KEY, electionId);
    if (domainId) sessionStorage.setItem(SELECTED_DOMAIN_STORAGE_KEY, domainId);

    let targetHash = `#${view}`;
    if (view === 'digital_ballot' && electionId) {
      targetHash = `#${view}?electionId=${encodeURIComponent(electionId)}`;
    } else if (view === 'domain_elections' && domainId) {
      targetHash = `#${view}?domain=${encodeURIComponent(domainId)}`;
    }
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  } catch {
    // Ignore
  }
}

interface AppContextType {
  activeView: ActiveView;
  userRole: UserRole;
  firebaseUser: User | null;
  student: StudentProfile | null;
  voterEligibilityRecord: VoterEligibilityRecord | null;
  admin: AdminProfile | null;
  selectedElectionId: string;
  selectedDomainId: DomainId;
  selectedCandidateId: string;
  compareCandidateIds: [string, string] | null;
  ballotSelections: BallotSelectionMap;
  elections: Election[];
  domains: DomainWithStats[];
  halls: HallUnit[];
  faculties: FacultyUnit[];
  departments: DepartmentUnit[];
  positionsByElection: Record<string, Position[]>;
  candidates: Candidate[];
  myCandidateApplication: Candidate | null;
  notifications: NotificationItem[];
  announcements: AnnouncementItem[];
  calendarEvents: CalendarEvent[];
  complaints: ComplaintTicket[];
  voteConfirmations: VoteConfirmationReceipt[];
  allStudents: StudentProfile[];
  eligibilityRecords: VoterEligibilityRecord[];
  auditLogs: AuditLogItem[];
  categoryFilter: ElectionCategory | 'All';
  statusFilter: ElectionStatus | 'All';
  searchQuery: string;
  recentVoteReceipt: VoteConfirmationReceipt | null;
  sessionChecked: boolean;
  isLoadingData: boolean;
  dataError: string | null;
  sessionExpiredReason: string | null;
  postLoginView: ActiveView | null;
  pendingEmailPrompt: boolean;
  emailLinkFeedback: { type: 'info' | 'success' | 'error'; text: string } | null;
  needsProfileCompletion: boolean;

  navigateTo: (
    view: ActiveView,
    params?: { electionId?: string; candidateId?: string; domainId?: DomainId; positionId?: string }
  ) => void;
  setSelectedDomainId: (id: DomainId) => void;
  setPostLoginView: (view: ActiveView | null) => void;
  clearSessionExpiredReason: () => void;
  clearEmailLinkFeedback: () => void;
  submitEmailLinkPrompt: (email: string) => Promise<{ success: boolean; error?: string }>;
  dismissEmailLinkPrompt: () => void;
  refreshAuthSession: () => Promise<boolean>;
  refreshDomains: () => Promise<void>;
  refreshElections: () => Promise<void>;
  refreshCandidates: () => Promise<void>;
  createElectionAction: (payload: any) => Promise<{ success: boolean; election?: Election; error?: string }>;
  updateElectionStatusAction: (
    id: string,
    newStatus: ElectionStatus,
    justification?: string
  ) => Promise<{ success: boolean; election?: Election; error?: string }>;
  registerCandidateAction: (
    payload: any
  ) => Promise<{ success: boolean; candidate?: Candidate; error?: string; message?: string }>;
  updateCandidateAction: (
    id: string,
    updates: any
  ) => Promise<{ success: boolean; candidate?: Candidate; error?: string; message?: string }>;
  approveCandidateAction: (
    id: string
  ) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  rejectCandidateAction: (
    id: string,
    reason: string
  ) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  requestCandidateCorrectionsAction: (
    id: string,
    notes: string
  ) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  withdrawCandidateAction: (
    id: string,
    reason?: string
  ) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  assignCandidatePositionAction: (
    id: string,
    electionId: string,
    positionId: string
  ) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  verifyCandidateEligibilityAction: (
    id: string
  ) => Promise<{ success: boolean; isEligible?: boolean; reason?: string; details?: any; error?: string }>;
  loginWithUserPayload: (user: any, role: 'student' | 'admin') => void;
  logout: () => Promise<void>;
  updateStudentProfile: (updates: Partial<StudentProfile>) => Promise<boolean>;
  setCategoryFilter: (cat: ElectionCategory | 'All') => void;
  setStatusFilter: (status: ElectionStatus | 'All') => void;
  setSearchQuery: (query: string) => void;
  setSelectedElectionId: (id: string) => void;
  setSelectedCandidateId: (id: string) => void;
  setBallotSelection: (positionId: string, candidateId: string, maxSelections?: number) => void;
  clearPositionSelection: (positionId: string) => void;
  resetBallot: () => void;
  submitBallotAction: (
    electionId: string,
    selectionsOverride?: BallotSelectionMap,
    idempotencyKey?: string
  ) => Promise<{
    success: boolean;
    code?: string;
    message?: string;
    error?: string;
    receipt?: VoteConfirmationReceipt;
  }>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  submitComplaint: (data: {
    category: ComplaintTicket['category'];
    subject: string;
    description: string;
    domainId?: DomainId;
    attachmentUrl?: string;
  }) => Promise<{ success: boolean; ticketNumber?: string; error?: string }>;
  toggleCompareCandidate: (candidateId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initialRoute = parseRouteFromHashOrStorage();

  const [activeView, setActiveView] = useState<ActiveView>(initialRoute.view);
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [studentRaw, setStudentRaw] = useState<StudentProfile | null>(null);
  const [voterEligibilityRecord, setVoterEligibilityRecord] =
    useState<VoterEligibilityRecord | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const [postLoginView, setPostLoginView] = useState<ActiveView | null>(null);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  const [pendingEmailPrompt, setPendingEmailPrompt] = useState(false);
  const [emailLinkFeedback, setEmailLinkFeedback] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  const [selectedElectionId, setSelectedElectionIdState] = useState<string>(initialRoute.electionId);
  const [selectedDomainId, setSelectedDomainIdState] = useState<DomainId>(initialRoute.domainId);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [compareCandidateIds, setCompareCandidateIds] = useState<[string, string] | null>(null);
  const [ballotSelections, setBallotSelections] = useState<BallotSelectionMap>({});

  const [elections, setElections] = useState<Election[]>([]);
  const [rawDomains, setRawDomains] = useState<DomainRegistryItem[]>(DOMAIN_REGISTRY);
  const [halls, setHalls] = useState<HallUnit[]>(UCC_HALLS);
  const [faculties, setFaculties] = useState<FacultyUnit[]>(UCC_FACULTIES);
  const [departments, setDepartments] = useState<DepartmentUnit[]>(UCC_DEPARTMENTS);
  const [positionsByElection, setPositionsByElection] = useState<Record<string, Position[]>>({});
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [rawNotifications, setRawNotifications] = useState<NotificationItem[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [complaints, setComplaints] = useState<ComplaintTicket[]>([]);
  const [voteConfirmations, setVoteConfirmations] = useState<VoteConfirmationReceipt[]>([]);
  const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
  const [eligibilityRecords, setEligibilityRecords] = useState<VoterEligibilityRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<ElectionCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<ElectionStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentVoteReceipt, setRecentVoteReceipt] = useState<VoteConfirmationReceipt | null>(null);

  // Merge voter_eligibility and vote_confirmations cleanly onto student state
  const student: StudentProfile | null = useMemo(() => {
    if (!studentRaw) return null;
    const votedFromReceipts = voteConfirmations.map((r) => r.electionId);
    const mergedVoted = Array.from(
      new Set([...(studentRaw.hasVotedElections || []), ...votedFromReceipts])
    );

    const effectiveEligible =
      voterEligibilityRecord !== null
        ? voterEligibilityRecord.isEligible === true && voterEligibilityRecord.status === 'eligible'
        : Boolean(studentRaw.isEligible) &&
          studentRaw.status !== 'suspended' &&
          studentRaw.eligibilityStatus === 'eligible';

    const effectiveEligibilityStatus =
      voterEligibilityRecord?.status ||
      studentRaw.eligibilityStatus ||
      (effectiveEligible ? 'eligible' : 'pending_verification');

    return {
      ...studentRaw,
      emailVerified: firebaseUser?.emailVerified ?? studentRaw.emailVerified,
      photoUrl: studentRaw.photoUrl || studentRaw.avatarUrl || firebaseUser?.photoURL || '',
      avatarUrl: studentRaw.avatarUrl || studentRaw.photoUrl || firebaseUser?.photoURL || '',
      isEligible: effectiveEligible,
      eligibilityStatus: effectiveEligibilityStatus,
      eligibilityNotes: voterEligibilityRecord?.reason || studentRaw.eligibilityNotes,
      hasVotedElections: mergedVoted,
    };
  }, [studentRaw, voterEligibilityRecord, voteConfirmations, firebaseUser]);

  // Compute live DomainWithStats dynamically from Firestore elections & candidates
  const domains: DomainWithStats[] = useMemo(() => {
    return [...rawDomains]
      .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99))
      .map((dom) => {
        const domElections = elections.filter(
          (e) => (e.domainId || categoryToDomainId(e.category)) === dom.id
        );
        const approvedCandCount = candidates.filter(
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
            approvedCandidatesCount: approvedCandCount,
          },
        };
      });
  }, [rawDomains, elections, candidates]);

  // Merge user-specific read states onto notifications
  const notifications: NotificationItem[] = useMemo(() => {
    return rawNotifications.map((n) => ({
      ...n,
      read: Boolean(n.read) || readNotificationIds.has(n.id),
    }));
  }, [rawNotifications, readNotificationIds]);

  const setSelectedElectionId = (id: string) => {
    setSelectedElectionIdState(id);
    try {
      sessionStorage.setItem(SELECTED_ELECTION_STORAGE_KEY, id);
    } catch {
      // Ignore
    }
  };

  const setSelectedDomainId = (id: DomainId) => {
    setSelectedDomainIdState(id);
    try {
      sessionStorage.setItem(SELECTED_DOMAIN_STORAGE_KEY, id);
    } catch {
      // Ignore
    }
  };

  // Auto-select first real election / candidates if current selection is empty
  useEffect(() => {
    if (elections.length > 0 && !elections.some((e) => e.id === selectedElectionId)) {
      const preferred = elections.find((e) => e.status === 'live') || elections[0];
      setSelectedElectionIdState(preferred.id);
    } else if (elections.length === 0 && selectedElectionId) {
      setSelectedElectionIdState('');
    }
  }, [elections, selectedElectionId]);

  useEffect(() => {
    if (candidates.length > 0 && !candidates.some((c) => c.id === selectedCandidateId)) {
      setSelectedCandidateId(candidates[0].id);
    }
  }, [candidates, selectedCandidateId]);

  // Initial Firestore connectivity verification + public real-time listeners
  useEffect(() => {
    let active = true;
    testFirestoreConnection().then((res) => {
      if (!active) return;
      if (res.databaseMissing) {
        setDataError(
          res.error ||
            `Cloud Firestore database "${FIRESTORE_DATABASE_ID}" could not be located in Firebase project "ucc-vote".`
        );
        setIsLoadingData(false);
      } else if (res.rulesLocked) {
        setDataError(
          res.error ||
            `Connected to Firestore database "${FIRESTORE_DATABASE_ID}", but security rules currently block access. Publish firestore.rules to this database in Firebase Console.`
        );
        setIsLoadingData(false);
      } else if (res.offline) {
        setDataError(
          'Unable to reach Cloud Firestore. Check your internet connection or Firebase project configuration.'
        );
        setIsLoadingData(false);
      } else {
        setDataError(null);
      }
    });

    const handleErr = (err: Error) => {
      if (!active) return;
      console.warn('Firestore subscription notice:', err.message);
      setIsLoadingData(false);
    };

    const unsubElections = subscribeElections((items) => {
      setElections(items);
      setIsLoadingData(false);
      setDataError(null);
    }, handleErr);

    const unsubPositions = subscribePositions((grouped) => {
      setPositionsByElection(grouped);
    }, handleErr);

    const unsubCandidates = subscribeCandidates((items) => {
      setCandidates(items);
    }, handleErr);

    const unsubAnnouncements = subscribeAnnouncements((items) => {
      setAnnouncements(items);
    }, handleErr);

    const unsubCalendar = subscribeCalendarEvents((items) => {
      setCalendarEvents(items);
    }, handleErr);

    const unsubDomains = subscribeDomains((items) => {
      if (items.length > 0) setRawDomains(items);
    }, () => {});

    const unsubHalls = subscribeStructuralCollection<HallUnit>('halls', (items) => {
      if (items.length > 0) setHalls(items);
    }, () => {});

    const unsubFaculties = subscribeStructuralCollection<FacultyUnit>('faculties', (items) => {
      if (items.length > 0) setFaculties(items);
    }, () => {});

    const unsubDepartments = subscribeStructuralCollection<DepartmentUnit>(
      'departments',
      (items) => {
        if (items.length > 0) setDepartments(items);
      },
      () => {}
    );

    return () => {
      active = false;
      unsubElections();
      unsubPositions();
      unsubCandidates();
      unsubAnnouncements();
      unsubCalendar();
      unsubDomains();
      unsubHalls();
      unsubFaculties();
      unsubDepartments();
    };
  }, []);

  // Handle incoming Firebase Email-Link authentication on initial mount
  useEffect(() => {
    if (!isIncomingEmailSignInLink(window.location.href)) {
      return;
    }

    let active = true;
    setEmailLinkFeedback({
      type: 'info',
      text: 'Verifying your Firebase email sign-in link...',
    });

    completeEmailSignInLink(undefined, window.location.href).then((res) => {
      if (!active) return;
      if (res.needsEmailPrompt) {
        setPendingEmailPrompt(true);
        setEmailLinkFeedback({
          type: 'info',
          text: 'To complete verification on this device/browser, please confirm the email address you used.',
        });
        return;
      }

      if (!res.success) {
        setEmailLinkFeedback({
          type: 'error',
          text: res.error || 'Email sign-in link could not be verified.',
        });
        return;
      }

      if (res.isAdmin && res.admin) {
        setAdmin(res.admin);
        setUserRole('admin');
        setStudentRaw(null);
        setNeedsProfileCompletion(false);
        setEmailLinkFeedback({
          type: 'success',
          text: 'Electoral Commission administrator sign-in verified.',
        });
        navigateTo('admin_dashboard');
        return;
      }

      if (res.needsProfileActivation) {
        setNeedsProfileCompletion(true);
        setEmailLinkFeedback({
          type: 'info',
          text: `Email (${res.email}) verified. Complete your UCC student details below to finish activating your profile.`,
        });
        navigateTo('student_register');
        return;
      }

      setNeedsProfileCompletion(false);
      setEmailLinkFeedback({
        type: 'success',
        text: 'Email verified and signed in to UCC VOTE.',
      });
      navigateTo('student_dashboard');
    });

    return () => {
      active = false;
    };
  }, []);

  // Handle Google signInWithRedirect return flow if popup fallback triggered a redirect
  useEffect(() => {
    if (isIncomingEmailSignInLink(window.location.href)) {
      return;
    }

    let active = true;
    completeGoogleRedirectResult().then((res) => {
      if (!active || !res.hasResult) return;

      if (!res.success) {
        setEmailLinkFeedback({
          type: 'error',
          text: res.error || 'Unable to sign in. Please try again.',
        });
        return;
      }

      if (res.isAdmin && res.admin) {
        setAdmin(res.admin);
        setUserRole('admin');
        setStudentRaw(null);
        setNeedsProfileCompletion(false);
        setSessionChecked(true);
        setEmailLinkFeedback({
          type: 'success',
          text: 'Electoral Commission administrator Google sign-in verified.',
        });
        setPostLoginView(null);
        navigateTo('admin_dashboard');
        return;
      }

      if (res.student) {
        setStudentRaw(res.student);
        setUserRole('student');
        setAdmin(null);
        setNeedsProfileCompletion(false);
        setSessionChecked(true);
      }

      setEmailLinkFeedback({
        type: 'success',
        text: res.isNewUser
          ? 'Google sign-in successful — your UCC VOTE student profile has been created.'
          : 'Google sign-in successful',
      });

      const targetView =
        postLoginView && postLoginView !== 'admin_dashboard'
          ? postLoginView
          : 'student_dashboard';
      setPostLoginView(null);
      navigateTo(targetView);
    });

    return () => {
      active = false;
    };
  }, []);

  // Firebase Auth state listener & scoped private Firestore listeners
  useEffect(() => {
    let privateUnsubs: Array<() => void> = [];
    const cleanupPrivate = () => {
      privateUnsubs.forEach((u) => {
        try {
          u();
        } catch {
          // ignore
        }
      });
      privateUnsubs = [];
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      cleanupPrivate();
      setFirebaseUser(user);

      if (!user) {
        setUserRole('guest');
        setStudentRaw(null);
        setVoterEligibilityRecord(null);
        setAdmin(null);
        setRawNotifications([]);
        setReadNotificationIds(new Set());
        setComplaints([]);
        setVoteConfirmations([]);
        setAllStudents([]);
        setEligibilityRecords([]);
        setAuditLogs([]);
        setNeedsProfileCompletion(false);
        setSessionChecked(true);
        return;
      }

      try {
        const tokenRes = await user.getIdTokenResult(true).catch(() => user.getIdTokenResult());
        const hasAdminClaim = tokenRes.claims?.admin === true;
        const adminSnap = hasAdminClaim
          ? await getDoc(doc(db, 'admins', user.uid)).catch(() => null)
          : null;
        const adminData = adminSnap?.exists() ? (adminSnap.data() as Omit<AdminProfile, 'id'>) : null;
        const isExplicitlyDeactivated = Boolean(adminData && adminData.isActive === false);

        if (hasAdminClaim && isExplicitlyDeactivated) {
          await signOut(auth).catch(() => undefined);
          setSessionExpiredReason('This administrator account has been deactivated.');
          setSessionChecked(true);
          return;
        }

        const isAdminUser = Boolean(hasAdminClaim) && !isExplicitlyDeactivated;

        if (isAdminUser) {
          setUserRole('admin');
          setStudentRaw(null);
          setVoterEligibilityRecord(null);
          setNeedsProfileCompletion(false);

          const resolvedRole = ((adminData?.role ||
            tokenRes.claims?.role ||
            'Electoral Commissioner') as AdminRoleType);

          if (adminData && adminSnap) {
            setAdmin({
              ...adminData,
              id: adminSnap.id,
              uid: user.uid,
              role: resolvedRole,
              permissions:
                Array.isArray(adminData.permissions) && adminData.permissions.length > 0
                  ? adminData.permissions
                  : getPermissionsForRole(resolvedRole),
            });
          } else {
            setAdmin({
              id: user.uid,
              uid: user.uid,
              staffId: (tokenRes.claims?.staffId as string) || `UCC/EC/${user.uid.slice(0, 6).toUpperCase()}`,
              fullName: user.displayName || user.email || 'Electoral Administrator',
              email: (user.email || '').toLowerCase(),
              role: resolvedRole,
              department: 'UCC Electoral Commission',
              permissions: getPermissionsForRole(resolvedRole),
              isActive: true,
            });
          }

          privateUnsubs.push(
            subscribeAdminProfile(user.uid, (a) => {
              if (a) {
                if (a.isActive === false) {
                  signOut(auth).catch(() => undefined);
                  return;
                }
                setAdmin(a);
              }
            }),
            subscribeAllStudents(true, setAllStudents),
            subscribeAllEligibilityRecords(true, setEligibilityRecords),
            subscribeComplaints(user.uid, true, setComplaints),
            subscribeAuditLogs(true, setAuditLogs),
            subscribeNotifications(user.uid, setRawNotifications),
            subscribeNotificationReads(user.uid, setReadNotificationIds)
          );
          setSessionChecked(true);
          return;
        }

        // Student or newly email-verified account
        privateUnsubs.push(
          subscribeStudentProfile(user.uid, (stud) => {
            if (stud) {
              setStudentRaw(stud);
              setUserRole('student');
              setAdmin(null);
              setNeedsProfileCompletion(false);
            } else {
              setStudentRaw(null);
              setNeedsProfileCompletion(true);
            }
          }),
          subscribeVoterEligibility(user.uid, setVoterEligibilityRecord),
          subscribeVoteConfirmations(user.uid, setVoteConfirmations),
          subscribeComplaints(user.uid, false, setComplaints),
          subscribeNotifications(user.uid, setRawNotifications),
          subscribeNotificationReads(user.uid, setReadNotificationIds)
        );
        setSessionChecked(true);
      } catch (err) {
        console.error('Auth listener resolution error:', err);
        setSessionChecked(true);
      }
    });

    return () => {
      cleanupPrivate();
      unsubAuth();
    };
  }, []);

  // Hash navigation listener
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseRouteFromHashOrStorage();
      setActiveView(parsed.view);
      if (parsed.electionId) setSelectedElectionIdState(parsed.electionId);
      if (parsed.domainId) setSelectedDomainIdState(parsed.domainId);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const submitEmailLinkPrompt = async (email: string) => {
    const res = await completeEmailSignInLink(email, window.location.href);
    if (!res.success) {
      return { success: false, error: res.error || 'Could not verify email link.' };
    }
    setPendingEmailPrompt(false);
    if (res.isAdmin && res.admin) {
      setAdmin(res.admin);
      setUserRole('admin');
      setStudentRaw(null);
      setNeedsProfileCompletion(false);
      setEmailLinkFeedback({
        type: 'success',
        text: 'Electoral Commission administrator sign-in verified.',
      });
      navigateTo('admin_dashboard');
    } else if (res.needsProfileActivation) {
      setNeedsProfileCompletion(true);
      setEmailLinkFeedback({
        type: 'info',
        text: `Email (${res.email}) verified. Complete your UCC student details to finish activation.`,
      });
      navigateTo('student_register');
    } else {
      setEmailLinkFeedback({
        type: 'success',
        text: 'Email verified and signed in to UCC VOTE.',
      });
      navigateTo('student_dashboard');
    }
    return { success: true };
  };

  const dismissEmailLinkPrompt = () => {
    setPendingEmailPrompt(false);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const refreshDomains = async () => {
    const res = await electionClient.getDomains();
    if (res.success) {
      if (res.halls?.length) setHalls(res.halls);
      if (res.faculties?.length) setFaculties(res.faculties);
      if (res.departments?.length) setDepartments(res.departments);
    }
  };

  const refreshElections = async () => {
    const res = await electionClient.getElections();
    if (res.success) {
      setElections(res.elections);
    }
  };

  const refreshCandidates = async () => {
    const res = await electionClient.getCandidates();
    if (res.success) {
      setCandidates(res.candidates);
    }
  };

  const refreshAuthSession = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    return true;
  };

  const clearSessionExpiredReason = () => setSessionExpiredReason(null);
  const clearEmailLinkFeedback = () => setEmailLinkFeedback(null);

  const navigateTo = (
    view: ActiveView,
    params?: { electionId?: string; candidateId?: string; domainId?: DomainId; positionId?: string }
  ) => {
    const nextElectionId = params?.electionId || selectedElectionId;
    const nextDomainId = params?.domainId || selectedDomainId;
    if (params?.electionId) setSelectedElectionId(params.electionId);
    if (params?.domainId) setSelectedDomainId(params.domainId);
    if (params?.candidateId) setSelectedCandidateId(params.candidateId);
    setActiveView(view);
    syncRouteToHashAndStorage(view, nextElectionId, nextDomainId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loginWithUserPayload = (user: any, role: 'student' | 'admin') => {
    setSessionExpiredReason(null);
    setSessionChecked(true);
    if (role === 'student') {
      setUserRole('student');
      setStudentRaw(user);
      setAdmin(null);
      setNeedsProfileCompletion(false);
      const targetView =
        postLoginView && postLoginView !== 'admin_dashboard'
          ? postLoginView
          : 'student_dashboard';
      setPostLoginView(null);
      navigateTo(targetView);
    } else {
      setUserRole('admin');
      setAdmin(user);
      setStudentRaw(null);
      setPostLoginView(null);
      navigateTo('admin_dashboard');
    }
  };

  const logout = async () => {
    await authClient.logout();
    setSessionExpiredReason(null);
    setPostLoginView(null);
    setUserRole('guest');
    setStudentRaw(null);
    setVoterEligibilityRecord(null);
    setAdmin(null);
    setBallotSelections({});
    setNeedsProfileCompletion(false);
    navigateTo('landing');
  };

  const createElectionAction = async (payload: any) => {
    try {
      const res = await adminService.createElection(payload);
      if (res.success && res.election) {
        return { success: true, election: res.election };
      }
      return { success: false, error: res.error || 'Failed to create election.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create election.' };
    }
  };

  const updateElectionStatusAction = async (
    id: string,
    newStatus: ElectionStatus,
    justification?: string
  ) => {
    try {
      const res = await adminService.changeStatus(id, newStatus, justification);
      return { success: res.success, election: res.election, error: res.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Status update failed.' };
    }
  };

  const registerCandidateAction = async (payload: any) => {
    try {
      const res = await electionClient.registerCandidate(payload);
      return {
        success: res.success,
        candidate: res.candidate,
        error: res.error,
        message: res.message,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to register candidate.' };
    }
  };

  const updateCandidateAction = async (id: string, updates: any) => {
    try {
      const res = await electionClient.updateCandidate(id, updates);
      return {
        success: res.success,
        candidate: res.candidate,
        error: res.error,
        message: res.message,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update candidate.' };
    }
  };

  const approveCandidateAction = async (id: string) => {
    try {
      const res = await adminService.approveCandidate(id);
      return { success: res.success, message: res.message, error: res.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to approve candidate.' };
    }
  };

  const rejectCandidateAction = async (id: string, reason: string) => {
    try {
      const res = await adminService.rejectCandidate(id, reason);
      return { success: res.success, message: res.message, error: res.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to reject candidate.' };
    }
  };

  const requestCandidateCorrectionsAction = async (id: string, notes: string) => {
    try {
      const res = await adminService.requestCandidateCorrections(id, notes);
      return { success: res.success, message: res.message, error: res.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to request corrections.' };
    }
  };

  const withdrawCandidateAction = async (id: string, reason?: string) => {
    try {
      const res = await adminService.withdrawCandidate(id, reason);
      return { success: res.success, message: res.message, error: res.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to withdraw candidate.' };
    }
  };

  const assignCandidatePositionAction = async (
    id: string,
    electionId: string,
    positionId: string
  ) => {
    try {
      const res = await adminService.assignCandidatePosition(id, electionId, positionId);
      return { success: res.success, message: res.message, error: res.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to assign position.' };
    }
  };

  const verifyCandidateEligibilityAction = async (id: string) => {
    try {
      const res = await adminService.verifyCandidateEligibility(id);
      return {
        success: res.success,
        isEligible: res.isEligible,
        reason: res.reason,
        details: res.details,
        error: res.error,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Verification failed.' };
    }
  };

  const updateStudentProfile = async (updates: Partial<StudentProfile>): Promise<boolean> => {
    if (!student) return false;
    try {
      const res = await authClient.updateProfile(updates);
      return res.success;
    } catch {
      return false;
    }
  };

  const setBallotSelection = (positionId: string, candidateId: string, maxSelections = 1) => {
    setBallotSelections((prev) => {
      const current = prev[positionId] || [];
      if (maxSelections <= 1) {
        const next = current.includes(candidateId) ? [] : [candidateId];
        return { ...prev, [positionId]: next };
      }
      if (current.includes(candidateId)) {
        return { ...prev, [positionId]: current.filter((id) => id !== candidateId) };
      }
      if (current.length >= maxSelections) return prev;
      return { ...prev, [positionId]: [...current, candidateId] };
    });
  };

  const clearPositionSelection = (positionId: string) => {
    setBallotSelections((prev) => {
      const copy = { ...prev };
      delete copy[positionId];
      return copy;
    });
  };

  const resetBallot = () => setBallotSelections({});

  const submitBallotAction = async (
    electionId: string,
    selectionsOverride?: BallotSelectionMap,
    idempotencyKey?: string
  ) => {
    const payloadSelections = selectionsOverride ?? ballotSelections;
    const res = await votingService.submitBallot(electionId, payloadSelections, idempotencyKey);
    if (res.success && res.receipt) {
      setRecentVoteReceipt(res.receipt);
      setBallotSelections({});
    }
    return {
      success: res.success,
      code: res.code,
      message: res.message,
      error: res.error,
      receipt: res.receipt,
    };
  };

  const markNotificationAsRead = async (id: string) => {
    if (!firebaseUser) return;
    await markNotificationReadDb(firebaseUser.uid, id);
  };

  const markAllNotificationsAsRead = async () => {
    if (!firebaseUser) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await markAllNotificationsReadDb(firebaseUser.uid, unreadIds);
    }
  };

  const submitComplaint = async (data: {
    category: ComplaintTicket['category'];
    subject: string;
    description: string;
    domainId?: DomainId;
    attachmentUrl?: string;
  }): Promise<{ success: boolean; ticketNumber?: string; error?: string }> => {
    if (!firebaseUser || !student) {
      return {
        success: false,
        error: 'Please sign in with your verified student account before submitting a formal complaint.',
      };
    }
    try {
      const created = await createComplaintTicket({
        uid: firebaseUser.uid,
        studentName: student.fullName,
        studentId: student.studentId,
        studentEmail: student.email,
        domainId: data.domainId,
        category: data.category,
        subject: data.subject,
        description: data.description,
        attachmentUrl: data.attachmentUrl,
      });
      return { success: true, ticketNumber: created.ticketNumber };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to submit complaint.' };
    }
  };

  const toggleCompareCandidate = (candidateId: string) => {
    const fallbackSecond = candidates.find((c) => c.id !== candidateId)?.id;
    if (!compareCandidateIds) {
      if (fallbackSecond) setCompareCandidateIds([candidateId, fallbackSecond]);
      return;
    }
    if (compareCandidateIds[0] === candidateId) return;
    setCompareCandidateIds([compareCandidateIds[0], candidateId]);
  };

  const myCandidateApplication =
    student && student.studentId?.trim()
      ? candidates.find(
          (c) => c.studentId?.toUpperCase() === student.studentId.trim().toUpperCase()
        ) || null
      : null;

  return (
    <AppContext.Provider
      value={{
        activeView,
        userRole,
        firebaseUser,
        student,
        voterEligibilityRecord,
        admin,
        selectedElectionId,
        selectedDomainId,
        selectedCandidateId,
        compareCandidateIds,
        ballotSelections,
        elections,
        domains,
        halls,
        faculties,
        departments,
        positionsByElection,
        candidates,
        myCandidateApplication,
        notifications,
        announcements,
        calendarEvents,
        complaints,
        voteConfirmations,
        allStudents,
        eligibilityRecords,
        auditLogs,
        categoryFilter,
        statusFilter,
        searchQuery,
        recentVoteReceipt,
        sessionChecked,
        isLoadingData,
        dataError,
        sessionExpiredReason,
        postLoginView,
        pendingEmailPrompt,
        emailLinkFeedback,
        needsProfileCompletion,
        navigateTo,
        setSelectedDomainId,
        setPostLoginView,
        clearSessionExpiredReason,
        clearEmailLinkFeedback,
        submitEmailLinkPrompt,
        dismissEmailLinkPrompt,
        refreshAuthSession,
        refreshDomains,
        refreshElections,
        refreshCandidates,
        createElectionAction,
        updateElectionStatusAction,
        registerCandidateAction,
        updateCandidateAction,
        approveCandidateAction,
        rejectCandidateAction,
        requestCandidateCorrectionsAction,
        withdrawCandidateAction,
        assignCandidatePositionAction,
        verifyCandidateEligibilityAction,
        loginWithUserPayload,
        logout,
        updateStudentProfile,
        setCategoryFilter,
        setStatusFilter,
        setSearchQuery,
        setSelectedElectionId,
        setSelectedCandidateId,
        setBallotSelection,
        clearPositionSelection,
        resetBallot,
        submitBallotAction,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        submitComplaint,
        toggleCompareCandidate,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
