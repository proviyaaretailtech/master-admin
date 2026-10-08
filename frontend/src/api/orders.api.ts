import { httpGet, money, nextDay, str, toPage } from "./_http";
import type { Money, Page, Row } from "./_http";

export interface OrderRow {
  id: string;
  number?: string;
  organization_id?: string;
  organization_name?: string;
  channel?: string;
  status: string;
  total?: Money;
  created_at: string;
}
export interface OrderEvent {
  id: string;
  at: string;
  kind: string;
  status?: string;
  actor?: string;
  note?: string | null;
}
export interface Order360 extends OrderRow {
  customer_name?: string;
  items?: Array<{ name: string; quantity: number; total?: Money }>;
  payment_status?: string;
  delivery_status?: string;
  order_trace?: Record<string, unknown> | null;
  timeline: OrderEvent[];
}

const mapOrder = (o: Row): OrderRow => ({
  id: String(o.id),
  number: str(o.display_no),
  organization_id: str(o.organization_id),
  organization_name: str(o.organization_name),
  channel: str(o.channel),
  status: String(o.status),
  total: o.total_minor !== undefined ? money(o.total_minor, o.currency_code) : undefined,
  created_at: String(o.created_at),
});

export const orderApi = {
  list: async (
    p: {
      org?: string;
      status?: string;
      channel?: string;
      q?: string;
      from?: string;
      to?: string;
      page?: number;
    } = {}
  ): Promise<Page<OrderRow>> => {
    const pg = toPage<Row>(await httpGet("/orders", { ...p, to: nextDay(p.to) }), "orders");
    return { ...pg, items: pg.items.map(mapOrder) };
  },
  async get(id: string): Promise<Order360> {
    const r = await httpGet<Row>(`/orders/${id}`);
    const o = (r.order ?? {}) as Row;
    const pays = (r.payments as Row[]) ?? [];
    const jobs = (r.delivery_jobs as Row[]) ?? [];
    const { timeline: _t, ...trace } = r;
    void _t;
    return {
      ...mapOrder(o),
      customer_name: str(o.customer_name),
      payment_status: pays.length ? "paid" : str(o.paid_at) ? "paid" : undefined,
      delivery_status: jobs[0] ? str(jobs[0].status) : undefined,
      items: ((r.items as Row[]) ?? []).map((i) => ({
        name: String(i.name ?? i.item_name ?? ""),
        quantity: Number(i.qty ?? i.quantity ?? 1),
        total: i.total_minor !== undefined ? money(i.total_minor, o.currency_code) : undefined,
      })),
      order_trace: trace,
      timeline: ((r.timeline as Row[]) ?? []).map((e, i) => ({
        id: `${i}`,
        at: String(e.at),
        kind: String(e.kind),
        status: str((e.detail as Row | undefined)?.status),
        note: e.source ? String(e.source) : null,
      })),
    };
  },
};
