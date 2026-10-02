import { describe, it, expect } from "vitest";
import en from "../i18n/locales/en.json";
import hi from "../i18n/locales/hi.json";

type Tree = { [k: string]: string | Tree };
const flatten = (obj: Tree, prefix = "", out: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else flatten(v, key, out);
  }
  return out;
};

const enFlat = flatten(en as Tree);
const hiFlat = flatten(hi as Tree);
const tokens = (s: string) =>
  [...s.matchAll(/\{\{\s*[-\w.]+\s*(?:,[^}]*)?\}\}|<\/?\d+>|\$t\([^)]*\)/g)]
    .map((m) => m[0].replace(/\s+/g, ""))
    .sort()
    .join("|");

describe("catalogue parity (en <-> hi)", () => {
  it("has a non-trivial catalogue namespaced by feature", () => {
    for (const ns of [
      "common",
      "status",
      "errors",
      "auth",
      "orgs",
      "locations",
      "plans",
      "packs",
      "addons",
      "modules",
      "roles",
      "users",
      "settings",
      "nav",
    ]) {
      expect(Object.keys(en), `namespace ${ns}`).toContain(ns);
      expect(Object.keys(hi), `namespace ${ns} (hi)`).toContain(ns);
    }
    expect(Object.keys(enFlat).length).toBeGreaterThan(500);
  });

  it("every key in en exists in hi, and vice versa", () => {
    const missingInHi = Object.keys(enFlat).filter((k) => !(k in hiFlat));
    const missingInEn = Object.keys(hiFlat).filter((k) => !(k in enFlat));
    expect(missingInHi).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it("no Hindi value is empty or identical to its own key", () => {
    const bad = Object.entries(hiFlat)
      .filter(([k, v]) => v.trim() === "" || v.trim() === k || v.trim() === k.split(".").pop())
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it("placeholders ({{count}}, <1>tags</1>, $t()) match between en and hi", () => {
    const bad = Object.keys(enFlat)
      .filter((k) => k in hiFlat && tokens(enFlat[k]) !== tokens(hiFlat[k]))
      .map((k) => `${k}: en=${enFlat[k]} | hi=${hiFlat[k]}`);
    expect(bad).toEqual([]);
  });

  it("plural keys come in _one/_other pairs in both languages", () => {
    for (const flat of [enFlat, hiFlat]) {
      const bases = new Set(
        Object.keys(flat)
          .filter((k) => /_(one|other)$/.test(k))
          .map((k) => k.replace(/_(one|other)$/, ""))
      );
      for (const b of bases) {
        expect(flat, `${b}_one`).toHaveProperty([`${b}_one`]);
        expect(flat, `${b}_other`).toHaveProperty([`${b}_other`]);
      }
    }
  });

  it("Hindi uses Latin digits and the glossary's core terms", () => {
    expect(hiFlat["common.save"]).toBe("सहेजें");
    expect(hiFlat["common.cancel"]).toBe("रद्द करें");
    expect(hiFlat["common.delete"]).toBe("हटाएँ");
    expect(hiFlat["status.active"]).toBe("सक्रिय");
    expect(hiFlat["status.published"]).toBe("प्रकाशित");
    expect(hiFlat["status.retired"]).toBe("बंद किया गया");
    expect(Object.values(hiFlat).some((v) => /[०-९]/.test(v))).toBe(false);
  });

  it("no English value contains a leaked key name pattern", () => {
    const bad = Object.entries(enFlat).filter(([, v]) => /^[a-z]+(\.[a-zA-Z_]+){2,}$/.test(v));
    expect(bad).toEqual([]);
  });
});
