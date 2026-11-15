import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { BrandedErrorBoundary } from './components/common/BrandedErrorBoundary';
import { Mail, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

// Page Views
import { LandingPage } from './pages/LandingPage';
import { StudentLoginPage } from './pages/auth/StudentLoginPage';
import { StudentRegisterPage } from './pages/auth/StudentRegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';

import { StudentDashboard } from './pages/dashboard/StudentDashboard';
import { ElectionsDirectoryPage } from './pages/elections/ElectionsDirectoryPage';
import { DomainElectionsPage } from './pages/elections/DomainElectionsPage';
import { ElectionDetailsPage } from './pages/elections/ElectionDetailsPage';
import { CandidateDirectoryPage } from './pages/candidates/CandidateDirectoryPage';
import { CandidateProfilePage } from './pages/candidates/CandidateProfilePage';
import { DigitalBallotPreviewPage } from './pages/voting/DigitalBallotPreviewPage';
import { ElectionResultsPage } from './pages/results/ElectionResultsPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { ElectionCalendarPage } from './pages/calendar/ElectionCalendarPage';
import { StudentProfilePage } from './pages/profile/StudentProfilePage';
import { HelpSupportPage } from './pages/support/HelpSupportPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';

const STUDENT_PROTECTED_VIEWS = new Set([
  'student_dashboard',
  'digital_ballot',
  'student_profile',
  'notifications',
]);

const EmailLinkVerificationOverlay: React.FC = () => {
  const {
    pendingEmailPrompt,
    emailLinkFeedback,
    submitEmailLinkPrompt,
    dismissEmailLinkPrompt,
    clearEmailLinkFeedback,
  } = useApp();

  const [emailInput, setEmailInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromptError(null);
    if (!emailInput.trim()) {
      setPromptError('Please enter the email address that received the sign-in link.');
      return;
    }
    setSubmitting(true);
    const res = await submitEmailLinkPrompt(emailInput.trim());
    setSubmitting(false);
    if (!res.success) {
      setPromptError(res.error || 'Could not verify email link.');
    }
  };

  return (
    <>
      {emailLinkFeedback && !pendingEmailPrompt && (
        <div
          className={`border-b px-4 py-2.5 text-xs ${
            emailLinkFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : emailLinkFeedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-[#C62828]'
              : 'bg-[#EAF2FA] border-[#123B70]/20 text-[#0B1F3A]'
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              {emailLinkFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : emailLinkFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-[#C62828] shrink-0" />
              ) : (
                <Mail className="w-4 h-4 text-[#123B70] shrink-0" />
              )}
              <span>{emailLinkFeedback.text}</span>
            </div>
            <button
              onClick={clearEmailLinkFeedback}
              className="p-1 rounded hover:bg-black/5 cursor-pointer"
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {pendingEmailPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#EAF2FA] text-[#123B70] flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirm Your Email Address
                  </h3>
                  <p className="text-xs text-slate-500">
                    Complete Firebase passwordless sign-in
                  </p>
                </div>
              </div>
              <button
                onClick={dismissEmailLinkPrompt}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You opened your UCC VOTE sign-in link in a new browser or device. Re-enter the email address where the link was sent to complete verification.
            </p>

            {promptError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C62828] font-medium">
                {promptError}
              </div>
            )}

            <form onSubmit={handleConfirm} className="space-y-3">
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#123B70]/20 focus:border-[#123B70] outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-[#123B70] hover:bg-[#0B1F3A] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Verifying...' : 'Confirm & Sign In'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const FirebaseStatusBanner: React.FC = () => {
  const { dataError } = useApp();
  const [dismissed, setDismissed] = useState(false);

  if (!dataError || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-950">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{dataError}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-black/5 cursor-pointer"
          aria-label="Dismiss Firebase notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { activeView, userRole, sessionChecked, navigateTo, setPostLoginView } = useApp();

  // Enforce client route guards once Firebase Auth session has been checked
  useEffect(() => {
    if (!sessionChecked) return;
    if (activeView === 'admin_dashboard' && userRole !== 'admin') {
      navigateTo('admin_login');
      return;
    }
    if (STUDENT_PROTECTED_VIEWS.has(activeView) && userRole === 'guest') {
      setPostLoginView(activeView);
      navigateTo('student_login');
    }
  }, [activeView, userRole, sessionChecked]);

  const renderActiveView = () => {
    switch (activeView) {
      case 'landing':
        return <LandingPage />;
      case 'student_login':
        return <StudentLoginPage />;
      case 'student_register':
        return <StudentRegisterPage />;
      case 'forgot_password':
        return <ForgotPasswordPage />;
      case 'admin_login':
        return <AdminLoginPage />;
      case 'student_dashboard':
        return <StudentDashboard />;
      case 'elections_directory':
        return <ElectionsDirectoryPage />;
      case 'domain_elections':
        return <DomainElectionsPage />;
      case 'election_details':
        return <ElectionDetailsPage />;
      case 'candidate_directory':
        return <CandidateDirectoryPage />;
      case 'candidate_profile':
        return <CandidateProfilePage />;
      case 'digital_ballot':
        return <DigitalBallotPreviewPage />;
      case 'election_results':
        return <ElectionResultsPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'election_calendar':
        return <ElectionCalendarPage />;
      case 'student_profile':
        return <StudentProfilePage />;
      case 'help_support':
        return <HelpSupportPage />;
      case 'admin_dashboard':
        return <AdminDashboard />;
      default:
        return <LandingPage />;
    }
  };

  if (activeView === 'landing') {
    return (
      <div className="flex flex-col">
        <FirebaseStatusBanner />
        <EmailLinkVerificationOverlay />
        <Navbar />
        <main>
          <LandingPage />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (
    activeView === 'student_login' ||
    activeView === 'student_register' ||
    activeView === 'forgot_password' ||
    activeView === 'admin_login'
  ) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F4F6F9]">
        <FirebaseStatusBanner />
        <EmailLinkVerificationOverlay />
        <Navbar />
        <main className="flex-1">{renderActiveView()}</main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9]">
      <FirebaseStatusBanner />
      <EmailLinkVerificationOverlay />
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {userRole !== 'guest' && <Sidebar isAdmin={userRole === 'admin'} />}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 pb-20 md:pb-8">
          {renderActiveView()}
        </main>
      </div>

      <BottomNav />
    </div>
  );
};

export default function App() {
  return (
    <BrandedErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </BrandedErrorBoundary>
  );
}
