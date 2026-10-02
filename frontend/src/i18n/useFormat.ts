import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  DateInput,
  DateOpts,
  MoneyOpts,
  NumberFormatOpts,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyFrom,
  formatMoneyMinor,
  formatNumber,
  formatRelativeTime,
  formatTime,
  getNumeralStyle,
  subscribeNumeralStyle,
} from "./format";

/**
 * Formatters bound to the active language. Using this hook makes the component re-render the
 * moment the language (or the digit style) changes, so numbers and dates switch in the same
 * frame as the text.
 *
 *   const f = useFormat();
 *   f.money(plan.price)                  // ₹1,23,456.50
 *   f.moneyFrom(plan, "price")           // prefers plan.price_minor
 *   f.date(org.created_at)               // Sep 16, 2026 / 16 सित॰ 2026
 */
export function useFormat() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const numerals = useSyncExternalStore(subscribeNumeralStyle, getNumeralStyle, getNumeralStyle);

  return useMemo(
    () => ({
      language,
      money: (v: number | null | undefined, o?: MoneyOpts) => formatMoney(v, o),
      moneyMinor: (v: number | null | undefined, o?: MoneyOpts) => formatMoneyMinor(v, o),
      moneyFrom: (r: Record<string, unknown> | null | undefined, field: string, o?: MoneyOpts) =>
        formatMoneyFrom(r, field, o),
      number: (v: number | null | undefined, o?: NumberFormatOpts) => formatNumber(v, o),
      date: (v: DateInput, o?: DateOpts) => formatDate(v, o),
      time: (v: DateInput, o?: Omit<DateOpts, "style">) => formatTime(v, o),
      dateTime: (v: DateInput, o?: DateOpts) => formatDateTime(v, o),
      relative: (v: DateInput, o?: { now?: Date | number }) => formatRelativeTime(v, o),
    }),
    // `numerals` is a dependency on purpose: the functions read it from module state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, numerals]
  );
}
