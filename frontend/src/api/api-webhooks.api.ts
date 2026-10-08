import { httpGet, httpPost, num, str, toPage } from "./_http";
import type { Page, Row } from "./_http";

export interface ApiApp {
  id: string;
  name: string;
  key_prefix?: string;
  status: string;
  scopes?: string[];
  created_at?: string;
  last_used_at?: string | null;
}
/** Returned by create and rotate only: `api_key` is shown ONCE and never retrievable again. */
export interface ApiAppSecret {
  app: ApiApp;
  api_key: string;
}
export interface WebhookEndpoint {
  id: string;
  name?: string;
  url: string;
  events: string[];
  status: string;
  created_at?: string;
}
export interface WebhookDelivery {
  id: string;
  endpoint_id?: string;
  endpoint_url?: string;
  event: string;
  status: string;
  attempts: number;
  response_code?: number | null;
  next_retry_at?: string | null;
  created_at: string;
}
export interface ApiLog {
  id: string;
  at: string;
  method: string;
  path: string;
  status: number;
  app_name?: string;
}

const mapApp = (a: Row, keys?: Row[]): ApiApp => {
  const ks = keys ?? (a.keys as Row[]) ?? [];
  return {
    id: String(a.id),
    name: String(a.name),
    key_prefix: str(ks[0]?.key_prefix),
    status: String(a.status),
    scopes: (a.scopes as string[]) ?? [],
    created_at: str(a.created_at),
    last_used_at: (a.last_used_at as string | null) ?? null,
  };
};
const secret = (r: Row): ApiAppSecret => ({
  app: mapApp((r.app ?? {}) as Row, (r.keys as Row[]) ?? []),
  api_key: String(r.api_key),
});

export const apiWebhooksApi = {
  apps: async () =>
    toPage<Row>(await httpGet("/api-apps", { limit: 100 }), "apps").items.map((a) => mapApp(a)),
  createApp: async (b: { name: string; scopes?: string[] }) =>
    secret(await httpPost<Row>("/api-apps", { name: b.name, scopes: b.scopes ?? [] })),
  rotateApp: async (id: string) => secret(await httpPost<Row>(`/api-apps/${id}/rotate`, {})),
  revokeApp: (id: string, reason: string) => httpPost(`/api-apps/${id}/revoke`, { reason }),
  webhooks: async () =>
    toPage<Row>(await httpGet("/webhooks", { limit: 100 }), "webhooks").items.map<WebhookEndpoint>(
      (w) => ({
        id: String(w.id),
        name: str(w.name),
        url: String(w.url),
        events: (w.events as string[]) ?? [],
        status: String(w.status),
        created_at: str(w.created_at),
      })
    ),
  createWebhook: (b: { name: string; url: string; events: string[]; secret_ref: string }) =>
    httpPost("/webhooks", b),
  testWebhook: (id: string) => httpPost(`/webhooks/${id}/test`),
  disableWebhook: (id: string, reason: string) => httpPost(`/webhooks/${id}/disable`, { reason }),
  deliveries: async (p: { page?: number } = {}): Promise<Page<WebhookDelivery>> => {
    const pg = toPage<Row>(await httpGet("/webhook-deliveries", p), "deliveries");
    return {
      ...pg,
      items: pg.items.map((d) => ({
        id: String(d.id),
        endpoint_id: str(d.endpoint_id),
        endpoint_url: str(d.endpoint_name),
        event: String(d.event_type),
        status: String(d.status),
        attempts: num(d.attempt_count),
        response_code:
          d.last_http_status === null || d.last_http_status === undefined
            ? null
            : num(d.last_http_status),
        next_retry_at: (d.next_attempt_at as string | null) ?? null,
        created_at: String(d.created_at),
      })),
    };
  },
  retryDelivery: (id: string) => httpPost(`/webhook-deliveries/${id}/retry`),
  replayDelivery: (id: string) => httpPost(`/webhook-deliveries/${id}/replay`),
  logs: async (): Promise<ApiLog[]> =>
    toPage<Row>(await httpGet("/api-logs"), "logs").items.map((l) => ({
      id: String(l.id),
      at: String(l.created_at),
      method: String(l.method),
      path: String(l.path),
      status: num(l.status_code),
      app_name: str(l.api_app_name),
    })),
};
