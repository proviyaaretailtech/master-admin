import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Shield,
  Search,
  Plus,
  User,
  Eye,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  AlertCircle,
  MapPin,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { roleApi } from "../api/role.api";
import { usePermissions } from "../hooks/use-permissions";
import { localizeError } from "../i18n/errors";
import { codeLabel, statusLabel } from "../i18n/labels";

export type FeatureCategory = "all" | FeatureCategoryValue;
type FeatureCategoryValue =
  | "commercials"
  | "partner_detail"
  | "organization"
  | "access_control"
  | "system"
  | "operations"
  | "finance"
  | "platform";

export type AccessLevel = "none" | "read_only" | "full";

export interface GranularAction {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface FeaturePermission {
  id: string;
  name: string;
  category: FeatureCategoryValue;
  pagePath: string;
  description: string;
  accessLevel: AccessLevel;
  actions: GranularAction[];
}

export interface SecurityRole {
  id: string;
  name: string;
  key: string;
  status: "Active" | "Inactive";
  scope: string;
  description: string;
  assignedText: string;
  assignedCount: number;
  isSystem?: boolean;
  features: FeaturePermission[];
}

// iOS-style Toggle Switch
interface ToggleSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = "sm",
  ariaLabel,
}) => {
  const isSm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#65D000]/40 ${
        isSm ? "h-5 w-9" : "h-6 w-11"
      } ${checked ? "bg-[#65D000]" : "bg-slate-200"} ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          isSm
            ? `h-3.5 w-3.5 transform ${checked ? "translate-x-4" : "translate-x-1"}`
            : `h-4.5 w-4.5 transform ${checked ? "translate-x-5" : "translate-x-1"}`
        }`}
      />
    </button>
  );
};

// The permission catalogue (every feature and action a role can be granted) comes from the backend's
// permission registry via GET /roles/catalog, so a feature added there is grantable here without a
// frontend change. There is deliberately no copy of it in this file.

/** A blank matrix for a new role: every catalogue feature, nothing granted. */
export const blankFeatures = (catalogue: FeaturePermission[]): FeaturePermission[] =>
  catalogue.map((feat) => ({
    ...feat,
    accessLevel: "none",
    actions: feat.actions.map((act) => ({ ...act, enabled: false })),
  }));

// ---------------------------------------------------------------------------
// Display text for the static permission catalogue.
// The catalogue (and the payload sent to the API) stays in English; what the admin SEES is looked
// up by feature id / action key, falling back to the original text for ids we do not know yet.
// ---------------------------------------------------------------------------
const featureName = (t: TFunction, feat: Pick<FeaturePermission, "id" | "name">): string =>
  t(`roles.features.${feat.id}.name`, { defaultValue: feat.name });

const featureDescription = (
  t: TFunction,
  feat: Pick<FeaturePermission, "id" | "description">
): string => t(`roles.features.${feat.id}.description`, { defaultValue: feat.description });

const actionLabel = (t: TFunction, featureId: string, act: GranularAction): string =>
  t(`roles.features.${featureId}.actions.${act.key}.label`, { defaultValue: act.label });

const actionDescription = (t: TFunction, featureId: string, act: GranularAction): string =>
  t(`roles.features.${featureId}.actions.${act.key}.description`, {
    defaultValue: act.description,
  });

/** Scope codes as stored by the API ("Platform", "One organization", ...). */
const ALL_SCOPES = "All Scopes";
const SCOPE_VALUES = [
  "Platform",
  "Assigned platform scope",
  "One organization",
  "Assigned locations",
  "Specific outlet",
] as const;

const scopeLabel = (t: TFunction, scope: string): string =>
  scope === ALL_SCOPES ? t("roles.scope.allScopes") : codeLabel(t, "roles.scope", scope);

const ACCESS_LEVEL_KEYS: Record<AccessLevel, string> = {
  none: "roles.access.none",
  read_only: "roles.access.readOnly",
  full: "roles.access.full",
};

const CATEGORY_VALUES: FeatureCategoryValue[] = [
  "commercials",
  "partner_detail",
  "organization",
  "access_control",
  "operations",
  "finance",
  "platform",
  "system",
];

export const RolesPermissionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { can } = usePermissions();

  const canCreateRole = can("feat_roles_templates", "create_roles");
  const canEditRole = can("feat_roles_templates", "edit_roles");
  const canDeleteRole = can("feat_roles_templates", "delete_roles");

  // Route-based title detection (Defaults to Security Policies)

  let locationPath = "";
  try {
    const location = useLocation();
    locationPath = location.pathname;
  } catch {
    locationPath = "";
  }
  const isRolesRoute =
    locationPath.endsWith("/roles") || locationPath.endsWith("/roles-permissions");
  const pageTitle = isRolesRoute ? t("roles.page.templatesTitle") : t("roles.page.policiesTitle");
  const pageSubtitle = isRolesRoute
    ? t("roles.page.templatesSubtitle")
    : t("roles.page.policiesSubtitle");

  // State
  const [roles, setRoles] = useState<SecurityRole[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<string>(ALL_SCOPES);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Modal State
  const [activeModalType, setActiveModalType] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedRole, setSelectedRole] = useState<SecurityRole | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<SecurityRole | null>(null);

  const isModalReadOnly =
    activeModalType === "view" ||
    (activeModalType === "edit" && !canEditRole) ||
    (activeModalType === "create" && !canCreateRole);

  // Modal Form State
  const [formName, setFormName] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formKeyManualOverride, setFormKeyManualOverride] = useState(false);
  const [formScope, setFormScope] = useState("One organization");
  const [formTemplate, setFormTemplate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formFeatures, setFormFeatures] = useState<FeaturePermission[]>([]);
  // Grantable features, from the backend permission registry (GET /roles/catalog).
  const [catalogue, setCatalogue] = useState<FeaturePermission[] | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<FeatureCategory>("all");

  // Notification Toast state
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: "success" | "info" | "error";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  const showNotification = (message: string, type: "success" | "info" | "error" = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const res = await roleApi.getAll();
      setRoles(res.roles || []);
    } catch (err: any) {
      showNotification(localizeError(err, "roles.toast.loadFailed"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCatalogue = async () => {
    try {
      const res = await roleApi.getCatalog();
      setCatalogue(res.features as FeaturePermission[]);
    } catch (err: any) {
      showNotification(localizeError(err, "roles.catalogueLoadFailed"), "error");
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchCatalogue();
  }, []);

  // Convert role name to snake_case key
  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!formKeyManualOverride) {
      setFormKey(generateKey(val));
    }
  };

  // Copy permissions from template
  const handleCopyFromTemplate = (templateKey: string) => {
    setFormTemplate(templateKey);
    const found = roles.find((r) => r.key === templateKey || r.id === templateKey);
    if (found) {
      setFormFeatures(JSON.parse(JSON.stringify(found.features)));
      setFormScope(found.scope);
      if (!formDescription) {
        setFormDescription(found.description);
      }
      showNotification(t("roles.toast.copiedFromTemplate", { name: found.name }), "info");
    }
  };

  // Change Access Level for a whole Feature
  const handleFeatureAccessLevelChange = (featureId: string, level: AccessLevel) => {
    setFormFeatures((prev) =>
      prev.map((feat) => {
        if (feat.id === featureId) {
          const updatedActions = feat.actions.map((act) => {
            if (level === "none") return { ...act, enabled: false };
            if (level === "read_only") {
              // Enable view-oriented actions, disable mutation actions
              return {
                ...act,
                enabled: act.key.startsWith("view_"),
              };
            }
            // Full access: enable all
            return { ...act, enabled: true };
          });
          return {
            ...feat,
            accessLevel: level,
            actions: updatedActions,
          };
        }
        return feat;
      })
    );
  };

  // Toggle individual action switch
  const handleToggleAction = (featureId: string, actionKey: string) => {
    setFormFeatures((prev) =>
      prev.map((feat) => {
        if (feat.id === featureId) {
          const updatedActions = feat.actions.map((act) => {
            if (act.key === actionKey) {
              return { ...act, enabled: !act.enabled };
            }
            return act;
          });

          // Re-calculate access level
          const anyEnabled = updatedActions.some((a) => a.enabled);
          const allEnabled = updatedActions.every((a) => a.enabled);
          const onlyViewEnabled =
            updatedActions.filter((a) => a.key.startsWith("view_")).every((a) => a.enabled) &&
            !updatedActions.some((a) => !a.key.startsWith("view_") && a.enabled);

          let newLevel: AccessLevel = "none";
          if (allEnabled) newLevel = "full";
          else if (onlyViewEnabled) newLevel = "read_only";
          else if (anyEnabled) newLevel = "full";

          return {
            ...feat,
            accessLevel: newLevel,
            actions: updatedActions,
          };
        }
        return feat;
      })
    );
  };

  // Quick Presets
  const applyPresetAll = (level: AccessLevel) => {
    setFormFeatures((prev) =>
      prev.map((feat) => ({
        ...feat,
        accessLevel: level,
        actions: feat.actions.map((act) => ({
          ...act,
          enabled:
            level === "none" ? false : level === "read_only" ? act.key.startsWith("view_") : true,
        })),
      }))
    );
    showNotification(
      level === "full"
        ? t("roles.toast.appliedFull")
        : level === "read_only"
          ? t("roles.toast.appliedReadOnly")
          : t("roles.toast.clearedAll"),
      "info"
    );
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    if (!canCreateRole) {
      showNotification(t("roles.toast.noPermissionCreate"), "error");
      return;
    }
    setSelectedRole(null);
    setFormName("");
    setFormKey("");
    setFormKeyManualOverride(false);
    setFormScope("One organization");
    setFormTemplate("");
    setFormDescription("");
    setFormIsActive(true);
    if (!catalogue) {
      // Without the catalogue a new role could not be granted anything: retry instead of opening.
      showNotification(t("roles.catalogueLoadFailed"), "error");
      fetchCatalogue();
      return;
    }
    setFormFeatures(blankFeatures(catalogue));
    setActiveCategoryTab("all");
    setActiveModalType("create");
  };

  // Open Edit Modal
  const handleOpenEditModal = (role: SecurityRole) => {
    if (!canEditRole) {
      showNotification(t("roles.toast.noPermissionEdit"), "error");
      return;
    }
    setSelectedRole(role);
    setFormName(role.name);
    setFormKey(role.key);
    setFormKeyManualOverride(true);
    setFormScope(role.scope);
    setFormTemplate("");
    setFormDescription(role.description);
    setFormIsActive(role.status === "Active");
    setFormFeatures(JSON.parse(JSON.stringify(role.features)));
    setActiveCategoryTab("all");
    setActiveModalType("edit");
  };

  // Open View Modal
  const handleOpenViewModal = (role: SecurityRole) => {
    setSelectedRole(role);
    setFormName(role.name);
    setFormKey(role.key);
    setFormScope(role.scope);
    setFormDescription(role.description);
    setFormIsActive(role.status === "Active");
    setFormFeatures(JSON.parse(JSON.stringify(role.features)));
    setActiveCategoryTab("all");
    setActiveModalType("view");
  };

  // Save Role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeModalType === "edit" && !canEditRole) {
      showNotification(t("roles.toast.noPermissionEdit"), "error");
      return;
    }
    if (activeModalType === "create" && !canCreateRole) {
      showNotification(t("roles.toast.noPermissionCreate"), "error");
      return;
    }
    if (!formName.trim()) {
      showNotification(t("roles.toast.nameRequired"), "error");
      return;
    }

    // Check duplicate role name (case-insensitive)
    const duplicateRole = roles.find(
      (r) =>
        r.name.trim().toLowerCase() === formName.trim().toLowerCase() &&
        (activeModalType === "create" || r.id !== selectedRole?.id)
    );
    if (duplicateRole) {
      showNotification(t("roles.toast.duplicateName", { name: formName.trim() }), "error");
      return;
    }

    const finalKey = formKey.trim() || generateKey(formName);
    setIsSubmitting(true);

    try {
      if (activeModalType === "edit" && selectedRole) {
        const res = await roleApi.update(selectedRole.id, {
          name: formName.trim(),
          scope: formScope,
          description: formDescription.trim(),
          isActive: formIsActive,
          features: formFeatures,
        });

        setRoles((prev) => prev.map((r) => (r.id === selectedRole.id ? res.role : r)));
        showNotification(t("roles.toast.updated", { name: formName }), "success");
      } else {
        const res = await roleApi.create({
          name: formName.trim(),
          key: finalKey,
          scope: formScope,
          description: formDescription.trim(),
          isActive: formIsActive,
          features: formFeatures,
        });

        setRoles((prev) => [...prev, res.role]);
        showNotification(t("roles.toast.created", { name: formName }), "success");
      }

      setActiveModalType(null);
    } catch (err: any) {
      showNotification(localizeError(err, "roles.toast.saveFailed"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    if (!canDeleteRole) {
      showNotification(t("roles.toast.noPermissionDelete"), "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await roleApi.delete(roleToDelete.id);
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
      showNotification(t("roles.toast.deleted", { name: roleToDelete.name }), "info");
      setRoleToDelete(null);
    } catch (err: any) {
      showNotification(localizeError(err, "roles.toast.deleteFailed"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered features inside modal based on category tab
  const displayedFeatures = useMemo(() => {
    if (activeCategoryTab === "all") return formFeatures;
    return formFeatures.filter((f) => f.category === activeCategoryTab);
  }, [formFeatures, activeCategoryTab]);

  // Compute total active permissions for form
  const totalEnabledPermissions = useMemo(() => {
    return formFeatures.reduce(
      (acc, feat) => acc + feat.actions.filter((a) => a.enabled).length,
      0
    );
  }, [formFeatures]);

  const maxPermissions = useMemo(() => {
    return formFeatures.reduce((acc, feat) => acc + feat.actions.length, 0);
  }, [formFeatures]);

  // Filtered roles in grid
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        role.name.toLowerCase().includes(q) ||
        role.key.toLowerCase().includes(q) ||
        role.scope.toLowerCase().includes(q) ||
        scopeLabel(t, role.scope).toLowerCase().includes(q) ||
        role.description.toLowerCase().includes(q);

      const matchesScope =
        selectedScopeFilter === ALL_SCOPES ||
        role.scope.toLowerCase() === selectedScopeFilter.toLowerCase();

      return matchesSearch && matchesScope;
    });
  }, [roles, searchQuery, selectedScopeFilter, t]);

  return (
    <div className="w-full space-y-6 pb-14 font-sans antialiased text-slate-800">
      {/* Toast Notification */}
      {notification.show && (
        <div className="fixed top-20 right-6 z-50 max-w-[min(28rem,calc(100vw-2rem))] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all animate-in fade-in slide-in-from-top-3 duration-200 bg-white border-slate-200">
          {notification.type === "success" && (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
          {notification.type === "info" && (
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
          )}
          {notification.type === "error" && (
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          )}
          <span className="text-slate-800 font-medium">{notification.message}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. TOP HEADER & CONTROLS                                       */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">{pageSubtitle}</p>
        </div>

        {/* Right Search, Filter & + Create Role Button */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Search Input */}
          <div className="relative min-w-[200px] w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("roles.page.searchPlaceholder")}
              className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium placeholder:text-slate-400 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-2xs cursor-pointer inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {selectedScopeFilter === ALL_SCOPES
                  ? t("common.filter")
                  : scopeLabel(t, selectedScopeFilter)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-max min-w-[13rem] max-w-[18rem] bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                {[ALL_SCOPES, ...SCOPE_VALUES].map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => {
                      setSelectedScopeFilter(scope);
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors ${
                      selectedScopeFilter === scope
                        ? "font-bold text-[#3E8800] bg-[#EEF9E8]/50"
                        : "text-slate-700"
                    }`}
                  >
                    {scopeLabel(t, scope)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* + Create Role Button */}
          {can("feat_roles_templates", "create_roles") && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-[#65D000] hover:bg-[#57B500] text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t("roles.page.createRole")}</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SECURITY TEMPLATES GRID                                     */}
      {/* ============================================================== */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <Loader2 className="w-8 h-8 animate-spin text-[#65D000] mb-2" />
          <span className="text-xs font-semibold text-slate-600">{t("roles.page.loading")}</span>
        </div>
      ) : roles.length === 0 ? (
        <div className="py-16 px-6 bg-white border border-slate-200/80 rounded-2xl text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 stroke-[1.8]" />
          </div>
          <h3 className="text-base font-bold text-slate-800">{t("roles.page.emptyTitle")}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {t("roles.page.emptyBody")}
          </p>
          {canCreateRole && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 text-xs font-bold text-white bg-[#65D000] hover:bg-[#57B500] rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t("roles.page.createFirstRole")}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRoles.map((role) => {
            // Calculate quick stats for this role
            const enabledCount = role.features.reduce(
              (acc, feat) => acc + feat.actions.filter((a) => a.enabled).length,
              0
            );
            const totalCount = role.features.reduce((acc, feat) => acc + feat.actions.length, 0);
            const reviewFeature = role.features.find((f) => f.id === "feat_partner_review");
            const locationsFeature = role.features.find((f) => f.id === "feat_partner_locations");

            return (
              <div
                key={role.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header: Title + Active Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-slate-900 shrink-0 stroke-[2.2]" />
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        {role.name}
                      </h2>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                        role.status === "Active"
                          ? "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {statusLabel(t, role.status)}
                    </span>
                  </div>

                  {/* Scope Row */}
                  <div className="mt-2.5 text-xs flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400 font-medium">{t("roles.card.scope")}</span>
                    <span className="text-slate-700 font-semibold">
                      {scopeLabel(t, role.scope)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-xs text-slate-500 font-normal leading-relaxed">
                    {role.description}
                  </p>

                  {/* Project-Specific Highlights: Locations & Review Actions */}
                  <div className="mt-4 p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-2">
                    {/* Locations Table Access */}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {t("roles.card.locationsTable")}
                      </span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-md ${
                          locationsFeature?.accessLevel === "full"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : locationsFeature?.accessLevel === "read_only"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {locationsFeature?.accessLevel === "full"
                          ? t("roles.card.fullAccessAddEdit")
                          : locationsFeature?.accessLevel === "read_only"
                            ? t("roles.access.readOnly")
                            : t("roles.access.none")}
                      </span>
                    </div>

                    {/* Review Actions Permitted */}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                        {t("roles.card.reviewActions")}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {reviewFeature?.actions.some((a) => a.enabled) ? (
                          reviewFeature.actions
                            .filter((a) => a.enabled)
                            .map((a) => (
                              <span
                                key={a.key}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                              >
                                {a.key === "approve_partner"
                                  ? t("roles.card.review.approve")
                                  : a.key === "reject_partner"
                                    ? t("roles.card.review.reject")
                                    : a.key === "mark_under_review"
                                      ? t("roles.card.review.review")
                                      : t("roles.card.review.delete")}
                              </span>
                            ))
                        ) : (
                          <span className="text-slate-400 italic">{t("common.none")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divider and Footer */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {typeof role.assignedCount === "number"
                          ? t("roles.card.staffAssigned", { count: role.assignedCount })
                          : role.assignedText}
                      </span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-400">
                      {t("roles.card.privileges", { enabled: enabledCount, total: totalCount })}
                    </span>
                  </div>

                  {/* Actions: View, Edit, & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenViewModal(role)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title={t("roles.card.viewTitle")}
                    >
                      <Eye className="w-4 h-4 stroke-[2]" />
                    </button>
                    {can("feat_roles_templates", "edit_roles") && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(role)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title={t("roles.card.editTitle")}
                      >
                        <Pencil className="w-3.5 h-3.5 stroke-[2]" />
                      </button>
                    )}
                    {!role.isSystem && can("feat_roles_templates", "delete_roles") && (
                      <button
                        type="button"
                        onClick={() => setRoleToDelete(role)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title={t("roles.card.deleteTitle")}
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 3. Add Custom Role Dashed Tile */}
          {canCreateRole && (
            <div
              onClick={handleOpenCreateModal}
              className="border-2 border-dashed border-slate-200 hover:border-slate-300 bg-white/40 hover:bg-slate-50/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group min-h-[240px]"
            >
              <div className="w-10 h-10 rounded-full border-2 border-slate-300 text-slate-400 group-hover:text-slate-600 group-hover:border-slate-400 flex items-center justify-center transition-colors mb-3">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-sm text-slate-800 group-hover:text-slate-900 transition-colors">
                {t("roles.page.addCustomRole")}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                {t("roles.page.addCustomRoleHint")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL: FEATURE-BY-FEATURE ROLE BUILDER (Create, View, Edit) */}
      {/* ============================================================== */}
      {activeModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {activeModalType === "create"
                      ? t("roles.modal.createTitle")
                      : activeModalType === "edit"
                        ? t("roles.modal.editTitle")
                        : t("roles.modal.viewTitle", { name: formName })}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeModalType === "view"
                      ? t("roles.modal.viewSubtitle")
                      : t("roles.modal.editSubtitle")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalType(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Row 1: Role name, Key, Scope, Template copy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Role name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("roles.form.roleName")}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isModalReadOnly}
                    placeholder={t("roles.form.roleNamePlaceholder")}
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium text-slate-900 placeholder:text-slate-400 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("roles.form.key")}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isModalReadOnly}
                    placeholder="regional_supervisor"
                    value={formKey}
                    onChange={(e) => {
                      setFormKey(e.target.value);
                      setFormKeyManualOverride(true);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-mono font-medium text-slate-700 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Scope */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("roles.form.operationalScope")}
                  </label>
                  <div className="relative">
                    <select
                      disabled={isModalReadOnly}
                      value={formScope}
                      onChange={(e) => setFormScope(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium text-slate-800 cursor-pointer appearance-none pr-7 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {SCOPE_VALUES.map((scope) => (
                        <option key={scope} value={scope}>
                          {scopeLabel(t, scope)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Copy from template */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("roles.form.copyFromTemplate")}
                  </label>
                  <div className="relative">
                    <select
                      disabled={isModalReadOnly}
                      value={formTemplate}
                      onChange={(e) => handleCopyFromTemplate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium text-slate-800 cursor-pointer appearance-none pr-7 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      <option value="">{t("roles.form.selectDefaultRole")}</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.key}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Row 2: Description & Active Status Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t("roles.form.roleDescription")}
                  </label>
                  <input
                    type="text"
                    disabled={isModalReadOnly}
                    placeholder={t("roles.form.roleDescriptionPlaceholder")}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center gap-2.5 shrink-0 sm:pt-4">
                  <ToggleSwitch
                    size="md"
                    checked={formIsActive}
                    disabled={isModalReadOnly}
                    onChange={(val) => setFormIsActive(val)}
                    ariaLabel={t("roles.form.activeToggleAria")}
                  />
                  <span className="text-xs font-bold text-slate-800 select-none">
                    {t("roles.form.activeLabel")}
                  </span>
                </div>
              </div>

              {/* ========================================================== */}
              {/* FEATURE-BY-FEATURE PERMISSION MATRIX SECTION              */}
              {/* ========================================================== */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        {t("roles.matrix.title")}
                      </h4>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {t("roles.matrix.activeCount", {
                          enabled: totalEnabledPermissions,
                          total: maxPermissions,
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{t("roles.matrix.subtitle")}</p>
                  </div>

                  {/* Preset Shortcuts */}
                  {!isModalReadOnly && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => applyPresetAll("full")}
                        className="text-[11px] font-semibold text-[#3E8800] bg-[#EEF9E8] px-2.5 py-1 rounded-lg hover:bg-[#DEF5CE] transition-colors cursor-pointer"
                      >
                        {t("roles.matrix.presetFull")}
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetAll("read_only")}
                        className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        {t("roles.matrix.presetReadOnly")}
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetAll("none")}
                        className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        {t("roles.matrix.presetClear")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Category Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl">
                  {/* Category Select Filter */}
                  <div className="flex items-center gap-2.5">
                    <label
                      htmlFor="feature-category-filter"
                      className="text-xs font-bold text-slate-700 shrink-0"
                    >
                      {t("roles.matrix.moduleCategory")}
                    </label>
                    <div className="relative">
                      <select
                        id="feature-category-filter"
                        value={activeCategoryTab}
                        onChange={(e) => setActiveCategoryTab(e.target.value as FeatureCategory)}
                        aria-label={t("roles.matrix.categoryAria")}
                        className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#65D000]/30 cursor-pointer"
                      >
                        <option value="all">
                          {t("roles.category.all", { n: formFeatures.length })}
                        </option>
                        {CATEGORY_VALUES.map((cat) => (
                          <option key={cat} value={cat}>
                            {t(`roles.category.${cat}`, {
                              n: formFeatures.filter((f) => f.category === cat).length,
                            })}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Showing count indicator */}
                  <div className="text-[11px] text-slate-500 font-medium">
                    <Trans
                      i18nKey="roles.matrix.showing"
                      count={displayedFeatures.length}
                      components={{ b: <span className="font-bold text-slate-800" /> }}
                    />
                  </div>
                </div>

                {/* Feature Cards List */}
                <div className="space-y-3.5">
                  {displayedFeatures.map((feat) => {
                    const isNone = feat.accessLevel === "none";
                    return (
                      <div
                        key={feat.id}
                        className={`rounded-2xl border transition-all ${
                          isNone
                            ? "bg-slate-50/50 border-slate-200/60 opacity-80"
                            : "bg-white border-slate-200/90 shadow-2xs"
                        }`}
                      >
                        {/* Feature Header Row */}
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                                {featureName(t, feat)}
                              </h5>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                {feat.pagePath}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-normal">
                              {featureDescription(t, feat)}
                            </p>
                          </div>

                          {/* Segmented Control for Access Level */}
                          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 shrink-0 self-start sm:self-auto">
                            {(["none", "read_only", "full"] as AccessLevel[]).map((lvl) => {
                              const isSelected = feat.accessLevel === lvl;
                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  disabled={isModalReadOnly}
                                  onClick={() => handleFeatureAccessLevelChange(feat.id, lvl)}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed ${
                                    isSelected
                                      ? lvl === "full"
                                        ? "bg-[#65D000] text-white shadow-2xs"
                                        : lvl === "read_only"
                                          ? "bg-amber-500 text-white shadow-2xs"
                                          : "bg-slate-700 text-white shadow-2xs"
                                      : "text-slate-600 hover:text-slate-900"
                                  }`}
                                >
                                  {t(ACCESS_LEVEL_KEYS[lvl])}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Granular Action Switches Grid */}
                        <div className="p-4 bg-white/70 rounded-b-2xl">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                            {t("roles.matrix.specificActions")}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {feat.actions.map((act) => (
                              <div
                                key={act.key}
                                className={`flex items-start justify-between gap-2.5 p-2.5 rounded-xl border transition-colors ${
                                  act.enabled
                                    ? "bg-emerald-50/40 border-emerald-200/80"
                                    : "bg-slate-50/60 border-slate-200/60"
                                }`}
                              >
                                <div className="space-y-0.5 pr-2">
                                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{actionLabel(t, feat.id, act)}</span>
                                    {act.enabled && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#65D000]" />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-normal leading-snug">
                                    {actionDescription(t, feat.id, act)}
                                  </div>
                                </div>

                                <ToggleSwitch
                                  size="sm"
                                  checked={act.enabled}
                                  disabled={isModalReadOnly}
                                  onChange={() => handleToggleAction(feat.id, act.key)}
                                  ariaLabel={t("roles.matrix.toggleAria", {
                                    feature: featureName(t, feat),
                                    action: actionLabel(t, feat.id, act),
                                  })}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hidden submit trigger */}
              <button type="submit" className="hidden" />
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] sm:text-xs text-slate-500 font-normal">
                {t("roles.modal.footerNote")}
              </span>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveModalType(null)}
                  className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                >
                  {isModalReadOnly ? t("common.close") : t("common.cancel")}
                </button>

                {!isModalReadOnly ? (
                  <button
                    type="button"
                    onClick={handleSaveRole}
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-[#65D000] hover:bg-[#57B500] rounded-xl transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSubmitting ? t("common.saving") : t("roles.modal.saveRole")}</span>
                  </button>
                ) : canEditRole && selectedRole ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRole) {
                        handleOpenEditModal(selectedRole);
                      }
                    }}
                    className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    {t("roles.modal.editThisRole")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL: DELETE CONFIRMATION FOR CUSTOM ROLES                 */}
      {/* ============================================================== */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t("roles.delete.title")}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("roles.delete.warning")}</p>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-rose-50/60 rounded-xl border border-rose-100 text-xs text-rose-800 font-medium">
              <Trans
                i18nKey="roles.delete.confirm"
                values={{ name: roleToDelete.name, roleKey: roleToDelete.key }}
                components={{ b: <span className="font-bold" /> }}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteRole}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Trash2 className="w-4 h-4" />
                <span>
                  {isSubmitting ? t("roles.delete.deleting") : t("roles.delete.deleteRole")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesPermissionsPage;
