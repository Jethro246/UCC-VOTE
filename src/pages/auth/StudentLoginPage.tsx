import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { authClient } from '../../services/authClient';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';

export const StudentLoginPage: React.FC = () => {
  const { navigateTo, loginWithUserPayload } = useApp();
  
  const [studentId, setStudentId] = useState('PS/CSC/22/0089');
  const [password, setPassword] = useState('Vote@UCC2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockedUntilSeconds, setLockedUntilSeconds] = useState<number | null>(null);
  const [showActivateLink, setShowActivateLink] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setShowActivateLink(false);

    if (!studentId.trim()) {
      setErrorMsg('Please enter your valid UCC Student ID.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authClient.login(studentId.trim(), password, rememberMe);
      setIsLoading(false);

      if (res.success && res.user) {
        loginWithUserPayload(res.user, 'student');
      } else {
        setErrorMsg(res.error || 'Authentication failed. Please verify your credentials.');
        if (res.attemptsRemaining !== undefined) {
          setAttemptsRemaining(res.attemptsRemaining);
        }
        if (res.lockedUntilSeconds) {
          setLockedUntilSeconds(res.lockedUntilSeconds);
        }
        if (res.canActivate) {
          setShowActivateLink(true);
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Network communication error. Please try again.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-[#F4F6F9]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        
        {/* Card Header */}
        <div className="bg-[#0B1F3A] p-6 text-white text-center relative">
          <div className="flex justify-center mb-3">
            <Logo variant="large" theme="dark" layout="stacked" showTagline />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Student Voter Login
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Access your university voting dashboard with your institutional ID
          </p>
        </div>

        {/* Verification Architecture Banner */}
        <div className="bg-[#EAF2FA] border-b border-blue-100 px-5 py-2.5 flex items-center justify-between text-xs text-[#123B70]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#123B70]" />
            <span>Authenticated via UCC SIS & Directorate of Academic Affairs</span>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
            PBKDF2-SHA512
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C62828] space-y-1">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
              {attemptsRemaining !== null && attemptsRemaining > 0 && (
                <p className="text-[11px] text-red-600 pl-6">
                  Security notice: {attemptsRemaining} attempt{attemptsRemaining > 1 ? 's' : ''} remaining before account locks for 5 minutes.
                </p>
              )}
              {showActivateLink && (
                <div className="pt-1.5 pl-6">
                  <button
                    type="button"
                    onClick={() => navigateTo('student_register')}
                    className="text-xs font-bold text-[#123B70] underline hover:text-[#0B1F3A] cursor-pointer"
                  >
                    Activate your voter account now →
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              UCC Student ID / Index Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. PS/CSC/22/0089 or 10982341"
                required
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70] focus:ring-1 focus:ring-[#123B70] font-mono transition-colors"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Standard format: PS/CSC/22/0089 (Level 300) or 8-digit Index Number
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Portal Password
              </label>
              <button
                type="button"
                onClick={() => navigateTo('forgot_password')}
                className="text-xs text-[#123B70] hover:underline font-medium cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your secret password"
                required
                className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70] focus:ring-1 focus:ring-[#123B70] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-[#123B70] focus:ring-[#123B70]"
              />
              <span>Remember session on this device (30 days)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#123B70] hover:bg-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#123B70] focus:ring-offset-2 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isLoading ? (
              <span>Verifying Credentials with PBKDF2...</span>
            ) : (
              <>
                <span>Sign In to Voter Dashboard</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </>
            )}
          </button>

          {/* Quick Demo Test Credential Fillers */}
          <div className="pt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Quick Test Credentials:
            </span>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setStudentId('PS/CSC/22/0089');
                  setPassword('Vote@UCC2026');
                  setErrorMsg('');
                }}
                className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"
              >
                ✓ Active: Kofi Mensah (L300)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudentId('ED/EPS/21/0034');
                  setPassword('Vote@UCC2026');
                  setErrorMsg('');
                }}
                className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"
              >
                ✓ Active: Nana Akua (L400)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudentId('AS/HIS/22/0055');
                  setPassword('Vote@UCC2026');
                  setErrorMsg('');
                }}
                className="px-2 py-1 rounded bg-purple-50 border border-purple-200 text-purple-800 hover:bg-purple-100 cursor-pointer font-medium"
                title="Tests suspended account lockout"
              >
                ⚠ Test Suspended Account
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-600">
              First time voting or account not activated?
            </p>
            <button
              type="button"
              onClick={() => navigateTo('student_register')}
              className="w-full py-2 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Activate Voter Account with Student ID
            </button>
          </div>
        </form>

        {/* Security Footer Note */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 text-[11px] text-slate-500 text-center leading-relaxed">
          <p>
            Protected by multi-tier rate limiting and brute force mitigation. 
            All authentication attempts are cryptographically audited by the Electoral Commission.
          </p>
        </div>

      </div>
    </div>
  );
};
