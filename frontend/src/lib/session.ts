import axios from "axios";

/**
 * The signed-in session, kept in memory only.
 *
 *  - The access token (Supabase JWT, ~1 hour) lives in this module, not in localStorage.
 *  - The refresh token never reaches JavaScript: the backend keeps it in an httpOnly cookie scoped to
 *    /api/auth and rotates it on every POST /auth/refresh.
 *  - refreshSession() is single-flight: any number of callers (parallel 401s, the expiry timer, the app
 *    start-up) share one request.
 *  - endSession("expired") is what every "the session is gone" path ends in; the auth context listens and
 *    sends the person to the sign-in page with a "session ended" message.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
/** Key the old build kept the access token under; removed on start-up. */
const LEGACY_TOKEN_KEY = "token";

export type SessionEndReason = "expired" | "signed_out";
type Listener = (reason: SessionEndReason) => void;

let accessToken: string | null = null;
let expiresAtMs: number | null = null;
let inflight: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

try {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
} catch {
  // storage unavailable (private mode / tests): nothing to clean up
}

/** Expiry (ms since epoch) from the JWT's own `exp` claim; used when the server did not send one. */
function jwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Access-token expiry in ms since the epoch, or null when unknown. */
export function getExpiresAt(): number | null {
  return expiresAtMs;
}

/** @param expiresAt seconds since the epoch, as Supabase / the backend report it */
export function setSession(token: string, expiresAt?: number | null): void {
  accessToken = token;
  expiresAtMs = typeof expiresAt === "number" ? expiresAt * 1000 : jwtExpiryMs(token);
}

export function clearSession(): void {
  accessToken = null;
  expiresAtMs = null;
}

/** Forgets the session and tells the app (auth context) why. */
export function endSession(reason: SessionEndReason): void {
  const hadSession = accessToken !== null;
  clearSession();
  if (hadSession || reason === "signed_out") listeners.forEach((fn) => fn(reason));
}

export function onSessionEnd(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Gets a new access token from the refresh cookie. Resolves to the new token, or null when there is no
 * usable session (no cookie, revoked, account deactivated). Never rejects.
 */
export function refreshSession(): Promise<string | null> {
  if (!inflight) {
    inflight = axios
      .post<{ token: string; expiresAt?: number | null }>(`${API_BASE_URL}/auth/refresh`, null, {
        withCredentials: true,
      })
      .then((res) => {
        setSession(res.data.token, res.data.expiresAt);
        return res.data.token;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Refreshes first when the access token is missing or expires within `marginMs`. */
export async function ensureFreshToken(marginMs = 60_000): Promise<string | null> {
  if (accessToken && (expiresAtMs === null || expiresAtMs - Date.now() > marginMs)) {
    return accessToken;
  }
  return refreshSession();
}
