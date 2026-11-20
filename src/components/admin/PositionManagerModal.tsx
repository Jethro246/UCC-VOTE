import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Award,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Check
} from 'lucide-react';
import { Position, Election } from '../../types';
import { electionClient } from '../../services/electionClient';
import { adminService } from '../../services/adminService';
import { useApp } from '../../context/AppContext';
import { getElectionStatusMeta } from '../../utils/electionStatus';

interface PositionManagerModalProps {
  isOpen: boolean;
  election: Election | null;
  onClose: () => void;
  onPositionsUpdated: (positionsCount: number) => void;
}

export const PositionManagerModal: React.FC<PositionManagerModalProps> = ({
  isOpen,
  election,
  onClose,
  onPositionsUpdated
}) => {
  const { refreshDomains } = useApp();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New Position inputs
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxSelections, setMaxSelections] = useState(1);
  const [allowsSkip, setAllowsSkip] = useState(false);
  const [candidateEligibilityRules, setCandidateEligibilityRules] = useState(
    'Accredited student in good standing, GPA >= 3.0.'
  );
  const [votingRules, setVotingRules] = useState('Single candidate preference');

  // Inline Edit state
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMaxSelections, setEditMaxSelections] = useState(1);
  const [editAllowsSkip, setEditAllowsSkip] = useState(false);
  const [editEligibilityRules, setEditEligibilityRules] = useState('');
  const [editVotingRules, setEditVotingRules] = useState('');

  useEffect(() => {
    if (election && isOpen) {
      setEditingPosId(null);
      setErrorMsg('');
      setSuccessMsg('');
      loadPositions();
    }
  }, [election, isOpen]);

  const loadPositions = async () => {
    if (!election) return;
    setLoading(true);
    const res = await electionClient.getElectionById(election.id);
    setLoading(false);
    if (res.success && res.positions) {
      setPositions(res.positions);
    }
  };

  if (!isOpen || !election) return null;

  const isLocalNugs = election.domainId === 'local_nugs' || election.category === 'Local NUGS';
  const isJcrcHall = election.domainId === 'jcrc_hall' || election.category === 'JCR / Hall';

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!title.trim()) {
      setErrorMsg('Position title is required.');
      return;
    }

    const res = await adminService.addPosition(election.id, {
      title: title.trim(),
      description: description.trim() || `Contested portfolio for ${title.trim()}`,
      maxSelections,
      allowsSkip,
      candidateEligibilityRules,
      votingRules
    });

    if (res?.success) {
      await loadPositions();
      onPositionsUpdated(positions.length + 1);
      await refreshDomains();
      setSuccessMsg(`Position '${title}' created successfully.`);
      setTitle('');
      setDescription('');
      setMaxSelections(1);
      setAllowsSkip(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg('Failed to add position.');
    }
  };

  const startEditing = (pos: Position) => {
    setEditingPosId(pos.id);
    setEditTitle(pos.title);
    setEditDescription(pos.description || '');
    setEditMaxSelections(pos.maxSelections || 1);
    setEditAllowsSkip(Boolean(pos.allowsSkip));
    setEditEligibilityRules(pos.candidateEligibilityRules || '');
    setEditVotingRules(pos.votingRules || '');
    setErrorMsg('');
  };

  const handleSaveEdit = async (posId: string) => {
    if (!editTitle.trim()) {
      setErrorMsg('Position title cannot be empty.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');

    const res = await adminService.updatePosition(election.id, posId, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      maxSelections: editMaxSelections,
      allowsSkip: editAllowsSkip,
      candidateEligibilityRules: editEligibilityRules.trim(),
      votingRules: editVotingRules.trim()
    });

    if (res?.success) {
      await loadPositions();
      onPositionsUpdated(positions.length);
      await refreshDomains();
      setEditingPosId(null);
      setSuccessMsg(`Portfolio '${editTitle.trim()}' updated.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg('Failed to update position.');
    }
  };

  const handleDeletePosition = async (posId: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    const res = await adminService.deletePosition(election.id, posId);
    if (res?.success) {
      const updated = res.remainingPositions || positions.filter((p) => p.id !== posId);
      setPositions(updated);
      onPositionsUpdated(updated.length);
      await refreshDomains();
      setSuccessMsg('Position removed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg('Failed to delete position.');
    }
  };

  const isLiveOrClosed =
    election.status === 'live' ||
    election.status === 'closed' ||
    election.status === 'results_published' ||
    election.status === 'cancelled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-1.5 ucc-caption font-semibold text-[#123B70] mb-1">
              <Award className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Ballot Portfolios & Contested Offices</span>
            </div>
            <h3 className="ucc-heading-card text-slate-900">
              Manage Positions: {election.title}
            </h3>
            <p className="ucc-caption text-slate-500 tabular-nums mt-0.5">
              {election.id} · {election.category}
              {election.subdomainLabel ? ` · ${election.subdomainLabel}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(isLocalNugs || isJcrcHall) && (
          <div className="p-3 rounded-xl bg-[#EAF2FA] border border-blue-200 ucc-body-secondary text-[#123B70]">
            {isLocalNugs
              ? 'Local NUGS Policy: Positions are dynamically configurable by authorized administrators—add, rename, edit, or remove portfolios freely before polls go live.'
              : 'Hall Constitution Policy: Each residential hall maintains its own independent JCRC portfolios according to its approved hall constitution.'}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 ucc-body-secondary flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 ucc-body-secondary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {isLiveOrClosed && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 ucc-body-secondary flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              This election is {getElectionStatusMeta(election).label.toUpperCase()}. Position structures are locked to preserve ballot integrity.
            </span>
          </div>
        )}

        {/* Existing Positions List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between ucc-label font-semibold text-slate-700">
            <span>Configured Contested Portfolios ({positions.length})</span>
            <span className="ucc-caption text-slate-400">Order of Appearance</span>
          </div>

          {loading ? (
            <div className="p-6 text-center ucc-body-secondary text-slate-500">Loading portfolios...</div>
          ) : positions.length === 0 ? (
            <div className="p-6 text-center ucc-body-secondary text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              No positions configured yet for this election. Add portfolios below.
            </div>
          ) : (
            <div className="space-y-2.5">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                >
                  {editingPosId === pos.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block ucc-label font-semibold text-slate-700 mb-1">Portfolio Title</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block ucc-label font-semibold text-slate-700 mb-1">Max Selections</label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={editMaxSelections}
                            onChange={(e) => setEditMaxSelections(parseInt(e.target.value, 10) || 1)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm tabular-nums text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block ucc-label font-semibold text-slate-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block ucc-label font-semibold text-slate-700 mb-1">Qualification Rule</label>
                          <input
                            type="text"
                            value={editEligibilityRules}
                            onChange={(e) => setEditEligibilityRules(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block ucc-label font-semibold text-slate-700 mb-1">Voting Rule</label>
                          <input
                            type="text"
                            value={editVotingRules}
                            onChange={(e) => setEditVotingRules(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer ucc-body-secondary text-slate-700">
                          <input
                            type="checkbox"
                            checked={editAllowsSkip}
                            onChange={(e) => setEditAllowsSkip(e.target.checked)}
                            className="rounded text-[#123B70]"
                          />
                          <span>Allow voters to skip / abstain</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPosId(null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 ucc-caption font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(pos.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#123B70] text-white ucc-caption font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Update</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#123B70] text-white flex items-center justify-center ucc-caption font-semibold tabular-nums shrink-0">
                            {pos.order}
                          </span>
                          <h4 className="ucc-label font-semibold text-slate-900">{pos.title}</h4>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 ucc-caption tabular-nums">
                            Max {pos.maxSelections} {pos.maxSelections > 1 ? 'votes' : 'vote'}
                          </span>
                        </div>
                        <p className="text-slate-600 ucc-body-secondary">{pos.description}</p>
                        <div className="ucc-caption text-slate-500 pt-0.5">
                          Rule: {pos.candidateEligibilityRules || 'Accredited student'} · Abstain allowed: {pos.allowsSkip ? 'YES' : 'NO'}
                        </div>
                      </div>

                      {!isLiveOrClosed && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditing(pos)}
                            className="p-1.5 rounded-lg text-[#123B70] hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Position"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePosition(pos.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove Position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Position Form (if not locked) */}
        {!isLiveOrClosed && (
          <form onSubmit={handleAddPosition} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <h4 className="ucc-label font-semibold text-slate-900 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Add New Contested Office</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block ucc-label font-semibold text-slate-700 mb-1">
                  Portfolio Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Women's Commissioner or Treasurer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block ucc-label font-semibold text-slate-700 mb-1">
                  Max Candidate Selections
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm tabular-nums text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block ucc-label font-semibold text-slate-700 mb-1">
                Portfolio Description & Mandate
              </label>
              <input
                type="text"
                placeholder="Official constitutional responsibilities..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block ucc-label font-semibold text-slate-700 mb-1">
                  Candidate Qualification Rule
                </label>
                <input
                  type="text"
                  value={candidateEligibilityRules}
                  onChange={(e) => setCandidateEligibilityRules(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block ucc-label font-semibold text-slate-700 mb-1">
                  Voting Rule
                </label>
                <input
                  type="text"
                  value={votingRules}
                  onChange={(e) => setVotingRules(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer ucc-body-secondary text-slate-700">
                <input
                  type="checkbox"
                  checked={allowsSkip}
                  onChange={(e) => setAllowsSkip(e.target.checked)}
                  className="rounded text-[#123B70]"
                />
                <span>Allow voters to skip / abstain</span>
              </label>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#123B70] text-white ucc-btn font-semibold hover:bg-[#0B1F3A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Add Portfolio
              </button>
            </div>
          </form>
        )}

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white ucc-btn font-semibold hover:bg-slate-900 cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
