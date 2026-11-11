import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Users, 
  HelpCircle, 
  AlertCircle,
  FileText,
  CheckCircle2,
  X
} from 'lucide-react';
import { ElectionCategory, ElectionStatus } from '../../types';
import { CreateElectionPayload, electionClient } from '../../services/electionClient';

interface CreateElectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newElection: any) => void;
}

const UCC_FACULTIES = [
  'School of Physical Sciences',
  'School of Biological Sciences',
  'School of Business',
  'Faculty of Arts & Social Sciences',
  'Faculty of Educational Foundations',
  'Faculty of Humanities and Social Sciences Education',
  'School of Medical Sciences',
  'School of Nursing and Midwifery',
  'School of Allied Health Sciences',
  'School of Agriculture',
  'School of Graduate Studies'
];

const UCC_DEPARTMENTS = [
  'Computer Science & Information Technology',
  'Physics',
  'Chemistry',
  'Mathematics & Statistics',
  'Accounting',
  'Finance',
  'Marketing & Supply Chain',
  'Management',
  'History & Diplomatic Studies',
  'Communication Studies',
  'English',
  'Psychology & Education',
  'Basic Education'
];

const UCC_HALLS = [
  'Casely Hayford Hall',
  'Valco Hall',
  'Oguaa Hall',
  'Kwame Nkrumah Hall',
  'Atlantic Hall',
  'Adehye Hall',
  'Superannuation Hall (SRC Hostel)',
  'UCC Diaspora / Private Hostels'
];

const UCC_LEVELS = ['100', '200', '300', '400', 'Postgraduate'];

