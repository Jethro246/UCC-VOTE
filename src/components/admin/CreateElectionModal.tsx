import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  Clock,
  ShieldCheck,
  Users,
  AlertCircle,
  CheckCircle2,
  X,
  Edit3
} from 'lucide-react';
import { DomainId, Election, ElectionCategory, Position } from '../../types';
import { CreateElectionPayload } from '../../services/interfaces';
import { adminService } from '../../services/adminService';
import { uploadElectionDocument } from '../../services/firebaseStorageService';
import { useApp } from '../../context/AppContext';

interface CreateElectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newElection: Election, createdPositions?: Position[]) => void | Promise<void>;
  defaultDomainId?: DomainId;
}

const UCC_LEVELS = ['100', '200', '300', '400', 'Postgraduate'];

interface PositionDraft {
  title: string;
  description: string;
  maxSelections: number;
  allowsSkip: boolean;
  candidateEligibilityRules: string;
  votingRules: string;
}

function getStarterPositionsForDomain(domainId: DomainId): PositionDraft[] {
  if (domainId === 'jcrc_hall') {
    return [
      {
        title: 'JCRC President',
        description: 'Executive head of the Hall Junior Common Room Council',
        maxSelections: 1,
        allowsSkip: false,
        candidateEligibilityRules: 'Registered resident or affiliate of the hall in good standing, CGPA >= 3.0.',
        votingRules: 'Single candidate preference.'
      },
      {
        title: 'JCRC General Secretary',
        description: 'Custodian of hall minutes, notices, and administrative correspondence',
        maxSelections: 1,
        allowsSkip: false,
        candidateEligibilityRules: 'Registered hall member, CGPA >= 3.0.',
        votingRules: 'Single candidate preference.'
      },
      {
        title: 'JCRC Financial Secretary',
        description: 'Oversees hall dues accounting, subventions, and expenditure transparency',
        maxSelections: 1,
        allowsSkip: false,
        candidateEligibilityRules: 'Registered hall member, CGPA >= 3.0.',
        votingRules: 'Single candidate preference.'
      }
    ];
  }
  if (domainId === 'local_nugs') {
    return [
      {
        title: 'Local NUGS President',
        description: 'Chief UCC chapter liaison to National Union of Ghana Students (customizable)',
        maxSelections: 1,
        allowsSkip: false,
        candidateEligibilityRules: 'Accredited UCC student, CGPA >= 3.0.',
        votingRules: 'Single candidate preference.'
      },
      {
        title: 'Local NUGS Secretary',
        description: 'Chapter secretariat, scholarship clinics & communications (customizable)',
        maxSelections: 1,
        allowsSkip: false,
        candidateEligibilityRules: 'Accredited UCC student, CGPA >= 3.0.',
        votingRules: 'Single candidate preference.'
      }
    ];
  }
  if (domainId === 'grasag') {
    return [
      {
        title: 'GRASAG President',
        description: 'Executive head of the UCC Graduate Students Association',
        maxSelections: 1,
        allowsSkip: false,
        candidateEligibilityRules: 'Registered Postgraduate student at UCC School of Graduate Studies.',
        votingRules: 'Single candidate preference.'
      },
      {
        title: 'GRASAG General Secretary',
        description: 'Graduate senate documentation and research fellowship dispatches',
        maxSelections: 1,
        allowsSkip: false,
        candidateEligibilityRules: 'Registered Postgraduate student.',
        votingRules: 'Single candidate preference.'
      }
    ];
  }
  return [
    {
      title: 'President & Vice-President',
      description: 'Executive Council leadership portfolio',
      maxSelections: 1,
      allowsSkip: false,
      candidateEligibilityRules: 'Cumulative GPA >= 3.0, verified enrollment and good standing.',
      votingRules: 'Single candidate preference.'
    },
    {
      title: 'General Secretary',
      description: 'Chief administrative officer and custodian of official council records',
      maxSelections: 1,
      allowsSkip: false,
      candidateEligibilityRules: 'Cumulative GPA >= 3.0, accredited in good standing.',
      votingRules: 'Single candidate preference.'
    }
  ];
}

