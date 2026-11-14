import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { Election, DomainId } from '../../types';
import {
  ArrowLeft,
  Vote,
  Award,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  GraduationCap,
  ShieldCheck,
  ChevronRight,
  Layers
} from 'lucide-react';

function matchesHallClient(studentHall: string | undefined, targetHall: string): boolean {
  if (!studentHall) return false;
  const s = studentHall.trim().toLowerCase();
  const t = targetHall.trim().toLowerCase();
  if (s === t) return true;
  const aliases: Record<string, string[]> = {
    'casely hayford hall': ['casely hayford', 'casford'],
    'atlantic hall': ['atlantic', 'atl'],
    'adehye hall': ['adehye'],
    'oguaa hall': ['oguaa'],
    'kwame nkrumah hall': ['kwame nkrumah', 'knh', 'nkrumah'],
    'valco hall': ['valco']
  };
  for (const [canonical, list] of Object.entries(aliases)) {
    const sMatch = s.includes(canonical) || list.some((a) => s.includes(a));
    const tMatch = t.includes(canonical) || list.some((a) => t.includes(a));
    if (sMatch && tMatch) return true;
  }
  return s.includes(t) || t.includes(s);
}

function checkStudentDomainEligibility(
  election: Election,
  student: any
): { eligible: boolean; reason: string } {
  if (!student) {
    return {
      eligible: true,
      reason: 'Log in with your UCC Student ID to verify your voter eligibility.'
    };
  }
  if (student.status === 'suspended' || !student.isEligible) {
    return {
      eligible: false,
      reason: 'Your voter account is currently suspended or restricted.'
    };
  }
  const domId = election.domainId || (election.category === 'GRASAG' ? 'grasag' : undefined);
  if (domId === 'grasag' && student.level !== 'Postgraduate') {
    return {
      eligible: false,
      reason: 'GRASAG elections are strictly restricted to Postgraduate students.'
    };
  }

  const crit = election.eligibilityCriteria;
  if (crit) {
    if (crit.levels && crit.levels.length > 0 && !crit.levels.includes(student.level)) {
      return {
        eligible: false,
        reason: `Restricted to ${crit.levels.join(', ')} students (Your level: ${student.level}).`
      };
    }
    if (
      crit.halls &&
      crit.halls.length > 0 &&
      !crit.halls.some((h) => matchesHallClient(student.hall, h))
    ) {
      return {
        eligible: false,
        reason: `Restricted to ${crit.halls.join(', ')} (Your hall: ${student.hall}).`
      };
    }
    if (
      crit.faculties &&
      crit.faculties.length > 0 &&
      !crit.faculties.some((f) => student.faculty?.toLowerCase().includes(f.toLowerCase()))
    ) {
      return {
        eligible: false,
        reason: `Restricted to ${crit.faculties.join(', ')} (Your faculty: ${student.faculty}).`
      };
    }
    if (
      crit.departments &&
      crit.departments.length > 0 &&
      !crit.departments.some((d) => student.department?.toLowerCase().includes(d.toLowerCase()))
    ) {
      return {
        eligible: false,
        reason: `Restricted to Dept. of ${crit.departments.join(', ')} (Your dept: ${student.department}).`
      };
    }
    if (
      crit.programmes &&
      crit.programmes.length > 0 &&
      !crit.programmes.some((p) => student.programme?.toLowerCase().includes(p.toLowerCase()))
    ) {
      return {
        eligible: false,
        reason: `Restricted to ${crit.programmes.join(', ')} programmes.`
      };
    }
  }
  return { eligible: true, reason: 'Eligible to vote in this election' };
}

