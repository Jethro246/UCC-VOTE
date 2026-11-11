import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MOCK_CANDIDATES } from '../../data/mockData';
import { 
  Search, 
  Users, 
  ArrowRight, 
  FileText, 
  Check, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  BookOpen
} from 'lucide-react';

export const CandidateDirectoryPage: React.FC = () => {
  const { 
    navigateTo, 
    compareCandidateIds, 
    toggleCompareCandidate,
    elections
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedElection, setSelectedElection] = useState<string>('All');
  const [showCompareModal, setShowCompareModal] = useState(false);

  const candidateList = Object.values(MOCK_CANDIDATES);

  const filteredCandidates = candidateList.filter((c) => {
    const matchesElection = selectedElection === 'All' || c.electionId === selectedElection;
    const matchesSearch = 
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (c.nickname && c.nickname.toLowerCase().includes(search.toLowerCase())) ||
      c.department.toLowerCase().includes(search.toLowerCase()) ||
      c.manifestoSummary.toLowerCase().includes(search.toLowerCase());
    return matchesElection && matchesSearch;
  });

  const compareCandidates = compareCandidateIds
    ? [MOCK_CANDIDATES[compareCandidateIds[0]], MOCK_CANDIDATES[compareCandidateIds[1]]].filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
            Approved Aspirants Registry
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Candidate Directory & Manifestos
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Examine the leadership vision, background, and policy proposals of approved student candidates.
          </p>
        </div>

        {/* Compare Bar Button */}
        {compareCandidates.length === 2 && (
          <button
            onClick={() => setShowCompareModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer self-start md:self-auto"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span>Compare Aspirants ({compareCandidates.length})</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-500 whitespace-nowrap">Filter by Election:</span>
          <select
            value={selectedElection}
            onChange={(e) => setSelectedElection(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
          >
            <option value="All">All Elections</option>
            {elections.map(el => (
              <option key={el.id} value={el.id}>{el.title}</option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, department..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white"
          />
        </div>
      </div>

      {/* Candidate Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCandidates.map((cand) => {
          const isComparing = compareCandidateIds?.includes(cand.id);

          return (
            <div
              key={cand.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-[#123B70]/40 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Photo & Identity Header */}
                <div className="p-5 flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={cand.photoUrl}
                      alt={cand.fullName}
                      className="w-20 h-20 rounded-xl object-cover object-center border border-slate-200 shrink-0 group-hover:scale-102 transition-transform shadow-xs"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#123B70] text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider block">
                      {cand.hall}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#123B70] transition-colors leading-tight">
                      {cand.fullName}
                    </h3>
                    {cand.nickname && (
                      <p className="text-xs font-semibold text-[#C62828]">
                        "{cand.nickname}"
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 font-mono">
                      {cand.studentId}
                    </p>
                  </div>
                </div>

                {/* Candidate Academic Details */}
                <div className="px-5 pb-3">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[170px]">{cand.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Class Level:</span>
                      <span className="font-semibold text-slate-800">Level {cand.level}</span>
                    </div>
                  </div>
                </div>

                {/* Manifesto Snippet */}
                <div className="px-5 pb-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Manifesto Highlights
                  </span>
                  <p className="text-xs text-slate-600 line-clamp-2 italic leading-relaxed">
                    "{cand.manifestoSummary}"
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleCompareCandidate(cand.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isComparing
                      ? 'bg-blue-100 text-[#123B70] border border-blue-300'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                  }`}
                >
                  {isComparing ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#123B70]" />
                      <span>In Compare</span>
                    </>
                  ) : (
                    <span>+ Compare</span>
                  )}
                </button>

                <button
                  onClick={() => navigateTo('candidate_profile', { candidateId: cand.id })}
                  className="px-3.5 py-1.5 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <span>Full Manifesto</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Candidate Comparison Modal */}
      {showCompareModal && compareCandidates.length === 2 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
                  Objective Policy Comparison
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Side-by-Side Candidate Manifesto Comparison
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Neutral non-partisan review of qualifications and key pledges
                </p>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {compareCandidates.map((c) => (
                <div key={c.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={c.photoUrl}
                      alt={c.fullName}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-300"
                    />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{c.fullName}</h3>
                      {c.nickname && <p className="text-xs text-[#C62828] font-bold">"{c.nickname}"</p>}
                      <p className="text-xs text-slate-500">{c.department} · {c.hall}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                      Core Vision & Manifesto
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed italic bg-white p-3 rounded-lg border border-slate-200">
                      "{c.manifestoSummary}"
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                      Key Campaign Pledges
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {c.keyPromises.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#123B70] font-bold">✓</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                      Prior Leadership Experience
                    </h4>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {c.leadershipExperience.map((exp, idx) => (
                        <li key={idx}>· {exp}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setShowCompareModal(false);
                      navigateTo('candidate_profile', { candidateId: c.id });
                    }}
                    className="w-full py-2 rounded-lg bg-[#123B70] text-white text-xs font-bold hover:bg-[#0B1F3A]"
                  >
                    View Individual Profile
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowCompareModal(false)}
                className="px-6 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
