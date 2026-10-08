import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "../../lib/api-error";

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  denied: boolean;
  reload: () => void;
}

/**
 * Loads data and exposes the four non-loaded page states (loading, error, denied via 403).
 * Stale responses are ignored. `refreshMs` re-fetches silently (no loading flash).
 */
export function useResource<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  opts: { refreshMs?: number; enabled?: boolean } = {}
): Resource<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(opts.enabled !== false);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const enabled = opts.enabled !== false;

  const run = useCallback((silent: boolean) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    fnRef
      .current()
      .then((d) => {
        if (id !== seq.current) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (id !== seq.current) return;
        setError(e);
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    run(false);
    return () => {
      seq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  useEffect(() => {
    if (!opts.refreshMs || !enabled) return;
    const h = window.setInterval(() => run(true), opts.refreshMs);
    return () => window.clearInterval(h);
  }, [opts.refreshMs, enabled, run]);

  const reload = useCallback(() => run(false), [run]);
  const denied = isApiError(error) && error.status === 403;
  return { data, error, loading, denied, reload };
}

export interface ActionState {
  busy: boolean;
  error: unknown;
  run: <R>(fn: () => Promise<R>) => Promise<R | undefined>;
  clear: () => void;
}

/** Wraps a mutating call: tracks busy + error so the screen can show it and stay put. */
export function useAction(): ActionState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(async <R>(fn: () => Promise<R>) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, clear: () => setError(null) };
}

export const isProviderNotConfigured = (e: unknown): boolean =>
  isApiError(e) &&
  (e.errorCode === "provider_not_configured" || /provider_not_configured/i.test(e.message));
