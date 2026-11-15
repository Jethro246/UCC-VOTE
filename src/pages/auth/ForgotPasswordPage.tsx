import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authClient } from '../../services/authClient';
import { Logo } from '../../components/common/Logo';
import { isValidEmail } from '../../services/firebaseAuthService';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const { navigateTo } = useApp();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    const res = await authClient.forgotPassword(email.trim());
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Unable to send password reset email.');
      return;
    }

    setSuccessMsg(
      res.message ||
        `A Firebase password reset email has been dispatched to ${email.trim()}.`
    );
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 bg-[#F4F6F9]">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-6">
        <div className="space-y-3">
          <Logo variant="compact" />
          <h1 className="text-xl font-extrabold text-slate-900">Reset Account Password</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Enter the email address registered with your UCC VOTE account to receive a Firebase password reset link, or use passwordless Email Link sign-in directly.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#C62828]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Enter your email address"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Reset Email...</span>
              </>
            ) : (
              <>
                <span>Send Password Reset Link</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => navigateTo('student_login')}
            className="flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('student_login')}
            className="font-bold text-[#123B70] hover:underline cursor-pointer"
          >
            Use Email-Link Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
