'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, UserProfile, AuthTokens, LoginCredentials, RegisterData } from '../services/auth';

interface AuthContextType {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<UserProfile>;
  register: (data: RegisterData) => Promise<UserProfile>;
  /**
   * Completes a Google Identity Services sign-in. Receives the ID token issued
   * to the browser, exchanges it for an MMSR session at the backend's dedicated
   * Google endpoint (which verifies it server-side), and persists the returned
   * JWT + profile exactly like the password login. Rejects with a user-readable
   * message when verification or account resolution fails.
   */
  loginWithGoogle: (credential: string) => Promise<UserProfile>;
  logout: () => void;
  clearError: () => void;
  /**
   * Replace the in-memory user with a freshly-saved profile (e.g. after the
   * profile edit form PATCHes the backend) so the header, sidebar and every
   * other consumer reflect the change immediately, without a re-login/refresh.
   */
  updateUser: (updated: UserProfile) => void;
  /**
   * Force-refreshes the short-lived access token using the stored refresh token.
   * Callers performing sensitive/authenticated operations (e.g. the paid conference
   * submission flow) should await this to obtain a fresh token, because access tokens
   * can expire during a long form-fill session and otherwise yield 401s. Returns the
   * new access token, or null when no refresh token is available / refresh fails.
   */
  refreshAccessToken: () => Promise<string | null>;
}

const STORAGE_KEY_REFRESH = 'mmsr_v2_rt';
const STORAGE_KEY_ACCESS = 'mmsr_v2_at';
// Non-sensitive, presence-only marker consumed by root middleware.ts for the
// server-side route gate (audit M-3). It carries NO role and NO token, so it is
// never an authorization signal — Django remains the security boundary. The
// string must match SESSION_MARKER_COOKIE in middleware.ts; it is duplicated
// (rather than imported) because middleware.ts pulls in `next/server`, which
// cannot be imported into a client component.
const SESSION_MARKER_COOKIE = 'mmsr_session';

