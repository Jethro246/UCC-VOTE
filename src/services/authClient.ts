export interface AuthResponse<T = any> {
  success: boolean;
  code?: string;
  httpStatus?: number;
  message?: string;
  error?: string;
  token?: string;
  refreshToken?: string;
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

export type SessionEvent =
  | { type: 'updated'; user: any; role: 'student' | 'admin'; token: string }
  | { type: 'refreshed'; user: any; role: 'student' | 'admin'; token: string }
  | { type: 'expired'; reason: string }
  | { type: 'cleared' };

type SessionListener = (event: SessionEvent) => void;

const TOKEN_KEY = 'ucc_vote_token';
const REFRESH_TOKEN_KEY = 'ucc_vote_refresh_token';
const USER_KEY = 'ucc_vote_user';
const ROLE_KEY = 'ucc_vote_role';

const listeners = new Set<SessionListener>();
let refreshInFlight: Promise<AuthResponse> | null = null;

function notifyListeners(event: SessionEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // ignore subscriber errors
    }
  });
}

async function safeParseJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const authClient = {
  subscribe(listener: SessionListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setSession(token: string, user: any, role: 'student' | 'admin', refreshToken?: string | null) {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(ROLE_KEY, role);
    notifyListeners({ type: 'updated', user, role, token });
  },

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

  async refreshSession(): Promise<AuthResponse> {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    refreshInFlight = (async () => {
      const refreshToken = this.getRefreshToken();
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(refreshToken ? { refreshToken } : {})
        });
        const data = await safeParseJson(res);

        if (res.ok && data?.success && data?.token && data?.user) {
          const role: 'student' | 'admin' =
            data.userRole === 'admin' ? 'admin' : 'student';
          localStorage.setItem(TOKEN_KEY, data.token);
          if (data.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
          }
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          localStorage.setItem(ROLE_KEY, role);
          notifyListeners({ type: 'refreshed', user: data.user, role, token: data.token });
          return { ...data, httpStatus: res.status };
        }

        if (res.status === 401 || res.status === 403) {
          const reason =
            data?.error || 'Your session has expired. Please log in again to continue.';
          this.clearSession(reason);
          return {
            success: false,
            httpStatus: res.status,
            code: data?.code || 'SESSION_EXPIRED',
            error: reason
          };
        }

        return {
          success: false,
          httpStatus: res.status,
          code: 'SERVER_ERROR',
          error: data?.error || `Server error (${res.status}) while renewing session.`
        };
      } catch {
        return {
          success: false,
          code: 'NETWORK_ERROR',
          error: 'Network connection interrupted while validating your session.'
        };
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  },

  async authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const buildHeaders = (tokenOverride?: string | null) => {
      const headers = new Headers(init.headers || {});
      const token = tokenOverride !== undefined ? tokenOverride : this.getToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      } else {
        headers.delete('Authorization');
      }
      return headers;
    };

    const res = await fetch(input, {
      ...init,
      credentials: 'include',
      headers: buildHeaders()
    });

    if (res.status !== 401) {
      return res;
    }

    // Attempt transparent token refresh when access token is expired/invalid and a refresh token or session existed
    const hasRefresh = Boolean(this.getRefreshToken() || this.getToken());
    if (!hasRefresh) {
      return res;
    }

    const refreshRes = await this.refreshSession();
    if (refreshRes.success && refreshRes.token) {
      return fetch(input, {
        ...init,
        credentials: 'include',
        headers: buildHeaders(refreshRes.token)
      });
    }

    return res;
  },

  async login(studentId: string, password: string, rememberMe = false): Promise<AuthResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password, rememberMe })
    });
    const data = (await safeParseJson(res)) || {
      success: false,
      error: `Authentication request failed (${res.status}).`
    };
    if (data.success && data.token && data.user) {
      this.setSession(data.token, data.user, 'student', data.refreshToken);
    }
    return { ...data, httpStatus: res.status };
  },

  async adminLogin(
    staffId: string,
    password: string,
    selectedRole: string,
    securityPin?: string
  ): Promise<AuthResponse> {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, password, selectedRole, securityPin })
    });
    const data = (await safeParseJson(res)) || {
      success: false,
      error: `Administrative login failed (${res.status}).`
    };
    if (data.success && data.token && data.user) {
      this.setSession(data.token, data.user, 'admin', data.refreshToken);
    }
    return { ...data, httpStatus: res.status };
  },

  async register(studentData: any): Promise<AuthResponse> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
    const data = (await safeParseJson(res)) || {
      success: false,
      error: `Registration failed (${res.status}).`
    };
    if (data.success && data.token && data.user) {
      this.setSession(data.token, data.user, 'student', data.refreshToken);
    }
    return { ...data, httpStatus: res.status };
  },

  async verifyStudentId(studentId: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/verify-student-id', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId })
    });
    return (await safeParseJson(res)) || { success: false, error: 'Verification request failed.' };
  },

  async forgotPassword(studentId: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId })
    });
    return (await safeParseJson(res)) || { success: false, error: 'Password recovery request failed.' };
  },

  async resetPassword(payload: {
    token?: string;
    code?: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<AuthResponse> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return (await safeParseJson(res)) || { success: false, error: 'Password reset failed.' };
  },

  async getMe(): Promise<AuthResponse> {
    const token = this.getToken();
    const refreshToken = this.getRefreshToken();
    if (!token && !refreshToken) {
      return { success: false, code: 'AUTH_REQUIRED', error: 'No active session' };
    }

    if (!token && refreshToken) {
      return this.refreshSession();
    }

    try {
      const res = await this.authorizedFetch('/api/auth/me');
      const data = await safeParseJson(res);

      if (res.ok && data?.success && data?.user) {
        const role: 'student' | 'admin' =
          data.userRole === 'admin' ? 'admin' : 'student';
        const latestToken = this.getToken() || token || '';
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        localStorage.setItem(ROLE_KEY, role);
        return { ...data, token: latestToken, httpStatus: res.status };
      }

      if (res.status === 401 || res.status === 403) {
        const reason =
          data?.error || 'Your session has expired. Please log in again to continue.';
        this.clearSession(reason);
        return {
          success: false,
          httpStatus: res.status,
          code: data?.code || 'SESSION_EXPIRED',
          error: reason
        };
      }

      return {
        success: false,
        httpStatus: res.status,
        code: 'SERVER_ERROR',
        error: data?.error || `Server error (${res.status}) verifying session.`
      };
    } catch {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        error: 'Network error validating session'
      };
    }
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    const refreshToken = this.getRefreshToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ refreshToken })
      });
    } catch {
      // ignore network failure during sign-out
    } finally {
      this.clearSession();
    }
  },

  async updateProfile(updates: {
    phone?: string;
    emergencyContact?: string;
    notificationPreferences?: any;
    attemptedIdentityChange?: boolean;
  }): Promise<AuthResponse> {
    const res = await this.authorizedFetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    const data = (await safeParseJson(res)) || {
      success: false,
      error: `Failed to update profile (${res.status}).`
    };
    if (data.success && data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return { ...data, httpStatus: res.status };
  },

  async changePassword(passwords: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<AuthResponse> {
    const res = await this.authorizedFetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(passwords)
    });
    const data = (await safeParseJson(res)) || {
      success: false,
      error: `Password update failed (${res.status}).`
    };
    return { ...data, httpStatus: res.status };
  },

  async testAdminAccess(): Promise<AuthResponse> {
    const res = await this.authorizedFetch('/api/admin/overview');
    const data = (await safeParseJson(res)) || {
      success: false,
      error: `Request failed (${res.status}).`
    };
    return { ...data, httpStatus: res.status };
  },

  async getStudentDashboard(): Promise<{
    success: boolean;
    code?: string;
    httpStatus?: number;
    data?: any;
    error?: string;
  }> {
    try {
      const res = await this.authorizedFetch('/api/student/dashboard');
      const data = await safeParseJson(res);
      if (!data) {
        return {
          success: false,
          httpStatus: res.status,
          code: res.status >= 500 ? 'SERVER_ERROR' : 'SESSION_EXPIRED',
          error: `Unexpected server response (${res.status}).`
        };
      }
      return { ...data, httpStatus: res.status };
    } catch {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        error: 'Network connection interrupted while loading your student dashboard.'
      };
    }
  }
};
