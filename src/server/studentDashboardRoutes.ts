import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import { STUDENT_ACCOUNTS } from './authStore.ts';
import type { SessionData } from './authStore.ts';
import {
  ELECTIONS_STORE,
  POSITIONS_STORE,
  CANDIDATES_STORE,
  isElectionPublished,
  verifyStudentEligibility
} from './electionStore.ts';
import { DOMAINS_STORE, categoryToDomainId } from './domainStore.ts';
import { NOTIFICATIONS_STORE } from './notificationStore.ts';

export const studentDashboardRouter = Router();

// Re-export single authoritative eligibility checker for backwards compatibility
export const checkStudentEligibility = verifyStudentEligibility;

/**
 * GET /api/student/dashboard
 * Aggregates personalized real-time statistics, domain category cards, published eligible elections,
 * voting status, and dynamic announcements
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

  // Only published elections are visible to students (drafts & pending approvals are strictly excluded)
  const elections = Array.from(ELECTIONS_STORE.values()).filter((el) => isElectionPublished(el));
  const hasVotedList: string[] = studentAccount.hasVotedElections || [];
  const allApprovedCandidates = Array.from(CANDIDATES_STORE.values()).filter(
    (c) => c.applicationStatus === 'Approved'
  );

  const processedElections = elections.map((el) => {
    const { isEligible, reason } = verifyStudentEligibility(studentAccount, el);
    const hasVoted = hasVotedList.includes(el.id);
    const canVoteNow =
      isEligible && el.status === 'live' && !hasVoted && studentAccount.status === 'active';
    const positions = [...(POSITIONS_STORE.get(el.id) || [])].sort((a, b) => a.order - b.order);

    return {
      ...el,
      domainId: el.domainId || categoryToDomainId(el.category),
      studentEligibility: {
        isEligible,
        reason: reason || (isEligible ? 'Verified against DAA registry records' : 'Ineligible'),
        hasVoted,
        canVoteNow
      },
      positionsList: positions.map((p) => {
        const approvedCount = allApprovedCandidates.filter(
          (c) => c.electionId === el.id && c.positionId === p.id
        ).length;
        return {
          id: p.id,
          title: p.title,
          order: p.order,
          candidatesCount: approvedCount
        };
      })
    };
  });

  // Strict personalized election sections for the logged-in student
  const electionsAvailableToMe = processedElections.filter((e) => e.studentEligibility.isEligible);
  const activeElections = electionsAvailableToMe.filter((e) => e.status === 'live');
  const upcomingElections = electionsAvailableToMe.filter(
    (e) => e.status === 'upcoming' || e.status === 'scheduled'
  );
  const completedElections = electionsAvailableToMe.filter(
    (e) =>
      e.status === 'results_published' ||
      e.status === 'closed' ||
      e.status === 'results_pending_certification'
  );

  // Build personalized per-domain summary cards for all registered domains
  const domainsSummary = Array.from(DOMAINS_STORE.values())
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((dom) => {
      const domElections = processedElections.filter((e) => e.domainId === dom.id);
      const eligibleInDom = domElections.filter((e) => e.studentEligibility.isEligible);
      const activeInDom = eligibleInDom.filter((e) => e.status === 'live');
      const canVoteCount = eligibleInDom.filter((e) => e.studentEligibility.canVoteNow).length;
      const votedCount = eligibleInDom.filter((e) => e.studentEligibility.hasVoted).length;

      return {
        ...dom,
        totalElections: domElections.length,
        activeCount: activeInDom.length,
        upcomingCount: eligibleInDom.filter(
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

  // Dynamic announcements derived from live notifications & eligible published elections
  const eligibleDomainIds = new Set(electionsAvailableToMe.map((e) => e.domainId));
  const relevantNotifs = NOTIFICATIONS_STORE.filter(
    (n) => !n.domainId || eligibleDomainIds.has(n.domainId)
  ).slice(0, 4);

  const announcements =
    relevantNotifs.length > 0
      ? relevantNotifs.map((n) => ({
          id: n.id,
          title: n.title,
          category: n.category === 'results' ? 'Certified Results' : n.category === 'deadline' ? 'Polling Notice' : 'Official Notice',
          domainId: n.domainId,
          timestamp: n.timestamp,
          deadline:
            n.category === 'results'
              ? 'Published'
              : n.category === 'security'
              ? 'Security Bulletin'
              : 'Active Bulletin',
          summary: n.message,
          priority: n.category === 'deadline' ? 'high' : 'medium'
        }))
      : electionsAvailableToMe.slice(0, 3).map((el) => ({
          id: `dyn-${el.id}`,
          title: el.title,
          category: el.category,
          domainId: el.domainId,
          timestamp: el.updatedAt ? new Date(el.updatedAt).toLocaleDateString('en-GB') : 'Active',
          deadline: new Date(el.endDate).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'UTC'
          }),
          summary: el.description,
          priority: el.status === 'live' ? 'high' : 'medium'
        }));

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
        completedElections: completedElections.length
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
