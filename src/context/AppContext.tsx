import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  ActiveView, 
  UserRole, 
  StudentProfile, 
  AdminProfile, 
  Election, 
  ElectionCategory, 
  ElectionStatus, 
  Candidate,
  CandidateApplicationStatus,
  NotificationItem, 
  ComplaintTicket 
} from '../types';
import { 
  DEMO_STUDENT, 
  DEMO_ADMIN, 
  MOCK_ELECTIONS, 
  MOCK_NOTIFICATIONS, 
  MOCK_COMPLAINTS,
  MOCK_CANDIDATES
} from '../data/mockData';
import { authClient } from '../services/authClient';
import { electionClient } from '../services/electionClient';

interface AppContextType {
  activeView: ActiveView;
  userRole: UserRole;
  student: StudentProfile | null;
  admin: AdminProfile | null;
  selectedElectionId: string;
  selectedCandidateId: string;
  compareCandidateIds: [string, string] | null;
  ballotSelections: Record<string, string>; // positionId -> candidateId
  elections: Election[];
  candidates: Candidate[];
  myCandidateApplication: Candidate | null;
  notifications: NotificationItem[];
  complaints: ComplaintTicket[];
  categoryFilter: ElectionCategory | 'All';
  statusFilter: ElectionStatus | 'All';
  searchQuery: string;
  recentVoteReceipt: { electionId: string; timestamp: string; receiptCode: string } | null;
  sessionChecked: boolean;
  
