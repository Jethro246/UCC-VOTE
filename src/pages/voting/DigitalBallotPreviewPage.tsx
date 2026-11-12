import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MOCK_POSITIONS } from '../../data/mockData';
import { Candidate } from '../../types';
import { 
  Vote, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  AlertCircle, 
  Check, 
  RotateCcw,
  Download,
  Share2
} from 'lucide-react';

export const DigitalBallotPreviewPage: React.FC = () => {
  const { 
    selectedElectionId, 
    elections, 
    navigateTo, 
    ballotSelections, 
    setBallotSelection, 
    resetBallot,
    submitSimulatedVote,
    student,
    recentVoteReceipt,
    candidates
  } = useApp();

  const election = elections.find(e => e.id === selectedElectionId) || elections[0];
  const positions = MOCK_POSITIONS[election.id] || [];

  // Steps: 1: Portfolios/Candidates selection, 2: Review ballot, 3: Submission Confirmed
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [activePositionIndex, setActivePositionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptCode, setReceiptCode] = useState('');
  const [confirmNoticeAgreed, setConfirmNoticeAgreed] = useState(false);

  const activePosition = positions[activePositionIndex] || positions[0];
  const hasVotedThisElection = student?.hasVotedElections.includes(election.id);

  const currentSelectionForPos = activePosition ? ballotSelections[activePosition.id] : undefined;

  const handleSelectCandidate = (candId: string) => {
    if (!activePosition) return;
    setBallotSelection(activePosition.id, candId);
  };

  const handleNextPosition = () => {
    if (activePositionIndex < positions.length - 1) {
      setActivePositionIndex(activePositionIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Proceed to review step
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPosition = () => {
    if (activePositionIndex > 0) {
      setActivePositionIndex(activePositionIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const code = submitSimulatedVote(election.id);
      setReceiptCode(code);
      setIsSubmitting(false);
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1000);
  };

  // If already voted
  if (hasVotedThisElection && currentStep !== 3) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Ballot Already Recorded
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Your single authorized ballot for <strong>{election.title}</strong> has already been cast and cryptographically sealed. 
            Duplicate submissions are strictly prohibited under UCC Electoral Regulations.
          </p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 max-w-md mx-auto space-y-2">
          <div className="flex justify-between">
            <span>Voter Identity:</span>
            <span className="font-mono font-bold text-slate-900">{student?.studentId || 'PS/CSC/22/0089'}</span>
          </div>
          <div className="flex justify-between">
            <span>Eligibility Status:</span>
            <span className="text-emerald-700 font-bold">BALLOT_RECORDED_SUCCESS</span>
          </div>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => navigateTo('student_dashboard')}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
          >
            Return to Dashboard
          </button>
          <button
            onClick={() => navigateTo('election_results', { electionId: election.id })}
            className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-xs font-bold text-white transition-colors cursor-pointer"
          >
            View Live Results
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: Post-Submission Success Confirmation
  if (currentStep === 3) {
    const codeToShow = receiptCode || recentVoteReceipt?.receiptCode || 'UCC-78B4-9021';
    return (
      <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
              Vote Confirmed & Sealed
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">
              Ballot Successfully Cast!
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Thank you for participating in the governance of the University of Cape Coast.
            </p>
          </div>

          {/* Cryptographic Receipt Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Auditable Voter Receipt Token
              </span>
              <span className="text-[10px] font-mono text-emerald-700 font-bold">VERIFIED</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Election:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]">{election.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp:</span>
                <span className="font-mono text-slate-700">{new Date().toUTCString()}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-500">Receipt Hash:</span>
                <span className="font-mono font-bold text-xs bg-slate-200 px-2 py-0.5 rounded text-[#123B70]">
                  {codeToShow}
                </span>
              </div>
            </div>
          </div>

          {/* Secrecy notice */}
          <div className="p-3 rounded-lg bg-[#EAF2FA] text-xs text-[#123B70] text-left flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Ballot Secrecy Guarantee:</strong> Your selected candidates have been unlinked from your student profile and anonymously placed into the certified tally vault. Even the Electoral Commission cannot inspect which candidates you voted for.
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => navigateTo('election_results', { electionId: election.id })}
              className="w-full py-2.5 px-3 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Monitor Election Turnout
            </button>
            <button
              onClick={() => navigateTo('student_dashboard')}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: Review Ballot Before Final Submission
  if (currentStep === 2) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
                Step 2 of 2: Final Verification
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                Review Your Digital Ballot
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Please verify your selections before final cryptographic confirmation.
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(1)}
              className="text-xs font-semibold text-[#123B70] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Modify Choices</span>
            </button>
          </div>

          {/* Selections breakdown */}
          <div className="space-y-4">
            {positions.map((pos) => {
              const selectedCandId = ballotSelections[pos.id];
              const cand = selectedCandId ? candidates.find(c => c.id === selectedCandId) : null;

              return (
                <div key={pos.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider">
                      {pos.title}
                    </span>
                    {cand ? (
                      <div className="flex items-center gap-3 mt-1.5">
                        <img
                          src={cand.photoUrl}
                          alt={cand.fullName}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-300"
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {cand.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {cand.department} · {cand.hall}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 italic mt-1 font-medium">
                        No candidate selected (Abstain / Blank Portfolio)
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const posIdx = positions.findIndex(p => p.id === pos.id);
                      if (posIdx !== -1) setActivePositionIndex(posIdx);
                      setCurrentStep(1);
                    }}
                    className="text-xs font-semibold text-[#123B70] hover:underline self-start sm:self-auto cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              );
            })}
          </div>

          {/* Confirmation Checkbox */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmNoticeAgreed}
                onChange={(e) => setConfirmNoticeAgreed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
              />
              <span className="leading-relaxed">
                I confirm that I have reviewed my ballot selections. I understand that once submitted, this vote cannot be recalled, modified, or canceled.
              </span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back to Portfolios
            </button>

            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting || !confirmNoticeAgreed}
              className="px-6 py-3 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Encrypting & Recording Ballot...</span>
              ) : (
                <>
                  <Vote className="w-4 h-4" />
                  <span>Confirm & Cast Vote</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 1: Portfolio and Candidate Selection - ONLY Approved candidates appear on official ballots
  const positionCandidates = activePosition
    ? (activePosition.candidateIds || [])
        .map(id => candidates.find(c => c.id === id))
        .filter((c): c is Candidate => Boolean(c && c.applicationStatus === 'Approved'))
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Breadcrumb & Election Identifier */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider">
            Official Digital Ballot
          </span>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
            {election.title}
          </h1>
        </div>

        {/* Portfolio step pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {positions.map((pos, idx) => {
            const isFilled = Boolean(ballotSelections[pos.id]);
            const isCurrent = idx === activePositionIndex;

            return (
              <button
                key={pos.id}
                onClick={() => setActivePositionIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-[#123B70] text-white shadow-xs'
                    : isFilled
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{idx + 1}</span>
                <span className="hidden sm:inline">. {pos.title.split(' ')[0]}</span>
                {isFilled && <Check className="w-3 h-3 text-emerald-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Portfolio Card */}
      {activePosition && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
                Portfolio {activePosition.order} of {positions.length}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {activePosition.title}
              </h2>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">
                {activePosition.description}
              </p>
            </div>

            <div className="text-xs text-slate-500 shrink-0">
              Select <strong>1</strong> approved candidate
            </div>
          </div>

          {/* Candidates Radio/Card Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {positionCandidates.map((cand) => {
              const isSelected = currentSelectionForPos === cand.id;

              return (
                <div
                  key={cand.id}
                  onClick={() => handleSelectCandidate(cand.id)}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative group flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#123B70] bg-[#EAF2FA]/50 shadow-md ring-2 ring-[#123B70]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-4">
                      <img
                        src={cand.photoUrl}
                        alt={cand.fullName}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-[#123B70] transition-colors leading-tight">
                          {cand.fullName}
                        </h3>
                        {cand.nickname && (
                          <p className="text-xs font-bold text-[#C62828] mt-0.5">
                            "{cand.nickname}"
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {cand.department} · {cand.hall}
                        </p>
                      </div>

                      {/* Selection Radio Circle */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected 
                          ? 'border-[#123B70] bg-[#123B70] text-white' 
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    {/* Manifesto pledge snippet */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 italic">
                      "{cand.manifestoSummary}"
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo('candidate_profile', { candidateId: cand.id });
                      }}
                      className="text-xs font-semibold text-[#123B70] hover:underline"
                    >
                      View Full Manifesto →
                    </button>

                    <span className={`font-bold text-xs ${isSelected ? 'text-[#123B70]' : 'text-slate-400'}`}>
                      {isSelected ? 'SELECTED' : 'Click to Select'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Skip option if allowed by position rules */}
          {activePosition.allowsSkip && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  // remove selection
                  const copy = { ...ballotSelections };
                  delete copy[activePosition.id];
                  // Move to next
                  handleNextPosition();
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Skip this portfolio (Abstain from voting for {activePosition.title})
              </button>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <button
              onClick={handlePrevPosition}
              disabled={activePositionIndex === 0}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous Portfolio</span>
            </button>

            <button
              onClick={handleNextPosition}
              className="px-6 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>
                {activePositionIndex === positions.length - 1 ? 'Review Ballot Summary' : 'Next Portfolio'}
              </span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>
      )}

      {/* Ballot Secrecy Footer Notice */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 flex items-start gap-3">
        <Lock className="w-4 h-4 text-[#123B70] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Institutional Secrecy Architecture:</strong> Your ballot selection is encrypted in transit and decoupled from your student authentication record. Neither university administrators nor hall commissioners have access to unsealed individual ballots.
        </p>
      </div>

    </div>
  );
};
