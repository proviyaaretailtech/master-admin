/**
 * The screens ask the permission model about feature/action ids (FEAT in lib/master-features.ts,
 * can("feat_x", "action"), featureId="feat_x"). Every one of them must exist in the backend permission
 * registry, which is also the catalogue the role editor offers (GET /roles/catalog). An id that is not
 * there could never be granted, so only super admins would ever see that screen or button.
 *
 * The registry is read as text from the backend source in this repository (not imported, so the
 * frontend build stays independent of the backend); the test is skipped when the frontend is checked
 * out on its own.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FEAT } from "../lib/master-features";

const SRC = path.resolve(__dirname, "..");
const REGISTRY = path.resolve(SRC, "../../backend/src/utils/permission-adapter.ts");
const hasRegistry = fs.existsSync(REGISTRY);

/** feature id -> action keys, parsed from DEFAULT_FEATURES_TEMPLATE. */
function backendRegistry(): Map<string, Set<string>> {
  const text = fs.readFileSync(REGISTRY, "utf8");
  const start = text.indexOf("export const DEFAULT_FEATURES_TEMPLATE");
  const body = text.slice(start, text.indexOf("\n];", start));
  const out = new Map<string, Set<string>>();
  let current: Set<string> | null = null;
  for (const m of body.matchAll(/\b(id|key):\s*"([a-z0-9_]+)"/g)) {
    if (m[1] === "id") {
      current = new Set();
      out.set(m[2], current);
    } else current?.add(m[2]);
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "test" ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

/** Every (feature, action?) the frontend asks about, with where it was found. */
function frontendChecks(): Array<{ feature: string; action?: string; where: string }> {
  const out: Array<{ feature: string; action?: string; where: string }> = [];
  for (const group of Object.values(FEAT) as Array<Record<string, string>>) {
    for (const [k, v] of Object.entries(group)) {
      if (k !== "id") out.push({ feature: group.id, action: v, where: "master-features.ts" });
    }
  }
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, "utf8");
    const where = path.relative(SRC, file);
    for (const m of text.matchAll(/\bcan\(\s*"(feat_[a-z0-9_]+)"\s*,\s*"([a-z0-9_]+)"/g)) {
      out.push({ feature: m[1], action: m[2], where });
    }
    for (const m of text.matchAll(/featureId[=:]\s*"(feat_[a-z0-9_]+)"/g)) {
      out.push({ feature: m[1], where });
    }
  }
  return out;
}

describe.skipIf(!hasRegistry)("frontend permission ids match the backend registry", () => {
  it("parses the registry (sanity)", () => {
    const reg = backendRegistry();
    expect(reg.size).toBeGreaterThan(20);
    expect(reg.get("feat_orders")?.has("decide_order_holds")).toBe(true);
    expect(reg.get("feat_partner_review")?.has("approve_partner")).toBe(true);
  });

  it("every feature/action the screens check is grantable", () => {
    const reg = backendRegistry();
    const checks = frontendChecks();
    expect(checks.length).toBeGreaterThan(30);
    const missing = checks
      .filter((c) => !reg.has(c.feature) || (c.action && !reg.get(c.feature)!.has(c.action)))
      .map((c) => `${c.feature}${c.action ? `.${c.action}` : ""} (${c.where})`);
    expect([...new Set(missing)]).toEqual([]);
  });
});
