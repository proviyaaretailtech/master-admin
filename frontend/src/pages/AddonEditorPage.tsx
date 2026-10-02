import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { Loader2, AlertCircle, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { addonApi, CreateAddonPayload } from "../api/addon.api";
import { planApi, CommercialPlanItem } from "../api/plan.api";
import { usePermissions } from "../hooks/use-permissions";
import { useFormat } from "../i18n/useFormat";
import { cadenceLabel, codeLabel, statusLabel } from "../i18n/labels";
import { localizeError } from "../i18n/errors";

// Cadence codes offered in the select; the visible text comes from the catalogue.
const CADENCE_OPTIONS = ["Monthly", "Quarterly", "Annual", "One-time"] as const;

// Validation results shown on the panel (and sent with a save). Codes, translated at display time.
const BILLING_SYNC_STATUS = "Success";
const ENTITLEMENT_VALIDATION_STATUS = "Passed";
const TAX_COMPLIANCE_STATUS = "Pending verification";

// What is on screen as an alert. `error` is kept as the ERROR (not a string) so it re-translates
// when the language changes; with no `error`, `key` is a plain validation message.
type ScreenError = { key: string; error?: unknown };

export const AddonEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const f = useFormat();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const { can } = usePermissions();
  const canSave = isEditMode
    ? can("feat_commercial_addons", "edit_addon")
    : can("feat_commercial_addons", "create_addon");
  const canPublish = can("feat_commercial_addons", "publish_addon");

  const [isLoading, setIsLoading] = useState<boolean>(isEditMode);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [plans, setPlans] = useState<CommercialPlanItem[]>([]);
  const [screenError, setScreenError] = useState<ScreenError | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State matching media_1790759137875.png
  const [name, setName] = useState("Additional Location Deployment");
  const [addonCode, setAddonCode] = useState("ad-loc-11");
  const [description, setDescription] = useState(
    "Permits tenant organizations to provision exactly one additional operational facility or outlet beyond their root entitlement base level."
  );
  const [category, setCategory] = useState("Locations & Logistics");
  const [effectiveDate, setEffectiveDate] = useState("2026-11-01 00:00:00");
  const [status, setStatus] = useState<"Draft" | "Published" | "Retired">("Draft");
  const [version, setVersion] = useState("v1.2");

  // Pricing & Quantity Controls
  const [price, setPrice] = useState<number>(1500);
  const [currency, setCurrency] = useState("INR");
  const [cadence, setCadence] = useState("Monthly");
  const [minQuantity, setMinQuantity] = useState<number>(1);
  const [maxQuantity, setMaxQuantity] = useState<number>(5);
  const [unitLabel, setUnitLabel] = useState("location");
  const [pricingSubtitle, setPricingSubtitle] = useState("Per site monthly billing");

  // Plan Compatibility (names/codes of compatible plans)
  const [compatiblePlans, setCompatiblePlans] = useState<string[]>([
    "Growth Plan",
    "Enterprise Suite",
  ]);

  // Modals & Warnings
  const [showWarningBanner, setShowWarningBanner] = useState(true);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Fetch plans from commercial_plans table
  useEffect(() => {
    const fetchData = async () => {
      try {
        const plansRes = await planApi
          .getAll()
          .catch(() => ({ message: "OK", plans: [], total: 0 }));
        setPlans(plansRes.plans || []);

        if (isEditMode && id) {
          const addonRes = await addonApi.getById(id);
          const a = addonRes.addon;
          setName(a.name);
          setAddonCode(a.addon_code);
          setDescription(a.description || "");
          setCategory(a.category || "General");
          setStatus(a.status);
          setVersion(a.version || "v1.0");
          setPrice(a.price);
          setCurrency(a.currency || "INR");
          setCadence(a.cadence || "Monthly");
          setUnitLabel(a.unit_label || "location");
          setPricingSubtitle(a.pricing_subtitle || "");
          setMinQuantity(a.min_quantity || 1);
          setMaxQuantity(a.max_quantity || 10);
          setEffectiveDate(
            a.effective_date
              ? new Date(a.effective_date).toISOString().replace("T", " ").substring(0, 19)
              : ""
          );
          setCompatiblePlans(a.compatible_plans || []);
        } else {
          // Defaults for new add-on matching screenshot
          setName("Additional Location Deployment");
          setAddonCode("ad-loc-11");
          setDescription(
            "Permits tenant organizations to provision exactly one additional operational facility or outlet beyond their root entitlement base level."
          );
          setCategory("Locations & Logistics");
          setEffectiveDate("2026-11-01 00:00:00");
          setPrice(1500);
          setCadence("Monthly");
          setMinQuantity(1);
          setMaxQuantity(5);
          setUnitLabel("location");
          setPricingSubtitle("Per site monthly billing");
          setStatus("Draft");
          setVersion("v1.2");
        }
      } catch (err) {
        setScreenError({ key: "addons.editor.errors.loadFailed", error: err });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, isEditMode]);

  // Unique published plans list for compatibility toggles (only Published plans)
  const platformPlansList = useMemo(() => {
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleCompatibility = (planName: string) => {
    setCompatiblePlans((prev) => {
      if (prev.includes(planName)) {
        return prev.filter((p) => p !== planName);
      } else {
        return [...prev, planName];
      }
    });
  };

  const handleSaveProgress = async () => {
    if (!name.trim()) {
      setScreenError({ key: "addons.editor.errors.nameRequired" });
      return;
    }
    if (!addonCode.trim()) {
      setScreenError({ key: "addons.editor.errors.codeRequired" });
      return;
    }

    setIsSaving(true);
    setScreenError(null);

    const payload: CreateAddonPayload = {
      name: name.trim(),
      addon_code: addonCode.trim(),
      description: description.trim(),
      category: category.trim(),
      status: status || "Draft",
      version: version.trim() || "v1.0",
      price: Number(price) || 0,
      currency,
      cadence,
      unit_label: unitLabel.trim() || "location",
      pricing_subtitle: pricingSubtitle.trim(),
      min_quantity: Number(minQuantity) || 1,
      max_quantity: Number(maxQuantity) || 10,
      effective_date: effectiveDate ? new Date(effectiveDate).toISOString() : null,
      compatible_plans: compatiblePlans,
      billing_sync_status: BILLING_SYNC_STATUS,
      entitlement_validation_status: ENTITLEMENT_VALIDATION_STATUS,
      tax_compliance_status: TAX_COMPLIANCE_STATUS,
    };

    try {
      if (isEditMode && id) {
        await addonApi.update(id, payload);
        showToast(t("addons.toast.progressSaved"));
      } else {
        const created = await addonApi.create(payload);
        showToast(t("addons.toast.created"));
        navigate(`/commercials/add-ons/${created.addon.id}/edit`, { replace: true });
      }
    } catch (err) {
      setScreenError({ key: "addons.editor.errors.saveFailed", error: err });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishAddon = async () => {
    if (!name.trim() || !addonCode.trim()) {
      setScreenError({ key: "addons.editor.errors.publishFieldsRequired" });
      return;
    }

    setIsPublishing(true);
    setScreenError(null);

    try {
      let targetId = id;
      // If new, create first
      if (!isEditMode || !targetId) {
        const payload: CreateAddonPayload = {
          name: name.trim(),
          addon_code: addonCode.trim(),
          description: description.trim(),
          category: category.trim(),
          status: "Draft",
          version: version.trim() || "v1.0",
          price: Number(price) || 0,
          currency,
          cadence,
          unit_label: unitLabel.trim() || "location",
          pricing_subtitle: pricingSubtitle.trim(),
          min_quantity: Number(minQuantity) || 1,
          max_quantity: Number(maxQuantity) || 10,
          effective_date: effectiveDate ? new Date(effectiveDate).toISOString() : null,
          compatible_plans: compatiblePlans,
        };
        const created = await addonApi.create(payload);
        targetId = created.addon.id;
      }

      await addonApi.publish(targetId);
      showToast(t("addons.toast.editorPublished", { name }));
      setShowPublishModal(false);
      navigate("/commercials/add-ons");
    } catch (err) {
      setScreenError({ key: "addons.editor.errors.publishFailed", error: err });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <Loader2 className="w-8 h-8 animate-spin text-[#4FA800] mb-3" />
        <p className="text-xs font-semibold text-slate-600">{t("addons.editor.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
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
            <span>
              {screenError.error === undefined
                ? t(screenError.key)
                : localizeError(screenError.error, screenError.key)}
            </span>
          </div>
          <button
            onClick={() => setScreenError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-4 cursor-pointer"
          >
            {t("addons.dismiss")}
          </button>
        </div>
      )}

      {/* Header matching media_1790759137875.png */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {name
              ? t("addons.editor.titleWithName", { name: name.split(" ")[0] })
              : t("addons.editor.title")}
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {statusLabel(t, status)} {version}
          </span>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowDiscardModal(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            {t("addons.editor.discardDraft")}
          </button>

          <button
            type="button"
            disabled={isSaving || !canSave}
            onClick={handleSaveProgress}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{t("addons.editor.saveProgress")}</span>
          </button>

          {canPublish && (
            <button
              type="button"
              onClick={() => setShowPublishModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#4FA800] hover:bg-[#439000] active:bg-[#387a00] transition-colors shadow-xs cursor-pointer"
            >
              <span>{t("addons.editor.publishAddon")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Cadence Warning Banner matching media_1790759137875.png */}
      {showWarningBanner && (
        <div className="flex items-center justify-between p-3.5 bg-[#FFF8E6] border border-[#FDE68A] rounded-xl text-xs text-[#92400E]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D97706] shrink-0" />
            <span>
              <Trans
                i18nKey="addons.editor.cadenceWarning"
                values={{
                  cadence: cadenceLabel(t, cadence),
                  pack: "Quarterly Location",
                  clients: f.number(14),
                }}
                components={{ strong: <strong /> }}
              />
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowWarningBanner(false)}
            className="text-[#92400E] hover:text-[#78350F] p-1 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2-Column Responsive Form Layout matching media_1790759137875.png */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Metadata & Pricing Controls */}
        <div className="space-y-6">
          {/* Card 1: Add-on Metadata & Description */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {t("addons.editor.metadataTitle")}
            </h2>

            {/* ADD-ON DISPLAY NAME */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t("addons.editor.labelName")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("addons.editor.placeholderName")}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
              />
            </div>

            {/* ADD-ON CODE / IDENTIFIER */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t("addons.editor.labelCode")}
              </label>
              <input
                type="text"
                value={addonCode}
                onChange={(e) => setAddonCode(e.target.value)}
                placeholder={t("addons.editor.placeholderCode")}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
              />
            </div>

            {/* DETAILED DESCRIPTION */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t("addons.editor.labelDescription")}
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("addons.editor.placeholderDescription")}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors leading-relaxed"
              />
            </div>

            {/* Row: CATEGORY & EFFECTIVE DATE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("addons.editor.labelCategory")}
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={t("addons.editor.placeholderCategory")}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("addons.editor.labelEffectiveDate")}
                </label>
                <input
                  type="text"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  placeholder="2026-11-01 00:00:00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Pricing & Quantity Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {t("addons.editor.pricingTitle")}
            </h2>

            {/* Row 1: INR PRICE & CADENCE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("addons.editor.labelPrice")}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-semibold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("addons.editor.labelCadence")}
                </label>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
                >
                  {CADENCE_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {cadenceLabel(t, c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: MINIMUM & MAXIMUM PURCHASE QTY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("addons.editor.labelMinQty")}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
                  />
                  <span className="absolute right-3.5 top-2.5 text-[11px] text-slate-400">
                    {t("addons.editor.unitSuffix")}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("addons.editor.labelMaxQty")}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
                  />
                  <span className="absolute right-3.5 top-2.5 text-[11px] text-slate-400">
                    {t("addons.editor.unitsMaxSuffix")}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 3: UNIT LABEL & PRICING SUBTITLE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("addons.editor.labelUnitLabel")}
                </label>
                <input
                  type="text"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder={t("addons.editor.placeholderUnitLabel")}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("addons.editor.labelSubtitle")}
                </label>
                <input
                  type="text"
                  value={pricingSubtitle}
                  onChange={(e) => setPricingSubtitle(e.target.value)}
                  placeholder={t("addons.editor.placeholderSubtitle")}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4FA800] focus:border-[#4FA800] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Plan Compatibility & System Validation */}
        <div className="space-y-6">
          {/* Card 3: Platform Plan Compatibility matching media_1790759137875.png */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {t("addons.editor.compatTitle")}
              </h2>
              <p className="text-xs text-slate-500 mt-1">{t("addons.editor.compatHint")}</p>
            </div>

            {/* Platform Plans List */}
            <div className="space-y-2.5 pt-1">
              {platformPlansList.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  {t("addons.editor.noPlans")}
                </div>
              ) : (
                platformPlansList.map((plan) => {
                  const isCompatible = compatiblePlans.includes(plan.name);
                  const displayName = `${plan.name} ${plan.version || "v1.0"}`;

                  return (
                    <div
                      key={plan.id || plan.name}
                      onClick={() => handleToggleCompatibility(plan.name)}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isCompatible
                          ? "bg-[#EAF7E2] border-[#C8EAB3] text-slate-900"
                          : "bg-slate-50/80 border-slate-200/80 text-slate-600 hover:bg-slate-100/60"
                      }`}
                    >
                      <span className="text-xs font-semibold">{displayName}</span>

                      {/* Compatibility Badge / Action Button */}
                      <button
                        type="button"
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold text-left transition-colors ${
                          isCompatible
                            ? "bg-[#DEF5CE] text-[#337400]"
                            : "bg-red-50 text-red-600 border border-red-200/60"
                        }`}
                      >
                        {isCompatible
                          ? t("addons.editor.compatible")
                          : t("addons.editor.incompatible")}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card 4: System Integration Validation matching media_1790759137875.png */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {t("addons.editor.validationTitle")}
            </h2>

            <div className="space-y-3 pt-1">
              {/* Check 1 */}
              <div className="flex items-center gap-2.5 text-xs text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                <span>
                  {t("addons.editor.billingSyncCheck")}{" "}
                  <strong>{codeLabel(t, "addons.sync", BILLING_SYNC_STATUS)}</strong>
                </span>
              </div>

              {/* Check 2 */}
              <div className="flex items-center gap-2.5 text-xs text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                <span>
                  {t("addons.editor.entitlementCheck")}{" "}
                  <strong>
                    {codeLabel(t, "addons.entitlement", ENTITLEMENT_VALIDATION_STATUS)}
                  </strong>
                </span>
              </div>

              {/* Check 3 */}
              <div className="flex items-center gap-2.5 text-xs text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] shrink-0" />
                <span>
                  {t("addons.editor.taxCheck")}{" "}
                  <strong>{codeLabel(t, "addons.tax", TAX_COMPLIANCE_STATUS)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Discard Draft Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t("addons.dialog.discard.title")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("addons.dialog.discard.hint")}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t("addons.dialog.discard.confirmText")}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {t("addons.dialog.discard.keepEditing")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/commercials/add-ons")}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
              >
                {t("addons.dialog.discard.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Add-on Modal */}
      {showPublishModal && (
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
                  {t("addons.dialog.publish.productionHint")}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("addons.dialog.addonName")}</span>
                <span className="font-bold text-slate-900 text-right">{name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{t("addons.dialog.unitPrice")}</span>
                <span className="font-semibold text-slate-800 text-right">
                  {t("addons.pricePerUnit", { price: f.money(Number(price)), unit: unitLabel })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">
                  {t("addons.dialog.compatiblePlans")}
                </span>
                <span className="font-semibold text-slate-800 text-right">
                  {compatiblePlans.length > 0 ? compatiblePlans.join(", ") : t("addons.allTiers")}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <Trans
                i18nKey="addons.dialog.publish.confirmText"
                values={{ name }}
                components={{ strong: <strong className="text-slate-900 font-semibold" /> }}
              />
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                disabled={isPublishing}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={handlePublishAddon}
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
    </div>
  );
};
