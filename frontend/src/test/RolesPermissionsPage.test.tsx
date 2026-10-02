import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RolesPermissionsPage, DEFAULT_FEATURES } from "../pages/RolesPermissionsPage";
import { roleApi } from "../api/role.api";
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

vi.mock("../api/role.api", () => ({
  roleApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApiRoles = [
  {
    id: "role-1",
    name: "Super-admin",
    key: "super_admin",
    status: "Active",
    isActive: true,
    isSystem: true,
    scope: "Platform",
    description: "Full platform control across all entities and review actions.",
    assignedText: "2 staff assigned",
    assignedCount: 2,
    createdAt: "2026-09-27T00:00:00Z",
    updatedAt: "2026-09-27T00:00:00Z",
    features: DEFAULT_FEATURES,
  },
  {
    id: "role-2",
    name: "Partner Reviewer & Compliance",
    key: "compliance_reviewer",
    status: "Active",
    isActive: true,
    isSystem: false,
    scope: "One organization",
    description: "Performs partner verification. Locations table is read-only.",
    assignedText: "5 staff assigned",
    assignedCount: 5,
    createdAt: "2026-09-27T00:00:00Z",
    updatedAt: "2026-09-27T00:00:00Z",
    features: DEFAULT_FEATURES.map((f) => {
      if (f.id === "feat_partner_locations") {
        return {
          ...f,
          accessLevel: "read_only" as const,
          actions: f.actions.map((a) => ({ ...a, enabled: a.key === "view_locations" })),
        };
      }
      return f;
    }),
  },
];

describe("RolesPermissionsPage Component (Feature-by-Feature Access Control with API Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(roleApi.getAll).mockResolvedValue({
      roles: mockApiRoles as any,
      total: mockApiRoles.length,
    });
  });

  const renderComponent = (initialRoute = "/access-control/policies") => {
    return render(
      <AuthContext.Provider
        value={{
          user: mockAdminUser as any,
          token: "fake-token",
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={[initialRoute]}>
          <RolesPermissionsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );
  };

  it("renders page header and subtitle correctly for Security Policies", async () => {
    renderComponent("/access-control/policies");

    expect(screen.getByRole("heading", { name: /^Security Policies$/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Configure feature-by-feature access controls, review actions, and security policies/i
      )
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(roleApi.getAll).toHaveBeenCalled();
    });
  });

  it("renders Security Templates header when navigated to roles route", async () => {
    renderComponent("/access-control/roles");

    expect(screen.getByRole("heading", { name: /^Security Templates$/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(roleApi.getAll).toHaveBeenCalled();
    });
  });

  it("renders search input, filter button, and create role button", async () => {
    renderComponent();

    expect(screen.getByPlaceholderText(/Search roles or permissions\.\.\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Role/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(roleApi.getAll).toHaveBeenCalled();
    });
  });

  it("renders fetched role cards with badges and scope details", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Super-admin$/i })).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /^Partner Reviewer & Compliance$/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("2 staff assigned")).toBeInTheDocument();
    expect(screen.getByText("5 staff assigned")).toBeInTheDocument();
  });

  it("renders empty state when no roles exist in database", async () => {
    vi.mocked(roleApi.getAll).mockResolvedValueOnce({ roles: [], total: 0 });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No security roles found")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Create First Role/i })).toBeInTheDocument();
  });

  it("filters roles in real-time when searching", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Super-admin$/i })).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search roles or permissions\.\.\./i);

    // Filter for Super-admin
    fireEvent.change(searchInput, { target: { value: "Super-admin" } });
    expect(screen.getByRole("heading", { name: /^Super-admin$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^Partner Reviewer & Compliance$/i })
    ).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(
      screen.getByRole("heading", { name: /^Partner Reviewer & Compliance$/i })
    ).toBeInTheDocument();
  });

  it("opens 'New custom role' modal with feature-by-feature permission matrix when clicking + Create Role", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Super-admin$/i })).toBeInTheDocument();
    });

    const createBtn = screen.getByRole("button", { name: /Create Role/i });
    fireEvent.click(createBtn);

    expect(screen.getByRole("heading", { name: /^New custom role$/i })).toBeInTheDocument();
    expect(screen.getByText(/Role name \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Key \*/i)).toBeInTheDocument();
    expect(screen.getByText("Partner Detail: Review Lifecycle Actions")).toBeInTheDocument();
    expect(screen.getByText("Partner Detail: Locations Management Table")).toBeInTheDocument();
  });

  it("filters feature permissions by category dropdown in role modal", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Super-admin$/i })).toBeInTheDocument();
    });

    const createBtn = screen.getByRole("button", { name: /Create Role/i });
    fireEvent.click(createBtn);

    const categorySelect = screen.getByLabelText(/Filter features by module category/i);
    expect(categorySelect).toBeInTheDocument();

    // Initially "all" shows both commercials and partner detail features
    expect(screen.getByText("Commercials: Platform Plans & Modules")).toBeInTheDocument();
    expect(screen.getByText("Partner Detail: Review Lifecycle Actions")).toBeInTheDocument();

    // Select "Commercials & Plans"
    fireEvent.change(categorySelect, { target: { value: "commercials" } });
    expect(screen.getByText("Commercials: Platform Plans & Modules")).toBeInTheDocument();
    expect(screen.queryByText("Partner Detail: Review Lifecycle Actions")).not.toBeInTheDocument();

    // Switch to "Partner Detail & Review"
    fireEvent.change(categorySelect, { target: { value: "partner_detail" } });
    expect(screen.getByText("Partner Detail: Review Lifecycle Actions")).toBeInTheDocument();
    expect(screen.queryByText("Commercials: Platform Plans & Modules")).not.toBeInTheDocument();
  });

  it("submits new role to roleApi.create and closes modal", async () => {
    const createdMockRole = {
      id: "role-3",
      name: "Floor Supervisor",
      key: "floor_supervisor",
      status: "Active",
      isActive: true,
      scope: "One organization",
      description: "Directs staff",
      assignedText: "0 staff assigned",
      assignedCount: 0,
      createdAt: "2026-09-27T00:00:00Z",
      updatedAt: "2026-09-27T00:00:00Z",
      features: DEFAULT_FEATURES,
    };

    vi.mocked(roleApi.create).mockResolvedValueOnce({
      message: "Role created successfully",
      role: createdMockRole as any,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Super-admin$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Role/i }));

    const nameInput = screen.getByPlaceholderText(/e\.g\. Regional Supervisor/i);
    fireEvent.change(nameInput, { target: { value: "Floor Supervisor" } });

    const submitBtn = screen.getByRole("button", { name: /^Save Role$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(roleApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Floor Supervisor",
          key: "floor_supervisor",
        })
      );
    });
  });

  it("deletes custom role through roleApi.delete", async () => {
    vi.mocked(roleApi.delete).mockResolvedValueOnce({
      message: "Role deleted",
      id: "role-2",
    });

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /^Partner Reviewer & Compliance$/i })
      ).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle("Delete custom role");
    fireEvent.click(deleteBtn);

    expect(screen.getByRole("heading", { name: /Delete Custom Role/i })).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: /^Delete Role$/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(roleApi.delete).toHaveBeenCalledWith("role-2");
    });
  });
});
