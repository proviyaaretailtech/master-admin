import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ProfilePage } from "../pages/ProfilePage";
import { UsersManagementPage } from "../pages/UsersManagementPage";
import { Organization360Page } from "../pages/Organization360Page";
import { PartnerDetailPage } from "../pages/PartnerDetailPage";
import { RolesPermissionsPage } from "../pages/RolesPermissionsPage";
import { CommercialPlansPage } from "../pages/CommercialPlansPage";
import { PlanEditorPage } from "../pages/PlanEditorPage";
import { PlatformModulesPage } from "../pages/PlatformModulesPage";
import { CommercialPacksPage } from "../pages/CommercialPacksPage";
import { PackEditorPage } from "../pages/PackEditorPage";
import { CommercialAddonsPage } from "../pages/CommercialAddonsPage";
import { AddonEditorPage } from "../pages/AddonEditorPage";
import { DomainPlaceholderPage } from "../pages/DomainPlaceholderPage";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { ProtectedRoute } from "../components/common/ProtectedRoute";

import { PermissionRoute } from "../components/common/PermissionRoute";

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* ============================================================== */}
      {/* PUBLIC AUTHENTICATION ROUTES                                    */}
      {/* ============================================================== */}
      <Route path="/login" element={<LoginPage />} />

      {/* ============================================================== */}
      {/* PROTECTED ROUTES (AUTHENTICATED ONLY)                          */}
      {/* ============================================================== */}
      <Route element={<ProtectedRoute />}>
        {/* All protected routes use the unified DashboardLayout */}
        <Route element={<DashboardLayout />}>
          {/* Main Dashboard / Onboarding System (matches screenshot 1) */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/overview" element={<DashboardPage />} />
          <Route path="/organizations" element={<DashboardPage />} />

          {/* User Account / My Profile (matches screenshot 2 dropdown destination) */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* Access Control: Users Management (System Accounts) */}
          <Route
            path="/users"
            element={
              <PermissionRoute featureId="feat_users_mgmt" featureName="Users Management">
                <UsersManagementPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/access-control"
            element={
              <PermissionRoute featureId="feat_users_mgmt" featureName="Users Management">
                <UsersManagementPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/access-control/users"
            element={
              <PermissionRoute featureId="feat_users_mgmt" featureName="Users Management">
                <UsersManagementPage />
              </PermissionRoute>
            }
          />

          {/* Security Policies */}
          <Route
            path="/access-control/policies"
            element={
              <PermissionRoute featureId="feat_roles_templates" featureName="Security Policies">
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/policies"
            element={
              <PermissionRoute featureId="feat_roles_templates" featureName="Security Policies">
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/security-policies"
            element={
              <PermissionRoute featureId="feat_roles_templates" featureName="Security Policies">
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />

          {/* Roles & Security Templates */}
          <Route
            path="/access-control/roles"
            element={
              <PermissionRoute featureId="feat_roles_templates" featureName="Roles & Permissions">
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <PermissionRoute featureId="feat_roles_templates" featureName="Roles & Permissions">
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/roles-permissions"
            element={
              <PermissionRoute featureId="feat_roles_templates" featureName="Roles & Permissions">
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/security-templates"
            element={
              <PermissionRoute featureId="feat_roles_templates" featureName="Roles & Permissions">
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/access-control/audit-logs"
            element={
              <PermissionRoute featureId="feat_audit_compliance" featureName="Audit Logs">
                <DomainPlaceholderPage />
              </PermissionRoute>
            }
          />

          {/* Organization Submenu Items */}
          <Route
            path="/organizations/360"
            element={
              <PermissionRoute featureId="feat_org_360" featureName="Organization 360">
                <Organization360Page />
              </PermissionRoute>
            }
          />
          {/* Partner Detail Routes with PermissionRoute guards */}
          <Route
            path="/organizations/partner-detail"
            element={
              <PermissionRoute
                featureId="feat_partner_review"
                anyOf={[
                  { featureId: "feat_partner_review" },
                  { featureId: "feat_partner_locations" },
                  { featureId: "feat_partner_docs" },
                  { featureId: "feat_org_360" },
                ]}
                featureName="Partner Detail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/organizations/partner-detail/:org_id"
            element={
              <PermissionRoute
                featureId="feat_partner_review"
                anyOf={[
                  { featureId: "feat_partner_review" },
                  { featureId: "feat_partner_locations" },
                  { featureId: "feat_partner_docs" },
                  { featureId: "feat_org_360" },
                ]}
                featureName="Partner Detail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/organizations/360/:id"
            element={
              <PermissionRoute
                featureId="feat_partner_review"
                anyOf={[
                  { featureId: "feat_partner_review" },
                  { featureId: "feat_partner_locations" },
                  { featureId: "feat_partner_docs" },
                  { featureId: "feat_org_360" },
                ]}
                featureName="Partner Detail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/organizations/:org_id"
            element={
              <PermissionRoute
                featureId="feat_partner_review"
                anyOf={[
                  { featureId: "feat_partner_review" },
                  { featureId: "feat_partner_locations" },
                  { featureId: "feat_partner_docs" },
                  { featureId: "feat_org_360" },
                ]}
                featureName="Partner Detail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/organizations/:org_id/locations"
            element={
              <PermissionRoute
                featureId="feat_partner_review"
                anyOf={[
                  { featureId: "feat_partner_review" },
                  { featureId: "feat_partner_locations" },
                  { featureId: "feat_partner_docs" },
                  { featureId: "feat_org_360" },
                ]}
                featureName="Partner Detail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/partners/:org_id"
            element={
              <PermissionRoute
                featureId="feat_partner_review"
                anyOf={[
                  { featureId: "feat_partner_review" },
                  { featureId: "feat_partner_locations" },
                  { featureId: "feat_partner_docs" },
                  { featureId: "feat_org_360" },
                ]}
                featureName="Partner Detail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/partner-detail"
            element={
              <PermissionRoute
                featureId="feat_partner_review"
                anyOf={[
                  { featureId: "feat_partner_review" },
                  { featureId: "feat_partner_locations" },
                  { featureId: "feat_partner_docs" },
                  { featureId: "feat_org_360" },
                ]}
                featureName="Partner Detail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/partner-detail/:org_id"
            element={
              <PermissionRoute
                featureId="feat_partner_review"
                anyOf={[
                  { featureId: "feat_partner_review" },
                  { featureId: "feat_partner_locations" },
                  { featureId: "feat_partner_docs" },
                  { featureId: "feat_org_360" },
                ]}
                featureName="Partner Detail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />

          <Route path="/brands" element={<DomainPlaceholderPage />} />
          <Route path="/locations" element={<DomainPlaceholderPage />} />
          <Route path="/departments" element={<DomainPlaceholderPage />} />
          <Route path="/employees" element={<DomainPlaceholderPage />} />
          <Route path="/invitations" element={<DomainPlaceholderPage />} />

          {/* Commercials Domain: Plans, Packs, Add-ons, Subscriptions, Entitlements, Usage, Billing */}
          <Route
            path="/commercials"
            element={
              <PermissionRoute featureId="feat_commercial_plans" featureName="Commercial Plans">
                <CommercialPlansPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/plans"
            element={
              <PermissionRoute featureId="feat_commercial_plans" featureName="Commercial Plans">
                <CommercialPlansPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/modules"
            element={
              <PermissionRoute featureId="feat_commercial_plans" featureName="Platform Modules">
                <PlatformModulesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/packs"
            element={
              <PermissionRoute featureId="feat_commercial_packs" featureName="Commercial Packs">
                <CommercialPacksPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/packs/new"
            element={
              <PermissionRoute
                featureId="feat_commercial_packs"
                actionKey="create_pack"
                featureName="Create Feature Pack"
              >
                <PackEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/packs/:id/edit"
            element={
              <PermissionRoute
                featureId="feat_commercial_packs"
                actionKey="edit_pack"
                featureName="Edit Feature Pack"
              >
                <PackEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/packs/:id"
            element={
              <PermissionRoute featureId="feat_commercial_packs" featureName="Commercial Packs">
                <PackEditorPage />
              </PermissionRoute>
            }
          />
          {/* Commercial Add-ons */}
          <Route
            path="/commercials/add-ons"
            element={
              <PermissionRoute featureId="feat_commercial_addons" featureName="Commercial Add-ons">
                <CommercialAddonsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/add-ons/new"
            element={
              <PermissionRoute
                featureId="feat_commercial_addons"
                actionKey="create_addon"
                featureName="Create Add-on Option"
              >
                <AddonEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/add-ons/:id/edit"
            element={
              <PermissionRoute
                featureId="feat_commercial_addons"
                actionKey="edit_addon"
                featureName="Edit Commercial Add-on"
              >
                <AddonEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/add-ons/:id"
            element={
              <PermissionRoute featureId="feat_commercial_addons" featureName="Commercial Add-ons">
                <AddonEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/plans/new"
            element={
              <PermissionRoute
                featureId="feat_commercial_plans"
                actionKey="create_plan"
                featureName="Create Plan"
              >
                <PlanEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/plans/:planId/edit"
            element={
              <PermissionRoute
                featureId="feat_commercial_plans"
                actionKey="edit_plan"
                featureName="Edit Plan"
              >
                <PlanEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/plans/:planId"
            element={
              <PermissionRoute featureId="feat_commercial_plans" featureName="Commercial Plans">
                <PlanEditorPage />
              </PermissionRoute>
            }
          />
          <Route path="/commercials/:subdomain" element={<DomainPlaceholderPage />} />
          <Route path="/platform-core" element={<DomainPlaceholderPage />} />
          <Route path="/commerce-engine" element={<DomainPlaceholderPage />} />
          <Route path="/inventory-supply" element={<DomainPlaceholderPage />} />
          <Route path="/fulfilment" element={<DomainPlaceholderPage />} />
          <Route path="/intelligence" element={<DomainPlaceholderPage />} />
          <Route path="/operations" element={<DomainPlaceholderPage />} />
          <Route path="/support" element={<DomainPlaceholderPage />} />
          <Route path="/developer" element={<DomainPlaceholderPage />} />
          <Route path="/audit" element={<DomainPlaceholderPage />} />
        </Route>
      </Route>

      {/* ============================================================== */}
      {/* FALLBACK REDIRECT                                              */}
      {/* ============================================================== */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
