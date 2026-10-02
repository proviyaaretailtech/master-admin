import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trash2,
  X,
  Building2,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { organizationApi } from "../api/organization.api";
import { locationApi } from "../api/location.api";
import {
  LocationItem as ApiLocationItem,
  CreateLocationPayload,
  UpdateLocationPayload,
} from "../@types";
import { formatLastSync } from "../lib/date-utils";
import { generateLocationCode } from "../lib/location-utils";
import { usePermissions } from "../hooks/use-permissions";
import { useFormat } from "../i18n/useFormat";
import { statusLabel, locationTypeLabel } from "../i18n/labels";
import { localizeError } from "../i18n/errors";

export interface PartnerDetails {
  id: string;
  business_name: string;
  domain: string;
  status: string;
  email: string;
  phone_number: string;
  created_at?: string;
}

export const DEFAULT_PARTNER: PartnerDetails = {
  id: "PRT-2048",
  business_name: "Proviyaa Global",
  domain: "Store",
  status: "Draft",
  email: "shreyjagga.pg@gmail.com",
  phone_number: "8668320699",
};

interface LocationItem {
  id: string;
  org_id?: string;
  name: string;
  area: string;
  code: string;
  type: string;
  status: "Active" | "Pending" | "Inactive" | "Draft";
  timeZone: string;
  currency: string;
  lastSync: string;
  last_sync?: string;
}

// Display labels are looked up by key at render time; the raw values below are what the API
// receives (and what colours/comparisons use), so they never change with the language.
const ONBOARDING_STEP_KEYS = [
  "becomePartner",
  "verify",
  "businessInfo",
  "shopDetails",
  "documents",
  "bank",
  "operations",
  "agreement",
  "reviewSubmit",
] as const;

const DOCUMENT_KEYS = [
  "panCard",
  "aadhaarCard",
  "gstCertificate",
  "shopLicense",
  "cancelledCheque",
] as const;

const LOCATION_TYPE_OPTIONS = [
  "Restaurant",
  "Cloud Kitchen",
  "Delivery Hub",
  "Warehouse",
  "Retail Outlet",
] as const;

const LOCATION_STATUS_OPTIONS = ["Active", "Pending", "Inactive", "Draft"] as const;

const TIME_ZONE_OPTIONS = ["Asia/Kolkata", "UTC", "Asia/Dubai", "America/New_York"] as const;

const CURRENCY_OPTIONS = ["INR (₹)", "USD ($)", "EUR (€)", "AED (د.إ)"] as const;

