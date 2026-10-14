import type { FeaturePermission } from "../../pages/RolesPermissionsPage";

/**
 * Mock response of GET /roles/catalog for component tests: a few features, all off, in the backend's
 * shape. The real catalogue is the backend registry (backend/src/utils/permission-adapter.ts);
 * permission-parity.test.ts checks the frontend against that file.
 */
const a = (key: string, label: string) => ({ key, label, description: label, enabled: false });

export const CATALOGUE: FeaturePermission[] = [
  {
    id: "feat_partner_review",
    name: "Partner Detail: Review Lifecycle Actions",
    category: "partner_detail",
    pagePath: "/organizations/:org_id",
    description: "Approve or reject partners.",
    accessLevel: "none",
    actions: [
      a("view_applications", "View Partner Applications"),
      a("approve_partner", "Approve Partner"),
      a("reject_partner", "Reject Partner"),
    ],
  },
  {
    id: "feat_partner_locations",
    name: "Partner Detail: Locations Management Table",
    category: "partner_detail",
    pagePath: "/organizations/:org_id",
    description: "Locations table.",
    accessLevel: "none",
    actions: [
      a("view_locations", "View Locations Table"),
      a("create_location", "Add New Location"),
    ],
  },
  {
    id: "feat_commercial_plans",
    name: "Commercials: Platform Plans & Modules",
    category: "commercials",
    pagePath: "/commercials/plans",
    description: "Plans.",
    accessLevel: "none",
    actions: [a("view_plans", "View Plans"), a("publish_plan", "Publish Plan")],
  },
  {
    id: "feat_orders",
    name: "Orders & Order 360",
    category: "operations",
    pagePath: "/orders",
    description: "Orders and held orders.",
    accessLevel: "none",
    actions: [
      a("view_orders", "View Orders"),
      a("decide_order_holds", "Release or Reject Held Orders"),
    ],
  },
];

/** The catalogue with every feature fully granted (what a super admin role looks like). */
export const FULL_GRANT: FeaturePermission[] = CATALOGUE.map((f) => ({
  ...f,
  accessLevel: "full",
  actions: f.actions.map((x) => ({ ...x, enabled: true })),
}));
