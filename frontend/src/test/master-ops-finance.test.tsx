import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, fireEvent, within, act } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { OrdersPage, Order360Page } from "../pages/master/OrdersPage";
import { DispatchBoardPage } from "../pages/master/DispatchBoardPage";
import { SettlementsPayoutsPage } from "../pages/master/SettlementsPayoutsPage";
import { FinanceControlPage } from "../pages/master/FinanceControlPage";
import { MasterDashboardPage } from "../pages/master/MasterDashboardPage";
import { AuditViewerPage } from "../pages/master/AuditViewerPage";
import { orderApi } from "../api/orders.api";
import { dispatchApi } from "../api/dispatch.api";
import { financeApi } from "../api/finance.api";
import { dashboardApi } from "../api/dashboard.api";
import { auditApi } from "../api/audit.api";
import { apiErr, page, renderPage } from "./master-helpers";
import { diffObjects } from "../lib/diff";

vi.mock("../api/orders.api", () => ({ orderApi: { list: vi.fn(), get: vi.fn() } }));
vi.mock("../api/dispatch.api", async (orig) => ({
  ...(await orig<object>()),
  dispatchApi: {
    jobs: vi.fn(),
    job: vi.fn(),
    reassign: vi.fn(),
    cancel: vi.fn(),
    resolveException: vi.fn(),
  },
}));
vi.mock("../api/finance.api", () => ({
  financeApi: {
    overview: vi.fn(),
    payments: vi.fn(),
    settlements: vi.fn(),
    runSettlement: vi.fn(),
    approveSettlement: vi.fn(),
    payouts: vi.fn(),
    approvePayout: vi.fn(),
    markPaid: vi.fn(),
    ledger: vi.fn(),
    reconciliation: vi.fn(),
    riderEarnings: vi.fn(),
  },
}));
vi.mock("../api/dashboard.api", () => ({ dashboardApi: { summary: vi.fn() } }));
vi.mock("../api/audit.api", () => ({ auditApi: { list: vi.fn() } }));

const inr = (n: number) => ({ amount_minor: n, currency: "INR" });
beforeEach(() => vi.clearAllMocks());

