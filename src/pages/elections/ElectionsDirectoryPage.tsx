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
    { label: 'Suspended', value: 'suspended' },
    { label: 'Closed', value: 'closed' },
    { label: 'Results Published', value: 'results_published' },
    { label: 'Historical Archive (2026)', value: 'archived' }
  ];

  const publicVisibleElections = elections.filter(
    (e) =>
      e.status !== 'draft' &&
      e.status !== 'pending_approval' &&
      e.status !== 'cancelled' &&
      (e.status !== 'archived' || e.isHistorical === true)
  );

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
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <Logo variant="default" showWordmark={false} />
          <div>
            <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
              University of Cape Coast · Multi-Domain Electoral Registry
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              UCC Election Domains & Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Explore independent student governance domains or filter active, scheduled, and certified polls across campus.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search elections, halls, depts..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-slate-50"
          />
        </div>
      </div>

      {/* Main Election Domains Section */}
      {domains.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Independent Student Election Domains
              </h2>
              <p className="text-xs text-slate-500">
                Each domain maintains separate portfolios, voter eligibility verification, digital ballots, and results certification.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {domains.map((dom) => {
              const Icon = getDomainIcon(dom.id);
              return (
                <div
                  key={dom.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4 hover:border-[#123B70]/50 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-bold text-[#123B70] flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{dom.shortName}</span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {dom.stats.activeElections} Live · {dom.stats.totalElections} Total
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{dom.name}</h3>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {dom.description}
                    </p>

                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">Eligibility: </span>
                      <span>{dom.eligibilityRuleSummary}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {dom.stats.approvedCandidatesCount} Approved Candidates
                    </span>
                    <button
                      onClick={() => navigateTo('domain_elections', { domainId: dom.id })}
                      className="px-3 py-1.5 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>View Elections</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Category Segmented Controls & Status Filter Bar */}
      <div className="pt-2 border-t border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
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
            <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
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
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {elections.length === 0 ? 'No active elections at the moment.' : 'No elections found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
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
                className="px-4 py-2 text-xs font-semibold text-[#123B70] bg-[#EAF2FA] rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredElections.map((election) => {
              const hasVoted = student?.hasVotedElections.includes(election.id);
              const isLive = election.status === 'live';
              const isUpcoming =
                election.status === 'upcoming' || election.status === 'scheduled';
              const isResults = election.status === 'results_published';
              const isArchived = election.status === 'archived';

              return (
                <div
                  key={election.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-[#123B70]/40 transition-colors flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-3">
                    {/* Top unboxed metadata */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500 truncate">
                        <span className="font-bold text-[#123B70] uppercase tracking-wider">
                          {election.category}
                        </span>
                        {election.subdomainLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate font-medium text-slate-700">
                              {election.subdomainLabel}
                            </span>
                          </>
                        )}
                      </div>

                      <span
                        className={`text-[11px] font-bold whitespace-nowrap ${
                          isLive
                            ? 'text-emerald-700'
                            : isResults
                            ? 'text-amber-700'
                            : isUpcoming
                            ? 'text-[#123B70]'
                            : isArchived
                            ? 'text-slate-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {isLive
                          ? 'Live Now'
                          : isUpcoming
                          ? 'Scheduled'
                          : isResults
                          ? 'Results Certified'
                          : isArchived
                          ? 'Historical Archive'
                          : election.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#123B70] transition-colors line-clamp-2">
                      {election.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {election.description}
                    </p>

                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <div>
                        <span className="block text-slate-400">Academic Year</span>
                        <span className="font-semibold text-slate-800">{election.academicYear}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Contested Portfolios</span>
                        <span className="font-semibold text-slate-800 font-mono tabular-nums">
                          {election.positionsCount} Positions
                        </span>
                      </div>
                    </div>

                    {(isLive || (isResults && election.tallyAvailable !== false)) && (
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>Turnout</span>
                          <span className="font-mono font-bold text-slate-700 tabular-nums">
                            {election.turnoutPercentage}% ({election.totalVotesCast.toLocaleString()})
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
                  <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => navigateTo('election_details', { electionId: election.id })}
                      className="text-xs font-bold text-slate-700 hover:text-[#123B70] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      View Guidelines
                    </button>

                    {isLive && !hasVoted && (
                      <button
                        onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                        className="px-3 py-1.5 rounded-lg bg-[#C62828] hover:bg-red-700 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                      >
                        <Vote className="w-3 h-3" />
                        <span>Vote Now</span>
                      </button>
                    )}

                    {isLive && hasVoted && (
                      <button
                        onClick={() => navigateTo('election_results', { electionId: election.id })}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Voted · Turnout</span>
                      </button>
                    )}

                    {isResults && (
                      <button
                        onClick={() => navigateTo('election_results', { electionId: election.id })}
                        className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#123B70] text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                      >
                        <Award className="w-3 h-3 text-amber-400" />
                        <span>Certified Results</span>
                      </button>
                    )}

                    {isUpcoming && (
                      <button
                        onClick={() => navigateTo('candidate_directory')}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Aspirants
                      </button>
                    )}

                    {isArchived && (election.provisionalResultsReady || election.resultsCertified) && (
                      <button
                        onClick={() => navigateTo('election_results', { electionId: election.id })}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-[#123B70] text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                      >
                        <Award className="w-3 h-3 text-amber-400" />
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

