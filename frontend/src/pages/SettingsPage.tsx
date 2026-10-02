import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { LanguageRadioGroup } from "../components/i18n/LanguageRadioGroup";
import { useLanguage, useNumeralStyle } from "../i18n/useLanguage";
import { formatNumber } from "../i18n/format";

/**
 * Settings. Today it holds one section, Language; it is also reachable from the header menu
 * (Language row -> /settings#language).
 */
export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
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
