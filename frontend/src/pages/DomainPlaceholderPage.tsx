import React from "react";
import { useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Layers } from "lucide-react";
import { humanizeCode, toCode } from "../i18n/labels";

export const DomainPlaceholderPage: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();

  // Title from the last path segment, e.g. /commercials/usage -> nav.items.usage,
  // /platform-core -> nav.items.platform_core. Unknown segments are humanised, never shown raw.
  const segment = location.pathname.split("/").filter(Boolean).pop() ?? "";
  const domainName = segment
    ? t(`nav.items.${toCode(segment)}`, { defaultValue: humanizeCode(segment.replace(/-/g, " ")) })
    : t("nav.placeholder.defaultName");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#65D000]">
          {t("nav.placeholder.eyebrow")}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          {domainName}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
          {t("nav.placeholder.description")}
        </p>
      </div>

      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center shadow-2xs space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#65D000]/10 text-[#65D000] flex items-center justify-center mx-auto">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">
            {t("nav.placeholder.workspace", { name: domainName })}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {t("nav.placeholder.ready")}
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>{t("nav.placeholder.returnToPipeline")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
