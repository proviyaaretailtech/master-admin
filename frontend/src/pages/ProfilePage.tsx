import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/use-auth";
import { userApi } from "../api";
import { useFormat } from "../i18n/useFormat";
import { localizeError } from "../i18n/errors";
import {
  Mail,
  Phone,
  ShieldCheck,
  Database,
  CheckCircle2,
  AlertTriangle,
  Save,
  KeyRound,
  Calendar,
  LogOut,
  MonitorSmartphone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// What is shown in the error banner: a catalogue key (validation) or an error thrown by the API.
// Both are kept as data (not text) so the banner re-translates when the language changes.
type ProfileError = { key: string } | { error: unknown };

export const ProfilePage: React.FC = () => {
  const { user, logout, logoutEverywhere } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const f = useFormat();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<ProfileError | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone_number: user.phone_number || "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (saved) setSaved(false);
    if (profileError) setProfileError(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.first_name.trim().length < 2) {
      setProfileError({ key: "settings.profile.messages.firstNameTooShort" });
      return;
    }
    if (formData.last_name.trim().length < 1) {
      setProfileError({ key: "settings.profile.messages.lastNameRequired" });
      return;
    }

    setSaving(true);
    setSaved(false);
    setProfileError(null);

    try {
      console.log("[ProfilePage] Updating user profile:", formData);
      await userApi.update(user.id, {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone_number: formData.phone_number.trim(),
      });

      setSaved(true);
    } catch (err: any) {
      console.error("[ProfilePage] Profile update failed:", err);
      setProfileError({ error: err });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  const handleSignOutEverywhere = async () => {
    await logoutEverywhere();
    navigate("/login");
  };

  const memberSince = user?.created_at
    ? f.date(user.created_at)
    : t("settings.profile.memberSinceFallback");

  const errorText = profileError
    ? "key" in profileError
      ? t(profileError.key)
      : localizeError(profileError.error, "settings.profile.messages.saveFailed")
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Title & Breadcrumbs */}
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-wider [&:lang(hi)]:tracking-normal text-[#65D000]">
          {t("settings.profile.eyebrow")}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          {t("settings.profile.title")}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          {t("settings.profile.intro")}
        </p>
      </div>

      {/* Header Profile Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#65D000]/15 text-[#429300] border border-[#65D000]/30 flex items-center justify-center font-bold text-xl shadow-xs">
            {user ? `${user.first_name[0] || ""}${user.last_name[0] || ""}` : "JD"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {user ? `${user.first_name} ${user.last_name}` : "John Doe"}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF9E5] text-[#3E8800] border border-[#BCE8A2]">
                <ShieldCheck className="w-3 h-3" /> {t("settings.profile.superAdminBadge")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user?.email || "john.doe@proviyaa.com"}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {user?.phone_number || "+91 98765 43210"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database className="w-3.5 h-3.5" /> {t("settings.profile.supabaseConnected")}
          </span>
        </div>
      </div>

      {/* Feedback Notifications */}
      {saved && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{t("settings.profile.messages.saved")}</span>
        </div>
      )}

      {errorText && (
        <div className="rounded-xl bg-[#FFF5F5] border border-[#FEB2B2] p-4 flex items-center gap-3 text-xs text-[#E53E3E]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#E53E3E]" />
          <span className="font-semibold">{errorText}</span>
        </div>
      )}

      {/* Grid: Profile Form + Security Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Personal Information Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {t("settings.profile.personal.title")}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("settings.profile.personal.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Names Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("settings.profile.form.firstName")}
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("settings.profile.form.lastName")}
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none"
                />
              </div>
            </div>

            {/* Email Address (Read-only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {t("settings.profile.form.emailAddress")}
                </label>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {t("settings.profile.form.verifiedIdentity")}
                </span>
              </div>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed outline-none font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {t("settings.profile.form.emailHint")}
              </p>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("settings.profile.form.phoneNumber")}
              </label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#65D000] hover:bg-[#58b800] text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {saving
                    ? t("settings.profile.form.savingChanges")
                    : t("settings.profile.form.saveChanges")}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (1 col): System & Security Information */}
        <div className="space-y-6">
          {/* Access Credentials Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <KeyRound className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider [&:lang(hi)]:tracking-normal text-slate-800">
                {t("settings.profile.access.title")}
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">
                  {t("settings.profile.access.systemRole")}
                </span>
                <span className="font-semibold text-slate-800">
                  {t("settings.profile.access.systemRoleValue")}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">
                  {t("settings.profile.access.accountId")}
                </span>
                <span className="font-mono text-[11px] text-slate-600 break-all">
                  {user?.id || t("settings.profile.notAvailable")}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">
                  {t("settings.profile.access.authMechanism")}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#65D000]" />
                  {t("settings.profile.access.authMechanismValue")}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">
                  {t("settings.profile.access.accountCreated")}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {memberSince}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#EF4444] bg-red-50 hover:bg-red-100/80 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t("settings.profile.access.signOut")}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOutEverywhere}
                title={t("settings.profile.access.signOutEverywhereHint")}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#EF4444] border border-red-100 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <MonitorSmartphone className="w-3.5 h-3.5" />
                <span>{t("settings.profile.access.signOutEverywhere")}</span>
              </button>
              <p className="mt-1.5 text-center text-[11px] text-slate-400">
                {t("settings.profile.access.signOutEverywhereHint")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
