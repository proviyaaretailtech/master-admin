/**
 * Self-hosted Noto Sans Devanagari, loaded through the FontFace API only when a Devanagari
 * language is about to be shown. The woff2 files ship inside the build (via the
 * @fontsource package), nothing is fetched from a CDN, and nothing is downloaded for users who
 * stay in English.
 *
 * We load the two weights the UI is built from (regular + bold). Medium/semibold text maps to
 * the nearest of these, which is visually indistinguishable at the sizes used here and halves
 * the download (~100 KB instead of ~210 KB).
 */

export const DEVANAGARI_FAMILY = "Noto Sans Devanagari";

const UNICODE_RANGE =
  "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09";

const FILES: Array<{ weight: string; url: () => Promise<{ default: string }> }> = [
  {
    weight: "400",
    url: () =>
      import("@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff2?url"),
  },
  {
    weight: "700",
    url: () =>
      import("@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2?url"),
  },
];

let inflight: Promise<void> | null = null;
let ready = false;

export const isDevanagariFontReady = (): boolean => ready;

const supportsFontFace = (): boolean =>
  typeof document !== "undefined" && typeof FontFace !== "undefined" && Boolean(document.fonts);

/** Resolves once every face is downloaded AND registered; rejects on any failure (retryable). */
export function ensureDevanagariFont(): Promise<void> {
  if (ready || !supportsFontFace()) return Promise.resolve();
  if (!inflight) {
    inflight = Promise.all(
      FILES.map(async ({ weight, url }) => {
        const href = (await url()).default;
        const face = new FontFace(DEVANAGARI_FAMILY, `url(${href}) format("woff2")`, {
          weight,
          style: "normal",
          display: "swap",
          unicodeRange: UNICODE_RANGE,
        });
        await face.load();
        document.fonts.add(face);
      })
    )
      .then(() => {
        ready = true;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
