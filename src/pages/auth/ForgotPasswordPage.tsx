import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandHeader } from '../../components/common/BrandHeader';
import { authClient } from '../../services/authClient';
import { 
  Mail, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  KeyRound, 
  Lock,
  ArrowRight
} from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const { navigateTo } = useApp();
  
  // Step 1: Request token, Step 2: Enter token & new password
  const [step, setStep] = useState<1 | 2>(1);
  const [studentId, setStudentId] = useState('PS/CSC/22/0089');
  const [tokenOrCode, setTokenOrCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dispatchedEmail, setDispatchedEmail] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!studentId.trim()) {
      setErrorMsg('Please enter your Student ID or institutional email.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authClient.forgotPassword(studentId.trim());
      setIsLoading(false);

      if (res.success) {
        setDispatchedEmail(res.email || 'student@st.ucc.edu.gh');
        if (res.demoRecoveryCode) {
          setDemoCode(res.demoRecoveryCode);
          setTokenOrCode(res.demoRecoveryCode);
        }
        setStep(2);
      } else {
        setErrorMsg(res.error || 'Failed to dispatch recovery token.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Network error.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!tokenOrCode.trim()) {
      setErrorMsg('Please provide the 6-digit recovery code or token.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authClient.resetPassword({
        code: tokenOrCode.trim(),
        token: tokenOrCode.trim(),
        newPassword,
        confirmPassword
      });
      setIsLoading(false);

      if (res.success) {
        setResetSuccess(true);
        setTimeout(() => {
          navigateTo('student_login');
        }, 1500);
      } else {
        setErrorMsg(res.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Network error.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-[#F4F6F9]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        
        <div className="bg-[#0B1F3A] p-6 text-white text-center">
          <div className="inline-block mb-2">
            <BrandHeader size="md" white />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Voter Account Recovery
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {step === 1 ? 'Request single-use cryptographic reset token' : 'Set your new portal password'}
          </p>
        </div>

        {resetSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Password Successfully Updated!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your credentials have been securely hashed and updated via PBKDF2. All prior sessions have been invalidated.
              Redirecting to login...
            </p>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleRequestToken} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C62828] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 bg-[#EAF2FA] rounded-lg text-xs text-[#123B70] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                To preserve election integrity, reset tokens are cryptographically generated and expire after 15 minutes.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                UCC Student ID Number
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. PS/CSC/22/0089"
                required
                className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:border-[#123B70]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#123B70] hover:bg-[#0B1F3A] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isLoading ? 'Verifying Identity...' : 'Dispatch Password Reset Token'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigateTo('student_login')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Student Login</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C62828] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 bg-emerald-50 rounded-lg text-xs text-emerald-800 space-y-1">
              <p className="font-semibold">Reset Token Dispatched</p>
              <p className="text-[11px] text-emerald-700">
                A single-use verification code was sent to: <strong>{dispatchedEmail}</strong>
              </p>
              {demoCode && (
                <div className="pt-1 text-[11px] font-mono text-[#123B70]">
                  Demo Recovery Code: <span className="font-bold underline">{demoCode}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                6-Digit Recovery Code / Secret Token
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={tokenOrCode}
                  onChange={(e) => setTokenOrCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:border-[#123B70]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                New Portal Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#123B70] hover:bg-[#0B1F3A] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isLoading ? 'Updating Passkey...' : 'Confirm New Password & Invalidate Old Sessions'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                ← Request a different token
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
