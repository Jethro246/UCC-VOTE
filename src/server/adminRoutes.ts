import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from './authRoutes.ts';
import {
  STUDENT_ACCOUNTS,
  ADMIN_ACCOUNTS,
  ACTIVE_SESSIONS,
  AUDIT_LOGS,
  logAuditEvent,
  OFFICIAL_UCC_STUDENT_REGISTRY,
  getRegisteredAndVerifiedStudentCounts,
  revokeUserSessions
} from './authStore.ts';
import type { StoredAdminAccount, SessionData } from './authStore.ts';
import { hashPassword } from './cryptoUtils.ts';
import { matchesHallName, normalizeText, categoryToDomainId } from './domainStore.ts';
import {
  ELECTIONS_STORE,
  CANDIDATES_STORE,
  recomputeAllElectionCounts
} from './electionStore.ts';
import { ANONYMOUS_BALLOT_VAULT, VOTER_PARTICIPATION_VAULT } from './votingStore.ts';
import { persistPlatformState } from './statePersistence.ts';
import { broadcastSyncEvent } from './realtimeBus.ts';
import type { AdminOverviewStats, AdminRoleType, DomainId, Election } from '../types/index.ts';

export const adminRouter = Router();

export const GLOBAL_ADMIN_ROLES: AdminRoleType[] = [
  'Super Administrator',
  'Electoral Commissioner'
];

export const ALL_MANAGING_ADMIN_ROLES: AdminRoleType[] = [
  'Super Administrator',
  'Electoral Commissioner',
  'SRC Election Administrator',
  'Hall Election Administrator',
  'GRASAG Election Administrator',
  'Local NUGS Election Administrator',
  'Departmental Election Administrator',
  'Faculty/School Election Administrator'
];

export function resolveAdminFromSession(session?: SessionData): StoredAdminAccount | undefined {
  if (!session || session.userType !== 'admin') return undefined;
  for (const admin of ADMIN_ACCOUNTS.values()) {
    if (admin.id === session.userId || admin.staffId === session.userId) {
      return admin;
    }
  }
  return undefined;
}

export function isGlobalGovernanceRole(role?: string): boolean {
  return role === 'Super Administrator' || role === 'Electoral Commissioner';
}

/**
 * Checks whether an authenticated admin session has permission to manage a given domain and optional subdomain unit
 */
export function canAdminAccessDomain(
  session: SessionData | undefined,
  domainId: DomainId,
  subScope?: { hall?: string; faculty?: string; department?: string }
): { allowed: boolean; reason?: string } {
  if (!session || session.userType !== 'admin') {
    return { allowed: false, reason: 'Administrative authentication required.' };
  }

  const admin = resolveAdminFromSession(session);
  const role = admin?.role || session.role;

  // Super Admin and Electoral Commissioner have global domain oversight
  if (isGlobalGovernanceRole(role)) {
    return { allowed: true };
  }

  // Returning Officer & Results Auditor are read/verification-audit roles, NOT domain election creators/vetters
  if (role === 'Returning Officer' || role === 'Results Auditor') {
    return {
      allowed: false,
      reason: `Role '${role}' is limited to ballot verification & results auditing and cannot modify domain elections or nominations.`
    };
  }

  const managedDomains = admin?.managedDomainIds || session.managedDomainIds || [];
  if (!managedDomains.includes(domainId)) {
    return {
      allowed: false,
      reason: `Access Denied: Your role (${role}) is not authorized to administer the '${domainId}' election domain.`
    };
  }

  // Subdomain granularity checks
  if (domainId === 'jcrc_hall' && subScope?.hall) {
    const halls = admin?.managedHalls || session.managedHalls || [];
    if (halls.length > 0 && !halls.some((h) => matchesHallName(h, subScope.hall))) {
      return {
        allowed: false,
        reason: `Access Denied: Hall administrator clearance is limited to [${halls.join(', ')}]. Cannot manage '${subScope.hall}'.`
      };
    }
  }

  if (domainId === 'departmental' && subScope?.department) {
    const depts = admin?.managedDepartments || session.managedDepartments || [];
    if (
      depts.length > 0 &&
      !depts.some((d) => normalizeText(d) === normalizeText(subScope.department) || normalizeText(subScope.department!).includes(normalizeText(d)))
    ) {
      return {
        allowed: false,
        reason: `Access Denied: Departmental administrator clearance is limited to [${depts.join(', ')}]. Cannot manage '${subScope.department}'.`
      };
    }
  }

  if (domainId === 'faculty_school' && subScope?.faculty) {
    const facs = admin?.managedFaculties || session.managedFaculties || [];
    if (
      facs.length > 0 &&
      !facs.some((f) => normalizeText(f) === normalizeText(subScope.faculty) || normalizeText(subScope.faculty!).includes(normalizeText(f)))
    ) {
      return {
        allowed: false,
        reason: `Access Denied: Faculty/School administrator clearance is limited to [${facs.join(', ')}]. Cannot manage '${subScope.faculty}'.`
      };
    }
  }

  return { allowed: true };
}

