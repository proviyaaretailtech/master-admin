import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bell,
  ChevronDown,
  Globe,
  HelpCircle,
  LogOut,
  MonitorSmartphone,
  Menu,
  Search,
  Settings as SettingsIcon,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { usePermissions } from "../../hooks/use-permissions";
import { useLanguage } from "../../i18n/useLanguage";
import { getLocaleMeta } from "../../i18n/registry";
import { shellApi } from "../../api/shell.api";
import type { EnvironmentName, HealthState } from "../../api/shell.api";
import { useMasterScope } from "./MasterContext";
import { useResource } from "./useResource";
import { Popover } from "./Popover";
import { SearchPalette } from "./SearchPalette";
import { TopbarSlotOutlet } from "./TopbarSlot";
import { inputCls } from "./ui";

const ENV_CLS: Record<EnvironmentName, string> = {
  production: "bg-red-50 text-red-700 border-red-200",
  staging: "bg-amber-50 text-amber-700 border-amber-200",
  development: "bg-sky-50 text-sky-700 border-sky-200",
};
const HEALTH_DOT: Record<HealthState, string> = {
  ok: "bg-[#4FA800]",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-slate-300",
};
const worst = (states: HealthState[]): HealthState =>
  states.includes("down")
    ? "down"
    : states.includes("degraded")
      ? "degraded"
      : states.every((s) => s === "ok")
        ? "ok"
        : "unknown";

