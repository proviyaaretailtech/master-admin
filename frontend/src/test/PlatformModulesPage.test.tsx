import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlatformModulesPage } from "../pages/PlatformModulesPage";
import { moduleApi, PlatformModuleItem } from "../api/module.api";
import { AuthContext } from "../context/auth-context";

vi.mock("../api/module.api", () => ({
  moduleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAdminUser = {
  id: "u-admin",
  first_name: "Admin",
  last_name: "User",
  email: "admin@example.com",
  isSuperAdmin: true,
  role_details: {
    id: "r-admin",
    name: "Administrator",
    key: "admin",
  },
  permissions: [],
};

const mockReadOnlyUser = {
  id: "u-readonly",
  first_name: "Read",
  last_name: "Only",
  email: "readonly@example.com",
  isSuperAdmin: false,
  role_details: {
    id: "r-ro",
    name: "Auditor",
    key: "auditor",
  },
  permissions: [
    {
      id: "feat_commercial_plans",
      name: "Commercial Plans & Modules",
      category: "commercial",
      accessLevel: "read_only" as const,
      actions: [
        {
          key: "manage_modules",
          name: "Manage Platform Modules",
          description: "Create, edit, or delete platform modules",
          enabled: false,
        },
      ],
    },
  ],
};

const mockModules: PlatformModuleItem[] = [
  {
    id: "m-1",
    key: "MODORG",
    name: "Organization Management",
    category: "Core",
    description: "Multi-branch and partner organization architecture",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    plans_count: 2,
  },
  {
    id: "m-2",
    key: "MODACC",
    name: "Access Control & RBAC",
    category: "Security",
    description: "Granular permissions and role enforcement",
    is_active: true,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    plans_count: 1,
  },
];

const renderComponent = (user: any = mockAdminUser) => {
  return render(
    <AuthContext.Provider
      value={{
        user: user as any,
        token: "fake-jwt",
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <MemoryRouter>
        <PlatformModulesPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe("PlatformModulesPage Component (Zero-Static-Data & Granular RBAC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state without static data when no modules exist in DB", async () => {
    vi.mocked(moduleApi.getAll).mockResolvedValueOnce({ message: "OK", modules: [] });

    renderComponent(mockAdminUser);

    expect(screen.getByRole("heading", { level: 1, name: "Platform Modules" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No platform modules found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "No platform modules exist in the database. Please create platform modules first before configuring commercial plans."
        )
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Create First Module/i })).toBeInTheDocument();
  });

  it("renders modules table WITH Actions column when user has manage_modules permission", async () => {
    vi.mocked(moduleApi.getAll).mockResolvedValueOnce({ message: "OK", modules: mockModules });

    renderComponent(mockAdminUser);

    await waitFor(() => {
      expect(screen.getByText("Organization Management")).toBeInTheDocument();
      expect(screen.getByText("Access Control & RBAC")).toBeInTheDocument();
    });

    // Check headers including ACTIONS
    expect(screen.getByRole("columnheader", { name: "ACTIONS" })).toBeInTheDocument();

    // Check edit and delete action buttons are present
    expect(screen.getAllByTitle("Edit Module")).toHaveLength(2);
    expect(screen.getAllByTitle("Delete Module")).toHaveLength(2);

    // Create module button should be visible in header
    expect(screen.getByRole("button", { name: /Create Module/i })).toBeInTheDocument();
  });

  it("renders modules table WITHOUT Actions column when user lacks manage_modules permission", async () => {
    vi.mocked(moduleApi.getAll).mockResolvedValueOnce({ message: "OK", modules: mockModules });

    renderComponent(mockReadOnlyUser);

    await waitFor(() => {
      expect(screen.getByText("Organization Management")).toBeInTheDocument();
      expect(screen.getByText("Access Control & RBAC")).toBeInTheDocument();
    });

    // The ACTIONS column header must NOT be rendered
    expect(screen.queryByRole("columnheader", { name: "ACTIONS" })).not.toBeInTheDocument();
    expect(screen.queryByText("ACTIONS")).not.toBeInTheDocument();

    // Edit and Delete buttons must NOT be rendered
    expect(screen.queryByTitle("Edit Module")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete Module")).not.toBeInTheDocument();

    // Create module button must also NOT be visible in header
    expect(screen.queryByRole("button", { name: /\+ Create Module/i })).not.toBeInTheDocument();
  });
});
