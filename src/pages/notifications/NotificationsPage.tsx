import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Bell, 
  Check, 
  ShieldAlert, 
  Vote, 
  Award, 
  Clock, 
  Calendar,
  ArrowRight
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { notifications, markNotificationAsRead, navigateTo } = useApp();

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'election':
        return <Vote className="w-5 h-5 text-[#123B70]" />;
      case 'security':
        return <ShieldAlert className="w-5 h-5 text-amber-600" />;
      case 'results':
        return <Award className="w-5 h-5 text-emerald-600" />;
      case 'deadline':
      default:
        return <Clock className="w-5 h-5 text-[#C62828]" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
            Electoral Broadcasts
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Notifications & Official Bulletins
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Timely security notices, polling window alerts, and certified declarations from the Electoral Commission.
          </p>
        </div>

        <button
          onClick={() => {
            notifications.forEach(n => markNotificationAsRead(n.id));
          }}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              markNotificationAsRead(item.id);
              if (item.linkAction) navigateTo(item.linkAction as any);
            }}
            className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
              item.read 
                ? 'bg-white border-slate-200 opacity-90' 
                : 'bg-white border-[#123B70]/40 shadow-xs ring-1 ring-[#123B70]/10'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
              {getCategoryIcon(item.category)}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider">
                  {item.category}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {item.timestamp}
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {item.title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {item.message}
              </p>

              {item.linkAction && (
                <div className="pt-2">
                  <span className="text-xs font-bold text-[#123B70] hover:underline inline-flex items-center gap-1">
                    <span>Take Action / Open Portal</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              )}
            </div>

            {!item.read && (
              <span className="w-2.5 h-2.5 bg-[#C62828] rounded-full shrink-0 mt-2" />
            )}
          </div>
        ))}
      </div>

    </div>
  );
};
