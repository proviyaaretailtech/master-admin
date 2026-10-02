import { describe, it, expect, afterEach } from "vitest";
import i18n from "../i18n";
import { loadLocale } from "../i18n/loader";
import {
  formatMoney,
  formatMoneyMinor,
  formatMoneyFrom,
  formatNumber,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  setNumeralStyle,
  normalizeCurrency,
} from "../i18n/format";

describe("money", () => {
  it("formats rupees with the ₹ prefix and Indian grouping", () => {
    expect(formatMoney(123456.5)).toBe("₹1,23,456.50");
    expect(formatMoney(1499)).toBe("₹1,499");
    expect(formatMoney(12345678)).toBe("₹1,23,45,678");
    expect(formatMoney(0)).toBe("₹0");
  });

  it("uses integer paise (*_minor) when present", () => {
    expect(formatMoneyMinor(12345650)).toBe("₹1,23,456.50");
    expect(formatMoneyMinor(149900)).toBe("₹1,499");
    expect(formatMoneyFrom({ price: 1, price_minor: 12345650 }, "price")).toBe("₹1,23,456.50");
    expect(formatMoneyFrom({ price: 499 }, "price")).toBe("₹499");
    expect(formatMoneyFrom({ price: "499.5" }, "price")).toBe("₹499.50");
    expect(formatMoneyFrom({}, "price")).toBe("—");
  });

  it("handles currencies, odd inputs and decimals option", () => {
    expect(normalizeCurrency("INR (₹)")).toBe("INR");
    expect(normalizeCurrency(undefined)).toBe("INR");
    expect(formatMoney(99, { currency: "USD ($)" })).toBe("$99");
    expect(formatMoney(NaN)).toBe("—");
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(10, { decimals: "always" })).toBe("₹10.00");
  });

  it("is identical in Hindi (Latin digits, ₹, Indian grouping)", async () => {
    await loadLocale("hi");
    await i18n.changeLanguage("hi");
    expect(formatMoney(123456.5)).toBe("₹1,23,456.50");
    expect(formatNumber(1234567)).toBe("12,34,567");
    expect(/^[0-9,]+$/.test(formatNumber(1234567))).toBe(true);
  });
});

describe("numbers and the optional Devanagari digits", () => {
  afterEach(() => setNumeralStyle("latn"));

  it("groups numbers the Indian way in English", () => {
    expect(formatNumber(1234567)).toBe("12,34,567");
    expect(formatNumber(undefined)).toBe("—");
  });

  it("uses Devanagari digits only when the user opts in, and only in Hindi", async () => {
    await loadLocale("hi");
    setNumeralStyle("deva");
    expect(formatNumber(1234567)).toBe("12,34,567"); // English ignores the option
    await i18n.changeLanguage("hi");
    expect(formatNumber(1234567)).toBe("१२,३४,५६७");
    setNumeralStyle("latn");
    expect(formatNumber(1234567)).toBe("12,34,567");
  });
});

describe("dates and times (Asia/Kolkata)", () => {
  // 2026-09-16 20:00 UTC == 2026-09-17 01:30 IST
  const instant = "2026-09-16T20:00:00Z";

  it("shows India time regardless of the machine's zone", () => {
    expect(formatDate(instant)).toBe("Sep 17, 2026");
    expect(formatTime(instant)).toMatch(/^1:30\s?AM$/i);
    expect(formatDateTime(instant)).toMatch(/Sep 17, 2026.*1:30\s?AM/i);
    expect(formatDate(instant, { style: "long" })).toBe("Thursday, September 17, 2026");
    expect(formatDate(instant, { timeZone: "UTC" })).toBe("Sep 16, 2026");
  });

  it("returns an em dash for missing or invalid dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
    expect(formatTime("")).toBe("—");
  });

  it("formats Hindi dates with Latin digits", async () => {
    await loadLocale("hi");
    await i18n.changeLanguage("hi");
    const out = formatDate(instant);
    expect(out).toMatch(/^17 /);
    expect(out).toContain("2026");
    expect(formatDate(instant, { style: "long" })).toContain("गुरुवार");
  });

  it("formats relative time in both languages", async () => {
    const now = new Date("2026-09-26T16:00:00Z").getTime();
    expect(formatRelativeTime(now - 5 * 60_000, { now })).toBe("5 minutes ago");
    expect(formatRelativeTime(now - 26 * 3600_000, { now })).toBe("yesterday");
    expect(formatRelativeTime(now + 3 * 86400_000, { now })).toBe("in 3 days");
    await loadLocale("hi");
    await i18n.changeLanguage("hi");
    // bare "कल" means both yesterday and tomorrow, so Hindi says "1 दिन पहले"
    expect(formatRelativeTime(now - 26 * 3600_000, { now })).toBe("1 दिन पहले");
    expect(formatRelativeTime(now + 26 * 3600_000, { now })).toBe("1 दिन में");
    expect(formatRelativeTime(now - 3 * 86400_000, { now })).toBe("3 दिन पहले");
  });
});

describe("formatLastSync follows the language", () => {
  const referenceNow = new Date("2026-09-26T16:00:00");

  it("speaks Hindi and keeps Latin digits", async () => {
    const { formatLastSync } = await import("../lib/date-utils");
    await loadLocale("hi");
    await i18n.changeLanguage("hi");

    const today = formatLastSync(new Date("2026-09-26T14:30:00"), referenceNow);
    expect(today.main).toBe("आज");
    expect(today.combined).toMatch(/^आज 2:30\s?pm पर$/i);

    const yesterday = formatLastSync(new Date("2026-09-25T17:15:00"), referenceNow);
    expect(yesterday.main).toBe("बीता कल"); // never the ambiguous bare "कल"
    expect(yesterday.combined).toMatch(/^बीते कल 5:15/);

    expect(formatLastSync(new Date("2026-09-05T12:00:00"), referenceNow).main).toBe(
      "3 सप्ताह पहले"
    );
    expect(formatLastSync(new Date("2026-06-23T12:00:00"), referenceNow).main).toBe("3 महीने पहले");
    expect(formatLastSync(null).main).toBe("कभी नहीं");
    expect(formatLastSync(new Date("2026-09-05T12:00:00"), referenceNow).sub).toMatch(/2026/);
  });
});
