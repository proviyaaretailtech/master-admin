import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { usePermissions } from "../../hooks/use-permissions";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  featureName?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ title, message, featureName }) => {
  const { t } = useTranslation();
  const { roleName } = usePermissions();

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 shadow-xs">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
        {title || t("auth.denied.title")}
      </h1>

      <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
        {message ||
          (featureName
            ? t("auth.denied.withFeature", { role: roleName, feature: featureName })
            : t("auth.denied.generic", { role: roleName }))}
        <br />
        {t("auth.denied.contactAdmin")}
      </p>

      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#65D000] text-white font-bold text-xs hover:bg-[#58b700] transition-colors shadow-xs"
        >
          <Home className="w-4 h-4" />
          <span>{t("auth.denied.goDashboard")}</span>
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400" />
          <span>{t("auth.denied.goBack")}</span>
        </button>
      </div>
    </div>
  );
};
