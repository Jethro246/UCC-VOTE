import React from 'react';
import { useApp } from '../../context/AppContext';
import { AuthTestConsole } from './AuthTestConsole';
import { ShieldCheck, User, LogOut, Terminal, Lock } from 'lucide-react';

export const DemoNotice: React.FC = () => {
  const { userRole, loginAsStudent, loginAsAdmin, logout, navigateTo, activeView, student, admin } = useApp();

  return (
    <div className="bg-[#0B1F3A] text-white text-xs border-b border-slate-700/60 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold text-slate-200">
            Phase 2: Student Authentication & Security System
          </span>
          <span className="text-slate-500 hidden sm:inline">·</span>
          <span className="text-slate-400 hidden sm:inline">
            PBKDF2 Password Hashing · Server-Side RBAC · Rate Limiting Active
          </span>
        </div>

        {/* Action controls & Test console trigger */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Diagnostic Console Button */}
          <AuthTestConsole />

          <button
            onClick={() => {
              if (userRole === 'student') {
                navigateTo('student_dashboard');
              } else {
                loginAsStudent();
              }
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              userRole === 'student' 
                ? 'bg-[#123B70] text-white border border-blue-400/40 shadow-xs' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <User className="w-3 h-3 text-sky-400" />
            <span>Student Mode</span>
          </button>

          <button
            onClick={() => {
              if (userRole === 'admin') {
                navigateTo('admin_dashboard');
              } else {
                loginAsAdmin();
              }
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              userRole === 'admin' 
                ? 'bg-[#C62828] text-white border border-red-400/40 shadow-xs' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-3 h-3 text-red-300" />
            <span>Admin Portal</span>
          </button>

          {userRole !== 'guest' ? (
            <button
              onClick={logout}
              className="px-2 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
              title="Sign Out Session"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          ) : (
            <button
              onClick={() => navigateTo('landing')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                activeView === 'landing' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Public
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
