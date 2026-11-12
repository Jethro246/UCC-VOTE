import React, { useState } from 'react';
import {
  BallotAccountingSummary,
  PositionResultSummary,
  TurnoutBreakdownRow,
  CandidateResultRow
} from '../../types';
import { Award, ShieldCheck, Lock, AlertTriangle, BarChart3, PieChart } from 'lucide-react';

const CHART_PALETTE = [
  '#123B70', // UCC Blue
  '#C62828', // UCC Red
  '#D97706', // UCC Gold/Amber
  '#0D9488', // Teal
  '#4F46E5', // Indigo
  '#64748B', // Slate
];

interface DoughnutSegment {
  label: string;
  value: number;
  pct: number;
  color: string;
  sublabel?: string;
}

function buildDoughnutArcs(segments: DoughnutSegment[], radius = 58, circumference = 2 * Math.PI * 58) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  if (total <= 0) {
    return [];
  }
  let cumulativeOffset = 0;
  return segments.map((seg) => {
    const fraction = Math.max(0, seg.value) / total;
    const strokeLength = fraction * circumference;
    const arc = {
      ...seg,
      strokeDasharray: `${strokeLength} ${circumference}`,
      strokeDashoffset: -cumulativeOffset,
    };
    cumulativeOffset += strokeLength;
    return arc;
  });
}

/**
 * 1. Ballot Accounting & Participation Doughnut Chart
 */
