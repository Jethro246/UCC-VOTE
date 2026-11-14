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
import { electionClient, EligibilityResult } from '../../services/electionClient';

interface EligibilityTesterModalProps {
  isOpen: boolean;
  election: Election | null;
  onClose: () => void;
}

const TEST_STUDENT_PRESETS = [
  { label: 'Kofi Mensah Sarbah (L300 CS & IT, Casford)', id: 'PS/CSC/22/0089' },
  { label: 'Nana Akua Afriyie Osei (L400 Psychology, Adehye)', id: 'ED/EPS/21/0034' },
  { label: 'Kwame Osei (L100 General Arts, Oguaa)', id: 'AS/COM/22/0104' },
  { label: 'Kojo Danquah (Suspended Student Account)', id: 'AS/HIS/22/0055' }
];

export const EligibilityTesterModal: React.FC<EligibilityTesterModalProps> = ({
  isOpen,
  election,
  onClose
}) => {
  const [studentIdInput, setStudentIdInput] = useState('PS/CSC/22/0089');
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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#123B70] text-xs font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#123B70]" />
              <span>DAA Server-Side Eligibility Engine</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Test Student Voter Eligibility
            </h3>
            <p className="text-xs text-slate-500">
              Evaluating criteria against: <span className="font-bold text-slate-800">{election.title}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 text-xs">
          <label className="font-bold text-slate-700">Quick Test Persona Presets:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {TEST_STUDENT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setStudentIdInput(p.id);
                  handleTestEligibility(p.id);
                }}
                className={`p-2 rounded-xl text-left border text-[11px] transition-all ${
                  studentIdInput === p.id
                    ? 'bg-blue-50 border-[#123B70] text-[#123B70] font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="space-y-2 text-xs">
          <label className="font-bold text-slate-700">Or Enter Student ID:</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              placeholder="e.g. PS/CSC/22/0089"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 uppercase"
            />
            <button
              type="button"
              onClick={() => handleTestEligibility()}
              disabled={evaluating}
              className="px-4 py-2 rounded-xl bg-[#123B70] text-white font-bold hover:bg-[#0B1F3A] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{evaluating ? 'Evaluating...' : 'Evaluate'}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Evaluation Output */}
        {result && (
          <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
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
                  <h4 className={`font-black text-sm ${result.isEligible ? 'text-emerald-900' : 'text-red-900'}`}>
                    {result.isEligible ? 'VERIFIED: ELIGIBLE TO VOTE' : 'INELIGIBLE TO VOTE'}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Student: {studentName} ({studentIdInput})
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                result.isEligible ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
              }`}>
                {result.isEligible ? 'ACCREDITED' : 'BLOCKED'}
              </span>
            </div>

            {result.reason && (
              <p className={`text-xs ${result.isEligible ? 'text-emerald-800' : 'text-red-800'}`}>
                {result.reason}
              </p>
            )}

            {/* Check Breakdown */}
            <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px] font-mono">
              {Object.entries(result.checks).map(([checkName, passed]) => (
                <div key={checkName} className="flex items-center justify-between p-1.5 rounded-lg bg-white/70">
                  <span className="text-slate-600 capitalize">{checkName.replace('Match', '')}</span>
                  <span className={`font-bold ${passed ? 'text-emerald-700' : 'text-red-700'}`}>
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
            className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
