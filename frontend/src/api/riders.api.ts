import { httpGet, httpPost, money, num, str, toPage } from "./_http";
import type { Money, Page, Row } from "./_http";

export type RiderAction = "approve" | "reject" | "suspend" | "reactivate";

export interface RiderRow {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  status: string;
  kyc_status?: string;
  online?: boolean;
  created_at?: string;
}
export interface Rider360 extends RiderRow {
  vehicle?: string;
  rating?: number | null;
  deliveries_total?: number;
  wallet_balance?: Money;
  cash_in_hand?: Money;
  cash_limit?: Money;
  documents?: Array<{ type: string; status: string }>;
  history?: Array<{
    id: string;
    action: string;
    reason?: string | null;
    actor?: string;
    created_at: string;
  }>;
}
export interface CashDeposit {
  id: string;
  rider_id: string;
  rider_name?: string;
  amount: Money;
  status: string;
  reference?: string | null;
  created_at: string;
}

const mapRider = (r: Row): RiderRow => ({
  id: String(r.id),
  name: String(r.full_name ?? r.name ?? ""),
  phone: str(r.phone),
  city: str(r.city_id),
  status: String(r.status),
  online: r.online === true,
  created_at: str(r.created_at),
});

export const riderApi = {
  list: async (
    p: { status?: string; city?: string; q?: string; page?: number } = {}
  ): Promise<Page<RiderRow>> => {
    const { city, ...rest } = p;
    const pg = toPage<Row>(await httpGet("/riders", { ...rest, city }), "riders");
    return { ...pg, items: pg.items.map(mapRider) };
  },
  async get(id: string): Promise<Rider360> {
    const r = await httpGet<Row>(`/riders/${id}`);
    const rider = (r.rider ?? {}) as Row;
    const cash = (r.cash ?? {}) as Row;
    const earnings = ((r.earnings as Row[]) ?? []).filter((e) => e.kind !== undefined);
    return {
      ...mapRider(rider),
      vehicle: str(rider.vehicle),
      deliveries_total: ((r.recent_jobs as Row[]) ?? []).length,
      cash_in_hand:
        cash.in_hand_minor !== undefined
          ? money(cash.in_hand_minor, cash.currency_code)
          : undefined,
      cash_limit: rider.cash_limit_minor !== undefined ? money(rider.cash_limit_minor) : undefined,
      wallet_balance: earnings.length
        ? money(
            earnings.reduce((a, e) => a + num(e.unpaid_minor), 0),
            earnings[0].currency_code
          )
        : undefined,
      documents: ((r.documents as Row[]) ?? []).map((d) => ({
        type: String(d.kind),
        status: String(d.status),
      })),
      history: [],
    };
  },
  act: (id: string, action: RiderAction, reason: string) =>
    httpPost(`/riders/${id}/${action}`, reason ? { reason } : {}),
  deposits: async (p: { status?: string } = {}): Promise<Page<CashDeposit>> => {
    const pg = toPage<Row>(await httpGet("/rider-cash-deposits", p), "deposits");
    return {
      ...pg,
      items: pg.items.map((d) => ({
        id: String(d.id),
        rider_id: String(d.rider_id),
        rider_name: str(d.rider_name),
        amount: money(d.amount_minor, d.currency_code),
        status: String(d.status),
        reference: (d.reference as string | null) ?? null,
        created_at: String(d.created_at),
      })),
    };
  },
  confirmDeposit: (id: string, note: string) =>
    httpPost(`/rider-cash-deposits/${id}/confirm`, note ? { note } : {}),
  rejectDeposit: (id: string, note: string) =>
    httpPost(`/rider-cash-deposits/${id}/reject`, { note }),
};
