/**
 * TEMPORARY FRONTEND-ONLY AUTHENTICATION CLIENT
 *
 * Implements IAuthService using temporary browser memory and localStorage
 * for demonstration purposes only. Does NOT connect to any backend server,
 * does NOT perform real cryptographic authentication, and is NOT production-ready.
 *
 * Replace the method bodies with real backend API calls when connecting a backend.
 */

import type { StudentProfile, AdminProfile, AdminRoleType } from '../types';
import {
  evaluateTempStudentEligibility,
  getPermissionsForRole
} from '../data/temporaryMockRegistry';
import type { TempDemoStudentAccount } from '../data/temporaryMockRegistry';
import { mockStateStore } from './mockStateStore';
import type { AuthResponse, IAuthService } from './interfaces';

export type { AuthResponse } from './interfaces';

export type SessionEvent =
  | { type: 'updated'; user: any; role: 'student' | 'admin'; token: string }
  | { type: 'refreshed'; user: any; role: 'student' | 'admin'; token: string }
  | { type: 'expired'; reason: string }
  | { type: 'cleared' };

type SessionListener = (event: SessionEvent) => void;

const TOKEN_KEY = 'ucc_vote_demo_token';
const REFRESH_TOKEN_KEY = 'ucc_vote_demo_refresh_token';
const USER_KEY = 'ucc_vote_demo_user';
const ROLE_KEY = 'ucc_vote_demo_role';

const listeners = new Set<SessionListener>();

function notifyListeners(event: SessionEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // ignore subscriber errors
    }
  });
}

function sanitizeStudent(account: TempDemoStudentAccount): StudentProfile {
  const { demoPassword: _pwd, ...rest } = account;
  return {
    ...rest,
    isDemoAccount: true
  };
}

function sanitizeAdmin(account: any): AdminProfile {
  const { demoPassword: _pwd, ...rest } = account;
  return {
    ...rest,
    isDemoAccount: true
  };
}

class FrontendDemoAuthService implements IAuthService {
  subscribe(listener: SessionListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setSession(token: string, user: any, role: 'student' | 'admin', refreshToken?: string | null) {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(ROLE_KEY, role);
    notifyListeners({ type: 'updated', user, role, token });
  }

  clearSession(expiredReason?: string) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    if (expiredReason) {
      notifyListeners({ type: 'expired', reason: expiredReason });
    } else {
      notifyListeners({ type: 'cleared' });
    }
  }

  getStoredUser(): any | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  getStoredRole(): 'student' | 'admin' | 'guest' {
    const role = localStorage.getItem(ROLE_KEY);
    if (role === 'student' || role === 'admin') return role;
    return 'guest';
  }

  async refreshSession(): Promise<AuthResponse> {
    const user = this.getStoredUser();
    const role = this.getStoredRole();
    if (!user || role === 'guest') {
      return {
        success: false,
        httpStatus: 401,
        code: 'SESSION_EXPIRED',
        error: 'No temporary demo session found.'
      };
    }
    const newToken = `demo-token-${Date.now()}`;
    const newRefresh = `demo-refresh-${Date.now()}`;
    this.setSession(newToken, user, role, newRefresh);
    notifyListeners({ type: 'refreshed', user, role, token: newToken });
    return {
      success: true,
      httpStatus: 200,
      token: newToken,
      refreshToken: newRefresh,
      user,
      userRole: role
    };
  }

