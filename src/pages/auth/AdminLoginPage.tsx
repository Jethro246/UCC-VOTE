import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Building,
  UserCheck
} from 'lucide-react';
import { AdminRoleType } from '../../types';
import { authClient } from '../../services/authClient';

export const AdminLoginPage: React.FC = () => {
  const { navigateTo, loginAsAdmin } = useApp();

  const [staffId, setStaffId] = useState('UCC/EC/ST/2019/04');
  const [password, setPassword] = useState('Admin@UCC2026');
  const [selectedRole, setSelectedRole] = useState<AdminRoleType>('Electoral Commissioner');
  const [securityPin, setSecurityPin] = useState('9482');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    setIsLoading(true);
    try {
      const res = await authClient.adminLogin(staffId.trim(), password, selectedRole, securityPin);
      setIsLoading(false);
      if (res.success && res.user) {
        loginAsAdmin(res.user);
      } else {
        setErrorMsg(res.error || 'Failed to authenticate administrative staff.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Network error.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-[#0B1F3A]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0B1F3A] p-6 text-white text-center border-b border-slate-800">
          <div className="flex justify-center mb-3">
            <Logo variant="large" theme="dark" layout="stacked" showTagline subtitle="Electoral Commission" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#C62828] text-[10px] font-bold uppercase tracking-wider text-white mt-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Official Electoral Commission Portal</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white mt-2">
            Authorized Personnel Login
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Restricted to certified Returning Officers and Commissioners
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C62828] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Electoral Authority Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as AdminRoleType)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white font-medium"
            >
              <option value="Electoral Commissioner">Electoral Commissioner (Executive Authority)</option>
              <option value="Super Administrator">Super Administrator (ICT Infrastructure)</option>
              <option value="Returning Officer">Returning Officer (Hall & Faculty)</option>
              <option value="Results Auditor">Results Auditor (Independent Verification)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Commission Staff ID / Officer Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Building className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="UCC/EC/ST/..."
                required
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:border-[#123B70]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Master Passkey
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Two-Factor Token / FIDO2 Pin
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="password"
                maxLength={6}
                value={securityPin}
                onChange={(e) => setSecurityPin(e.target.value)}
                placeholder="6-digit hardware token"
                required
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono tracking-widest focus:outline-none focus:border-[#123B70]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0B1F3A] hover:bg-[#123B70] focus:outline-none transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
          >
            {isLoading ? (
              <span>Validating Hardware Credentials...</span>
            ) : (
              <>
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Authorize & Enter Console</span>
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={loginAsAdmin}
              className="text-xs text-slate-600 hover:text-[#123B70] underline cursor-pointer"
            >
              Demo Shortcut: Log In as Dr. Joseph E. Tetteh (Commissioner)
            </button>
          </div>

          <div className="pt-3 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={() => navigateTo('student_login')}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Are you a student voter? Go to Student Login
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
