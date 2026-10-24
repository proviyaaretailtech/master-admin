import { query } from "../../config/database.config";
import { Actor, actorCan } from "../../utils/authz";
import { ForbiddenException, NotFoundException } from "../../utils/app-error";
import { pageMeta } from "../../validators/master.validator";
import { APPROVER_ROLES, ApproverRole } from "../../validators/master-governance.validator";
import { Row, Where, recordAudit, scrub } from "./common";

const page = (p: number, l: number) => `LIMIT ${l} OFFSET ${(p - 1) * l}`;
const STAFF_NAME = (alias: string) =>
  `nullif(btrim(coalesce(${alias}.first_name,'') || ' ' || coalesce(${alias}.last_name,'')), '')`;

/**
 * The approver roles this staff member holds, read from their feat_approvals actions. Super admins (founders) hold
 * every role so they can act in an emergency, but tiers never route requests to them (founder decision 1).
 */
export function approverRolesOf(actor: Actor): ApproverRole[] {
  return (Object.entries(APPROVER_ROLES) as [ApproverRole, string][])
    .filter(([, action]) => actorCan(actor, "feat_approvals", action))
    .map(([role]) => role);
}

/** Pending past its expiry reads as expired even before anything marks it so. */
const withEffectiveStatus = (row: Row): Row => {
  const expired = (row.status === "pending" || row.status === "approved") && new Date(String(row.expires_at)).getTime() <= Date.now();
  return { ...scrub(row), effective_status: expired ? "expired" : row.status };
};

const REQUEST_COLS = `r.id, r.action_type, r.subject_type, r.subject_id, r.amount_minor, r.currency_code, r.status, r.reason,
  r.decision_note, r.details, r.approver_roles, r.escalation_roles, r.requested_by, ${STAFF_NAME("rq")} AS requested_by_name,
  r.approver_id, ${STAFF_NAME("ap")} AS approver_name, r.expires_at, r.escalate_at, r.escalated_at, r.decided_at, r.executed_at,
  r.created_at, r.updated_at`;
const REQUEST_FROM = `approval_requests r
  LEFT JOIN platform_admins rq ON rq.user_id = r.requested_by
  LEFT JOIN platform_admins ap ON ap.user_id = r.approver_id`;

/**
 * Platform approvals (0600): Master's inbox over approval_requests with scope = 'platform'. Tiers decide who may approve;
 * the database enforces maker != checker, single use and expiry; this service checks the staff member's approver role.
 */
