import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Candidate, Position } from '../../types';
import { CandidateAvatar } from '../common/CandidateAvatar';
import {
  evaluateElectionCandidateActionAllowed,
  resolveCandidatePhotoUrl,
} from '../../utils/contestantUtils';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Award, 
  GraduationCap, 
  Building, 
  Video, 
  Edit3, 
  Check, 
  RotateCcw, 
  ExternalLink,
  UserCheck
} from 'lucide-react';

interface CandidateReviewModalProps {
  candidate: Candidate;
  position?: Position;
  electionTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onEditCandidate: (candidate: Candidate) => void;
}

export const CandidateReviewModal: React.FC<CandidateReviewModalProps> = ({
  candidate,
  position,
  electionTitle,
  isOpen,
  onClose,
  onEditCandidate
}) => {
  const { 
    approveCandidateAction, 
    rejectCandidateAction, 
    requestCandidateCorrectionsAction,
    verifyCandidateEligibilityAction,
    assignCandidatePositionAction,
    elections,
    positionsByElection
  } = useApp();

  const [activeTab, setActiveTab] = useState<'dossier' | 'eligibility' | 'actions'>('dossier');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [selectedPositionId, setSelectedPositionId] = useState(candidate.positionId);
  const [isReassigning, setIsReassigning] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async () => {
    setIsProcessing(true);
    setFeedbackMsg(null);
    try {
      const res = await verifyCandidateEligibilityAction(candidate.id);
      if (res.success) {
        setFeedbackMsg({
          text: res.isEligible 
            ? 'Candidate satisfies all SIS academic standing and constituency criteria!'
            : `Eligibility Warning: ${res.reason || 'Candidate failed one or more vetting criteria.'}`,
          type: res.isEligible ? 'success' : 'error'
        });
      } else {
        setFeedbackMsg({ text: res.error || 'Verification check failed.', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    setFeedbackMsg(null);
    try {
      const res = await approveCandidateAction(candidate.id);
      if (res.success) {
        setFeedbackMsg({ text: res.message || 'Candidate nomination successfully approved!', type: 'success' });
        setTimeout(() => onClose(), 1200);
      } else {
        setFeedbackMsg({ text: res.error || 'Approval failed.', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setFeedbackMsg({ text: 'Please enter a valid constitutional or academic reason for rejection.', type: 'error' });
      return;
    }
    setIsProcessing(true);
    setFeedbackMsg(null);
    try {
      const res = await rejectCandidateAction(candidate.id, rejectionReason.trim());
      if (res.success) {
        setFeedbackMsg({ text: res.message || 'Candidate nomination rejected.', type: 'success' });
        setTimeout(() => onClose(), 1200);
      } else {
        setFeedbackMsg({ text: res.error || 'Rejection failed.', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestCorrections = async () => {
    if (!correctionNotes.trim()) {
      setFeedbackMsg({ text: 'Please state the specific revisions requested from the candidate.', type: 'error' });
      return;
    }
    setIsProcessing(true);
    setFeedbackMsg(null);
    try {
      const res = await requestCandidateCorrectionsAction(candidate.id, correctionNotes.trim());
      if (res.success) {
        setFeedbackMsg({ text: res.message || 'Correction request dispatched to candidate.', type: 'success' });
        setTimeout(() => onClose(), 1200);
      } else {
        setFeedbackMsg({ text: res.error || 'Failed to dispatch correction request.', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReassignPosition = async () => {
    if (!selectedPositionId || selectedPositionId === candidate.positionId) return;
    const electionObj = elections.find((e) => e.id === candidate.electionId);
    const guard = evaluateElectionCandidateActionAllowed(
      electionObj,
      'change_position',
      candidate
    );
    if (!guard.allowed) {
      setFeedbackMsg({
        text: guard.reason || 'Portfolio reassignment is blocked for this election.',
        type: 'error',
      });
      return;
    }
    setIsProcessing(true);
    try {
      const res = await assignCandidatePositionAction(candidate.id, candidate.electionId, selectedPositionId);
      if (res.success) {
        setFeedbackMsg({ text: 'Portfolio assignment updated successfully.', type: 'success' });
        setIsReassigning(false);
      } else {
        setFeedbackMsg({ text: res.error || 'Failed to reassign position.', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Status color pill
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="text-emerald-700 font-semibold ucc-caption uppercase">Approved for Ballot</span>;
      case 'Rejected':
        return <span className="text-red-700 font-semibold ucc-caption uppercase">Application Rejected</span>;
      case 'Submitted':
        return <span className="text-blue-700 font-semibold ucc-caption uppercase">Awaiting Vetting</span>;
      case 'Under review':
        return <span className="text-amber-700 font-semibold ucc-caption uppercase">Under Active Review</span>;
      case 'Draft':
        return <span className="text-slate-600 font-semibold ucc-caption uppercase">Draft Application</span>;
      case 'Withdrawn':
        return <span className="text-slate-600 font-semibold ucc-caption uppercase">Nomination Withdrawn</span>;
      default:
        return <span className="text-slate-600 font-semibold ucc-caption uppercase">{status}</span>;
    }
  };

  const targetElection = elections.find(e => e.id === candidate.electionId);
  const electionPositions = positionsByElection[candidate.electionId] || [];
  const resolvedPosition =
    position || electionPositions.find(p => p.id === candidate.positionId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0B1F3A] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="ucc-heading-card text-white">
                Vetting Committee Dossier Review
              </h2>
              <p className="ucc-body-secondary text-blue-200">
                Official Electoral Commission Candidate Scrutiny Panel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close review modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Candidate Summary Strip */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <CandidateAvatar
              src={resolveCandidatePhotoUrl(candidate)}
              alt={candidate.fullName}
              className="w-14 h-14 rounded-xl object-cover border border-slate-300 shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="ucc-heading-card text-slate-900">{candidate.fullName}</h3>
                {candidate.nickname && (
                  <span className="ucc-label font-semibold text-[#C62828]">"{candidate.nickname}"</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 ucc-body-secondary text-slate-500 mt-0.5">
                <span className="tabular-nums text-slate-700 font-semibold">{candidate.studentId}</span>
                <span>·</span>
                <span>{candidate.department}</span>
                <span>·</span>
                <span className="tabular-nums">Level {candidate.level}</span>
                <span>·</span>
                <span>{candidate.hall}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="text-right sm:block hidden">
              <span className="ucc-caption text-slate-400 uppercase tracking-wider block">Application Status</span>
              {getStatusBadge(candidate.applicationStatus)}
            </div>
            <button
              onClick={() => {
                onClose();
                onEditCandidate(candidate);
              }}
              className="px-3 py-1.5 ucc-btn font-semibold rounded-xl border border-slate-300 hover:bg-white text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Edit Record</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('dossier')}
            className={`px-4 py-3 ucc-nav-item font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'dossier'
                ? 'border-[#123B70] text-[#123B70]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Nomination Dossier
          </button>
          <button
            onClick={() => setActiveTab('eligibility')}
            className={`px-4 py-3 ucc-nav-item font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'eligibility'
                ? 'border-[#123B70] text-[#123B70]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>SIS Academic Standing Check</span>
            {candidate.eligibilityVerified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-3 ucc-nav-item font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'actions'
                ? 'border-[#123B70] text-[#123B70]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Commission Actions & Ballot Clearance
          </button>
        </div>

        {/* Feedback Message */}
        {feedbackMsg && (
          <div className={`mx-6 mt-4 p-3.5 rounded-xl border ucc-body-secondary flex items-start gap-2.5 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Modal Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* TAB 1: DOSSIER */}
          {activeTab === 'dossier' && (
            <div className="space-y-6">
              
              {/* Election & Portfolio Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider block">
                    Portfolio Contested
                  </span>
                  <h4 className="ucc-body font-bold text-slate-900 mt-0.5">
                    {resolvedPosition?.title || candidate.positionId}
                  </h4>
                  <p className="ucc-body-secondary text-slate-600 mt-0.5">
                    Election: {electionTitle || targetElection?.title || candidate.electionId}
                    {targetElection?.subdomainLabel ? ` · ${targetElection.subdomainLabel}` : ''}
                  </p>
                </div>

                <button
                  onClick={() => setIsReassigning(!isReassigning)}
                  className="ucc-btn font-semibold text-[#123B70] hover:underline self-start sm:self-auto cursor-pointer"
                >
                  {isReassigning ? 'Cancel Reassignment' : 'Reassign Portfolio'}
                </button>
              </div>

              {/* Reassignment Dropdown if active */}
              {isReassigning && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
                  <span className="ucc-label font-semibold text-[#123B70] block">
                    Reassign Candidate to Another Position in {targetElection?.title || candidate.electionId}:
                  </span>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {electionPositions.length > 0 ? (
                      <select
                        value={selectedPositionId}
                        onChange={(e) => setSelectedPositionId(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-xl border border-slate-300 bg-white flex-1"
                      >
                        {electionPositions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedPositionId}
                        onChange={(e) => setSelectedPositionId(e.target.value)}
                        placeholder="Enter target Position ID"
                        className="px-3 py-1.5 text-sm rounded-xl border border-slate-300 bg-white flex-1"
                      />
                    )}
                    <button
                      onClick={handleReassignPosition}
                      disabled={isProcessing}
                      className="px-4 py-1.5 rounded-xl bg-[#123B70] text-white ucc-btn font-semibold cursor-pointer hover:bg-[#0B1F3A] whitespace-nowrap"
                    >
                      Confirm Reassignment
                    </button>
                  </div>
                </div>
              )}

              {/* Biography */}
              {candidate.biography && (
                <div className="space-y-1.5">
                  <h4 className="ucc-caption font-semibold text-slate-900 uppercase tracking-wider">
                    Candidate Biography
                  </h4>
                  <p className="ucc-body-secondary text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    {candidate.biography}
                  </p>
                </div>
              )}

              {/* Leadership Track Record */}
              <div className="space-y-2">
                <h4 className="ucc-caption font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#123B70]" />
                  <span>Leadership Experience & Past Portfolios</span>
                </h4>
                <ul className="space-y-1.5">
                  {candidate.leadershipExperience.map((item, idx) => (
                    <li key={idx} className="ucc-body-secondary text-slate-700 flex items-start gap-2">
                      <span className="text-[#123B70] font-bold">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Manifesto Summary */}
              <div className="space-y-1.5">
                <h4 className="ucc-caption font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#123B70]" />
                  <span>Manifesto Pillar Summary</span>
                </h4>
                {candidate.campaignStatement && (
                  <p className="ucc-body-secondary font-semibold text-slate-800 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
                    Campaign Statement: {candidate.campaignStatement}
                  </p>
                )}
                <div className="p-3.5 rounded-xl border border-blue-100 bg-[#EAF2FA]/50 ucc-body-secondary font-medium text-[#123B70]">
                  "{candidate.manifestoSummary}"
                </div>
              </div>

              {/* Full Manifesto Points */}
              <div className="space-y-2">
                <h4 className="ucc-caption font-semibold text-slate-900 uppercase tracking-wider">
                  Detailed Manifesto Proposals
                </h4>
                <div className="space-y-2">
                  {candidate.fullManifesto.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white ucc-body-secondary text-slate-700 flex items-start gap-2.5">
                      <span className="font-semibold text-[#123B70] shrink-0 tabular-nums">{idx + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Campaign Promises */}
              <div className="space-y-2">
                <h4 className="ucc-caption font-semibold text-slate-900 uppercase tracking-wider">
                  Campaign Promises & Commitments
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {candidate.keyPromises.map((promise, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 ucc-body-secondary text-slate-700 flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{promise}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campaign Video */}
              {candidate.videoUrl && (
                <div className="space-y-2">
                  <h4 className="ucc-caption font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-[#123B70]" />
                    <span>Campaign Video Broadcast</span>
                  </h4>
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 ucc-body-secondary">
                    <span className="text-slate-600 truncate">{candidate.videoUrl}</span>
                    <a
                      href={candidate.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg bg-[#123B70] text-white ucc-btn font-semibold flex items-center gap-1 shrink-0"
                    >
                      <span>Watch</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Audit history */}
              <div className="pt-2 ucc-caption text-slate-500 border-t border-slate-200 flex flex-wrap gap-4 tabular-nums">
                {candidate.submittedAt && (
                  <span>Submitted: {new Date(candidate.submittedAt).toLocaleDateString()}</span>
                )}
                {candidate.reviewedAt && (
                  <span>Last Reviewed: {new Date(candidate.reviewedAt).toLocaleDateString()}</span>
                )}
                {candidate.reviewedBy && (
                  <span>Auditor: {candidate.reviewedBy}</span>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SIS ELIGIBILITY & VETTING GATES */}
          {activeTab === 'eligibility' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <h4 className="ucc-label font-semibold text-slate-900">
                    Official Student Information System (SIS) Automated Check
                  </h4>
                  <p className="ucc-body-secondary text-slate-500 mt-0.5">
                    Cross-references candidate credentials with the UCC Academic Affairs and Hall Registry.
                  </p>
                </div>
                <button
                  onClick={handleVerify}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>{isProcessing ? 'Verifying...' : 'Re-run SIS Registry Verification'}</span>
                </button>
              </div>

              {/* Vetting Checklist Breakdown */}
              <div className="space-y-3">
                <h4 className="ucc-caption font-semibold text-slate-900 uppercase tracking-wider">
                  Mandatory Statutory Vetting Checklist
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Gate 1 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="ucc-label font-semibold text-slate-800">1. Active Semester Enrollment</span>
                      {candidate.eligibilityDetails?.isEnrolled !== false ? (
                        <span className="text-emerald-700 font-semibold ucc-caption flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold ucc-caption flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Not Enrolled
                        </span>
                      )}
                    </div>
                    <p className="ucc-caption text-slate-500">
                      Confirmed registered student status for the 2025/2026 academic term.
                    </p>
                  </div>

                  {/* Gate 2 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="ucc-label font-semibold text-slate-800">2. Academic CGPA Standing</span>
                      {candidate.eligibilityDetails?.cgpaQualified !== false ? (
                        <span className="text-emerald-700 font-semibold ucc-caption flex items-center gap-1 tabular-nums">
                          <CheckCircle2 className="w-3.5 h-3.5" /> CGPA &ge; 3.00
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold ucc-caption flex items-center gap-1 tabular-nums">
                          <XCircle className="w-3.5 h-3.5" /> Below 3.00
                        </span>
                      )}
                    </div>
                    <p className="ucc-caption text-slate-500">
                      Minimum CGPA 3.00 required by Article 14 of UCC Electoral Regulations.
                    </p>
                  </div>

                  {/* Gate 3 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="ucc-label font-semibold text-slate-800">3. Academic Level Alignment</span>
                      {candidate.eligibilityDetails?.levelMatch !== false ? (
                        <span className="text-emerald-700 font-semibold ucc-caption flex items-center gap-1 tabular-nums">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Level {candidate.level} Eligible
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold ucc-caption flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Level Mismatch
                        </span>
                      )}
                    </div>
                    <p className="ucc-caption text-slate-500">
                      Validates that candidate level matches executive portfolio rules.
                    </p>
                  </div>

                  {/* Gate 4 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="ucc-label font-semibold text-slate-800">4. Faculty & Hall Constituency</span>
                      {candidate.eligibilityDetails?.hallMatch !== false && candidate.eligibilityDetails?.facultyMatch !== false ? (
                        <span className="text-emerald-700 font-semibold ucc-caption flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Constituency Match
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold ucc-caption flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Non-Resident / Ineligible
                        </span>
                      )}
                    </div>
                    <p className="ucc-caption text-slate-500">
                      Affiliated hall ({candidate.hall}) and faculty ({candidate.faculty}) verified.
                    </p>
                  </div>
                </div>

                {candidate.eligibilityDetails?.summary && (
                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 ucc-body-secondary text-[#123B70]">
                    <strong>Audit Summary:</strong> {candidate.eligibilityDetails.summary}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: COMMISSION ACTIONS */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              <div>
                <h4 className="ucc-caption font-semibold text-slate-900 uppercase tracking-wider mb-2">
                  Electoral Commission Vetting Determinations
                </h4>
                <p className="ucc-body-secondary text-slate-600">
                  Approved candidates will be instantly added to official digital ballots. Rejections and correction requests are automatically audited and archived.
                </p>
              </div>

              {/* Status info box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="ucc-body-secondary text-slate-600">Current Application Status:</span>
                  {getStatusBadge(candidate.applicationStatus)}
                </div>
                {candidate.rejectionReason && (
                  <div className="ucc-body-secondary text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
                    <strong>Rejection Notice:</strong> {candidate.rejectionReason}
                  </div>
                )}
                {candidate.correctionNotes && (
                  <div className="ucc-body-secondary text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    <strong>Correction Notes:</strong> {candidate.correctionNotes}
                  </div>
                )}
              </div>

              {/* Main Decision Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Approve Button */}
                <button
                  onClick={handleApprove}
                  disabled={isProcessing || candidate.applicationStatus === 'Approved'}
                  className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold ucc-btn flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Approve Application</span>
                  <span className="ucc-caption font-normal text-emerald-700">Assign to Official Ballot</span>
                </button>

                {/* Reject Button */}
                <button
                  onClick={() => setShowRejectInput(!showRejectInput)}
                  disabled={isProcessing}
                  className="p-4 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 font-semibold ucc-btn flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span>Reject Application</span>
                  <span className="ucc-caption font-normal text-red-700">Disqualify with Stated Reason</span>
                </button>

                {/* Request Corrections Button */}
                <button
                  onClick={() => setShowCorrectionInput(!showCorrectionInput)}
                  disabled={isProcessing}
                  className="p-4 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold ucc-btn flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Request Corrections</span>
                  <span className="ucc-caption font-normal text-amber-700">Return for Clarification</span>
                </button>
              </div>

              {/* Sub-Panel: Reject with Reason */}
              {showRejectInput && (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-3">
                  <span className="ucc-label font-semibold text-red-900 block">
                    Specify Rejection Ground (Constitutional / Vetting Requirement):
                  </span>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Failure to satisfy Article 14(2) minimum CGPA clearance, or disciplinary record with Dean of Students..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-red-300 bg-white focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="px-3 py-1.5 ucc-btn text-slate-600 hover:bg-white rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={isProcessing}
                      className="px-4 py-1.5 ucc-btn font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-Panel: Request Corrections */}
              {showCorrectionInput && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
                  <span className="ucc-label font-semibold text-amber-900 block">
                    Correction Notice to Aspirant:
                  </span>
                  <textarea
                    rows={3}
                    value={correctionNotes}
                    onChange={(e) => setCorrectionNotes(e.target.value)}
                    placeholder="e.g. Please upload certified clearance slip from the Directorate of Academic Affairs and update campaign promises..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-amber-300 bg-white focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCorrectionInput(false)}
                      className="px-3 py-1.5 ucc-btn text-slate-600 hover:bg-white rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestCorrections}
                      disabled={isProcessing}
                      className="px-4 py-1.5 ucc-btn font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                    >
                      Send Revision Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="ucc-caption text-slate-500 font-mono tabular-nums">
            Candidate ID: {candidate.id}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 ucc-btn font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors cursor-pointer"
          >
            Close Review
          </button>
        </div>
      </div>
    </div>
  );
};
