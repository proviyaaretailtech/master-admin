import { httpGet, httpPost, money, num, nextDay, str, toPage } from "./_http";
import type { Page, Money, Row } from "./_http";

export interface FinanceOverview {
  collected: Money;
  earned: Money;
  owed: Money;
  paid: Money;
}
export interface PaymentRow {
  id: string;
  order_id?: string;
  method?: string;
  status: string;
  amount: Money;
  created_at: string;
}
export interface Settlement {
  id: string;
  organization_id?: string;
  organization_name?: string;
  period_start: string;
  period_end: string;
  status: string;
  net: Money;
  approved_by?: string | null;
  /** The backend does not send this; kept optional for a future field. */
  created_by_me?: boolean;
}
export interface Payout {
  id: string;
  payee_name?: string;
  status: string;
  amount: Money;
  reference?: string | null;
  created_at?: string;
  created_by_me?: boolean;
}
export interface LedgerEntry {
  id: string;
  order_id?: string;
  type: string;
  direction?: "debit" | "credit";
  amount: Money;
  created_at: string;
}
export interface ReconciliationRow {
  id: string;
  label: string;
  status: string;
  expected?: Money;
  actual?: Money;
  difference?: Money;
}
export interface RiderEarning {
  rider_id: string;
  rider_name?: string;
  deliveries: number;
  earned: Money;
  paid: Money;
  owed: Money;
}
type R = { from?: string; to?: string };

const mapSettlement = (s: Row): Settlement => ({
  id: String(s.id),
  organization_id: str(s.organization_id),
  organization_name: str(s.organization_name),
  period_start: String(s.period_start),
  period_end: String(s.period_end),
  status: String(s.status),
  net: money(s.net_minor, s.currency_code),
});

export const financeApi = {
  async overview(p: R = {}): Promise<FinanceOverview> {
    const r = await httpGet<Row>("/finance/overview", { from: p.from, to: nextDay(p.to) });
    const o = (r.overview ?? r) as Row;
    const c = o.currency_code;
    return {
      collected: money(o.collected_net_minor ?? o.collected_minor, c),
      earned: money(o.earned_minor, c),
      owed: money(o.owed_minor, c),
      paid: money(o.paid_minor, c),
    };
  },
  payments: async (p: { page?: number } = {}): Promise<Page<PaymentRow>> => {
    const pg = toPage<Row>(await httpGet("/finance/payments", p), "payments");
    return {
      ...pg,
      items: pg.items.map((x) => ({
        id: String(x.id),
        order_id: str(x.order_id),
        method: str(x.method),
        status: "captured",
        amount: money(x.amount_minor, x.currency_code),
        created_at: String(x.created_at),
      })),
    };
  },
  settlements: async (): Promise<Page<Settlement>> => {
    const pg = toPage<Row>(await httpGet("/finance/settlements"), "settlements");
    return { ...pg, items: pg.items.map(mapSettlement) };
  },
  runSettlement: (b: { organization_id: string; period_start: string; period_end: string }) =>
    httpPost("/finance/settlements/run", b),
  approveSettlement: (id: string) => httpPost(`/finance/settlements/${id}/approve`),
  payouts: async (p: { status?: string } = {}): Promise<Page<Payout>> => {
    const pg = toPage<Row>(await httpGet("/finance/payouts", p), "payouts");
    return {
      ...pg,
      items: pg.items.map((x) => ({
        id: String(x.id),
        payee_name:
          str(x.organization_name) ?? `${String(x.payee_type)} ${String(x.payee_id).slice(0, 8)}`,
        status: String(x.status),
        amount: money(x.amount_minor, x.currency_code),
        reference: (x.reference as string | null) ?? null,
        created_at: str(x.created_at),
      })),
    };
  },
  approvePayout: (id: string) => httpPost(`/finance/payouts/${id}/approve`),
  markPaid: (id: string, reference: string) =>
    httpPost(`/finance/payouts/${id}/mark-paid`, { reference }),
  ledger: async (
    p: { order_id?: string; type?: string; page?: number } = {}
  ): Promise<Page<LedgerEntry>> => {
    const pg = toPage<Row>(await httpGet("/finance/ledger", p), "entries");
    return {
      ...pg,
      items: pg.items.map((x) => ({
        id: `${String(x.source)}:${String(x.id)}`,
        order_id: str(x.order_id),
        type: String(x.entry_type),
        direction: x.direction === "debit" || x.direction === "credit" ? x.direction : undefined,
        amount: money(x.amount_minor, x.currency_code),
        created_at: String(x.created_at),
      })),
    };
  },
  async reconciliation(): Promise<ReconciliationRow[]> {
    const r = await httpGet<Row>("/finance/reconciliation");
    const ex = ((r.payment_exceptions as Row[]) ?? []).map<ReconciliationRow>((x) => ({
      id: `pay:${String(x.id)}`,
      label: String(x.kind),
      status: String(x.status),
      expected:
        x.expected_minor !== null && x.expected_minor !== undefined
          ? money(x.expected_minor)
          : undefined,
      actual:
        x.actual_minor !== null && x.actual_minor !== undefined ? money(x.actual_minor) : undefined,
      difference:
        x.expected_minor != null && x.actual_minor != null
          ? money(num(x.actual_minor) - num(x.expected_minor))
          : undefined,
    }));
    const inv = ((r.invariant_violations as Row[]) ?? []).map<ReconciliationRow>((x) => ({
      id: `inv:${String(x.id)}`,
      label: String(x.code),
      status: "open",
    }));
    return [...ex, ...inv];
  },
  async riderEarnings(): Promise<RiderEarning[]> {
    const pg = toPage<Row>(await httpGet("/finance/rider-earnings"), "rider_earnings");
    return pg.items.map((x) => ({
      rider_id: String(x.rider_id),
      rider_name: str(x.rider_name),
      deliveries: num(x.entries),
      earned: money(x.earned_minor, x.currency_code),
      paid: money(x.paid_minor, x.currency_code),
      owed: money(x.unpaid_minor, x.currency_code),
    }));
  },
};
