import { apiClient } from "../lib/api-client";

export type Params = Record<string, string | number | boolean | null | undefined>;

/** Drops empty / "all" filters so they never reach the query string. */
export function cleanParams(p: Params = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === "" || v === "all") continue;
    out[k] = v;
  }
  return out;
}

export async function httpGet<T>(url: string, params?: Params): Promise<T> {
  const res = await apiClient.get<T>(url, { params: cleanParams(params) });
  return res.data;
}
export async function httpPost<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.post<T>(url, body ?? {});
  return res.data;
}
export async function httpPut<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.put<T>(url, body ?? {});
  return res.data;
}
export async function httpPatch<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.patch<T>(url, body ?? {});
  return res.data;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * List endpoints are not all specified to the same shape. Accept a bare array, `{items}`,
 * `{data}` or `{<key>: []}`, plus `{pagination}` / `{total,page,limit}`; always return a Page.
 */
export function toPage<T>(raw: unknown, key?: string): Page<T> {
  const r = (raw ?? {}) as Record<string, unknown>;
  let items: unknown[] = [];
  if (Array.isArray(raw)) items = raw;
  else if (key && Array.isArray(r[key])) items = r[key] as unknown[];
  else if (Array.isArray(r.items)) items = r.items;
  else if (Array.isArray(r.data)) items = r.data;
  else {
    const firstArray = Object.values(r).find(Array.isArray);
    if (firstArray) items = firstArray as unknown[];
  }
  const pg = ((r.pagination ?? r.meta ?? r) as Record<string, unknown>) || {};
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const limit = num(pg.limit ?? pg.page_size, items.length || 20);
  const total = num(pg.total ?? pg.count, items.length);
  return {
    items: items as T[],
    total,
    page: num(pg.page, 1),
    limit,
    totalPages: num(pg.totalPages ?? pg.total_pages, Math.max(1, Math.ceil(total / (limit || 1)))),
  };
}

/** Money on the wire: integer minor units plus ISO currency. */
export interface Money {
  amount_minor: number;
  currency: string;
}

/** bigint / numeric columns can arrive as JSON numbers or strings. */
export const num = (v: unknown, d = 0): number => {
  if (v === null || v === undefined || v === "") return d;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};
export const money = (minor: unknown, currency: unknown = "INR"): Money => ({
  amount_minor: num(minor),
  currency: typeof currency === "string" && currency ? currency : "INR",
});
export type Row = Record<string, unknown>;
export const str = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : String(v);

/** The UI takes inclusive whole days; the backend filters are half-open [from, to), so `to` becomes the next day. */
export const nextDay = (d?: string): string | undefined => {
  if (!d) return undefined;
  const t = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return d;
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};
