import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import {
  Check,
  ShieldAlert,
  Vote,
  Award,
  Clock,
  ArrowRight
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { notifications, domains, markNotificationAsRead, markAllNotificationsAsRead, navigateTo, isLoadingData } = useApp();
  const [domainFilter, setDomainFilter] = useState<string>('all');

  const filteredNotifications = notifications.filter((item) => {
    if (domainFilter === 'all') return true;
    return item.domainId === domainFilter;
  });

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
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <Logo variant="default" showWordmark={false} />
            <div>
              <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
                Electoral Broadcasts
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                Notifications & Official Bulletins
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Timely security notices, polling window alerts, and certified declarations across all UCC election domains.
              </p>
            </div>
          </div>

          {notifications.length > 0 && (
            <button
              onClick={() => markAllNotificationsAsRead()}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer whitespace-nowrap shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>

        {/* Domain Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setDomainFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              domainFilter === 'all' ? 'bg-[#123B70] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Domains
          </button>
          {domains.map((dom) => (
            <button
              key={dom.id}
              onClick={() => setDomainFilter(dom.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                domainFilter === dom.id ? 'bg-[#123B70] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dom.shortName}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List / Empty State */}
      {isLoadingData ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          Loading notifications from Cloud Firestore...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No notifications available.</p>
          <p className="text-xs text-slate-500">
            Official electoral notices, polling reminders, and personal alerts will appear here once published.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => {
            const domObj = item.domainId ? domains.find((d) => d.id === item.domainId) : null;
            return (
              <div
                key={item.id}
                onClick={() => {
                  markNotificationAsRead(item.id);
                  if (item.linkAction) {
                    navigateTo(
                      item.linkAction as any,
                      item.domainId && item.linkAction === 'domain_elections'
                        ? { domainId: item.domainId }
                        : undefined
                    );
                  }
                }}
                className={`p-5 rounded-2xl border transition-colors cursor-pointer flex items-start gap-4 bg-white ${
                  item.read
                    ? 'border-slate-200 opacity-90'
                    : 'border-[#123B70]/40'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
                  {getCategoryIcon(item.category)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-bold text-[#123B70] uppercase tracking-wider">
                        {item.category}
                      </span>
                      {domObj && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="font-semibold text-slate-700">{domObj.name}</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
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
                        <span>Open Domain Portal</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                </div>

                {!item.read && (
                  <span className="w-2.5 h-2.5 bg-[#C62828] rounded-full shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
