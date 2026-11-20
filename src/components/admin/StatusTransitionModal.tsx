import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Clock
} from 'lucide-react';
import { Election, ElectionStatus } from '../../types';
import { adminService } from '../../services/adminService';

interface StatusTransitionModalProps {
  isOpen: boolean;
  election: Election | null;
  onClose: () => void;
  onSuccess: (updatedElection: Election) => void;
}

export const StatusTransitionModal: React.FC<StatusTransitionModalProps> = ({
  isOpen,
  election,
  onClose,
  onSuccess
}) => {
  const [targetStatus, setTargetStatus] = useState<ElectionStatus | ''>('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !election) return null;

  // Allowed transitions per election lifecycle state machine
  const transitionOptions: Record<ElectionStatus, { status: ElectionStatus; label: string; desc: string }[]> = {
    draft: [
      { status: 'scheduled', label: 'Publish & Schedule Election', desc: 'Publish election configuration to students with official poll schedule.' },
      { status: 'live', label: 'Publish & Open Voting Now', desc: 'Publish election and open digital ballot box immediately for accredited voters.' },
      { status: 'pending_approval', label: 'Submit for Approval', desc: 'Forward draft to Electoral Commission board for gazetting review.' },
      { status: 'cancelled', label: 'Cancel Election', desc: 'Mark this draft election as cancelled and remove from active planning.' },
      { status: 'archived', label: 'Archive Draft', desc: 'Move unpublished draft to administrative archive.' }
    ],
    pending_approval: [
      { status: 'scheduled', label: 'Gazette & Schedule', desc: 'Formal approval granted by Electoral Commissioner.' },
      { status: 'live', label: 'Approve & Open Voting Now', desc: 'Approve election and immediately open polls.' },
      { status: 'draft', label: 'Return to Draft', desc: 'Send back to organizing committee for corrections.' },
      { status: 'suspended', label: 'Suspend Process', desc: 'Halt proceedings pending legal or vetting resolution.' },
      { status: 'cancelled', label: 'Cancel Election', desc: 'Cancel pending election before gazetting.' }
    ],
    scheduled: [
      { status: 'live', label: 'Open Voting Now (Activate)', desc: 'Open digital ballot interface for accredited voters.' },
      { status: 'draft', label: 'Unpublish (Revert to Draft)', desc: 'Remove from published student schedule and return to draft.' },
      { status: 'suspended', label: 'Halt / Postpone', desc: 'Temporarily freeze voting schedule.' },
      { status: 'cancelled', label: 'Cancel Election', desc: 'Cancel scheduled election and notify stakeholders.' },
      { status: 'archived', label: 'Archive Election', desc: 'Hide from active schedule while preserving configuration.' }
    ],
    upcoming: [
      { status: 'live', label: 'Open Voting Now (Activate)', desc: 'Open digital ballot interface for accredited voters.' },
      { status: 'draft', label: 'Unpublish (Revert to Draft)', desc: 'Remove from published student schedule and return to draft.' },
      { status: 'suspended', label: 'Halt / Postpone', desc: 'Temporarily freeze voting schedule.' },
      { status: 'cancelled', label: 'Cancel Election', desc: 'Cancel scheduled election.' },
      { status: 'archived', label: 'Archive Election', desc: 'Hide from active schedule while preserving configuration.' }
    ],
    live: [
      { status: 'closed', label: 'Close Voting Portal', desc: 'Officially close ballot submission. No further votes will be accepted.' },
      { status: 'suspended', label: 'Emergency Suspension', desc: 'Halt voting immediately due to security or connectivity alert.' },
      { status: 'cancelled', label: 'Cancel Election Immediately', desc: 'Halt voting immediately and mark election cancelled while preserving recorded audit state.' }
    ],
    suspended: [
      { status: 'live', label: 'Resume Live Voting', desc: 'Restore voting access to accredited students.' },
      { status: 'scheduled', label: 'Reschedule Opening', desc: 'Assign new timeline for voting.' },
      { status: 'closed', label: 'Close Election', desc: 'Conclude the election without resuming polls.' },
      { status: 'cancelled', label: 'Cancel Election', desc: 'Permanently cancel suspended election.' },
      { status: 'draft', label: 'Unpublish to Draft', desc: 'Return election to unpublished draft state.' }
    ],
    closed: [
      { status: 'results_pending_certification', label: 'Initiate Results Audit', desc: 'Begin cryptographic ballot counting and reconciliation.' },
      { status: 'live', label: 'Reopen Voting Portal', desc: 'Reopen digital polling portal for additional voting.' },
      { status: 'cancelled', label: 'Cancel Election', desc: 'Annul or cancel concluded poll (recorded in audit trail).' },
      { status: 'archived', label: 'Archive Record', desc: 'Hide from active elections while preserving ballots, confirmations, and results.' }
    ],
    cancelled: [
      { status: 'draft', label: 'Reopen as Draft', desc: 'Return cancelled election to draft status for re-configuration.' },
      { status: 'archived', label: 'Archive Cancelled Election', desc: 'Move cancelled election record into Commission archives.' }
    ],
    results_pending_certification: [
      { status: 'results_published', label: 'Publish Certified Results', desc: 'Release officially signed election outcomes to students.' },
      { status: 'closed', label: 'Return for Recount', desc: 'Audit discrepancies detected; return for investigation.' },
      { status: 'archived', label: 'Archive Record', desc: 'Archive election while preserving ballots and preliminary tallies.' }
    ],
    results_published: [
      { status: 'closed', label: 'Unpublish Results', desc: 'Withdraw public result publication and revert status to closed.' },
      { status: 'results_pending_certification', label: 'Return to Certification Audit', desc: 'Unpublish public gazette and reopen audit verification.' },
      { status: 'archived', label: 'Archive Record', desc: 'Hide from active polls while preserving certified results and audit logs.' }
    ],
    archived: election.isHistorical
      ? []
      : [
          {
            status: election.previousStatus && election.previousStatus !== 'archived' && election.previousStatus !== 'live'
              ? election.previousStatus
              : 'closed',
            label: 'Restore Archived Election',
            desc: `Restore election from archive to ${(election.previousStatus && election.previousStatus !== 'archived' && election.previousStatus !== 'live' ? election.previousStatus : 'closed').replace(/_/g, ' ')} status.`,
          },
        ]
  };

  const availableTransitions = transitionOptions[election.status] || [];

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!targetStatus) {
      setErrorMsg('Please select a target status.');
      return;
    }

    if (!justification.trim()) {
      setErrorMsg('Administrative justification is required for the permanent audit trail.');
      return;
    }

    setSubmitting(true);
    const res =
      election.status === 'archived'
        ? await adminService.restoreArchivedElection(
            election.id,
            targetStatus as ElectionStatus,
            justification
          )
        : await adminService.changeStatus(election.id, targetStatus as ElectionStatus, justification);
    setSubmitting(false);

    if (res?.success && res.election) {
      onSuccess(res.election);
      onClose();
    } else {
      setErrorMsg(res?.error || 'Failed to update status.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 space-y-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#123B70] ucc-caption font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Election Lifecycle State Machine</span>
            </div>
            <h3 className="ucc-heading-card text-slate-900">
              Change Status: {election.title}
            </h3>
            <p className="ucc-caption text-slate-500">
              Current State: <span className="font-semibold text-[#123B70] uppercase">{election.status}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 ucc-body-secondary flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {availableTransitions.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-100 text-slate-600 ucc-body-secondary text-center">
            This election has reached the terminal status of <strong>{election.status}</strong>. No further state transitions are permitted.
          </div>
        ) : (
          <form onSubmit={handleTransition} className="space-y-4">
            
            <div>
              <label className="block ucc-label font-semibold text-slate-800 mb-2">
                Permitted Target Status Transitions:
              </label>
              <div className="space-y-2">
                {availableTransitions.map((opt) => (
                  <label
                    key={opt.status}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      targetStatus === opt.status
                        ? 'bg-blue-50/70 border-[#123B70] shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetStatus"
                      value={opt.status}
                      checked={targetStatus === opt.status}
                      onChange={() => setTargetStatus(opt.status)}
                      className="mt-0.5 text-[#123B70]"
                    />
                    <div>
                      <div className="ucc-label font-semibold text-slate-900 flex items-center gap-2">
                        <span>{opt.label}</span>
                        <span className="ucc-caption px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                          {opt.status}
                        </span>
                      </div>
                      <p className="ucc-caption text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block ucc-label font-semibold text-slate-800 mb-1">
                Official Commission Justification / Gazette Order <span className="text-red-600">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="State the formal constitutional or administrative rationale for this transition (logged to permanent tamper-evident audit records)..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-sm text-slate-900"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 ucc-btn font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !targetStatus}
                className="px-5 py-2 rounded-xl bg-[#123B70] text-white ucc-btn font-semibold hover:bg-[#0B1F3A] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Executing Transition...' : 'Confirm Status Change'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
