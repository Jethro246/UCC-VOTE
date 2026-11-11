import React from 'react';
import { useApp } from '../../context/AppContext';
import { BrandHeader } from '../common/BrandHeader';
import { Shield, Phone, Mail, MapPin, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigateTo } = useApp();

  return (
    <footer className="bg-[#0B1F3A] text-slate-300 pt-12 pb-16 md:pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800">
          {/* Col 1: Brand & Identity */}
          <div className="space-y-4">
            <BrandHeader size="lg" white />
            <p className="text-xs text-slate-400 leading-relaxed">
              The official electronic voting platform of the University of Cape Coast, Ghana. 
              Engineered to guarantee voter eligibility, ballot secrecy, and transparent election audits.
            </p>
            <div className="pt-1">
              <span className="inline-block text-[11px] font-bold tracking-widest text-amber-400 uppercase">
                YOUR VOICE. YOUR VOTE. YOUR UCC.
              </span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Platform Directory
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button 
                  onClick={() => navigateTo('elections_directory')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Active & Upcoming Elections
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateTo('candidate_directory')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Candidates & Manifestos
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateTo('digital_ballot')} 
                  className="hover:text-white transition-colors cursor-pointer text-amber-400 font-medium"
                >
                  Digital Ballot Portal
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateTo('election_results')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Certified Election Results
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateTo('election_calendar')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Electoral Academic Calendar
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Institutional Security */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Integrity & Compliance
            </h4>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Cryptographic decoupling ensures voter identity is never bound to ballot selections.
                </span>
              </div>
              <p>
                Compliance with Ghana Data Protection Act, 2012 (Act 843) and UCC Electoral Regulations.
              </p>
              <div>
                <button
                  onClick={() => navigateTo('help_support')}
                  className="text-sky-400 hover:text-sky-300 text-xs font-medium underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Submit Election Irregularity Report</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Col 4: Contact & Secretariat */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Electoral Secretariat
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>UCC Electoral Commission, Students\' Centre, University of Cape Coast, Cape Coast, Ghana</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>+233 (0) 3321 32440 / 32480</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>elections@ucc.edu.gh</span>
              </li>
              <li className="pt-1">
                <button
                  onClick={() => navigateTo('admin_login')}
                  className="text-slate-400 hover:text-amber-400 text-[11px] font-mono transition-colors cursor-pointer"
                >
                  → Commissioner & Officer Portal Login
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} University of Cape Coast, Ghana. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>UCC Directorate of ICT (DoICT)</span>
            <span>·</span>
            <span>Dean of Students Affairs</span>
            <span>·</span>
            <span>Electoral Commission</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
