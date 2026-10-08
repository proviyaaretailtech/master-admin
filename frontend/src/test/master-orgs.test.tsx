import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { OrganizationsPage } from "../pages/master/OrganizationsPage";
import { Organization360OpsPage } from "../pages/master/Organization360OpsPage";
import { ChangePlanPage } from "../pages/master/ChangePlanPage";
import { InvitationsPage } from "../pages/master/InvitationsPage";
import { organizationApi } from "../api/organization.api";
import { organizationOpsApi, invitationApi } from "../api/organization-ops.api";
import { planApi } from "../api/plan.api";
import { roleApi } from "../api/role.api";
import { apiErr, page, renderPage } from "./master-helpers";

vi.mock("../api/organization.api", () => ({ organizationApi: { getAll: vi.fn() } }));
vi.mock("../api/plan.api", () => ({ planApi: { getAll: vi.fn() } }));
vi.mock("../api/role.api", () => ({ roleApi: { getAll: vi.fn() } }));
vi.mock("../api/organization-ops.api", () => ({
  organizationOpsApi: {
    create: vi.fn(),
    setOrdering: vi.fn(),
    suspend: vi.fn(),
    reactivate: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    get360: vi.fn(),
    changePlan: vi.fn(),
    getEntitlements: vi.fn(),
  },
  invitationApi: { list: vi.fn(), create: vi.fn(), revoke: vi.fn(), resend: vi.fn() },
}));

