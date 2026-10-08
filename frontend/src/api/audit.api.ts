import { httpGet, nextDay, str, toPage } from "./_http";
import type { Page, Row } from "./_http";

export interface AuditLog {
  id: string;
  created_at: string;
  actor?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  organization_id?: string | null;
  reason?: string | null;
  /** Rows are returned as stored (already redacted). */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export const auditApi = {
  list: async (
    p: {
      actor?: string;
      entity_type?: string;
      entity_id?: string;
      org?: string;
      from?: string;
      to?: string;
      page?: number;
    } = {}
  ): Promise<Page<AuditLog>> => {
    const pg = toPage<Row>(await httpGet("/audit-logs", { ...p, to: nextDay(p.to) }), "logs");
    return {
      ...pg,
      items: pg.items.map((a) => ({
        id: String(a.id),
        created_at: String(a.created_at),
        actor: str(a.actor_name) ?? str(a.actor_user_id) ?? str(a.actor_db_role) ?? null,
        action: String(a.action),
        entity_type: String(a.entity_type),
        entity_id: str(a.entity_id) ?? null,
        organization_id: str(a.organization_id) ?? null,
        before: (a.before as Record<string, unknown> | null) ?? null,
        after: (a.after as Record<string, unknown> | null) ?? null,
      })),
    };
  },
};
