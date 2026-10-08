export type DiffKind = "added" | "removed" | "changed" | "same";
export interface DiffRow {
  key: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Field-level diff of two audit snapshots (top-level keys). Changed rows first, then unchanged. */
export function diffObjects(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
): DiffRow[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  const rows = keys.map<DiffRow>((key) => {
    const inB = key in b;
    const inA = key in a;
    if (inB && !inA) return { key, kind: "removed", before: b[key] };
    if (!inB && inA) return { key, kind: "added", after: a[key] };
    return { key, kind: same(b[key], a[key]) ? "same" : "changed", before: b[key], after: a[key] };
  });
  return [...rows.filter((r) => r.kind !== "same"), ...rows.filter((r) => r.kind === "same")];
}

export const showValue = (v: unknown): string =>
  v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