const nowMs = Date.now();
const INITIAL_LOCATIONS: LocationItem[] = [
  {
    id: "loc-1",
    name: "Main Restaurant",
    area: "Indiranagar, Bengaluru",
    code: "LOC - PG 001",
    type: "Restaurant",
    status: "Active",
    timeZone: "Asia/Kolkata",
    currency: "INR (₹)",
    lastSync: new Date(nowMs - 12 * 60 * 1000).toISOString(),
  },
  {
    id: "loc-2",
    name: "Cloud Kitchen North",
    area: "Hebbal, Bengaluru",
    code: "LOC - PG 002",
    type: "Cloud Kitchen",
    status: "Active",
    timeZone: "Asia/Kolkata",
    currency: "INR (₹)",
    lastSync: new Date(nowMs - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: "loc-3",
    name: "Delivery Hub East",
    area: "Whitefield, Bengaluru",
    code: "LOC - PG 003",
    type: "Delivery Hub",
    status: "Pending",
    timeZone: "Asia/Kolkata",
    currency: "INR (₹)",
    lastSync: new Date(nowMs - 26 * 3600 * 1000).toISOString(),
  },
  {
    id: "loc-4",
    name: "Central Warehouse",
    area: "Hosur Road, Bengaluru",
    code: "LOC - PG 004",
    type: "Warehouse",
    status: "Inactive",
    timeZone: "Asia/Kolkata",
    currency: "INR (₹)",
    lastSync: new Date(nowMs - 4 * 86400 * 1000).toISOString(),
  },
  {
    id: "loc-5",
    name: "New Outlet South",
    area: "JP Nagar, Bengaluru",
    code: "LOC - PG 005",
    type: "Restaurant",
    status: "Draft",
    timeZone: "Asia/Kolkata",
    currency: "INR (₹)",
    lastSync: new Date(nowMs - 11 * 86400 * 1000).toISOString(),
  },
];

export const PartnerDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { can, canAccess } = usePermissions();
  const { org_id, id } = useParams<{ org_id?: string; id?: string }>();
  const activeOrgId = org_id || id || "";

  // Granular Permission Checks
  const canApprovePartner = can("feat_partner_review", "approve_partner");
  const canRejectPartner = can("feat_partner_review", "reject_partner");
  const canMarkUnderReview = can("feat_partner_review", "mark_under_review");
  const canDeletePartner = can("feat_partner_review", "delete_partner");
  const hasAnyReviewAction =
    canAccess("feat_partner_review") &&
    (canApprovePartner || canRejectPartner || canMarkUnderReview || canDeletePartner);

  const canViewLocations =
    canAccess("feat_partner_locations") && can("feat_partner_locations", "view_locations");
  const canCreateLocation = can("feat_partner_locations", "create_location");
  const canEditLocation = can("feat_partner_locations", "edit_location");
  const canDeleteLocation = can("feat_partner_locations", "delete_location");
  const canManageLocation = canEditLocation || canDeleteLocation;

  const canViewDocs = canAccess("feat_partner_docs") && can("feat_partner_docs", "view_docs");

  // Partner state
  const [partner, setPartner] = useState<PartnerDetails>(DEFAULT_PARTNER);
  const [isLoadingPartner, setIsLoadingPartner] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);
  const [isDeletingPartner, setIsDeletingPartner] = useState(false);

  // Locations state
  const [locations, setLocations] = useState<LocationItem[]>(INITIAL_LOCATIONS);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");

  const filteredLocations = locations.filter((loc) => {
    const q = locationSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const sync = formatLastSync(loc.last_sync || loc.lastSync);
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.area.toLowerCase().includes(q) ||
      loc.code.toLowerCase().includes(q) ||
      loc.type.toLowerCase().includes(q) ||
      locationTypeLabel(t, loc.type).toLowerCase().includes(q) ||
      loc.status.toLowerCase().includes(q) ||
      statusLabel(t, loc.status).toLowerCase().includes(q) ||
      sync.main.toLowerCase().includes(q) ||
      sync.combined.toLowerCase().includes(q)
    );
  });

  // Fetch live partner data and locations from backend API
  const fetchPartnerData = useCallback(async () => {
    if (!activeOrgId) return;

    // 1. Fetch organization details if valid DB identifier
    if (!activeOrgId.startsWith("PRT-") && !activeOrgId.startsWith("loc-")) {
      try {
        setIsLoadingPartner(true);
        const orgRes = await organizationApi.getById(activeOrgId);
        if (orgRes && orgRes.organization) {
          setPartner({
            id: orgRes.organization.id,
            business_name: orgRes.organization.business_name,
            domain: orgRes.organization.domain || "Store",
            status: orgRes.organization.status || "Draft",
            email: orgRes.organization.email,
            phone_number: orgRes.organization.phone_number,
            created_at: orgRes.organization.created_at,
          });
        }
      } catch (err: unknown) {
        console.warn("Could not fetch organization by ID, keeping fallback:", err);
      } finally {
        setIsLoadingPartner(false);
      }
    }

    // 2. Fetch locations under this organization
    try {
      setIsLoadingLocations(true);
      const locRes = await locationApi.getByOrganization(activeOrgId);
      if (locRes && Array.isArray(locRes.locations)) {
        if (locRes.locations.length > 0) {
          const mappedLocations: LocationItem[] = locRes.locations.map(
            (loc: ApiLocationItem, idx: number) => ({
              id: loc.id,
              org_id: loc.org_id,
              name: loc.name,
              area: loc.area || "Bengaluru",
              code: loc.code || generateLocationCode(partner.business_name || "Location", idx + 1),
              type: loc.type,
              status: (loc.status as "Active" | "Pending" | "Inactive" | "Draft") || "Active",
              timeZone: loc.time_zone || loc.timeZone || "Asia/Kolkata",
              currency: loc.currency || "INR (₹)",
              lastSync: loc.last_sync || loc.lastSync || "Just now",
            })
          );
          setLocations(mappedLocations);
        } else {
          setLocations([]);
        }
      }
    } catch (err: unknown) {
      console.warn("Could not fetch locations from API, keeping fallback:", err);
    } finally {
      setIsLoadingLocations(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    if (activeOrgId) {
      fetchPartnerData();
    }
  }, [activeOrgId, fetchPartnerData]);

  // Location delete modal state
  const [locationToDelete, setLocationToDelete] = useState<LocationItem | null>(null);

  const confirmDeleteLocation = async () => {
    if (!locationToDelete) return;
    if (!canDeleteLocation) {
      showNotification(t("locations.toast.noPermissionDelete"), "error");
      return;
    }
    setIsDeletingLocation(true);
    try {
      if (activeOrgId && !activeOrgId.startsWith("PRT-")) {
        await locationApi.delete(activeOrgId, locationToDelete.id);
      }
      setLocations((prev) => prev.filter((loc) => loc.id !== locationToDelete.id));
      showNotification(t("locations.toast.deleted", { name: locationToDelete.name }), "success");
      setLocationToDelete(null);
    } catch (err: unknown) {
      showNotification(localizeError(err, "locations.toast.deleteFailed"), "error");
    } finally {
      setIsDeletingLocation(false);
    }
  };

  // Modals state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Notification Toast state
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    show: false,
    message: "",
    type: "info",
  });

  const showNotification = (message: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  // Location Form state
  const [locationForm, setLocationForm] = useState({
    name: "",
    area: "",
    code: "",
    type: "Restaurant",
    status: "Active" as "Active" | "Pending" | "Inactive" | "Draft",
    timeZone: "Asia/Kolkata",
    currency: "INR (₹)",
  });

  // Open Location Modal for Add
  const handleOpenAddLocation = () => {
    if (!canCreateLocation) {
      showNotification(t("locations.toast.noPermissionAdd"), "error");
      return;
    }
    setEditingLocation(null);
    const nextCode = generateLocationCode(partner.business_name, locations.length + 1);
    setLocationForm({
      name: "",
      area: "",
      code: nextCode,
      type: "Restaurant",
      status: "Active",
      timeZone: "Asia/Kolkata",
      currency: "INR (₹)",
    });
    setIsLocationModalOpen(true);
  };

  // Open Location Modal for Edit
  const handleOpenEditLocation = (loc: LocationItem) => {
    if (!canEditLocation) {
      showNotification(t("locations.toast.noPermissionEdit"), "error");
      return;
    }
    setEditingLocation(loc);
    setLocationForm({
      name: loc.name,
      area: loc.area,
      code: loc.code,
      type: loc.type,
      status: loc.status,
      timeZone: loc.timeZone,
      currency: loc.currency,
    });
    setIsLocationModalOpen(true);
  };

  // Save Location (Add or Update)
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLocation && !canEditLocation) {
      showNotification(t("locations.toast.noPermissionEdit"), "error");
      return;
    }
    if (!editingLocation && !canCreateLocation) {
      showNotification(t("locations.toast.noPermissionAdd"), "error");
      return;
    }
    if (!locationForm.name.trim()) {
      showNotification(t("locations.toast.nameRequired"), "error");
      return;
    }

    setIsSavingLocation(true);
    try {
      if (editingLocation) {
        if (activeOrgId && !activeOrgId.startsWith("PRT-")) {
          const updatePayload: UpdateLocationPayload = {
            name: locationForm.name.trim(),
            area: locationForm.area.trim() || undefined,
            code: locationForm.code.trim().toUpperCase() || undefined,
            type: locationForm.type,
            status: locationForm.status,
            time_zone: locationForm.timeZone,
            currency: locationForm.currency,
          };
          const res = await locationApi.update(activeOrgId, editingLocation.id, updatePayload);
          const updated = res.location;
          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === editingLocation.id
                ? {
                    ...loc,
                    name: updated.name,
                    area: updated.area || locationForm.area.trim() || "Bengaluru",
                    code: updated.code || locationForm.code.trim().toUpperCase(),
                    type: updated.type,
                    status:
                      (updated.status as "Active" | "Pending" | "Inactive" | "Draft") ||
                      locationForm.status,
                    timeZone: updated.time_zone || locationForm.timeZone,
                    currency: updated.currency || locationForm.currency,
                    lastSync: "Just now",
                  }
                : loc
            )
          );
        } else {
          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === editingLocation.id
                ? {
                    ...loc,
                    name: locationForm.name.trim(),
                    area: locationForm.area.trim() || "Bengaluru",
                    code: locationForm.code.trim().toUpperCase(),
                    type: locationForm.type,
                    status: locationForm.status,
                    timeZone: locationForm.timeZone,
                    currency: locationForm.currency,
                    lastSync: "Just now",
                  }
                : loc
            )
          );
        }
        showNotification(t("locations.toast.updated"), "success");
      } else {
        if (activeOrgId && !activeOrgId.startsWith("PRT-")) {
          const createPayload: CreateLocationPayload = {
            name: locationForm.name.trim(),
            area: locationForm.area.trim() || "Bengaluru",
            code: locationForm.code.trim().toUpperCase() || undefined,
            type: locationForm.type,
            status: locationForm.status,
            time_zone: locationForm.timeZone,
            currency: locationForm.currency,
          };
          const res = await locationApi.create(activeOrgId, createPayload);
          const created = res.location;
          const newLoc: LocationItem = {
            id: created.id,
            org_id: created.org_id || activeOrgId,
            name: created.name,
            area: created.area || locationForm.area.trim() || "Bengaluru",
            code: created.code || locationForm.code.trim().toUpperCase() || "ANN-NEW",
            type: created.type,
            status:
              (created.status as "Active" | "Pending" | "Inactive" | "Draft") ||
              locationForm.status,
            timeZone: created.time_zone || locationForm.timeZone,
            currency: created.currency || locationForm.currency,
            lastSync: "Just now",
          };
          setLocations((prev) => [newLoc, ...prev]);
        } else {
          const newLoc: LocationItem = {
            id: `loc-${Date.now()}`,
            name: locationForm.name.trim(),
            area: locationForm.area.trim() || "Bengaluru",
            code: locationForm.code.trim().toUpperCase() || "ANN-NEW",
            type: locationForm.type,
            status: locationForm.status,
            timeZone: locationForm.timeZone,
            currency: locationForm.currency,
            lastSync: "Just now",
          };
          setLocations((prev) => [newLoc, ...prev]);
        }
        showNotification(t("locations.toast.added"), "success");
      }
      setIsLocationModalOpen(false);
    } catch (err: unknown) {
      showNotification(localizeError(err, "locations.toast.saveFailed"), "error");
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Handle Lifecycle Actions - Delete Partner
  const handleDeletePartner = async () => {
    if (!canDeletePartner) {
      showNotification(t("orgs.detail.toast.noPermissionDelete"), "error");
      return;
    }
    setIsDeletingPartner(true);
    try {
      if (activeOrgId && !activeOrgId.startsWith("PRT-")) {
        await organizationApi.delete(activeOrgId);
      }
      setIsDeleteModalOpen(false);
      showNotification(t("orgs.detail.toast.deleted", { name: partner.business_name }), "error");
      setTimeout(() => {
        navigate("/organizations/360");
      }, 1500);
    } catch (err: unknown) {
      showNotification(localizeError(err, "orgs.detail.toast.deleteFailed"), "error");
    } finally {
      setIsDeletingPartner(false);
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
      case "Approved":
        return "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]";
      case "Pending":
      case "Draft":
        return "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]";
      case "Inactive":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "Rejected":
        return "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="w-full space-y-6 pb-14">
      {/* Toast Notification */}
      {notification.show && (
        <div className="fixed top-20 right-6 z-50 max-w-[min(28rem,calc(100vw-2rem))] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all animate-in fade-in slide-in-from-top-3 duration-200 bg-white">
          {notification.type === "success" && (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
          {notification.type === "error" && <XCircle className="w-5 h-5 text-rose-500 shrink-0" />}
          {notification.type === "info" && (
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
          )}
          <span className="text-slate-800">{notification.message}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* TOP BREADCRUMB & BACK ACTION                                    */}
      {/* ============================================================== */}
      <div className="flex items-center justify-between">
        <Link
          to="/organizations/360"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {t("orgs.detail.backToOrg360")}
        </Link>
        {activeOrgId && (
          <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {t("orgs.detail.orgIdBadge", { id: activeOrgId })}
          </span>
        )}
      </div>

      {/* ============================================================== */}
      {/* 1. PAGE HEADER                                                 */}
      {/* ============================================================== */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {t("orgs.detail.title")}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t("orgs.detail.subtitle", { name: partner.business_name })}
        </p>
      </div>

      {/* ============================================================== */}
      {/* 2. TOP ROW (Partner Summary & Onboarding Progress)             */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Partner Summary */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {t("orgs.detail.summary.title")}
                  </h2>
                  {isLoadingPartner && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{partner.business_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {partner.domain || "Store"}
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                    partner.status
                  )}`}
                >
                  {statusLabel(t, partner.status)}
                </span>
              </div>
            </div>

            {/* 3 Metric Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
              {/* Partner ID */}
              <div className="bg-[#F8FAFC] border border-slate-200/70 rounded-xl p-3.5">
                <div className="text-xs text-slate-400 font-medium">
                  {t("orgs.detail.summary.partnerId")}
                </div>
                <div
                  className="text-sm font-bold text-slate-900 mt-1.5 tracking-tight truncate font-mono"
                  title={partner.id}
                >
                  {partner.id}
                </div>
              </div>

              {/* Primary Store */}
              <div className="bg-[#F8FAFC] border border-slate-200/70 rounded-xl p-3.5">
                <div className="text-xs text-slate-400 font-medium">
                  {t("orgs.detail.summary.primaryStore")}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1.5 tracking-tight truncate">
                  {locations.length > 0 ? locations[0].name : "Main Restaurant"}
                </div>
              </div>

              {/* Onboarding */}
              <div className="bg-[#F8FAFC] border border-slate-200/70 rounded-xl p-3.5">
                <div className="text-xs text-slate-400 font-medium">
                  {t("orgs.detail.summary.onboarding")}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1.5 tracking-tight">
                  {t("orgs.detail.summary.percentComplete", { percent: f.number(0) })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Onboarding Progress */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {t("orgs.detail.onboarding.title")}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {t("orgs.detail.onboarding.summary", {
                count: ONBOARDING_STEP_KEYS.length,
                num: f.number(ONBOARDING_STEP_KEYS.length),
                percent: f.number(0),
              })}
            </p>
          </div>

          <div className="space-y-2 mt-4">
            {ONBOARDING_STEP_KEYS.map((step) => (
              <div key={step} className="flex items-center justify-between gap-3 text-xs py-0.5">
                <span className="font-semibold text-slate-800">
                  {t(`orgs.detail.onboarding.steps.${step}`)}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  {statusLabel(t, "Pending")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. MIDDLE ROW (Contact & Basic + Documents)                    */}
      {/* ============================================================== */}
      <div className={`grid grid-cols-1 ${canViewDocs ? "lg:grid-cols-2" : ""} gap-6`}>
        {/* Card 3: Contact & Basic */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t("orgs.detail.contact.title")}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {t("orgs.detail.contact.subtitle")}
            </p>
          </div>

          <div className="space-y-3.5 mt-5">
            {/* Email */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-normal">{t("common.email")}</span>
              <span className="font-bold text-slate-900 text-xs sm:text-sm">{partner.email}</span>
            </div>

            {/* Phone */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-normal">{t("orgs.detail.contact.phone")}</span>
              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                {partner.phone_number}
              </span>
            </div>

            {/* City */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-normal">{t("orgs.detail.contact.city")}</span>
              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                {locations[0]?.area
                  ? locations[0].area.includes(",")
                    ? locations[0].area.split(",")[1].trim()
                    : locations[0].area
                  : "Latur"}
              </span>
            </div>

            {/* Mobile verified */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-normal">
                {t("orgs.detail.contact.mobileVerified")}
              </span>
              <span className="bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {t("orgs.detail.contact.verified")}
              </span>
            </div>

            {/* Email verified */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-normal">
                {t("orgs.detail.contact.emailVerified")}
              </span>
              <span className="bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {t("orgs.detail.contact.verified")}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Documents */}
        {canViewDocs && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t("orgs.detail.documents.title")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {t("orgs.detail.documents.subtitle")}
              </p>
            </div>

            <div className="space-y-3 mt-5">
              {DOCUMENT_KEYS.map((doc) => (
                <div key={doc} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                    {t(`orgs.detail.documents.items.${doc}`)}
                  </span>
                  <span className="bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {statusLabel(t, "Pending")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 4. REVIEW ACTIONS CARD                                         */}
      {/* ============================================================== */}
      {hasAnyReviewAction && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t("orgs.detail.review.title")}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {t("orgs.detail.review.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            {/* Approve (Design placeholder - functionality to be enabled once finalized) */}
            {canApprovePartner && (
              <button
                type="button"
                onClick={() => showNotification(t("orgs.detail.review.approveNotReady"), "info")}
                className="bg-[#00875A] hover:bg-[#00744D] text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {t("orgs.detail.review.approve")}
              </button>
            )}

            {/* Reject (Design placeholder - functionality to be enabled once finalized) */}
            {canRejectPartner && (
              <button
                type="button"
                onClick={() => showNotification(t("orgs.detail.review.rejectNotReady"), "info")}
                className="border border-[#F59E0B] text-[#D97706] hover:bg-[#FFFBEB] font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {t("orgs.detail.review.reject")}
              </button>
            )}

            {/* Mark under review (Design placeholder - functionality to be enabled once finalized) */}
            {canMarkUnderReview && (
              <button
                type="button"
                onClick={() =>
                  showNotification(t("orgs.detail.review.markUnderReviewNotReady"), "info")
                }
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {t("orgs.detail.review.markUnderReview")}
              </button>
            )}

            {/* Delete Partner */}
            {canDeletePartner && (
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="border border-[#F43F5E] text-[#E11D48] hover:bg-[#FFF1F2] font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("orgs.detail.review.deletePartner")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. LOCATION MANAGEMENT SECTION                                 */}
      {/* ============================================================== */}
      {canViewLocations && (
        <div className="space-y-4 pt-2">
          {/* Header with Title on Left and "Add New Location" + Search on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {t("locations.list.title")}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {t("locations.list.count", {
                    count: locations.length,
                    num: f.number(locations.length),
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t("locations.list.subtitle")}</p>
            </div>

            {/* Right-aligned Controls: Real-time Search + Prominent Primary "Add New Location" Button */}
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Quick search input */}
              <div className="relative min-w-[210px] w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={locationSearchQuery}
                  onChange={(e) => setLocationSearchQuery(e.target.value)}
                  placeholder={t("locations.list.searchPlaceholder")}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium placeholder:text-slate-400 shadow-2xs"
                />
                {locationSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLocationSearchQuery("")}
                    aria-label={t("locations.list.clearSearch")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Prominent Add New Location Button above table */}
              {canCreateLocation && (
                <button
                  type="button"
                  onClick={handleOpenAddLocation}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm hover:shadow cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  {t("locations.list.addNew")}
                </button>
              )}
            </div>
          </div>

          {/* Location Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-white">
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                      {t("locations.list.columnLocation")}
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                      {t("locations.list.columnCode")}
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                      {t("common.type")}
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                      {t("common.status")}
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                      {t("locations.list.columnTimeZone")}
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                      {t("locations.list.columnCurrency")}
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                      {t("locations.list.columnLastSync")}
                    </th>
                    {canManageLocation && (
                      <th className="px-5 py-3.5 text-xs font-semibold text-slate-600 text-right">
                        {t("locations.list.columnAction")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingLocations ? (
                    <tr>
                      <td
                        colSpan={canManageLocation ? 8 : 7}
                        className="px-5 py-8 text-center text-xs text-slate-400"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                          <span>{t("locations.list.loading")}</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLocations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canManageLocation ? 8 : 7}
                        className="px-5 py-8 text-center text-xs text-slate-400"
                      >
                        {t("locations.list.noMatch", { query: locationSearchQuery })}
                        {locationSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setLocationSearchQuery("")}
                            className="ml-2 text-blue-600 hover:underline font-semibold cursor-pointer"
                          >
                            {t("locations.list.clearSearch")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredLocations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Location Name & Subtitle */}
                        <td className="px-5 py-4">
                          <div className="text-xs font-bold text-slate-900">{loc.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{loc.area}</div>
                        </td>

                        {/* Location Code */}
                        <td className="px-5 py-4 text-xs font-medium text-slate-800">{loc.code}</td>

                        {/* Type */}
                        <td className="px-5 py-4 text-xs font-medium text-slate-700">
                          {locationTypeLabel(t, loc.type)}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                              loc.status
                            )}`}
                          >
                            {statusLabel(t, loc.status)}
                          </span>
                        </td>

                        {/* Time Zone */}
                        <td className="px-5 py-4 text-xs font-medium text-slate-700">
                          {loc.timeZone}
                        </td>

                        {/* Currency */}
                        <td className="px-5 py-4 text-xs font-medium text-slate-700">
                          {loc.currency}
                        </td>

                        {/* Last Sync */}
                        <td className="px-5 py-4">
                          {(() => {
                            const sync = formatLastSync(loc.last_sync || loc.lastSync);
                            return (
                              <div
                                className="flex flex-col text-left"
                                title={t("locations.list.lastSyncedTitle", { time: sync.full })}
                              >
                                <span className="text-xs font-semibold text-slate-800">
                                  {sync.main} ({sync.sub})
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Action */}
                        {canManageLocation && (
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canEditLocation && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditLocation(loc)}
                                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                                >
                                  {t("common.edit")}
                                </button>
                              )}
                              {canDeleteLocation && (
                                <button
                                  type="button"
                                  onClick={() => setLocationToDelete(loc)}
                                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer"
                                >
                                  {t("common.delete")}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Summary & Subtext */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500">
              <span>
                {t("locations.list.footerShowing", {
                  shown: f.number(filteredLocations.length),
                  total: f.number(locations.length),
                })}
              </span>
              <span>{t("locations.list.footerHint")}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL: ADD / EDIT LOCATION                                  */}
      {/* ============================================================== */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingLocation ? t("locations.form.editTitle") : t("locations.form.addTitle")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingLocation
                      ? t("locations.form.editSubtitle", { name: editingLocation.name })
                      : t("locations.form.addSubtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                aria-label={t("common.close")}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("locations.form.name")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("locations.form.namePlaceholder")}
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("locations.form.area")}
                </label>
                <input
                  type="text"
                  placeholder={t("locations.form.areaPlaceholder")}
                  value={locationForm.area}
                  onChange={(e) => setLocationForm({ ...locationForm, area: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {t("locations.form.code")}
                    </label>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {t("locations.form.codeLocked")}
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    placeholder="LOC - XX 001"
                    value={locationForm.code}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-mono font-bold uppercase cursor-not-allowed select-none focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">{t("locations.form.codeHint")}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("locations.form.type")}
                  </label>
                  <select
                    value={locationForm.type}
                    onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-medium cursor-pointer"
                  >
                    {LOCATION_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {locationTypeLabel(t, opt)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("common.status")}
                  </label>
                  <select
                    value={locationForm.status}
                    onChange={(e) =>
                      setLocationForm({
                        ...locationForm,
                        status: e.target.value as "Active" | "Pending" | "Inactive" | "Draft",
                      })
                    }
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-medium cursor-pointer"
                  >
                    {LOCATION_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {statusLabel(t, opt)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("locations.form.timeZone")}
                  </label>
                  <select
                    value={locationForm.timeZone}
                    onChange={(e) => setLocationForm({ ...locationForm, timeZone: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-medium cursor-pointer"
                  >
                    {TIME_ZONE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("locations.form.currency")}
                  </label>
                  <select
                    value={locationForm.currency}
                    onChange={(e) => setLocationForm({ ...locationForm, currency: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-medium cursor-pointer"
                  >
                    {CURRENCY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSavingLocation}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isSavingLocation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingLocation
                    ? t("locations.form.saveChanges")
                    : t("locations.form.createCta")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. MODAL: DELETE PARTNER CONFIRMATION                          */}
      {/* ============================================================== */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Trash icon and Delete Partner title side by side */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t("orgs.detail.delete.title")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("orgs.detail.delete.irreversible")}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-rose-50/60 rounded-xl border border-rose-100 text-xs text-rose-800 font-medium">
              <Trans
                i18nKey="orgs.detail.delete.confirm"
                values={{ name: partner.business_name, id: partner.id }}
                components={{ b: <span className="font-bold" /> }}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeletePartner}
                disabled={isDeletingPartner}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {isDeletingPartner ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {isDeletingPartner
                  ? t("orgs.detail.delete.deleting")
                  : t("orgs.detail.delete.title")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. MODAL: DELETE LOCATION CONFIRMATION                         */}
      {/* ============================================================== */}
      {locationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Trash icon and Delete Location title side by side */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t("locations.delete.title")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("orgs.detail.delete.irreversible")}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-rose-50/60 rounded-xl border border-rose-100 text-xs text-rose-800 font-medium">
              <Trans
                i18nKey="locations.delete.confirm"
                values={{ name: locationToDelete.name, code: locationToDelete.code }}
                components={{ b: <span className="font-bold" /> }}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setLocationToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDeleteLocation}
                disabled={isDeletingLocation}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {isDeletingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {isDeletingLocation ? t("orgs.detail.delete.deleting") : t("locations.delete.cta")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDetailPage;
