import React, { useEffect, useRef, useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { AuthContext } from "../context/auth-context";
import { LoginPage } from "../pages/LoginPage";
import { SettingsPage } from "../pages/SettingsPage";
import { LanguageRadioGroup } from "../components/i18n/LanguageRadioGroup";
import { LanguageAnnouncer } from "../components/i18n/LanguageAnnouncer";
import {
  localeLoaders,
  loadLocaleWithTimeout,
  resetLocaleCache,
  LocaleLoadError,
  isLocaleLoaded,
} from "../i18n/loader";
import { resetLanguageStore, selectLanguage, getLanguageState } from "../i18n/language-store";
import { LANGUAGE_STORAGE_KEY } from "../i18n/config";
import hi from "../i18n/locales/hi.json";

const realLoaders = { ...localeLoaders };

/** A loader whose completion the test controls. */
function deferredLoader() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const gate = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const catalogue = vi.fn(async () => {
    await gate;
    return hi as unknown as Record<string, unknown>;
  });
  return { loader: { catalogue }, resolve, reject, catalogue };
}

const authValue = {
  user: null,
  token: null,
  loading: false,
  login: vi.fn(async () => ({ error: null })),
  logout: vi.fn(async () => {}),
  logoutEverywhere: vi.fn(async () => {}),
  notice: null,
};

const renderLogin = () =>
  render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter>
        <LoginPage />
        <LanguageAnnouncer />
      </MemoryRouter>
    </AuthContext.Provider>
  );

const radio = (name: RegExp | string) => screen.getByRole("radio", { name });

beforeEach(() => {
  resetLocaleCache("hi");
  resetLocaleCache("en-XA");
  resetLanguageStore("en");
});

afterEach(async () => {
  cleanup(); // unmount first so resetting the store does not update live components
  Object.assign(localeLoaders, realLoaders);
  resetLocaleCache("hi");
  resetLocaleCache("en-XA");
  resetLanguageStore("en");
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("switching language re-renders instantly without remounting", () => {
  it("login page: text, <html lang> and the typed email all update in place", async () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Super Admin" })).toBeInTheDocument();

    const email = screen.getByLabelText("Email Address") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "owner@example.com" } });
    expect(email.value).toBe("owner@example.com");

    await act(async () => {
      await selectLanguage("hi");
    });

    // Same frame: no waitFor needed after the awaited switch.
    expect(screen.getByRole("heading", { name: "सुपर एडमिन" })).toBeInTheDocument();
    expect(screen.getByLabelText("ईमेल पता")).toBe(email); // same DOM node: not remounted
    expect(email.value).toBe("owner@example.com"); // typed state kept
    expect(screen.getByRole("button", { name: "साइन इन करें" })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("lang")).toBe("hi");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("hi");

    await act(async () => {
      await selectLanguage("en");
    });
    expect(screen.getByRole("heading", { name: "Super Admin" })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(email.value).toBe("owner@example.com");
  });

  it("a stateful host never remounts and its input keeps its value", async () => {
    let mounts = 0;
    const Host: React.FC = () => {
      const { t } = useTranslation();
      const [value, setValue] = useState("");
      const ref = useRef<HTMLInputElement>(null);
      useEffect(() => {
        mounts += 1;
      }, []);
      return (
        <div>
          <input
            aria-label="note"
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p data-testid="word">{t("common.save")}</p>
          <LanguageRadioGroup variant="compact" />
        </div>
      );
    };
    render(<Host />);
    fireEvent.change(screen.getByLabelText("note"), { target: { value: "draft text" } });
    const input = screen.getByLabelText("note");
    act(() => input.focus());

    await act(async () => {
      fireEvent.click(radio(/हिन्दी/));
    });
    await waitFor(() => expect(screen.getByTestId("word")).toHaveTextContent("सहेजें"));

    expect(mounts).toBe(1);
    expect(screen.getByLabelText("note")).toBe(input);
    expect((input as HTMLInputElement).value).toBe("draft text");
  });

  it("numbers and dates follow the same switch", async () => {
    const { formatMoney, formatDate } = await import("../i18n/format");
    expect(formatDate("2026-09-17T01:30:00+05:30")).toBe("Sep 17, 2026");
    await act(async () => {
      await selectLanguage("hi");
    });
    expect(formatDate("2026-09-17T01:30:00+05:30")).not.toBe("Sep 17, 2026");
    expect(formatMoney(123456.5)).toBe("₹1,23,456.50");
  });
});

