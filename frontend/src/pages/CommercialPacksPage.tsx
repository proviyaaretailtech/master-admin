import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { packApi, CommercialPackItem } from "../api/pack.api";
import { planApi, CommercialPlanItem } from "../api/plan.api";
import { usePermissions } from "../hooks/use-permissions";
import { useFormat } from "../i18n/useFormat";
import { statusLabel, cadenceLabel } from "../i18n/labels";
import { localizeError } from "../i18n/errors";

// An error kept as the ERROR (not a string) so it re-translates if the language changes.
type PageError = { err: unknown; fallbackKey: string };
// A success toast kept as a catalogue key + values for the same reason.
type PageToast = { key: "packs.toast.published" | "packs.toast.retired"; name: string };

export const CommercialPacksPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();

  const canCreate = can("feat_commercial_packs", "create_pack");
  const canEdit = can("feat_commercial_packs", "edit_pack");
  const canPublish = can("feat_commercial_packs", "publish_pack");
  const canRetire = can("feat_commercial_packs", "retire_pack");

  const [packs, setPacks] = useState<CommercialPackItem[]>([]);
  const [plans, setPlans] = useState<CommercialPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCompatibility, setSelectedCompatibility] = useState<string>("All");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<PageToast | null>(null);
  const [error, setError] = useState<PageError | null>(null);
  const [packToRetire, setPackToRetire] = useState<CommercialPackItem | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);

  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter plans to ONLY published plans and deduplicate by name
  const publishedPlans = useMemo(() => {
    const map = new Map<string, CommercialPlanItem>();
    plans
      .filter((p) => p.status === "Published")
      .forEach((p) => {
        if (!map.has(p.name)) {
          map.set(p.name, p);
        }
      });
    return Array.from(map.values());
  }, [plans]);

  const fetchPacksAndPlans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [packsRes, plansRes] = await Promise.all([
        packApi.getAll({
          compatibility: selectedCompatibility !== "All" ? selectedCompatibility : undefined,
        }),
        planApi.getAll().catch(() => ({ message: "OK", plans: [], total: 0 })),
      ]);
      setPacks(packsRes.packs || []);
      setPlans(plansRes.plans || []);
    } catch (err: unknown) {
      setPacks([]);
      setError({ err, fallbackKey: "packs.toast.loadFailed" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPacksAndPlans();
  }, [selectedCompatibility]);

  const showToast = (next: PageToast) => {
    setToast(next);
    setTimeout(() => setToast(null), 4000);
  };

  const handlePublish = async (id: string, name: string) => {
    try {
      await packApi.publish(id);
      showToast({ key: "packs.toast.published", name });
      fetchPacksAndPlans();
    } catch (err: unknown) {
      setError({ err, fallbackKey: "packs.toast.publishFailed" });
    }
  };

  const handleOpenRetireModal = (pack: CommercialPackItem) => {
    setPackToRetire(pack);
  };

  const handleConfirmRetire = async () => {
    if (!packToRetire) return;
    setIsRetiring(true);
    try {
      await packApi.retire(packToRetire.id);
      showToast({ key: "packs.toast.retired", name: packToRetire.name });
      setPackToRetire(null);
      fetchPacksAndPlans();
    } catch (err: unknown) {
      setError({ err, fallbackKey: "packs.toast.retireFailed" });
    } finally {
      setIsRetiring(false);
    }
  };

  // Render status badge (the raw status stays the code; only the shown text is translated)
  const renderStatusBadge = (status: CommercialPackItem["status"]) => {
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
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600">
            {label}
          </span>
        );
    }
  };

  // Format compatible plans display
  const formatCompatiblePlans = (compatiblePlans: string[]) => {
    if (!compatiblePlans || compatiblePlans.length === 0) {
      return t("packs.list.allCommercialPlans");
    }
    return compatiblePlans.join(", ");
  };

  // Format price: "₹1,499 / monthly"
  const formatPrice = (pack: CommercialPackItem) =>
    t("packs.list.priceWithCadence", {
      amount: f.moneyFrom(pack as unknown as Record<string, unknown>, "price", {
        currency: pack.currency,
      }),
      cadence: cadenceLabel(t, pack.cadence).toLowerCase(),
    });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-[min(28rem,calc(100vw-2rem))] flex items-center gap-2 bg-emerald-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{t(toast.key, { name: toast.name })}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{localizeError(error.err, error.fallbackKey)}</span>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <span>{t("packs.shared.breadcrumbMaster")}</span>
            <span>/</span>
            <span>{t("packs.shared.breadcrumbCommercials")}</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">
              {t("packs.shared.breadcrumbPacks")}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("packs.list.title")}
          </h1>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => navigate("/commercials/packs/new")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{t("packs.shared.createPack")}</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar matching screenshot */}
      <div className="flex flex-wrap items-center gap-3">
        <div ref={filterDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{t("packs.list.filters")}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {isFilterDropdownOpen && (
            <div className="absolute left-0 mt-1 w-max min-w-[16rem] max-w-[20rem] bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-2 text-xs">
              <div className="font-semibold text-slate-700 px-2 py-1 mb-1 border-b border-slate-100 flex items-center justify-between">
                <span>{t("packs.list.filterByCompatibility")}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCompatibility("All");
                  setIsFilterDropdownOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                  selectedCompatibility === "All"
                    ? "bg-[#DEF5CE] text-[#337400] font-semibold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t("packs.list.allCompatiblePlans")}
              </button>
              {publishedPlans.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-slate-400">
                  {t("packs.list.noPublishedPlans")}
                </div>
              ) : (
                publishedPlans.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      setSelectedCompatibility(pl.name);
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                      selectedCompatibility === pl.name
                        ? "bg-[#DEF5CE] text-[#337400] font-semibold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {pl.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedCompatibility !== "All" && (
          <div className="inline-flex flex-wrap items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-300 rounded-full text-xs font-medium text-slate-800">
            <span className="text-slate-500">{t("packs.list.compatibilityLabel")}</span>
            <span className="font-semibold">{selectedCompatibility}</span>
            <button
              type="button"
              onClick={() => setSelectedCompatibility("All")}
              className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
              title={t("packs.list.clearFilter")}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-[#15803D] animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">{t("packs.list.loading")}</p>
        </div>
      ) : packs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-xl border border-dashed border-slate-300 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {t("packs.list.emptyTitle")}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mb-5">{t("packs.list.emptyBody")}</p>
          {canCreate && (
            <button
              type="button"
              onClick={() => navigate("/commercials/packs/new")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{t("packs.shared.createPack")}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5">{t("packs.list.columns.packName")}</th>
                  <th className="py-3 px-4">{t("packs.list.columns.compatiblePlans")}</th>
                  <th className="py-3 px-4">{t("common.status")}</th>
                  <th className="py-3 px-4">{t("packs.list.columns.includedFeatures")}</th>
                  <th className="py-3 px-4">{t("packs.list.columns.priceInr")}</th>
                  <th className="py-3 px-4">{t("packs.list.columns.assignedOrgs")}</th>
                  <th className="py-3 px-5 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packs.map((pack) => (
                  <tr key={pack.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* PACK NAME & ID */}
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 text-sm">{pack.name}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {t("packs.list.packId", { code: pack.pack_code })}
                      </div>
                    </td>

                    {/* COMPATIBLE PLANS */}
                    <td className="py-4 px-4">
                      <div className="text-slate-800 font-medium max-w-xs">
                        {formatCompatiblePlans(pack.compatible_plans)}
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className="py-4 px-4">{renderStatusBadge(pack.status)}</td>

                    {/* INCLUDED FEATURES */}
                    <td className="py-4 px-4">
                      <div className="text-slate-900 font-semibold">
                        {pack.included_feature_title || t("packs.list.standardCapability")}
                      </div>
                      {pack.included_feature_subtitle && (
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {pack.included_feature_subtitle}
                        </div>
                      )}
                    </td>

                    {/* PRICE */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{formatPrice(pack)}</div>
                    </td>

                    {/* ASSIGNED ORGS */}
                    <td className="py-4 px-4">
                      <div
                        className={`font-semibold ${
                          pack.assigned_count > 0 ? "text-[#15803D] font-bold" : "text-slate-600"
                        }`}
                      >
                        {t("packs.list.orgsCount", { count: pack.assigned_count })}
                      </div>
                    </td>

                    {/* ACTIONS */}
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                        {pack.status === "Published" ? (
                          <>
                            {canEdit && (
                              <Link
                                to={`/commercials/packs/${pack.id}/edit`}
                                className="font-medium text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                              >
                                {t("packs.list.editPack")}
                              </Link>
                            )}
                            {canRetire && (
                              <button
                                type="button"
                                onClick={() => handleOpenRetireModal(pack)}
                                className="text-slate-500 hover:text-rose-600 font-medium hover:underline cursor-pointer"
                              >
                                {t("common.retire")}
                              </button>
                            )}
                          </>
                        ) : pack.status === "Draft" ? (
                          <>
                            {canEdit && (
                              <Link
                                to={`/commercials/packs/${pack.id}/edit`}
                                className="font-bold text-[#15803D] hover:underline cursor-pointer"
                              >
                                {t("packs.list.editDraft")}
                              </Link>
                            )}
                            {canPublish && (
                              <button
                                type="button"
                                onClick={() => handlePublish(pack.id, pack.name)}
                                className="text-slate-700 hover:text-slate-900 font-medium hover:underline cursor-pointer"
                              >
                                {t("common.publish")}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {canEdit && (
                              <Link
                                to={`/commercials/packs/${pack.id}/edit`}
                                className="font-medium text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                              >
                                {t("common.edit")}
                              </Link>
                            )}
                          </>
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

      {/* Retire Feature Pack Confirmation Modal */}
      {packToRetire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t("packs.dialog.retireTitle")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("packs.dialog.retireSubtitle")}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("packs.dialog.packName")}</span>
                <span className="font-bold text-slate-900 text-right">{packToRetire.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("packs.dialog.packCode")}</span>
                <span className="font-mono text-slate-800 text-right">
                  {packToRetire.pack_code}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("packs.dialog.currentPrice")}</span>
                <span className="font-semibold text-slate-800 text-right">
                  {formatPrice(packToRetire)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("packs.dialog.assignedOrgs")}</span>
                <span className="font-semibold text-slate-800 text-right">
                  {t("packs.list.orgsCount", { count: packToRetire.assigned_count })}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <Trans
                i18nKey="packs.dialog.retireConfirm"
                values={{ name: packToRetire.name }}
                components={{ strong: <strong className="text-slate-900 font-semibold" /> }}
              />
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPackToRetire(null)}
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
                  {isRetiring ? t("packs.dialog.retiring") : t("packs.dialog.confirmRetire")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
