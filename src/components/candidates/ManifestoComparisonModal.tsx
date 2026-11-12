import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Candidate, Position } from '../../types';
import { 
  X, 
  SlidersHorizontal, 
  Scale, 
  CheckCircle2, 
  Award, 
  BookOpen, 
  GraduationCap, 
  MapPin, 
  Video, 
  ArrowRight,
  Vote,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface ManifestoComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCandidateIds?: string[];
  candidates?: Candidate[];
  positionTitle?: string;
  electionTitle?: string;
  initialElectionId?: string;
  initialPositionId?: string;
}

export const ManifestoComparisonModal: React.FC<ManifestoComparisonModalProps> = ({
  isOpen,
  onClose,
  initialCandidateIds = [],
  candidates: propCandidates,
  positionTitle,
  electionTitle
}) => {
  const { candidates: contextCandidates, elections, navigateTo } = useApp();

  const sourceCandidates = propCandidates && propCandidates.length > 0 ? propCandidates : contextCandidates;

  const [selectedElectionId, setSelectedElectionId] = useState<string>('UCC-SRC-2026');
  const [selectedPositionId, setSelectedPositionId] = useState<string>('pos-src-pres');
  const [activeCandidateId1, setActiveCandidateId1] = useState<string>(
    initialCandidateIds[0] || (sourceCandidates[0]?.id || 'cand-01')
  );
  const [activeCandidateId2, setActiveCandidateId2] = useState<string>(
    initialCandidateIds[1] || (sourceCandidates[1]?.id || sourceCandidates[0]?.id || 'cand-02')
  );

  if (!isOpen) return null;

  // Filter approved or accredited candidates for comparison
  const approvedCandidates = sourceCandidates.filter(
    c => c.applicationStatus === 'Approved' || (propCandidates && propCandidates.includes(c))
  );

  // Candidate 1 and Candidate 2
  const candidate1 = approvedCandidates.find(c => c.id === activeCandidateId1) || approvedCandidates[0];
  const candidate2 = approvedCandidates.find(c => c.id === activeCandidateId2) || approvedCandidates[1] || candidate1;

  // Opponents running for the same position
  const samePositionCandidates = approvedCandidates.filter(c => 
    c.electionId === candidate1?.electionId && c.positionId === candidate1?.positionId
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-[#123B70] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Impartial Side-by-Side Manifesto Comparison
              </h2>
              <p className="text-xs text-blue-100">
                Neutral Aspirant Scrutiny · University of Cape Coast E-Voting Platform
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close comparison"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Candidate Selector Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Contested Portfolio:</span>
            <span className="px-3 py-1 rounded-lg bg-[#EAF2FA] text-[#123B70] text-xs font-extrabold">
              {candidate1?.department || 'Executive Office'} · {candidate1?.hall || 'UCC'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Candidate A:</span>
              <select
                value={activeCandidateId1}
                onChange={(e) => setActiveCandidateId1(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-800"
              >
                {approvedCandidates.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.hall})</option>
                ))}
              </select>
            </div>

            <span className="text-xs font-bold text-slate-400">vs</span>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Candidate B:</span>
              <select
                value={activeCandidateId2}
                onChange={(e) => setActiveCandidateId2(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-800"
              >
                {approvedCandidates.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.hall})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Neutrality Disclaimer */}
        <div className="bg-amber-50/70 border-b border-amber-200 px-6 py-2.5 text-[11px] text-amber-900 flex items-center justify-between gap-2 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              <strong>Neutrality Guarantee:</strong> Information is drawn verbatim from candidate vetting submissions. The UCC Electoral Commission maintains strict neutrality and does not endorse any candidate.
            </span>
          </span>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* Candidates Identity Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Candidate 1 Header Card */}
            <div className="p-5 rounded-2xl border-2 border-[#123B70]/30 bg-white shadow-xs space-y-3">
              <div className="flex items-center gap-4">
                <img
                  src={candidate1?.photoUrl}
                  alt={candidate1?.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#123B70] shadow-sm shrink-0"
                />
                <div>
                  <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider block">Candidate A</span>
                  <h3 className="text-base font-extrabold text-slate-900">{candidate1?.fullName}</h3>
                  {candidate1?.nickname && (
                    <p className="text-xs font-bold text-[#C62828]">"{candidate1.nickname}"</p>
                  )}
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{candidate1?.studentId}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-[10px] text-slate-400 block">Programme</span>
                  <span className="font-medium text-slate-800">{candidate1?.programme || candidate1?.department}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Hall of Residence</span>
                  <span className="font-medium text-slate-800">{candidate1?.hall} (L{candidate1?.level})</span>
                </div>
              </div>
            </div>

            {/* Candidate 2 Header Card */}
            <div className="p-5 rounded-2xl border-2 border-[#C62828]/30 bg-white shadow-xs space-y-3">
              <div className="flex items-center gap-4">
                <img
                  src={candidate2?.photoUrl}
                  alt={candidate2?.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#C62828] shadow-sm shrink-0"
                />
                <div>
                  <span className="text-[10px] font-bold text-[#C62828] uppercase tracking-wider block">Candidate B</span>
                  <h3 className="text-base font-extrabold text-slate-900">{candidate2?.fullName}</h3>
                  {candidate2?.nickname && (
                    <p className="text-xs font-bold text-[#C62828]">"{candidate2.nickname}"</p>
                  )}
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{candidate2?.studentId}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-[10px] text-slate-400 block">Programme</span>
                  <span className="font-medium text-slate-800">{candidate2?.programme || candidate2?.department}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Hall of Residence</span>
                  <span className="font-medium text-slate-800">{candidate2?.hall} (L{candidate2?.level})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Core Manifesto Slogan */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-center">
              Core Campaign Pillar / Slogan
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl border border-blue-100 bg-[#EAF2FA]/50 text-xs text-[#123B70] font-medium leading-relaxed italic">
                "{candidate1?.manifestoSummary}"
              </div>
              <div className="p-4 rounded-xl border border-red-100 bg-red-50/50 text-xs text-red-900 font-medium leading-relaxed italic">
                "{candidate2?.manifestoSummary}"
              </div>
            </div>
          </div>

          {/* Section: Manifesto Pillars */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-center">
              Comprehensive Manifesto Proposals
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                {candidate1?.fullManifesto.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-700 flex items-start gap-2.5">
                    <span className="font-bold text-[#123B70] shrink-0">{idx + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {candidate2?.fullManifesto.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-700 flex items-start gap-2.5">
                    <span className="font-bold text-[#C62828] shrink-0">{idx + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Key Promises */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-center">
              Key Campaign Promises & Pledges
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                {candidate1?.keyPromises.map((promise, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#123B70] shrink-0 mt-0.5" />
                    <span>{promise}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                {candidate2?.keyPromises.map((promise, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C62828] shrink-0 mt-0.5" />
                    <span>{promise}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Leadership Experience */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-center">
              Leadership Experience & Past Track Record
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs text-slate-700">
                {candidate1?.leadershipExperience.map((exp, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#123B70] font-bold">·</span>
                    <span>{exp}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs text-slate-700">
                {candidate2?.leadershipExperience.map((exp, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#C62828] font-bold">·</span>
                    <span>{exp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Campaign Video Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {candidate1?.videoUrl ? (
                <a
                  href={candidate1.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#123B70] bg-white flex items-center justify-between text-xs text-[#123B70] font-semibold transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-red-600" />
                    <span>Watch {candidate1.fullName}'s Video Pitch</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400 italic text-center">
                  No video pitch submitted
                </div>
              )}
            </div>

            <div>
              {candidate2?.videoUrl ? (
                <a
                  href={candidate2.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#C62828] bg-white flex items-center justify-between text-xs text-[#C62828] font-semibold transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-red-600" />
                    <span>Watch {candidate2.fullName}'s Video Pitch</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400 italic text-center">
                  No video pitch submitted
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Compare student leaders objectively on policy, feasibility, and character.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                navigateTo('digital_ballot', { electionId: candidate1?.electionId });
              }}
              className="px-4 py-2 rounded-xl bg-[#C62828] hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Vote className="w-4 h-4" />
              <span>Proceed to Digital Ballot</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close Comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
