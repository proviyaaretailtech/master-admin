import i18n from "i18next";
import { NUMERALS_STORAGE_KEY, safeStorageGet, safeStorageSet } from "./config";

/**
 * Locale-aware formatting. Screens must use these instead of toLocaleString()/template strings.
 *
 * - Money: ₹ prefix, Indian grouping (1,23,456.50). Whole rupees show no decimals; fractional
 *   amounts always show two. Prefer integer `*_minor` (paise) fields when the API sends them.
 * - Numbers/dates for `hi-IN` use LATIN digits by default. Devanagari digits are a user option
 *   (`setNumeralStyle("deva")`), off by default.
 * - Dates/times are shown in Asia/Kolkata unless a timeZone is passed.
 * - English dates keep the existing en-US style ("Sep 16, 2026"); numbers use en-IN grouping.
 *
 * All functions read the ACTIVE language at call time, so a component that re-renders on a
 * language change (it uses useTranslation()/useFormat()) always gets the new format.
 */

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";
export const EMPTY_VALUE = "—";

export type DateInput = Date | string | number | null | undefined;
export type NumeralStyle = "latn" | "deva";

type LocaleKind = "number" | "date";

const NUMBER_LOCALES: Record<string, string> = { en: "en-IN", hi: "hi-IN" };
const DATE_LOCALES: Record<string, string> = { en: "en-US", hi: "hi-IN" };

let numeralStyle: NumeralStyle = safeStorageGet(NUMERALS_STORAGE_KEY) === "deva" ? "deva" : "latn";
const numeralListeners = new Set<() => void>();

export const getNumeralStyle = (): NumeralStyle => numeralStyle;

export function setNumeralStyle(style: NumeralStyle): void {
  numeralStyle = style;
  safeStorageSet(NUMERALS_STORAGE_KEY, style);
  numeralListeners.forEach((l) => l());
}

export function subscribeNumeralStyle(listener: () => void): () => void {
  numeralListeners.add(listener);
  return () => numeralListeners.delete(listener);
}

const baseLanguage = (lng?: string): string => {
  const code = (lng || i18n.language || "en").toLowerCase();
  if (code === "en-xa") return "en";
  return code.split("-")[0];
};

/** The BCP-47 tag handed to Intl for the given (or active) language. */
export function intlLocaleFor(kind: LocaleKind, lng?: string): string {
  const base = baseLanguage(lng);
  const table = kind === "number" ? NUMBER_LOCALES : DATE_LOCALES;
  const tag = table[base] ?? table.en;
  if (base === "hi") return `${tag}-u-nu-${numeralStyle}`;
  return tag;
}

export function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "INR (₹)" / "inr" / "INR" -> "INR". Falls back to INR. */
export function normalizeCurrency(raw?: string | null): string {
  const m = /[A-Za-z]{3}/.exec(raw || "");
  return m ? m[0].toUpperCase() : "INR";
}

export interface NumberFormatOpts extends Intl.NumberFormatOptions {
  locale?: string;
}

export function formatNumber(
  value: number | null | undefined,
  opts: NumberFormatOpts = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  const { locale, ...intl } = opts;
  return new Intl.NumberFormat(locale ?? intlLocaleFor("number"), intl).format(value);
}

export interface MoneyOpts {
  currency?: string;
  /** Show decimals: "auto" (default) = two decimals only when the amount has paise. */
  decimals?: "auto" | "always" | "never";
  locale?: string;
}

/** `value` is in major units (rupees). */
export function formatMoney(value: number | null | undefined, opts: MoneyOpts = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  const currency = normalizeCurrency(opts.currency);
  const hasFraction = !Number.isInteger(Math.round(value * 100) / 100);
  const wantFraction =
    opts.decimals === "always" ? true : opts.decimals === "never" ? false : hasFraction;
  const digits = wantFraction ? 2 : 0;
  return new Intl.NumberFormat(opts.locale ?? intlLocaleFor("number"), {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** `minor` is an integer in the smallest unit (paise). */
export function formatMoneyMinor(minor: number | null | undefined, opts: MoneyOpts = {}): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return EMPTY_VALUE;
  return formatMoney(Math.round(minor) / 100, opts);
}

/**
 * Format `record[field]`, preferring the integer `record[field + "_minor"]` twin when present.
 * e.g. formatMoneyFrom(plan, "price") uses plan.price_minor if the API sent it.
 */
export function formatMoneyFrom(
  record: Record<string, unknown> | null | undefined,
  field: string,
  opts: MoneyOpts = {}
): string {
  if (!record) return EMPTY_VALUE;
  const minor = record[`${field}_minor`];
  if (typeof minor === "number" && Number.isFinite(minor)) return formatMoneyMinor(minor, opts);
  const major = record[field];
  const num = typeof major === "string" && major.trim() !== "" ? Number(major) : major;
  return typeof num === "number" ? formatMoney(num, opts) : EMPTY_VALUE;
}

export interface DateOpts {
  /** "medium" Sep 16, 2026 (default) · "short" Sep 16 · "long" Wednesday, September 16, 2026 */
  style?: "short" | "medium" | "long";
  timeZone?: string;
  locale?: string;
}

const DATE_STYLES: Record<NonNullable<DateOpts["style"]>, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
};

export function formatDate(input: DateInput, opts: DateOpts = {}): string {
  const d = toDate(input);
  if (!d) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(opts.locale ?? intlLocaleFor("date"), {
    ...DATE_STYLES[opts.style ?? "medium"],
    timeZone: opts.timeZone ?? DEFAULT_TIME_ZONE,
  }).format(d);
}

export function formatTime(input: DateInput, opts: Omit<DateOpts, "style"> = {}): string {
  const d = toDate(input);
  if (!d) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(opts.locale ?? intlLocaleFor("date"), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: opts.timeZone ?? DEFAULT_TIME_ZONE,
  }).format(d);
}

export function formatDateTime(input: DateInput, opts: DateOpts = {}): string {
  const d = toDate(input);
  if (!d) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(opts.locale ?? intlLocaleFor("date"), {
    ...DATE_STYLES[opts.style ?? "medium"],
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: opts.timeZone ?? DEFAULT_TIME_ZONE,
  }).format(d);
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

/** "5 minutes ago" / "कल" / "in 2 hours". Phrasing comes from the platform's CLDR data. */
export function formatRelativeTime(
  input: DateInput,
  opts: { now?: Date | number; locale?: string } = {}
): string {
  const d = toDate(input);
  if (!d) return EMPTY_VALUE;
  const now = opts.now instanceof Date ? opts.now.getTime() : (opts.now ?? Date.now());
  const diffSec = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  const tag = opts.locale ?? intlLocaleFor("date");
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  if (abs < 45) return rtf.format(0, "second");
  if (abs < HOUR) return rtf.format(Math.round(diffSec / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diffSec / HOUR), "hour");
  if (abs < 7 * DAY) {
    const days = Math.round(diffSec / DAY);
    // Hindi "कल" means both yesterday and tomorrow: say "1 दिन पहले" / "1 दिन में" instead.
    if (Math.abs(days) === 1 && tag.startsWith("hi")) {
      return new Intl.RelativeTimeFormat(tag, { numeric: "always" }).format(days, "day");
    }
    return rtf.format(days, "day");
  }
  if (abs < 30 * DAY) return rtf.format(Math.round(diffSec / (7 * DAY)), "week");
  if (abs < 365 * DAY) return rtf.format(Math.round(diffSec / (30 * DAY)), "month");
  return rtf.format(Math.round(diffSec / (365 * DAY)), "year");
}
