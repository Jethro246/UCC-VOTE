import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from './authRoutes.ts';
import { 
  STUDENT_ACCOUNTS, 
  ACTIVE_SESSIONS, 
  AUDIT_LOGS, 
  logAuditEvent,
  OFFICIAL_UCC_STUDENT_REGISTRY
} from './authStore.ts';
import type { StoredStudentAccount } from './authStore.ts';

export const adminRouter = Router();

// Strict Role-Based Access Control Middleware
export function requireAdminRole(allowedRoles?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

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
        error: 'Access Denied: Administrative authority required. Student role is strictly forbidden from accessing electoral administration endpoints.',
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
adminRouter.get('/overview', (req: Request, res: Response) => {
  const totalRegistered = Object.keys(OFFICIAL_UCC_STUDENT_REGISTRY).length;
  const activatedCount = STUDENT_ACCOUNTS.size;
  const activeSessionsCount = ACTIVE_SESSIONS.size;
  const suspendedCount = Array.from(STUDENT_ACCOUNTS.values()).filter(s => s.status === 'suspended').length;

  return res.json({
    success: true,
    stats: {
      totalRegistryStudents: totalRegistered,
      activatedStudentAccounts: activatedCount,
      activeSessions: activeSessionsCount,
      suspendedAccounts: suspendedCount,
      totalAuditEvents: AUDIT_LOGS.length
    }
  });
});

/**
 * GET /api/admin/students
 */
adminRouter.get('/students', (req: Request, res: Response) => {
  const students = Array.from(STUDENT_ACCOUNTS.values()).map(s => {
    const { passwordHash, passwordSalt, ...sanitized } = s;
    return sanitized;
  });

  return res.json({
    success: true,
    students
  });
});

/**
 * PUT /api/admin/students/:studentId/status
 * Administrative suspension or reinstatement
 */
adminRouter.put('/students/:studentId/status', (req: Request, res: Response) => {
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

  // If suspending, terminate all current active sessions for that student
  if (status === 'suspended') {
    for (const [token, sess] of ACTIVE_SESSIONS.entries()) {
      if (sess.userId === student.id) {
        ACTIVE_SESSIONS.delete(token);
      }
    }
  }

  logAuditEvent({
    eventType: 'STATUS_CHANGE',
    userId: session.userId,
    identifier: student.studentId,
    role: session.role,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    status: status === 'suspended' ? 'WARNING' : 'SUCCESS',
    details: `${session.role} changed status of ${student.fullName} (${student.studentId}) to ${status.toUpperCase()}. Reason: ${reason || 'Administrative review'}.`
  });

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
});

/**
 * GET /api/admin/audit-logs
 */
adminRouter.get('/audit-logs', (req: Request, res: Response) => {
  return res.json({
    success: true,
    logs: AUDIT_LOGS
  });
});