  async login(studentId: string, password: string, _rememberMe = false): Promise<AuthResponse> {
    const cleanId = (studentId || '').trim().toUpperCase();
    if (!cleanId || !password) {
      return {
        success: false,
        httpStatus: 400,
        error: 'Please enter both your UCC Student ID and password.'
      };
    }

    const lockInfo = mockStateStore.demoFailedAttempts.get(cleanId);
    if (lockInfo && lockInfo.lockedUntil > Date.now()) {
      const remaining = Math.ceil((lockInfo.lockedUntil - Date.now()) / 1000);
      return {
        success: false,
        httpStatus: 429,
        code: 'DEMO_LOCKOUT',
        lockedUntilSeconds: remaining,
        error: `Demo rate-limit preview: Too many failed attempts. Wait ${remaining}s.`
      };
    }

    const account = mockStateStore.findStudentById(cleanId);
    if (!account) {
      const regEntry = mockStateStore.officialRegistry[cleanId];
      if (regEntry) {
        return {
          success: false,
          httpStatus: 403,
          canActivate: true,
          error:
            'Student ID found in temporary mock registry, but account is not activated yet. Use "Activate Voter Account" to preview activation.'
        };
      }
      return {
        success: false,
        httpStatus: 401,
        error: 'Student ID not found in temporary demonstration accounts.'
      };
    }

    if (account.status === 'suspended') {
      mockStateStore.logAuditEvent({
        eventType: 'DEMO_LOGIN_BLOCKED',
        identifier: account.studentId,
        role: 'Student',
        ipAddress: 'Browser Local',
        status: 'FLAGGED',
        details: 'Suspended demo student account login blocked in frontend preview.'
      });
      return {
        success: false,
        httpStatus: 403,
        code: 'ACCOUNT_SUSPENDED',
        error:
          'This demonstration student account is marked as suspended in temporary mock data.'
      };
    }

    if (password !== account.demoPassword) {
      const nextCount = (lockInfo?.count || 0) + 1;
      const maxAttempts = 5;
      if (nextCount >= maxAttempts) {
        mockStateStore.demoFailedAttempts.set(cleanId, {
          count: 0,
          lockedUntil: Date.now() + 60 * 1000
        });
        return {
          success: false,
          httpStatus: 429,
          attemptsRemaining: 0,
          lockedUntilSeconds: 60,
          error: 'Demo preview lockout triggered after 5 incorrect password attempts (60s).'
        };
      }
      mockStateStore.demoFailedAttempts.set(cleanId, { count: nextCount, lockedUntil: 0 });
      return {
        success: false,
        httpStatus: 401,
        attemptsRemaining: maxAttempts - nextCount,
        error: 'Incorrect password for temporary demonstration account.'
      };
    }

    mockStateStore.demoFailedAttempts.delete(cleanId);
    account.lastLogin = new Date().toISOString();
    const user = sanitizeStudent(account);
    const token = `demo-student-token-${Date.now()}`;
    const refreshToken = `demo-student-refresh-${Date.now()}`;
    this.setSession(token, user, 'student', refreshToken);

    mockStateStore.logAuditEvent({
      eventType: 'DEMO_LOGIN_SUCCESS',
      userId: account.id,
      identifier: account.studentId,
      role: 'Student (Demo)',
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details: 'Temporary frontend demo student session started.'
    });

    return {
      success: true,
      httpStatus: 200,
      token,
      refreshToken,
      user,
      userRole: 'student',
      message: 'Signed in to temporary frontend preview session.'
    };
  }

  async adminLogin(
    staffId: string,
    password: string,
    selectedRole: string,
    securityPin?: string
  ): Promise<AuthResponse> {
    const cleanId = (staffId || '').trim().toUpperCase();
    const account = mockStateStore.findAdminByStaffId(cleanId);
    if (!account) {
      return {
        success: false,
        httpStatus: 401,
        error: 'Administrative Staff ID not found in temporary demo registry.'
      };
    }

    if (password !== account.demoPassword) {
      return {
        success: false,
        httpStatus: 401,
        error: 'Invalid password for temporary admin demo account.'
      };
    }

    if (securityPin && securityPin.trim() !== '9482') {
      return {
        success: false,
        httpStatus: 401,
        error: 'Invalid demo security PIN (expected 9482 in preview mode).'
      };
    }

    if (selectedRole && account.role !== selectedRole) {
      return {
        success: false,
        httpStatus: 403,
        error: `Selected role "${selectedRole}" does not match demo staff role "${account.role}".`
      };
    }

    account.lastLogin = new Date().toISOString();
    const user = sanitizeAdmin(account);
    const token = `demo-admin-token-${Date.now()}`;
    const refreshToken = `demo-admin-refresh-${Date.now()}`;
    this.setSession(token, user, 'admin', refreshToken);

    mockStateStore.logAuditEvent({
      eventType: 'DEMO_ADMIN_LOGIN',
      userId: account.id,
      identifier: account.staffId,
      role: account.role,
      ipAddress: 'Browser Local',
      status: 'SUCCESS',
      details: `Temporary frontend demo admin session started (${account.role}).`
    });

    return {
      success: true,
      httpStatus: 200,
      token,
      refreshToken,
      user,
      userRole: 'admin'
    };
  }

