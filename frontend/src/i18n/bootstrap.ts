import { AppLanguage, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, safeStorageGet } from "./config";
import { applyLanguage, resetLanguageStore } from "./language-store";
import { isLocaleLoaded, loadLocaleWithTimeout, prefetchLocale } from "./loader";
import { LOCALES, isSupportedLanguage } from "./registry";

/**
 * Startup, before the first React render:
 *   1. read the saved language synchronously (localStorage) — else the browser's language — else en
 *   2. if it is not English, load THAT catalogue + font (the inline splash in index.html stays
 *      visible meanwhile), then apply it, so a Hindi user never sees English first
 *   3. on failure/timeout fall back to English and render anyway (never a blank screen); the saved
 *      preference is kept so the next visit tries again
 */

/** Saved choice, else the first browser language we support, else English. */
export function readInitialLanguage(): AppLanguage {
  const saved = safeStorageGet(LANGUAGE_STORAGE_KEY);
  if (isSupportedLanguage(saved)) return saved;

  const preferred =
    typeof navigator === "undefined"
      ? []
      : Array.from(navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const tag of preferred) {
    const base = String(tag || "")
      .toLowerCase()
      .split("-")[0];
    const match = LOCALES.find((l) => !l.devOnly && l.code === base);
    if (match) return match.code;
  }
  return DEFAULT_LANGUAGE;
}

export async function bootstrapI18n(): Promise<AppLanguage> {
  const wanted = readInitialLanguage();
  if (wanted === DEFAULT_LANGUAGE) return DEFAULT_LANGUAGE;
  try {
    await loadLocaleWithTimeout(wanted);
    applyLanguage(wanted, { sync: false });
    resetLanguageStore(wanted);
    return wanted;
  } catch (err) {
    console.warn(`[i18n] could not load "${wanted}" at startup, using English`, err);
    return DEFAULT_LANGUAGE;
  }
}

/** After first paint, quietly download the other languages so a later switch is instant. */
export function scheduleIdlePrefetch(): void {
  if (typeof window === "undefined") return;
  const conn = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "")) return;

  const run = () => {
    for (const l of LOCALES) {
      if (!l.devOnly && !isLocaleLoaded(l.code)) prefetchLocale(l.code);
    }
  };
  const ric = (
    window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }
  ).requestIdleCallback;
  if (ric) ric.call(window, run, { timeout: 5000 });
  else setTimeout(run, 3000);
}
