import type { TFunction } from "i18next";

/**
 * Codes -> labels. Status words, location types, cadences, etc. travel as CODES and are shown
 * through these helpers; the raw word is never rendered on its own.
 *
 *   statusLabel(t, "Active")            -> "Active" / "सक्रिय"
 *   locationTypeLabel(t, "Cloud Kitchen")
 *   codeLabel(t, "roles.scope", "Platform")   // generic: looks up `roles.scope.platform`
 *
 * The API may send TitleCase words ("Active", "Cloud Kitchen", "Online Ready"); `toCode`
 * normalises them to snake_case codes ("active", "cloud_kitchen", "online_ready").
 */

export function toCode(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** "cloud_kitchen" -> "Cloud kitchen". Only used as a last-resort display for unknown codes. */
export function humanizeCode(raw: string | null | undefined): string {
  const words = String(raw ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/**
 * Look up `${prefix}.${toCode(raw)}`. Unknown codes fall back to a humanised version of the
 * value (never the raw snake_case code) so a new backend value degrades gracefully.
 */
export function codeLabel(t: TFunction, prefix: string, raw: string | null | undefined): string {
  const code = toCode(raw);
  if (!code) return "";
  return t(`${prefix}.${code}`, { defaultValue: humanizeCode(raw) });
}

export const statusLabel = (t: TFunction, raw: string | null | undefined): string =>
  codeLabel(t, "status", raw);

/** Location types: Restaurant, Cloud Kitchen, Delivery Hub, Warehouse, Retail Outlet, Other. */
export const locationTypeLabel = (t: TFunction, raw: string | null | undefined): string =>
  codeLabel(t, "locations.type", raw);

/** Billing cadence: Monthly, Quarterly, Annual, ... */
export const cadenceLabel = (t: TFunction, raw: string | null | undefined): string =>
  codeLabel(t, "common.cadence", raw);