const org = {
  id: "o1",
  business_name: "Alpha Foods",
  domain: "Restaurant",
  status: "Active",
  email: "a@x.com",
  phone_number: "1",
  created_at: "2026-09-16T00:00:00Z",
  updated_at: "",
};
const plans = {
  message: "",
  total: 1,
  plans: [{ id: "p1", plan_code: "GROWTH", name: "Growth", price: 999 }],
};
const o360 = {
  id: "o1",
  business_name: "Alpha Foods",
  status: "Active",
  domain: "Restaurant",
  email: "a@x.com",
  phone_number: "1",
  created_at: "2026-09-16T00:00:00Z",
  archived_at: null,
  ordering: { accepting: true },
  plan: { code: "GROWTH", name: "Growth", status: "active" },
  members: [{ id: "m1", name: "Asha", email: "asha@x.com", role: "owner", status: "active" }],
  locations: [{ id: "l1", name: "Alpha Central", city: "Latur", status: "active" }],
  open_orders: 2,
  orders_30d: 10,
  gmv_30d: { amount_minor: 123456, currency: "INR" },
  recent_orders: [
    { id: "ord1", number: "1001", status: "paid", created_at: "2026-10-01T00:00:00Z" },
  ],
  audit: [{ id: "a1", action: "org.suspend", actor: "root", created_at: "2026-10-01T00:00:00Z" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(planApi.getAll).mockResolvedValue(plans as never);
});

describe("OrganizationsPage", () => {
  const list = (organizations: unknown[]) =>
    vi.mocked(organizationApi.getAll).mockResolvedValue({
      message: "",
      organizations,
      pagination: { total: organizations.length, page: 1, limit: 20, totalPages: 1 },
    } as never);

  it("loads organizations from the endpoint and shows them", async () => {
    list([org]);
    renderPage(<OrganizationsPage />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    expect(await screen.findByText("Alpha Foods")).toBeInTheDocument();
    expect(organizationApi.getAll).toHaveBeenCalled();
  });
  it("empty / error / permission-denied states", async () => {
    list([]);
    const { unmount } = renderPage(<OrganizationsPage />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    unmount();
    vi.mocked(organizationApi.getAll).mockRejectedValue(apiErr(500, "down"));
    const r2 = renderPage(<OrganizationsPage />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(organizationApi.getAll).toHaveBeenCalledTimes(3);
    r2.unmount();
    vi.mocked(organizationApi.getAll).mockRejectedValue(apiErr(403));
    renderPage(<OrganizationsPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
  it("create wizard walks business → plan → owner → location → ordering and posts the contract payload", async () => {
    list([]);
    vi.mocked(organizationOpsApi.create).mockResolvedValue({});
    renderPage(<OrganizationsPage />);
    await screen.findByTestId("empty-state");
    fireEvent.click(screen.getAllByRole("button", { name: "Create organization" })[0]);
    const dlg = await screen.findByRole("dialog");
    const next = () => fireEvent.click(within(dlg).getByRole("button", { name: "Next" }));
    expect(within(dlg).getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText("Business name"), { target: { value: "Gamma" } });
    fireEvent.change(within(dlg).getByLabelText("Email"), { target: { value: "g@x.com" } });
    fireEvent.change(within(dlg).getByLabelText("Phone number"), { target: { value: "99999" } });
    next();
    await waitFor(() =>
      expect(within(dlg).getByRole("option", { name: "Growth (GROWTH)" })).toBeInTheDocument()
    );
    fireEvent.change(within(dlg).getByLabelText("Plan"), { target: { value: "GROWTH" } });
    next();
    fireEvent.change(within(dlg).getByLabelText("Owner email"), {
      target: { value: "owner@x.com" },
    });
    next();
    fireEvent.change(within(dlg).getByLabelText("Location 1 name"), { target: { value: "Main" } });
    next();
    fireEvent.click(within(dlg).getByRole("checkbox"));
    fireEvent.click(within(dlg).getAllByRole("button", { name: "Create organization" }).pop()!);
    await waitFor(() => expect(organizationOpsApi.create).toHaveBeenCalledTimes(1));
    expect(organizationOpsApi.create).toHaveBeenCalledWith({
      business_name: "Gamma",
      domain: "Restaurant",
      email: "g@x.com",
      phone_number: "99999",
      plan_code: "GROWTH",
      owner_email: "owner@x.com",
      locations: [{ name: "Main", city: "" }],
      ordering_open: true,
    });
    expect(await screen.findByText(/Organization created/)).toBeInTheDocument();
  });
});

describe("Organization 360", () => {
  const mount = () =>
    renderPage(
      <Routes>
        <Route path="/organizations/:id/360" element={<Organization360OpsPage />} />
      </Routes>,
      { route: "/organizations/o1/360" }
    );
  beforeEach(() => {
    vi.mocked(organizationOpsApi.get360).mockResolvedValue(o360 as never);
    vi.mocked(organizationOpsApi.getEntitlements).mockResolvedValue({
      modules: [{ key: "pos", name: "POS", enabled: true }],
    });
  });
  it("renders tabs and the overview numbers; subscription tab loads entitlements", async () => {
    mount();
    expect(await screen.findByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(organizationOpsApi.get360).toHaveBeenCalledWith("o1");
    expect(screen.getAllByRole("tab")).toHaveLength(7);
    fireEvent.click(screen.getByRole("tab", { name: "Subscription & entitlements" }));
    expect(await screen.findByText("POS")).toBeInTheDocument();
    expect(organizationOpsApi.getEntitlements).toHaveBeenCalledWith("o1");
    fireEvent.click(screen.getByRole("tab", { name: "Members" }));
    expect(screen.getByText("asha@x.com")).toBeInTheDocument();
  });
  it("tabs move with the arrow keys", async () => {
    mount();
    const first = await screen.findByRole("tab", { name: "Overview" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Members" })).toHaveAttribute("aria-selected", "true");
  });
  it("suspend needs a reason (min 3 chars) and sends it", async () => {
    vi.mocked(organizationOpsApi.suspend).mockResolvedValue({});
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Suspend" }));
    const dlg = await screen.findByRole("dialog");
    const confirm = within(dlg).getByRole("button", { name: "Suspend" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "ab" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "unpaid dues" } });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(organizationOpsApi.suspend).toHaveBeenCalledWith("o1", "unpaid dues")
    );
    expect(await screen.findByText(/recorded in the audit log/)).toBeInTheDocument();
  });
  it("a failing action keeps the dialog open and shows the error", async () => {
    vi.mocked(organizationOpsApi.archive).mockRejectedValue(
      apiErr(409, "Organization has open orders")
    );
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "closing down" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Archive" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent(/open orders/);
  });
  it("pauses ordering with a reason (PATCH accepting=false)", async () => {
    vi.mocked(organizationOpsApi.setOrdering).mockResolvedValue({});
    mount();
    fireEvent.click(await screen.findByRole("tab", { name: "Ordering" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause ordering" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "stock out" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(organizationOpsApi.setOrdering).toHaveBeenCalledWith("o1", false, "stock out")
    );
  });
  it("shows restore (not suspend) for an archived organization", async () => {
    vi.mocked(organizationOpsApi.get360).mockResolvedValue({
      ...o360,
      archived_at: "2026-10-01",
    } as never);
    mount();
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });
  it("403 shows permission denied", async () => {
    vi.mocked(organizationOpsApi.get360).mockRejectedValue(apiErr(403));
    mount();
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
});

describe("ChangePlanPage", () => {
  it("posts plan_code + reason to the subscription endpoint", async () => {
    vi.mocked(organizationOpsApi.get360).mockResolvedValue(o360 as never);
    vi.mocked(organizationOpsApi.getEntitlements).mockResolvedValue({ modules: [] });
    vi.mocked(planApi.getAll).mockResolvedValue({
      plans: [
        { id: "p1", plan_code: "GROWTH", name: "Growth", price: 1 },
        { id: "p2", plan_code: "SCALE", name: "Scale", price: 2 },
      ],
    } as never);
    vi.mocked(organizationOpsApi.changePlan).mockResolvedValue({});
    renderPage(
      <Routes>
        <Route path="/organizations/:id/change-plan" element={<ChangePlanPage />} />
      </Routes>,
      { route: "/organizations/o1/change-plan" }
    );
    const select = await screen.findByLabelText("Choose a plan");
    expect(screen.getByRole("button", { name: "Change plan" })).toBeDisabled();
    fireEvent.change(select, { target: { value: "SCALE" } });
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText(/Reason/), {
      target: { value: "upgrade request" },
    });
    fireEvent.click(within(dlg).getByRole("button", { name: "Change plan" }));
    await waitFor(() =>
      expect(organizationOpsApi.changePlan).toHaveBeenCalledWith("o1", "SCALE", "upgrade request")
    );
  });
});

describe("InvitationsPage", () => {
  const inv = {
    id: "i1",
    organization_id: "o1",
    organization_name: "Alpha Foods",
    email: "new@x.com",
    role_slug: "manager",
    status: "pending",
  };
  it("lists, resends and revokes", async () => {
    vi.mocked(invitationApi.list).mockResolvedValue(page([inv]) as never);
    vi.mocked(invitationApi.resend).mockResolvedValue({});
    vi.mocked(invitationApi.revoke).mockResolvedValue({});
    renderPage(<InvitationsPage />);
    expect(await screen.findByText("new@x.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resend invitation to new@x.com" }));
    await waitFor(() => expect(invitationApi.resend).toHaveBeenCalledWith("i1"));
    fireEvent.click(screen.getByRole("button", { name: "Revoke invitation for new@x.com" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(invitationApi.revoke).toHaveBeenCalledWith("i1"));
  });
  it("empty state, and create requires org + email + role", async () => {
    vi.mocked(invitationApi.list).mockResolvedValue(page([]) as never);
    vi.mocked(roleApi.getAll).mockResolvedValue({
      roles: [{ id: "r1", key: "manager", name: "Manager" }],
      total: 1,
    } as never);
    renderPage(<InvitationsPage />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByRole("button", { name: "Send invitation" })).toBeDisabled();
  });
});
