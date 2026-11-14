import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import { STUDENT_ACCOUNTS } from './authStore.ts';
import type { SessionData } from './authStore.ts';
import { ELECTIONS_STORE, POSITIONS_STORE, verifyStudentEligibility } from './electionStore.ts';
import { DOMAINS_STORE, categoryToDomainId } from './domainStore.ts';

export const studentDashboardRouter = Router();

// Re-export single authoritative eligibility checker for backwards compatibility
export const checkStudentEligibility = verifyStudentEligibility;

/**
 * GET /api/student/dashboard
 * Aggregates personalized real-time statistics, domain category cards, elections,
 * voting status, and announcements
 */
studentDashboardRouter.get('/dashboard', authenticateToken, (req: Request, res: Response) => {
  const session: SessionData = (req as any).session;

  if (!session || session.userType !== 'student') {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_ROLE_NOT_STUDENT',
      error: 'Student voter dashboard requires an authenticated student account.'
    });
  }

  let studentAccount: any;
  for (const s of STUDENT_ACCOUNTS.values()) {
    if (s.id === session.userId || s.studentId === session.userId) {
      studentAccount = s;
      break;
    }
  }

  if (!studentAccount) {
    return res.status(404).json({
      success: false,
      code: 'STUDENT_NOT_FOUND',
      error: 'Student record not found.'
    });
  }

  const elections = Array.from(ELECTIONS_STORE.values());
  const hasVotedList: string[] = studentAccount.hasVotedElections || [];

  const processedElections = elections.map((el) => {
    const { isEligible, reason } = verifyStudentEligibility(studentAccount, el);
    const hasVoted = hasVotedList.includes(el.id);
    const canVoteNow =
      isEligible && el.status === 'live' && !hasVoted && studentAccount.status === 'active';
    const positions = POSITIONS_STORE.get(el.id) || [];

    return {
      ...el,
      domainId: el.domainId || categoryToDomainId(el.category),
      studentEligibility: {
        isEligible,
        reason: reason || (isEligible ? 'Verified against DAA registry records' : 'Ineligible'),
        hasVoted,
        canVoteNow
      },
      positionsList: positions.map((p) => ({
        id: p.id,
        title: p.title,
        order: p.order,
        candidatesCount: p.candidateIds.length
      }))
    };
  });

  const electionsAvailableToMe = processedElections.filter((e) => e.studentEligibility.isEligible);
  const activeElections = processedElections.filter((e) => e.status === 'live');
  const upcomingElections = processedElections.filter(
    (e) => e.status === 'upcoming' || e.status === 'scheduled'
  );
  const completedElections = processedElections.filter(
    (e) => e.status === 'results_published' || e.status === 'closed'
  );

  // Build personalized per-domain summary cards for all registered domains
  const domainsSummary = Array.from(DOMAINS_STORE.values())
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((dom) => {
      const domElections = processedElections.filter((e) => e.domainId === dom.id);
      const eligibleInDom = domElections.filter((e) => e.studentEligibility.isEligible);
      const activeInDom = domElections.filter((e) => e.status === 'live');
      const canVoteCount = domElections.filter((e) => e.studentEligibility.canVoteNow).length;
      const votedCount = domElections.filter((e) => e.studentEligibility.hasVoted).length;

      return {
        ...dom,
        totalElections: domElections.length,
        activeCount: activeInDom.length,
        upcomingCount: domElections.filter(
          (e) => e.status === 'upcoming' || e.status === 'scheduled'
        ).length,
        eligibleCount: eligibleInDom.length,
        canVoteCount,
        votedCount
      };
    });

  const completedVotesCount = electionsAvailableToMe.filter(
    (e) => e.studentEligibility.hasVoted
  ).length;
  const pendingVotesCount = electionsAvailableToMe.filter(
    (e) => e.status === 'live' && !e.studentEligibility.hasVoted
  ).length;
  const closedEligibleCount = electionsAvailableToMe.filter(
    (e) => e.status === 'results_published' || e.status === 'closed'
  ).length;

  const announcements = [
    {
      id: 'ann-1',
      title: '64th SRC General Elections: Digital Polling Closes at 17:00 GMT',
      category: 'Official Notice',
      domainId: 'src',
      timestamp: 'Today, 08:00 GMT',
      deadline: 'Nov 25, 17:00 GMT',
      summary:
        'All eligible undergraduate voters are urged to verify their ballot token before the official closing time.',
      priority: 'high'
    },
    {
      id: 'ann-2',
      title: 'JCRC / Hall Polling Underway: Casford & Adehye Halls',
      category: 'Hall Election',
      domainId: 'jcrc_hall',
      timestamp: 'Today, 09:00 GMT',
      deadline: 'Nov 25, 16:00 GMT',
      summary:
        'Voting for participating residential hall JCRC executive portfolios is active for verified hall residents and affiliates.',
      priority: 'medium'
    },
    {
      id: 'ann-5',
      title: 'GRASAG-UCC 2026 & Local NUGS Polls Open',
      category: 'Union & Postgraduate',
      domainId: 'grasag',
      timestamp: 'Today, 08:30 GMT',
      deadline: 'Nov 26, 18:00 GMT',
      summary:
        'Postgraduate students may cast independent GRASAG ballots, and active students may participate in Local NUGS elections.',
      priority: 'medium'
    },
    {
      id: 'ann-3',
      title: 'Department of Computer Science & IT (NACOS) Nominations Gazetted',
      category: 'Departmental',
      domainId: 'departmental',
      timestamp: 'Yesterday',
      deadline: 'Nov 18, 08:00 GMT',
      summary:
        'Final vetting reports and aspirant manifestos for the 2026 NACOS executive elections are now available for review.',
      priority: 'info'
    }
  ];

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
        isDemoData: true
      },
      votingStatus: {
        totalEligible: electionsAvailableToMe.length,
        completedVotesCount,
        pendingVotesCount,
        closedEligibleCount,
        statusLabel:
          studentAccount.status === 'suspended'
            ? 'SUSPENDED'
            : pendingVotesCount > 0
            ? 'BALLOT_AWAITING_ACTION'
            : 'ALL_CAUGHT_UP'
      },
      domainsSummary,
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
