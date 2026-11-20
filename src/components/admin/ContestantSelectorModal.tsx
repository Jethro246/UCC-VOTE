import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Edit3,
  FileText,
  GraduationCap,
  ImagePlus,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Candidate,
  ContestantProfile,
  Election,
  ElectionCategory,
  Position,
} from '../../types';
import { ElectionCandidateAssignmentDraft } from '../../services/interfaces';
import { useApp } from '../../context/AppContext';
import {
  ContestantDirectoryEntry,
  evaluateElectionCandidateActionAllowed,
  findDuplicateAssignment,
  normalizeStudentId,
  resolveCandidatePhotoUrl,
  searchContestants,
} from '../../utils/contestantUtils';
import {
  startCandidatePhotoUpload,
  UploadTaskHandle,
  validateCandidateImageFile,
} from '../../services/firebaseStorageService';
import { CandidateAvatar } from '../common/CandidateAvatar';

export interface DraftElectionPositionOption {
  index: number;
  title: string;
  description?: string;
  maxSelections?: number;
  allowsSkip?: boolean;
}

interface ContestantSelectorModalProps {
  isOpen: boolean;
  mode: 'draft' | 'live';
  election?: Election | null;
  electionTitle: string;
  electionCategory: ElectionCategory;
  draftPositions?: DraftElectionPositionOption[];
  livePositions?: Position[];
  existingCandidates?: Candidate[];
  existingDrafts?: ElectionCandidateAssignmentDraft[];
  initialTab?: 'existing' | 'new';
  initialEditDraft?: ElectionCandidateAssignmentDraft | null;
  initialFocusPositionJump?: boolean;
  onClose: () => void;
  onStageDrafts?: (drafts: ElectionCandidateAssignmentDraft[]) => void;
  onLiveCandidatesAdded?: (added: Candidate[], message: string) => void;
}

interface QueuedContestantItem {
  queueKey: string;
  sourceMode: 'existing' | 'new';
  contestantId?: string;
  originalProfile?: ContestantDirectoryEntry | null;
  // Permanent profile fields
  fullName: string;
  studentId: string;
  nickname: string;
  email: string;
  phone: string;
  department: string;
  faculty: string;
  programme: string;
  level: string;
  hall: string;
  photoUrl: string;
  photoStoragePath?: string;
  biography: string;
  leadershipExperienceText: string;
  confirmPermanentUpdate: boolean;
  // Election-specific fields
  selectedPositionKey: string; // String(positionIndex) for draft, position.id for live
  electionPhotoUrl: string;
  campaignStatement: string;
  manifestoSummary: string;
  fullManifestoText: string;
  keyPromisesText: string;
  videoUrl: string;
  applicationStatus: 'Draft' | 'Submitted' | 'Under review' | 'Approved';
}

const UCC_LEVELS = ['100', '200', '300', '400', 'Postgraduate'];

function computeChangedPermanentFields(item: QueuedContestantItem): string[] {
  const orig = item.originalProfile;
  if (!orig || item.sourceMode === 'new') return [];
  const changed: string[] = [];
  const pairs: [string, string, string][] = [
    ['Full Name', orig.fullName || '', item.fullName],
    ['Student ID', normalizeStudentId(orig.studentId), normalizeStudentId(item.studentId)],
    ['Nickname', orig.nickname || '', item.nickname],
    ['Email', orig.email || '', item.email],
    ['Phone', orig.phone || '', item.phone],
    ['Department', orig.department || '', item.department],
    ['Faculty', orig.faculty || '', item.faculty],
    ['Programme', orig.programme || '', item.programme],
    ['Level', orig.level || '', item.level],
    ['Hall', orig.hall || '', item.hall],
    ['Default Photo', orig.photoUrl || '', item.photoUrl],
    ['Biography', orig.biography || '', item.biography],
    [
      'Leadership Experience',
      (orig.leadershipExperience || []).join('\n'),
      item.leadershipExperienceText,
    ],
  ];
  for (const [label, a, b] of pairs) {
    if (a.trim() !== b.trim()) changed.push(label);
  }
  return changed;
}

