import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { CandidateAvatar } from '../../components/common/CandidateAvatar';
import { resolveCandidatePhotoUrl } from '../../utils/contestantUtils';
import {
  Search,
  Users,
  ArrowRight,
  Check,
  PlusCircle,
  Scale
} from 'lucide-react';
import { ManifestoComparisonModal } from '../../components/candidates/ManifestoComparisonModal';
import { CandidateRegistrationModal } from '../../components/admin/CandidateRegistrationModal';
import { Candidate } from '../../types';
import {
  getHallDisplayName,
  isElectionForHall,
  matchesHallAffiliation
} from '../../utils/hallUtils';

export const CandidateDirectoryPage: React.FC = () => {
  const {
    navigateTo,
    compareCandidateIds,
    toggleCompareCandidate,
    elections,
    domains,
    halls,
    positionsByElection,
    candidates,
    userRole,
    myCandidateApplication
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [selectedHall, setSelectedHall] = useState<string>('All');
  const [selectedElection, setSelectedElection] = useState<string>('All');
  const [selectedPosition, setSelectedPosition] = useState<string>('All');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('All');

  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareInit, setCompareInit] = useState<{
    electionId?: string;
    positionId?: string;
    candidateIds?: string[];
  }>({});
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const electionMap = useMemo(() => {
    const map = new Map<string, (typeof elections)[number]>();
    elections.forEach((e) => map.set(e.id, e));
    return map;
  }, [elections]);

  const positionLookup = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(positionsByElection).forEach((posList) => {
      posList.forEach((p) => map.set(p.id, p.title));
    });
    return map;
  }, [positionsByElection]);

  const approvedCandidates = candidates.filter((c) => c.applicationStatus === 'Approved');

  const electionsForDomain = useMemo(() => {
    return elections.filter((e) => {
      const domMatches =
        selectedDomain === 'All' ||
        e.domainId === selectedDomain ||
        (selectedDomain === 'src' && e.category === 'SRC') ||
        (selectedDomain === 'jcrc_hall' && e.category === 'JCR / Hall') ||
        (selectedDomain === 'grasag' && e.category === 'GRASAG') ||
        (selectedDomain === 'local_nugs' && e.category === 'Local NUGS') ||
        (selectedDomain === 'departmental' && e.category === 'Departmental') ||
        (selectedDomain === 'faculty_school' && e.category === 'Faculty / School');
      if (!domMatches) return false;
      if (selectedHall !== 'All') {
        const hallObj = halls.find((h) => h.id === selectedHall);
        if (hallObj && (e.domainId === 'jcrc_hall' || e.category === 'JCR / Hall')) {
          return isElectionForHall(e, hallObj, halls);
        }
      }
      return true;
    });
  }, [elections, selectedDomain, selectedHall, halls]);

  const allFaculties = Array.from(new Set(approvedCandidates.map((c) => c.faculty))).filter(Boolean);

  const currentElectionPositions = useMemo(() => {
    const allowedElectionIds = new Set(electionsForDomain.map((e) => e.id));
    const uniqueIds = Array.from(
      new Set(
        approvedCandidates
          .filter(
            (c) =>
              (selectedDomain === 'All' || allowedElectionIds.has(c.electionId)) &&
              (selectedElection === 'All' || c.electionId === selectedElection)
          )
          .map((c) => c.positionId)
      )
    );
    return uniqueIds.map((id) => ({
      id,
      title: positionLookup.get(id) || id
    }));
  }, [approvedCandidates, electionsForDomain, selectedDomain, selectedElection, positionLookup]);

  const filteredCandidates = approvedCandidates.filter((c) => {
    const el = electionMap.get(c.electionId);
    const elDom =
      c.domainId ||
      el?.domainId ||
      (el?.category === 'SRC'
        ? 'src'
        : el?.category === 'JCR / Hall'
        ? 'jcrc_hall'
        : el?.category === 'GRASAG'
        ? 'grasag'
        : el?.category === 'Local NUGS'
        ? 'local_nugs'
        : el?.category === 'Departmental'
        ? 'departmental'
        : el?.category === 'Faculty / School'
        ? 'faculty_school'
        : 'src');

    const matchesDomain = selectedDomain === 'All' || elDom === selectedDomain;
    const matchesElection = selectedElection === 'All' || c.electionId === selectedElection;
    const matchesPosition = selectedPosition === 'All' || c.positionId === selectedPosition;
    const matchesFaculty =
      selectedFaculty === 'All' || c.faculty.toLowerCase().includes(selectedFaculty.toLowerCase());

    const hallObj = selectedHall === 'All' ? undefined : halls.find((h) => h.id === selectedHall);
    const matchesHall =
      !hallObj ||
      (el && (elDom === 'jcrc_hall' || el.category === 'JCR / Hall')
        ? isElectionForHall(el, hallObj, halls)
        : matchesHallAffiliation(c.hallId || c.hall, hallObj.name, hallObj));

    const q = search.toLowerCase();
    const posTitle = (positionLookup.get(c.positionId) || '').toLowerCase();
    const matchesSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      (c.nickname && c.nickname.toLowerCase().includes(q)) ||
      c.studentId.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q) ||
      posTitle.includes(q) ||
      (c.programme && c.programme.toLowerCase().includes(q)) ||
      c.manifestoSummary.toLowerCase().includes(q);

    return (
      matchesDomain &&
      matchesHall &&
      matchesElection &&
      matchesPosition &&
      matchesFaculty &&
      matchesSearch
    );
  });

  // Group filtered candidates strictly by Election -> Position so different domains/positions never mix
  const groupedSections = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        electionId: string;
        electionTitle: string;
        category: string;
        subdomainLabel?: string;
        positionId: string;
        positionTitle: string;
        candidates: Candidate[];
      }
    >();

    filteredCandidates.forEach((cand) => {
      const el = electionMap.get(cand.electionId);
      const posTitle = positionLookup.get(cand.positionId) || cand.positionId;
      const key = `${cand.electionId}::${cand.positionId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          electionId: cand.electionId,
          electionTitle: el?.title || cand.electionId,
          category: el?.category || 'Election',
          subdomainLabel: el?.subdomainLabel,
          positionId: cand.positionId,
          positionTitle: posTitle,
          candidates: []
        });
      }
      groups.get(key)!.candidates.push(cand);
    });

    return Array.from(groups.values());
  }, [filteredCandidates, electionMap, positionLookup]);

  const openRaceComparison = (electionId: string, positionId: string, raceCandidates: Candidate[]) => {
    setCompareInit({
      electionId,
      positionId,
      candidateIds: raceCandidates.slice(0, 2).map((c) => c.id)
    });
    setShowCompareModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <Logo variant="default" showWordmark={false} />
          <div>
            <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
              Approved Aspirants Registry
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Candidate Directory & Manifestos
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Accredited candidates organized strictly by election domain, election, and contested portfolio.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => {
              setCompareInit({});
              setShowCompareModal(true);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Scale className="w-4 h-4 text-[#123B70]" />
            <span>Compare Manifestos</span>
          </button>

          {userRole !== 'admin' && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>Apply for Candidacy</span>
            </button>
          )}
        </div>
      </div>

      {/* Candidate Application Status Banner */}
      {myCandidateApplication && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#123B70] text-white flex items-center justify-center font-bold text-sm shrink-0">
              {myCandidateApplication.applicationStatus === 'Approved' ? '✓' : 'i'}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-[#123B70]">
                  Your Candidacy Application: {myCandidateApplication.fullName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-700">
                  {myCandidateApplication.applicationStatus}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {myCandidateApplication.applicationStatus === 'Approved'
                  ? 'Your nomination is vetted and approved. You are officially on the digital ballot.'
                  : myCandidateApplication.applicationStatus === 'Under review'
                  ? `Vetting update: ${myCandidateApplication.correctionNotes || 'Awaiting panel clearance.'}`
                  : myCandidateApplication.applicationStatus === 'Rejected'
                  ? `Application rejected: ${myCandidateApplication.rejectionReason || 'Constitutional non-compliance.'}`
                  : 'Your application has been received and is awaiting committee vetting.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigateTo('candidate_profile', { candidateId: myCandidateApplication.id })}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            View My Profile
          </button>
        </div>
      )}

      {/* Domain Filter Strip + Multi-tier Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setSelectedDomain('All');
              setSelectedHall('All');
              setSelectedElection('All');
              setSelectedPosition('All');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              selectedDomain === 'All'
                ? 'bg-[#123B70] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Domains
          </button>
          {domains.map((dom) => (
            <button
              key={dom.id}
              onClick={() => {
                setSelectedDomain(dom.id);
                if (dom.id !== 'jcrc_hall') setSelectedHall('All');
                setSelectedElection('All');
                setSelectedPosition('All');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                selectedDomain === dom.id
                  ? 'bg-[#123B70] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dom.shortName}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate by name, student ID, position, department, manifesto..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-slate-50/50"
            />
          </div>

          {(selectedDomain !== 'All' ||
            selectedHall !== 'All' ||
            selectedElection !== 'All' ||
            selectedPosition !== 'All' ||
            selectedFaculty !== 'All' ||
            search) && (
            <button
              onClick={() => {
                setSelectedDomain('All');
                setSelectedHall('All');
                setSelectedElection('All');
                setSelectedPosition('All');
                setSelectedFaculty('All');
                setSearch('');
              }}
              className="text-xs font-semibold text-[#C62828] hover:underline self-start md:self-auto whitespace-nowrap cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Hall of Residence / JCR
            </label>
            <select
              value={selectedHall}
              onChange={(e) => {
                setSelectedHall(e.target.value);
                setSelectedElection('All');
                setSelectedPosition('All');
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
            >
              <option value="All">All 8 UCC Halls</option>
              {halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {getHallDisplayName(h)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Election
            </label>
            <select
              value={selectedElection}
              onChange={(e) => {
                setSelectedElection(e.target.value);
                setSelectedPosition('All');
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
            >
              <option value="All">All Elections ({electionsForDomain.length})</option>
              {electionsForDomain.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Contested Portfolio
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
            >
              <option value="All">All Portfolios</option>
              {currentElectionPositions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Faculty / School
            </label>
            <select
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
            >
              <option value="All">All Faculties</option>
              {allFaculties.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Candidate Sections Grouped Strictly by Election & Position */}
      {groupedSections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {approvedCandidates.length === 0
              ? 'No candidates have been added yet.'
              : 'No Approved Candidates Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {approvedCandidates.length === 0
              ? 'Approved election candidates will appear here once vetted and published in Firestore.'
              : 'No candidates matched your search criteria. Try modifying your domain, hall, election, or position filters.'}
          </p>
          {approvedCandidates.length > 0 && (
            <button
              onClick={() => {
                setSelectedDomain('All');
                setSelectedHall('All');
                setSelectedElection('All');
                setSelectedPosition('All');
                setSelectedFaculty('All');
                setSearch('');
              }}
              className="px-4 py-2 rounded-xl bg-[#123B70] text-white text-xs font-semibold hover:bg-[#0B1F3A] cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedSections.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-bold text-[#123B70] uppercase tracking-wider">
                      {group.category}
                    </span>
                    {group.subdomainLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-700">{group.subdomainLabel}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{group.electionTitle}</span>
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {group.positionTitle}{' '}
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      ({group.candidates.length})
                    </span>
                  </h2>
                </div>

                {group.candidates.length >= 2 && (
                  <button
                    onClick={() =>
                      openRaceComparison(group.electionId, group.positionId, group.candidates)
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#123B70] flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Compare Candidates in Race</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.candidates.map((cand) => {
                  const isComparing = compareCandidateIds?.includes(cand.id);

                  return (
                    <div
                      key={cand.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-[#123B70]/50 transition-colors flex flex-col justify-between group"
                    >
                      <div>
                        <div className="p-5 flex items-start gap-4">
                          <div className="relative shrink-0">
                            <CandidateAvatar
                              src={resolveCandidatePhotoUrl(cand)}
                              alt={cand.fullName}
                              className="w-20 h-20 rounded-2xl object-cover object-center border-2 border-slate-200 shrink-0"
                            />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#123B70] text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">
                              ✓
                            </div>
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider truncate">
                                {group.positionTitle}
                              </span>
                              {cand.historicalRole && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                    cand.historicalRole === 'Winner' ||
                                    cand.historicalRole === 'Elected' ||
                                    cand.historicalRole === 'Elected Unopposed'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {cand.historicalRole}
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#123B70] transition-colors leading-tight truncate">
                              {cand.fullName}
                            </h3>
                            {cand.nickname && (
                              <p className="text-xs font-bold text-[#C62828] truncate">
                                "{cand.nickname}"
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 font-mono truncate">
                              {cand.studentId} · {cand.hall}
                            </p>
                          </div>
                        </div>

                        <div className="px-5 pb-3">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-slate-500">Department</span>
                              <span
                                className="font-semibold text-slate-800 truncate max-w-[170px]"
                                title={cand.department}
                              >
                                {cand.department}
                              </span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-slate-500">Programme</span>
                              <span
                                className="font-semibold text-slate-800 truncate max-w-[170px]"
                                title={cand.programme}
                              >
                                {cand.programme || (cand.isHistoricalRecord ? 'Not verified' : 'Registered Student')}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Level</span>
                              <span className="font-semibold text-slate-800">{cand.level}</span>
                            </div>
                          </div>
                        </div>

                        <div className="px-5 pb-4 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Policy Vision
                          </span>
                          <p className="text-xs text-slate-600 line-clamp-2 italic leading-relaxed">
                            {cand.campaignStatement || cand.manifestoSummary
                              ? `"${cand.campaignStatement || cand.manifestoSummary}"`
                              : cand.isHistoricalRecord
                              ? 'Manifesto not yet provided (Historical 2026 Record)'
                              : 'Manifesto summary not provided.'}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                        <button
                          onClick={() => toggleCompareCandidate(cand.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                            isComparing
                              ? 'bg-blue-100 text-[#123B70] border border-blue-300'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                          }`}
                        >
                          {isComparing ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#123B70]" />
                              <span>Selected</span>
                            </>
                          ) : (
                            <span>+ Compare</span>
                          )}
                        </button>

                        <button
                          onClick={() => navigateTo('candidate_profile', { candidateId: cand.id })}
                          className="px-3.5 py-1.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                        >
                          <span>View Profile</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Manifesto Comparison Modal */}
      <ManifestoComparisonModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        initialElectionId={compareInit.electionId}
        initialPositionId={compareInit.positionId}
        initialCandidateIds={
          compareInit.candidateIds ||
          (compareCandidateIds ? [compareCandidateIds[0], compareCandidateIds[1]] : [])
        }
      />

      {/* Candidate Registration Modal */}
      <CandidateRegistrationModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
      />
    </div>
  );
};