// Keep the edge route-gate marker in sync with the real (sessionStorage) JWT
// session. Set when a session exists, cleared otherwise.
const setSessionMarker = (active: boolean) => {
  if (typeof document === 'undefined') return;
  // `Secure` only over HTTPS so the dev (http://localhost) flow still works.
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  if (active) {
    document.cookie = `${SESSION_MARKER_COOKIE}=1; Path=/; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${SESSION_MARKER_COOKIE}=; Path=/; Max-Age=0${secure}`;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Decode the `exp` claim (seconds) from a JWT without verification. This is a
 * latency optimisation ONLY: the token's actual validity is always checked
 * server-side on every request. Returns null when the token cannot be parsed,
 * which safely falls back to the full refresh flow.
 */
const getJwtExpSeconds = (token: string): number | null => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    // base64url → base64, decode via browser APIs (no Buffer dependency in
    // client bundles), then parse only the claims we need.
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join('')
    );
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to persist tokens safely
  const persistTokens = (newTokens: AuthTokens | null) => {
    if (newTokens) {
      sessionStorage.setItem(STORAGE_KEY_ACCESS, newTokens.access);
      sessionStorage.setItem(STORAGE_KEY_REFRESH, newTokens.refresh);
      setSessionMarker(true);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_ACCESS);
      sessionStorage.removeItem(STORAGE_KEY_REFRESH);
      setSessionMarker(false);
    }
    setTokens(newTokens);
  };

  // Logout action. Revokes the refresh token server-side (audit M-7) on a
  // best-effort basis, then always destroys the local session. Reads the
  // token straight from sessionStorage so this callback stays dependency-
  // free (it is an effect dependency below — an unstable identity would
  // re-run session restoration in a loop).
  const logout = useCallback(() => {
    const storedRefresh = sessionStorage.getItem(STORAGE_KEY_REFRESH);
    setUser(null);
    persistTokens(null);
    setError(null);
    if (storedRefresh) {
      void authService.logout(storedRefresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize and verify existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedRefresh = sessionStorage.getItem(STORAGE_KEY_REFRESH);
      const storedAccess = sessionStorage.getItem(STORAGE_KEY_ACCESS);

      if (!storedRefresh) {
        setIsLoading(false);
        return;
      }

      try {
        // Fast path: if the stored access token is still unexpired (30s clock
        // skew margin), load the profile with it directly. This removes one
        // full sequential round-trip (refresh → profile) from every page load.
        // Security is unchanged — Django validates the token server-side on
        // the profile request itself; a rejected token falls through to the
        // refresh flow below.
        const expSeconds = storedAccess ? getJwtExpSeconds(storedAccess) : null;
        const accessCandidate = storedAccess;
        if (expSeconds && accessCandidate && expSeconds * 1000 - Date.now() > 30_000) {
          try {
            const profile = await authService.getUserProfile(accessCandidate);
            setUser(profile);
            setTokens({ access: accessCandidate, refresh: storedRefresh });
            setIsLoading(false);
            return;
          } catch {
            // Stored access token rejected (expired/revoked server-side) —
            // continue with the refresh flow below.
          }
        }

        // Attempt token refresh to get valid access token. The backend
        // rotates refresh tokens and blacklists the presented one, so the
        // NEW refresh (when returned) must be persisted — keeping the old
        // one would break the next restoration attempt.
        const refreshResult = await authService.refreshToken(storedRefresh);
        const newTokens: AuthTokens = {
          access: refreshResult.access,
          refresh: refreshResult.refresh || storedRefresh,
        };

        // Fetch user profile with valid access token
        const profile = await authService.getUserProfile(newTokens.access);

        setUser(profile);
        persistTokens(newTokens);
      } catch (err: any) {
        // Refresh failed or token expired -> clear session
        console.warn('Authentication session restoration failed:', err?.message || err);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [logout]);

  const login = async (credentials: LoginCredentials): Promise<UserProfile> => {
    setError(null);
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      persistTokens(response.tokens);
      return response.user;
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please verify your credentials.';
      setError(msg);
      throw new Error(msg);
    }
  };

  // Register Action
  const register = async (data: RegisterData): Promise<UserProfile> => {
    setError(null);
    try {
      const profile = await authService.register(data);
      return profile;
    } catch (err: any) {
      const msg = err?.message || 'Registration failed. Please check your information.';
      setError(msg);
      throw new Error(msg);
    }
  };

  // Google Identity Services sign-in (see interface docstring).
  const loginWithGoogle = async (credential: string): Promise<UserProfile> => {
    setError(null);
    try {
      const response = await authService.googleAuth(credential);
      setUser(response.user);
      persistTokens(response.tokens);
      return response.user;
    } catch (err: any) {
      const msg = err?.message || 'Google sign-in failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const clearError = () => setError(null);

  const updateUser = (updated: UserProfile) => setUser(updated);

  // On-demand access-token refresh for sensitive operations (see interface docstring).
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const storedRefresh =
      sessionStorage.getItem(STORAGE_KEY_REFRESH) || tokens?.refresh || null;
    if (!storedRefresh) return null;
    try {
      const result = await authService.refreshToken(storedRefresh);
      const newAccess = result.access;
      // Persist the rotated refresh token too (backend blacklists the old one).
      const newRefresh = result.refresh || storedRefresh;
      sessionStorage.setItem(STORAGE_KEY_ACCESS, newAccess);
      sessionStorage.setItem(STORAGE_KEY_REFRESH, newRefresh);
      setTokens({ access: newAccess, refresh: newRefresh });
      return newAccess;
    } catch (err: any) {
      console.warn('On-demand token refresh failed:', err?.message || err);
      return null;
    }
  }, [tokens?.refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        isAuthenticated: Boolean(user && tokens?.access),
        isLoading,
        error,
        login,
        register,
        loginWithGoogle,
        logout,
        clearError,
        updateUser,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
