import React from 'react';
import { useApp } from '../context/AppContext';
import { Vote, ArrowRight } from 'lucide-react';
import { PWAInstallBanner } from '../components/common/PWAInstallButton';

export const LandingPage: React.FC = () => {
  const { navigateTo, userRole } = useApp();

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section
        aria-label="UCC VOTE Hero"
        className="relative w-full min-h-[540px] sm:min-h-[600px] lg:min-h-[650px] xl:min-h-[720px] flex items-center overflow-hidden bg-[#0B1F3A] bg-[url('/assets/aistudio/jet_04926c53.jpg')] bg-cover bg-[56%_35%] md:bg-center bg-no-repeat text-white"
      >
        {/* Mobile subtle navy-blue overlay for crisp text readability while keeping voter, Ghana flag & ballot box clearly visible */}
        <div
          aria-hidden="true"
          className="absolute inset-0 md:hidden pointer-events-none bg-[linear-gradient(180deg,rgba(11,31,58,0.68)_0%,rgba(18,59,112,0.74)_55%,rgba(11,31,58,0.86)_100%)]"
        />

        {/* Tablet/Desktop directional navy-blue overlay: keeps left text high-contrast while citizen, Ghana flag & ballot box remain bright and unobstructed */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(11,31,58,0.92)_0%,rgba(18,59,112,0.78)_36%,rgba(18,59,112,0.28)_62%,rgba(11,31,58,0.08)_100%)]"
        />

        {/* Subtle bottom contrast edge */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-[linear-gradient(to_top,rgba(11,31,58,0.35)_0%,transparent_100%)]"
        />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20">
          <div className="max-w-xl lg:max-w-[540px] space-y-5 sm:space-y-6">
            <div className="flex items-center gap-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-sky-200">
              <span className="inline-block w-7 h-0.5 bg-[#C62828] shrink-0" aria-hidden="true" />
              <span>University of Cape Coast · Official E-Voting</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[3.35rem] font-black tracking-tight text-white leading-[1.08] text-balance drop-shadow-sm">
              YOUR VOTE. YOUR POWER.
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
          </div>
        </div>
      </section>
      <PWAInstallBanner />
    </div>
  );
};