export const governanceService = {
  /** Adds backup roles to overdue pending requests (sideways escalation). Safe to call often. */
  async escalateDue(): Promise<number> {
    const r = await query<{ n: number }>(`SELECT public.platform_approval_escalate_due() AS n;`);
    return r.rows[0]?.n ?? 0;
  },

  async list(actor: Actor, f: { view: "mine" | "escalated" | "all"; status?: string; action?: string; page: number; limit: number }) {
    await this.escalateDue();
    const roles = approverRolesOf(actor);
    const w = new Where().raw("r.scope = 'platform'").add("r.status = $?", f.status).add("r.action_type = $?", f.action);
    if (f.view === "mine") {
      // waiting for me: pending, not mine to decide if I asked, and naming one of my approver roles
      w.raw("r.status = 'pending' AND r.expires_at > now()")
        .add("(r.approver_roles && $?::text[] OR r.escalation_roles && $?::text[])", roles)
        .add("r.requested_by <> $?::uuid", actor.id);
    } else if (f.view === "escalated") {
      w.raw("r.escalated_at IS NOT NULL AND r.status = 'pending'");
    }
    const total = (await query<{ n: number }>(`SELECT count(*)::int AS n FROM approval_requests r ${w.sql};`, w.values)).rows[0].n;
    const rows = await query<Row>(
      `SELECT ${REQUEST_COLS} FROM ${REQUEST_FROM} ${w.sql} ORDER BY r.created_at DESC, r.id ${page(f.page, f.limit)};`,
      w.values
    );
    return { approvals: rows.rows.map(withEffectiveStatus), my_roles: roles, pagination: pageMeta(total, f.page, f.limit) };
  },

  async get(id: string) {
    const r = await query<Row>(`SELECT ${REQUEST_COLS} FROM ${REQUEST_FROM} WHERE r.id = $1 AND r.scope = 'platform';`, [id]);
    if (!r.rows[0]) throw new NotFoundException("Approval request not found");
    const d = await query<Row>(
      `SELECT d.id, d.decision, d.decided_by, ${STAFF_NAME("pa")} AS decided_by_name, d.decided_role, d.note, d.created_at
         FROM approval_decisions d LEFT JOIN platform_admins pa ON pa.user_id = d.decided_by
        WHERE d.approval_request_id = $1 ORDER BY d.created_at, d.id;`,
      [id]
    );
    return { approval: withEffectiveStatus(r.rows[0]), decisions: d.rows.map((x) => scrub(x)) };
  },

  async create(actor: Actor, b: { action_type: string; subject_type: string; subject_id: string; amount_minor: number; reason: string; details?: Record<string, unknown> }) {
    const r = await query<{ r: { required: boolean; id?: string; label: string } }>(
      `SELECT public.platform_approval_create($1, $2, $3, $4::bigint, $5, $6::uuid, $7::jsonb) AS r;`,
      [b.action_type, b.subject_type, b.subject_id, b.amount_minor, b.reason, actor.id, JSON.stringify(b.details ?? {})]
    );
    const out = r.rows[0].r;
    if (out.id) await recordAudit(actor, "approval.requested", "approval_request", out.id, null, { action_type: b.action_type, amount_minor: b.amount_minor });
    return out;
  },

  /** Approve or reject. The staff member must hold one of the roles the request names (or its escalation roles). */
  async decide(actor: Actor, id: string, decision: "approved" | "rejected", note?: string) {
    const { approval } = await this.get(id);
    const allowed = [...((approval.approver_roles as string[]) ?? []), ...((approval.escalation_roles as string[]) ?? [])];
    const role = approverRolesOf(actor).find((x) => allowed.includes(x));
    if (!role) throw new ForbiddenException("Your approver role is not allowed to decide this request");
    const r = await query<{ r: Row }>(`SELECT public.platform_approval_decide($1::uuid, $2, $3, $4::uuid, $5) AS r;`, [id, decision, note ?? null, actor.id, role]);
    await recordAudit(actor, `approval.${decision}`, "approval_request", id, null, { role, note: note ?? null });
    return { result: r.rows[0].r, ...(await this.get(id)) };
  },

  /** The requester withdraws their own pending request. */
  async cancel(actor: Actor, id: string, note?: string) {
    const { approval } = await this.get(id);
    if (approval.requested_by !== actor.id) throw new ForbiddenException("Only the person who asked can withdraw this request");
    const r = await query<{ r: Row }>(`SELECT public.platform_approval_decide($1::uuid, 'cancelled', $2, $3::uuid, NULL) AS r;`, [id, note ?? null, actor.id]);
    await recordAudit(actor, "approval.cancelled", "approval_request", id, null, { note: note ?? null });
    return { result: r.rows[0].r, ...(await this.get(id)) };
  },

  async tiers() {
    const r = await query<Row>(
      `SELECT t.id, t.action_type, t.min_minor, t.max_minor, t.requires_approval, t.approver_roles, t.backup_roles, t.expiry_hours,
              t.escalate_after_minutes, t.currency_code, t.label, t.enabled, t.updated_by, ${STAFF_NAME("pa")} AS updated_by_name, t.updated_at
         FROM platform_approval_tiers t LEFT JOIN platform_admins pa ON pa.user_id = t.updated_by
        ORDER BY t.action_type, t.min_minor;`
    );
    return { tiers: r.rows };
  },

  /** Founders only (decision 1): approval limits are platform policy, not something a Controller can loosen. */
  async updateTier(
    actor: Actor,
    id: string,
    patch: { requires_approval?: boolean; approver_roles?: string[]; backup_roles?: string[]; expiry_hours?: number; escalate_after_minutes?: number | null; enabled?: boolean; reason: string }
  ) {
    if (!actor.isSuperAdmin) throw new ForbiddenException("Only founders can change approval limits");
    const before = await query<Row>(`SELECT * FROM platform_approval_tiers WHERE id = $1;`, [id]);
    if (!before.rows[0]) throw new NotFoundException("Approval tier not found");
    const { reason, ...fields } = patch;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      values.push(v);
      sets.push(`${k} = $${values.length}${k.endsWith("_roles") ? "::text[]" : ""}`);
    }
    values.push(actor.id, id);
    const r = await query<Row>(
      `UPDATE platform_approval_tiers SET ${sets.join(", ")}, updated_by = $${values.length - 1}::uuid WHERE id = $${values.length}::uuid RETURNING *;`,
      values
    );
    await recordAudit(actor, "approval_tier.updated", "platform_approval_tier", id, null, { reason, before: before.rows[0], after: r.rows[0] });
    return { tier: r.rows[0] };
  },
};
