import React, { useContext, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Globe,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  MapPin,
  User as UserIcon,
} from "lucide-react";
import { AuthContext } from "../context/auth-context";
import { usePermissions } from "../hooks/use-permissions";
import { FEAT } from "../lib/master-features";
import { LanguageRadioGroup } from "../components/i18n/LanguageRadioGroup";
import { useLanguage, useNumeralStyle } from "../i18n/useLanguage";
import { formatNumber } from "../i18n/format";

/**
 * Settings. Today it holds one section, Language; it is also reachable from the header menu
 * (Language row -> /settings#language).
 */
interface EntryLink {
  id: string;
  path: string;
  feature?: { id: string; action?: string };
}
/** Entry points into the screens that own each kind of configuration. */
const GROUPS: Array<{ id: string; icon: React.ElementType; links: EntryLink[] }> = [
  {
    id: "platform",
    icon: SlidersHorizontal,
    links: [
      {
        id: "plans",
        path: "/commercials/plans",
        feature: { id: "feat_commercial_plans", action: "view_plans" },
      },
      {
        id: "modules",
        path: "/commercials/modules",
        feature: { id: "feat_commercial_plans", action: "view_plans" },
      },
      {
        id: "roles",
        path: "/access-control/roles",
        feature: { id: "feat_roles_templates", action: "view_roles" },
      },
      {
        id: "integrations",
        path: "/integrations",
        feature: { id: FEAT.INTEGRATIONS.id, action: FEAT.INTEGRATIONS.view },
      },
      { id: "api", path: "/developer/api", feature: { id: FEAT.API.id, action: FEAT.API.view } },
    ],
  },
  {
    id: "business",
    icon: Store,
    links: [
      {
        id: "organizations",
        path: "/organizations",
        feature: { id: FEAT.ORG_OPS.id, action: FEAT.ORG_OPS.view },
      },
      {
        id: "commission",
        path: "/commission-rules",
        feature: { id: FEAT.COMMISSION.id, action: FEAT.COMMISSION.view },
      },
      {
        id: "riderPay",
        path: "/rider-pay",
        feature: { id: FEAT.RIDER_PAY.id, action: FEAT.RIDER_PAY.view },
      },
    ],
  },
  {
    id: "location",
    icon: MapPin,
    links: [
      {
        id: "locations",
        path: "/locations",
        feature: { id: "feat_partner_locations", action: "view_locations" },
      },
      {
        id: "invitations",
        path: "/invitations",
        feature: { id: FEAT.USERS.id, action: FEAT.USERS.view },
      },
    ],
  },
  {
    id: "security",
    icon: ShieldCheck,
    links: [
      {
        id: "policies",
        path: "/access-control/policies",
        feature: { id: "feat_roles_templates", action: "view_roles" },
      },
      { id: "users", path: "/users", feature: { id: "feat_users_mgmt", action: "view_users" } },
      {
        id: "audit",
        path: "/access-control/audit-logs",
        feature: { id: FEAT.AUDIT.id, action: FEAT.AUDIT.view },
      },
    ],
  },
];

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useContext(AuthContext)?.user;
  const { can, roleName } = usePermissions();
  const { hash } = useLocation();
  const { active } = useLanguage();
  const numerals = useNumeralStyle();
  const sectionRef = useRef<HTMLElement>(null);

  // Deep link: /settings#language scrolls the section into view.
  useEffect(() => {
    if (hash === "#language") sectionRef.current?.scrollIntoView?.({ block: "start" });
  }, [hash]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#65D000]">
          {t("settings.eyebrow")}
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {t("settings.title")}
        </h1>
        <p className="mt-1 max-w-xl text-xs text-slate-500 sm:text-sm">{t("settings.subtitle")}</p>
      </div>

      <section
        aria-labelledby="settings-profile-heading"
        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#65D000]/10 text-[#65D000]">
              <UserIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="settings-profile-heading" className="text-base font-bold text-slate-900">
                {t("settings.profile.title")}
              </h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {user ? `${user.first_name} ${user.last_name}`.trim() : ""} · {user?.email} ·{" "}
                {roleName}
              </p>
            </div>
          </div>
          <Link to="/profile" className="text-xs font-semibold text-[#337400] underline">
            {t("settings.profile.open")}
          </Link>
        </div>
      </section>

      {GROUPS.map((g) => {
        const links = g.links.filter((l) => !l.feature || can(l.feature.id, l.feature.action));
        if (links.length === 0) return null;
        const Icon = g.icon;
        return (
          <section
            key={g.id}
            aria-labelledby={`settings-${g.id}-heading`}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:p-6"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#65D000]/10 text-[#65D000]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id={`settings-${g.id}-heading`} className="text-base font-bold text-slate-900">
                  {t(`settings.group.${g.id}.title`)}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t(`settings.group.${g.id}.description`)}
                </p>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {links.map((l) => (
                <li key={l.id}>
                  <Link
                    to={l.path}
                    className="block rounded-xl border border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#65D000] hover:bg-[#EEF9E8]"
                  >
                    {t(`settings.link.${l.id}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section
        id="language"
        ref={sectionRef}
        aria-labelledby="settings-language-heading"
        className="scroll-mt-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#65D000]/10 text-[#65D000]">
            <Globe className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="settings-language-heading" className="text-base font-bold text-slate-900">
              {t("settings.language.title")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("settings.language.description")}</p>
          </div>
        </div>

        <LanguageRadioGroup variant="list" labelledBy="settings-language-heading" />

        <div className="mt-4 border-t border-slate-100 pt-4">
          <label
            className={`flex items-start gap-3 text-xs ${
              active === "hi"
                ? "cursor-pointer text-slate-700"
                : "cursor-not-allowed text-slate-400"
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#65D000]"
              checked={numerals.style === "deva"}
              disabled={active !== "hi"}
              onChange={(e) => numerals.set(e.target.checked ? "deva" : "latn")}
            />
            <span className="min-w-0">
              <span className="block font-semibold">{t("settings.language.devanagariDigits")}</span>
              <span className="mt-0.5 block text-slate-500">
                {t("settings.language.devanagariDigitsHint", {
                  example: formatNumber(1234567, { locale: "hi-IN-u-nu-deva" }),
                })}
              </span>
            </span>
          </label>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
