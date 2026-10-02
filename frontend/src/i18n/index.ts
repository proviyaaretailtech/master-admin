import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import { DEFAULT_LANGUAGE, AppLanguage } from "./config";

/**
 * i18next setup.
 *
 * - `en` (source + fallback language) is bundled: it is always available, so a failed download of
 *   another language can never leave the UI blank, and a missing key in another language falls
 *   back to English text (never to a key name or an empty string).
 * - Every other language (`hi`, ...) is a lazy chunk added by `loader.ts` BEFORE the app switches
 *   to it. See `language-store.ts` for the switch, `bootstrap.ts` for startup.
 * - One catalogue per language, namespaced by feature at the top level: t("orgs.title").
 */

const warned = new Set<string>();
const warnOnce = (kind: string, lng: string, key: string) => {
  const id = `${kind}:${lng}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(`[i18n] ${kind} (${lng}): ${key}`);
};

export const htmlLangFor = (lng: string): string => (lng === "en-XA" ? "en" : lng);

/** Keep <html lang> in step with the active language. */
export function syncDocumentLanguage(lng: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("lang", htmlLangFor(lng));
  document.documentElement.setAttribute("dir", "ltr");
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: ["en", "hi", "en-XA"],
    load: "currentOnly",
    nsSeparator: false,
    returnEmptyString: false,
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    saveMissing: Boolean(import.meta.env.DEV),
    missingKeyHandler: (lngs: readonly string[], _ns: string, key: string) => {
      const lng = lngs[0] ?? "";
      if (lng && lng !== DEFAULT_LANGUAGE) warnOnce("missing key, using English", lng, key);
    },
    // A call that passes defaultValue (codeLabel/statusLabel for unknown codes) gets that text.
    parseMissingKeyHandler: (key: string, defaultValue?: string) => {
      if (defaultValue) return defaultValue;
      warnOnce("missing key in every language", DEFAULT_LANGUAGE, key);
      return key;
    },
  });
  i18n.on("languageChanged", syncDocumentLanguage);
  syncDocumentLanguage(DEFAULT_LANGUAGE);
}

export const getActiveLanguage = (): AppLanguage =>
  (i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE) as AppLanguage;

export { i18n };
export default i18n;
