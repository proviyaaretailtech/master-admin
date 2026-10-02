import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, X, Loader2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { planApi } from "../api/plan.api";
import { moduleApi } from "../api/module.api";
import { usePermissions } from "../hooks/use-permissions";
import { cadenceLabel } from "../i18n/labels";
import { localizeError } from "../i18n/errors";

interface PlatformModule {
  id: string;
  key: string;
  name: string;
  selected: boolean;
  isFuture?: boolean;
}

/**
 * A toast is either a catalogue key (plus values) or a caught error with its fallback key.
 * It is turned into text when drawn, so it always shows in the current language.
 */
type ToastMessage =
  | { key: string; values?: Record<string, string | number> }
  | { error: unknown; fallbackKey: string };

export const PlanEditorPage: React.FC = () => {
  const { planId } = useParams<{ planId?: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { t } = useTranslation();

  const isNew = !planId || planId === "new";
  const canCreate = can("feat_commercial_plans", "create_plan");
  const canEdit = can("feat_commercial_plans", "edit_plan");
  const canPublish = can("feat_commercial_plans", "publish_plan");
  const canManageModules = can("feat_commercial_plans", "manage_modules");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Plan Details State (No static mock data)
  const [planName, setPlanName] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [billingCadence, setBillingCadence] = useState("Monthly");
  const [trialDays, setTrialDays] = useState("14");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);

  // Hard Provision Limits State
  const [locationsAllowed, setLocationsAllowed] = useState("1");
  const [coreAdminUsers, setCoreAdminUsers] = useState("3");

  // Modules State - Pure DB-driven
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modals & Feedback
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  // Load modules & existing plan if editing
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch live platform modules from DB
        const modRes = await moduleApi.getAll();
        let loadedModules: PlatformModule[] = (modRes.modules || []).map((m) => ({
          id: m.id,
          key: m.key,
          name: m.name,
          selected: isNew, // Select all existing modules by default when creating new plan
        }));

        // If editing an existing plan, fetch plan details
        if (!isNew && planId) {
          const planRes = await planApi.getById(planId);
          if (planRes.plan) {
            const p = planRes.plan;
            setPlanName(p.name);
            setPlanCode(p.plan_code);
            setPrice(p.price.toString());
            setCurrency(p.currency);
            setBillingCadence(p.cadence || "Monthly");
            setTrialDays(p.trial_days.toString());
            setEffectiveDate(
              p.effective_date
                ? p.effective_date.split("T")[0]
                : new Date().toISOString().split("T")[0]
            );
            setLocationsAllowed(p.locations_limit.toString());
            setCoreAdminUsers(p.users_limit.toString());

            // Match module selections strictly by module key/code, supporting case-insensitivity and legacy ALL
            const planModules = Array.isArray(p.modules) ? p.modules : [];
            const hasAllFlag = planModules.some(
              (k) => typeof k === "string" && k.toUpperCase() === "ALL"
            );

            loadedModules = loadedModules.map((m) => {
              const isIncluded =
                hasAllFlag ||
                planModules.some(
                  (k) =>
                    typeof k === "string" && (k.toUpperCase() === m.key.toUpperCase() || k === m.id)
                );
              return {
                ...m,
                selected: isIncluded,
              };
            });
          }
        }

        setModules(loadedModules);
      } catch {
        setModules([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [planId, isNew]);

  const selectedCount = modules.filter((m) => m.selected).length;

  const toggleModule = (id: string) => {
    if (!canManageModules) {
      setToastMessage({ key: "plans.toast.noPermissionModules" });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m)));
    setHasUnsavedChanges(true);
  };

  const handleSaveDraft = async () => {
    if (modules.length === 0) {
      setToastMessage({ key: "plans.toast.modulesRequiredToSave" });
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    if (!isNew && !canEdit) {
      setToastMessage({ key: "plans.toast.noPermissionEdit" });
      return;
    }
    if (isNew && !canCreate) {
      setToastMessage({ key: "plans.toast.noPermissionCreate" });
      return;
    }

    setIsSaving(true);
    const selectedKeys = modules.filter((m) => m.selected).map((m) => m.key);
    const payload = {
      name: planName,
      plan_code: planCode,
      price: parseFloat(price.replace(/,/g, "")) || 0,
      currency,
      cadence: (billingCadence as "Monthly" | "Quarterly" | "Annual") || "Monthly",
      trial_days: parseInt(trialDays, 10) || 3,
      effective_date: effectiveDate,
      locations_limit: parseInt(locationsAllowed, 10) || 1,
      users_limit: parseInt(coreAdminUsers, 10) || 3,
      modules: selectedKeys, // Always store explicit module codes
      status: "Draft" as const,
      version_type: "Draft" as const,
    };

    try {
      if (isNew) {
        const res = await planApi.create(payload);
        setToastMessage({ key: "plans.toast.draftCreated" });
        setHasUnsavedChanges(false);
        setTimeout(() => navigate(`/commercials/plans/${res.plan.id}/edit`), 1000);
      } else if (planId) {
        await planApi.update(planId, payload);
        setToastMessage({ key: "plans.toast.draftSaved" });
        setHasUnsavedChanges(false);
      }
    } catch (err: unknown) {
      setToastMessage({ error: err, fallbackKey: "plans.toast.saveDraftFailed" });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handlePublish = async () => {
    if (modules.length === 0) {
      setToastMessage({ key: "plans.toast.modulesRequiredToPublish" });
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    if (!canPublish) {
      setToastMessage({ key: "plans.toast.noPermissionPublish" });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      const selectedKeys = modules.filter((m) => m.selected).map((m) => m.key);
      if (isNew) {
        await planApi.create({
          name: planName,
          plan_code: planCode,
          price: parseFloat(price.replace(/,/g, "")) || 0,
          currency,
          cadence: (billingCadence as "Monthly" | "Quarterly" | "Annual") || "Monthly",
          trial_days: parseInt(trialDays, 10) || 3,
          effective_date: effectiveDate,
          locations_limit: parseInt(locationsAllowed, 10) || 1,
          users_limit: parseInt(coreAdminUsers, 10) || 3,
          modules: selectedKeys, // Always store explicit module codes
          status: "Published",
          version_type: "Active",
        });
        setToastMessage({ key: "plans.toast.createdAndPublished", values: { name: planName } });
      } else if (planId) {
        await planApi.update(planId, {
          name: planName,
          plan_code: planCode,
          price: parseFloat(price.replace(/,/g, "")) || 0,
          currency,
          cadence: (billingCadence as "Monthly" | "Quarterly" | "Annual") || "Monthly",
          trial_days: parseInt(trialDays, 10) || 3,
          effective_date: effectiveDate,
          locations_limit: parseInt(locationsAllowed, 10) || 1,
          users_limit: parseInt(coreAdminUsers, 10) || 3,
          modules: selectedKeys,
        });
        await planApi.publish(planId);
        setToastMessage({ key: "plans.toast.published", values: { name: planName } });
      }
      setHasUnsavedChanges(false);
      setTimeout(() => navigate("/commercials/plans"), 1200);
    } catch (err: unknown) {
      setToastMessage({ error: err, fallbackKey: "plans.toast.publishFailed" });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-[min(28rem,calc(100vw-2rem))] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {"error" in toastMessage
              ? localizeError(toastMessage.error, toastMessage.fallbackKey)
              : t(toastMessage.key, toastMessage.values)}
          </span>
        </div>
      )}

      {/* 1. Breadcrumb Navigation */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
        <Link to="/dashboard" className="hover:text-slate-800">
          {t("plans.editor.breadcrumb.master")}
        </Link>
        <span>/</span>
        <Link to="/commercials" className="hover:text-slate-800">
          {t("plans.editor.breadcrumb.commercials")}
        </Link>
        <span>/</span>
        <Link to="/commercials/plans" className="hover:text-slate-800">
          {t("plans.editor.breadcrumb.plans")}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-bold">
          {isNew
            ? t("plans.editor.breadcrumb.newPlan")
            : planName || t("plans.editor.breadcrumb.editPlan")}
        </span>
      </nav>

      {/* 2. Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isNew
              ? t("plans.editor.createTitle")
              : t("plans.editor.editTitle", {
                  name: planName || t("plans.editor.planFallback"),
                })}
          </h1>
          {isLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            {t("plans.editor.previewPublishImpact")}
          </button>

          {(isNew ? canCreate : canEdit) && (
            <button
              type="button"
              disabled={isSaving || modules.length === 0}
              onClick={handleSaveDraft}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? t("common.saving") : t("plans.editor.saveDraft")}
            </button>
          )}

          {canPublish && (
            <button
              type="button"
              disabled={isSaving || modules.length === 0}
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isSaving ? t("plans.editor.publishing") : t("plans.editor.publishPlan")}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Platform Modules Required Warning Banner */}
      {!isLoading && modules.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">{t("plans.editor.modulesRequired.title")}</div>
              <p className="mt-0.5 text-amber-700">{t("plans.editor.modulesRequired.body")}</p>
            </div>
          </div>
          <Link
            to="/commercials/modules"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-200 transition-colors"
          >
            <span>{t("plans.editor.goToModules")}</span>
          </Link>
        </div>
      )}

      {/* 4. Unsaved Changes Alert Notice */}
      {hasUnsavedChanges && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span>{t("plans.editor.unsavedChanges")}</span>
        </div>
      )}

      {/* 5. Main 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Plan Basics & Hard Limits */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Plan Basics */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {t("plans.editor.basics.title")}
            </h2>

            {/* Row 0: Plan Name & Plan Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  {t("plans.editor.basics.planName")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("plans.editor.basics.planNamePlaceholder")}
                  value={planName}
                  onChange={(e) => {
                    setPlanName(e.target.value);
                    if (isNew) {
                      setPlanCode(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "_")
                          .replace(/_+/g, "_")
                      );
                    }
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  {t("plans.editor.basics.planCode")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("plans.editor.basics.planCodePlaceholder")}
                  value={planCode}
                  onChange={(e) => {
                    setPlanCode(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  {t("plans.editor.basics.price")}
                </label>
                <input
                  type="text"
                  placeholder={t("plans.editor.basics.pricePlaceholder")}
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  {t("plans.editor.basics.billingCadence")}
                </label>
                <select
                  value={billingCadence}
                  onChange={(e) => {
                    setBillingCadence(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Monthly">{cadenceLabel(t, "Monthly")}</option>
                  <option value="Quarterly">{cadenceLabel(t, "Quarterly")}</option>
                  <option value="Annual">{cadenceLabel(t, "Annual")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  {t("plans.editor.basics.trialDays")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={trialDays}
                  onChange={(e) => {
                    setTrialDays(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  {t("plans.editor.basics.effectiveDate")}
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => {
                    setEffectiveDate(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Hard Provision Limits */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {t("plans.editor.limits.title")}
            </h2>

            <div className="space-y-4">
              {/* Row 1: Locations allowed */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-slate-800 min-w-[120px]">
                  {t("plans.editor.limits.locationsAllowed")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={locationsAllowed}
                  onChange={(e) => {
                    setLocationsAllowed(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-20 text-center bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-400 text-right flex-1">
                  {t("plans.editor.limits.locationsHint")}
                </span>
              </div>

              {/* Row 2: Core admin users */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-slate-800 min-w-[120px]">
                  {t("plans.editor.limits.coreAdminUsers")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={coreAdminUsers}
                  onChange={(e) => {
                    setCoreAdminUsers(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-20 text-center bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-400 text-right flex-1">
                  {t("plans.editor.limits.coreAdminUsersHint")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Included Platform Modules */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  {t("plans.editor.bundle.title")}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{t("plans.editor.bundle.subtitle")}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isLoading && modules.length > 0 && (
                  <span className="text-xs font-extrabold text-[#15803D] tracking-wider uppercase">
                    {t("plans.editor.bundle.selected", { value: selectedCount })}
                  </span>
                )}
              </div>
            </div>

            {/* Modules Checkable List or Empty State */}
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  {t("plans.editor.bundle.loading")}
                </p>
              </div>
            ) : modules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-8 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <div className="text-sm font-bold text-amber-900">
                  {t("plans.editor.bundle.emptyTitle")}
                </div>
                <p className="text-xs text-amber-700 max-w-sm mx-auto">
                  {t("plans.editor.bundle.emptyBody")}
                </p>
                <Link
                  to="/commercials/modules"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-2xs"
                >
                  <span>{t("plans.editor.goToModules")}</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {modules.map((mod) => (
                  <div
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer select-none text-xs ${
                      mod.selected
                        ? "bg-[#EAF7DB] border-[#C5E59F] text-slate-900 font-semibold shadow-2xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          mod.selected
                            ? "bg-[#15803D] text-white"
                            : "border border-slate-300 bg-white"
                        }`}
                      >
                        {mod.selected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{mod.name}</span>
                        <span className="font-mono text-[10px] text-slate-400 font-semibold uppercase">
                          [{mod.key}]
                        </span>
                      </div>
                    </div>

                    {mod.isFuture && (
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        {t("plans.editor.bundle.future")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Bottom Navigation */}
      <div className="pt-2">
        <Link
          to="/commercials/plans"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t("plans.editor.backToPlans")}</span>
        </Link>
      </div>

      {/* 7. Preview Publish Impact Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {t("plans.editor.preview.title")}
              </h3>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                aria-label={t("common.close")}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                <span className="font-bold">{t("plans.editor.preview.reviewTitle")}</span>{" "}
                {t("plans.editor.preview.reviewBody")}
              </div>

              <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t("plans.editor.preview.planName")}</span>
                  <span className="font-bold text-slate-800 text-right">
                    {planName || t("plans.editor.preview.untitled")}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t("plans.editor.preview.planCode")}</span>
                  <span className="font-mono font-bold text-slate-800 text-right">
                    {planCode || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t("plans.editor.preview.price")}</span>
                  <span className="font-bold text-slate-800 text-right">
                    {t("plans.editor.preview.priceValue", {
                      currency,
                      price: price || "0",
                      cadence: cadenceLabel(t, billingCadence),
                    })}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t("plans.editor.preview.activeModules")}</span>
                  <span className="font-bold text-emerald-700 text-right">
                    {t("plans.editor.preview.modulesIncluded", { value: selectedCount })}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t("plans.editor.preview.maxLocations")}</span>
                  <span className="font-bold text-slate-800 text-right">
                    {t("plans.editor.preview.locationsAllowed", { value: locationsAllowed })}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t("plans.editor.preview.adminSeats")}</span>
                  <span className="font-bold text-slate-800 text-right">
                    {t("plans.editor.preview.adminUsers", { value: coreAdminUsers })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                {t("plans.editor.preview.close")}
              </button>
              <button
                type="button"
                disabled={isSaving || modules.length === 0}
                onClick={() => {
                  setShowPreviewModal(false);
                  handlePublish();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 cursor-pointer"
              >
                {t("plans.editor.preview.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanEditorPage;
