import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../common/Logo';
import { CandidateAvatar } from '../common/CandidateAvatar';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { 
  Bell, 
  Menu, 
  X, 
  User, 
  ShieldCheck, 
  Vote, 
  Calendar, 
  HelpCircle, 
  Award,
  ChevronRight,
  LogOut
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { 
    activeView, 
    userRole, 
    student, 
    admin, 
    notifications, 
    navigateTo, 
    logout 
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadNotifs = notifications.filter(n => !n.read).length;

  const handleNav = (view: any) => {
    navigateTo(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-6 h-16">
          {/* Zone 1: Official UCC Crest & Brand Wordmark */}
          <button 
            onClick={() => handleNav('landing')} 
            className="text-left min-w-0 shrink cursor-pointer focus:outline-none"
          >
            <span className="inline-flex sm:hidden">
              <Logo variant="compact" />
            </span>
            <span className="hidden sm:inline-flex">
              <Logo variant="default" />
            </span>
          </button>

          {/* Zone 2: Concise Single-Line Nav Links */}
          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600">
            <button
              onClick={() => handleNav('elections_directory')}
              className={`hover:text-[#123B70] transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'elections_directory' ||
                activeView === 'domain_elections' ||
                activeView === 'election_details'
                  ? 'text-[#123B70] font-semibold'
                  : ''
              }`}
            >
              Elections
            </button>
            <button
              onClick={() => handleNav('candidate_directory')}
              className={`hover:text-[#123B70] transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'candidate_directory' || activeView === 'candidate_profile'
                  ? 'text-[#123B70] font-semibold'
                  : ''
              }`}
            >
              Candidates
            </button>
            <button
              onClick={() => handleNav('digital_ballot')}
              className={`hover:text-[#123B70] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeView === 'digital_ballot'
                  ? 'text-[#123B70] font-semibold'
                  : ''
              }`}
            >
              <span>Ballot Preview</span>
            </button>
            <button
              onClick={() => handleNav('election_results')}
              className={`hover:text-[#123B70] transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'election_results' ? 'text-[#123B70] font-semibold' : ''
              }`}
            >
              Results
            </button>
            <button
              onClick={() => handleNav('election_calendar')}
              className={`hover:text-[#123B70] transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'election_calendar' ? 'text-[#123B70] font-semibold' : ''
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => handleNav('help_support')}
              className={`hover:text-[#123B70] transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'help_support' ? 'text-[#123B70] font-semibold' : ''
              }`}
            >
              Support
            </button>
          </nav>

          {/* Zone 3: Install App + Primary Action */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton variant="header" />
            </div>
            {userRole === 'student' && student ? (
              <div className="flex items-center gap-1 sm:gap-3">
                <button
                  onClick={() => handleNav('notifications')}
                  className="relative p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifs > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#C62828] rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => handleNav('student_dashboard')}
                  className="flex items-center gap-2.5 p-1 sm:pl-2 sm:pr-3 sm:py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                >
                  <CandidateAvatar
                    src={student.avatarUrl || student.photoUrl}
                    alt={student.fullName || student.email || 'Student'}
                    className="w-7 h-7 rounded-full object-cover border border-slate-300 text-[10px]"
                  />
                  <div className="hidden sm:block">
                    <p className="text-xs font-semibold text-slate-900 leading-none truncate max-w-[120px]">
                      {(student.fullName || student.email || 'Student').split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[120px]">
                      {student.studentId || student.email || 'Google Account'}
                    </p>
                  </div>
                </button>
              </div>
            ) : userRole === 'admin' && admin ? (
              <button
                onClick={() => handleNav('admin_dashboard')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0B1F3A] hover:bg-[#123B70] rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Console</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNav('student_login')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#123B70] hover:bg-[#0B1F3A] rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                >
                  Student Login
                </button>
              </div>
            )}

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 shadow-lg animate-in fade-in slide-in-from-top duration-150">
          <div className="space-y-1">
            <button
              onClick={() => handleNav('landing')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Home
            </button>
            <button
              onClick={() => handleNav('elections_directory')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Elections Directory</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => handleNav('candidate_directory')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Candidate Directory</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => handleNav('digital_ballot')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Digital Ballot Preview</span>
              <Vote className="w-4 h-4 text-[#123B70]" />
            </button>
            <button
              onClick={() => handleNav('election_results')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Election Results</span>
              <Award className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => handleNav('election_calendar')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Election Calendar</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => handleNav('help_support')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Help & Support</span>
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <PWAInstallButton variant="menu" />
              {userRole === 'admin' && admin ? (
                <>
                  <button
                    onClick={() => handleNav('admin_dashboard')}
                    className="w-full px-4 py-2.5 text-center text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Go to Admin Dashboard</span>
                  </button>
                  <button
                    onClick={logout}
                    className="w-full px-4 py-2 text-center text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </>
              ) : userRole === 'student' && student ? (
                <>
                  <button
                    onClick={() => handleNav('student_dashboard')}
                    className="w-full px-4 py-2.5 text-center text-xs font-semibold text-white bg-[#123B70] rounded-lg"
                  >
                    Go to Student Dashboard
                  </button>
                  <button
                    onClick={logout}
                    className="w-full px-4 py-2 text-center text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleNav('student_login')}
                    className="px-3 py-2 text-center text-xs font-semibold text-white bg-[#123B70] rounded-lg"
                  >
                    Student Login
                  </button>
                  <button
                    onClick={() => handleNav('admin_login')}
                    className="px-3 py-2 text-center text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Admin Portal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