export const BallotDoughnutChart: React.FC<{
  summary: BallotAccountingSummary;
  title?: string;
}> = ({ summary, title = 'Ballot Accounting & Turnout Distribution' }) => {
  const [scope, setScope] = useState<'eligible' | 'cast'>('eligible');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const eligibleSegments: DoughnutSegment[] = [
    {
      label: 'Valid Ballots',
      value: summary.validBallots,
      pct: summary.totalEligibleVoters > 0 ? Math.round((summary.validBallots / summary.totalEligibleVoters) * 1000) / 10 : 0,
      color: '#123B70',
      sublabel: 'Counted toward candidate tallies',
    },
    {
      label: 'Blank Ballots',
      value: summary.blankBallots,
      pct: summary.totalEligibleVoters > 0 ? Math.round((summary.blankBallots / summary.totalEligibleVoters) * 1000) / 10 : 0,
      color: '#D97706',
      sublabel: 'Voluntary abstentions',
    },
    {
      label: 'Invalid Ballots',
      value: summary.invalidBallots,
      pct: summary.totalEligibleVoters > 0 ? Math.round((summary.invalidBallots / summary.totalEligibleVoters) * 1000) / 10 : 0,
      color: '#C62828',
      sublabel: 'Rejected / spoilt tickets',
    },
    {
      label: 'Uncast Ballots',
      value: summary.uncastBallots,
      pct: summary.totalEligibleVoters > 0 ? Math.round((summary.uncastBallots / summary.totalEligibleVoters) * 1000) / 10 : 0,
      color: '#CBD5E1',
      sublabel: 'Eligible voters who did not vote',
    },
  ];

  const castSegments: DoughnutSegment[] = [
    {
      label: 'Valid Ballots',
      value: summary.validBallots,
      pct: summary.validBallotRate,
      color: '#123B70',
      sublabel: 'Counted toward candidate tallies',
    },
    {
      label: 'Blank Ballots',
      value: summary.blankBallots,
      pct: summary.blankBallotRate,
      color: '#D97706',
      sublabel: 'Submitted without selection',
    },
    {
      label: 'Invalid Ballots',
      value: summary.invalidBallots,
      pct: summary.invalidBallotRate,
      color: '#C62828',
      sublabel: 'Rejected / malformed ballots',
    },
  ];

  const activeSegments = scope === 'eligible' ? eligibleSegments : castSegments;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const arcs = buildDoughnutArcs(activeSegments, radius, circumference);
  const hovered = hoveredIdx !== null ? activeSegments[hoveredIdx] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <PieChart className="w-4 h-4 text-[#123B70]" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">
              Strict separation of valid, blank, invalid, and uncast ballots
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setScope('eligible')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              scope === 'eligible' ? 'bg-[#123B70] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Full Roll ({summary.totalEligibleVoters.toLocaleString()})
          </button>
          <button
            type="button"
            onClick={() => setScope('cast')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              scope === 'cast' ? 'bg-[#123B70] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cast Only ({summary.totalBallotsCast.toLocaleString()})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* SVG Doughnut */}
        <div className="md:col-span-5 flex justify-center">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth="22"
              />
              {arcs.map((arc, idx) => (
                <circle
                  key={arc.label}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={hoveredIdx === idx ? 26 : 22}
                  strokeDasharray={arc.strokeDasharray}
                  strokeDashoffset={arc.strokeDashoffset}
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              ))}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
              {hovered ? (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate max-w-[100px]">
                    {hovered.label}
                  </span>
                  <span className="text-xl font-black font-mono tabular-nums text-slate-900">
                    {hovered.pct.toFixed(1)}%
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {hovered.value.toLocaleString()}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {scope === 'eligible' ? 'Turnout' : 'Valid Rate'}
                  </span>
                  <span className="text-2xl font-black font-mono tabular-nums text-[#123B70]">
                    {scope === 'eligible'
                      ? `${summary.turnoutPercentage.toFixed(1)}%`
                      : `${summary.validBallotRate.toFixed(1)}%`}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {summary.totalBallotsCast.toLocaleString()} cast
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Legend Rows */}
        <div className="md:col-span-7 space-y-2.5">
          {activeSegments.map((seg, idx) => (
            <div
              key={seg.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-default ${
                hoveredIdx === idx
                  ? 'border-[#123B70]/40 bg-[#EAF2FA]/40'
                  : 'border-slate-100 bg-slate-50/70'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3 h-3 rounded-xs shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900">{seg.label}</div>
                  {seg.sublabel && (
                    <div className="text-[11px] text-slate-500 truncate">{seg.sublabel}</div>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 pl-3">
                <div className="text-sm font-black font-mono tabular-nums text-slate-900">
                  {seg.value.toLocaleString()}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500">
                  {seg.pct.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 2. Position Share Doughnut Chart (per contested position)
 */
export const PositionShareDoughnut: React.FC<{
  position: PositionResultSummary;
}> = ({ position }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const segments: DoughnutSegment[] = position.candidates.map((cand, idx) => ({
    label: cand.fullName,
    value: cand.votesReceived,
    pct: cand.percentageOfValidVotes,
    color: CHART_PALETTE[idx % CHART_PALETTE.length],
    sublabel: `${cand.votesReceived.toLocaleString()} valid votes`,
  }));

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const arcs = buildDoughnutArcs(segments, radius, circumference);
  const hovered = hoveredIdx !== null ? segments[hoveredIdx] : null;

  if (position.totalValidVotes === 0) {
    return (
      <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col items-center justify-center text-center min-h-[220px]">
        <PieChart className="w-6 h-6 text-slate-400 mb-2" />
        <p className="text-xs font-semibold text-slate-600">No valid votes tallied yet</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Distribution chart updates once ballots are cast</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Valid Vote Share
        </span>
        <span className="text-xs font-mono tabular-nums font-bold text-slate-700">
          {position.totalValidVotes.toLocaleString()} valid
        </span>
      </div>

      <div className="flex justify-center">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="18" />
            {arcs.map((arc, idx) => (
              <circle
                key={arc.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={hoveredIdx === idx ? 22 : 18}
                strokeDasharray={arc.strokeDasharray}
                strokeDashoffset={arc.strokeDashoffset}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
            {hovered ? (
              <>
                <span className="text-[10px] font-bold text-slate-500 truncate max-w-[84px]">
                  {hovered.label.split(' ')[0]}
                </span>
                <span className="text-lg font-black font-mono tabular-nums text-slate-900">
                  {hovered.pct.toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold uppercase text-slate-500">Valid</span>
                <span className="text-lg font-black font-mono tabular-nums text-[#123B70]">
                  {position.totalValidVotes.toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {segments.map((seg, idx) => (
          <div
            key={seg.label}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="font-medium text-slate-700 truncate">{seg.label}</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-slate-900 pl-2 shrink-0">
              {seg.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 3. Position Candidate Bar Chart & Breakdown
 */
export const CandidateBarChart: React.FC<{
  position: PositionResultSummary;
  showOfficialOutcome: boolean;
}> = ({ position, showOfficialOutcome }) => {
  return (
    <div className="space-y-3.5">
      {position.isTie && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Official Exact Tie Recorded: </span>
            <span>
              Top contenders received equal valid votes. No sole winner is declared; subject to UCC Electoral Commission run-off guidelines.
            </span>
          </div>
        </div>
      )}

      {position.candidates.map((cand: CandidateResultRow, idx: number) => {
        const barColor = cand.isTied
          ? '#D97706'
          : cand.isWinner && showOfficialOutcome
          ? '#16A34A'
          : CHART_PALETTE[idx % CHART_PALETTE.length];

        const highlightRow = (cand.isWinner && showOfficialOutcome) || cand.isTied;

        return (
          <div
            key={cand.candidateId}
            className={`p-4 rounded-xl border transition-colors ${
              cand.isTied
                ? 'border-amber-300 bg-amber-50/40'
                : highlightRow
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono font-bold text-slate-400 w-5 shrink-0 tabular-nums">
                  #{cand.rank}
                </span>
                <img
                  src={cand.photoUrl}
                  alt={cand.fullName}
                  className="w-11 h-11 rounded-lg object-cover object-top border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {cand.fullName}
                    </h4>
                    {cand.isTied && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider">
                        Tied
                      </span>
                    )}
                    {cand.isWinner && showOfficialOutcome && !cand.isTied && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider">
                        <Award className="w-3 h-3" />
                        Winner Elect
                      </span>
                    )}
                    {cand.isLeading && !showOfficialOutcome && !cand.isTied && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                        Provisional Lead
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {cand.department} · {cand.hall}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0 pl-8 sm:pl-0">
                <div className="text-lg font-black font-mono tabular-nums text-slate-900">
                  {cand.percentageOfValidVotes.toFixed(1)}%
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  {cand.votesReceived.toLocaleString()} valid votes
                </div>
              </div>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(Math.max(cand.percentageOfValidVotes, 0), 100)}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Position-level ballot accounting footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] font-mono tabular-nums text-slate-500 border-t border-slate-100">
        <span>Valid Votes: {position.totalValidVotes.toLocaleString()}</span>
        <span>Blank / Abstain: {position.blankVotes.toLocaleString()}</span>
        <span>Invalid / Rejected: {position.invalidVotes.toLocaleString()}</span>
        <span>Processed Total: {position.totalBallotsProcessed.toLocaleString()}</span>
      </div>
    </div>
  );
};

/**
 * 4. Privacy-Preserving Voter Turnout Analytics Chart
 */
export const TurnoutAnalyticsChart: React.FC<{
  analytics: {
    privacyThreshold: number;
    byFaculty: TurnoutBreakdownRow[];
    byDepartment: TurnoutBreakdownRow[];
    byLevel: TurnoutBreakdownRow[];
    byHall: TurnoutBreakdownRow[];
  };
}> = ({ analytics }) => {
  const [dimension, setDimension] = useState<'faculty' | 'department' | 'level' | 'hall'>('faculty');

  const rowsMap: Record<typeof dimension, TurnoutBreakdownRow[]> = {
    faculty: analytics.byFaculty,
    department: analytics.byDepartment,
    level: analytics.byLevel,
    hall: analytics.byHall,
  };

  const rows = rowsMap[dimension] || [];
  const suppressedCount = rows.filter(r => r.suppressed).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-2.5">
          <BarChart3 className="w-4 h-4 text-[#123B70] mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Aggregated Voter Turnout Analytics
            </h3>
            <p className="text-xs text-slate-500">
              Participation breakdown across university units with privacy suppression for cohorts under {analytics.privacyThreshold} voters
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-slate-50 self-start lg:self-auto">
          {[
            { id: 'faculty', label: 'Faculty' },
            { id: 'department', label: 'Department' },
            { id: 'level', label: 'Academic Level' },
            { id: 'hall', label: 'Hall of Residence' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDimension(tab.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                dimension === tab.id
                  ? 'bg-[#123B70] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {suppressedCount > 0 && (
        <div className="p-3 rounded-lg bg-[#EAF2FA]/60 border border-[#123B70]/20 text-xs text-[#0B1F3A] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#123B70] shrink-0 mt-0.5" />
          <span>
            <strong>Student Privacy Safeguard Active:</strong> {suppressedCount} small cohort{suppressedCount > 1 ? 's' : ''} below the {analytics.privacyThreshold}-voter threshold {suppressedCount > 1 ? 'are' : 'is'} masked to prevent individual participation inference.
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">
          No turnout breakdown rows available for this dimension.
        </p>
      ) : (
        <div className="space-y-3.5">
          {rows.map((row) => {
            if (row.suppressed) {
              return (
                <div
                  key={row.label}
                  className="p-3.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{row.label}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {row.suppressionReason || `Suppressed — < ${analytics.privacyThreshold} eligible voters`}
                  </div>
                </div>
              );
            }

            const pct = row.turnoutPercentage ?? 0;
            const cast = row.ballotsCast ?? 0;

            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <span className="font-semibold text-slate-800">{row.label}</span>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="text-slate-500">
                      {cast.toLocaleString()} / {row.eligibleVoters.toLocaleString()} voters
                    </span>
                    <span className="font-bold text-[#123B70] min-w-[48px] text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#123B70] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
