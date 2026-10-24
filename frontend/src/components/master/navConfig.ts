import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ShieldCheck,
  Landmark,
  Truck,
  Wallet,
  Plug,
  Layers,
  ShoppingCart,
  Package,
  BarChart3,
  Headphones,
} from "lucide-react";
import { FEAT } from "../../lib/master-features";

export interface NavItem {
  id: string;
  /** Catalogue key of the label. */
  labelKey: string;
  path: string;
  feature?: { id: string; action?: string };
  /** Extra path prefixes that mark this item active. */
  also?: string[];
}
export interface NavSection {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: NavItem[];
}

/** Sidebar model. Items render only when the permission model allows the feature+action. */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "governance",
    labelKey: "nav.sections.governance",
    icon: Landmark,
    items: [
      {
        id: "approvals",
        labelKey: "nav.items.approvals",
        path: "/approvals",
        feature: { id: FEAT.APPROVALS.id, action: FEAT.APPROVALS.view },
      },
      {
        id: "approvalLimits",
        labelKey: "nav.items.approvalLimits",
        path: "/approvals/limits",
        feature: { id: FEAT.APPROVALS.id, action: FEAT.APPROVALS.view },
      },
    ],
  },
  {
    id: "organization",
    labelKey: "nav.organization",
    icon: Building2,
    items: [
      {
        id: "organizations",
        labelKey: "nav.items.organizations",
        path: "/organizations",
        feature: { id: FEAT.ORG_OPS.id, action: FEAT.ORG_OPS.view },
        also: ["/organizations/"],
      },
      {
        id: "organization_360",
        labelKey: "nav.items.organization_360",
        path: "/organizations/360",
        feature: { id: "feat_org_360", action: "view_directory" },
      },
      {
        id: "locations",
        labelKey: "nav.items.locations",
        path: "/locations",
        feature: { id: "feat_partner_locations", action: "view_locations" },
      },
      {
        id: "partnerApplications",
        labelKey: "nav.items.partnerApplications",
        path: "/partner-applications",
        feature: { id: FEAT.PARTNER_REVIEW.id, action: FEAT.PARTNER_REVIEW.view },
      },
      {
        id: "invitations",
        labelKey: "nav.items.invitations",
        path: "/invitations",
        feature: { id: FEAT.USERS.id, action: FEAT.USERS.view },
      },
    ],
  },
  {
    id: "access",
    labelKey: "nav.accessControl",
    icon: ShieldCheck,
    items: [
      {
        id: "users",
        labelKey: "nav.items.users",
        path: "/users",
        feature: { id: "feat_users_mgmt", action: "view_users" },
        also: ["/access-control/users"],
      },
      {
        id: "roles",
        labelKey: "nav.items.roles_permissions",
        path: "/access-control/roles",
        feature: { id: "feat_roles_templates", action: "view_roles" },
        also: ["/roles"],
      },
      {
        id: "policies",
        labelKey: "nav.items.security_policies",
        path: "/access-control/policies",
        feature: { id: "feat_roles_templates", action: "view_roles" },
        also: ["/policies"],
      },
      {
        id: "audit",
        labelKey: "nav.items.audit_logs",
        path: "/access-control/audit-logs",
        feature: { id: FEAT.AUDIT.id, action: FEAT.AUDIT.view },
      },
    ],
  },
  {
    id: "commercials",
    labelKey: "nav.commercials",
    icon: Landmark,
    items: [
      {
        id: "plans",
        labelKey: "nav.items.plans",
        path: "/commercials/plans",
        feature: { id: "feat_commercial_plans", action: "view_plans" },
        also: ["/commercials/modules"],
      },
      {
        id: "packs",
        labelKey: "nav.items.packs",
        path: "/commercials/packs",
        feature: { id: "feat_commercial_packs", action: "view_packs" },
      },
      {
        id: "addons",
        labelKey: "nav.items.add_ons",
        path: "/commercials/add-ons",
        feature: { id: "feat_commercial_addons", action: "view_addons" },
      },
    ],
  },
  {
    id: "operations",
    labelKey: "nav.sections.operations",
    icon: Truck,
    items: [
      {
        id: "orders",
        labelKey: "nav.items.orders",
        path: "/orders",
        feature: { id: FEAT.ORDERS.id, action: FEAT.ORDERS.view },
      },
      {
        id: "orderHolds",
        labelKey: "nav.items.orderHolds",
        path: "/order-holds",
        feature: { id: FEAT.ORDERS.id, action: FEAT.ORDERS.view },
      },
      {
        id: "dispatch",
        labelKey: "nav.items.dispatch",
        path: "/dispatch",
        feature: { id: FEAT.DISPATCH.id, action: FEAT.DISPATCH.view },
      },
      {
        id: "riders",
        labelKey: "nav.items.riders",
        path: "/riders",
        feature: { id: FEAT.RIDERS.id, action: FEAT.RIDERS.view },
      },
      {
        id: "riderPay",
        labelKey: "nav.items.riderPay",
        path: "/rider-pay",
        feature: { id: FEAT.RIDER_PAY.id, action: FEAT.RIDER_PAY.view },
      },
      {
        id: "commission",
        labelKey: "nav.items.commission",
        path: "/commission-rules",
        feature: { id: FEAT.COMMISSION.id, action: FEAT.COMMISSION.view },
      },
    ],
  },
  {
    id: "finance",
    labelKey: "nav.sections.finance",
    icon: Wallet,
    items: [
      {
        id: "financeControl",
        labelKey: "nav.items.financeControl",
        path: "/finance",
        feature: { id: FEAT.FINANCE.id, action: FEAT.FINANCE.view },
      },
      {
        id: "settlements",
        labelKey: "nav.items.settlements",
        path: "/finance/settlements",
        feature: { id: FEAT.FINANCE.id, action: FEAT.FINANCE.view },
      },
    ],
  },
  {
    id: "integrations",
    labelKey: "nav.sections.integrations",
    icon: Plug,
    items: [
      {
        id: "integrationCentre",
        labelKey: "nav.items.integrationCentre",
        path: "/integrations",
        feature: { id: FEAT.INTEGRATIONS.id, action: FEAT.INTEGRATIONS.view },
      },
      {
        id: "crm",
        labelKey: "nav.items.crm",
        path: "/integrations/crm",
        feature: { id: FEAT.INTEGRATIONS.id, action: FEAT.INTEGRATIONS.view },
      },
      {
        id: "cms",
        labelKey: "nav.items.cms",
        path: "/integrations/cms",
        feature: { id: FEAT.INTEGRATIONS.id, action: FEAT.INTEGRATIONS.view },
      },
      {
        id: "apiWebhooks",
        labelKey: "nav.items.apiWebhooks",
        path: "/developer/api",
        feature: { id: FEAT.API.id, action: FEAT.API.view },
      },
    ],
  },
];

