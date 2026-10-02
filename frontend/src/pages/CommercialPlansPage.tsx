import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Filter,
  ChevronDown,
  CheckCircle2,
  Plus,
  Loader2,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { planApi, CommercialPlanItem } from "../api/plan.api";
import { moduleApi } from "../api/module.api";
import { usePermissions } from "../hooks/use-permissions";
import { useFormat } from "../i18n/useFormat";
import { statusLabel, toCode } from "../i18n/labels";

/** What the "Included modules" column shows. Wording is decided at render time (per language). */
type PlanModules = { kind: "none" } | { kind: "all" } | { kind: "list"; names: string[] };

/**
 * Plain data only: every word the user reads is produced at render time with t()/useFormat(),
 * so the table re-translates the moment the language changes.
 */
export interface PlanItem {
  id: string;
  name: string;
  version: string;
  versionType: "Draft" | "Active" | "Custom" | "Legacy";
  rawPlan: CommercialPlanItem;
  price: number;
  currency: string;
  /** Raw cadence code from the API ("Monthly", "Annual"...); empty when the plan has none. */
  cadence: string;
  /** Backend-owned tax text; empty when the plan has none. */
  taxNote: string;
  status: "Draft" | "Published" | "Retired";
  modules: PlanModules;
  rawModules?: string[];
  isUnlimitedLocations: boolean;
  locationsLimit: number;
  isUnlimitedUsers: boolean;
  usersLimit: number;
  assignmentsCount: number;
  updatedAt: string;
  updatedJustNow?: boolean;
  updatedByEmail: string | null;
  updatedByYou?: boolean;
}

type StatusFilter = "All Active" | "All" | "Draft" | "Published" | "Retired";
type CurrencyFilter = "INR (₹)" | "USD ($)";

/** A toast is a catalogue key plus values, resolved when it is drawn. */
interface ToastMessage {
  key: string;
  values?: Record<string, string | number>;
}

/** Tax notes the backend is known to send; anything else is shown exactly as stored. */
const KNOWN_TAX_NOTE_KEYS: Record<string, string> = {
  "+18% GST Applicable": "plans.list.taxNote.gst18",
  "Exclusive of GST": "plans.list.taxNote.exclusiveGst",
};

const mapApiPlanToItem = (
  p: CommercialPlanItem,
  moduleLookup?: Map<string, string>,
  totalPlatformModulesCount?: number
): PlanItem => {
  const rawList = Array.isArray(p.modules) ? p.modules : [];
  const moduleList = rawList.filter((m) => typeof m === "string" && m.toUpperCase() !== "ALL");

  let modules: PlanModules;

  if (moduleList.length === 0) {
    modules = { kind: "none" };
  } else if (
    totalPlatformModulesCount &&
    totalPlatformModulesCount >= 3 &&
    moduleList.length >= totalPlatformModulesCount
  ) {
    modules = { kind: "all" };
  } else {
    // Map to friendly module names (or fallback to key)
    const names = moduleList.map((k) => {
      const lookup = moduleLookup?.get(k.toUpperCase()) || moduleLookup?.get(k);
      return lookup || k;
    });
    modules = { kind: "list", names };
  }

  return {
    id: p.id,
    name: p.name,
    version: p.version || "1.0",
    versionType: p.version_type,
    rawPlan: p,
    price: p.price,
    currency: p.currency,
    cadence: p.cadence || "",
    taxNote: p.tax_note || "",
    status: p.status,
    modules,
    rawModules: moduleList,
    isUnlimitedLocations: Boolean(p.is_unlimited_locations),
    locationsLimit: p.locations_limit,
    isUnlimitedUsers: Boolean(p.is_unlimited_users),
    usersLimit: p.users_limit,
    assignmentsCount: p.assignments_count || 0,
    updatedAt: p.updated_at || p.created_at,
    updatedByEmail: p.updated_by_email || null,
  };
};