/**
 * Checks whether an authenticated admin session may manage, vet candidates for, or oversee a specific Election
 */
export function canAdminManageElection(
  session: SessionData | undefined,
  election: Election,
  options?: { allowAuditorRead?: boolean }
): { allowed: boolean; reason?: string } {
  if (!session || session.userType !== 'admin') {
    return { allowed: false, reason: 'Administrative authentication required.' };
  }

  const admin = resolveAdminFromSession(session);
  const role = admin?.role || session.role;

  if (isGlobalGovernanceRole(role)) {
    return { allowed: true };
  }

  if (options?.allowAuditorRead && (role === 'Returning Officer' || role === 'Results Auditor')) {
    return { allowed: true };
  }

  const domId = election.domainId || categoryToDomainId(election.category);
  const crit = election.eligibilityCriteria || {};

  return canAdminAccessDomain(session, domId, {
    hall: crit.halls?.[0] || election.subdomainLabel,
    faculty: crit.faculties?.[0] || election.subdomainLabel,
    department: crit.departments?.[0] || election.subdomainLabel
  });
}

// Strict Role-Based Access Control Middleware
export function requireAdminRole(allowedRoles?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session as SessionData | undefined;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!session) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (session.userType === 'student') {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: session.userId,
        role: 'Student',
        ipAddress,
        status: 'FLAGGED',
        details: `FORBIDDEN ACCESS ATTEMPT: Student ${session.userId} attempted to call protected route ${req.originalUrl}.`
      });

      return res.status(403).json({
        success: false,
        error:
          'Access Denied: Administrative authority required. Student role is strictly forbidden from accessing electoral administration endpoints.',
        attemptedEndpoint: req.originalUrl,
        userRole: 'Student'
      });
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: session.userId,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Insufficient permissions: ${session.role} attempted to access restricted route requiring [${allowedRoles.join(', ')}].`
      });

      return res.status(403).json({
        success: false,
        error: `Insufficient administrative clearance. Required roles: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
}

// All admin routes must authenticate and require admin role
adminRouter.use(authenticateToken);
adminRouter.use(requireAdminRole());

/**
 * GET /api/admin/overview
 */
adminRouter.get('/overview', (_req: Request, res: Response) => {
  const {
    totalRegistryStudents,
    activatedStudentAccounts,
    registeredStudents,
    verifiedStudents,
    suspendedAccounts
  } = getRegisteredAndVerifiedStudentCounts();

  const elections = Array.from(ELECTIONS_STORE.values());
  const candidates = Array.from(CANDIDATES_STORE.values());
  const uniqueVoters = new Set(
    Array.from(VOTER_PARTICIPATION_VAULT.values()).map((v) => v.studentAccountId)
  );
  const uniqueVotersVoted = uniqueVoters.size;
  const totalVotesCast = ANONYMOUS_BALLOT_VAULT.length;

  const stats: AdminOverviewStats = {
    totalElections: elections.length,
    activeElections: elections.filter((e) => e.status === 'live').length,
    upcomingElections: elections.filter(
      (e) => e.status === 'scheduled' || e.status === 'upcoming'
    ).length,
    closedElections: elections.filter(
      (e) =>
        e.status === 'closed' ||
        e.status === 'results_pending_certification' ||
        e.status === 'results_published'
    ).length,
    publishedResultsCount: elections.filter((e) => e.status === 'results_published').length,
    draftElections: elections.filter(
      (e) => e.status === 'draft' || e.status === 'pending_approval'
    ).length,
    totalCandidates: candidates.length,
    approvedCandidates: candidates.filter((c) => c.applicationStatus === 'Approved').length,
    pendingCandidates: candidates.filter(
      (c) => c.applicationStatus === 'Submitted' || c.applicationStatus === 'Under review'
    ).length,
    registeredStudents,
    verifiedStudents,
    totalRegistryStudents,
    activatedStudentAccounts,
    suspendedAccounts,
    totalVotesCast,
    uniqueVotersVoted,
    overallTurnoutPercentage:
      verifiedStudents > 0
        ? Math.round((uniqueVotersVoted / verifiedStudents) * 1000) / 10
        : 0,
    activeSessions: ACTIVE_SESSIONS.size,
    totalAuditEvents: AUDIT_LOGS.length
  };

  return res.json({
    success: true,
    stats
  });
});

