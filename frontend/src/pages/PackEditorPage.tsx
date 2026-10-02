import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Check,
  X,
  Search,
} from "lucide-react";
import { packApi, CreatePackPayload } from "../api/pack.api";
import { planApi, CommercialPlanItem } from "../api/plan.api";
import { usePermissions } from "../hooks/use-permissions";
import { localizeError } from "../i18n/errors";

// Errors are kept as a catalogue key or as the ERROR itself (never a finished string), so the
// banner re-translates if the language changes while it is on screen.
type PageError = { kind: "key"; key: string } | { kind: "api"; err: unknown; fallbackKey: string };
// A success toast, kept as a key + values for the same reason.
type PageToast = { key: "packs.toast.created" | "packs.toast.updated"; name: string };

export const PackEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const { can } = usePermissions();
  const canSave = isEditMode
    ? can("feat_commercial_packs", "edit_pack")
    : can("feat_commercial_packs", "create_pack");

  const [isLoading, setIsLoading] = useState<boolean>(isEditMode);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [plans, setPlans] = useState<CommercialPlanItem[]>([]);
  const [error, setError] = useState<PageError | null>(null);
  const [toast, setToast] = useState<PageToast | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [packCode, setPackCode] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [currency, setCurrency] = useState("INR");
  const [cadence, setCadence] = useState("Monthly");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [extendedLimits, setExtendedLimits] = useState("");
  const [prerequisiteNote, setPrerequisiteNote] = useState("");
  const [includedFeatureTitle, setIncludedFeatureTitle] = useState("");
  const [includedFeatureSubtitle, setIncludedFeatureSubtitle] = useState("");
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);

  // Dropdown & Search state for Compatible Plans
  const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
  const [planSearchTerm, setPlanSearchTerm] = useState("");
  const planDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (planDropdownRef.current && !planDropdownRef.current.contains(event.target as Node)) {
        setIsPlanDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Only published plans, deduplicated by name
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

  const filteredPlans = useMemo(() => {
    if (!planSearchTerm.trim()) return publishedPlans;
    const term = planSearchTerm.toLowerCase();
    return publishedPlans.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.plan_code && p.plan_code.toLowerCase().includes(term))
    );
  }, [publishedPlans, planSearchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const plansRes = await planApi
          .getAll()
          .catch(() => ({ message: "OK", plans: [], total: 0 }));
        setPlans(plansRes.plans || []);

        if (isEditMode && id) {
          const packRes = await packApi.getById(id);
          const p = packRes.pack;
          setName(p.name);
          setPackCode(p.pack_code);
          setDescription(p.description || "");
          setPrice(p.price);
          setCurrency(p.currency || "INR");
          setCadence(p.cadence || "Monthly");
          setEffectiveDate(
            p.effective_date
              ? new Date(p.effective_date).toISOString().replace("T", " ").substring(0, 19)
              : ""
          );
          setExtendedLimits(p.extended_limits || "");
          setPrerequisiteNote(p.prerequisite_note || "");
          setIncludedFeatureTitle(p.included_feature_title || "");
          setIncludedFeatureSubtitle(p.included_feature_subtitle || "");
          setSelectedPlans(p.compatible_plans || []);
        } else {
          // Defaults for new pack
          setPrerequisiteNote(
            "Advanced Reporting requires intelligence platform module ready state. This pack extends standard database query boundaries."
          );
          setEffectiveDate("2026-03-01 00:00:00");
          setPrice(1499);
        }
      } catch (err: unknown) {
        setError({ kind: "api", err, fallbackKey: "packs.toast.loadConfigFailed" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, isEditMode]);

  const handleTogglePlan = (planName: string) => {
    setSelectedPlans((prev) =>
      prev.includes(planName) ? prev.filter((p) => p !== planName) : [...prev, planName]
    );
  };

  const handleRemovePlan = (planName: string) => {
    setSelectedPlans((prev) => prev.filter((p) => p !== planName));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError({ kind: "key", key: "packs.editor.validation.nameRequired" });
      return;
    }

    let code = packCode.trim();
    if (!code) {
      code = `pk-${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`;
    }

    setIsSaving(true);
    setError(null);

    const payload: CreatePackPayload = {
      name: name.trim(),
      pack_code: code,
      description: description.trim(),
      price: Number(price) || 0,
      currency,
      cadence,
      effective_date: effectiveDate.trim() ? effectiveDate.trim() : null,
      extended_limits: extendedLimits.trim(),
      prerequisite_note: prerequisiteNote.trim(),
      included_feature_title: includedFeatureTitle.trim(),
      included_feature_subtitle: includedFeatureSubtitle.trim(),
      compatible_plans: selectedPlans,
    };

    try {
      if (isEditMode && id) {
        await packApi.update(id, payload);
        setToast({ key: "packs.toast.updated", name });
      } else {
        await packApi.create(payload);
        setToast({ key: "packs.toast.created", name });
      }
      setTimeout(() => navigate("/commercials/packs"), 800);
    } catch (err: unknown) {
      setError({ kind: "api", err, fallbackKey: "packs.toast.saveFailed" });
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-[#15803D] animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">{t("packs.editor.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-[min(28rem,calc(100vw-2rem))] flex items-center gap-2 bg-emerald-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{t(toast.key, { name: toast.name })}</span>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Link to="/commercials/packs" className="hover:underline text-slate-600">
              {t("packs.shared.breadcrumbMaster")}
            </Link>
            <span>/</span>
            <Link to="/commercials/packs" className="hover:underline text-slate-600">
              {t("packs.shared.breadcrumbCommercials")}
            </Link>
            <span>/</span>
            <Link to="/commercials/packs" className="hover:underline text-slate-600">
              {t("packs.shared.breadcrumbPacks")}
            </Link>
            {isEditMode && (
              <>
                <span>/</span>
                <span className="text-slate-800 font-semibold">
                  {name || t("packs.editor.featurePackFallback")}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEditMode
              ? t("packs.editor.titleEdit", { name: name || t("packs.editor.featureFallback") })
              : t("packs.shared.createPack")}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/commercials/packs")}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("common.back")}</span>
          </button>

          {canSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{t("packs.editor.save")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-xs">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>
            {error.kind === "key" ? t(error.key) : localizeError(error.err, error.fallbackKey)}
          </span>
        </div>
      )}

      {/* Prerequisite Callout Note matching screenshot 1 */}
      {prerequisiteNote && (
        <div className="flex items-start gap-2.5 p-3.5 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-xl text-xs font-medium">
          <span className="text-amber-500 text-base leading-none">•</span>
          <div>
            <span className="font-bold">{t("packs.editor.noteLabel")}</span> {prerequisiteNote}
          </div>
        </div>
      )}

      {/* Pack Configuration Details Card */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5"
      >
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
          {t("packs.editor.configDetails")}
        </h2>

        {/* PACK NAME */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {t("packs.editor.field.packName")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("packs.editor.placeholder.packName")}
            className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
            required
          />
        </div>

        {/* PACK CODE (Identifier) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {t("packs.editor.field.packCode")}
          </label>
          <input
            type="text"
            value={packCode}
            onChange={(e) => setPackCode(e.target.value)}
            placeholder={t("packs.editor.placeholder.packCode")}
            className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
          />
          <p className="text-[11px] text-slate-400 mt-1">{t("packs.editor.hint.packCode")}</p>
        </div>

        {/* COMPATIBLE PLANS (Clean Searchable Dropdown - Published Plans Only) */}
        <div ref={planDropdownRef} className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t("packs.editor.field.compatiblePlans")}
            </label>
            {selectedPlans.length > 0 && (
              <span className="text-[11px] font-semibold text-[#15803D]">
                {t("packs.editor.plansSelected", { count: selectedPlans.length })}
              </span>
            )}
          </div>

          {/* Selected Plans Box / Dropdown Trigger */}
          <div
            onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
            className={`w-full min-h-[46px] p-2 bg-white border rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all ${
              isPlanDropdownOpen
                ? "border-[#15803D] ring-2 ring-[#15803D]/20 shadow-xs"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {selectedPlans.length === 0 ? (
                <span className="text-xs text-slate-400 pl-1.5 select-none">
                  {t("packs.editor.plansPlaceholder")}
                </span>
              ) : (
                selectedPlans.map((planName) => (
                  <span
                    key={planName}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#DEF5CE] text-[#2B7000] border border-[#CDE7B2] animate-in fade-in zoom-in-95 duration-100"
                  >
                    <span>{planName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemovePlan(planName);
                      }}
                      className="text-[#2B7000] hover:text-rose-600 transition-colors p-0.5 rounded cursor-pointer"
                      title={t("packs.editor.removePlan")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 pr-1">
              {selectedPlans.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedPlans([]);
                  }}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  {t("packs.editor.clear")}
                </button>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  isPlanDropdownOpen ? "rotate-180 text-[#15803D]" : ""
                }`}
              />
            </div>
          </div>

          {/* Clean Dropdown Popover */}
          {isPlanDropdownOpen && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in-50 duration-150">
              {/* Dropdown Header: Search Bar ("a little") + Select All Button + Cross (Clear) Button */}
              <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-white">
                {/* Search input ("a little" compact search) */}
                <div className="flex items-center gap-2 flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus-within:border-[#15803D] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#15803D] transition-all">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={planSearchTerm}
                    onChange={(e) => setPlanSearchTerm(e.target.value)}
                    placeholder={t("packs.editor.searchPlans")}
                    className="w-full text-xs text-slate-800 placeholder:text-slate-400 bg-transparent border-none outline-none focus:outline-hidden"
                    autoFocus
                  />
                  {planSearchTerm && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPlanSearchTerm("");
                      }}
                      className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
                      title={t("packs.editor.clearSearch")}
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Select All Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedPlans(publishedPlans.map((p) => p.name));
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#15803D] hover:bg-[#DEF5CE] rounded-lg transition-colors cursor-pointer"
                >
                  {t("packs.editor.selectAll")}
                </button>

                {/* Cross Button within the dropdown to clear all things */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedPlans([]);
                    setPlanSearchTerm("");
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                  title={t("packs.editor.clearAll")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Plans List - ONLY Published Plans, NO Checkboxes, Clicking directly adds to box above */}
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1">
                {filteredPlans.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {publishedPlans.length === 0
                      ? t("packs.editor.noPublishedPlans")
                      : t("packs.editor.noMatchingPlans")}
                  </div>
                ) : (
                  filteredPlans.map((plan) => {
                    const isSelected = selectedPlans.includes(plan.name);
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTogglePlan(plan.name);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#F0FDF4] text-[#166534]"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`truncate ${
                              isSelected ? "font-bold text-[#15803D]" : "font-medium text-slate-800"
                            }`}
                          >
                            {plan.name}
                          </span>
                          {plan.plan_code && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({plan.plan_code})
                            </span>
                          )}
                        </div>

                        <div className="shrink-0 ml-3">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15803D]">
                              <Check className="w-3.5 h-3.5" />
                              <span>{t("packs.editor.added")}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-semibold text-slate-400">
                              {t("packs.editor.addPlan")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400 mt-1.5">
            {t("packs.editor.hint.compatiblePlans")}
          </p>
        </div>

        {/* PRICE & EFFECTIVE DATE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {t("packs.editor.field.priceMonthly")}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full pl-7 pr-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {t("packs.editor.field.effectiveDate")}
            </label>
            <input
              type="text"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              placeholder="YYYY-MM-DD HH:mm:ss"
              className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
            />
          </div>
        </div>

        {/* EXTENDED LIMITS */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {t("packs.editor.field.extendedLimits")}
          </label>
          <input
            type="text"
            value={extendedLimits}
            onChange={(e) => setExtendedLimits(e.target.value)}
            placeholder={t("packs.editor.placeholder.extendedLimits")}
            className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
          />
        </div>

        {/* INCLUDED FEATURES HIGHLIGHTS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {t("packs.editor.field.highlightsTitle")}
            </label>
            <input
              type="text"
              value={includedFeatureTitle}
              onChange={(e) => setIncludedFeatureTitle(e.target.value)}
              placeholder={t("packs.editor.placeholder.highlightsTitle")}
              className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {t("packs.editor.field.highlightsSubtitle")}
            </label>
            <input
              type="text"
              value={includedFeatureSubtitle}
              onChange={(e) => setIncludedFeatureSubtitle(e.target.value)}
              placeholder={t("packs.editor.placeholder.highlightsSubtitle")}
              className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
            />
          </div>
        </div>

        {/* PREREQUISITE ALERT NOTE */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {t("packs.editor.field.prerequisiteNote")}
          </label>
          <input
            type="text"
            value={prerequisiteNote}
            onChange={(e) => setPrerequisiteNote(e.target.value)}
            placeholder={t("packs.editor.placeholder.prerequisiteNote")}
            className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
          />
        </div>
      </form>
    </div>
  );
};
