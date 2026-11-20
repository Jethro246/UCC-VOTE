import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { electionClient } from '../../services/electionClient';
import { Logo } from '../../components/common/Logo';
import { CandidateAvatar } from '../../components/common/CandidateAvatar';
import { resolveCandidatePhotoUrl } from '../../utils/contestantUtils';
import { Position } from '../../types';
import {
  UNVERIFIED_HALL_MESSAGE,
  getHallDisplayName,
  isOfficialHallAffiliation,
  matchesHallAffiliation,
  resolveElectionHallUnit
} from '../../utils/hallUtils';
import { formatElectionWindow } from '../../utils/dateUtils';
import { 
  ArrowLeft, 
  Vote, 
  Clock, 
  ShieldCheck, 
  Users, 
  Award, 
  FileCheck, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building
} from 'lucide-react';

export const ElectionDetailsPage: React.FC = () => {
  const { selectedElectionId, elections, candidates, halls, navigateTo, student } = useApp();

  const election = elections.find(e => e.id === selectedElectionId) || elections[0];
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    if (!election?.id) {
      setPositions([]);
      return;
    }
    let active = true;
    electionClient.getElectionById(election.id).then((res) => {
      if (active && res.success && res.positions) {
        setPositions(res.positions);
      }
    });
    return () => { active = false; };
  }, [election?.id]);

  if (!election) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
        <Vote className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="ucc-heading-section text-slate-900">No active elections at the moment.</h2>
        <p className="ucc-body-secondary text-slate-500">
          Elections published in Cloud Firestore will appear here with full details and positions.
        </p>
        <button
          onClick={() => navigateTo('elections_directory')}
          className="px-4 py-2 rounded-xl bg-[#123B70] text-white text-sm font-semibold cursor-pointer"
        >
          Back to Elections Directory
        </button>
      </div>
    );
  }

  const hasVoted = student?.hasVotedElections.includes(election.id);

  // Check eligibility for student against multi-tier domain criteria
  let isEligible = true;
  let eligibilityReason = 'You satisfy all university eligibility criteria for this ballot.';

  if (student) {
    const resolvedHallUnit = resolveElectionHallUnit(election, halls);
    const crit = election.eligibilityCriteria;
    const isHallScoped =
      election.domainId === 'jcrc_hall' ||
      election.category === 'JCR / Hall' ||
      Boolean(election.hallId) ||
      Boolean(crit?.halls && crit.halls.length > 0);

    if (student.status === 'suspended' || !student.isEligible) {
      isEligible = false;
      eligibilityReason =
        student.status === 'suspended'
          ? 'Your voter account has been administratively suspended.'
          : 'Pending UCC Electoral Commission voter roll confirmation.';
    } else if (
      (election.domainId === 'grasag' || election.category === 'GRASAG') &&
      student.level !== 'Postgraduate'
    ) {
      isEligible = false;
      eligibilityReason = `GRASAG elections are strictly restricted to Postgraduate students. Your level is Level ${student.level}.`;
    } else if (isHallScoped && !isOfficialHallAffiliation(student.hall, halls)) {
      isEligible = false;
      eligibilityReason = UNVERIFIED_HALL_MESSAGE;
    } else if (isHallScoped) {
      const targetHalls =
        crit?.halls && crit.halls.length > 0
          ? crit.halls
          : resolvedHallUnit
          ? [resolvedHallUnit.name]
          : election.hallId
          ? [election.hallId]
          : election.subdomainLabel
          ? [election.subdomainLabel]
          : [];

      if (
        targetHalls.length > 0 &&
        !targetHalls.some((h) => matchesHallAffiliation(student.hall, h, resolvedHallUnit))
      ) {
        isEligible = false;
        const targetLabel = resolvedHallUnit
          ? getHallDisplayName(resolvedHallUnit)
          : targetHalls.join(', ');
        eligibilityReason = `Restricted to registered members of ${targetLabel}. Your hall is ${student.hall}.`;
      }
    }

    if (isEligible && crit) {
      if (crit.levels && crit.levels.length > 0 && !crit.levels.includes(student.level)) {
        isEligible = false;
        eligibilityReason = `Restricted to ${crit.levels.join(', ')}. Your registered level is Level ${student.level}.`;
      } else if (
        crit.faculties &&
        crit.faculties.length > 0 &&
        !crit.faculties.some((f) => student.faculty?.toLowerCase().includes(f.toLowerCase()))
      ) {
        isEligible = false;
        eligibilityReason = `Restricted to ${crit.faculties.join(', ')}. Your faculty is ${student.faculty}.`;
      } else if (
        crit.departments &&
        crit.departments.length > 0 &&
        !crit.departments.some((d) =>
          student.department?.toLowerCase().includes(d.toLowerCase())
        )
      ) {
        isEligible = false;
        eligibilityReason = `Restricted to ${crit.departments.join(', ')}. Your department is ${student.department}.`;
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigateTo('elections_directory')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#123B70] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Elections Directory</span>
        </button>
        {election.domainId && (
          <>
            <span className="text-slate-300">/</span>
            <button
              onClick={() => navigateTo('domain_elections', { domainId: election.domainId })}
              className="text-sm font-semibold text-[#123B70] hover:underline cursor-pointer"
            >
              {election.category} Domain
            </button>
          </>
        )}
      </div>

      {/* Main Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 max-md:gap-3">
          <div className="flex items-start gap-4 max-md:gap-2.5 max-w-3xl">
            <Logo variant="default" showWordmark={false} className="mt-1 hidden sm:inline-flex" />
            <div className="space-y-2 max-md:space-y-1">
              <div className="flex flex-wrap items-center gap-2 ucc-caption text-slate-500">
                <span className="font-semibold text-[#123B70] uppercase tracking-wider">
                  {election.category}
                </span>
                {election.subdomainLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-700">{election.subdomainLabel}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-medium">Election Code: {election.code}</span>
                <span aria-hidden="true">·</span>
                <span className="font-normal">Academic Year {election.academicYear}</span>
              </div>

              <h1 className="ucc-heading-page text-slate-900">
                {election.title}
              </h1>

            <p className="ucc-body-secondary text-slate-600 pt-1 max-md:pt-0">
              {election.description}
            </p>

            {election.historicalNote && (
              <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 ucc-body-secondary text-amber-950">
                <strong className="font-semibold">Historical Archive Record Notice: </strong>
                {election.historicalNote}
              </div>
            )}

            <div className="pt-2 max-md:pt-1 flex flex-wrap items-center gap-4 max-md:gap-2 ucc-caption font-normal text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" />
                <span>Organizing Secretariat: <strong className="font-semibold text-slate-700">{election.organizingBody}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{formatElectionWindow(election)}</span>
              </span>
            </div>
            </div>
          </div>

          {/* Action box */}
          <div className="shrink-0 p-5 max-md:p-3 rounded-2xl bg-slate-50 border border-slate-200 min-w-[240px] max-md:min-w-0 max-md:w-full space-y-3 max-md:space-y-2">
            <div>
              <span className="ucc-caption text-slate-500 uppercase tracking-wider font-semibold block">
                Election Status
              </span>
              <div className="mt-1">
                {election.status === 'live' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 ucc-caption font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    Active Election · Voting Open
                  </span>
                )}
                {(election.status === 'scheduled' || (election.status as any) === 'upcoming') && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#123B70] ucc-caption font-semibold">
                    <Clock className="w-3.5 h-3.5 text-[#123B70]" />
                    Scheduled
                  </span>
                )}
                {election.status === 'draft' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-700 ucc-caption font-semibold">
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                    Draft · Pending Activation
                  </span>
                )}
                {election.status === 'pending_approval' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 ucc-caption font-semibold">
                    Pending Approval
                  </span>
                )}
                {election.status === 'suspended' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 ucc-caption font-semibold">
                    Temporarily Suspended
                  </span>
                )}
                {election.status === 'closed' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 ucc-caption font-semibold">
                    Polling Concluded
                  </span>
                )}
                {election.status === 'results_pending_certification' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 ucc-caption font-semibold">
                    Auditing Results
                  </span>
                )}
                {election.status === 'results_published' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 ucc-caption font-semibold">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    Certified Results Ready
                  </span>
                )}
                {election.status === 'cancelled' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-[#C62828] text-xs font-bold">
                    Cancelled Election
                  </span>
                )}
                {election.status === 'archived' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-300 text-slate-800 ucc-caption font-semibold">
                    Archived Record
                  </span>
                )}
              </div>
            </div>

            {election.status === 'draft' && (
              <p className="ucc-caption text-slate-600 leading-relaxed">
                Draft until an authorised administrator configures polling dates and activates voting.
              </p>
            )}

            {/* Voting or Results button */}
            {election.status === 'live' && isEligible && !hasVoted && (
              <button
                onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                className="w-full py-3 px-4 rounded-xl bg-[#C62828] hover:bg-red-700 text-white font-semibold text-sm sm:text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Vote className="w-4 h-4" />
                <span>Cast Your Vote</span>
              </button>
            )}

            {election.status === 'live' && hasVoted && (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 ucc-caption text-emerald-800 text-center font-medium">
                  ✓ Your ballot has been recorded securely.
                </div>
                <button
                  onClick={() => navigateTo('digital_ballot', { electionId: election.id })}
                  className="w-full py-2 px-4 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 font-semibold text-sm transition-colors cursor-pointer"
                >
                  View Submission Confirmation
                </button>
              </div>
            )}

            {(election.status === 'results_published' ||
              hasVoted ||
              (election.status === 'archived' && (election.provisionalResultsReady || election.resultsCertified))) && (
              <button
                onClick={() => navigateTo('election_results', { electionId: election.id })}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0B1F3A] hover:bg-[#123B70] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>
                  {election.status === 'archived' ? 'View Historical Outcomes' : 'View Certified Results'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Eligibility & Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Portfolios & Candidates */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h2 className="ucc-heading-section text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#123B70]" />
              <span>Contested Portfolios & Approved Candidates</span>
            </h2>

            {positions.length === 0 ? (
              <p className="ucc-body-secondary text-slate-500 italic">
                Candidate nomination and vetting records for this election are being compiled.
              </p>
            ) : (
              <div className="space-y-6">
                {positions.map((pos) => {
                  const positionCandidates = candidates.filter(
                    c => c.electionId === election.id && c.positionId === pos.id && c.applicationStatus === 'Approved'
                  );

                  return (
                    <div key={pos.id} className="p-5 max-md:p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 max-md:space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider">
                            Portfolio {pos.order}
                          </span>
                          <h3 className="ucc-heading-card text-slate-900">
                            {pos.title}
                          </h3>
                        </div>
                        <span className="ucc-caption text-slate-500 font-medium shrink-0">
                          {positionCandidates.length} Approved Aspirant{positionCandidates.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      
                      <p className="ucc-body-secondary text-slate-600">
                        {pos.description}
                      </p>

                      {/* Candidates cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-md:gap-2 pt-2 max-md:pt-1">
                        {positionCandidates.map((cand) => (
                          <div
                            key={cand.id}
                            onClick={() => navigateTo('candidate_profile', { candidateId: cand.id })}
                            className="p-3 max-md:p-2 bg-white rounded-xl border border-slate-200 hover:border-[#123B70]/40 transition-all cursor-pointer flex items-center gap-3 max-md:gap-2.5 group"
                          >
                            <CandidateAvatar
                              src={resolveCandidatePhotoUrl(cand)}
                              alt={cand.fullName}
                              className="w-12 h-12 max-md:w-10 max-md:h-10 rounded-lg object-cover border border-slate-200 shrink-0 group-hover:scale-105 transition-transform text-xs"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h4 className="text-sm font-semibold text-slate-900 truncate group-hover:text-[#123B70]">
                                  {cand.fullName}
                                </h4>
                                {cand.historicalRole && (
                                  <span className={`px-1.5 py-0.5 rounded ucc-caption font-semibold uppercase shrink-0 ${
                                    cand.historicalRole === 'Winner' ||
                                    cand.historicalRole === 'Elected' ||
                                    cand.historicalRole === 'Elected Unopposed'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {cand.historicalRole}
                                  </span>
                                )}
                              </div>
                              {cand.nickname && (
                                <p className="ucc-caption text-[#C62828] font-semibold truncate">
                                  "{cand.nickname}"
                                </p>
                              )}
                              <p className="ucc-caption font-normal text-slate-500 truncate mt-0.5">
                                {cand.department === 'Not verified' && cand.hall === 'Not verified'
                                  ? 'Hall & Dept not verified'
                                  : `${cand.department} · ${cand.hall}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Rules & Eligibility Verification */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Eligibility Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="ucc-label font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#123B70]" />
              <span>Your Voter Eligibility</span>
            </h3>

            {election.status === 'archived' ? (
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>Historical Archive — Voting Closed</span>
                </div>
                <p className="ucc-body-secondary text-slate-600">
                  Voting is disabled for historical 2026 archive records. You can inspect portfolios, verified candidates, and recorded outcomes.
                </p>
              </div>
            ) : isEligible ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Eligible to Vote in this Election</span>
                </div>
                <p className="ucc-body-secondary text-emerald-700">
                  {election.status === 'draft'
                    ? 'Your student record at the Directorate of Academic Affairs qualifies you for this election. Ballot casting opens once the UCC Electoral Commission activates voting.'
                    : 'Your student record at the Directorate of Academic Affairs qualifies you to cast a ballot in this race.'}
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Voter Ineligibility Alert</span>
                </div>
                <p className="ucc-body-secondary text-amber-800">
                  {eligibilityReason}
                </p>
              </div>
            )}

            <div className="pt-2 ucc-caption font-normal text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Voter ID:</span>
                <span className="font-semibold text-slate-700">
                  {student ? (student.studentId || student.email) : 'Not signed in'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Affiliation:</span>
                <span className="font-semibold text-slate-700">
                  {student ? (student.hall || 'Pending UCC details') : 'Sign in to check hall eligibility'}
                </span>
              </div>
            </div>
          </div>

          {/* Rules & Regulations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="ucc-label font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#123B70]" />
              <span>Official Polling Regulations</span>
            </h3>
            <ul className="space-y-2 ucc-body-secondary text-slate-600">
              {election.rules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#123B70] font-semibold">·</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
};
