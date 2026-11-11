import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MOCK_CALENDAR_EVENTS } from '../../data/mockData';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Filter, 
  Vote, 
  Users, 
  Award, 
  FileText 
} from 'lucide-react';
import { ElectionCategory } from '../../types';

export const ElectionCalendarPage: React.FC = () => {
  const [selectedCat, setSelectedCat] = useState<ElectionCategory | 'All'>('All');

  const categories: (ElectionCategory | 'All')[] = [
    'All',
    'SRC',
    'JCR / Hall',
    'Departmental',
    'Faculty / School',
    'GRASAG'
  ];

  const filteredEvents = MOCK_CALENDAR_EVENTS.filter(
    ev => selectedCat === 'All' || ev.electionCategory === selectedCat
  );

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'voting':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">Live Voting</span>;
      case 'results':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold uppercase">Results Declaration</span>;
      case 'campaign':
        return <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">Debate / Campaign</span>;
      case 'vetting':
        return <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#123B70] text-[10px] font-bold uppercase">Vetting</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold uppercase">Electoral Event</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
            Academic Year 2026/2027
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Official Electoral Calendar
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Important dates for candidate nominations, vetting sessions, voting days, and certified declarations.
          </p>
        </div>

        {/* Category Filter buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCat === c
                  ? 'bg-[#123B70] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Timeline */}
      <div className="space-y-4">
        {filteredEvents.map((ev, idx) => (
          <div
            key={ev.id}
            className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-[#123B70]/40 transition-all flex flex-col sm:flex-row sm:items-start gap-5"
          >
            {/* Date Block */}
            <div className="p-3.5 rounded-xl bg-[#EAF2FA] text-[#123B70] text-center min-w-[90px] shrink-0 border border-blue-100">
              <span className="text-[11px] uppercase font-bold tracking-wider block">
                {new Date(ev.startDate).toLocaleDateString('en-US', { month: 'short' })}
              </span>
              <span className="text-2xl font-black font-mono block">
                {new Date(ev.startDate).getDate()}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block">
                {new Date(ev.startDate).getFullYear()}
              </span>
            </div>

            {/* Event Details */}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {getTypeBadge(ev.type)}
                <span className="text-slate-400">·</span>
                <span className="text-xs font-bold text-[#123B70] uppercase">
                  {ev.electionCategory}
                </span>
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
                    {new Date(ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} GMT
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

    </div>
  );
};
