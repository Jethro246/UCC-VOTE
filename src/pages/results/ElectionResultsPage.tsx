import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MOCK_POSITIONS, MOCK_CANDIDATES } from '../../data/mockData';
import { 
  Award, 
  CheckCircle2, 
  Download, 
  Share2, 
  Building, 
  ShieldCheck, 
  FileText, 
  TrendingUp, 
  Clock, 
  Users 
} from 'lucide-react';

export const ElectionResultsPage: React.FC = () => {
  const { elections, selectedElectionId, setSelectedElectionId } = useApp();

  const [activeElectionId, setActiveElectionId] = useState<string>(
    selectedElectionId || 'UCC-GRA-2025'
  );

  const election = elections.find(e => e.id === activeElectionId) || elections[0];
  const positions = MOCK_POSITIONS[election.id] || MOCK_POSITIONS['UCC-SRC-2026'] || [];

  const isCertified = election.resultsCertified || election.status === 'results_published';
  const totalVotes = election.totalVotesCast || 14620;
  const totalEligible = election.totalEligibleVoters || 24850;
  const turnout = election.turnoutPercentage || 58.8;

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Selector */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
            Official Tally & Declarations
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Election Results Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Certified declarations and verified ballot tallies supervised by the UCC Electoral Commission.
          </p>
        </div>

        {/* Election Selector Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Select Election:</span>
          <select
            value={activeElectionId}
            onChange={(e) => setActiveElectionId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#123B70]"
          >
            {elections.map((el) => (
              <option key={el.id} value={el.id}>
                {el.title} ({el.status === 'results_published' ? 'Certified' : 'Live Turnout'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Certification Status Bar */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isCertified
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
            isCertified ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm uppercase tracking-wide">
                {isCertified ? 'Official Certified Declaration' : 'Provisional Live Tally (Polls Open)'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isCertified ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
              }`}>
                {isCertified ? 'FINAL_CERTIFIED' : 'PROVISIONAL'}
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              {isCertified 
                ? 'Tallies audited, signed, and gazetted by the Electoral Commissioner.'
                : 'Ballot counting in progress. Unofficial until validated and signed by the Commission.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => alert(`Exporting official PDF results declaration for ${election.title}...`)}
          className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 self-start sm:self-auto cursor-pointer shadow-xs"
        >
          <Download className="w-4 h-4 text-[#123B70]" />
          <span>Export Declaration PDF</span>
        </button>
      </div>

      {/* Participation Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Eligible Voters</span>
          <span className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1 block">
            {totalEligible.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Academic registry total</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Ballots Cast</span>
          <span className="text-2xl font-black text-[#123B70] font-mono tabular-nums mt-1 block">
            {totalVotes.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Verified digital submissions</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Voter Turnout Rate</span>
          <span className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1 block">
            {turnout}%
          </span>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${turnout}%` }} />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Invalid / Rejected Ballots</span>
          <span className="text-2xl font-black text-slate-400 font-mono tabular-nums mt-1 block">
            0
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
            100% Validated Digital Format
          </span>
        </div>
      </div>

      {/* Results by Portfolio */}
      <div className="space-y-6">
        {positions.map((pos) => {
          const cands = pos.candidateIds.map(id => MOCK_CANDIDATES[id]).filter(Boolean);
          const highestVotes = Math.max(...cands.map(c => c.votesReceived || 0));

          return (
            <div key={pos.id} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                <div>
                  <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
                    Contested Portfolio {pos.order}
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                    {pos.title}
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {cands.length} Aspirant{cands.length > 1 ? 's' : ''} Contesting
                </span>
              </div>

              {/* Candidates Results Bars */}
              <div className="space-y-5">
                {cands.map((cand) => {
                  const votes = cand.votesReceived || 0;
                  const pct = cand.votePercentage || 0;
                  const isWinner = isCertified && votes === highestVotes && votes > 0;

                  return (
                    <div 
                      key={cand.id} 
                      className={`p-4 sm:p-5 rounded-xl border transition-all ${
                        isWinner 
                          ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-300' 
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={cand.photoUrl}
                            alt={cand.fullName}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                                {cand.fullName}
                              </h4>
                              {isWinner && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider">
                                  <Award className="w-3 h-3" />
                                  WINNER ELECT
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {cand.department} · {cand.hall}
                            </p>
                          </div>
                        </div>

                        {/* Votes and Pct */}
                        <div className="text-right">
                          <div className="text-lg sm:text-xl font-black font-mono text-slate-900 tabular-nums">
                            {pct}%
                          </div>
                          <span className="text-xs font-mono text-slate-500 tabular-nums">
                            {votes.toLocaleString()} votes
                          </span>
                        </div>
                      </div>

                      {/* Bar Visualization */}
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isWinner ? 'bg-amber-500' : 'bg-[#123B70]'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Official Sign-off & Audit Notice */}
      <div className="bg-[#0B1F3A] text-white p-6 sm:p-8 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Electoral Commission Certification
            </h4>
          </div>
          <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
            All tallies are electronically verified against the UCC immutable ballot ledger. 
            Official certification signed by Dr. Joseph E. Tetteh, Electoral Commissioner.
          </p>
        </div>

        <div className="shrink-0 text-center md:text-right">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">Digital Signature Hash</span>
          <span className="font-mono text-xs text-amber-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 block mt-1">
            SHA256: 9b2d8e41a...e7f01a
          </span>
        </div>
      </div>

    </div>
  );
};
