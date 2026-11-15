import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authClient } from '../../services/authClient';
import { Logo } from '../../components/common/Logo';
import { GoogleAuthButton } from '../../components/common/GoogleAuthButton';
import {
  ShieldCheck,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { navigateTo, loginWithUserPayload } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your Electoral Commission administrator email and password.');
      return;
    }

    setIsLoading(true);
    const res = await authClient.adminLogin(email.trim(), password);
    setIsLoading(false);

    if (!res.success || !res.user) {
      setError(res.error || 'Administrator authentication failed.');
      return;
    }

    loginWithUserPayload(res.user, 'admin');
  };

  const handleGoogleAdminLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const res = await authClient.adminLoginWithGoogle();
      if (res.redirected) {
        return;
      }
      setIsGoogleLoading(false);
      if (!res.success || !res.admin) {
        setError(res.error || 'Administrator Google sign-in failed.');
        return;
      }
      loginWithUserPayload(res.admin, 'admin');
    } catch {
      setIsGoogleLoading(false);
      setError('Unable to sign in with Google. Please try again.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 bg-[#F4F6F9]">
      <div className="max-w-3xl w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Navy Authority Panel */}
        <div className="md:col-span-5 bg-[#0B1F3A] text-white p-8 flex flex-col justify-between">
          <div className="space-y-5">
            <Logo theme="dark" variant="compact" />
            <div className="space-y-2 pt-2">
              <span className="inline-block px-2.5 py-0.5 rounded bg-red-950 border border-red-700/50 text-[10px] font-bold uppercase tracking-wider text-red-300">
                Restricted Access
              </span>
              <h2 className="text-xl font-extrabold leading-snug">
                Electoral Commission Console
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Authorized returning officers, election administrators, and auditors sign in using their Firebase Electoral Commission credentials.
              </p>
            </div>
          </div>

          <div className="pt-8 text-[11px] text-slate-400 space-y-2 border-t border-slate-800">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Role Claims & Firestore Verification</span>
            </div>
            <p className="leading-relaxed">
              Administrative permissions are verified against Firebase custom claims and the UCC Electoral Commission directory.
            </p>
          </div>
        </div>

        {/* Right Sign-In Form */}
        <div className="md:col-span-7 p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Administrator Sign In
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sign in to manage elections, voter eligibility rolls, nominations, and certified results.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#C62828]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <GoogleAuthButton
            onClick={handleGoogleAdminLogin}
            isLoading={isGoogleLoading}
            disabled={isLoading}
            label="Continue with Google"
            loadingLabel="Verifying administrator..."
            sublabel="For Google accounts granted Electoral Commission custom claims"
          />

          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              or sign in with password
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your administrator email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => navigateTo('forgot_password')}
                  className="text-xs font-semibold text-[#123B70] hover:underline cursor-pointer"
                >
                  Reset password
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#0B1F3A] hover:bg-[#123B70] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Access Electoral Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Looking for student voting?</span>
            <button
              type="button"
              onClick={() => navigateTo('student_login')}
              className="font-bold text-[#123B70] hover:underline cursor-pointer"
            >
              Student Portal Sign In →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
