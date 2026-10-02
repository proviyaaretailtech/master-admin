import i18n from "i18next";
import en from "./locales/en.json";
import { AppLanguage, DEFAULT_LANGUAGE, LOCALE_LOAD_TIMEOUT_MS } from "./config";
import { ensureDevanagariFont } from "./fonts";

/**
 * Lazy locale loading. `en` is bundled; every other catalogue is a separate chunk fetched with
 * a dynamic import() the first time it is needed (selection, hover/focus on its row, idle time,
 * or startup when it is the saved language). A locale counts as loaded only when BOTH its
 * catalogue and its font are ready, so switching never shows half-translated text or tofu boxes.
 */

export interface LocaleLoader {
  catalogue: () => Promise<Record<string, unknown>>;
  /** Optional: resolves when the font this language needs is ready. */
  font?: () => Promise<void>;
}

/** Mutable on purpose: tests (and future locales) replace/add entries. */
export const localeLoaders: Partial<Record<AppLanguage, LocaleLoader>> = {
  hi: {
    catalogue: async () => (await import("./locales/hi.json")).default as Record<string, unknown>,
    font: ensureDevanagariFont,
  },
};

if (import.meta.env.DEV) {
  localeLoaders["en-XA"] = {
    catalogue: async () => {
      const { pseudoLocalizeCatalog } = await import("./pseudo");
      return pseudoLocalizeCatalog(en as never) as Record<string, unknown>;
    },
  };
}

const loaded = new Set<string>([DEFAULT_LANGUAGE]);
const inflight = new Map<string, Promise<void>>();

export class LocaleLoadError extends Error {
  readonly reason: "timeout" | "failed";
  constructor(code: string, reason: "timeout" | "failed", cause?: unknown) {
    super(`Could not load locale "${code}" (${reason})`);
    this.name = "LocaleLoadError";
    this.reason = reason;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export const isLocaleLoaded = (code: string): boolean => loaded.has(code);

/** Forget everything about a locale (tests only). */
export function resetLocaleCache(code: string): void {
  loaded.delete(code);
  inflight.delete(code);
  if (i18n.hasResourceBundle(code, "translation")) i18n.removeResourceBundle(code, "translation");
}

/** Start (or join) the load of one locale: catalogue + font, registered with i18next. */
export function loadLocale(code: AppLanguage): Promise<void> {
  if (loaded.has(code)) return Promise.resolve();
  const existing = inflight.get(code);
  if (existing) return existing;
  const loader = localeLoaders[code];
  if (!loader) return Promise.reject(new LocaleLoadError(code, "failed"));

  const attempt = Promise.all([loader.catalogue(), loader.font ? loader.font() : undefined])
    .then(([catalogue]) => {
      i18n.addResourceBundle(code, "translation", catalogue, true, true);
      loaded.add(code);
    })
    .catch((err: unknown) => {
      throw err instanceof LocaleLoadError ? err : new LocaleLoadError(code, "failed", err);
    })
    .finally(() => {
      if (inflight.get(code) === attempt) inflight.delete(code);
    });
  inflight.set(code, attempt);
  return attempt;
}

/** Like loadLocale but gives up after `ms`; a later retry starts a fresh attempt. */
export function loadLocaleWithTimeout(
  code: AppLanguage,
  ms: number = LOCALE_LOAD_TIMEOUT_MS
): Promise<void> {
  if (loaded.has(code)) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      inflight.delete(code);
      reject(new LocaleLoadError(code, "timeout"));
    }, ms);
    loadLocale(code).then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Fire-and-forget warm-up (hover/focus/idle). Never throws, never shows UI. */
export function prefetchLocale(code: AppLanguage): void {
  if (loaded.has(code) || inflight.has(code) || !localeLoaders[code]) return;
  loadLocale(code).catch(() => {
    /* a real selection will surface the error with a Retry */
  });
}
