import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "../hooks/use-permissions";
import { AuthContext } from "../context/auth-context";
import { User } from "../@types";

describe("usePermissions Hook (Fail-Secure & Super Admin Bypass)", () => {
  const renderWithUser = (user: User | null) => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider
        value={{
          user,
          token: user ? "mock-token" : null,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        {children}
      </AuthContext.Provider>
    );

    return renderHook(() => usePermissions(), { wrapper });
  };

  it("can() returns false across all features and actions when user is null (fail-secure)", () => {
    const { result } = renderWithUser(null);

    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.roleName).toBe("Unassigned");

    // All can() queries must fail closed
    expect(result.current.can("feat_commercial_plans")).toBe(false);
    expect(result.current.can("feat_commercial_plans", "create_plan")).toBe(false);
    expect(result.current.can("feat_commercial_plans", "retire_plan")).toBe(false);
    expect(result.current.can("feat_partner_review")).toBe(false);
    expect(result.current.can("feat_partner_review", "delete_partner")).toBe(false);
    expect(result.current.can("feat_roles_templates")).toBe(false);
    expect(result.current.canAccess("feat_org_360")).toBe(false);
  });

  it("a super admin with an empty permission string can open all pages and perform all actions", () => {
    const superAdminUser: User = {
      id: "sa-1",
      first_name: "Super",
      last_name: "Admin",
      email: "superadmin@onlatur.com",
      phone_number: "+15550001122",
      isSuperAdmin: true,
      role_details: {
        id: "role-sa",
        name: "Super Admin",
        key: "super_admin",
      } as any,
      permissions: [], // Empty permission array as returned for unconfigured or root
    };

    const { result } = renderWithUser(superAdminUser);

    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.roleName).toBe("Super Admin");

    // Super Admin must bypass all checks and immediately return true
    expect(result.current.can("feat_commercial_plans")).toBe(true);
    expect(result.current.can("feat_commercial_plans", "create_plan")).toBe(true);
    expect(result.current.can("feat_commercial_plans", "edit_plan")).toBe(true);
    expect(result.current.can("feat_commercial_plans", "duplicate_plan")).toBe(true);
    expect(result.current.can("feat_commercial_plans", "retire_plan")).toBe(true);
    expect(result.current.can("feat_partner_review", "delete_partner")).toBe(true);
    expect(result.current.can("feat_roles_templates", "create_roles")).toBe(true);
    expect(result.current.canAccess("feat_org_360")).toBe(true);
  });

  it("a super admin recognized via role_details.key='super_admin' bypasses even if permissions contain 'none'", () => {
    const superAdminWithNoneTemplates: User = {
      id: "sa-2",
      first_name: "Root",
      last_name: "Administrator",
      email: "root@onlatur.com",
      phone_number: "+15550001133",
      isSuperAdmin: false, // fallback to role_details.key
      role_details: {
        id: "role-root",
        name: "Super Administrator",
        key: "super_admin",
      } as any,
      permissions: [
        {
          id: "feat_commercial_plans",
          name: "Commercials",
          category: "commercials" as any,
          pagePath: "/commercials/plans",
          description: "",
          accessLevel: "none",
          actions: [{ key: "retire_plan", label: "", description: "", enabled: false }],
        },
      ],
    };

    const { result } = renderWithUser(superAdminWithNoneTemplates);

    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.can("feat_commercial_plans")).toBe(true);
    expect(result.current.can("feat_commercial_plans", "retire_plan")).toBe(true);
  });

  it("evaluates granular permissions correctly for non-superadmin users", () => {
    const complianceUser: User = {
      id: "user-comp",
      first_name: "Compliance",
      last_name: "Officer",
      email: "compliance@onlatur.com",
      phone_number: "+15552223344",
      isSuperAdmin: false,
      role_details: {
        id: "role-comp",
        name: "Compliance Officer",
        key: "compliance_officer",
      } as any,
      permissions: [
        {
          id: "feat_commercial_plans",
          name: "Commercials",
          category: "commercials" as any,
          pagePath: "/commercials/plans",
          description: "",
          accessLevel: "read_only",
          actions: [
            { key: "view_plans", label: "", description: "", enabled: true },
            { key: "edit_plan", label: "", description: "", enabled: false },
            { key: "retire_plan", label: "", description: "", enabled: false },
          ],
        },
      ],
    };

    const { result } = renderWithUser(complianceUser);

    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.roleName).toBe("Compliance Officer");

    // Allowed actions
    expect(result.current.can("feat_commercial_plans")).toBe(true);
    expect(result.current.can("feat_commercial_plans", "view_plans")).toBe(true);

    // Disallowed actions
    expect(result.current.can("feat_commercial_plans", "edit_plan")).toBe(false);
    expect(result.current.can("feat_commercial_plans", "retire_plan")).toBe(false);

    // Unconfigured features
    expect(result.current.can("feat_roles_templates")).toBe(false);
  });
});
