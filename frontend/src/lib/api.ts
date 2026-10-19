/**
 * Single entry point for every backend call.
 *
 * Previously each page called fetch() directly and sent no identity whatsoever,
 * so the server had no way to tell traders apart. All requests now carry the
 * bearer token issued at sign-in, and an expired or rejected token signs the
 * user out instead of silently showing another account's data.
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'adatya_token';
const USER_KEY = 'user';

export interface SessionUser {
  id: number;
  name: string;
  businessName: string;
  apmcLocation: string;
  mobile: string;
  role: string;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage unavailable (private mode); the session simply will not persist */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

/** A stored token is required to render the app shell. */
export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout(): void {
  clearSession();
  window.location.href = '/login';
}

/**
 * Authenticated fetch. Adds the bearer token, defaults the JSON content type
 * for bodied requests, and signs the user out on 401.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (response.status === 401) {
    // The token is missing, expired, or the account no longer exists.
    clearSession();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Your session has expired. Please sign in again.');
  }

  return response;
}

/** Authenticated fetch that parses JSON and surfaces the server error message. */
export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data && (data.error || data.message)) || 'Request failed. Please try again.';
    throw new Error(message);
  }

  return data as T;
}

/**
 * Unauthenticated POST, used only by sign-in and registration. It deliberately
 * does not redirect on 401 so the login form can display the error inline.
 */
export async function publicPost<T = any>(path: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  return { ok: response.ok, data: data as T };
}
