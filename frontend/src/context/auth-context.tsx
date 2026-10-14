import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import { authApi } from "../api";
import { User } from "../@types";
import {
  clearSession,
  endSession,
  ensureFreshToken,
  getAccessToken,
  getExpiresAt,
  onSessionEnd,
  refreshSession,
  setSession,
} from "../lib/session";

/** Why the person is looking at the sign-in page (shown as a banner there). */
export type AuthNotice = "session_ended" | null;

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** Set when the session ended on its own (refresh failed); cleared on the next sign-in. */
  notice: AuthNotice;
  login: (email: string, password: string) => Promise<{ error: Error | null; user?: User }>;
  logout: () => Promise<void>;
  /** Ends every session of this account on every device (Supabase sign-out, scope global). */
  logoutEverywhere: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Refresh this long before the access token expires. */
const REFRESH_MARGIN_MS = 60_000;
/** Never schedule sooner than this (clock skew, a token that is already about to expire). */
const MIN_DELAY_MS = 5_000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<AuthNotice>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The session ended (refresh failed, or signed out): forget the user. The protected routes then send
  // the person to /login, where `notice` explains why.
  useEffect(
    () =>
      onSessionEnd((reason) => {
        setUser(null);
        setToken(null);
        if (reason === "expired") setNotice("session_ended"); // i18n-ignore: notice code, shown via auth.sessionEnded
      }),
    []
  );

  // Restore the session on start-up from the httpOnly refresh cookie (the access token is memory-only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const restored = getAccessToken() ?? (await refreshSession());
        if (!restored) return;
        const response = await authApi.getMe();
        if (cancelled) return;
        setToken(getAccessToken());
        setUser(response.user);
      } catch (error) {
        console.warn("Could not restore the session:", error);
        clearSession();
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Proactive refresh: shortly before the access token expires, get a new one. If that fails the
  // session is over (endSession -> "session ended" on the sign-in page).
  useEffect(() => {
    if (!token || !user) return;
    const expiresAt = getExpiresAt();
    if (expiresAt === null) return;
    const delay = Math.max(MIN_DELAY_MS, expiresAt - Date.now() - REFRESH_MARGIN_MS);
    timer.current = setTimeout(async () => {
      const next = await refreshSession();
      if (next) setToken(next);
      else endSession("expired");
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [token, user]);

  // Timers do not run while a laptop sleeps: when the tab comes back, refresh if the token is stale.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || !getAccessToken()) return;
      const expiresAt = getExpiresAt();
      if (expiresAt === null || expiresAt - Date.now() > REFRESH_MARGIN_MS) return;
      const next = await refreshSession();
      if (next) setToken(next);
      else endSession("expired");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await authApi.login({ email, password });
      const { user: loggedInUser, token: authToken } = data;
      setSession(authToken, data.expiresAt);
      setToken(authToken);
      setUser(loggedInUser);
      setNotice(null);
      return { error: null, user: loggedInUser };
    } catch (err: any) {
      return {
        error: err instanceof Error ? err : new Error(err?.message || "Invalid credentials"),
      };
    }
  };

  const signOut = useCallback(async (scope: "local" | "global") => {
    try {
      // Revoking needs a live access token; "everywhere" must not silently fail on an expired one.
      await ensureFreshToken();
      await authApi.logout(scope);
    } catch {
      // Ignore network errors on logout: this browser forgets the session either way
    } finally {
      endSession("signed_out");
      setToken(null);
      setUser(null);
    }
  }, []);

  const logout = useCallback(() => signOut("local"), [signOut]);
  const logoutEverywhere = useCallback(() => signOut("global"), [signOut]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        notice,
        login,
        logout,
        logoutEverywhere,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
