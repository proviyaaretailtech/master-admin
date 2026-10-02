import React from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "../../hooks/use-permissions";
import { AccessDenied } from "./AccessDenied";

export interface PermissionRequirement {
  featureId: string;
  actionKey?: string;
}

interface PermissionRouteProps {
  featureId?: string;
  actionKey?: string;
  anyOf?: PermissionRequirement[];
  /** Already-translated page name. Prefer featureNameKey. */
  featureName?: string;
  /** Catalogue key of the page name, e.g. "nav.feature.usersManagement". */
  featureNameKey?: string;
  children?: React.ReactNode;
}

export const PermissionRoute: React.FC<PermissionRouteProps> = ({
  featureId,
  actionKey,
  anyOf,
  featureName,
  featureNameKey,
  children,
}) => {
  const { t } = useTranslation();
  const { can } = usePermissions();

  const isAllowed =
    anyOf && anyOf.length > 0
      ? anyOf.some((req) => can(req.featureId, req.actionKey))
      : featureId
        ? can(featureId, actionKey)
        : false;

  if (!isAllowed) {
    return <AccessDenied featureName={featureNameKey ? t(featureNameKey) : featureName} />;
  }

  return children ? <>{children}</> : <Outlet />;
};
