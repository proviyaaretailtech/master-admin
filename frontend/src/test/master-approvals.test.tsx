import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { ApprovalsPage } from "../pages/master/ApprovalsPage";
import { ApprovalLimitsPage } from "../pages/master/ApprovalLimitsPage";
import { approvalsApi } from "../api/approvals.api";
import type { Approval, ApprovalTier } from "../api/approvals.api";
import { limitedUser, page, renderPage, superUser } from "./master-helpers";
import { isStillNew } from "../components/master/ui";
import { NEW_UNTIL_LAYER_1A } from "../components/master/navConfig";

vi.mock("../api/approvals.api", async (orig) => ({
  ...(await orig<object>()),
  approvalsApi: { list: vi.fn(), get: vi.fn(), decide: vi.fn(), cancel: vi.fn(), tiers: vi.fn(), updateTier: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

const req = (over: Partial<Approval> = {}): Approval => ({
  id: "a1",
  action_type: "refund",
  subject_type: "ol_refund",
  subject_id: "R-1",
  amount_minor: 200000,
  currency_code: "INR",
  status: "pending",
  effective_status: "pending",
  reason: "Customer got a damaged order",
  approver_roles: ["finance"],
  escalation_roles: [],
  requested_by: "someone-else",
  requested_by_name: "Asha Ops",
  tier_label: "Refund ₹501 to ₹5,000: Finance",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  created_at: new Date().toISOString(),
  ...over,
});
const financeUser = limitedUser([{ id: "feat_approvals", actions: ["view_approvals", "approve_as_finance"] }]);

describe("ApprovalsPage", () => {
  it("shows what is waiting for me and my approver roles", async () => {
    vi.mocked(approvalsApi.list).mockResolvedValue({ ...page([req()]), myRoles: ["finance"] } as never);
    renderPage(<ApprovalsPage />, { user: financeUser });
    expect(await screen.findByText("Asha Ops")).toBeInTheDocument();
    expect(screen.getByText(/Your approver roles: Finance/)).toBeInTheDocument();
    expect(approvalsApi.list).toHaveBeenCalledWith("mine", 1);
  });

  it("switching tabs asks for that view", async () => {
    vi.mocked(approvalsApi.list).mockResolvedValue({ ...page([]), myRoles: [] } as never);
    renderPage(<ApprovalsPage />, { user: financeUser });
    expect(await screen.findByText("Nothing is waiting for you.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Escalated" }));
    await waitFor(() => expect(approvalsApi.list).toHaveBeenLastCalledWith("escalated", 1));
  });

  it("an approver approves from the detail drawer", async () => {
    vi.mocked(approvalsApi.list).mockResolvedValue({ ...page([req()]), myRoles: ["finance"] } as never);
    vi.mocked(approvalsApi.get).mockResolvedValue({ approval: req(), decisions: [] });
    vi.mocked(approvalsApi.decide).mockResolvedValue({});
    renderPage(<ApprovalsPage />, { user: financeUser });
    fireEvent.click(await screen.findByText("Asha Ops"));
    const drawer = await screen.findByRole("dialog", { name: "Approval request" });
    fireEvent.click(await within(drawer).findByRole("button", { name: "Approve" }));
    const confirm = await screen.findByRole("dialog", { name: "Approve" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approvalsApi.decide).toHaveBeenCalledWith("a1", "approved", ""));
    expect(await screen.findByText("Request approved.")).toBeInTheDocument();
  });

  it("rejecting needs a reason before the button works", async () => {
    vi.mocked(approvalsApi.list).mockResolvedValue({ ...page([req()]), myRoles: ["finance"] } as never);
    vi.mocked(approvalsApi.get).mockResolvedValue({ approval: req(), decisions: [] });
    renderPage(<ApprovalsPage />, { user: financeUser });
    fireEvent.click(await screen.findByText("Asha Ops"));
    const drawer = await screen.findByRole("dialog", { name: "Approval request" });
    fireEvent.click(await within(drawer).findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject" });
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("the person who asked sees a note and a Withdraw button, never Approve", async () => {
    const mine = req({ requested_by: financeUser.id });
    vi.mocked(approvalsApi.list).mockResolvedValue({ ...page([mine]), myRoles: ["finance"] } as never);
    vi.mocked(approvalsApi.get).mockResolvedValue({ approval: mine, decisions: [] });
    renderPage(<ApprovalsPage />, { user: financeUser });
    fireEvent.click(await screen.findByText("Asha Ops"));
    const drawer = await screen.findByRole("dialog", { name: "Approval request" });
    expect(await within(drawer).findByText("You asked for this, so someone else must decide it.")).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(drawer).getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
  });

  it("a request for another band shows no decision buttons", async () => {
    const controllerOnly = req({ approver_roles: ["controller"] });
    vi.mocked(approvalsApi.list).mockResolvedValue({ ...page([controllerOnly]), myRoles: ["finance"] } as never);
    vi.mocked(approvalsApi.get).mockResolvedValue({ approval: controllerOnly, decisions: [] });
    renderPage(<ApprovalsPage />, { user: financeUser });
    fireEvent.click(await screen.findByText("Asha Ops"));
    const drawer = await screen.findByRole("dialog", { name: "Approval request" });
    await within(drawer).findByText("Customer got a damaged order");
    expect(within(drawer).queryByRole("button", { name: "Approve" })).toBeNull();
  });
});

describe("New tag", () => {
  it("shows until the end of its date, then disappears by itself", () => {
    expect(isStillNew("2026-11-23", new Date("2026-11-23T20:00:00").getTime())).toBe(true);
    expect(isStillNew("2026-11-23", new Date("2026-11-24T00:00:01").getTime())).toBe(false);
    expect(isStillNew(undefined)).toBe(false);
  });

  it("marks the new Approvals page while it is new", async () => {
    vi.mocked(approvalsApi.list).mockResolvedValue({ ...page([]), myRoles: [] } as never);
    renderPage(<ApprovalsPage />, { user: financeUser });
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(isStillNew(NEW_UNTIL_LAYER_1A) ? "ApprovalsNew" : "Approvals");
  });
});

const tier = (over: Partial<ApprovalTier> = {}): ApprovalTier => ({
  id: "t1",
  action_type: "refund",
  min_minor: 50000,
  max_minor: 500000,
  requires_approval: true,
  approver_roles: ["finance"],
  backup_roles: ["controller"],
  expiry_hours: 48,
  escalate_after_minutes: 240,
  label: "Refund ₹501 to ₹5,000: Finance",
  enabled: true,
  ...over,
});

describe("ApprovalLimitsPage", () => {
  it("shows the bands in plain words, read-only for non-founders", async () => {
    vi.mocked(approvalsApi.tiers).mockResolvedValue([tier(), tier({ id: "t0", min_minor: 0, max_minor: 50000, requires_approval: false, approver_roles: [], backup_roles: [], escalate_after_minutes: null })]);
    renderPage(<ApprovalLimitsPage />, { user: financeUser });
    expect(await screen.findByText("Requester may act alone")).toBeInTheDocument();
    expect(screen.getByText("Only founders can change approval limits.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("a founder changes a band with a reason", async () => {
    vi.mocked(approvalsApi.tiers).mockResolvedValue([tier()]);
    vi.mocked(approvalsApi.updateTier).mockResolvedValue({});
    renderPage(<ApprovalLimitsPage />, { user: superUser });
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save change" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Expires after (hours, 1 to 720)"), { target: { value: "24" } });
    fireEvent.change(within(dialog).getByLabelText("Why are you changing this?"), { target: { value: "faster turnaround" } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(approvalsApi.updateTier).toHaveBeenCalledWith("t1", expect.objectContaining({ expiry_hours: 24, reason: "faster turnaround" }))
    );
    expect(await screen.findByText("Approval limit updated.")).toBeInTheDocument();
  });
});
