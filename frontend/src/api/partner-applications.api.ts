import { httpGet, httpPost, num, str, toPage } from "./_http";
import type { Page, Row } from "./_http";

/** ol_partner_applications.status (database migration 0335). */
export const APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "reviewing",
  "approved",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationDecision = "approve" | "reject";

export interface PartnerApplicationRow {
  id: string;
  reference: string;
  status: string;
  business_name: string;
  partner_type?: string;
  category?: string;
  categories: string[];
  city_id?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  organization_id?: string;
  organization_name?: string;
  created_at?: string;
}
export interface PartnerApplication extends PartnerApplicationRow {
  source?: string;
  city_name?: string;
  business_type?: string;
  category_family?: string;
  subcategories: string[];
  outlets?: number;
  address?: string;
  pin_code?: string;
  whatsapp_ok?: boolean;
  gstin?: string;
  fssai?: string;
  services: string[];
  own_delivery?: boolean;
  notes?: string;
  consent_version?: string;
  consent_at?: string;
  organization_status?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_note?: string;
  applicant_user_id?: string;
  applicant_login_email?: string;
  applicant_login_confirmed?: boolean;
  updated_at?: string;
  /** When the application names no login: the login an approval would link by email. */
  login_match: { found: boolean; confirmed: boolean } | null;
  history: Array<{ id: string; action: string; created_at: string }>;
}
export interface DecisionResult {
  status: string;
  organization_id?: string | null;
  owner_membership?: boolean;
  invitation_id?: string | null;
  replayed?: boolean;
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

const mapRow = (r: Row): PartnerApplicationRow => ({
  id: String(r.id),
  reference: String(r.reference ?? ""),
  status: String(r.status ?? ""),
  business_name: String(r.business_name ?? ""),
  partner_type: str(r.partner_type),
  category: str(r.category),
  categories: list(r.categories).length
    ? list(r.categories)
    : r.category
      ? [String(r.category)]
      : [],
  city_id: str(r.city_id),
  owner_name: str(r.owner_name),
  phone: str(r.phone),
  email: str(r.email),
  organization_id: str(r.organization_id),
  organization_name: str(r.organization_name),
  created_at: str(r.created_at),
});

export const partnerApplicationApi = {
  list: async (
    p: { status?: string; q?: string; page?: number } = {}
  ): Promise<Page<PartnerApplicationRow> & { counts: Record<string, number> }> => {
    const raw = await httpGet<Row>("/partner-applications", p);
    const pg = toPage<Row>(raw, "applications");
    const counts = (raw.counts ?? {}) as Record<string, unknown>;
    return {
      ...pg,
      items: pg.items.map(mapRow),
      counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, num(v)])),
    };
  },
  async get(id: string): Promise<PartnerApplication> {
    const r = await httpGet<Row>(`/partner-applications/${id}`);
    const a = (r.application ?? {}) as Row;
    return {
      ...mapRow(a),
      source: str(a.source),
      city_name: str(a.city_name),
      business_type: str(a.business_type),
      category_family: str(a.category_family),
      subcategories: list(a.subcategories),
      outlets: a.outlets === null || a.outlets === undefined ? undefined : num(a.outlets),
      address: str(a.address),
      pin_code: str(a.pin_code),
      whatsapp_ok: a.whatsapp_ok === true,
      gstin: str(a.gstin),
      fssai: str(a.fssai),
      services: list(a.services),
      own_delivery: a.own_delivery === true,
      notes: str(a.notes),
      consent_version: str(a.consent_version),
      consent_at: str(a.consent_at),
      organization_status: str(a.organization_status),
      reviewed_by_name: str(a.reviewed_by_name),
      reviewed_at: str(a.reviewed_at),
      review_note: str(a.review_note),
      applicant_user_id: str(a.applicant_user_id),
      applicant_login_email: str(a.applicant_login_email),
      applicant_login_confirmed: a.applicant_login_confirmed === true,
      updated_at: str(a.updated_at),
      login_match: (r.login_match as PartnerApplication["login_match"]) ?? null,
      history: ((r.history as Row[]) ?? []).map((h) => ({
        id: String(h.id),
        action: String(h.action),
        created_at: String(h.created_at),
      })),
    };
  },
  decide: async (
    id: string,
    decision: ApplicationDecision,
    reason: string
  ): Promise<DecisionResult> => {
    const r = await httpPost<Row>(
      `/partner-applications/${id}/${decision}`,
      reason ? { reason } : {}
    );
    return (r.result ?? {}) as DecisionResult;
  },
};
