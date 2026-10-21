import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { authApi } from "../api";
import { LanguageRadioGroup } from "../components/i18n/LanguageRadioGroup";
import { localizeError } from "../i18n/errors";

/** Same rule as the backend (validators/common.validator.ts passwordSchema). */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Reads the recovery token Supabase put in the reset link's URL fragment
 * (#access_token=...&type=recovery). The fragment never reaches a server.
 */
export function readRecoveryToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("error") || params.get("error_code")) return null;
  const token = params.get("access_token");
  const type = params.get("type");
  return token && (type === null || type === "recovery") ? token : null;
}

/**
 * /reset-password: the page the emailed reset link opens. The admin chooses a new password; the backend
 * sets it with the recovery token (Supabase PUT /auth/v1/user) and ends every session of the account.
 */
export const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Read once, then remove the token from the address bar and the browser history.
  const [token] = useState<string | null>(() => readRecoveryToken(window.location.hash));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [serverError, setServerError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setProblem(t("auth.reset.tooShort", { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      setProblem(t("auth.reset.tooLong", { max: PASSWORD_MAX_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setProblem(t("auth.reset.mismatch"));
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      await authApi.resetPassword(token!, password);
      navigate("/login", { replace: true, state: { passwordChanged: true } });
    } catch (err) {
      setServerError(err);
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-[#65D000] focus:ring-2 focus:ring-[#65D000]/20";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#F4F5F7] px-4 py-8">
      <div className="absolute right-4 top-4 z-10">
        <LanguageRadioGroup variant="compact" />
      </div>

      <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sm:p-10">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-[#65D000] flex items-center justify-center shadow-sm">
            {/* i18n-ignore */}
            <span className="text-white font-extrabold text-xl tracking-tight">P</span>
          </div>
        </div>
        <h1 className="mt-5 text-center text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          {t("auth.reset.title")}
        </h1>

        {!token ? (
          <div className="mt-6 space-y-4">
            <div
              role="alert"
              className="rounded-xl bg-[#FFF5F5] border border-[#FEB2B2] p-3 flex items-start gap-2.5 text-xs text-[#E53E3E]"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-tight font-medium">{t("auth.reset.invalidLink")}</span>
            </div>
            <Link
              to="/login"
              className="block w-full text-center bg-[#65D000] hover:bg-[#58b800] text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              {t("auth.reset.requestNew")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {(problem || serverError !== null) && (
              <div
                role="alert"
                className="rounded-xl bg-[#FFF5F5] border border-[#FEB2B2] p-3 flex items-start gap-2.5 text-xs text-[#E53E3E]"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-tight font-medium">
                  {problem ?? localizeError(serverError, "auth.reset.failed")}
                </span>
              </div>
            )}
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {t("auth.reset.newPassword")}
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {t("auth.reset.rule", { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })}
              </p>
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {t("auth.reset.confirmPassword")}
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#65D000] hover:bg-[#58b800] text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-sm disabled:opacity-70 cursor-pointer"
            >
              {saving ? t("auth.reset.saving") : t("auth.reset.submit")}
            </button>
            <Link
              to="/login"
              className="block text-center text-xs font-medium text-[#65D000] hover:underline"
            >
              {t("auth.forgot.back")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
};
