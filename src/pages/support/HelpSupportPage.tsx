import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../../components/common/Logo';
import { uploadComplaintAttachment } from '../../services/firebaseStorageService';
import {
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  Send,
  Paperclip,
  Loader2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { ComplaintTicket } from '../../types';
import { formatNumber, formatPercentage } from '../../utils/numberFormat';

export const HelpSupportPage: React.FC = () => {
  const { complaints, domains, submitComplaint, userRole, firebaseUser, navigateTo } = useApp();

  const [activeTab, setActiveTab] = useState<'submit' | 'track'>('submit');
  const [category, setCategory] = useState<ComplaintTicket['category']>('technical');
  const [domainId, setDomainId] = useState<string>('src');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedTicketNumber, setGeneratedTicketNumber] = useState('');
  const [searchTicket, setSearchTicket] = useState('');
  const [searchedTicket, setSearchedTicket] = useState<ComplaintTicket | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!subject.trim() || !description.trim()) return;

    setSubmitting(true);
    let attachmentUrl: string | undefined;

    try {
      if (attachmentFile && firebaseUser) {
        const uploaded = await uploadComplaintAttachment(
          attachmentFile,
          firebaseUser.uid,
          setUploadProgress
        );
        attachmentUrl = uploaded.url;
      }

      const res = await submitComplaint({
        category,
        subject,
        description,
        domainId,
        attachmentUrl,
      });

      if (!res.success || !res.ticketNumber) {
        setSubmitError(res.error || 'Could not lodge complaint.');
      } else {
        setGeneratedTicketNumber(res.ticketNumber);
        setSubject('');
        setDescription('');
        setAttachmentFile(null);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Attachment upload or ticket submission failed.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = complaints.find(
      (c) => c.ticketNumber.toLowerCase() === searchTicket.trim().toLowerCase()
    );
    setSearchedTicket(found || null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <Logo variant="default" showWordmark={false} />
          <div>
            <span className="ucc-caption font-semibold text-[#C62828] uppercase tracking-wider">
              Student Support & Grievances
            </span>
            <h1 className="ucc-heading-page text-slate-900 mt-0.5">
              Electoral Complaint & Support Desk
            </h1>
            <p className="ucc-body-secondary text-slate-600 mt-1">
              Submit inquiries, report technical ballot difficulties, or file formal irregularity petitions to the Commission.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-3.5 py-2 rounded-xl ucc-btn font-semibold transition-colors cursor-pointer ${
              activeTab === 'submit'
                ? 'bg-[#123B70] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            File Complaint
          </button>
          <button
            onClick={() => setActiveTab('track')}
            className={`px-3.5 py-2 rounded-xl ucc-btn font-semibold transition-colors cursor-pointer tabular-nums ${
              activeTab === 'track'
                ? 'bg-[#123B70] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Track Status ({formatNumber(complaints.length)})
          </button>
        </div>
      </div>

      {/* Tab 1: Submit Complaint */}
      {activeTab === 'submit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          {userRole !== 'student' ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
              <Lock className="w-8 h-8 text-[#123B70] mx-auto" />
              <h3 className="ucc-heading-card text-slate-900">
                Sign In Required to File a Support Ticket
              </h3>
              <p className="ucc-body-secondary text-slate-600 max-w-md mx-auto">
                Sign in with your activated UCC VOTE student account so your ticket is securely linked to your profile for Commission follow-up.
              </p>
              <button
                type="button"
                onClick={() => navigateTo('student_login')}
                className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white ucc-btn font-semibold cursor-pointer"
              >
                Sign In to File Ticket
              </button>
            </div>
          ) : generatedTicketNumber ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="ucc-heading-card text-slate-900">
                Complaint Successfully Saved
              </h3>
              <p className="ucc-body-secondary text-slate-600 max-w-md mx-auto">
                Your petition has been saved to Cloud Firestore and routed to the Electoral Commission Support Desk.
              </p>
              <div className="p-3 bg-white rounded-xl border border-emerald-300 inline-block font-mono tabular-nums font-semibold text-sm text-[#123B70]">
                Tracking Number: {generatedTicketNumber}
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setGeneratedTicketNumber('')}
                  className="px-4 py-2 rounded-lg ucc-btn font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  File Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-[#EAF2FA] rounded-xl ucc-body-secondary text-[#123B70] flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-[#123B70] mt-0.5" />
                <p>
                  All election petitions are recorded with your authenticated student identity and reviewed directly by the UCC Electoral Commission.
                </p>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 ucc-body-secondary text-[#C62828] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Complaint / Inquiry Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white font-medium"
                  >
                    <option value="technical">Technical Difficulty</option>
                    <option value="eligibility">Voter Roll Eligibility Query</option>
                    <option value="irregularity">Electoral Irregularity / Campaign Petition</option>
                    <option value="general">General Commission Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Related Election Domain
                  </label>
                  <select
                    value={domainId}
                    onChange={(e) => setDomainId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70] bg-white font-medium"
                  >
                    {domains.map((dom) => (
                      <option key={dom.id} value={dom.id}>
                        {dom.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Subject Headline
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Describe the issue briefly"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Detailed Description & Evidence
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide precise details, error messages, portfolio involved, and timestamps..."
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#123B70]"
                />
              </div>

              <div>
                <label className="block ucc-caption font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Supporting Evidence Attachment (Optional — PDF / Image up to 10 MB)
                </label>
                <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-dashed border-slate-300 hover:border-[#123B70] bg-slate-50 ucc-body-secondary text-slate-600 cursor-pointer">
                  <Paperclip className="w-4 h-4 text-[#123B70]" />
                  <span>
                    {attachmentFile
                      ? `${attachmentFile.name} (${formatNumber(Math.round(attachmentFile.size / 1024))} KB)`
                      : 'Attach screenshot or supporting PDF document'}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {uploadProgress !== null && (
                  <p className="ucc-caption tabular-nums text-[#123B70] mt-1">
                    Uploading to Firebase Storage: {formatPercentage(uploadProgress)}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl font-semibold ucc-btn text-white bg-[#C62828] hover:bg-red-700 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Ticket...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Formal Complaint Ticket</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tab 2: Track Status */}
      {activeTab === 'track' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <form onSubmit={handleTrackSearch} className="flex gap-2">
              <input
                type="text"
                value={searchTicket}
                onChange={(e) => setSearchTicket(e.target.value)}
                placeholder="Search your submitted ticket number"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono tabular-nums focus:outline-none focus:border-[#123B70]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#123B70] text-white ucc-btn font-semibold rounded-xl hover:bg-[#0B1F3A] cursor-pointer"
              >
                Track Ticket
              </button>
            </form>

            {searchedTicket && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono tabular-nums font-semibold ucc-caption text-[#123B70]">
                    {searchedTicket.ticketNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded ucc-caption font-semibold uppercase bg-emerald-100 text-emerald-800">
                    {searchedTicket.status}
                  </span>
                </div>
                <h4 className="ucc-body-secondary font-semibold text-slate-900">{searchedTicket.subject}</h4>
                <p className="ucc-body-secondary text-slate-600">{searchedTicket.description}</p>
                {searchedTicket.response && (
                  <div className="mt-2 p-2.5 bg-white rounded border border-slate-200 ucc-body-secondary text-slate-700">
                    <strong className="text-slate-900 font-semibold block mb-0.5">Commission Response:</strong>
                    {searchedTicket.response}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="ucc-heading-card text-slate-900">Your Submitted Tickets</h3>
            {complaints.length === 0 ? (
              <p className="ucc-body-secondary text-slate-500 py-6 text-center">
                No support tickets have been submitted yet.
              </p>
            ) : (
              <div className="space-y-3">
                {complaints.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between ucc-caption">
                      <span className="font-mono tabular-nums font-semibold text-[#123B70]">{c.ticketNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded ucc-caption font-semibold uppercase ${
                          c.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <h4 className="ucc-body-secondary font-semibold text-slate-900">{c.subject}</h4>
                    <p className="ucc-body-secondary text-slate-600">{c.description}</p>
                    {c.attachmentUrl && (
                      <a
                        href={c.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 ucc-caption font-semibold text-[#123B70] hover:underline"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>View Uploaded Attachment</span>
                      </a>
                    )}
                    {c.response && (
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 ucc-body-secondary text-slate-700 mt-2">
                        <span className="ucc-caption font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                          Commission Resolution
                        </span>
                        {c.response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Commission Contact Desk */}
      <div className="bg-[#0B1F3A] text-white p-6 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 shrink-0">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 ucc-caption uppercase font-semibold">Election Hotline</p>
            <p className="ucc-body-secondary font-semibold text-white tabular-nums mt-0.5">+233 3321 32440</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-sky-400 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 ucc-caption uppercase font-semibold">Email Desk</p>
            <p className="ucc-body-secondary font-semibold text-white mt-0.5">elections@ucc.edu.gh</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 ucc-caption uppercase font-semibold">Physical Secretariat</p>
            <p className="ucc-body-secondary font-semibold text-white mt-0.5">Students' Centre, Room 14</p>
          </div>
        </div>
      </div>
    </div>
  );
};
