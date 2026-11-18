import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { CandidateAvatar } from '../../components/common/CandidateAvatar';
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
  GraduationCap,
  Mail,
  Scale,
  ExternalLink,
  Clock,
  AlertTriangle,
  Play
} from 'lucide-react';
import { ManifestoComparisonModal } from '../../components/candidates/ManifestoComparisonModal';

export const CandidateProfilePage: React.FC = () => {
  const { selectedCandidateId, candidates, elections, positionsByElection, navigateTo } = useApp();
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Find candidate from live context candidates
  const candidate = candidates.find(c => c.id === selectedCandidateId) || candidates[0];

  if (!candidate) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">
          {candidates.length === 0 ? 'No candidates have been added yet.' : 'Candidate Not Found'}
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {candidates.length === 0
            ? 'No candidate nominations have been published to the electoral register yet.'
            : 'The requested aspirant profile could not be located in the electoral register.'}
        </p>
        <button
          onClick={() => navigateTo('candidate_directory')}
          className="px-4 py-2 rounded-xl bg-[#123B70] text-white text-xs font-bold cursor-pointer"
        >
          Return to Candidate Directory
        </button>
      </div>
    );
  }

  // Find election and position dynamically
  const election = elections.find(e => e.id === candidate.electionId);
  const electionPositions = positionsByElection[candidate.electionId] || [];
  const position = electionPositions.find(p => p.id === candidate.positionId);
  const positionTitle = position ? position.title : candidate.positionId.replace('pos-', '').replace(/-/g, ' ').toUpperCase();

  // Find opponents contesting exclusively for the same election AND position
  const opponents = candidates.filter(
    c => c.electionId === candidate.electionId && c.positionId === candidate.positionId
  );

  const isApproved = candidate.applicationStatus === 'Approved';

  return (
    <div className="space-y-6">
      
      {/* Top navigation row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() =>
              navigateTo('candidate_directory', {
                electionId: candidate.electionId,
                positionId: candidate.positionId
              })
            }
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#123B70] hover:underline transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {positionTitle} Candidates</span>
          </button>

          <button
            onClick={() => navigateTo('candidate_directory')}
            className="text-xs font-semibold text-slate-500 hover:text-[#123B70] transition-colors cursor-pointer"
          >
            All Positions Directory
          </button>
        </div>

        {opponents.length > 1 && (
          <button
            onClick={() => setShowComparisonModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EAF2FA] hover:bg-blue-100 text-[#123B70] text-xs font-bold transition-colors cursor-pointer border border-blue-200"
          >
            <Scale className="w-3.5 h-3.5 text-[#123B70]" />
            <span>Compare Manifestos for {positionTitle} ({opponents.length} Aspirants)</span>
          </button>
        )}
      </div>

      {/* Candidate Profile Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row items-start gap-6 lg:gap-8">
          
          {/* Large Profile Photograph with Status Badge */}
          <div className="relative shrink-0 mx-auto md:mx-0">
            <CandidateAvatar
              src={candidate.photoUrl}
              alt={candidate.fullName}
              className="w-36 h-36 sm:w-48 sm:h-48 rounded-2xl object-cover object-top border-2 border-slate-200 shadow-md ring-4 ring-[#EAF2FA]"
            />
            
            {candidate.applicationStatus === 'Approved' && (
              <div className="absolute -bottom-2.5 inset-x-2 px-2.5 py-1 bg-[#123B70] text-white text-[10px] font-bold rounded-lg border-2 border-white shadow-xs text-center uppercase tracking-wider flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Approved Aspirant</span>
              </div>
            )}
            {candidate.applicationStatus === 'Under review' && (
              <div className="absolute -bottom-2.5 inset-x-2 px-2.5 py-1 bg-purple-700 text-white text-[10px] font-bold rounded-lg border-2 border-white shadow-xs text-center uppercase tracking-wider flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-purple-200" />
                <span>Under Review</span>
              </div>
            )}
            {candidate.applicationStatus === 'Submitted' && (
              <div className="absolute -bottom-2.5 inset-x-2 px-2.5 py-1 bg-amber-600 text-white text-[10px] font-bold rounded-lg border-2 border-white shadow-xs text-center uppercase tracking-wider">
                Submitted
              </div>
            )}
            {candidate.applicationStatus === 'Draft' && (
              <div className="absolute -bottom-2.5 inset-x-2 px-2.5 py-1 bg-slate-600 text-white text-[10px] font-bold rounded-lg border-2 border-white shadow-xs text-center uppercase tracking-wider">
                Draft Record
              </div>
            )}
            {candidate.applicationStatus === 'Rejected' && (
              <div className="absolute -bottom-2.5 inset-x-2 px-2.5 py-1 bg-red-700 text-white text-[10px] font-bold rounded-lg border-2 border-white shadow-xs text-center uppercase tracking-wider">
                Disqualified
              </div>
            )}
            {candidate.applicationStatus === 'Withdrawn' && (
              <div className="absolute -bottom-2.5 inset-x-2 px-2.5 py-1 bg-slate-700 text-white text-[10px] font-bold rounded-lg border-2 border-white shadow-xs text-center uppercase tracking-wider">
                Withdrawn
              </div>
            )}
          </div>

          {/* Profile Header Details */}
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Logo variant="compact" showWordmark={false} />
              <span className="px-3 py-1 rounded-full bg-[#123B70] text-white text-xs font-bold uppercase tracking-wider">
                Contesting: {positionTitle}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-semibold text-slate-600">
                {election?.title || 'UCC Election'}
              </span>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {candidate.fullName}
              </h1>
              {candidate.historicalRole && (
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                    candidate.historicalRole === 'Winner' ||
                    candidate.historicalRole === 'Elected' ||
                    candidate.historicalRole === 'Elected Unopposed'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {candidate.historicalRole}
                </span>
              )}
            </div>
            {candidate.nickname && (
              <p className="text-base font-bold text-[#C62828] mt-0.5">
                "{candidate.nickname}"
              </p>
            )}
            {candidate.historicalOutcomeNote && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed">
                <strong className="font-bold">2026 Historical Record: </strong>
                {candidate.historicalOutcomeNote}
              </div>
            )}

            {/* Academic & University Profile Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-700 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#123B70] shrink-0" />
                <span><strong>Programme:</strong> {candidate.programme || candidate.department}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#123B70] shrink-0" />
                <span>
                  <strong>Standing:</strong>{' '}
                  {candidate.level === 'Not verified' ? 'Level not verified' : `Level ${candidate.level}`} · {candidate.hall || 'Not verified'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#123B70] shrink-0" />
                <span><strong>ID:</strong> <code className="font-mono">{candidate.studentId}</code></span>
              </div>
              {candidate.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#123B70] shrink-0" />
                  <span className="truncate"><strong>Email:</strong> {candidate.email}</span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="pt-4 flex flex-wrap items-center gap-3">
              {isApproved && election?.status === 'live' && (
                <button
                  onClick={() => navigateTo('digital_ballot', { electionId: candidate.electionId })}
                  className="px-5 py-2.5 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  <Vote className="w-4 h-4" />
                  <span>Cast Vote for this Portfolio</span>
                </button>
              )}

              {opponents.length > 1 && (
                <button
                  onClick={() => setShowComparisonModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#EAF2FA] hover:bg-blue-100 text-[#123B70] font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer border border-blue-200"
                >
                  <Scale className="w-4 h-4" />
                  <span>Side-by-Side Comparison</span>
                </button>
              )}

              <button
                onClick={() => navigateTo('election_details', { electionId: candidate.electionId })}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                View All Portfolios
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Full Manifesto & Key Promises */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Biography, Vision, Full Manifesto & Video */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Candidate Biography */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#123B70]" />
              <span>Candidate Biography & Background</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2">
              {candidate.biography ? (
                candidate.biography.split('\n\n').map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))
              ) : (
                <p className="text-slate-500 italic">
                  {candidate.isHistoricalRecord
                    ? 'Biography not yet provided (Historical 2026 Record). Administrators may add verified biographical details.'
                    : 'No candidate biography submitted.'}
                </p>
              )}
            </div>
          </div>

          {/* Vision Statement / Manifesto Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#123B70]" />
              <span>Vision Statement & Core Slogan</span>
            </h2>
            {candidate.manifestoSummary ? (
              <blockquote className="p-4 rounded-xl bg-[#EAF2FA] text-xs sm:text-sm text-[#0B1F3A] font-medium leading-relaxed italic border-l-4 border-[#123B70]">
                "{candidate.manifestoSummary}"
              </blockquote>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Vision statement not yet provided.
              </p>
            )}
          </div>

          {/* Full Manifesto Pillars */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#123B70]" />
                <span>Detailed Manifesto Policy Agenda</span>
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">
                {candidate.fullManifesto?.length || 0} Strategic Pillars
              </span>
            </div>

            {candidate.fullManifesto && candidate.fullManifesto.length > 0 ? (
              <div className="space-y-3">
                {candidate.fullManifesto.map((pillar, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#123B70] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                        {pillar}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No manifesto policy proposals recorded yet.
              </p>
            )}
          </div>

          {/* Prior Leadership Experience */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#123B70]" />
              <span>Prior University Leadership & Service Record</span>
            </h2>
            {candidate.leadershipExperience && candidate.leadershipExperience.length > 0 ? (
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                {candidate.leadershipExperience.map((exp, idx) => (
                  <li key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{exp}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No prior leadership record provided.
              </p>
            )}
          </div>

          {/* Campaign Video */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-[#123B70]" />
                <span>Official Campaign Address Video</span>
              </h2>
              {candidate.videoUrl && (
                <a
                  href={candidate.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#123B70] hover:underline font-semibold flex items-center gap-1"
                >
                  <span>Open Video Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {candidate.videoUrl ? (
              <div className="space-y-3">
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-900 relative shadow-inner">
                  {candidate.videoUrl.includes('youtube.com') || candidate.videoUrl.includes('youtu.be') ? (
                    <iframe
                      src={candidate.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                      title={`Campaign Address - ${candidate.fullName}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-gradient-to-br from-[#0B1F3A] to-[#123B70]">
                      <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center mb-3 text-white shadow-lg">
                        <Play className="w-7 h-7 fill-white ml-1" />
                      </div>
                      <h4 className="text-sm font-bold">{candidate.fullName}'s Official Address</h4>
                      <p className="text-xs text-slate-300 max-w-md mt-1">
                        Campaign video stream linked: {candidate.videoUrl}
                      </p>
                      <a
                        href={candidate.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Watch Campaign Video in Full Screen</span>
                      </a>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  Recorded and archived by UCC SRC Electoral Media Directorate. Broadcast in accordance with UCC electoral broadcast guidelines.
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center space-y-1.5">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                  <Video className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  No campaign video URL submitted
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  {candidate.isHistoricalRecord
                    ? 'No archival campaign address recording was included in the 2026 record.'
                    : 'No third-party campaign address URL has been linked for this candidate.'}
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Running Mate, Key Promises, Vetting Clearance */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Running Mate Card if available */}
          {candidate.runningMate && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#123B70]">
                Vice Presidential Running Mate
              </span>
              <div className="flex items-center gap-3 pt-1">
                <CandidateAvatar
                  src={candidate.runningMate.photoUrl}
                  alt={candidate.runningMate.fullName}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {candidate.runningMate.fullName}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {candidate.runningMate.studentId}
                  </p>
                  <p className="text-[11px] text-[#123B70] truncate">
                    {candidate.runningMate.department}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Key Promises Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center justify-between">
              <span>Immediate 100-Day Pledges</span>
              <span className="text-[10px] font-mono text-slate-500">{candidate.keyPromises?.length || 0} Pledges</span>
            </h3>
            {candidate.keyPromises && candidate.keyPromises.length > 0 ? (
              <ul className="space-y-2 text-xs text-slate-700">
                {candidate.keyPromises.map((promise, idx) => (
                  <li key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{promise}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No campaign pledges recorded yet.
              </p>
            )}
          </div>

          {/* Electoral Commission Vetting & Eligibility Seal */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-xs font-bold text-slate-900">
              {candidate.isHistoricalRecord
                ? 'Historical 2026 Record'
                : isApproved
                ? 'Vetted & Cleared by UCC EC'
                : `Application Status: ${candidate.applicationStatus}`}
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {candidate.isHistoricalRecord
                ? 'Recorded from 2026 UCC historical election archives. Administrators may enrich incomplete biography or manifesto details.'
                : isApproved 
                ? 'Candidate has satisfied all constitutional requirements including CGPA qualification (min 3.0), student status, and disciplinary standing.'
                : candidate.rejectionReason 
                ? `Rejection Notice: ${candidate.rejectionReason}`
                : candidate.correctionNotes
                ? `Corrections Requested: ${candidate.correctionNotes}`
                : 'Aspirant application is currently progressing through official UCC Electoral Commission review.'}
            </p>
            {candidate.reviewedBy && (
              <p className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200">
                Audited by: {candidate.reviewedBy}
              </p>
            )}
          </div>

          {/* Manifesto Comparison Widget */}
          {opponents.length > 1 && (
            <div className="bg-gradient-to-br from-[#123B70] to-[#0B1F3A] text-white rounded-2xl p-5 shadow-md space-y-3">
              <Scale className="w-6 h-6 text-amber-400" />
              <h4 className="text-xs font-bold">Unsure between candidates?</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Compare all {opponents.length} aspirants contesting for {positionTitle} side-by-side with zero bias.
              </p>
              <button
                onClick={() => setShowComparisonModal(true)}
                className="w-full py-2 rounded-xl bg-white text-[#123B70] hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                Launch Side-by-Side Comparison
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Manifesto Comparison Modal */}
      <ManifestoComparisonModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        initialElectionId={candidate.electionId}
        initialPositionId={candidate.positionId}
        initialCandidateIds={[candidate.id, ...opponents.filter(o => o.id !== candidate.id).map(o => o.id)].slice(0, 2)}
        positionTitle={positionTitle}
        electionTitle={election?.title || 'UCC Election'}
        candidates={opponents}
      />

    </div>
  );
};

