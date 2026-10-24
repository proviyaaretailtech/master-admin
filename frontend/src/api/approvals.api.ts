import { httpGet, httpPost, httpPut, num, str, toPage } from "./_http";
import type { Page, Row } from "./_http";

/** Platform approval action types (backend 0600). */
export const APPROVAL_ACTIONS = [
  "refund",
  "ledger_adjustment",
  "payout_release",
  "rule_publish",
  "setting_change",
  "ui_release",
  "partner_reactivation",
  "credit_issue",
  "other",
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];
export const APPROVER_ROLES = ["finance", "controller", "backup_controller"] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];
export type ApprovalView = "mine" | "escalated" | "all";

export interface Approval {
  id: string;
  action_type: string;
  subject_type: string;
  subject_id: string;
  amount_minor: number;
  currency_code: string;
  status: string;
  /** "expired" when pending past its expiry, before anything marks it so */
  effective_status: string;
  reason: string;
  decision_note?: string;
  approver_roles: string[];
  escalation_roles: string[];
  requested_by: string;
  requested_by_name?: string;
  approver_name?: string;
  tier_label?: string;
  expires_at?: string;
  escalated_at?: string;
  decided_at?: string;
  created_at?: string;
}
export interface ApprovalDecision {
  id: string;
  decision: string;
  decided_by: string;
  decided_by_name?: string;
  decided_role?: string;
  note?: string;
  created_at?: string;
}
export interface ApprovalTier {
  id: string;
  action_type: string;
  min_minor: number;
  max_minor: number | null;
  requires_approval: boolean;
  approver_roles: string[];
  backup_roles: string[];
  expiry_hours: number;
  escalate_after_minutes: number | null;
  label: string;
  enabled: boolean;
  updated_by_name?: string;
  updated_at?: string;
}
export type TierPatch = Partial<
  Pick<ApprovalTier, "requires_approval" | "approver_roles" | "backup_roles" | "expiry_hours" | "escalate_after_minutes" | "enabled">
> & { reason: string };

const roles = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

const mapApproval = (r: Row): Approval => {
  const details = (r.details ?? {}) as Row;
  return {
    id: String(r.id),
    action_type: String(r.action_type),
    subject_type: String(r.subject_type ?? ""),
    subject_id: String(r.subject_id ?? ""),
    amount_minor: num(r.amount_minor),
    currency_code: str(r.currency_code) ?? "INR",
    status: String(r.status),
    effective_status: String(r.effective_status ?? r.status),
    reason: String(r.reason ?? ""),
    decision_note: str(r.decision_note),
    approver_roles: roles(r.approver_roles),
    escalation_roles: roles(r.escalation_roles),
    requested_by: String(r.requested_by ?? ""),
    requested_by_name: str(r.requested_by_name),
    approver_name: str(r.approver_name),
    tier_label: str(details.tier_label),
    expires_at: str(r.expires_at),
    escalated_at: str(r.escalated_at),
    decided_at: str(r.decided_at),
    created_at: str(r.created_at),
  };
};
const mapDecision = (r: Row): ApprovalDecision => ({
  id: String(r.id),
  decision: String(r.decision),
  decided_by: String(r.decided_by ?? ""),
  decided_by_name: str(r.decided_by_name),
  decided_role: str(r.decided_role),
  note: str(r.note),
  created_at: str(r.created_at),
});
const mapTier = (r: Row): ApprovalTier => ({
  id: String(r.id),
  action_type: String(r.action_type),
  min_minor: num(r.min_minor),
  max_minor: r.max_minor === null || r.max_minor === undefined ? null : num(r.max_minor),
  requires_approval: r.requires_approval === true,
  approver_roles: roles(r.approver_roles),
  backup_roles: roles(r.backup_roles),
  expiry_hours: num(r.expiry_hours),
  escalate_after_minutes:
    r.escalate_after_minutes === null || r.escalate_after_minutes === undefined ? null : num(r.escalate_after_minutes),
  label: String(r.label ?? ""),
  enabled: r.enabled !== false,
  updated_by_name: str(r.updated_by_name),
  updated_at: str(r.updated_at),
});

export const approvalsApi = {
  list: async (view: ApprovalView, page = 1): Promise<Page<Approval> & { myRoles: string[] }> => {
    const raw = await httpGet<Row>("/approvals", { view, page, limit: 25 });
    const p = toPage<Row>(raw, "approvals");
    return { ...p, items: p.items.map(mapApproval), myRoles: roles(raw.my_roles) };
  },
  get: async (id: string) => {
    const raw = await httpGet<Row>(`/approvals/${id}`);
    return {
      approval: mapApproval((raw.approval ?? {}) as Row),
      decisions: ((raw.decisions as Row[]) ?? []).map(mapDecision),
    };
  },
  decide: (id: string, decision: "approved" | "rejected", note?: string) =>
    httpPost(`/approvals/${id}/decide`, { decision, note: note || undefined }),
  cancel: (id: string, note?: string) => httpPost(`/approvals/${id}/cancel`, { note: note || undefined }),
  tiers: async () => {
    const raw = await httpGet<Row>("/approvals/tiers");
    return ((raw.tiers as Row[]) ?? []).map(mapTier);
  },
  updateTier: (id: string, patch: TierPatch) => httpPut(`/approvals/tiers/${id}`, patch),
};
