import { useSyncExternalStore } from "react";
import {
  getLanguageState,
  subscribeLanguage,
  selectLanguage,
  prefetchLanguage,
} from "./language-store";
import { LOCALES } from "./registry";
import { getNumeralStyle, setNumeralStyle, subscribeNumeralStyle } from "./format";

/** Everything a language picker needs. Re-renders only on language/loader changes. */
export function useLanguage() {
  const state = useSyncExternalStore(subscribeLanguage, getLanguageState, getLanguageState);
  return {
    active: state.active,
    rows: state.rows,
    locales: LOCALES,
    select: selectLanguage,
    prefetch: prefetchLanguage,
  };
}

export function useLanguageAnnouncement() {
  return useSyncExternalStore(subscribeLanguage, () => getLanguageState().announcement);
}

/** Devanagari-digits preference (Hindi only, off by default). */
export function useNumeralStyle() {
  const style = useSyncExternalStore(subscribeNumeralStyle, getNumeralStyle, getNumeralStyle);
  return { style, set: setNumeralStyle };
}
