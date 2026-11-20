import React, { useEffect, useRef, useState } from 'react';
import { X, Edit3, AlertCircle, Calendar, Clock, Users } from 'lucide-react';
import { Election } from '../../types';
import { adminService } from '../../services/adminService';
import { useApp } from '../../context/AppContext';
import { resolveElectionHallUnit, getHallDisplayName } from '../../utils/hallUtils';

interface EditElectionModalProps {
  isOpen: boolean;
  election: Election | null;
  onClose: () => void;
  onSuccess: (updatedElection: Election) => void | Promise<void>;
}

const UCC_LEVELS = ['100', '200', '300', '400', 'Postgraduate'];

function extractDatePart(isoOrDate: string | undefined, allowBlank = false): string {
  if (!isoOrDate) return allowBlank ? '' : new Date().toISOString().slice(0, 10);
  if (isoOrDate.includes('T')) return isoOrDate.slice(0, 10);
  return isoOrDate.slice(0, 10);
}

function extractTimePart(isoOrTime: string | undefined, fallback: string): string {
  if (!isoOrTime) return fallback;
  if (isoOrTime.includes('T')) {
    const t = isoOrTime.split('T')[1];
    if (t && t.length >= 5) return t.slice(0, 5);
  }
  if (/^\d{2}:\d{2}/.test(isoOrTime)) return isoOrTime.slice(0, 5);
  return fallback;
}