export const DomainElectionsPage: React.FC = () => {
  const {
    selectedDomainId,
    setSelectedDomainId,
    domains,
    halls,
    faculties,
    departments,
    elections,
    positionsByElection,
    candidates,
    student,
    userRole,
    navigateTo
  } = useApp();

  const [selectedHallId, setSelectedHallId] = useState<string>('All');
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('All');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  useEffect(() => {
    setSelectedHallId('All');
    setSelectedFacultyId('All');
    setSelectedDepartmentId('All');
    setStatusFilter('All');
  }, [selectedDomainId]);

  const activeDomain =
    domains.find((d) => d.id === selectedDomainId) ||
    domains[0] || {
      id: selectedDomainId,
      name: 'SRC General Elections',
      shortName: 'SRC',
      category: 'SRC',
      description: 'Central Students Representative Council elections.',
      governanceScope: 'All Enrolled Undergraduate Students',
      eligibilityRuleSummary: 'Undergraduate levels 100-400',
      positionsPolicyNote: 'Managed by Electoral Commission.',
      adminRole: 'SRC Election Administrator',
      supportsSubdomains: false,
      subdomainType: 'none' as const,
      isBuiltIn: true,
      displayOrder: 1,
      stats: {
        totalElections: 0,
        activeElections: 0,
        upcomingElections: 0,
        completedElections: 0,
        pendingCertification: 0,
        totalVotesCast: 0,
        approvedCandidatesCount: 0
      }
    };

  const domainElections = useMemo(() => {
    return elections.filter((e) => {
      if (
        userRole !== 'admin' &&
        (e.isPublished === false || e.status === 'draft' || e.status === 'pending_approval')
      ) {
        return false;
      }
      const domId =
        e.domainId ||
        (e.category === 'SRC'
          ? 'src'
          : e.category === 'JCR / Hall'
          ? 'jcrc_hall'
          : e.category === 'GRASAG'
          ? 'grasag'
          : e.category === 'Local NUGS'
          ? 'local_nugs'
          : e.category === 'Departmental'
          ? 'departmental'
          : e.category === 'Faculty / School'
          ? 'faculty_school'
          : 'src');
      return domId === activeDomain.id;
    });
  }, [elections, activeDomain.id, userRole]);

  const filteredDepartments = useMemo(() => {
    if (selectedFacultyId === 'All') return departments;
    return departments.filter((d) => d.facultyId === selectedFacultyId);
  }, [departments, selectedFacultyId]);

  const visibleElections = useMemo(() => {
    return domainElections.filter((e) => {
      if (activeDomain.subdomainType === 'hall' && selectedHallId !== 'All') {
        const hallObj = halls.find((h) => h.id === selectedHallId);
        const matchesId = e.hallId === selectedHallId;
        const matchesCriteria =
          hallObj &&
          e.eligibilityCriteria?.halls?.some((h) => matchesHallClient(h, hallObj.name));
        if (!matchesId && !matchesCriteria) return false;
      }
      if (
        (activeDomain.subdomainType === 'faculty' || activeDomain.subdomainType === 'department') &&
        selectedFacultyId !== 'All'
      ) {
        const facObj = faculties.find((f) => f.id === selectedFacultyId);
        const matchesId = e.facultyId === selectedFacultyId;
        const matchesCriteria =
          facObj &&
          e.eligibilityCriteria?.faculties?.some((f) =>
            f.toLowerCase().includes(facObj.name.toLowerCase())
          );
        if (!matchesId && !matchesCriteria) return false;
      }
      if (activeDomain.subdomainType === 'department' && selectedDepartmentId !== 'All') {
        const deptObj = departments.find((d) => d.id === selectedDepartmentId);
        const matchesId = e.departmentId === selectedDepartmentId;
        const matchesCriteria =
          deptObj &&
          e.eligibilityCriteria?.departments?.some((d) =>
            d.toLowerCase().includes(deptObj.name.toLowerCase())
          );
        if (!matchesId && !matchesCriteria) return false;
      }
      if (statusFilter !== 'All') {
        if (statusFilter === 'scheduled') {
          if (e.status !== 'scheduled' && e.status !== 'upcoming') return false;
        } else if (e.status !== statusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [
    domainElections,
    activeDomain.subdomainType,
    selectedHallId,
    selectedFacultyId,
    selectedDepartmentId,
    statusFilter,
    halls,
    faculties,
    departments
  ]);

  const selectedDeptObj = departments.find((d) => d.id === selectedDepartmentId);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Domain Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigateTo('elections_directory')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#123B70] transition-colors cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Election Domains</span>
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {domains.map((dom) => (
            <button
              key={dom.id}
              onClick={() => setSelectedDomainId(dom.id as DomainId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                dom.id === activeDomain.id
                  ? 'bg-[#123B70] text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {dom.shortName}
            </button>
          ))}
        </div>
      </div>

      {/* Domain Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Logo variant="default" showWordmark={false} className="hidden sm:inline-flex" />
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-[#123B70] uppercase tracking-wider">
                  {activeDomain.category} Domain
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeDomain.governanceScope}</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {activeDomain.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                {activeDomain.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                Total Races
              </span>
              <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900">
                {domainElections.length}
              </span>
            </div>
            <div className="border-x border-slate-200 px-3">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                Live Now
              </span>
              <span className="text-lg font-extrabold font-mono tabular-nums text-emerald-700">
                {domainElections.filter((e) => e.status === 'live').length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                Ballots Cast
              </span>
              <span className="text-lg font-extrabold font-mono tabular-nums text-[#123B70]">
                {domainElections
                  .reduce((acc, el) => acc + (el.totalVotesCast || 0), 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Governance & Constitution Policy Strip */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2 text-slate-700">
            <ShieldCheck className="w-4 h-4 text-[#123B70] shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-900">Eligibility Rule: </strong>
              {activeDomain.eligibilityRuleSummary}
            </span>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <Layers className="w-4 h-4 text-[#C62828] shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-900">Portfolio Policy: </strong>
              {activeDomain.positionsPolicyNote}
            </span>
          </div>
        </div>

        {/* GRASAG Isolation Callout for logged-in students */}
        {activeDomain.id === 'grasag' && student && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              student.level === 'Postgraduate'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {student.level === 'Postgraduate' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            )}
            <span>
              {student.level === 'Postgraduate'
                ? `Postgraduate status verified (${student.programme}). You are authorized for GRASAG-UCC polls and separated from undergraduate SRC/Hall ballots.`
                : `Your current academic record is Level ${student.level} (${student.programme}). GRASAG elections are strictly restricted to registered Postgraduate students.`}
            </span>
          </div>
        )}
      </div>

      {/* Subdomain Navigator: JCRC / Hall */}
      {activeDomain.subdomainType === 'hall' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-[#123B70]" />
                <span>Participating UCC Residential Halls (Independent JCRC Subdomains)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select a residential hall to inspect its independent JCRC positions, contestants, and digital ballot.
              </p>
            </div>
            {selectedHallId !== 'All' && (
              <button
                onClick={() => setSelectedHallId('All')}
                className="text-xs font-semibold text-[#123B70] hover:underline whitespace-nowrap cursor-pointer self-start"
              >
                Show All Halls
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {halls.map((hall) => {
              const hallElections = domainElections.filter(
                (e) =>
                  e.hallId === hall.id ||
                  e.eligibilityCriteria?.halls?.some((h) => matchesHallClient(h, hall.name))
              );
              const isSelected = selectedHallId === hall.id;
              const isStudentHall = student ? matchesHallClient(student.hall, hall.name) : false;

              return (
                <button
                  key={hall.id}
                  onClick={() => setSelectedHallId(isSelected ? 'All' : hall.id)}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#123B70] bg-[#EAF2FA]/50'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{hall.name}</span>
                    {isStudentHall && (
                      <span className="text-[10px] font-bold text-emerald-700 whitespace-nowrap">
                        Your Hall
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                    <span>{hallElections.length} Election{hallElections.length === 1 ? '' : 's'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {hallElections.some((e) => e.status === 'live')
                        ? 'Polling Open'
                        : hallElections.some((e) => e.status === 'results_published')
                        ? 'Results Published'
                        : 'Awaiting Schedule'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subdomain Navigator: Faculty / School & Departmental */}
      {(activeDomain.subdomainType === 'faculty' || activeDomain.subdomainType === 'department') && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#123B70]" />
              <span>
                {activeDomain.subdomainType === 'department'
                  ? 'Filter by Faculty / School, Department & Programme'
                  : 'Filter by Participating Faculty / School'}
              </span>
            </h2>
            {(selectedFacultyId !== 'All' || selectedDepartmentId !== 'All') && (
              <button
                onClick={() => {
                  setSelectedFacultyId('All');
                  setSelectedDepartmentId('All');
                }}
                className="text-xs font-semibold text-[#C62828] hover:underline whitespace-nowrap cursor-pointer"
              >
                Clear Academic Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Faculty / School
              </label>
              <select
                value={selectedFacultyId}
                onChange={(e) => {
                  setSelectedFacultyId(e.target.value);
                  setSelectedDepartmentId('All');
                }}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#123B70]"
              >
                <option value="All">All Faculties & Schools ({faculties.length})</option>
                {faculties.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} ({fac.code})
                  </option>
                ))}
              </select>
            </div>

            {activeDomain.subdomainType === 'department' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Academic Department
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#123B70]"
                >
                  <option value="All">All Departments ({filteredDepartments.length})</option>
                  {filteredDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} — {dept.facultyName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selectedDeptObj && (
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Recognized Programmes in {selectedDeptObj.name}: </span>
              <span>{selectedDeptObj.programmes.join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Status Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">
          Elections in {activeDomain.shortName}{' '}
          <span className="text-slate-400 font-mono text-xs tabular-nums">
            ({visibleElections.length})
          </span>
        </h2>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
        >
          <option value="All">All Statuses</option>
          <option value="live">Live Polling</option>
          <option value="scheduled">Scheduled / Upcoming</option>
          <option value="results_published">Results Published</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Elections List */}
      {visibleElections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <Clock className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            No Elections Currently Scheduled for Selection
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            This subdomain has no elections matching your current filter yet. Authorized Electoral Administrators can configure and publish new elections in the Admin Console.
          </p>
          {(selectedHallId !== 'All' ||
            selectedFacultyId !== 'All' ||
            selectedDepartmentId !== 'All' ||
            statusFilter !== 'All') && (
            <button
              onClick={() => {
                setSelectedHallId('All');
                setSelectedFacultyId('All');
                setSelectedDepartmentId('All');
                setStatusFilter('All');
              }}
              className="px-4 py-2 rounded-lg bg-[#123B70] text-white text-xs font-semibold hover:bg-[#0B1F3A] cursor-pointer"
            >
              Reset Subdomain Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visibleElections.map((election) => {
            const positions = positionsByElection[election.id] || [];
            const approvedCandsCount = candidates.filter(
              (c) => c.electionId === election.id && c.applicationStatus === 'Approved'
            ).length;
            const hasVoted = student?.hasVotedElections.includes(election.id);
            const elig = checkStudentDomainEligibility(election, student);
            const isLive = election.status === 'live';
            const isResults = election.status === 'results_published';

            return (
              <div
                key={election.id}
                className="bg-white rounded-2xl border border-slate-200 flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-3.5">
                  {/* Unboxed quiet metadata header */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-500 truncate">
                      <span className="font-bold text-[#123B70] uppercase tracking-wider">
                        {election.subdomainLabel || election.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{election.code}</span>
                      {election.isDemoRecord && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                          DEMO DATA
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-bold whitespace-nowrap ${
                        isLive
                          ? 'text-emerald-700'
                          : isResults
                          ? 'text-amber-700'
                          : 'text-[#123B70]'
                      }`}
                    >
                      {isLive
                        ? 'Polling Open'
                        : isResults
                        ? 'Certified Results'
                        : election.status === 'scheduled' || election.status === 'upcoming'
                        ? 'Scheduled'
                        : election.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 leading-snug">
                      {election.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {election.description}
                    </p>
                  </div>

                  {/* Contested Portfolios List (Constitution/Domain Specific) */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 uppercase tracking-wider">
                        Configured Portfolios ({positions.length || election.positionsCount})
                      </span>
                      <span className="text-slate-500">
                        {approvedCandsCount} Approved Candidate{approvedCandsCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    {positions.length > 0 ? (
                      <div className="text-xs text-slate-600 leading-relaxed">
                        {positions.map((p) => p.title).join(' · ')}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        Portfolios awaiting configuration by domain administrator.
                      </div>
                    )}
                  </div>

                  {/* Turnout & Eligibility */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Polling Window</span>
                      <span className="font-semibold text-slate-800 font-mono text-[11px] tabular-nums">
                        {election.startDate} – {election.endDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Turnout Progress</span>
                      <span className="font-bold text-[#123B70] font-mono tabular-nums">
                        {election.turnoutPercentage}% ({election.totalVotesCast.toLocaleString()} /{' '}
                        {election.totalEligibleVoters.toLocaleString()})
                      </span>
                    </div>
                  </div>

                  {student && (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] flex items-center gap-2 ${
                        elig.eligible
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50/70 border-amber-200 text-amber-900'
                      }`}
                    >
                      {elig.eligible ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      <span>{elig.reason}</span>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigateTo('election_details', { electionId: election.id })}
                      className="text-xs font-bold text-slate-700 hover:text-[#123B70] cursor-pointer whitespace-nowrap"
                    >
                      Details & Rules
                    </button>
                    <button
                      onClick={() => navigateTo('candidate_directory', { electionId: election.id })}
                      className="text-xs font-bold text-[#123B70] hover:underline cursor-pointer flex items-center gap-1 whitespace-nowrap"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Candidates</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {isLive && !hasVoted && elig.eligible && (
                      <button
                        onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                        className="px-3.5 py-1.5 rounded-lg bg-[#C62828] hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Vote className="w-3.5 h-3.5" />
                        <span>Cast Ballot</span>
                      </button>
                    )}

                    {hasVoted && (
                      <button
                        onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    )}

                    {(isResults || !isLive) && (
                      <button
                        onClick={() => navigateTo('election_results', { electionId: election.id })}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#123B70] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isResults ? 'View Results' : 'Results Portal'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
