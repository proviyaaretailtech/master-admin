import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check } from "lucide-react";
import { useLanguage } from "../../i18n/useLanguage";
import { AppLanguage } from "../../i18n/config";
import { htmlLangFor } from "../../i18n";

interface Props {
  /** "list": one row per language with a live preview (Settings). "compact": pills (login page). */
  variant?: "list" | "compact";
  /** id of the element that labels the group (Settings heading). */
  labelledBy?: string;
  className?: string;
}

const Spinner: React.FC = () => (
  <span
    aria-hidden="true"
    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#65D000] border-t-transparent"
  />
);

/**
 * Radio-group language picker used by Settings and the login page.
 *
 * - Selecting never reloads or remounts anything; see i18n/language-store.ts.
 * - While a language downloads, the CURRENT language stays on screen and only that row shows a
 *   spinner; failure keeps the current language and shows an inline error with Retry.
 * - Keyboard: Tab to the group, arrows/Home/End move focus (and warm up that language),
 *   Space/Enter selects. Focus is never moved or lost by a switch.
 * - Hover and focus prefetch the language so the click is usually instant.
 */
export const LanguageRadioGroup: React.FC<Props> = ({
  variant = "list",
  labelledBy,
  className = "",
}) => {
  const { t } = useTranslation();
  const { active, rows, locales, select, prefetch } = useLanguage();
  const [focused, setFocused] = useState<AppLanguage | null>(null);
  const refs = useRef<Partial<Record<AppLanguage, HTMLButtonElement | null>>>({});

  const tabStop = focused && locales.some((l) => l.code === focused) ? focused : active;

  const moveFocus = (index: number) => {
    const target = locales[(index + locales.length) % locales.length];
    refs.current[target.code]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        moveFocus(index + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(index - 1);
        break;
      case "Home":
        e.preventDefault();
        moveFocus(0);
        break;
      case "End":
        e.preventDefault();
        moveFocus(locales.length - 1);
        break;
    }
  };

  const errorFor = (code: AppLanguage, nativeName: string) => {
    const row = rows[code];
    if (row?.status !== "error") return null;
    const current = locales.find((l) => l.code === active)?.nativeName ?? active;
    return (
      <div
        role="alert"
        className="mt-1.5 flex items-start gap-2 rounded-xl border border-[#FEB2B2] bg-[#FFF5F5] px-3 py-2 text-xs text-[#E53E3E]"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 font-medium">
          {t(row.error === "timeout" ? "settings.language.timeout" : "settings.language.failed", {
            language: nativeName,
            current,
          })}
        </span>
        <button
          type="button"
          onClick={() => void select(code)}
          className="shrink-0 rounded-lg border border-[#FEB2B2] bg-white px-2.5 py-1 font-semibold text-[#E53E3E] hover:bg-[#FFF5F5]"
        >
          {t("common.retry")}
        </button>
      </div>
    );
  };

  if (variant === "compact") {
    return (
      <div className={className}>
        <div
          role="radiogroup"
          aria-label={t("common.language")}
          className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5"
        >
          {locales.map((l, index) => {
            const row = rows[l.code];
            const isActive = active === l.code;
            const loading = row?.status === "loading";
            return (
              <button
                key={l.code}
                ref={(el) => {
                  refs.current[l.code] = el;
                }}
                type="button"
                role="radio"
                lang={htmlLangFor(l.code)}
                aria-checked={isActive}
                aria-disabled={loading || undefined}
                aria-busy={loading || undefined}
                tabIndex={l.code === tabStop ? 0 : -1}
                onClick={() => void select(l.code)}
                onKeyDown={(e) => onKeyDown(e, index)}
                onFocus={() => {
                  setFocused(l.code);
                  prefetch(l.code);
                }}
                onMouseEnter={() => prefetch(l.code)}
                className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#65D000]/50 ${
                  isActive ? "bg-[#65D000]/15 text-[#337400]" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{l.nativeName}</span>
                {loading && <Spinner />}
                {loading && (
                  <span role="status" className="sr-only">
                    {t("settings.language.loading", { language: l.nativeName })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {locales.map((l) => (
          <React.Fragment key={l.code}>{errorFor(l.code, l.nativeName)}</React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : t("common.language")}
      className={`space-y-2 ${className}`}
    >
      {locales.map((l, index) => {
        const row = rows[l.code];
        const isActive = active === l.code;
        const loading = row?.status === "loading";
        return (
          <div key={l.code}>
            <button
              ref={(el) => {
                refs.current[l.code] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={loading || undefined}
              aria-busy={loading || undefined}
              aria-describedby={`language-sample-${l.code}`}
              tabIndex={l.code === tabStop ? 0 : -1}
              onClick={() => void select(l.code)}
              onKeyDown={(e) => onKeyDown(e, index)}
              onFocus={() => {
                setFocused(l.code);
                prefetch(l.code);
              }}
              onBlur={() => setFocused(null)}
              onMouseEnter={() => prefetch(l.code)}
              className={`flex w-full min-h-[64px] items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#65D000]/50 ${
                isActive
                  ? "border-[#65D000] bg-[#EEF9E8]"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {/* radio dot */}
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isActive
                    ? "border-[#65D000] bg-[#65D000] text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {isActive && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span lang={htmlLangFor(l.code)} className="text-sm font-bold text-slate-900">
                    {l.nativeName}
                  </span>
                  {l.englishName !== l.nativeName && (
                    <span lang="en" className="text-xs font-medium text-slate-500">
                      {l.englishName}
                    </span>
                  )}
                </span>
                <span
                  id={`language-sample-${l.code}`}
                  lang={htmlLangFor(l.code)}
                  className="mt-0.5 block text-xs text-slate-600"
                >
                  {l.sample}
                </span>
              </span>

              {/* fixed-size slot: spinner / check never changes the row height */}
              <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center gap-1.5">
                {loading && <Spinner />}
                {loading && (
                  <span role="status" className="text-xs font-medium text-slate-500">
                    {t("common.loading")}
                  </span>
                )}
              </span>
            </button>
            {errorFor(l.code, l.nativeName)}
          </div>
        );
      })}
    </div>
  );
};
