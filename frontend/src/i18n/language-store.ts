import { flushSync } from "react-dom";
import i18n, { syncDocumentLanguage } from "./index";
import { AppLanguage, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, safeStorageSet } from "./config";
import { LocaleLoadError, isLocaleLoaded, loadLocaleWithTimeout, prefetchLocale } from "./loader";
import { getLocaleMeta, isSupportedLanguage } from "./registry";

/**
 * The language switch. A tiny external store (no provider, no remount) that:
 *  - keeps showing the CURRENT language while another one loads (per-row status only),
 *  - swaps catalogue + <html lang> + formats atomically (one synchronous React commit),
 *  - lets the LAST choice win when the user clicks quickly,
 *  - ignores a second click on a language that is already loading,
 *  - on failure/timeout stays on the current language and exposes a retryable error.
 */

export type RowStatus = "idle" | "loading" | "error";
export interface RowState {
  status: RowStatus;
  error?: "timeout" | "failed";
}
export interface LanguageState {
  active: AppLanguage;
  rows: Partial<Record<AppLanguage, RowState>>;
  /** Text for the polite live region, written in the NEW language after a successful switch. */
  announcement: { id: number; text: string } | null;
}

let state: LanguageState = {
  active: (i18n.language as AppLanguage) || DEFAULT_LANGUAGE,
  rows: {},
  announcement: null,
};
const listeners = new Set<() => void>();
let requestSeq = 0;
let pendingTarget: AppLanguage | null = null;
let announcementId = 0;

const emit = () => listeners.forEach((l) => l());
const setState = (next: Partial<LanguageState>) => {
  state = { ...state, ...next };
  emit();
};

export const getLanguageState = (): LanguageState => state;
export const subscribeLanguage = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Make `code` the active language right now. Its catalogue must already be loaded. */
export function applyLanguage(code: AppLanguage, opts: { sync?: boolean } = {}): void {
  const run = () => {
    void i18n.changeLanguage(code);
    syncDocumentLanguage(code);
  };
  // flushSync: text, <html lang> and number/date formats land in the same commit/frame.
  if (opts.sync === false) run();
  else flushSync(run);
}

const clearLoadingRows = (rows: LanguageState["rows"], except?: AppLanguage) => {
  const next: LanguageState["rows"] = {};
  for (const [code, row] of Object.entries(rows) as Array<[AppLanguage, RowState]>) {
    if (code === except) continue;
    if (row.status === "error") next[code] = row; // keep errors visible until retried
  }
  return next;
};

function commit(code: AppLanguage) {
  applyLanguage(code);
  safeStorageSet(LANGUAGE_STORAGE_KEY, code);
  pendingTarget = null;
  const meta = getLocaleMeta(code);
  const text = i18n.t("settings.language.changed", {
    language: meta?.nativeName ?? code,
    defaultValue: `Language changed to ${meta?.nativeName ?? code}`,
  });
  setState({
    active: code,
    rows: {},
    announcement: { id: ++announcementId, text },
  });
}

/**
 * Switch the app language. Resolves true when `code` became active.
 * Superseded requests (user chose something else meanwhile) and ignored double-taps resolve false.
 */
export async function selectLanguage(code: AppLanguage): Promise<boolean> {
  if (!isSupportedLanguage(code)) return false;

  // Double-tap on a language that is already loading: ignore.
  if (pendingTarget === code && state.rows[code]?.status === "loading") return false;

  const seq = ++requestSeq;

  // Choosing what is already active just cancels whatever was pending.
  if (code === state.active) {
    pendingTarget = null;
    setState({ rows: clearLoadingRows(state.rows) });
    return true;
  }

  // Already downloaded (e.g. by hover/idle prefetch): switch instantly, no spinner.
  if (isLocaleLoaded(code)) {
    commit(code);
    return true;
  }

  pendingTarget = code;
  setState({ rows: { ...clearLoadingRows(state.rows, code), [code]: { status: "loading" } } });

  try {
    await loadLocaleWithTimeout(code);
  } catch (err) {
    if (seq !== requestSeq) return false; // user already moved on
    pendingTarget = null;
    const reason = err instanceof LocaleLoadError ? err.reason : "failed";
    setState({ rows: { ...state.rows, [code]: { status: "error", error: reason } } });
    return false;
  }

  if (seq !== requestSeq) return false; // loaded and cached, but the user chose differently
  commit(code);
  return true;
}

/** Warm a language up without any UI (hover / focus / idle). */
export const prefetchLanguage = (code: AppLanguage): void => prefetchLocale(code);

/** Test helper: back to a clean "English, nothing pending" state. */
export function resetLanguageStore(active: AppLanguage = DEFAULT_LANGUAGE): void {
  requestSeq++;
  pendingTarget = null;
  state = { active, rows: {}, announcement: null };
  emit();
}
