import { httpGet, num } from "./_http";
import type { Row } from "./_http";

export type EnvironmentName = "production" | "staging" | "development";
export type HealthState = "ok" | "degraded" | "down" | "unknown";

export interface MeContext {
  user: { id: string; name?: string; email?: string };
  environment: EnvironmentName;
  organizations: Array<{ id: string; name: string }>;
  /** Not part of /me/context: filled per selected organization from the Organization 360. */
  locations: Array<{ id: string; organization_id: string; name: string }>;
}

export interface SystemStatus {
  api?: { status: HealthState };
  db: { status: HealthState; latency_ms?: number };
  queue: { status: HealthState; backlog: number };
  sync: { status: HealthState; lag_seconds?: number };
  pending_approvals: number;
  open_exceptions: number;
  environment?: EnvironmentName;
}

export interface SearchHit {
  id: string;
  label: string;
  sublabel?: string;
  status?: string;
}
export type SearchGroup =
  "organizations" | "riders" | "orders" | "users" | "payouts" | "settlements";
export type SearchResults = Partial<Record<SearchGroup, SearchHit[]>>;

export const SEARCH_GROUPS: SearchGroup[] = [
  "organizations",
  "riders",
  "orders",
  "users",
  "payouts",
  "settlements",
];

/** Server labels: production | local | test | staging ... -> the three badges the UI knows. */
export const toEnvironment = (v: unknown): EnvironmentName => {
  const s = String(v ?? "").toLowerCase();
  return s === "production" ? "production" : s === "staging" ? "staging" : "development";
};

export const shellApi = {
  async getContext(): Promise<MeContext> {
    const r = await httpGet<Row>("/me/context");
    const u = (r.user ?? {}) as Row;
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
    return {
      user: {
        id: String(u.id ?? ""),
        name: name || undefined,
        email: u.email as string | undefined,
      },
      environment: toEnvironment(r.environment),
      organizations: ((r.organizations as Row[]) ?? []).map((o) => ({
        id: String(o.id),
        name: String(o.name),
      })),
      locations: [],
    };
  },
  async orgLocations(orgId: string): Promise<MeContext["locations"]> {
    const r = await httpGet<Row>(`/organizations/${orgId}/360`);
    return ((r.locations as Row[]) ?? []).map((l) => ({
      id: String(l.id),
      organization_id: orgId,
      name: String(l.name),
    }));
  },
  async getSystemStatus(): Promise<SystemStatus> {
    const r = await httpGet<Row>("/system/status");
    const db = (r.db ?? {}) as Row;
    const q = r.queue as Row | null;
    const sy = r.sync as Row | null;
    const backlog = num(q?.backlog);
    return {
      api: { status: "ok" },
      db: {
        status: db.ok === true ? "ok" : db.ok === false ? "down" : "unknown",
        latency_ms: db.latency_ms === undefined ? undefined : num(db.latency_ms),
      },
      queue: {
        status: !q ? "unknown" : backlog > 0 && num(q.oldest_seconds) > 300 ? "degraded" : "ok",
        backlog,
      },
      sync: { status: !sy ? "unknown" : num(sy.failed) > 0 ? "degraded" : "ok" },
      pending_approvals: num(r.pending_approvals),
      open_exceptions: num(r.open_invariant_violations),
      environment: toEnvironment(r.environment),
    };
  },
  async search(q: string): Promise<SearchResults> {
    const r = await httpGet<Row>("/search", { q });
    const groups = (r.results ?? r) as Record<string, Row[]>;
    const out: SearchResults = {};
    for (const g of SEARCH_GROUPS) {
      const list = groups[g];
      if (Array.isArray(list))
        out[g] = list.map((h) => ({
          id: String(h.id),
          label: String(h.label ?? h.id),
          sublabel: (h.sub ?? h.sublabel) as string | undefined,
          status: h.status as string | undefined,
        }));
    }
    return out;
  },
};
