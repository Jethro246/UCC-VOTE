import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MOCK_AUDIT_LOGS } from '../../data/mockData';
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
  AlertTriangle,
  FileText,
  RefreshCw,
  UserPlus,
  Building,
  Layers
} from 'lucide-react';
import { AdminProfile, AdminRoleType, DomainId, Election, Candidate } from '../../types';
import { CreateElectionModal } from '../../components/admin/CreateElectionModal';
import { StatusTransitionModal } from '../../components/admin/StatusTransitionModal';
import { PositionManagerModal } from '../../components/admin/PositionManagerModal';
import { EligibilityTesterModal } from '../../components/admin/EligibilityTesterModal';
import { CandidateRegistrationModal } from '../../components/admin/CandidateRegistrationModal';
import { CandidateReviewModal } from '../../components/admin/CandidateReviewModal';
import { AdminResultsPanel } from '../../components/admin/AdminResultsPanel';

function matchesHallScope(criteriaHalls: string[] | undefined, managedHalls: string[] | undefined): boolean {
  if (!managedHalls || managedHalls.length === 0) return true;
  if (!criteriaHalls || criteriaHalls.length === 0) return false;
  return criteriaHalls.some((ch) =>
    managedHalls.some((mh) => {
      const a = ch.toLowerCase();
      const b = mh.toLowerCase();
      return a.includes(b) || b.includes(a) || (a.includes('casford') && b.includes('casely')) || (a.includes('casely') && b.includes('casford'));
    })
  );
}

