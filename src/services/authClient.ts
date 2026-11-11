export interface AuthResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  token?: string;
  user?: T;
  userRole?: 'student' | 'admin' | 'guest';
  expiresAt?: number;
  attemptsRemaining?: number;
  lockedUntilSeconds?: number;
  canActivate?: boolean;
  demoResetToken?: string;
  demoRecoveryCode?: string;
  found?: boolean;
  isAlreadyRegistered?: boolean;
  student?: any;
  email?: string;
}

const TOKEN_KEY = 'ucc_vote_token';
const USER_KEY = 'ucc_vote_user';
const ROLE_KEY = 'ucc_vote_role';

export const authClient = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setSession(token: string, user: any, role: 'student' | 'admin') {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(ROLE_KEY, role);
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
  },

  getStoredUser(): any | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getStoredRole(): 'student' | 'admin' | 'guest' {
    const role = localStorage.getItem(ROLE_KEY);
    if (role === 'student' || role === 'admin') return role;
    return 'guest';
  },

  async login(studentId: string, password: string, rememberMe = false): Promise<AuthResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password, rememberMe })
    });
    const data = await res.json();
    if (data.success && data.token) {
      this.setSession(data.token, data.user, 'student');
    }
    return data;
  },

  async adminLogin(staffId: string, password: string, selectedRole: string, securityPin?: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, password, selectedRole, securityPin })
    });
    const data = await res.json();
    if (data.success && data.token) {
      this.setSession(data.token, data.user, 'admin');
    }
    return data;
  },

  async register(studentData: any): Promise<AuthResponse> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
    const data = await res.json();
    if (data.success && data.token) {
      this.setSession(data.token, data.user, 'student');
    }
    return data;
  },

  async verifyStudentId(studentId: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/verify-student-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId })
    });
    return res.json();
  },

  async forgotPassword(studentId: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId })
    });
    return res.json();
  },

  async resetPassword(payload: { token?: string; code?: string; newPassword: string; confirmPassword: string }): Promise<AuthResponse> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async getMe(): Promise<AuthResponse> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'No active session' };
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        this.clearSession();
      }
      return data;
    } catch {
      return { success: false, error: 'Network error validating session' };
    }
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch (e) {
      // ignore
    } finally {
      this.clearSession();
    }
  },

  async updateProfile(updates: { phone?: string; emergencyContact?: string; notificationPreferences?: any; attemptedIdentityChange?: boolean }): Promise<AuthResponse> {
    const token = this.getToken();
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (data.success && data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  },

  async changePassword(passwords: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<AuthResponse> {
    const token = this.getToken();
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(passwords)
    });
    return res.json();
  },

  async testAdminAccess(): Promise<AuthResponse> {
    const token = this.getToken();
    const res = await fetch('/api/admin/overview', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return res.json();
  },

  async getStudentDashboard(): Promise<{ success: boolean; data?: any; error?: string }> {
    const token = this.getToken();
    const res = await fetch('/api/student/dashboard', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return res.json();
  }
};