describe("Orders", () => {
  const row = {
    id: "ord1",
    number: "1001",
    organization_name: "Alpha Foods",
    channel: "delivery",
    status: "paid",
    total: inr(125000),
    created_at: "2026-10-01T10:00:00Z",
  };
  it("lists orders via GET /orders with filters", async () => {
    vi.mocked(orderApi.list).mockResolvedValue(page([row]) as never);
    renderPage(<OrdersPage />);
    expect(await screen.findByText("1001")).toBeInTheDocument();
    expect(screen.getByText("₹1,250")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "cancelled" } });
    await waitFor(() =>
      expect(orderApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "cancelled" })
      )
    );
  });
  it("empty / error / denied", async () => {
    vi.mocked(orderApi.list).mockResolvedValue(page([]) as never);
    const a = renderPage(<OrdersPage />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    a.unmount();
    vi.mocked(orderApi.list).mockRejectedValue(apiErr(403));
    renderPage(<OrdersPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
  it("Order 360 renders the timeline from the trace", async () => {
    vi.mocked(orderApi.get).mockResolvedValue({
      ...row,
      timeline: [
        { id: "e1", at: "2026-10-01T10:00:00Z", kind: "order.created", status: "new" },
        {
          id: "e2",
          at: "2026-10-01T10:05:00Z",
          kind: "payment.captured",
          status: "paid",
          actor: "gateway",
        },
      ],
      order_trace: { id: "ord1" },
    } as never);
    renderPage(
      <Routes>
        <Route path="/orders/:id" element={<Order360Page />} />
      </Routes>,
      { route: "/orders/ord1" }
    );
    const list = await screen.findByRole("list", { name: "Timeline" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("payment.captured")).toBeInTheDocument();
    expect(orderApi.get).toHaveBeenCalledWith("ord1");
  });
});

describe("DispatchBoardPage", () => {
  const job = {
    id: "j1",
    order_number: "1001",
    organization_name: "Alpha",
    status: "exception",
    rider_name: "Ravi",
    exception_id: "x1",
    exception_reason: "customer unreachable",
  };
  const job2 = { id: "j2", order_number: "1002", status: "assigned" };
  beforeEach(() => {
    vi.mocked(dispatchApi.jobs).mockResolvedValue(page([job, job2]) as never);
    vi.mocked(dispatchApi.job).mockResolvedValue({
      ...job,
      events: [{ id: "ev", at: "2026-10-01T10:00:00Z", status: "assigned" }],
    } as never);
  });
  it("groups jobs into state columns", async () => {
    renderPage(<DispatchBoardPage />);
    const col = await screen.findByRole("listitem", { name: "Exception" });
    expect(within(col).getByText("1001")).toBeInTheDocument();
    expect(
      within(screen.getByRole("listitem", { name: "Assigned" })).getByText("1002")
    ).toBeInTheDocument();
  });
  it("reassign requires a reason and calls the endpoint", async () => {
    vi.mocked(dispatchApi.reassign).mockResolvedValue({});
    renderPage(<DispatchBoardPage />);
    fireEvent.click(await screen.findByRole("button", { name: /1001/ }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Reassign" }));
    const dlgs = await screen.findAllByRole("dialog");
    const d = dlgs[dlgs.length - 1];
    const ok = within(d).getByRole("button", { name: "Reassign" });
    expect(ok).toBeDisabled();
    fireEvent.change(within(d).getByLabelText(/Reason/), {
      target: { value: "rider unreachable" },
    });
    fireEvent.click(ok);
    await waitFor(() =>
      expect(dispatchApi.reassign).toHaveBeenCalledWith("j1", "rider unreachable")
    );
  });
  it("shows the honest provider_not_configured state when dispatch is unreachable", async () => {
    vi.mocked(dispatchApi.cancel).mockRejectedValue(
      apiErr(503, "provider_not_configured", "provider_not_configured")
    );
    renderPage(<DispatchBoardPage />);
    fireEvent.click(await screen.findByRole("button", { name: /1001/ }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Cancel delivery" }));
    const dlgs = await screen.findAllByRole("dialog");
    const d = dlgs[dlgs.length - 1];
    fireEvent.change(within(d).getByLabelText(/Reason/), { target: { value: "customer asked" } });
    fireEvent.click(within(d).getByRole("button", { name: "Cancel delivery" }));
    expect(await within(d).findByTestId("provider-not-configured")).toBeInTheDocument();
  });
  it("resolves an exception with outcome and note", async () => {
    vi.mocked(dispatchApi.resolveException).mockResolvedValue({});
    renderPage(<DispatchBoardPage />);
    fireEvent.click(await screen.findByRole("button", { name: /1001/ }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Resolve exception" }));
    const dlgs = await screen.findAllByRole("dialog");
    const d = dlgs[dlgs.length - 1];
    fireEvent.change(within(d).getByLabelText("Outcome"), { target: { value: "cancel" } });
    fireEvent.change(within(d).getByLabelText(/Notes/), { target: { value: "called customer" } });
    fireEvent.click(within(d).getByRole("button", { name: "Resolve exception" }));
    await waitFor(() =>
      expect(dispatchApi.resolveException).toHaveBeenCalledWith("x1", "cancel", "called customer")
    );
  });
  it("empty state and 403", async () => {
    vi.mocked(dispatchApi.jobs).mockResolvedValue(page([]) as never);
    const a = renderPage(<DispatchBoardPage />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    a.unmount();
    vi.mocked(dispatchApi.jobs).mockRejectedValue(apiErr(403));
    renderPage(<DispatchBoardPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
});

describe("Settlements & payouts", () => {
  const st = {
    id: "s1",
    organization_name: "Alpha",
    period_start: "2026-09-01",
    period_end: "2026-09-30",
    status: "draft",
    net: inr(900000),
  };
  it("approve is confirmed; own items show the maker-checker note instead of a button", async () => {
    vi.mocked(financeApi.settlements).mockResolvedValue(
      page([st, { ...st, id: "s2", created_by_me: true }]) as never
    );
    vi.mocked(financeApi.approveSettlement).mockResolvedValue({});
    renderPage(<SettlementsPayoutsPage />);
    expect(await screen.findAllByText("₹9,000")).toHaveLength(2);
    expect(screen.getByText("Needs a different approver")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(financeApi.approveSettlement).toHaveBeenCalledWith("s1"));
  });
  it("run settlement posts organization + period", async () => {
    vi.mocked(financeApi.settlements).mockResolvedValue(page([]) as never);
    vi.mocked(financeApi.runSettlement).mockResolvedValue({});
    renderPage(<SettlementsPayoutsPage />);
    await screen.findByTestId("empty-state");
    fireEvent.click(screen.getByRole("button", { name: "Run settlement" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByRole("button", { name: "Run settlement" })).toBeDisabled();
  });
  it("payouts: mark paid needs a reference", async () => {
    vi.mocked(financeApi.settlements).mockResolvedValue(page([]) as never);
    vi.mocked(financeApi.payouts).mockResolvedValue(
      page([{ id: "p1", payee_name: "Ravi", status: "approved", amount: inr(50000) }]) as never
    );
    vi.mocked(financeApi.markPaid).mockResolvedValue({});
    renderPage(<SettlementsPayoutsPage />, { route: "/finance/settlements?tab=payouts" });
    fireEvent.click(await screen.findByRole("button", { name: "Mark as paid" }));
    const dlg = await screen.findByRole("dialog");
    const ok = within(dlg).getByRole("button", { name: "Mark as paid" });
    expect(ok).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText("Payment reference"), {
      target: { value: "UTR123456" },
    });
    fireEvent.click(ok);
    await waitFor(() => expect(financeApi.markPaid).toHaveBeenCalledWith("p1", "UTR123456"));
  });
  it("error and denied", async () => {
    vi.mocked(financeApi.settlements).mockRejectedValue(apiErr(403));
    renderPage(<SettlementsPayoutsPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
});

describe("Finance control", () => {
  it("overview shows collected/earned/owed/paid in minor-unit money", async () => {
    vi.mocked(financeApi.overview).mockResolvedValue({
      collected: inr(1000000),
      earned: inr(150000),
      owed: inr(80000),
      paid: inr(70000),
    });
    renderPage(<FinanceControlPage />);
    expect(await screen.findByTestId("kpi-collected")).toHaveTextContent("₹10,000");
    expect(screen.getByTestId("kpi-owed")).toHaveTextContent("₹800");
  });
  it("ledger, reconciliation and rider earnings tabs call their endpoints", async () => {
    vi.mocked(financeApi.overview).mockResolvedValue({
      collected: inr(1),
      earned: inr(1),
      owed: inr(1),
      paid: inr(1),
    });
    vi.mocked(financeApi.ledger).mockResolvedValue(
      page([
        {
          id: "l1",
          order_id: "ord1",
          type: "commission",
          direction: "credit",
          amount: inr(2500),
          created_at: "2026-10-01T00:00:00Z",
        },
      ]) as never
    );
    vi.mocked(financeApi.reconciliation).mockResolvedValue([
      { id: "r1", label: "Gateway vs ledger", status: "matched" },
    ]);
    vi.mocked(financeApi.riderEarnings).mockResolvedValue([
      {
        rider_id: "r1",
        rider_name: "Ravi",
        deliveries: 4,
        earned: inr(1000),
        paid: inr(0),
        owed: inr(1000),
      },
    ]);
    renderPage(<FinanceControlPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Ledger" }));
    expect(await screen.findByText("commission")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Reconciliation" }));
    expect(await screen.findByText("Gateway vs ledger")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Rider earnings" }));
    expect(await screen.findByText("Ravi")).toBeInTheDocument();
    expect(financeApi.riderEarnings).toHaveBeenCalled();
  });
  it("empty ledger and error on overview", async () => {
    vi.mocked(financeApi.overview).mockRejectedValue(apiErr(500, "bad"));
    vi.mocked(financeApi.ledger).mockResolvedValue(page([]) as never);
    renderPage(<FinanceControlPage />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Ledger" }));
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });
});

describe("Dashboard", () => {
  const summary = {
    orders_today: 42,
    gmv: inr(5500000),
    riders_online: 7,
    active_deliveries: 5,
    failed_deliveries: 1,
    late_deliveries: 0,
    pending_approvals: 3,
    open_exceptions: 2,
    settlements_pending: 1,
    payouts_pending: 4,
    failed_payments: 0,
  };
  it("renders real KPIs, linking into screens", async () => {
    vi.mocked(dashboardApi.summary).mockResolvedValue(summary);
    renderPage(<MasterDashboardPage />);
    expect(await screen.findByTestId("kpi-ordersToday")).toHaveTextContent("42");
    expect(screen.getByTestId("kpi-gmv")).toHaveTextContent("₹55,000");
    expect(screen.getByTestId("kpi-ordersToday").closest("a")).toHaveAttribute("href", "/orders");
    expect(screen.getByTestId("kpi-openExceptions").closest("a")).toHaveAttribute(
      "href",
      "/dispatch?status=exception"
    );
  });
  it("auto-refreshes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(dashboardApi.summary).mockResolvedValue(summary);
      renderPage(<MasterDashboardPage />);
      await screen.findByTestId("kpi-ordersToday");
      expect(dashboardApi.summary).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30500);
      });
      expect(vi.mocked(dashboardApi.summary).mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("error with retry, and denied", async () => {
    vi.mocked(dashboardApi.summary)
      .mockRejectedValueOnce(apiErr(500, "x"))
      .mockResolvedValue(summary);
    renderPage(<MasterDashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("kpi-ordersToday")).toBeInTheDocument();
  });
});

describe("Audit viewer", () => {
  const log = {
    id: "a1",
    created_at: "2026-10-01T10:00:00Z",
    actor: "root",
    action: "org.update",
    entity_type: "organization",
    entity_id: "o1",
    before: { status: "Active", name: "A" },
    after: { status: "Suspended", name: "A", reason: "dues" },
  };
  it("filters call the endpoint and the diff view marks changed/added fields", async () => {
    vi.mocked(auditApi.list).mockResolvedValue(page([log]) as never);
    renderPage(<AuditViewerPage />);
    fireEvent.click(await screen.findByRole("button", { name: "org.update" }));
    const drawer = await screen.findByRole("dialog");
    const rows = within(drawer).getAllByRole("row");
    const kinds = rows.map((r) => r.getAttribute("data-kind")).filter(Boolean);
    expect(kinds).toEqual(["added", "changed", "same"]);
    fireEvent.click(within(drawer).getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByLabelText("Entity type"), { target: { value: "organization" } });
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ entity_type: "organization" })
      )
    );
  });
  it("empty and denied", async () => {
    vi.mocked(auditApi.list).mockResolvedValue(page([]) as never);
    const a = renderPage(<AuditViewerPage />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    a.unmount();
    vi.mocked(auditApi.list).mockRejectedValue(apiErr(403));
    renderPage(<AuditViewerPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
  it("diffObjects orders changes first", () => {
    expect(
      diffObjects({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 }).map((r) => `${r.key}:${r.kind}`)
    ).toEqual(["b:changed", "c:added", "a:same"]);
  });
});

afterEach(() => vi.useRealTimers());
