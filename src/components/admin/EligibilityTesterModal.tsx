import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  UserCheck,
  Building,
  GraduationCap
} from 'lucide-react';
import { Election } from '../../types';
import { electionClient } from '../../services/electionClient';
import { EligibilityResult } from '../../services/interfaces';

interface EligibilityTesterModalProps {
  isOpen: boolean;
  election: Election | null;
  onClose: () => void;
}

export const EligibilityTesterModal: React.FC<EligibilityTesterModalProps> = ({
  isOpen,
  election,
  onClose
}) => {
  const [studentIdInput, setStudentIdInput] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [studentName, setStudentName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !election) return null;

  const handleTestEligibility = async (customId?: string) => {
    const targetId = customId || studentIdInput.trim();
    if (!targetId) return;

    setEvaluating(true);
    setErrorMsg('');
    setResult(null);

    const res = await electionClient.checkEligibility(election.id, targetId);
    setEvaluating(false);

    if (res.success && res.result) {
      setResult(res.result);
      setStudentName(res.studentName || targetId);
    } else {
      setErrorMsg(res.error || 'Failed to evaluate eligibility.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 space-y-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#123B70] ucc-caption font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Firebase Voter Eligibility Engine</span>
            </div>
            <h3 className="ucc-heading-card text-slate-900">
              Verify Student Voter Eligibility
            </h3>
            <p className="ucc-body-secondary text-slate-500">
              Evaluating criteria against: <span className="font-semibold text-slate-800">{election.title}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Lookup Input */}
        <div className="space-y-2">
          <label className="block ucc-label font-semibold text-slate-700">Enter Registered Student ID or Firebase UID:</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              placeholder="Enter Student ID or UID"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums text-slate-900"
            />
            <button
              type="button"
              onClick={() => handleTestEligibility()}
              disabled={evaluating || !studentIdInput.trim()}
              className="px-4 py-2 rounded-xl bg-[#123B70] text-white ucc-btn font-semibold hover:bg-[#0B1F3A] transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{evaluating ? 'Evaluating...' : 'Evaluate'}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 ucc-body-secondary flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Evaluation Output */}
        {result && (
          <div className={`p-4 rounded-2xl border space-y-3 ${
            result.isEligible 
              ? 'bg-emerald-50/70 border-emerald-200' 
              : 'bg-red-50/70 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.isEligible ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div>
                  <h4 className={`ucc-label font-bold ${result.isEligible ? 'text-emerald-900' : 'text-red-900'}`}>
                    {result.isEligible ? 'VERIFIED: ELIGIBLE TO VOTE' : 'INELIGIBLE TO VOTE'}
                  </h4>
                  <p className="ucc-caption text-slate-600 tabular-nums">
                    Student: {studentName} ({studentIdInput})
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full ucc-caption font-semibold uppercase ${
                result.isEligible ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
              }`}>
                {result.isEligible ? 'ACCREDITED' : 'BLOCKED'}
              </span>
            </div>

            {result.reason && (
              <p className={`ucc-body-secondary ${result.isEligible ? 'text-emerald-800' : 'text-red-800'}`}>
                {result.reason}
              </p>
            )}

            {/* Check Breakdown */}
            <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 ucc-caption">
              {Object.entries(result.checks).map(([checkName, passed]) => (
                <div key={checkName} className="flex items-center justify-between p-1.5 rounded-lg bg-white/70">
                  <span className="text-slate-600 capitalize">{checkName.replace('Match', '')}</span>
                  <span className={`font-semibold ${passed ? 'text-emerald-700' : 'text-red-700'}`}>
                    {passed ? '✓ PASS' : '✕ FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white ucc-btn font-semibold hover:bg-slate-900"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
