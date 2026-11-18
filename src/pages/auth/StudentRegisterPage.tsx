import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authClient } from '../../services/authClient';
import { Logo } from '../../components/common/Logo';
import { GoogleAuthButton } from '../../components/common/GoogleAuthButton';
import { isValidEmail } from '../../services/firebaseAuthService';
import { NON_RESIDENT_HALL_LABEL, getHallDisplayName } from '../../utils/hallUtils';
import {
  UserPlus,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Info,
  ArrowRight,
} from 'lucide-react';

export const StudentRegisterPage: React.FC = () => {
  const {
    navigateTo,
    loginWithUserPayload,
    halls,
    faculties,
    departments,
    firebaseUser,
    needsProfileCompletion,
  } = useApp();

  const [studentId, setStudentId] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(firebaseUser?.email || '');
  const [phone, setPhone] = useState('');
  const [faculty, setFaculty] = useState(faculties[0]?.name || '');
  const [department, setDepartment] = useState(departments[0]?.name || '');
  const [programme, setProgramme] = useState(departments[0]?.programmes?.[0] || '');
  const [level, setLevel] = useState<'100' | '200' | '300' | '400' | 'Postgraduate'>('200');
  const [hall, setHall] = useState(halls[0]?.name || '');

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleSuccessMessage, setGoogleSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseUser?.email && !email) {
      setEmail(firebaseUser.email);
    }
  }, [firebaseUser, email]);

  useEffect(() => {
    if (!hall && halls.length > 0) {
      setHall(halls[0].name);
    }
  }, [hall, halls]);

  const filteredDepartments = departments.filter(
    (d) => !faculty || d.facultyName.toLowerCase() === faculty.toLowerCase()
  );

  const selectedDeptObj = departments.find((d) => d.name === department);

  const handleFacultyChange = (nextFac: string) => {
    setFaculty(nextFac);
    const matching = departments.filter(
      (d) => d.facultyName.toLowerCase() === nextFac.toLowerCase()
    );
    if (matching.length > 0) {
      setDepartment(matching[0].name);
      setProgramme(matching[0].programmes?.[0] || '');
    }
  };

  const handleDepartmentChange = (nextDept: string) => {
    setDepartment(nextDept);
    const obj = departments.find((d) => d.name === nextDept);
    if (obj && obj.programmes.length > 0) {
      setProgramme(obj.programmes[0]);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSentMessage(null);

    if (
      !studentId.trim() ||
      !indexNumber.trim() ||
      !fullName.trim() ||
      !department.trim() ||
      !faculty.trim() ||
      !hall.trim()
    ) {
      setError('Please complete all required UCC student identification and academic fields.');
      return;
    }

    const cleanEmail = (firebaseUser?.email || email).trim();
    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address (any valid provider is accepted).');
      return;
    }

    setIsLoading(true);
    try {
      // If user already completed email-link verification and now needs to save their UCC profile
      if (firebaseUser && needsProfileCompletion) {
        const saveRes = await authClient.saveActivationProfile({
          studentId: studentId.trim().toUpperCase(),
          indexNumber: indexNumber.trim(),
          fullName: fullName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          department: department.trim(),
          faculty: faculty.trim(),
          programme: programme.trim() || department.trim(),
          level,
          hall: hall.trim(),
        });
        if (!saveRes.success) {
          setError(saveRes.error || 'Could not save student profile.');
          return;
        }
        navigateTo('student_dashboard');
        return;
      }

      const res = await authClient.sendEmailLink(cleanEmail, 'activate', {
        studentId: studentId.trim().toUpperCase(),
        indexNumber: indexNumber.trim(),
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        department: department.trim(),
        faculty: faculty.trim(),
        programme: programme.trim() || department.trim(),
        level,
        hall: hall.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Failed to send verification link.');
        return;
      }

      setSentMessage(
        res.message ||
          `Verification link sent to ${cleanEmail}. Click the link in your email to verify your address and activate your UCC VOTE account.`
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to complete student activation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setSentMessage(null);
    setGoogleSuccessMessage(null);
    setIsGoogleLoading(true);

    try {
      const res = await authClient.signInWithGoogle();
      if (res.redirected) {
        return;
      }
      if (!res.success) {
        setError(res.error || 'Unable to sign in. Please try again.');
        setIsGoogleLoading(false);
        return;
      }

      if (res.isAdmin && res.admin) {
        setGoogleSuccessMessage('Administrator verified — opening Electoral Commission Console...');
        setIsGoogleLoading(false);
        setTimeout(() => {
          loginWithUserPayload(res.admin, 'admin');
        }, 350);
        return;
      }

      if (!res.student) {
        setError(res.error || 'Unable to sign in. Please try again.');
        setIsGoogleLoading(false);
        return;
      }

      setGoogleSuccessMessage(
        res.isNewUser
          ? 'Google sign-in successful — your UCC VOTE profile has been created.'
          : 'Google sign-in successful — existing profile loaded.'
      );
      setIsGoogleLoading(false);

      setTimeout(() => {
        loginWithUserPayload(res.student, 'student');
      }, 450);
    } catch {
      setIsGoogleLoading(false);
      setError('Unable to sign in. Please try again.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 bg-[#F4F6F9]">
      <div className="max-w-5xl w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Sidebar */}
        <div className="lg:col-span-4 bg-[#0B1F3A] text-white p-7 sm:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <Logo theme="dark" variant="compact" />
            <div className="space-y-2 pt-2">
              <span className="inline-block px-2.5 py-0.5 rounded bg-blue-950 border border-blue-700/50 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                First-Time Activation
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug">
                Activate Your UCC Student Account
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sign up with Google in one click or register your UCC credentials via Firebase passwordless email verification.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-8 text-xs text-slate-300">
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>Verification vs Voter Eligibility</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Google or email verification confirms that you own the account. Official UCC voter eligibility is verified separately on the UCC Electoral Commission roll.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>
                Students may sign up using Gmail, @stu.ucc.edu.gh, or any valid Google or email account.
              </p>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-8 p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {firebaseUser && needsProfileCompletion
                  ? 'Complete Student Profile'
                  : 'Student Account Activation'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {firebaseUser && needsProfileCompletion
                  ? 'Enter your official University of Cape Coast registration details below.'
                  : 'Create your account instantly with Google or activate using your UCC student details.'}
              </p>
            </div>
            <UserPlus className="w-6 h-6 text-[#123B70] shrink-0" />
          </div>

          {!sentMessage && !(firebaseUser && needsProfileCompletion) && (
            <>
              <GoogleAuthButton
                onClick={handleGoogleSignUp}
                isLoading={isGoogleLoading}
                disabled={isLoading}
                label="Continue with Google"
                loadingLabel="Creating your account..."
                sublabel="Automatically creates your profile using Gmail or UCC Google accounts"
              />

              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  or activate with email verification
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>
            </>
          )}

          {googleSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{googleSuccessMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#C62828]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {sentMessage ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-emerald-950">
                    Check Your Email Inbox to Complete Activation
                  </h3>
                  <p className="text-xs text-emerald-800 leading-relaxed">{sentMessage}</p>
                  <p className="text-[11px] text-emerald-700 pt-1">
                    Note: After clicking the link, your email will be verified and your profile will be saved to Cloud Firestore with status{' '}
                    <strong>Pending Electoral Roll Verification</strong> until confirmed by the UCC Electoral Commission.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSentMessage(null)}
                  className="px-4 py-2 rounded-lg border border-emerald-300 text-xs font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  Use Another Email
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('student_login')}
                  className="px-4 py-2 rounded-lg bg-[#123B70] text-white text-xs font-bold hover:bg-[#0B1F3A] cursor-pointer"
                >
                  Back to Student Sign In
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    UCC Student ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. PS/CSC/22/0041"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono uppercase focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Index / Reference Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={indexNumber}
                    onChange={(e) => setIndexNumber(e.target.value)}
                    placeholder="e.g. 10945120"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="As shown on student ID card"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +233 24 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    disabled={Boolean(firebaseUser?.email && needsProfileCompletion)}
                    value={firebaseUser?.email && needsProfileCompletion ? firebaseUser.email : email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email (@stu.ucc.edu.gh, Gmail, or any valid email)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Faculty / School *
                  </label>
                  <select
                    value={faculty}
                    onChange={(e) => handleFacultyChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                  >
                    {faculties.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Department *
                  </label>
                  <select
                    value={department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                  >
                    {(filteredDepartments.length > 0 ? filteredDepartments : departments).map(
                      (d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Programme
                  </label>
                  {selectedDeptObj && selectedDeptObj.programmes.length > 0 ? (
                    <select
                      value={programme}
                      onChange={(e) => setProgramme(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                    >
                      {selectedDeptObj.programmes.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={programme}
                      onChange={(e) => setProgramme(e.target.value)}
                      placeholder="Programme of study"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Level *
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                  >
                    <option value="100">Level 100</option>
                    <option value="200">Level 200</option>
                    <option value="300">Level 300</option>
                    <option value="400">Level 400</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hall of Residence *
                  </label>
                  <select
                    value={hall}
                    onChange={(e) => setHall(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
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
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#C62828] hover:bg-[#A61E1E] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {firebaseUser && needsProfileCompletion
                        ? 'Saving Student Profile...'
                        : 'Sending Verification Link...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {firebaseUser && needsProfileCompletion
                        ? 'Complete Student Activation'
                        : 'Send Activation Email Link'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Already activated?{' '}
              <button
                type="button"
                onClick={() => navigateTo('student_login')}
                className="font-bold text-[#123B70] hover:underline cursor-pointer"
              >
                Sign In with Email Link
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
