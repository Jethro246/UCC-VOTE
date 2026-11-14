import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  ActiveView,
  UserRole,
  StudentProfile,
  AdminProfile,
  Election,
  ElectionCategory,
  ElectionStatus,
  Position,
  Candidate,
  NotificationItem,
  ComplaintTicket,
  BallotSelectionMap,
  VoteConfirmationReceipt,
  DomainId,
  HallUnit,
  FacultyUnit,
  DepartmentUnit
} from '../types';
import {
  MOCK_ELECTIONS,
  MOCK_NOTIFICATIONS,
  MOCK_COMPLAINTS,
  MOCK_CANDIDATES,
  MOCK_POSITIONS
} from '../data/mockData';
import { authClient } from '../services/authClient';
import { electionClient, DomainWithStats } from '../services/electionClient';

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
  'admin_dashboard'
]);

function parseRouteFromHashOrStorage(): {
  view: ActiveView;
  electionId: string;
  domainId: DomainId;
} {
  let view: ActiveView = 'landing';
  let electionId = 'UCC-SRC-2026';
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
    // ignore storage/hash errors
  }

  return { view, electionId, domainId };
}

function syncRouteToHashAndStorage(view: ActiveView, electionId?: string, domainId?: DomainId) {
  try {
    sessionStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, view);
    if (electionId) {
      sessionStorage.setItem(SELECTED_ELECTION_STORAGE_KEY, electionId);
    }
    if (domainId) {
      sessionStorage.setItem(SELECTED_DOMAIN_STORAGE_KEY, domainId);
    }
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
    // ignore history/storage errors
  }
}

interface AppContextType {
  activeView: ActiveView;
  userRole: UserRole;
  student: StudentProfile | null;
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
  complaints: ComplaintTicket[];
  categoryFilter: ElectionCategory | 'All';
  statusFilter: ElectionStatus | 'All';
  searchQuery: string;
  recentVoteReceipt: VoteConfirmationReceipt | null;
  sessionChecked: boolean;
  sessionExpiredReason: string | null;
  postLoginView: ActiveView | null;

