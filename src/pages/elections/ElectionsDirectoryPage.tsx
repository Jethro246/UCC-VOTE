import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import {
  Search,
  Vote,
  CheckCircle2,
  Award,
  ArrowRight,
  Layers,
  Building,
  GraduationCap,
  Users,
  ShieldCheck
} from 'lucide-react';
import { DomainId, ElectionCategory, ElectionStatus } from '../../types';
import { formatNumber, formatPercentage } from '../../utils/numberFormat';
import { isElectionVisibleInDirectory } from '../../utils/electionStatus';

function getDomainIcon(domainId: DomainId) {
  switch (domainId) {
    case 'src':
      return Vote;
    case 'jcrc_hall':
      return Building;
    case 'grasag':
      return GraduationCap;
    case 'local_nugs':
      return ShieldCheck;
    case 'departmental':
      return Layers;
    case 'faculty_school':
      return Users;
    default:
      return Layers;
  }
}

export const ElectionsDirectoryPage: React.FC = () => {
  const {
    elections,
    domains,
    navigateTo,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    student
  } = useApp();

  const [search, setSearch] = useState('');

  const categories: (ElectionCategory | 'All')[] = [
    'All',
    'SRC',
    'JCR / Hall',
    'GRASAG',
    'Local NUGS',
    'Departmental',
    'Faculty / School'
  ];

  const statuses: { label: string; value: ElectionStatus | 'All' }[] = [
    { label: 'All Active & Published', value: 'All' },
    { label: 'Live Polling', value: 'live' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Draft (Pending Activation)', value: 'draft' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Closed', value: 'closed' },
    { label: 'Results Published', value: 'results_published' },
    { label: 'Historical Archive (2026)', value: 'archived' }
  ];

  const publicVisibleElections = elections.filter(isElectionVisibleInDirectory);

  const filteredElections = publicVisibleElections.filter((e) => {
    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
    const matchesStatus =
      statusFilter === 'All' ||
      e.status === statusFilter ||
      (statusFilter === 'scheduled' && (e.status as any) === 'upcoming');
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.code.toLowerCase().includes(search.toLowerCase()) ||
      (e.subdomainLabel || '').toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-4 min-[481px]:space-y-5 lg:space-y-6">
      {/* Header & Search */}
      <div className="bg-white p-3.5 min-[376px]:p-4 min-[481px]:p-5 lg:p-6 rounded-xl min-[481px]:rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 lg:gap-4">
        <div className="flex items-start sm:items-center gap-2.5 min-[481px]:gap-3.5 min-w-0">
          <Logo variant="default" showWordmark={false} className="shrink-0" />
          <div className="min-w-0">
            <span className="block text-[11px] min-[481px]:text-xs leading-tight font-semibold text-[#123B70] uppercase tracking-wider truncate">
              University of Cape Coast · Multi-Domain Electoral Registry
            </span>
            <h1 className="text-lg min-[376px]:text-xl min-[481px]:text-2xl lg:text-[2rem] font-bold leading-tight tracking-[-0.02em] text-slate-900 mt-0.5">
              UCC Election Domains & Directory
            </h1>
            <p className="text-xs min-[481px]:text-sm leading-snug lg:leading-normal text-slate-600 mt-0.5 lg:mt-1 line-clamp-2 sm:line-clamp-none">
              Explore independent student governance domains or filter active, scheduled, and certified polls across campus.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search elections, halls, depts..."
            className="w-full pl-9 pr-3 py-1.5 min-[481px]:py-2 text-xs min-[481px]:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-slate-50"
          />
        </div>
      </div>

      {/* Main Election Domains Section */}
      {domains.length > 0 && (
        <section className="space-y-2.5 min-[481px]:space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-base min-[376px]:text-lg min-[481px]:text-xl lg:text-[1.5rem] font-semibold leading-snug tracking-[-0.015em] text-slate-900">
                Independent Student Election Domains
              </h2>
              <p className="text-xs min-[481px]:text-sm leading-snug lg:leading-normal text-slate-500 line-clamp-2 sm:line-clamp-none">
                Each domain maintains separate portfolios, voter eligibility verification, digital ballots, and results certification.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 min-[376px]:gap-2.5 min-[481px]:gap-3 md:gap-4">
            {domains.map((dom) => {
              const Icon = getDomainIcon(dom.id);
              return (
                <div
                  key={dom.id}
                  className="bg-white rounded-xl min-[481px]:rounded-2xl border border-slate-200 p-2 min-[376px]:p-2.5 min-[481px]:p-3.5 md:p-4 lg:p-5 flex flex-col justify-between gap-2 min-[481px]:gap-3 lg:gap-4 hover:border-[#123B70]/50 transition-colors min-w-0 overflow-hidden"
                >
                  <div className="space-y-1 min-[376px]:space-y-1.5 min-[481px]:space-y-2 min-w-0">
                    <div className="flex flex-col min-[481px]:flex-row min-[481px]:items-center min-[481px]:justify-between gap-0.5 min-[481px]:gap-2 text-[10px] min-[376px]:text-[11px] min-[481px]:text-xs leading-tight text-slate-500 min-w-0">
                      <span className="font-semibold text-[#123B70] flex items-center gap-1 min-w-0 truncate">
                        <Icon className="w-3 h-3 min-[481px]:w-3.5 min-[481px]:h-3.5 shrink-0" />
                        <span className="truncate">{dom.shortName}</span>
                      </span>
                      <span className="tabular-nums font-medium truncate min-[481px]:whitespace-nowrap shrink-0">
                        {formatNumber(dom.stats.activeElections)} Live · {formatNumber(dom.stats.totalElections)} Total
                      </span>
                    </div>

                    <h3 className="text-[13px] min-[376px]:text-sm min-[481px]:text-[15px] md:text-lg lg:text-xl font-bold lg:font-semibold leading-snug tracking-[-0.01em] text-slate-900 line-clamp-2 break-words">
                      {dom.name}
                    </h3>

                    <p className="text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm leading-snug lg:leading-normal text-slate-600 line-clamp-2 min-[376px]:line-clamp-3 lg:line-clamp-2 break-words">
                      {dom.description}
                    </p>

                    <div className="pt-1 min-[481px]:pt-1.5 lg:pt-2 border-t border-slate-100 text-[10px] min-[376px]:text-[11px] min-[481px]:text-xs leading-snug font-normal text-slate-500 line-clamp-2 md:line-clamp-none break-words">
                      <span className="font-semibold text-slate-700">Eligibility: </span>
                      <span>{dom.eligibilityRuleSummary}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 pt-1.5 min-[481px]:pt-2 border-t border-slate-100 min-w-0">
                    <span className="text-[10px] min-[376px]:text-[11px] min-[481px]:text-xs leading-tight font-normal text-slate-500 tabular-nums min-w-0 truncate">
                      {formatNumber(dom.stats.approvedCandidatesCount)} Approved Candidates
                    </span>
                    <button
                      onClick={() => navigateTo('domain_elections', { domainId: dom.id })}
                      className="w-full sm:w-auto px-2 py-1.5 min-[376px]:px-2.5 min-[481px]:px-3 lg:px-3.5 lg:py-1.5 min-h-[32px] lg:min-h-0 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1 min-[481px]:gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>View Elections</span>
                      <ArrowRight className="w-3 h-3 min-[481px]:w-3.5 min-[481px]:h-3.5 shrink-0" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Category Segmented Controls & Status Filter Bar */}
      <div className="pt-2 border-t border-slate-200 space-y-3 lg:space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 min-[481px]:px-3 min-[481px]:py-1.5 rounded-lg text-xs min-[481px]:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[#123B70] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="ucc-label text-slate-500 whitespace-nowrap hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-auto px-2.5 py-1.5 min-[481px]:px-3 text-xs min-[481px]:text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
            >
              {statuses.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Elections Grid */}
        {filteredElections.length === 0 ? (
          <div className="bg-white rounded-xl min-[481px]:rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-base min-[481px]:text-lg lg:text-xl font-semibold text-slate-900">
              {elections.length === 0 ? 'No active elections at the moment.' : 'No elections found'}
            </h3>
            <p className="text-xs min-[481px]:text-sm text-slate-500 max-w-sm mx-auto">
              {elections.length === 0
                ? 'Elections configured by the UCC Electoral Commission will appear here automatically once published.'
                : 'Try adjusting your search query or reset the filters to view all available university ballots.'}
            </p>
            {elections.length > 0 && (
              <button
                onClick={() => {
                  setCategoryFilter('All');
                  setStatusFilter('All');
                  setSearch('');
                }}
                className="px-4 py-2 text-xs min-[481px]:text-sm font-semibold text-[#123B70] bg-[#EAF2FA] rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 min-[376px]:gap-2.5 min-[481px]:gap-3 md:gap-5 lg:gap-6">
            {filteredElections.map((election) => {
              const hasVoted = student?.hasVotedElections.includes(election.id);
              const isLive = election.status === 'live';
              const isDraft = election.status === 'draft';
              const isUpcoming =
                election.status === 'upcoming' || election.status === 'scheduled';
              const isResults = election.status === 'results_published';
              const isArchived = election.status === 'archived';

              return (
                <div
                  key={election.id}
                  className="bg-white rounded-xl min-[481px]:rounded-2xl border border-slate-200 hover:border-[#123B70]/40 transition-colors flex flex-col justify-between overflow-hidden group min-w-0"
                >
                  <div className="p-2 min-[376px]:p-2.5 min-[481px]:p-3.5 md:p-4 lg:p-5 space-y-1.5 min-[376px]:space-y-2 min-[481px]:space-y-2.5 lg:space-y-3 min-w-0">
                    {/* Top unboxed metadata */}
                    <div className="flex flex-col min-[481px]:flex-row min-[481px]:items-center min-[481px]:justify-between gap-0.5 min-[481px]:gap-2 text-[10px] min-[376px]:text-[11px] min-[481px]:text-xs leading-tight min-w-0">
                      <div className="flex items-center gap-1 min-[481px]:gap-1.5 text-slate-500 min-w-0 truncate">
                        <span className="font-semibold text-[#123B70] uppercase tracking-wider shrink-0">
                          {election.category}
                        </span>
                        {election.subdomainLabel && (
                          <>
                            <span aria-hidden="true" className="shrink-0">·</span>
                            <span className="truncate font-medium text-slate-700">
                              {election.subdomainLabel}
                            </span>
                          </>
                        )}
                      </div>

                      <span
                        className={`text-[10px] min-[376px]:text-[11px] min-[481px]:text-xs font-semibold truncate min-[481px]:whitespace-nowrap shrink-0 ${
                          isLive
                            ? 'text-emerald-700'
                            : isResults
                            ? 'text-amber-700'
                            : isUpcoming || isDraft
                            ? 'text-[#123B70]'
                            : isArchived
                            ? 'text-slate-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {isLive
                          ? 'Active · Voting Open'
                          : isUpcoming
                          ? 'Scheduled'
                          : isDraft
                          ? 'Draft · Pending'
                          : isResults
                          ? 'Results Certified'
                          : isArchived
                          ? 'Historical Archive'
                          : election.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h3 className="text-[13px] min-[376px]:text-sm min-[481px]:text-[15px] md:text-lg lg:text-xl font-bold lg:font-semibold leading-snug tracking-[-0.01em] text-slate-900 group-hover:text-[#123B70] transition-colors line-clamp-2 break-words">
                      {election.title}
                    </h3>

                    <p className="text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm leading-snug lg:leading-normal text-slate-600 line-clamp-2 min-[376px]:line-clamp-3 lg:line-clamp-2 break-words">
                      {election.description}
                    </p>

                    <div className="pt-1 min-[481px]:pt-1.5 lg:pt-2 border-t border-slate-100 grid grid-cols-1 min-[481px]:grid-cols-2 gap-1 min-[481px]:gap-2 text-[10px] min-[376px]:text-[11px] min-[481px]:text-xs leading-tight font-normal text-slate-500">
                      <div className="min-w-0">
                        <span className="block text-slate-400 truncate">Academic Year</span>
                        <span className="font-semibold text-slate-800 truncate block">{election.academicYear}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-slate-400 truncate">Contested Portfolios</span>
                        <span className="font-semibold text-slate-800 tabular-nums truncate block">
                          {formatNumber(election.positionsCount)} Positions
                        </span>
                      </div>
                    </div>

                    {(isLive || (isResults && election.tallyAvailable !== false)) && (
                      <div className="pt-0.5 lg:pt-1">
                        <div className="flex items-center justify-between gap-1 text-[10px] min-[376px]:text-[11px] min-[481px]:text-xs leading-tight font-normal text-slate-500 mb-1">
                          <span className="truncate">Turnout</span>
                          <span className="font-semibold text-slate-700 tabular-nums shrink-0">
                            {formatPercentage(election.turnoutPercentage)} ({formatNumber(election.totalVotesCast)})
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#123B70] h-full rounded-full"
                            style={{ width: `${Math.min(election.turnoutPercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-2 py-2 min-[376px]:px-2.5 min-[481px]:px-3.5 min-[481px]:py-2.5 md:p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-1.5 sm:gap-2 min-w-0">
                    <button
                      onClick={() => navigateTo('election_details', { electionId: election.id })}
                      className="w-full sm:w-auto text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm font-semibold text-slate-700 hover:text-[#123B70] transition-colors cursor-pointer text-left leading-tight sm:whitespace-nowrap min-h-[28px] lg:min-h-0 inline-flex items-center"
                    >
                      View Election Information
                    </button>

                    {isLive && !hasVoted && (
                      <button
                        onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                        className="w-full sm:w-auto px-2 py-1.5 min-[376px]:px-2.5 min-[481px]:px-3.5 min-h-[32px] lg:min-h-0 rounded-lg bg-[#C62828] hover:bg-red-700 text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm font-semibold text-white transition-colors cursor-pointer inline-flex items-center justify-center gap-1 min-[481px]:gap-1.5 text-center leading-tight sm:whitespace-nowrap shrink-0"
                      >
                        <Vote className="w-3 h-3 min-[481px]:w-3.5 min-[481px]:h-3.5 shrink-0" />
                        <span>Cast Your Vote</span>
                      </button>
                    )}

                    {isLive && hasVoted && (
                      <button
                        onClick={() => navigateTo('election_results', { electionId: election.id })}
                        className="w-full sm:w-auto px-2 py-1.5 min-[376px]:px-2.5 min-[481px]:px-3.5 min-h-[32px] lg:min-h-0 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm font-semibold text-white transition-colors cursor-pointer inline-flex items-center justify-center gap-1 min-[481px]:gap-1.5 text-center leading-tight sm:whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2 className="w-3 h-3 min-[481px]:w-3.5 min-[481px]:h-3.5 shrink-0" />
                        <span>Voted · Turnout</span>
                      </button>
                    )}

                    {isResults && (
                      <button
                        onClick={() => navigateTo('election_results', { electionId: election.id })}
                        className="w-full sm:w-auto px-2 py-1.5 min-[376px]:px-2.5 min-[481px]:px-3.5 min-h-[32px] lg:min-h-0 rounded-lg bg-[#0B1F3A] hover:bg-[#123B70] text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm font-semibold text-white transition-colors cursor-pointer inline-flex items-center justify-center gap-1 min-[481px]:gap-1.5 text-center leading-tight sm:whitespace-nowrap shrink-0"
                      >
                        <Award className="w-3 h-3 min-[481px]:w-3.5 min-[481px]:h-3.5 text-amber-400 shrink-0" />
                        <span>Certified Results</span>
                      </button>
                    )}

                    {(isUpcoming || isDraft) && (
                      <button
                        onClick={() => navigateTo('candidate_directory', { electionId: election.id })}
                        className="w-full sm:w-auto px-2 py-1.5 min-[376px]:px-2.5 min-[481px]:px-3.5 min-h-[32px] lg:min-h-0 rounded-lg bg-slate-200 hover:bg-slate-300 text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm font-semibold text-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center text-center leading-tight sm:whitespace-nowrap shrink-0"
                      >
                        {isDraft ? 'Contestants' : 'Aspirants'}
                      </button>
                    )}

                    {isArchived && (election.provisionalResultsReady || election.resultsCertified) && (
                      <button
                        onClick={() => navigateTo('election_results', { electionId: election.id })}
                        className="w-full sm:w-auto px-2 py-1.5 min-[376px]:px-2.5 min-[481px]:px-3.5 min-h-[32px] lg:min-h-0 rounded-lg bg-slate-800 hover:bg-[#123B70] text-[11px] min-[376px]:text-xs min-[481px]:text-[13px] lg:text-sm font-semibold text-white transition-colors cursor-pointer inline-flex items-center justify-center gap-1 min-[481px]:gap-1.5 text-center leading-tight sm:whitespace-nowrap shrink-0"
                      >
                        <Award className="w-3 h-3 min-[481px]:w-3.5 min-[481px]:h-3.5 text-amber-400 shrink-0" />
                        <span>View Historical Outcomes</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

