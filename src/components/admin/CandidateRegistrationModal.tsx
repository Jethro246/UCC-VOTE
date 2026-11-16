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
  const { elections, positionsByElection, admin, registerCandidateAction, updateCandidateAction, student } = useApp();

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
  const [photoStoragePath, setPhotoStoragePath] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);
  const [uploadSessionKey, setUploadSessionKey] = useState('');
  const [biography, setBiography] = useState('');
  const [manifestoSummary, setManifestoSummary] = useState('');
  const [fullManifestoText, setFullManifestoText] = useState('');
  const [keyPromisesText, setKeyPromisesText] = useState('');
  const [leadershipExpText, setLeadershipExpText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const [availablePositions, setAvailablePositions] = useState<Position[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const activeUploadRef = useRef<UploadTaskHandle | null>(null);
  const uploadAttemptRef = useRef(0);
  const localPreviewRef = useRef('');

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
      cancelOngoingPhotoUpload();
      revokeLocalPreview();
    };
  }, []);

  const hallOptions = [
    'Casely Hayford Hall',
    'Valco Hall',
    'Kwame Nkrumah Hall',
    'Oguaa Hall',
    'Atlantic Hall',
    'Adehye Hall',
    'Superannuation Hostel',
    'SRC Hostel',
    'University Hall'
  ];

  const facultyOptions = [
    'School of Physical Sciences',
    'Faculty of Arts',
    'School of Business',
    'Faculty of Educational Foundations',
    'School of Biological Sciences',
    'School of Medical Sciences',
    'Faculty of Social Sciences',
    'School of Agriculture'
  ];

  // Prefill when editing or opening
  useEffect(() => {
    cancelOngoingPhotoUpload();
    revokeLocalPreview();
    setUploadSessionKey(`cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    if (candidateToEdit) {
      setFullName(candidateToEdit.fullName);
      setStudentId(candidateToEdit.studentId);
      setNickname(candidateToEdit.nickname || '');
      setEmail(candidateToEdit.email || '');
      setDepartment(candidateToEdit.department);
      setFaculty(candidateToEdit.faculty);
      setProgramme(candidateToEdit.programme || '');
      setLevel(candidateToEdit.level as any || '300');
      setHall(candidateToEdit.hall);
      setSelectedElectionId(candidateToEdit.electionId);
      setSelectedPositionId(candidateToEdit.positionId);
      setPhotoUrl(candidateToEdit.photoUrl || '');
      setPhotoStoragePath(candidateToEdit.photoStoragePath || '');
      setUploadStatus(candidateToEdit.photoUrl ? 'success' : 'idle');
      setUploadProgress(candidateToEdit.photoUrl ? 100 : null);
      setBiography(candidateToEdit.biography || '');
      setManifestoSummary(candidateToEdit.manifestoSummary);
      setFullManifestoText(candidateToEdit.fullManifesto.join('\n'));
      setKeyPromisesText(candidateToEdit.keyPromises.join('\n'));
      setLeadershipExpText(candidateToEdit.leadershipExperience.join('\n'));
      setVideoUrl(candidateToEdit.videoUrl || '');
    } else {
      const initialElection = defaultElectionId || (elections[0]?.id || '');
      setSelectedElectionId(initialElection);
      setSelectedPositionId(defaultPositionId || '');

      if (student) {
        setFullName(student.fullName);
        setStudentId(student.studentId);
        setEmail(student.email);
        setDepartment(student.department);
        setFaculty(student.faculty);
        setProgramme(student.programme);
        setLevel(student.level as any);
        setHall(student.hall);
      } else {
        setFullName('');
        setStudentId('');
        setEmail('');
        setDepartment('');
        setFaculty(facultyOptions[0]);
        setProgramme('');
        setLevel('300');
        setHall(hallOptions[0]);
      }
      setNickname('');
      setBiography('');
      setManifestoSummary('');
      setFullManifestoText('');
      setKeyPromisesText('');
      setLeadershipExpText('');
      setVideoUrl('');
      setPhotoUrl('');
      setPhotoStoragePath('');
      setUploadStatus('idle');
      setUploadProgress(null);
    }
    setUploadingPhoto(false);
    setUploadError('');
    setLastSelectedFile(null);
    setErrorMsg('');
    setSuccessMsg('');
  }, [candidateToEdit, defaultElectionId, defaultPositionId, isOpen, student]);

  // Load positions for selected election from live positionsByElection or Firestore
  useEffect(() => {
    if (!selectedElectionId) {
      setAvailablePositions([]);
      return;
    }
    const cached = positionsByElection[selectedElectionId];
    if (cached && cached.length > 0) {
      setAvailablePositions(cached);
      if (!candidateToEdit && !defaultPositionId) {
        setSelectedPositionId((prev) =>
          cached.some((p) => p.id === prev) ? prev : cached[0].id
        );
      }
      return;
    }
    async function loadPositions() {
      const res = await electionClient.getElectionById(selectedElectionId);
      if (res.success && Array.isArray(res.positions)) {
        setAvailablePositions(res.positions);
        if (!candidateToEdit && !defaultPositionId && res.positions.length > 0) {
          setSelectedPositionId(res.positions[0].id);
        }
      } else {
        setAvailablePositions([]);
      }
    }
    loadPositions();
  }, [selectedElectionId, candidateToEdit, defaultPositionId, positionsByElection]);

  if (!isOpen) return null;

  const handleClose = () => {
    cancelOngoingPhotoUpload();
    revokeLocalPreview();
    onClose();
  };

  const handlePhotoFileUpload = async (file: File) => {
    setErrorMsg('');
    setUploadError('');

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

  const handleSubmit = async (isDraft: boolean) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (uploadingPhoto) {
      setErrorMsg('Photograph upload is still in progress. Please wait until it finishes or cancel the upload before saving.');
      return;
    }

    if (!fullName.trim() || !studentId.trim() || !selectedElectionId || !selectedPositionId) {
      setErrorMsg('Please complete all required fields: Full Name, Student ID, Election, and Position.');
      return;
    }

    if (!isDraft && (!manifestoSummary.trim() || !fullManifestoText.trim())) {
      setErrorMsg('For official submission, a manifesto summary and full manifesto points are required.');
      return;
    }

    const cleanPhotoUrl = photoUrl.trim();
    if (cleanPhotoUrl.startsWith('blob:')) {
      setErrorMsg('Candidate photograph has not finished uploading to Firebase Storage. Please wait or retry uploading.');
      return;
    }

    setIsSubmitting(true);

    const fullManifesto = fullManifestoText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const keyPromises = keyPromisesText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const leadershipExperience = leadershipExpText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      fullName: fullName.trim(),
      studentId: studentId.trim().toUpperCase(),
      nickname: nickname.trim() || undefined,
      email: email.trim(),
      department: department.trim(),
      faculty: faculty.trim(),
      programme: programme.trim(),
      level,
      hall,
      electionId: selectedElectionId,
      positionId: selectedPositionId,
      photoUrl: cleanPhotoUrl,
      photoStoragePath: cleanPhotoUrl && photoStoragePath ? photoStoragePath : undefined,
      biography: biography.trim(),
      manifestoSummary: manifestoSummary.trim() || 'Committed to student welfare and academic advancement.',
      fullManifesto: fullManifesto.length > 0 ? fullManifesto : ['Advancing university student welfare and transparent representation.'],
      keyPromises: keyPromises.length > 0 ? keyPromises : ['Prompt handling of student academic grievances'],
      leadershipExperience: leadershipExperience.length > 0 ? leadershipExperience : ['Active member of UCC Student Body'],
      videoUrl: videoUrl.trim() || undefined,
      isDraft
    };

    try {
      if (candidateToEdit) {
        const res = await updateCandidateAction(candidateToEdit.id, {
          ...payload,
          resubmit: !isDraft && (candidateToEdit.applicationStatus === 'Draft' || candidateToEdit.applicationStatus === 'Rejected')
        });
        if (res.success) {
          setSuccessMsg('Candidate details updated successfully.');
          setTimeout(() => {
            handleClose();
          }, 1000);
        } else {
          setErrorMsg(res.error || 'Failed to update candidate record.');
        }
      } else {
        const res = await registerCandidateAction(payload);
        if (res.success) {
          setSuccessMsg(isDraft ? 'Nomination saved as Draft.' : 'Nomination submitted successfully for vetting clearance!');
          setTimeout(() => {
            handleClose();
          }, 1200);
        } else {
          setErrorMsg(res.error || 'Failed to register candidate.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                {candidateToEdit ? 'Edit Candidate Dossier' : 'Candidate Nomination & Application Form'}
              </h2>
              <p className="text-xs text-blue-100">
                Official Electoral Commission Aspirant Registry · University of Cape Coast
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SECTION 1: Personal & Student Identity */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>1. Aspirant Identity & Academic Credentials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Nana Akua Afriyie Osei"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. ED/EPS/21/0034"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campaign Nickname / Moniker
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Iron Lady of Cape Coast"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  University Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@st.ucc.edu.gh"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Faculty or School <span className="text-red-500">*</span>
                </label>
                <select
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white"
                >
                  {facultyOptions.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Educational Foundations"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Programme of Study <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  placeholder="e.g. B.Ed. Psychology and Foundations"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Academic Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white"
                >
                  <option value="100">Level 100</option>
                  <option value="200">Level 200</option>
                  <option value="300">Level 300</option>
                  <option value="400">Level 400</option>
                  <option value="Postgraduate">Postgraduate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hall of Residence <span className="text-red-500">*</span>
                </label>
                <select
                  value={hall}
                  onChange={(e) => setHall(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white"
                >
                  {hallOptions.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Election & Contested Portfolio */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>2. Election Target & Position Contested</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Election <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedElectionId}
                  onChange={(e) => setSelectedElectionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white"
                >
                  {selectableElections.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.title} · {el.category} ({el.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Position Being Contested <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPositionId}
                  onChange={(e) => setSelectedPositionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white"
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
              </div>
            </div>
          </div>

          {/* SECTION 3: Profile Photograph */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>3. Candidate Profile Photograph (Firebase Storage)</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0 relative">
                <CandidateAvatar
                  src={localPreviewUrl || photoUrl}
                  alt={fullName || 'Candidate preview'}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-[#123B70] shadow-sm"
                />
                <span className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-[#123B70] text-white text-[9px] font-bold rounded-full">
                  {uploadingPhoto ? 'UPLOADING' : 'PREVIEW'}
                </span>
              </div>

              <div className="space-y-3 flex-1 min-w-0 w-full">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Upload Official Candidate Portrait (JPEG, PNG or WebP, max 5 MB):
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-colors ${
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
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel Upload</span>
                      </button>
                    )}
                  </div>

                  {uploadingPhoto && uploadProgress !== null && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#123B70]">
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
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {uploadProgress === 100
                          ? 'Upload complete (100%) — Candidate portrait ready.'
                          : 'Verified portrait attached.'}
                      </span>
                    </div>
                  )}

                  {!uploadingPhoto && uploadStatus === 'error' && uploadError && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span>{uploadError}</span>
                      </div>
                      {lastSelectedFile && (
                        <button
                          type="button"
                          onClick={() => handlePhotoFileUpload(lastSelectedFile)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry Upload</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Or Paste Verified Image URL:
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      revokeLocalPreview();
                      setPhotoUrl(val);
                      setPhotoStoragePath('');
                      setUploadError('');
                      setUploadProgress(null);
                      setUploadStatus(val.trim().startsWith('http') ? 'success' : 'idle');
                    }}
                    placeholder="https://firebasestorage.googleapis.com/..."
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Biography & Leadership Experience */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>4. Biography & Track Record</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Candidate Biography (Overview & Background)
                </label>
                <textarea
                  rows={3}
                  value={biography}
                  onChange={(e) => setBiography(e.target.value)}
                  placeholder="Provide a comprehensive academic, leadership, and personal background summary..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Leadership Experience & Accomplishments (One per line)
                </label>
                <textarea
                  rows={3}
                  value={leadershipExpText}
                  onChange={(e) => setLeadershipExpText(e.target.value)}
                  placeholder="SRC Welfare Committee Chairperson (2024/2025)&#10;Adehye Hall Academic Secretary (2023/2024)&#10;UCC Debate Lead Delegate"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Manifesto & Promises */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#123B70] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>5. Manifesto, Pledges & Campaign Media</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manifesto Elevator Summary <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manifestoSummary}
                  onChange={(e) => setManifestoSummary(e.target.value)}
                  placeholder="A concise 1-2 sentence core campaign message or slogan"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Manifesto Pillars & Policy Proposals (One per line) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={fullManifestoText}
                  onChange={(e) => setFullManifestoText(e.target.value)}
                  placeholder="Overhaul and expansion of the intra-campus shuttle network with real-time tracking&#10;Solar-powered study pavilions across Old Site and New Site&#10;Establishing the GH₵250,000 UCC Student Enterprise Seed Grant"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Concrete Campaign Promises (Pledges to Students - One per line)
                </label>
                <textarea
                  rows={3}
                  value={keyPromisesText}
                  onChange={(e) => setKeyPromisesText(e.target.value)}
                  placeholder="24/7 charging zones in lecture theatres&#10;Direct Dean-Student quarterly open town halls&#10;Free digital textbook and recorded lecture repository"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-[#123B70]" />
                  <span>Optional Campaign Video URL (YouTube, Vimeo or MP4 stream)</span>
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {candidateToEdit ? (
              <span>Status: <strong className="text-[#123B70]">{candidateToEdit.applicationStatus}</strong></span>
            ) : (
              <span>All applications undergo SIS registry validation before appearing on official ballots.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {!candidateToEdit && (
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              >
                Save as Draft
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : (
                <span>{candidateToEdit ? 'Save Changes' : 'Submit Application'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
