import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { RidersPage } from "../pages/master/RidersPage";
import { RiderPayPage } from "../pages/master/RiderPayPage";
import { CommissionRulesPage } from "../pages/master/CommissionRulesPage";
import { riderApi } from "../api/riders.api";
import { riderPayApi } from "../api/rider-pay.api";
import { commissionApi } from "../api/commission.api";
import { apiErr, page, renderPage } from "./master-helpers";
import {
  majorStringToMinor,
  minorToMajorString,
  percentStringToBps,
  bpsToPercentString,
} from "../lib/units";

vi.mock("../api/riders.api", () => ({
  riderApi: {
    list: vi.fn(),
    get: vi.fn(),
    act: vi.fn(),
    deposits: vi.fn(),
    confirmDeposit: vi.fn(),
    rejectDeposit: vi.fn(),
  },
}));
vi.mock("../api/rider-pay.api", () => ({
  riderPayApi: {
    cities: vi.fn(),
    getRateCard: vi.fn(),
    putRateCard: vi.fn(),
    getPolicy: vi.fn(),
    putPolicy: vi.fn(),
  },
}));
vi.mock("../api/commission.api", async (orig) => ({
  ...(await orig<object>()),
  commissionApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe("money unit helpers", () => {
  it("convert rupees <-> minor units with integer math", () => {
    expect(majorStringToMinor("12.5")).toBe(1250);
    expect(majorStringToMinor("0.07")).toBe(7);
    expect(majorStringToMinor("12.345")).toBeNull();
    expect(majorStringToMinor("abc")).toBeNull();
    expect(minorToMajorString(1250)).toBe("12.5");
    expect(minorToMajorString(1200)).toBe("12");
    expect(percentStringToBps("2.5")).toBe(250);
    expect(bpsToPercentString(250)).toBe("2.5");
  });
});

describe("RidersPage", () => {
  const rider = {
    id: "r1",
    name: "Ravi Kumar",
    phone: "9",
    city: "Latur",
    status: "submitted",
    kyc_status: "verified",
    online: false,
  };
  const detail = { ...rider, history: [], documents: [{ type: "RC", status: "approved" }] };

  it("lists riders with filters sent to the endpoint", async () => {
    vi.mocked(riderApi.list).mockResolvedValue(page([rider]) as never);
    renderPage(<RidersPage />);
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "suspended" } });
    await waitFor(() =>
      expect(riderApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "suspended", page: 1 })
      )
    );
  });
  it("empty, error with retry, and 403", async () => {
    vi.mocked(riderApi.list).mockResolvedValue(page([]) as never);
    const a = renderPage(<RidersPage />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    a.unmount();
    vi.mocked(riderApi.list)
      .mockRejectedValueOnce(apiErr(500, "down"))
      .mockResolvedValue(page([rider]) as never);
    renderPage(<RidersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
  });
  it("403 on the list shows permission denied", async () => {
    vi.mocked(riderApi.list).mockRejectedValue(apiErr(403));
    renderPage(<RidersPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
  it("opens the rider 360 drawer and rejects with a required reason (approve reason is optional)", async () => {
    vi.mocked(riderApi.list).mockResolvedValue(page([rider]) as never);
    vi.mocked(riderApi.get).mockResolvedValue(detail as never);
    vi.mocked(riderApi.act).mockResolvedValue({});
    renderPage(<RidersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ravi Kumar" }));
    const drawer = await screen.findByRole("dialog");
    expect(riderApi.get).toHaveBeenCalledWith("r1");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Reject" }));
    const dialogs = await screen.findAllByRole("dialog");
    const reasonDlg = dialogs[dialogs.length - 1];
    const confirm = within(reasonDlg).getByRole("button", { name: "Reject" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(reasonDlg).getByLabelText(/Reason/), {
      target: { value: "KYC checked" },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(riderApi.act).toHaveBeenCalledWith("r1", "reject", "KYC checked"));
  });
  it("cash deposits: confirm, and reject requires a note", async () => {
    vi.mocked(riderApi.list).mockResolvedValue(page([]) as never);
    const dep = {
      id: "d1",
      rider_id: "r1",
      rider_name: "Ravi Kumar",
      amount: { amount_minor: 50000, currency: "INR" },
      status: "pending",
      created_at: "2026-10-01T00:00:00Z",
    };
    vi.mocked(riderApi.deposits).mockResolvedValue(page([dep]) as never);
    vi.mocked(riderApi.confirmDeposit).mockResolvedValue({});
    vi.mocked(riderApi.rejectDeposit).mockResolvedValue({});
    renderPage(<RidersPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Cash deposits" }));
    expect(await screen.findByText("₹500")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    let dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(riderApi.confirmDeposit).toHaveBeenCalledWith("d1", ""));
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    dlg = await screen.findByRole("dialog");
    const rej = within(dlg).getByRole("button", { name: "Reject" });
    expect(rej).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText(/Note/), { target: { value: "short by 100" } });
    fireEvent.click(rej);
    await waitFor(() => expect(riderApi.rejectDeposit).toHaveBeenCalledWith("d1", "short by 100"));
  });
});

describe("RiderPayPage", () => {
  beforeEach(() => {
    vi.mocked(riderPayApi.cities).mockResolvedValue([{ id: "c1", name: "Latur" }]);
    vi.mocked(riderPayApi.getRateCard).mockResolvedValue({
      base_minor: 2500,
      per_km_minor: 800,
      min_minor: 3000,
      active: true,
    });
    vi.mocked(riderPayApi.getPolicy).mockResolvedValue({
      withdraw_min_minor: 10000,
      withdraw_max_minor: 500000,
      withdraw_per_day: 2,
      default_cash_limit_minor: 200000,
      unavailable_wait_seconds: 120,
    });
    vi.mocked(riderPayApi.putRateCard).mockResolvedValue({});
    vi.mocked(riderPayApi.putPolicy).mockResolvedValue({});
  });
  it("shows rupees in the form and sends minor units on the wire", async () => {
    renderPage(<RiderPayPage />);
    const base = (await screen.findByLabelText("Base pay (₹)")) as HTMLInputElement;
    await waitFor(() => expect(base.value).toBe("25"));
    fireEvent.change(base, { target: { value: "27.5" } });
    fireEvent.click(
      within(screen.getByRole("form", { name: "Rate card" })).getByRole("button", { name: "Save" })
    );
    await waitFor(() =>
      expect(riderPayApi.putRateCard).toHaveBeenCalledWith("c1", {
        base_minor: 2750,
        per_km_minor: 800,
        min_minor: 3000,
        active: true,
      })
    );
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });
  it("saves the policy and rejects invalid numbers without calling the API", async () => {
    renderPage(<RiderPayPage />);
    const perDay = (await screen.findByLabelText("Withdrawals per day")) as HTMLInputElement;
    await waitFor(() => expect(perDay.value).toBe("2"));
    const form = screen.getByRole("form", { name: "Policy" });
    fireEvent.change(perDay, { target: { value: "x" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(form).findByText(/valid numbers/)).toBeInTheDocument();
    expect(riderPayApi.putPolicy).not.toHaveBeenCalled();
    fireEvent.change(perDay, { target: { value: "3" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(riderPayApi.putPolicy).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          withdraw_per_day: 3,
          withdraw_min_minor: 10000,
          default_cash_limit_minor: 200000,
          unavailable_wait_seconds: 120,
        })
      )
    );
  });
  it("no cities -> empty; 403 -> denied", async () => {
    vi.mocked(riderPayApi.cities).mockResolvedValue([]);
    const a = renderPage(<RiderPayPage />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    a.unmount();
    vi.mocked(riderPayApi.cities).mockRejectedValue(apiErr(403));
    renderPage(<RiderPayPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
  it("read-only user cannot save", async () => {
    const { limitedUser } = await import("./master-helpers");
    renderPage(<RiderPayPage />, {
      user: limitedUser([{ id: "feat_rider_pay", actions: ["view_rider_pay"] }]),
    });
    await screen.findByLabelText("Base pay (₹)");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});

describe("CommissionRulesPage", () => {
  const rule = {
    id: "cr1",
    organization_id: null,
    channel: "delivery",
    pct_bps: 250,
    fixed_minor: 1000,
    min_minor: 0,
    max_minor: 50000,
    active: true,
    version: 1,
  };
  it("lists rules; create converts percent/rupees to bps/minor", async () => {
    vi.mocked(commissionApi.list).mockResolvedValue([rule]);
    vi.mocked(commissionApi.create).mockResolvedValue({});
    renderPage(<CommissionRulesPage />);
    expect(await screen.findByText("2.5%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New rule" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Percent (%)"), { target: { value: "3" } });
    fireEvent.change(within(dlg).getByLabelText("Fixed amount (₹)"), { target: { value: "5" } });
    fireEvent.change(within(dlg).getByLabelText("Maximum (₹)"), { target: { value: "100" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(commissionApi.create).toHaveBeenCalledWith({
        organization_id: null,
        channel: null,
        pct_bps: 300,
        fixed_minor: 500,
        min_minor: 0,
        max_minor: 10000,
      })
    );
  });
  it("edit is a versioned PUT with a notice, deactivate asks for confirmation", async () => {
    vi.mocked(commissionApi.list).mockResolvedValue([rule]);
    vi.mocked(commissionApi.update).mockResolvedValue({});
    vi.mocked(commissionApi.deactivate).mockResolvedValue({});
    renderPage(<CommissionRulesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit (creates a new version)" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText(/Saving deactivates the current rule/)).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Percent (%)"), { target: { value: "4" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(commissionApi.update).toHaveBeenCalledWith(
        "cr1",
        expect.objectContaining({ pct_bps: 400, channel: "delivery" })
      )
    );
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    const c = await screen.findByRole("dialog");
    fireEvent.click(within(c).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(commissionApi.deactivate).toHaveBeenCalledWith("cr1"));
  });
  it("empty and error states", async () => {
    vi.mocked(commissionApi.list).mockResolvedValue([]);
    const a = renderPage(<CommissionRulesPage />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    a.unmount();
    vi.mocked(commissionApi.list).mockRejectedValue(apiErr(500, "bad"));
    renderPage(<CommissionRulesPage />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
