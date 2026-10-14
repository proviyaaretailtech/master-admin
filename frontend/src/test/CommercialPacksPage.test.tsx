import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommercialPacksPage } from "../pages/CommercialPacksPage";
import { packApi, CommercialPackItem } from "../api/pack.api";
import { planApi } from "../api/plan.api";
import { AuthContext } from "../context/auth-context";

vi.mock("../api/pack.api", () => ({
  packApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    retire: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../api/plan.api", () => ({
  planApi: {
    getAll: vi.fn(),
  },
}));

const mockSuperAdminUser = {
  id: "u-superadmin",
  first_name: "Super",
  last_name: "Admin",
  email: "superadmin@proviyaa.com",
  isSuperAdmin: true,
  role_details: {
    id: "r-superadmin",
    name: "Super Administrator",
    key: "super_admin",
  },
  permissions: [],
};

const mockReadOnlyUser = {
  id: "u-readonly",
  first_name: "Auditor",
  last_name: "Viewer",
  email: "auditor@proviyaa.com",
  isSuperAdmin: false,
  role_details: {
    id: "r-auditor",
    name: "Auditor",
    key: "auditor",
  },
  permissions: [
    {
      id: "feat_commercial_packs",
      name: "Commercial Feature Packs",
      category: "commercial",
      accessLevel: "read_only" as const,
      actions: [
        {
          key: "view_packs",
          name: "View Feature Packs",
          description: "View packs list and details",
          enabled: true,
        },
        {
          key: "create_pack",
          name: "Create Feature Pack",
          description: "Create new commercial feature packs",
          enabled: false,
        },
        {
          key: "edit_pack",
          name: "Edit Feature Pack",
          description: "Edit existing feature pack attributes",
          enabled: false,
        },
        {
          key: "publish_pack",
          name: "Publish Feature Pack",
          description: "Publish draft feature packs to active catalog",
          enabled: false,
        },
        {
          key: "retire_pack",
          name: "Retire Feature Pack",
          description: "Retire active packs from future assignments",
          enabled: false,
        },
      ],
    },
  ],
};

const mockPacks: CommercialPackItem[] = [
  {
    id: "pk-1",
    name: "Custom SQL Reporting Pack",
    pack_code: "pk-custom-sql",
    description: "Allows custom SQL queries",
    price: 1499,
    currency: "INR",
    cadence: "Monthly",
    status: "Published",
    compatible_plans: ["Growth Plan", "Enterprise Plan"],
    required_modules: [],
    included_feature_title: "Custom SQL Builder",
    included_feature_subtitle: "Execute raw read-only analytics queries",
    prerequisite_note: "Requires intelligence module",
    extended_limits: "100 Queries/day",
    effective_date: "2026-03-01T00:00:00Z",
    assigned_count: 12,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
  },
  {
    id: "pk-2",
    name: "Multi-Location Inventory Sync",
    pack_code: "pk-multi-loc",
    description: "Sync across multiple locations",
    price: 2999,
    currency: "INR",
    cadence: "Monthly",
    status: "Draft",
    compatible_plans: [],
    required_modules: [],
    included_feature_title: "Multi-warehouse sync",
    included_feature_subtitle: "Real-time sync across warehouses",
    prerequisite_note: "",
    extended_limits: "",
    effective_date: null,
    assigned_count: 0,
    created_at: "2026-03-02T00:00:00Z",
    updated_at: "2026-03-02T00:00:00Z",
  },
];

