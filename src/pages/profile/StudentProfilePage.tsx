import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authClient } from '../../services/authClient';
import { Logo, BrandedLoadingScreen } from '../../components/common/Logo';
import { CandidateAvatar } from '../../components/common/CandidateAvatar';
import { NON_RESIDENT_HALL_LABEL, getHallDisplayName } from '../../utils/hallUtils';
import { formatNumber } from '../../utils/numberFormat';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  Phone, 
  History, 
  AlertCircle,
  Save,
  ShieldAlert
} from 'lucide-react';

export const StudentProfilePage: React.FC = () => {
  const {
    student,
    userRole,
    sessionChecked,
    sessionExpiredReason,
    setPostLoginView,
    navigateTo,
    voteConfirmations,
    updateStudentProfile,
    halls,
    faculties,
    departments,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'history'>('profile');

  // Editable personal fields (hooks declared unconditionally at top)
  const [phone, setPhone] = useState(student?.phone || '');
  const [emergencyContact, setEmergencyContact] = useState(student?.emergencyContact || '');
  const [notifPrefs, setNotifPrefs] = useState(
    student?.notificationPreferences || {
      emailAlerts: true,
      smsBulletins: true,
      resultsAnnouncements: true
    }
  );

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  const [tamperingSecurityAlert, setTamperingSecurityAlert] = useState('');

  // Initial UCC institutional fields for Google Sign-Up users who haven't submitted them yet
  const [instStudentId, setInstStudentId] = useState(student?.studentId || '');
  const [instIndexNumber, setInstIndexNumber] = useState(student?.indexNumber || '');
  const [instFullName, setInstFullName] = useState(student?.fullName || '');
  const [instFaculty, setInstFaculty] = useState(student?.faculty || faculties[0]?.name || '');
  const [instDepartment, setInstDepartment] = useState(student?.department || departments[0]?.name || '');
  const [instProgramme, setInstProgramme] = useState(student?.programme || departments[0]?.programmes?.[0] || '');
  const [instLevel, setInstLevel] = useState<'100' | '200' | '300' | '400' | 'Postgraduate'>(student?.level || '100');
  const [instHall, setInstHall] = useState(student?.hall || halls[0]?.name || '');
  const [instMsg, setInstMsg] = useState('');
  const [instErr, setInstErr] = useState('');
  const [isSavingInst, setIsSavingInst] = useState(false);

  React.useEffect(() => {
    if (student) {
      setPhone(student.phone || '');
      setEmergencyContact(student.emergencyContact || '');
      setNotifPrefs(
        student.notificationPreferences || {
          emailAlerts: true,
          smsBulletins: true,
          resultsAnnouncements: true
        }
      );
      setInstFullName(student.fullName || '');
      if (student.studentId) setInstStudentId(student.studentId);
      if (student.indexNumber) setInstIndexNumber(student.indexNumber);
      if (student.faculty) setInstFaculty(student.faculty);
      if (student.department) setInstDepartment(student.department);
      if (student.programme) setInstProgramme(student.programme);
      if (student.level) setInstLevel(student.level);
      if (student.hall) setInstHall(student.hall);
    }
  }, [student?.id, student?.phone, student?.emergencyContact, student?.studentId]);

  React.useEffect(() => {
    if (!instHall && halls.length > 0) {
      setInstHall(halls[0].name);
    }
  }, [instHall, halls]);

  if (!sessionChecked) {
    return (
      <BrandedLoadingScreen
        title="Verifying your secure voting session..."
        subtitle="Restoring your authenticated UCC student profile..."
      />
    );
  }

  if (userRole !== 'student' || !student) {
    const isExpired = Boolean(sessionExpiredReason);
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5 text-center">
          <div className="flex justify-center">
            <Logo variant="default" layout="stacked" subtitle="Student Profile" />
          </div>
          <h1 className="ucc-heading-section text-slate-900">
            {isExpired ? 'Your Session Has Expired' : 'Student Sign-In Required'}
          </h1>
          <p className="ucc-body-secondary text-slate-600">
            {sessionExpiredReason || 'Sign in with your verified UCC Student ID to access your voter profile.'}
          </p>
          <button
            onClick={() => {
              setPostLoginView('student_profile');
              navigateTo('student_login');
            }}
            className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold cursor-pointer"
          >
            {isExpired ? 'Log In Again' : 'Sign In as Student'}
          </button>
        </div>
      </div>
    );
  }

  const currentStudent = student;

  const handleSavePermittedDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setSaveSuccessMsg('');
    setTamperingSecurityAlert('');

    const success = await updateStudentProfile({
      phone,
      emergencyContact,
      notificationPreferences: notifPrefs
    });

    setIsSavingProfile(false);
    if (success) {
      setSaveSuccessMsg('Personal contact details and notification preferences successfully saved.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    }
  };

  const handleTestTampering = async () => {
    setTamperingSecurityAlert('');
    try {
      const res = await authClient.updateProfile({ attemptedIdentityChange: true });
      if (!res.success) {
        setTamperingSecurityAlert(res.error || 'Server actively blocked unauthorized identity tampering.');
      }
    } catch (err: any) {
      setTamperingSecurityAlert(err.message || 'Server rejected identity modification.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdError('');

    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    setIsChangingPwd(true);
    try {
      const res = await authClient.changePassword({ currentPassword, newPassword, confirmPassword });
      setIsChangingPwd(false);
      if (res.success) {
        setPwdMsg('Password updated successfully. Prior sessions have been validated.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwdError(res.error || 'Failed to change password. Verify your current password.');
      }
    } catch (err: any) {
      setIsChangingPwd(false);
      setPwdError(err.message || 'Network error.');
    }
  };

  const handleSaveInitialInstitutional = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstMsg('');
    setInstErr('');

    if (!instStudentId.trim() || !instIndexNumber.trim() || !instFullName.trim() || !instFaculty.trim() || !instDepartment.trim() || !instHall.trim()) {
      setInstErr('Please complete all required UCC identification fields.');
      return;
    }

    setIsSavingInst(true);
    const res = await authClient.completeInitialInstitutionalDetails({
      studentId: instStudentId,
      indexNumber: instIndexNumber,
      fullName: instFullName,
      phone,
      faculty: instFaculty,
      department: instDepartment,
      programme: instProgramme || instDepartment,
      level: instLevel,
      hall: instHall,
    });
    setIsSavingInst(false);

    if (!res.success) {
      setInstErr(res.error || 'Unable to save student identification details.');
      return;
    }

    setInstMsg(res.message || 'UCC student identification saved.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-6 max-md:gap-3">
        <CandidateAvatar
          src={currentStudent.avatarUrl || currentStudent.photoUrl}
          alt={currentStudent.fullName}
          className="w-24 h-24 sm:w-28 sm:h-28 max-md:w-16 max-md:h-16 max-md:rounded-xl rounded-2xl object-cover border-2 border-slate-200 shadow-md shrink-0 text-2xl"
        />

        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
          {currentStudent.status === 'suspended' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 ucc-caption font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Account Suspended</span>
            </div>
          ) : currentStudent.isEligible ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 ucc-caption font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Eligible Voter</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 ucc-caption font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {currentStudent.authProvider === 'google' ? 'Google Verified' : 'Email Verified'} · Pending Voter Roll Confirmation
              </span>
            </div>
          )}

          <h1 className="ucc-heading-page text-slate-900">
            {currentStudent.fullName}
          </h1>

          <p className="ucc-body-secondary text-slate-600">
            {[
              currentStudent.programme || 'Programme not yet linked',
              currentStudent.level ? `Level ${currentStudent.level}` : '',
              currentStudent.hall || 'Hall not yet linked',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <div className="pt-1 flex flex-wrap justify-center sm:justify-start items-center gap-3 ucc-caption text-slate-500 tabular-nums">
            <span>ID: {currentStudent.studentId || 'Pending submission'}</span>
            <span>·</span>
            <span>INDEX: {currentStudent.indexNumber || 'Pending'}</span>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
          <Logo variant="default" showWordmark={false} />
          <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider">
            UCC Registry
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl ucc-btn font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-[#123B70] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Profile & Permitted Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl ucc-btn font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-[#123B70] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Security & Passkey
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl ucc-btn font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
            activeTab === 'history'
              ? 'bg-[#123B70] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Voting Participation History ({formatNumber(voteConfirmations.length)})
        </button>
      </div>

      {/* TAB 1: PROFILE & PERMITTED DETAILS */}
      {activeTab === 'profile' && (
        <div className="space-y-6">

          {!currentStudent.studentId && (
            <div className="bg-white rounded-2xl border-2 border-[#123B70]/25 p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-[#123B70] shrink-0" />
                  <h2 className="ucc-label font-semibold uppercase tracking-wider text-slate-900">
                    Link Your UCC Student Identification
                  </h2>
                </div>
                <span className="ucc-caption font-semibold text-[#123B70] bg-blue-100 px-2.5 py-0.5 rounded-full shrink-0">
                  ONE-TIME SUBMISSION
                </span>
              </div>

              <p className="ucc-body-secondary text-slate-600">
                Your Google account is connected. Submit your official UCC student identification below so the Electoral Commission can match your record to the voter roll. Once saved, institutional fields are locked.
              </p>

              {instMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 ucc-body-secondary text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{instMsg}</span>
                </div>
              )}

              {instErr && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 ucc-body-secondary text-[#C62828] font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>{instErr}</span>
                </div>
              )}

              <form onSubmit={handleSaveInitialInstitutional} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      UCC Student ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={instStudentId}
                      onChange={(e) => setInstStudentId(e.target.value)}
                      placeholder="e.g. PS/CSC/22/0041"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 tabular-nums uppercase focus:outline-none focus:border-[#123B70]"
                    />
                  </div>
                  <div>
                    <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Index Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={instIndexNumber}
                      onChange={(e) => setInstIndexNumber(e.target.value)}
                      placeholder="e.g. 10945120"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 tabular-nums focus:outline-none focus:border-[#123B70]"
                    />
                  </div>
                  <div>
                    <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={instFullName}
                      onChange={(e) => setInstFullName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Faculty / School *
                    </label>
                    <select
                      value={instFaculty}
                      onChange={(e) => {
                        const nextFac = e.target.value;
                        setInstFaculty(nextFac);
                        const match = departments.filter((d) => d.facultyName.toLowerCase() === nextFac.toLowerCase());
                        if (match.length > 0) {
                          setInstDepartment(match[0].name);
                          setInstProgramme(match[0].programmes?.[0] || '');
                        }
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#123B70]"
                    >
                      {faculties.map((f) => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Academic Department *
                    </label>
                    <select
                      value={instDepartment}
                      onChange={(e) => {
                        const nextDept = e.target.value;
                        setInstDepartment(nextDept);
                        const obj = departments.find((d) => d.name === nextDept);
                        if (obj?.programmes?.length) setInstProgramme(obj.programmes[0]);
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#123B70]"
                    >
                      {departments
                        .filter((d) => !instFaculty || d.facultyName.toLowerCase() === instFaculty.toLowerCase())
                        .map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Programme
                    </label>
                    <input
                      type="text"
                      value={instProgramme}
                      onChange={(e) => setInstProgramme(e.target.value)}
                      placeholder="Programme of study"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                    />
                  </div>
                  <div>
                    <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Level *
                    </label>
                    <select
                      value={instLevel}
                      onChange={(e) => setInstLevel(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#123B70]"
                    >
                      <option value="100">Level 100</option>
                      <option value="200">Level 200</option>
                      <option value="300">Level 300</option>
                      <option value="400">Level 400</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Hall of Residence *
                    </label>
                    <select
                      value={instHall}
                      onChange={(e) => setInstHall(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#123B70]"
                    >
                      {halls.map((h) => (
                        <option key={h.id} value={h.name}>
                          {getHallDisplayName(h)}
                        </option>
                      ))}
                      <option value={NON_RESIDENT_HALL_LABEL}>
                        {NON_RESIDENT_HALL_LABEL} (No Hall Affiliation)
                      </option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingInst}
                  className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-semibold ucc-btn flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingInst ? 'Submitting UCC Identification...' : 'Submit UCC Student Details'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Institutional Immutable Attributes Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-4 h-4 text-[#123B70] shrink-0" />
                <h2 className="ucc-label font-semibold uppercase tracking-wider text-slate-900">
                  Authoritative Institutional Identity (Locked)
                </h2>
              </div>
              <span className="ucc-caption font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full shrink-0">
                DAA SYNCHRONIZED
              </span>
            </div>

            <p className="ucc-body-secondary text-slate-500">
              In accordance with university electoral integrity standards, students are <strong className="font-semibold">prohibited</strong> from unilaterally altering their official department, faculty, level, or hall affiliation. 
              Changes require an authorized petition to the Directorate of Academic Affairs (DAA).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-md:gap-2 ucc-body-secondary">
              <div className="p-3 max-md:p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Faculty:</span>
                <span className="font-semibold text-slate-800 text-right break-words min-w-0">{currentStudent.faculty || 'Not yet submitted'}</span>
              </div>
              <div className="p-3 max-md:p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Department:</span>
                <span className="font-semibold text-slate-800 text-right break-words min-w-0">{currentStudent.department || 'Not yet submitted'}</span>
              </div>
              <div className="p-3 max-md:p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Programme:</span>
                <span className="font-semibold text-slate-800 text-right break-words min-w-0">{currentStudent.programme || 'Not yet submitted'}</span>
              </div>
              <div className="p-3 max-md:p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Level:</span>
                <span className="font-semibold text-slate-800 text-right tabular-nums">Level {currentStudent.level || '100'}</span>
              </div>
              <div className="p-3 max-md:p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Hall of Residence:</span>
                <span className="font-semibold text-slate-800 text-right break-words min-w-0">{currentStudent.hall || 'Not yet submitted'}</span>
              </div>
              <div className="p-3 max-md:p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Account Email:</span>
                <span className="font-semibold text-slate-800 text-right break-all min-w-0">{currentStudent.email}</span>
              </div>
            </div>

            {/* Test Tampering Rejection Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestTampering}
                className="ucc-caption text-slate-500 hover:text-[#C62828] underline flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Test Server Identity Tampering Protection (Simulate unauthorized field edit)</span>
              </button>
              {tamperingSecurityAlert && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg ucc-body-secondary text-[#C62828] font-medium">
                  {tamperingSecurityAlert}
                </div>
              )}
            </div>
          </div>

          {/* Permitted Editable Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-4 h-4 text-[#123B70] shrink-0" />
                <h2 className="ucc-label font-semibold uppercase tracking-wider text-slate-900">
                  Permitted Contact & Notification Settings
                </h2>
              </div>
              <span className="ucc-caption text-emerald-700 font-semibold bg-emerald-100 px-2.5 py-0.5 rounded-full shrink-0">
                STUDENT EDITABLE
              </span>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 ucc-body-secondary text-emerald-800 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSavePermittedDetails} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    SMS / Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 tabular-nums focus:outline-none focus:border-[#123B70]"
                  />
                  <p className="ucc-caption text-slate-500 mt-1">Used for voting verification alerts</p>
                </div>

                <div>
                  <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Emergency Contact Number
                  </label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 tabular-nums focus:outline-none focus:border-[#123B70]"
                  />
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="pt-2 space-y-2">
                <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700">
                  Notification Dispatch Channels
                </label>
                
                <div className="space-y-2 ucc-body-secondary text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPrefs.emailAlerts}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, emailAlerts: e.target.checked })}
                      className="rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
                    />
                    <span>Email notices for election openings and candidate manifestos</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPrefs.smsBulletins}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, smsBulletins: e.target.checked })}
                      className="rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
                    />
                    <span>SMS circulars for urgent polling deadlines</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPrefs.resultsAnnouncements}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, resultsAnnouncements: e.target.checked })}
                      className="rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
                    />
                    <span>Immediate alert upon certified election results declaration</span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-semibold ucc-btn flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingProfile ? 'Saving Details...' : 'Save Permitted Details'}</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* TAB 2: SECURITY & PASSKEY */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-[#123B70] shrink-0" />
              <h2 className="ucc-label font-semibold uppercase tracking-wider text-slate-900">
                Update Portal Password
              </h2>
            </div>
            <span className="ucc-caption text-slate-500 shrink-0">FIREBASE AUTHENTICATION</span>
          </div>

          {pwdMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 ucc-body-secondary text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{pwdMsg}</span>
            </div>
          )}

          {pwdError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 ucc-body-secondary text-[#C62828] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{pwdError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
              />
            </div>

            <div>
              <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                New Secret Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
              />
            </div>

            <div>
              <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPwd}
              className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isChangingPwd ? 'Updating Password...' : 'Update Portal Password'}
            </button>
          </form>

          {/* Active Session Info */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Current Firebase Authentication Session
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 ucc-body-secondary text-slate-600 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0">Authentication Provider:</span>
                <span className="font-semibold text-slate-800 text-right min-w-0 break-words">
                  {currentStudent.authProvider === 'google'
                    ? 'Google Sign-In (Firebase Authentication — ucc-vote)'
                    : currentStudent.authProvider === 'password'
                    ? 'Email & Password (Firebase Authentication — ucc-vote)'
                    : 'Email Link (Firebase Authentication — ucc-vote)'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0">Email Verification:</span>
                <span className="text-emerald-700 font-semibold text-right">
                  {currentStudent.emailVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0">Voter Roll Eligibility:</span>
                <span className={`font-semibold uppercase text-right ${currentStudent.isEligible ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {currentStudent.isEligible ? 'Eligible' : 'Pending Verification'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VOTING PARTICIPATION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
          <div>
            <h2 className="ucc-heading-card text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-[#123B70]" />
              <span>Personal Voting Participation Records</span>
            </h2>
            <p className="ucc-body-secondary text-slate-500 mt-1">
              In strict accordance with electronic voting privacy standards, your confirmation receipts record only participation metadata. 
              <strong className="font-semibold"> The candidates you chose are never stored in your profile.</strong>
            </p>
          </div>

          {voteConfirmations.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center ucc-body-secondary text-slate-500">
              No voting participation records found yet.
            </div>
          ) : (
            <div className="space-y-3">
              {voteConfirmations.map((receipt) => (
                <div
                  key={receipt.confirmationRef}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <span className="ucc-caption font-semibold text-[#123B70] uppercase">
                      {receipt.electionCategory}
                    </span>
                    <h4 className="ucc-heading-card text-slate-900">{receipt.electionTitle}</h4>
                    <p className="ucc-caption text-slate-500 tabular-nums">
                      Submitted: {receipt.submittedAt ? new Date(receipt.submittedAt).toLocaleString() : ''}
                    </p>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 ucc-caption font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ballot Confirmed</span>
                    </span>
                    <p className="ucc-caption text-slate-500 font-mono tabular-nums mt-1">
                      Ref: {receipt.confirmationRef}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
