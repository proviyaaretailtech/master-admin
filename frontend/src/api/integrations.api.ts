import { httpGet, httpPost, httpPut, str, toPage } from "./_http";
import type { Row } from "./_http";

export type IntegrationCategory =
  "crm" | "cms" | "payment_gateway" | "messaging" | "maps" | "analytics" | "other";
export type MappingKind = "crm_field" | "cms_content" | "cms_placement";
export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  "crm",
  "cms",
  "payment_gateway",
  "messaging",
  "maps",
  "analytics",
  "other",
];

export interface Integration {
  id: string;
  category: IntegrationCategory | string;
  provider: string;
  name: string;
  status: string;
  last_sync_at?: string | null;
  credentials_rotated_at?: string | null;
  config?: Record<string, unknown>;
}
export interface IntegrationLog {
  id: string;
  at: string;
  level?: string;
  event: string;
  message?: string;
}
export interface IntegrationMapping {
  id?: string;
  kind: MappingKind;
  source: string;
  target: string;
}

const mapIntegration = (c: Row): Integration => ({
  id: String(c.id),
  category: String(c.category),
  provider: String(c.provider),
  name: String(c.name),
  status: String(c.status),
  last_sync_at: (c.last_synced_at as string | null) ?? null,
  credentials_rotated_at: (c.credentials_rotated_at as string | null) ?? null,
  config: (c.config as Record<string, unknown>) ?? {},
});

export const integrationApi = {
  list: async (category?: string) =>
    toPage<Row>(await httpGet("/integrations", { category, limit: 100 }), "integrations").items.map(
      mapIntegration
    ),
  create: (b: { category: string; provider: string; name: string }) => httpPost("/integrations", b),
  async get(id: string): Promise<Integration> {
    const r = await httpGet<Row>(`/integrations/${id}`);
    return mapIntegration((r.integration ?? r) as Row);
  },
  update: (id: string, b: { name?: string; config?: Record<string, unknown> }) =>
    httpPut(`/integrations/${id}`, b),
  test: (id: string) => httpPost(`/integrations/${id}/test`),
  sync: (id: string) => httpPost(`/integrations/${id}/sync`),
  disable: (id: string, reason: string) => httpPost(`/integrations/${id}/disable`, { reason }),
  enable: (id: string) => httpPost(`/integrations/${id}/enable`),
  rotateCredentials: (id: string) => httpPost(`/integrations/${id}/rotate-credentials`),
  logs: async (id: string): Promise<IntegrationLog[]> =>
    toPage<Row>(await httpGet(`/integrations/${id}/logs`), "logs").items.map((l) => ({
      id: String(l.id),
      at: String(l.created_at),
      level: str(l.level),
      event: String(l.event),
      message: str(l.message),
    })),
  mappings: async (id: string): Promise<IntegrationMapping[]> =>
    toPage<Row>(await httpGet(`/integrations/${id}/mappings`), "mappings").items.map((m) => ({
      id: String(m.id),
      kind: m.kind as MappingKind,
      source: String(m.source_key),
      target: String(m.target_key),
    })),
  putMappings: (id: string, mappings: IntegrationMapping[]) =>
    httpPut(`/integrations/${id}/mappings`, {
      mappings: mappings.map((m) => ({ kind: m.kind, source: m.source, target: m.target })),
    }),
};
