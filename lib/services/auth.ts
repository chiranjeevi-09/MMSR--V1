/**
 * MMSR Publications V2 — Authentication Service Layer
 * Directly interfaces with Django REST Framework SimpleJWT endpoints.
 */

export interface UserProfile {
  id: number;
  // Standardized MMSR public ID (MMSR-USR-1931-NNNNNN) — the identifier shown
  // to the account holder. The ADM display identity (MMSR-ADM-1931-NNNNNN) is
  // surfaced separately for staff accounts only.
  public_id?: string | null;
  admin_public_id?: string | null;
  email: string;
  // Dedicated admin-portal login minted by the invitation flow; null for
  // accounts that sign in with their personal email directly.
  work_email?: string | null;
  first_name: string;
  last_name: string;
  phone_number?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  is_author?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  // Assigned by the invitation wizard / superuser admin APIs — surfaced for
  // the profile page's locked "Editorial Designation" & "Department" fields.
  admin_role?: string;
  department?: string;
  // Per-section CMS grants maintained on the /admin/access page.
  // Absent key means "no override" — full staff access.
  admin_permissions?: Record<string, 'none' | 'read' | 'edit'>;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

export interface ApiMessageResponse {
  message: string;
}

// Base API URL from environment variable or fallback to Django backend
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

class AuthService {
  private getUrl(endpoint: string): string {
    return `${API_BASE_URL}${endpoint}`;
  }

  /**
   * Helper to format DRF validation or generic error responses cleanly.
   */
  private async parseErrorResponse(response: Response): Promise<string> {
    try {
      const data = await response.json();
      if (data.error) {
        return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      }
      if (data.detail) {
        return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
      if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
        return data.non_field_errors.join(' ');
      }
      // Check field specific errors e.g. { email: ["user with this email address already exists."] }
      const fieldErrors: string[] = [];
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          fieldErrors.push(`${key.toUpperCase()}: ${data[key].join(' ')}`);
        } else if (typeof data[key] === 'string') {
          fieldErrors.push(data[key]);
        }
      }
      if (fieldErrors.length > 0) {
        return fieldErrors.join(' | ');
      }
      return `Request failed with status ${response.status}`;
    } catch {
      return `Server error (${response.status}). Please try again later.`;
    }
  }

  /**
   * User Login Endpoint
   * POST /api/users/auth/login/
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const res = await fetch(this.getUrl('/api/users/auth/login/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }

  /**
   * User Registration Endpoint
   * POST /api/users/auth/register/
   */
  async register(data: RegisterData): Promise<UserProfile> {
    const res = await fetch(this.getUrl('/api/users/auth/register/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }

  /**
   * Token Refresh Endpoint
   * POST /api/users/auth/token/refresh/
   *
   * The backend rotates refresh tokens and blacklists the presented one
   * (audit M-7), so callers MUST persist `refresh` from the response when
   * present — keeping the old token would break the next refresh.
   */
  async refreshToken(refreshToken: string): Promise<{ access: string; refresh?: string }> {
    const res = await fetch(this.getUrl('/api/users/auth/token/refresh/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }

  /**
   * Logout Endpoint (audit M-7)
   * POST /api/users/auth/logout/
   * Revokes the refresh token server-side so it can never mint new access
   * tokens. Idempotent; failures are non-fatal for the caller (local state
   * is cleared either way).
   */
  async logout(refreshToken: string | null): Promise<void> {
    if (!refreshToken) return;
    try {
      await fetch(this.getUrl('/api/users/auth/logout/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    } catch {
      // Network hiccup: local session is destroyed regardless; the refresh
      // token simply lives until its 7-day expiry. Never block a logout.
    }
  }

  /**
   * Password Reset Request Endpoint
   * POST /api/users/auth/request-password-reset/
   */
  async requestPasswordReset(email: string): Promise<ApiMessageResponse> {
    const res = await fetch(this.getUrl('/api/users/auth/request-password-reset/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }

  /**
   * Password Reset Confirm Endpoint
   * POST /api/users/auth/confirm-password-reset/
   */
  async confirmPasswordReset(uid: string, token: string, newPassword: string): Promise<ApiMessageResponse> {
    const res = await fetch(this.getUrl('/api/users/auth/confirm-password-reset/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        token,
        new_password: newPassword,
      }),
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }

  /**
   * Verify Password Endpoint (first gate of the two-step change flow)
   * POST /api/users/auth/verify-password/
   * Returns true when the account's current password matches, false otherwise.
   */
  async verifyPassword(accessToken: string, currentPassword: string): Promise<boolean> {
    const res = await fetch(this.getUrl('/api/users/auth/verify-password/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ current_password: currentPassword }),
    });

    // 401 means the session expired — surface it distinctly so callers can prompt re-login.
    if (res.status === 401) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const data = await res.json().catch(() => ({} as { valid?: boolean }));
    return Boolean(res.ok && data.valid);
  }

  /**
   * Change Password Endpoint
   * POST /api/users/auth/change-password/
   */
  async changePassword(accessToken: string, currentPassword: string, newPassword: string): Promise<ApiMessageResponse> {
    const res = await fetch(this.getUrl('/api/users/auth/change-password/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }

  /**
   * Fetch User Profile Endpoint
   * GET /api/users/profile/
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const res = await fetch(this.getUrl('/api/users/profile/'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }

  /**
   * Update Profile Endpoint
   * PATCH /api/users/profile/
   * Self-service fields only (names, personal sign-in email, phone).
   * work_email, role and permissions are read-only server-side.
   */
  async updateProfile(
    accessToken: string,
    data: Partial<Pick<UserProfile, 'first_name' | 'last_name' | 'email' | 'phone_number'>>
  ): Promise<UserProfile> {
    const res = await fetch(this.getUrl('/api/users/profile/'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }

  /**
   * Google OAuth Backend Integration
   * POST /api/users/auth/google/
   */
  async googleAuth(googleToken: string): Promise<LoginResponse> {
    const res = await fetch(this.getUrl('/api/users/auth/google/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken }),
    });

    if (!res.ok) {
      const errorMessage = await this.parseErrorResponse(res);
      throw new Error(errorMessage);
    }

    return await res.json();
  }
}

export const authService = new AuthService();
