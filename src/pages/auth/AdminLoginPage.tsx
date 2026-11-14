import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Building,
  UserCheck
} from 'lucide-react';
import { AdminRoleType } from '../../types';
import { authClient } from '../../services/authClient';

interface DemoAdminPreset {
  label: string;
  scopeTag: string;
  staffId: string;
  role: AdminRoleType;
}

const DEMO_ADMIN_PRESETS: DemoAdminPreset[] = [
  {
    label: 'Electoral Commissioner',
    scopeTag: 'All Domains',
    staffId: 'UCC/EC/ST/2019/04',
    role: 'Electoral Commissioner'
  },
  {
    label: 'Super Administrator',
    scopeTag: 'All Domains & RBAC',
    staffId: 'UCC/ICT/SA/2021/01',
    role: 'Super Administrator'
  },
  {
    label: 'SRC Election Admin',
    scopeTag: 'SRC Domain',
    staffId: 'UCC/DOM/SRC/01',
    role: 'SRC Election Administrator'
  },
  {
    label: 'Casford Hall Admin',
    scopeTag: 'Casely Hayford Hall',
    staffId: 'UCC/DOM/CAS/01',
    role: 'Hall Election Administrator'
  },
  {
    label: 'Valco Hall Admin',
    scopeTag: 'Valco Hall',
    staffId: 'UCC/DOM/VAL/01',
    role: 'Hall Election Administrator'
  },
  {
    label: 'GRASAG Election Admin',
    scopeTag: 'Postgraduate Only',
    staffId: 'UCC/DOM/GRA/01',
    role: 'GRASAG Election Administrator'
  },
  {
    label: 'Local NUGS Admin',
    scopeTag: 'Local NUGS Domain',
    staffId: 'UCC/DOM/NUGS/01',
    role: 'Local NUGS Election Administrator'
  },
  {
    label: 'Dept. CS & IT Admin',
    scopeTag: 'Departmental · CS/IT',
    staffId: 'UCC/DOM/DCS/01',
    role: 'Departmental Election Administrator'
  },
  {
    label: 'Physical Sciences Admin',
    scopeTag: 'Faculty / School · SPS',
    staffId: 'UCC/DOM/SPS/01',
    role: 'Faculty/School Election Administrator'
  }
];

const ALL_ADMIN_ROLES: { value: AdminRoleType; label: string }[] = [
  { value: 'Electoral Commissioner', label: 'Electoral Commissioner (Executive Authority)' },
  { value: 'Super Administrator', label: 'Super Administrator (System & Domain Governance)' },
  { value: 'SRC Election Administrator', label: 'SRC Election Administrator (Central SRC Domain)' },
  { value: 'Hall Election Administrator', label: 'Hall Election Administrator (JCRC / Hall Subdomain)' },
  { value: 'GRASAG Election Administrator', label: 'GRASAG Election Administrator (Postgraduate Domain)' },
  { value: 'Local NUGS Election Administrator', label: 'Local NUGS Election Administrator (NUGS Chapter)' },
  { value: 'Departmental Election Administrator', label: 'Departmental Election Administrator (Department Scope)' },
  { value: 'Faculty/School Election Administrator', label: 'Faculty/School Election Administrator (Faculty Scope)' },
  { value: 'Returning Officer', label: 'Returning Officer (Polling & Verification)' },
  { value: 'Results Auditor', label: 'Results Auditor (Independent Verification)' }
];

export const AdminLoginPage: React.FC = () => {
  const { navigateTo, loginWithUserPayload } = useApp();

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
        loginWithUserPayload(res.user, 'admin');
      } else {
        setErrorMsg(res.error || 'Failed to authenticate administrative staff.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Network error.');
    }
  };

  const handleDemoPresetLogin = async (preset: DemoAdminPreset, autoSubmit: boolean) => {
    setStaffId(preset.staffId);
    setSelectedRole(preset.role);
    setPassword('Admin@UCC2026');
    setSecurityPin('9482');
    setErrorMsg('');

    if (!autoSubmit) return;
    setIsLoading(true);
    try {
      const res = await authClient.adminLogin(preset.staffId, 'Admin@UCC2026', preset.role, '9482');
      setIsLoading(false);
      if (res.success && res.user) {
        loginWithUserPayload(res.user, 'admin');
      } else {
        setErrorMsg(res.error || 'Failed to authenticate demonstration admin account.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Network error.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-[#0B1F3A]">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl border border-slate-700 shadow-xl overflow-hidden">

        {/* Left Column: Credential Login Form */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-[#0B1F3A] p-6 text-white text-center border-b border-slate-800">
            <div className="flex justify-center mb-3">
              <Logo variant="large" theme="dark" layout="stacked" showTagline subtitle="Electoral Commission" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mt-1">
              Official Electoral Commission Portal
            </p>
            <h2 className="text-lg font-bold tracking-tight text-white mt-1">
              Authorized Personnel Login
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Domain-scoped access for Commissioners, Super Admins, and Election Administrators
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
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
                {ALL_ADMIN_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
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
                  placeholder="UCC/EC/ST/... or UCC/DOM/..."
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
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Two-Factor Token / Hardware Pin
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
              className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0B1F3A] hover:bg-[#123B70] focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isLoading ? (
                <span>Validating Credentials...</span>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Authorize & Enter Console</span>
                </>
              )}
            </button>

            <div className="pt-3 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={() => navigateTo('student_login')}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Are you a student voter? Go to Student Login
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Demonstration RBAC Admin Accounts */}
        <div className="lg:col-span-5 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#123B70]">
              <ShieldCheck className="w-4 h-4 text-[#C62828]" />
              <span>Demonstration Admin Accounts</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Select any demonstration account below to sign in directly with domain-scoped RBAC credentials (demo passkey: <span className="font-mono font-semibold text-slate-800">Admin@UCC2026</span>).
            </p>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {DEMO_ADMIN_PRESETS.map((preset) => {
                const isSelected = staffId === preset.staffId;
                return (
                  <button
                    key={preset.staffId}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDemoPresetLogin(preset, true)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white border-[#123B70] ring-1 ring-[#123B70]/20'
                        : 'bg-white border-slate-200 hover:border-[#123B70]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{preset.label}</span>
                      <span className="text-[10px] font-semibold text-[#123B70] whitespace-nowrap shrink-0">
                        {preset.scopeTag}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {preset.staffId}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
            Domain administrators are strictly limited by backend RBAC to their assigned election domain or subdomain (Hall, Faculty, or Department).
          </div>
        </div>

      </div>
    </div>
  );
};
