import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { electionClient } from '../../services/electionClient';
import { ElectionResultsPayload, ResultsWorkflowStage } from '../../types';
import { Logo, BrandedLoadingScreen } from '../common/Logo';
import {
  BallotDoughnutChart,
  CandidateBarChart,
  PositionShareDoughnut,
  TurnoutAnalyticsChart,
} from '../results/ResultsCharts';
import {
  Award,
  CheckCircle2,
  AlertCircle,
  Download,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Loader2,
  Clock,
  Lock,
} from 'lucide-react';

const WORKFLOW_STAGES: {
  id: ResultsWorkflowStage;
  step: number;
  label: string;
  actionLabel: string;
  restrictedToCommissioner: boolean;
}[] = [
  {
    id: 'preliminary',
    step: 1,
    label: 'Preliminary Results',
    actionLabel: 'Initialize Preliminary Count',
    restrictedToCommissioner: false,
  },
  {
    id: 'verification',
    step: 2,
    label: 'Results Verification',
    actionLabel: 'Complete Results Verification',
    restrictedToCommissioner: false,
  },
  {
    id: 'audit',
    step: 3,
    label: 'Results Audit',
    actionLabel: 'Complete Independent Audit',
    restrictedToCommissioner: false,
  },
  {
    id: 'approved',
    step: 4,
    label: 'Results Approval',
    actionLabel: 'Grant Board Approval',
    restrictedToCommissioner: true,
  },
  {
    id: 'certified',
    step: 5,
    label: 'Certified Results',
    actionLabel: 'Certify & Sign Cryptographic Seal',
    restrictedToCommissioner: true,
  },
  {
    id: 'published',
    step: 6,
    label: 'Official Publication',
    actionLabel: 'Publish Official Results to Students',
    restrictedToCommissioner: true,
  },
];

