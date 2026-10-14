import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PartnerDetailPage } from "../pages/PartnerDetailPage";
import { organizationApi } from "../api/organization.api";
import { locationApi } from "../api/location.api";
import { AuthContext } from "../context/auth-context";

const mockAdminUser = {
  id: "u-admin",
  first_name: "Super",
  last_name: "Admin",
  email: "superadmin@onlatur.com",
  isSuperAdmin: true,
  role_details: {
    id: "r-admin",
    name: "Super Administrator",
    key: "super_admin",
  },
  permissions: [],
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <AuthContext.Provider
      value={{
        user: mockAdminUser as any,
        token: "fake-token",
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        logoutEverywhere: vi.fn(),
        notice: null,
      }}
    >
      {ui}
    </AuthContext.Provider>
  );
};

describe("PartnerDetailPage Component", () => {
  const renderComponent = () => {
    return renderWithProviders(
      <MemoryRouter>
        <PartnerDetailPage />
      </MemoryRouter>
    );
  };

  it("renders page header and partner summary correctly", () => {
    renderComponent();

    // Check main title
    expect(screen.getByRole("heading", { name: /Partner Detail/i })).toBeInTheDocument();

    // Check partner summary details
    expect(screen.getByText("Proviyaa Global")).toBeInTheDocument();
    expect(screen.getByText("PRT-2048")).toBeInTheDocument();
    expect(screen.getAllByText("Main Restaurant").length).toBeGreaterThanOrEqual(1);
  });

  it("renders onboarding progress and required steps", () => {
    renderComponent();

    expect(screen.getByText("Onboarding Progress")).toBeInTheDocument();
    expect(screen.getByText("Become Partner")).toBeInTheDocument();
    expect(screen.getByText("Review & Submit")).toBeInTheDocument();
  });

  it("renders review lifecycle action buttons with design placeholders and functional Delete Partner", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /^Approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Mark under review$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Delete Partner$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Show\/Create password$/i })
    ).not.toBeInTheDocument();
  });

  it("renders location management table with search and Add New Location button", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: /Location Management/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add New Location/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search locations or codes.../i)).toBeInTheDocument();

    // Check preloaded locations
    expect(screen.getByText("LOC - PG 001")).toBeInTheDocument();
    expect(screen.getByText("Cloud Kitchen North")).toBeInTheDocument();
  });

  it("filters locations dynamically when typing in search input", () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText(/Search locations or codes.../i);

    // Search for North
    fireEvent.change(searchInput, { target: { value: "North" } });
    expect(screen.getByText("Cloud Kitchen North")).toBeInTheDocument();
    expect(screen.queryByText("LOC - PG 001")).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("LOC - PG 001")).toBeInTheDocument();
  });

  it("opens Add New Location modal with auto-generated read-only location code", () => {
    renderComponent();

    const addButton = screen.getByRole("button", { name: /Add New Location/i });
    fireEvent.click(addButton);

    expect(screen.getByText("Create Location")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Indiranagar Flagship Outlet/i)).toBeInTheDocument();
    expect(screen.getByText("Auto-generated (Locked)")).toBeInTheDocument();

    const codeInput = screen.getByDisplayValue("LOC - PG 006");
    expect(codeInput).toBeInTheDocument();
    expect(codeInput).toHaveAttribute("readonly");
  });

  describe("API integration with route parameter org_id", () => {
    const mockOrg = {
      id: "org-1234-abcd",
      business_name: "Spice Route Kitchen",
      domain: "Restaurant",
      status: "Pending",
      email: "contact@spiceroute.com",
      phone_number: "+1 555 123 4567",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const mockLocations = [
      {
        id: "loc-999",
        org_id: "org-1234-abcd",
        name: "Downtown Flagship Hub",
        area: "MG Road, Bengaluru",
        code: "SRK-MAIN",
        type: "Restaurant",
        status: "Active",
        time_zone: "Asia/Kolkata",
        currency: "INR (₹)",
        last_sync: "Just now",
      },
    ];

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    const renderWithOrgId = (orgId = "org-1234-abcd") => {
      return renderWithProviders(
        <MemoryRouter initialEntries={[`/organizations/${orgId}`]}>
          <Routes>
            <Route path="/organizations/:org_id" element={<PartnerDetailPage />} />
          </Routes>
        </MemoryRouter>
      );
    };

    it("fetches and renders partner details and locations using org_id", async () => {
      vi.spyOn(organizationApi, "getById").mockResolvedValue({
        message: "Success",
        organization: mockOrg,
      });
      vi.spyOn(locationApi, "getByOrganization").mockResolvedValue({
        message: "Success",
        locations: mockLocations,
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      renderWithOrgId();

      await waitFor(() => {
        expect(organizationApi.getById).toHaveBeenCalledWith("org-1234-abcd");
        expect(locationApi.getByOrganization).toHaveBeenCalledWith("org-1234-abcd");
      });

      // Verify partner business name and email are rendered
      expect(await screen.findByText("Spice Route Kitchen")).toBeInTheDocument();
      expect(screen.getByText("contact@spiceroute.com")).toBeInTheDocument();
      expect(screen.getByText("+1 555 123 4567")).toBeInTheDocument();

      // Verify location is rendered
      expect(screen.getAllByText("Downtown Flagship Hub").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("SRK-MAIN")).toBeInTheDocument();
    });

    it("creates a new location via locationApi.create when submitting add form", async () => {
      vi.spyOn(organizationApi, "getById").mockResolvedValue({
        message: "Success",
        organization: mockOrg,
      });
      vi.spyOn(locationApi, "getByOrganization").mockResolvedValue({
        message: "Success",
        locations: mockLocations,
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      const createSpy = vi.spyOn(locationApi, "create").mockResolvedValue({
        message: "Location created",
        location: {
          id: "loc-new-100",
          org_id: "org-1234-abcd",
          name: "Whitefield Express",
          area: "Whitefield",
          code: "SRK-WF",
          type: "Cloud Kitchen",
          status: "Active",
          time_zone: "Asia/Kolkata",
          currency: "INR (₹)",
        },
      });

      renderWithOrgId();

      await waitFor(() => {
        expect(screen.getAllByText("Downtown Flagship Hub").length).toBeGreaterThanOrEqual(1);
      });

      // Open Add New Location modal
      fireEvent.click(screen.getByRole("button", { name: /Add New Location/i }));

      // Fill in form
      const nameInput = screen.getByPlaceholderText(/e\.g\. Indiranagar Flagship Outlet/i);
      fireEvent.change(nameInput, { target: { value: "Whitefield Express" } });

      // Click Create Location
      fireEvent.click(screen.getByRole("button", { name: /^Create Location$/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          "org-1234-abcd",
          expect.objectContaining({
            name: "Whitefield Express",
          })
        );
      });
    });

    it("deletes a location via locationApi.delete upon confirmation", async () => {
      vi.spyOn(organizationApi, "getById").mockResolvedValue({
        message: "Success",
        organization: mockOrg,
      });
      vi.spyOn(locationApi, "getByOrganization").mockResolvedValue({
        message: "Success",
        locations: mockLocations,
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      const deleteSpy = vi.spyOn(locationApi, "delete").mockResolvedValue({
        message: "Location deleted successfully",
      });

      renderWithOrgId();

      await waitFor(() => {
        expect(screen.getAllByText("Downtown Flagship Hub").length).toBeGreaterThanOrEqual(1);
      });

      // Click Delete in table row
      const deleteBtns = screen.getAllByRole("button", { name: /^Delete$/i });
      fireEvent.click(deleteBtns[0]);

      // Confirm delete in modal
      const confirmDeleteBtn = screen.getByRole("button", { name: /Delete Location/i });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith("org-1234-abcd", "loc-999");
      });
    });

    it("deletes partner via organizationApi.delete when Delete Partner is clicked and confirmed", async () => {
      vi.spyOn(organizationApi, "getById").mockResolvedValue({
        message: "Success",
        organization: mockOrg,
      });
      vi.spyOn(locationApi, "getByOrganization").mockResolvedValue({
        message: "Success",
        locations: mockLocations,
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      const deleteOrgSpy = vi.spyOn(organizationApi, "delete").mockResolvedValue({
        success: true,
        message: "Organization deleted successfully",
        deletedId: "org-1234-abcd",
      });

      renderWithOrgId();

      await waitFor(() => {
        expect(screen.getByText("Spice Route Kitchen")).toBeInTheDocument();
      });

      // Click Delete Partner button in Review Actions
      const deleteBtn = screen.getByRole("button", { name: /^Delete Partner$/i });
      fireEvent.click(deleteBtn);

      // Confirm delete in modal
      const modalDeleteBtns = screen.getAllByRole("button", { name: /^Delete Partner$/i });
      fireEvent.click(modalDeleteBtns[modalDeleteBtns.length - 1]);

      await waitFor(() => {
        expect(deleteOrgSpy).toHaveBeenCalledWith("org-1234-abcd");
      });
    });
  });
});
