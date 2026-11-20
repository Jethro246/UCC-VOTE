import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Lock,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useApp } from '../../context/AppContext';
import {
  BULK_REMOVE_CONFIRMATION_PHRASE,
  BulkElectionInspectionItem,
  buildBulkRemovalPlan,
  getElectionStatusMeta,
  matchesBulkRemovalConfirmation,
} from '../../utils/electionRemovalUtils';

interface RemoveAllElectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const RemoveAllElectionsModal: React.FC<RemoveAllElectionsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { removeAllElectionsAction } = useApp();

  const [inspecting, setInspecting] = useState(false);
  const [inspectionItems, setInspectionItems] = useState<BulkElectionInspectionItem[]>([]);
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [detachProtectedElections, setDetachProtectedElections] = useState(false);
  const [reviewedElections, setReviewedElections] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [blockedReport, setBlockedReport] = useState<
    Array<{
      electionId: string;
      title: string;
      code: string;
      status: string;
      protectedRecords: string[];
      reason: string;
    }>
  >([]);
  const [resultSummary, setResultSummary] = useState<{
    message: string;
    removedElectionsCount: number;
    removedRelatedDocsCount: number;
    archivedDetachedCount: number;
    preservedHistoricalCount: number;
    preservedCollections: string[];
  } | null>(null);

  const inFlightRef = useRef(false);

  const runInspection = async () => {
    setInspecting(true);
    setErrorMsg('');
    setBlockedReport([]);
    try {
      const res = await adminService.inspectAllElectionsForRemoval();
      if (res.success) {
        setInspectionItems(res.items);
      } else {
        setErrorMsg(res.error || 'Unable to inspect elections on UCC-VOTE.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Inspection failed.');
    } finally {
      setInspecting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setInspectionItems([]);
      setIncludeHistorical(false);
      setDetachProtectedElections(false);
      setReviewedElections(false);
      setConfirmationInput('');
      setReason('');
      setErrorMsg('');
      setBlockedReport([]);
      setResultSummary(null);
      setSubmitting(false);
      inFlightRef.current = false;
      return;
    }
    runInspection();
  }, [isOpen]);

  const plan = useMemo(
    () => buildBulkRemovalPlan(inspectionItems, { includeHistorical }),
    [inspectionItems, includeHistorical]
  );

  if (!isOpen) return null;

  const isPhraseValid = matchesBulkRemovalConfirmation(confirmationInput);
  const needsDetachApproval = plan.detachArchiveCount > 0 && !detachProtectedElections;
  const canSubmit =
    !inspecting &&
    !submitting &&
    !inFlightRef.current &&
    !resultSummary &&
    plan.totalFound > 0 &&
    !plan.hasLiveBlockers &&
    reviewedElections &&
    isPhraseValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || submitting || resultSummary) return;

    if (!reviewedElections) {
      setErrorMsg('Please confirm that you have reviewed all identified elections above.');
      return;
    }

    if (!isPhraseValid) {
      setErrorMsg(`Please type "${BULK_REMOVE_CONFIRMATION_PHRASE}" verbatim to confirm.`);
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    setErrorMsg('');
    setBlockedReport([]);

    try {
      const res = await removeAllElectionsAction({
        confirmationText: confirmationInput.trim(),
        includeHistorical,
        detachProtectedElections,
        reason: reason.trim() || undefined,
      });

      if (res.success) {
        const msg =
          res.message ||
          `Removed ${res.removedElectionsCount ?? 0} election(s) and archived/detached ${
            res.archivedDetachedCount ?? 0
          } protected election(s).`;
        setResultSummary({
          message: msg,
          removedElectionsCount: res.removedElectionsCount ?? 0,
          removedRelatedDocsCount: res.removedRelatedDocsCount ?? 0,
          archivedDetachedCount: res.archivedDetachedCount ?? 0,
          preservedHistoricalCount: res.preservedHistoricalCount ?? 0,
          preservedCollections: res.preservedCollections || [],
        });
        onSuccess(msg);
      } else {
        setErrorMsg(res.error || 'Bulk removal was blocked by safety rules.');
        if (Array.isArray(res.blockedReport) && res.blockedReport.length > 0) {
          setBlockedReport(res.blockedReport);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected error during bulk election removal.');
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-all-elections-title"
        className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-[#C62828] text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Global Governance Directory Control</span>
            </div>
            <h3
              id="remove-all-elections-title"
              className="text-lg font-black text-slate-900 tracking-tight"
            >
              REMOVE ALL ELECTIONS
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {!resultSummary && (
              <button
                type="button"
                disabled={inspecting || submitting}
                onClick={runInspection}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${inspecting ? 'animate-spin' : ''}`} />
                <span>Re-inspect</span>
              </button>
            )}
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
        </div>

        {/* Completed Execution Report */}
        {resultSummary ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
              <div className="font-extrabold text-sm flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Directory Clearance Complete</span>
              </div>
              <p className="leading-relaxed">{resultSummary.message}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-400">Removed Elections</div>
                <div className="text-lg font-mono font-black text-slate-900">
                  {resultSummary.removedElectionsCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Removed Related Docs
                </div>
                <div className="text-lg font-mono font-black text-slate-900">
                  {resultSummary.removedRelatedDocsCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] font-bold uppercase text-amber-700">
                  Archived &amp; Detached
                </div>
                <div className="text-lg font-mono font-black text-amber-900">
                  {resultSummary.archivedDetachedCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[10px] font-bold uppercase text-[#123B70]">
                  Historical Retained
                </div>
                <div className="text-lg font-mono font-black text-[#123B70]">
                  {resultSummary.preservedHistoricalCount}
                </div>
              </div>
            </div>

            {resultSummary.preservedCollections.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">Strictly Preserved Collections</div>
                <div className="text-[11px] font-mono text-slate-600">
                  {resultSummary.preservedCollections.join(', ')}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Serious Confirmation Warning (Section 3 Verbatim) */}
            <div className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-950 space-y-1.5">
              <div className="font-extrabold flex items-center gap-2 text-[#C62828]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Serious Administrative Confirmation Required</span>
              </div>
              <p className="font-semibold leading-relaxed">
                WARNING: You are about to remove all configured elections from UCC-VOTE. This operation may affect election listings and associated configurations.
              </p>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Elections Found
                </span>
                <span className="text-lg font-mono font-black text-slate-900 tabular-nums">
                  {inspecting ? '...' : plan.totalFound}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Associated Positions
                </span>
                <span className="text-lg font-mono font-black text-slate-900 tabular-nums">
                  {inspecting ? '...' : plan.totalPositionsCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Candidate Records
                </span>
                <span className="text-lg font-mono font-black text-slate-900 tabular-nums">
                  {inspecting ? '...' : plan.totalCandidatesCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  With Voting Records
                </span>
                <span
                  className={`text-lg font-mono font-black tabular-nums ${
                    plan.withVotingRecordsCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {inspecting ? '...' : plan.withVotingRecordsCount}
                </span>
              </div>
            </div>

            {/* Historical Inclusion Toggle */}
            <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHistorical}
                onChange={(e) => setIncludeHistorical(e.target.checked)}
                disabled={inspecting || submitting}
                className="mt-0.5 rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">
                  Include historical 2026 election entries for active directory removal
                </span>
                <span className="text-[11px] text-slate-600 block">
                  When selected, historical entries are archived/detached from active student listings while preserving historical outcomes, tallies, and audit records.
                </span>
              </div>
            </label>

            {/* Discovered Elections Pre-Execution Inspection Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#123B70]" />
                  <span>Pre-Execution Discovery Inventory ({plan.totalFound})</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Delete: {plan.deletableCount} · Archive/Detach: {plan.detachArchiveCount} · Retained Historical: {plan.skippedHistoricalCount}
                </span>
              </div>

              {inspecting ? (
                <div className="py-8 text-center text-slate-500 border border-slate-200 rounded-2xl bg-slate-50/50">
                  Scanning Firestore elections, positions, candidates, voter authorisations, receipts, and results...
                </div>
              ) : plan.totalFound === 0 ? (
                <div className="py-8 text-center text-slate-500 border border-slate-200 rounded-2xl bg-slate-50/50">
                  No configured elections remain in the active election directory.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {plan.items.map((item) => {
                    const statusMeta = getElectionStatusMeta(item.election.status);
                    const badgeStyle =
                      item.disposition === 'delete'
                        ? 'bg-red-50 text-[#C62828] border-red-200'
                        : item.disposition === 'blocked_live'
                        ? 'bg-red-100 text-red-900 border-red-300'
                        : item.disposition === 'detach_archive'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-blue-50 text-[#123B70] border-blue-200';

                    const dispositionLabel =
                      item.disposition === 'delete'
                        ? 'Safe Remove'
                        : item.disposition === 'blocked_live'
                        ? 'Live Blocker'
                        : item.disposition === 'detach_archive'
                        ? 'Archive & Detach Only'
                        : 'Preserved Historical';

                    return (
                      <div key={item.election.id} className="p-3.5 space-y-1.5 bg-white">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {item.election.code} · ID: {item.election.id} ·{' '}
                              {item.source === 'firestore' ? 'Firestore' : 'Built-In Config'}
                            </div>
                            <div className="font-bold text-slate-900 text-xs">
                              {item.election.title}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${badgeStyle}`}
                            >
                              {dispositionLabel}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                          <span>
                            Positions: <strong className="font-mono">{item.positionsCount}</strong>
                          </span>
                          <span>
                            Candidates: <strong className="font-mono">{item.candidatesCount}</strong>
                          </span>
                          <span>
                            Voting Records:{' '}
                            <strong
                              className={
                                item.votingRecordsExist ? 'text-amber-700' : 'text-emerald-700'
                              }
                            >
                              {item.votingRecordsExist ? 'Yes (Protected)' : 'None'}
                            </strong>
                          </span>
                        </div>

                        {item.protectedRecords.length > 0 && (
                          <div className="text-[10px] text-amber-800 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2.5 py-1">
                            Protected Records: {item.protectedRecords.join(' · ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live Blockers Notice */}
            {plan.hasLiveBlockers && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-[#C62828]">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Active LIVE Election(s) Prevent Bulk Removal</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {plan.blockedLiveCount} election(s) currently have LIVE status. Close or cancel all live elections before executing bulk removal.
                </p>
              </div>
            )}

            {/* Protected Voting Records Safeguard */}
            {plan.detachArchiveCount > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Protected Records Detected ({plan.detachArchiveCount} election(s))
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Ballots, voter authorisations, confirmation receipts, published/certified results, or historical archives cannot be permanently deleted. Check the safeguard below to archive and detach them from the active directory while preserving every protected record; otherwise, execution will stop and report the blocking records.
                </p>
                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detachProtectedElections}
                    onChange={(e) => setDetachProtectedElections(e.target.checked)}
                    disabled={submitting}
                    className="mt-0.5 rounded border-amber-400 text-[#123B70] focus:ring-[#123B70]"
                  />
                  <span className="font-bold text-[11px] text-amber-950">
                    Archive &amp; detach protected/historical elections from the active directory without deleting ballots, receipts, authorisations, or results
                  </span>
                </label>
              </div>
            )}

            {/* Blocked Report Returned By Server Guard */}
            {blockedReport.length > 0 && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-950 space-y-2">
                <div className="font-bold text-[#C62828]">
                  Execution Stopped — Protected Records Prevent Permanent Deletion:
                </div>
                <ul className="space-y-1.5 text-[11px]">
                  {blockedReport.map((item) => (
                    <li key={item.electionId} className="bg-white/80 rounded-lg p-2 border border-red-200">
                      <div className="font-bold">
                        {item.title} ({item.code}) — Status: {item.status}
                      </div>
                      <div className="text-red-800">{item.reason}</div>
                      {item.protectedRecords.length > 0 && (
                        <div className="font-mono text-[10px] text-slate-700 mt-0.5">
                          Protected: {item.protectedRecords.join(', ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Data Preservation Guarantee */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-950 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
              <span>
                Strictly preserved: student accounts, administrator accounts, Firebase Auth users, voter eligibility records, permanent contestant profiles, cast ballots, voter authorisations, confirmation receipts, certified results, and audit logs.
              </span>
            </div>

            {plan.totalFound > 0 && (
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reviewedElections}
                    onChange={(e) => setReviewedElections(e.target.checked)}
                    disabled={submitting}
                    className="mt-0.5 rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
                  />
                  <span className="font-semibold text-slate-800">
                    I have reviewed all {plan.totalFound} identified election(s), their statuses, associated positions/candidates, and protected record flags above.
                  </span>
                </label>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Audit Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Resetting active election directory prior to 2027 cycle setup"
                    disabled={submitting}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Type{' '}
                    <span className="font-mono text-[#C62828] select-all">
                      {BULK_REMOVE_CONFIRMATION_PHRASE}
                    </span>{' '}
                    to confirm <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder={BULK_REMOVE_CONFIRMATION_PHRASE}
                    disabled={submitting}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#C62828] font-mono text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <span className="text-[11px] text-slate-500">
                {needsDetachApproval
                  ? 'Protected records exist: execution will halt unless Archive & Detach is enabled.'
                  : 'Ability to create new elections will remain fully intact.'}
              </span>
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
                  disabled={!canSubmit}
                  className="px-5 py-2 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {submitting ? 'Processing Removal...' : 'Execute REMOVE ALL ELECTIONS'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
