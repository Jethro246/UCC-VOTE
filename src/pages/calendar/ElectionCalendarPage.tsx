import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { ElectionCategory } from '../../types';

export const ElectionCalendarPage: React.FC = () => {
  const { calendarEvents, isLoadingData } = useApp();
  const [selectedCat, setSelectedCat] = useState<ElectionCategory | 'All'>('All');

  const categories: (ElectionCategory | 'All')[] = [
    'All',
    'SRC',
    'JCR / Hall',
    'GRASAG',
    'Local NUGS',
    'Departmental',
    'Faculty / School',
  ];

  const filteredEvents = calendarEvents.filter(
    (ev) => selectedCat === 'All' || ev.electionCategory === selectedCat
  );

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'voting':
        return (
          <span className="text-emerald-700 text-[11px] font-bold uppercase tracking-wider">
            Live Voting
          </span>
        );
      case 'results':
        return (
          <span className="text-amber-700 text-[11px] font-bold uppercase tracking-wider">
            Results Declaration
          </span>
        );
      case 'campaign':
        return (
          <span className="text-purple-700 text-[11px] font-bold uppercase tracking-wider">
            Debate / Campaign
          </span>
        );
      case 'vetting':
        return (
          <span className="text-[#123B70] text-[11px] font-bold uppercase tracking-wider">
            Vetting
          </span>
        );
      default:
        return (
          <span className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">
            Electoral Event
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <Logo variant="default" showWordmark={false} />
          <div>
            <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
              UCC Electoral Schedule
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Official Electoral Calendar
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Scheduled dates for nominations, vetting sessions, voting windows, and declarations across UCC election domains.
            </p>
          </div>
        </div>

        {/* Category Filter buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedCat === c
                  ? 'bg-[#123B70] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Timeline / Empty State */}
      {isLoadingData ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          Loading electoral calendar from Cloud Firestore...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-2">
          <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">
            No electoral calendar events scheduled yet.
          </p>
          <p className="text-xs text-slate-500">
            Upcoming nomination, vetting, voting, and declaration dates published by the UCC Electoral Commission will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 hover:border-[#123B70]/40 transition-colors flex flex-col sm:flex-row sm:items-start gap-5"
            >
              <div className="p-3.5 rounded-xl bg-[#EAF2FA] text-[#123B70] text-center min-w-[90px] shrink-0 border border-blue-100">
                <span className="text-[11px] uppercase font-bold tracking-wider block">
                  {new Date(ev.startDate).toLocaleDateString('en-US', { month: 'short' })}
                </span>
                <span className="text-2xl font-black font-mono tabular-nums block">
                  {new Date(ev.startDate).getDate()}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block">
                  {new Date(ev.startDate).getFullYear()}
                </span>
              </div>

              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {getTypeLabel(ev.type)}
                  <span className="text-slate-300">·</span>
                  <span className="text-xs font-bold text-[#123B70] uppercase">
                    {ev.electionCategory}
                  </span>
                  {ev.subdomainLabel && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500">{ev.subdomainLabel}</span>
                    </>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {ev.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {ev.description}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {new Date(ev.startDate).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      –{' '}
                      {new Date(ev.endDate).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      GMT
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ev.location}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
