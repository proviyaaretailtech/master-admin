import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import i18n from "../i18n";
import { LANGUAGE_STORAGE_KEY } from "../i18n/config";

// Node >= 25 ships an experimental global `localStorage` that shadows jsdom's and is `undefined`
// unless a --localstorage-file is given (merely reading it prints a warning). Always install a
// simple in-memory Storage so code under test (language preference, auth token) behaves the
// same on every Node version.
{
  const data = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
  Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
}

// Automatically unmount and cleanup DOM after the test finishes
afterEach(async () => {
  cleanup();
  // Tests run in English; any test that switches language must not leak into the next one.
  if (i18n.language !== "en") await i18n.changeLanguage("en");
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
});

// Mock window.matchMedia if needed by responsive designs
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
