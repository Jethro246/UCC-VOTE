import React, { useState, useEffect } from 'react';
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
  HelpCircle
} from 'lucide-react';
import { Candidate, Position } from '../../types';
import { 
  CANDIDATE_MALE_IMAGE, 
  CANDIDATE_FEMALE_IMAGE, 
  CANDIDATE_MALE_GLASSES_IMAGE, 
  CANDIDATE_FEMALE_SUIT_IMAGE 
} from '../../data/mockData';

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
  const { elections, registerCandidateAction, updateCandidateAction, student, userRole } = useApp();

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
  const [photoUrl, setPhotoUrl] = useState(CANDIDATE_MALE_GLASSES_IMAGE);
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

  // Sample portrait choices
  const portraitPresets = [
    { label: 'Male Formal (Navy)', url: CANDIDATE_MALE_GLASSES_IMAGE },
    { label: 'Female Formal (Burgundy)', url: CANDIDATE_FEMALE_SUIT_IMAGE },
    { label: 'Male Classic', url: CANDIDATE_MALE_IMAGE },
    { label: 'Female Classic', url: CANDIDATE_FEMALE_IMAGE },
  ];

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
      setPhotoUrl(candidateToEdit.photoUrl || CANDIDATE_MALE_GLASSES_IMAGE);
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

      // If student is logged in, autofill student info
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
        setDepartment('Computer Science & Information Technology');
        setFaculty('School of Physical Sciences');
        setProgramme('B.Sc. Computer Science');
        setLevel('300');
        setHall('Casely Hayford Hall');
      }
      setNickname('');
      setBiography('');
      setManifestoSummary('');
      setFullManifestoText('');
      setKeyPromisesText('');
      setLeadershipExpText('');
      setVideoUrl('');
      setPhotoUrl(CANDIDATE_MALE_GLASSES_IMAGE);
    }
    setErrorMsg('');
    setSuccessMsg('');
  }, [candidateToEdit, defaultElectionId, defaultPositionId, isOpen, student]);

  // Load positions for selected election
  useEffect(() => {
    if (!selectedElectionId) {
      setAvailablePositions([]);
      return;
    }
    async function loadPositions() {
      try {
        const res = await fetch(`/api/elections/${encodeURIComponent(selectedElectionId)}/positions`);
        const data = await res.json();
        if (data.success && Array.isArray(data.positions)) {
          setAvailablePositions(data.positions);
          if (!candidateToEdit && !defaultPositionId && data.positions.length > 0) {
            setSelectedPositionId(data.positions[0].id);
          }
        }
      } catch {
        // fallback
      }
    }
    loadPositions();
  }, [selectedElectionId, candidateToEdit, defaultPositionId]);

  if (!isOpen) return null;

  const handleSubmit = async (isDraft: boolean) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!fullName.trim() || !studentId.trim() || !selectedElectionId || !selectedPositionId) {
      setErrorMsg('Please complete all required fields: Full Name, Student ID, Election, and Position.');
      return;
    }

    if (!isDraft && (!manifestoSummary.trim() || !fullManifestoText.trim())) {
      setErrorMsg('For official submission, a manifesto summary and full manifesto points are required.');
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
      email: email.trim() || `${studentId.toLowerCase().replace(/\//g, '.')}@st.ucc.edu.gh`,
      department: department.trim(),
      faculty: faculty.trim(),
      programme: programme.trim(),
      level,
      hall,
      electionId: selectedElectionId,
      positionId: selectedPositionId,
      photoUrl,
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
            onClose();
          }, 1000);
        } else {
          setErrorMsg(res.error || 'Failed to update candidate record.');
        }
      } else {
        const res = await registerCandidateAction(payload);
        if (res.success) {
          setSuccessMsg(isDraft ? 'Nomination saved as Draft.' : 'Nomination submitted successfully for vetting clearance!');
          setTimeout(() => {
            onClose();
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
            onClick={onClose}
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
                  {elections.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.title} ({el.code})
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
              <span>3. Candidate Profile Photograph</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0 relative">
                <img
                  src={photoUrl}
                  alt="Candidate preview"
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-[#123B70] shadow-sm"
                />
                <span className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-[#123B70] text-white text-[9px] font-bold rounded-full">
                  PREVIEW
                </span>
              </div>

              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Select Official Studio Headshot Preset:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {portraitPresets.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setPhotoUrl(preset.url)}
                        className={`p-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                          photoUrl === preset.url
                            ? 'border-[#123B70] bg-[#EAF2FA] text-[#123B70] font-bold shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-6 h-6 rounded-lg object-cover" />
                        <span className="truncate">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Or Enter Direct Photo URL:
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://..."
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
              onClick={onClose}
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
