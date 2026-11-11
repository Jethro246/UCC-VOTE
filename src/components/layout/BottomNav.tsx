import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Vote, Users, Award, Bell } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeView, navigateTo, notifications, userRole } = useApp();
  const unreadNotifs = notifications.filter(n => !n.read).length;

  // Only show bottom nav if in mobile viewport and either logged in as student or exploring
  const navItems = [
    { 
      id: userRole === 'admin' ? 'admin_dashboard' : 'student_dashboard', 
      label: userRole === 'admin' ? 'Console' : 'Dashboard', 
      icon: LayoutDashboard 
    },
    { id: 'elections_directory', label: 'Elections', icon: Vote },
    { id: 'digital_ballot', label: 'Ballot', icon: Vote, highlight: true },
    { id: 'election_results', label: 'Results', icon: Award },
    { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadNotifs }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id as any)}
              className={`flex flex-col items-center justify-center py-1 rounded-lg text-[10px] font-medium transition-colors relative ${
                isActive
                  ? 'text-[#123B70] font-bold'
                  : item.highlight
                  ? 'text-[#C62828] font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#123B70]' : item.highlight ? 'text-[#C62828]' : 'text-slate-400'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#C62828] rounded-full" />
                ) : null}
              </div>
              <span className="mt-0.5 truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