describe("Settings > Language", () => {
  const renderSettings = (route = "/settings#language") =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <SettingsPage />
        <LanguageAnnouncer />
      </MemoryRouter>
    );

  it("lists one radio row per locale with a live preview, English selected", () => {
    renderSettings();
    expect(screen.getByRole("heading", { name: "Language" })).toBeInTheDocument();
    const group = screen.getByRole("radiogroup");
    expect(within(group).getByRole("radio", { name: /English/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(within(group).getByRole("radio", { name: /हिन्दी/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByText("Order accepted")).toBeInTheDocument();
    expect(screen.getByText("ऑर्डर स्वीकार किया गया")).toBeInTheDocument();
    // previews are tagged with their own language for screen readers
    expect(screen.getByText("ऑर्डर स्वीकार किया गया")).toHaveAttribute("lang", "hi");
  });

  it("shows the loader on that row only, keeps the current language, then swaps and announces", async () => {
    const d = deferredLoader();
    localeLoaders.hi = d.loader;
    renderSettings();

    const hiRow = radio(/हिन्दी/);
    await act(async () => {
      fireEvent.click(hiRow);
    });

    // loading: row busy + inline status; page still English; English row unaffected
    expect(hiRow).toHaveAttribute("aria-busy", "true");
    expect(within(hiRow).getByRole("status")).toHaveTextContent("Loading...");
    expect(screen.getByRole("heading", { name: "Language" })).toBeInTheDocument();
    expect(radio(/English/)).not.toHaveAttribute("aria-busy");
    expect(radio(/English/)).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.getAttribute("lang")).toBe("en");

    await act(async () => {
      d.resolve();
    });

    await waitFor(() => expect(screen.getByRole("heading", { name: "भाषा" })).toBeInTheDocument());
    expect(radio(/हिन्दी/)).toHaveAttribute("aria-checked", "true");
    expect(radio(/हिन्दी/)).not.toHaveAttribute("aria-busy");
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(document.documentElement.getAttribute("lang")).toBe("hi");
    // polite live region announces in the NEW language
    expect(screen.getByTestId("language-announcer")).toHaveTextContent("भाषा हिन्दी में बदली गई");
    expect(screen.getByTestId("language-announcer")).toHaveAttribute("aria-live", "polite");
  });

  it("failure keeps the current language and shows an inline error with Retry", async () => {
    const d = deferredLoader();
    localeLoaders.hi = d.loader;
    renderSettings();

    await act(async () => {
      fireEvent.click(radio(/हिन्दी/));
    });
    await act(async () => {
      d.reject(new Error("network down"));
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Could not load हिन्दी\. You are still using English\./);
    expect(radio(/English/)).toHaveAttribute("aria-checked", "true");
    expect(i18n.language).toBe("en");
    expect(screen.getByRole("heading", { name: "Language" })).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();

    // Retry with a working loader switches the language
    localeLoaders.hi = { catalogue: async () => hi as unknown as Record<string, unknown> };
    await act(async () => {
      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    });
    await waitFor(() => expect(i18n.language).toBe("hi"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("timeout (fake timers) leaves the UI on the current language with a Retry", async () => {
    vi.useFakeTimers();
    try {
      localeLoaders.hi = { catalogue: () => new Promise(() => {}) }; // never settles
      renderSettings();
      await act(async () => {
        fireEvent.click(radio(/हिन्दी/));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8100);
      });
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/taking too long/);
      expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
      expect(i18n.language).toBe("en");
    } finally {
      vi.useRealTimers();
    }
  });

  it("double-tap on a loading row is ignored (one download, still loading)", async () => {
    const d = deferredLoader();
    localeLoaders.hi = d.loader;
    renderSettings();
    const hiRow = radio(/हिन्दी/);
    await act(async () => {
      fireEvent.click(hiRow);
      fireEvent.click(hiRow);
      fireEvent.click(hiRow);
    });
    expect(d.catalogue).toHaveBeenCalledTimes(1);
    expect(hiRow).toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      d.resolve();
    });
    await waitFor(() => expect(i18n.language).toBe("hi"));
  });

  it("last click wins when the user switches quickly", async () => {
    const slowHi = deferredLoader();
    const fastPseudo = deferredLoader();
    localeLoaders.hi = slowHi.loader;
    localeLoaders["en-XA"] = fastPseudo.loader;
    renderSettings();

    await act(async () => {
      fireEvent.click(radio(/हिन्दी/));
    });
    await act(async () => {
      fireEvent.click(radio(/Pseudo/));
    });
    // only the latest target shows a loader
    expect(radio(/हिन्दी/)).not.toHaveAttribute("aria-busy");
    expect(radio(/Pseudo/)).toHaveAttribute("aria-busy", "true");

    // the EARLIER request finishes first: it must not be applied
    await act(async () => {
      slowHi.resolve();
    });
    expect(i18n.language).toBe("en");
    expect(isLocaleLoaded("hi")).toBe(true); // cached for later, just not applied

    await act(async () => {
      fastPseudo.resolve();
    });
    await waitFor(() => expect(i18n.language).toBe("en-XA"));
    expect(getLanguageState().active).toBe("en-XA");
  });

  it("choosing the active language cancels a pending switch", async () => {
    const d = deferredLoader();
    localeLoaders.hi = d.loader;
    renderSettings();
    await act(async () => {
      fireEvent.click(radio(/हिन्दी/));
    });
    await act(async () => {
      fireEvent.click(radio(/English/));
    });
    expect(radio(/हिन्दी/)).not.toHaveAttribute("aria-busy");
    await act(async () => {
      d.resolve();
    });
    expect(i18n.language).toBe("en");
  });

  it("hover prefetches, so the click that follows switches with no spinner", async () => {
    const d = deferredLoader();
    localeLoaders.hi = d.loader;
    renderSettings();
    const hiRow = radio(/हिन्दी/);
    fireEvent.mouseEnter(hiRow);
    expect(d.catalogue).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve();
    });
    await waitFor(() => expect(isLocaleLoaded("hi")).toBe(true));
    await act(async () => {
      fireEvent.click(hiRow);
    });
    expect(i18n.language).toBe("hi"); // instant: no loading state in between
    expect(d.catalogue).toHaveBeenCalledTimes(1);
  });

  it("is keyboard operable: arrows move focus, Space selects, focus stays put", async () => {
    renderSettings();
    const en = radio(/English/);
    act(() => en.focus());
    expect(en).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(en, { key: "ArrowDown" });
    expect(document.activeElement).toBe(radio(/हिन्दी/));
    // roving tabindex: only one radio is a tab stop
    const stops = screen.getAllByRole("radio").filter((r) => r.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);

    // a native button turns Space/Enter into a click
    await act(async () => {
      fireEvent.click(radio(/हिन्दी/));
    });
    await waitFor(() => expect(i18n.language).toBe("hi"));
    expect(document.activeElement).toBe(radio(/हिन्दी/));

    fireEvent.keyDown(radio(/हिन्दी/), { key: "Home" });
    expect(document.activeElement).toBe(radio(/English/));
    fireEvent.keyDown(radio(/English/), { key: "End" });
    expect(document.activeElement).toBe(screen.getAllByRole("radio").at(-1));
  });
});

describe("loader", () => {
  it("rejects with a timeout error and lets a retry start fresh", async () => {
    localeLoaders.hi = { catalogue: () => new Promise(() => {}) };
    await expect(loadLocaleWithTimeout("hi", 20)).rejects.toMatchObject({
      name: "LocaleLoadError",
      reason: "timeout",
    });
    localeLoaders.hi = { catalogue: async () => hi as unknown as Record<string, unknown> };
    await expect(loadLocaleWithTimeout("hi", 500)).resolves.toBeUndefined();
    expect(isLocaleLoaded("hi")).toBe(true);
  });

  it("a font failure counts as a load failure (no tofu boxes)", async () => {
    localeLoaders.hi = {
      catalogue: async () => hi as unknown as Record<string, unknown>,
      font: async () => {
        throw new Error("font blocked");
      },
    };
    const err = await loadLocaleWithTimeout("hi", 500).catch((e) => e);
    expect(err).toBeInstanceOf(LocaleLoadError);
    expect(isLocaleLoaded("hi")).toBe(false);
    expect(i18n.hasResourceBundle("hi", "translation")).toBe(false);
  });

  it("only the English catalogue is available until another locale is loaded", () => {
    expect(isLocaleLoaded("en")).toBe(true);
    expect(isLocaleLoaded("hi")).toBe(false);
    expect(i18n.hasResourceBundle("hi", "translation")).toBe(false);
  });
});
