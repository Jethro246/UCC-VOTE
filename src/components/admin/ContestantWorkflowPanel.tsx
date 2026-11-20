import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  Mail,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  Candidate,
  CandidateApplicationStatus,
  ContestantPermanentFields,
  DomainId,
  ElectionCategory,
} from '../../types';
import {
  AddContestantToElectionInput,
  DerivedContestantRecord,
} from '../../services/interfaces';
import { useApp } from '../../context/AppContext';
import { CandidateAvatar } from '../common/CandidateAvatar';
import {
  startCandidatePhotoUpload,
  UploadTaskHandle,
  validateCandidateImageFile,
} from '../../services/firebaseStorageService';
import {
  diffPermanentProfileFields,
  findDuplicateContestant,
  findDuplicateParticipationInElection,
  normalizeStudentIdKey,
  searchContestants,
} from '../../utils/contestantUtils';
import { NON_RESIDENT_HALL_LABEL, getHallDisplayName } from '../../utils/hallUtils';
import { formatPercentage } from '../../utils/numberFormat';

export interface ElectionPositionOption {
  id: string;
  title: string;
  description?: string;
  index: number;
}

export interface StagedContestantDraft {
  draftId: string;
  mode: 'existing' | 'new';
  contestantId?: string;
  sourceCandidateId?: string;
  positionIndex: number;
  positionKey: string;
  permanentProfile: ContestantPermanentFields;
  permanentProfileEdited: boolean;
  confirmedPermanentEdit: boolean;
  electionSpecific: {
    campaignStatement: string;
    manifestoSummary: string;
    fullManifesto: string[];
    keyPromises: string[];
    videoUrl?: string;
    electionPhotoUrl?: string;
    usesCustomElectionPhoto: boolean;
    applicationStatus: CandidateApplicationStatus;
  };
}

interface ContestantWorkflowPanelProps {
  mode: 'staged' | 'live';
  electionContext: {
    id?: string;
    title: string;
    category: ElectionCategory;
    domainId?: DomainId;
    subdomainLabel?: string;
  };
  positions: ElectionPositionOption[];
  // Staged mode props (used inside CreateElectionModal Step 5)
  stagedCandidates?: StagedContestantDraft[];
  onAddStagedCandidate?: (draft: StagedContestantDraft) => void;
  onUpdateStagedCandidate?: (draftId: string, draft: StagedContestantDraft) => void;
  onRemoveStagedCandidate?: (draftId: string) => void;
  // Live mode props (used inside ElectionCandidatesModal after election creation)
  existingElectionCandidates?: Candidate[];
  onLiveCommitted?: (candidate: Candidate) => void;
  initialView?: 'hub' | 'search_existing' | 'register_new';
  onCloseFlow?: () => void;
}

type WorkflowView =
  | 'hub'
  | 'search_existing'
  | 'register_new'
  | 'configure_edit'
  | 'preview';

interface QueueItem {
  draftId?: string;
  mode: 'existing' | 'new';
  contestantId?: string;
  sourceCandidateId?: string;
  originalPermanent?: ContestantPermanentFields;
  permanent: ContestantPermanentFields;
  confirmedPermanentEdit: boolean;
  positionKey: string;
  campaignStatement: string;
  manifestoSummary: string;
  fullManifestoText: string;
  keyPromisesText: string;
  videoUrl: string;
  usesCustomElectionPhoto: boolean;
  electionPhotoUrl: string;
  applicationStatus: CandidateApplicationStatus;
}

function permanentFieldsFromDerived(c: DerivedContestantRecord): ContestantPermanentFields {
  return {
    fullName: c.fullName || '',
    studentId: c.studentId || '',
    nickname: c.nickname || '',
    email: c.email || '',
    phone: c.phone || '',
    department: c.department || '',
    faculty: c.faculty || '',
    programme: c.programme || '',
    level: c.level || '300',
    hall: c.hall || '',
    hallId: c.hallId,
    photoUrl: c.photoUrl || '',
    photoStoragePath: c.photoStoragePath,
    biography: c.biography || '',
    leadershipExperience: Array.isArray(c.leadershipExperience)
      ? [...c.leadershipExperience]
      : [],
  };
}

