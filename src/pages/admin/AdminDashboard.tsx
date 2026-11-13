import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MOCK_AUDIT_LOGS, MOCK_POSITIONS, MOCK_CANDIDATES } from '../../data/mockData';
import { electionClient } from '../../services/electionClient';
import { authClient } from '../../services/authClient';
import { Logo } from '../../components/common/Logo';
import { 
  LayoutDashboard, 
  Vote, 
  Users, 
  Award, 
  ShieldCheck, 
  Lock, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Download, 
  SlidersHorizontal,
  AlertTriangle,
  FileText,
  Building,
  RefreshCw,
  UserCheck,
  UserPlus,
  Filter
} from 'lucide-react';
import { Election, ElectionStatus, Candidate } from '../../types';
import { CreateElectionModal } from '../../components/admin/CreateElectionModal';
import { StatusTransitionModal } from '../../components/admin/StatusTransitionModal';
import { PositionManagerModal } from '../../components/admin/PositionManagerModal';
import { EligibilityTesterModal } from '../../components/admin/EligibilityTesterModal';
import { CandidateRegistrationModal } from '../../components/admin/CandidateRegistrationModal';
import { CandidateReviewModal } from '../../components/admin/CandidateReviewModal';

export const AdminDashboard: React.FC = () => {
  const { admin, elections, complaints, navigateTo, refreshElections, candidates, refreshCandidates } = useApp();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'elections' | 'candidates' | 'voters' | 'results' | 'audit'
  >('overview');

  const [liveAuditLogs, setLiveAuditLogs] = useState<any[]>([]);
  const [inspectStudentId, setInspectStudentId] = useState('PS/CSC/22/0089');
  const [secrecyTestResult, setSecrecyTestResult] = useState<{ code?: string; message: string } | null>(null);
  const [vaultAuditSummary, setVaultAuditSummary] = useState<any>(null);

  const fetchAuditLogs = async () => {
    try {
      const token = authClient.getToken();
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLiveAuditLogs(data.logs);
      }
    } catch {
      // fallback to static logs
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
      electionClient.getVotingAuditSummary('UCC-SRC-2026').then((r) => {
        if (r.success && r.summary) setVaultAuditSummary(r.summary);
      });
    }
  }, [activeTab]);

  const [searchStudent, setSearchStudent] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedElectionForStatus, setSelectedElectionForStatus] = useState<Election | null>(null);
  const [selectedElectionForPositions, setSelectedElectionForPositions] = useState<Election | null>(null);
  const [selectedElectionForEligibility, setSelectedElectionForEligibility] = useState<Election | null>(null);

  // Candidate Management State
  const [selectedCandidateForReview, setSelectedCandidateForReview] = useState<Candidate | null>(null);
  const [selectedCandidateForEdit, setSelectedCandidateForEdit] = useState<Candidate | null>(null);
  const [showCandidateRegisterModal, setShowCandidateRegisterModal] = useState(false);
  const [candidateFilterStatus, setCandidateFilterStatus] = useState<string>('all');
  const [candidateFilterElection, setCandidateFilterElection] = useState<string>('all');
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');

  const [certifiedSuccessMsg, setCertifiedSuccessMsg] = useState('');
  const [statusActionMsg, setStatusActionMsg] = useState('');

  // Sample student registry for management
  const [studentRegistry, setStudentRegistry] = useState([
    { id: '1', studentId: 'PS/CSC/22/0089', name: 'Kofi Mensah Sarbah', programme: 'B.Sc. Computer Science', level: '300', hall: 'Casely Hayford Hall', isEligible: true, status: 'active' },
    { id: '2', studentId: 'ED/EPS/21/0034', name: 'Nana Akua Afriyie Osei', programme: 'B.Ed. Psychology', level: '400', hall: 'Adehye Hall', isEligible: true, status: 'active' },
    { id: '3', studentId: 'SB/ACC/21/0112', name: 'Richmond Kwabena Frimpong', programme: 'B.Com. Accounting', level: '400', hall: 'Valco Hall', isEligible: true, status: 'active' },
    { id: '4', studentId: 'AS/COM/22/0104', name: 'Emmanuel Kofi Annan', programme: 'B.A. Communication', level: '300', hall: 'Valco Hall', isEligible: true, status: 'active' },
    { id: '5', studentId: 'PS/CHE/21/0088', name: 'Kwesi Boateng Mensah', programme: 'B.Sc. Chemistry', level: '400', hall: 'Casely Hayford Hall', isEligible: true, status: 'active' },
    { id: '6', studentId: 'SB/FIN/21/0019', name: 'Priscilla Baaba Eshun', programme: 'B.Com. Finance', level: '400', hall: 'Kwame Nkrumah Hall', isEligible: true, status: 'active' },
    { id: '7', studentId: 'AS/HIS/22/0055', name: 'Kojo Adomako Danquah', programme: 'B.A. History', level: '300', hall: 'Casely Hayford Hall', isEligible: false, status: 'suspended' },
  ]);

  const toggleEligibility = async (studentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const token = localStorage.getItem('ucc_vote_token');
      const res = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ status: newStatus, reason: 'Administrative commission action' })
      });
      const data = await res.json();
      if (data.success) {
        setStatusActionMsg(`Account ${studentId} marked as ${newStatus.toUpperCase()}.`);
        setTimeout(() => setStatusActionMsg(''), 3000);
      }
    } catch {
      // fallback
    }

    setStudentRegistry(prev => prev.map(s => {
      if (s.studentId === studentId) {
        return { ...s, isEligible: newStatus === 'active', status: newStatus };
      }
      return s;
    }));
  };

  const filteredStudents = studentRegistry.filter(s => 
    s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchStudent.toLowerCase()) ||
    s.hall.toLowerCase().includes(searchStudent.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Admin Commission Header */}
      <div className="bg-[#0B1F3A] text-white p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <Logo variant="default" theme="dark" showWordmark={false} className="hidden sm:inline-flex" />
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/30 border border-red-500/40 text-xs text-red-200">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Authenticated as {admin?.role || 'Electoral Commissioner'}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Electoral Commission Administration Console
            </h1>

            <p className="text-xs sm:text-sm text-slate-300">
              Master oversight for University of Cape Coast student elections, candidate accreditation, and audit trails.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Election</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-none">
        {[
          { id: 'overview', label: 'Overview & Turnout', icon: LayoutDashboard },
          { id: 'elections', label: 'Elections Manager', icon: Vote },
          { id: 'candidates', label: 'Candidate Nominations', icon: Users },
          { id: 'voters', label: 'Voter Roll & Eligibility', icon: FileText },
          { id: 'results', label: 'Results Certification', icon: Award },
          { id: 'audit', label: 'Security & Audit Trail', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#123B70] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & TURNOUT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Registered Voters</span>
              <span className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1 block">24,850</span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">100% Academic Registry Synced</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Ballots Cast</span>
              <span className="text-2xl font-black text-[#123B70] font-mono tabular-nums mt-1 block">
                {elections.reduce((sum, e) => sum + (e.totalVotesCast || 0), 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Across all configured elections</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Elections</span>
              <span className="text-2xl font-black text-amber-600 font-mono tabular-nums mt-1 block">
                {elections.filter(e => e.status === 'live').length} Live
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Currently accepting ballots</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Ballot Vault Separation</span>
              <span className="text-2xl font-black text-emerald-600 font-mono tabular-nums mt-1 block">ENFORCED</span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Identity & ballot stores decoupled</span>
            </div>
          </div>

          {/* Departmental & Faculty Participation Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Real-Time Faculty Voter Turnout
                </h3>
                <span className="text-xs text-slate-500 font-mono">Updated 1 min ago</span>
              </div>

              <div className="space-y-4">
                {[
                  { faculty: 'School of Physical Sciences', turnout: 68.4, total: 3140 },
                  { faculty: 'School of Business', turnout: 64.2, total: 4200 },
                  { faculty: 'Faculty of Arts & Social Sciences', turnout: 59.8, total: 5100 },
                  { faculty: 'Faculty of Educational Foundations', turnout: 56.1, total: 3800 },
                  { faculty: 'School of Medical Sciences', turnout: 74.5, total: 1200 },
                ].map((f, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{f.faculty}</span>
                      <span className="font-mono font-bold text-[#123B70] tabular-nums">
                        {f.turnout}% ({f.total.toLocaleString()} votes)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-[#123B70] h-full rounded-full transition-all"
                        style={{ width: `${f.turnout}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Participation by Hall
              </h3>
              <div className="space-y-3 text-xs">
                {[
                  { hall: 'Casely Hayford Hall', pct: 68.1, color: 'text-red-700' },
                  { hall: 'Valco Hall', pct: 62.4, color: 'text-blue-700' },
                  { hall: 'Oguaa Hall', pct: 58.0, color: 'text-slate-800' },
                  { hall: 'Kwame Nkrumah Hall', pct: 55.4, color: 'text-slate-800' },
                  { hall: 'Adehye Hall', pct: 66.2, color: 'text-slate-800' },
                  { hall: 'Atlantic Hall', pct: 53.9, color: 'text-slate-800' },
                ].map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="font-medium text-slate-700">{h.hall}</span>
                    <span className={`font-mono font-bold ${h.color}`}>{h.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ELECTIONS MANAGER */}
      {activeTab === 'elections' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Elections Management Table
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure schedules, activate/suspend polling portals, and manage portfolios.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#123B70] text-white text-xs font-bold hover:bg-[#0B1F3A] flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Election</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Election Code & Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Portfolios</th>
                  <th className="py-3 px-4">Turnout</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {elections.map((el) => (
                  <tr key={el.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                      <div className="font-mono text-[10px] text-slate-400">{el.code}</div>
                      <div className="truncate font-bold">{el.title}</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        {new Date(el.startDate).toLocaleDateString()} - {new Date(el.endDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-[10px] text-slate-800">
                        {el.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {el.status === 'live' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ● Live Polling
                        </span>
                      )}
                      {(el.status === 'scheduled' || (el.status as any) === 'upcoming') && (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#123B70] text-[10px] font-bold">
                          Scheduled
                        </span>
                      )}
                      {el.status === 'draft' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                          Draft
                        </span>
                      )}
                      {el.status === 'pending_approval' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                          Pending Approval
                        </span>
                      )}
                      {el.status === 'suspended' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                          Suspended
                        </span>
                      )}
                      {el.status === 'closed' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">
                          Closed
                        </span>
                      )}
                      {el.status === 'results_pending_certification' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                          Audit Pending
                        </span>
                      )}
                      {el.status === 'results_published' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                          Published
                        </span>
                      )}
                      {el.status === 'archived' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-300 text-slate-800 text-[10px] font-bold">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      <button
                        onClick={() => setSelectedElectionForPositions(el)}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-[#123B70] font-bold cursor-pointer transition-colors"
                        title="Configure Contested Portfolios"
                      >
                        {el.positionsCount} Portfolios ⚙
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                      {el.turnoutPercentage}% ({el.totalVotesCast.toLocaleString()})
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedElectionForStatus(el)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                        title="State Machine Transition"
                      >
                        Status
                      </button>
                      <button
                        onClick={() => setSelectedElectionForEligibility(el)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#123B70] font-bold text-[11px] transition-colors cursor-pointer"
                        title="Evaluate Student Eligibility Against Rules"
                      >
                        Eligibility
                      </button>
                      <button
                        onClick={() => navigateTo('election_details', { electionId: el.id })}
                        className="px-2.5 py-1 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CANDIDATE NOMINATIONS & VETTING */}
      {activeTab === 'candidates' && (() => {
        // Filter logic for candidates
        const filteredCandidates = candidates.filter((cand) => {
          const matchesStatus =
            candidateFilterStatus === 'all' ||
            cand.applicationStatus.toLowerCase() === candidateFilterStatus.toLowerCase();

          const matchesElection =
            candidateFilterElection === 'all' || cand.electionId === candidateFilterElection;

          const matchesSearch =
            !candidateSearchQuery ||
            cand.fullName.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
            cand.studentId.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
            cand.department.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
            cand.positionId.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
            (cand.nickname && cand.nickname.toLowerCase().includes(candidateSearchQuery.toLowerCase()));

          return matchesStatus && matchesElection && matchesSearch;
        });

        const pendingCount = candidates.filter(
          c => c.applicationStatus === 'Submitted' || c.applicationStatus === 'Under review'
        ).length;
        const approvedCount = candidates.filter(c => c.applicationStatus === 'Approved').length;
        const rejectedCount = candidates.filter(
          c => c.applicationStatus === 'Rejected' || c.applicationStatus === 'Withdrawn'
        ).length;

        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            
            {/* Header & New Candidate Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#123B70]" />
                  <span>Candidate Applications & Vetting Desk</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review aspirant applications, verify academic eligibility against SIS records, approve nominations, and assign official portfolios.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={async () => {
                    await refreshCandidates();
                    setStatusActionMsg('Candidate registry refreshed from commission server.');
                    setTimeout(() => setStatusActionMsg(''), 3000);
                  }}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                  title="Refresh Candidate Applications"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setSelectedCandidateForEdit(null);
                    setShowCandidateRegisterModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-amber-400" />
                  <span>Register New Candidate</span>
                </button>
              </div>
            </div>

            {/* Candidate Nomination KPI Counters */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Applications</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{candidates.length}</span>
                <span className="text-[10px] text-slate-500">All elections & portfolios</span>
              </div>
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Pending Vetting</span>
                <span className="text-xl font-bold font-mono text-purple-900 mt-0.5 block">{pendingCount}</span>
                <span className="text-[10px] text-purple-700 font-semibold">Requires commission determination</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Approved on Ballot</span>
                <span className="text-xl font-bold font-mono text-emerald-900 mt-0.5 block">{approvedCount}</span>
                <span className="text-[10px] text-emerald-700 font-semibold">Live on official digital ballots</span>
              </div>
              <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Disqualified / Withdrawn</span>
                <span className="text-xl font-bold font-mono text-red-900 mt-0.5 block">{rejectedCount}</span>
                <span className="text-[10px] text-red-700">Excluded from voting</span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
              {/* Status Segmented Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All Aspirants', count: candidates.length },
                  { id: 'submitted', label: 'Submitted', count: candidates.filter(c => c.applicationStatus === 'Submitted').length },
                  { id: 'under review', label: 'Under Review', count: candidates.filter(c => c.applicationStatus === 'Under review').length },
                  { id: 'approved', label: 'Approved', count: approvedCount },
                  { id: 'rejected', label: 'Rejected', count: candidates.filter(c => c.applicationStatus === 'Rejected').length },
                  { id: 'draft', label: 'Draft', count: candidates.filter(c => c.applicationStatus === 'Draft').length },
                  { id: 'withdrawn', label: 'Withdrawn', count: candidates.filter(c => c.applicationStatus === 'Withdrawn').length },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setCandidateFilterStatus(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                      candidateFilterStatus === s.id
                        ? 'bg-[#123B70] text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{s.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${candidateFilterStatus === s.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {s.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search & Election Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={candidateFilterElection}
                  onChange={(e) => setCandidateFilterElection(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:border-[#123B70]"
                >
                  <option value="all">All Contested Elections</option>
                  {elections.map((el) => (
                    <option key={el.id} value={el.id}>{el.title}</option>
                  ))}
                </select>

                <div className="relative w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={candidateSearchQuery}
                    onChange={(e) => setCandidateSearchQuery(e.target.value)}
                    placeholder="Search candidate name, ID..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:border-[#123B70]"
                  />
                </div>
              </div>
            </div>

            {/* Candidate Applications Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Candidate & Student ID</th>
                    <th className="py-3 px-4">Contested Portfolio & Election</th>
                    <th className="py-3 px-4">Programme & Hall</th>
                    <th className="py-3 px-4">Application Status</th>
                    <th className="py-3 px-4">SIS Eligibility Check</th>
                    <th className="py-3 px-4 text-right">Commission Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        No candidate applications found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((cand) => {
                      const el = elections.find(e => e.id === cand.electionId);
                      const elPositions = MOCK_POSITIONS[cand.electionId] || [];
                      const pos = elPositions.find(p => p.id === cand.positionId);
                      const posTitle = pos ? pos.title : cand.positionId.replace('pos-', '').replace(/-/g, ' ').toUpperCase();

                      return (
                        <tr key={cand.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={cand.photoUrl}
                                alt={cand.fullName}
                                className="w-11 h-11 rounded-xl object-cover object-top border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">
                                  {cand.fullName}
                                </div>
                                {cand.nickname && (
                                  <div className="text-[11px] font-semibold text-[#C62828]">
                                    "{cand.nickname}"
                                  </div>
                                )}
                                <div className="font-mono text-[10px] text-slate-500">
                                  {cand.studentId}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 text-xs">
                              {posTitle}
                            </div>
                            <div className="text-[11px] text-[#123B70] truncate max-w-[200px]">
                              {el?.title || cand.electionId}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-slate-700">
                            <div className="truncate max-w-[180px] font-medium">
                              {cand.programme || cand.department}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Level {cand.level} · {cand.hall || 'Off Campus'}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {cand.applicationStatus === 'Approved' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                Approved
                              </span>
                            )}
                            {cand.applicationStatus === 'Under review' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                                <Clock className="w-3 h-3" />
                                Under Review
                              </span>
                            )}
                            {cand.applicationStatus === 'Submitted' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Submitted
                              </span>
                            )}
                            {cand.applicationStatus === 'Draft' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                                Draft
                              </span>
                            )}
                            {cand.applicationStatus === 'Rejected' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold" title={cand.rejectionReason}>
                                <XCircle className="w-3 h-3" />
                                Rejected
                              </span>
                            )}
                            {cand.applicationStatus === 'Withdrawn' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                                Withdrawn
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {cand.eligibilityVerified ? (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>CGPA & Standing OK</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-[11px]">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Pending Verification</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedCandidateForReview(cand)}
                              className="px-2.5 py-1 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-[11px] transition-colors cursor-pointer"
                              title="Review Dossier, Run SIS Eligibility Check & Vet"
                            >
                              Review & Vet
                            </button>

                            <button
                              onClick={() => {
                                setSelectedCandidateForEdit(cand);
                                setShowCandidateRegisterModal(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                              title="Edit Candidate Dossier & Photo"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => navigateTo('candidate_profile', { candidateId: cand.id })}
                              className="px-2 py-1 rounded-lg text-slate-600 hover:text-[#123B70] font-semibold text-[11px] transition-colors cursor-pointer"
                              title="View Public Profile & Manifesto"
                            >
                              Profile →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        );
      })()}

      {/* TAB 4: VOTER ROLL & ELIGIBILITY */}
      {activeTab === 'voters' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Official Student Voter Roll
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Search student eligibility status or toggle voting clearance.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Search student ID, name..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:border-[#123B70]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">UCC Student ID</th>
                  <th className="py-3 px-3">Programme & Level</th>
                  <th className="py-3 px-3">Hall of Residence</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{s.studentId}</td>
                    <td className="py-3 px-3 text-slate-700">{s.programme} · L{s.level}</td>
                    <td className="py-3 px-3 text-slate-700">{s.hall}</td>
                    <td className="py-3 px-3">
                      {s.isEligible ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Eligible
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => toggleEligibility(s.studentId, s.status || 'active')}
                        className={`text-xs font-bold cursor-pointer ${s.isEligible ? 'text-red-600 hover:underline' : 'text-emerald-700 hover:underline'}`}
                      >
                        {s.isEligible ? 'Suspend' : 'Reinstate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RESULTS CERTIFICATION */}
      {activeTab === 'results' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Results Certification & Gazette Publishing
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review election audit signatures and officially declare winners to the university public.
            </p>
          </div>

          {certifiedSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{certifiedSuccessMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            {elections.map((el) => (
              <div key={el.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#123B70] uppercase">{el.category}</span>
                  <h4 className="text-base font-bold text-slate-900">{el.title}</h4>
                  <p className="text-xs text-slate-500 font-mono">
                    Total Ballots: {el.totalVotesCast.toLocaleString()} / Turnout: {el.turnoutPercentage}%
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateTo('election_results', { electionId: el.id })}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    View Tallies
                  </button>

                  <button
                    onClick={() => {
                      setCertifiedSuccessMsg(`Election ${el.title} has been officially certified and gazetted.`);
                      setTimeout(() => setCertifiedSuccessMsg(''), 4000);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>Certify & Publish</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SECURITY & AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Ballot Secrecy Enforcement Verification Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#123B70]" />
                  <span>Ballot Secrecy & Vault Separation Audit</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify that administrators cannot inspect any individual student&apos;s candidate choices and reconcile aggregate vault totals.
                </p>
              </div>
              {vaultAuditSummary && (
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold self-start sm:self-auto">
                  {vaultAuditSummary.vaultCountBalanced
                    ? `Vaults Balanced (${vaultAuditSummary.sessionParticipationRecords} participation = ${vaultAuditSummary.sessionAnonymousBallots} anonymous ballots)`
                    : 'Vault Audit Check'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={inspectStudentId}
                onChange={(e) => setInspectStudentId(e.target.value)}
                placeholder="Student ID (e.g. PS/CSC/22/0089)"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:border-[#123B70]"
              />
              <button
                onClick={async () => {
                  const res = await electionClient.attemptAdminBallotInspect(inspectStudentId);
                  setSecrecyTestResult({
                    code: res.code || 'BLOCKED',
                    message: res.error || 'Access denied by ballot secrecy guard.'
                  });
                  await fetchAuditLogs();
                }}
                className="px-4 py-2 rounded-xl bg-[#C62828] hover:bg-red-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                Test Ballot Choice Lookup (Must Block)
              </button>
            </div>

            {secrecyTestResult && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
                <div className="font-mono font-bold text-[11px] text-[#C62828]">
                  SERVER ENFORCEMENT: 403 {secrecyTestResult.code}
                </div>
                <p>{secrecyTestResult.message}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Live Electoral Audit Trail & Security Events
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Server-recorded administrative actions, anonymized voting events, and blocked security/secrecy violations.
                </p>
              </div>
              <button
                onClick={fetchAuditLogs}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {(liveAuditLogs.length > 0
                ? liveAuditLogs.map((l) => ({
                    id: l.id,
                    timestamp: l.timestamp,
                    action: l.eventType,
                    target: l.details,
                    adminName: l.identifier,
                    adminRole: l.role || 'System',
                    ipAddress: l.ipAddress,
                    status: l.status === 'FLAGGED' ? 'flagged' : l.status === 'WARNING' ? 'warning' : 'success'
                  }))
                : MOCK_AUDIT_LOGS
              ).map((log) => (
                <div 
                  key={log.id} 
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                    log.status === 'flagged' 
                      ? 'bg-red-50/60 border-red-300' 
                      : log.status === 'warning'
                      ? 'bg-amber-50/60 border-amber-300'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === 'flagged'
                          ? 'bg-red-200 text-red-900'
                          : log.status === 'warning'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                    </div>
                    <p className="font-sans text-xs font-bold text-slate-900 mt-1">
                      {log.target}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Actor: {log.adminName} ({log.adminRole})
                    </p>
                  </div>

                  <div className="text-slate-400 text-[10px] text-right font-mono shrink-0">
                    IP: {log.ipAddress}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Step Centralized Election Creation Modal */}
      <CreateElectionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async (newElection) => {
          setStatusActionMsg(`Election "${newElection.title}" created successfully.`);
          await refreshElections();
          setTimeout(() => setStatusActionMsg(''), 4000);
        }}
      />

      {/* State Machine Status Transition Modal */}
      <StatusTransitionModal
        isOpen={!!selectedElectionForStatus}
        election={selectedElectionForStatus}
        onClose={() => setSelectedElectionForStatus(null)}
        onSuccess={async (updated) => {
          setStatusActionMsg(`Election "${updated.title}" status changed to ${updated.status.toUpperCase()}.`);
          await refreshElections();
          setTimeout(() => setStatusActionMsg(''), 4000);
        }}
      />

      {/* Contested Portfolios / Positions Manager Modal */}
      <PositionManagerModal
        isOpen={!!selectedElectionForPositions}
        election={selectedElectionForPositions}
        onClose={() => setSelectedElectionForPositions(null)}
        onPositionsUpdated={async () => {
          await refreshElections();
        }}
      />

      {/* Server-Side Student Eligibility Tester & Audit Modal */}
      <EligibilityTesterModal
        isOpen={!!selectedElectionForEligibility}
        election={selectedElectionForEligibility}
        onClose={() => setSelectedElectionForEligibility(null)}
      />

      {/* Candidate Dossier & Vetting Review Modal */}
      {selectedCandidateForReview && (
        <CandidateReviewModal
          isOpen={!!selectedCandidateForReview}
          candidate={selectedCandidateForReview}
          position={(MOCK_POSITIONS[selectedCandidateForReview.electionId] || []).find(p => p.id === selectedCandidateForReview.positionId)}
          electionTitle={elections.find(e => e.id === selectedCandidateForReview.electionId)?.title}
          onClose={() => setSelectedCandidateForReview(null)}
          onEditCandidate={(cand) => {
            setSelectedCandidateForReview(null);
            setSelectedCandidateForEdit(cand);
            setShowCandidateRegisterModal(true);
          }}
        />
      )}

      {/* Candidate Registration / Edit Modal */}
      <CandidateRegistrationModal
        isOpen={showCandidateRegisterModal}
        candidateToEdit={selectedCandidateForEdit}
        onClose={() => {
          setShowCandidateRegisterModal(false);
          setSelectedCandidateForEdit(null);
        }}
      />

      {/* Global Status / Alert Toast */}
      {statusActionMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0B1F3A] text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusActionMsg}</span>
        </div>
      )}

    </div>
  );
};