/**
 * GET /api/admin/students
 */
adminRouter.get('/students', (req: Request, res: Response) => {
  const { hall, faculty, department, level } = req.query;
  let students = Array.from(STUDENT_ACCOUNTS.values()).map((s) => {
    const { passwordHash: _ph, passwordSalt: _ps, ...sanitized } = s;
    return sanitized;
  });

  if (hall && typeof hall === 'string' && hall !== 'All') {
    students = students.filter((s) => matchesHallName(s.hall, hall));
  }
  if (faculty && typeof faculty === 'string' && faculty !== 'All') {
    students = students.filter((s) => s.faculty.toLowerCase().includes(faculty.toLowerCase()));
  }
  if (department && typeof department === 'string' && department !== 'All') {
    students = students.filter((s) => s.department.toLowerCase().includes(department.toLowerCase()));
  }
  if (level && typeof level === 'string' && level !== 'All') {
    students = students.filter((s) => s.level === level);
  }

  return res.json({
    success: true,
    students
  });
});

/**
 * PUT /api/admin/students/:studentId/status
 * Administrative suspension or reinstatement (Global admin / EC only)
 */
adminRouter.put(
  '/students/:studentId/status',
  requireAdminRole(['Super Administrator', 'Electoral Commissioner']),
  (req: Request, res: Response) => {
    const { studentId } = req.params;
    const { status, reason } = req.body;
    const session = (req as any).session;

    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be "active" or "suspended".' });
    }

    const student = STUDENT_ACCOUNTS.get(decodeURIComponent(studentId));
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student account not found.' });
    }

    student.status = status;
    student.isEligible = status === 'active';

    // If suspending, terminate all current active & refresh sessions for that student
    if (status === 'suspended') {
      revokeUserSessions(student.id);
    }

    logAuditEvent({
      eventType: 'STATUS_CHANGE',
      userId: session.userId,
      identifier: student.studentId,
      role: session.role,
      ipAddress:
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      status: status === 'suspended' ? 'WARNING' : 'SUCCESS',
      details: `${session.role} changed status of ${student.fullName} (${student.studentId}) to ${status.toUpperCase()}. Reason: ${reason || 'Administrative review'}.`
    });

    recomputeAllElectionCounts();
    persistPlatformState();
    broadcastSyncEvent('student:status');

    return res.json({
      success: true,
      message: `Student account status updated to ${status}.`,
      student: {
        studentId: student.studentId,
        fullName: student.fullName,
        status: student.status,
        isEligible: student.isEligible
      }
    });
  }
);

/**
 * GET /api/admin/admins
 * Lists registered electoral administration officials and their domain scopes
 */
adminRouter.get('/admins', (req: Request, res: Response) => {
  const admins = Array.from(ADMIN_ACCOUNTS.values()).map((a) => {
    const { passwordHash: _ph, passwordSalt: _ps, ...sanitized } = a;
    return sanitized;
  });

  return res.json({
    success: true,
    admins
  });
});

/**
 * POST /api/admin/admins
 * Super Administrator creates or assigns a new Domain-Scoped Election Administrator
 */
