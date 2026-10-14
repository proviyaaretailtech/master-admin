import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommercialPlansPage } from "../pages/CommercialPlansPage";
import { planApi, CommercialPlanItem } from "../api/plan.api";
import { moduleApi } from "../api/module.api";
import { AuthContext } from "../context/auth-context";

// Mock the APIs
vi.mock("../api/plan.api", () => ({
  planApi: {
    getAll: vi.fn(),
    duplicate: vi.fn(),
    retire: vi.fn(),
  },
}));

vi.mock("../api/module.api", () => ({
  moduleApi: {
    getAll: vi.fn(),
  },
}));

const mockUser = {
  id: "u-1",
  first_name: "Super",
  last_name: "Admin",
  email: "superadmin@onlatur.com",
  isSuperAdmin: true,
  role_details: {
    id: "r-1",
    name: "Super Administrator",
    key: "super_admin",
  },
  permissions: [],
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <AuthContext.Provider
      value={{
        user: mockUser as any,
        token: "fake-token",
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        logoutEverywhere: vi.fn(),
        notice: null,
      }}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
};

describe("CommercialPlansPage Component (Zero-Static-Data & RBAC Enforced)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state with zero static data when no plans exist in DB", async () => {
    vi.mocked(planApi.getAll).mockResolvedValueOnce({ message: "OK", plans: [], total: 0 });
    vi.mocked(moduleApi.getAll).mockResolvedValueOnce({ message: "OK", modules: [] });

    renderWithProviders(<CommercialPlansPage />);

    expect(screen.getByText("SaaS Commercial Plans")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No commercial plans found")).toBeInTheDocument();
      expect(
        screen.getByText("No SaaS commercial plans have been created yet.")
      ).toBeInTheDocument();
    });

    // Verify static benchmarks and fake cards are NOT rendered
    expect(screen.queryByText("Growth Plan v2.1")).not.toBeInTheDocument();
    expect(screen.queryByText("M3-02")).not.toBeInTheDocument();
    expect(screen.queryByText("142 Active Organizations")).not.toBeInTheDocument();

    // Verify "Create Module" button is NOT present on plans page (Point 3)
    expect(screen.queryByRole("button", { name: /\+ Create Module/i })).not.toBeInTheDocument();
  });

  it("displays prominent warning alert linking to platform modules when no modules exist in DB", async () => {
    vi.mocked(planApi.getAll).mockResolvedValueOnce({ message: "OK", plans: [], total: 0 });
    vi.mocked(moduleApi.getAll).mockResolvedValueOnce({ message: "OK", modules: [] });

    renderWithProviders(<CommercialPlansPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Platform Modules Required Before Creating Plans")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /No platform modules currently exist in the database. Please create platform modules first/i
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/View Platform Modules/i)).toBeInTheDocument();
    });
  });

  it("renders commercial plans table with explicit module keys (no 'ALL')", async () => {
    const mockPlans: CommercialPlanItem[] = [
      {
        id: "plan-1",
        plan_code: "enterprise_annual",
        name: "Enterprise Annual Plan",
        version: "v1.0",
        version_type: "Active",
        status: "Published",
        price: 9999,
        currency: "INR",
        cadence: "Annual",
        tax_note: "+18% GST Applicable",
        trial_days: 14,
        effective_date: "2026-03-01",
        locations_limit: 10,
        users_limit: 50,
        is_unlimited_locations: false,
        is_unlimited_users: false,
        modules: ["MODORG", "MODACC"],
        created_by: null,
        updated_by: null,
        assignments_count: 5,
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
      },
    ];

    vi.mocked(planApi.getAll).mockResolvedValueOnce({ message: "OK", plans: mockPlans, total: 1 });
    vi.mocked(moduleApi.getAll).mockResolvedValueOnce({
      message: "OK",
      modules: [
        {
          id: "m-1",
          key: "MODORG",
          name: "Org",
          category: "Core",
          description: "",
          is_active: true,
          created_at: "",
          updated_at: "",
        },
      ],
    });

    renderWithProviders(<CommercialPlansPage />);

    await waitFor(() => {
      expect(screen.getByText("Enterprise Annual Plan")).toBeInTheDocument();
      expect(screen.getByText("Org, MODACC")).toBeInTheDocument();
      expect(screen.getByText("2 Core Modules")).toBeInTheDocument();
      expect(screen.getByText("5 Active Orgs")).toBeInTheDocument();
    });

    // Warning alert should NOT be shown when modules exist
    expect(
      screen.queryByText("Platform Modules Required Before Creating Plans")
    ).not.toBeInTheDocument();
  });

  it("prevents creating plans without platform modules and shows toast notice", async () => {
    vi.mocked(planApi.getAll).mockResolvedValueOnce({ message: "OK", plans: [], total: 0 });
    vi.mocked(moduleApi.getAll).mockResolvedValueOnce({ message: "OK", modules: [] });

    renderWithProviders(<CommercialPlansPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Platform Modules Required Before Creating Plans")
      ).toBeInTheDocument();
    });

    // Click "Create First Plan"
    const createPlanBtn = screen.getByRole("button", { name: /Create First Plan/i });
    fireEvent.click(createPlanBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Please create platform modules first before creating a commercial plan.")
      ).toBeInTheDocument();
    });
  });

  it("opens confirmation modal and calls planApi.retire when user confirms plan retirement", async () => {
    const mockPlans: CommercialPlanItem[] = [
      {
        id: "pl-retire-1",
        plan_code: "starter",
        name: "Starter Monthly Plan",
        version: "v1.0",
        version_type: "Active",
        status: "Published",
        price: 499,
        currency: "INR",
        cadence: "Monthly",
        tax_note: "Exclusive of GST",
        trial_days: 7,
        effective_date: "2026-01-01",
        locations_limit: 1,
        users_limit: 5,
        is_unlimited_locations: false,
        is_unlimited_users: false,
        modules: ["MODORG"],
        created_by: null,
        updated_by: null,
        assignments_count: 3,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    vi.mocked(planApi.getAll).mockResolvedValue({ message: "OK", plans: mockPlans, total: 1 });
    vi.mocked(moduleApi.getAll).mockResolvedValue({
      message: "OK",
      modules: [
        {
          id: "m-1",
          key: "MODORG",
          name: "Organization Management",
          category: "Core",
          description: "",
          is_active: true,
          created_at: "",
          updated_at: "",
        },
      ],
    });
    vi.mocked(planApi.retire).mockResolvedValueOnce({
      message: "Retired",
      plan: { ...mockPlans[0], status: "Retired" },
    });

    renderWithProviders(<CommercialPlansPage />);

    await waitFor(() => {
      expect(screen.getByText("Starter Monthly Plan")).toBeInTheDocument();
      expect(screen.getByText("Retire")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Retire"));

    await waitFor(() => {
      expect(screen.getByText("Retire Commercial Plan")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirm & Retire Plan/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirm & Retire Plan/i }));

    await waitFor(() => {
      expect(planApi.retire).toHaveBeenCalledWith("pl-retire-1");
    });
  });
});