export const EditElectionModal: React.FC<EditElectionModalProps> = ({
  isOpen,
  election,
  onClose,
  onSuccess,
}) => {
  const { halls, faculties, refreshElections, refreshDomains } = useApp();

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [organizingBody, setOrganizingBody] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('17:00');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [selectedHalls, setSelectedHalls] = useState<string[]>([]);
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && election) {
      const allowBlankDates = Boolean(election.isHistorical || election.status === 'archived');
      setTitle(election.title || '');
      setCode(election.code || '');
      setAcademicYear(election.academicYear || '');
      setOrganizingBody(election.organizingBody || '');
      setDescription(election.description || '');
      setStartDate(extractDatePart(election.startDate, allowBlankDates));
      setStartTime(election.startTime || extractTimePart(election.startDate, allowBlankDates && !election.startDate ? '' : '08:00'));
      setEndDate(extractDatePart(election.endDate, allowBlankDates));
      setEndTime(election.endTime || extractTimePart(election.endDate, allowBlankDates && !election.endDate ? '' : '17:00'));
      setSelectedLevels(election.eligibilityCriteria?.levels || ['100', '200', '300', '400']);
      const isMultiHallFramework =
        (election.eligibilityCriteria?.halls?.length ?? 0) > 1 && !election.hallId;
      const resolvedHall = isMultiHallFramework ? undefined : resolveElectionHallUnit(election, halls);
      setSelectedHallId(election.hallId || resolvedHall?.id || '');
      setSelectedHalls(
        election.eligibilityCriteria?.halls?.length
          ? election.eligibilityCriteria.halls
          : resolvedHall
          ? [resolvedHall.name]
          : []
      );
      setSelectedFaculties(election.eligibilityCriteria?.faculties || []);
      setErrorMsg('');
      setSaving(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen, election?.id]);

  if (!isOpen || !election) return null;

  const isGrasag = election.domainId === 'grasag' || election.category === 'GRASAG';
  const isHallElection = election.domainId === 'jcrc_hall' || election.category === 'JCR / Hall';

  const isHistoricalOrArchived = Boolean(election.isHistorical || election.status === 'archived');
  const isMultiHallFramework =
    isHallElection && (election.eligibilityCriteria?.halls?.length ?? 0) > 1 && !election.hallId;

  const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setList((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || saving) return;
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Election title is mandatory.');
      return;
    }
    if (!academicYear.trim()) {
      setErrorMsg('Academic year is required.');
      return;
    }
    if (!organizingBody.trim()) {
      setErrorMsg('Organizing body is required.');
      return;
    }

    const hasBothDates = Boolean(startDate.trim() && endDate.trim());
    const hasPartialDate = Boolean(startDate.trim()) !== Boolean(endDate.trim());
    if (hasPartialDate) {
      setErrorMsg('Provide both opening and closing dates, or leave both blank for historical records.');
      return;
    }
    if (!isHistoricalOrArchived && !hasBothDates) {
      setErrorMsg('Opening and closing dates are required.');
      return;
    }

    let startIso = '';
    let endIso = '';
    const effectiveStartTime = startTime || '08:00';
    const effectiveEndTime = endTime || '17:00';
    if (hasBothDates) {
      startIso = `${startDate}T${effectiveStartTime}:00Z`;
      endIso = `${endDate}T${effectiveEndTime}:00Z`;
      const sMs = new Date(startIso).getTime();
      const eMs = new Date(endIso).getTime();
      if (Number.isNaN(sMs) || Number.isNaN(eMs) || eMs <= sMs) {
        setErrorMsg('Closing date/time must be strictly after opening date/time.');
        return;
      }
    }

    if (!isGrasag && selectedLevels.length === 0) {
      setErrorMsg('Select at least one eligible academic level.');
      return;
    }

    const selectedHallObj = halls.find((h) => h.id === selectedHallId);
    if (isHallElection && !selectedHallObj && !isMultiHallFramework) {
      setErrorMsg('Please select the participating UCC Hall of Residence.');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      const res = await adminService.updateElection(election.id, {
        title: title.trim(),
        code: code.trim().toUpperCase() || election.code,
        academicYear: academicYear.trim(),
        organizingBody: organizingBody.trim(),
        description: description.trim(),
        startDate: startIso,
        endDate: endIso,
        startTime: hasBothDates ? effectiveStartTime : '',
        endTime: hasBothDates ? effectiveEndTime : '',
        ...(isHallElection && selectedHallObj
          ? {
              hallId: selectedHallObj.id,
              subdomainLabel: selectedHallObj.name,
            }
          : {}),
        eligibilityCriteria: {
          ...election.eligibilityCriteria,
          levels: isGrasag ? ['Postgraduate'] : selectedLevels,
          halls: isHallElection && selectedHallObj ? [selectedHallObj.name] : selectedHalls,
          faculties: selectedFaculties,
        },
      });

      if (res.success) {
        await Promise.all([refreshElections(), refreshDomains()]);
        await onSuccess(res.election || { ...election, title: title.trim() });
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to update election configuration.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected error while saving election changes.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-1.5 ucc-caption font-semibold text-[#123B70] mb-1">
              <Edit3 className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Edit Election Configuration</span>
            </div>
            <h3 className="ucc-heading-card text-slate-900">{election.title}</h3>
            <p className="ucc-caption text-slate-500 font-mono tabular-nums mt-0.5">
              ID: {election.id} · {election.category}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 ucc-body-secondary flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 ucc-body-secondary">
          <div>
            <label className="block ucc-label font-semibold text-slate-800 mb-1">
              Election Title <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block ucc-label font-semibold text-slate-800 mb-1">Public Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 tabular-nums uppercase"
              />
            </div>
            <div>
              <label className="block ucc-label font-semibold text-slate-800 mb-1">Academic Year</label>
              <input
                type="text"
                required
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 tabular-nums"
              />
            </div>
            <div>
              <label className="block ucc-label font-semibold text-slate-800 mb-1">Organizing Body</label>
              <input
                type="text"
                required
                value={organizingBody}
                onChange={(e) => setOrganizingBody(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {isHallElection && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block ucc-label font-semibold text-slate-800 mb-1">
                Participating Hall of Residence <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedHallId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedHallId(nextId);
                  const hObj = halls.find((h) => h.id === nextId);
                  if (hObj) {
                    setSelectedHalls([hObj.name]);
                  }
                }}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-semibold text-slate-900"
              >
                <option value="">Select Official UCC Hall...</option>
                {halls.map((h) => (
                  <option key={h.id} value={h.id}>
                    {getHallDisplayName(h)}
                  </option>
                ))}
              </select>
              <p className="ucc-caption text-slate-500 mt-1">
                Updates hall ID, subdomain label, and voter hall eligibility restriction simultaneously.
              </p>
            </div>
          )}

          <div>
            <label className="block ucc-label font-semibold text-slate-800 mb-1">Official Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="space-y-2">
              <div className="ucc-label font-semibold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#123B70]" />
                <span>Poll Opening {isHistoricalOrArchived ? '(Optional for Archive)' : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required={!isHistoricalOrArchived}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 bg-white tabular-nums"
                />
                <input
                  type="time"
                  required={!isHistoricalOrArchived && Boolean(startDate)}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 bg-white tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="ucc-label font-semibold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-red-600" />
                <span>Poll Closing {isHistoricalOrArchived ? '(Optional for Archive)' : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required={!isHistoricalOrArchived}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 bg-white tabular-nums"
                />
                <input
                  type="time"
                  required={!isHistoricalOrArchived && Boolean(endDate)}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 bg-white tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="ucc-label font-semibold text-slate-800 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#123B70]" />
              <span>Eligible Academic Levels</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {UCC_LEVELS.map((lvl) => {
                const isSelected = selectedLevels.includes(lvl);
                return (
                  <button
                    key={lvl}
                    type="button"
                    disabled={isGrasag}
                    onClick={() => toggleItem(selectedLevels, setSelectedLevels, lvl)}
                    className={`px-3 py-1 rounded-lg border ucc-btn font-semibold cursor-pointer disabled:opacity-50 tabular-nums ${
                      isSelected
                        ? 'bg-[#123B70] text-white border-[#123B70]'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {lvl === 'Postgraduate' ? 'Postgraduate' : `Level ${lvl}`}
                  </button>
                );
              })}
            </div>
          </div>

          {election.domainId !== 'src' && election.domainId !== 'grasag' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block ucc-label font-semibold text-slate-800 mb-1">Restricted Halls</label>
                <div className="max-h-28 overflow-y-auto p-2 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  {halls.map((h) => (
                    <label key={h.id} className="flex items-center gap-2 ucc-caption cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedHalls.includes(h.name)}
                        onChange={() => toggleItem(selectedHalls, setSelectedHalls, h.name)}
                      />
                      <span>{h.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block ucc-label font-semibold text-slate-800 mb-1">Restricted Faculties</label>
                <div className="max-h-28 overflow-y-auto p-2 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  {faculties.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 ucc-caption cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFaculties.includes(f.name)}
                        onChange={() => toggleItem(selectedFaculties, setSelectedFaculties, f.name)}
                      />
                      <span className="truncate">{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 ucc-btn font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving Changes...' : 'Save Election Updates'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
