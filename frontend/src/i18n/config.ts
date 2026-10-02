/**
 * Shared i18n constants. Kept free of imports so it can be used from anywhere
 * (including the tiny boot code in main.tsx) without pulling in i18next.
 */

/** Language codes the app ships. `en-XA` is the dev-only pseudo-locale. */
export type AppLanguage = "en" | "hi" | "en-XA";

/** The source language and the last-resort fallback. Its catalogue is always bundled. */
export const DEFAULT_LANGUAGE: AppLanguage = "en";

/** The dev-only accented / +30% pseudo-locale used to spot hard-coded strings and layout breaks. */
export const PSEUDO_LANGUAGE: AppLanguage = "en-XA";

/** localStorage key holding the user's last explicit language choice. */
export const LANGUAGE_STORAGE_KEY = "master-admin.language";

/** localStorage key for the optional Devanagari-digits preference (off by default). */
export const NUMERALS_STORAGE_KEY = "master-admin.numerals";

/** Longest we wait for a catalogue + font before giving up and keeping the current language. */
export const LOCALE_LOAD_TIMEOUT_MS = 8000;

export const isPseudoEnabled = (): boolean => Boolean(import.meta.env.DEV);

export function safeStorageGet(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode); the language still switches for this session.
  }
}
