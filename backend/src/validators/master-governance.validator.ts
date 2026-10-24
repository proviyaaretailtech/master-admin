import { z } from "zod";
import { minorSchema, optStr, pageQuery, reasonSchema } from "./master.validator";

/** Platform approval action types (0600). Partner-side types (pos_refund, pos_void, ...) are not raised from Master. */
export const PLATFORM_ACTIONS = [
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

/** Approver roles a platform tier can name, and the feat_approvals action that grants each. */
export const APPROVER_ROLES = {
  finance: "approve_as_finance",
  controller: "approve_as_controller",
  backup_controller: "approve_as_backup_controller",
} as const;
export type ApproverRole = keyof typeof APPROVER_ROLES;

const STATUSES = ["pending", "approved", "rejected", "cancelled", "expired", "executed"] as const;

export const approvalsQuery = z.object({
  view: z.enum(["mine", "escalated", "all"]).default("mine"),
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum(STATUSES).optional()),
  action: z.preprocess((v) => (v === "" ? undefined : v), z.enum(PLATFORM_ACTIONS).optional()),
  ...pageQuery,
});

export const approvalCreateBody = z.object({
  action_type: z.enum(PLATFORM_ACTIONS),
  subject_type: z.string().trim().min(1).max(60),
  subject_id: z.string().trim().min(1).max(200),
  amount_minor: minorSchema().default(0),
  reason: reasonSchema,
  details: z.record(z.unknown()).optional(),
});

export const approvalDecisionBody = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((b) => b.decision !== "rejected" || (b.note?.length ?? 0) >= 3, {
    message: "A reason of at least 3 characters is required to reject",
    path: ["note"],
  });

export const approvalCancelBody = z.object({ note: optStr(500) });

const roleList = z.array(z.enum(Object.keys(APPROVER_ROLES) as [ApproverRole, ...ApproverRole[]])).max(3);

export const tierUpdateBody = z
  .object({
    requires_approval: z.boolean().optional(),
    approver_roles: roleList.optional(),
    backup_roles: roleList.optional(),
    expiry_hours: z.number().int().min(1).max(720).optional(),
    escalate_after_minutes: z.number().int().min(5).max(10080).nullable().optional(),
    enabled: z.boolean().optional(),
    reason: reasonSchema,
  })
  .refine((b) => Object.keys(b).some((k) => k !== "reason"), { message: "Nothing to change" });
