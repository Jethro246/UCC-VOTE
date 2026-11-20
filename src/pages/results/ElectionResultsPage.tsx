import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { electionClient } from '../../services/electionClient';
import { adminService } from '../../services/adminService';
import { Logo } from '../../components/common/Logo';
import { CandidateAvatar } from '../../components/common/CandidateAvatar';
import { ElectionResultsPayload, DomainId } from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getHallDisplayName, isElectionForHall } from '../../utils/hallUtils';
import { formatNumber, formatPercentage } from '../../utils/numberFormat';
import {
  Award,
  Download,
  ShieldCheck,
  FileText,
  Lock,
  WifiOff,
  Building
} from 'lucide-react';

export const ElectionResultsPage: React.FC = () => {
  const { elections, domains, halls, selectedElectionId, userRole } = useApp();
  const { isOnline } = useOnlineStatus();

  const [selectedDomainTab, setSelectedDomainTab] = useState<DomainId | 'All'>('All');
  const [selectedHallId, setSelectedHallId] = useState<string>('All');
  const [activeElectionId, setActiveElectionId] = useState<string>(
    selectedElectionId || ''
  );
  const [resultsPayload, setResultsPayload] = useState<ElectionResultsPayload | null>(null);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const [resultsBlockedMsg, setResultsBlockedMsg] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const filteredElections = useMemo(() => {
    return elections.filter((e) => {
      const domOk =
        selectedDomainTab === 'All' ||
        e.domainId === selectedDomainTab ||
        (selectedDomainTab === 'src' && e.category === 'SRC') ||
        (selectedDomainTab === 'jcrc_hall' && e.category === 'JCR / Hall') ||
        (selectedDomainTab === 'grasag' && e.category === 'GRASAG') ||
        (selectedDomainTab === 'local_nugs' && e.category === 'Local NUGS') ||
        (selectedDomainTab === 'departmental' && e.category === 'Departmental') ||
        (selectedDomainTab === 'faculty_school' && e.category === 'Faculty / School');
      if (!domOk) return false;
      if (selectedDomainTab === 'jcrc_hall' && selectedHallId !== 'All') {
        const hallObj = halls.find((h) => h.id === selectedHallId);
        if (!hallObj) return false;
        return isElectionForHall(e, hallObj, halls);
      }
      return true;
    });
  }, [elections, selectedDomainTab, selectedHallId, halls]);

  useEffect(() => {
    if (filteredElections.length > 0 && !filteredElections.some((e) => e.id === activeElectionId)) {
      const preferred =
        filteredElections.find((e) => e.status === 'results_published') ||
        filteredElections.find((e) => e.status === 'archived' && e.provisionalResultsReady) ||
        filteredElections[0];
      setActiveElectionId(preferred.id);
    } else if (filteredElections.length === 0 && activeElectionId) {
      setActiveElectionId('');
    }
  }, [filteredElections, activeElectionId]);

  const election =
    filteredElections.length > 0
      ? filteredElections.find((e) => e.id === activeElectionId) || filteredElections[0]
      : undefined;

  useEffect(() => {
    const electionId = election?.id;
    if (!electionId) {
      setResultsPayload(null);
      setLoadingResults(false);
      return;
    }
    let active = true;
    setLoadingResults(true);
    setResultsBlockedMsg(null);

    async function fetchResults(targetElectionId: string) {
      try {
        if (userRole === 'admin') {
          const adminRes = await adminService.getAdminElectionResults(targetElectionId);
          if (active && adminRes.success && adminRes.results) {
            setResultsPayload(adminRes.results);
            setLoadingResults(false);
            return;
          }
        }
        const res = await electionClient.getPublishedResults(targetElectionId);
        if (!active) return;
        if (res.success && res.results) {
          setResultsPayload(res.results);
          setResultsBlockedMsg(null);
        } else {
          setResultsPayload(null);
          setResultsBlockedMsg(
            res.error ||
              'Election results have not been published.'
          );
        }
      } catch {
        if (active) {
          setResultsPayload(null);
        }
      } finally {
        if (active) setLoadingResults(false);
      }
    }

    fetchResults(electionId);
    return () => {
      active = false;
    };
  }, [election?.id, userRole]);

  const handleExportPdf = async () => {
    if (!election?.id) return;
    setIsExporting(true);
    setExportMsg(null);
    const res = await adminService.downloadElectionReport(election.id, 'pdf', 'full');
    setIsExporting(false);
    if (res.success) {
      setExportMsg({
        type: 'success',
        text: `Official declaration prepared (${res.filename}).`
      });
    } else {
      setExportMsg({
        type: 'error',
        text:
          res.error ||
          'Declaration export is available once results are published or to authorized Commission officials.'
      });
    }
  };

  if (!isOnline) {
    return (
      <div className="bg-white p-8 sm:p-10 rounded-2xl border border-amber-200 text-center space-y-3 max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <WifiOff className="w-6 h-6" />
        </div>
        <h2 className="ucc-heading-card text-slate-900">
          Internet Connection Required for Certified Results
        </h2>
        <p className="ucc-body-secondary text-slate-600 max-w-md mx-auto">
          Official election tallies and declarations are retrieved live from Cloud Firestore to prevent displaying stale or unverified counts. Reconnect to the internet to view published results.
        </p>
      </div>
    );
  }

  const isCertified = election
    ? resultsPayload?.resultsCertified ||
      election.resultsCertified ||
      election.status === 'results_published'
    : false;
  const isHistoricalNoTally = Boolean(
    election &&
      (resultsPayload?.tallyAvailable === false ||
        (election.isHistorical && election.tallyAvailable === false))
  );
  const totalVotes = resultsPayload?.ballotSummary?.totalBallotsCast ?? election?.totalVotesCast ?? 0;
  const totalEligible =
    resultsPayload?.ballotSummary?.totalEligibleVoters ?? election?.totalEligibleVoters ?? 0;
  const turnout = resultsPayload?.ballotSummary?.turnoutPercentage ?? election?.turnoutPercentage ?? 0;
  const selectedHallObj = halls.find((h) => h.id === selectedHallId);

  return (
    <div className="space-y-6">
      {/* Top Banner & Election Selector */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <Logo variant="default" showWordmark={false} />
          <div>
            <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider">
              Official Multi-Domain Tally & Declarations
            </span>
            <h1 className="ucc-heading-page text-slate-900 mt-0.5">
              Election Results Center
            </h1>
            <p className="ucc-body-secondary text-slate-600 mt-1">
              Domain-isolated certified declarations, position tallies, and turnout breakdowns supervised by the UCC Electoral Commission.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="ucc-label text-slate-500 whitespace-nowrap">Election:</span>
          <select
            value={activeElectionId}
            onChange={(e) => setActiveElectionId(e.target.value)}
            disabled={filteredElections.length === 0}
            className="px-3 py-2 text-sm font-medium rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#123B70] max-w-xs disabled:opacity-50"
          >
            {filteredElections.length === 0 ? (
              <option value="">No elections in filter</option>
            ) : (
              filteredElections.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.title} ({el.status === 'results_published' ? 'Certified' : el.status})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Single-line Domain Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => {
            setSelectedDomainTab('All');
            setSelectedHallId('All');
          }}
          className={`px-3.5 py-2 rounded-lg ucc-btn whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            selectedDomainTab === 'All'
              ? 'bg-[#123B70] text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Domains
        </button>
        {domains.map((dom) => (
          <button
            key={dom.id}
            onClick={() => {
              setSelectedDomainTab(dom.id);
              if (dom.id !== 'jcrc_hall') setSelectedHallId('All');
            }}
            className={`px-3.5 py-2 rounded-lg ucc-btn whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              selectedDomainTab === dom.id
                ? 'bg-[#123B70] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {dom.shortName} Results
          </button>
        ))}
      </div>

      {/* 8-Hall Sub-filter when JCR / Hall Results is active */}
      {selectedDomainTab === 'jcrc_hall' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 ucc-label font-semibold text-slate-800">
            <Building className="w-4 h-4 text-[#123B70]" />
            <span>Filter Hall Results (All 8 Official UCC Halls):</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedHallId('All')}
              className={`px-3 py-1.5 rounded-lg ucc-btn whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                selectedHallId === 'All'
                  ? 'bg-[#123B70] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All 8 Halls
            </button>
            {halls.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelectedHallId(h.id)}
                className={`px-3 py-1.5 rounded-lg ucc-btn whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  selectedHallId === h.id
                    ? 'bg-[#123B70] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {h.shortName || h.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!election ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3">
          <Award className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="ucc-heading-card text-slate-900">
            {selectedHallObj
              ? `No election results found for ${getHallDisplayName(selectedHallObj)}.`
              : 'No elections found for the selected domain.'}
          </h2>
          <p className="ucc-body-secondary text-slate-500 max-w-md mx-auto">
            Certified returns and provisional tallies will appear here once an election is configured and conducted in this subdomain.
          </p>
        </div>
      ) : (
        <>

      {/* Certification Status Bar */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isHistoricalNoTally
            ? 'bg-slate-50 border-slate-300 text-slate-900'
            : isCertified
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold shrink-0 ${
              isHistoricalNoTally
                ? 'bg-[#123B70] text-white'
                : isCertified
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-600 text-white'
            }`}
          >
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm uppercase tracking-wide">
                {isHistoricalNoTally
                  ? 'Historical 2026 Outcome Archive (Vote Tally Unavailable)'
                  : isCertified
                  ? 'Official Certified Declaration'
                  : 'Provisional Live Tally / Pre-Publication'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="ucc-caption font-semibold">
                {election.subdomainLabel || election.category}
              </span>
            </div>
            <p className="ucc-body-secondary mt-0.5 opacity-90">
              {isHistoricalNoTally
                ? resultsPayload?.historicalNote ||
                  election.historicalNote ||
                  'Recorded historical outcomes preserved in read-only archive. Vote count breakdowns were not included in the source record.'
                : isCertified
                ? `Tallies audited, signed, and gazetted (${resultsPayload?.certifiedBy || 'UCC Electoral Commission'}).`
                : 'Tallies are provisionally tracked in real time and remain unofficial until final Electoral Commission certification.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto no-print">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 ucc-btn font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-[#123B70]" />
            <span>Print Declaration</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 ucc-btn font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#123B70]" />
            <span>{isExporting ? 'Generating PDF...' : 'Export Declaration PDF'}</span>
          </button>
        </div>
      </div>

      {exportMsg && (
        <div
          className={`p-3.5 rounded-xl border ucc-body-secondary font-medium flex items-center justify-between gap-2 no-print ${
            exportMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <span>{exportMsg.text}</span>
          <button
            onClick={() => setExportMsg(null)}
            className="ucc-btn underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Participation Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200">
          <span className="ucc-caption font-semibold text-slate-500 uppercase tracking-wider block">
            Total Eligible Voters
          </span>
          <span className="text-2xl font-bold text-slate-900 tabular-nums mt-1 block">
            {isHistoricalNoTally ? 'Not recorded' : formatNumber(totalEligible)}
          </span>
          <span className="ucc-caption text-slate-400 mt-0.5 block">
            {isHistoricalNoTally ? 'Historical 2026 archive' : 'Domain registry roll'}
          </span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200">
          <span className="ucc-caption font-semibold text-slate-500 uppercase tracking-wider block">
            Total Ballots Cast
          </span>
          <span className="text-2xl font-bold text-[#123B70] tabular-nums mt-1 block">
            {isHistoricalNoTally ? 'Unavailable' : formatNumber(totalVotes)}
          </span>
          <span className="ucc-caption text-slate-400 mt-0.5 block">
            {isHistoricalNoTally ? 'Vote counts not provided' : 'Verified submissions'}
          </span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200">
          <span className="ucc-caption font-semibold text-slate-500 uppercase tracking-wider block">
            Voter Turnout Rate
          </span>
          <span className="text-2xl font-bold text-emerald-700 tabular-nums mt-1 block">
            {isHistoricalNoTally ? 'Unavailable' : formatPercentage(turnout)}
          </span>
          {!isHistoricalNoTally && (
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-emerald-600 h-full rounded-full"
                style={{ width: `${Math.min(turnout, 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200">
          <span className="ucc-caption font-semibold text-slate-500 uppercase tracking-wider block">
            Invalid / Rejected Ballots
          </span>
          <span className="text-2xl font-bold text-slate-400 tabular-nums mt-1 block">
            {isHistoricalNoTally ? 'Unavailable' : formatNumber(resultsPayload?.ballotSummary?.invalidBallots)}
          </span>
          <span className="ucc-caption text-emerald-600 font-semibold mt-0.5 block">
            {isHistoricalNoTally ? 'Historical outcome record' : '100% Validated Digital Format'}
          </span>
        </div>
      </div>

      {/* Results by Portfolio */}
      {loadingResults ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center ucc-body-secondary text-slate-500">
          Loading authoritative ballot tallies...
        </div>
      ) : !resultsPayload ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#EAF2FA] text-[#123B70] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="ucc-heading-card text-slate-900">
            Candidate Vote Totals Withheld Pending Publication
          </h3>
          <p className="ucc-body-secondary text-slate-600 max-w-lg mx-auto">
            {resultsBlockedMsg ||
              'Per UCC Electoral Commission regulations, individual candidate vote counts remain confidential until polling closes, audits complete, and results are officially published.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {resultsPayload.positions.map((pos) => (
            <div
              key={pos.positionId}
              className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                <div>
                  <span className="ucc-caption font-semibold text-[#123B70] uppercase tracking-wider">
                    Contested Portfolio {pos.order}
                  </span>
                  <h3 className="ucc-heading-card text-slate-900 mt-0.5">{pos.title}</h3>
                </div>
                <div className="ucc-label text-slate-500 tabular-nums">
                  {isHistoricalNoTally ? (
                    <span>Historical Outcome Record · Tally unavailable</span>
                  ) : (
                    <>
                      {formatNumber(pos.totalValidVotes)} Valid Votes ·{' '}
                      {formatNumber(pos.blankVotes)} Blank / Abstained
                      {pos.isTie && (
                        <span className="ml-2 font-semibold text-amber-700">· TIE DETECTED</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {pos.contestNote && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 ucc-body-secondary text-amber-950">
                  <strong className="font-semibold">Archive Note: </strong>
                  {pos.contestNote}
                </div>
              )}

              {pos.candidates.length === 0 ? (
                <p className="ucc-body-secondary text-slate-500 italic">
                  No candidate tally rows recorded for this portfolio yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {pos.candidates.map((cand) => (
                    <div
                      key={cand.candidateId}
                      className={`p-4 sm:p-5 rounded-xl border transition-colors ${
                        cand.isWinner
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <CandidateAvatar
                            src={cand.photoUrl}
                            alt={cand.fullName}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 ucc-caption"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-semibold text-slate-900">
                                {cand.fullName}
                              </h4>
                              {(cand.isWinner || cand.historicalRole) && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ucc-caption font-semibold uppercase tracking-wider ${
                                    cand.isWinner
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {cand.isWinner && <Award className="w-3 h-3" />}
                                  {cand.historicalRole || 'Winner Elect'}
                                </span>
                              )}
                              {cand.isTied && (
                                <span className="ucc-caption font-semibold text-amber-700 uppercase">
                                  Tied
                                </span>
                              )}
                            </div>
                            <p className="ucc-caption text-slate-500">
                              {cand.department} · {cand.hall}
                            </p>
                            {cand.outcomeNote && (
                              <p className="ucc-caption text-slate-600 mt-0.5">{cand.outcomeNote}</p>
                            )}
                          </div>
                        </div>

                        {isHistoricalNoTally ? (
                          <div className="text-left sm:text-right">
                            <span className="ucc-caption font-medium text-slate-500">
                              Vote tally unavailable
                            </span>
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="text-xl font-bold text-slate-900 tabular-nums">
                              {formatPercentage(cand.percentageOfValidVotes)}
                            </div>
                            <span className="ucc-caption text-slate-500 tabular-nums">
                              {formatNumber(cand.votesReceived)} votes
                            </span>
                          </div>
                        )}
                      </div>

                      {!isHistoricalNoTally && (
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              cand.isWinner ? 'bg-amber-500' : 'bg-[#123B70]'
                            }`}
                            style={{
                              width: `${Math.min(cand.percentageOfValidVotes, 100)}%`
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Official Sign-off & Audit Notice */}
      <div className="bg-[#0B1F3A] text-white p-6 sm:p-8 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <Logo variant="default" theme="dark" showWordmark={false} />
          <div className="space-y-2">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="ucc-label font-semibold uppercase tracking-wider text-slate-200">
                Electoral Commission Certification
              </h4>
            </div>
            <p className="ucc-body-secondary text-slate-400 max-w-lg">
              {resultsPayload?.certifiedBy
                ? `Tallies verified and certified by ${resultsPayload.certifiedBy}.`
                : `Supervised by ${election.organizingBody || 'UCC Electoral Commission'}.`}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-center md:text-right">
          <span className="ucc-caption uppercase text-slate-400 block">
            Digital Signature Hash
          </span>
          <span className="ucc-caption font-medium text-amber-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 block mt-1 tabular-nums">
            {resultsPayload?.certificationHash || 'PENDING_CERTIFICATION'}
          </span>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

