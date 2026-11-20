import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { votingService } from '../../services/votingService';
import { EligibilityResult } from '../../services/interfaces';
import { Candidate, Election, Position, VoteConfirmationReceipt } from '../../types';
import { Logo, BrandedLoadingScreen } from '../../components/common/Logo';
import { CandidateAvatar } from '../../components/common/CandidateAvatar';
import { resolveCandidatePhotoUrl } from '../../utils/contestantUtils';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { isElectionPublishedToStudents } from '../../utils/electionStatus';
import {
  Vote,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Lock,
  AlertCircle,
  AlertTriangle,
  Check,
  RotateCcw,
  Clock,
  FileText,
  X,
  RefreshCw,
  LogIn,
  ShieldAlert,
  Award,
  Users,
  WifiOff
} from 'lucide-react';

interface DynamicBallotPosition {
  position: Position;
  candidates: Candidate[];
}

function formatCountdown(endDateIso: string): string {
  const diff = new Date(endDateIso).getTime() - Date.now();
  if (isNaN(diff) || diff <= 0) return 'Polling deadline reached';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m remaining`;
  return `${hours}h ${mins}m remaining`;
}

export const DigitalBallotPreviewPage: React.FC = () => {
  const {
    selectedElectionId,
    elections,
    navigateTo,
    ballotSelections,
    setBallotSelection,
    clearPositionSelection,
    resetBallot,
    submitBallotAction,
    student,
    userRole,
    sessionChecked,
    sessionExpiredReason,
    setPostLoginView,
    recentVoteReceipt
  } = useApp();

  const { isOnline } = useOnlineStatus();
  const visibleElections = elections.filter(isElectionPublishedToStudents);
  const fallbackElection =
    visibleElections.find((e) => e.id === selectedElectionId) || visibleElections[0];

  const [isLoadingBallot, setIsLoadingBallot] = useState(true);
  const [ballotError, setBallotError] = useState<{
    code?: string;
    message: string;
    opensAt?: string;
    closesAt?: string;
  } | null>(null);
  const [serverElection, setServerElection] = useState<Election | null>(null);
  const [eligibilityInfo, setEligibilityInfo] = useState<EligibilityResult | null>(null);
  const [ballotPositions, setBallotPositions] = useState<DynamicBallotPosition[]>([]);
  const [alreadyVotedReceipt, setAlreadyVotedReceipt] = useState<VoteConfirmationReceipt | null>(null);

  // Steps: 1 = Select Candidates, 2 = Review Ballot, 3 = Submitted Confirmation
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [activePositionIndex, setActivePositionIndex] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);

  // Final Confirmation Modal & Submission state
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [confirmNoticeAgreed, setConfirmNoticeAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] = useState<VoteConfirmationReceipt | null>(null);

  // Inline Manifesto Modal (preserves selections)
  const [manifestoCandidate, setManifestoCandidate] = useState<Candidate | null>(null);

  // Countdown tick
  const [countdownText, setCountdownText] = useState('');

  // Concurrency / double-click guard refs
  const isSubmittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string>(
    `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  const election = serverElection || fallbackElection;

  const loadAuthorizedBallot = async () => {
    if (!sessionChecked) {
      setIsLoadingBallot(true);
      return;
    }

    setIsLoadingBallot(true);
    setBallotError(null);
    setAlreadyVotedReceipt(null);

    if (userRole === 'admin') {
      setBallotError({
        code: 'ADMIN_VOTING_FORBIDDEN',
        message:
          'Electoral Commission administrators are prohibited from accessing student voting ballots.'
      });
      setIsLoadingBallot(false);
      return;
    }

    if (userRole === 'guest' || !student) {
      if (sessionExpiredReason) {
        setBallotError({
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again to continue.'
        });
      } else {
        setBallotError({
          code: 'AUTH_REQUIRED',
          message:
            'Please sign in with your verified UCC Student ID to authenticate and load your official digital ballot.'
        });
      }
      setIsLoadingBallot(false);
      return;
    }

    if (visibleElections.length === 0 || !selectedElectionId) {
      setBallotError({
        code: 'NO_ACTIVE_ELECTIONS',
        message: 'No active elections at the moment.'
      });
      setIsLoadingBallot(false);
      return;
    }

    const res = await votingService.getBallot(selectedElectionId);

    if (res.election) {
      setServerElection(res.election);
    }
    if (res.eligibility) {
      setEligibilityInfo(res.eligibility);
    }

    if (res.success && res.alreadyVoted && res.receipt) {
      setAlreadyVotedReceipt(res.receipt);
      setIsLoadingBallot(false);
      return;
    }

    if (!res.success) {
      setBallotError({
        code: (res as any).code || (res.httpStatus ? `HTTP_${res.httpStatus}` : undefined),
        message: res.error || 'Unable to load authorized digital ballot.',
        opensAt: res.opensAt || res.election?.startDate,
        closesAt: res.closesAt || res.election?.endDate
      });
      setIsLoadingBallot(false);
      return;
    }

    setBallotPositions(res.positions || []);
    setActivePositionIndex(0);
    setCurrentStep(1);
    setIsLoadingBallot(false);
  };

  useEffect(() => {
    if (!sessionChecked) {
      setIsLoadingBallot(true);
      return;
    }
    // Reset local ballot state when switching elections, user, or once session settles
    resetBallot();
    setConfirmedReceipt(null);
    setSubmitError(null);
    setShowFinalConfirmModal(false);
    setConfirmNoticeAgreed(false);
    idempotencyKeyRef.current = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    if (isOnline) {
      loadAuthorizedBallot();
    }
  }, [selectedElectionId, sessionChecked, userRole, student?.id, sessionExpiredReason, isOnline]);

  useEffect(() => {
    if (!election?.endDate) return;
    setCountdownText(formatCountdown(election.endDate));
    const timer = setInterval(() => {
      setCountdownText(formatCountdown(election.endDate));
    }, 30000);
    return () => clearInterval(timer);
  }, [election?.endDate]);

  const activeEntry = ballotPositions[activePositionIndex] || null;
  const activePosition = activeEntry?.position || null;
  const positionCandidates = activeEntry?.candidates || [];
  const currentSelectionsForPos = activePosition ? ballotSelections[activePosition.id] || [] : [];

  // Validation summary across all positions
  const missingRequiredPositions = ballotPositions.filter(({ position, candidates }) => {
    if (candidates.length === 0) return false;
    const chosen = ballotSelections[position.id] || [];
    return !position.allowsSkip && chosen.length === 0;
  });

  const totalSelectedCount = ballotPositions.reduce((acc, { position }) => {
    return acc + (ballotSelections[position.id]?.length || 0);
  }, 0);

  const canProceedToSubmit =
    missingRequiredPositions.length === 0 &&
    (totalSelectedCount > 0 || Boolean(election?.allowsEmptyBallot));

  const handleToggleCandidate = (candId: string) => {
    if (!activePosition) return;
    setSubmitError(null);
    setBallotSelection(activePosition.id, candId, activePosition.maxSelections || 1);
  };

  const handleSkipPosition = () => {
    if (!activePosition || !activePosition.allowsSkip) return;
    clearPositionSelection(activePosition.id);
    handleNextPosition();
  };

  const handleNextPosition = () => {
    if (activePositionIndex < ballotPositions.length - 1) {
      setActivePositionIndex(activePositionIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
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

  const handleConfirmVoteSubmission = async () => {
    if (isSubmittingRef.current || !confirmNoticeAgreed || !election) return;
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setSubmitError(
        'Internet connection lost. Ballot submission requires an active connection to the UCC VOTE server and cannot be queued offline.'
      );
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await submitBallotAction(
        election.id,
        ballotSelections,
        idempotencyKeyRef.current
      );

      if (res.success && res.receipt) {
        setConfirmedReceipt(res.receipt);
        setShowFinalConfirmModal(false);
        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSubmitError(
          res.error ||
            'Your ballot could not be submitted. Please review the notice and try again.'
        );
        // Generate a fresh idempotency key only if previous submission was rejected on validation (not network retry)
        if (res.code && res.code !== 'NETWORK_ERROR' && res.code !== 'CONCURRENT_SUBMISSION_BLOCKED') {
          idempotencyKeyRef.current = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        }
      }
    } catch (err: any) {
      setSubmitError(
        err?.message ||
          'Connection interrupted during submission. Verify your participation status before retrying.'
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // OFFLINE SECURITY GUARD (NO OFFLINE VOTING OR BALLOT QUEUING)
  // =========================================================================
  if (!isOnline) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="bg-white rounded-2xl border border-amber-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <WifiOff className="w-6 h-6" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Logo variant="compact" showWordmark={false} />
                <span className="ucc-caption font-semibold uppercase tracking-wider text-amber-700">
                  Online Verification Required
                </span>
              </div>
              <h1 className="ucc-heading-section text-slate-900">
                Internet Connection Required to Vote
              </h1>
              <p className="ucc-body-secondary text-slate-600">
                For electoral security and ballot secrecy, digital ballots are never cached or queued offline. Please reconnect to mobile data or campus Wi-Fi to verify your eligibility and cast your vote directly on the UCC VOTE server.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (navigator.onLine) loadAuthorizedBallot();
              }}
              className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('elections_directory')}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 ucc-btn font-semibold cursor-pointer"
            >
              Back to Elections Directory
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LOADING STATE
  // =========================================================================
  if (!sessionChecked || isLoadingBallot) {
    return (
      <BrandedLoadingScreen
        title={
          !sessionChecked
            ? 'Verifying your secure voting session...'
            : 'Verifying Voter Eligibility & Loading Official Ballot'
        }
        subtitle="Checking your authenticated UCC student session, polling window, and approved candidate roster..."
      />
    );
  }

  // =========================================================================
  // STEP 3: POST-SUBMISSION CONFIRMATION SCREEN (OR ALREADY VOTED RECEIPT)
  // =========================================================================
  const activeReceipt =
    currentStep === 3
      ? confirmedReceipt ||
        (recentVoteReceipt?.electionId === election?.id ? recentVoteReceipt : null)
      : alreadyVotedReceipt;

  if (activeReceipt) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center pb-1">
              <Logo variant="default" layout="stacked" showTagline subtitle="Electoral Commission" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 ucc-caption font-semibold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{alreadyVotedReceipt ? 'Official Participation Record' : 'Submission Verified'}</span>
            </div>

            <h1 className="ucc-heading-section text-slate-900">
              YOUR VOTE HAS BEEN SUCCESSFULLY SUBMITTED.
            </h1>

            <p className="ucc-body-secondary text-slate-600 max-w-lg mx-auto">
              Your participation has been recorded for the University of Cape Coast election listed below. No candidate selections are stored on this receipt or linked to your student profile.
            </p>
          </div>

          {/* Official Confirmation Details */}
          <div className="p-5 rounded-xl bg-[#F4F6F9] border border-slate-200 space-y-3 ucc-body-secondary">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <span className="ucc-caption uppercase font-semibold text-[#123B70] tracking-wider">
                Ballot Submission Confirmation
              </span>
              <span className="ucc-caption font-semibold text-emerald-700">RECORDED</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="ucc-caption text-slate-500 block">Election Name</span>
                <span className="font-semibold text-slate-900">{activeReceipt.electionTitle}</span>
              </div>
              <div>
                <span className="ucc-caption text-slate-500 block">Submission Confirmation Reference</span>
                <span className="font-mono font-semibold text-[#123B70] bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5 tabular-nums">
                  {activeReceipt.confirmationRef}
                </span>
              </div>
              <div>
                <span className="ucc-caption text-slate-500 block">Submission Date & Time</span>
                <span className="text-slate-800 tabular-nums">
                  {new Date(activeReceipt.submittedAt).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                    timeZone: 'UTC'
                  })}{' '}
                  GMT
                </span>
              </div>
              <div>
                <span className="ucc-caption text-slate-500 block">Receipt Verification Digest</span>
                <span className="font-mono text-slate-700 tabular-nums">{activeReceipt.receiptHash}</span>
              </div>
            </div>
          </div>

          {/* Positions Completed (No Candidates Revealed!) */}
          <div className="space-y-2.5">
            <h2 className="ucc-label font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Positions Successfully Completed</span>
            </h2>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {activeReceipt.positionsCompleted.map((pos) => (
                <div
                  key={pos.id}
                  className="px-4 py-2.5 bg-white flex items-center justify-between ucc-body-secondary"
                >
                  <span className="font-semibold text-slate-800">{pos.title}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full ucc-caption font-semibold ${
                      pos.status === 'VOTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {pos.status === 'VOTED' ? 'Ballot Recorded (Secret)' : 'Abstained'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Ballot Secrecy & Governance Notice */}
          <div className="p-4 rounded-xl bg-[#EAF2FA] border border-blue-200 ucc-body-secondary text-[#123B70] space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="ucc-caption leading-relaxed">
                <strong className="font-semibold">Ballot Secrecy Protection:</strong> Your selected candidates are stored separately from your student identity and cannot be viewed in your profile, voting history, or by Electoral Commission administrators.
              </p>
            </div>
            <p className="ucc-caption leading-relaxed text-slate-700 border-t border-blue-200/70 pt-2">
              <strong className="font-semibold">Security & Governance Notice:</strong> Do not use this platform for an actual UCC election until it has undergone independent security review, election governance approval, and full operational testing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 no-print">
            <button
              onClick={() => window.print()}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 ucc-btn font-semibold transition-colors cursor-pointer"
            >
              Print Official Receipt
            </button>
            <button
              onClick={() => navigateTo('student_dashboard')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 ucc-btn font-semibold transition-colors cursor-pointer"
            >
              Return to Dashboard
            </button>
            <button
              onClick={() => navigateTo('election_results', { electionId: activeReceipt.electionId })}
              className="w-full py-2.5 px-4 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold transition-colors cursor-pointer"
            >
              View Turnout & Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ACCESS DENIED / AUTH REQUIRED / EXPIRED / ELECTION STATUS / ERROR STATE
  // =========================================================================
  if (ballotError) {
    const isSessionExpired =
      ballotError.code === 'SESSION_EXPIRED' || ballotError.code === 'TOKEN_EXPIRED';
    const isAuthRequired = ballotError.code === 'AUTH_REQUIRED';
    const isAuthIssue = isSessionExpired || isAuthRequired;
    const isTransientIssue =
      ballotError.code === 'NETWORK_ERROR' || ballotError.code === 'SERVER_ERROR';
    const isAdminBlocked = ballotError.code === 'ADMIN_VOTING_FORBIDDEN';
    const isNotOpenYet =
      ballotError.code === 'ELECTION_NOT_OPEN' || ballotError.code === 'ELECTION_NOT_STARTED';
    const isClosed =
      ballotError.code === 'ELECTION_CLOSED' || ballotError.code === 'ELECTION_ARCHIVED';

    const formattedOpening =
      ballotError.opensAt && !isNaN(new Date(ballotError.opensAt).getTime())
        ? `${new Date(ballotError.opensAt).toLocaleString('en-GB', {
            dateStyle: 'full',
            timeStyle: 'short',
            timeZone: 'UTC'
          })} GMT`
        : null;

    return (
      <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isAuthRequired
                  ? 'bg-[#EAF2FA] text-[#123B70]'
                  : isAdminBlocked ||
                    ballotError.code === 'ELECTION_SUSPENDED' ||
                    ballotError.code === 'ACCOUNT_SUSPENDED'
                  ? 'bg-red-100 text-[#C62828]'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isAuthIssue ? (
                <LogIn className="w-6 h-6" />
              ) : isAdminBlocked || ballotError.code === 'ACCOUNT_SUSPENDED' ? (
                <ShieldAlert className="w-6 h-6" />
              ) : isNotOpenYet || isClosed ? (
                <Clock className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>

            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Logo variant="compact" showWordmark={false} />
                <span className="ucc-caption font-semibold uppercase tracking-wider text-slate-500">
                  {election?.title || 'Digital Ballot Access'} · {ballotError.code || 'NOTICE'}
                </span>
              </div>
              <h1 className="ucc-heading-section text-slate-900">
                {isSessionExpired
                  ? 'Your Session Has Expired'
                  : isAuthRequired
                  ? 'Student Authentication Required'
                  : isAdminBlocked
                  ? 'Administrative Role Cannot Cast Voter Ballots'
                  : isNotOpenYet
                  ? 'Voting Has Not Opened Yet'
                  : isClosed
                  ? 'Polling Has Officially Closed'
                  : ballotError.code === 'ELECTION_SUSPENDED'
                  ? 'Election Temporarily Suspended'
                  : ballotError.code === 'ACCOUNT_SUSPENDED'
                  ? 'Voter Account Suspended'
                  : ballotError.code === 'INELIGIBLE_VOTER'
                  ? 'Voter Eligibility Check Not Satisfied'
                  : ballotError.code === 'NO_ACTIVE_ELECTIONS'
                  ? 'No active elections at the moment.'
                  : ballotError.code === 'SERVER_ERROR'
                  ? 'Voting Service Temporarily Unavailable'
                  : ballotError.code === 'NETWORK_ERROR'
                  ? 'Connection Interrupted'
                  : 'Ballot Currently Unavailable'}
              </h1>
              <p className="ucc-body-secondary text-slate-600">
                {isSessionExpired
                  ? 'Your session has expired. Please log in again to continue.'
                  : ballotError.message}
              </p>

              {isNotOpenYet && formattedOpening && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EAF2FA] border border-blue-200 ucc-label text-[#123B70] font-semibold">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Scheduled Opening: {formattedOpening}</span>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Eligibility Verification Checks if Ineligible */}
          {eligibilityInfo && !eligibilityInfo.isEligible && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 ucc-body-secondary">
              <div className="font-semibold text-slate-800">Server Eligibility Verification Breakdown</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(eligibilityInfo.checks).map(([key, passed]) => (
                  <div
                    key={key}
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ucc-caption ${
                      passed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800 font-semibold'
                    }`}
                  >
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-semibold">{passed ? 'PASS' : 'FAIL'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            {isAuthIssue && (
              <button
                onClick={() => {
                  setPostLoginView('digital_ballot');
                  navigateTo('student_login');
                }}
                className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold flex items-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSessionExpired ? 'Log In Again' : 'Sign In as Verified Student'}</span>
              </button>
            )}

            {isTransientIssue && (
              <button
                onClick={loadAuthorizedBallot}
                className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Loading Ballot</span>
              </button>
            )}

            <button
              onClick={() =>
                navigateTo(userRole === 'admin' ? 'admin_dashboard' : 'elections_directory')
              }
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 ucc-btn font-semibold cursor-pointer"
            >
              {userRole === 'admin' ? 'Return to Admin Console' : 'Back to Elections Directory'}
            </button>

            {election && (isClosed || election.status === 'closed' || election.status === 'results_published') && (
              <button
                onClick={() => navigateTo('election_results', { electionId: election.id })}
                className="px-4 py-2.5 rounded-xl bg-[#0B1F3A] hover:bg-[#123B70] text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>View Election Results</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // NO POSITIONS CONFIGURED
  // =========================================================================
  if (ballotPositions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <Users className="w-10 h-10 text-slate-400 mx-auto" />
          <h2 className="ucc-heading-card text-slate-900">No Contested Positions Available</h2>
          <p className="ucc-body-secondary text-slate-600 max-w-md mx-auto">
            This election does not currently have configured positions or approved candidates ready for ballot rendering.
          </p>
          <button
            onClick={() => navigateTo('elections_directory')}
            className="px-5 py-2.5 rounded-xl bg-[#123B70] text-white ucc-btn font-semibold cursor-pointer"
          >
            Back to Elections Directory
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 2: BALLOT REVIEW SCREEN
  // =========================================================================
  if (currentStep === 2) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex items-start sm:items-center gap-3.5">
              <Logo variant="default" showWordmark={false} />
              <div>
                <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider">
                  Ballot Review · {election.category}
                </span>
                <h1 className="ucc-heading-section text-slate-900 mt-0.5">
                  Review Your Selections
                </h1>
                <p className="ucc-body-secondary text-slate-500 mt-1">
                  Verify your selections for <strong className="font-semibold">{election.title}</strong> before confirming final submission.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCurrentStep(1)}
              className="ucc-btn font-semibold text-[#123B70] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Modify Ballot</span>
            </button>
          </div>

          {missingRequiredPositions.length > 0 && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 ucc-body-secondary text-red-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#C62828] shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Required Portfolio Selection Missing</strong>
                <span>
                  Please select a candidate for:{' '}
                  {missingRequiredPositions.map((p) => p.position.title).join(', ')}.
                </span>
              </div>
            </div>
          )}

          {totalSelectedCount === 0 && !election.allowsEmptyBallot && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 ucc-body-secondary text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Empty ballots are not permitted under the rules of this election. Please select at least one approved candidate.
              </span>
            </div>
          )}

          {/* Selections breakdown */}
          <div className="space-y-3">
            {ballotPositions.map(({ position, candidates }, idx) => {
              const selectedIds = ballotSelections[position.id] || [];
              const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id));
              const isMissingRequired =
                candidates.length > 0 && !position.allowsSkip && selectedIds.length === 0;

              return (
                <div
                  key={position.id}
                  className={`p-4 max-md:p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-md:gap-2 ${
                    isMissingRequired
                      ? 'border-red-300 bg-red-50/50'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider">
                        {position.order}. {position.title}
                      </span>
                      {!position.allowsSkip && (
                        <span className="ucc-caption px-2 py-0.5 rounded bg-[#EAF2FA] text-[#123B70] font-semibold">
                          Required
                        </span>
                      )}
                      {position.maxSelections > 1 && (
                        <span className="ucc-caption px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                          Up to {position.maxSelections}
                        </span>
                      )}
                    </div>

                    {selectedCandidates.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCandidates.map((cand) => (
                          <div key={cand.id} className="flex items-center gap-3">
                            <CandidateAvatar
                              src={resolveCandidatePhotoUrl(cand)}
                              alt={cand.fullName}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-300 shrink-0"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{cand.fullName}</p>
                              <p className="ucc-caption text-slate-500">
                                {cand.programme || cand.department} · {cand.department}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : candidates.length === 0 ? (
                      <p className="ucc-body-secondary text-slate-500 italic">
                        No approved candidates on ballot for this position.
                      </p>
                    ) : isMissingRequired ? (
                      <p className="ucc-body-secondary text-red-700 font-semibold">
                        Selection required before submission.
                      </p>
                    ) : (
                      <p className="ucc-body-secondary text-amber-700 italic font-medium">
                        Skipped (Abstained from voting for this position)
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setActivePositionIndex(idx);
                      setCurrentStep(1);
                    }}
                    className="ucc-btn font-semibold text-[#123B70] hover:underline self-start sm:self-center cursor-pointer"
                  >
                    {isMissingRequired ? 'Select Now' : 'Change'}
                  </button>
                </div>
              );
            })}
          </div>

          {submitError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 ucc-body-secondary text-red-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#C62828] shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 ucc-btn font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back to Ballot Positions
            </button>

            <button
              onClick={() => {
                setSubmitError(null);
                setShowFinalConfirmModal(true);
              }}
              disabled={!canProceedToSubmit || isSubmitting}
              className="px-6 py-3 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-semibold ucc-btn transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Vote className="w-4 h-4" />
              <span>Proceed to Final Confirmation</span>
            </button>
          </div>
        </div>

        {/* Final Confirmation Modal */}
        {showFinalConfirmModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-[#C62828] flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="ucc-heading-card text-slate-900">
                      Confirm Final Ballot Submission
                    </h3>
                    <p className="ucc-caption text-slate-500">
                      Irreversible Official Action
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !isSubmitting && setShowFinalConfirmModal(false)}
                  disabled={isSubmitting}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 ucc-body-secondary text-slate-800 space-y-2">
                <p>
                  You are about to submit your official ballot for <strong className="font-semibold">{election.title}</strong>. Once submitted, votes cannot be changed, retracted, or inspected.
                </p>
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={confirmNoticeAgreed}
                    onChange={(e) => setConfirmNoticeAgreed(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-0.5 rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
                  />
                  <span className="font-semibold text-slate-900 leading-snug">
                    I confirm these selections represent my final vote and understand that duplicate or modified submissions are not permitted.
                  </span>
                </label>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 ucc-body-secondary text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#C62828] shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowFinalConfirmModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 ucc-btn font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel & Review
                </button>
                <button
                  onClick={handleConfirmVoteSubmission}
                  disabled={!confirmNoticeAgreed || isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#C62828] hover:bg-red-700 text-white ucc-btn font-semibold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting Ballot...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Submit Official Ballot</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STEP 1: DYNAMIC ELECTION HEADER, INSTRUCTIONS & CANDIDATE SELECTION
  // =========================================================================
  const maxForPos = activePosition?.maxSelections || 1;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Election Metadata Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Logo variant="default" showWordmark={false} className="mt-0.5 hidden sm:inline-flex" />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#EAF2FA] text-[#123B70] ucc-caption font-semibold uppercase tracking-wider">
                  {election.category}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 ucc-caption font-semibold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {election.status === 'live' ? 'Polling Live' : election.status}
                </span>
                <span className="ucc-caption text-slate-500 tabular-nums">{election.code}</span>
              </div>

              <h1 className="ucc-heading-page text-slate-900">
                {election.title}
              </h1>
              <p className="ucc-body-secondary text-slate-600 max-w-2xl">
                {election.description}
              </p>
            </div>
          </div>

          <div className="shrink-0 p-3.5 max-md:p-2.5 rounded-xl bg-[#F4F6F9] border border-slate-200 ucc-caption space-y-1 min-w-[210px] max-md:min-w-0 max-md:w-full">
            <div className="flex items-center gap-1.5 text-[#123B70] font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Voting Deadline</span>
            </div>
            <div className="font-semibold text-slate-900 tabular-nums">
              {new Date(election.endDate).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'UTC'
              })}{' '}
              GMT
            </div>
            <div className="font-semibold text-[#C62828]">{countdownText}</div>
          </div>
        </div>

        {/* Voting Instructions Collapsible */}
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="ucc-btn font-semibold text-[#123B70] flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>
              {showInstructions ? 'Hide Voting Instructions & Rules' : 'Show Voting Instructions & Rules'}
            </span>
          </button>

          {showInstructions && (
            <div className="mt-2.5 p-3.5 rounded-xl bg-[#EAF2FA]/60 border border-blue-100 ucc-body-secondary text-slate-700 space-y-1.5">
              <p className="font-semibold text-[#123B70]">Official Voting Instructions:</p>
              <ul className="list-disc pl-4 space-y-1 ucc-caption">
                <li>Select your preferred approved candidate(s) for each position listed below.</li>
                <li>Use &quot;View Manifesto&quot; on any candidate card to read their full platform without losing your selections.</li>
                <li>Required positions must have a selection before submitting; optional positions allow abstaining.</li>
                {(election.rules || []).map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Dynamic Position Stepper Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1">
          {ballotPositions.map(({ position, candidates }, idx) => {
            const count = (ballotSelections[position.id] || []).length;
            const isFilled = count > 0;
            const isCurrent = idx === activePositionIndex;

            return (
              <button
                key={position.id}
                onClick={() => setActivePositionIndex(idx)}
                className={`px-3.5 py-2 rounded-lg ucc-btn font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-[#123B70] text-white shadow-xs'
                    : isFilled
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="tabular-nums">{idx + 1}.</span>
                <span>{position.title}</span>
                {candidates.length > 0 && !position.allowsSkip && !isFilled && (
                  <span className="ucc-caption text-[#C62828] font-bold">*</span>
                )}
                {isFilled && <Check className="w-3 h-3 text-emerald-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Position Card */}
      {activePosition && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6 max-md:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider">
                  Position {activePositionIndex + 1} of {ballotPositions.length} · {election.category}
                </span>
                <span
                  className={`px-2 py-0.5 rounded ucc-caption font-semibold uppercase ${
                    activePosition.allowsSkip
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-red-50 text-[#C62828]'
                  }`}
                >
                  {activePosition.allowsSkip ? 'Optional (Skip Allowed)' : 'Required Selection'}
                </span>
              </div>
              <h2 className="ucc-heading-section text-slate-900 mt-1">
                {activePosition.title}
              </h2>
              <p className="ucc-body-secondary text-slate-600 mt-1 max-w-xl">{activePosition.description}</p>
            </div>

            <div className="ucc-caption bg-[#F4F6F9] px-3.5 py-2 rounded-xl border border-slate-200 shrink-0 text-slate-700 tabular-nums">
              {maxForPos > 1 ? (
                <span>
                  Multi-choice: Select up to <strong className="font-semibold">{maxForPos}</strong> ({currentSelectionsForPos.length}/{maxForPos} selected)
                </span>
              ) : (
                <span>
                  Single-choice: Select <strong className="font-semibold">1</strong> approved candidate
                </span>
              )}
            </div>
          </div>

          {/* Approved Candidates Grid */}
          {positionCandidates.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center ucc-body-secondary text-slate-500">
              No approved candidates are currently assigned to this position.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-md:gap-2.5">
              {positionCandidates.map((cand) => {
                const isSelected = currentSelectionsForPos.includes(cand.id);
                const limitReached =
                  maxForPos > 1 && !isSelected && currentSelectionsForPos.length >= maxForPos;

                return (
                  <div
                    key={cand.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => !limitReached && handleToggleCandidate(cand.id)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !limitReached) {
                        e.preventDefault();
                        handleToggleCandidate(cand.id);
                      }
                    }}
                    className={`p-5 max-md:p-3 rounded-2xl border-2 transition-all cursor-pointer relative group flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#123B70] bg-[#EAF2FA]/55 shadow-md ring-2 ring-[#123B70]/20'
                        : limitReached
                        ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="space-y-3 max-md:space-y-2">
                      <div className="flex items-start gap-4 max-md:gap-2.5">
                        <CandidateAvatar
                          src={resolveCandidatePhotoUrl(cand)}
                          alt={cand.fullName}
                          className="w-16 h-16 max-md:w-12 max-md:h-12 rounded-xl object-cover object-top border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="ucc-heading-card text-slate-900 group-hover:text-[#123B70] transition-colors">
                            {cand.fullName}
                          </h3>
                          <p className="ucc-caption font-semibold text-[#123B70] mt-0.5">
                            {cand.programme || cand.department}
                          </p>
                          <p className="ucc-caption text-slate-500">
                            {cand.department} · Level {cand.level}
                          </p>
                        </div>

                        {/* Radio or Checkbox Selection Control */}
                        <div
                          className={`w-6 h-6 ${
                            maxForPos > 1 ? 'rounded-md' : 'rounded-full'
                          } border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-[#123B70] bg-[#123B70] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      {/* Candidate Campaign Statement / Biography */}
                      <p className="ucc-body-secondary text-slate-600 line-clamp-3">
                        {cand.campaignStatement || cand.biography || cand.manifestoSummary}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 max-md:mt-2.5 max-md:pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setManifestoCandidate(cand);
                        }}
                        className="ucc-btn font-semibold text-[#123B70] hover:underline cursor-pointer"
                      >
                        View Manifesto →
                      </button>

                      <span
                        className={`ucc-caption font-semibold ${
                          isSelected ? 'text-[#123B70]' : 'text-slate-500'
                        }`}
                      >
                        {isSelected
                          ? 'SELECTED'
                          : limitReached
                          ? `Max ${maxForPos} Reached`
                          : 'Select Candidate'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Skip / Abstain option if allowed by position rules */}
          {activePosition.allowsSkip && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSkipPosition}
                className="ucc-btn text-slate-600 hover:text-[#123B70] underline cursor-pointer font-medium"
              >
                Skip this position (Abstain from voting for {activePosition.title})
              </button>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-200">
            <button
              onClick={handlePrevPosition}
              disabled={activePositionIndex === 0}
              className="px-4 py-2.5 rounded-xl border border-slate-300 ucc-btn font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous Position</span>
            </button>

            <div className="flex items-center gap-2.5">
              {activePositionIndex < ballotPositions.length - 1 && (
                <button
                  onClick={() => {
                    setCurrentStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-4 py-2.5 rounded-xl border border-[#123B70]/30 text-[#123B70] hover:bg-[#EAF2FA] ucc-btn font-semibold transition-colors cursor-pointer tabular-nums"
                >
                  Review Ballot ({totalSelectedCount})
                </button>
              )}

              <button
                onClick={handleNextPosition}
                className="px-6 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {activePositionIndex === ballotPositions.length - 1
                    ? 'Review & Confirm Ballot'
                    : 'Next Position'}
                </span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ballot Secrecy & Governance Notice */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 ucc-body-secondary text-slate-600 flex items-start gap-3">
        <Lock className="w-4 h-4 text-[#123B70] shrink-0 mt-0.5" />
        <p>
          <strong className="font-semibold">Ballot Secrecy Architecture:</strong> Your voter participation record is separated from your anonymous ballot selections on the server. Do not use this system for an actual UCC election until it has undergone independent security review, election governance approval, and operational testing.
        </p>
      </div>

      {/* Inline Candidate Manifesto Modal (preserves ballot selections) */}
      {manifestoCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <CandidateAvatar
                  src={resolveCandidatePhotoUrl(manifestoCandidate)}
                  alt={manifestoCandidate.fullName}
                  className="w-14 h-14 rounded-xl object-cover object-top border border-slate-200 shrink-0"
                />
                <div>
                  <h3 className="ucc-heading-card text-slate-900">
                    {manifestoCandidate.fullName}
                  </h3>
                  <p className="ucc-label text-[#123B70] font-semibold">
                    {manifestoCandidate.programme || manifestoCandidate.department} · Level{' '}
                    {manifestoCandidate.level}
                  </p>
                  <p className="ucc-caption text-slate-500">
                    {manifestoCandidate.department} · {manifestoCandidate.hall}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManifestoCandidate(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manifestoCandidate.biography && (
              <div className="space-y-1">
                <h4 className="ucc-caption font-semibold uppercase tracking-wider text-slate-500">
                  Biography
                </h4>
                <p className="ucc-body-secondary text-slate-700">
                  {manifestoCandidate.biography}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="ucc-caption font-semibold uppercase tracking-wider text-slate-500">
                Manifesto & Vision
              </h4>
              <p className="ucc-body-secondary font-semibold text-[#123B70] italic">
                "{manifestoCandidate.manifestoSummary}"
              </p>
              <ul className="list-disc pl-4 space-y-1.5 ucc-body-secondary text-slate-700">
                {(manifestoCandidate.fullManifesto || []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {manifestoCandidate.keyPromises && manifestoCandidate.keyPromises.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="ucc-caption font-semibold uppercase tracking-wider text-slate-500">
                  Key Campaign Promises
                </h4>
                <ul className="list-disc pl-4 space-y-1 ucc-body-secondary text-slate-700">
                  {manifestoCandidate.keyPromises.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {manifestoCandidate.leadershipExperience &&
              manifestoCandidate.leadershipExperience.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="ucc-caption font-semibold uppercase tracking-wider text-slate-500">
                    Leadership Experience
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 ucc-body-secondary text-slate-700">
                    {manifestoCandidate.leadershipExperience.map((exp, i) => (
                      <li key={i}>{exp}</li>
                    ))}
                  </ul>
                </div>
              )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setManifestoCandidate(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 ucc-btn font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  if (activePosition && !currentSelectionsForPos.includes(manifestoCandidate.id)) {
                    handleToggleCandidate(manifestoCandidate.id);
                  }
                  setManifestoCandidate(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold cursor-pointer"
              >
                {currentSelectionsForPos.includes(manifestoCandidate.id)
                  ? 'Keep Selected'
                  : 'Select This Candidate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
