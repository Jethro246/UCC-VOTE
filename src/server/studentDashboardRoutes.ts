import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import { 
  STUDENT_ACCOUNTS, 
  OFFICIAL_UCC_STUDENT_REGISTRY
} from './authStore.ts';
import type { SessionData } from './authStore.ts';
import { MOCK_NOTIFICATIONS } from '../data/mockData.ts';
import { ELECTIONS_STORE, POSITIONS_STORE, verifyStudentEligibility } from './electionStore.ts';
import type { Election } from '../types/index.ts';

export const studentDashboardRouter = Router();

// Helper to determine if a student is eligible for an election
export function checkStudentEligibility(student: any, election: Election): { isEligible: boolean; reason?: string } {
  if (student.status === 'suspended') {
    return { isEligible: false, reason: 'Your voter account has been administratively suspended.' };
  }

  const crit = election.eligibilityCriteria;
  if (!crit) return { isEligible: true };

  // Check levels
  if (crit.levels && crit.levels.length > 0) {
    if (!crit.levels.includes(student.level)) {
      return { isEligible: false, reason: `Requires academic level: ${crit.levels.join(', ')} (Your level: ${student.level})` };
    }
  }

  // Check faculties
  if (crit.faculties && crit.faculties.length > 0) {
    if (!crit.faculties.some((f: string) => student.faculty?.toLowerCase().includes(f.toLowerCase()))) {
      return { isEligible: false, reason: `Restricted to faculty: ${crit.faculties.join(', ')}` };
    }
  }

  // Check departments
  if (crit.departments && crit.departments.length > 0) {
    if (!crit.departments.some((d: string) => student.department?.toLowerCase().includes(d.toLowerCase()))) {
      return { isEligible: false, reason: `Restricted to department: ${crit.departments.join(', ')}` };
    }
  }

  // Check halls
  if (crit.halls && crit.halls.length > 0) {
    if (!crit.halls.some((h: string) => student.hall?.toLowerCase().includes(h.toLowerCase().split(' ')[0]))) {
      return { isEligible: false, reason: `Restricted to members/residents of ${crit.halls.join(', ')}` };
    }
  }

  return { isEligible: true };
}

/**
 * GET /api/student/dashboard
 * Aggregates personalized real-time statistics, elections, voting status, and announcements
 */
