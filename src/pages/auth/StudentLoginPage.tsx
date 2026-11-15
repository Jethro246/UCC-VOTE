import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authClient } from '../../services/authClient';
import { Logo } from '../../components/common/Logo';
import { GoogleAuthButton } from '../../components/common/GoogleAuthButton';
import { isValidEmail } from '../../services/firebaseAuthService';
import {
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';

export const StudentLoginPage: React.FC = () => {
  const {
    navigateTo,
    loginWithUserPayload,
    sessionExpiredReason,
    clearSessionExpiredReason,
  } = useApp();

  const [authMethod, setAuthMethod] = useState<'email_link' | 'password'>('email_link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleSuccessMessage, setGoogleSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkSentMessage, setLinkSentMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkSentMessage(null);
    clearSessionExpiredReason();

    const clean = email.trim();
    if (!isValidEmail(clean)) {
      setError(
        'Please enter a valid email address (e.g. your UCC student email, Gmail, or personal email).'
      );
      return;
    }

    setIsLoading(true);
    const res = await authClient.sendEmailLink(clean, 'login');
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Unable to send sign-in link.');
      return;
    }

    setLinkSentMessage(
      res.message ||
        `A secure sign-in link has been dispatched to ${clean}. Open the link from your inbox to sign in.`
    );
    setResendCooldown(60);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkSentMessage(null);
    clearSessionExpiredReason();

    if (!isValidEmail(email.trim()) || !password) {
      setError('Please enter your registered email address and password.');
      return;
    }

    setIsLoading(true);
    const res = await authClient.login(email.trim(), password);
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Sign-in failed.');
      return;
    }

    if (!res.user) {
      navigateTo('student_register');
      return;
    }

    if (res.userRole === 'admin') {
      loginWithUserPayload(res.user, 'admin');
      return;
    }

    loginWithUserPayload(res.user, 'student');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLinkSentMessage(null);
    setGoogleSuccessMessage(null);
    clearSessionExpiredReason();
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
          ? 'Google sign-in successful — your UCC VOTE account has been created.'
          : 'Google sign-in successful'
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
      <div className="max-w-4xl w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Institutional Trust Panel */}
        <div className="lg:col-span-5 bg-[#0B1F3A] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-[#123B70]/40 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-6 relative">
            <Logo theme="dark" variant="compact" />
            <div className="space-y-2 pt-2">
              <span className="inline-block px-2.5 py-0.5 rounded bg-blue-950 border border-blue-700/50 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                UCC Student Authentication
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight leading-snug">
                Verified Student Sign-In
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Authenticate securely using your Google account, a passwordless email sign-in link, or your configured account password.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-8 text-xs text-slate-300 relative">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>Gmail, @stu.ucc.edu.gh, and other valid email accounts are all supported.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <p>
                Authentication confirms account ownership. Official voter eligibility is verified separately by the UCC Electoral Commission.
              </p>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 space-y-5">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold text-slate-900">Student Portal Sign In</h1>
            <p className="text-xs text-slate-500">
              Sign in with Google, a one-time email link, or your configured password.
            </p>
          </div>

          <GoogleAuthButton
            onClick={handleGoogleSignIn}
            isLoading={isGoogleLoading}
            disabled={isLoading}
            label="Continue with Google"
            loadingLabel="Signing you in..."
            sublabel="Supports Gmail and UCC student Google accounts"
          />

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              or sign in with email
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          {/* Method Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('email_link');
                setError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                authMethod === 'email_link'
                  ? 'bg-[#123B70] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Link (Passwordless)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('password');
                setError(null);
                setLinkSentMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                authMethod === 'password'
                  ? 'bg-[#123B70] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Email & Password</span>
            </button>
          </div>

          {sessionExpiredReason && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{sessionExpiredReason}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#C62828]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {googleSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{googleSuccessMessage}</span>
            </div>
          )}

          {linkSentMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs text-emerald-950">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Sign-In Link Dispatched</p>
                  <p className="leading-relaxed text-emerald-800">{linkSentMessage}</p>
                </div>
              </div>
            </div>
          )}

          {authMethod === 'email_link' ? (
            <form onSubmit={handleSendEmailLink} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address (e.g. name@stu.ucc.edu.gh or Gmail)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  We accept @stu.ucc.edu.gh, Gmail, and any valid email address. Check your spam/junk folder if you do not see the email within a minute.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || resendCooldown > 0}
                className="w-full py-3 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Sign-In Link...</span>
                  </>
                ) : resendCooldown > 0 ? (
                  <span>Resend Link Available in {resendCooldown}s</span>
                ) : (
                  <>
                    <span>Send Sign-In Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
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
                    Forgot password?
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
                className="w-full py-3 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500">
              First time on UCC VOTE?{' '}
              <button
                type="button"
                onClick={() => navigateTo('student_register')}
                className="font-bold text-[#123B70] hover:underline cursor-pointer"
              >
                Activate Student Account
              </button>
            </span>
            <button
              type="button"
              onClick={() => navigateTo('admin_login')}
              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
            >
              Electoral Officer Portal →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
