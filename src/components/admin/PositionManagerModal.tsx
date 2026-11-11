import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Award, 
  AlertCircle, 
  CheckCircle2,
  Users
} from 'lucide-react';
import { Position, Election } from '../../types';
import { electionClient } from '../../services/electionClient';

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
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New Position inputs
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxSelections, setMaxSelections] = useState(1);
  const [allowsSkip, setAllowsSkip] = useState(false);
  const [candidateEligibilityRules, setCandidateEligibilityRules] = useState('Accredited student in good standing, GPA >= 3.0.');
  const [votingRules, setVotingRules] = useState('Single candidate preference');

  useEffect(() => {
    if (election && isOpen) {
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

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!title.trim()) {
      setErrorMsg('Position title is required.');
      return;
    }

    const res = await electionClient.addPosition(election.id, {
      title: title.trim(),
      description: description.trim() || `Contested portfolio for ${title.trim()}`,
      maxSelections,
      allowsSkip,
      candidateEligibilityRules,
      votingRules
    });

    if (res.success && res.allPositions) {
      setPositions(res.allPositions);
      onPositionsUpdated(res.allPositions.length);
      setSuccessMsg(`Position '${title}' created successfully.`);
      setTitle('');
      setDescription('');
      setMaxSelections(1);
      setAllowsSkip(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg(res.error || 'Failed to add position.');
    }
  };

  const handleDeletePosition = async (posId: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    const res = await electionClient.deletePosition(election.id, posId);
    if (res.success && res.remainingPositions) {
      setPositions(res.remainingPositions);
      onPositionsUpdated(res.remainingPositions.length);
      setSuccessMsg('Position removed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg(res.error || 'Failed to delete position.');
    }
  };

  const isLiveOrClosed = election.status === 'live' || election.status === 'closed' || election.status === 'results_published';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#123B70] text-xs font-bold mb-1">
              <Award className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Ballot Portfolios & Contested Offices</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Manage Positions: {election.title}
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Election ID: {election.id} · Category: {election.category}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {isLiveOrClosed && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              This election is {election.status.toUpperCase()}. Position structures are locked to preserve ballot integrity and prevent tampering.
            </span>
          </div>
        )}

        {/* Existing Positions List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Configured Contested Portfolios ({positions.length})</span>
            <span className="text-slate-400 font-mono">Order of Appearance</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-xs text-slate-500">Loading portfolios...</div>
          ) : positions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              No positions configured yet for this election. Add portfolios below.
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#123B70] text-white flex items-center justify-center font-mono font-bold text-[11px]">
                        {pos.order}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{pos.title}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
                        Max {pos.maxSelections} {pos.maxSelections > 1 ? 'votes' : 'vote'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{pos.description}</p>
                    <div className="text-[10px] text-slate-500 font-mono pt-1">
                      Rule: {pos.candidateEligibilityRules || 'Accredited student'} · Abstain allowed: {pos.allowsSkip ? 'YES' : 'NO'}
                    </div>
                  </div>

                  {!isLiveOrClosed && (
                    <button
                      type="button"
                      onClick={() => handleDeletePosition(pos.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      title="Remove Position"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Position Form (if not locked) */}
        {!isLiveOrClosed && (
          <form onSubmit={handleAddPosition} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Add New Contested Office</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Portfolio Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Public Relations Officer (PRO)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Max Candidate Selections
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Portfolio Description & Mandate
              </label>
              <input
                type="text"
                placeholder="Official constitutional responsibilities..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Candidate Qualification Rule
                </label>
                <input
                  type="text"
                  value={candidateEligibilityRules}
                  onChange={(e) => setCandidateEligibilityRules(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Voting Rule
                </label>
                <input
                  type="text"
                  value={votingRules}
                  onChange={(e) => setVotingRules(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={allowsSkip}
                  onChange={(e) => setAllowsSkip(e.target.checked)}
                  className="rounded text-[#123B70]"
                />
                <span>Allow student voters to skip / abstain from this portfolio</span>
              </label>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#123B70] text-white font-bold hover:bg-[#0B1F3A] transition-colors"
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
            className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
