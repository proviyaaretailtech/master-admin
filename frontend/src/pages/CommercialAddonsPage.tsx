import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  Plus,
  Loader2,
  Filter,
  Package,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { addonApi, CommercialAddonItem } from "../api/addon.api";
import { usePermissions } from "../hooks/use-permissions";
import { useFormat } from "../i18n/useFormat";
import { statusLabel } from "../i18n/labels";
import { localizeError } from "../i18n/errors";

// Sentinel for "no category filter". It is a code, never shown: the label comes from the catalogue.
const ALL_CATEGORIES = "__all__";

// A failure kept as the ERROR (not a string) so it re-translates when the language changes.
type ScreenError = { error: unknown; fallbackKey: string };

export const CommercialAddonsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();

  const canCreate = can("feat_commercial_addons", "create_addon");
  const canEdit = can("feat_commercial_addons", "edit_addon");
  const canPublish = can("feat_commercial_addons", "publish_addon");
  const canRetire = can("feat_commercial_addons", "retire_addon");

  const [addons, setAddons] = useState<CommercialAddonItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<ScreenError | null>(null);

  // Custom Confirmation Modals
  const [addonToRetire, setAddonToRetire] = useState<CommercialAddonItem | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  const [addonToPublish, setAddonToPublish] = useState<CommercialAddonItem | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAddonsAndCategories = async () => {
    setIsLoading(true);
    setScreenError(null);
    try {
      const [addonsRes, categoriesRes] = await Promise.all([
        addonApi.getAll({
          category: selectedCategory !== ALL_CATEGORIES ? selectedCategory : undefined,
        }),
        addonApi.getCategories().catch(() => ({ message: "OK", categories: [] })),
      ]);
      setAddons(addonsRes.addons || []);
      setCategories(categoriesRes.categories || []);
    } catch (err) {
      setAddons([]);
      setScreenError({ error: err, fallbackKey: "addons.list.errors.loadFailed" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAddonsAndCategories();
  }, [selectedCategory]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenPublishModal = (addon: CommercialAddonItem) => {
    setAddonToPublish(addon);
  };

  const handleConfirmPublish = async () => {
    if (!addonToPublish) return;
    setIsPublishing(true);
    try {
      await addonApi.publish(addonToPublish.id);
      showToast(t("addons.toast.published", { name: addonToPublish.name }));
      setAddonToPublish(null);
      fetchAddonsAndCategories();
    } catch (err) {
      setScreenError({ error: err, fallbackKey: "addons.list.errors.publishFailed" });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpenRetireModal = (addon: CommercialAddonItem) => {
    setAddonToRetire(addon);
  };

  const handleConfirmRetire = async () => {
    if (!addonToRetire) return;
    setIsRetiring(true);
    try {
      await addonApi.retire(addonToRetire.id);
      showToast(t("addons.toast.retired", { name: addonToRetire.name }));
      setAddonToRetire(null);
      fetchAddonsAndCategories();
    } catch (err) {
      setScreenError({ error: err, fallbackKey: "addons.list.errors.retireFailed" });
    } finally {
      setIsRetiring(false);
    }
  };

  const formatPrice = (addon: CommercialAddonItem) =>
    t("addons.pricePerUnit", {
      price: f.moneyFrom({ ...addon }, "price", { currency: addon.currency }),
      unit: addon.unit_label || t("addons.unit"),
    });

  const formatCompatibility = (compatiblePlans: string[]) => {
    if (!compatiblePlans || compatiblePlans.length === 0 || compatiblePlans.includes("ALL")) {
      return t("addons.allTiers");
    }
    return compatiblePlans.join(", ");
  };

  const formatActiveAssignments = (addon: CommercialAddonItem) => {
    if (addon.active_units_count > 0) {
      const label = addon.unit_label || t("addons.unit");
      // English plural of the unit noun ("location" -> "locations"); other languages keep the label.
      const unit = label.toLowerCase().endsWith("s")
        ? label
        : t("addons.unitPlural", { unit: label });
      return t("addons.list.activeUnits", { number: f.number(addon.active_units_count), unit });
    }
    return t("addons.list.noActive");
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 max-w-[min(28rem,calc(100vw-2rem))] flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/20 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {screenError && (
        <div className="flex items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{localizeError(screenError.error, screenError.fallbackKey)}</span>
          </div>
          <button
            onClick={() => setScreenError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-4 cursor-pointer"
          >
            {t("addons.dismiss")}
          </button>
        </div>
      )}

      {/* Breadcrumb & Header matching media_1790759140293.png */}
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-slate-400">
          {t("addons.list.breadcrumbMaster")} / {t("addons.list.breadcrumbCommercials")} /{" "}
          <span className="text-slate-600 font-semibold">{t("addons.list.breadcrumbAddons")}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("addons.list.title")}
          </h1>
          {canCreate && (
            <button
              type="button"
              onClick={() => navigate("/commercials/add-ons/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#4FA800] hover:bg-[#439000] active:bg-[#387a00] transition-colors shadow-xs cursor-pointer"
            >
              <span>{t("addons.list.create")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar matching media_1790759140293.png */}
      <div className="flex flex-wrap items-center gap-3 py-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>{t("addons.list.filters")}</span>
        </div>

        {/* Category Dropdown Filter */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            type="button"
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <span>
              {t("addons.list.categoryLabel")}{" "}
              <span className="text-slate-900">
                {selectedCategory === ALL_CATEGORIES
                  ? t("addons.list.allCategories")
                  : selectedCategory}
              </span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isFilterDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in-50 zoom-in-95">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(ALL_CATEGORIES);
                  setIsFilterDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 font-medium transition-colors hover:bg-slate-50 cursor-pointer flex items-center justify-between ${
                  selectedCategory === ALL_CATEGORIES
                    ? "text-[#4FA800] font-bold bg-[#F4FBEF]"
                    : "text-slate-700"
                }`}
              >
                <span>{t("addons.list.allCategories")}</span>
                {selectedCategory === ALL_CATEGORIES && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4FA800]" />
                )}
              </button>

              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 font-medium transition-colors hover:bg-slate-50 cursor-pointer flex items-center justify-between ${
                    selectedCategory === cat
                      ? "text-[#4FA800] font-bold bg-[#F4FBEF]"
                      : "text-slate-700"
                  }`}
                >
                  <span>{cat}</span>
                  {selectedCategory === cat && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#4FA800]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <Loader2 className="w-8 h-8 animate-spin text-[#4FA800] mb-3" />
          <p className="text-xs font-semibold text-slate-600">{t("addons.list.loadingTitle")}</p>
          <p className="text-[11px] text-slate-400 mt-1">{t("addons.list.loadingHint")}</p>
        </div>
      ) : addons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#4FA800] mb-3.5 shadow-xs">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{t("addons.list.emptyTitle")}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {selectedCategory !== ALL_CATEGORIES
              ? t("addons.list.emptyForCategory", { category: selectedCategory })
              : t("addons.list.emptyHint")}
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={() => navigate("/commercials/add-ons/new")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#4FA800] hover:bg-[#439000] transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("addons.list.create")}</span>
            </button>
          )}
        </div>
      ) : (
        /* Add-ons Catalog Table matching media_1790759140293.png */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#FAFAFA] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{t("addons.list.colName")}</th>
                  <th className="py-3.5 px-4">{t("addons.list.colCategory")}</th>
                  <th className="py-3.5 px-4">{t("addons.list.colCompatibility")}</th>
                  <th className="py-3.5 px-4">{t("addons.list.colPrice")}</th>
                  <th className="py-3.5 px-4">{t("addons.list.colStatus")}</th>
                  <th className="py-3.5 px-4">{t("addons.list.colAssignments")}</th>
                  <th className="py-3.5 px-4 text-right">{t("addons.list.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {addons.map((addon) => (
                  <tr key={addon.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* ADD-ON NAME & ID */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900 text-xs">{addon.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {t("addons.list.idPrefix", { code: addon.addon_code })}
                      </div>
                    </td>

                    {/* CATEGORY */}
                    <td className="py-4 px-4 text-slate-600 font-normal">{addon.category}</td>

                    {/* COMPATIBILITY */}
                    <td className="py-4 px-4 text-slate-600 font-normal">
                      {formatCompatibility(addon.compatible_plans)}
                    </td>

                    {/* UNIT PRICE & QUANTITY */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{formatPrice(addon)}</div>
                      {addon.pricing_subtitle && (
                        <div className="text-[11px] text-slate-400 mt-0.5 font-normal">
                          {addon.pricing_subtitle}
                        </div>
                      )}
                    </td>

                    {/* STATUS BADGE */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          addon.status === "Published"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : addon.status === "Draft"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {statusLabel(t, addon.status)}
                      </span>
                    </td>

                    {/* ACTIVE ASSIGNMENTS */}
                    <td className="py-4 px-4">
                      <span
                        className={`font-semibold ${
                          addon.active_units_count > 0 || addon.assigned_count > 0
                            ? "text-[#4FA800] font-bold"
                            : "text-slate-600 font-normal"
                        }`}
                      >
                        {formatActiveAssignments(addon)}
                      </span>
                    </td>

                    {/* ACTIONS */}
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                        {addon.status === "Published" ? (
                          <>
                            {canEdit && (
                              <Link
                                to={`/commercials/add-ons/${addon.id}/edit`}
                                className="text-slate-600 hover:text-slate-900 font-semibold transition-colors"
                              >
                                {t("common.edit")}
                              </Link>
                            )}
                            {canRetire && (
                              <button
                                type="button"
                                onClick={() => handleOpenRetireModal(addon)}
                                className="text-slate-500 hover:text-amber-600 font-semibold transition-colors cursor-pointer"
                              >
                                {t("common.retire")}
                              </button>
                            )}
                          </>
                        ) : addon.status === "Draft" ? (
                          <>
                            {canEdit && (
                              <Link
                                to={`/commercials/add-ons/${addon.id}/edit`}
                                className="text-slate-600 hover:text-slate-900 font-semibold transition-colors"
                              >
                                {t("addons.list.editDraft")}
                              </Link>
                            )}
                            {canPublish && (
                              <button
                                type="button"
                                onClick={() => handleOpenPublishModal(addon)}
                                className="text-[#4FA800] hover:text-[#439000] font-semibold transition-colors cursor-pointer"
                              >
                                {t("common.publish")}
                              </button>
                            )}
                          </>
                        ) : (
                          // Retired Add-on
                          canEdit && (
                            <Link
                              to={`/commercials/add-ons/${addon.id}/edit`}
                              className="text-slate-600 hover:text-slate-900 font-semibold transition-colors"
                            >
                              {t("common.edit")}
                            </Link>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Publish Add-on Confirmation Modal (No window.confirm/alert!) */}
      {addonToPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t("addons.dialog.publish.title")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("addons.dialog.publish.catalogHint")}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("addons.dialog.addonName")}</span>
                <span className="font-bold text-slate-900 text-right">{addonToPublish.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("addons.dialog.addonId")}</span>
                <span className="font-mono text-slate-800 text-right">
                  {addonToPublish.addon_code}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("addons.dialog.unitPrice")}</span>
                <span className="font-semibold text-slate-800 text-right">
                  {formatPrice(addonToPublish)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">
                  {t("addons.dialog.compatibility")}
                </span>
                <span className="font-semibold text-slate-800 text-right">
                  {formatCompatibility(addonToPublish.compatible_plans)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t("addons.dialog.publish.catalogNote")}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAddonToPublish(null)}
                disabled={isPublishing}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={handleConfirmPublish}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#4FA800] hover:bg-[#439000] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isPublishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isPublishing
                    ? t("addons.dialog.publish.publishing")
                    : t("addons.dialog.publish.confirm")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retire Add-on Confirmation Modal (No window.confirm/alert!) */}
      {addonToRetire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t("addons.dialog.retire.title")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("addons.dialog.retire.hint")}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("addons.dialog.addonName")}</span>
                <span className="font-bold text-slate-900 text-right">{addonToRetire.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("addons.dialog.addonId")}</span>
                <span className="font-mono text-slate-800 text-right">
                  {addonToRetire.addon_code}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">
                  {t("addons.dialog.activeAssignments")}
                </span>
                <span className="font-semibold text-slate-800 text-right">
                  {formatActiveAssignments(addonToRetire)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <Trans
                i18nKey="addons.dialog.retire.confirmText"
                values={{ name: addonToRetire.name }}
                components={{ strong: <strong className="text-slate-900 font-semibold" /> }}
              />
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAddonToRetire(null)}
                disabled={isRetiring}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isRetiring}
                onClick={handleConfirmRetire}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isRetiring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isRetiring
                    ? t("addons.dialog.retire.retiring")
                    : t("addons.dialog.retire.confirm")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