  async verifyStudentId(studentId: string): Promise<AuthResponse> {
    const cleanId = (studentId || '').trim().toUpperCase();
    const reg =
      mockStateStore.officialRegistry[cleanId] ||
      Object.values(mockStateStore.officialRegistry).find(
        (r) => r.indexNumber.toUpperCase() === cleanId
      );

    if (!reg) {
      return {
        success: false,
        found: false,
        error:
          'Student ID not found in temporary mock registry (try SB/MKT/23/0142 for activation preview).'
      };
    }

    const alreadyRegistered = Boolean(mockStateStore.findStudentById(reg.studentId));
    return {
      success: true,
      found: true,
      isAlreadyRegistered: alreadyRegistered,
      student: {
        studentId: reg.studentId,
        indexNumber: reg.indexNumber,
        fullName: reg.fullName,
        email: reg.officialEmail,
        faculty: reg.faculty,
        department: reg.department,
        programme: reg.programme,
        level: reg.level,
        hall: reg.hall,
        isEnrolled: reg.isEnrolled
      }
    };
  }

  async register(studentData: any): Promise<AuthResponse> {
    const cleanId = (studentData?.studentId || '').trim().toUpperCase();
    if (!cleanId) {
      return { success: false, httpStatus: 400, error: 'Student ID is required.' };
    }

    if (mockStateStore.findStudentById(cleanId)) {
      return {
        success: false,
        httpStatus: 409,
        error:
          'This Student ID is already activated in the temporary demonstration store. Please sign in instead.'
      };
    }

    if (!studentData.password || studentData.password.length < 8) {
      return {
        success: false,
        httpStatus: 400,
        error: 'Password must be at least 8 characters long.'
      };
    }

    if (studentData.password !== studentData.confirmPassword) {
      return {
        success: false,
        httpStatus: 400,
        error: 'Password confirmation does not match.'
      };
    }

    const reg = mockStateStore.officialRegistry[cleanId];
    const newAccount: TempDemoStudentAccount = {
      id: `stu-demo-${Date.now()}`,
      studentId: reg?.studentId || cleanId,
      indexNumber: reg?.indexNumber || studentData.indexNumber || '10990000',
      fullName: reg?.fullName || studentData.fullName || 'UCC Student',
      email: reg?.officialEmail || studentData.email || `${cleanId.toLowerCase()}@st.ucc.edu.gh`,
      phone: studentData.phone || '+233 24 000 0000',
      department: reg?.department || studentData.department || 'Computer Science & Information Technology',
      faculty: reg?.faculty || studentData.faculty || 'School of Physical Sciences',
      programme: reg?.programme || studentData.programme || 'B.Sc. Computer Science',
      level: reg?.level || studentData.level || '200',
      hall: reg?.hall || studentData.hall || 'Kwame Nkrumah Hall',
      demoPassword: studentData.password,
      status: 'active',
      isEligible: reg ? reg.isEnrolled : true,
      emailVerified: true,
      notificationPreferences: {
        emailAlerts: true,
        smsBulletins: true,
        resultsAnnouncements: true
      },
      hasVotedElections: [],
      createdAt: new Date().toISOString(),
      isDemoAccount: true
    };

    mockStateStore.studentAccounts.push(newAccount);
    const user = sanitizeStudent(newAccount);
    const token = `demo-student-token-${Date.now()}`;
    const refreshToken = `demo-student-refresh-${Date.now()}`;
    this.setSession(token, user, 'student', refreshToken);

    return {
      success: true,
      httpStatus: 201,
      token,
      refreshToken,
      user,
      userRole: 'student',
      message: 'Temporary demonstration voter account activated locally.'
    };
  }

