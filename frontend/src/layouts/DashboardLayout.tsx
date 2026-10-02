import React, { useState, useRef, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/use-auth";
import { usePermissions } from "../hooks/use-permissions";
import {
  Store,
  Search,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  LogOut,
  Building2,
  ShieldCheck,
  Landmark,
  Layers,
  ShoppingCart,
  Package,
  Truck,
  BarChart3,
  Sliders,
  Headphones,
  Code2,
  FileCheck,
  ArrowLeft,
  LayoutDashboard,
  Menu,
  X,
  Settings as SettingsIcon,
  Globe,
} from "lucide-react";
import { getLocaleMeta } from "../i18n/registry";
import { useLanguage } from "../i18n/useLanguage";

export const DashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const { active: activeLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const { can, roleName } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const isAccessControlActive =
    location.pathname === "/users" ||
    location.pathname.startsWith("/access-control") ||
    location.pathname === "/security-policies" ||
    location.pathname === "/policies" ||
    location.pathname === "/roles" ||
    location.pathname === "/roles-permissions" ||
    location.pathname === "/security-templates";

  const isCommercialsActive = location.pathname.startsWith("/commercials");

  // State
  const [isOnlineAccepting, setIsOnlineAccepting] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isOrganizationExpanded, setIsOrganizationExpanded] = useState(
    !isAccessControlActive && !isCommercialsActive
  );
  const [isAccessControlExpanded, setIsAccessControlExpanded] = useState(isAccessControlActive);
  const [isCommercialsExpanded, setIsCommercialsExpanded] = useState<boolean>(
    isCommercialsActive || true
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update expansion when location changes
  useEffect(() => {
    if (isAccessControlActive) {
      setIsAccessControlExpanded(true);
    }
    if (isCommercialsActive) {
      setIsCommercialsExpanded(true);
    }
    if (
      location.pathname.startsWith("/organizations") ||
      location.pathname === "/dashboard" ||
      location.pathname === "/" ||
      location.pathname === "/brands" ||
      location.pathname === "/locations" ||
      location.pathname === "/departments" ||
      location.pathname === "/employees" ||
      location.pathname === "/invitations"
    ) {
      setIsOrganizationExpanded(true);
    }
    setIsMobileSidebarOpen(false);
  }, [location.pathname, isAccessControlActive, isCommercialsActive]);

  const handleSignOut = async () => {
    setIsDropdownOpen(false);
    await logout();
    navigate("/login");
  };

  const displayName = user ? `${user.first_name} ${user.last_name}` : "John Doe";
  const displayEmail = user?.email || "john.doe@proviyaa.com";

  // Navigation Items: Organization (filtered by permissions)
  const organizationSubItems = [
    { name: "organizations", path: "/dashboard", visible: true },
    {
      name: "organization_360",
      path: "/organizations/360",
      visible: can("feat_org_360", "view_directory"),
    },
    { name: "brands", path: "/brands", visible: true },
    {
      name: "locations",
      path: "/locations",
      visible: can("feat_partner_locations", "view_locations"),
    },
    { name: "departments", path: "/departments", visible: true },
    { name: "employees", path: "/employees", visible: true },
    { name: "invitations", path: "/invitations", visible: true },
  ].filter((item) => item.visible);

  // Navigation Items: Access Control (filtered by permissions)
  const accessControlSubItems = [
    { name: "users", path: "/users", visible: can("feat_users_mgmt", "view_users") },
    {
      name: "roles_permissions",
      path: "/access-control/roles",
      visible: can("feat_roles_templates", "view_roles"),
    },
    {
      name: "security_policies",
      path: "/access-control/policies",
      visible: can("feat_roles_templates", "view_roles"),
    },
    {
      name: "audit_logs",
      path: "/access-control/audit-logs",
      visible: can("feat_audit_compliance", "view_audit_logs"),
    },
  ].filter((item) => item.visible);

  // Navigation Items: Commercials (matches screenshots 1 & 2)
  const commercialsSubItems = [
    {
      name: "plans",
      path: "/commercials/plans",
      visible: can("feat_commercial_plans", "view_plans"),
    },
    {
      name: "packs",
      path: "/commercials/packs",
      visible: can("feat_commercial_packs", "view_packs"),
    },
    {
      name: "add_ons",
      path: "/commercials/add-ons",
      visible: can("feat_commercial_addons", "view_addons"),
    },
    { name: "subscriptions", path: "/commercials/subscriptions", visible: true },
    { name: "entitlements", path: "/commercials/entitlements", visible: true },
    { name: "usage", path: "/commercials/usage", visible: true },
    { name: "billing", path: "/commercials/billing", visible: true },
  ].filter((item) => item.visible);

  // Other System Domains
  const systemDomains = [
    { name: "platform_core", icon: Layers, path: "/platform-core" },
    { name: "commerce_engine", icon: ShoppingCart, path: "/commerce-engine" },
    { name: "inventory_supply", icon: Package, path: "/inventory-supply" },
    { name: "fulfilment", icon: Truck, path: "/fulfilment" },
    { name: "intelligence", icon: BarChart3, path: "/intelligence" },
    { name: "operations", icon: Sliders, path: "/operations" },
    { name: "support", icon: Headphones, path: "/support" },
    { name: "developer", icon: Code2, path: "/developer" },
    { name: "audit", icon: FileCheck, path: "/audit" },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] font-sans antialiased text-slate-800">
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-xs"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR (FULL HEIGHT FROM TOP OF VIEWPORT TO BOTTOM)   */}
      {/* ============================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 shrink-0 ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Brand Logo Header (Aligned with right TopBar h-16) */}
        <div className="h-16 shrink-0 flex items-center justify-between px-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#65D000] flex items-center justify-center text-white font-extrabold text-lg shadow-sm shrink-0">
              <span>P</span>
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-slate-900 text-base tracking-tight">Proviyaa</div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                {t("nav.brandSub")}
              </div>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label={t("nav.closeMenu")}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {/* OVERVIEW SECTION */}
          <div>
            <div className="px-2.5 pb-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {t("nav.overview")}
            </div>
            <Link
              to="/dashboard"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                location.pathname === "/overview"
                  ? "bg-[#65D000]/15 text-[#429300]"
                  : "text-slate-600 hover:bg-slate-100/70"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-slate-500" />
              <span>{t("nav.items.dashboard")}</span>
            </Link>
          </div>

          {/* SYSTEM DOMAINS SECTION */}
          <div className="space-y-1">
            <div className="px-2.5 pb-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {t("nav.systemDomains")}
            </div>

            {/* 1. Organization Section (Collapsible Dropdown Menu) */}
            <div>
              <button
                type="button"
                onClick={() => setIsOrganizationExpanded(!isOrganizationExpanded)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  location.pathname === "/dashboard" ||
                  location.pathname === "/" ||
                  location.pathname.startsWith("/organizations") ||
                  location.pathname === "/brands" ||
                  location.pathname === "/locations" ||
                  location.pathname === "/departments" ||
                  location.pathname === "/employees" ||
                  location.pathname === "/invitations"
                    ? "bg-[#EEF9E8] text-[#3E8800]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Building2
                    className={`w-4 h-4 ${
                      location.pathname === "/dashboard" ||
                      location.pathname === "/" ||
                      location.pathname.startsWith("/organizations")
                        ? "text-[#4FA800]"
                        : "text-slate-500"
                    }`}
                  />
                  <span>{t("nav.organization")}</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isOrganizationExpanded ? "rotate-0 text-[#4FA800]" : "-rotate-90 text-slate-400"
                  }`}
                />
              </button>

              {/* Organization Submenu Items */}
              {isOrganizationExpanded && (
                <div className="mt-1 ml-5 pl-2 border-l border-slate-200/80 space-y-0.5">
                  {organizationSubItems.map((sub) => {
                    const isActive =
                      location.pathname === sub.path ||
                      (sub.path === "/dashboard" &&
                        (location.pathname === "/" || location.pathname === "/organizations"));
                    return (
                      <Link
                        key={sub.name}
                        to={sub.path}
                        className={`block px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          isActive
                            ? "bg-[#DEF5CE] text-[#337400] font-bold"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium"
                        }`}
                      >
                        {t(`nav.items.${sub.name}`)}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Access Control Section (Contains Users Page!) */}
            {accessControlSubItems.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setIsAccessControlExpanded(!isAccessControlExpanded)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isAccessControlActive
                      ? "bg-[#EEF9E8] text-[#3E8800]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck
                      className={`w-4 h-4 ${isAccessControlActive ? "text-[#4FA800]" : "text-slate-500"}`}
                    />
                    <span>{t("nav.accessControl")}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isAccessControlExpanded
                        ? "rotate-0 text-[#4FA800]"
                        : "-rotate-90 text-slate-400"
                    }`}
                  />
                </button>

                {/* Access Control Submenu Items (Users moved here!) */}
                {isAccessControlExpanded && (
                  <div className="mt-1 ml-5 pl-2 border-l border-slate-200/80 space-y-0.5">
                    {accessControlSubItems.map((sub) => {
                      const isActive =
                        location.pathname === sub.path ||
                        (sub.path === "/users" &&
                          (location.pathname === "/access-control" ||
                            location.pathname === "/access-control/users")) ||
                        (sub.path === "/access-control/policies" &&
                          (location.pathname === "/policies" ||
                            location.pathname === "/security-policies")) ||
                        (sub.path === "/access-control/roles" &&
                          (location.pathname === "/roles" ||
                            location.pathname === "/roles-permissions" ||
                            location.pathname === "/security-templates"));
                      return (
                        <Link
                          key={sub.name}
                          to={sub.path}
                          className={`block px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            isActive
                              ? "bg-[#DEF5CE] text-[#337400] font-bold"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium"
                          }`}
                        >
                          {t(`nav.items.${sub.name}`)}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. Commercials Section (Plans, Packs, Add-ons, Subscriptions, Entitlements, Usage, Billing) */}
            {commercialsSubItems.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setIsCommercialsExpanded(!isCommercialsExpanded)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isCommercialsActive
                      ? "bg-[#EEF9E8] text-[#3E8800]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Landmark
                      className={`w-4 h-4 ${isCommercialsActive ? "text-[#4FA800]" : "text-slate-500"}`}
                    />
                    <span>{t("nav.commercials")}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isCommercialsExpanded
                        ? "rotate-0 text-[#4FA800]"
                        : "-rotate-90 text-slate-400"
                    }`}
                  />
                </button>

                {/* Commercials Submenu Items */}
                {isCommercialsExpanded && (
                  <div className="mt-1 ml-5 pl-2 border-l border-slate-200/80 space-y-0.5">
                    {commercialsSubItems.map((sub) => {
                      const isActive =
                        location.pathname === sub.path ||
                        (sub.name === "plans" &&
                          (location.pathname === "/commercials" ||
                            location.pathname.startsWith("/commercials/plans"))) ||
                        (sub.name === "packs" &&
                          location.pathname.startsWith("/commercials/packs")) ||
                        (sub.name === "add_ons" &&
                          location.pathname.startsWith("/commercials/add-ons"));
                      return (
                        <Link
                          key={sub.name}
                          to={sub.path}
                          className={`block px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            isActive
                              ? "bg-[#DEF5CE] text-[#337400] font-bold"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium"
                          }`}
                        >
                          {t(`nav.items.${sub.name}`)}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. Other System Domains */}
            {systemDomains.map((domain) => {
              const IconComponent = domain.icon;
              const isActive = location.pathname === domain.path;
              return (
                <Link
                  key={domain.name}
                  to={domain.path}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-[#EEF9E8] text-[#3E8800]"
                      : "text-slate-600 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComponent className="w-4 h-4 text-slate-500" />
                    <span>{t(`nav.items.${domain.name}`)}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Sidebar: Back to Home */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>{t("nav.backToHome")}</span>
          </Link>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. RIGHT COLUMN: TOP BAR + MAIN CONTENT OUTLET                  */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* ============================================================ */}
        {/* TOP BAR (Header sits to the right of the sidebar)            */}
        {/* ============================================================ */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shadow-2xs z-30">
          {/* Left side of Top Bar */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label={t("nav.toggleMenu")}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Role / PANEL Badge */}
            <div className="inline-flex min-w-0 max-w-[14rem] items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-800 shadow-2xs">
              <Store className="w-4 h-4 shrink-0 text-slate-600" />
              <span
                className="hidden sm:inline min-w-0 truncate uppercase"
                title={t("nav.rolePanel", { role: roleName })}
              >
                {t("nav.rolePanel", { role: roleName })}
              </span>
              <span className="sm:hidden min-w-0 truncate">{roleName}</span>
            </div>

            {/* Open / Accepting Online Toggle */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsOnlineAccepting(!isOnlineAccepting)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOnlineAccepting ? "bg-[#65D000]" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isOnlineAccepting ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-slate-700 hidden xl:inline whitespace-nowrap">
                {isOnlineAccepting ? t("nav.acceptingOnline") : t("nav.closedOffline")}
              </span>
            </div>
          </div>

          {/* Right side of Top Bar */}
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {/* Search bar */}
            <div className="relative hidden md:block w-40 lg:w-48 xl:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                aria-label={t("common.search")}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none placeholder:text-slate-400"
              />
            </div>

            {/* ONLINE Status Badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EBF9E5] text-[#4FA800] border border-[#C6EEB2]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4FA800] animate-pulse" />
              <span>{t("nav.onlineBadge")}</span>
            </div>

            {/* User Account Trigger & Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2.5 p-1 sm:p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer outline-none"
              >
                {/* Avatar Photo / Initials */}
                <div className="w-9 h-9 rounded-full bg-[#65D000]/20 text-[#54a800] border border-[#65D000]/40 flex items-center justify-center font-bold text-xs shadow-2xs overflow-hidden">
                  <span className="tracking-tight">
                    {user ? `${user.first_name[0] || ""}${user.last_name[0] || ""}` : "JD"}
                  </span>
                </div>

                {/* Name & Role Text */}
                <div className="hidden max-w-[10rem] text-left sm:block">
                  <div className="truncate text-xs font-bold text-slate-900 leading-tight">
                    {displayName}
                  </div>
                  <div className="truncate text-[11px] text-slate-400 leading-tight">
                    {roleName}
                  </div>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Account Dropdown Card (matching screenshot 2) */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white p-4 shadow-xl border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* User Info Header */}
                  <div className="px-1 py-1">
                    <div className="font-bold text-sm text-slate-900 leading-snug">
                      {displayName}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{displayEmail}</div>
                  </div>

                  <div className="my-2.5 border-t border-slate-100" />

                  {/* Navigation: My Profile */}
                  <Link
                    to="/profile"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    <span>{t("nav.myProfile")}</span>
                  </Link>

                  {/* Navigation: Settings and Language (Settings > Language section) */}
                  <Link
                    to="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4 text-slate-500" />
                    <span>{t("nav.settings")}</span>
                  </Link>
                  <Link
                    to="/settings#language"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Globe className="w-4 h-4 text-slate-500" />
                    <span className="min-w-0 flex-1">{t("nav.language")}</span>
                    <span className="shrink-0 text-[11px] font-medium text-slate-400">
                      {getLocaleMeta(activeLanguage)?.nativeName}
                    </span>
                  </Link>

                  <div className="my-2 border-t border-slate-100" />

                  {/* Action: Sign Out */}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs font-semibold text-[#EF4444] hover:bg-red-50/70 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 text-[#EF4444]" />
                    <span>{t("nav.signOut")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ============================================================ */}
        {/* MAIN SCROLLABLE CONTENT OUTLET                               */}
        {/* ============================================================ */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