export const AdminResultsPanel: React.FC = () => {
  const { elections, admin, navigateTo, refreshElections } = useApp();

  const [selectedId, setSelectedId] = useState<string>(() => {
    const pending = elections.find(e => e.status === 'results_pending_certification');
    return pending?.id || elections[0]?.id || 'UCC-BUS-2026';
  });

  const [results, setResults] = useState<ElectionResultsPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [workflowNotes, setWorkflowNotes] = useState<string>('');
  const [advancing, setAdvancing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const loadAdminResults = async (electionId: string) => {
    setLoading(true);
    setErrorMsg('');
    const res = await electionClient.getAdminElectionResults(electionId);
    if (res.success && res.results) {
      setResults(res.results);
    } else {
      setResults(null);
      setErrorMsg(res.error || 'Failed to load authoritative election results.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedId) {
      loadAdminResults(selectedId);
    }
  }, [selectedId]);

  const currentStageIdx = results
    ? WORKFLOW_STAGES.findIndex(s => s.id === results.workflowStage)
    : 0;
  const nextStage =
    currentStageIdx >= 0 && currentStageIdx < WORKFLOW_STAGES.length - 1
      ? WORKFLOW_STAGES[currentStageIdx + 1]
      : null;

  const isCommissionerOrSuper =
    admin?.role === 'Electoral Commissioner' || admin?.role === 'Super Administrator';

  const handleAdvanceStage = async () => {
    if (!results || !nextStage) return;
    setAdvancing(true);
    setFeedback(null);

    const res = await electionClient.advanceResultsWorkflow(
      results.electionId,
      nextStage.id,
      workflowNotes.trim() || `${nextStage.label} completed via Commission Console.`,
      admin?.fullName
    );

    setAdvancing(false);

    if (res.success && res.results) {
      setResults(res.results);
      setWorkflowNotes('');
      setFeedback({
        type: 'success',
        message: res.message || `Advanced workflow to ${nextStage.label}.`,
      });
      await refreshElections();
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Workflow transition denied.',
      });
    }
  };

  const handleExport = async (
    format: 'pdf' | 'csv',
    reportType: 'full' | 'results' | 'turnout' | 'candidates' | 'positions'
  ) => {
    if (!results) return;
    const key = `${format}-${reportType}`;
    setExportingKey(key);
    setFeedback(null);
    const res = await electionClient.downloadElectionReport(results.electionId, format, reportType);
    setExportingKey(null);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Generated and downloaded ${res.filename}.`,
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Report export failed.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Election Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <Logo variant="default" showWordmark={false} />
          <div>
            <span className="text-[11px] font-bold text-[#123B70] uppercase tracking-wider">
              Results Management · Certification & Reporting
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
              Official Election Tally & Certification Console
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify ballot accounting, advance the 6-stage commission approval workflow, and generate audited PDF/CSV reports.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setFeedback(null);
            }}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#123B70]"
          >
            {elections.map((el) => (
              <option key={el.id} value={el.id}>
                {el.title} ({el.status.replace(/_/g, ' ')})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadAdminResults(selectedId)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Recalculate Authoritative Tallies"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => navigateTo('election_results', { electionId: selectedId })}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Student View →
          </button>
        </div>
      </div>

      {/* Inline Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading && (
        <BrandedLoadingScreen
          title="Computing Authoritative Election Tallies"
          subtitle="Reconciling encrypted ballot vaults and small-cohort privacy thresholds..."
        />
      )}

      {!loading && errorMsg && (
        <div className="bg-white rounded-xl border border-red-200 p-6 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!loading && results && (
        <>
          {/* 1. 6-STAGE RESULTS APPROVAL WORKFLOW */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-[#123B70]" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Results Approval & Certification Workflow
                  </h4>
                  <p className="text-xs text-slate-500">
                    {results.electionTitle} · {results.electionCode} · Completion:{' '}
                    <strong className="text-slate-800 uppercase">{results.status.replace(/_/g, ' ')}</strong>
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono font-bold text-[#123B70]">
                Stage {currentStageIdx + 1} of 6 · {WORKFLOW_STAGES[currentStageIdx]?.label}
              </div>
            </div>

            {/* 6-Step Progress Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {WORKFLOW_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIdx || results.workflowStage === 'published';
                const isCurrent = idx === currentStageIdx && results.workflowStage !== 'published';
                return (
                  <div
                    key={stage.id}
                    className={`p-3 rounded-lg border text-xs transition-colors ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                        : isCurrent
                        ? 'border-[#123B70] bg-[#EAF2FA]/60 text-[#0B1F3A]'
                        : 'border-slate-200 bg-slate-50/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold">STAGE {stage.step}</span>
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : isCurrent ? (
                        <Clock className="w-3.5 h-3.5 text-[#123B70]" />
                      ) : stage.restrictedToCommissioner ? (
                        <Lock className="w-3 h-3 text-slate-400" />
                      ) : null}
                    </div>
                    <div className="font-bold leading-snug">{stage.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Next Stage Action Bar */}
            {nextStage ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                <div className="flex-1 space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Commission Verification / Audit Remarks for Stage {nextStage.step} ({nextStage.label})
                  </label>
                  <input
                    type="text"
                    value={workflowNotes}
                    onChange={(e) => setWorkflowNotes(e.target.value)}
                    placeholder={`Enter official notes for ${nextStage.label.toLowerCase()}...`}
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#123B70]"
                  />
                  {nextStage.restrictedToCommissioner && !isCommissionerOrSuper && (
                    <p className="text-[11px] text-[#C62828] font-semibold">
                      Restricted: Only an Electoral Commissioner or Super Administrator can authorize Stages 4–6.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={advancing || (nextStage.restrictedToCommissioner && !isCommissionerOrSuper)}
                  onClick={handleAdvanceStage}
                  className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {advancing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{nextStage.actionLabel}</span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Stage 6 Complete — Results Officially Certified & Published ({results.certificationHash})
                  </span>
                </div>
                {results.publishedAt && (
                  <span className="font-mono text-[11px] text-emerald-700">
                    {new Date(results.publishedAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Workflow Audit Timeline */}
            {results.workflowHistory.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Workflow Certification Log
                </span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {results.workflowHistory.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase text-[#123B70]">
                            {item.stage}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-bold text-slate-900">{item.actorName}</span>
                          <span className="text-slate-500">({item.actorRole})</span>
                        </div>
                        <p className="text-slate-600">{item.notes}</p>
                      </div>
                      <div className="text-left sm:text-right font-mono text-[11px] text-slate-400 shrink-0">
                        <div>{new Date(item.timestamp).toLocaleString()}</div>
                        {item.signatureHash && (
                          <div className="text-emerald-700 font-semibold">{item.signatureHash}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. AUTHORITATIVE BALLOT ACCOUNTING KPIs & DOUGHNUT */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Eligible Voters
              </span>
              <span className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1 block">
                {results.ballotSummary.totalEligibleVoters.toLocaleString()}
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Ballots Cast
              </span>
              <span className="text-xl font-black font-mono tabular-nums text-[#123B70] mt-1 block">
                {results.ballotSummary.totalBallotsCast.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {results.ballotSummary.turnoutPercentage.toFixed(1)}% turnout
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Valid Ballots
              </span>
              <span className="text-xl font-black font-mono tabular-nums text-emerald-700 mt-1 block">
                {results.ballotSummary.validBallots.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {results.ballotSummary.validBallotRate.toFixed(1)}% of cast
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Invalid Ballots
              </span>
              <span className="text-xl font-black font-mono tabular-nums text-[#C62828] mt-1 block">
                {results.ballotSummary.invalidBallots.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {results.ballotSummary.invalidBallotRate.toFixed(1)}% of cast
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Blank Ballots
              </span>
              <span className="text-xl font-black font-mono tabular-nums text-amber-700 mt-1 block">
                {results.ballotSummary.blankBallots.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {results.ballotSummary.blankBallotRate.toFixed(1)}% of cast
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Uncast Ballots
              </span>
              <span className="text-xl font-black font-mono tabular-nums text-slate-600 mt-1 block">
                {results.ballotSummary.uncastBallots.toLocaleString()}
              </span>
            </div>
          </div>

          <BallotDoughnutChart
            summary={results.ballotSummary}
            title="Commission Ballot Vault Reconciliation"
          />

          {/* 3. REPORT GENERATION CENTER */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Logo variant="compact" showWordmark={false} />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Official Report Generation & Exports
                  </h4>
                  <p className="text-xs text-slate-500">
                    All exports include server-calculated tallies, rounding rules, and small-cohort privacy suppressions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer no-print"
              >
                Print Report
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  title: 'Full Election Report',
                  desc: 'Accounting, positions & turnout',
                  type: 'full' as const,
                  pdf: true,
                  csv: false,
                },
                {
                  title: 'Official Results CSV',
                  desc: 'Structured tally & ballot ledger',
                  type: 'results' as const,
                  pdf: false,
                  csv: true,
                },
                {
                  title: 'Election Turnout Report',
                  desc: 'Faculty, Dept, Level & Hall rates',
                  type: 'turnout' as const,
                  pdf: true,
                  csv: true,
                },
                {
                  title: 'Candidate Performance',
                  desc: 'Votes, percentages & outcome status',
                  type: 'candidates' as const,
                  pdf: true,
                  csv: true,
                },
                {
                  title: 'Position-by-Position Summary',
                  desc: 'Valid, blank, invalid & winner/tie',
                  type: 'positions' as const,
                  pdf: true,
                  csv: true,
                },
              ].map((rep) => (
                <div key={rep.type} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{rep.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{rep.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rep.pdf && (
                      <button
                        type="button"
                        disabled={!!exportingKey}
                        onClick={() => handleExport('pdf', rep.type)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3 h-3" />
                        <span>{exportingKey === `pdf-${rep.type}` ? '...' : 'PDF'}</span>
                      </button>
                    )}
                    {rep.csv && (
                      <button
                        type="button"
                        disabled={!!exportingKey}
                        onClick={() => handleExport('csv', rep.type)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <FileSpreadsheet className="w-3 h-3 text-[#123B70]" />
                        <span>{exportingKey === `csv-${rep.type}` ? '...' : 'CSV'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. POSITION-BY-POSITION TALLIES */}
          <div className="space-y-5">
            {results.positions.map((pos) => (
              <div key={pos.positionId} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-bold text-[#123B70] uppercase tracking-wider">
                      Portfolio {pos.order}
                    </span>
                    <h4 className="text-base sm:text-lg font-extrabold text-slate-900">{pos.title}</h4>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-500">
                    Valid: <strong>{pos.totalValidVotes.toLocaleString()}</strong> · Blank: {pos.blankVotes.toLocaleString()} · Invalid: {pos.invalidVotes.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8">
                    <CandidateBarChart position={pos} showOfficialOutcome={results.resultsCertified} />
                  </div>
                  <div className="lg:col-span-4">
                    <PositionShareDoughnut position={pos} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 5. PRIVACY-PRESERVING VOTER TURNOUT ANALYTICS */}
          <TurnoutAnalyticsChart analytics={results.turnoutAnalytics} />
        </>
      )}
    </div>
  );
};