  // Actions
  navigateTo: (view: ActiveView, params?: { electionId?: string; candidateId?: string }) => void;
  refreshElections: () => Promise<void>;
  refreshCandidates: () => Promise<void>;
  createElectionAction: (payload: any) => Promise<{ success: boolean; election?: Election; error?: string }>;
  updateElectionStatusAction: (id: string, newStatus: ElectionStatus, justification?: string) => Promise<{ success: boolean; election?: Election; error?: string }>;
  registerCandidateAction: (payload: any) => Promise<{ success: boolean; candidate?: Candidate; error?: string; message?: string }>;
  updateCandidateAction: (id: string, updates: any) => Promise<{ success: boolean; candidate?: Candidate; error?: string; message?: string }>;
  approveCandidateAction: (id: string) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  rejectCandidateAction: (id: string, reason: string) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  requestCandidateCorrectionsAction: (id: string, notes: string) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  withdrawCandidateAction: (id: string, reason?: string) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  assignCandidatePositionAction: (id: string, electionId: string, positionId: string) => Promise<{ success: boolean; candidate?: Candidate; message?: string; error?: string }>;
  verifyCandidateEligibilityAction: (id: string) => Promise<{ success: boolean; isEligible?: boolean; reason?: string; details?: any; error?: string }>;
  loginAsStudent: (studentData?: any) => void;
  loginAsAdmin: (adminData?: any) => void;
  loginWithUserPayload: (user: any, role: 'student' | 'admin') => void;
  logout: () => void;
  updateStudentProfile: (updates: Partial<StudentProfile>) => Promise<boolean>;
  setCategoryFilter: (cat: ElectionCategory | 'All') => void;
  setStatusFilter: (status: ElectionStatus | 'All') => void;
  setSearchQuery: (query: string) => void;
  setSelectedElectionId: (id: string) => void;
  setSelectedCandidateId: (id: string) => void;
  setBallotSelection: (positionId: string, candidateId: string) => void;
  resetBallot: () => void;
  submitSimulatedVote: (electionId: string) => string;
  markNotificationAsRead: (id: string) => void;
  submitComplaint: (data: { category: ComplaintTicket['category']; subject: string; description: string }) => string;
  toggleCompareCandidate: (candidateId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<ActiveView>('landing');
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  
  const [selectedElectionId, setSelectedElectionId] = useState<string>('UCC-SRC-2026');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('cand-01');
  const [compareCandidateIds, setCompareCandidateIds] = useState<[string, string] | null>(['cand-01', 'cand-02']);
  const [ballotSelections, setBallotSelections] = useState<Record<string, string>>({});
  
  const [elections, setElections] = useState<Election[]>(MOCK_ELECTIONS);
  const [candidates, setCandidates] = useState<Candidate[]>(Object.values(MOCK_CANDIDATES));
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [complaints, setComplaints] = useState<ComplaintTicket[]>(MOCK_COMPLAINTS);
  
  const [categoryFilter, setCategoryFilter] = useState<ElectionCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<ElectionStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [recentVoteReceipt, setRecentVoteReceipt] = useState<{ electionId: string; timestamp: string; receiptCode: string } | null>(null);

  // Validate active session against server on mount and load initial elections & candidates
  const refreshElections = async () => {
    try {
      const res = await fetch('/api/elections');
      const data = await res.json();
      if (data.success && Array.isArray(data.elections) && data.elections.length > 0) {
        setElections(data.elections);
      }
    } catch {
      // fallback to pre-loaded MOCK_ELECTIONS
    }
  };

  const refreshCandidates = async () => {
    try {
      const res = await electionClient.getCandidates();
      if (res.success && Array.isArray(res.candidates) && res.candidates.length > 0) {
        setCandidates(res.candidates);
      }
    } catch {
      // fallback to pre-loaded MOCK_CANDIDATES
    }
  };

  useEffect(() => {
    refreshElections();
    refreshCandidates();
  }, []);

  const createElectionAction = async (payload: any) => {
    try {
      const token = authClient.getToken();
      const res = await fetch('/api/elections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.election) {
        await refreshElections();
        return { success: true, election: data.election };
      }
      return { success: false, error: data.error || 'Failed to create election.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateElectionStatusAction = async (id: string, newStatus: ElectionStatus, justification?: string) => {
    try {
      const token = authClient.getToken();
      const res = await fetch(`/api/elections/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ newStatus, justification })
      });
      const data = await res.json();
      if (data.success && data.election) {
        await refreshElections();
        return { success: true, election: data.election };
      }
      return { success: false, error: data.error || 'Status update failed.' };
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

  const assignCandidatePositionAction = async (id: string, electionId: string, positionId: string) => {
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
        return { success: true, isEligible: res.isEligible, reason: res.reason, details: res.details };
      }
      return { success: false, error: res.error || 'Candidate eligibility verification failed.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    async function checkSession() {
      const storedToken = authClient.getToken();
      if (storedToken) {
        try {
          const res = await authClient.getMe();
          if (res.success && res.user) {
            if (res.userRole === 'student') {
              setStudent(res.user);
              setUserRole('student');
            } else if (res.userRole === 'admin') {
              setAdmin(res.user);
              setUserRole('admin');
            }
          } else {
            authClient.clearSession();
            setUserRole('guest');
          }
        } catch {
          // fallback
        }
      }
      setSessionChecked(true);
    }
    checkSession();
  }, []);

  const navigateTo = (view: ActiveView, params?: { electionId?: string; candidateId?: string }) => {
    if (params?.electionId) setSelectedElectionId(params.electionId);
    if (params?.candidateId) setSelectedCandidateId(params.candidateId);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loginWithUserPayload = (user: any, role: 'student' | 'admin') => {
    if (role === 'student') {
      setUserRole('student');
      setStudent(user);
      setAdmin(null);
      setActiveView('student_dashboard');
    } else {
      setUserRole('admin');
      setAdmin(user);
      setStudent(null);
      setActiveView('admin_dashboard');
    }
  };

  const loginAsStudent = (studentData?: any) => {
    const studentUser = studentData || DEMO_STUDENT;
    authClient.setSession('demo-token-student', studentUser, 'student');
    setUserRole('student');
    setStudent(studentUser);
    setAdmin(null);
    setActiveView('student_dashboard');
  };

  const loginAsAdmin = (adminData?: any) => {
    const adminUser = adminData || DEMO_ADMIN;
    authClient.setSession('demo-token-admin', adminUser, 'admin');
    setUserRole('admin');
    setAdmin(adminUser);
    setStudent(null);
    setActiveView('admin_dashboard');
  };

  const logout = () => {
    authClient.logout();
    setUserRole('guest');
    setStudent(null);
    setAdmin(null);
    setActiveView('landing');
  };

  const updateStudentProfile = async (updates: Partial<StudentProfile>): Promise<boolean> => {
    if (!student) return false;
    try {
      const res = await authClient.updateProfile(updates);
      if (res.success && res.user) {
        setStudent(res.user);
        return true;
      }
    } catch {
      // fallback local update
    }
    setStudent({ ...student, ...updates });
    return true;
  };

  const setBallotSelection = (positionId: string, candidateId: string) => {
    setBallotSelections(prev => ({
      ...prev,
      [positionId]: candidateId
    }));
  };

  const resetBallot = () => {
    setBallotSelections({});
  };

  const submitSimulatedVote = (electionId: string): string => {
    const receiptCode = 'UCC-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString().slice(-4);
    const receipt = {
      electionId,
      timestamp: new Date().toISOString(),
      receiptCode
    };
    setRecentVoteReceipt(receipt);

    // Update student's hasVotedElections
    if (student) {
      setStudent({
        ...student,
        hasVotedElections: [...student.hasVotedElections, electionId]
      });
    }

    // Increment total votes cast in the election mock
    setElections(prev => prev.map(el => {
      if (el.id === electionId) {
        const newCast = el.totalVotesCast + 1;
        return {
          ...el,
          totalVotesCast: newCast,
          turnoutPercentage: Number(((newCast / el.totalEligibleVoters) * 100).toFixed(1))
        };
      }
      return el;
    }));

    return receiptCode;
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const submitComplaint = (data: { category: ComplaintTicket['category']; subject: string; description: string }): string => {
    const ticketNumber = 'UCC-EC-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    const newComplaint: ComplaintTicket = {
      id: 'comp-' + Date.now(),
      ticketNumber,
      studentName: student?.fullName || 'Anonymous Registered Student',
      studentId: student?.studentId || 'PS/CSC/22/0089',
      category: data.category,
      subject: data.subject,
      description: data.description,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    setComplaints(prev => [newComplaint, ...prev]);
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
    ? candidates.find(c => c.studentId.toUpperCase() === student.studentId.toUpperCase()) || null
    : null;

  return (
    <AppContext.Provider value={{
      activeView,
      userRole,
      student,
      admin,
      selectedElectionId,
      selectedCandidateId,
      compareCandidateIds,
      ballotSelections,
      elections,
      candidates,
      myCandidateApplication,
      notifications,
      complaints,
      categoryFilter,
      statusFilter,
      searchQuery,
      recentVoteReceipt,
      sessionChecked,
      navigateTo,
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
      resetBallot,
      submitSimulatedVote,
      markNotificationAsRead,
      submitComplaint,
      toggleCompareCandidate
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
