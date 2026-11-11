import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  HelpCircle, 
  AlertCircle, 
  Phone, 
  Mail, 
  MapPin, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ShieldAlert,
  Send
} from 'lucide-react';
import { ComplaintTicket } from '../../types';

export const HelpSupportPage: React.FC = () => {
  const { complaints, submitComplaint, student } = useApp();

  const [activeTab, setActiveTab] = useState<'submit' | 'track' | 'faq'>('submit');
  const [category, setCategory] = useState<ComplaintTicket['category']>('technical');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [generatedTicketNumber, setGeneratedTicketNumber] = useState('');
  const [searchTicket, setSearchTicket] = useState('');
  const [searchedTicket, setSearchedTicket] = useState<ComplaintTicket | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    const ticketNo = submitComplaint({ category, subject, description });
    setGeneratedTicketNumber(ticketNo);
    setSubject('');
    setDescription('');
  };

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = complaints.find(c => c.ticketNumber.toLowerCase() === searchTicket.trim().toLowerCase());
    setSearchedTicket(found || null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#C62828] uppercase tracking-wider">
            Student Support & Grievances
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Electoral Complaint & Support Desk
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Submit inquiries, report technical ballot difficulties, or file formal irregularity petitions to the Commission.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'submit' ? 'bg-[#123B70] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            File Complaint
          </button>
          <button
            onClick={() => setActiveTab('track')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'track' ? 'bg-[#123B70] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Track Status ({complaints.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Submit Complaint */}
      {activeTab === 'submit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          {generatedTicketNumber ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Complaint Successfully Lodged
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Your petition has been encrypted and routed directly to the Returning Officer and ICT Monitoring Desk.
              </p>
              <div className="p-3 bg-white rounded-xl border border-emerald-300 inline-block font-mono font-bold text-sm text-[#123B70]">
                Tracking Number: {generatedTicketNumber}
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setGeneratedTicketNumber('')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  File Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-[#EAF2FA] rounded-xl text-xs text-[#123B70] flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-[#123B70] mt-0.5" />
                <p className="leading-relaxed">
                  All election petitions are protected by strict whistleblower confidentiality. Frivolous submissions may be subject to UCC Student Code of Conduct penalties.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Complaint / Inquiry Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white font-medium"
                >
                  <option value="technical">Technical Difficulty (e.g. login issue, network timeout, OTP delay)</option>
                  <option value="eligibility">Voter Roll Eligibility Query (e.g. wrong hall or department recorded)</option>
                  <option value="irregularity">Electoral Irregularity or Campaign Violation Report</option>
                  <option value="general">General Commission Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Subject Headline
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Unable to verify student index number for Faculty election"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Detailed Description & Evidence
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide precise details, error messages, polling portfolio involved, and timestamps..."
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#C62828] hover:bg-red-700 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit Formal Complaint Ticket</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tab 2: Track Status */}
      {activeTab === 'track' && (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <form onSubmit={handleTrackSearch} className="flex gap-2">
              <input
                type="text"
                value={searchTicket}
                onChange={(e) => setSearchTicket(e.target.value)}
                placeholder="Enter Ticket Number (e.g. UCC-EC-2026-7819)"
                className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-[#123B70]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#123B70] text-white text-xs font-bold rounded-xl hover:bg-[#0B1F3A] cursor-pointer"
              >
                Track Ticket
              </button>
            </form>

            {searchedTicket && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[#123B70]">{searchedTicket.ticketNumber}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    {searchedTicket.status}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{searchedTicket.subject}</h4>
                <p className="text-xs text-slate-600">{searchedTicket.description}</p>
                {searchedTicket.response && (
                  <div className="mt-2 p-2.5 bg-white rounded border border-slate-200 text-xs text-slate-700">
                    <strong className="text-slate-900 block mb-0.5">Secretariat Response:</strong>
                    {searchedTicket.response}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* List of existing complaints */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Submitted Tickets in Registry
            </h3>
            <div className="space-y-3">
              {complaints.map((c) => (
                <div key={c.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#123B70]">{c.ticketNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">{c.subject}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{c.description}</p>
                  {c.response && (
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 mt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Commission Resolution
                      </span>
                      {c.response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Commission Contact Hotline Strip */}
      <div className="bg-[#0B1F3A] text-white p-6 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 shrink-0">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase font-bold">Election Hotline</p>
            <p className="font-semibold text-white mt-0.5">+233 3321 32440</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-sky-400 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase font-bold">Email Desk</p>
            <p className="font-semibold text-white mt-0.5">elections@ucc.edu.gh</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase font-bold">Physical Secretariat</p>
            <p className="font-semibold text-white mt-0.5">Students' Centre, Room 14</p>
          </div>
        </div>
      </div>

    </div>
  );
};