export const AdminDashboard: React.FC = () => {
  const {
    admin,
    elections,
    domains,
    halls,
    faculties,
    departments,
    positionsByElection,
    navigateTo,
    refreshElections,
    refreshDomains,
    candidates,
    refreshCandidates
  } = useApp();

  const isGlobalGovernanceAdmin =
    admin?.role === 'Super Administrator' || admin?.role === 'Electoral Commissioner';

  const permittedDomains = admin?.managedDomainIds?.length
    ? domains.filter((d) => admin.managedDomainIds!.includes(d.id))
    : domains;

  const [selectedDomainWorkspace, setSelectedDomainWorkspace] = useState<'all' | DomainId>(() => {
    if (admin?.managedDomainIds && admin.managedDomainIds.length === 1) {
      return admin.managedDomainIds[0];
    }
    return 'all';
  });

  useEffect(() => {
    if (admin?.managedDomainIds && admin.managedDomainIds.length === 1) {
      setSelectedDomainWorkspace(admin.managedDomainIds[0]);
    }
  }, [admin?.id]);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'elections' | 'candidates' | 'voters' | 'results' | 'domains_rbac' | 'audit'
  >('overview');

  const [liveAuditLogs, setLiveAuditLogs] = useState<any[]>([]);
  const [inspectStudentId, setInspectStudentId] = useState('PS/CSC/22/0089');
  const [secrecyTestResult, setSecrecyTestResult] = useState<{ code?: string; message: string } | null>(null);
  const [vaultAuditSummary, setVaultAuditSummary] = useState<any>(null);

  const fetchAuditLogs = async () => {
    try {
      const res = await authClient.authorizedFetch('/api/admin/audit-logs');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLiveAuditLogs(data.logs);
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
      const firstElectionId = scopedElections[0]?.id || 'UCC-SRC-2026';
      electionClient.getVotingAuditSummary(firstElectionId).then((r) => {
        if (r.success && r.summary) setVaultAuditSummary(r.summary);
      });
    }
  }, [activeTab]);

  // Domain & RBAC Management State (Super Admin / EC)
  const [adminAccounts, setAdminAccounts] = useState<AdminProfile[]>([]);
  const [rbacError, setRbacError] = useState('');
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainShortName, setNewDomainShortName] = useState('');
  const [newDomainCategory, setNewDomainCategory] = useState<'Other' | 'Faculty / School' | 'Departmental'>('Other');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [newDomainEligSummary, setNewDomainEligSummary] = useState('');

  const [subTargetDomain, setSubTargetDomain] = useState<DomainId>('jcrc_hall');
  const [newSubName, setNewSubName] = useState('');
  const [newSubShort, setNewSubShort] = useState('');
  const [newSubFacultyId, setNewSubFacultyId] = useState('fac-sps');

  const [newAdminStaffId, setNewAdminStaffId] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRoleType>('Hall Election Administrator');
  const [newAdminDept, setNewAdminDept] = useState('');
  const [newAdminDomainId, setNewAdminDomainId] = useState<DomainId>('jcrc_hall');
  const [newAdminHallScope, setNewAdminHallScope] = useState('');

  const loadAdminAccounts = async () => {
    if (!isGlobalGovernanceAdmin) return;
    const res = await electionClient.getAdminAccounts();
    if (res.success) {
      setAdminAccounts(res.admins);
    }
  };

  useEffect(() => {
    if (activeTab === 'domains_rbac' && isGlobalGovernanceAdmin) {
      loadAdminAccounts();
    }
  }, [activeTab, isGlobalGovernanceAdmin]);

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

  const [statusActionMsg, setStatusActionMsg] = useState('');

  // Sample student registry for management
  const [studentRegistry, setStudentRegistry] = useState([
    { id: '1', studentId: 'PS/CSC/22/0089', name: 'Kofi Mensah Sarbah', programme: 'B.Sc. Computer Science', level: '300', hall: 'Casely Hayford Hall', isEligible: true, status: 'active' },
    { id: '2', studentId: 'ED/EPS/21/0034', name: 'Nana Akua Afriyie Osei', programme: 'B.Ed. Psychology', level: '400', hall: 'Adehye Hall', isEligible: true, status: 'active' },
    { id: '3', studentId: 'PG/CSC/25/0018', name: 'Ama Serwaa Darko (Postgraduate Demo)', programme: 'M.Phil. Computer Science', level: 'Postgraduate', hall: 'Casely Hayford Hall', isEligible: true, status: 'active' },
    { id: '4', studentId: 'MED/SMS/24/0012', name: 'Kwame Osei Mensah', programme: 'MB ChB Medicine & Surgery', level: '100', hall: 'Off-Campus Private Hostel', isEligible: true, status: 'active' },
    { id: '5', studentId: 'SB/ACC/21/0112', name: 'Richmond Kwabena Frimpong', programme: 'B.Com. Accounting', level: '400', hall: 'Valco Hall', isEligible: true, status: 'active' },
    { id: '6', studentId: 'AS/COM/22/0104', name: 'Emmanuel Kofi Annan', programme: 'B.A. Communication', level: '300', hall: 'Valco Hall', isEligible: true, status: 'active' },
    { id: '7', studentId: 'AS/HIS/22/0055', name: 'Kojo Adomako Danquah', programme: 'B.A. History', level: '300', hall: 'Casely Hayford Hall', isEligible: false, status: 'suspended' }
  ]);

  const toggleEligibility = async (studentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await authClient.authorizedFetch(
        `/api/admin/students/${encodeURIComponent(studentId)}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, reason: 'Administrative commission action' })
        }
      );
      const data = await res.json();
      if (data.success) {
        setStatusActionMsg(`Account ${studentId} marked as ${newStatus.toUpperCase()}.`);
        setTimeout(() => setStatusActionMsg(''), 3000);
      }
    } catch {
      // ignore transient error
    }

    setStudentRegistry((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, isEligible: newStatus === 'active', status: newStatus }
          : s
      )
    );
  };

  // Scope elections strictly by Admin RBAC + selected Domain Workspace
  const rbacElections = elections.filter((el) => {
    if (admin?.managedDomainIds?.length && el.domainId && !admin.managedDomainIds.includes(el.domainId)) {
      return false;
    }
    if (admin?.managedHalls?.length && el.domainId === 'jcrc_hall') {
      if (!matchesHallScope(el.eligibilityCriteria?.halls, admin.managedHalls)) {
        return false;
      }
    }
    if (admin?.managedFaculties?.length && (el.domainId === 'faculty_school' || el.domainId === 'departmental')) {
      const facs = el.eligibilityCriteria?.faculties || [];
      if (!facs.some((f) => admin.managedFaculties!.some((mf) => f.toLowerCase().includes(mf.toLowerCase())))) {
        return false;
      }
    }
    if (admin?.managedDepartments?.length && el.domainId === 'departmental') {
      const depts = el.eligibilityCriteria?.departments || [];
      if (!depts.some((d) => admin.managedDepartments!.some((md) => d.toLowerCase().includes(md.toLowerCase())))) {
        return false;
      }
    }
    return true;
  });

  const scopedElections =
    selectedDomainWorkspace === 'all'
      ? rbacElections
      : rbacElections.filter((e) => e.domainId === selectedDomainWorkspace);

  const scopedElectionIds = new Set(scopedElections.map((e) => e.id));
  const scopedCandidates = candidates.filter((c) => scopedElectionIds.has(c.electionId));

  const filteredStudents = studentRegistry.filter(
    (s) =>
      s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.hall.toLowerCase().includes(searchStudent.toLowerCase())
  );

  const showSuccessToast = (msg: string) => {
    setStatusActionMsg(msg);
    setTimeout(() => setStatusActionMsg(''), 4000);
  };

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setRbacError('');
    const res = await electionClient.createDomain({
      name: newDomainName.trim(),
      shortName: newDomainShortName.trim() || undefined,
      category: newDomainCategory,
      description: newDomainDesc.trim() || `${newDomainName.trim()} student governance domain.`,
      eligibilityRuleSummary:
        newDomainEligSummary.trim() || 'Accredited UCC student membership verified against registry.'
    });
    if (res.success) {
      await refreshDomains();
      setNewDomainName('');
      setNewDomainShortName('');
      setNewDomainDesc('');
      setNewDomainEligSummary('');
      showSuccessToast(`New election domain "${res.domain?.name}" registered.`);
    } else {
      setRbacError(res.error || 'Failed to create domain.');
    }
  };

  const handleCreateSubdomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setRbacError('');
    const type =
      subTargetDomain === 'jcrc_hall'
        ? 'hall'
        : subTargetDomain === 'faculty_school'
        ? 'faculty'
        : 'department';
    const facObj = faculties.find((f) => f.id === newSubFacultyId);
    const res = await electionClient.createSubdomain(subTargetDomain, {
      type,
      name: newSubName.trim(),
      shortName: newSubShort.trim() || undefined,
      facultyId: type === 'department' ? newSubFacultyId : undefined,
      facultyName: type === 'department' ? facObj?.name : undefined
    });
    if (res.success) {
      await refreshDomains();
      setNewSubName('');
      setNewSubShort('');
      showSuccessToast(`Subdomain "${res.subdomain?.name}" added to ${subTargetDomain}.`);
    } else {
      setRbacError(res.error || 'Failed to add subdomain.');
    }
  };

  const handleCreateScopedAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setRbacError('');
    const res = await electionClient.createAdminAccount({
      staffId: newAdminStaffId.trim(),
      fullName: newAdminName.trim(),
      email: newAdminEmail.trim(),
      role: newAdminRole,
      department: newAdminDept.trim() || 'Electoral Administration',
      managedDomainIds: [newAdminDomainId],
      managedHalls: newAdminDomainId === 'jcrc_hall' && newAdminHallScope ? [newAdminHallScope] : undefined
    });
    if (res.success) {
      await loadAdminAccounts();
      setNewAdminStaffId('');
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminDept('');
      setNewAdminHallScope('');
      showSuccessToast(`Administrator ${res.admin?.staffId} provisioned.`);
    } else {
      setRbacError(res.error || 'Failed to create admin account.');
    }
  };

  return (
    <div className="space-y-6">

      {/* Admin Commission Header */}
      <div className="bg-[#0B1F3A] text-white p-6 sm:p-8 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <Logo variant="default" theme="dark" showWordmark={false} className="hidden sm:inline-flex" />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{admin?.role || 'Electoral Commissioner'}</span>
              {admin?.managedHalls?.length ? (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="text-sky-200">{admin.managedHalls.join(', ')}</span>
                </>
              ) : admin?.managedDepartments?.length ? (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="text-sky-200">{admin.managedDepartments.join(', ')}</span>
                </>
              ) : admin?.managedFaculties?.length ? (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="text-sky-200">{admin.managedFaculties.join(', ')}</span>
                </>
              ) : null}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Electoral Commission Administration Console
            </h1>

            <p className="text-xs sm:text-sm text-slate-300">
              Multi-domain governance for University of Cape Coast student elections, portfolios, vetting, and certified results.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Election</span>
          </button>
        </div>
      </div>

      {/* Domain Workspace Switcher */}
      {permittedDomains.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Layers className="w-4 h-4 text-[#123B70]" />
            <span>Domain Workspace:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {permittedDomains.length > 1 && (
              <button
                onClick={() => setSelectedDomainWorkspace('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  selectedDomainWorkspace === 'all'
                    ? 'bg-[#123B70] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Permitted Domains ({rbacElections.length})
              </button>
            )}
            {permittedDomains.map((dom) => {
              const count = rbacElections.filter((e) => e.domainId === dom.id).length;
              return (
                <button
                  key={dom.id}
                  onClick={() => setSelectedDomainWorkspace(dom.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    selectedDomainWorkspace === dom.id
                      ? 'bg-[#123B70] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {dom.shortName} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-none">
        {[
          { id: 'overview', label: 'Overview & Turnout', icon: LayoutDashboard },
          { id: 'elections', label: 'Elections Manager', icon: Vote },
          { id: 'candidates', label: 'Candidate Nominations', icon: Users },
          { id: 'voters', label: 'Voter Roll & Eligibility', icon: FileText },
          { id: 'results', label: 'Results Certification', icon: Award },
          ...(isGlobalGovernanceAdmin
            ? [{ id: 'domains_rbac', label: 'Domains & RBAC', icon: Building }]
            : []),
          { id: 'audit', label: 'Security & Audit Trail', icon: Lock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#123B70] text-white'
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Scoped Elections
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1 block">
                {scopedElections.length}
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block">
                Active domain workspace total
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Ballots Cast
              </span>
              <span className="text-2xl font-black text-[#123B70] font-mono tabular-nums mt-1 block">
                {scopedElections.reduce((sum, e) => sum + (e.totalVotesCast || 0), 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Across scoped domain races</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Active Polling Portals
              </span>
              <span className="text-2xl font-black text-amber-600 font-mono tabular-nums mt-1 block">
                {scopedElections.filter((e) => e.status === 'live').length} Live
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Currently accepting ballots</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Ballot Vault Separation
              </span>
              <span className="text-2xl font-black text-emerald-600 font-mono tabular-nums mt-1 block">
                ENFORCED
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Identity & ballot stores decoupled
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Domain-by-Domain Participation Overview
                </h3>
                <span className="text-xs text-slate-500 font-mono">Live domain registry</span>
              </div>

              <div className="space-y-3">
                {permittedDomains.map((dom) => {
                  const domElections = rbacElections.filter((e) => e.domainId === dom.id);
                  const totalCast = domElections.reduce((s, e) => s + (e.totalVotesCast || 0), 0);
                  const totalEligible = domElections.reduce((s, e) => s + (e.totalEligibleVoters || 0), 0);
                  const pct = totalEligible > 0 ? Math.min(100, Math.round((totalCast / totalEligible) * 1000) / 10) : 0;

                  return (
                    <div key={dom.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-semibold text-slate-800">
                          {dom.name} ({domElections.length} {domElections.length === 1 ? 'election' : 'elections'})
                        </span>
                        <span className="font-mono font-bold text-[#123B70] tabular-nums whitespace-nowrap">
                          {pct}% ({totalCast.toLocaleString()} votes)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#123B70] h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Participating Halls Registry
              </h3>
              <div className="space-y-2.5 text-xs">
                {halls.map((h) => {
                  const hallElections = rbacElections.filter(
                    (e) =>
                      e.domainId === 'jcrc_hall' &&
                      (e.hallId === h.id || matchesHallScope(e.eligibilityCriteria?.halls, [h.name]))
                  );
                  return (
                    <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-medium text-slate-700">{h.name}</span>
                      <span className="font-mono font-bold text-[#123B70] tabular-nums">
                        {hallElections.length} {hallElections.length === 1 ? 'poll' : 'polls'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ELECTIONS MANAGER */}
      {activeTab === 'elections' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Elections Management Table
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure schedules, state transitions, and dynamic portfolios within your authorized domains.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#123B70] text-white text-xs font-bold hover:bg-[#0B1F3A] flex items-center gap-1.5 cursor-pointer self-start sm:self-auto whitespace-nowrap"
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
                  <th className="py-3 px-4">Domain & Subdomain</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Portfolios</th>
                  <th className="py-3 px-4">Turnout</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedElections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      No elections found inside this domain workspace.
                    </td>
                  </tr>
                ) : (
                  scopedElections.map((el) => (
                    <tr key={el.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                        <div className="font-mono text-[10px] text-slate-400">{el.code}</div>
                        <div className="truncate font-bold">{el.title}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                          {new Date(el.startDate).toLocaleDateString()} – {new Date(el.endDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <div className="font-bold text-[#123B70] text-[11px]">{el.category}</div>
                        {el.subdomainLabel && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{el.subdomainLabel}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[11px] text-slate-800 uppercase">
                          {el.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        <button
                          onClick={() => setSelectedElectionForPositions(el)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-[#123B70] font-bold cursor-pointer transition-colors whitespace-nowrap"
                          title="Configure Contested Portfolios"
                        >
                          {el.positionsCount} Portfolios
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {el.turnoutPercentage}% ({el.totalVotesCast.toLocaleString()})
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedElectionForStatus(el)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Status
                        </button>
                        <button
                          onClick={() => setSelectedElectionForEligibility(el)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#123B70] font-bold text-[11px] transition-colors cursor-pointer"
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CANDIDATE NOMINATIONS & VETTING */}
      {activeTab === 'candidates' && (() => {
        const filteredCandidates = scopedCandidates.filter((cand) => {
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

        const pendingCount = scopedCandidates.filter(
          (c) => c.applicationStatus === 'Submitted' || c.applicationStatus === 'Under review'
        ).length;
        const approvedCount = scopedCandidates.filter((c) => c.applicationStatus === 'Approved').length;
        const rejectedCount = scopedCandidates.filter(
          (c) => c.applicationStatus === 'Rejected' || c.applicationStatus === 'Withdrawn'
        ).length;

        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#123B70]" />
                  <span>Candidate Applications & Vetting Desk</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review aspirant applications strictly scoped to your authorized election domains.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={async () => {
                    await refreshCandidates();
                    showSuccessToast('Candidate registry refreshed.');
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
                  className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4 text-amber-400" />
                  <span>Register New Candidate</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Applications</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{scopedCandidates.length}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Pending Vetting</span>
                <span className="text-xl font-bold font-mono text-purple-900 mt-0.5 block">{pendingCount}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Approved on Ballot</span>
                <span className="text-xl font-bold font-mono text-emerald-900 mt-0.5 block">{approvedCount}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Rejected / Withdrawn</span>
                <span className="text-xl font-bold font-mono text-red-900 mt-0.5 block">{rejectedCount}</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All', count: scopedCandidates.length },
                  { id: 'submitted', label: 'Submitted', count: scopedCandidates.filter((c) => c.applicationStatus === 'Submitted').length },
                  { id: 'under review', label: 'Under Review', count: scopedCandidates.filter((c) => c.applicationStatus === 'Under review').length },
                  { id: 'approved', label: 'Approved', count: approvedCount },
                  { id: 'rejected', label: 'Rejected', count: scopedCandidates.filter((c) => c.applicationStatus === 'Rejected').length },
                  { id: 'draft', label: 'Draft', count: scopedCandidates.filter((c) => c.applicationStatus === 'Draft').length },
                  { id: 'withdrawn', label: 'Withdrawn', count: scopedCandidates.filter((c) => c.applicationStatus === 'Withdrawn').length }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setCandidateFilterStatus(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      candidateFilterStatus === s.id
                        ? 'bg-[#123B70] text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s.label} ({s.count})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={candidateFilterElection}
                  onChange={(e) => setCandidateFilterElection(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:border-[#123B70]"
                >
                  <option value="all">All Scoped Elections</option>
                  {scopedElections.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.title}
                    </option>
                  ))}
                </select>

                <div className="relative w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={candidateSearchQuery}
                    onChange={(e) => setCandidateSearchQuery(e.target.value)}
                    placeholder="Search candidate, ID..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:border-[#123B70]"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Candidate & Student ID</th>
                    <th className="py-3 px-4">Contested Portfolio & Election</th>
                    <th className="py-3 px-4">Programme & Hall</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">SIS Verification</th>
                    <th className="py-3 px-4 text-right">Actions</th>
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
                      const el = elections.find((e) => e.id === cand.electionId);
                      const elPositions = positionsByElection[cand.electionId] || [];
                      const pos = elPositions.find((p) => p.id === cand.positionId);
                      const posTitle = pos ? pos.title : cand.positionId;

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
                                <div className="font-bold text-slate-900 truncate">{cand.fullName}</div>
                                <div className="font-mono text-[10px] text-slate-500">{cand.studentId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 text-xs">{posTitle}</div>
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
                          <td className="py-3 px-4 font-bold text-[11px]">
                            <span
                              className={
                                cand.applicationStatus === 'Approved'
                                  ? 'text-emerald-700'
                                  : cand.applicationStatus === 'Rejected'
                                  ? 'text-red-700'
                                  : 'text-slate-700'
                              }
                            >
                              {cand.applicationStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {cand.eligibilityVerified ? (
                              <span className="text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Verified
                              </span>
                            ) : (
                              <span className="text-amber-600 font-semibold text-[11px] inline-flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedCandidateForReview(cand)}
                              className="px-2.5 py-1 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-[11px] cursor-pointer"
                            >
                              Review & Vet
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCandidateForEdit(cand);
                                setShowCandidateRegisterModal(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                            >
                              Edit
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Demonstration Student Voter Roll
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect student registry affiliations (Undergraduate, Postgraduate, Hall) and toggle clearance.
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
                    <td className="py-3 px-3 text-slate-700">{s.programme} · {s.level}</td>
                    <td className="py-3 px-3 text-slate-700">{s.hall}</td>
                    <td className="py-3 px-3 font-bold text-[11px]">
                      <span className={s.isEligible ? 'text-emerald-700' : 'text-red-700'}>
                        {s.isEligible ? 'Eligible' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => toggleEligibility(s.studentId, s.status || 'active')}
                        className={`text-xs font-bold cursor-pointer ${
                          s.isEligible ? 'text-red-600 hover:underline' : 'text-emerald-700 hover:underline'
                        }`}
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

      {/* TAB 5: RESULTS CERTIFICATION (Full Authoritative Panel) */}
      {activeTab === 'results' && <AdminResultsPanel />}

      {/* TAB 6: DOMAINS, SUBDOMAINS & RBAC GOVERNANCE (Super Admin / EC) */}
      {activeTab === 'domains_rbac' && isGlobalGovernanceAdmin && (
        <div className="space-y-6">
          {rbacError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
              {rbacError}
            </div>
          )}

          {/* Create New Domain & Subdomain */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleCreateDomain} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create New Election Domain</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register an independent student governance domain (e.g. Sports Council, Judicial Board, Alumni Chapter).
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Domain Name *</label>
                  <input
                    type="text"
                    required
                    value={newDomainName}
                    onChange={(e) => setNewDomainName(e.target.value)}
                    placeholder="e.g. Distance Education Students"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Short Label</label>
                  <input
                    type="text"
                    value={newDomainShortName}
                    onChange={(e) => setNewDomainShortName(e.target.value)}
                    placeholder="e.g. CoDE"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Mapping</label>
                <select
                  value={newDomainCategory}
                  onChange={(e) => setNewDomainCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Other">Other Approved Student Body</option>
                  <option value="Faculty / School">Faculty / School</option>
                  <option value="Departmental">Departmental</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Eligibility Policy Summary</label>
                <input
                  type="text"
                  value={newDomainEligSummary}
                  onChange={(e) => setNewDomainEligSummary(e.target.value)}
                  placeholder="Who is eligible to vote in this domain?"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold cursor-pointer"
              >
                Register Domain
              </button>
            </form>

            <form onSubmit={handleCreateSubdomain} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Register Subdomain Unit</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add a participating Residential Hall, Faculty/School, or Academic Department dynamically.
                </p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Domain</label>
                <select
                  value={subTargetDomain}
                  onChange={(e) => setSubTargetDomain(e.target.value as DomainId)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="jcrc_hall">JCRC / Hall Elections (Add Hall)</option>
                  <option value="faculty_school">Faculty / School Elections (Add Faculty/School)</option>
                  <option value="departmental">Departmental Elections (Add Department)</option>
                </select>
              </div>
              {subTargetDomain === 'departmental' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Parent Faculty / School</label>
                  <select
                    value={newSubFacultyId}
                    onChange={(e) => setNewSubFacultyId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subdomain Name *</label>
                  <input
                    type="text"
                    required
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="e.g. Superannuation Hall"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Short Code</label>
                  <input
                    type="text"
                    value={newSubShort}
                    onChange={(e) => setNewSubShort(e.target.value)}
                    placeholder="e.g. SUP"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold cursor-pointer"
              >
                Add Subdomain Unit
              </button>
            </form>
          </div>

          {/* Domain Administrators & Scope Assignment */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 text-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Domain Administrators & RBAC Scope Assignment
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign domain-specific or hall-specific administrative authority. Cross-domain modifications are enforced by backend RBAC (`403 DOMAIN_RBAC_DENIED`).
              </p>
            </div>

            <form onSubmit={handleCreateScopedAdmin} className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={newAdminStaffId}
                onChange={(e) => setNewAdminStaffId(e.target.value)}
                placeholder="Staff ID (e.g. UCC/DOM/OGU/01)"
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
              <input
                type="text"
                required
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Administrator Full Name"
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="official.email@ucc.edu.gh"
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value as AdminRoleType)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="SRC Election Administrator">SRC Election Administrator</option>
                <option value="Hall Election Administrator">Hall Election Administrator</option>
                <option value="GRASAG Election Administrator">GRASAG Election Administrator</option>
                <option value="Local NUGS Election Administrator">Local NUGS Election Administrator</option>
                <option value="Departmental Election Administrator">Departmental Election Administrator</option>
                <option value="Faculty/School Election Administrator">Faculty/School Election Administrator</option>
              </select>
              <select
                value={newAdminDomainId}
                onChange={(e) => setNewAdminDomainId(e.target.value as DomainId)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    Scope: {d.name}
                  </option>
                ))}
              </select>
              {newAdminDomainId === 'jcrc_hall' ? (
                <select
                  value={newAdminHallScope}
                  onChange={(e) => setNewAdminHallScope(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">All Halls</option>
                  {halls.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={newAdminDept}
                  onChange={(e) => setNewAdminDept(e.target.value)}
                  placeholder="Unit / Board Label"
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              )}
              <button
                type="submit"
                className="sm:col-span-3 px-4 py-2 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold cursor-pointer justify-self-start"
              >
                Provision Scoped Administrator (Demo Passkey: Admin@UCC2026)
              </button>
            </form>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Staff ID</th>
                    <th className="py-2.5 px-3">Name & Unit</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Domain & Subdomain Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminAccounts.map((acc) => (
                    <tr key={acc.staffId}>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{acc.staffId}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{acc.fullName}</div>
                        <div className="text-[11px] text-slate-500">{acc.department}</div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#123B70]">{acc.role}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>Domains: {(acc.managedDomainIds || ['All']).join(', ')}</div>
                        {acc.managedHalls?.length ? (
                          <div className="text-[11px] text-slate-500">Hall: {acc.managedHalls.join(', ')}</div>
                        ) : null}
                        {acc.managedDepartments?.length ? (
                          <div className="text-[11px] text-slate-500">Dept: {acc.managedDepartments.join(', ')}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SECURITY & AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#123B70]" />
                  <span>Ballot Secrecy & Vault Separation Audit</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify that administrators cannot inspect any individual student&apos;s candidate choices.
                </p>
              </div>
              {vaultAuditSummary && (
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {vaultAuditSummary.vaultCountBalanced
                    ? `Vaults Balanced (${vaultAuditSummary.sessionParticipationRecords} participation = ${vaultAuditSummary.sessionAnonymousBallots} anonymous)`
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

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Live Electoral Audit Trail & Security Events
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Server-recorded administrative actions, anonymized voting events, and RBAC blocks.
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
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          log.status === 'flagged'
                            ? 'text-red-800'
                            : log.status === 'warning'
                            ? 'text-amber-800'
                            : 'text-emerald-800'
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                    </div>
                    <p className="font-sans text-xs font-bold text-slate-900 mt-1">{log.target}</p>
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

      {/* Modals */}
      <CreateElectionModal
        isOpen={showCreateModal}
        defaultDomainId={selectedDomainWorkspace === 'all' ? undefined : selectedDomainWorkspace}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async (newElection) => {
          showSuccessToast(`Election "${newElection.title}" created successfully.`);
          await refreshElections();
        }}
      />

      <StatusTransitionModal
        isOpen={!!selectedElectionForStatus}
        election={selectedElectionForStatus}
        onClose={() => setSelectedElectionForStatus(null)}
        onSuccess={async (updated) => {
          showSuccessToast(`Election "${updated.title}" status changed to ${updated.status.toUpperCase()}.`);
          await refreshElections();
        }}
      />

      <PositionManagerModal
        isOpen={!!selectedElectionForPositions}
        election={selectedElectionForPositions}
        onClose={() => setSelectedElectionForPositions(null)}
        onPositionsUpdated={async () => {
          await refreshElections();
        }}
      />

      <EligibilityTesterModal
        isOpen={!!selectedElectionForEligibility}
        election={selectedElectionForEligibility}
        onClose={() => setSelectedElectionForEligibility(null)}
      />

      {selectedCandidateForReview && (
        <CandidateReviewModal
          isOpen={!!selectedCandidateForReview}
          candidate={selectedCandidateForReview}
          position={(positionsByElection[selectedCandidateForReview.electionId] || []).find(
            (p) => p.id === selectedCandidateForReview.positionId
          )}
          electionTitle={elections.find((e) => e.id === selectedCandidateForReview.electionId)?.title}
          onClose={() => setSelectedCandidateForReview(null)}
          onEditCandidate={(cand) => {
            setSelectedCandidateForReview(null);
            setSelectedCandidateForEdit(cand);
            setShowCandidateRegisterModal(true);
          }}
        />
      )}

      <CandidateRegistrationModal
        isOpen={showCandidateRegisterModal}
        candidateToEdit={selectedCandidateForEdit}
        defaultElectionId={scopedElections[0]?.id}
        onClose={() => {
          setShowCandidateRegisterModal(false);
          setSelectedCandidateForEdit(null);
        }}
      />

      {statusActionMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0B1F3A] text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusActionMsg}</span>
        </div>
      )}

    </div>
  );
};