  async forgotPassword(studentId: string): Promise<AuthResponse> {
    const cleanId = (studentId || '').trim().toUpperCase();
    const account = mockStateStore.findStudentById(cleanId);
    if (!account) {
      return {
        success: false,
        httpStatus: 404,
        error: 'Student ID not found in temporary demonstration accounts.'
      };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const token = `demo-reset-${Date.now()}`;
    mockStateStore.demoResetTokens.set(code, {
      studentId: account.studentId,
      code,
      expiresAt: Date.now() + 15 * 60 * 1000
    });
    mockStateStore.demoResetTokens.set(token, {
      studentId: account.studentId,
      code,
      expiresAt: Date.now() + 15 * 60 * 1000
    });

    return {
      success: true,
      httpStatus: 200,
      email: account.email,
      demoRecoveryCode: code,
      demoResetToken: token,
      message: 'Temporary demo reset code generated locally (no email sent).'
    };
  }

  async resetPassword(payload: {
    token?: string;
    code?: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<AuthResponse> {
    const lookup = (payload.code || payload.token || '').trim();
    const entry = mockStateStore.demoResetTokens.get(lookup);
    if (!entry || entry.expiresAt < Date.now()) {
      return {
        success: false,
        httpStatus: 400,
        error: 'Invalid or expired temporary demo reset code.'
      };
    }
    if (!payload.newPassword || payload.newPassword.length < 8) {
      return {
        success: false,
        httpStatus: 400,
        error: 'New password must be at least 8 characters.'
      };
    }
    if (payload.newPassword !== payload.confirmPassword) {
      return {
        success: false,
        httpStatus: 400,
        error: 'Password confirmation does not match.'
      };
    }

    const account = mockStateStore.findStudentById(entry.studentId);
    if (account) {
      account.demoPassword = payload.newPassword;
    }
    mockStateStore.demoResetTokens.delete(lookup);

    return {
      success: true,
      httpStatus: 200,
      message: 'Temporary demonstration password updated locally.'
    };
  }

  async getMe(): Promise<AuthResponse> {
    const storedUser = this.getStoredUser();
    const storedRole = this.getStoredRole();
    const token = this.getToken();

    if (!storedUser || storedRole === 'guest' || !token) {
      return { success: false, code: 'AUTH_REQUIRED', error: 'No active temporary session' };
    }

    if (storedRole === 'student') {
      const liveAccount = mockStateStore.findStudentById(storedUser.studentId || storedUser.id);
      const user = liveAccount ? sanitizeStudent(liveAccount) : storedUser;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { success: true, httpStatus: 200, user, userRole: 'student', token };
    }

    const liveAdmin = mockStateStore.findAdminByStaffId(storedUser.staffId || storedUser.id);
    const adminUser = liveAdmin ? sanitizeAdmin(liveAdmin) : storedUser;
    localStorage.setItem(USER_KEY, JSON.stringify(adminUser));
    return { success: true, httpStatus: 200, user: adminUser, userRole: 'admin', token };
  }

  async logout(): Promise<void> {
    this.clearSession();
  }

  async updateProfile(updates: {
    phone?: string;
    emergencyContact?: string;
    notificationPreferences?: any;
    attemptedIdentityChange?: boolean;
  }): Promise<AuthResponse> {
    const storedUser = this.getStoredUser();
    if (!storedUser || this.getStoredRole() !== 'student') {
      return { success: false, httpStatus: 401, error: 'Sign in as a student to update profile.' };
    }

    const account = mockStateStore.findStudentById(storedUser.studentId || storedUser.id);
    if (!account) {
      return { success: false, httpStatus: 404, error: 'Temporary student account not found.' };
    }

    if (updates.phone !== undefined) account.phone = updates.phone;
    if (updates.emergencyContact !== undefined) account.emergencyContact = updates.emergencyContact;
    if (updates.notificationPreferences !== undefined) {
      account.notificationPreferences = {
        ...account.notificationPreferences,
        ...updates.notificationPreferences
      };
    }

    const updatedUser = sanitizeStudent(account);
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    notifyListeners({
      type: 'updated',
      user: updatedUser,
      role: 'student',
      token: this.getToken() || 'demo-token'
    });

    return { success: true, httpStatus: 200, user: updatedUser };
  }

  async changePassword(passwords: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<AuthResponse> {
    const storedUser = this.getStoredUser();
    if (!storedUser || this.getStoredRole() !== 'student') {
      return { success: false, httpStatus: 401, error: 'Authentication required.' };
    }

    const account = mockStateStore.findStudentById(storedUser.studentId || storedUser.id);
    if (!account) {
      return { success: false, httpStatus: 404, error: 'Account not found.' };
    }

    if (passwords.currentPassword !== account.demoPassword) {
      return { success: false, httpStatus: 400, error: 'Current demo password is incorrect.' };
    }
    if (!passwords.newPassword || passwords.newPassword.length < 8) {
      return { success: false, httpStatus: 400, error: 'New password must be at least 8 characters.' };
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      return { success: false, httpStatus: 400, error: 'New passwords do not match.' };
    }

    account.demoPassword = passwords.newPassword;
    return {
      success: true,
      httpStatus: 200,
      message: 'Temporary demonstration password updated locally.'
    };
  }

  async testAdminAccess(): Promise<AuthResponse> {
    const role = this.getStoredRole();
    if (role !== 'admin') {
      return {
        success: false,
        httpStatus: 403,
        code: 'RBAC_ADMIN_ONLY',
        error:
          'Frontend role check blocked request: Student or Guest role cannot access Administrative views.'
      };
    }
    return {
      success: true,
      httpStatus: 200,
      message: 'Frontend demo admin role verified.'
    };
  }

  async getStudentDashboard(): Promise<{
    success: boolean;
    code?: string;
    httpStatus?: number;
    data?: any;
    error?: string;
  }> {
    const role = this.getStoredRole();
    const storedUser = this.getStoredUser();
    if (role !== 'student' || !storedUser) {
      return {
        success: false,
        httpStatus: 401,
        code: 'AUTH_REQUIRED',
        error: 'Student authentication required.'
      };
    }

    const account = mockStateStore.findStudentById(storedUser.studentId || storedUser.id);
    const student = account ? sanitizeStudent(account) : (storedUser as StudentProfile);

    const processedElections = mockStateStore.elections.map((el) => {
      const elig = evaluateTempStudentEligibility(student, el);
      const hasVoted = student.hasVotedElections.includes(el.id);
      const canVoteNow = elig.isEligible && el.status === 'live' && !hasVoted;
      return {
        ...el,
        studentEligibility: {
          isEligible: elig.isEligible,
          reason: elig.reason,
          hasVoted,
          canVoteNow
        }
      };
    });

    return {
      success: true,
      httpStatus: 200,
      data: {
        student,
        sections: {
          availableToMe: processedElections.filter((e) => e.studentEligibility.isEligible),
          active: processedElections.filter((e) => e.status === 'live'),
          upcoming: processedElections.filter(
            (e) => e.status === 'upcoming' || e.status === 'scheduled'
          ),
          completed: processedElections.filter(
            (e) => e.status === 'results_published' || e.status === 'closed'
          )
        }
      }
    };
  }
}

export const authClient = new FrontendDemoAuthService();
export { getPermissionsForRole };
export type { AdminRoleType };
