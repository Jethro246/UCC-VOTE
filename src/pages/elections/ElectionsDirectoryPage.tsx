import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, 
  Filter, 
  Vote, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock, 
  Award, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { ElectionCategory, ElectionStatus } from '../../types';

export const ElectionsDirectoryPage: React.FC = () => {
  const { 
    elections, 
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
    'Departmental',
    'Faculty / School',
    'GRASAG'
  ];

  const statuses: { label: string; value: ElectionStatus | 'All' }[] = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Live Polling', value: 'live' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Pending Approval', value: 'pending_approval' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Closed', value: 'closed' },
    { label: 'Results Published', value: 'results_published' }
  ];

  const filteredElections = elections.filter((e) => {
    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || e.status === statusFilter || 
      (statusFilter === 'scheduled' && (e.status as any) === 'upcoming');
    const matchesSearch = 
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.code.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header & Description */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
            Institutional Registry
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Elections Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Browse active, scheduled, and past University of Cape Coast elections.
          </p>
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
            placeholder="Search elections, codes..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-slate-50"
          />
        </div>
      </div>

      {/* Category Segmented Controls & Status Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#123B70] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
          >
            {statuses.map(st => (
              <option key={st.value} value={st.value}>{st.label}</option>
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
          <h3 className="text-base font-bold text-slate-900">No elections found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or reset the filters to view all available university ballots.
          </p>
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
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredElections.map((election) => {
            const hasVoted = student?.hasVotedElections.includes(election.id);
            const isLive = election.status === 'live';
            const isUpcoming = election.status === 'upcoming';
            const isResults = election.status === 'results_published';

            return (
              <div
                key={election.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-[#123B70]/40 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3">
                  {/* Top line metadata */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#123B70] uppercase tracking-wider">
                      {election.category}
                    </span>

                    {/* Status badge */}
                    {isLive && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Live Now
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-[#123B70] text-[11px] font-semibold">
                        <Clock className="w-3 h-3 text-[#123B70]" />
                        Upcoming
                      </span>
                    )}
                    {isResults && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                        <Award className="w-3 h-3 text-amber-600" />
                        Results Certified
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#123B70] transition-colors line-clamp-2">
                    {election.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {election.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div>
                      <span className="block text-slate-400">Academic Year:</span>
                      <span className="font-semibold text-slate-800">{election.academicYear}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Contested Portfolios:</span>
                      <span className="font-semibold text-slate-800">{election.positionsCount} Positions</span>
                    </div>
                  </div>

                  {/* Turnout if live or closed */}
                  {(isLive || isResults) && (
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
                    className="text-xs font-bold text-slate-700 hover:text-[#123B70] transition-colors cursor-pointer"
                  >
                    View Guidelines
                  </button>

                  {isLive && !hasVoted && (
                    <button
                      onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                      className="px-3 py-1.5 rounded-lg bg-[#C62828] hover:bg-red-700 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <Vote className="w-3 h-3" />
                      <span>Vote Now</span>
                    </button>
                  )}

                  {isLive && hasVoted && (
                    <button
                      onClick={() => navigateTo('election_results', { electionId: election.id })}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Voted · Turnout</span>
                    </button>
                  )}

                  {isResults && (
                    <button
                      onClick={() => navigateTo('election_results', { electionId: election.id })}
                      className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#123B70] text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Award className="w-3 h-3 text-amber-400" />
                      <span>Certified Results</span>
                    </button>
                  )}

                  {isUpcoming && (
                    <button
                      onClick={() => navigateTo('candidate_directory')}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
                    >
                      Aspirants
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
