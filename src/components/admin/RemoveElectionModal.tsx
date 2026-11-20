import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  Lock,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { Election } from '../../types';
import { adminService } from '../../services/adminService';
import { useApp } from '../../context/AppContext';
import {
  ElectionRemovalEligibility,
  getElectionStatusMeta,
  matchesRemovalConfirmation,
} from '../../utils/electionRemovalUtils';
import { formatElectionWindow } from '../../utils/dateUtils';

interface RemoveElectionModalProps {
  isOpen: boolean;
  election: Election | null;
  initialMode?: 'remove' | 'archive' | 'restore';
  onClose: () => void;
  onSuccess: (message: string) => void;
  onOpenStatusModal?: (election: Election) => void;
}

export const RemoveElectionModal: React.FC<RemoveElectionModalProps> = ({
  isOpen,
  election,
  initialMode = 'remove',
  onClose,
  onSuccess,
  onOpenStatusModal,
}) => {
  const {
    removeElectionAction,
    archiveElectionAction,
    restoreArchivedElectionAction,
    cancelElectionAction,
    updateElectionStatusAction,
  } = useApp();

  const [inspecting, setInspecting] = useState(false);
  const [eligibility, setEligibility] = useState<ElectionRemovalEligibility | null>(null);
  const [counts, setCounts] = useState<{
    positionsCount: number;
    candidatesCount: number;
    authorisationsCount: number;
    confirmationsCount: number;
  } | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !election) {
      setEligibility(null);
      setCounts(null);
      setConfirmationInput('');
      setReason('');
      setErrorMsg('');
      setSubmitting(false);
      inFlightRef.current = false;
      return;
    }

    let active = true;
    setInspecting(true);
    setErrorMsg('');
    setConfirmationInput('');
    setReason('');

    adminService
      .inspectElectionRemovalEligibility(election.id)
      .then((res) => {
        if (!active) return;
        if (res.success && res.eligibility) {
          setEligibility(res.eligibility);
          setCounts(res.counts || null);
        } else {
          setErrorMsg(res.error || 'Unable to verify election removal eligibility.');
        }
      })
      .finally(() => {
        if (active) setInspecting(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, election?.id, election?.status, election?.totalVotesCast]);

  if (!isOpen || !election) return null;

  const statusMeta = getElectionStatusMeta(election.status);
  const codePhrase = election.code ? `DELETE ${election.code.trim()}` : '';
  const isConfirmed = matchesRemovalConfirmation(confirmationInput, election);

  const runGuardedAction = async (fn: () => Promise<{ success: boolean; message?: string; error?: string }>) => {
    if (inFlightRef.current || submitting) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fn();
      if (res.success) {
        onSuccess(res.message || 'Election action completed.');
        onClose();
      } else {
        setErrorMsg(res.error || 'Action could not be completed.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected error while processing request.');
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const handlePermanentDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) {
      setErrorMsg(
        `Please type the exact election name "${election.title}"${codePhrase ? ` or "${codePhrase}"` : ''} to confirm.`
      );
      return;
    }
    await runGuardedAction(() =>
      removeElectionAction(election.id, confirmationInput.trim(), reason.trim())
    );
  };

  const handleArchive = async () => {
    await runGuardedAction(() =>
      archiveElectionAction(
        election.id,
        reason.trim() || 'Archived from election management dashboard'
      )
    );
  };

  const handleRestore = async () => {
    await runGuardedAction(() =>
      restoreArchivedElectionAction(
        election.id,
        undefined,
        reason.trim() || 'Restored from archive by administrator'
      )
    );
  };

  const handleCloseLiveElection = async () => {
    await runGuardedAction(async () => {
      const res = await updateElectionStatusAction(
        election.id,
        'closed',
        reason.trim() || 'Closed voting portal prior to election archival or removal review'
      );
      return {
        success: res.success,
        message: res.success
          ? `Election "${election.title}" closed. You can now archive or remove it if eligible.`
          : undefined,
        error: res.error,
      };
    });
  };

  const handleCancelLiveElection = async () => {
    await runGuardedAction(() =>
      cancelElectionAction(
        election.id,
        reason.trim() || 'Cancelled by administrator prior to removal review'
      )
    );
  };

  const modalTitle =
    initialMode === 'restore' && election.status === 'archived'
      ? 'RESTORE ARCHIVED ELECTION?'
      : initialMode === 'archive' && election.status !== 'archived'
      ? 'ARCHIVE ELECTION?'
      : 'REMOVE ELECTION?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-election-modal-title"
        className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-[#C62828] text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Election Lifecycle Safeguard</span>
            </div>
            <h3
              id="remove-election-modal-title"
              className="text-lg font-black text-slate-900 tracking-tight"
            >
              {modalTitle}
            </h3>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Election Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] text-slate-500">{election.code}</div>
              <div className="text-sm font-extrabold text-slate-900">{election.title}</div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
              <span className="font-semibold text-slate-800">
                {election.category}
                {election.subdomainLabel ? ` · ${election.subdomainLabel}` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Election Date</span>
              <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {formatElectionWindow(election)}
              </span>
            </div>
          </div>

          {counts && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Votes Cast</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {Math.max(
                    election.totalVotesCast || 0,
                    eligibility?.voteEvidence.electionTotalVotesCast || 0
                  ).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Authorisations</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {counts.authorisationsCount}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Portfolios</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {counts.positionsCount}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Candidates</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {counts.candidatesCount}
                </span>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {inspecting ? (
          <div className="py-6 text-center text-xs text-slate-500">
            Checking Firestore ballots, voter authorisations, receipts, and results records...
          </div>
        ) : eligibility ? (
          <div className="space-y-4 text-xs">
            {/* Case 1: Live Election Block */}
            {eligibility.isLive && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-xs">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>Live Election Cannot Be Removed</span>
                  </div>
                  <p className="leading-relaxed">
                    {eligibility.blockedReason} Close or cancel voting first so accredited voters cannot submit concurrent ballots.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Administrative Reason (Audit Trail)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional reason for closing or cancelling voting..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  {onOpenStatusModal && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        onClose();
                        onOpenStatusModal(election);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold cursor-pointer"
                    >
                      Open Status Manager
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCloseLiveElection}
                    className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Closing...' : 'Close Voting Portal'}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCancelLiveElection}
                    className="px-4 py-2 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Cancelling...' : 'Cancel Election'}
                  </button>
                </div>
              </div>
            )}

            {/* Case 2: Historical Protected or Already Archived */}
            {!eligibility.isLive && eligibility.isHistoricalProtected && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                  {eligibility.blockedReason}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Case 3: Restore Archived (when opened in restore mode or archived with votes) */}
            {!eligibility.isLive &&
              !eligibility.isHistoricalProtected &&
              election.status === 'archived' &&
              (initialMode === 'restore' || !eligibility.canPermanentlyDelete) && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-slate-800 space-y-1.5">
                    <div className="font-bold text-[#123B70] flex items-center gap-1.5">
                      <Archive className="w-4 h-4" />
                      <span>Archived Election Record</span>
                    </div>
                    <p className="leading-relaxed">
                      This election is currently archived. All cast ballots, voter authorisations, receipts, and results remain preserved. You can restore it to{' '}
                      <strong>{(election.previousStatus || 'closed').replace(/_/g, ' ')}</strong> status.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Restoration Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for restoring archived election..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleRestore}
                      className="px-4 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{submitting ? 'Restoring...' : 'Restore Archived Election'}</span>
                    </button>
                  </div>
                </div>
              )}

            {/* Case 4: Archive Only (Votes / Authorisations / Receipts / Published Results Exist, OR explicitly opened in archive mode) */}
            {!eligibility.isLive &&
              !eligibility.isHistoricalProtected &&
              election.status !== 'archived' &&
              (initialMode === 'archive' || !eligibility.canPermanentlyDelete) && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <Archive className="w-4 h-4 text-amber-700" />
                      <span>
                        {eligibility.hasVotesOrParticipation
                          ? 'Permanent Deletion Blocked — Archive Election Instead'
                          : 'Archive Election'}
                      </span>
                    </div>
                    <p className="leading-relaxed">
                      {eligibility.hasVotesOrParticipation
                        ? eligibility.blockedReason
                        : 'Archiving hides this election from active student listings, blocks voting, and preserves all positions, candidates, and audit logs.'}
                    </p>
                    <ul className="list-disc pl-5 text-[11px] space-y-0.5 pt-1 text-amber-900">
                      <li>Preserves official ballots, voter authorisations, and confirmation receipts.</li>
                      <li>Preserves certified results and immutable Electoral Commission audit logs.</li>
                      <li>Can be restored later by an authorised Electoral Commission administrator.</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Archive Reason (Audit Trail)
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Concluded election moved to Commission archives"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    {eligibility.canCancel && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleCancelLiveElection}
                        className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-[#C62828] font-bold cursor-pointer disabled:opacity-50"
                      >
                        Cancel Election
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleArchive}
                      className="px-5 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{submitting ? 'Archiving...' : 'Archive Election'}</span>
                    </button>
                  </div>
                </div>
              )}

            {/* Case 5: Eligible for Permanent Removal (Zero Votes, Not Live, Not Historical) */}
            {!eligibility.isLive &&
              !eligibility.isHistoricalProtected &&
              eligibility.canPermanentlyDelete &&
              initialMode === 'remove' && (
                <form onSubmit={handlePermanentDelete} className="space-y-4">
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-950 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-[#C62828]">
                      <Trash2 className="w-4 h-4" />
                      <span>Permanent Deletion Eligible (Zero Votes Recorded)</span>
                    </div>
                    <p className="leading-relaxed text-[11px]">
                      This action permanently removes this election record along with its election-scoped positions, candidate participation rows, assignment locks, and unpublished result drafts.
                    </p>
                    <p className="leading-relaxed text-[11px] font-semibold text-emerald-900 flex items-center gap-1 pt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Protected records preserved: registered students, permanent contestant profiles, administrator accounts, and audit logs.
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Reason for Removal (Optional)
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Duplicate draft or completed test election"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Type <span className="font-mono text-[#C62828] select-all">{election.title}</span>
                      {codePhrase ? (
                        <>
                          {' '}or <span className="font-mono text-[#C62828] select-all">{codePhrase}</span>
                        </>
                      ) : null}{' '}
                      to confirm permanent deletion <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      placeholder={election.title}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#C62828] font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                    {election.status !== 'archived' ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleArchive}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive Instead</span>
                      </button>
                    ) : (
                      <span />
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !isConfirmed}
                        className="px-5 py-2 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {submitting ? 'Removing Election...' : 'Permanently Remove Election'}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
