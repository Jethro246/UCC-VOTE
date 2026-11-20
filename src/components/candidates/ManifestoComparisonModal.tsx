import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Candidate } from '../../types';
import { CandidateAvatar } from '../common/CandidateAvatar';
import { resolveCandidatePhotoUrl } from '../../utils/contestantUtils';
import {
  X,
  Scale,
  CheckCircle2,
  Video,
  Vote,
  ExternalLink,
  ShieldCheck,
  AlertCircle
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
  initialElectionId,
  initialPositionId
}) => {
  const {
    candidates: contextCandidates,
    elections,
    positionsByElection,
    navigateTo
  } = useApp();

  const sourceCandidates =
    propCandidates && propCandidates.length > 0 ? propCandidates : contextCandidates;

  const approvedCandidates = useMemo(
    () =>
      sourceCandidates.filter(
        (c) =>
          c.applicationStatus === 'Approved' ||
          (propCandidates && propCandidates.some((pc) => pc.id === c.id))
      ),
    [sourceCandidates, propCandidates]
  );

  const [selectedElectionId, setSelectedElectionId] = useState<string>(
    initialElectionId || elections[0]?.id || ''
  );
  const [selectedPositionId, setSelectedPositionId] = useState<string>(
    initialPositionId || ''
  );
  const [activeCandidateId1, setActiveCandidateId1] = useState<string>(
    initialCandidateIds[0] || ''
  );
  const [activeCandidateId2, setActiveCandidateId2] = useState<string>(
    initialCandidateIds[1] || ''
  );

  useEffect(() => {
    if (!isOpen) return;
    if (initialElectionId) {
      setSelectedElectionId(initialElectionId);
    } else if (initialCandidateIds[0]) {
      const seed = approvedCandidates.find((c) => c.id === initialCandidateIds[0]);
      if (seed) {
        setSelectedElectionId(seed.electionId);
        setSelectedPositionId(seed.positionId);
      }
    } else if (!selectedElectionId && elections[0]?.id) {
      setSelectedElectionId(elections[0].id);
    }
    if (initialPositionId) {
      setSelectedPositionId(initialPositionId);
    }
  }, [isOpen, initialElectionId, initialPositionId, initialCandidateIds, approvedCandidates]);

  const positionsInSelectedElection = useMemo(() => {
    const posList = positionsByElection[selectedElectionId] || [];
    if (posList.length > 0) return posList;
    const ids = Array.from(
      new Set(
        approvedCandidates
          .filter((c) => c.electionId === selectedElectionId)
          .map((c) => c.positionId)
      )
    );
    return ids.map((id, idx) => ({
      id,
      electionId: selectedElectionId,
      title: id,
      description: '',
      maxSelections: 1,
      allowsSkip: true,
      order: idx + 1,
      candidateIds: []
    }));
  }, [positionsByElection, selectedElectionId, approvedCandidates]);

  const samePositionCandidates = useMemo(
    () =>
      approvedCandidates.filter(
        (c) => c.electionId === selectedElectionId && c.positionId === selectedPositionId
      ),
    [approvedCandidates, selectedElectionId, selectedPositionId]
  );

  useEffect(() => {
    if (
      positionsInSelectedElection.length > 0 &&
      !positionsInSelectedElection.some((p) => p.id === selectedPositionId)
    ) {
      setSelectedPositionId(positionsInSelectedElection[0].id);
    }
  }, [positionsInSelectedElection, selectedPositionId]);

  useEffect(() => {
    if (samePositionCandidates.length === 0) return;
    if (!samePositionCandidates.some((c) => c.id === activeCandidateId1)) {
      setActiveCandidateId1(samePositionCandidates[0].id);
    }
    if (!samePositionCandidates.some((c) => c.id === activeCandidateId2)) {
      setActiveCandidateId2(
        samePositionCandidates[1]?.id || samePositionCandidates[0].id
      );
    }
  }, [samePositionCandidates, activeCandidateId1, activeCandidateId2]);

  if (!isOpen) return null;

  const candidate1 =
    samePositionCandidates.find((c) => c.id === activeCandidateId1) || samePositionCandidates[0];
  const candidate2 =
    samePositionCandidates.find((c) => c.id === activeCandidateId2) ||
    samePositionCandidates[1] ||
    candidate1;

  const activeElection = elections.find((e) => e.id === selectedElectionId);
  const activePosition = positionsInSelectedElection.find((p) => p.id === selectedPositionId);

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
              <h2 className="ucc-heading-card text-white">
                Impartial Side-by-Side Manifesto Comparison
              </h2>
              <p className="ucc-caption font-normal text-blue-100">
                Strict Same-Election & Same-Portfolio Scrutiny · {activeElection?.category || 'UCC VOTE'}
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

        {/* Race & Candidate Selector Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block ucc-caption font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Election
              </label>
              <select
                value={selectedElectionId}
                onChange={(e) => setSelectedElectionId(e.target.value)}
                className="w-full px-2.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                {elections.map((el) => (
                  <option key={el.id} value={el.id}>
                    [{el.category}] {el.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block ucc-caption font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Contested Portfolio
              </label>
              <select
                value={selectedPositionId}
                onChange={(e) => setSelectedPositionId(e.target.value)}
                className="w-full px-2.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                {positionsInSelectedElection.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {samePositionCandidates.length >= 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="ucc-body-secondary text-slate-600">
                <span className="font-semibold text-slate-800">Portfolio: </span>
                <span className="font-semibold text-[#123B70]">
                  {activePosition?.title || selectedPositionId}
                </span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="tabular-nums">
                  {samePositionCandidates.length} Approved Candidate
                  {samePositionCandidates.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="ucc-caption text-slate-500">Candidate A:</span>
                  <select
                    value={candidate1?.id || ''}
                    onChange={(e) => setActiveCandidateId1(e.target.value)}
                    className="px-2.5 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-800"
                  >
                    {samePositionCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.hall})
                      </option>
                    ))}
                  </select>
                </div>

                <span className="ucc-caption font-semibold text-slate-400">vs</span>

                <div className="flex items-center gap-1.5">
                  <span className="ucc-caption text-slate-500">Candidate B:</span>
                  <select
                    value={candidate2?.id || ''}
                    onChange={(e) => setActiveCandidateId2(e.target.value)}
                    className="px-2.5 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-800"
                  >
                    {samePositionCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.hall})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Neutrality Disclaimer */}
        <div className="bg-amber-50/70 border-b border-amber-200 px-6 py-2.5 ucc-caption font-normal text-amber-900 flex items-center justify-between gap-2 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              <strong className="font-semibold">Neutrality Guarantee:</strong> Comparison is strictly restricted to candidates contesting the same election and portfolio.
            </span>
          </span>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {samePositionCandidates.length === 0 ? (
            <div className="p-10 text-center space-y-2 border border-slate-200 rounded-2xl bg-slate-50">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="ucc-heading-card text-slate-900">
                No Approved Candidates in Selected Portfolio
              </h3>
              <p className="ucc-body-secondary text-slate-500 max-w-md mx-auto">
                Select another election or portfolio above that has approved candidates to compare their vetted manifestos.
              </p>
            </div>
          ) : (
            <>
          
          {/* Candidates Identity Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Candidate 1 Header Card */}
            <div className="p-5 rounded-2xl border-2 border-[#123B70]/30 bg-white shadow-xs space-y-3">
              <div className="flex items-center gap-4">
                <CandidateAvatar
                  src={resolveCandidatePhotoUrl(candidate1)}
                  alt={candidate1?.fullName || 'Candidate A'}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#123B70] shadow-sm shrink-0"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider">Candidate A</span>
                    {candidate1?.historicalRole && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 ucc-caption font-semibold uppercase">
                        {candidate1.historicalRole}
                      </span>
                    )}
                  </div>
                  <h3 className="ucc-heading-card text-slate-900">{candidate1?.fullName}</h3>
                  {candidate1?.nickname && (
                    <p className="ucc-label font-semibold text-[#C62828]">"{candidate1.nickname}"</p>
                  )}
                  <p className="ucc-caption text-slate-500 tabular-nums mt-0.5">{candidate1?.studentId}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 ucc-body-secondary text-slate-600">
                <div>
                  <span className="ucc-caption text-slate-400 block">Programme</span>
                  <span className="font-medium text-slate-800">{candidate1?.programme || candidate1?.department}</span>
                </div>
                <div>
                  <span className="ucc-caption text-slate-400 block">Hall of Residence</span>
                  <span className="font-medium text-slate-800">
                    {candidate1?.hall}{candidate1?.level && candidate1.level !== 'Not verified' ? ` (L${candidate1.level})` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Candidate 2 Header Card */}
            <div className="p-5 rounded-2xl border-2 border-[#C62828]/30 bg-white shadow-xs space-y-3">
              <div className="flex items-center gap-4">
                <CandidateAvatar
                  src={resolveCandidatePhotoUrl(candidate2)}
                  alt={candidate2?.fullName || 'Candidate B'}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#C62828] shadow-sm shrink-0"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="ucc-caption font-semibold text-[#C62828] uppercase tracking-wider">Candidate B</span>
                    {candidate2?.historicalRole && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 ucc-caption font-semibold uppercase">
                        {candidate2.historicalRole}
                      </span>
                    )}
                  </div>
                  <h3 className="ucc-heading-card text-slate-900">{candidate2?.fullName}</h3>
                  {candidate2?.nickname && (
                    <p className="ucc-label font-semibold text-[#C62828]">"{candidate2.nickname}"</p>
                  )}
                  <p className="ucc-caption text-slate-500 tabular-nums mt-0.5">{candidate2?.studentId}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 ucc-body-secondary text-slate-600">
                <div>
                  <span className="ucc-caption text-slate-400 block">Programme</span>
                  <span className="font-medium text-slate-800">{candidate2?.programme || candidate2?.department}</span>
                </div>
                <div>
                  <span className="ucc-caption text-slate-400 block">Hall of Residence</span>
                  <span className="font-medium text-slate-800">
                    {candidate2?.hall}{candidate2?.level && candidate2.level !== 'Not verified' ? ` (L${candidate2.level})` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Core Manifesto Slogan */}
          <div className="space-y-2">
            <h4 className="ucc-label font-semibold text-slate-900 uppercase tracking-wider text-center">
              Core Campaign Pillar / Slogan
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl border border-blue-100 bg-[#EAF2FA]/50 ucc-body-secondary text-[#123B70] font-medium italic">
                {candidate1?.manifestoSummary ? `"${candidate1.manifestoSummary}"` : 'Not yet provided'}
              </div>
              <div className="p-4 rounded-xl border border-red-100 bg-red-50/50 ucc-body-secondary text-red-900 font-medium italic">
                {candidate2?.manifestoSummary ? `"${candidate2.manifestoSummary}"` : 'Not yet provided'}
              </div>
            </div>
          </div>

          {/* Section: Manifesto Pillars */}
          <div className="space-y-2">
            <h4 className="ucc-label font-semibold text-slate-900 uppercase tracking-wider text-center">
              Comprehensive Manifesto Proposals
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                {candidate1?.fullManifesto && candidate1.fullManifesto.length > 0 ? (
                  candidate1.fullManifesto.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 ucc-body-secondary text-slate-700 flex items-start gap-2.5">
                      <span className="font-semibold text-[#123B70] tabular-nums shrink-0">{idx + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 ucc-body-secondary text-slate-400 italic">
                    Not yet provided
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {candidate2?.fullManifesto && candidate2.fullManifesto.length > 0 ? (
                  candidate2.fullManifesto.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 ucc-body-secondary text-slate-700 flex items-start gap-2.5">
                      <span className="font-semibold text-[#C62828] tabular-nums shrink-0">{idx + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 ucc-body-secondary text-slate-400 italic">
                    Not yet provided
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Key Promises */}
          <div className="space-y-2">
            <h4 className="ucc-label font-semibold text-slate-900 uppercase tracking-wider text-center">
              Key Campaign Promises & Pledges
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                {candidate1?.keyPromises && candidate1.keyPromises.length > 0 ? (
                  candidate1.keyPromises.map((promise, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white ucc-body-secondary text-slate-700 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#123B70] shrink-0 mt-1" />
                      <span>{promise}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 ucc-body-secondary text-slate-400 italic">
                    Not yet provided
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                {candidate2?.keyPromises && candidate2.keyPromises.length > 0 ? (
                  candidate2.keyPromises.map((promise, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white ucc-body-secondary text-slate-700 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C62828] shrink-0 mt-1" />
                      <span>{promise}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 ucc-body-secondary text-slate-400 italic">
                    Not yet provided
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Leadership Experience */}
          <div className="space-y-2">
            <h4 className="ucc-label font-semibold text-slate-900 uppercase tracking-wider text-center">
              Leadership Experience & Past Track Record
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 ucc-body-secondary text-slate-700">
                {candidate1?.leadershipExperience && candidate1.leadershipExperience.length > 0 ? (
                  candidate1.leadershipExperience.map((exp, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-[#123B70] font-semibold">·</span>
                      <span>{exp}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400 italic">Not yet provided</span>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 ucc-body-secondary text-slate-700">
                {candidate2?.leadershipExperience && candidate2.leadershipExperience.length > 0 ? (
                  candidate2.leadershipExperience.map((exp, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-[#C62828] font-semibold">·</span>
                      <span>{exp}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400 italic">Not yet provided</span>
                )}
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
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#123B70] bg-white flex items-center justify-between ucc-btn text-[#123B70] font-semibold transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-red-600" />
                    <span>Watch {candidate1.fullName}'s Video Pitch</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 ucc-body-secondary text-slate-400 italic text-center">
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
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#C62828] bg-white flex items-center justify-between ucc-btn text-[#C62828] font-semibold transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-red-600" />
                    <span>Watch {candidate2.fullName}'s Video Pitch</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 ucc-body-secondary text-slate-400 italic text-center">
                  No video pitch submitted
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="ucc-body-secondary text-slate-500">
            Compare student leaders objectively on policy, feasibility, and character.
          </div>

          <div className="flex items-center gap-3">
            {activeElection?.status === 'live' && (
              <button
                disabled={!candidate1?.electionId}
                onClick={() => {
                  onClose();
                  if (candidate1?.electionId) {
                    navigateTo('digital_ballot', { electionId: candidate1.electionId });
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#C62828] hover:bg-red-700 disabled:opacity-50 text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Vote className="w-4 h-4" />
                <span>Proceed to Digital Ballot</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 ucc-btn font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close Comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
