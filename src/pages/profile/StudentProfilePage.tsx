import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authClient } from '../../services/authClient';
import { Logo } from '../../components/common/Logo';
import { 
  User, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  Mail, 
  Phone, 
  Building, 
  GraduationCap, 
  Home, 
  History, 
  KeyRound,
  FileText,
  AlertCircle,
  Bell,
  Save,
  ShieldAlert
} from 'lucide-react';

export const StudentProfilePage: React.FC = () => {
  const { student, elections, updateStudentProfile } = useApp();

  const currentStudent = student || {
    id: 'stu-001',
    studentId: 'PS/CSC/22/0089',
    indexNumber: '10982341',
    fullName: 'Kofi Mensah Sarbah',
    email: 'kofi.sarbah@st.ucc.edu.gh',
    phone: '+233 24 555 0192',
    emergencyContact: '+233 20 888 1234',
    department: 'Computer Science & Information Technology',
    faculty: 'School of Physical Sciences',
    programme: 'B.Sc. Computer Science',
    level: '300',
    hall: 'Casely Hayford Hall',
    isEligible: true,
    avatarUrl: '/src/assets/images/candidate_male_1794352938747.jpg',
    notificationPreferences: {
      emailAlerts: true,
      smsBulletins: true,
      resultsAnnouncements: true
    },
    hasVotedElections: ['UCC-GRA-2025', 'UCC-VAL-2025']
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'history'>('profile');
  
  // Editable personal fields
  const [phone, setPhone] = useState(currentStudent.phone || '+233 24 555 0192');
  const [emergencyContact, setEmergencyContact] = useState(currentStudent.emergencyContact || '+233 20 888 1234');
  const [notifPrefs, setNotifPrefs] = useState(currentStudent.notificationPreferences || {
    emailAlerts: true,
    smsBulletins: true,
    resultsAnnouncements: true
  });
  
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

  const votedElections = elections.filter(e => currentStudent.hasVotedElections?.includes(e.id));

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <img
          src={currentStudent.avatarUrl || '/src/assets/images/candidate_male_1794352938747.jpg'}
          alt={currentStudent.fullName}
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-200 shadow-md shrink-0"
        />

        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified Student Voter · Academic Year 2026/2027</span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {currentStudent.fullName}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600">
            {currentStudent.programme} · Level {currentStudent.level} · {currentStudent.hall}
          </p>

          <div className="pt-1 flex flex-wrap justify-center sm:justify-start items-center gap-3 text-xs text-slate-500 font-mono">
            <span>ID: {currentStudent.studentId}</span>
            <span>·</span>
            <span>INDEX: {currentStudent.indexNumber}</span>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
          <Logo variant="default" showWordmark={false} />
          <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider">
            UCC Registry
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-[#123B70] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Profile & Permitted Details
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'security'
              ? 'bg-[#123B70] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Security & Passkey
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#123B70] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Voting Participation History ({votedElections.length})
        </button>
      </div>

      {/* TAB 1: PROFILE & PERMITTED DETAILS */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          
          {/* Institutional Immutable Attributes Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#123B70]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Authoritative Institutional Identity (Locked)
                </h2>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                DAA SYNCHRONIZED
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              In accordance with university electoral integrity standards, students are <strong>prohibited</strong> from unilaterally altering their official department, faculty, level, or hall affiliation. 
              Changes require an authorized petition to the Directorate of Academic Affairs (DAA).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Faculty:</span>
                <span className="font-bold text-slate-800">{currentStudent.faculty}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-bold text-slate-800">{currentStudent.department}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Programme:</span>
                <span className="font-bold text-slate-800">{currentStudent.programme}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Level:</span>
                <span className="font-bold text-slate-800">Level {currentStudent.level}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Hall of Residence:</span>
                <span className="font-bold text-slate-800">{currentStudent.hall}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Institutional Email:</span>
                <span className="font-bold text-slate-800 font-mono">{currentStudent.email}</span>
              </div>
            </div>

            {/* Test Tampering Rejection Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestTampering}
                className="text-xs text-slate-500 hover:text-[#C62828] underline flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Test Server Identity Tampering Protection (Simulate unauthorized field edit)</span>
              </button>
              {tamperingSecurityAlert && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-[#C62828] font-medium">
                  {tamperingSecurityAlert}
                </div>
              )}
            </div>
          </div>

          {/* Permitted Editable Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#123B70]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Permitted Contact & Notification Settings
                </h2>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                STUDENT EDITABLE
              </span>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSavePermittedDetails} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    SMS / Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:border-[#123B70]"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Used for voting verification alerts</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Emergency Contact Number
                  </label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:border-[#123B70]"
                  />
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="pt-2 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Notification Dispatch Channels
                </label>
                
                <div className="space-y-2 text-xs text-slate-700">
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
                  className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
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
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#123B70]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Update Portal Password
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-500">PBKDF2 ENCRYPTION</span>
          </div>

          {pwdMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{pwdMsg}</span>
            </div>
          )}

          {pwdError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C62828] font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{pwdError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                New Secret Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPwd}
              className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isChangingPwd ? 'Updating Password...' : 'Update Portal Password'}
            </button>
          </form>

          {/* Active Session Info */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Current Session Telemetry
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Session Type:</span>
                <span className="font-semibold text-slate-800">UCC Student Portal Bearer Session</span>
              </div>
              <div className="flex justify-between">
                <span>Auth Protocol:</span>
                <span className="font-mono text-emerald-700 font-semibold">PBKDF2-SHA512 + HTTP-Only Cookie</span>
              </div>
              <div className="flex justify-between">
                <span>Account Status:</span>
                <span className="text-emerald-700 font-bold uppercase">Active & Eligible</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VOTING PARTICIPATION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-[#123B70]" />
              <span>Personal Voting Participation Records</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              In strict accordance with electronic voting privacy standards, this ledger only records that you cast a valid ballot. 
              <strong> The candidates you chose are never stored in your profile.</strong>
            </p>
          </div>

          <div className="space-y-3">
            {votedElections.map((el) => (
              <div key={el.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-[#123B70] uppercase">{el.category}</span>
                  <h4 className="text-sm font-bold text-slate-900">{el.title}</h4>
                  <p className="text-xs text-slate-500 font-mono">Academic Year: {el.academicYear}</p>
                </div>

                <div className="sm:text-right shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ballot Recorded</span>
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    Receipt Token: UCC-{el.id.slice(-4)}-{Math.floor(1000 + Math.random() * 9000)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
