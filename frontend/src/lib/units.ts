/**
 * Money helpers for forms: people type rupees, the wire carries integer minor units (paise).
 * Integer string math only; never floating point, so 0.1 + 0.2 style errors cannot reach money.
 */

/** 12345 -> "123.45", 1200 -> "12", null -> "". */
export function minorToMajorString(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "";
  const neg = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const s =
    frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
  return neg ? `-${s}` : s;
}

/** "123.45" -> 12345, "12" -> 1200. Returns null when the text is not a valid amount (max 2 decimals). */
export function majorStringToMinor(text: string): number | null {
  const m = /^\s*(-?)(\d+)(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  const minor = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || "0");
  return m[1] ? -minor : minor;
}

/** Basis points: 250 -> "2.5" (percent); "2.5" -> 250. */
export function bpsToPercentString(bps: number | null | undefined): string {
  if (bps === null || bps === undefined || !Number.isFinite(bps)) return "";
  const neg = bps < 0;
  const abs = Math.abs(Math.round(bps));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const s =
    frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
  return neg ? `-${s}` : s;
}
export function percentStringToBps(text: string): number | null {
  return majorStringToMinor(text);
}

/** Local date -> ISO yyyy-mm-dd (for date inputs) */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);
