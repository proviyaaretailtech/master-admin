import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
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
import { MasterDashboardPage } from "../pages/master/MasterDashboardPage";
import { OrganizationsPage } from "../pages/master/OrganizationsPage";
import { Organization360OpsPage } from "../pages/master/Organization360OpsPage";
import { ChangePlanPage } from "../pages/master/ChangePlanPage";
import { InvitationsPage } from "../pages/master/InvitationsPage";
import { RidersPage } from "../pages/master/RidersPage";
import { PartnerApplicationsPage } from "../pages/master/PartnerApplicationsPage";
import { OrderHoldsPage } from "../pages/master/OrderHoldsPage";
import { RiderPayPage } from "../pages/master/RiderPayPage";
import { CommissionRulesPage } from "../pages/master/CommissionRulesPage";
import { OrdersPage, Order360Page } from "../pages/master/OrdersPage";
import { DispatchBoardPage } from "../pages/master/DispatchBoardPage";
import { SettlementsPayoutsPage } from "../pages/master/SettlementsPayoutsPage";
import { FinanceControlPage } from "../pages/master/FinanceControlPage";
import { AuditViewerPage } from "../pages/master/AuditViewerPage";
import { ApprovalsPage } from "../pages/master/ApprovalsPage";
import { ApprovalLimitsPage } from "../pages/master/ApprovalLimitsPage";
import {
  IntegrationsPage,
  CrmIntegrationPage,
  CmsIntegrationPage,
} from "../pages/master/IntegrationsPage";
import { ApiWebhooksPage } from "../pages/master/ApiWebhooksPage";
import { FEAT } from "../lib/master-features";
import { DomainPlaceholderPage } from "../pages/DomainPlaceholderPage";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { ProtectedRoute } from "../components/common/ProtectedRoute";

