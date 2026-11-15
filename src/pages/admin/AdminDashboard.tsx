import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { adminService } from '../../services/adminService';
import {
  createAnnouncement,
  createCalendarEvent,
  createNotification,
  deleteAnnouncement,
  updateComplaintTicket,
  updateStudentEligibilityAndStatus,
  writeAuditLog,
} from '../../services/firebaseDbService';
import { Logo } from '../../components/common/Logo';
import { CandidateAvatar } from '../../components/common/CandidateAvatar';
import { domainIdToCategory } from '../../data/uccStructure';
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
  AlertTriangle,
  FileText,
  RefreshCw,
  UserPlus,
  Building,
  Layers,
  Megaphone,
  Calendar,
  MessageSquareWarning,
  Trash2,
  Send,
  ExternalLink,
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
      return (
        a.includes(b) ||
        b.includes(a) ||
        (a.includes('casford') && b.includes('casely')) ||
        (a.includes('casely') && b.includes('casford'))
      );
    })
  );
}

export const AdminDashboard: React.FC = () => {
  const { admin, userRole, sessionChecked } = useApp();
  if (!sessionChecked || userRole !== 'admin' || !admin) {
    return null;
  }
  return <AdminDashboardContent />;
};

const AdminDashboardContent: React.FC = () => {
  const {
    admin,
    elections,
    domains,
    halls,
    faculties,
    positionsByElection,
    navigateTo,
    refreshElections,
    refreshDomains,
    candidates,
    refreshCandidates,
    allStudents,
    eligibilityRecords,
    auditLogs,
    complaints,
    announcements,
    calendarEvents,
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
    | 'overview'
    | 'elections'
    | 'candidates'
    | 'voters'
    | 'results'
    | 'communications'
    | 'domains_rbac'
    | 'audit'
  >('overview');

  const [manualAuditLogs, setManualAuditLogs] = useState<typeof auditLogs>([]);
  const [inspectStudentId, setInspectStudentId] = useState('');
  const [secrecyTestResult, setSecrecyTestResult] = useState<{ code?: string; message: string } | null>(null);
  const [vaultAuditSummary, setVaultAuditSummary] = useState<any>(null);

  // Scope elections strictly by Admin RBAC + selected Domain Workspace
  const rbacElections = useMemo(() => {
    return elections.filter((el) => {
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
  }, [elections, admin]);

  const scopedElections = useMemo(() => {
    return selectedDomainWorkspace === 'all'
      ? rbacElections
      : rbacElections.filter((e) => e.domainId === selectedDomainWorkspace);
  }, [rbacElections, selectedDomainWorkspace]);

  const scopedElectionIds = useMemo(() => new Set(scopedElections.map((e) => e.id)), [scopedElections]);
  const scopedCandidates = useMemo(
    () => candidates.filter((c) => scopedElectionIds.has(c.electionId)),
    [candidates, scopedElectionIds]
  );

  const fetchAuditLogs = async () => {
    const res = await adminService.getAuditLogs();
    if (res.success && Array.isArray(res.logs)) {
      setManualAuditLogs(res.logs);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
      const firstElectionId = scopedElections[0]?.id;
      if (firstElectionId) {
        adminService.getVotingAuditSummary(firstElectionId).then((r) => {
          if (r.success && r.summary) setVaultAuditSummary(r.summary);
        });
      } else {
        setVaultAuditSummary(null);
      }
    }
  }, [activeTab, scopedElections]);

  // Domain & RBAC Management State
  const [adminAccounts, setAdminAccounts] = useState<AdminProfile[]>([]);
  const [rbacError, setRbacError] = useState('');
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainShortName, setNewDomainShortName] = useState('');
  const [newDomainCategory, setNewDomainCategory] = useState<'Other' | 'Faculty / School' | 'Departmental'>('Other');
  const [newDomainEligSummary, setNewDomainEligSummary] = useState('');

  const [subTargetDomain, setSubTargetDomain] = useState<DomainId>('jcrc_hall');
  const [newSubName, setNewSubName] = useState('');
  const [newSubShort, setNewSubShort] = useState('');
  const [newSubFacultyId, setNewSubFacultyId] = useState(faculties[0]?.id || 'fac-sps');

  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminStaffId, setNewAdminStaffId] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRoleType>('Hall Election Administrator');
  const [newAdminDept, setNewAdminDept] = useState('');
  const [newAdminDomainId, setNewAdminDomainId] = useState<DomainId>('jcrc_hall');
  const [newAdminHallScope, setNewAdminHallScope] = useState('');

  const loadAdminAccounts = async () => {
    if (!isGlobalGovernanceAdmin) return;
    const res = await adminService.getAdminAccounts();
    if (res.success) {
      setAdminAccounts(res.admins);
    }
  };

  useEffect(() => {
    if (activeTab === 'domains_rbac' && isGlobalGovernanceAdmin) {
      loadAdminAccounts();
    }
  }, [activeTab, isGlobalGovernanceAdmin]);

  // Voter Roll & Eligibility State
  const [searchStudent, setSearchStudent] = useState('');
  const [voterBusyUid, setVoterBusyUid] = useState<string | null>(null);

  // Election & Candidate Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedElectionForStatus, setSelectedElectionForStatus] = useState<Election | null>(null);
  const [selectedElectionForPositions, setSelectedElectionForPositions] = useState<Election | null>(null);
  const [selectedElectionForEligibility, setSelectedElectionForEligibility] = useState<Election | null>(null);

  const [selectedCandidateForReview, setSelectedCandidateForReview] = useState<Candidate | null>(null);
  const [selectedCandidateForEdit, setSelectedCandidateForEdit] = useState<Candidate | null>(null);
  const [showCandidateRegisterModal, setShowCandidateRegisterModal] = useState(false);
  const [candidateFilterStatus, setCandidateFilterStatus] = useState<string>('all');
  const [candidateFilterElection, setCandidateFilterElection] = useState<string>('all');
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');

  // Announcements, Calendar & Complaints State
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annCategory, setAnnCategory] = useState<'general' | 'election' | 'deadline' | 'results' | 'security'>('election');
  const [annPinned, setAnnPinned] = useState(false);

  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifCategory, setNotifCategory] = useState<'election' | 'security' | 'deadline' | 'results'>('election');

  const [calTitle, setCalTitle] = useState('');
  const [calDate, setCalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [calCategory, setCalCategory] = useState<'nomination' | 'vetting' | 'campaign' | 'voting' | 'results'>('voting');
  const [calDesc, setCalDesc] = useState('');

  const [complaintDrafts, setComplaintDrafts] = useState<
    Record<string, { status: 'pending' | 'in_review' | 'resolved'; response: string }>
  >({});

  const [statusActionMsg, setStatusActionMsg] = useState('');

  const showSuccessToast = (msg: string) => {
    setStatusActionMsg(msg);
    setTimeout(() => setStatusActionMsg(''), 4000);
  };

  // Merge live Firestore students + voter_eligibility records
  const mergedStudents = useMemo(() => {
    const eligMap = new Map(eligibilityRecords.map((r) => [r.uid || r.id, r]));
    return allStudents.map((s) => {
      const uid = s.uid || s.id;
      const elig = eligMap.get(uid);
      const effectiveStatus = elig?.status || s.eligibilityStatus || (s.isEligible ? 'eligible' : 'pending_verification');
      const effectiveEligible = elig ? elig.isEligible === true && elig.status === 'eligible' : Boolean(s.isEligible);
      return {
        ...s,
        uid,
        effectiveStatus,
        effectiveEligible,
      };
    });
  }, [allStudents, eligibilityRecords]);

  const filteredStudents = useMemo(() => {
    const q = searchStudent.trim().toLowerCase();
    if (!q) return mergedStudents;
    return mergedStudents.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.studentId?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.hall?.toLowerCase().includes(q) ||
        s.programme?.toLowerCase().includes(q)
    );
  }, [mergedStudents, searchStudent]);

  const handleVoterEligibilityAction = async (
    studentUid: string,
    studentLabel: string,
    action: 'approve' | 'suspend' | 'ineligible'
  ) => {
    setVoterBusyUid(studentUid);
    try {
      const actorName = admin?.fullName || admin?.email || 'Electoral Commission';
      if (action === 'approve') {
        await updateStudentEligibilityAndStatus(studentUid, {
          isEligible: true,
          eligibilityStatus: 'eligible',
          status: 'active',
          reason: 'Verified against UCC electoral roll',
          verifiedBy: actorName,
        });
        await writeAuditLog({
          adminName: actorName,
          adminRole: admin?.role || 'Administrator',
          action: 'Approved UCC Voter Eligibility',
          target: studentLabel,
        });
        showSuccessToast(`${studentLabel} approved for eligible elections.`);
      } else if (action === 'suspend') {
        await updateStudentEligibilityAndStatus(studentUid, {
          isEligible: false,
          eligibilityStatus: 'suspended',
          status: 'suspended',
          reason: 'Account suspended by Electoral Commission',
          verifiedBy: actorName,
        });
        await writeAuditLog({
          adminName: actorName,
          adminRole: admin?.role || 'Administrator',
          action: 'Suspended Voter Account',
          target: studentLabel,
          status: 'warning',
        });
        showSuccessToast(`${studentLabel} suspended.`);
      } else {
        await updateStudentEligibilityAndStatus(studentUid, {
          isEligible: false,
          eligibilityStatus: 'ineligible',
          status: 'active',
          reason: 'Marked ineligible during electoral roll audit',
          verifiedBy: actorName,
        });
        await writeAuditLog({
          adminName: actorName,
          adminRole: admin?.role || 'Administrator',
          action: 'Marked Voter Ineligible',
          target: studentLabel,
        });
        showSuccessToast(`${studentLabel} marked ineligible.`);
      }
    } catch (err: any) {
      setRbacError(err?.message || 'Unable to update student eligibility.');
    } finally {
      setVoterBusyUid(null);
    }
  };

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setRbacError('');
    const res = await adminService.createDomain({
      name: newDomainName.trim(),
      shortName: newDomainShortName.trim() || undefined,
      category: newDomainCategory,
      description: `${newDomainName.trim()} student governance domain.`,
      eligibilityRuleSummary:
        newDomainEligSummary.trim() || 'Accredited UCC student membership verified against registry.',
    });
    if (res.success) {
      await refreshDomains();
      setNewDomainName('');
      setNewDomainShortName('');
      setNewDomainEligSummary('');
      showSuccessToast(`New election domain "${res.domain?.name}" registered.`);
    } else {
      setRbacError('Failed to create domain.');
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
    const res = await adminService.createSubdomain(subTargetDomain, {
      type,
      name: newSubName.trim(),
      shortName: newSubShort.trim() || undefined,
      facultyId: type === 'department' ? newSubFacultyId : undefined,
      facultyName: type === 'department' ? facObj?.name : undefined,
    });
    if (res.success) {
      await refreshDomains();
      setNewSubName('');
      setNewSubShort('');
      showSuccessToast(`Subdomain "${res.subdomain?.name}" added.`);
    } else {
      setRbacError('Failed to add subdomain.');
    }
  };

  const handleCreateScopedAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setRbacError('');
    const res = await adminService.createAdminAccount({
      uid: newAdminUid.trim() || undefined,
      staffId: newAdminStaffId.trim(),
      fullName: newAdminName.trim(),
      email: newAdminEmail.trim(),
      role: newAdminRole,
      department: newAdminDept.trim() || 'Electoral Administration',
      managedDomainIds: [newAdminDomainId],
      managedHalls: newAdminDomainId === 'jcrc_hall' && newAdminHallScope ? [newAdminHallScope] : undefined,
    });
    if (res.success) {
      await loadAdminAccounts();
      setNewAdminUid('');
      setNewAdminStaffId('');
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminDept('');
      setNewAdminHallScope('');
      showSuccessToast(`Administrator ${res.admin?.staffId || newAdminStaffId} provisioned.`);
    } else {
      setRbacError(res.error || 'Failed to create admin account.');
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;
    await createAnnouncement({
      title: annTitle,
      message: annMessage,
      category: annCategory,
      domainId: selectedDomainWorkspace === 'all' ? undefined : selectedDomainWorkspace,
      publishedBy: admin?.fullName || 'Electoral Commission',
      pinned: annPinned,
    });
    setAnnTitle('');
    setAnnMessage('');
    setAnnPinned(false);
    showSuccessToast('Official announcement published to Firestore.');
  };

  const handlePublishNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;
    await createNotification({
      title: notifTitle,
      message: notifMessage,
      category: notifCategory,
      domainId: selectedDomainWorkspace === 'all' ? undefined : selectedDomainWorkspace,
    });
    setNotifTitle('');
    setNotifMessage('');
    showSuccessToast('Notification dispatched to authenticated voters.');
  };

  const handleCreateCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calTitle.trim() || !calDate) return;
    await createCalendarEvent({
      title: calTitle.trim(),
      electionCategory:
        selectedDomainWorkspace === 'all' ? 'SRC' : domainIdToCategory(selectedDomainWorkspace),
      startDate: calDate,
      endDate: calDate,
      type: calCategory,
      location: 'UCC Campus & Online Voting Portal',
      description: calDesc.trim() || 'Official UCC Electoral Commission milestone.',
      domainId: selectedDomainWorkspace === 'all' ? undefined : selectedDomainWorkspace,
    });
    setCalTitle('');
    setCalDesc('');
    showSuccessToast('Milestone added to Election Calendar.');
  };

  const handleSaveComplaintUpdate = async (complaintId: string) => {
    const existing = complaints.find((c) => c.id === complaintId);
    const draft = complaintDrafts[complaintId] || {
      status: existing?.status || 'in_review',
      response: existing?.response || '',
    };
    await updateComplaintTicket(complaintId, {
      status: draft.status,
      response: draft.response,
      resolvedBy: admin?.fullName || admin?.email || 'Electoral Commission',
    });
    showSuccessToast('Complaint ticket updated in Firestore.');
  };

  const displayedAuditLogs = auditLogs.length > 0 ? auditLogs : manualAuditLogs;

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
              Live Firebase governance console for University of Cape Coast elections, voter eligibility verification, vetting, and certified results.
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
          { id: 'communications', label: 'Announcements & Support', icon: Megaphone },
          ...(isGlobalGovernanceAdmin
            ? [{ id: 'domains_rbac', label: 'Domains & RBAC', icon: Building }]
            : []),
          { id: 'audit', label: 'Security & Audit Trail', icon: Lock },
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
                Registered Students
              </span>
              <span className="text-2xl font-black text-amber-600 font-mono tabular-nums mt-1 block">
                {allStudents.length}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {mergedStudents.filter((s) => s.effectiveEligible).length} verified eligible
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Ballot Vault Separation
              </span>
              <span className="text-2xl font-black text-emerald-600 font-mono tabular-nums mt-1 block">
                ENFORCED
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Firestore rules &amp; Cloud Function vault
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Domain-by-Domain Participation Overview
                </h3>
                <span className="text-xs text-slate-500 font-mono">Live Firestore counts</span>
              </div>

              <div className="space-y-3">
                {permittedDomains.map((dom) => {
                  const domElections = rbacElections.filter((e) => e.domainId === dom.id);
                  const totalCast = domElections.reduce((s, e) => s + (e.totalVotesCast || 0), 0);
                  const totalEligible = domElections.reduce((s, e) => s + (e.totalEligibleVoters || 0), 0);
                  const pct =
                    totalEligible > 0
                      ? Math.min(100, Math.round((totalCast / totalEligible) * 1000) / 10)
                      : 0;

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
              <h3 className="text-base font-bold text-slate-900">Participating Halls Registry</h3>
              <div className="space-y-2.5 text-xs">
                {halls.map((h) => {
                  const hallElections = rbacElections.filter(
                    (e) =>
                      e.domainId === 'jcrc_hall' &&
                      (e.hallId === h.id || matchesHallScope(e.eligibilityCriteria?.halls, [h.name]))
                  );
                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                    >
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
              <h3 className="text-base font-bold text-slate-900">Elections Management Table</h3>
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
                  <th className="py-3 px-4">Election Code &amp; Title</th>
                  <th className="py-3 px-4">Domain &amp; Subdomain</th>
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
                      No active elections at the moment.
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
      {activeTab === 'candidates' &&
        (() => {
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
                    <span>Candidate Applications &amp; Vetting Desk</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review aspirant nominations and upload portraits stored in Firebase Storage.
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
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Applications
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
                    {scopedCandidates.length}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                    Pending Vetting
                  </span>
                  <span className="text-xl font-bold font-mono text-purple-900 mt-0.5 block">
                    {pendingCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Approved on Ballot
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-900 mt-0.5 block">
                    {approvedCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
                  <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                    Rejected / Withdrawn
                  </span>
                  <span className="text-xl font-bold font-mono text-red-900 mt-0.5 block">
                    {rejectedCount}
                  </span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: 'all', label: 'All', count: scopedCandidates.length },
                    {
                      id: 'submitted',
                      label: 'Submitted',
                      count: scopedCandidates.filter((c) => c.applicationStatus === 'Submitted').length,
                    },
                    {
                      id: 'under review',
                      label: 'Under Review',
                      count: scopedCandidates.filter((c) => c.applicationStatus === 'Under review').length,
                    },
                    { id: 'approved', label: 'Approved', count: approvedCount },
                    {
                      id: 'rejected',
                      label: 'Rejected',
                      count: scopedCandidates.filter((c) => c.applicationStatus === 'Rejected').length,
                    },
                    {
                      id: 'draft',
                      label: 'Draft',
                      count: scopedCandidates.filter((c) => c.applicationStatus === 'Draft').length,
                    },
                    {
                      id: 'withdrawn',
                      label: 'Withdrawn',
                      count: scopedCandidates.filter((c) => c.applicationStatus === 'Withdrawn').length,
                    },
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
                      <th className="py-3 px-4">Candidate &amp; Student ID</th>
                      <th className="py-3 px-4">Contested Portfolio &amp; Election</th>
                      <th className="py-3 px-4">Programme &amp; Hall</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Verification</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                          No candidates have been added yet.
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
                                <CandidateAvatar
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
                                Review &amp; Vet
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
                Registered Voters &amp; UCC Eligibility Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Email verification only proves inbox control; use this panel to approve or restrict official UCC voting eligibility.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Search student ID, name, email..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:border-[#123B70]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Student Name &amp; Email</th>
                  <th className="py-3 px-3">UCC Student ID</th>
                  <th className="py-3 px-3">Programme &amp; Hall</th>
                  <th className="py-3 px-3">Email Auth</th>
                  <th className="py-3 px-3">Voter Eligibility</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500 text-xs">
                      No registered student profiles found in Firestore.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{s.fullName}</div>
                        <div className="text-[11px] text-slate-500">{s.email}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">{s.studentId}</td>
                      <td className="py-3 px-3 text-slate-700">
                        <div>{s.programme} · Level {s.level}</div>
                        <div className="text-[11px] text-slate-500">{s.hall}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-[11px]">
                        {s.emailVerified ? (
                          <span className="text-emerald-700">Verified</span>
                        ) : (
                          <span className="text-amber-700">Unverified</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-[11px] uppercase">
                        <span
                          className={
                            s.effectiveStatus === 'eligible'
                              ? 'text-emerald-700'
                              : s.effectiveStatus === 'suspended' || s.effectiveStatus === 'ineligible'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }
                        >
                          {s.effectiveStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                        {s.effectiveStatus !== 'eligible' && (
                          <button
                            disabled={voterBusyUid === s.uid}
                            onClick={() =>
                              handleVoterEligibilityAction(s.uid, `${s.fullName} (${s.studentId})`, 'approve')
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            Approve Eligibility
                          </button>
                        )}
                        {s.status !== 'suspended' && (
                          <button
                            disabled={voterBusyUid === s.uid}
                            onClick={() =>
                              handleVoterEligibilityAction(s.uid, `${s.fullName} (${s.studentId})`, 'suspend')
                            }
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                        {s.effectiveStatus !== 'ineligible' && (
                          <button
                            disabled={voterBusyUid === s.uid}
                            onClick={() =>
                              handleVoterEligibilityAction(s.uid, `${s.fullName} (${s.studentId})`, 'ineligible')
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            Mark Ineligible
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RESULTS CERTIFICATION */}
      {activeTab === 'results' && <AdminResultsPanel />}

      {/* TAB 6: ANNOUNCEMENTS, CALENDAR & COMPLAINTS */}
      {activeTab === 'communications' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Publish Announcement */}
            <form
              onSubmit={handlePublishAnnouncement}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Megaphone className="w-4 h-4 text-[#123B70]" />
                <span>Publish Official Announcement</span>
              </div>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Announcement headline"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
              <select
                value={annCategory}
                onChange={(e) => setAnnCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="election">Election Notice</option>
                <option value="deadline">Deadline Reminder</option>
                <option value="results">Results Bulletin</option>
                <option value="security">Security Notice</option>
                <option value="general">General Notice</option>
              </select>
              <textarea
                rows={3}
                required
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Announcement message for voters..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
              <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={annPinned}
                  onChange={(e) => setAnnPinned(e.target.checked)}
                />
                <span>Pin announcement</span>
              </label>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish Announcement</span>
              </button>
            </form>

            {/* Broadcast Notification */}
            <form
              onSubmit={handlePublishNotification}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Send className="w-4 h-4 text-[#123B70]" />
                <span>Dispatch Voter Notification</span>
              </div>
              <input
                type="text"
                required
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Notification title"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
              <select
                value={notifCategory}
                onChange={(e) => setNotifCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="election">Election Alert</option>
                <option value="deadline">Polling Deadline</option>
                <option value="results">Results Update</option>
                <option value="security">Security Alert</option>
              </select>
              <textarea
                rows={4}
                required
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Notification content delivered to voter inboxes..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Notification</span>
              </button>
            </form>

            {/* Add Calendar Milestone */}
            <form
              onSubmit={handleCreateCalendarEvent}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Calendar className="w-4 h-4 text-[#123B70]" />
                <span>Add Election Calendar Event</span>
              </div>
              <input
                type="text"
                required
                value={calTitle}
                onChange={(e) => setCalTitle(e.target.value)}
                placeholder="Milestone title (e.g. Nominations Close)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required
                  value={calDate}
                  onChange={(e) => setCalDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <select
                  value={calCategory}
                  onChange={(e) => setCalCategory(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="nomination">Nomination</option>
                  <option value="vetting">Vetting</option>
                  <option value="campaign">Campaign</option>
                  <option value="voting">Voting Day</option>
                  <option value="results">Results</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={calDesc}
                onChange={(e) => setCalDesc(e.target.value)}
                placeholder="Milestone summary and instructions..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Calendar Milestone</span>
              </button>
            </form>
          </div>

          {/* Active Announcements */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Published Announcements ({announcements.length}) &amp; Calendar Milestones ({calendarEvents.length})
            </h3>
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-500">No announcements available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900">{a.title}</div>
                      <p className="text-slate-600">{a.message}</p>
                      <div className="text-[10px] text-slate-400">
                        {a.category} · {a.publishedBy}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAnnouncement(a.id)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Complaints Desk */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="w-5 h-5 text-[#123B70]" />
              <h3 className="text-base font-bold text-slate-900">
                Electoral Petitions &amp; Student Support Tickets ({complaints.length})
              </h3>
            </div>

            {complaints.length === 0 ? (
              <p className="text-xs text-slate-500">No complaints or petitions submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {complaints.map((ticket) => {
                  const draft = complaintDrafts[ticket.id] || {
                    status: ticket.status,
                    response: ticket.response || '',
                  };
                  return (
                    <div
                      key={ticket.id}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-[#123B70] mr-2">
                            {ticket.ticketNumber}
                          </span>
                          <span className="font-bold text-slate-900">{ticket.subject}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {ticket.studentName} ({ticket.studentId})
                        </span>
                      </div>
                      <p className="text-slate-700">{ticket.description}</p>
                      {ticket.attachmentUrl && (
                        <a
                          href={ticket.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#123B70] font-semibold hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Evidence Attachment</span>
                        </a>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            setComplaintDrafts((prev) => ({
                              ...prev,
                              [ticket.id]: { ...draft, status: e.target.value as any },
                            }))
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_review">In Review</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <input
                          type="text"
                          value={draft.response}
                          onChange={(e) =>
                            setComplaintDrafts((prev) => ({
                              ...prev,
                              [ticket.id]: { ...draft, response: e.target.value },
                            }))
                          }
                          placeholder="Write official commission resolution..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                        <button
                          onClick={() => handleSaveComplaintUpdate(ticket.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold cursor-pointer"
                        >
                          Save Update
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: DOMAINS, SUBDOMAINS & RBAC GOVERNANCE (Super Admin / EC) */}
      {activeTab === 'domains_rbac' && isGlobalGovernanceAdmin && (
        <div className="space-y-6">
          {rbacError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
              {rbacError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleCreateDomain} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create New Election Domain</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register an independent student governance domain in Cloud Firestore.
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
                Domain Administrators &amp; RBAC Scope Assignment
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign domain-specific or hall-specific Firebase custom claims via the `setAdminRole` Cloud Function.
              </p>
            </div>

            <form
              onSubmit={handleCreateScopedAdmin}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <input
                type="text"
                value={newAdminUid}
                onChange={(e) => setNewAdminUid(e.target.value)}
                placeholder="Firebase Auth UID (optional if email registered)"
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
              <input
                type="text"
                required
                value={newAdminStaffId}
                onChange={(e) => setNewAdminStaffId(e.target.value)}
                placeholder="Staff ID (e.g. UCC/EC/014)"
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
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white sm:col-span-2"
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
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white sm:col-span-2"
                />
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold cursor-pointer justify-self-start"
              >
                Provision Scoped Administrator
              </button>
            </form>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Staff ID</th>
                    <th className="py-2.5 px-3">Name &amp; Unit</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Domain &amp; Subdomain Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No administrator records loaded.
                      </td>
                    </tr>
                  ) : (
                    adminAccounts.map((acc) => (
                      <tr key={acc.id || acc.staffId}>
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
                            <div className="text-[11px] text-slate-500">
                              Dept: {acc.managedDepartments.join(', ')}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: SECURITY & AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#123B70]" />
                  <span>Ballot Secrecy &amp; Vault Separation Audit</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify that administrators cannot inspect any individual student&apos;s candidate choices.
                </p>
              </div>
              {vaultAuditSummary && (
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {vaultAuditSummary.secrecyGuarantee}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={inspectStudentId}
                onChange={(e) => setInspectStudentId(e.target.value)}
                placeholder="Enter Student ID to verify secrecy guard"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:border-[#123B70]"
              />
              <button
                onClick={async () => {
                  const res = await adminService.attemptAdminBallotInspect(inspectStudentId.trim() || 'UNSPECIFIED');
                  setSecrecyTestResult({
                    code: res.code || 'BLOCKED',
                    message: res.error || 'Access denied by ballot secrecy guard.',
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
                  ZERO-TRUST GUARD: {secrecyTestResult.code}
                </div>
                <p>{secrecyTestResult.message}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Live Electoral Audit Trail &amp; Security Events
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time Firestore audit log entries for administrative actions and security checks.
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
              {displayedAuditLogs.length === 0 ? (
                <p className="font-sans text-xs text-slate-500 text-center py-6">
                  No audit log entries recorded yet.
                </p>
              ) : (
                displayedAuditLogs.map((log) => (
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
                      Source: {log.ipAddress || 'firebase-client'}
                    </div>
                  </div>
                ))
              )}
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
