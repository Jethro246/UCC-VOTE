import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { 
  Search, 
  Users, 
  ArrowRight, 
  FileText, 
  Check, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  BookOpen,
  Filter,
  PlusCircle,
  GraduationCap,
  Scale,
  Building,
  UserCheck
} from 'lucide-react';
import { ManifestoComparisonModal } from '../../components/candidates/ManifestoComparisonModal';
import { CandidateRegistrationModal } from '../../components/admin/CandidateRegistrationModal';

export const CandidateDirectoryPage: React.FC = () => {
  const { 
    navigateTo, 
    compareCandidateIds, 
    toggleCompareCandidate,
    elections,
    candidates,
    userRole,
    myCandidateApplication
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedElection, setSelectedElection] = useState<string>('All');
  const [selectedPosition, setSelectedPosition] = useState<string>('All');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('All');
  
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // In the public candidate directory, only approved candidates appear
  const approvedCandidates = candidates.filter(c => c.applicationStatus === 'Approved');

  // Extract unique departments and faculties from candidates
  const allDepartments = Array.from(new Set(approvedCandidates.map(c => c.department))).filter(Boolean);
  const allFaculties = Array.from(new Set(approvedCandidates.map(c => c.faculty))).filter(Boolean);
  
  // Extract positions for selected election
  const currentElectionPositions = Array.from(
    new Set(
      approvedCandidates
        .filter(c => selectedElection === 'All' || c.electionId === selectedElection)
        .map(c => c.positionId)
    )
  );

  const filteredCandidates = approvedCandidates.filter((c) => {
    const matchesElection = selectedElection === 'All' || c.electionId === selectedElection;
    const matchesPosition = selectedPosition === 'All' || c.positionId === selectedPosition;
    const matchesDepartment = selectedDepartment === 'All' || c.department.toLowerCase().includes(selectedDepartment.toLowerCase());
    const matchesFaculty = selectedFaculty === 'All' || c.faculty.toLowerCase().includes(selectedFaculty.toLowerCase());
    
    const q = search.toLowerCase();
    const matchesSearch = 
      c.fullName.toLowerCase().includes(q) ||
      (c.nickname && c.nickname.toLowerCase().includes(q)) ||
      c.studentId.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q) ||
      (c.programme && c.programme.toLowerCase().includes(q)) ||
      c.manifestoSummary.toLowerCase().includes(q) ||
      (c.biography && c.biography.toLowerCase().includes(q));

    return matchesElection && matchesPosition && matchesDepartment && matchesFaculty && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              Review the accredited candidate portfolios, policy manifestos, and vision for University of Cape Coast leadership.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Compare Manifestos Button */}
          <button
            onClick={() => setShowCompareModal(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Scale className="w-4 h-4 text-[#123B70]" />
            <span>Compare Manifestos</span>
          </button>

          {/* Student Candidacy Button */}
          {userRole !== 'admin' && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>Apply for Candidacy</span>
            </button>
          )}
        </div>
      </div>

      {/* Candidate Application Status Banner (if student has an active candidacy) */}
      {myCandidateApplication && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#123B70] text-white flex items-center justify-center font-bold text-sm shrink-0">
              {myCandidateApplication.applicationStatus === 'Approved' ? '✓' : 'ℹ'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#123B70]">
                  Your Candidacy Application: {myCandidateApplication.fullName}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
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

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => navigateTo('candidate_profile', { candidateId: myCandidateApplication.id })}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              View My Profile
            </button>
          </div>
        </div>
      )}

      {/* Advanced Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate by name, nickname, student ID, department, programme, manifesto..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#123B70] bg-slate-50/50"
            />
          </div>

          {/* Quick Clear Filter */}
          {(selectedElection !== 'All' || selectedPosition !== 'All' || selectedDepartment !== 'All' || selectedFaculty !== 'All' || search) && (
            <button
              onClick={() => {
                setSelectedElection('All');
                setSelectedPosition('All');
                setSelectedDepartment('All');
                setSelectedFaculty('All');
                setSearch('');
              }}
              className="text-xs font-semibold text-[#C62828] hover:underline self-start md:self-auto whitespace-nowrap cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* 4 Multi-tier Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* Election Filter */}
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
              <option value="All">All Elections</option>
              {elections.map((el) => (
                <option key={el.id} value={el.id}>{el.title}</option>
              ))}
            </select>
          </div>

          {/* Position Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Position
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
            >
              <option value="All">All Positions</option>
              {currentElectionPositions.map((posId) => (
                <option key={posId} value={posId}>{posId}</option>
              ))}
            </select>
          </div>

          {/* Faculty Filter */}
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
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#123B70]"
            >
              <option value="All">All Departments</option>
              {allDepartments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Candidate Grid */}
      {filteredCandidates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Approved Candidates Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No candidates matched your search criteria. Try modifying your election, department, or faculty filters.
          </p>
          <button
            onClick={() => {
              setSelectedElection('All');
              setSelectedPosition('All');
              setSelectedDepartment('All');
              setSelectedFaculty('All');
              setSearch('');
            }}
            className="px-4 py-2 rounded-xl bg-[#123B70] text-white text-xs font-semibold hover:bg-[#0B1F3A]"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map((cand) => {
            const isComparing = compareCandidateIds?.includes(cand.id);

            return (
              <div
                key={cand.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-[#123B70]/50 hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Photo & Identity Header */}
                  <div className="p-5 flex items-start gap-4">
                    <div className="relative shrink-0">
                      <img
                        src={cand.photoUrl}
                        alt={cand.fullName}
                        className="w-20 h-20 rounded-2xl object-cover object-center border-2 border-slate-200 shrink-0 group-hover:scale-102 transition-transform shadow-xs"
                      />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#123B70] text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-xs">
                        ✓
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider block">
                        {cand.hall}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#123B70] transition-colors leading-tight truncate">
                        {cand.fullName}
                      </h3>
                      {cand.nickname && (
                        <p className="text-xs font-bold text-[#C62828] truncate">
                          "{cand.nickname}"
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 font-mono">
                        {cand.studentId}
                      </p>
                    </div>
                  </div>

                  {/* Candidate Academic Details */}
                  <div className="px-5 pb-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Department:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[170px]" title={cand.department}>
                          {cand.department}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Programme:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[170px]" title={cand.programme}>
                          {cand.programme || 'Undergraduate'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Class Level:</span>
                        <span className="font-semibold text-slate-800">Level {cand.level}</span>
                      </div>
                    </div>
                  </div>

                  {/* Biography or Short Manifesto Snippet */}
                  <div className="px-5 pb-4 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Policy Vision
                    </span>
                    <p className="text-xs text-slate-600 line-clamp-2 italic leading-relaxed">
                      "{cand.manifestoSummary}"
                    </p>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleCompareCandidate(cand.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isComparing
                        ? 'bg-blue-100 text-[#123B70] border border-blue-300'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    {isComparing ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#123B70]" />
                        <span>In Compare</span>
                      </>
                    ) : (
                      <span>+ Compare</span>
                    )}
                  </button>

                  <button
                    onClick={() => navigateTo('candidate_profile', { candidateId: cand.id })}
                    className="px-3.5 py-1.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <span>View Profile</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manifesto Comparison Modal */}
      <ManifestoComparisonModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        initialCandidateIds={compareCandidateIds ? [compareCandidateIds[0], compareCandidateIds[1]] : []}
      />

      {/* Candidate Registration Modal */}
      <CandidateRegistrationModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
      />

    </div>
  );
};