export const CommercialPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { t } = useTranslation();
  const f = useFormat();

  const canCreate = can("feat_commercial_plans", "create_plan");
  const canEdit = can("feat_commercial_plans", "edit_plan");
  const canDuplicate = can("feat_commercial_plans", "duplicate_plan");
  const canRetire = can("feat_commercial_plans", "retire_plan");

  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [modulesCount, setModulesCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All Active");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("INR (₹)");
  const [showRetiredView, setShowRetiredView] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [planToRetire, setPlanToRetire] = useState<PlanItem | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);

  const hasAnyPlanActions = canEdit || canDuplicate || canRetire || showRetiredView;

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const [planRes, modRes] = await Promise.all([
        planApi.getAll(),
        moduleApi.getAll().catch(() => ({ message: "OK", modules: [] })),
      ]);
      const modulesList = modRes.modules || [];
      const lookup = new Map<string, string>();
      modulesList.forEach((m) => {
        const shortName = m.name
          .replace(" Management", "")
          .replace(" Engine", "")
          .replace(" Supply", "");
        lookup.set(m.key.toUpperCase(), shortName);
        lookup.set(m.id, shortName);
      });
      setPlans((planRes.plans || []).map((p) => mapApiPlanToItem(p, lookup, modulesList.length)));
      setModulesCount(modulesList.length);
    } catch {
      setPlans([]);
      setModulesCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // ---- Display helpers (all words and numbers come from the active language) ----

  /** "₹1,499" / "$99" - Indian grouping; prefers the exact paise amount when the API sends it. */
  const formatPlanPrice = (plan: PlanItem) =>
    f.moneyFrom({ ...plan.rawPlan }, "price", { currency: plan.currency });

  /** "/ month". Plans without a cadence show the short form, as before. */
  const formatCadence = (cadence: string) => {
    if (!cadence) return t("plans.list.cadenceShort.default");
    return t(`plans.list.cadenceShort.${toCode(cadence)}`, {
      defaultValue: `/ ${cadence.toLowerCase().replace("ly", "")}`,
    });
  };

  const formatTaxNote = (note: string) => {
    if (!note) return t("plans.list.taxNote.gst18");
    const key = KNOWN_TAX_NOTE_KEYS[note];
    return key ? t(key) : note;
  };

  const formatModules = (modules: PlanModules) => {
    if (modules.kind === "none") {
      return { main: t("plans.list.modules.none"), note: t("plans.list.modules.noneNote") };
    }
    if (modules.kind === "all") {
      return { main: t("plans.list.modules.all"), note: t("plans.list.modules.allNote") };
    }
    const { names } = modules;
    if (names.length <= 2) {
      return {
        main: names.join(", "),
        note: t("plans.list.modules.coreCount", { count: names.length }),
      };
    }
    return {
      main: `${names.slice(0, 2).join(", ")},`,
      note: t("plans.list.modules.more", { value: names.length - 2 }),
    };
  };

  const formatLocationsLimit = (plan: PlanItem) =>
    plan.isUnlimitedLocations
      ? t("plans.list.limits.unlimitedLocations")
      : t("plans.list.limits.locationsAllowed", { count: plan.locationsLimit });

  const formatUsersLimit = (plan: PlanItem) =>
    plan.isUnlimitedUsers
      ? t("plans.list.limits.unlimitedAdmins")
      : t("plans.list.limits.coreAdminUsers", { value: plan.usersLimit });

  const formatUpdatedAt = (plan: PlanItem) =>
    plan.updatedJustNow ? t("common.relative.justNow") : f.date(plan.updatedAt);

  const formatUpdatedBy = (plan: PlanItem) => {
    if (plan.updatedByYou) return t("plans.list.updatedBy.you");
    if (plan.updatedByEmail) return t("plans.list.updatedBy.user", { email: plan.updatedByEmail });
    return t("plans.list.updatedBy.system");
  };

  const showToast = (message: ToastMessage, durationMs = 3000) => {
    setToast(message);
    setTimeout(() => setToast(null), durationMs);
  };

  // Status badge styling helper
  const renderStatusBadge = (status: PlanItem["status"]) => {
    const label = statusLabel(t, status);
    switch (status) {
      case "Published":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#EAF7DB] text-[#2B7000] border border-[#CDE7B2]">
            {label}
          </span>
        );
      case "Draft":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {label}
          </span>
        );
      case "Retired":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
            {label}
          </span>
        );
    }
  };

  const filteredPlans = plans.filter((plan) => {
    if (showRetiredView) return plan.status === "Retired";
    if (statusFilter === "All Active") return plan.status !== "Retired";
    if (statusFilter === "All") return true;
    return plan.status === statusFilter;
  });

  const handleDuplicate = async (plan: PlanItem) => {
    let message: ToastMessage | null = null;
    try {
      const res = await planApi.duplicate(plan.id);
      if (res.plan) {
        setPlans((prev) => [mapApiPlanToItem(res.plan), ...prev]);
        message = { key: "plans.toast.duplicated", values: { name: plan.name } };
      }
    } catch {
      message = { key: "plans.toast.duplicateFailed" };
    }
    if (message) setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenRetireModal = (plan: PlanItem) => {
    setPlanToRetire(plan);
  };

  const handleConfirmRetire = async () => {
    if (!planToRetire) return;
    setIsRetiring(true);
    try {
      await planApi.retire(planToRetire.id);
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planToRetire.id
            ? { ...p, status: "Retired", updatedJustNow: true, updatedByYou: true }
            : p
        )
      );
      setToast({ key: "plans.toast.retired", values: { name: planToRetire.name } });
      setPlanToRetire(null);
    } catch {
      setToast({ key: "plans.toast.retireFailed" });
    } finally {
      setIsRetiring(false);
    }
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreatePlanClick = () => {
    if (modulesCount === 0) {
      showToast({ key: "plans.toast.modulesRequired" }, 3500);
      return;
    }
    navigate("/commercials/plans/new");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 antialiased">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 max-w-[min(28rem,calc(100vw-2rem))] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t(toast.key, toast.values)}</span>
        </div>
      )}

      {/* 1. Breadcrumbs */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
        <Link to="/dashboard" className="hover:text-slate-800">
          {t("plans.list.breadcrumb.master")}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-bold">{t("plans.list.breadcrumb.plans")}</span>
      </nav>

      {/* 2. Top Tabs: Plans & Modules Navigation */}
      <div className="flex flex-wrap border-b border-slate-200 gap-x-8 gap-y-1 text-sm font-semibold">
        <Link
          to="/commercials/plans"
          className="pb-3 border-b-2 border-emerald-600 text-slate-900 transition-colors"
        >
          {t("plans.list.tabs.plans")}
        </Link>
        <Link
          to="/commercials/modules"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-colors"
        >
          {t("plans.list.tabs.modules")}
        </Link>
      </div>

      {/* 3. Header Area with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t("plans.list.title")}
          </h1>
          {isLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowRetiredView(!showRetiredView)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors shadow-2xs cursor-pointer ${
              showRetiredView
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {showRetiredView ? t("plans.list.viewActivePlans") : t("plans.list.viewRetiredPlans")}
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={handleCreatePlanClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{t("plans.list.createPlan")}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Platform Modules Required Warning Alert */}
      {!isLoading && modulesCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">{t("plans.list.modulesRequired.title")}</div>
              <p className="mt-0.5 text-amber-700">{t("plans.list.modulesRequired.body")}</p>
            </div>
          </div>
          <Link
            to="/commercials/modules"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-200 transition-colors"
          >
            <span>{t("plans.list.modulesRequired.link")}</span>
          </Link>
        </div>
      )}

      {/* 5. Filters Row */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold px-1">
          <Filter className="w-3.5 h-3.5 shrink-0" />
          <span>{t("plans.list.filters")}</span>
        </div>

        {/* Status Filter Pill */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label={t("plans.list.filterByStatus")}
            className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="All Active">
              {t("plans.list.statusOption", { value: t("plans.list.statusAllActive") })}
            </option>
            <option value="All">
              {t("plans.list.statusOption", { value: t("plans.list.statusAllStatuses") })}
            </option>
            <option value="Published">
              {t("plans.list.statusOption", { value: statusLabel(t, "Published") })}
            </option>
            <option value="Draft">
              {t("plans.list.statusOption", { value: statusLabel(t, "Draft") })}
            </option>
            <option value="Retired">
              {t("plans.list.statusOption", { value: statusLabel(t, "Retired") })}
            </option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Currency Filter Pill */}
        <div className="relative">
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value as CurrencyFilter)}
            aria-label={t("plans.list.filterByCurrency")}
            className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="INR (₹)">{t("plans.list.currencyOption", { value: "INR (₹)" })}</option>
            <option value="USD ($)">{t("plans.list.currencyOption", { value: "USD ($)" })}</option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 6. Plans Table / Empty State */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">{t("plans.list.loading")}</p>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {showRetiredView ? t("plans.list.emptyRetiredTitle") : t("plans.list.emptyTitle")}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {showRetiredView ? t("plans.list.emptyRetiredBody") : t("plans.list.emptyBody")}
            </p>
            {!showRetiredView && canCreate && (
              <button
                type="button"
                onClick={handleCreatePlanClick}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>{t("plans.list.createFirstPlan")}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">{t("plans.list.columns.planVersion")}</th>
                  <th className="py-3.5 px-4">{t("plans.list.columns.priceCadence")}</th>
                  <th className="py-3.5 px-4">{t("plans.list.columns.status")}</th>
                  <th className="py-3.5 px-4">{t("plans.list.columns.modules")}</th>
                  <th className="py-3.5 px-4">{t("plans.list.columns.limits")}</th>
                  <th className="py-3.5 px-4">{t("plans.list.columns.assignments")}</th>
                  <th className="py-3.5 px-4">{t("plans.list.columns.lastUpdated")}</th>
                  {hasAnyPlanActions && (
                    <th className="py-3.5 px-5 text-right">{t("plans.list.columns.actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPlans.map((plan) => {
                  const modules = formatModules(plan.modules);
                  return (
                    <tr key={plan.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Plan Name & Version */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 text-sm">{plan.name}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {t("plans.list.versionLabel", {
                            version: plan.version,
                            type: statusLabel(t, plan.versionType),
                          })}
                        </div>
                      </td>

                      {/* Price & Cadence */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 whitespace-nowrap">
                          {formatPlanPrice(plan)} {formatCadence(plan.cadence)}
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {formatTaxNote(plan.taxNote)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">{renderStatusBadge(plan.status)}</td>

                      {/* Included Modules */}
                      <td className="py-4 px-4" title={plan.rawModules?.join(", ")}>
                        <div className="text-slate-800 font-medium">{modules.main}</div>
                        {modules.note && (
                          <div className="text-slate-500 text-[11px] mt-0.5">{modules.note}</div>
                        )}
                      </td>

                      {/* Key Limits */}
                      <td className="py-4 px-4">
                        <div className="text-slate-800 font-medium">
                          {formatLocationsLimit(plan)}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {formatUsersLimit(plan)}
                        </div>
                      </td>

                      {/* Assignments */}
                      <td className="py-4 px-4">
                        <div
                          className={`font-semibold ${
                            plan.assignmentsCount > 0
                              ? "text-[#15803D] font-bold"
                              : "text-slate-700"
                          }`}
                        >
                          {t("plans.list.assignmentsLabel", { value: plan.assignmentsCount })}
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td className="py-4 px-4">
                        <div className="text-slate-800 font-medium">{formatUpdatedAt(plan)}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {formatUpdatedBy(plan)}
                        </div>
                      </td>

                      {/* Actions */}
                      {hasAnyPlanActions && (
                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                            {plan.status === "Draft" ? (
                              <>
                                {canEdit && (
                                  <Link
                                    to={`/commercials/plans/${plan.id}/edit`}
                                    className="font-bold text-[#15803D] hover:underline"
                                  >
                                    {t("plans.list.editDraft")}
                                  </Link>
                                )}
                                {canDuplicate && (
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicate(plan)}
                                    className="text-slate-600 hover:text-slate-900 font-medium hover:underline cursor-pointer"
                                  >
                                    {t("common.duplicate")}
                                  </button>
                                )}
                              </>
                            ) : plan.status === "Published" ? (
                              <>
                                {canEdit && (
                                  <Link
                                    to={`/commercials/plans/${plan.id}/edit`}
                                    className="font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                                  >
                                    {t("common.edit")}
                                  </Link>
                                )}
                                {canDuplicate && (
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicate(plan)}
                                    className="font-semibold text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                                  >
                                    {t("common.duplicate")}
                                  </button>
                                )}
                                {canRetire && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRetireModal(plan)}
                                    className="text-slate-600 hover:text-rose-600 font-medium hover:underline cursor-pointer"
                                  >
                                    {t("common.retire")}
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  showToast({
                                    key: "plans.toast.historyShown",
                                    values: { name: plan.name },
                                  })
                                }
                                className="font-medium text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                              >
                                {t("plans.list.viewHistory")}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Retire Commercial Plan Confirmation Modal */}
      {planToRetire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t("plans.dialog.retire.title")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("plans.dialog.retire.subtitle")}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">
                  {t("plans.dialog.retire.planName")}
                </span>
                <span className="font-bold text-slate-900 text-right">{planToRetire.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">
                  {t("plans.dialog.retire.pricing")}
                </span>
                <span className="font-semibold text-slate-800 text-right">
                  {formatPlanPrice(planToRetire)} {formatCadence(planToRetire.cadence)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">
                  {t("plans.dialog.retire.subscriptions")}
                </span>
                <span className="font-semibold text-slate-800 text-right">
                  {t("plans.list.assignmentsLabel", { value: planToRetire.assignmentsCount })}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <Trans
                i18nKey="plans.dialog.retire.confirmBody"
                values={{ name: planToRetire.name }}
                components={{ strong: <strong className="text-slate-900 font-semibold" /> }}
              />
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPlanToRetire(null)}
                disabled={isRetiring}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isRetiring}
                onClick={handleConfirmRetire}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isRetiring && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                <span>
                  {isRetiring
                    ? t("plans.dialog.retire.retiring")
                    : t("plans.dialog.retire.confirm")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommercialPlansPage;