export const ContestantWorkflowPanel: React.FC<ContestantWorkflowPanelProps> = ({
  mode,
  electionContext,
  positions,
  stagedCandidates = [],
  onAddStagedCandidate,
  onUpdateStagedCandidate,
  onRemoveStagedCandidate,
  existingElectionCandidates = [],
  onLiveCommitted,
  initialView = 'hub',
  onCloseFlow,
}) => {
  const {
    contestants,
    elections,
    positionsByElection,
    halls,
    faculties,
    addContestantToElectionAction,
    refreshCandidates,
  } = useApp();

  const [view, setView] = useState<WorkflowView>(initialView);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [changingPositionInline, setChangingPositionInline] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Photo upload state for Permanent or Election-specific photo
  const [uploadingTarget, setUploadingTarget] = useState<'permanent' | 'election' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const activeUploadRef = useRef<UploadTaskHandle | null>(null);

  const electionMap = useMemo(() => {
    const m = new Map<string, (typeof elections)[number]>();
    elections.forEach((e) => m.set(e.id, e));
    return m;
  }, [elections]);

  const positionTitleLookup = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(positionsByElection).forEach((list) => {
      list.forEach((p) => m.set(p.id, p.title));
    });
    positions.forEach((p) => m.set(p.id, p.title));
    return m;
  }, [positionsByElection, positions]);

  const filteredExistingContestants = useMemo(
    () => searchContestants(contestants, searchQuery),
    [contestants, searchQuery]
  );

  // Check if contestant is already in the current target election (either staged or live)
  const isAlreadyInThisElection = (c: DerivedContestantRecord): boolean => {
    const normSid = normalizeStudentIdKey(c.studentId);
    if (mode === 'live') {
      return existingElectionCandidates.some(
        (ec) =>
          (ec.contestantId && ec.contestantId === c.id) ||
          (normSid && normalizeStudentIdKey(ec.studentId) === normSid)
      );
    }
    return stagedCandidates.some(
      (sc) =>
        (sc.contestantId && sc.contestantId === c.id) ||
        (normSid && normalizeStudentIdKey(sc.permanentProfile.studentId) === normSid)
    );
  };

  const currentItem = queue[queueIdx] || null;

  const updateCurrentItem = (updater: (prev: QueueItem) => QueueItem) => {
    setQueue((prev) => prev.map((it, idx) => (idx === queueIdx ? updater(it) : it)));
  };

  const permanentChangedFields = useMemo(() => {
    if (!currentItem || currentItem.mode !== 'existing' || !currentItem.originalPermanent) {
      return [];
    }
    return diffPermanentProfileFields(currentItem.originalPermanent, currentItem.permanent);
  }, [currentItem]);

  const duplicateForNewProfile = useMemo(() => {
    if (!currentItem || currentItem.mode !== 'new') return null;
    if (!currentItem.permanent.studentId.trim() && !currentItem.permanent.email?.trim()) {
      return null;
    }
    return findDuplicateContestant(contestants, {
      studentId: currentItem.permanent.studentId,
      email: currentItem.permanent.email,
    });
  }, [currentItem, contestants]);

  const startNewRegistration = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setUploadError('');
    const defaultPos = positions[0]?.id || '';
    const emptyPerm: ContestantPermanentFields = {
      fullName: '',
      studentId: '',
      nickname: '',
      email: '',
      phone: '',
      department: '',
      faculty: faculties[0]?.name || '',
      programme: '',
      level: electionContext.domainId === 'grasag' ? 'Postgraduate' : '300',
      hall: halls[0]?.name || 'Casely Hayford Hall',
      photoUrl: '',
      biography: '',
      leadershipExperience: [],
    };
    setQueue([
      {
        mode: 'new',
        permanent: emptyPerm,
        confirmedPermanentEdit: true,
        positionKey: defaultPos,
        campaignStatement: '',
        manifestoSummary: '',
        fullManifestoText: '',
        keyPromisesText: '',
        videoUrl: '',
        usesCustomElectionPhoto: false,
        electionPhotoUrl: '',
        applicationStatus: 'Approved',
      },
    ]);
    setQueueIdx(0);
    setView('register_new');
  };

  const startEditStaged = (draft: StagedContestantDraft) => {
    setErrorMsg('');
    setSuccessMsg('');
    setQueue([
      {
        draftId: draft.draftId,
        mode: draft.mode,
        contestantId: draft.contestantId,
        sourceCandidateId: draft.sourceCandidateId,
        originalPermanent:
          draft.mode === 'existing'
            ? (() => {
                const found = contestants.find((c) => c.id === draft.contestantId);
                return found ? permanentFieldsFromDerived(found) : { ...draft.permanentProfile };
              })()
            : undefined,
        permanent: { ...draft.permanentProfile },
        confirmedPermanentEdit: draft.confirmedPermanentEdit,
        positionKey: draft.positionKey || positions[draft.positionIndex]?.id || positions[0]?.id || '',
        campaignStatement: draft.electionSpecific.campaignStatement,
        manifestoSummary: draft.electionSpecific.manifestoSummary,
        fullManifestoText: draft.electionSpecific.fullManifesto.join('\n'),
        keyPromisesText: draft.electionSpecific.keyPromises.join('\n'),
        videoUrl: draft.electionSpecific.videoUrl || '',
        usesCustomElectionPhoto: draft.electionSpecific.usesCustomElectionPhoto,
        electionPhotoUrl: draft.electionSpecific.electionPhotoUrl || '',
        applicationStatus: draft.electionSpecific.applicationStatus,
      },
    ]);
    setQueueIdx(0);
    setView('configure_edit');
  };

  const toggleSelectExisting = (id: string) => {
    setSelectedExistingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const proceedWithSelectedExisting = (overrideIds?: string[]) => {
    setErrorMsg('');
    setSuccessMsg('');
    const ids = overrideIds ?? selectedExistingIds;
    if (ids.length === 0) {
      setErrorMsg('Select at least one existing contestant to add to this election.');
      return;
    }
    if (positions.length === 0) {
      setErrorMsg('Configure at least one contested position before assigning contestants.');
      return;
    }

    const items: QueueItem[] = [];
    for (const id of ids) {
      const c = contestants.find((x) => x.id === id);
      if (!c) continue;
      const perm = permanentFieldsFromDerived(c);
      items.push({
        mode: 'existing',
        contestantId: c.id,
        sourceCandidateId: c.sourceCandidateIds[0],
        originalPermanent: { ...perm, leadershipExperience: [...perm.leadershipExperience] },
        permanent: perm,
        confirmedPermanentEdit: false,
        positionKey: positions[0]?.id || '',
        campaignStatement: '',
        manifestoSummary: '',
        fullManifestoText: '',
        keyPromisesText: '',
        videoUrl: '',
        usesCustomElectionPhoto: false,
        electionPhotoUrl: '',
        applicationStatus: 'Approved',
      });
    }

    if (items.length === 0) return;
    setQueue(items);
    setQueueIdx(0);
    setView('configure_edit');
  };

  const switchNewToExisting = (dup: DerivedContestantRecord) => {
    setErrorMsg('');
    const perm = permanentFieldsFromDerived(dup);
    setQueue([
      {
        mode: 'existing',
        contestantId: dup.id,
        sourceCandidateId: dup.sourceCandidateIds[0],
        originalPermanent: { ...perm, leadershipExperience: [...perm.leadershipExperience] },
        permanent: perm,
        confirmedPermanentEdit: false,
        positionKey: currentItem?.positionKey || positions[0]?.id || '',
        campaignStatement: currentItem?.campaignStatement || '',
        manifestoSummary: currentItem?.manifestoSummary || '',
        fullManifestoText: currentItem?.fullManifestoText || '',
        keyPromisesText: currentItem?.keyPromisesText || '',
        videoUrl: currentItem?.videoUrl || '',
        usesCustomElectionPhoto: currentItem?.usesCustomElectionPhoto || false,
        electionPhotoUrl: currentItem?.electionPhotoUrl || '',
        applicationStatus: currentItem?.applicationStatus || 'Approved',
      },
    ]);
    setQueueIdx(0);
    setView('configure_edit');
  };

  const handlePhotoUpload = async (file: File, target: 'permanent' | 'election') => {
    setUploadError('');
    const validation = await validateCandidateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      return;
    }
    if (activeUploadRef.current) {
      activeUploadRef.current.cancel();
    }
    setUploadingTarget(target);
    setUploadProgress(0);

    const key =
      currentItem?.contestantId ||
      normalizeStudentIdKey(currentItem?.permanent.studentId) ||
      `cont_${Date.now()}`;
    const handle = startCandidatePhotoUpload(file, `${key}_${target}`, (pct) =>
      setUploadProgress(pct)
    );
    activeUploadRef.current = handle;

    try {
      const uploaded = await handle.promise;
      if (!uploaded?.url || !uploaded.url.startsWith('http')) {
        throw new Error('Firebase Storage returned an invalid URL.');
      }
      if (target === 'permanent') {
        updateCurrentItem((prev) => ({
          ...prev,
          permanent: {
            ...prev.permanent,
            photoUrl: uploaded.url,
            photoStoragePath: uploaded.path,
          },
        }));
      } else {
        updateCurrentItem((prev) => ({
          ...prev,
          usesCustomElectionPhoto: true,
          electionPhotoUrl: uploaded.url,
        }));
      }
      setUploadProgress(100);
    } catch (err: any) {
      setUploadError(err?.message || 'Photo upload failed.');
      setUploadProgress(null);
    } finally {
      activeUploadRef.current = null;
      setUploadingTarget(null);
    }
  };

  const validateCurrentForPreview = (): boolean => {
    setErrorMsg('');
    if (!currentItem) return false;
    if (uploadingTarget) {
      setErrorMsg('Please wait for the portrait upload to finish before continuing.');
      return false;
    }
    if (!currentItem.permanent.fullName.trim() || !currentItem.permanent.studentId.trim()) {
      setErrorMsg('Contestant Full Name and Student ID are required.');
      return false;
    }
    if (!currentItem.permanent.department.trim() || !currentItem.permanent.faculty.trim()) {
      setErrorMsg('Faculty and Department are required.');
      return false;
    }
    if (!currentItem.positionKey || !positions.some((p) => p.id === currentItem.positionKey)) {
      setErrorMsg('Select a valid contested position belonging to this election.');
      return false;
    }
    if (currentItem.mode === 'new' && duplicateForNewProfile) {
      setErrorMsg(
        `Duplicate contestant detected: ${duplicateForNewProfile.fullName} (${duplicateForNewProfile.studentId}) already exists. Switch to their existing profile instead of creating a duplicate.`
      );
      return false;
    }
    if (
      currentItem.mode === 'existing' &&
      permanentChangedFields.length > 0 &&
      !currentItem.confirmedPermanentEdit
    ) {
      setErrorMsg(
        'Please confirm the permanent profile update warning checkbox before proceeding, or revert your permanent profile edits.'
      );
      return false;
    }

    // Check duplicate assignment in staged/live candidates
    const normSid = normalizeStudentIdKey(currentItem.permanent.studentId);
    if (mode === 'live') {
      const dup = findDuplicateParticipationInElection(
        existingElectionCandidates,
        electionContext.id || '',
        currentItem.positionKey,
        currentItem.contestantId,
        currentItem.permanent.studentId
      );
      if (dup.isSamePositionDuplicate) {
        setErrorMsg(
          `${currentItem.permanent.fullName} is already assigned to this position in this election.`
        );
        return false;
      }
      if (dup.existingSameElection) {
        setErrorMsg(
          `${currentItem.permanent.fullName} is already contesting another position in this election.`
        );
        return false;
      }
    } else {
      const otherStaged = stagedCandidates.filter((s) => s.draftId !== currentItem.draftId);
      const conflictSamePos = otherStaged.find(
        (s) =>
          s.positionKey === currentItem.positionKey &&
          ((currentItem.contestantId && s.contestantId === currentItem.contestantId) ||
            (normSid && normalizeStudentIdKey(s.permanentProfile.studentId) === normSid))
      );
      if (conflictSamePos) {
        setErrorMsg(
          `${currentItem.permanent.fullName} is already staged for this position.`
        );
        return false;
      }
      const conflictSameElection = otherStaged.find(
        (s) =>
          (currentItem.contestantId && s.contestantId === currentItem.contestantId) ||
          (normSid && normalizeStudentIdKey(s.permanentProfile.studentId) === normSid)
      );
      if (conflictSameElection) {
        setErrorMsg(
          `${currentItem.permanent.fullName} is already staged in this election under another position.`
        );
        return false;
      }
    }

    return true;
  };

  const handleConfirmCandidate = async () => {
    if (!currentItem) return;
    if (!validateCurrentForPreview()) return;
    setErrorMsg('');

    const fullManifesto = currentItem.fullManifestoText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const keyPromises = currentItem.keyPromisesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const targetPos = positions.find((p) => p.id === currentItem.positionKey)!;

    if (mode === 'staged') {
      const draft: StagedContestantDraft = {
        draftId:
          currentItem.draftId ||
          `staged_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode: currentItem.mode,
        contestantId: currentItem.contestantId,
        sourceCandidateId: currentItem.sourceCandidateId,
        positionIndex: targetPos.index,
        positionKey: targetPos.id,
        permanentProfile: { ...currentItem.permanent },
        permanentProfileEdited: permanentChangedFields.length > 0,
        confirmedPermanentEdit: currentItem.confirmedPermanentEdit,
        electionSpecific: {
          campaignStatement: currentItem.campaignStatement.trim(),
          manifestoSummary: currentItem.manifestoSummary.trim(),
          fullManifesto,
          keyPromises,
          videoUrl: currentItem.videoUrl.trim() || undefined,
          electionPhotoUrl: currentItem.usesCustomElectionPhoto
            ? currentItem.electionPhotoUrl.trim()
            : undefined,
          usesCustomElectionPhoto: currentItem.usesCustomElectionPhoto,
          applicationStatus: currentItem.applicationStatus,
        },
      };

      if (currentItem.draftId && onUpdateStagedCandidate) {
        onUpdateStagedCandidate(currentItem.draftId, draft);
      } else if (onAddStagedCandidate) {
        onAddStagedCandidate(draft);
      }

      if (queueIdx < queue.length - 1) {
        setQueueIdx((idx) => idx + 1);
        setView('configure_edit');
        setSuccessMsg(`${currentItem.permanent.fullName} staged. Configure next selected contestant below.`);
      } else {
        setSelectedExistingIds([]);
        setQueue([]);
        setQueueIdx(0);
        setView('hub');
        setSuccessMsg(
          `${currentItem.permanent.fullName} staged for "${targetPos.title}". Click "Provision & Save Election" when ready to save to Firestore.`
        );
      }
      return;
    }

    // LIVE MODE: Persist immediately to Cloud Firestore and wait for DB confirmation
    if (!electionContext.id) {
      setErrorMsg('Missing target election ID.');
      return;
    }

    setSaving(true);
    const payload: AddContestantToElectionInput = {
      mode: currentItem.mode,
      electionId: electionContext.id,
      contestantId: currentItem.contestantId,
      sourceCandidateId: currentItem.sourceCandidateId,
      permanentProfile: currentItem.permanent,
      permanentProfileEdited: permanentChangedFields.length > 0,
      confirmedPermanentEdit:
        currentItem.mode === 'new' ? true : currentItem.confirmedPermanentEdit,
      electionSpecific: {
        positionId: targetPos.id,
        campaignStatement: currentItem.campaignStatement.trim(),
        manifestoSummary: currentItem.manifestoSummary.trim(),
        fullManifesto,
        keyPromises,
        videoUrl: currentItem.videoUrl.trim() || undefined,
        electionPhotoUrl: currentItem.usesCustomElectionPhoto
          ? currentItem.electionPhotoUrl.trim()
          : undefined,
        usesCustomElectionPhoto: currentItem.usesCustomElectionPhoto,
        applicationStatus: currentItem.applicationStatus,
      },
    };

    const res = await addContestantToElectionAction(payload);
    setSaving(false);

    if (!res.success || !res.candidate) {
      setErrorMsg(res.error || 'Firestore rejected candidate assignment.');
      return;
    }

    await refreshCandidates();
    onLiveCommitted?.(res.candidate);

    if (queueIdx < queue.length - 1) {
      setQueueIdx((idx) => idx + 1);
      setView('configure_edit');
      setSuccessMsg(
        `Confirmed: ${currentItem.permanent.fullName} saved to Firestore under "${targetPos.title}". Configure next contestant below.`
      );
    } else {
      setSelectedExistingIds([]);
      setQueue([]);
      setQueueIdx(0);
      setSuccessMsg(
        `Confirmed: ${currentItem.permanent.fullName} saved to "${targetPos.title}" in Cloud Firestore.`
      );
      setView('hub');
    }
  };

  const handleRemoveFromQueueOrCancel = () => {
    setErrorMsg('');
    if (currentItem?.draftId && onRemoveStagedCandidate) {
      onRemoveStagedCandidate(currentItem.draftId);
    }
    if (queue.length > 1 && queueIdx < queue.length - 1) {
      const remaining = queue.filter((_, idx) => idx !== queueIdx);
      setQueue(remaining);
      setView('configure_edit');
    } else {
      setQueue([]);
      setQueueIdx(0);
      setView('hub');
    }
  };

  const selectedPreviewPhoto = currentItem
    ? currentItem.usesCustomElectionPhoto && currentItem.electionPhotoUrl
      ? currentItem.electionPhotoUrl
      : currentItem.permanent.photoUrl
    : '';

  const currentAssignedPosition = positions.find((p) => p.id === currentItem?.positionKey);

  return (
    <div className="space-y-4 ucc-body-secondary">
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-[#E45757]/10 border border-[#E45757]/40 text-[#9B1C1C] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#E45757] shrink-0 mt-0.5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/40 text-[#0F766E] flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* VIEW 1: HUB */}
      {view === 'hub' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#F5F7FB] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#102A43] ucc-heading-card">
                <Users className="w-4 h-4 text-[#2563EB]" />
                <span>Candidate &amp; Contestant Assignment</span>
              </div>
              <p className="ucc-body-secondary text-slate-600 max-w-xl">
                Select existing contestants already registered in UCC VOTE or register a new contestant profile, assign them to a specific position in{' '}
                <strong className="text-[#102A43] font-semibold">{electionContext.title || 'this election'}</strong>, and review their details before confirming.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setView('search_existing');
                }}
                disabled={positions.length === 0}
                className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white ucc-btn font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Add Existing Contestant</span>
              </button>

              <button
                type="button"
                onClick={startNewRegistration}
                disabled={positions.length === 0}
                className="px-4 py-2.5 rounded-xl bg-[#102A43] hover:bg-slate-900 text-white ucc-btn font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Register New Contestant</span>
              </button>
            </div>
          </div>

          {positions.length === 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Add at least one contested portfolio first before assigning candidates.</span>
            </div>
          )}

          {mode === 'staged' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-[#102A43] uppercase tracking-wider ucc-caption tabular-nums">
                  Staged Candidates Ready to Provision ({stagedCandidates.length})
                </h4>
                {stagedCandidates.length === 0 && (
                  <span className="ucc-caption text-slate-500">
                    Optional during initial creation — you can also add candidates anytime afterward.
                  </span>
                )}
              </div>

              {stagedCandidates.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {stagedCandidates.map((sc) => {
                    const pos = positions.find((p) => p.id === sc.positionKey) || positions[sc.positionIndex];
                    const photo =
                      sc.electionSpecific.usesCustomElectionPhoto && sc.electionSpecific.electionPhotoUrl
                        ? sc.electionSpecific.electionPhotoUrl
                        : sc.permanentProfile.photoUrl;
                    return (
                      <div
                        key={sc.draftId}
                        className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CandidateAvatar
                            src={photo}
                            alt={sc.permanentProfile.fullName}
                            className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-[#102A43] truncate">
                                {sc.permanentProfile.fullName}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-[#2563EB]/10 text-[#2563EB] font-semibold ucc-caption">
                                {pos ? pos.title : 'Position Unassigned'}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-[#14B8A6]/15 text-[#0F766E] font-semibold ucc-caption">
                                {sc.electionSpecific.applicationStatus}
                              </span>
                              {sc.permanentProfileEdited && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold ucc-caption">
                                  Permanent Profile Update Confirmed
                                </span>
                              )}
                            </div>
                            <p className="ucc-caption text-slate-500 truncate mt-0.5">
                              <span className="tabular-nums">{sc.permanentProfile.studentId}</span> ·{' '}
                              {sc.permanentProfile.department}
                              {sc.permanentProfile.hall ? ` · ${sc.permanentProfile.hall}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditStaged(sc)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[#102A43] ucc-caption font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveStagedCandidate?.(sc.draftId)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#E45757]/10 hover:bg-[#E45757]/20 text-[#E45757] ucc-caption font-semibold flex items-center gap-1 cursor-pointer"
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
          )}

          {mode === 'live' && onCloseFlow && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onCloseFlow}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 ucc-btn font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Back to Election Candidate Roster
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SEARCH & SELECT EXISTING CONTESTANTS */}
      {view === 'search_existing' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setView('hub');
                setErrorMsg('');
              }}
              className="inline-flex items-center gap-1.5 ucc-btn font-semibold text-[#102A43] hover:text-[#2563EB] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="text-right">
              <h4 className="ucc-heading-card text-[#102A43] tabular-nums">
                Select Existing Contestants ({contestants.length} in database)
              </h4>
              <p className="ucc-caption text-slate-500">
                Select one or multiple contestants without re-registering them.
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by full name, student ID, department, programme, faculty, or hall..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-[#F5F7FB] focus:bg-white focus:outline-none focus:border-[#2563EB] text-slate-900"
            />
          </div>

          {selectedExistingIds.length > 0 && (
            <div className="p-3 rounded-xl bg-[#2563EB]/5 border border-[#2563EB]/30 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-[#102A43] mr-1 tabular-nums">
                  Selected ({selectedExistingIds.length}):
                </span>
                {selectedExistingIds.map((id) => {
                  const found = contestants.find((c) => c.id === id);
                  if (!found) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2563EB] text-white font-semibold ucc-caption"
                    >
                      <span>{found.fullName}</span>
                      <button
                        type="button"
                        onClick={() => toggleSelectExisting(id)}
                        className="hover:text-blue-200 cursor-pointer"
                        aria-label={`Deselect ${found.fullName}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => proceedWithSelectedExisting()}
                className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <span>Assign &amp; Configure Selected</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {filteredExistingContestants.length === 0 ? (
              <div className="col-span-full p-8 text-center rounded-2xl bg-[#F5F7FB] border border-slate-200 space-y-2">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-semibold text-[#102A43]">No matching contestants found</p>
                <p className="ucc-caption text-slate-500">
                  Adjust your search terms or register a brand new contestant profile.
                </p>
                <button
                  type="button"
                  onClick={startNewRegistration}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#102A43] text-white ucc-btn font-semibold cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register New Contestant</span>
                </button>
              </div>
            ) : (
              filteredExistingContestants.map((c) => {
                const isSelected = selectedExistingIds.includes(c.id);
                const alreadyAdded = isAlreadyInThisElection(c);
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (!alreadyAdded) toggleSelectExisting(c.id);
                    }}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                      alreadyAdded
                        ? 'bg-slate-50 border-slate-200 opacity-65 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#2563EB]/5 border-[#2563EB] ring-2 ring-[#2563EB]/20 cursor-pointer'
                        : 'bg-white border-slate-200 hover:border-[#2563EB]/50 cursor-pointer'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <CandidateAvatar
                        src={c.photoUrl}
                        alt={c.fullName}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                      />
                      <span
                        className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-md border flex items-center justify-center ${
                          alreadyAdded
                            ? 'bg-slate-300 border-slate-400 text-white'
                            : isSelected
                            ? 'bg-[#2563EB] border-[#2563EB] text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h5 className="font-semibold text-[#102A43] truncate">{c.fullName}</h5>
                          <div className="ucc-caption tabular-nums text-slate-500">
                            {c.studentId || 'Student ID not verified'}
                          </div>
                        </div>
                        {alreadyAdded && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-semibold ucc-caption shrink-0">
                            Already Added
                          </span>
                        )}
                      </div>

                      <div className="ucc-caption text-slate-600 truncate">
                        {c.programme ? `${c.programme} · ` : ''}
                        {c.department}
                      </div>
                      <div className="ucc-caption text-slate-500 truncate">
                        {c.faculty} · {c.hall || 'Hall not specified'}
                      </div>

                      {c.participations.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-1">
                          {c.participations.slice(0, 2).map((p) => {
                            const el = electionMap.get(p.electionId);
                            const posName = positionTitleLookup.get(p.positionId) || p.positionId;
                            return (
                              <span
                                key={p.candidateId}
                                className="px-1.5 py-0.5 rounded bg-[#F5F7FB] border border-slate-200 ucc-caption text-slate-700 truncate max-w-[220px]"
                              >
                                {el?.code || p.electionId}: {posName}
                              </span>
                            );
                          })}
                          {c.participations.length > 2 && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 ucc-caption text-slate-600 font-semibold">
                              +{c.participations.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 3 & 4: REGISTER NEW OR CONFIGURE & EDIT SELECTED CONTESTANT */}
      {(view === 'register_new' || view === 'configure_edit') && currentItem && (
        <div className="space-y-5">
          {/* Top navigation & queue bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setView(currentItem.mode === 'existing' ? 'search_existing' : 'hub');
              }}
              className="inline-flex items-center gap-1.5 ucc-btn font-semibold text-[#102A43] hover:text-[#2563EB] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>
                {currentItem.mode === 'existing'
                  ? 'Back to Contestant Search'
                  : 'Back to Contestant Options'}
              </span>
            </button>

            {queue.length > 1 && (
              <div className="flex items-center gap-2 ucc-caption font-semibold tabular-nums text-[#2563EB] bg-[#2563EB]/10 px-3 py-1 rounded-lg">
                <span>
                  Configuring {queueIdx + 1} of {queue.length}: {currentItem.permanent.fullName}
                </span>
              </div>
            )}
          </div>

          {/* Duplicate detection alert for New Contestant registration */}
          {currentItem.mode === 'new' && duplicateForNewProfile && (
            <div className="p-4 rounded-2xl bg-[#E45757]/10 border border-[#E45757]/50 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-[#E45757] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-semibold text-[#9B1C1C]">
                    Duplicate Contestant Profile Detected
                  </h5>
                  <p className="ucc-body-secondary text-[#9B1C1C]/90">
                    A permanent contestant record already exists for{' '}
                    <strong className="font-semibold">{duplicateForNewProfile.fullName}</strong> (
                    <code className="tabular-nums">{duplicateForNewProfile.studentId}</code> ·{' '}
                    {duplicateForNewProfile.department}). Select their existing record instead of creating a duplicate contestant.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => switchNewToExisting(duplicateForNewProfile)}
                className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white ucc-btn font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Switch to Existing Profile ({duplicateForNewProfile.fullName})</span>
              </button>
            </div>
          )}

          {/* CARD A: ELECTION-SPECIFIC POSITION & CAMPAIGN DETAILS */}
          <div className="rounded-2xl border border-[#2563EB]/30 bg-white overflow-hidden shadow-xs">
            <div className="bg-[#2563EB] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <Award className="w-4 h-4" />
                <span>1. Election Assignment &amp; Election-Specific Details</span>
              </div>
              <span className="ucc-caption bg-white/15 px-2 py-0.5 rounded font-semibold">
                Applies ONLY to {electionContext.title || 'this election'}
              </span>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Assigned Position in This Election <span className="text-[#E45757]">*</span>
                  </label>
                  <select
                    value={currentItem.positionKey}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({ ...prev, positionKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-[#102A43] focus:outline-none focus:border-[#2563EB]"
                  >
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Ballot Approval Status
                  </label>
                  <select
                    value={currentItem.applicationStatus}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        applicationStatus: e.target.value as CandidateApplicationStatus,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-[#102A43] focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="Approved">Approved (Active on Digital Ballot)</option>
                    <option value="Submitted">Submitted (Pending Vetting Review)</option>
                    <option value="Draft">Draft (Admin Staging)</option>
                  </select>
                </div>
              </div>

              {/* Election-Specific Portrait Option */}
              <div className="p-3 rounded-xl bg-[#F5F7FB] border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="ucc-label font-semibold text-[#102A43] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Portrait for This Election</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!currentItem.usesCustomElectionPhoto}
                        onChange={() =>
                          updateCurrentItem((prev) => ({
                            ...prev,
                            usesCustomElectionPhoto: false,
                          }))
                        }
                      />
                      <span>Use permanent portrait</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={currentItem.usesCustomElectionPhoto}
                        onChange={() =>
                          updateCurrentItem((prev) => ({
                            ...prev,
                            usesCustomElectionPhoto: true,
                          }))
                        }
                      />
                      <span>Upload election-specific portrait</span>
                    </label>
                  </div>
                </div>

                {currentItem.usesCustomElectionPhoto && (
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                    <CandidateAvatar
                      src={currentItem.electionPhotoUrl}
                      alt={currentItem.permanent.fullName || 'Election portrait'}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-300 shrink-0"
                    />
                    <div className="flex-1 space-y-1.5 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white ucc-btn font-semibold cursor-pointer hover:bg-blue-700">
                          {uploadingTarget === 'election' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {uploadingTarget === 'election'
                              ? `Uploading ${formatPercentage(uploadProgress ?? 0)}...`
                              : 'Choose Election Portrait'}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={Boolean(uploadingTarget)}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (f) handlePhotoUpload(f, 'election');
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <input
                        type="url"
                        value={currentItem.electionPhotoUrl}
                        onChange={(e) =>
                          updateCurrentItem((prev) => ({
                            ...prev,
                            electionPhotoUrl: e.target.value,
                          }))
                        }
                        placeholder="Or paste election-specific image URL..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Campaign Statement (Election-Specific)
                  </label>
                  <input
                    type="text"
                    value={currentItem.campaignStatement}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        campaignStatement: e.target.value,
                      }))
                    }
                    placeholder="e.g. Putting Student Welfare & Digital Innovation First"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Manifesto Summary / Core Slogan
                  </label>
                  <input
                    type="text"
                    value={currentItem.manifestoSummary}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        manifestoSummary: e.target.value,
                      }))
                    }
                    placeholder="1-2 sentence vision statement for this race"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Detailed Manifesto Pillars (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={currentItem.fullManifestoText}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        fullManifestoText: e.target.value,
                      }))
                    }
                    placeholder="Expand shuttle access across campus&#10;Launch academic peer tutoring hubs"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Key Promises (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={currentItem.keyPromisesText}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        keyPromisesText: e.target.value,
                      }))
                    }
                    placeholder="Quarterly open budget townhalls&#10;24/7 reading room Wi-Fi upgrade"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block ucc-label font-semibold text-[#102A43] mb-1 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Campaign Video URL (Optional)</span>
                </label>
                <input
                  type="url"
                  value={currentItem.videoUrl}
                  onChange={(e) =>
                    updateCurrentItem((prev) => ({ ...prev, videoUrl: e.target.value }))
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
          </div>

          {/* CARD B: PERMANENT CONTESTANT PROFILE */}
          <div className="rounded-2xl border border-[#102A43]/25 bg-white overflow-hidden shadow-xs">
            <div className="bg-[#102A43] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
                <span>2. Permanent Contestant Profile</span>
              </div>
              <span className="ucc-caption bg-white/15 px-2 py-0.5 rounded font-semibold">
                {currentItem.mode === 'existing'
                  ? 'Shared master record across all elections'
                  : 'Creates permanent reusable contestant record'}
              </span>
            </div>

            <div className="p-4 space-y-4">
              {currentItem.mode === 'existing' && permanentChangedFields.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#E45757]/10 border border-[#E45757]/50 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#E45757] shrink-0 mt-0.5" />
                      <div className="text-[#9B1C1C]">
                        <p className="font-semibold">
                          Shared Permanent Profile Modification Warning
                        </p>
                        <p className="ucc-caption mt-0.5">
                          You modified: <strong className="font-semibold">{permanentChangedFields.join(', ')}</strong>. Saving will update this contestant&apos;s permanent profile everywhere they appear in UCC VOTE.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateCurrentItem((prev) => ({
                          ...prev,
                          permanent: prev.originalPermanent
                            ? {
                                ...prev.originalPermanent,
                                leadershipExperience: [
                                  ...prev.originalPermanent.leadershipExperience,
                                ],
                              }
                            : prev.permanent,
                          confirmedPermanentEdit: false,
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold ucc-caption hover:bg-slate-50 cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Revert</span>
                    </button>
                  </div>

                  <label className="flex items-center gap-2 font-semibold text-[#9B1C1C] cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={currentItem.confirmedPermanentEdit}
                      onChange={(e) =>
                        updateCurrentItem((prev) => ({
                          ...prev,
                          confirmedPermanentEdit: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      I confirm updating the permanent contestant profile across all linked records.
                    </span>
                  </label>
                </div>
              )}

              {/* Permanent Portrait */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl bg-[#F5F7FB] border border-slate-200">
                <CandidateAvatar
                  src={currentItem.permanent.photoUrl}
                  alt={currentItem.permanent.fullName || 'Contestant portrait'}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#102A43] shrink-0"
                />
                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#102A43] hover:bg-slate-900 text-white ucc-btn font-semibold cursor-pointer">
                      {uploadingTarget === 'permanent' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {uploadingTarget === 'permanent'
                          ? `Uploading ${formatPercentage(uploadProgress ?? 0)}...`
                          : 'Upload Permanent Portrait'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={Boolean(uploadingTarget)}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) handlePhotoUpload(f, 'permanent');
                        }}
                        className="hidden"
                      />
                    </label>
                    {uploadError && (
                      <span className="ucc-caption text-[#E45757] font-semibold">
                        {uploadError}
                      </span>
                    )}
                  </div>
                  <input
                    type="url"
                    value={currentItem.permanent.photoUrl}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, photoUrl: e.target.value },
                      }))
                    }
                    placeholder="Permanent portrait URL (https://firebasestorage.googleapis.com/...)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Full Name <span className="text-[#E45757]">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentItem.permanent.fullName}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, fullName: e.target.value },
                      }))
                    }
                    placeholder="e.g. Kwame Boateng Mensah"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Student ID / Reg. No. <span className="text-[#E45757]">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentItem.permanent.studentId}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, studentId: e.target.value },
                      }))
                    }
                    placeholder="e.g. PS/CSC/22/0019"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">Nickname / Moniker</label>
                  <input
                    type="text"
                    value={currentItem.permanent.nickname || ''}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, nickname: e.target.value },
                      }))
                    }
                    placeholder="Optional campaign moniker"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <span>Email (Admin / Contact)</span>
                  </label>
                  <input
                    type="email"
                    value={currentItem.permanent.email || ''}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, email: e.target.value },
                      }))
                    }
                    placeholder="name@st.ucc.edu.gh"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>Phone (Private Admin Only)</span>
                  </label>
                  <input
                    type="tel"
                    value={currentItem.permanent.phone || ''}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, phone: e.target.value },
                      }))
                    }
                    placeholder="024XXXXXXX"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Faculty / School <span className="text-[#E45757]">*</span>
                  </label>
                  <select
                    value={currentItem.permanent.faculty}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, faculty: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  >
                    {!faculties.some((f) => f.name === currentItem.permanent.faculty) &&
                      currentItem.permanent.faculty && (
                        <option value={currentItem.permanent.faculty}>
                          {currentItem.permanent.faculty}
                        </option>
                      )}
                    {faculties.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Department <span className="text-[#E45757]">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentItem.permanent.department}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, department: e.target.value },
                      }))
                    }
                    placeholder="e.g. Computer Science & IT"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">Programme of Study</label>
                  <input
                    type="text"
                    value={currentItem.permanent.programme || ''}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, programme: e.target.value },
                      }))
                    }
                    placeholder="e.g. B.Sc. Computer Science"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">Academic Level</label>
                  <select
                    value={currentItem.permanent.level}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, level: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  >
                    {currentItem.permanent.level === 'Not verified' && (
                      <option value="Not verified">Not verified</option>
                    )}
                    <option value="100">Level 100</option>
                    <option value="200">Level 200</option>
                    <option value="300">Level 300</option>
                    <option value="400">Level 400</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">Hall of Residence</label>
                  <select
                    value={currentItem.permanent.hall}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, hall: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  >
                    {halls.map((h) => (
                      <option key={h.id} value={h.name}>
                        {getHallDisplayName(h)}
                      </option>
                    ))}
                    <option value={NON_RESIDENT_HALL_LABEL}>{NON_RESIDENT_HALL_LABEL}</option>
                    {!halls.some((h) => h.name === currentItem.permanent.hall) &&
                      currentItem.permanent.hall &&
                      currentItem.permanent.hall !== NON_RESIDENT_HALL_LABEL && (
                        <option value={currentItem.permanent.hall}>
                          {currentItem.permanent.hall}
                        </option>
                      )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Contestant Biography
                  </label>
                  <textarea
                    rows={3}
                    value={currentItem.permanent.biography || ''}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: { ...prev.permanent, biography: e.target.value },
                      }))
                    }
                    placeholder="Permanent background & academic profile..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-[#102A43] mb-1">
                    Prior Leadership Experience (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={currentItem.permanent.leadershipExperience.join('\n')}
                    onChange={(e) =>
                      updateCurrentItem((prev) => ({
                        ...prev,
                        permanent: {
                          ...prev.permanent,
                          leadershipExperience: e.target.value.split('\n'),
                        },
                      }))
                    }
                    placeholder="Hall Welfare Secretary (2024/2025)&#10;Departmental Representative"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleRemoveFromQueueOrCancel}
              className="px-4 py-2 rounded-xl border border-[#E45757]/40 text-[#E45757] hover:bg-[#E45757]/10 ucc-btn font-semibold cursor-pointer"
            >
              Remove from Selection
            </button>

            <button
              type="button"
              onClick={() => {
                if (validateCurrentForPreview()) {
                  setChangingPositionInline(false);
                  setView('preview');
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white ucc-btn font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Candidate</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 5: CANDIDATE PREVIEW & CONFIRMATION */}
      {view === 'preview' && currentItem && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="font-semibold text-[#102A43] uppercase tracking-wider ucc-caption flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-[#2563EB]" />
              <span>Candidate Preview &amp; Confirmation</span>
            </span>
            <span className="ucc-caption text-slate-500">
              Review all information before confirming participation.
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <CandidateAvatar
                src={selectedPreviewPhoto}
                alt={currentItem.permanent.fullName}
                className="w-28 h-28 rounded-2xl object-cover border-2 border-[#102A43] shrink-0"
              />

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#102A43] text-white font-semibold ucc-caption uppercase">
                    {electionContext.category}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#2563EB] text-white font-semibold ucc-caption">
                    {currentAssignedPosition?.title || 'Unassigned Position'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#14B8A6]/15 text-[#0F766E] font-semibold ucc-caption">
                    {currentItem.applicationStatus}
                  </span>
                </div>

                <div>
                  <h4 className="ucc-heading-card text-[#102A43]">
                    {currentItem.permanent.fullName}
                  </h4>
                  {currentItem.permanent.nickname && (
                    <p className="ucc-caption font-semibold text-[#E45757]">
                      &ldquo;{currentItem.permanent.nickname}&rdquo;
                    </p>
                  )}
                  <p className="ucc-caption text-slate-500 font-semibold mt-0.5">
                    Election: {electionContext.title || 'New Election'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 ucc-caption text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                    <span className="truncate">
                      {currentItem.permanent.programme
                        ? `${currentItem.permanent.programme} · `
                        : ''}
                      {currentItem.permanent.department}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                    <span className="truncate">
                      {currentItem.permanent.faculty} · {currentItem.permanent.hall}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {(currentItem.campaignStatement || currentItem.manifestoSummary) && (
              <div className="p-3.5 rounded-xl bg-[#F5F7FB] border-l-4 border-[#2563EB] space-y-1">
                {currentItem.campaignStatement && (
                  <p className="font-semibold text-[#102A43]">{currentItem.campaignStatement}</p>
                )}
                {currentItem.manifestoSummary && (
                  <p className="text-slate-700 italic">&ldquo;{currentItem.manifestoSummary}&rdquo;</p>
                )}
              </div>
            )}

            {changingPositionInline && (
              <div className="p-3 rounded-xl bg-[#F5F7FB] border border-[#2563EB]/30 flex flex-wrap items-center gap-2">
                <label className="font-semibold text-[#102A43]">New Position:</label>
                <select
                  value={currentItem.positionKey}
                  onChange={(e) =>
                    updateCurrentItem((prev) => ({ ...prev, positionKey: e.target.value }))
                  }
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white font-medium flex-1"
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setChangingPositionInline(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#102A43] text-white ucc-btn font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setView('configure_edit')}
                disabled={saving}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#102A43] ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Information</span>
              </button>

              <button
                type="button"
                onClick={() => setChangingPositionInline((v) => !v)}
                disabled={saving}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#102A43] ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Change Position</span>
              </button>

              <button
                type="button"
                onClick={handleRemoveFromQueueOrCancel}
                disabled={saving}
                className="px-3.5 py-2 rounded-xl bg-[#E45757]/10 hover:bg-[#E45757]/20 text-[#E45757] ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove from Election</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleConfirmCandidate}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-teal-600 text-white ucc-btn font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Firestore...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm and Add Candidate</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