export const CreateElectionModal: React.FC<CreateElectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1: Basic Information
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<ElectionCategory>('SRC');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [organizingBody, setOrganizingBody] = useState('UCC Electoral Commission (EC-UCC)');
  const [description, setDescription] = useState('');

  // Step 2: Schedule & Timeline
  const [startDate, setStartDate] = useState('2026-11-12');
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState('2026-11-12');
  const [endTime, setEndTime] = useState('17:00');

  // Step 3: Eligibility Rules
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['100', '200', '300', '400']);
  const [selectedHalls, setSelectedHalls] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>([
    'Each accredited student has exactly one vote per contested portfolio.',
    'Strict ballot secrecy is cryptographically maintained.',
    'Voting closes strictly at the scheduled closing time.'
  ]);
  const [newRuleInput, setNewRuleInput] = useState('');

  // Step 4: Contested Positions
  const [positions, setPositions] = useState<
    {
      title: string;
      description: string;
      maxSelections: number;
      allowsSkip: boolean;
      candidateEligibilityRules: string;
      votingRules: string;
    }[]
  >([
    {
      title: 'President & Vice-President',
      description: 'Executive Council joint presidential slate leadership portfolio',
      maxSelections: 1,
      allowsSkip: false,
      candidateEligibilityRules: 'Cumulative GPA >= 3.0, Level 300 or 400 student, verified conduct.',
      votingRules: 'Single joint-ticket preference.'
    },
    {
      title: 'General Secretary',
      description: 'Chief administrative officer and executive custodian of records',
      maxSelections: 1,
      allowsSkip: false,
      candidateEligibilityRules: 'Cumulative GPA >= 3.0, accredited in good standing.',
      votingRules: 'Single candidate preference.'
    }
  ]);

  const [newPosTitle, setNewPosTitle] = useState('');
  const [newPosDesc, setNewPosDesc] = useState('');
  const [newPosMax, setNewPosMax] = useState(1);
  const [newPosSkip, setNewPosSkip] = useState(false);

  if (!isOpen) return null;

  const handleToggleLevel = (lvl: string) => {
    setSelectedLevels(prev => 
      prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl]
    );
  };

  const handleToggleFaculty = (f: string) => {
    setSelectedFaculties(prev => 
      prev.includes(f) ? prev.filter(item => item !== f) : [...prev, f]
    );
  };

  const handleToggleDepartment = (d: string) => {
    setSelectedDepartments(prev => 
      prev.includes(d) ? prev.filter(item => item !== d) : [...prev, d]
    );
  };

  const handleToggleHall = (h: string) => {
    setSelectedHalls(prev => 
      prev.includes(h) ? prev.filter(item => item !== h) : [...prev, h]
    );
  };

  const handleAddRule = () => {
    if (!newRuleInput.trim()) return;
    setRules(prev => [...prev, newRuleInput.trim()]);
    setNewRuleInput('');
  };

  const handleRemoveRule = (idx: number) => {
    setRules(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddPosition = () => {
    if (!newPosTitle.trim()) return;
    setPositions(prev => [
      ...prev,
      {
        title: newPosTitle.trim(),
        description: newPosDesc.trim() || `Contested portfolio for ${newPosTitle.trim()}`,
        maxSelections: newPosMax,
        allowsSkip: newPosSkip,
        candidateEligibilityRules: 'Accredited student in good standing, GPA >= 3.0.',
        votingRules: newPosMax > 1 ? `Multi-choice up to ${newPosMax} candidates` : 'Single candidate preference'
      }
    ]);
    setNewPosTitle('');
    setNewPosDesc('');
    setNewPosMax(1);
    setNewPosSkip(false);
  };

  const handleRemovePosition = (idx: number) => {
    setPositions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validation
    if (!title.trim()) {
      setErrorMsg('Election title is mandatory.');
      setActiveStep(1);
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}:00Z`).getTime();
    const endDateTime = new Date(`${endDate}T${endTime}:00Z`).getTime();

    if (isNaN(startDateTime) || isNaN(endDateTime)) {
      setErrorMsg('Invalid schedule dates or times.');
      setActiveStep(2);
      return;
    }

    if (endDateTime <= startDateTime) {
      setErrorMsg('Election closing date/time must be strictly after the start date/time.');
      setActiveStep(2);
      return;
    }

    if (positions.length === 0) {
      setErrorMsg('At least one contested position/portfolio is required.');
      setActiveStep(4);
      return;
    }

    setSubmitting(true);

    const payload: CreateElectionPayload = {
      title: title.trim(),
      code: code.trim().toUpperCase() || undefined,
      description: description.trim() || `Official ${category} election for academic year ${academicYear}.`,
      category,
      academicYear,
      startDate: `${startDate}T${startTime}:00Z`,
      endDate: `${endDate}T${endTime}:00Z`,
      startTime,
      endTime,
      organizingBody: organizingBody.trim() || 'UCC Electoral Commission (EC-UCC)',
      rules,
      eligibilityCriteria: {
        faculties: selectedFaculties,
        departments: selectedDepartments,
        levels: selectedLevels,
        halls: selectedHalls
      },
      positions
    };

    const res = await electionClient.createElection(payload);
    setSubmitting(false);

    if (res.success && res.election) {
      onSuccess(res.election);
      onClose();
    } else {
      setErrorMsg(res.error || 'Failed to create election.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#123B70] text-xs font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#123B70]" />
              <span>EC-UCC Centralized Election Provisioning</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Create New University Election
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure parameters, multi-tier eligibility rules, timelines, and ballot portfolios.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          {[
            { step: 1, label: '1. Basic Info' },
            { step: 2, label: '2. Schedule' },
            { step: 3, label: '3. Eligibility' },
            { step: 4, label: '4. Portfolios' }
          ].map((item) => (
            <button
              key={item.step}
              type="button"
              onClick={() => setActiveStep(item.step as any)}
              className={`py-2 px-3 rounded-xl font-bold text-center transition-all ${
                activeStep === item.step
                  ? 'bg-[#123B70] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* STEP 1: Basic Information */}
          {activeStep === 1 && (
            <div className="space-y-4 text-xs animate-in fade-in">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Election Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 65th Students' Representative Council (SRC) General Elections"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-slate-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Election Category <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ElectionCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-slate-900 bg-white font-medium"
                  >
                    <option value="SRC">SRC (Students' Representative Council)</option>
                    <option value="JCR / Hall">JCR / Hall of Residence</option>
                    <option value="Departmental">Departmental Association</option>
                    <option value="Faculty / School">Faculty / School Society</option>
                    <option value="GRASAG">GRASAG (Graduate Students Association)</option>
                    <option value="Other">Other Approved Student Body</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2026/2027"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Election Code (Public ID)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. SRC-2026-MAIN (Auto-generated if blank)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-slate-900 bg-white font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Organizing Electoral Body
                  </label>
                  <input
                    type="text"
                    value={organizingBody}
                    onChange={(e) => setOrganizingBody(e.target.value)}
                    placeholder="e.g. UCC Electoral Commission (EC-UCC)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Official Election Notice & Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the constitutional background, scope, and purpose of this election..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-slate-900 bg-white"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Schedule & Timeline */}
          {activeStep === 2 && (
            <div className="space-y-4 text-xs animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[#123B70] flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  Official voting portals open automatically at start time and close strictly at closing time. Invalid or overlapping date ranges will be blocked.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#123B70]" />
                    <span>Poll Opening Schedule</span>
                  </h4>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Time (GMT)</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-red-600" />
                    <span>Poll Closing Schedule</span>
                  </h4>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Time (GMT)</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Multi-Tier Eligibility Rules */}
          {activeStep === 3 && (
            <div className="space-y-5 text-xs animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 flex items-center gap-2">
                <Users className="w-4 h-4 shrink-0 text-amber-700" />
                <span>
                  Eligibility Engine matches verified DAA student records against these criteria on the server. If no restrictions are checked, all students in good standing can vote.
                </span>
              </div>

              {/* Levels */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  Eligible Academic Levels
                </label>
                <div className="flex flex-wrap gap-2">
                  {UCC_LEVELS.map((lvl) => {
                    const isSelected = selectedLevels.includes(lvl);
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleToggleLevel(lvl)}
                        className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                          isSelected
                            ? 'bg-[#123B70] text-white border-[#123B70]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Level {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Halls (for JCR) */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  Eligible Hall Affiliations (Crucial for JCR elections)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {UCC_HALLS.map((h) => {
                    const isSelected = selectedHalls.includes(h);
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleToggleHall(h)}
                        className={`p-2 rounded-xl text-left font-medium border text-[11px] transition-all ${
                          isSelected
                            ? 'bg-red-50 text-red-900 border-red-300 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Faculties */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  Eligible Faculties / Schools (Optional Filter)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {UCC_FACULTIES.map((f) => {
                    const isSelected = selectedFaculties.includes(f);
                    return (
                      <label key={f} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleFaculty(f)}
                          className="rounded text-[#123B70] focus:ring-0"
                        />
                        <span className="truncate text-slate-800">{f}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Election Rules */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  Official Election Regulations
                </label>
                <div className="space-y-1.5 mb-2">
                  {rules.map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                      <span>{rule}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRuleInput}
                    onChange={(e) => setNewRuleInput(e.target.value)}
                    placeholder="Add custom regulatory rule..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900"
                  >
                    Add Rule
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Contested Positions / Portfolios */}
          {activeStep === 4 && (
            <div className="space-y-4 text-xs animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  Configure the official executive and legislative positions that will appear on the digital ballot interface.
                </span>
              </div>

              {/* List of positions */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {positions.map((pos, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#123B70] text-white font-mono font-bold text-[10px]">
                          #{idx + 1}
                        </span>
                        <h4 className="font-bold text-slate-900">{pos.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-600">{pos.description}</p>
                      <div className="flex gap-3 text-[10px] text-slate-500 font-mono pt-1">
                        <span>Max selections: {pos.maxSelections}</span>
                        <span>Allows skip: {pos.allowsSkip ? 'YES' : 'NO'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePosition(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Position Form */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#123B70]" />
                  <span>Add Contested Position</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Portfolio Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Women's Commissioner or Secretary"
                      value={newPosTitle}
                      onChange={(e) => setNewPosTitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Max Selections</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={newPosMax}
                      onChange={(e) => setNewPosMax(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Position Summary</label>
                  <input
                    type="text"
                    placeholder="Brief description of executive responsibilities..."
                    value={newPosDesc}
                    onChange={(e) => setNewPosDesc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPosSkip}
                      onChange={(e) => setNewPosSkip(e.target.checked)}
                      className="rounded text-[#123B70]"
                    />
                    <span>Allow voters to abstain/skip this portfolio on the ballot</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPosition}
                    className="px-3.5 py-1.5 rounded-xl bg-[#123B70] text-white font-bold hover:bg-[#0B1F3A]"
                  >
                    Add Portfolio
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (activeStep > 1) setActiveStep((prev) => (prev - 1) as any);
                else onClose();
              }}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors"
            >
              {activeStep === 1 ? 'Cancel' : 'Previous Step'}
            </button>

            <div className="flex gap-2">
              {activeStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev + 1) as any)}
                  className="px-5 py-2.5 rounded-xl bg-[#123B70] text-white font-bold hover:bg-[#0B1F3A] transition-colors"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#C62828] text-white font-bold hover:bg-red-800 transition-colors shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Provisioning Election...' : 'Provision & Save Election'}
                </button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