export const Topbar: React.FC<{ onOpenMenu: () => void }> = ({ onOpenMenu }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, logoutEverywhere } = useAuth();
  const { roleName } = usePermissions();
  const { active: activeLanguage } = useLanguage();
  const scope = useMasterScope();
  const [searchOpen, setSearchOpen] = useState(false);

  const status = useResource(() => shellApi.getSystemStatus(), [], { refreshMs: 30000 });
  const s = status.data;

  // "/" and cmd/ctrl-k open global search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const orgs = scope.context?.organizations ?? [];
  const locations = scope.locations;
  const env = scope.context?.environment ?? s?.environment;

  const health: Array<{
    key: "api" | "db" | "queue" | "sync";
    state: HealthState;
    detail?: string;
  }> = [
    { key: "api", state: s?.api?.status ?? (s ? "ok" : "unknown") },
    {
      key: "db",
      state: s?.db?.status ?? "unknown",
      detail: s?.db?.latency_ms != null ? `${s.db.latency_ms} ms` : undefined,
    },
    {
      key: "queue",
      state: s?.queue?.status ?? "unknown",
      detail: s ? String(s.queue.backlog) : undefined,
    },
    {
      key: "sync",
      state: s?.sync?.status ?? "unknown",
      detail: s?.sync?.lag_seconds != null ? `${s.sync.lag_seconds} s` : undefined,
    },
  ];
  const overall = status.error ? "unknown" : worst(health.map((h) => h.state));
  const pending = s?.pending_approvals ?? 0;
  const exceptions = s?.open_exceptions ?? 0;
  const bell = pending + exceptions;

  const name =
    scope.context?.user.name || (user ? `${user.first_name} ${user.last_name}`.trim() : "");
  const email = scope.context?.user.email || user?.email || "";
  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`
    : (name[0] ?? "");

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  const handleSignOutEverywhere = async () => {
    await logoutEverywhere();
    navigate("/login");
  };

  return (
    <header className="z-30 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-4 py-2 shadow-2xs sm:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t("nav.toggleMenu")}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <select
          aria-label={t("m.topbar.orgSwitcher")}
          value={scope.orgId}
          onChange={(e) => scope.setOrgId(e.target.value)}
          className={`${inputCls} w-auto max-w-[12rem]`}
        >
          <option value="">{t("m.topbar.allOrgs")}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t("m.topbar.locationSwitcher")}
          value={scope.locationId}
          onChange={(e) => scope.setLocationId(e.target.value)}
          disabled={!scope.orgId}
          className={`${inputCls} w-auto max-w-[12rem]`}
        >
          <option value="">{t("m.topbar.allLocations")}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <TopbarSlotOutlet />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={t("m.search.open")}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-500 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#65D000]/50"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline">{t("nav.searchPlaceholder")}</span>
          <kbd className="hidden rounded border border-slate-200 bg-white px-1 text-[10px] sm:inline">
            /
          </kbd>
        </button>

        {env && (
          <span
            data-testid="env-badge"
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${ENV_CLS[env] ?? ENV_CLS.development}`}
          >
            {t(`m.topbar.env.${env}`)}
          </span>
        )}

        <Popover
          buttonLabel={t("m.topbar.health")}
          buttonClassName="inline-flex min-h-8 items-center gap-1.5 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
          button={
            <>
              <span
                data-testid="health-dot"
                data-state={overall}
                className={`h-2 w-2 rounded-full ${HEALTH_DOT[overall]}`}
              />
              <span>{t(`m.topbar.healthState.${overall}`)}</span>
            </>
          }
        >
          {() => (
            <ul className="space-y-1.5 text-xs">
              {health.map((h) => (
                <li key={h.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[h.state]}`} />
                    {t(`m.topbar.healthItem.${h.key}`)}
                  </span>
                  <span className="text-slate-500">
                    {t(`m.topbar.healthState.${h.state}`)}
                    {h.detail ? ` · ${h.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Popover>

        <Popover
          buttonLabel={t("m.topbar.notifications", { count: bell })}
          buttonClassName="relative p-2 text-slate-600 hover:bg-slate-100"
          button={
            <>
              <Bell className="h-5 w-5" aria-hidden="true" />
              {bell > 0 && (
                <span
                  data-testid="bell-count"
                  className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold text-white"
                >
                  {bell}
                </span>
              )}
            </>
          }
        >
          {(close) => (
            <ul className="space-y-1 text-xs">
              <li>
                <Link
                  to="/finance/settlements"
                  onClick={close}
                  className="flex justify-between rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <span>{t("m.topbar.pendingApprovals")}</span>
                  <b>{pending}</b>
                </Link>
              </li>
              <li>
                <Link
                  to="/dispatch?status=exception"
                  onClick={close}
                  className="flex justify-between rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <span>{t("m.topbar.openExceptions")}</span>
                  <b>{exceptions}</b>
                </Link>
              </li>
            </ul>
          )}
        </Popover>

        <Popover
          buttonLabel={t("common.help")}
          buttonClassName="p-2 text-slate-600 hover:bg-slate-100"
          button={<HelpCircle className="h-5 w-5" aria-hidden="true" />}
        >
          {(close) => (
            <ul className="space-y-1 text-xs">
              <li className="px-2 py-1 text-slate-500">{t("m.topbar.helpShortcuts")}</li>
              <li>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    close();
                    setSearchOpen(true);
                  }}
                >
                  {t("m.search.open")}
                </button>
              </li>
              <li>
                <Link
                  to="/settings"
                  onClick={close}
                  className="block rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  {t("nav.settings")}
                </Link>
              </li>
            </ul>
          )}
        </Popover>

        <Popover
          buttonLabel={t("m.topbar.profileMenu")}
          buttonClassName="flex items-center gap-2 p-1 hover:bg-slate-100"
          button={
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#65D000]/40 bg-[#65D000]/20 text-xs font-bold text-[#54a800]">
                {initials}
              </span>
              <span className="hidden max-w-[10rem] text-left sm:block">
                <span className="block truncate text-xs font-bold text-slate-900">{name}</span>
                <span className="block truncate text-[11px] text-slate-400">{roleName}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </>
          }
        >
          {(close) => (
            <div className="text-xs">
              <div className="px-1 py-1">
                <div className="text-sm font-bold text-slate-900">{name}</div>
                <div className="truncate text-slate-400">{email}</div>
              </div>
              <div className="my-2 border-t border-slate-100" />
              <Link
                to="/profile"
                onClick={close}
                className="flex items-center gap-3 rounded-xl px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <UserIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                {t("nav.myProfile")}
              </Link>
              <Link
                to="/settings"
                onClick={close}
                className="flex items-center gap-3 rounded-xl px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <SettingsIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                {t("nav.settings")}
              </Link>
              <Link
                to="/settings#language"
                onClick={close}
                className="flex items-center gap-3 rounded-xl px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Globe className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 flex-1">{t("nav.language")}</span>
                <span className="text-[11px] font-medium text-slate-400">
                  {getLocaleMeta(activeLanguage)?.nativeName}
                </span>
              </Link>
              <div className="my-2 border-t border-slate-100" />
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left font-semibold text-red-600 hover:bg-red-50/70"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t("nav.signOut")}
              </button>
              <button
                type="button"
                onClick={handleSignOutEverywhere}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left font-semibold text-red-600 hover:bg-red-50/70"
              >
                <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
                {t("nav.signOutEverywhere")}
              </button>
            </div>
          )}
        </Popover>
      </div>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};
