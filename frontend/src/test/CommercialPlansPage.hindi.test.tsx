import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n";
import { CommercialPlansPage } from "../pages/CommercialPlansPage";
import { planApi, CommercialPlanItem } from "../api/plan.api";
import { moduleApi } from "../api/module.api";
import { AuthContext } from "../context/auth-context";
import { selectLanguage, resetLanguageStore } from "../i18n/language-store";
import { resetLocaleCache } from "../i18n/loader";

vi.mock("../api/plan.api", () => ({
  planApi: { getAll: vi.fn(), duplicate: vi.fn(), retire: vi.fn() },
}));
vi.mock("../api/module.api", () => ({ moduleApi: { getAll: vi.fn() } }));

const plan = (over: Partial<CommercialPlanItem>): CommercialPlanItem => ({
  id: "p1",
  plan_code: "GROW",
  name: "Growth Plan",
  version: "2.1",
  version_type: "Active",
  status: "Published",
  price: 123456.5,
  currency: "INR",
  cadence: "Monthly",
  tax_note: "Exclusive of GST",
  trial_days: 14,
  effective_date: null,
  locations_limit: 5,
  users_limit: 10,
  is_unlimited_locations: false,
  is_unlimited_users: false,
  modules: [],
  created_by: null,
  updated_by: null,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  assignments_count: 3,
  ...over,
});

const user = {
  id: "u-1",
  first_name: "Super",
  last_name: "Admin",
  email: "superadmin@example.com",
  isSuperAdmin: true,
  role_details: { id: "r-1", name: "Super Administrator", key: "super_admin" },
  permissions: [],
};

describe("a real screen switches to Hindi in place (Commercial Plans)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLocaleCache("hi");
    resetLanguageStore("en");
  });
  afterEach(async () => {
    cleanup();
    resetLocaleCache("hi");
    resetLanguageStore("en");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("translates chrome and status words, keeps API data and money formatting", async () => {
    vi.mocked(planApi.getAll).mockResolvedValue({
      message: "OK",
      plans: [
        plan({}),
        plan({ id: "p2", name: "Legacy Plan", status: "Draft", plan_code: "LEG", price: 499 }),
      ],
      total: 2,
    });
    vi.mocked(moduleApi.getAll).mockResolvedValue({ message: "OK", modules: [] });

    render(
      <AuthContext.Provider
        value={{
          user: user as never,
          token: "t",
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          logoutEverywhere: vi.fn(),
          notice: null,
        }}
      >
        <MemoryRouter>
          <CommercialPlansPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // English first
    expect(screen.getByText("SaaS Commercial Plans")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Growth Plan")).toBeInTheDocument());
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText(/₹1,23,456\.50/)).toBeInTheDocument();

    await act(async () => {
      await selectLanguage("hi");
    });

    // Chrome translated, same instance of the table
    expect(screen.getByText("SaaS कमर्शियल प्लान")).toBeInTheDocument();
    expect(screen.queryByText("SaaS Commercial Plans")).not.toBeInTheDocument();
    // Status words are codes mapped to labels
    expect(screen.getByText("प्रकाशित")).toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.getByText("ड्राफ़्ट")).toBeInTheDocument();
    // Data the admin typed is not translated; money keeps ₹, Indian grouping and Latin digits
    expect(screen.getByText("Growth Plan")).toBeInTheDocument();
    expect(screen.getByText(/₹1,23,456\.50/)).toBeInTheDocument();
    // no key names leak anywhere on the page
    expect(document.body.textContent).not.toMatch(/\b(plans|common|status|errors)\.[a-zA-Z_.]+\b/);
  });
});
