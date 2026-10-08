import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { SettingsPage } from "../pages/SettingsPage";
import { isNavActive, NAV_SECTIONS } from "../components/master/navConfig";
import { limitedUser, renderPage } from "./master-helpers";

describe("Settings", () => {
  it("shows entry points the user is allowed to see, and security", () => {
    renderPage(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "Platform configuration" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Commission rules" })).toHaveAttribute(
      "href",
      "/commission-rules"
    );
    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
  });
  it("hides entry points without permission", () => {
    renderPage(<SettingsPage />, {
      user: limitedUser([{ id: "feat_commission", actions: ["view_commission"] }]),
    });
    expect(screen.getByRole("link", { name: "Commission rules" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "API & webhooks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Security" })).not.toBeInTheDocument();
  });
});

describe("nav", () => {
  const org = NAV_SECTIONS.find((s) => s.id === "organization")!.items;
  it("/organizations does not swallow /organizations/360", () => {
    const orgs = org.find((i) => i.id === "organizations")!;
    expect(isNavActive(orgs, "/organizations", org)).toBe(true);
    expect(isNavActive(orgs, "/organizations/o1/360", org)).toBe(true);
    expect(isNavActive(orgs, "/organizations/360", org)).toBe(false);
  });
});

describe("Hindi", () => {
  it("new screens render Hindi from the catalogue (no key names, no blanks)", async () => {
    const { selectLanguage } = await import("../i18n/language-store");
    await selectLanguage("hi");
    renderPage(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "प्लेटफ़ॉर्म कॉन्फ़िगरेशन" })).toBeInTheDocument();
    expect(screen.queryByText(/^settings\./)).not.toBeInTheDocument();
  });
});