adminRouter.post(
  '/admins',
  requireAdminRole(['Super Administrator']),
  (req: Request, res: Response) => {
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const {
      staffId,
      fullName,
      email,
      role,
      department,
      managedDomainIds,
      managedHalls,
      managedFaculties,
      managedDepartments,
      password
    } = req.body || {};

    if (!staffId || !fullName || !role) {
      return res.status(400).json({
        success: false,
        error: 'Staff ID, full name, and administrative role are required.'
      });
    }

    const cleanId = staffId.trim();
    if (ADMIN_ACCOUNTS.has(cleanId)) {
      return res.status(409).json({
        success: false,
        error: `Staff ID '${cleanId}' already exists.`
      });
    }

    const pwd = hashPassword(password || 'Admin@UCC2026');
    const newAdmin: StoredAdminAccount = {
      id: `adm-${Date.now().toString().slice(-5)}`,
      staffId: cleanId,
      fullName: fullName.trim(),
      email: (email || `${cleanId.toLowerCase().replace(/[^a-z0-9]/g, '.')}@ucc.edu.gh`).trim(),
      role: role as AdminRoleType,
      department: (department || 'University Electoral Directorate').trim(),
      permissions: ['manage_domain_elections', 'manage_positions', 'vet_candidates', 'view_domain_results'],
      managedDomainIds: Array.isArray(managedDomainIds) ? managedDomainIds : [],
      managedHalls: Array.isArray(managedHalls) ? managedHalls : [],
      managedFaculties: Array.isArray(managedFaculties) ? managedFaculties : [],
      managedDepartments: Array.isArray(managedDepartments) ? managedDepartments : [],
      passwordHash: pwd.hash,
      passwordSalt: pwd.salt,
      status: 'active'
    };

    ADMIN_ACCOUNTS.set(cleanId, newAdmin);

    logAuditEvent({
      eventType: 'UPDATE_ADMIN_SCOPE',
      userId: session.userId,
      identifier: cleanId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Super Administrator created/assigned ${role} (${fullName}) for domains [${(newAdmin.managedDomainIds || []).join(', ')}].`
    });

    persistPlatformState();

    const { passwordHash: _ph, passwordSalt: _ps, ...sanitized } = newAdmin;
    return res.status(201).json({
      success: true,
      message: `Administrator '${newAdmin.fullName}' assigned successfully.`,
      admin: sanitized
    });
  }
);

/**
 * PUT /api/admin/admins/:staffId/scope
 * Super Administrator updates an existing admin's domain/subdomain scope
 */
adminRouter.put(
  '/admins/:staffId/scope',
  requireAdminRole(['Super Administrator']),
  (req: Request, res: Response) => {
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const cleanStaffId = decodeURIComponent(req.params.staffId);
    const admin = ADMIN_ACCOUNTS.get(cleanStaffId);

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Administrator account not found.' });
    }

    const { role, managedDomainIds, managedHalls, managedFaculties, managedDepartments, status } =
      req.body || {};

    if (role) admin.role = role;
    if (Array.isArray(managedDomainIds)) admin.managedDomainIds = managedDomainIds;
    if (Array.isArray(managedHalls)) admin.managedHalls = managedHalls;
    if (Array.isArray(managedFaculties)) admin.managedFaculties = managedFaculties;
    if (Array.isArray(managedDepartments)) admin.managedDepartments = managedDepartments;
    if (status && ['active', 'suspended'].includes(status)) admin.status = status;

    ADMIN_ACCOUNTS.set(cleanStaffId, admin);

    logAuditEvent({
      eventType: 'UPDATE_ADMIN_SCOPE',
      userId: session.userId,
      identifier: cleanStaffId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Updated domain scope for ${admin.fullName} (${cleanStaffId}) to domains [${(admin.managedDomainIds || []).join(', ')}].`
    });

    persistPlatformState();

    const { passwordHash: _ph, passwordSalt: _ps, ...sanitized } = admin;
    return res.json({
      success: true,
      message: `Updated domain assignment for ${admin.fullName}.`,
      admin: sanitized
    });
  }
);

/**
 * GET /api/admin/audit-logs
 */
adminRouter.get('/audit-logs', (req: Request, res: Response) => {
  return res.json({
    success: true,
    logs: AUDIT_LOGS
  });
});
