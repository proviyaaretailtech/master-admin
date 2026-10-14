import { httpGet, httpPost, money, num, str, toPage } from "./_http";
import type { Money, Page, Row } from "./_http";

/** ol_order_holds.status (database migration 0331). */
export const HOLD_STATUSES = ["held", "released", "rejected"] as const;
export type HoldDecision = "release" | "reject";

/** One reason the order was held (One Local server/order-risk.ts): a code plus the numbers behind it. */
export interface HoldReason {
  code: string;
  item?: string;
  qty?: number;
  limit?: number;
  recent?: number;
  [k: string]: unknown;
}
export interface OrderHoldRow {
  id: string;
  order_id: string;
  status: string;
  reasons: HoldReason[];
  created_at: string;
  decided_at?: string;
  decided_by_name?: string;
  note?: string;
  order_status?: string;
  payment_method?: string;
  payment_status?: string;
  total: Money;
  city_id?: string;
  store_name?: string;
  organization_name?: string;
  item_lines: number;
  item_qty: number;
}
export interface OrderHold extends OrderHoldRow {
  pos_order_id?: string;
  items: Array<{ name: string; qty: number; line_total?: Money }>;
}

const mapRow = (r: Row): OrderHoldRow => ({
  id: String(r.id),
  order_id: String(r.order_id),
  status: String(r.status),
  reasons: Array.isArray(r.reasons) ? (r.reasons as HoldReason[]) : [],
  created_at: String(r.created_at),
  decided_at: str(r.decided_at),
  decided_by_name: str(r.decided_by_name),
  note: str(r.note),
  order_status: str(r.order_status),
  payment_method: str(r.payment_method),
  payment_status: str(r.payment_status),
  total: money(r.total_minor, r.currency_code),
  city_id: str(r.city_id),
  store_name: str(r.store_name),
  organization_name: str(r.organization_name),
  item_lines: num(r.item_lines),
  item_qty: num(r.item_qty),
});

export const orderHoldApi = {
  list: async (
    p: { status?: string; q?: string; page?: number } = {}
  ): Promise<Page<OrderHoldRow> & { counts: Record<string, number> }> => {
    const raw = await httpGet<Row>("/order-holds", p);
    const pg = toPage<Row>(raw, "holds");
    const counts = (raw.counts ?? {}) as Record<string, unknown>;
    return {
      ...pg,
      items: pg.items.map(mapRow),
      counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, num(v)])),
    };
  },
  async get(id: string): Promise<OrderHold> {
    const r = await httpGet<Row>(`/order-holds/${id}`);
    const h = (r.hold ?? {}) as Row;
    return {
      ...mapRow(h),
      pos_order_id: str(h.pos_order_id),
      items: ((r.items as Row[]) ?? []).map((i) => ({
        name: String(i.name),
        qty: num(i.qty),
        line_total:
          i.line_total_minor === null || i.line_total_minor === undefined
            ? undefined
            : money(i.line_total_minor, h.currency_code),
      })),
    };
  },
  decide: (id: string, decision: HoldDecision, reason: string) =>
    httpPost(`/order-holds/${id}/${decision}`, { reason }),
};
