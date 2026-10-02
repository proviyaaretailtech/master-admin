/**
 * Dev-only pseudo-locale "en-XA": every letter is replaced by an accented look-alike and each
 * string is padded by ~30%. Switch to it (Settings > Language, dev builds only, or
 * `?lang=en-XA`-free: just pick it in the list) to spot
 *   - hard-coded English that never changed (it stays plain),
 *   - truncated / overflowing layouts (padding simulates Hindi's longer text; the [ ] brackets
 *     show where a label is cut off).
 * Placeholders ({{count}}), $t() nesting, <1>tags</1> and HTML entities are preserved.
 */

const FROM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const TO = "àƀçðéƒĝĥîĵķļɱñôþǫŕšţûṽŵẋýžÀßÇÐÉƑĜĤÎĴĶĻƜÑÔÞǪŔŠŢÛṼŴẊÝŽ";
const MAP = new Map<string, string>(Array.from(FROM).map((c, i) => [c, Array.from(TO)[i] ?? c]));

/** Matches things that must pass through untouched. */
const PROTECTED = /(\{\{[^}]*\}\}|\$t\([^)]*\)|<\/?[0-9a-z]+[^>]*>|&[a-z#0-9]+;)/gi;

const PAD_WORD = "ẋẋẋ";

export function pseudoLocalize(input: string): string {
  if (!input) return input;
  const parts = input.split(PROTECTED);
  const body = parts
    .map((part, i) =>
      i % 2 === 1
        ? part
        : Array.from(part)
            .map((c) => MAP.get(c) ?? c)
            .join("")
    )
    .join("");
  const visibleLength = input.replace(PROTECTED, "").length;
  const extra = Math.max(2, Math.ceil(visibleLength * 0.3));
  const padding = (" " + PAD_WORD)
    .repeat(Math.ceil(extra / (PAD_WORD.length + 1)))
    .slice(0, extra + 1);
  return `[${body}${padding}]`;
}

type Catalogue = { [key: string]: string | Catalogue };

export function pseudoLocalizeCatalog(source: Catalogue): Catalogue {
  const out: Catalogue = {};
  for (const [k, v] of Object.entries(source)) {
    out[k] = typeof v === "string" ? pseudoLocalize(v) : pseudoLocalizeCatalog(v);
  }
  return out;
}
