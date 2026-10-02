import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n";
import { AuthContext } from "../context/auth-context";
import { LoginPage } from "../pages/LoginPage";
import { bootstrapI18n, readInitialLanguage } from "../i18n/bootstrap";
import { LANGUAGE_STORAGE_KEY } from "../i18n/config";
import { localeLoaders, resetLocaleCache, isLocaleLoaded } from "../i18n/loader";
import { resetLanguageStore } from "../i18n/language-store";

const realLoaders = { ...localeLoaders };
const authValue = {
  user: null,
  token: null,
  loading: false,
  login: vi.fn(async () => ({ error: null })),
  logout: vi.fn(async () => {}),
};

const setNavigatorLanguages = (langs: string[]) => {
  Object.defineProperty(window.navigator, "languages", { value: langs, configurable: true });
  Object.defineProperty(window.navigator, "language", { value: langs[0], configurable: true });
};

beforeEach(() => {
  resetLocaleCache("hi");
  resetLanguageStore("en");
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
});

afterEach(async () => {
  cleanup(); // unmount first so resetting the store does not update live components
  Object.assign(localeLoaders, realLoaders);
  setNavigatorLanguages(["en-US", "en"]);
  resetLocaleCache("hi");
  resetLanguageStore("en");
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("startup language", () => {
  it("defaults from the browser, falling back to English", () => {
    setNavigatorLanguages(["fr-FR", "hi-IN", "en"]);
    expect(readInitialLanguage()).toBe("hi");
    setNavigatorLanguages(["fr-FR", "de"]);
    expect(readInitialLanguage()).toBe("en");
    setNavigatorLanguages(["en-GB"]);
    expect(readInitialLanguage()).toBe("en");
  });

  it("a saved choice beats the browser language; junk values are ignored", () => {
    setNavigatorLanguages(["hi-IN"]);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    expect(readInitialLanguage()).toBe("en");
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "klingon");
    expect(readInitialLanguage()).toBe("hi");
  });

  it("applies the saved Hindi locale BEFORE the first render (no English flash)", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "hi");
    expect(isLocaleLoaded("hi")).toBe(false);

    const wanted = await bootstrapI18n();
    expect(wanted).toBe("hi");
    expect(i18n.language).toBe("hi");
    expect(document.documentElement.getAttribute("lang")).toBe("hi");

    // the very first render output is already Hindi
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );
    expect(screen.getByRole("heading", { name: "सुपर एडमिन" })).toBeInTheDocument();
    expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
  });

  it("starts in English without loading Hindi when English is saved", async () => {
    const hiLoader = vi.fn(realLoaders.hi!.catalogue);
    localeLoaders.hi = { ...realLoaders.hi!, catalogue: hiLoader };
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    expect(await bootstrapI18n()).toBe("en");
    expect(hiLoader).not.toHaveBeenCalled();
    expect(i18n.language).toBe("en");
  });

  it("if the saved language cannot load, the app still starts in English and keeps the preference", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localeLoaders.hi = {
      catalogue: async () => {
        throw new Error("offline");
      },
    };
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "hi");
    expect(await bootstrapI18n()).toBe("en");
    expect(i18n.language).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("hi");
    warn.mockRestore();
  });
});
