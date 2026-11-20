import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { Election, DomainId, HallUnit, StudentProfile } from '../../types';
import {
  UNVERIFIED_HALL_MESSAGE,
  computeHallMetrics,
  findMatchingHallUnit,
  getHallDisplayName,
  isElectionForHall,
  isOfficialHallAffiliation,
  matchesHallAffiliation,
  resolveElectionHallUnit
} from '../../utils/hallUtils';
import { formatElectionWindow } from '../../utils/dateUtils';
import { formatNumber, formatPercentage } from '../../utils/numberFormat';
import { isElectionVisibleInDirectory } from '../../utils/electionStatus';
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

function checkStudentDomainEligibility(
  election: Election,
  student: StudentProfile | null,
  halls: HallUnit[]
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
  const resolvedHallUnit = resolveElectionHallUnit(election, halls);
  const isHallScoped =
    domId === 'jcrc_hall' ||
    election.category === 'JCR / Hall' ||
    Boolean(election.hallId) ||
    Boolean(crit?.halls && crit.halls.length > 0);

  if (isHallScoped) {
    if (!isOfficialHallAffiliation(student.hall, halls)) {
      return {
        eligible: false,
        reason: UNVERIFIED_HALL_MESSAGE
      };
    }

    const targetHalls =
      crit?.halls && crit.halls.length > 0
        ? crit.halls
        : resolvedHallUnit
        ? [resolvedHallUnit.name]
        : election.hallId
        ? [election.hallId]
        : election.subdomainLabel
        ? [election.subdomainLabel]
        : [];

    if (
      targetHalls.length > 0 &&
      !targetHalls.some((h) => matchesHallAffiliation(student.hall, h, resolvedHallUnit))
    ) {
      const targetLabel = resolvedHallUnit
        ? getHallDisplayName(resolvedHallUnit)
        : targetHalls.join(', ');
      return {
        eligible: false,
        reason: `Restricted to verified affiliates of ${targetLabel} (Your hall: ${student.hall}).`
      };
    }
  }

  if (crit) {
    if (crit.levels && crit.levels.length > 0 && !crit.levels.includes(student.level)) {
      return {
        eligible: false,
        reason: `Restricted to ${crit.levels.join(', ')} students (Your level: ${student.level}).`
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
      if (!isElectionVisibleInDirectory(e)) {
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
  }, [elections, activeDomain.id]);

  const studentMatchedHall = useMemo(() => {
    if (!student || !isOfficialHallAffiliation(student.hall, halls)) return undefined;
    return findMatchingHallUnit(student.hall, halls);
  }, [student, halls]);

  const filteredDepartments = useMemo(() => {
    if (selectedFacultyId === 'All') return departments;
    return departments.filter((d) => d.facultyId === selectedFacultyId);
  }, [departments, selectedFacultyId]);

  const visibleElections = useMemo(() => {
    return domainElections.filter((e) => {
      if (activeDomain.subdomainType === 'hall' && selectedHallId !== 'All') {
        const hallObj = halls.find((h) => h.id === selectedHallId);
        if (!hallObj || !isElectionForHall(e, hallObj, halls)) return false;
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
  const selectedHallObj = halls.find((h) => h.id === selectedHallId);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Domain Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigateTo('elections_directory')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#123B70] transition-colors cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Election Domains</span>
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {domains.map((dom) => (
            <button
              key={dom.id}
              onClick={() => setSelectedDomainId(dom.id as DomainId)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
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
              <div className="flex flex-wrap items-center gap-2 ucc-caption text-slate-500">
                <span className="font-semibold text-[#123B70] uppercase tracking-wider">
                  {activeDomain.category} Domain
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-normal">{activeDomain.governanceScope}</span>
              </div>
              <h1 className="ucc-heading-page text-slate-900 mt-0.5">
                {activeDomain.name}
              </h1>
              <p className="ucc-body-secondary text-slate-600 mt-1 max-w-3xl">
                {activeDomain.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div>
              <span className="ucc-caption font-semibold text-slate-500 uppercase block">
                Total Races
              </span>
              <span className="text-xl font-bold tabular-nums text-slate-900">
                {formatNumber(domainElections.length)}
              </span>
            </div>
            <div className="border-x border-slate-200 px-3">
              <span className="ucc-caption font-semibold text-slate-500 uppercase block">
                Live Now
              </span>
              <span className="text-xl font-bold tabular-nums text-emerald-700">
                {formatNumber(domainElections.filter((e) => e.status === 'live').length)}
              </span>
            </div>
            <div>
              <span className="ucc-caption font-semibold text-slate-500 uppercase block">
                Ballots Cast
              </span>
              <span className="text-xl font-bold tabular-nums text-[#123B70]">
                {formatNumber(
                  domainElections.reduce((acc, el) => acc + (el.totalVotesCast || 0), 0)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Governance & Constitution Policy Strip */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 ucc-body-secondary">
          <div className="flex items-start gap-2 text-slate-700">
            <ShieldCheck className="w-4 h-4 text-[#123B70] shrink-0 mt-0.5" />
            <span>
              <strong className="font-semibold text-slate-900">Eligibility Rule: </strong>
              {activeDomain.eligibilityRuleSummary}
            </span>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <Layers className="w-4 h-4 text-[#C62828] shrink-0 mt-0.5" />
            <span>
              <strong className="font-semibold text-slate-900">Portfolio Policy: </strong>
              {activeDomain.positionsPolicyNote}
            </span>
          </div>
        </div>

        {/* GRASAG Isolation Callout for logged-in students */}
        {activeDomain.id === 'grasag' && student && (
          <div
            className={`p-3.5 rounded-xl border ucc-body-secondary flex items-center gap-2.5 ${
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

        {/* Hall Affiliation Verification Callout for logged-in students */}
        {activeDomain.subdomainType === 'hall' && student && (
          <div
            className={`p-3.5 rounded-xl border ucc-body-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              studentMatchedHall
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2.5">
              {studentMatchedHall ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <span>
                {studentMatchedHall
                  ? `Verified Hall Affiliation: ${getHallDisplayName(
                      studentMatchedHall
                    )}. You are strictly eligible to vote only in JCRC elections for ${getHallDisplayName(
                      studentMatchedHall
                    )}.`
                  : UNVERIFIED_HALL_MESSAGE}
              </span>
            </div>
            {studentMatchedHall && (
              <button
                type="button"
                onClick={() => setSelectedHallId(studentMatchedHall.id)}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
              >
                View My Hall Elections
              </button>
            )}
          </div>
        )}
      </div>

      {/* Subdomain Navigator: JCRC / Hall (All 8 Official UCC Halls) */}
      {activeDomain.subdomainType === 'hall' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="ucc-heading-card text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-[#123B70]" />
                <span>
                  Official UCC Residential Halls ({halls.length} Independent JCRC Subdomains)
                </span>
              </h2>
              <p className="ucc-body-secondary text-slate-500 mt-0.5">
                Select any hall to view its JCRC election details and candidates. Voting access remains strictly enforced by your verified student hall affiliation.
              </p>
            </div>
            {selectedHallId !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedHallId('All')}
                className="text-sm font-semibold text-[#123B70] hover:underline whitespace-nowrap cursor-pointer self-start"
              >
                Show All {halls.length} Halls
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {halls.map((hall) => {
              const metrics = computeHallMetrics(hall, halls, domainElections, candidates);
              const isSelected = selectedHallId === hall.id;
              const isStudentHall = studentMatchedHall?.id === hall.id;

              return (
                <button
                  key={hall.id}
                  type="button"
                  onClick={() => setSelectedHallId(isSelected ? 'All' : hall.id)}
                  className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-[#123B70] bg-[#EAF2FA]/60'
                      : isStudentHall
                      ? 'border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/60'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-white'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {hall.logoUrl ? (
                          <img
                            src={hall.logoUrl}
                            alt={`${hall.name} emblem`}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-[#123B70]/10 text-[#123B70] flex items-center justify-center ucc-caption font-bold shrink-0">
                            {hall.code || hall.shortName.slice(0, 3).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-slate-900 block leading-snug truncate">
                            {getHallDisplayName(hall)}
                          </span>
                          <span className="ucc-caption font-normal text-slate-500">
                            {hall.code || hall.shortName}
                          </span>
                        </div>
                      </div>
                      {isStudentHall && (
                        <span className="ucc-caption font-semibold text-emerald-700 whitespace-nowrap shrink-0">
                          Your Hall
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between ucc-caption font-normal text-slate-600 tabular-nums">
                    <span>
                      {formatNumber(metrics.electionsCount)} Election{metrics.electionsCount === 1 ? '' : 's'}
                    </span>
                    <span
                      className={`font-semibold ${
                        metrics.liveElectionsCount > 0
                          ? 'text-emerald-700'
                          : metrics.publishedResultsCount > 0
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {metrics.liveElectionsCount > 0
                        ? 'Polling Open'
                        : metrics.publishedResultsCount > 0
                        ? 'Results Published'
                        : metrics.scheduledElectionsCount > 0
                        ? 'Scheduled'
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
            <h2 className="ucc-heading-card text-slate-900 flex items-center gap-2">
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
                className="text-sm font-semibold text-[#C62828] hover:underline whitespace-nowrap cursor-pointer"
              >
                Clear Academic Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block ucc-caption font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Faculty / School
              </label>
              <select
                value={selectedFacultyId}
                onChange={(e) => {
                  setSelectedFacultyId(e.target.value);
                  setSelectedDepartmentId('All');
                }}
                className="w-full px-3 py-2 text-sm font-medium rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#123B70]"
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
                <label className="block ucc-caption font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Academic Department
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-medium rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#123B70]"
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
            <div className="pt-2 border-t border-slate-100 ucc-body-secondary text-slate-600">
              <span className="font-semibold text-slate-800">Recognized Programmes in {selectedDeptObj.name}: </span>
              <span>{selectedDeptObj.programmes.join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Status Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="ucc-heading-section text-slate-900">
          Elections in {activeDomain.shortName}{' '}
          <span className="text-slate-400 text-sm font-medium tabular-nums">
            ({formatNumber(visibleElections.length)})
          </span>
        </h2>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
        >
          <option value="All">All Statuses</option>
          <option value="live">Live Polling</option>
          <option value="scheduled">Scheduled / Upcoming</option>
          <option value="draft">Draft (Pending Activation)</option>
          <option value="results_published">Results Published</option>
          <option value="closed">Closed</option>
          <option value="archived">Historical Archive (2026)</option>
        </select>
      </div>

      {/* Elections List */}
      {visibleElections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <Clock className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="ucc-heading-card text-slate-900">
            {selectedHallObj
              ? `No Elections Currently Scheduled for ${getHallDisplayName(selectedHallObj)}`
              : 'No Elections Currently Scheduled for Selection'}
          </h3>
          <p className="ucc-body-secondary text-slate-500 max-w-md mx-auto">
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
              className="px-4 py-2 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#0B1F3A] cursor-pointer"
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
            const elig = checkStudentDomainEligibility(election, student, halls);
            const isLive = election.status === 'live';
            const isDraft = election.status === 'draft';
            const isResults = election.status === 'results_published';
            const isArchived = election.status === 'archived';

            return (
              <div
                key={election.id}
                className="bg-white rounded-2xl border border-slate-200 flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-3.5">
                  {/* Unboxed quiet metadata header */}
                  <div className="flex items-center justify-between gap-2 ucc-caption">
                    <div className="flex items-center gap-2 text-slate-500 truncate">
                      <span className="font-semibold text-[#123B70] uppercase tracking-wider">
                        {election.subdomainLabel || election.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-normal">{election.code}</span>
                    </div>
                    <span
                      className={`ucc-caption font-semibold whitespace-nowrap ${
                        isLive
                          ? 'text-emerald-700'
                          : isResults
                          ? 'text-amber-700'
                          : isArchived
                          ? 'text-slate-600'
                          : 'text-[#123B70]'
                      }`}
                    >
                      {isLive
                        ? 'Live Election · Voting Open'
                        : isResults
                        ? 'Certified Results'
                        : isArchived
                        ? 'Historical Archive'
                        : isDraft
                        ? 'Draft · Pending Activation'
                        : election.status === 'scheduled' || election.status === 'upcoming'
                        ? 'Scheduled'
                        : election.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <h3 className="ucc-heading-card text-slate-900">
                      {election.title}
                    </h3>
                    <p className="ucc-body-secondary text-slate-600 mt-1">
                      {election.description}
                    </p>
                  </div>

                  {election.historicalNote && (
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 ucc-caption font-normal text-amber-950">
                      <strong className="font-semibold">Historical Record Note: </strong>
                      {election.historicalNote}
                    </div>
                  )}

                  {/* Contested Portfolios List (Constitution/Domain Specific) */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between ucc-caption">
                      <span className="font-semibold text-slate-700 uppercase tracking-wider">
                        Configured Portfolios ({formatNumber(positions.length || election.positionsCount)})
                      </span>
                      <span className="text-slate-500 font-normal">
                        {formatNumber(approvedCandsCount)} Approved Candidate{approvedCandsCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    {positions.length > 0 ? (
                      <div className="ucc-body-secondary text-slate-600">
                        {positions.map((p) => p.title).join(' · ')}
                      </div>
                    ) : (
                      <div className="ucc-body-secondary text-slate-400 italic">
                        {isArchived
                          ? 'No portfolios recorded in source archive — awaiting administrator input.'
                          : 'Portfolios awaiting configuration by domain administrator.'}
                      </div>
                    )}
                  </div>

                  {/* Turnout & Eligibility */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 ucc-caption">
                    <div>
                      <span className="text-slate-500 font-normal block">Polling Window</span>
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {formatElectionWindow(election)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-normal block">Turnout Progress</span>
                      <span className="font-semibold text-[#123B70] tabular-nums">
                        {isArchived && election.tallyAvailable === false
                          ? 'Tally unavailable'
                          : `${formatPercentage(election.turnoutPercentage)} (${formatNumber(election.totalVotesCast)} / ${formatNumber(election.totalEligibleVoters)})`}
                      </span>
                    </div>
                  </div>

                  {student && (
                    isArchived ? (
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 ucc-caption font-normal flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Historical Archive · Voting Disabled (Read-only historical record)</span>
                      </div>
                    ) : (
                      <div
                        className={`p-2.5 rounded-lg border ucc-caption font-normal flex items-center gap-2 ${
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
                        <span>
                          {isDraft
                            ? `Your Voter Eligibility: ${elig.reason} (Draft until activated by the UCC Electoral Commission)`
                            : elig.reason}
                        </span>
                      </div>
                    )
                  )}
                </div>

                {/* Action Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigateTo('election_details', { electionId: election.id })}
                      className="text-sm font-semibold text-slate-700 hover:text-[#123B70] cursor-pointer whitespace-nowrap"
                    >
                      View Election Information
                    </button>
                    <button
                      onClick={() => navigateTo('candidate_directory', { electionId: election.id })}
                      className="text-sm font-semibold text-[#123B70] hover:underline cursor-pointer flex items-center gap-1 whitespace-nowrap"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Candidates</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {isLive && !hasVoted && elig.eligible && (
                      <button
                        onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                        className="px-3.5 py-1.5 rounded-lg bg-[#C62828] hover:bg-red-700 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Vote className="w-3.5 h-3.5" />
                        <span>Cast Your Vote</span>
                      </button>
                    )}

                    {hasVoted && (
                      <button
                        onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    )}

                    {(isResults ||
                      (!isLive &&
                        !isDraft &&
                        election.status !== 'pending_approval' &&
                        (!isArchived || election.provisionalResultsReady || election.resultsCertified))) && (
                      <button
                        onClick={() => navigateTo('election_results', { electionId: election.id })}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#123B70] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isResults ? 'View Results' : isArchived ? 'View Outcomes' : 'Results Portal'}</span>
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
