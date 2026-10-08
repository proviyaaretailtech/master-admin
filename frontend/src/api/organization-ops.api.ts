import { httpGet, httpPatch, httpPost, money, num, str, toPage } from "./_http";
import type { Money, Page, Row } from "./_http";

export interface OrgLocationInput {
  name: string;
  city?: string;
  address?: string;
}
export interface CreateOrganizationOpsPayload {
  business_name: string;
  domain: string;
  email: string;
  phone_number: string;
  plan_code: string;
  owner_email: string;
  locations: OrgLocationInput[];
  ordering_open: boolean;
}

export interface Org360 {
  id: string;
  business_name: string;
  status: string;
  domain?: string;
  email?: string;
  phone_number?: string;
  created_at?: string;
  archived_at?: string | null;
  ordering: { accepting: boolean; reason?: string | null; changed_at?: string | null };
  plan?: { code: string; name?: string; status?: string; since?: string | null } | null;
  /** The 360 read model carries member COUNTS, not a member list. */
  member_counts?: { active: number; total: number };
  members: Array<{ id: string; name: string; email: string; role?: string; status?: string }>;
  locations: Array<{ id: string; name: string; city?: string; status?: string }>;
  open_orders?: number;
  orders_30d?: number;
  gmv_30d?: Money;
  recent_orders?: Array<{
    id: string;
    number?: string;
    status: string;
    total?: Money;
    created_at: string;
  }>;
  audit?: Array<{ id: string; action: string; actor?: string; created_at: string }>;
}

export interface Entitlements {
  plan_code?: string;
  modules: Array<{ key: string; name?: string; enabled: boolean; source?: string }>;
  limits?: Array<{ key: string; name?: string; limit: number | null; used?: number }>;
}

export interface Invitation {
  id: string;
  organization_id: string;
  organization_name?: string;
  email: string;
  role_slug: string;
  status: string;
  created_at?: string;
  expires_at?: string | null;
}

const reasonBody = (reason: string) => ({ reason });
const sumValues = (v: unknown): number =>
  v && typeof v === "object"
    ? Object.values(v as Row).reduce<number>((a, x) => a + num(x), 0)
    : num(v);

export function mapOrg360(r: Row): Org360 {
  const o = (r.organization ?? {}) as Row;
  const sub = r.subscription as Row | null;
  const ord = (r.ordering ?? {}) as Row;
  const orders = (r.orders ?? {}) as Row;
  const users = (r.users ?? {}) as Row;
  return {
    id: String(o.id),
    business_name: String(o.name ?? ""),
    status: String(o.control_status ?? o.status ?? ""),
    domain: str(o.business_domain),
    email: str(o.contact_email),
    phone_number: str(o.contact_phone),
    created_at: str(o.created_at),
    archived_at: (o.archived_at as string | null) ?? null,
    ordering: {
      accepting: ord.accepting === true,
      changed_at: (ord.updated_at as string | null) ?? null,
    },
    plan: sub
      ? {
          code: String(sub.plan_code),
          name: str(sub.plan_name),
          status: str(sub.status),
          since: str(sub.current_period_start) ?? null,
        }
      : null,
    member_counts: { active: num(users.active), total: num(users.total) },
    members: [],
    locations: ((r.locations as Row[]) ?? []).map((l) => ({
      id: String(l.id),
      name: String(l.name),
      city: str(l.area),
      status: str(l.status),
    })),
    open_orders: sumValues(orders.open),
    orders_30d: num(orders.orders_30d),
    gmv_30d: money(orders.gmv_30d_minor, orders.currency_code),
    recent_orders: [],
    audit: ((r.recent_audit as Row[]) ?? []).map((a) => ({
      id: String(a.id),
      action: String(a.action),
      actor: str(a.actor_user_id),
      created_at: String(a.created_at),
    })),
  };
}

export const organizationOpsApi = {
  create: (p: CreateOrganizationOpsPayload) =>
    httpPost("/organizations", {
      business_name: p.business_name,
      domain: p.domain,
      email: p.email,
      phone_number: p.phone_number,
      plan_code: p.plan_code,
      owner_email: p.owner_email,
      locations: p.locations.map((l) => ({ name: l.name, ...(l.city ? { area: l.city } : {}) })),
      ordering_open: p.ordering_open,
      // the backend only opens ordering for an Active organization
      ...(p.ordering_open ? { status: "Active" } : {}),
    }),
  setOrdering: (id: string, accepting: boolean, reason: string) =>
    httpPatch(`/organizations/${id}/ordering`, { accepting, reason }),
  suspend: (id: string, reason: string) =>
    httpPost(`/organizations/${id}/suspend`, reasonBody(reason)),
  reactivate: (id: string, reason: string) =>
    httpPost(`/organizations/${id}/reactivate`, reasonBody(reason)),
  archive: (id: string, reason: string) =>
    httpPost(`/organizations/${id}/archive`, reasonBody(reason)),
  restore: (id: string, reason: string) =>
    httpPost(`/organizations/${id}/restore`, reasonBody(reason)),
  get360: async (id: string) => mapOrg360(await httpGet<Row>(`/organizations/${id}/360`)),
  changePlan: (id: string, plan_code: string, reason: string) =>
    httpPost(`/organizations/${id}/subscription`, { plan_code, reason }),
  async getEntitlements(id: string): Promise<Entitlements> {
    const r = await httpGet<Row>(`/organizations/${id}/entitlements`);
    const e = (r.entitlements ?? {}) as Row;
    const mods = Array.isArray(e.modules) ? (e.modules as unknown[]) : [];
    return {
      plan_code: str(e.plan_code),
      modules: mods.map((m) => ({ key: String(m), enabled: true })),
    };
  },
};

const mapInvitation = (i: Row): Invitation => ({
  id: String(i.id),
  organization_id: String(i.organization_id),
  organization_name: str(i.organization_name),
  email: String(i.email),
  role_slug: String(i.role_slug ?? i.role_name ?? ""),
  status: String(i.status),
  created_at: str(i.created_at),
  expires_at: (i.expires_at as string | null) ?? null,
});

export const invitationApi = {
  list: async (
    p: { org?: string; status?: string; page?: number } = {}
  ): Promise<Page<Invitation>> => {
    const pg = toPage<Row>(await httpGet("/invitations", p), "invitations");
    return { ...pg, items: pg.items.map(mapInvitation) };
  },
  create: (b: { organization_id: string; email: string; role_slug: string }) =>
    httpPost("/invitations", b),
  revoke: (id: string) => httpPost(`/invitations/${id}/revoke`),
  resend: (id: string) => httpPost(`/invitations/${id}/resend`),
};
