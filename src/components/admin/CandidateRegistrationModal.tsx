import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  UserPlus, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon,
  FileText,
  Video,
  Award,
  Sparkles,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { Candidate, Position } from '../../types';
import { CandidateAvatar } from '../common/CandidateAvatar';
import { electionClient } from '../../services/electionClient';
import {
  startCandidatePhotoUpload,
  validateCandidateImageFile,
  UploadTaskHandle,
} from '../../services/firebaseStorageService';
import {
  NON_RESIDENT_HALL_LABEL,
  getHallDisplayName,
  resolveElectionHallUnit,
} from '../../utils/hallUtils';
import {
  normalizeStudentId,
  resolveCandidatePhotoUrl,
} from '../../utils/contestantUtils';
import {
  CandidateFieldErrors,
  CandidateFieldKey,
  buildCandidateSubmissionPayload,
  generateCandidateDocId,
  runGuardedSubmission,
  validateCandidateApplicationForm,
} from '../../utils/candidateApplicationUtils';

interface CandidateRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateToEdit?: Candidate | null;
  defaultElectionId?: string;
  defaultPositionId?: string;
}

export const CandidateRegistrationModal: React.FC<CandidateRegistrationModalProps> = ({
  isOpen,
  onClose,
  candidateToEdit,
  defaultElectionId,
  defaultPositionId
}) => {
  const {
    elections,
    positionsByElection,
    contestants,
    halls,
    faculties,
    admin,
    registerCandidateAction,
    updateCandidateAction,
    updateElectionCandidateAction,
    student,
  } = useApp();

  const selectableElections = admin?.managedDomainIds?.length
    ? elections.filter((e) => !e.domainId || admin.managedDomainIds!.includes(e.domainId))
    : elections;

  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [faculty, setFaculty] = useState('');
  const [programme, setProgramme] = useState('');
  const [level, setLevel] = useState<'100' | '200' | '300' | '400' | 'Postgraduate'>('300');
  const [hall, setHall] = useState('Casely Hayford Hall');
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [electionPhotoUrl, setElectionPhotoUrl] = useState('');
  const [photoStoragePath, setPhotoStoragePath] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);
  const [uploadSessionKey, setUploadSessionKey] = useState('');
  const [biography, setBiography] = useState('');
  const [campaignStatement, setCampaignStatement] = useState('');
  const [manifestoSummary, setManifestoSummary] = useState('');
  const [fullManifestoText, setFullManifestoText] = useState('');
  const [keyPromisesText, setKeyPromisesText] = useState('');
  const [leadershipExpText, setLeadershipExpText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [confirmPermanentSync, setConfirmPermanentSync] = useState(false);
  const [historicalRole, setHistoricalRole] = useState<
    '' | 'Winner' | 'Contestant' | 'Elected' | 'Elected Unopposed'
  >('');
  const [historicalOutcomeNote, setHistoricalOutcomeNote] = useState('');

  const [availablePositions, setAvailablePositions] = useState<Position[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<'submit' | 'draft' | 'edit' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CandidateFieldErrors>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const activeUploadRef = useRef<UploadTaskHandle | null>(null);
  const uploadAttemptRef = useRef(0);
  const localPreviewRef = useRef('');
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const submittingRef = useRef(false);
  const sessionCandidateIdRef = useRef('');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFieldError = (key: CandidateFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const revokeLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = '';
    }
    setLocalPreviewUrl('');
  };

  const cancelOngoingPhotoUpload = () => {
    uploadAttemptRef.current += 1;
    if (activeUploadRef.current) {
      activeUploadRef.current.cancel();
      activeUploadRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      cancelOngoingPhotoUpload();
      revokeLocalPreview();
    };
  }, []);

  const hallOptions = [
    ...halls.map((h) => h.name),
    NON_RESIDENT_HALL_LABEL,
  ];

  const facultyOptions = faculties.map((f) => f.name);

  // Prefill ONLY when modal opens or target candidate/defaults change (never wipe on background profile ticks)
  useEffect(() => {
    if (!isOpen) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    cancelOngoingPhotoUpload();
    revokeLocalPreview();
    submittingRef.current = false;
    setIsSubmitting(false);
    setSubmittingMode(null);
    setUploadSessionKey(`cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    sessionCandidateIdRef.current = candidateToEdit ? candidateToEdit.id : generateCandidateDocId();

    if (candidateToEdit) {
      setFullName(candidateToEdit.fullName || '');
      setStudentId(candidateToEdit.studentId || '');
      setNickname(candidateToEdit.nickname || '');
      setEmail(candidateToEdit.email || '');
      setDepartment(candidateToEdit.department || '');
      setFaculty(candidateToEdit.faculty || '');
      setProgramme(candidateToEdit.programme || '');
      setLevel((candidateToEdit.level as any) || '300');
      setHall(candidateToEdit.hall || '');
      setSelectedElectionId(candidateToEdit.electionId || '');
      setSelectedPositionId(candidateToEdit.positionId || '');
      setPhotoUrl(candidateToEdit.photoUrl || '');
      setElectionPhotoUrl(candidateToEdit.electionPhotoUrl || '');
      setPhotoStoragePath(candidateToEdit.photoStoragePath || '');
      const resolvedUrl = resolveCandidatePhotoUrl(candidateToEdit);
      setUploadStatus(resolvedUrl ? 'success' : 'idle');
      setUploadProgress(resolvedUrl ? 100 : null);
      setBiography(candidateToEdit.biography || '');
      setCampaignStatement(candidateToEdit.campaignStatement || '');
      setManifestoSummary(candidateToEdit.manifestoSummary || '');
      setFullManifestoText(
        Array.isArray(candidateToEdit.fullManifesto)
          ? candidateToEdit.fullManifesto.join('\n')
          : ''
      );
      setKeyPromisesText(
        Array.isArray(candidateToEdit.keyPromises)
          ? candidateToEdit.keyPromises.join('\n')
          : ''
      );
      setLeadershipExpText(
        Array.isArray(candidateToEdit.leadershipExperience)
          ? candidateToEdit.leadershipExperience.join('\n')
          : ''
      );
      setVideoUrl(candidateToEdit.videoUrl || '');
      setHistoricalRole(candidateToEdit.historicalRole || '');
      setHistoricalOutcomeNote(candidateToEdit.historicalOutcomeNote || '');
      setConfirmPermanentSync(false);
    } else {
      const initialElectionId = defaultElectionId || (selectableElections[0]?.id || elections[0]?.id || '');
      const initialElectionObj = elections.find((e) => e.id === initialElectionId);
      const initialElectionHall = initialElectionObj ? resolveElectionHallUnit(initialElectionObj, halls) : undefined;
      setSelectedElectionId(initialElectionId);
      setSelectedPositionId(defaultPositionId || '');

      if (student) {
        setFullName(student.fullName || '');
        setStudentId(student.studentId || '');
        setEmail(student.email || '');
        setDepartment(student.department || '');
        setFaculty(student.faculty || '');
        setProgramme(student.programme || '');
        setLevel((student.level as any) || '300');
        setHall(student.hall || initialElectionHall?.name || '');
      } else {
        setFullName('');
        setStudentId('');
        setEmail('');
        setDepartment('');
        setFaculty(facultyOptions[0] || '');
        setProgramme('');
        setLevel('300');
        setHall(initialElectionHall?.name || hallOptions[0] || '');
      }
      setNickname('');
      setBiography('');
      setCampaignStatement('');
      setManifestoSummary('');
      setFullManifestoText('');
      setKeyPromisesText('');
      setLeadershipExpText('');
      setVideoUrl('');
      setHistoricalRole('');
      setHistoricalOutcomeNote('');
      setPhotoUrl('');
      setElectionPhotoUrl('');
      setPhotoStoragePath('');
      setConfirmPermanentSync(false);
      setUploadStatus('idle');
      setUploadProgress(null);
    }
    setUploadingPhoto(false);
    setUploadError('');
    setLastSelectedFile(null);
    setFieldErrors({});
    setErrorMsg('');
    setSuccessMsg('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, candidateToEdit?.id, defaultElectionId, defaultPositionId]);

  // Ensure an election is selected if elections finish loading right after modal open
  useEffect(() => {
    if (!isOpen || candidateToEdit || selectedElectionId) return;
    const fallbackId = defaultElectionId || selectableElections[0]?.id || elections[0]?.id || '';
    if (fallbackId) {
      setSelectedElectionId(fallbackId);
    }
  }, [isOpen, candidateToEdit, selectedElectionId, defaultElectionId, selectableElections, elections]);

  // Load positions for selected election from live positionsByElection or Firestore
  useEffect(() => {
    if (!selectedElectionId) {
      setAvailablePositions([]);
      return;
    }
    const cached = positionsByElection[selectedElectionId];
    if (cached && cached.length > 0) {
      setAvailablePositions(cached);
      setSelectedPositionId((prev) => {
        if (prev && cached.some((p) => p.id === prev)) return prev;
        if (candidateToEdit && candidateToEdit.electionId === selectedElectionId && candidateToEdit.positionId) {
          return candidateToEdit.positionId;
        }
        if (defaultPositionId && cached.some((p) => p.id === defaultPositionId)) {
          return defaultPositionId;
        }
        return cached[0].id;
      });
      return;
    }
    let active = true;
    async function loadPositions() {
      const res = await electionClient.getElectionById(selectedElectionId);
      if (!active) return;
      if (res.success && Array.isArray(res.positions)) {
        setAvailablePositions(res.positions);
        if (res.positions.length > 0) {
          setSelectedPositionId((prev) => {
            if (prev && res.positions!.some((p) => p.id === prev)) return prev;
            if (defaultPositionId && res.positions!.some((p) => p.id === defaultPositionId)) {
              return defaultPositionId;
            }
            return res.positions![0].id;
          });
        }
      } else {
        setAvailablePositions([]);
      }
    }
    loadPositions();
    return () => {
      active = false;
    };
  }, [selectedElectionId, candidateToEdit, defaultPositionId, positionsByElection]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    cancelOngoingPhotoUpload();
    revokeLocalPreview();
    onClose();
  };

  const handlePhotoFileUpload = async (file: File) => {
    setErrorMsg('');
    setUploadError('');
    clearFieldError('photoUrl');

    const validation = await validateCandidateImageFile(file);
    if (!validation.valid) {
      setUploadingPhoto(false);
      setUploadProgress(null);
      setUploadStatus('error');
      setUploadError(validation.error);
      setLastSelectedFile(null);
      return;
    }

    cancelOngoingPhotoUpload();
    revokeLocalPreview();

    const attemptId = ++uploadAttemptRef.current;
    const previewObjectUrl = URL.createObjectURL(file);
    localPreviewRef.current = previewObjectUrl;
    setLocalPreviewUrl(previewObjectUrl);
    setLastSelectedFile(file);
    setUploadingPhoto(true);
    setUploadStatus('uploading');
    setUploadProgress(0);

    const candidateKey =
      candidateToEdit?.id ||
      (studentId.trim()
        ? `${studentId.trim()}_${uploadSessionKey}`
        : uploadSessionKey || `cand_${Date.now()}`);

    const handle = startCandidatePhotoUpload(file, candidateKey, (pct) => {
      if (uploadAttemptRef.current !== attemptId) return;
      setUploadProgress(pct);
    });
    activeUploadRef.current = handle;

    try {
      const uploaded = await handle.promise;
      if (uploadAttemptRef.current !== attemptId) return;

      if (!uploaded?.url || !uploaded.url.startsWith('http')) {
        throw new Error('Firebase Storage returned an invalid download URL.');
      }

      setPhotoUrl(uploaded.url);
      setPhotoStoragePath(uploaded.path);
      revokeLocalPreview();
      setUploadProgress(100);
      setUploadStatus('success');
      setUploadError('');
    } catch (err: any) {
      if (uploadAttemptRef.current !== attemptId) return;
      setUploadStatus('error');
      setUploadProgress(null);
      setUploadError(err?.message || 'Failed to upload candidate photograph.');
    } finally {
      if (uploadAttemptRef.current === attemptId) {
        activeUploadRef.current = null;
        setUploadingPhoto(false);
      }
    }
  };

  const handleCancelPhotoUpload = () => {
    activeUploadRef.current?.cancel();
  };

  const scrollToValidationProblem = (firstField?: CandidateFieldKey) => {
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    if (firstField && modalBodyRef.current) {
      const el = modalBodyRef.current.querySelector<HTMLElement>(`[data-field="${firstField}"]`);
      if (el) {
        el.focus({ preventScroll: true });
      }
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (submittingRef.current) return;

    setErrorMsg('');
    setSuccessMsg('');

    const validation = validateCandidateApplicationForm(
      {
        fullName,
        studentId,
        nickname,
        email,
        faculty,
        department,
        programme,
        level,
        hall,
        selectedElectionId,
        selectedPositionId,
        photoUrl,
        electionPhotoUrl,
        photoStoragePath,
        biography,
        campaignStatement,
        manifestoSummary,
        fullManifestoText,
        keyPromisesText,
        leadershipExpText,
        videoUrl,
        confirmPermanentSync,
        historicalRole,
        historicalOutcomeNote,
      },
      {
        isDraft,
        uploadingPhoto,
        candidateToEdit,
        elections,
        availablePositions,
        halls,
        contestants,
        isAdmin: Boolean(admin),
      }
    );

    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setErrorMsg(
        validation.errorMessage || 'Please complete all highlighted required fields before submitting.'
      );
      scrollToValidationProblem(validation.firstErrorField);
      return;
    }

    setFieldErrors({});

    const isResubmitting =
      Boolean(candidateToEdit) &&
      !isDraft &&
      (candidateToEdit?.applicationStatus === 'Draft' ||
        candidateToEdit?.applicationStatus === 'Rejected');

    const mode: 'submit' | 'draft' | 'edit' = isDraft
      ? 'draft'
      : !candidateToEdit || isResubmitting
      ? 'submit'
      : 'edit';

    const permanentChangedWhenEditing =
      Boolean(candidateToEdit) &&
      (fullName.trim() !== (candidateToEdit?.fullName || '').trim() ||
        normalizeStudentId(studentId) !== normalizeStudentId(candidateToEdit?.studentId) ||
        department.trim() !== (candidateToEdit?.department || '').trim() ||
        faculty.trim() !== (candidateToEdit?.faculty || '').trim() ||
        programme.trim() !== (candidateToEdit?.programme || '').trim() ||
        level !== (candidateToEdit?.level || '') ||
        hall !== (candidateToEdit?.hall || ''));

    const payload = buildCandidateSubmissionPayload(
      {
        fullName,
        studentId,
        nickname,
        email,
        faculty,
        department,
        programme,
        level,
        hall,
        selectedElectionId,
        selectedPositionId,
        photoUrl,
        electionPhotoUrl,
        photoStoragePath,
        biography,
        campaignStatement,
        manifestoSummary,
        fullManifestoText,
        keyPromisesText,
        leadershipExpText,
        videoUrl,
        confirmPermanentSync,
        historicalRole,
        historicalOutcomeNote,
      },
      {
        id: sessionCandidateIdRef.current || undefined,
        isDraft,
        candidateToEdit,
        elections,
        halls,
      }
    );

    await runGuardedSubmission(submittingRef, async () => {
      setIsSubmitting(true);
      setSubmittingMode(mode);

      try {
        if (candidateToEdit) {
          const res =
            admin && candidateToEdit.contestantId
              ? await updateElectionCandidateAction(candidateToEdit.id, {
                  positionId: selectedPositionId,
                  campaignStatement: campaignStatement.trim(),
                  manifestoSummary: manifestoSummary.trim(),
                  fullManifesto: payload.fullManifesto || [],
                  keyPromises: payload.keyPromises || [],
                  electionPhotoUrl: electionPhotoUrl.trim(),
                  videoUrl: videoUrl.trim() || undefined,
                  confirmPermanentUpdate: permanentChangedWhenEditing && confirmPermanentSync,
                  permanentProfileUpdates:
                    permanentChangedWhenEditing && confirmPermanentSync
                      ? {
                          fullName: payload.fullName,
                          studentId: payload.studentId,
                          nickname: payload.nickname,
                          email: payload.email,
                          department: payload.department,
                          faculty: payload.faculty,
                          programme: payload.programme,
                          level: payload.level,
                          hall: payload.hall,
                          photoUrl: payload.photoUrl,
                          biography: payload.biography,
                          leadershipExperience: payload.leadershipExperience || [],
                        }
                      : undefined,
                })
              : await updateCandidateAction(candidateToEdit.id, {
                  ...payload,
                  resubmit: isResubmitting,
                });

          if (res.success) {
            setSuccessMsg(
              isResubmitting
                ? 'Nomination submitted successfully for Electoral Commission review!'
                : isDraft
                ? 'Draft changes saved.'
                : 'Candidate details updated successfully.'
            );
            modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            closeTimerRef.current = setTimeout(() => {
              handleClose();
            }, 1000);
          } else {
            setErrorMsg(res.error || 'Failed to update candidate record.');
            modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          const res = await registerCandidateAction(payload);
          if (res.success) {
            setSuccessMsg(
              isDraft
                ? 'Nomination saved as Draft.'
                : 'Nomination submitted successfully for Electoral Commission review!'
            );
            modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            closeTimerRef.current = setTimeout(() => {
              handleClose();
            }, 1200);
          } else {
            setErrorMsg(res.error || 'Failed to register candidate application.');
            modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'An unexpected error occurred while saving your application.');
        modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        setIsSubmitting(false);
        setSubmittingMode(null);
      }
    });
  };

  const isDraftOrRejectedEdit =
    Boolean(candidateToEdit) &&
    (candidateToEdit?.applicationStatus === 'Draft' ||
      candidateToEdit?.applicationStatus === 'Rejected');

  const canSaveAsDraft =
    !candidateToEdit || candidateToEdit.applicationStatus === 'Draft';

  const primaryButtonIdleLabel = !candidateToEdit || candidateToEdit.applicationStatus === 'Draft'
    ? 'Submit Application'
    : candidateToEdit.applicationStatus === 'Rejected'
    ? 'Resubmit Application'
    : 'Save Changes';

  const primaryButtonLoadingLabel =
    submittingMode === 'edit' ? 'Saving Changes...' : 'Submitting Application...';

  const fieldBorder = (key: CandidateFieldKey) =>
    fieldErrors[key]
      ? 'border-red-400 bg-red-50/30 focus:border-red-600'
      : 'border-slate-300 focus:border-[#123B70]';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-[#123B70] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <UserPlus className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="ucc-heading-card text-white">
                {candidateToEdit ? 'Edit Candidate Dossier' : 'Candidate Nomination & Application Form'}
              </h2>
              <p className="ucc-body-secondary text-blue-100">
                Official Electoral Commission Aspirant Registry · University of Cape Coast
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(false);
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Modal Body */}
          <div ref={modalBodyRef} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
            
            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 ucc-body-secondary flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 ucc-body-secondary flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* SECTION 1: Personal & Student Identity */}
            <div className="space-y-4">
              <h3 className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>1. Aspirant Identity & Academic Credentials</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-field="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      clearFieldError('fullName');
                    }}
                    placeholder="e.g. Nana Akua Afriyie Osei"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none ${fieldBorder('fullName')}`}
                    required
                  />
                  {fieldErrors.fullName && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-field="studentId"
                    type="text"
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      clearFieldError('studentId');
                    }}
                    placeholder="e.g. ED/EPS/21/0034"
                    className={`w-full px-3 py-2 text-sm tabular-nums rounded-xl border focus:outline-none ${fieldBorder('studentId')}`}
                    required
                  />
                  {fieldErrors.studentId && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.studentId}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Campaign Nickname / Moniker
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. Iron Lady of Cape Coast"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    University Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-field="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                    }}
                    placeholder="e.g. name@st.ucc.edu.gh"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none ${fieldBorder('email')}`}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Faculty or School <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-field="faculty"
                    value={faculty}
                    onChange={(e) => {
                      setFaculty(e.target.value);
                      clearFieldError('faculty');
                    }}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none bg-white ${fieldBorder('faculty')}`}
                  >
                    <option value="">Select Faculty / School...</option>
                    {faculty === 'Not verified' && <option value="Not verified">Not verified</option>}
                    {facultyOptions.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                    {faculty &&
                      faculty !== 'Not verified' &&
                      !facultyOptions.includes(faculty) && (
                        <option value={faculty}>{faculty}</option>
                      )}
                  </select>
                  {fieldErrors.faculty && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.faculty}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-field="department"
                    type="text"
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      clearFieldError('department');
                    }}
                    placeholder="e.g. Educational Foundations"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none ${fieldBorder('department')}`}
                  />
                  {fieldErrors.department && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.department}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Programme of Study <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-field="programme"
                    type="text"
                    value={programme}
                    onChange={(e) => {
                      setProgramme(e.target.value);
                      clearFieldError('programme');
                    }}
                    placeholder="e.g. B.Ed. Psychology and Foundations"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none ${fieldBorder('programme')}`}
                  />
                  {fieldErrors.programme && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.programme}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Academic Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-field="level"
                    value={level}
                    onChange={(e) => {
                      setLevel(e.target.value as any);
                      clearFieldError('level');
                    }}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none bg-white ${fieldBorder('level')}`}
                  >
                    {(level as string) === 'Not verified' && (
                      <option value="Not verified">Not verified</option>
                    )}
                    <option value="100">Level 100</option>
                    <option value="200">Level 200</option>
                    <option value="300">Level 300</option>
                    <option value="400">Level 400</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                  {fieldErrors.level && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.level}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Hall of Residence <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-field="hall"
                    value={hall}
                    onChange={(e) => {
                      setHall(e.target.value);
                      clearFieldError('hall');
                    }}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none bg-white ${fieldBorder('hall')}`}
                  >
                    <option value="">Select Hall of Residence...</option>
                    {halls.map((h) => (
                      <option key={h.id} value={h.name}>
                        {getHallDisplayName(h)}
                      </option>
                    ))}
                    <option value={NON_RESIDENT_HALL_LABEL}>{NON_RESIDENT_HALL_LABEL}</option>
                    {!hallOptions.includes(hall) && hall && (
                      <option value={hall}>{hall}</option>
                    )}
                  </select>
                  {fieldErrors.hall && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.hall}</p>
                  )}
                </div>
              </div>

              {candidateToEdit?.isHistoricalRecord && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">
                      Historical Outcome Designation
                    </label>
                    <select
                      value={historicalRole}
                      onChange={(e) => setHistoricalRole(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white"
                    >
                      <option value="">None specified</option>
                      <option value="Winner">Winner</option>
                      <option value="Elected">Elected</option>
                      <option value="Elected Unopposed">Elected Unopposed</option>
                      <option value="Contestant">Contestant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1">
                      Historical Outcome Note
                    </label>
                    <input
                      type="text"
                      value={historicalOutcomeNote}
                      onChange={(e) => setHistoricalOutcomeNote(e.target.value)}
                      placeholder="Optional historical record note"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: Election & Contested Portfolio */}
            <div className="space-y-4">
              <h3 className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                <span>2. Election Target & Position Contested</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Target Election <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-field="selectedElectionId"
                    value={selectedElectionId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedElectionId(nextId);
                      setSelectedPositionId('');
                      clearFieldError('selectedElectionId');
                      clearFieldError('selectedPositionId');
                      const nextElection = elections.find((el) => el.id === nextId);
                      if (nextElection && !candidateToEdit && !student) {
                        const nextHall = resolveElectionHallUnit(nextElection, halls);
                        if (nextHall) setHall(nextHall.name);
                      }
                    }}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none bg-white ${fieldBorder('selectedElectionId')}`}
                  >
                    {selectableElections.length === 0 && (
                      <option value="">No elections currently available</option>
                    )}
                    {selectableElections.map((el) => (
                      <option key={el.id} value={el.id}>
                        {el.title} · {el.category} ({el.code})
                      </option>
                    ))}
                  </select>
                  {fieldErrors.selectedElectionId && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.selectedElectionId}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Position Being Contested <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-field="selectedPositionId"
                    value={selectedPositionId}
                    onChange={(e) => {
                      setSelectedPositionId(e.target.value);
                      clearFieldError('selectedPositionId');
                    }}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none bg-white ${fieldBorder('selectedPositionId')}`}
                    disabled={availablePositions.length === 0}
                  >
                    {availablePositions.length === 0 && (
                      <option value="">No positions configured for this election</option>
                    )}
                    {availablePositions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.selectedPositionId && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.selectedPositionId}</p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: Profile Photograph */}
            <div className="space-y-4">
              <h3 className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>3. Candidate Profile Photograph (Firebase Storage)</span>
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="shrink-0 relative">
                  <CandidateAvatar
                    src={localPreviewUrl || electionPhotoUrl || photoUrl}
                    alt={fullName || 'Candidate preview'}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-[#123B70] shadow-sm"
                  />
                  <span className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-[#123B70] text-white ucc-caption font-semibold rounded-full">
                    {uploadingPhoto ? 'UPLOADING' : 'PREVIEW'}
                  </span>
                </div>

                <div className="space-y-3 flex-1 min-w-0 w-full">
                  <div>
                    <label className="block ucc-label font-semibold text-slate-700 mb-1.5">
                      Upload Official Candidate Portrait (JPEG, PNG or WebP, max 5 MB):
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ucc-btn font-semibold transition-colors ${
                          uploadingPhoto
                            ? 'border-[#123B70]/50 bg-[#EAF2FA] text-[#123B70] cursor-wait'
                            : 'border-[#123B70] bg-[#EAF2FA]/60 hover:bg-[#EAF2FA] text-[#123B70] cursor-pointer'
                        }`}
                      >
                        {uploadingPhoto ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {uploadingPhoto
                            ? `Uploading ${uploadProgress ?? 0}%...`
                            : uploadStatus === 'success' && photoUrl
                            ? 'Change Photograph File'
                            : 'Choose Photograph File'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                          disabled={uploadingPhoto}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            handlePhotoFileUpload(file);
                          }}
                          className="hidden"
                        />
                      </label>

                      {uploadingPhoto && (
                        <button
                          type="button"
                          onClick={handleCancelPhotoUpload}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 ucc-btn font-semibold cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Cancel Upload</span>
                        </button>
                      )}
                    </div>

                    {!admin && (
                      <p className="mt-1.5 ucc-caption text-slate-500">
                        Direct portrait storage upload is reserved for Electoral Commission officers. Student applicants may paste a verified HTTPS portrait URL below or submit without a photo.
                      </p>
                    )}

                    {uploadingPhoto && uploadProgress !== null && (
                      <div className="mt-2.5 space-y-1">
                        <div className="flex items-center justify-between ucc-caption font-semibold text-[#123B70] tabular-nums">
                          <span>Uploading to Firebase Storage...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#123B70] h-full transition-all duration-150"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {!uploadingPhoto && uploadStatus === 'success' && photoUrl && (
                      <div className="mt-2 inline-flex items-center gap-1.5 ucc-caption font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {uploadProgress === 100
                            ? 'Upload complete (100%) — Candidate portrait ready.'
                            : 'Verified portrait attached.'}
                        </span>
                      </div>
                    )}

                    {!uploadingPhoto && uploadStatus === 'error' && uploadError && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 ucc-body-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span>{uploadError}</span>
                        </div>
                        {lastSelectedFile && (
                          <button
                            type="button"
                            onClick={() => handlePhotoFileUpload(lastSelectedFile)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white ucc-caption font-semibold shrink-0 cursor-pointer transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry Upload</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block ucc-label font-semibold text-slate-600 mb-1">
                      Or Paste Verified Image URL:
                    </label>
                    <input
                      data-field="photoUrl"
                      type="url"
                      value={photoUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        revokeLocalPreview();
                        setPhotoUrl(val);
                        setPhotoStoragePath('');
                        setUploadError('');
                        setUploadProgress(null);
                        clearFieldError('photoUrl');
                        setUploadStatus(val.trim().startsWith('http') ? 'success' : 'idle');
                      }}
                      placeholder="https://firebasestorage.googleapis.com/..."
                      className={`w-full px-3 py-1.5 text-sm rounded-xl border focus:outline-none ${fieldBorder('photoUrl')}`}
                    />
                    {fieldErrors.photoUrl && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.photoUrl}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: Biography & Leadership Experience */}
            <div className="space-y-4">
              <h3 className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>4. Biography & Track Record</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Candidate Biography (Overview & Background)
                  </label>
                  <textarea
                    rows={3}
                    value={biography}
                    onChange={(e) => setBiography(e.target.value)}
                    placeholder="Provide a comprehensive academic, leadership, and personal background summary..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Leadership Experience & Accomplishments (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={leadershipExpText}
                    onChange={(e) => setLeadershipExpText(e.target.value)}
                    placeholder="SRC Welfare Committee Chairperson (2024/2025)&#10;Adehye Hall Academic Secretary (2023/2024)&#10;UCC Debate Lead Delegate"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: Manifesto & Promises */}
            <div className="space-y-4">
              <h3 className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>5. Manifesto, Pledges & Campaign Media</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Campaign Statement / Tagline
                  </label>
                  <input
                    type="text"
                    value={campaignStatement}
                    onChange={(e) => setCampaignStatement(e.target.value)}
                    placeholder="Optional concise election tagline or vision statement"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Manifesto Elevator Summary <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-field="manifestoSummary"
                    type="text"
                    value={manifestoSummary}
                    onChange={(e) => {
                      setManifestoSummary(e.target.value);
                      clearFieldError('manifestoSummary');
                    }}
                    placeholder="A concise 1-2 sentence core campaign message or slogan"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none ${fieldBorder('manifestoSummary')}`}
                  />
                  {fieldErrors.manifestoSummary && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.manifestoSummary}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Full Manifesto Pillars & Policy Proposals (One per line) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    data-field="fullManifestoText"
                    rows={4}
                    value={fullManifestoText}
                    onChange={(e) => {
                      setFullManifestoText(e.target.value);
                      clearFieldError('fullManifestoText');
                    }}
                    placeholder="Overhaul and expansion of the intra-campus shuttle network with real-time tracking&#10;Solar-powered study pavilions across Old Site and New Site&#10;Establishing the GH₵250,000 UCC Student Enterprise Seed Grant"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none ${fieldBorder('fullManifestoText')}`}
                  />
                  {fieldErrors.fullManifestoText && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.fullManifestoText}</p>
                  )}
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1">
                    Concrete Campaign Promises (Pledges to Students - One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={keyPromisesText}
                    onChange={(e) => setKeyPromisesText(e.target.value)}
                    placeholder="24/7 charging zones in lecture theatres&#10;Direct Dean-Student quarterly open town halls&#10;Free digital textbook and recorded lecture repository"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  />
                </div>

                <div>
                  <label className="block ucc-label font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-[#123B70]" />
                    <span>Optional Campaign Video URL (YouTube, Vimeo or MP4 stream)</span>
                  </label>
                  <input
                    data-field="videoUrl"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      clearFieldError('videoUrl');
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none ${fieldBorder('videoUrl')}`}
                  />
                  {fieldErrors.videoUrl && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.videoUrl}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Permanent profile confirmation if editing linked contestant */}
          {admin &&
            candidateToEdit?.contestantId &&
            (fullName.trim() !== (candidateToEdit.fullName || '').trim() ||
              normalizeStudentId(studentId) !== normalizeStudentId(candidateToEdit.studentId) ||
              department.trim() !== (candidateToEdit.department || '').trim() ||
              faculty.trim() !== (candidateToEdit.faculty || '').trim() ||
              programme.trim() !== (candidateToEdit.programme || '').trim() ||
              level !== (candidateToEdit.level || '') ||
              hall !== (candidateToEdit.hall || '')) && (
              <div className="mx-6 mb-3 p-3 rounded-xl bg-amber-50 border border-amber-300 ucc-body-secondary text-amber-950">
                <label className="flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    data-field="confirmPermanentSync"
                    type="checkbox"
                    checked={confirmPermanentSync}
                    onChange={(e) => {
                      setConfirmPermanentSync(e.target.checked);
                      clearFieldError('confirmPermanentSync');
                    }}
                    className="rounded text-[#123B70]"
                  />
                  <span>
                    I confirm updating this contestant&apos;s shared permanent profile across UCC VOTE
                  </span>
                </label>
                {fieldErrors.confirmPermanentSync && (
                  <p className="text-xs text-red-700 mt-1">{fieldErrors.confirmPermanentSync}</p>
                )}
              </div>
            )}

          {/* Modal Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col gap-2.5 shrink-0">
            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="ucc-body-secondary text-slate-500">
                {candidateToEdit ? (
                  <span>
                    Status: <strong className="text-[#123B70]">{candidateToEdit.applicationStatus}</strong>
                    {isDraftOrRejectedEdit && (
                      <span> · Submitting sends your dossier for Electoral Commission review.</span>
                    )}
                  </span>
                ) : (
                  <span>All applications undergo SIS registry validation before appearing on official ballots.</span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 ucc-btn font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                {canSaveAsDraft && (
                  <button
                    type="button"
                    onClick={() => void handleSubmit(true)}
                    disabled={isSubmitting}
                    className="px-4 py-2 ucc-btn font-semibold rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting && submittingMode === 'draft' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Draft...</span>
                      </>
                    ) : (
                      <span>Save as Draft</span>
                    )}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 ucc-btn font-semibold rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-70"
                >
                  {isSubmitting && submittingMode !== 'draft' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{primaryButtonLoadingLabel}</span>
                    </>
                  ) : (
                    <span>{primaryButtonIdleLabel}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

