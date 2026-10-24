/**
 * Feature / action ids the Master screens ask the permission model about. They are the backend's
 * real ids (Master Admin backend: src/tests/helpers/master-routes.ts). Super Admin bypasses.
 */
export const FEAT = {
  DASHBOARD: { id: "feat_dashboard", view: "view_dashboard" },
  ORG_OPS: {
    id: "feat_org_360",
    view: "view_directory",
    create: "create_org",
    ordering: "manage_ordering",
    suspend: "suspend_org",
    archive: "archive_org",
  },
  SUBSCRIPTION: { id: "feat_org_subscription", view: "view_subscription", plan: "change_plan" },
  USERS: { id: "feat_invitations", view: "view_invitations", invite: "manage_invitations" },
  RIDERS: {
    id: "feat_riders",
    view: "view_riders",
    approve: "approve_rider",
    reject: "reject_rider",
    suspend: "suspend_rider",
    reactivate: "reactivate_rider",
    cash: "confirm_cash_deposit",
  },
  RIDER_PAY: { id: "feat_rider_pay", view: "view_rider_pay", edit: "edit_rider_pay" },
  COMMISSION: { id: "feat_commission", view: "view_commission", edit: "edit_commission" },
  ORDERS: { id: "feat_orders", view: "view_orders", decideHolds: "decide_order_holds" },
  PARTNER_REVIEW: {
    id: "feat_partner_review",
    view: "view_applications",
    approve: "approve_partner",
    reject: "reject_partner",
  },
  DISPATCH: { id: "feat_dispatch", view: "view_dispatch", manage: "manage_dispatch" },
  FINANCE: {
    id: "feat_finance",
    view: "view_finance",
    run: "run_settlement",
    approveSettlement: "approve_settlement",
    approvePayout: "approve_payout",
    markPaid: "mark_payout_paid",
  },
  AUDIT: { id: "feat_audit_compliance", view: "view_audit_logs" },
  APPROVALS: {
    id: "feat_approvals",
    view: "view_approvals",
    request: "request_approval",
    editLimits: "edit_approval_limits",
  },
  INTEGRATIONS: {
    id: "feat_integrations",
    view: "view_integrations",
    manage: "manage_integrations",
  },
  API: { id: "feat_api_webhooks", view: "view_api_webhooks", manage: "manage_api_webhooks" },
} as const;