export const CreateElectionModal: React.FC<CreateElectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultDomainId
}) => {
  const { domains, halls, faculties, departments, admin, refreshDomains, refreshElections } = useApp();

  const allowedDomains = admin?.managedDomainIds?.length
    ? domains.filter((d) => admin.managedDomainIds!.includes(d.id))
    : domains;

  const initialDomain =
    (defaultDomainId && allowedDomains.some((d) => d.id === defaultDomainId)
      ? defaultDomainId
      : allowedDomains[0]?.id) || 'src';

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftIdempotencyKey, setDraftIdempotencyKey] = useState<string>(
    () => `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const [initialStatus, setInitialStatus] = useState<'draft' | 'scheduled' | 'live'>('draft');

  // Step 1: Domain, Subdomain & Basic Info
  const [domainId, setDomainId] = useState<DomainId>(initialDomain);
  const [category, setCategory] = useState<ElectionCategory>('SRC');
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [subdomainLabel, setSubdomainLabel] = useState<string>('');
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [academicYear, setAcademicYear] = useState(`${new Date().getFullYear()}/${new Date().getFullYear() + 1}`);
  const [organizingBody, setOrganizingBody] = useState('UCC Electoral Commission (EC-UCC)');
  const [description, setDescription] = useState('');
  const [guidelinesUrl, setGuidelinesUrl] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Step 2: Schedule & Timeline
  const todayIsoDate = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayIsoDate);
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState(todayIsoDate);
  const [endTime, setEndTime] = useState('17:00');

  // Step 3: Eligibility Rules
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedProgrammes, setSelectedProgrammes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['100', '200', '300', '400']);
  const [selectedHalls, setSelectedHalls] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>([
    'Each accredited student has exactly one vote per contested portfolio.',
    'Strict ballot secrecy is cryptographically maintained.',
    'Voting closes strictly at the scheduled closing time.'
  ]);
  const [newRuleInput, setNewRuleInput] = useState('');

  // Step 4: Contested Positions
  const [positions, setPositions] = useState<PositionDraft[]>(() =>
    getStarterPositionsForDomain(initialDomain)
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [newPosTitle, setNewPosTitle] = useState('');
  const [newPosDesc, setNewPosDesc] = useState('');
  const [newPosMax, setNewPosMax] = useState(1);
  const [newPosSkip, setNewPosSkip] = useState(false);

  const applyDomainDefaults = (targetDomainId: DomainId) => {
    setDomainId(targetDomainId);
    const domainObj = domains.find((d) => d.id === targetDomainId);
    if (domainObj) {
      setCategory(domainObj.category);
    }

    setPositions(getStarterPositionsForDomain(targetDomainId));
    setEditingIdx(null);

    if (targetDomainId === 'grasag') {
      setSelectedLevels(['Postgraduate']);
      setSelectedHalls([]);
      setSelectedFaculties([]);
      setSelectedDepartments([]);
      setSelectedProgrammes([]);
      setSelectedHallId('');
      setSelectedFacultyId('');
      setSelectedDepartmentId('');
      setSubdomainLabel('School of Graduate Studies');
      setOrganizingBody('GRASAG-UCC Electoral Board');
    } else if (targetDomainId === 'jcrc_hall') {
      const scopedHallName = admin?.managedHalls?.[0];
      const defaultHall =
        (scopedHallName && halls.find((h) => h.name === scopedHallName)) || halls[0];
      setSelectedLevels(['100', '200', '300', '400']);
      setSelectedFaculties([]);
      setSelectedDepartments([]);
      setSelectedProgrammes([]);
      setSelectedFacultyId('');
      setSelectedDepartmentId('');
      if (defaultHall) {
        setSelectedHallId(defaultHall.id);
        setSelectedHalls([defaultHall.name]);
        setSubdomainLabel(defaultHall.name);
        setOrganizingBody(`${defaultHall.name} Electoral Committee`);
      }
    } else if (targetDomainId === 'faculty_school') {
      const scopedFacName = admin?.managedFaculties?.[0];
      const defaultFac =
        (scopedFacName && faculties.find((f) => f.name === scopedFacName)) || faculties[0];
      setSelectedLevels(['100', '200', '300', '400']);
      setSelectedHalls([]);
      setSelectedDepartments([]);
      setSelectedProgrammes([]);
      setSelectedHallId('');
      setSelectedDepartmentId('');
      if (defaultFac) {
        setSelectedFacultyId(defaultFac.id);
        setSelectedFaculties([defaultFac.name]);
        setSubdomainLabel(defaultFac.name);
        setOrganizingBody(`${defaultFac.name} Electoral Committee`);
      }
    } else if (targetDomainId === 'departmental') {
      const scopedDeptName = admin?.managedDepartments?.[0];
      const defaultDept =
        (scopedDeptName && departments.find((d) => d.name === scopedDeptName)) || departments[0];
      setSelectedLevels(['100', '200', '300', '400']);
      setSelectedHalls([]);
      setSelectedHallId('');
      if (defaultDept) {
        setSelectedFacultyId(defaultDept.facultyId);
        setSelectedDepartmentId(defaultDept.id);
        setSelectedFaculties([defaultDept.facultyName]);
        setSelectedDepartments([defaultDept.name]);
        setSelectedProgrammes([]);
        setSubdomainLabel(defaultDept.name);
        setOrganizingBody(`${defaultDept.name} Electoral Board`);
      }
    } else if (targetDomainId === 'local_nugs') {
      setSelectedLevels(['100', '200', '300', '400', 'Postgraduate']);
      setSelectedHalls([]);
      setSelectedFaculties([]);
      setSelectedDepartments([]);
      setSelectedProgrammes([]);
      setSelectedHallId('');
      setSelectedFacultyId('');
      setSelectedDepartmentId('');
      setSubdomainLabel('UCC Local NUGS Chapter');
      setOrganizingBody('UCC Local NUGS Electoral Committee');
    } else {
      setSelectedLevels(['100', '200', '300', '400']);
      setSelectedHalls([]);
      setSelectedFaculties([]);
      setSelectedDepartments([]);
      setSelectedProgrammes([]);
      setSelectedHallId('');
      setSelectedFacultyId('');
      setSelectedDepartmentId('');
      setSubdomainLabel(domainObj?.name || 'Central SRC Constituency');
      setOrganizingBody('UCC Electoral Commission (EC-UCC)');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveStep(1);
      setSubmitting(false);
      isSubmittingRef.current = false;
      setErrorMsg('');
      setFieldErrors({});
      setTitle('');
      setCode('');
      setDescription('');
      setGuidelinesUrl('');
      setNewPosTitle('');
      setNewPosDesc('');
      setNewPosMax(1);
      setNewPosSkip(false);
      setInitialStatus('draft');
      setDraftIdempotencyKey(`draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      applyDomainDefaults(initialDomain);
    }
  }, [isOpen, defaultDomainId]);

  if (!isOpen) return null;

  const availableHalls = admin?.managedHalls?.length
    ? halls.filter((h) => admin.managedHalls!.includes(h.name))
    : halls;

  const availableFaculties = admin?.managedFaculties?.length
    ? faculties.filter((f) => admin.managedFaculties!.includes(f.name))
    : faculties;

  const availableDepartments = departments.filter((d) => {
    if (admin?.managedDepartments?.length && !admin.managedDepartments.includes(d.name)) {
      return false;
    }
    if (selectedFacultyId && d.facultyId !== selectedFacultyId) {
      return false;
    }
    return true;
  });

  const activeDepartmentObj = departments.find((d) => d.id === selectedDepartmentId);

  const handleToggleLevel = (lvl: string) => {
    if (domainId === 'grasag') return; // GRASAG strictly locked to Postgraduate
    setSelectedLevels((prev) =>
      prev.includes(lvl) ? prev.filter((l) => l !== lvl) : [...prev, lvl]
    );
  };

  const handleToggleProgramme = (prog: string) => {
    setSelectedProgrammes((prev) =>
      prev.includes(prog) ? prev.filter((p) => p !== prog) : [...prev, prog]
    );
  };

  const handleToggleHall = (hName: string) => {
    setSelectedHalls((prev) =>
      prev.includes(hName) ? prev.filter((item) => item !== hName) : [...prev, hName]
    );
  };

  const handleToggleFaculty = (fName: string) => {
    setSelectedFaculties((prev) =>
      prev.includes(fName) ? prev.filter((item) => item !== fName) : [...prev, fName]
    );
  };

  const handleAddRule = () => {
    if (!newRuleInput.trim()) return;
    setRules((prev) => [...prev, newRuleInput.trim()]);
    setNewRuleInput('');
  };

  const handleRemoveRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddPosition = () => {
    clearFieldError('newPosTitle');
    setErrorMsg('');
    if (!newPosTitle.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        newPosTitle: 'Enter a portfolio title before adding a custom position.',
      }));
      return;
    }
    const clampedMax = Math.min(5, Math.max(1, Number(newPosMax) || 1));
    setPositions((prev) => [
      ...prev,
      {
        title: newPosTitle.trim(),
        description: newPosDesc.trim() || `Contested portfolio for ${newPosTitle.trim()}`,
        maxSelections: clampedMax,
        allowsSkip: newPosSkip,
        candidateEligibilityRules: 'Accredited student in good standing, GPA >= 3.0.',
        votingRules:
          clampedMax > 1 ? `Multi-choice up to ${clampedMax} candidates` : 'Single candidate preference'
      }
    ]);
    setNewPosTitle('');
    setNewPosDesc('');
    setNewPosMax(1);
    setNewPosSkip(false);
  };

  const handleUpdatePositionField = (idx: number, field: keyof PositionDraft, value: any) => {
    setPositions((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const handleRemovePosition = (idx: number) => {
    setPositions((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const validateStep = (step: 1 | 2 | 3 | 4): boolean => {
    const errors: Record<string, string> = {};
    if (step === 1) {
      if (!title.trim()) {
        errors.title = 'Election title is mandatory.';
      }
      if (!academicYear.trim()) {
        errors.academicYear = 'Academic year is required (e.g. 2026/2027).';
      }
      if (!organizingBody.trim()) {
        errors.organizingBody = 'Organizing electoral body is required.';
      }
      if (domainId === 'jcrc_hall' && !selectedHallId) {
        errors.hallId = 'Please select the participating Hall of Residence.';
      }
      if ((domainId === 'faculty_school' || domainId === 'departmental') && !selectedFacultyId) {
        errors.facultyId = 'Please select the participating Faculty or School.';
      }
      if (domainId === 'departmental' && !selectedDepartmentId) {
        errors.departmentId = 'Please select the participating Academic Department.';
      }
    } else if (step === 2) {
      if (!startDate || !startTime) {
        errors.schedule = 'Opening date and time are required.';
      }
      if (!endDate || !endTime) {
        errors.schedule = 'Closing date and time are required.';
      }
      const startMs = new Date(`${startDate}T${startTime}:00Z`).getTime();
      const endMs = new Date(`${endDate}T${endTime}:00Z`).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        errors.schedule = 'Closing date/time must be strictly after the opening date/time.';
      }
    } else if (step === 3) {
      if (domainId !== 'grasag' && selectedLevels.length === 0) {
        errors.levels = 'Select at least one eligible academic level.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMsg(Object.values(errors)[0]);
      return false;
    }
    setFieldErrors({});
    setErrorMsg('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || submitting) return;
    setErrorMsg('');
    setFieldErrors({});

    if (!validateStep(1)) {
      setActiveStep(1);
      return;
    }
    if (!validateStep(2)) {
      setActiveStep(2);
      return;
    }
    if (!validateStep(3)) {
      setActiveStep(3);
      return;
    }

    // Auto-capture any typed-but-unclicked custom position so admin work is never lost
    if (!newPosTitle.trim() && newPosDesc.trim()) {
      setFieldErrors({ newPosTitle: 'Enter a title for your custom position or clear the summary.' });
      setErrorMsg('You entered a custom position summary without a portfolio title.');
      setActiveStep(4);
      return;
    }

    let finalPositions = [...positions];
    if (newPosTitle.trim()) {
      const clampedMax = Math.min(5, Math.max(1, Number(newPosMax) || 1));
      finalPositions.push({
        title: newPosTitle.trim(),
        description: newPosDesc.trim() || `Contested portfolio for ${newPosTitle.trim()}`,
        maxSelections: clampedMax,
        allowsSkip: newPosSkip,
        candidateEligibilityRules: 'Accredited student in good standing, GPA >= 3.0.',
        votingRules:
          clampedMax > 1 ? `Multi-choice up to ${clampedMax} candidates` : 'Single candidate preference',
      });
      setPositions(finalPositions);
      setNewPosTitle('');
      setNewPosDesc('');
      setNewPosMax(1);
      setNewPosSkip(false);
    }

    if (finalPositions.length === 0) {
      setErrorMsg('At least one contested position/portfolio is required.');
      setActiveStep(4);
      return;
    }

    for (let i = 0; i < finalPositions.length; i++) {
      const p = finalPositions[i];
      if (!p.title || !p.title.trim()) {
        setErrorMsg(`Contested position #${i + 1} must have a valid title.`);
        setActiveStep(4);
        return;
      }
      if (!p.maxSelections || p.maxSelections < 1 || p.maxSelections > 5) {
        setErrorMsg(`Position "${p.title}" must have Max Selections between 1 and 5.`);
        setActiveStep(4);
        return;
      }
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    const payload: CreateElectionPayload = {
      title: title.trim(),
      code: code.trim().toUpperCase() || undefined,
      description:
        description.trim() || `Official ${category} election for academic year ${academicYear}.`,
      category,
      domainId,
      hallId: domainId === 'jcrc_hall' ? selectedHallId : undefined,
      facultyId:
        domainId === 'faculty_school' || domainId === 'departmental'
          ? selectedFacultyId
          : undefined,
      departmentId: domainId === 'departmental' ? selectedDepartmentId : undefined,
      subdomainLabel: subdomainLabel.trim() || undefined,
      academicYear: academicYear.trim(),
      startDate: `${startDate}T${startTime}:00Z`,
      endDate: `${endDate}T${endTime}:00Z`,
      startTime,
      endTime,
      organizingBody: organizingBody.trim() || 'UCC Electoral Commission (EC-UCC)',
      rules,
      eligibilityCriteria: {
        faculties: selectedFaculties,
        departments: selectedDepartments,
        programmes: selectedProgrammes,
        levels: domainId === 'grasag' ? ['Postgraduate'] : selectedLevels,
        halls: selectedHalls
      },
      positions: finalPositions.map((p, idx) => ({
        ...p,
        order: idx + 1,
      })),
      initialStatus,
      idempotencyKey: draftIdempotencyKey,
      ...(guidelinesUrl ? { guidelinesUrl } : {})
    };

    try {
      const res = await adminService.createElection(payload);
      if (res.success && res.election) {
        await Promise.all([refreshElections(), refreshDomains()]);
        await onSuccess(res.election, res.positions);
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to save election to Cloud Firestore. Please review and try again.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected error while saving election. Please try again.');
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-xl my-8">

        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#123B70] mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#123B70]" />
              <span>EC-UCC Multi-Domain Election Provisioning</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Create New University Election
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign election domain, subdomain scope, eligibility criteria, timelines, and configurable portfolios.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          {[
            { step: 1, label: '1. Domain & Info' },
            { step: 2, label: '2. Schedule' },
            { step: 3, label: '3. Eligibility' },
            { step: 4, label: '4. Portfolios' }
          ].map((item) => (
            <button
              key={item.step}
              type="button"
              onClick={() => setActiveStep(item.step as any)}
              className={`py-2 px-3 rounded-xl font-bold text-center transition-colors cursor-pointer whitespace-nowrap ${
                activeStep === item.step
                  ? 'bg-[#123B70] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* STEP 1: Domain, Subdomain & Basic Information */}
          {activeStep === 1 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Election Domain <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={domainId}
                    onChange={(e) => applyDomainDefaults(e.target.value as DomainId)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-slate-900 bg-white font-semibold"
                  >
                    {allowedDomains.map((dom) => (
                      <option key={dom.id} value={dom.id}>
                        {dom.name} ({dom.category})
                      </option>
                    ))}
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

              {/* Dynamic Subdomain Selectors */}
              {domainId === 'jcrc_hall' && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-800">
                    Participating Hall Subdomain <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={selectedHallId}
                    onChange={(e) => {
                      clearFieldError('hallId');
                      const hallObj = halls.find((h) => h.id === e.target.value);
                      setSelectedHallId(e.target.value);
                      if (hallObj) {
                        setSelectedHalls([hallObj.name]);
                        setSubdomainLabel(hallObj.name);
                        setOrganizingBody(`${hallObj.name} Electoral Committee`);
                      }
                    }}
                    className={`w-full px-3.5 py-2 rounded-xl border bg-white font-medium text-slate-900 ${
                      fieldErrors.hallId ? 'border-red-500' : 'border-slate-300'
                    }`}
                  >
                    <option value="">Select Residential Hall...</option>
                    {availableHalls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.hallId && (
                    <p className="text-[11px] font-semibold text-red-600">{fieldErrors.hallId}</p>
                  )}
                </div>
              )}

              {(domainId === 'faculty_school' || domainId === 'departmental') && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Faculty / School <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={selectedFacultyId}
                      onChange={(e) => {
                        const facObj = faculties.find((f) => f.id === e.target.value);
                        setSelectedFacultyId(e.target.value);
                        setSelectedDepartmentId('');
                        setSelectedDepartments([]);
                        setSelectedProgrammes([]);
                        if (facObj) {
                          setSelectedFaculties([facObj.name]);
                          if (domainId === 'faculty_school') {
                            setSubdomainLabel(facObj.name);
                            setOrganizingBody(`${facObj.name} Electoral Committee`);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900"
                    >
                      <option value="">Select Faculty / School...</option>
                      {availableFaculties.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {domainId === 'departmental' && (
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Department Subdomain <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={selectedDepartmentId}
                        onChange={(e) => {
                          const deptObj = departments.find((d) => d.id === e.target.value);
                          setSelectedDepartmentId(e.target.value);
                          setSelectedProgrammes([]);
                          if (deptObj) {
                            setSelectedFacultyId(deptObj.facultyId);
                            setSelectedFaculties([deptObj.facultyName]);
                            setSelectedDepartments([deptObj.name]);
                            setSubdomainLabel(deptObj.name);
                            setOrganizingBody(`${deptObj.name} Electoral Board`);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900"
                      >
                        <option value="">Select Department...</option>
                        {availableDepartments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Election Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oguaa Hall JCRC Executive Elections 2026/2027"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    clearFieldError('title');
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#123B70] text-slate-900 bg-white ${
                    fieldErrors.title ? 'border-red-500' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.title && (
                  <p className="text-[11px] font-semibold text-red-600 mt-1">{fieldErrors.title}</p>
                )}
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
                    placeholder="Auto-generated if left blank"
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
                  placeholder="Detail constitutional mandate, domain constituency, and scope..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Optional Election Guidelines / Gazette Document (Firebase Storage)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={uploadingDoc}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setErrorMsg('');
                      setUploadingDoc(true);
                      try {
                        const uploaded = await uploadElectionDocument(file, code || 'election-doc');
                        setGuidelinesUrl(uploaded.url);
                      } catch (err: any) {
                        setErrorMsg(err?.message || 'Document upload failed.');
                      } finally {
                        setUploadingDoc(false);
                      }
                    }}
                    className="text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#EAF2FA] file:text-[#123B70] hover:file:bg-blue-100 cursor-pointer"
                  />
                  {uploadingDoc && <span className="text-xs text-[#123B70] font-semibold">Uploading...</span>}
                  {guidelinesUrl && !uploadingDoc && (
                    <span className="text-xs text-emerald-700 font-semibold">Document attached</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Schedule & Timeline */}
          {activeStep === 2 && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[#123B70] flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  Official voting portals enforce scheduled open and close windows.
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
            <div className="space-y-5 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 flex items-center gap-2">
                <Users className="w-4 h-4 shrink-0 text-amber-700" />
                <span>
                  {domainId === 'grasag'
                    ? 'GRASAG Domain Rule: Automatically restricted to accredited Postgraduate students only.'
                    : 'Server-side Eligibility Engine enforces these criteria for every student ballot request.'}
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
                    const lockedOut = domainId === 'grasag' && lvl !== 'Postgraduate';
                    return (
                      <button
                        key={lvl}
                        type="button"
                        disabled={lockedOut || domainId === 'grasag'}
                        onClick={() => handleToggleLevel(lvl)}
                        className={`px-3 py-1.5 rounded-xl font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                          isSelected
                            ? 'bg-[#123B70] text-white border-[#123B70]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {lvl === 'Postgraduate' ? 'Postgraduate' : `Level ${lvl}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Academic Programmes (for Departmental elections) */}
              {domainId === 'departmental' && activeDepartmentObj && (
                <div>
                  <label className="block font-bold text-slate-800 mb-2">
                    Restrict to Specific Academic Programmes (Leave unchecked for entire {activeDepartmentObj.name})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeDepartmentObj.programmes.map((prog) => {
                      const isSel = selectedProgrammes.includes(prog);
                      return (
                        <button
                          key={prog}
                          type="button"
                          onClick={() => handleToggleProgramme(prog)}
                          className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                            isSel
                              ? 'bg-[#123B70] text-white border-[#123B70]'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {prog}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Halls */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  Eligible Hall Affiliations (Required for JCRC / Hall elections)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableHalls.map((h) => {
                    const isSelected = selectedHalls.includes(h.name);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => handleToggleHall(h.name)}
                        className={`p-2 rounded-xl text-left font-medium border text-[11px] transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-red-50 text-red-900 border-red-300 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {h.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Faculties */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  Eligible Faculties / Schools
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {availableFaculties.map((f) => {
                    const isSelected = selectedFaculties.includes(f.name);
                    return (
                      <label key={f.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleFaculty(f.name)}
                          className="rounded text-[#123B70] focus:ring-0"
                        />
                        <span className="truncate text-slate-800">{f.name}</span>
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
                        className="text-red-500 hover:text-red-700 ml-2 cursor-pointer"
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
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900 cursor-pointer"
                  >
                    Add Rule
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Contested Positions / Portfolios */}
          {activeStep === 4 && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  {domainId === 'local_nugs'
                    ? 'Local NUGS portfolios are fully admin-configurable—edit, rename, remove, or add positions freely.'
                    : domainId === 'jcrc_hall'
                    ? 'Customize portfolios to match this hall constitution—different halls need not use identical offices.'
                    : 'Configure the official executive and legislative portfolios for this ballot.'}
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {positions.map((pos, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    {editingIdx === idx ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={pos.title}
                            onChange={(e) => handleUpdatePositionField(idx, 'title', e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                            placeholder="Portfolio Title"
                          />
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={pos.maxSelections}
                            onChange={(e) =>
                              handleUpdatePositionField(
                                idx,
                                'maxSelections',
                                parseInt(e.target.value, 10) || 1
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <input
                          type="text"
                          value={pos.description}
                          onChange={(e) =>
                            handleUpdatePositionField(idx, 'description', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                          placeholder="Portfolio description"
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pos.allowsSkip}
                              onChange={(e) =>
                                handleUpdatePositionField(idx, 'allowsSkip', e.target.checked)
                              }
                            />
                            <span>Allow abstain</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setEditingIdx(null)}
                            className="px-3 py-1 rounded-lg bg-[#123B70] text-white font-bold cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-[#123B70] text-white font-mono font-bold text-[10px]">
                              #{idx + 1}
                            </span>
                            <h4 className="font-bold text-slate-900">{pos.title}</h4>
                          </div>
                          <p className="text-[11px] text-slate-600">{pos.description}</p>
                          <div className="flex gap-3 text-[10px] text-slate-500 font-mono pt-0.5">
                            <span>Max selections: {pos.maxSelections}</span>
                            <span>Allows skip: {pos.allowsSkip ? 'YES' : 'NO'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingIdx(idx)}
                            className="text-[#123B70] hover:bg-blue-50 p-1 rounded cursor-pointer"
                            title="Edit Position"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePosition(idx)}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            title="Remove Position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Position Form */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#123B70]" />
                  <span>Add Custom Contested Position</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Portfolio Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Women's Commissioner or Hall Organizer"
                      value={newPosTitle}
                      onChange={(e) => {
                        setNewPosTitle(e.target.value);
                        clearFieldError('newPosTitle');
                      }}
                      className={`w-full px-3 py-1.5 rounded-xl border ${
                        fieldErrors.newPosTitle ? 'border-red-500' : 'border-slate-300'
                      }`}
                    />
                    {fieldErrors.newPosTitle && (
                      <p className="text-[11px] font-semibold text-red-600 mt-1">
                        {fieldErrors.newPosTitle}
                      </p>
                    )}
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

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPosSkip}
                      onChange={(e) => setNewPosSkip(e.target.checked)}
                      className="rounded text-[#123B70]"
                    />
                    <span>Allow voters to abstain/skip this portfolio</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPosition}
                    className="px-3.5 py-1.5 rounded-xl bg-[#123B70] text-white font-bold hover:bg-[#0B1F3A] cursor-pointer whitespace-nowrap"
                  >
                    Add Portfolio
                  </button>
                </div>
              </div>

              {/* Publication Readiness */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">
                  Initial Publication Status
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      value: 'draft' as const,
                      label: 'Save as Draft',
                      desc: 'Hidden from students until published.',
                    },
                    {
                      value: 'scheduled' as const,
                      label: 'Publish as Scheduled',
                      desc: 'Visible to students ahead of poll opening.',
                    },
                    {
                      value: 'live' as const,
                      label: 'Publish & Open Now',
                      desc: 'Immediately live for candidate & voter access.',
                    },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        initialStatus === opt.value
                          ? 'bg-blue-50 border-[#123B70] text-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="initialStatus"
                          value={opt.value}
                          checked={initialStatus === opt.value}
                          onChange={() => setInitialStatus(opt.value)}
                          className="text-[#123B70]"
                        />
                        <span>{opt.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (activeStep > 1) setActiveStep((prev) => (prev - 1) as any);
                else onClose();
              }}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {activeStep === 1 ? 'Cancel' : 'Previous Step'}
            </button>

            <div className="flex gap-2">
              {activeStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep(activeStep)) {
                      setActiveStep((prev) => (prev + 1) as any);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#123B70] text-white font-bold hover:bg-[#0B1F3A] transition-colors cursor-pointer"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#C62828] text-white font-bold hover:bg-red-800 transition-colors disabled:opacity-50 cursor-pointer"
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
