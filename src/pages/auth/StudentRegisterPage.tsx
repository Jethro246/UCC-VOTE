import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { authClient } from '../../services/authClient';
import { 
  ShieldCheck, 
  User, 
  Mail, 
  BookOpen, 
  Building2, 
  Home, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Check,
  Sparkles
} from 'lucide-react';

export const StudentRegisterPage: React.FC = () => {
  const { navigateTo, loginWithUserPayload } = useApp();

  const [formData, setFormData] = useState({
    fullName: '',
    studentId: 'SB/MKT/23/0142', // Default to unactivated test student Beatrice Arhin
    indexNumber: '10989944',
    email: 'beatrice.arhin@st.ucc.edu.gh',
    phone: '+233 24 990 1122',
    faculty: 'School of Business',
    department: 'Marketing',
    programme: 'B.Com. Marketing',
    level: '200',
    hall: 'Kwame Nkrumah Hall',
    password: '',
    confirmPassword: '',
    agreedToRules: true
  });

  const [isVerifyingRegistry, setIsVerifyingRegistry] = useState(false);
  const [registryMatch, setRegistryMatch] = useState<{
    found: boolean;
    isAlreadyRegistered: boolean;
    student?: any;
    error?: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live lookup of Student ID in authoritative registry
  const checkRegistry = async (idToCheck: string) => {
    if (!idToCheck || idToCheck.trim().length < 6) {
      setRegistryMatch(null);
      return;
    }

    setIsVerifyingRegistry(true);
    try {
      const res = await authClient.verifyStudentId(idToCheck.trim());
      setIsVerifyingRegistry(false);
      if (res.found && res.student) {
        setRegistryMatch({
          found: true,
          isAlreadyRegistered: Boolean(res.isAlreadyRegistered),
          student: res.student
        });

        // Pre-fill official institutional details
        setFormData(prev => ({
          ...prev,
          fullName: res.student.fullName,
          indexNumber: res.student.indexNumber,
          email: res.student.officialEmail,
          faculty: res.student.faculty,
          department: res.student.department,
          programme: res.student.programme,
          level: res.student.level,
          hall: res.student.hall
        }));
      } else {
        setRegistryMatch({
          found: false,
          isAlreadyRegistered: false,
          error: 'Student ID not found in the official UCC student enrollment registry.'
        });
      }
    } catch {
      setIsVerifyingRegistry(false);
    }
  };

  useEffect(() => {
    if (formData.studentId) {
      checkRegistry(formData.studentId);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStudentIdBlur = () => {
    checkRegistry(formData.studentId);
  };

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.studentId || !formData.password) {
      setErrorMsg('Student ID and password are required.');
      return;
    }

    if (formData.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your entries.');
      return;
    }

    if (!formData.agreedToRules) {
      setErrorMsg('You must agree to the UCC Electoral Commission regulations.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authClient.register(formData);
      setIsSubmitting(false);

      if (res.success && res.user) {
        setSuccess(true);
        setTimeout(() => {
          loginWithUserPayload(res.user, 'student');
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Activation failed. Please check your details.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Network error during activation.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-8 bg-[#F4F6F9]">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0B1F3A] p-6 text-white text-center">
          <div className="flex justify-center mb-3">
            <Logo variant="large" theme="dark" layout="stacked" showTagline />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Voter Account Activation & Verification
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Synchronize your official institutional registry record to enable electronic voting
          </p>
        </div>

        {/* Info notice */}
        <div className="bg-[#EAF2FA] border-b border-blue-100 p-4 text-xs text-[#123B70] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 shrink-0 text-[#123B70] mt-0.5" />
          <p className="leading-relaxed">
            <strong>Authoritative Student Verification Rule:</strong> The system verifies your Student ID directly against the 
            Directorate of Academic Affairs (DAA) database. Only currently registered students are permitted to activate voter accounts.
          </p>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Voter Account Successfully Activated!
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Your student credentials (<strong>{formData.studentId}</strong>) have been verified with institutional records. 
              Redirecting you directly to your Student Dashboard...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C62828] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick Demo Test Buttons */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Quick Test Scenarios:
              </span>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, studentId: 'SB/MKT/23/0142' }));
                    checkRegistry('SB/MKT/23/0142');
                  }}
                  className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-[#123B70] hover:bg-blue-100 cursor-pointer font-medium"
                >
                  ✓ Eligible Unactivated: Beatrice Arhin (L200)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, studentId: 'PS/CSC/22/0089' }));
                    checkRegistry('PS/CSC/22/0089');
                  }}
                  className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 cursor-pointer font-medium"
                >
                  ⚠ Test Duplicate: Kofi Mensah (Already Active)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, studentId: 'INVALID/ID/999' }));
                    checkRegistry('INVALID/ID/999');
                  }}
                  className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 cursor-pointer font-medium"
                >
                  ✕ Test Non-Existent ID
                </button>
              </div>
            </div>

            {/* Student ID & Registry Match Status Banner */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                UCC Student ID Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  onBlur={handleStudentIdBlur}
                  placeholder="e.g. SB/MKT/23/0142"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:border-[#123B70]"
                />
                <button
                  type="button"
                  onClick={() => checkRegistry(formData.studentId)}
                  className="absolute right-2 top-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 rounded cursor-pointer"
                >
                  {isVerifyingRegistry ? 'Verifying...' : 'Verify ID'}
                </button>
              </div>

              {/* Status feedback */}
              {registryMatch && (
                <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-center justify-between ${
                  registryMatch.found 
                    ? registryMatch.isAlreadyRegistered 
                      ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <div className="flex items-center gap-1.5">
                    {registryMatch.found ? (
                      registryMatch.isAlreadyRegistered ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>Official Record Found: Already activated in voter roll.</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Official Record Verified: {registryMatch.student?.fullName} ({registryMatch.student?.programme})</span>
                        </>
                      )
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span>Not found in UCC Academic Affairs database.</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name (Official Registered)
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Index Number
                </label>
                <input
                  type="text"
                  name="indexNumber"
                  value={formData.indexNumber}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  University Student Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Faculty / School
                </label>
                <input
                  type="text"
                  name="faculty"
                  value={formData.faculty}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Programme of Study
                </label>
                <input
                  type="text"
                  name="programme"
                  value={formData.programme}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Academic Level
                </label>
                <select
                  name="level"
                  value={formData.level}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white"
                >
                  <option value="100">Level 100</option>
                  <option value="200">Level 200</option>
                  <option value="300">Level 300</option>
                  <option value="400">Level 400</option>
                  <option value="Postgraduate">Postgraduate</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Hall of Residence
                </label>
                <input
                  type="text"
                  name="hall"
                  value={formData.hall}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Create Secret Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="agreedToRules"
                  checked={formData.agreedToRules}
                  onChange={handleCheckbox}
                  className="mt-0.5 rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
                />
                <span>
                  I declare that my information matches my official UCC registration, and I accept the terms of the Electoral Commission.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || Boolean(registryMatch && !registryMatch.found)}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#C62828] hover:bg-red-700 focus:outline-none transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
            >
              {isSubmitting ? (
                <span>Validating Against Institutional Registry...</span>
              ) : (
                <>
                  <span>Activate & Verify Voter Record</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => navigateTo('student_login')}
                className="text-xs text-[#123B70] hover:underline cursor-pointer"
              >
                Already activated? Return to Student Login
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
