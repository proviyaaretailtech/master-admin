import { httpGet, httpPost, httpPut, num, str, toPage } from "./_http";
import type { Row } from "./_http";

export interface CommissionRule {
  id: string;
  organization_id?: string | null;
  organization_name?: string | null;
  channel?: string | null;
  pct_bps: number;
  fixed_minor: number;
  min_minor: number;
  /** null = no cap */
  max_minor: number | null;
  active: boolean;
  version?: number;
  created_at?: string;
}
export type CommissionRuleInput = Pick<
  CommissionRule,
  "organization_id" | "channel" | "pct_bps" | "fixed_minor" | "min_minor" | "max_minor"
>;

/** Channels the backend accepts. */
export const COMMISSION_CHANNELS = [
  "dine_in",
  "delivery",
  "pickup",
  "online",
  "swiggy",
  "zomato",
  "other",
];

const mapRule = (r: Row): CommissionRule => ({
  id: String(r.id),
  organization_id: (r.organization_id as string | null) ?? null,
  channel: (r.channel as string | null) ?? null,
  pct_bps: num(r.pct_bps),
  fixed_minor: num(r.fixed_minor),
  min_minor: num(r.min_minor),
  max_minor: r.max_minor === null || r.max_minor === undefined ? null : num(r.max_minor),
  active: r.active === true,
  created_at: str(r.created_at),
});

export const commissionApi = {
  list: async () =>
    toPage<Row>(await httpGet("/commission-rules", { limit: 100 }), "rules").items.map(mapRule),
  create: (b: CommissionRuleInput) => httpPost("/commission-rules", b),
  // the backend replaces only the amounts; scope (organization, channel) is fixed for a rule
  update: (id: string, b: CommissionRuleInput) =>
    httpPut(`/commission-rules/${id}`, {
      pct_bps: b.pct_bps,
      fixed_minor: b.fixed_minor,
      min_minor: b.min_minor,
      max_minor: b.max_minor,
    }),
  deactivate: (id: string) => httpPost(`/commission-rules/${id}/deactivate`),
};
