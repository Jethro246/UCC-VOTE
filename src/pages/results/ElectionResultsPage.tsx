import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { electionClient } from '../../services/electionClient';
import { adminService } from '../../services/adminService';
import { Logo } from '../../components/common/Logo';
import { CandidateAvatar } from '../../components/common/CandidateAvatar';
import { ElectionResultsPayload, DomainId } from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  Award,
  Download,
  ShieldCheck,
  FileText,
  Lock,
  WifiOff
} from 'lucide-react';

export const ElectionResultsPage: React.FC = () => {
  const { elections, domains, selectedElectionId, userRole } = useApp();
  const { isOnline } = useOnlineStatus();

  const [selectedDomainTab, setSelectedDomainTab] = useState<DomainId | 'All'>('All');
  const [activeElectionId, setActiveElectionId] = useState<string>(
    selectedElectionId || ''
  );
  const [resultsPayload, setResultsPayload] = useState<ElectionResultsPayload | null>(null);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const [resultsBlockedMsg, setResultsBlockedMsg] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const visiblePool = useMemo(() => {
    if (userRole === 'admin') return elections;
    return elections.filter((e) => e.status !== 'draft' && e.status !== 'pending_approval');
  }, [elections, userRole]);

  const filteredElections = useMemo(() => {
    if (selectedDomainTab === 'All') return visiblePool;
    return visiblePool.filter(
      (e) =>
        e.domainId === selectedDomainTab ||
        (selectedDomainTab === 'src' && e.category === 'SRC') ||
        (selectedDomainTab === 'jcrc_hall' && e.category === 'JCR / Hall') ||
        (selectedDomainTab === 'grasag' && e.category === 'GRASAG') ||
        (selectedDomainTab === 'local_nugs' && e.category === 'Local NUGS') ||
        (selectedDomainTab === 'departmental' && e.category === 'Departmental') ||
        (selectedDomainTab === 'faculty_school' && e.category === 'Faculty / School')
    );
  }, [visiblePool, selectedDomainTab]);

  useEffect(() => {
    if (filteredElections.length > 0 && !filteredElections.some((e) => e.id === activeElectionId)) {
      const preferred =
        filteredElections.find((e) => e.status === 'results_published') || filteredElections[0];
      setActiveElectionId(preferred.id);
    }
  }, [filteredElections, activeElectionId]);

  const election =
    filteredElections.find((e) => e.id === activeElectionId) ||
    visiblePool.find((e) => e.id === activeElectionId) ||
    visiblePool[0];

  useEffect(() => {
    if (!election?.id) {
      setResultsPayload(null);
      setLoadingResults(false);
      return;
    }
    let active = true;
    setLoadingResults(true);
    setResultsBlockedMsg(null);

    async function fetchResults() {
      try {
        if (userRole === 'admin') {
          const adminRes = await adminService.getAdminElectionResults(election.id);
          if (active && adminRes.success && adminRes.results) {
            setResultsPayload(adminRes.results);
            setLoadingResults(false);
            return;
          }
        }
        const res = await electionClient.getPublishedResults(election.id);
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

    fetchResults();
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
        <h2 className="text-lg font-extrabold text-slate-900">
          Internet Connection Required for Certified Results
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Official election tallies and declarations are retrieved live from Cloud Firestore to prevent displaying stale or unverified counts. Reconnect to the internet to view published results.
        </p>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3">
        <Award className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">
          Election results have not been published.
        </h2>
        <p className="text-xs text-slate-500">
          Certified returns will appear here once elections conclude and results are officially published by the UCC Electoral Commission.
        </p>
      </div>
    );
  }

  const isCertified =
    resultsPayload?.resultsCertified ||
    election.resultsCertified ||
    election.status === 'results_published';
  const totalVotes = resultsPayload?.ballotSummary?.totalBallotsCast ?? election.totalVotesCast ?? 0;
  const totalEligible =
    resultsPayload?.ballotSummary?.totalEligibleVoters ?? election.totalEligibleVoters ?? 0;
  const turnout = resultsPayload?.ballotSummary?.turnoutPercentage ?? election.turnoutPercentage ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Election Selector */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <Logo variant="default" showWordmark={false} />
          <div>
            <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
              Official Multi-Domain Tally & Declarations
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Election Results Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Domain-isolated certified declarations, position tallies, and turnout breakdowns supervised by the UCC Electoral Commission.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 whitespace-nowrap">Election:</span>
          <select
            value={activeElectionId}
            onChange={(e) => setActiveElectionId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#123B70] max-w-xs"
          >
            {filteredElections.map((el) => (
              <option key={el.id} value={el.id}>
                {el.title} ({el.status === 'results_published' ? 'Certified' : el.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Single-line Domain Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedDomainTab('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
            onClick={() => setSelectedDomainTab(dom.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              selectedDomainTab === dom.id
                ? 'bg-[#123B70] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {dom.shortName} Results
          </button>
        ))}
      </div>

      {/* Certification Status Bar */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isCertified
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              isCertified ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}
          >
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-extrabold text-sm uppercase tracking-wide">
                {isCertified
                  ? 'Official Certified Declaration'
                  : 'Provisional Live Tally / Pre-Publication'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold">
                {election.subdomainLabel || election.category}
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              {isCertified
                ? `Tallies audited, signed, and gazetted (${resultsPayload?.certifiedBy || 'UCC Electoral Commission'}).`
                : 'Tallies are provisionally tracked in real time and remain unofficial until final Electoral Commission certification.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto no-print">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-[#123B70]" />
            <span>Print Declaration</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#123B70]" />
            <span>{isExporting ? 'Generating PDF...' : 'Export Declaration PDF'}</span>
          </button>
        </div>
      </div>

      {exportMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 no-print ${
            exportMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <span>{exportMsg.text}</span>
          <button
            onClick={() => setExportMsg(null)}
            className="text-xs underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Participation Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Eligible Voters
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1 block">
            {totalEligible.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Domain registry roll</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Ballots Cast
          </span>
          <span className="text-2xl font-black text-[#123B70] font-mono tabular-nums mt-1 block">
            {totalVotes.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Verified submissions</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Voter Turnout Rate
          </span>
          <span className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1 block">
            {turnout}%
          </span>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-emerald-600 h-full rounded-full"
              style={{ width: `${Math.min(turnout, 100)}%` }}
            />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Invalid / Rejected Ballots
          </span>
          <span className="text-2xl font-black text-slate-400 font-mono tabular-nums mt-1 block">
            {resultsPayload?.ballotSummary?.invalidBallots ?? 0}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
            100% Validated Digital Format
          </span>
        </div>
      </div>

      {/* Results by Portfolio */}
      {loadingResults ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          Loading authoritative ballot tallies...
        </div>
      ) : !resultsPayload ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#EAF2FA] text-[#123B70] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            Candidate Vote Totals Withheld Pending Publication
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
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
                  <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
                    Contested Portfolio {pos.order}
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">{pos.title}</h3>
                </div>
                <div className="text-xs font-mono text-slate-500 tabular-nums">
                  {pos.totalValidVotes.toLocaleString()} Valid Votes ·{' '}
                  {pos.blankVotes.toLocaleString()} Blank / Abstained
                  {pos.isTie && (
                    <span className="ml-2 font-bold text-amber-700">· TIE DETECTED</span>
                  )}
                </div>
              </div>

              {pos.candidates.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
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
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <CandidateAvatar
                            src={cand.photoUrl}
                            alt={cand.fullName}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 text-xs"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                                {cand.fullName}
                              </h4>
                              {cand.isWinner && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider">
                                  <Award className="w-3 h-3" />
                                  Winner Elect
                                </span>
                              )}
                              {cand.isTied && (
                                <span className="text-[10px] font-bold text-amber-700 uppercase">
                                  Tied
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {cand.department} · {cand.hall}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg sm:text-xl font-black font-mono text-slate-900 tabular-nums">
                            {cand.percentageOfValidVotes}%
                          </div>
                          <span className="text-xs font-mono text-slate-500 tabular-nums">
                            {cand.votesReceived.toLocaleString()} votes
                          </span>
                        </div>
                      </div>

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
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Electoral Commission Certification
              </h4>
            </div>
            <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
              {resultsPayload?.certifiedBy
                ? `Tallies verified and certified by ${resultsPayload.certifiedBy}.`
                : `Supervised by ${election.organizingBody || 'UCC Electoral Commission'}.`}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-center md:text-right">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">
            Digital Signature Hash
          </span>
          <span className="font-mono text-xs text-amber-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 block mt-1">
            {resultsPayload?.certificationHash || 'PENDING_CERTIFICATION'}
          </span>
        </div>
      </div>
    </div>
  );
};