/** Roadmap domains that still show the placeholder page (no permission gate, as before). */
export const PLACEHOLDER_DOMAINS: Array<{
  id: string;
  labelKey: string;
  icon: LucideIcon;
  path: string;
}> = [
  {
    id: "platform_core",
    labelKey: "nav.items.platform_core",
    icon: Layers,
    path: "/platform-core",
  },
  {
    id: "commerce_engine",
    labelKey: "nav.items.commerce_engine",
    icon: ShoppingCart,
    path: "/commerce-engine",
  },
  {
    id: "inventory_supply",
    labelKey: "nav.items.inventory_supply",
    icon: Package,
    path: "/inventory-supply",
  },
  {
    id: "intelligence",
    labelKey: "nav.items.intelligence",
    icon: BarChart3,
    path: "/intelligence",
  },
  { id: "support", labelKey: "nav.items.support", icon: Headphones, path: "/support" },
];

/** Exact path or any listed prefix. `/organizations` must not swallow `/organizations/360`. */
export function isNavActive(item: NavItem, pathname: string, siblings: NavItem[]): boolean {
  const longerSibling = siblings.some(
    (s) =>
      s.id !== item.id &&
      s.path.length > item.path.length &&
      (pathname === s.path || pathname.startsWith(s.path + "/"))
  );
  if (longerSibling) return false;
  if (pathname === item.path) return true;
  if (item.also?.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p)))
    return true;
  return item.path !== "/" && pathname.startsWith(item.path + "/");
}