import { PermissionRoute } from "../components/common/PermissionRoute";
import { SettingsPage } from "../pages/SettingsPage";

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* ============================================================== */}
      {/* PUBLIC AUTHENTICATION ROUTES                                    */}
      {/* ============================================================== */}
      <Route path="/login" element={<LoginPage />} />
      {/* Opened from the emailed password reset link (recovery token in the URL fragment) */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ============================================================== */}
      {/* PROTECTED ROUTES (AUTHENTICATED ONLY)                          */}
      {/* ============================================================== */}
      <Route element={<ProtectedRoute />}>
        {/* All protected routes use the unified DashboardLayout */}
        <Route element={<DashboardLayout />}>
          {/* Main Dashboard / Onboarding System (matches screenshot 1) */}
          <Route path="/" element={<MasterDashboardPage />} />
          <Route path="/dashboard" element={<MasterDashboardPage />} />
          <Route path="/overview" element={<MasterDashboardPage />} />
          {/* The partner onboarding pipeline view moved off /organizations */}
          <Route path="/organizations/pipeline" element={<DashboardPage />} />

          {/* User Account / My Profile (matches screenshot 2 dropdown destination) */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* Settings (Language) — available to every signed-in user */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Access Control: Users Management (System Accounts) */}
          <Route
            path="/users"
            element={
              <PermissionRoute
                featureId="feat_users_mgmt"
                featureNameKey="nav.feature.usersManagement"
              >
                <UsersManagementPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/access-control"
            element={
              <PermissionRoute
                featureId="feat_users_mgmt"
                featureNameKey="nav.feature.usersManagement"
              >
                <UsersManagementPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/access-control/users"
            element={
              <PermissionRoute
                featureId="feat_users_mgmt"
                featureNameKey="nav.feature.usersManagement"
              >
                <UsersManagementPage />
              </PermissionRoute>
            }
          />

          {/* Security Policies */}
          <Route
            path="/access-control/policies"
            element={
              <PermissionRoute
                featureId="feat_roles_templates"
                featureNameKey="nav.feature.securityPolicies"
              >
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/policies"
            element={
              <PermissionRoute
                featureId="feat_roles_templates"
                featureNameKey="nav.feature.securityPolicies"
              >
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/security-policies"
            element={
              <PermissionRoute
                featureId="feat_roles_templates"
                featureNameKey="nav.feature.securityPolicies"
              >
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />

          {/* Roles & Security Templates */}
          <Route
            path="/access-control/roles"
            element={
              <PermissionRoute
                featureId="feat_roles_templates"
                featureNameKey="nav.feature.rolesPermissions"
              >
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <PermissionRoute
                featureId="feat_roles_templates"
                featureNameKey="nav.feature.rolesPermissions"
              >
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/roles-permissions"
            element={
              <PermissionRoute
                featureId="feat_roles_templates"
                featureNameKey="nav.feature.rolesPermissions"
              >
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/security-templates"
            element={
              <PermissionRoute
                featureId="feat_roles_templates"
                featureNameKey="nav.feature.rolesPermissions"
              >
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/access-control/audit-logs"
            element={
              <PermissionRoute
                featureId="feat_audit_compliance"
                featureNameKey="nav.feature.auditLogs"
              >
                <AuditViewerPage />
              </PermissionRoute>
            }
          />

          {/* Organization Submenu Items */}
          <Route
            path="/organizations/360"
            element={
              <PermissionRoute
                featureId="feat_org_360"
                featureNameKey="nav.feature.organization360"
              >
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
                featureNameKey="nav.feature.partnerDetail"
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
                featureNameKey="nav.feature.partnerDetail"
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
                featureNameKey="nav.feature.partnerDetail"
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
                featureNameKey="nav.feature.partnerDetail"
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
                featureNameKey="nav.feature.partnerDetail"
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
                featureNameKey="nav.feature.partnerDetail"
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
                featureNameKey="nav.feature.partnerDetail"
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
                featureNameKey="nav.feature.partnerDetail"
              >
                <PartnerDetailPage />
              </PermissionRoute>
            }
          />

          <Route path="/brands" element={<DomainPlaceholderPage />} />
          <Route path="/locations" element={<DomainPlaceholderPage />} />
          <Route path="/departments" element={<DomainPlaceholderPage />} />
          <Route path="/employees" element={<DomainPlaceholderPage />} />

          {/* Commercials Domain: Plans, Packs, Add-ons, Subscriptions, Entitlements, Usage, Billing */}
          <Route
            path="/commercials"
            element={
              <PermissionRoute
                featureId="feat_commercial_plans"
                featureNameKey="nav.feature.commercialPlans"
              >
                <CommercialPlansPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/plans"
            element={
              <PermissionRoute
                featureId="feat_commercial_plans"
                featureNameKey="nav.feature.commercialPlans"
              >
                <CommercialPlansPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/modules"
            element={
              <PermissionRoute
                featureId="feat_commercial_plans"
                featureNameKey="nav.feature.platformModules"
              >
                <PlatformModulesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/packs"
            element={
              <PermissionRoute
                featureId="feat_commercial_packs"
                featureNameKey="nav.feature.commercialPacks"
              >
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
                featureNameKey="nav.feature.createPack"
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
                featureNameKey="nav.feature.editPack"
              >
                <PackEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/packs/:id"
            element={
              <PermissionRoute
                featureId="feat_commercial_packs"
                featureNameKey="nav.feature.commercialPacks"
              >
                <PackEditorPage />
              </PermissionRoute>
            }
          />
          {/* Commercial Add-ons */}
          <Route
            path="/commercials/add-ons"
            element={
              <PermissionRoute
                featureId="feat_commercial_addons"
                featureNameKey="nav.feature.commercialAddons"
              >
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
                featureNameKey="nav.feature.createAddon"
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
                featureNameKey="nav.feature.editAddon"
              >
                <AddonEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/add-ons/:id"
            element={
              <PermissionRoute
                featureId="feat_commercial_addons"
                featureNameKey="nav.feature.commercialAddons"
              >
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
                featureNameKey="nav.feature.createPlan"
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
                featureNameKey="nav.feature.editPlan"
              >
                <PlanEditorPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commercials/plans/:planId"
            element={
              <PermissionRoute
                featureId="feat_commercial_plans"
                featureNameKey="nav.feature.commercialPlans"
              >
                <PlanEditorPage />
              </PermissionRoute>
            }
          />
          <Route path="/commercials/:subdomain" element={<DomainPlaceholderPage />} />

          {/* ===== Master operations (permission-gated) ===== */}
          <Route
            path="/organizations"
            element={
              <PermissionRoute
                featureId={FEAT.ORG_OPS.id}
                actionKey={FEAT.ORG_OPS.view}
                featureNameKey="nav.feature.organizations"
              >
                <OrganizationsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/organizations/:id/360"
            element={
              <PermissionRoute
                featureId={FEAT.ORG_OPS.id}
                actionKey={FEAT.ORG_OPS.view}
                featureNameKey="nav.feature.organizations"
              >
                <Organization360OpsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/organizations/:id/change-plan"
            element={
              <PermissionRoute
                featureId={FEAT.SUBSCRIPTION.id}
                actionKey={FEAT.SUBSCRIPTION.plan}
                featureNameKey="nav.feature.changePlan"
              >
                <ChangePlanPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/invitations"
            element={
              <PermissionRoute
                featureId={FEAT.USERS.id}
                actionKey={FEAT.USERS.view}
                featureNameKey="nav.feature.invitations"
              >
                <InvitationsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/partner-applications"
            element={
              <PermissionRoute
                featureId={FEAT.PARTNER_REVIEW.id}
                actionKey={FEAT.PARTNER_REVIEW.view}
                featureNameKey="nav.feature.partnerApplications"
              >
                <PartnerApplicationsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/order-holds"
            element={
              <PermissionRoute
                featureId={FEAT.ORDERS.id}
                actionKey={FEAT.ORDERS.view}
                featureNameKey="nav.feature.orderHolds"
              >
                <OrderHoldsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/riders"
            element={
              <PermissionRoute
                featureId={FEAT.RIDERS.id}
                actionKey={FEAT.RIDERS.view}
                featureNameKey="nav.feature.riders"
              >
                <RidersPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/rider-pay"
            element={
              <PermissionRoute
                featureId={FEAT.RIDER_PAY.id}
                actionKey={FEAT.RIDER_PAY.view}
                featureNameKey="nav.feature.riderPay"
              >
                <RiderPayPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/approvals"
            element={
              <PermissionRoute
                featureId={FEAT.APPROVALS.id}
                actionKey={FEAT.APPROVALS.view}
                featureNameKey="nav.feature.approvals"
              >
                <ApprovalsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/approvals/limits"
            element={
              <PermissionRoute
                featureId={FEAT.APPROVALS.id}
                actionKey={FEAT.APPROVALS.view}
                featureNameKey="nav.feature.approvals"
              >
                <ApprovalLimitsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/commission-rules"
            element={
              <PermissionRoute
                featureId={FEAT.COMMISSION.id}
                actionKey={FEAT.COMMISSION.view}
                featureNameKey="nav.feature.commission"
              >
                <CommissionRulesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <PermissionRoute
                featureId={FEAT.ORDERS.id}
                actionKey={FEAT.ORDERS.view}
                featureNameKey="nav.feature.orders"
              >
                <OrdersPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <PermissionRoute
                featureId={FEAT.ORDERS.id}
                actionKey={FEAT.ORDERS.view}
                featureNameKey="nav.feature.orders"
              >
                <Order360Page />
              </PermissionRoute>
            }
          />
          <Route
            path="/dispatch"
            element={
              <PermissionRoute
                featureId={FEAT.DISPATCH.id}
                actionKey={FEAT.DISPATCH.view}
                featureNameKey="nav.feature.dispatch"
              >
                <DispatchBoardPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <PermissionRoute
                featureId={FEAT.FINANCE.id}
                actionKey={FEAT.FINANCE.view}
                featureNameKey="nav.feature.finance"
              >
                <FinanceControlPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/finance/settlements"
            element={
              <PermissionRoute
                featureId={FEAT.FINANCE.id}
                actionKey={FEAT.FINANCE.view}
                featureNameKey="nav.feature.settlements"
              >
                <SettlementsPayoutsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/integrations"
            element={
              <PermissionRoute
                featureId={FEAT.INTEGRATIONS.id}
                actionKey={FEAT.INTEGRATIONS.view}
                featureNameKey="nav.feature.integrations"
              >
                <IntegrationsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/integrations/crm"
            element={
              <PermissionRoute
                featureId={FEAT.INTEGRATIONS.id}
                actionKey={FEAT.INTEGRATIONS.view}
                featureNameKey="nav.feature.crm"
              >
                <CrmIntegrationPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/integrations/cms"
            element={
              <PermissionRoute
                featureId={FEAT.INTEGRATIONS.id}
                actionKey={FEAT.INTEGRATIONS.view}
                featureNameKey="nav.feature.cms"
              >
                <CmsIntegrationPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/developer/api"
            element={
              <PermissionRoute
                featureId={FEAT.API.id}
                actionKey={FEAT.API.view}
                featureNameKey="nav.feature.apiWebhooks"
              >
                <ApiWebhooksPage />
              </PermissionRoute>
            }
          />
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
