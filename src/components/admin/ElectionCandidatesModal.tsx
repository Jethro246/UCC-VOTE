import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Candidate, ContestantProfile, Election } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  ContestantDirectoryEntry,
  evaluateElectionCandidateActionAllowed,
  normalizeStudentId,
  resolveCandidatePhotoUrl,
} from '../../utils/contestantUtils';
import {
  startCandidatePhotoUpload,
  UploadTaskHandle,
  validateCandidateImageFile,
} from '../../services/firebaseStorageService';
import { CandidateAvatar } from '../common/CandidateAvatar';
import { ContestantSelectorModal } from './ContestantSelectorModal';

interface ElectionCandidatesModalProps {
  isOpen: boolean;
  election: Election | null;
  onClose: () => void;
  onSuccessToast: (message: string) => void;
}

const UCC_LEVELS = ['100', '200', '300', '400', 'Postgraduate'];

export const ElectionCandidatesModal: React.FC<ElectionCandidatesModalProps> = ({
  isOpen,
  election,
  onClose,
  onSuccessToast,
}) => {
  const {
    candidates,
    positionsByElection,
    contestants,
    halls,
    updateElectionCandidateAction,
    updateContestantPermanentProfileAction,
    removeCandidateFromElectionAction,
    refreshCandidates,
    refreshElections,
  } = useApp();

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorTab, setSelectorTab] = useState<'existing' | 'new'>('existing');
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [viewingProfileEntry, setViewingProfileEntry] =
    useState<ContestantDirectoryEntry | null>(null);
  const [candidateToRemove, setCandidateToRemove] = useState<Candidate | null>(null);

  // Edit form state
  const [editPosId, setEditPosId] = useState('');
  const [editCampaignStatement, setEditCampaignStatement] = useState('');
  const [editManifestoSummary, setEditManifestoSummary] = useState('');
  const [editFullManifestoText, setEditFullManifestoText] = useState('');
  const [editKeyPromisesText, setEditKeyPromisesText] = useState('');
  const [editElectionPhotoUrl, setEditElectionPhotoUrl] = useState('');
  const [editStatus, setEditStatus] = useState<Candidate['applicationStatus']>('Approved');

  // Permanent profile fields inside edit view
  const [permOriginal, setPermOriginal] = useState<ContestantDirectoryEntry | null>(null);
  const [permFullName, setPermFullName] = useState('');
  const [permStudentId, setPermStudentId] = useState('');
  const [permNickname, setPermNickname] = useState('');
  const [permDepartment, setPermDepartment] = useState('');
  const [permFaculty, setPermFaculty] = useState('');
  const [permProgramme, setPermProgramme] = useState('');
  const [permLevel, setPermLevel] = useState('300');
  const [permHall, setPermHall] = useState('');
  const [permPhone, setPermPhone] = useState('');
  const [permPhotoUrl, setPermPhotoUrl] = useState('');
  const [permBiography, setPermBiography] = useState('');
  const [confirmPermanentUpdate, setConfirmPermanentUpdate] = useState(false);

  // Uploads inside edit view
  const [uploadingSlot, setUploadingSlot] = useState<'election' | 'permanent' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeReason, setRemoveReason] = useState('');

  const uploadTaskRef = useRef<UploadTaskHandle | null>(null);
  const electionPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const permanentPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const electionPositions = useMemo(
    () => (election ? positionsByElection[election.id] || [] : []),
    [election, positionsByElection]
  );

  const electionCandidates = useMemo(
    () => (election ? candidates.filter((c) => c.electionId === election.id) : []),
    [candidates, election]
  );

  const findContestantEntry = (cand: Candidate): ContestantDirectoryEntry | null => {
    const normSid = normalizeStudentId(cand.studentId);
    return (
      contestants.find(
        (c) =>
          (cand.contestantId && c.id === cand.contestantId) ||
          (normSid && normalizeStudentId(c.studentId) === normSid)
      ) || null
    );
  };

  const openEditCandidate = (cand: Candidate) => {
    setActionError('');
    setConfirmPermanentUpdate(false);
    setEditingCandidate(cand);

    setEditPosId(cand.positionId);
    setEditCampaignStatement(cand.campaignStatement || '');
    setEditManifestoSummary(cand.manifestoSummary || '');
    setEditFullManifestoText((cand.fullManifesto || []).join('\n'));
    setEditKeyPromisesText((cand.keyPromises || []).join('\n'));
    setEditElectionPhotoUrl(cand.electionPhotoUrl || '');
    setEditStatus(cand.applicationStatus);

    const matchedPerm = findContestantEntry(cand);
    setPermOriginal(matchedPerm);
    setPermFullName(matchedPerm?.fullName || cand.fullName);
    setPermStudentId(matchedPerm?.studentId || cand.studentId);
    setPermNickname(matchedPerm?.nickname || cand.nickname || '');
    setPermDepartment(matchedPerm?.department || cand.department);
    setPermFaculty(matchedPerm?.faculty || cand.faculty);
    setPermProgramme(matchedPerm?.programme || cand.programme || '');
    setPermLevel(matchedPerm?.level || cand.level || '300');
    setPermHall(matchedPerm?.hall || cand.hall);
    setPermPhone(matchedPerm?.phone || cand.phone || '');
    setPermPhotoUrl(matchedPerm?.photoUrl || cand.photoUrl || '');
    setPermBiography(matchedPerm?.biography || cand.biography || '');
  };

  const modifiedPermanentFields = useMemo(() => {
    if (!editingCandidate) return [];
    const baseName = permOriginal?.fullName || editingCandidate.fullName || '';
    const baseSid = normalizeStudentId(
      permOriginal?.studentId || editingCandidate.studentId
    );
    const baseNick = permOriginal?.nickname || editingCandidate.nickname || '';
    const baseDept = permOriginal?.department || editingCandidate.department || '';
    const baseFac = permOriginal?.faculty || editingCandidate.faculty || '';
    const baseProg = permOriginal?.programme || editingCandidate.programme || '';
    const baseLvl = permOriginal?.level || editingCandidate.level || '';
    const baseHall = permOriginal?.hall || editingCandidate.hall || '';
    const basePhone = permOriginal?.phone || editingCandidate.phone || '';
    const basePhoto = permOriginal?.photoUrl || editingCandidate.photoUrl || '';
    const baseBio = permOriginal?.biography || editingCandidate.biography || '';

    const changed: string[] = [];
    const checks: [string, string, string][] = [
      ['Full Name', baseName, permFullName],
      ['Student ID', baseSid, normalizeStudentId(permStudentId)],
      ['Nickname', baseNick, permNickname],
      ['Department', baseDept, permDepartment],
      ['Faculty', baseFac, permFaculty],
      ['Programme', baseProg, permProgramme],
      ['Level', baseLvl, permLevel],
      ['Hall', baseHall, permHall],
      ['Phone', basePhone, permPhone],
      ['Default Photo', basePhoto, permPhotoUrl],
      ['Biography', baseBio, permBiography],
    ];
    for (const [label, a, b] of checks) {
      if (a.trim() !== b.trim()) changed.push(label);
    }
    return changed;
  }, [
    editingCandidate,
    permOriginal,
    permFullName,
    permStudentId,
    permNickname,
    permDepartment,
    permFaculty,
    permProgramme,
    permLevel,
    permHall,
    permPhone,
    permPhotoUrl,
    permBiography,
  ]);

  const handleUploadSlot = async (file: File, slot: 'election' | 'permanent') => {
    if (!editingCandidate) return;
    setActionError('');
    const validation = await validateCandidateImageFile(file);
    if (!validation.valid) {
      setActionError(validation.error);
      return;
    }

    uploadTaskRef.current?.cancel();
    setUploadingSlot(slot);
    setUploadProgress(0);

    const keyHint =
      normalizeStudentId(permStudentId) ||
      editingCandidate.contestantId ||
      editingCandidate.id;

    const handle = startCandidatePhotoUpload(file, keyHint, (pct) => {
      setUploadProgress(pct);
    });
    uploadTaskRef.current = handle;

    try {
      const { url } = await handle.promise;
      if (slot === 'election') setEditElectionPhotoUrl(url);
      else setPermPhotoUrl(url);
      setUploadingSlot(null);
      setUploadProgress(100);
    } catch (err: any) {
      setUploadingSlot(null);
      setActionError(err?.message || 'Image upload failed.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate || !election) return;
    setActionError('');

    if (modifiedPermanentFields.length > 0 && !confirmPermanentUpdate) {
      setActionError(
        `Permanent contestant fields changed (${modifiedPermanentFields.join(', ')}). Confirm the permanent profile update checkbox before saving.`
      );
      return;
    }

    setSaving(true);
    const permanentUpdates: Partial<ContestantProfile> | undefined =
      modifiedPermanentFields.length > 0 && confirmPermanentUpdate
        ? {
            fullName: permFullName.trim(),
            studentId:
              normalizeStudentId(permStudentId) || permStudentId.trim() || 'Not verified',
            nickname: permNickname.trim() || undefined,
            department: permDepartment.trim() || 'Not verified',
            faculty: permFaculty.trim() || 'Not verified',
            programme: permProgramme.trim(),
            level: permLevel,
            hall: permHall.trim() || 'Not verified',
            phone: permPhone.trim() || undefined,
            photoUrl: permPhotoUrl.trim(),
            biography: permBiography.trim(),
          }
        : undefined;

    const res = await updateElectionCandidateAction(editingCandidate.id, {
      positionId: editPosId,
      campaignStatement: editCampaignStatement.trim(),
      manifestoSummary: editManifestoSummary.trim(),
      fullManifesto: editFullManifestoText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      keyPromises: editKeyPromisesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      electionPhotoUrl: editElectionPhotoUrl.trim(),
      applicationStatus: editStatus,
      confirmPermanentUpdate:
        modifiedPermanentFields.length > 0 && confirmPermanentUpdate,
      permanentProfileUpdates: permanentUpdates,
    });

    setSaving(false);

    if (!res.success) {
      setActionError(res.error || 'Failed to update candidate.');
      return;
    }

    await refreshCandidates();
    setEditingCandidate(null);
    onSuccessToast(res.message || `Updated ${permFullName} in ${election.title}.`);
  };

  const handleConfirmRemove = async () => {
    if (!candidateToRemove || !election) return;
    setActionError('');
    setRemoving(true);
    const res = await removeCandidateFromElectionAction(
      candidateToRemove.id,
      removeReason.trim() || undefined
    );
    setRemoving(false);

    if (!res.success) {
      setActionError(res.error || 'Failed to remove candidate from election.');
      return;
    }

    await Promise.all([refreshCandidates(), refreshElections()]);
    const removedName = candidateToRemove.fullName;
    setCandidateToRemove(null);
    setRemoveReason('');
    onSuccessToast(
      res.message ||
        `${removedName} removed from ${election.title}. Permanent contestant profile preserved.`
    );
  };

  if (!isOpen || !election) return null;

  const addGuard = evaluateElectionCandidateActionAllowed(election, 'add');
  const posChangeGuard = editingCandidate
    ? evaluateElectionCandidateActionAllowed(election, 'change_position', editingCandidate)
    : { allowed: true };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#102A43]/75 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl border border-slate-200 max-w-5xl w-full shadow-2xl my-6 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-4 bg-[#102A43] text-white rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#14B8A6] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {election.category} · {election.status.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                Election Candidates — {election.title}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {electionCandidates.length} candidate
                {electionCandidates.length === 1 ? '' : 's'} across {electionPositions.length}{' '}
                position{electionPositions.length === 1 ? '' : 's'}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!addGuard.allowed}
                onClick={() => {
                  setSelectorTab('existing');
                  setSelectorOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Add Existing Contestant</span>
              </button>
              <button
                type="button"
                disabled={!addGuard.allowed}
                onClick={() => {
                  setSelectorTab('new');
                  setSelectorOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#14B8A6] hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register New Contestant</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
            {!addGuard.allowed && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Election Roster Safeguard Active</div>
                  <p className="mt-0.5">{addGuard.reason}</p>
                </div>
              </div>
            )}

            {actionError && !editingCandidate && !candidateToRemove && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#E45757]" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Edit Candidate Panel */}
            {editingCandidate ? (
              <form
                onSubmit={handleSaveEdit}
                className="p-5 rounded-2xl bg-[#F5F7FB] border border-slate-200 space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-black text-[#102A43]">
                      Edit Candidate Participation — {editingCandidate.fullName}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Election-specific fields only update this election; permanent profile changes
                      require explicit confirmation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCandidate(null);
                      setActionError('');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Back to Roster
                  </button>
                </div>

                {actionError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#E45757] mt-0.5" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Position & Election-specific fields */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-4">
                  <h4 className="font-bold text-[#102A43] text-sm flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#2563EB]" />
                    <span>Election-Specific Participation Details</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Assigned Position in {election.title}
                      </label>
                      <select
                        disabled={!posChangeGuard.allowed}
                        value={editPosId}
                        onChange={(e) => setEditPosId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        {electionPositions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                      {!posChangeGuard.allowed && (
                        <p className="text-[10px] text-[#E45757] mt-1">{posChangeGuard.reason}</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Ballot Approval Status
                      </label>
                      <select
                        value={editStatus}
                        onChange={(e) =>
                          setEditStatus(e.target.value as Candidate['applicationStatus'])
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                      >
                        <option value="Approved">Approved</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Under review">Under review</option>
                        <option value="Draft">Draft</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Withdrawn">Withdrawn</option>
                      </select>
                    </div>
                  </div>

                  {/* Election Photo Override */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#F5F7FB] border border-slate-200">
                    <div className="flex items-center gap-3">
                      <CandidateAvatar
                        src={editElectionPhotoUrl || permPhotoUrl}
                        alt={permFullName}
                        className="w-12 h-12 rounded-xl object-cover object-top border border-slate-200 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-slate-900">
                          {editElectionPhotoUrl
                            ? 'Election-Specific Photo Override Active'
                            : 'Using Permanent Default Photo'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Overrides the candidate photo exclusively in {election.title}.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={electionPhotoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) handleUploadSlot(f, 'election');
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingSlot === 'election'}
                        onClick={() => electionPhotoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>
                          {uploadingSlot === 'election'
                            ? `Uploading ${uploadProgress}%...`
                            : 'Upload Election Photo'}
                        </span>
                      </button>
                      {editElectionPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditElectionPhotoUrl('')}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold cursor-pointer"
                        >
                          Clear Override
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Campaign Statement / Slogan
                    </label>
                    <input
                      type="text"
                      value={editCampaignStatement}
                      onChange={(e) => setEditCampaignStatement(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Manifesto Summary
                    </label>
                    <textarea
                      rows={2}
                      value={editManifestoSummary}
                      onChange={(e) => setEditManifestoSummary(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Full Manifesto Points (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={editFullManifestoText}
                        onChange={(e) => setEditFullManifestoText(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Key Promises (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={editKeyPromisesText}
                        onChange={(e) => setEditKeyPromisesText(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Permanent Contestant Profile Section */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-[#102A43] text-sm flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4" />
                      <span>Permanent Contestant Profile (Shared Registry)</span>
                    </h4>
                    <div>
                      <input
                        ref={permanentPhotoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) handleUploadSlot(f, 'permanent');
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingSlot === 'permanent'}
                        onClick={() => permanentPhotoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {uploadingSlot === 'permanent'
                            ? `Uploading ${uploadProgress}%...`
                            : 'Update Default Portrait'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {modifiedPermanentFields.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#E45757] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">
                            Warning: Shared Permanent Fields Changed (
                            {modifiedPermanentFields.join(', ')})
                          </div>
                          <p className="text-[11px] mt-0.5">
                            Saving updates the permanent contestant profile and propagates shared
                            identity fields across UCC VOTE while preserving vote counts and
                            election-specific overrides.
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 font-bold text-[#102A43] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmPermanentUpdate}
                          onChange={(e) => setConfirmPermanentUpdate(e.target.checked)}
                          className="rounded text-[#2563EB]"
                        />
                        <span>
                          I confirm updating the permanent contestant profile across UCC VOTE
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={permFullName}
                        onChange={(e) => setPermFullName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Student ID</label>
                      <input
                        type="text"
                        value={permStudentId}
                        onChange={(e) => setPermStudentId(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nickname</label>
                      <input
                        type="text"
                        value={permNickname}
                        onChange={(e) => setPermNickname(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Department</label>
                      <input
                        type="text"
                        value={permDepartment}
                        onChange={(e) => setPermDepartment(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Programme</label>
                      <input
                        type="text"
                        value={permProgramme}
                        onChange={(e) => setPermProgramme(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Faculty</label>
                      <input
                        type="text"
                        value={permFaculty}
                        onChange={(e) => setPermFaculty(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Level</label>
                      <select
                        value={permLevel}
                        onChange={(e) => setPermLevel(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      >
                        {UCC_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                        {!UCC_LEVELS.includes(permLevel) && permLevel && (
                          <option value={permLevel}>{permLevel}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Hall</label>
                      <select
                        value={permHall}
                        onChange={(e) => setPermHall(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      >
                        {halls.map((h) => (
                          <option key={h.id} value={h.name}>
                            {h.name}
                          </option>
                        ))}
                        {!halls.some((h) => h.name === permHall) && permHall && (
                          <option value={permHall}>{permHall}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Phone (Admin PII)
                      </label>
                      <input
                        type="tel"
                        value={permPhone}
                        onChange={(e) => setPermPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Biography</label>
                    <textarea
                      rows={2}
                      value={permBiography}
                      onChange={(e) => setPermBiography(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCandidate(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || Boolean(uploadingSlot)}
                    className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{saving ? 'Saving Changes...' : 'Save Candidate Updates'}</span>
                  </button>
                </div>
              </form>
            ) : viewingProfileEntry ? (
              /* Permanent Profile Drawer */
              <div className="p-5 rounded-2xl bg-[#F5F7FB] border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-base font-black text-[#102A43]">
                    Permanent Contestant Profile — {viewingProfileEntry.fullName}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setViewingProfileEntry(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Back to Roster
                  </button>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-4 items-start">
                  <CandidateAvatar
                    src={viewingProfileEntry.photoUrl}
                    alt={viewingProfileEntry.fullName}
                    className="w-20 h-20 rounded-2xl object-cover object-top border border-slate-200 shrink-0"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 flex-1">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Full Name
                      </span>
                      <span className="font-bold text-slate-900">
                        {viewingProfileEntry.fullName}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Student ID
                      </span>
                      <span className="font-mono font-bold text-slate-800 tabular-nums">
                        {viewingProfileEntry.studentId}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Programme &amp; Department
                      </span>
                      <span className="text-slate-800">
                        {viewingProfileEntry.programme || viewingProfileEntry.department}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Faculty &amp; Hall
                      </span>
                      <span className="text-slate-800">
                        {viewingProfileEntry.faculty} · {viewingProfileEntry.hall}
                      </span>
                    </div>
                    {viewingProfileEntry.email && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Email (Admin Only)
                        </span>
                        <span className="text-slate-800">{viewingProfileEntry.email}</span>
                      </div>
                    )}
                    {viewingProfileEntry.phone && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Phone (Admin Only)
                        </span>
                        <span className="font-mono text-slate-800">
                          {viewingProfileEntry.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {viewingProfileEntry.biography && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Biography
                    </span>
                    <p className="text-slate-700 leading-relaxed">
                      {viewingProfileEntry.biography}
                    </p>
                  </div>
                )}

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Election Participation History ({viewingProfileEntry.participations.length})
                  </span>
                  <div className="space-y-1.5">
                    {viewingProfileEntry.participations.map((p) => (
                      <div
                        key={p.candidateId}
                        className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#F5F7FB] border border-slate-200"
                      >
                        <div>
                          <div className="font-bold text-[#102A43]">{p.electionTitle}</div>
                          <div className="text-[11px] text-slate-600">{p.positionTitle}</div>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <span className="font-bold text-slate-800">{p.applicationStatus}</span>
                          {typeof p.votesReceived === 'number' && (
                            <span className="text-slate-500 ml-2 tabular-nums">
                              · {p.votesReceived} votes
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Grouped Election Candidates List */
              <div className="space-y-4">
                {electionPositions.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#F5F7FB] border border-slate-200 text-slate-600">
                    No contested positions exist in this election yet. Add positions before
                    assigning candidates.
                  </div>
                ) : (
                  electionPositions.map((pos) => {
                    const posCandidates = electionCandidates.filter(
                      (c) => c.positionId === pos.id
                    );
                    return (
                      <div
                        key={pos.id}
                        className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                      >
                        <div className="px-4 py-3 bg-[#F5F7FB] border-b border-slate-200 flex items-center justify-between">
                          <div>
                            <h4 className="font-extrabold text-[#102A43] text-sm">{pos.title}</h4>
                            {pos.description && (
                              <p className="text-[11px] text-slate-500">{pos.description}</p>
                            )}
                          </div>
                          <span className="font-mono font-bold text-[11px] text-[#102A43] bg-white px-2.5 py-1 rounded-lg border border-slate-200 tabular-nums">
                            {posCandidates.length} candidate
                            {posCandidates.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {posCandidates.length === 0 ? (
                          <div className="p-5 text-center text-slate-500">
                            No candidates assigned to {pos.title} yet.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {posCandidates.map((cand) => {
                              const removeGuard = evaluateElectionCandidateActionAllowed(
                                election,
                                'remove',
                                cand
                              );
                              const permEntry = findContestantEntry(cand);
                              return (
                                <div
                                  key={cand.id}
                                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70"
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <CandidateAvatar
                                      src={resolveCandidatePhotoUrl(cand)}
                                      alt={cand.fullName}
                                      className="w-14 h-14 rounded-xl object-cover object-top border border-slate-200 shrink-0"
                                    />
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-slate-900 text-sm">
                                          {cand.fullName}
                                        </span>
                                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                          {cand.studentId}
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold uppercase ${
                                            cand.applicationStatus === 'Approved'
                                              ? 'text-[#14B8A6]'
                                              : cand.applicationStatus === 'Rejected'
                                              ? 'text-[#E45757]'
                                              : 'text-slate-600'
                                          }`}
                                        >
                                          · {cand.applicationStatus}
                                        </span>
                                        {cand.electionPhotoUrl && (
                                          <span className="text-[10px] font-semibold text-[#2563EB]">
                                            · Election Photo Override
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-slate-600">
                                        {cand.programme || cand.department} · {cand.hall}
                                      </div>
                                      {(cand.campaignStatement || cand.manifestoSummary) && (
                                        <p className="text-[11px] text-slate-500 truncate max-w-xl">
                                          {cand.campaignStatement || cand.manifestoSummary}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    {typeof cand.votesReceived === 'number' &&
                                      cand.votesReceived > 0 && (
                                        <span className="px-2 py-1 rounded-lg bg-slate-100 font-mono font-bold text-slate-700 tabular-nums mr-1">
                                          {cand.votesReceived} votes
                                        </span>
                                      )}
                                    <button
                                      type="button"
                                      onClick={() => openEditCandidate(cand)}
                                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Edit Info / Position</span>
                                    </button>
                                    {permEntry && (
                                      <button
                                        type="button"
                                        onClick={() => setViewingProfileEntry(permEntry)}
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#102A43] font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>Permanent Profile</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={!removeGuard.allowed}
                                      title={removeGuard.reason || 'Remove from this election'}
                                      onClick={() => {
                                        setActionError('');
                                        setRemoveReason('');
                                        setCandidateToRemove(cand);
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-[#E45757] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Removal Modal */}
      {candidateToRemove && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-50 text-[#E45757]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Remove Candidate from Election?
                </h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Removing <strong>{candidateToRemove.fullName}</strong> removes their candidacy
                  strictly from <strong>{election.title}</strong>. Their permanent contestant
                  profile and history in other elections remain preserved.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800">
                {actionError}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Audit Reason (Optional)
              </label>
              <input
                type="text"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="e.g. Candidate withdrew prior to ballot opening"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => setCandidateToRemove(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={handleConfirmRemove}
                className="px-4 py-2 rounded-xl bg-[#E45757] hover:bg-red-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {removing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{removing ? 'Removing...' : 'Confirm Remove from Election'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contestant Selector Modal (Live mode) */}
      <ContestantSelectorModal
        isOpen={selectorOpen}
        mode="live"
        election={election}
        electionTitle={election.title}
        electionCategory={election.category}
        livePositions={electionPositions}
        existingCandidates={electionCandidates}
        initialTab={selectorTab}
        onClose={() => setSelectorOpen(false)}
        onLiveCandidatesAdded={async (_added, msg) => {
          await Promise.all([refreshCandidates(), refreshElections()]);
          onSuccessToast(msg);
        }}
      />
    </>
  );
};