  // Actions
  navigateTo: (
    view: ActiveView,
    params?: { electionId?: string; candidateId?: string; domainId?: DomainId }
  ) => void;
  setSelectedDomainId: (id: DomainId) => void;
  setPostLoginView: (view: ActiveView | null) => void;
  clearSessionExpiredReason: () => void;
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
  loginAsStudent: () => Promise<boolean>;
  loginAsAdmin: () => Promise<boolean>;
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
  markNotificationAsRead: (id: string) => void;
  submitComplaint: (data: {
    category: ComplaintTicket['category'];
    subject: string;
    description: string;
    domainId?: DomainId;
  }) => string;
  toggleCompareCandidate: (candidateId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initialRoute = parseRouteFromHashOrStorage();

  const [activeView, setActiveView] = useState<ActiveView>(initialRoute.view);
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const [postLoginView, setPostLoginView] = useState<ActiveView | null>(null);

  const [selectedElectionId, setSelectedElectionIdState] = useState<string>(initialRoute.electionId);
  const [selectedDomainId, setSelectedDomainIdState] = useState<DomainId>(initialRoute.domainId);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('cand-01');
  const [compareCandidateIds, setCompareCandidateIds] = useState<[string, string] | null>([
    'cand-01',
    'cand-02'
  ]);
  const [ballotSelections, setBallotSelections] = useState<BallotSelectionMap>({});

  const [elections, setElections] = useState<Election[]>(MOCK_ELECTIONS);
  const [domains, setDomains] = useState<DomainWithStats[]>([]);
  const [halls, setHalls] = useState<HallUnit[]>([]);
  const [faculties, setFaculties] = useState<FacultyUnit[]>([]);
  const [departments, setDepartments] = useState<DepartmentUnit[]>([]);
  const [positionsByElection, setPositionsByElection] =
    useState<Record<string, Position[]>>(MOCK_POSITIONS);
  const [candidates, setCandidates] = useState<Candidate[]>(Object.values(MOCK_CANDIDATES));
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [complaints, setComplaints] = useState<ComplaintTicket[]>(MOCK_COMPLAINTS);

  const [categoryFilter, setCategoryFilter] = useState<ElectionCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<ElectionStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [recentVoteReceipt, setRecentVoteReceipt] = useState<VoteConfirmationReceipt | null>(null);

  const setSelectedElectionId = (id: string) => {
    setSelectedElectionIdState(id);
    try {
      sessionStorage.setItem(SELECTED_ELECTION_STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
  };

  const setSelectedDomainId = (id: DomainId) => {
    setSelectedDomainIdState(id);
    try {
      sessionStorage.setItem(SELECTED_DOMAIN_STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
  };

  const refreshDomains = async () => {
    try {
      const res = await electionClient.getDomains();
      if (res.success) {
        if (Array.isArray(res.domains)) setDomains(res.domains);
        if (Array.isArray(res.halls)) setHalls(res.halls);
        if (Array.isArray(res.faculties)) setFaculties(res.faculties);
        if (Array.isArray(res.departments)) setDepartments(res.departments);
        if (res.positionsByElection && typeof res.positionsByElection === 'object') {
          setPositionsByElection(res.positionsByElection);
        }
      }
    } catch {
      // keep existing domain registry on transient error
    }
  };

  const refreshElections = async () => {
    try {
      const res = await fetch('/api/elections', { credentials: 'include' });
      const data = await res.json();
      if (data.success && Array.isArray(data.elections) && data.elections.length > 0) {
        setElections(data.elections);
      }
      await refreshDomains();
    } catch {
      // keep existing elections list on transient fetch error
    }
  };

  const refreshCandidates = async () => {
    try {
      const res = await electionClient.getCandidates();
      if (res.success && Array.isArray(res.candidates) && res.candidates.length > 0) {
        setCandidates(res.candidates);
      }
    } catch {
      // keep existing candidates list on transient fetch error
    }
  };

  useEffect(() => {
    refreshDomains();
    refreshElections();
    refreshCandidates();
  }, []);

  // Listen to browser hash navigation so back/forward/hash changes update active view cleanly
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseRouteFromHashOrStorage();
      setActiveView(parsed.view);
      if (parsed.electionId) {
        setSelectedElectionIdState(parsed.electionId);
      }
      if (parsed.domainId) {
        setSelectedDomainIdState(parsed.domainId);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Subscribe to authClient session refresh / expiry events
  useEffect(() => {
    const unsubscribe = authClient.subscribe((event) => {
      if (event.type === 'refreshed' || event.type === 'updated') {
        setSessionExpiredReason(null);
        if (event.role === 'student') {
          setUserRole('student');
          setStudent(event.user);
          setAdmin(null);
        } else {
          setUserRole('admin');
          setAdmin(event.user);
          setStudent(null);
        }
      } else if (event.type === 'expired') {
        setUserRole('guest');
        setStudent(null);
        setAdmin(null);
        setSessionExpiredReason(
          event.reason || 'Your session has expired. Please log in again to continue.'
        );
      } else if (event.type === 'cleared') {
        setUserRole('guest');
        setStudent(null);
        setAdmin(null);
      }
    });
    return unsubscribe;
  }, []);

  // Restore & verify session against backend before releasing protected routes
  useEffect(() => {
    let active = true;
    async function restoreSession() {
      const hasToken = Boolean(authClient.getToken());
      const hasRefresh = Boolean(authClient.getRefreshToken());
      const storedUser = authClient.getStoredUser();
      const storedRole = authClient.getStoredRole();

      if (hasToken || hasRefresh) {
        const res = await authClient.getMe();
        if (!active) return;

        if (res.success && res.user) {
          setSessionExpiredReason(null);
          if (res.userRole === 'admin') {
            setAdmin(res.user);
            setStudent(null);
            setUserRole('admin');
          } else {
            setStudent(res.user);
            setAdmin(null);
            setUserRole('student');
          }
        } else if (res.code === 'NETWORK_ERROR' && storedUser && storedRole !== 'guest') {
          // Do not unexpectedly log user out during temporary connectivity loss
          if (storedRole === 'student') {
            setStudent(storedUser);
            setAdmin(null);
            setUserRole('student');
          } else {
            setAdmin(storedUser);
            setStudent(null);
            setUserRole('admin');
          }
        } else {
          setUserRole('guest');
          setStudent(null);
          setAdmin(null);
          if (res.code === 'SESSION_EXPIRED' || res.code === 'TOKEN_EXPIRED' || res.code === 'ACCOUNT_SUSPENDED') {
            setSessionExpiredReason(
              res.error || 'Your session has expired. Please log in again to continue.'
            );
          }
        }
      }

      if (active) {
        setSessionChecked(true);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const refreshAuthSession = async (): Promise<boolean> => {
    const res = await authClient.refreshSession();
    if (res.success && res.user) {
      setSessionExpiredReason(null);
      if (res.userRole === 'admin') {
        setAdmin(res.user);
        setStudent(null);
        setUserRole('admin');
      } else {
        setStudent(res.user);
        setAdmin(null);
        setUserRole('student');
      }
      return true;
    }
    return false;
  };

  const clearSessionExpiredReason = () => setSessionExpiredReason(null);

  const navigateTo = (
    view: ActiveView,
    params?: { electionId?: string; candidateId?: string; domainId?: DomainId }
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
      setStudent(user);
      setAdmin(null);
      const targetView =
        postLoginView && postLoginView !== 'admin_dashboard'
          ? postLoginView
          : 'student_dashboard';
      setPostLoginView(null);
      setActiveView(targetView);
      syncRouteToHashAndStorage(targetView, selectedElectionId);
    } else {
      setUserRole('admin');
      setAdmin(user);
      setStudent(null);
      setPostLoginView(null);
      setActiveView('admin_dashboard');
      syncRouteToHashAndStorage('admin_dashboard', selectedElectionId);
    }
  };

  const loginAsStudent = async (): Promise<boolean> => {
    const res = await authClient.login('PS/CSC/22/0089', 'Vote@UCC2026', true);
    if (res.success && res.user) {
      loginWithUserPayload(res.user, 'student');
      return true;
    }
    return false;
  };

  const loginAsAdmin = async (): Promise<boolean> => {
    const res = await authClient.adminLogin(
      'UCC/EC/ST/2019/04',
      'Admin@UCC2026',
      'Electoral Commissioner',
      '9482'
    );
    if (res.success && res.user) {
      loginWithUserPayload(res.user, 'admin');
      return true;
    }
    return false;
  };

  const logout = async () => {
    await authClient.logout();
    setSessionExpiredReason(null);
    setPostLoginView(null);
    setUserRole('guest');
    setStudent(null);
    setAdmin(null);
    setBallotSelections({});
    setActiveView('landing');
    syncRouteToHashAndStorage('landing', selectedElectionId);
  };

  const createElectionAction = async (payload: any) => {
    try {
      const res = await electionClient.createElection(payload);
      if (res.success && res.election) {
        await refreshElections();
        return { success: true, election: res.election };
      }
      return { success: false, error: res.error || 'Failed to create election.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateElectionStatusAction = async (
    id: string,
    newStatus: ElectionStatus,
    justification?: string
  ) => {
    try {
      const res = await electionClient.changeStatus(id, newStatus, justification);
      if (res.success && res.election) {
        await refreshElections();
        return { success: true, election: res.election };
      }
      return { success: false, error: res.error || 'Status update failed.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const registerCandidateAction = async (payload: any) => {
    try {
      const res = await electionClient.registerCandidate(payload);
      if (res.success && res.candidate) {
        await refreshCandidates();
        return { success: true, candidate: res.candidate, message: res.message };
      }
      return { success: false, error: res.error || 'Failed to submit candidate application.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateCandidateAction = async (id: string, updates: any) => {
    try {
      const res = await electionClient.updateCandidate(id, updates);
      if (res.success && res.candidate) {
        await refreshCandidates();
        return { success: true, candidate: res.candidate, message: res.message };
      }
      return { success: false, error: res.error || 'Failed to update candidate.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const approveCandidateAction = async (id: string) => {
    try {
      const res = await electionClient.approveCandidate(id);
      if (res.success && res.candidate) {
        await refreshCandidates();
        await refreshElections();
        return { success: true, candidate: res.candidate, message: res.message };
      }
      return { success: false, error: res.error || 'Failed to approve candidate nomination.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const rejectCandidateAction = async (id: string, reason: string) => {
    try {
      const res = await electionClient.rejectCandidate(id, reason);
      if (res.success && res.candidate) {
        await refreshCandidates();
        await refreshElections();
        return { success: true, candidate: res.candidate, message: res.message };
      }
      return { success: false, error: res.error || 'Failed to reject candidate nomination.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const requestCandidateCorrectionsAction = async (id: string, notes: string) => {
    try {
      const res = await electionClient.requestCandidateCorrections(id, notes);
      if (res.success && res.candidate) {
        await refreshCandidates();
        return { success: true, candidate: res.candidate, message: res.message };
      }
      return { success: false, error: res.error || 'Failed to submit correction request.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const withdrawCandidateAction = async (id: string, reason?: string) => {
    try {
      const res = await electionClient.withdrawCandidate(id, reason);
      if (res.success && res.candidate) {
        await refreshCandidates();
        await refreshElections();
        return { success: true, candidate: res.candidate, message: res.message };
      }
      return { success: false, error: res.error || 'Failed to withdraw candidate.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const assignCandidatePositionAction = async (
    id: string,
    electionId: string,
    positionId: string
  ) => {
    try {
      const res = await electionClient.assignCandidatePosition(id, electionId, positionId);
      if (res.success && res.candidate) {
        await refreshCandidates();
        await refreshElections();
        return { success: true, candidate: res.candidate, message: res.message };
      }
      return { success: false, error: res.error || 'Failed to assign candidate position.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const verifyCandidateEligibilityAction = async (id: string) => {
    try {
      const res = await electionClient.verifyCandidateEligibility(id);
      if (res.success) {
        await refreshCandidates();
        return {
          success: true,
          isEligible: res.isEligible,
          reason: res.reason,
          details: res.details
        };
      }
      return { success: false, error: res.error || 'Candidate eligibility verification failed.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateStudentProfile = async (updates: Partial<StudentProfile>): Promise<boolean> => {
    if (!student) return false;
    try {
      const res = await authClient.updateProfile(updates);
      if (res.success && res.user) {
        setStudent(res.user);
        return true;
      }
      return false;
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
      if (current.length >= maxSelections) {
        return prev;
      }
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

  const resetBallot = () => {
    setBallotSelections({});
  };

  const submitBallotAction = async (
    electionId: string,
    selectionsOverride?: BallotSelectionMap,
    idempotencyKey?: string
  ) => {
    const payloadSelections = selectionsOverride ?? ballotSelections;
    const res = await electionClient.submitBallot(electionId, payloadSelections, idempotencyKey);

    if (res.success && res.receipt) {
      setRecentVoteReceipt(res.receipt);
      setBallotSelections({});

      if (student) {
        const updatedVoted = student.hasVotedElections.includes(electionId)
          ? student.hasVotedElections
          : [...student.hasVotedElections, electionId];
        setStudent({
          ...student,
          hasVotedElections: updatedVoted
        });
      }

      if (res.updatedTurnout) {
        setElections((prev) =>
          prev.map((el) =>
            el.id === electionId
              ? {
                  ...el,
                  totalVotesCast: res.updatedTurnout!.totalVotesCast,
                  turnoutPercentage: res.updatedTurnout!.turnoutPercentage
                }
              : el
          )
        );
      }

      refreshElections();
      refreshCandidates();
    }

    return {
      success: res.success,
      code: res.code,
      message: res.message,
      error: res.error,
      receipt: res.receipt
    };
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const submitComplaint = (data: {
    category: ComplaintTicket['category'];
    subject: string;
    description: string;
    domainId?: DomainId;
  }): string => {
    const ticketNumber =
      'UCC-EC-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    const newComplaint: ComplaintTicket = {
      id: 'comp-' + Date.now(),
      ticketNumber,
      studentName: student?.fullName || 'Anonymous Registered Student',
      studentId: student?.studentId || 'UNAUTHENTICATED',
      domainId: data.domainId,
      category: data.category,
      subject: data.subject,
      description: data.description,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    setComplaints((prev) => [newComplaint, ...prev]);
    return ticketNumber;
  };

  const toggleCompareCandidate = (candidateId: string) => {
    if (!compareCandidateIds) {
      setCompareCandidateIds([candidateId, 'cand-02']);
      return;
    }
    if (compareCandidateIds[0] === candidateId) {
      return;
    }
    setCompareCandidateIds([compareCandidateIds[0], candidateId]);
  };

  const myCandidateApplication = student
    ? candidates.find((c) => c.studentId.toUpperCase() === student.studentId.toUpperCase()) || null
    : null;

  return (
    <AppContext.Provider
      value={{
        activeView,
        userRole,
        student,
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
        complaints,
        categoryFilter,
        statusFilter,
        searchQuery,
        recentVoteReceipt,
        sessionChecked,
        sessionExpiredReason,
        postLoginView,
        navigateTo,
        setSelectedDomainId,
        setPostLoginView,
        clearSessionExpiredReason,
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
        loginAsStudent,
        loginAsAdmin,
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
        submitComplaint,
        toggleCompareCandidate
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
