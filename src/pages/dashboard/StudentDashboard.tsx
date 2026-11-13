import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { authClient } from '../../services/authClient';
import { Logo } from '../../components/common/Logo';
import { 
  Vote, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Award, 
  Users, 
  ArrowRight, 
  Calendar, 
  ShieldCheck, 
  Bell, 
  ChevronRight,
  ExternalLink,
  Lock,
  RotateCcw,
  UserCheck,
  UserX,
  FileText,
  Building,
  Check,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  UserCircle,
  FileCheck,
  Edit3
} from 'lucide-react';
import { Election } from '../../types';
import { CandidateRegistrationModal } from '../../components/admin/CandidateRegistrationModal';

export const StudentDashboard: React.FC = () => {
  const { 
    student, 
    elections, 
    navigateTo, 
    notifications, 
    loginWithUserPayload, 
    logout,
    myCandidateApplication,
    candidates,
    refreshCandidates,
    withdrawCandidateAction
  } = useApp();

  const [activeSectionTab, setActiveSectionTab] = useState<'available' | 'active' | 'upcoming' | 'completed'>('available');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showCandidateAppModal, setShowCandidateAppModal] = useState(false);

  // Fetch live dashboard data from backend API
  const fetchDashboard = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await authClient.getStudentDashboard();
      if (res.success && res.data) {
        setDashboardData(res.data);
      } else {
        // If not logged in via backend token, build fallback from local context
        setDashboardData(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load dashboard from backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [student]);

  // Current active student profile
  const currentStudent = student || {
    id: 'stu-001',
    studentId: 'PS/CSC/22/0089',
    indexNumber: '10982341',
    fullName: 'Kofi Mensah Sarbah',
    email: 'kofi.sarbah@st.ucc.edu.gh',
    phone: '+233 24 555 0192',
    department: 'Computer Science & Information Technology',
    faculty: 'School of Physical Sciences',
    programme: 'B.Sc. Computer Science',
    level: '300',
    hall: 'Casely Hayford Hall',
    status: 'active',
    avatarUrl: '/src/assets/images/candidate_male_1794352938747.jpg',
    isEligible: true,
    hasVotedElections: ['UCC-GRA-2025', 'UCC-VAL-2025']
  };

  const isSuspended = currentStudent.status === 'suspended';

  // Helper to compute student eligibility for an election locally if backend data unavailable
  const computeEligibility = (el: Election): { isEligible: boolean; reason: string } => {
    if (isSuspended) return { isEligible: false, reason: 'Account administratively suspended.' };
    const crit = el.eligibilityCriteria;
    if (!crit) return { isEligible: true, reason: 'Open to all university students' };

    if (crit.levels && crit.levels.length > 0 && !crit.levels.includes(currentStudent.level)) {
      return { isEligible: false, reason: `Requires Level ${crit.levels.join(', ')} (Your level: ${currentStudent.level})` };
    }
    if (crit.faculties && crit.faculties.length > 0 && !crit.faculties.some(f => currentStudent.faculty?.toLowerCase().includes(f.toLowerCase()))) {
      return { isEligible: false, reason: `Restricted to ${crit.faculties.join(', ')}` };
    }
    if (crit.departments && crit.departments.length > 0 && !crit.departments.some(d => currentStudent.department?.toLowerCase().includes(d.toLowerCase()))) {
      return { isEligible: false, reason: `Restricted to ${crit.departments.join(', ')}` };
    }
    if (crit.halls && crit.halls.length > 0 && !crit.halls.some(h => currentStudent.hall?.toLowerCase().includes(h.toLowerCase().split(' ')[0]))) {
      return { isEligible: false, reason: `Restricted to residents of ${crit.halls.join(', ')}` };
    }
    return { isEligible: true, reason: 'Verified eligible voter' };
  };

  // Build section datasets
  const allElectionsWithEligibility = elections.map(el => {
    const { isEligible, reason } = computeEligibility(el);
    const hasVoted = currentStudent.hasVotedElections?.includes(el.id);
    const canVoteNow = isEligible && el.status === 'live' && !hasVoted && !isSuspended;
    return {
      ...el,
      isEligible,
      eligibilityReason: reason,
      hasVoted,
      canVoteNow
    };
  });

  const availableElections = allElectionsWithEligibility.filter(e => e.isEligible);
  const activeElections = allElectionsWithEligibility.filter(e => e.status === 'live');
  const upcomingElections = allElectionsWithEligibility.filter(e => e.status === 'upcoming');
  const completedElections = allElectionsWithEligibility.filter(e => e.status === 'results_published' || e.status === 'closed');

  // Voting Status figures
  const completedVotesCount = availableElections.filter(e => e.hasVoted).length;
  const pendingVotesCount = availableElections.filter(e => e.status === 'live' && !e.hasVoted).length;
  const closedEligibleCount = availableElections.filter(e => e.status === 'results_published' || e.status === 'closed').length;

  const unreadAlerts = notifications.slice(0, 4);

  // Testing Persona Switchers
  const switchTestPersona = async (personaType: 'kofi' | 'nana' | 'beatrice' | 'suspended' | 'medical_freshman') => {
    setIsLoading(true);
    let idToLogin = 'PS/CSC/22/0089';
    if (personaType === 'nana') idToLogin = 'ED/EPS/21/0034';
    if (personaType === 'beatrice') idToLogin = 'SB/MKT/23/0142';
    if (personaType === 'suspended') idToLogin = 'AS/HIS/22/0055';

    if (personaType === 'medical_freshman') {
      const mockFreshman = {
        id: 'stu-freshman',
        studentId: 'MED/SMS/24/0012',
        indexNumber: '10991204',
        fullName: 'Kwame Osei Mensah (Medical Freshman)',
        email: 'kwame.mensah@st.ucc.edu.gh',
        phone: '+233 24 111 2233',
        department: 'School of Medical Sciences',
        faculty: 'School of Medical Sciences',
        programme: 'MB ChB Medicine & Surgery',
        level: '100' as const,
        hall: 'Off-Campus Private Hostel',
        status: 'active' as const,
        isEligible: true,
        hasVotedElections: []
      };
      loginWithUserPayload(mockFreshman, 'student');
      setIsLoading(false);
      return;
    }

    try {
      const res = await authClient.login(idToLogin, 'Vote@UCC2026', true);
      if (res.user) {
        loginWithUserPayload(res.user, 'student');
      }
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Testing Persona Switcher Bar */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-slate-800">Persona Testing Switcher:</span>
          <span className="text-slate-500 hidden sm:inline">Evaluate different student eligibility states</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => switchTestPersona('kofi')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              currentStudent.studentId === 'PS/CSC/22/0089' && !isSuspended
                ? 'bg-[#123B70] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Kofi (L300 CS · Casford)
          </button>

          <button
            onClick={() => switchTestPersona('nana')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              currentStudent.studentId === 'ED/EPS/21/0034'
                ? 'bg-[#123B70] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Nana Akua (L400 · Adehye)
          </button>

          <button
            onClick={() => switchTestPersona('medical_freshman')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              currentStudent.studentId === 'MED/SMS/24/0012'
                ? 'bg-[#123B70] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Freshman (L100 · Off-Campus)
          </button>

          <button
            onClick={() => switchTestPersona('suspended')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              isSuspended
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            }`}
          >
            ⚠ Suspended Student
          </button>
        </div>
      </div>

      {/* Suspended Alert Banner (If Account is Suspended) */}
      {isSuspended && (
        <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Voter Account Administratively Suspended</h4>
              <p className="text-xs text-red-800 mt-0.5">
                Your voting rights have been frozen by the University Electoral Commission pending eligibility resolution.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('help_support')}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            Contact Commission Desk
          </button>
        </div>
      )}

      {/* DASHBOARD HEADER & WELCOME HERO */}
      <div className="bg-gradient-to-r from-[#0B1F3A] via-[#123B70] to-[#1e4e8c] rounded-2xl text-white p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* Left: Verified Name, Photo & Affiliation */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={currentStudent.avatarUrl || '/src/assets/images/candidate_male_1794352938747.jpg'}
                alt={currentStudent.fullName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/30 shadow-md"
              />
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0B1F3A] flex items-center justify-center text-[10px] font-bold ${
                isSuspended ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
              }`}>
                {isSuspended ? '✕' : '✓'}
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Logo variant="compact" theme="dark" showWordmark={false} />
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-[11px] text-sky-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {isSuspended ? 'Account Suspended' : 'Verified UCC Voter · 2026/2027'}
                  </span>
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                Welcome back, {currentStudent.fullName}
              </h1>

              <p className="text-xs sm:text-sm text-slate-200 truncate max-w-xl">
                {currentStudent.programme} · Level {currentStudent.level} · {currentStudent.hall}
              </p>

              <p className="text-[11px] text-slate-300 font-mono">
                ID: {currentStudent.studentId} · Dept: {currentStudent.department}
              </p>
            </div>
          </div>

          {/* Right: Quick Action & Account Menu */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigateTo('notifications')}
              className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors cursor-pointer relative"
              title="View Bulletins"
            >
              <Bell className="w-4 h-4" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#C62828] rounded-full" />
              )}
            </button>

            {/* Direct Cast Ballot CTA */}
            {pendingVotesCount > 0 && !isSuspended && (
              <button
                onClick={() => navigateTo('digital_ballot', { electionId: 'UCC-SRC-2026' })}
                className="px-5 py-3 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Vote className="w-4 h-4" />
                <span>Cast Live Ballot ({pendingVotesCount})</span>
              </button>
            )}

            {/* Account Settings Menu */}
            <div className="relative">
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserCircle className="w-4 h-4" />
                <span>Account</span>
              </button>

              {showAccountMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 text-xs font-medium">
                  <button
                    onClick={() => { setShowAccountMenu(false); navigateTo('student_profile'); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[#123B70]" />
                    <span>My Student Profile</span>
                  </button>
                  <button
                    onClick={() => { setShowAccountMenu(false); navigateTo('help_support'); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[#123B70]" />
                    <span>Support & Complaints</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => { setShowAccountMenu(false); logout(); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* DASHBOARD STATISTICS CARDS (DERIVED FROM APPLICATION DATA) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Available to Me */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Available To Me
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#123B70] font-mono tabular-nums">
            {isSuspended ? 0 : availableElections.length}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Personalized to your faculty, dept & hall
          </p>
        </div>

        {/* Active Elections */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Elections
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono tabular-nums">
            {activeElections.length}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Polling portals open today on campus
          </p>
        </div>

        {/* Upcoming Elections */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Upcoming Scheduled
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 font-mono tabular-nums">
            {upcomingElections.length}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Vetting and campaign windows scheduled
          </p>
        </div>

        {/* Completed Elections */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Completed Elections
            </span>
            <span className="w-2 h-2 rounded-full bg-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-600 font-mono tabular-nums">
            {completedElections.length}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Official declarations & gazetted results
          </p>
        </div>

      </div>

      {/* MY CANDIDACY APPLICATION & ASPIRANT STATUS CARD */}
      {myCandidateApplication ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider block">
                Official Candidate Portal
              </span>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                <Users className="w-4 h-4 text-[#123B70]" />
                <span>My Candidacy Application & Vetting Status</span>
              </h2>
            </div>

            {/* Status Pill */}
            <div>
              {myCandidateApplication.applicationStatus === 'Approved' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Approved · Accredited on Ballot</span>
                </span>
              )}
              {myCandidateApplication.applicationStatus === 'Under review' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span>Under Active Vetting Review</span>
                </span>
              )}
              {myCandidateApplication.applicationStatus === 'Submitted' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Application Submitted</span>
                </span>
              )}
              {myCandidateApplication.applicationStatus === 'Draft' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-bold">
                  <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Draft (Not Yet Submitted)</span>
                </span>
              )}
              {myCandidateApplication.applicationStatus === 'Rejected' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>Application Disqualified</span>
                </span>
              )}
              {myCandidateApplication.applicationStatus === 'Withdrawn' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                  <span>Candidacy Withdrawn</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-4">
            <img
              src={myCandidateApplication.photoUrl}
              alt={myCandidateApplication.fullName}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover object-top border-2 border-slate-200 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900 text-sm sm:text-base">
                  {myCandidateApplication.fullName}
                </span>
                {myCandidateApplication.nickname && (
                  <span className="text-xs font-bold text-[#C62828]">
                    "{myCandidateApplication.nickname}"
                  </span>
                )}
                <span className="text-xs text-slate-400 font-mono">
                  ({myCandidateApplication.studentId})
                </span>
              </div>

              <p className="text-xs text-[#123B70] font-semibold">
                Contesting for: <strong>{myCandidateApplication.positionId.replace('pos-', '').replace(/-/g, ' ').toUpperCase()}</strong>
              </p>

              <p className="text-xs text-slate-600 italic line-clamp-2">
                "{myCandidateApplication.manifestoSummary}"
              </p>

              {/* Commission Notices */}
              {myCandidateApplication.correctionNotes && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 mt-2">
                  <strong>Electoral Commission Revision Notes:</strong> {myCandidateApplication.correctionNotes}
                </div>
              )}
              {myCandidateApplication.rejectionReason && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 mt-2">
                  <strong>Disqualification Reason:</strong> {myCandidateApplication.rejectionReason}
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateTo('candidate_profile', { candidateId: myCandidateApplication.id })}
                className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Inspect Public Profile →
              </button>
              <button
                onClick={() => setShowCandidateAppModal(true)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Application / Manifesto</span>
              </button>
            </div>

            {myCandidateApplication.applicationStatus !== 'Withdrawn' && myCandidateApplication.applicationStatus !== 'Rejected' && (
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to withdraw your candidacy? This will remove your portfolio nomination from official ballots.')) {
                    await withdrawCandidateAction(myCandidateApplication.id, 'Withdrawn by candidate request');
                  }
                }}
                className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
              >
                Withdraw Candidacy
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-blue-900/5 via-[#123B70]/10 to-transparent rounded-2xl border border-blue-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-[#123B70] text-[10px] font-bold uppercase tracking-wider">
              <span>Nominations Open</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Interested in Serving as a Student Leader at UCC?
            </h3>
            <p className="text-xs text-slate-600 max-w-xl">
              File nomination for SRC Executive, Hall JCRC, or Faculty portfolios. Submit your 15-point dossier, campaign promises, and manifesto.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCandidateAppModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-xs transition-all shadow-xs cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <UserCircle className="w-4 h-4 text-amber-400" />
              <span>File Candidacy Nomination</span>
            </button>
            <button
              onClick={() => navigateTo('candidate_directory')}
              className="px-3 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              View Aspirants
            </button>
          </div>
        </div>
      )}

      {/* STUDENT VOTING STATUS BREAKDOWN PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#123B70]" />
              <span>Personalized Voting Participation Status</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks your participation progress across all eligible campus elections. (Ballot secrecy is cryptographically preserved: your selected candidates are never shown).
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-[#123B70]">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ballot Secrecy Enforced</span>
          </div>
        </div>

        {/* 4 Status KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500">Total Eligible</span>
            <span className="block text-xl font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
              {availableElections.length} Races
            </span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-800">Ballots Cast</span>
            <span className="block text-xl font-bold font-mono text-emerald-700 mt-0.5 tabular-nums">
              {completedVotesCount} Completed
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] uppercase font-bold text-amber-800">Awaiting Your Vote</span>
            <span className="block text-xl font-bold font-mono text-amber-700 mt-0.5 tabular-nums">
              {pendingVotesCount} Pending
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500">Closed Races</span>
            <span className="block text-xl font-bold font-mono text-slate-600 mt-0.5 tabular-nums">
              {closedEligibleCount} Finalized
            </span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTION: ELECTIONS DIRECTORY (LEFT) + QUICK ACTIONS & ANNOUNCEMENTS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 Cols): 4 Distinct Election Sections */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            
            {/* 4 Section Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-none">
              <button
                onClick={() => setActiveSectionTab('available')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeSectionTab === 'available'
                    ? 'bg-[#123B70] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                1. Available to Me ({availableElections.length})
              </button>

              <button
                onClick={() => setActiveSectionTab('active')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeSectionTab === 'active'
                    ? 'bg-[#123B70] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>2. Active Polls ({activeElections.length})</span>
              </button>

              <button
                onClick={() => setActiveSectionTab('upcoming')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeSectionTab === 'upcoming'
                    ? 'bg-[#123B70] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                3. Upcoming ({upcomingElections.length})
              </button>

              <button
                onClick={() => setActiveSectionTab('completed')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeSectionTab === 'completed'
                    ? 'bg-[#123B70] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                4. Completed ({completedElections.length})
              </button>
            </div>

            {/* List of election cards in selected section */}
            {(() => {
              let displayList: any[] = [];
              let sectionTitle = '';
              let sectionDescription = '';

              if (activeSectionTab === 'available') {
                displayList = availableElections;
                sectionTitle = 'Elections Available to Me';
                sectionDescription = `Elections where your verified affiliations (${currentStudent.faculty}, ${currentStudent.department}, ${currentStudent.hall}) grant you valid voting rights.`;
              } else if (activeSectionTab === 'active') {
                displayList = activeElections;
                sectionTitle = 'Live Campus Elections Open for Voting';
                sectionDescription = 'Current electronic polling portals open for ballot submission.';
              } else if (activeSectionTab === 'upcoming') {
                displayList = upcomingElections;
                sectionTitle = 'Upcoming University Elections Scheduled';
                sectionDescription = 'Elections currently in nomination or campaign period.';
              } else {
                displayList = completedElections;
                sectionTitle = 'Completed Elections & Certified Results';
                sectionDescription = 'Elections concluded with certified returns from the Electoral Commission.';
              }

              if (displayList.length === 0) {
                return (
                  <div className="py-12 px-4 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Vote className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">No elections found in this section</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      {isSuspended 
                        ? 'Your account is suspended, rendering you ineligible for active ballots.' 
                        : 'No election in this category currently matches your academic level, department, or hall.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500 pb-1">
                    <span className="font-bold text-slate-800">{sectionTitle}:</span> {sectionDescription}
                  </div>

                  {displayList.map((election) => (
                    <div
                      key={election.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#123B70]/40 hover:shadow-sm transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 max-w-lg">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-[#123B70] uppercase tracking-wider text-[11px]">
                              {election.category}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="font-mono text-slate-500 text-[11px]">
                              {election.code}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600 text-[11px]">
                              {election.positionsCount} Contested Positions
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-slate-900 leading-snug">
                            {election.title}
                          </h3>

                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {election.description}
                          </p>
                        </div>

                        {/* Status & Eligibility Badge */}
                        <div className="shrink-0 sm:text-right space-y-1">
                          {election.status === 'live' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              Polls Open
                            </span>
                          )}
                          {election.status === 'upcoming' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#123B70] text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              Upcoming
                            </span>
                          )}
                          {election.status === 'results_published' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                              <Award className="w-3.5 h-3.5 text-amber-600" />
                              Certified
                            </span>
                          )}

                          <div>
                            {election.hasVoted ? (
                              <span className="text-[11px] font-bold text-emerald-700 flex items-center sm:justify-end gap-1">
                                <Check className="w-3 h-3" />
                                Ballot Cast
                              </span>
                            ) : election.isEligible ? (
                              <span className="text-[11px] font-semibold text-slate-600 block">
                                Eligible to Vote
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic block">
                                {election.eligibilityReason}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Timeline dates bar */}
                      <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Opens: {new Date(election.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, 08:00
                          </span>
                          <span>·</span>
                          <span>
                            Closes: {new Date(election.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, 17:00 GMT
                          </span>
                        </div>

                        {/* Card action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigateTo('election_details', { electionId: election.id })}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            View Details
                          </button>

                          {election.canVoteNow && (
                            <button
                              onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                              className="px-3.5 py-1.5 rounded-lg bg-[#C62828] hover:bg-red-700 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <Vote className="w-3.5 h-3.5" />
                              <span>Vote Now</span>
                            </button>
                          )}

                          {election.hasVoted && (
                            <button
                              onClick={() => navigateTo('election_results', { electionId: election.id })}
                              className="px-3 py-1.5 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                              <span>Live Tallies</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

          </div>

        </div>

        {/* Right Column (4 Cols): Quick Actions Matrix & Announcements Feed */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* QUICK ACTIONS MATRIX */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Voter Quick Actions
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navigateTo('elections_directory')}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#EAF2FA] hover:border-blue-200 text-left transition-all group cursor-pointer"
              >
                <Vote className="w-5 h-5 text-[#123B70] group-hover:scale-105 transition-transform mb-1.5" />
                <span className="text-xs font-bold text-slate-900 block">All Elections</span>
                <span className="text-[10px] text-slate-500">Campus directory</span>
              </button>

              <button
                onClick={() => navigateTo('candidate_directory')}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#EAF2FA] hover:border-blue-200 text-left transition-all group cursor-pointer"
              >
                <Users className="w-5 h-5 text-[#123B70] group-hover:scale-105 transition-transform mb-1.5" />
                <span className="text-xs font-bold text-slate-900 block">Candidates</span>
                <span className="text-[10px] text-slate-500">Read manifestos</span>
              </button>

              <button
                onClick={() => navigateTo('election_results')}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#EAF2FA] hover:border-blue-200 text-left transition-all group cursor-pointer"
              >
                <Award className="w-5 h-5 text-amber-600 group-hover:scale-105 transition-transform mb-1.5" />
                <span className="text-xs font-bold text-slate-900 block">Results</span>
                <span className="text-[10px] text-slate-500">Certified returns</span>
              </button>

              <button
                onClick={() => navigateTo('election_calendar')}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#EAF2FA] hover:border-blue-200 text-left transition-all group cursor-pointer"
              >
                <Calendar className="w-5 h-5 text-[#123B70] group-hover:scale-105 transition-transform mb-1.5" />
                <span className="text-xs font-bold text-slate-900 block">Calendar</span>
                <span className="text-[10px] text-slate-500">Voting windows</span>
              </button>

              <button
                onClick={() => navigateTo('notifications')}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#EAF2FA] hover:border-blue-200 text-left transition-all group cursor-pointer"
              >
                <Bell className="w-5 h-5 text-[#123B70] group-hover:scale-105 transition-transform mb-1.5" />
                <span className="text-xs font-bold text-slate-900 block">Bulletins</span>
                <span className="text-[10px] text-slate-500">Urgent notices</span>
              </button>

              <button
                onClick={() => navigateTo('help_support')}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-red-50 hover:border-red-200 text-left transition-all group cursor-pointer"
              >
                <AlertCircle className="w-5 h-5 text-[#C62828] group-hover:scale-105 transition-transform mb-1.5" />
                <span className="text-xs font-bold text-slate-900 block">Get Support</span>
                <span className="text-[10px] text-slate-500">File a complaint</span>
              </button>
            </div>
          </div>

          {/* RECENT ANNOUNCEMENTS FEED */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#123B70]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Recent Announcements
                </h3>
              </div>
              <button
                onClick={() => navigateTo('notifications')}
                className="text-xs text-[#123B70] hover:underline font-semibold cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: 'ann-1',
                  tag: 'Official Polls Closing',
                  title: '64th SRC General Elections: Polling Closes at 17:00 GMT',
                  deadline: 'Tomorrow, 17:00 GMT',
                  summary: 'Undergraduates are advised to confirm their secret ballot selections before the close of polls.'
                },
                {
                  id: 'ann-2',
                  tag: 'Hall Elections',
                  title: 'Casely Hayford Hall Executive Voting Underway',
                  deadline: 'Tomorrow, 16:00 GMT',
                  summary: 'Registered gentlemen of Casford Hall can cast their votes online or at the Casford Forecourt kiosks.'
                },
                {
                  id: 'ann-3',
                  tag: 'Departmental Gazettes',
                  title: 'NACOS-UCC (Computer Science) Presidential Debate',
                  deadline: 'Nov 15, 16:00 GMT',
                  summary: 'Manifesto town-hall presentations scheduled at Science Lecture Theatre 1.'
                }
              ].map((ann) => (
                <div 
                  key={ann.id}
                  onClick={() => navigateTo('notifications')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 transition-colors cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-[#123B70] uppercase">
                      {ann.tag}
                    </span>
                    <span className="text-amber-700 font-mono font-medium">
                      {ann.deadline}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {ann.title}
                  </h4>

                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                    {ann.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Institutional Trust Citation Card */}
          <div className="p-4 rounded-xl bg-[#EAF2FA] border border-blue-200 text-xs text-[#123B70] space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="w-4 h-4 text-[#123B70]" />
              <span>Institutional Data Integrity</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Voting eligibility is verified directly against the Directorate of Academic Affairs registry. 
              Voter selections are decoupled and encrypted to ensure complete constitutional privacy.
            </p>
          </div>

        </div>

      </div>

      {/* Candidate Application / Nomination Modal */}
      <CandidateRegistrationModal
        isOpen={showCandidateAppModal}
        onClose={() => setShowCandidateAppModal(false)}
        candidateToEdit={myCandidateApplication}
      />

    </div>
  );
};