export const ContestantSelectorModal: React.FC<ContestantSelectorModalProps> = ({
  isOpen,
  mode,
  election,
  electionTitle,
  electionCategory,
  draftPositions = [],
  livePositions = [],
  existingCandidates = [],
  existingDrafts = [],
  initialTab = 'existing',
  initialEditDraft = null,
  onClose,
  onStageDrafts,
  onLiveCandidatesAdded,
}) => {
  const {
    contestants,
    halls,
    faculties,
    departments,
    assignContestantToElectionAction,
    refreshCandidates,
  } = useApp();

  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');
  const [sourceTab, setSourceTab] = useState<'existing' | 'new'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);

  // New contestant creation state
  const [newFullName, setNewFullName] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newFaculty, setNewFaculty] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newProgramme, setNewProgramme] = useState('');
  const [newLevel, setNewLevel] = useState('300');
  const [newHall, setNewHall] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoStoragePath, setNewPhotoStoragePath] = useState('');
  const [newBiography, setNewBiography] = useState('');
  const [newLeadershipText, setNewLeadershipText] = useState('');

  // Staging queue for step 2 & step 3
  const [queuedItems, setQueuedItems] = useState<QueuedContestantItem[]>([]);
  const [activeQueueIdx, setActiveQueueIdx] = useState(0);

  // Firebase Storage upload state
  const [uploadingTarget, setUploadingTarget] = useState<
    'new_permanent' | 'edit_permanent' | 'edit_election' | null
  >(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const uploadTaskRef = useRef<UploadTaskHandle | null>(null);
  const permanentFileInputRef = useRef<HTMLInputElement | null>(null);
  const electionFileInputRef = useRef<HTMLInputElement | null>(null);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const positionSelectRef = useRef<HTMLSelectElement | null>(null);

  // Available target positions STRICTLY scoped to this single election
  const positionOptions = useMemo(() => {
    if (mode === 'draft') {
      return draftPositions.map((p) => ({
        key: String(p.index),
        index: p.index,
        title: p.title || `Position #${p.index + 1}`,
        description: p.description || '',
      }));
    }
    return livePositions
      .filter((p) => !election || p.electionId === election.id)
      .map((p, idx) => ({
        key: p.id,
        index: idx,
        title: p.title,
        description: p.description || '',
      }));
  }, [mode, draftPositions, livePositions, election]);

  // Election status guard for live mode
  const liveAddGuard = useMemo(
    () =>
      mode === 'live' && election
        ? evaluateElectionCandidateActionAllowed(election, 'add')
        : { allowed: true },
    [mode, election]
  );

  // Reset modal cleanly on open
  useEffect(() => {
    if (!isOpen) {
      uploadTaskRef.current?.cancel();
      return;
    }

    setErrorMsg('');
    setUploadError('');
    setUploadingTarget(null);
    setUploadProgress(0);
    setSearchTerm('');
    setSelectedExistingIds([]);
    setSaving(false);

    const defaultFaculty = faculties[0]?.name || 'College of Humanities and Legal Studies';
    const defaultDept = departments[0]?.name || 'Department of Computer Science & IT';
    const defaultHall = halls[0]?.name || 'Adehye Hall';

    setNewFullName('');
    setNewStudentId('');
    setNewNickname('');
    setNewEmail('');
    setNewPhone('');
    setNewFaculty(defaultFaculty);
    setNewDepartment(defaultDept);
    setNewProgramme('');
    setNewLevel('300');
    setNewHall(defaultHall);
    setNewPhotoUrl('');
    setNewPhotoStoragePath('');
    setNewBiography('');
    setNewLeadershipText('');

    if (initialEditDraft) {
      const matchedOrig =
        contestants.find(
          (c) =>
            (initialEditDraft.contestantId && c.id === initialEditDraft.contestantId) ||
            (normalizeStudentId(initialEditDraft.studentId) &&
              normalizeStudentId(c.studentId) ===
                normalizeStudentId(initialEditDraft.studentId))
        ) || null;

      const defaultPosKey =
        initialEditDraft.positionIndex !== undefined
          ? String(initialEditDraft.positionIndex)
          : positionOptions[0]?.key || '';

      setQueuedItems([
        {
          queueKey:
            initialEditDraft.contestantId ||
            normalizeStudentId(initialEditDraft.studentId) ||
            `draft_${Date.now()}`,
          sourceMode: initialEditDraft.isNewContestant ? 'new' : 'existing',
          contestantId: initialEditDraft.contestantId,
          originalProfile: matchedOrig,
          fullName: initialEditDraft.fullName,
          studentId: initialEditDraft.studentId,
          nickname: initialEditDraft.nickname || '',
          email: initialEditDraft.email || '',
          phone: initialEditDraft.phone || '',
          department: initialEditDraft.department || defaultDept,
          faculty: initialEditDraft.faculty || defaultFaculty,
          programme: initialEditDraft.programme || '',
          level: initialEditDraft.level || '300',
          hall: initialEditDraft.hall || defaultHall,
          photoUrl: initialEditDraft.photoUrl || '',
          photoStoragePath: initialEditDraft.photoStoragePath,
          biography: initialEditDraft.biography || '',
          leadershipExperienceText: (initialEditDraft.leadershipExperience || []).join('\n'),
          confirmPermanentUpdate: Boolean(initialEditDraft.updatePermanentProfile),
          selectedPositionKey: defaultPosKey,
          electionPhotoUrl: initialEditDraft.electionPhotoUrl || '',
          campaignStatement: initialEditDraft.campaignStatement || '',
          manifestoSummary: initialEditDraft.manifestoSummary || '',
          fullManifestoText: (initialEditDraft.fullManifesto || []).join('\n'),
          keyPromisesText: (initialEditDraft.keyPromises || []).join('\n'),
          videoUrl: initialEditDraft.videoUrl || '',
          applicationStatus: initialEditDraft.applicationStatus || 'Approved',
        },
      ]);
      setActiveQueueIdx(0);
      setStep('configure');
    } else {
      setQueuedItems([]);
      setActiveQueueIdx(0);
      setSourceTab(initialTab);
      setStep('select');
    }
  }, [isOpen, initialTab, initialEditDraft]);

  const filteredContestants = useMemo(
    () => searchContestants(contestants, searchTerm),
    [contestants, searchTerm]
  );

  // Live duplicate check when typing student ID in Register New Contestant
  const duplicateNewStudentMatch = useMemo(() => {
    const norm = normalizeStudentId(newStudentId);
    if (!norm) return null;
    return contestants.find((c) => normalizeStudentId(c.studentId) === norm) || null;
  }, [contestants, newStudentId]);

  const existingParticipationsMap = useMemo(() => {
    const map = new Map<string, { candidate: Candidate; positionTitle: string }[]>();
    const posTitleLookup = new Map(positionOptions.map((p) => [p.key, p.title]));

    for (const cand of existingCandidates) {
      if (election && cand.electionId !== election.id) continue;
      const keys = [
        cand.contestantId,
        normalizeStudentId(cand.studentId)
          ? `sid:${normalizeStudentId(cand.studentId)}`
          : '',
      ].filter(Boolean) as string[];
      const posTitle = posTitleLookup.get(cand.positionId) || cand.positionId;
      for (const k of keys) {
        const list = map.get(k) || [];
        list.push({ candidate: cand, positionTitle: posTitle });
        map.set(k, list);
      }
    }
    return map;
  }, [existingCandidates, election, positionOptions]);

  const getContestantAlreadyInElection = (entry: ContestantDirectoryEntry) => {
    const byId = existingParticipationsMap.get(entry.id) || [];
    const normSid = normalizeStudentId(entry.studentId);
    const bySid = normSid ? existingParticipationsMap.get(`sid:${normSid}`) || [] : [];
    const merged = [...byId, ...bySid];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.candidate.id)) return false;
      seen.add(item.candidate.id);
      return true;
    });
  };

  const handleToggleSelectExisting = (id: string) => {
    setSelectedExistingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePhotoUpload = async (
    file: File,
    target: 'new_permanent' | 'edit_permanent' | 'edit_election'
  ) => {
    setUploadError('');
    setErrorMsg('');
    const validation = await validateCandidateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      return;
    }

    uploadTaskRef.current?.cancel();
    setUploadingTarget(target);
    setUploadProgress(0);

    const activeItem = queuedItems[activeQueueIdx];
    const keyHint =
      target === 'new_permanent'
        ? normalizeStudentId(newStudentId) || newFullName || 'contestant'
        : normalizeStudentId(activeItem?.studentId) ||
          activeItem?.contestantId ||
          activeItem?.fullName ||
          'contestant';

    const handle = startCandidatePhotoUpload(file, keyHint, (pct) => {
      setUploadProgress(pct);
    });
    uploadTaskRef.current = handle;

    try {
      const { url, path } = await handle.promise;
      if (target === 'new_permanent') {
        setNewPhotoUrl(url);
        setNewPhotoStoragePath(path);
      } else if (target === 'edit_permanent' && activeItem) {
        updateQueueItem(activeQueueIdx, { photoUrl: url, photoStoragePath: path });
      } else if (target === 'edit_election' && activeItem) {
        updateQueueItem(activeQueueIdx, { electionPhotoUrl: url });
      }
      setUploadingTarget(null);
      setUploadProgress(100);
    } catch (err: any) {
      setUploadingTarget(null);
      setUploadError(err?.message || 'Photo upload failed. Please retry.');
    }
  };

  const updateQueueItem = (idx: number, patch: Partial<QueuedContestantItem>) => {
    setQueuedItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const handleRevertPermanentEdits = (idx: number) => {
    const item = queuedItems[idx];
    if (!item?.originalProfile) return;
    const orig = item.originalProfile;
    updateQueueItem(idx, {
      fullName: orig.fullName || '',
      studentId: orig.studentId || '',
      nickname: orig.nickname || '',
      email: orig.email || '',
      phone: orig.phone || '',
      department: orig.department || '',
      faculty: orig.faculty || '',
      programme: orig.programme || '',
      level: orig.level || '300',
      hall: orig.hall || '',
      photoUrl: orig.photoUrl || '',
      photoStoragePath: orig.photoStoragePath,
      biography: orig.biography || '',
      leadershipExperienceText: (orig.leadershipExperience || []).join('\n'),
      confirmPermanentUpdate: false,
    });
  };

  const handleContinueFromSelect = () => {
    setErrorMsg('');
    if (positionOptions.length === 0) {
      setErrorMsg(
        'No contested positions have been configured for this election yet. Configure at least one position before adding candidates.'
      );
      return;
    }

    if (sourceTab === 'existing') {
      if (selectedExistingIds.length === 0) {
        setErrorMsg('Select at least one existing contestant from the directory to proceed.');
        return;
      }

      const existingSelectedEntries = selectedExistingIds
        .map((id) => contestants.find((c) => c.id === id))
        .filter(Boolean) as ContestantDirectoryEntry[];

      const items: QueuedContestantItem[] = existingSelectedEntries.map((entry) => {
        // Pick first position in this election where this contestant is NOT already registered
        const takenPositions = new Set(
          getContestantAlreadyInElection(entry).map((p) => p.candidate.positionId)
        );
        const defaultPos =
          positionOptions.find((p) => !takenPositions.has(p.key)) || positionOptions[0];

        return {
          queueKey: entry.id,
          sourceMode: 'existing',
          contestantId: entry.id,
          originalProfile: entry,
          fullName: entry.fullName || '',
          studentId: entry.studentId || '',
          nickname: entry.nickname || '',
          email: entry.email || '',
          phone: entry.phone || '',
          department: entry.department || departments[0]?.name || '',
          faculty: entry.faculty || faculties[0]?.name || '',
          programme: entry.programme || '',
          level: entry.level || '300',
          hall: entry.hall || halls[0]?.name || '',
          photoUrl: entry.photoUrl || '',
          photoStoragePath: entry.photoStoragePath,
          biography: entry.biography || '',
          leadershipExperienceText: (entry.leadershipExperience || []).join('\n'),
          confirmPermanentUpdate: false,
          selectedPositionKey: defaultPos?.key || '',
          electionPhotoUrl: '',
          campaignStatement: '',
          manifestoSummary: '',
          fullManifestoText: '',
          keyPromisesText: '',
          videoUrl: '',
          applicationStatus: 'Approved',
        };
      });

      setQueuedItems(items);
      setActiveQueueIdx(0);
      setStep('configure');
      return;
    }

    // New contestant validation before staging
    if (!newFullName.trim() || newFullName.trim().length < 2) {
      setErrorMsg('Enter the new contestant’s full name (at least 2 characters).');
      return;
    }
    if (!newStudentId.trim()) {
      setErrorMsg('Enter the new contestant’s UCC Student Registration ID.');
      return;
    }
    if (duplicateNewStudentMatch) {
      setErrorMsg(
        `Student ID ${normalizeStudentId(newStudentId)} already belongs to ${duplicateNewStudentMatch.fullName}. Click "Select Existing Contestant Instead" below to reuse their profile.`
      );
      return;
    }
    if (!newPhotoUrl.trim()) {
      setErrorMsg(
        'Upload the candidate’s portrait photograph via Firebase Storage before continuing.'
      );
      return;
    }

    setQueuedItems([
      {
        queueKey: `new_${Date.now()}`,
        sourceMode: 'new',
        fullName: newFullName.trim(),
        studentId: normalizeStudentId(newStudentId) || newStudentId.trim(),
        nickname: newNickname.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
        department: newDepartment.trim() || 'Not verified',
        faculty: newFaculty.trim() || 'Not verified',
        programme: newProgramme.trim(),
        level: newLevel,
        hall: newHall.trim() || 'Not verified',
        photoUrl: newPhotoUrl.trim(),
        photoStoragePath: newPhotoStoragePath || undefined,
        biography: newBiography.trim(),
        leadershipExperienceText: newLeadershipText.trim(),
        confirmPermanentUpdate: true,
        selectedPositionKey: positionOptions[0]?.key || '',
        electionPhotoUrl: '',
        campaignStatement: '',
        manifestoSummary: '',
        fullManifestoText: '',
        keyPromisesText: '',
        videoUrl: '',
        applicationStatus: 'Approved',
      },
    ]);
    setActiveQueueIdx(0);
    setStep('configure');
  };

  const validateQueuedItems = (): string | null => {
    if (queuedItems.length === 0) {
      return 'No candidates are staged to add.';
    }

    const batchAssignmentKeys = new Set<string>();

    for (let i = 0; i < queuedItems.length; i++) {
      const item = queuedItems[i];
      if (!item.fullName.trim() || item.fullName.trim().length < 2) {
        return `Candidate #${i + 1}: Full name is required.`;
      }
      if (!item.selectedPositionKey) {
        return `Select an explicit target position in "${electionTitle}" for ${item.fullName}.`;
      }
      const posObj = positionOptions.find((p) => p.key === item.selectedPositionKey);
      if (!posObj) {
        return `Selected position for ${item.fullName} does not belong to "${electionTitle}".`;
      }

      const normSid = normalizeStudentId(item.studentId);
      const uniqueBatchKey = `${item.selectedPositionKey}::${item.contestantId || normSid || item.fullName.toLowerCase()}`;
      if (batchAssignmentKeys.has(uniqueBatchKey)) {
        return `${item.fullName} cannot be assigned twice to "${posObj.title}".`;
      }
      batchAssignmentKeys.add(uniqueBatchKey);

      if (mode === 'live' && election) {
        const dup = findDuplicateAssignment(existingCandidates, {
          electionId: election.id,
          positionId: item.selectedPositionKey,
          contestantId: item.contestantId,
          studentId: item.studentId,
        });
        if (dup) {
          return `${item.fullName} is already registered for "${posObj.title}" in "${electionTitle}".`;
        }
      } else if (mode === 'draft') {
        const dupDraft = existingDrafts.find((d) => {
          if (initialEditDraft && d === initialEditDraft) return false;
          if (String(d.positionIndex) !== item.selectedPositionKey) return false;
          if (item.contestantId && d.contestantId && d.contestantId === item.contestantId) {
            return true;
          }
          const dSid = normalizeStudentId(d.studentId);
          return Boolean(normSid && dSid && normSid === dSid);
        });
        if (dupDraft) {
          return `${item.fullName} is already staged for "${posObj.title}" in this election.`;
        }
      }

      const changedFields = computeChangedPermanentFields(item);
      if (changedFields.length > 0 && !item.confirmPermanentUpdate) {
        return `Permanent profile fields changed for ${item.fullName} (${changedFields.join(', ')}). Confirm the permanent profile update checkbox or revert the permanent edits before proceeding.`;
      }
    }
    return null;
  };

  const handleGoToPreview = () => {
    setErrorMsg('');
    const err = validateQueuedItems();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setStep('preview');
  };

  const handleConfirmAndAdd = async () => {
    setErrorMsg('');
    const err = validateQueuedItems();
    if (err) {
      setErrorMsg(err);
      return;
    }

    if (mode === 'draft') {
      const drafts: ElectionCandidateAssignmentDraft[] = queuedItems.map((item) => {
        const posObj = positionOptions.find((p) => p.key === item.selectedPositionKey)!;
        const changedFields = computeChangedPermanentFields(item);
        return {
          contestantId: item.contestantId,
          isNewContestant: item.sourceMode === 'new',
          fullName: item.fullName.trim(),
          studentId: normalizeStudentId(item.studentId) || item.studentId.trim() || 'Not verified',
          nickname: item.nickname.trim() || undefined,
          email: item.email.trim() || undefined,
          phone: item.phone.trim() || undefined,
          department: item.department.trim() || 'Not verified',
          faculty: item.faculty.trim() || 'Not verified',
          programme: item.programme.trim(),
          level: item.level.trim() || 'Not verified',
          hall: item.hall.trim() || 'Not verified',
          photoUrl: item.photoUrl.trim(),
          photoStoragePath: item.photoStoragePath,
          biography: item.biography.trim(),
          leadershipExperience: item.leadershipExperienceText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          updatePermanentProfile: changedFields.length > 0 && item.confirmPermanentUpdate,
          permanentProfileFieldsChanged: changedFields,
          positionIndex: posObj.index,
          positionTitle: posObj.title,
          electionPhotoUrl: item.electionPhotoUrl.trim() || undefined,
          campaignStatement: item.campaignStatement.trim() || undefined,
          manifestoSummary:
            item.manifestoSummary.trim() || item.campaignStatement.trim() || '',
          fullManifesto: item.fullManifestoText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          keyPromises: item.keyPromisesText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          videoUrl: item.videoUrl.trim() || undefined,
          applicationStatus: item.applicationStatus,
        };
      });

      onStageDrafts?.(drafts);
      onClose();
      return;
    }

    // Live election persistence — execute atomic Firestore saves sequentially
    if (!election) {
      setErrorMsg('Target election context is missing.');
      return;
    }

    setSaving(true);
    const addedCandidates: Candidate[] = [];
    const remainingFailed: QueuedContestantItem[] = [];
    const errors: string[] = [];

    for (const item of queuedItems) {
      const changedFields = computeChangedPermanentFields(item);
      const shouldUpdatePerm =
        item.sourceMode === 'existing' &&
        changedFields.length > 0 &&
        item.confirmPermanentUpdate;

      const profileSnapshot: Partial<ContestantProfile> = {
        fullName: item.fullName.trim(),
        studentId: normalizeStudentId(item.studentId) || item.studentId.trim() || 'Not verified',
        nickname: item.nickname.trim() || undefined,
        email: item.email.trim() || undefined,
        phone: item.phone.trim() || undefined,
        department: item.department.trim() || 'Not verified',
        faculty: item.faculty.trim() || 'Not verified',
        programme: item.programme.trim(),
        level: item.level.trim() || 'Not verified',
        hall: item.hall.trim() || 'Not verified',
        photoUrl: item.photoUrl.trim(),
        photoStoragePath: item.photoStoragePath,
        biography: item.biography.trim(),
        leadershipExperience: item.leadershipExperienceText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const res = await assignContestantToElectionAction({
        electionId: election.id,
        positionId: item.selectedPositionKey,
        contestantId: item.contestantId,
        mode: item.sourceMode,
        updatePermanentProfile: shouldUpdatePerm,
        permanentProfileUpdates: shouldUpdatePerm ? profileSnapshot : undefined,
        profileSnapshot,
        electionParticipation: {
          manifestoSummary:
            item.manifestoSummary.trim() || item.campaignStatement.trim() || '',
          fullManifesto: item.fullManifestoText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          keyPromises: item.keyPromisesText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          campaignStatement: item.campaignStatement.trim() || undefined,
          electionPhotoUrl: item.electionPhotoUrl.trim() || undefined,
          videoUrl: item.videoUrl.trim() || undefined,
          applicationStatus: item.applicationStatus,
        },
      });

      if (res.success && res.candidate) {
        addedCandidates.push(res.candidate);
      } else {
        remainingFailed.push(item);
        errors.push(`${item.fullName}: ${res.error || 'Failed to save candidate.'}`);
      }
    }

    await refreshCandidates();
    setSaving(false);

    if (remainingFailed.length > 0) {
      setQueuedItems(remainingFailed);
      setActiveQueueIdx(0);
      setErrorMsg(
        `${addedCandidates.length} candidate(s) saved. ${errors.join(' | ')}`
      );
      if (addedCandidates.length > 0) {
        onLiveCandidatesAdded?.(
          addedCandidates,
          `${addedCandidates.length} candidate(s) saved, ${remainingFailed.length} require attention.`
        );
      }
      return;
    }

    const msg =
      addedCandidates.length === 1
        ? `${addedCandidates[0].fullName} confirmed and added to ${electionTitle}.`
        : `${addedCandidates.length} candidates confirmed and added to ${electionTitle}.`;
    onLiveCandidatesAdded?.(addedCandidates, msg);
    onClose();
  };

  if (!isOpen) return null;

  const activeItem = queuedItems[activeQueueIdx] || null;
  const activeChangedPermanentFields = activeItem
    ? computeChangedPermanentFields(activeItem)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#102A43]/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full shadow-2xl my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-[#102A43] text-white rounded-t-2xl flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 ucc-caption font-semibold text-[#14B8A6] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {electionCategory} · {electionTitle || 'New Election'}
              </span>
            </div>
            <h2 className="ucc-heading-card text-white mt-0.5">
              {step === 'select'
                ? 'Select or Register Election Contestants'
                : step === 'configure'
                ? 'Assign Position & Review Candidate Information'
                : 'Preview & Confirm Election Candidates'}
            </h2>
            <p className="ucc-body-secondary text-slate-300 mt-0.5">
              {step === 'select'
                ? 'Search registered UCC contestants across campus records or register a new contestant profile.'
                : step === 'configure'
                ? 'Bind each contestant strictly to one position in this election and review permanent vs. election-specific details.'
                : 'Verify photo, target position, and campaign details before committing to Firestore.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Bar */}
        <div className="px-6 py-3 bg-[#F5F7FB] border-b border-slate-200 grid grid-cols-3 gap-2 ucc-label shrink-0">
          {[
            { id: 'select', label: '1. Select Contestant' },
            { id: 'configure', label: '2. Position & Edit Info' },
            { id: 'preview', label: '3. Preview & Confirm' },
          ].map((s) => {
            const active = step === s.id;
            return (
              <div
                key={s.id}
                className={`py-2 px-3 rounded-xl font-semibold text-center transition-colors ${
                  active
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {s.label}
              </div>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {!liveAddGuard.allowed && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 ucc-body-secondary flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#E45757] mt-0.5" />
              <div>
                <p className="font-semibold">Adding candidates is blocked for this election</p>
                <p className="mt-0.5">{liveAddGuard.reason}</p>
              </div>
            </div>
          )}

          {liveAddGuard.allowed && liveAddGuard.warning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 ucc-body-secondary flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>{liveAddGuard.warning}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 ucc-body-secondary flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#E45757] mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 ucc-body-secondary flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#E45757] mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* STEP 1: SELECT EXISTING OR REGISTER NEW */}
          {step === 'select' && (
            <div className="space-y-4 ucc-body-secondary">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-xl bg-[#F5F7FB] p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSourceTab('existing')}
                    className={`px-3.5 py-2 rounded-lg ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      sourceTab === 'existing'
                        ? 'bg-[#102A43] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="tabular-nums">Existing Contestants ({contestants.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceTab('new')}
                    className={`px-3.5 py-2 rounded-lg ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      sourceTab === 'new'
                        ? 'bg-[#2563EB] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Register New Contestant</span>
                  </button>
                </div>

                {sourceTab === 'existing' && selectedExistingIds.length > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-[#102A43] font-semibold">
                    <UserCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span className="tabular-nums">{selectedExistingIds.length} selected</span>
                    <button
                      type="button"
                      onClick={() => setSelectedExistingIds([])}
                      className="ucc-caption font-semibold text-[#E45757] hover:underline ml-1 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {sourceTab === 'existing' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by full name, Student ID, department, programme, faculty, hall, email, or previous election..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2563EB] text-slate-900"
                    />
                  </div>

                  {selectedExistingIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-[#F5F7FB] border border-slate-200">
                      {selectedExistingIds.map((id) => {
                        const c = contestants.find((item) => item.id === id);
                        if (!c) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 ucc-caption font-semibold"
                          >
                            <span>{c.fullName}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleSelectExisting(id)}
                              className="text-slate-400 hover:text-[#E45757] cursor-pointer"
                              aria-label={`Remove ${c.fullName}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[46vh] overflow-y-auto pr-1">
                    {filteredContestants.length === 0 ? (
                      <div className="col-span-full py-10 text-center bg-[#F5F7FB] rounded-xl border border-slate-200 space-y-2">
                        <p className="text-slate-700 font-semibold">
                          No existing contestants match &ldquo;{searchTerm}&rdquo;.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSourceTab('new');
                            if (searchTerm.trim() && !newFullName) {
                              setNewFullName(searchTerm.trim());
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-[#2563EB] text-white ucc-btn font-semibold cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Register New Contestant Instead</span>
                        </button>
                      </div>
                    ) : (
                      filteredContestants.map((entry) => {
                        const isSelected = selectedExistingIds.includes(entry.id);
                        const existingInElection = getContestantAlreadyInElection(entry);
                        return (
                          <label
                            key={entry.id}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                              isSelected
                                ? 'bg-blue-50/70 border-[#2563EB] ring-1 ring-[#2563EB]'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectExisting(entry.id)}
                              className="mt-1 rounded text-[#2563EB] focus:ring-0"
                            />
                            <CandidateAvatar
                              src={entry.photoUrl}
                              alt={entry.fullName}
                              className="w-12 h-12 rounded-xl object-cover object-top border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-slate-900 ucc-body-secondary truncate">
                                  {entry.fullName}
                                </div>
                                {entry.participations.length > 0 && (
                                  <span className="ucc-caption font-semibold text-[#102A43] bg-slate-100 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
                                    {entry.participations.length} race
                                    {entry.participations.length === 1 ? '' : 's'}
                                  </span>
                                )}
                              </div>
                              <div className="ucc-caption text-slate-600 tabular-nums">
                                {entry.studentId || 'ID Not Verified'}
                                {entry.nickname ? ` · "${entry.nickname}"` : ''}
                              </div>
                              <div className="ucc-caption text-slate-600 truncate">
                                <GraduationCap className="w-3 h-3 inline mr-1 text-slate-400" />
                                {entry.programme || entry.department}
                              </div>
                              <div className="ucc-caption text-slate-500 truncate">
                                <Building2 className="w-3 h-3 inline mr-1 text-slate-400" />
                                {entry.faculty} · {entry.hall} · Level {entry.level}
                              </div>
                              {existingInElection.length > 0 && (
                                <div className="ucc-caption font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                  Already in this election:{' '}
                                  {existingInElection.map((x) => x.positionTitle).join(', ')}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* REGISTER NEW CONTESTANT FORM */
                <div className="space-y-4 p-4 rounded-2xl bg-[#F5F7FB] border border-slate-200">
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="flex items-center gap-3">
                      <CandidateAvatar
                        src={newPhotoUrl}
                        alt={newFullName || 'New Contestant'}
                        className="w-16 h-16 rounded-2xl object-cover object-top border border-slate-300 shrink-0"
                      />
                      <div className="space-y-1.5">
                        <input
                          ref={newFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) handlePhotoUpload(f, 'new_permanent');
                          }}
                        />
                        <button
                          type="button"
                          disabled={uploadingTarget === 'new_permanent'}
                          onClick={() => newFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-[#102A43] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {uploadingTarget === 'new_permanent' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {uploadingTarget === 'new_permanent'
                              ? `Uploading ${uploadProgress}%...`
                              : newPhotoUrl
                              ? 'Change Portrait Photo'
                              : 'Upload Portrait Photo *'}
                          </span>
                        </button>
                        <p className="ucc-caption text-slate-500">
                          Uploaded to Firebase Storage (JPEG/PNG/WebP, max 5MB).
                        </p>
                      </div>
                    </div>
                  </div>

                  {duplicateNewStudentMatch && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold ucc-body-secondary">
                            Duplicate Student ID Detected: {duplicateNewStudentMatch.fullName}
                          </div>
                          <div className="ucc-caption text-amber-800">
                            {duplicateNewStudentMatch.department} · {duplicateNewStudentMatch.hall}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSourceTab('existing');
                          setSelectedExistingIds((prev) =>
                            prev.includes(duplicateNewStudentMatch.id)
                              ? prev
                              : [...prev, duplicateNewStudentMatch.id]
                          );
                          setSearchTerm(duplicateNewStudentMatch.studentId || '');
                          setErrorMsg('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#102A43] text-white ucc-btn font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Select Existing Contestant Instead
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block ucc-label font-semibold text-slate-800 mb-1">
                        Full Name <span className="text-[#E45757]">*</span>
                      </label>
                      <input
                        type="text"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        placeholder="e.g. Kwame Boateng Mensah"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block ucc-label font-semibold text-slate-800 mb-1">
                        UCC Student ID <span className="text-[#E45757]">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStudentId}
                        onChange={(e) => setNewStudentId(e.target.value.toUpperCase())}
                        placeholder="e.g. PS/CSC/22/0041"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block ucc-label font-semibold text-slate-800 mb-1">
                        Faculty / School
                      </label>
                      <select
                        value={newFaculty}
                        onChange={(e) => setNewFaculty(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                      >
                        {faculties.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block ucc-label font-semibold text-slate-800 mb-1">Department</label>
                      <select
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block ucc-label font-semibold text-slate-800 mb-1">Programme</label>
                      <input
                        type="text"
                        value={newProgramme}
                        onChange={(e) => setNewProgramme(e.target.value)}
                        placeholder="e.g. B.Sc. Computer Science"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block ucc-label font-semibold text-slate-800 mb-1">Level</label>
                        <select
                          value={newLevel}
                          onChange={(e) => setNewLevel(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                        >
                          {UCC_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block ucc-label font-semibold text-slate-800 mb-1">Hall</label>
                        <select
                          value={newHall}
                          onChange={(e) => setNewHall(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                        >
                          {halls.map((h) => (
                            <option key={h.id} value={h.name}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block ucc-label font-semibold text-slate-800 mb-1">
                        Nickname / Popular Name
                      </label>
                      <input
                        type="text"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        placeholder="Optional campaign nickname"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block ucc-label font-semibold text-slate-800 mb-1">Email</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="student@stu.ucc.edu.gh"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block ucc-label font-semibold text-slate-800 mb-1">
                          Phone (Admin Only)
                        </label>
                        <input
                          type="tel"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="024 XXX XXXX"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ASSIGN POSITION & EDIT ELECTION-SPECIFIC + PERMANENT INFO */}
          {step === 'configure' && activeItem && (
            <div className="space-y-5 ucc-body-secondary">
              {queuedItems.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {queuedItems.map((item, idx) => {
                    const posTitle =
                      positionOptions.find((p) => p.key === item.selectedPositionKey)?.title ||
                      'Unassigned';
                    return (
                      <button
                        key={item.queueKey}
                        type="button"
                        onClick={() => setActiveQueueIdx(idx)}
                        className={`px-3 py-2 rounded-xl border text-left shrink-0 cursor-pointer transition-colors ${
                          idx === activeQueueIdx
                            ? 'bg-[#102A43] text-white border-[#102A43]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-semibold ucc-label">{item.fullName}</div>
                        <div
                          className={`ucc-caption ${
                            idx === activeQueueIdx ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          Position: {posTitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Explicit Target Position Binding */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-[#102A43] ucc-label">
                    Target Contested Position in {electionTitle}{' '}
                    <span className="text-[#E45757]">*</span>
                  </label>
                  <span className="ucc-caption font-semibold text-[#2563EB]">
                    Positions scoped exclusively to this election
                  </span>
                </div>
                <select
                  ref={positionSelectRef}
                  value={activeItem.selectedPositionKey}
                  onChange={(e) =>
                    updateQueueItem(activeQueueIdx, { selectedPositionKey: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-blue-300 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#2563EB]"
                >
                  {positionOptions.map((pos) => (
                    <option key={pos.key} value={pos.key}>
                      {pos.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section A: Election-Specific Participation Data */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F7FB] border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="ucc-label font-semibold text-[#102A43] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#2563EB]" />
                      <span>Election-Specific Campaign &amp; Participation Details</span>
                    </h3>
                    <p className="ucc-caption text-slate-500">
                      Applies strictly to <strong>{electionTitle}</strong>. Does not alter other
                      elections or the permanent contestant record.
                    </p>
                  </div>
                </div>

                {/* Election-specific portrait override */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-3">
                    <CandidateAvatar
                      src={activeItem.electionPhotoUrl || activeItem.photoUrl}
                      alt={activeItem.fullName}
                      className="w-12 h-12 rounded-xl object-cover object-top border border-slate-200 shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 ucc-body-secondary">
                        {activeItem.electionPhotoUrl
                          ? 'Using Election-Specific Portrait Override'
                          : 'Using Permanent Contestant Portrait'}
                      </div>
                      <div className="ucc-caption text-slate-500">
                        Optional: upload a dedicated campaign photo solely for this election.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={electionFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) handlePhotoUpload(f, 'edit_election');
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingTarget === 'edit_election'}
                      onClick={() => electionFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>
                        {uploadingTarget === 'edit_election'
                          ? `Uploading ${uploadProgress}%...`
                          : 'Upload Election Photo'}
                      </span>
                    </button>
                    {activeItem.electionPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => updateQueueItem(activeQueueIdx, { electionPhotoUrl: '' })}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 ucc-btn font-semibold cursor-pointer"
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block ucc-label font-semibold text-slate-800 mb-1">
                      Campaign Statement / Slogan
                    </label>
                    <input
                      type="text"
                      value={activeItem.campaignStatement}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, { campaignStatement: e.target.value })
                      }
                      placeholder="e.g. Putting Students First Through Transparent Governance"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-800 mb-1">
                      Initial Approval Status
                    </label>
                    <select
                      value={activeItem.applicationStatus}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, {
                          applicationStatus: e.target.value as QueuedContestantItem['applicationStatus'],
                        })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="Approved">Approved (Appear on Ballot)</option>
                      <option value="Submitted">Submitted (Pending Review)</option>
                      <option value="Under review">Under review</option>
                      <option value="Draft">Draft</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-800 mb-1">Manifesto Summary</label>
                  <textarea
                    rows={2}
                    value={activeItem.manifestoSummary}
                    onChange={(e) =>
                      updateQueueItem(activeQueueIdx, { manifestoSummary: e.target.value })
                    }
                    placeholder="Concise summary shown on candidate directory cards and comparison views..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block ucc-label font-semibold text-slate-800 mb-1">
                      Full Manifesto Points (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={activeItem.fullManifestoText}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, { fullManifestoText: e.target.value })
                      }
                      placeholder="Reform hall welfare budgeting&#10;Digitize clearance approvals"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-800 mb-1">
                      Key Actionable Promises (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={activeItem.keyPromisesText}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, { keyPromisesText: e.target.value })
                      }
                      placeholder="100-day Wi-Fi reliability audit&#10;Monthly open town hall"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section B: Permanent Contestant Profile */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="ucc-label font-semibold text-[#102A43] flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4 text-[#102A43]" />
                      <span>Permanent Contestant Profile (Shared Registry)</span>
                    </h3>
                    <p className="ucc-caption text-slate-500">
                      Shared identity, academic, and contact information stored in the permanent
                      contestants registry.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={permanentFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) handlePhotoUpload(f, 'edit_permanent');
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingTarget === 'edit_permanent'}
                      onClick={() => permanentFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingTarget === 'edit_permanent'
                          ? `Uploading ${uploadProgress}%...`
                          : 'Update Default Photo'}
                      </span>
                    </button>
                  </div>
                </div>

                {activeChangedPermanentFields.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#E45757] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold ucc-body-secondary">
                            Warning: Permanent Profile Fields Modified (
                            {activeChangedPermanentFields.join(', ')})
                          </div>
                          <p className="ucc-caption text-amber-900 mt-0.5">
                            Saving these edits will update this contestant&apos;s permanent UCC VOTE
                            profile and synchronize shared identity fields across linked records
                            (recorded vote tallies are never modified).
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevertPermanentEdits(activeQueueIdx)}
                        className="px-2.5 py-1 rounded-lg border border-amber-400 bg-white hover:bg-amber-100 ucc-caption font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Revert Edits
                      </button>
                    </div>

                    <label className="flex items-center gap-2 pt-1 ucc-label font-semibold text-[#102A43] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeItem.confirmPermanentUpdate}
                        onChange={(e) =>
                          updateQueueItem(activeQueueIdx, {
                            confirmPermanentUpdate: e.target.checked,
                          })
                        }
                        className="rounded text-[#2563EB]"
                      />
                      <span>
                        I confirm updating this shared permanent contestant profile across UCC VOTE
                      </span>
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={activeItem.fullName}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, { fullName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">Student ID</label>
                    <input
                      type="text"
                      value={activeItem.studentId}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, {
                          studentId: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">Nickname</label>
                    <input
                      type="text"
                      value={activeItem.nickname}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, { nickname: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">Department</label>
                    <input
                      type="text"
                      value={activeItem.department}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, { department: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">Programme</label>
                    <input
                      type="text"
                      value={activeItem.programme}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, { programme: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">Faculty / School</label>
                    <input
                      type="text"
                      value={activeItem.faculty}
                      onChange={(e) =>
                        updateQueueItem(activeQueueIdx, { faculty: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">Level</label>
                    <select
                      value={activeItem.level}
                      onChange={(e) => updateQueueItem(activeQueueIdx, { level: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    >
                      {UCC_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                      {!UCC_LEVELS.includes(activeItem.level) && activeItem.level && (
                        <option value={activeItem.level}>{activeItem.level}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">Hall</label>
                    <select
                      value={activeItem.hall}
                      onChange={(e) => updateQueueItem(activeQueueIdx, { hall: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    >
                      {halls.map((h) => (
                        <option key={h.id} value={h.name}>
                          {h.name}
                        </option>
                      ))}
                      {!halls.some((h) => h.name === activeItem.hall) && activeItem.hall && (
                        <option value={activeItem.hall}>{activeItem.hall}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">
                      Phone (Admin Only PII)
                    </label>
                    <input
                      type="tel"
                      value={activeItem.phone}
                      onChange={(e) => updateQueueItem(activeQueueIdx, { phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">Biography</label>
                  <textarea
                    rows={2}
                    value={activeItem.biography}
                    onChange={(e) =>
                      updateQueueItem(activeQueueIdx, { biography: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & CONFIRM */}
          {step === 'preview' && (
            <div className="space-y-4 ucc-body-secondary">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#14B8A6] shrink-0" />
                <span>
                  Review the <span className="tabular-nums">{queuedItems.length}</span> staged candidate
                  {queuedItems.length === 1 ? '' : 's'} below. Click{' '}
                  <strong>Confirm and Add Candidate</strong> to persist.
                </span>
              </div>

              <div className="space-y-3">
                {queuedItems.map((item, idx) => {
                  const posObj = positionOptions.find((p) => p.key === item.selectedPositionKey);
                  const previewPhoto = resolveCandidatePhotoUrl({
                    photoUrl: item.photoUrl,
                    electionPhotoUrl: item.electionPhotoUrl,
                  });
                  const changedFields = computeChangedPermanentFields(item);

                  return (
                    <div
                      key={item.queueKey}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <CandidateAvatar
                          src={previewPhoto}
                          alt={item.fullName}
                          className="w-16 h-16 rounded-xl object-cover object-top border border-slate-200 shrink-0"
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-slate-900 ucc-body">{item.fullName}</h4>
                            <span className="ucc-caption text-slate-500 tabular-nums">
                              {item.studentId}
                            </span>
                            {item.electionPhotoUrl && (
                              <span className="ucc-caption font-semibold text-[#2563EB] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                Election Photo Override
                              </span>
                            )}
                            {changedFields.length > 0 && (
                              <span className="ucc-caption font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                Updates Permanent Profile
                              </span>
                            )}
                          </div>
                          <div className="text-slate-700 font-semibold">
                            <span className="text-[#102A43]">{electionCategory}</span> ·{' '}
                            <span>{electionTitle}</span> ·{' '}
                            <span className="text-[#2563EB] font-semibold">
                              {posObj?.title || 'Unassigned Position'}
                            </span>
                          </div>
                          <div className="text-slate-600">
                            {item.department}
                            {item.programme ? ` — ${item.programme}` : ''} · {item.hall}
                          </div>
                          {(item.campaignStatement || item.manifestoSummary) && (
                            <p className="text-slate-700 bg-[#F5F7FB] border border-slate-200 rounded-lg px-3 py-1.5 mt-1">
                              &ldquo;{item.campaignStatement || item.manifestoSummary}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQueueIdx(idx);
                            setStep('configure');
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 ucc-caption font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Edit Information
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQueueIdx(idx);
                            setStep('configure');
                            setTimeout(() => positionSelectRef.current?.focus(), 60);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2563EB] ucc-caption font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Change Position
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = queuedItems.filter((_, i) => i !== idx);
                            setQueuedItems(next);
                            if (next.length === 0) setStep('select');
                            else if (activeQueueIdx >= next.length) {
                              setActiveQueueIdx(next.length - 1);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-[#E45757] ucc-caption font-semibold cursor-pointer whitespace-nowrap flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove from Election</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-[#F5F7FB] rounded-b-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {step === 'select' ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 ucc-btn font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setErrorMsg('');
                  setStep(step === 'preview' ? 'configure' : 'select');
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 ucc-btn font-semibold hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'select' && (
              <button
                type="button"
                disabled={!liveAddGuard.allowed || uploadingTarget === 'new_permanent'}
                onClick={handleContinueFromSelect}
                className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>
                  {sourceTab === 'existing'
                    ? `Assign Position & Review (${selectedExistingIds.length})`
                    : 'Assign Position & Review Details'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 'configure' && (
              <button
                type="button"
                disabled={Boolean(uploadingTarget)}
                onClick={handleGoToPreview}
                className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Preview &amp; Confirm</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 'preview' && (
              <button
                type="button"
                disabled={saving || queuedItems.length === 0 || !liveAddGuard.allowed}
                onClick={handleConfirmAndAdd}
                className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-teal-600 text-white ucc-btn font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>
                  {saving
                    ? 'Saving to Firestore...'
                    : queuedItems.length === 1
                    ? 'Confirm and Add Candidate'
                    : `Confirm and Add ${queuedItems.length} Candidates`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
