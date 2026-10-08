import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronDown, ChevronRight, LayoutDashboard, X } from "lucide-react";
import { usePermissions } from "../../hooks/use-permissions";
import { MasterProvider } from "./MasterContext";
import { TopbarSlotProvider } from "./TopbarSlot";
import { Topbar } from "./Topbar";
import { NAV_SECTIONS, PLACEHOLDER_DOMAINS, isNavActive } from "./navConfig";

/**
 * The one Master layout: sidebar (built from the permission model) + Topbar + page outlet.
 * Everything inside it can use useMasterScope() and <TopbarAction>.
 */
export const MasterShell: React.FC = () => {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => setMobileOpen(false), [pathname]);

  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    visible: s.items.filter((i) => !i.feature || can(i.feature.id, i.feature.action)),
  })).filter((s) => s.visible.length > 0);

  const linkCls = (active: boolean) =>
    `block rounded-lg px-3 py-1.5 text-xs transition-colors ${
      active
        ? "bg-[#DEF5CE] font-bold text-[#337400]"
        : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
    }`;

  return (
    <MasterProvider>
      <TopbarSlotProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] font-sans text-slate-800 antialiased">
          {mobileOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
          )}
          <aside
            aria-label={t("m.nav.label")}
            className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white transition-transform duration-200 md:static md:translate-x-0 ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#65D000] text-lg font-extrabold text-white shadow-sm">
                  P
                </div>
                <div className="leading-tight">
                  <div className="text-base font-extrabold tracking-tight text-slate-900">
                    Proviyaa
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t("nav.brandSub")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t("nav.closeMenu")}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 md:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
              <div>
                <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t("nav.overview")}
                </div>
                <Link
                  to="/dashboard"
                  aria-current={pathname === "/dashboard" || pathname === "/" ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                    pathname === "/dashboard" || pathname === "/"
                      ? "bg-[#65D000]/15 text-[#429300]"
                      : "text-slate-600 hover:bg-slate-100/70"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {t("nav.items.dashboard")}
                </Link>
              </div>

              <div className="space-y-1">
                <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t("nav.systemDomains")}
                </div>
                {sections.map((s) => {
                  const Icon = s.icon;
                  const hasActive = s.visible.some((i) => isNavActive(i, pathname, s.visible));
                  const open = collapsed[s.id] === undefined ? true : !collapsed[s.id];
                  return (
                    <div key={s.id}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setCollapsed((c) => ({ ...c, [s.id]: open }))}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                          hasActive
                            ? "bg-[#EEF9E8] text-[#3E8800]"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon
                            className={`h-4 w-4 ${hasActive ? "text-[#4FA800]" : "text-slate-500"}`}
                            aria-hidden="true"
                          />
                          {t(s.labelKey)}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
                          aria-hidden="true"
                        />
                      </button>
                      {open && (
                        <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-200/80 pl-2">
                          {s.visible.map((i) => {
                            const active = isNavActive(i, pathname, s.visible);
                            return (
                              <Link
                                key={i.id}
                                to={i.path}
                                aria-current={active ? "page" : undefined}
                                className={linkCls(active)}
                              >
                                {t(i.labelKey)}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {PLACEHOLDER_DOMAINS.map((d) => {
                  const Icon = d.icon;
                  const active = pathname === d.path;
                  return (
                    <Link
                      key={d.id}
                      to={d.path}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                        active
                          ? "bg-[#EEF9E8] text-[#3E8800]"
                          : "text-slate-600 hover:bg-slate-100/70"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        {t(d.labelKey)}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-slate-200 bg-white p-3">
              <Link
                to="/dashboard"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500" aria-hidden="true" />
                {t("nav.backToHome")}
              </Link>
            </div>
          </aside>

          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <Topbar onOpenMenu={() => setMobileOpen(true)} />
            <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6 lg:p-8">
              <Outlet />
            </main>
          </div>
        </div>
      </TopbarSlotProvider>
    </MasterProvider>
  );
};

export default MasterShell;
