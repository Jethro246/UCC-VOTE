import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  ActiveView, 
  UserRole, 
  StudentProfile, 
  AdminProfile, 
  Election, 
  ElectionCategory, 
  ElectionStatus, 
  NotificationItem, 
  ComplaintTicket 
} from '../types';
import { 
  DEMO_STUDENT, 
  DEMO_ADMIN, 
  MOCK_ELECTIONS, 
  MOCK_NOTIFICATIONS, 
  MOCK_COMPLAINTS 
} from '../data/mockData';
import { authClient } from '../services/authClient';

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
  createElectionAction: (payload: any) => Promise<{ success: boolean; election?: Election; error?: string }>;
  updateElectionStatusAction: (id: string, newStatus: ElectionStatus, justification?: string) => Promise<{ success: boolean; election?: Election; error?: string }>;
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
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [complaints, setComplaints] = useState<ComplaintTicket[]>(MOCK_COMPLAINTS);
  
  const [categoryFilter, setCategoryFilter] = useState<ElectionCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<ElectionStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [recentVoteReceipt, setRecentVoteReceipt] = useState<{ electionId: string; timestamp: string; receiptCode: string } | null>(null);

  // Validate active session against server on mount and load initial elections
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

  useEffect(() => {
    refreshElections();
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
      notifications,
      complaints,
      categoryFilter,
      statusFilter,
      searchQuery,
      recentVoteReceipt,
      sessionChecked,
      navigateTo,
      refreshElections,
      createElectionAction,
      updateElectionStatusAction,
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
