import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  Vote, 
  Users, 
  Award, 
  Calendar, 
  Bell, 
  UserCircle, 
  HelpCircle, 
  ShieldCheck, 
  LogOut,
  FileText,
  Sliders,
  CheckCircle,
  AlertTriangle,
  History,
  Building
} from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isAdmin = false }) => {
  const { 
    activeView, 
    navigateTo, 
    notifications, 
    student, 
    admin, 
    logout 
  } = useApp();

  const unreadNotifs = notifications.filter(n => !n.read).length;

  if (isAdmin) {
    const adminNavItems = [
      { id: 'admin_dashboard', label: 'Admin Overview', icon: LayoutDashboard },
      { id: 'elections_directory', label: 'Election Management', icon: Vote },
      { id: 'candidate_directory', label: 'Candidate Nominations', icon: Users },
      { id: 'election_results', label: 'Results Certification', icon: Award },
      { id: 'election_calendar', label: 'Election Calendar', icon: Calendar },
      { id: 'help_support', label: 'Complaints & Inquiries', icon: HelpCircle },
    ];

    return (
      <aside className="w-64 shrink-0 bg-[#0B1F3A] text-slate-200 border-r border-slate-800 min-h-[calc(100vh-4rem)] flex flex-col justify-between hidden md:flex">
        <div className="p-4 space-y-6">
          {/* Admin Identity Card */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#C62828] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                EC
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {admin?.fullName || 'Dr. J. Tetteh'}
                </p>
                <p className="text-[11px] text-amber-400 font-medium">
                  {admin?.role || 'Electoral Commissioner'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  {admin?.staffId || 'UCC/EC/ST/2019/04'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Electoral Administration
            </p>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#123B70] text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Security Status Box */}
          <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span>Security Engine</span>
              <span className="text-emerald-400 font-mono text-[10px]">ACTIVE</span>
            </div>
            <p className="text-slate-400 text-[10px] leading-tight">
              Cryptographic separation between ballot storage and voter identification is enforced.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => navigateTo('student_dashboard')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span>Switch to Student View</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    );
  }

  // Student Navigation
  const studentNavItems = [
    { id: 'student_dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'elections_directory', label: 'Elections', icon: Vote },
    { id: 'candidate_directory', label: 'Candidates & Manifestos', icon: Users },
    { id: 'digital_ballot', label: 'Digital Ballot', icon: Vote, highlight: true },
    { id: 'election_results', label: 'Election Results', icon: Award },
    { id: 'election_calendar', label: 'Election Calendar', icon: Calendar },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs },
    { id: 'student_profile', label: 'My Student Profile', icon: UserCircle },
    { id: 'help_support', label: 'Support & Complaints', icon: HelpCircle },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] flex flex-col justify-between hidden md:flex">
      <div className="p-4 space-y-6">
        {/* Student Profile Quick Capsule */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <img
              src={student?.avatarUrl || '/src/assets/images/candidate_male_1794352938747.jpg'}
              alt={student?.fullName || 'Student'}
              className="w-10 h-10 rounded-full object-cover border border-slate-300 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {student?.fullName || 'Kofi Mensah Sarbah'}
              </p>
              <p className="text-[11px] text-[#123B70] font-medium truncate">
                {student?.programme || 'B.Sc. Computer Science'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {student?.studentId || 'PS/CSC/22/0089'}
              </p>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Eligibility Status:</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Verified
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Student Portal
          </p>
          {studentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#123B70] text-white font-semibold shadow-xs'
                    : item.highlight
                    ? 'text-[#C62828] hover:bg-red-50 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${
                    isActive 
                      ? 'text-white' 
                      : item.highlight 
                      ? 'text-[#C62828]' 
                      : 'text-slate-500'
                  }`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#C62828] text-white rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer sign out */}
      <div className="p-4 border-t border-slate-200">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