studentDashboardRouter.get('/dashboard', authenticateToken, (req: Request, res: Response) => {
  const session: SessionData = (req as any).session;
  
  // Find student in memory store
  let studentAccount: any;
  for (const s of STUDENT_ACCOUNTS.values()) {
    if (s.id === session.userId || s.studentId === session.userId) {
      studentAccount = s;
      break;
    }
  }

  // Fallback if demo session
  if (!studentAccount) {
    studentAccount = STUDENT_ACCOUNTS.get('PS/CSC/22/0089');
  }

  if (!studentAccount) {
    return res.status(404).json({ success: false, error: 'Student record not found.' });
  }

  const elections = Array.from(ELECTIONS_STORE.values());
  const hasVotedList: string[] = studentAccount.hasVotedElections || [];

  // Map each election with eligibility and voting status
  const processedElections = elections.map(el => {
    const { isEligible, reason } = verifyStudentEligibility(studentAccount, el);
    const hasVoted = hasVotedList.includes(el.id);
    const canVoteNow = isEligible && el.status === 'live' && !hasVoted && studentAccount.status === 'active';
    const positions = POSITIONS_STORE.get(el.id) || [];

    return {
      ...el,
      studentEligibility: {
        isEligible,
        reason: reason || (isEligible ? 'Verified against DAA registry records' : 'Ineligible'),
        hasVoted,
        canVoteNow
      },
      positionsList: positions.map(p => ({
        id: p.id,
        title: p.title,
        order: p.order,
        candidatesCount: p.candidateIds.length
      }))
    };
  });

  // Categorize sections
  const electionsAvailableToMe = processedElections.filter(e => e.studentEligibility.isEligible);
  const activeElections = processedElections.filter(e => e.status === 'live');
  const upcomingElections = processedElections.filter(e => e.status === 'upcoming');
  const completedElections = processedElections.filter(e => e.status === 'results_published' || e.status === 'closed');

  // Compute student voting status summary
  const completedVotesCount = electionsAvailableToMe.filter(e => e.studentEligibility.hasVoted).length;
  const pendingVotesCount = electionsAvailableToMe.filter(e => e.status === 'live' && !e.studentEligibility.hasVoted).length;
  const closedEligibleCount = electionsAvailableToMe.filter(e => e.status === 'results_published' || e.status === 'closed').length;

  // Real announcements
  const announcements = [
    {
      id: 'ann-1',
      title: '64th SRC General Elections: Digital Polling Closes at 17:00 GMT',
      category: 'Official Notice',
      timestamp: 'Today, 08:00 GMT',
      deadline: 'Tomorrow, 17:00 GMT',
      summary: 'All eligible undergraduate voters are urged to verify their ballot token before the official closing time. Extended polling kiosks are available at New Examination Centre and Students\' Centre.',
      priority: 'high'
    },
    {
      id: 'ann-2',
      title: 'Casely Hayford Hall (Casford) JCR Polling Underway',
      category: 'Hall Election',
      timestamp: 'Today, 09:00 GMT',
      deadline: 'Tomorrow, 16:00 GMT',
      summary: 'Voting for Casford Hall executive portfolios is active for all verified hall residents and affiliates.',
      priority: 'medium'
    },
    {
      id: 'ann-3',
      title: 'Department of Computer Science & IT (NACOS) Nominations Gazetted',
      category: 'Departmental',
      timestamp: 'Yesterday',
      deadline: 'Nov 18, 08:00 GMT',
      summary: 'Final vetting reports and aspirant manifestos for the 2026 NACOS executive elections are now available for review.',
      priority: 'info'
    },
    {
      id: 'ann-4',
      title: 'School of Physical Sciences (SPS-ESA) Presidential Debate Announced',
      category: 'Faculty Election',
      timestamp: 'Nov 8, 2026',
      deadline: 'Nov 15, 16:00 GMT',
      summary: 'The SPS Electoral Committee invites all physical science students to the Science Lecture Theatre 1 for the official manifesto presentation.',
      priority: 'info'
    }
  ];

  // Return full dashboard response
  return res.json({
    success: true,
    data: {
      student: {
        id: studentAccount.id,
        studentId: studentAccount.studentId,
        indexNumber: studentAccount.indexNumber,
        fullName: studentAccount.fullName,
        email: studentAccount.email,
        department: studentAccount.department,
        faculty: studentAccount.faculty,
        programme: studentAccount.programme,
        level: studentAccount.level,
        hall: studentAccount.hall,
        status: studentAccount.status,
        isEligible: studentAccount.isEligible && studentAccount.status === 'active',
        hasVotedElections: studentAccount.hasVotedElections
      },
      statistics: {
        availableElections: electionsAvailableToMe.length,
        activeElections: activeElections.length,
        upcomingElections: upcomingElections.length,
        completedElections: completedElections.length,
        isDemoData: true // Clearly identifies demonstration figures
      },
      votingStatus: {
        totalEligible: electionsAvailableToMe.length,
        completedVotesCount,
        pendingVotesCount,
        closedEligibleCount,
        statusLabel: studentAccount.status === 'suspended' ? 'SUSPENDED' : pendingVotesCount > 0 ? 'BALLOT_AWAITING_ACTION' : 'ALL_CAUGHT_UP'
      },
      sections: {
        availableToMe: electionsAvailableToMe,
        active: activeElections,
        upcoming: upcomingElections,
        completed: completedElections
      },
      announcements
    }
  });
});
