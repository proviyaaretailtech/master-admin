import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthContext } from "../context/auth-context";
import { ApiError } from "../lib/api-error";

export const superUser = {
  id: "u1",
  first_name: "Super",
  last_name: "Admin",
  email: "super@example.com",
  phone_number: "1",
  isSuperAdmin: true,
  role_details: { id: "r1", name: "Super Admin", key: "super_admin" },
  permissions: [],
};

export const limitedUser = (features: Array<{ id: string; actions: string[] }>) => ({
  ...superUser,
  id: "u2",
  isSuperAdmin: false,
  role_details: { id: "r2", name: "Ops", key: "ops" },
  permissions: features.map((f) => ({
    id: f.id,
    name: f.id,
    category: "x",
    accessLevel: "read_only" as const,
    actions: f.actions.map((a) => ({ key: a, name: a, description: "", enabled: true })),
  })),
});

const LocationProbe: React.FC = () => {
  const l = useLocation();
  return <div data-testid="location">{l.pathname + l.search}</div>;
};

export function renderPage(
  ui: React.ReactElement,
  opts: { route?: string; path?: string; user?: unknown } = {}
) {
  const { route = "/", path = "*", user = superUser } = opts;
  return render(
    <AuthContext.Provider
      value={{
        user: user as never,
        token: "t",
        loading: false,
        login: async () => ({ error: null }),
        logout: async () => {},
      }}
    >
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

export const apiErr = (status: number, message = "boom", errorCode?: string) =>
  new ApiError(message, { status, errorCode });

export const page = <T,>(items: T[], extra: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...extra,
});