const renderComponent = (user: any = mockSuperAdminUser) => {
  return render(
    <AuthContext.Provider
      value={{
        user: user as any,
        token: "fake-jwt",
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        logoutEverywhere: vi.fn(),
        notice: null,
      }}
    >
      <MemoryRouter>
        <CommercialPacksPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe("CommercialPacksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state with zero static data when no packs exist", async () => {
    vi.mocked(packApi.getAll).mockResolvedValueOnce({
      message: "OK",
      packs: [],
      total: 0,
    });
    vi.mocked(planApi.getAll).mockResolvedValueOnce({
      message: "OK",
      plans: [],
      total: 0,
    });

    renderComponent(mockSuperAdminUser);

    expect(screen.getByText("Commercial Feature Packs")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No Commercial Feature Packs Found")).toBeInTheDocument();
      expect(screen.getByText(/Zero static data is loaded/i)).toBeInTheDocument();
    });

    // Make sure table headers are not rendered in empty state
    expect(screen.queryByText("Pack Name")).not.toBeInTheDocument();
  });

  it("renders packs table with dynamic pack data and assigned organization counts", async () => {
    vi.mocked(packApi.getAll).mockResolvedValueOnce({
      message: "OK",
      packs: mockPacks,
      total: 2,
    });
    vi.mocked(planApi.getAll).mockResolvedValueOnce({
      message: "OK",
      plans: [],
      total: 0,
    });

    renderComponent(mockSuperAdminUser);

    await waitFor(() => {
      expect(screen.getByText("Custom SQL Reporting Pack")).toBeInTheDocument();
      expect(screen.getByText("Pack ID: pk-custom-sql")).toBeInTheDocument();
      expect(screen.getByText("Growth Plan, Enterprise Plan")).toBeInTheDocument();
      expect(screen.getByText("Published")).toBeInTheDocument();
      expect(screen.getByText("Custom SQL Builder")).toBeInTheDocument();
      expect(screen.getByText("12 Orgs")).toBeInTheDocument();

      // Second pack (Draft)
      expect(screen.getByText("Multi-Location Inventory Sync")).toBeInTheDocument();
      expect(screen.getByText("Pack ID: pk-multi-loc")).toBeInTheDocument();
      expect(screen.getByText("All Commercial Plans")).toBeInTheDocument();
      expect(screen.getByText("Draft")).toBeInTheDocument();
      expect(screen.getByText("0 Orgs")).toBeInTheDocument();
    });
  });

  it("allows super admin to see all mutation actions (create, edit, publish, retire)", async () => {
    vi.mocked(packApi.getAll).mockResolvedValueOnce({
      message: "OK",
      packs: mockPacks,
      total: 2,
    });
    vi.mocked(planApi.getAll).mockResolvedValueOnce({
      message: "OK",
      plans: [],
      total: 0,
    });

    renderComponent(mockSuperAdminUser);

    await waitFor(() => {
      // Header Create button
      expect(screen.getByRole("button", { name: /Create Feature Pack/i })).toBeInTheDocument();
      // Row actions
      expect(screen.getByText("Edit Pack")).toBeInTheDocument();
      expect(screen.getByText("Retire")).toBeInTheDocument();
      expect(screen.getByText("Edit Draft")).toBeInTheDocument();
      expect(screen.getByText("Publish")).toBeInTheDocument();
    });
  });

  it("hides create, edit, retire and publish actions for read-only user without permissions", async () => {
    vi.mocked(packApi.getAll).mockResolvedValueOnce({
      message: "OK",
      packs: mockPacks,
      total: 2,
    });
    vi.mocked(planApi.getAll).mockResolvedValueOnce({
      message: "OK",
      plans: [],
      total: 0,
    });

    renderComponent(mockReadOnlyUser);

    await waitFor(() => {
      expect(screen.getByText("Custom SQL Reporting Pack")).toBeInTheDocument();
    });

    // Should NOT see Create button in header
    expect(screen.queryByRole("button", { name: /Create Feature Pack/i })).not.toBeInTheDocument();
    // Should NOT see Edit Pack, Retire, Edit Draft, Publish
    expect(screen.queryByText("Edit Pack")).not.toBeInTheDocument();
    expect(screen.queryByText("Retire")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit Draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish")).not.toBeInTheDocument();
  });

  it("calls publish API when superadmin clicks Publish", async () => {
    vi.mocked(packApi.getAll).mockResolvedValue({
      message: "OK",
      packs: mockPacks,
      total: 2,
    });
    vi.mocked(planApi.getAll).mockResolvedValue({
      message: "OK",
      plans: [],
      total: 0,
    });
    vi.mocked(packApi.publish).mockResolvedValueOnce({
      message: "Published",
      pack: { ...mockPacks[1], status: "Published" },
    });

    renderComponent(mockSuperAdminUser);

    await waitFor(() => {
      expect(screen.getByText("Publish")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Publish"));

    await waitFor(() => {
      expect(packApi.publish).toHaveBeenCalledWith("pk-2");
    });
  });

  it("opens confirmation modal and calls retire API when superadmin confirms retirement", async () => {
    vi.mocked(packApi.getAll).mockResolvedValue({
      message: "OK",
      packs: mockPacks,
      total: 2,
    });
    vi.mocked(planApi.getAll).mockResolvedValue({
      message: "OK",
      plans: [],
      total: 0,
    });
    vi.mocked(packApi.retire).mockResolvedValueOnce({
      message: "Retired",
      pack: { ...mockPacks[0], status: "Retired" },
    });

    renderComponent(mockSuperAdminUser);

    await waitFor(() => {
      expect(screen.getByText("Retire")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Retire"));

    await waitFor(() => {
      expect(screen.getByText("Retire Feature Pack")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirm & Retire Pack/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirm & Retire Pack/i }));

    await waitFor(() => {
      expect(packApi.retire).toHaveBeenCalledWith("pk-1");
    });
  });

  it("filters packs when compatibility filter is selected", async () => {
    vi.mocked(packApi.getAll).mockResolvedValue({
      message: "OK",
      packs: [mockPacks[0]],
      total: 1,
    });
    vi.mocked(planApi.getAll).mockResolvedValue({
      message: "OK",
      plans: [
        {
          id: "pl-1",
          name: "Growth Plan",
          plan_code: "growth",
          version: "v1.0",
          version_type: "Active",
          status: "Published",
          price: 999,
          currency: "INR",
          cadence: "Monthly",
          tax_note: "Exclusive of GST",
          trial_days: 14,
          effective_date: "2026-01-01",
          locations_limit: 10,
          users_limit: 50,
          is_unlimited_locations: false,
          is_unlimited_users: false,
          modules: [],
          created_by: null,
          updated_by: null,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          assignments_count: 5,
        },
      ],
      total: 1,
    });

    renderComponent(mockSuperAdminUser);

    await waitFor(() => {
      expect(screen.getByText("Filters")).toBeInTheDocument();
    });

    // Open filter dropdown
    fireEvent.click(screen.getByText("Filters"));

    await waitFor(() => {
      expect(screen.getByText("Growth Plan")).toBeInTheDocument();
    });

    // Click Growth Plan
    fireEvent.click(screen.getByText("Growth Plan"));

    await waitFor(() => {
      expect(packApi.getAll).toHaveBeenCalledWith({
        compatibility: "Growth Plan",
      });
    });
  });
});
