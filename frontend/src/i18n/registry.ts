import { AppLanguage, PSEUDO_LANGUAGE, isPseudoEnabled } from "./config";

/**
 * The locale registry. One row per language the user can pick.
 *
 * Adding a language = one JSON catalogue + one row here + one loader in `loader.ts`.
 * `sample` is deliberately NOT in the catalogue: the preview line under each language in
 * Settings must be readable BEFORE that language's catalogue has been downloaded.
 */
export interface LocaleMeta {
  code: AppLanguage;
  /** Name written in the language itself (never translated). */
  nativeName: string;
  englishName: string;
  /** Preview line shown under the language row, written in that language. */
  sample: string;
  /** Whether the language needs the self-hosted Devanagari font before it can be shown. */
  needsDevanagariFont: boolean;
  devOnly?: boolean;
}

const ALL_LOCALES: LocaleMeta[] = [
  {
    code: "en",
    nativeName: "English",
    englishName: "English",
    sample: "Order accepted",
    needsDevanagariFont: false,
  },
  {
    code: "hi",
    nativeName: "हिन्दी",
    englishName: "Hindi",
    sample: "ऑर्डर स्वीकार किया गया",
    needsDevanagariFont: true,
  },
  {
    code: PSEUDO_LANGUAGE,
    nativeName: "Pseudo (en-XA)",
    englishName: "Pseudo-locale (dev only)",
    sample: "[Ōŕðéŕ àççéþţéð ~~~]",
    needsDevanagariFont: false,
    devOnly: true,
  },
];

/** Locales visible to the user in this build (pseudo-locale only in dev). */
export const LOCALES: LocaleMeta[] = ALL_LOCALES.filter((l) => !l.devOnly || isPseudoEnabled());

export const getLocaleMeta = (code: string): LocaleMeta | undefined =>
  LOCALES.find((l) => l.code === code);

export const isSupportedLanguage = (code: string | null | undefined): code is AppLanguage =>
  Boolean(code && LOCALES.some((l) => l.code === code));
