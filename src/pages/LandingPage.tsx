import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Logo } from '../components/common/Logo';
import { 
  Vote, 
  ShieldCheck, 
  Lock, 
  Users, 
  Award, 
  CheckCircle, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  FileText
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { navigateTo, elections, userRole } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const activeElectionCount = elections.filter(e => e.status === 'live').length;

  const faqs = [
    {
      q: "How does UCC VOTE guarantee that my vote remains secret?",
      a: "UCC VOTE operates with cryptographic decoupling. When you authenticate using your student ID, the system validates your eligibility and marks that a ballot has been cast. The actual ballot selections are encrypted and recorded into a separate, unlinked ballot repository. Even system administrators and Electoral Commissioners cannot correlate a specific student to their candidate choices."
    },
    {
      q: "Can I vote from my smartphone outside campus or during clinical/teaching practice?",
      a: "Yes. UCC VOTE is accessible from anywhere in Ghana or abroad using any internet-connected smartphone, tablet, or laptop. Eligible distance, sandwich, and off-campus students can participate securely without travelling to campus."
    },
    {
      q: "What credentials do I need to log into the voting system?",
      a: "You will log in using your official UCC Student ID (e.g., PS/CSC/22/0089) and your portal password. New or unregistered students must first complete the 1-minute account activation process."
    },
    {
      q: "Can an administrator or candidate change or alter my vote after submission?",
      a: "No. Every ballot submission is stamped with a cryptographic hash and recorded in a tamper-evident audit ledger. Votes cannot be deleted, modified, or re-allocated once confirmed."
    },
    {
      q: "What should I do if my student record displays that I am ineligible to vote?",
      a: "You can submit an immediate eligibility review ticket through our Help & Support Complaint Centre or visit the UCC Electoral Commission desk at the Students' Centre."
    }
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* Hero Section */}
      <section
        aria-label="UCC VOTE Hero"
        className="relative w-full min-h-[540px] sm:min-h-[600px] lg:min-h-[650px] xl:min-h-[720px] flex items-center overflow-hidden bg-[#0B1F3A] bg-[url('/assets/aistudio/image_6f5614c6.png')] bg-cover bg-center bg-no-repeat text-white"
      >
        {/* Mobile dark navy overlay for full readability while preserving subject visibility */}
        <div
          aria-hidden="true"
          className="absolute inset-0 md:hidden pointer-events-none bg-[linear-gradient(180deg,rgba(11,31,58,0.76)_0%,rgba(18,59,112,0.82)_55%,rgba(11,31,58,0.94)_100%)]"
        />

        {/* Tablet/Desktop directional dark navy overlay: keeps left text high-contrast while students & ballot box remain bright and unobstructed */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(11,31,58,0.92)_0%,rgba(18,59,112,0.80)_36%,rgba(18,59,112,0.34)_62%,rgba(11,31,58,0.12)_100%)]"
        />

        {/* Subtle bottom contrast edge */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute inset-x-0 bottom-0 h-28 pointer-events-none bg-[linear-gradient(to_top,rgba(11,31,58,0.45)_0%,transparent_100%)]"
        />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20">
          <div className="max-w-xl lg:max-w-[540px] space-y-5 sm:space-y-6">
            <div className="flex items-center gap-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-sky-200">
              <span className="inline-block w-7 h-0.5 bg-[#C62828] shrink-0" aria-hidden="true" />
              <span>University of Cape Coast · Official E-Voting</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[3.35rem] font-black tracking-tight text-white leading-[1.08] text-balance drop-shadow-sm">
              YOUR VOICE. YOUR VOTE. YOUR UCC.
            </h1>

            <p className="text-base sm:text-lg text-slate-100 leading-relaxed max-w-lg drop-shadow-xs">
              Make your voice count. Participate in student elections, choose your leaders, and help shape the future of our university.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => navigateTo(userRole === 'student' ? 'student_dashboard' : 'student_register')}
                className="group min-h-[48px] px-7 py-3.5 text-sm sm:text-base font-bold text-white bg-[#C62828] hover:bg-[#A61E1E] rounded-xl transition-all duration-200 shadow-lg shadow-black/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => navigateTo('elections_directory')}
                className="min-h-[48px] px-7 py-3.5 text-sm sm:text-base font-bold text-white bg-white/10 hover:bg-white hover:text-[#123B70] border-2 border-white backdrop-blur-xs rounded-xl transition-all duration-200 shadow-md hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <Vote className="w-4 h-4" />
                <span>Explore Elections</span>
              </button>
            </div>

            {/* Key Institutional Trust Metrics */}
            <div className="pt-5 mt-2 border-t border-white/20 grid grid-cols-3 gap-4">
              <div>
                <p className="text-lg sm:text-2xl font-extrabold text-white font-mono tabular-nums">24,850+</p>
                <p className="text-slate-200 text-[11px] sm:text-xs mt-0.5">Eligible Student Voters</p>
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-extrabold text-amber-300 font-mono tabular-nums">{activeElectionCount} Live</p>
                <p className="text-slate-200 text-[11px] sm:text-xs mt-0.5">Active Polling Portals</p>
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-extrabold text-emerald-300 font-mono tabular-nums">100%</p>
                <p className="text-slate-200 text-[11px] sm:text-xs mt-0.5">Secret Ballot Secrecy</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Election Categories Strip */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Supported Election Categories
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              UCC VOTE supports university-wide governance from hall chambers to postgraduate councils.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              {
                title: "SRC Elections",
                desc: "Students' Representative Council general leadership for all undergraduates.",
                icon: Vote,
                badge: "University-Wide",
                id: "UCC-SRC-2026"
              },
              {
                title: "JCR & Hall Elections",
                desc: "Casely Hayford, Valco, Oguaa, Atlantic, Adehye & Nkrumah hall executives.",
                icon: Users,
                badge: "Hall Residents",
                id: "UCC-CAS-2026"
              },
              {
                title: "Departmental Elections",
                desc: "Computer Science (NACOS), Chemistry, Economics & departmental associations.",
                icon: FileText,
                badge: "Academic Units",
                id: "UCC-DCS-2026"
              },
              {
                title: "Faculty & School",
                desc: "School of Physical Sciences, Business, Arts, and Educational Foundations.",
                icon: Award,
                badge: "Faculties",
                id: "UCC-SPS-2026"
              },
              {
                title: "GRASAG Elections",
                desc: "Graduate Students Association of Ghana for Masters and PhD candidates.",
                icon: ShieldCheck,
                badge: "Postgraduate",
                id: "UCC-GRA-2025"
              }
            ].map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div 
                  key={idx}
                  onClick={() => navigateTo('elections_directory')}
                  className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#123B70]/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-[#EAF2FA] text-[#123B70] group-hover:bg-[#123B70] group-hover:text-white transition-colors flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-[#123B70] uppercase tracking-wider block">
                      {cat.badge}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1 group-hover:text-[#123B70] transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center text-xs font-semibold text-[#123B70]">
                    <span>Explore Category →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-[#F4F6F9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#C62828] uppercase tracking-wider">
              Simple 4-Step Process
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              How UCC Students Vote Online
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Designed so that any Cape Coast student can complete their ballot in under two minutes with zero technical friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Authenticate Student ID",
                desc: "Sign in with your verified UCC student identification number and secure portal credentials."
              },
              {
                step: "02",
                title: "Review Portfolios & Aspirants",
                desc: "Examine approved candidate biographies, leadership records, and campaign manifestos side-by-side."
              },
              {
                step: "03",
                title: "Cast Secret Electronic Ballot",
                desc: "Select your preferred candidate for each contested portfolio on our intuitive ballot card."
              },
              {
                step: "04",
                title: "Receive Cryptographic Receipt",
                desc: "Get an immutable confirmation token verifying your participation while preserving ballot confidentiality."
              }
            ].map((item, i) => (
              <div 
                key={i}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative"
              >
                <span className="text-3xl font-black text-slate-200 font-mono block mb-2">
                  {item.step}
                </span>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Secrecy Architecture Spotlight */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            <div className="lg:col-span-6 space-y-5">
              <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
                Cryptographic Ballot Integrity
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Separation of Voter Authentication and Ballot Secrecy
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Traditional electronic systems pose a risk when user credentials can be linked to ballot data. 
                UCC VOTE strictly implements the <strong>Two-Vault Architecture</strong>:
              </p>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Voter Eligibility Vault</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Confirms student registration and marks that a voter has participated to permanently prevent duplicate ballots.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-[#123B70] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Encrypted Ballot Repository</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Stores anonymous candidate choices with no foreign key or back-link to student identifiers.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 text-[#C62828] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Tamper-Evident Audit Trail</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Every administrative action, opening, and certified tally declaration is logged with immutable timestamps.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigateTo('help_support')}
                  className="text-xs font-bold text-[#123B70] hover:text-[#0B1F3A] flex items-center gap-1.5 cursor-pointer underline"
                >
                  <span>Learn about UCC Electoral Commission Security Guidelines</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Architecture diagram card */}
            <div className="lg:col-span-6">
              <div className="p-6 rounded-2xl bg-[#0B1F3A] text-white border border-slate-700 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <Logo variant="compact" theme="dark" showWordmark={false} />
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        About UCC VOTE · Security Protocol
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">ENCRYPTED</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Vault A: Identity</p>
                    <p className="font-bold text-white mt-1">Student Registry</p>
                    <p className="text-[11px] text-slate-300 mt-1">Status: Registered & Verified</p>
                    <div className="mt-2 text-[10px] text-emerald-400 font-mono">HAS_VOTED: TRUE</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Vault B: Ballot</p>
                    <p className="font-bold text-white mt-1">Anonymous Tally</p>
                    <p className="text-[11px] text-slate-300 mt-1">Candidate Selected: [Encrypted]</p>
                    <div className="mt-2 text-[10px] text-sky-400 font-mono">VOTER_ID: DECOUPLED</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                  <span>Audit Verification Checksum</span>
                  <span className="font-mono text-[10px] text-amber-300">SHA-256 / UCC-EC-CERTIFIED</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-16 bg-[#F4F6F9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-[#123B70] uppercase tracking-wider">
              Student Inquiries
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Everything you need to know about voting in University of Cape Coast elections.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm font-bold text-slate-900">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#123B70] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA Block */}
      <section className="py-16 bg-[#123B70] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Shape The Future Of University Of Cape Coast
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Ready to Make Your Vote Count?
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl mx-auto leading-relaxed">
            Log into your student account or activate your voter credentials to participate in the live 64th SRC General Elections.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4 pt-2">
            <button
              onClick={() => navigateTo('student_login')}
              className="px-6 py-3.5 text-sm font-bold text-[#123B70] bg-white hover:bg-slate-100 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Sign In with Student ID
            </button>
            <button
              onClick={() => navigateTo('student_register')}
              className="px-6 py-3.5 text-sm font-bold text-white bg-[#C62828] hover:bg-red-700 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Activate Voter Account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
