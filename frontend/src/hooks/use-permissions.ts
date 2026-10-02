import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../context/auth-context";
import { FeaturePermission } from "../api/role.api";

export interface UsePermissionsReturn {
  permissions: FeaturePermission[];
  isSuperAdmin: boolean;
  can: (featureId: string, actionKey?: string) => boolean;
  canAccess: (featureId: string) => boolean;
  roleName: string;
}

/**
 * Custom React hook for checking feature-by-feature and action-level authorization
 */
export const usePermissions = (): UsePermissionsReturn => {
  const { t } = useTranslation();
  const authContext = useContext(AuthContext);
  const user = authContext?.user;

  // Resolve isSuperAdmin strictly when an authenticated user exists
  const isSuperAdmin = Boolean(
    user && (user.isSuperAdmin || user.role_details?.key === "super_admin")
  );

  const permissions: FeaturePermission[] = user?.permissions || [];

  /**
   * Checks whether the current user is permitted to access a given feature and optional granular action.
   */
  const can = (featureId: string, actionKey?: string): boolean => {
    // Fail-secure: no user context => strictly deny access
    if (!user) {
      return false;
    }

    // Super Admin has unrestricted bypass across all features and actions
    if (isSuperAdmin) {
      return true;
    }

    const feature = permissions.find((f) => f.id === featureId);
    if (!feature || feature.accessLevel === "none") {
      return false;
    }

    if (actionKey) {
      const action = feature.actions?.find((a) => a.key === actionKey);
      return !!action?.enabled;
    }

    return feature.accessLevel === "read_only" || feature.accessLevel === "full";
  };

  const canAccess = (featureId: string): boolean => {
    return can(featureId);
  };

  const roleName = user?.role_details?.name || t("common.unassigned");

  return {
    permissions,
    isSuperAdmin,
    can,
    canAccess,
    roleName,
  };
};
