import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { DemoNotice } from './components/common/DemoNotice';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';

// Page Views
import { LandingPage } from './pages/LandingPage';
import { StudentLoginPage } from './pages/auth/StudentLoginPage';
import { StudentRegisterPage } from './pages/auth/StudentRegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';

import { StudentDashboard } from './pages/dashboard/StudentDashboard';
import { ElectionsDirectoryPage } from './pages/elections/ElectionsDirectoryPage';
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

const AppContent: React.FC = () => {
  const { activeView, userRole } = useApp();

  const isPortalLayout = 
    activeView === 'student_dashboard' || 
    activeView === 'admin_dashboard' || 
    activeView === 'student_profile' ||
    userRole !== 'guest';

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

  // If in pure public landing page
  if (activeView === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-[#F4F6F9]">
        <DemoNotice />
        <Navbar />
        <main className="flex-1">
          <LandingPage />
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  // If in auth pages (login, register, forgot, admin login)
  if (
    activeView === 'student_login' || 
    activeView === 'student_register' || 
    activeView === 'forgot_password' || 
    activeView === 'admin_login'
  ) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F4F6F9]">
        <DemoNotice />
        <Navbar />
        <main className="flex-1">
          {renderActiveView()}
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  // If in student portal or admin portal or directories
  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9]">
      <DemoNotice />
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Sidebar for Desktop when logged in */}
        {userRole !== 'guest' && (
          <Sidebar isAdmin={userRole === 'admin'} />
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 pb-20 md:pb-8">
          {renderActiveView()}
        </main>
      </div>

      <Footer />
      <BottomNav />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
