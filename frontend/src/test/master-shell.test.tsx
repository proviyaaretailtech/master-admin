import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { MasterShell } from "../components/master/MasterShell";
import { shellApi } from "../api/shell.api";
import { limitedUser, renderPage } from "./master-helpers";

vi.mock("../api/shell.api", async (orig) => {
  const actual = await orig<typeof import("../api/shell.api")>();
  return {
    ...actual,
    shellApi: {
      getContext: vi.fn(),
      getSystemStatus: vi.fn(),
      search: vi.fn(),
      orgLocations: vi.fn(),
    },
  };
});

const ctx = {
  user: { id: "u1", name: "Super Admin", email: "super@example.com" },
  environment: "staging" as const,
  organizations: [
    { id: "o1", name: "Alpha Foods" },
    { id: "o2", name: "Beta Kitchens" },
  ],
  locations: [
    { id: "l1", organization_id: "o1", name: "Alpha Central" },
    { id: "l2", organization_id: "o2", name: "Beta Main" },
  ],
};
const status = {
  db: { status: "ok" as const },
  queue: { status: "degraded" as const, backlog: 12 },
  sync: { status: "ok" as const },
  pending_approvals: 3,
  open_exceptions: 2,
};

const shell = (user?: unknown) =>
  renderPage(
    <Routes>
      <Route element={<MasterShell />}>
        <Route path="*" element={<div>page body</div>} />
      </Route>
    </Routes>,
    { route: "/dashboard", user }
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(shellApi.getContext).mockResolvedValue(ctx);
  vi.mocked(shellApi.getSystemStatus).mockResolvedValue(status);
  vi.mocked(shellApi.orgLocations).mockImplementation(async (id: string) =>
    ctx.locations.filter((l) => l.organization_id === id)
  );
  vi.mocked(shellApi.search).mockResolvedValue({
    organizations: [{ id: "o1", label: "Alpha Foods", sublabel: "Latur" }],
    orders: [{ id: "ord1", label: "#1001", status: "paid" }],
  });
});

describe("MasterShell / Topbar", () => {
  it("shows environment badge, health pill and the notifications count from /system/status", async () => {
    shell();
    expect(await screen.findByTestId("env-badge")).toHaveTextContent("Staging");
    await waitFor(() => expect(screen.getByTestId("bell-count")).toHaveTextContent("5"));
    expect(screen.getByTestId("health-dot")).toHaveAttribute("data-state", "degraded");
    expect(shellApi.getContext).toHaveBeenCalledTimes(1);
    expect(shellApi.getSystemStatus).toHaveBeenCalled();
  });

  it("scopes the location switcher to the selected organization", async () => {
    shell();
    const org = (await screen.findByLabelText("Organization")) as HTMLSelectElement;
    const loc = screen.getByLabelText("Location") as HTMLSelectElement;
    expect(loc).toBeDisabled();
    await waitFor(() => expect(within(org).getByText("Alpha Foods")).toBeInTheDocument());
    fireEvent.change(org, { target: { value: "o1" } });
    await waitFor(() => expect(within(loc).getByText("Alpha Central")).toBeInTheDocument());
    expect(loc).not.toBeDisabled();
    expect(within(loc).queryByText("Beta Main")).not.toBeInTheDocument();
    expect(localStorage.getItem("master-admin.scope.org")).toBe("o1");
  });

  it("opens global search with '/', searches, groups results and navigates on Enter", async () => {
    shell();
    await screen.findByTestId("env-badge");
    fireEvent.keyDown(document, { key: "/" });
    const box = await screen.findByRole("combobox", { name: "Search" });
    fireEvent.change(box, { target: { value: "alp" } });
    await waitFor(() => expect(shellApi.search).toHaveBeenCalledWith("alp"));
    const group = await screen.findByRole("group", { name: "Organizations" });
    expect(within(group).getByText("Alpha Foods")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Orders" })).toBeInTheDocument();
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/organizations/o1/360")
    );
    expect(JSON.parse(localStorage.getItem("master-admin.search.recent") || "[]")).toEqual(["alp"]);
  });

  it("opens search with Ctrl+K and lists recent searches", async () => {
    localStorage.setItem("master-admin.search.recent", JSON.stringify(["last one"]));
    shell();
    await screen.findByTestId("env-badge");
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(await screen.findByText("last one")).toBeInTheDocument();
  });

  it("builds the sidebar from the permission model", async () => {
    shell(limitedUser([{ id: "feat_riders", actions: ["view_riders"] }]));
    await screen.findByTestId("env-badge");
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Riders" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Orders" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Dispatch board" })).not.toBeInTheDocument();
  });

  it("shows the contextual health detail and profile menu with logout", async () => {
    shell();
    await screen.findByTestId("env-badge");
    fireEvent.click(screen.getByRole("button", { name: "System health" }));
    expect(await screen.findByText(/Queue/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));
    expect(screen.getByRole("link", { name: /Language/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });
});
