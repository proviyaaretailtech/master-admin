import { httpGet, money, nextDay, num } from "./_http";
import type { Money, Row } from "./_http";

export interface DashboardSummary {
  orders_today: number;
  gmv: Money;
  riders_online: number;
  active_deliveries: number;
  failed_deliveries: number;
  late_deliveries: number;
  pending_approvals: number;
  open_exceptions: number;
  settlements_pending: number;
  payouts_pending: number;
  failed_payments: number;
}

/** A count that the server may send as a number or as {count|total}. */
const count = (v: unknown): number =>
  v && typeof v === "object" ? num((v as Row).count ?? (v as Row).total) : num(v);

export const dashboardApi = {
  async summary(p: { from?: string; to?: string } = {}): Promise<DashboardSummary> {
    const r = await httpGet<Row>("/dashboard/summary", {
      from: p.from,
      to: p.to ? nextDay(p.to) : undefined,
    });
    const s = (r.summary ?? r) as Row;
    return {
      orders_today: num(s.orders_count),
      gmv: money(s.gmv_minor, s.currency_code),
      riders_online: num(s.riders_online),
      active_deliveries: num(s.active_deliveries),
      failed_deliveries: num(s.failed_deliveries),
      late_deliveries: num(s.late_deliveries),
      pending_approvals: num(s.pending_approvals),
      open_exceptions: count(s.open_exceptions),
      settlements_pending: count(s.settlements_pending),
      payouts_pending: count(s.payouts_pending),
      failed_payments: num(s.failed_payments),
    };
  },
};
