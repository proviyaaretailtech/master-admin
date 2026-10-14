import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { PartnerApplicationsPage } from "../pages/master/PartnerApplicationsPage";
import { OrderHoldsPage } from "../pages/master/OrderHoldsPage";
import { partnerApplicationApi } from "../api/partner-applications.api";
import { orderHoldApi } from "../api/order-holds.api";
import { apiErr, limitedUser, page, renderPage } from "./master-helpers";

vi.mock("../api/partner-applications.api", async (orig) => ({
  ...(await orig<object>()),
  partnerApplicationApi: { list: vi.fn(), get: vi.fn(), decide: vi.fn() },
}));
vi.mock("../api/order-holds.api", async (orig) => ({
  ...(await orig<object>()),
  orderHoldApi: { list: vi.fn(), get: vi.fn(), decide: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

const row = {
  id: "a1",
  reference: "OLP-E68EA844",
  status: "submitted",
  business_name: "Purshotam",
  partner_type: "store",
  categories: ["Grocery", "Dairy"],
  city_id: "latur",
  owner_name: "Asha",
  phone: "9800000001",
  email: "asha@example.com",
  created_at: "2026-10-11T06:16:19Z",
};
const detail = {
  ...row,
  subcategories: ["Supermarket"],
  services: ["delivery"],
  address: "Station Road",
  pin_code: "413512",
  login_match: { found: false, confirmed: false },
  history: [],
};

describe("PartnerApplicationsPage", () => {
  it("lists submitted applications first with every category, and filters by status", async () => {
    vi.mocked(partnerApplicationApi.list).mockResolvedValue({
      ...page([row]),
      counts: { submitted: 1 },
    } as never);
    renderPage(<PartnerApplicationsPage />);
    expect(await screen.findByText("Purshotam")).toBeInTheDocument();
    expect(screen.getByText("Dairy")).toBeInTheDocument();
    expect(partnerApplicationApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "submitted" })
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "rejected" } });
    await waitFor(() =>
      expect(partnerApplicationApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "rejected", page: 1 })
      )
    );
  });

  it("shows the detail and approves (note optional), then reject needs a reason", async () => {
    vi.mocked(partnerApplicationApi.list).mockResolvedValue({
      ...page([row]),
      counts: {},
    } as never);
    vi.mocked(partnerApplicationApi.get).mockResolvedValue(detail as never);
    vi.mocked(partnerApplicationApi.decide).mockResolvedValue({
      status: "approved",
      owner_membership: false,
    } as never);
    renderPage(<PartnerApplicationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Purshotam/ }));
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Supermarket")).toBeInTheDocument();
    expect(within(drawer).getByText(/approving sends the owner an invitation/)).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: "Approve" }));
    let dialogs = await screen.findAllByRole("dialog");
    fireEvent.click(within(dialogs[dialogs.length - 1]).getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(partnerApplicationApi.decide).toHaveBeenCalledWith("a1", "approve", "")
    );
    expect(await screen.findByText(/owner was invited by email/)).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "Reject" }));
    dialogs = await screen.findAllByRole("dialog");
    const dlg = dialogs[dialogs.length - 1];
    const confirm = within(dlg).getByRole("button", { name: "Reject" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "Outside area" } });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(partnerApplicationApi.decide).toHaveBeenLastCalledWith("a1", "reject", "Outside area")
    );
  });

  it("someone who can only view sees no decision buttons", async () => {
    vi.mocked(partnerApplicationApi.list).mockResolvedValue({
      ...page([row]),
      counts: {},
    } as never);
    vi.mocked(partnerApplicationApi.get).mockResolvedValue(detail as never);
    renderPage(<PartnerApplicationsPage />, {
      user: limitedUser([{ id: "feat_partner_review", actions: ["view_applications"] }]),
    });
    fireEvent.click(await screen.findByRole("button", { name: /Purshotam/ }));
    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByText("Supermarket");
    expect(within(drawer).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(drawer).queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it("403 on the list shows permission denied", async () => {
    vi.mocked(partnerApplicationApi.list).mockRejectedValue(apiErr(403));
    renderPage(<PartnerApplicationsPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
});

describe("OrderHoldsPage", () => {
  const hold = {
    id: "h1",
    order_id: "o1",
    status: "held",
    reasons: [{ code: "line_qty", item: "Classic Cheeseburger", qty: 10, limit: 8 }],
    created_at: "2026-10-10T15:53:55Z",
    total: { amount_minor: 150000, currency: "INR" },
    store_name: "Burger Barn",
    item_lines: 1,
    item_qty: 10,
  };
  it("lists open holds with the reason in words, and releases with a required reason", async () => {
    vi.mocked(orderHoldApi.list).mockResolvedValue({
      ...page([hold]),
      counts: { held: 1 },
    } as never);
    vi.mocked(orderHoldApi.get).mockResolvedValue({
      ...hold,
      items: [{ name: "Classic Cheeseburger", qty: 10 }],
    } as never);
    vi.mocked(orderHoldApi.decide).mockResolvedValue({});
    renderPage(<OrderHoldsPage />);
    expect(await screen.findByText(/10 × Classic Cheeseburger/)).toBeInTheDocument();
    expect(orderHoldApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: "held" }));
    fireEvent.click(
      screen
        .getAllByRole("button")
        .find((b) => b.textContent?.includes("2026") || b.textContent?.includes("Oct"))!
    );
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Release to restaurant" }));
    const dialogs = await screen.findAllByRole("dialog");
    const dlg = dialogs[dialogs.length - 1];
    const confirm = within(dlg).getByRole("button", { name: "Release to restaurant" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText(/Reason/), {
      target: { value: "Party order, called customer" },
    });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(orderHoldApi.decide).toHaveBeenCalledWith(
        "h1",
        "release",
        "Party order, called customer"
      )
    );
  });

  it("a One Local refusal is shown in the dialog and nothing is claimed", async () => {
    vi.mocked(orderHoldApi.list).mockResolvedValue({ ...page([hold]), counts: {} } as never);
    vi.mocked(orderHoldApi.get).mockResolvedValue({ ...hold, items: [] } as never);
    vi.mocked(orderHoldApi.decide).mockRejectedValue(
      apiErr(403, "Only One Local platform admins can use this.", "one_local_forbidden")
    );
    renderPage(<OrderHoldsPage />);
    await screen.findByText(/10 × Classic Cheeseburger/);
    fireEvent.click(
      screen
        .getAllByRole("button")
        .find((b) => b.textContent?.includes("2026") || b.textContent?.includes("Oct"))!
    );
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Reject and cancel" }));
    const dialogs = await screen.findAllByRole("dialog");
    const dlg = dialogs[dialogs.length - 1];
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "Fake order" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Reject and cancel" }));
    expect(await within(dlg).findByText(/only lets its super admins/)).toBeInTheDocument();
    expect(screen.queryByText(/The order was cancelled/)).toBeNull();
  });
});
