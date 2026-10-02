import { describe, it, expect } from "vitest";
import { pseudoLocalize, pseudoLocalizeCatalog } from "../i18n/pseudo";

describe("pseudo-locale en-XA", () => {
  it("accents letters, wraps in brackets and adds ~30% length", () => {
    const out = pseudoLocalize("Save changes");
    expect(out.startsWith("[")).toBe(true);
    expect(out.endsWith("]")).toBe(true);
    expect(out).not.toContain("Save");
    expect(out.length).toBeGreaterThanOrEqual(Math.ceil("Save changes".length * 1.3));
  });

  it("keeps placeholders, tags, nesting and entities intact", () => {
    const out = pseudoLocalize(
      "Hello {{name}}, you have {{count}} <1>new</1> items &amp; $t(common.ok)"
    );
    expect(out).toContain("{{name}}");
    expect(out).toContain("{{count}}");
    expect(out).toContain("<1>");
    expect(out).toContain("</1>");
    expect(out).toContain("&amp;");
    expect(out).toContain("$t(common.ok)");
  });

  it("transforms a catalogue recursively without changing its shape", () => {
    const out = pseudoLocalizeCatalog({ a: { b: "Open", c_one: "{{count}} item" }, d: "Close" });
    expect(Object.keys(out)).toEqual(["a", "d"]);
    expect((out.a as Record<string, string>).c_one).toContain("{{count}}");
    expect(out.d).not.toContain("Close");
  });
});
