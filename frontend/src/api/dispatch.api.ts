import { httpGet, httpPost, str, toPage } from "./_http";
import type { Page, Row } from "./_http";

export interface DispatchJob {
  id: string;
  order_id?: string;
  order_number?: string;
  organization_name?: string;
  status: string;
  rider_id?: string | null;
  rider_name?: string | null;
  pickup?: string;
  drop?: string;
  exception_id?: string | null;
  exception_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}
export interface DispatchJobDetail extends DispatchJob {
  events?: Array<{ id: string; at: string; status: string; note?: string | null }>;
}

/** Outcomes the backend accepts for an exception. */
export const EXCEPTION_OUTCOMES = ["resume", "reassign", "return", "fail", "cancel"];
/** Cancel reason codes the backend accepts. */
export const CANCEL_CODES = [
  "restaurant_rejected",
  "restaurant_timed_out",
  "customer_cancelled",
  "other",
];

const mapJob = (j: Row): DispatchJob => ({
  id: String(j.id),
  order_id: str(j.ol_order_id ?? j.pos_order_id),
  order_number: str(j.order_no),
  organization_name: str(j.organization_name),
  status: String(j.status),
  rider_id: (j.rider_id as string | null) ?? null,
  rider_name: (j.rider_name as string | null) ?? null,
  pickup: str(j.pickup_name),
  drop: str(j.drop_area),
  exception_reason: str(j.exception_kind) ?? null,
  created_at: str(j.created_at),
  updated_at: str(j.updated_at),
});

export const dispatchApi = {
  jobs: async (
    p: { status?: string; org?: string; page?: number } = {}
  ): Promise<Page<DispatchJob>> => {
    const pg = toPage<Row>(await httpGet("/dispatch/jobs", p), "jobs");
    return { ...pg, items: pg.items.map(mapJob) };
  },
  async job(id: string): Promise<DispatchJobDetail> {
    const r = await httpGet<Row>(`/dispatch/jobs/${id}`);
    const exceptions = ((r.exceptions as Row[]) ?? []).filter((x) => x.status === "open");
    const open = exceptions[0];
    return {
      ...mapJob((r.job ?? {}) as Row),
      exception_id: open ? String(open.id) : null,
      exception_reason: open ? String(open.note ?? open.kind) : null,
      events: ((r.timeline as Row[]) ?? []).map((e) => ({
        id: String(e.id),
        at: String(e.created_at),
        status: String(e.kind),
        note: null,
      })),
    };
  },
  reassign: (id: string, reason: string) => httpPost(`/dispatch/jobs/${id}/reassign`, { reason }),
  cancel: (id: string, reason: string, code = "other") =>
    httpPost(`/dispatch/jobs/${id}/cancel`, { reason, code }),
  resolveException: (id: string, outcome: string, note: string) =>
    httpPost(`/dispatch/exceptions/${id}/resolve`, { outcome, note }),
};
