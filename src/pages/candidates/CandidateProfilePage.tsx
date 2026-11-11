import React from 'react';
import { useApp } from '../../context/AppContext';
import { MOCK_CANDIDATES } from '../../data/mockData';
import { 
  ArrowLeft, 
  Vote, 
  Award, 
  BookOpen, 
  ShieldCheck, 
  Video, 
  Users, 
  CheckCircle2, 
  FileText,
  MapPin,
  GraduationCap
} from 'lucide-react';

export const CandidateProfilePage: React.FC = () => {
  const { selectedCandidateId, navigateTo } = useApp();

  const candidate = MOCK_CANDIDATES[selectedCandidateId] || MOCK_CANDIDATES['cand-01'];

  return (
    <div className="space-y-6">
      
      {/* Back button */}
      <div>
        <button
          onClick={() => navigateTo('candidate_directory')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#123B70] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Candidate Directory</span>
        </button>
      </div>

      {/* Candidate Profile Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="relative shrink-0">
            <img
              src={candidate.photoUrl}
              alt={candidate.fullName}
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover object-center border-2 border-slate-200 shadow-md"
            />
            <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 bg-[#123B70] text-white text-[10px] font-bold rounded-full border-2 border-white shadow-xs">
              APPROVED ASPIRANT
            </div>
          </div>

          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#EAF2FA] text-[#123B70] text-xs font-bold uppercase tracking-wider">
                {candidate.hall}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-xs font-mono text-slate-500">
                ID: {candidate.studentId}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {candidate.fullName}
            </h1>

            {candidate.nickname && (
              <p className="text-base font-bold text-[#C62828]">
                "{candidate.nickname}"
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#123B70]" />
                <span>{candidate.department}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#123B70]" />
                <span>Level {candidate.level} · {candidate.hall}</span>
              </div>
            </div>

            {/* Quick Action */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigateTo('digital_ballot', { electionId: candidate.electionId })}
                className="px-5 py-2.5 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Vote className="w-4 h-4" />
                <span>Cast Vote in this Election</span>
              </button>

              <button
                onClick={() => navigateTo('election_details', { electionId: candidate.electionId })}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                View Election Portfolios
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Full Manifesto & Key Promises */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Full Manifesto Pillars & Leadership */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Executive Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#123B70]" />
              <span>Vision Statement</span>
            </h2>
            <blockquote className="p-4 rounded-xl bg-[#EAF2FA] text-xs sm:text-sm text-[#0B1F3A] font-medium leading-relaxed italic border-l-2 border-[#123B70]">
              "{candidate.manifestoSummary}"
            </blockquote>
          </div>

          {/* Full Manifesto Pillars */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#123B70]" />
              <span>Detailed Manifesto Agenda</span>
            </h2>

            <div className="space-y-3">
              {candidate.fullManifesto.map((pillar, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#123B70] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {pillar}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Leadership Experience */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#123B70]" />
              <span>Prior University Leadership Record</span>
            </h2>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
              {candidate.leadershipExperience.map((exp, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{exp}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Optional Campaign Video Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Video className="w-4 h-4 text-[#123B70]" />
              <span>Official Campaign Address Video</span>
            </h2>
            <div className="aspect-video w-full rounded-xl bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-amber-400">
                <Video className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                Manifesto Town Hall Address by {candidate.fullName}
              </p>
              <p className="text-[11px] text-slate-400">
                Broadcasting in 1080p from UCC Students' Centre (Official Feed)
              </p>
            </div>
          </div>

        </div>

        {/* Right Column: Running Mate & Key Promises */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Running Mate Card if available */}
          {candidate.runningMate && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#123B70]">
                Vice Presidential Running Mate
              </span>
              <div className="flex items-center gap-3 pt-1">
                <img
                  src={candidate.runningMate.photoUrl || '/src/assets/images/candidate_male_1794352938747.jpg'}
                  alt={candidate.runningMate.fullName}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {candidate.runningMate.fullName}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {candidate.runningMate.studentId}
                  </p>
                  <p className="text-[11px] text-[#123B70]">
                    {candidate.runningMate.department}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Key Promises Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Immediate 100-Day Pledges
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              {candidate.keyPromises.map((promise, idx) => (
                <li key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{promise}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Compliance & Vetting Seal */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-xs font-bold text-slate-900">
              Vetted & Cleared by UCC EC
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Candidate has met all constitutional requirements including CGPA qualification and disciplinary clearance.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
