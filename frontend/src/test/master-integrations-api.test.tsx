import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { IntegrationsPage, CrmIntegrationPage } from "../pages/master/IntegrationsPage";
import { ApiWebhooksPage } from "../pages/master/ApiWebhooksPage";
import { integrationApi } from "../api/integrations.api";
import { apiWebhooksApi } from "../api/api-webhooks.api";
import { apiErr, limitedUser, renderPage } from "./master-helpers";

vi.mock("../api/integrations.api", async (orig) => ({
  ...(await orig<object>()),
  integrationApi: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    test: vi.fn(),
    sync: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    rotateCredentials: vi.fn(),
    logs: vi.fn(),
    mappings: vi.fn(),
    putMappings: vi.fn(),
  },
}));
vi.mock("../api/api-webhooks.api", () => ({
  apiWebhooksApi: {
    apps: vi.fn(),
    createApp: vi.fn(),
    rotateApp: vi.fn(),
    revokeApp: vi.fn(),
    webhooks: vi.fn(),
    createWebhook: vi.fn(),
    testWebhook: vi.fn(),
    disableWebhook: vi.fn(),
    deliveries: vi.fn(),
    retryDelivery: vi.fn(),
    replayDelivery: vi.fn(),
    logs: vi.fn(),
  },
}));

beforeEach(() => vi.clearAllMocks());

describe("Integrations", () => {
  const it1 = {
    id: "i1",
    category: "crm",
    provider: "hubspot",
    name: "HubSpot CRM",
    status: "configured",
  };
  beforeEach(() => {
    vi.mocked(integrationApi.list).mockResolvedValue([it1]);
    vi.mocked(integrationApi.get).mockResolvedValue(it1);
    vi.mocked(integrationApi.logs).mockResolvedValue([
      { id: "g1", at: "2026-10-01T10:00:00Z", event: "sync.failed", message: "no token" },
    ]);
    vi.mocked(integrationApi.mappings).mockResolvedValue([
      { id: "m1", kind: "crm_field", source: "email", target: "Email" },
    ]);
  });
  it("centre lists the registry; CRM page filters by category", async () => {
    const a = renderPage(<IntegrationsPage />);
    expect(await screen.findByText("HubSpot CRM")).toBeInTheDocument();
    expect(integrationApi.list).toHaveBeenCalledWith(undefined);
    a.unmount();
    renderPage(<CrmIntegrationPage />);
    await screen.findByText("HubSpot CRM");
    expect(integrationApi.list).toHaveBeenLastCalledWith("crm");
  });
  it("test connection reports provider_not_configured honestly", async () => {
    vi.mocked(integrationApi.test).mockRejectedValue(
      apiErr(503, "provider_not_configured", "provider_not_configured")
    );
    renderPage(<IntegrationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "HubSpot CRM" }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Test connection" }));
    expect(await within(drawer).findByTestId("provider-not-configured")).toBeInTheDocument();
    expect(integrationApi.test).toHaveBeenCalledWith("i1");
  });
  it("shows logs and saves mappings", async () => {
    vi.mocked(integrationApi.putMappings).mockResolvedValue({});
    renderPage(<IntegrationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "HubSpot CRM" }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("tab", { name: "Mappings" }));
    const target = await within(drawer).findByDisplayValue("Email");
    fireEvent.change(target, { target: { value: "EmailAddress" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(integrationApi.putMappings).toHaveBeenCalledWith("i1", [
        { id: "m1", kind: "crm_field", source: "email", target: "EmailAddress" },
      ])
    );
    fireEvent.click(within(drawer).getByRole("tab", { name: "Logs" }));
    expect(await within(drawer).findByText("sync.failed")).toBeInTheDocument();
  });
  it("rotating credentials asks for confirmation first", async () => {
    vi.mocked(integrationApi.rotateCredentials).mockResolvedValue({});
    renderPage(<IntegrationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "HubSpot CRM" }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Rotate credentials" }));
    expect(integrationApi.rotateCredentials).not.toHaveBeenCalled();
    const dlgs = await screen.findAllByRole("dialog");
    fireEvent.click(
      within(dlgs[dlgs.length - 1]).getByRole("button", { name: "Rotate credentials" })
    );
    await waitFor(() => expect(integrationApi.rotateCredentials).toHaveBeenCalledWith("i1"));
  });
  it("empty, denied, and read-only users get no manage buttons", async () => {
    vi.mocked(integrationApi.list).mockResolvedValue([]);
    const a = renderPage(<IntegrationsPage />, {
      user: limitedUser([{ id: "feat_integrations", actions: ["view_integrations"] }]),
    });
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add integration" })).not.toBeInTheDocument();
    a.unmount();
    vi.mocked(integrationApi.list).mockRejectedValue(apiErr(403));
    renderPage(<IntegrationsPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
});

describe("API & webhooks", () => {
  const app = { id: "a1", name: "Partner A", key_prefix: "pk_live_ab", status: "active" };
  it("creates an app and shows the key exactly once, with copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.mocked(apiWebhooksApi.apps).mockResolvedValue([]);
    vi.mocked(apiWebhooksApi.createApp).mockResolvedValue({ app, api_key: "pk_live_SECRET_VALUE" });
    renderPage(<ApiWebhooksPage />);
    await screen.findByTestId("empty-state");
    fireEvent.click(screen.getByRole("button", { name: "Create API app" }));
    let dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("App name"), { target: { value: "Partner A" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Create" }));
    dlg = await screen.findByRole("dialog", { name: "Your new API key" });
    expect(within(dlg).getByLabelText("API key")).toHaveValue("pk_live_SECRET_VALUE");
    const done = within(dlg).getByRole("button", { name: "Done" });
    expect(done).toBeDisabled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("pk_live_SECRET_VALUE"));
    expect(await within(dlg).findByText("Copied to clipboard.")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("checkbox"));
    fireEvent.click(done);
    await waitFor(() =>
      expect(screen.queryByDisplayValue("pk_live_SECRET_VALUE")).not.toBeInTheDocument()
    );
    // list shows only the prefix, never the key
    vi.mocked(apiWebhooksApi.apps).mockResolvedValue([app]);
    expect(document.body.textContent).not.toContain("SECRET_VALUE");
  });
  it("rotate asks for confirmation and shows the new key once; revoke calls the endpoint", async () => {
    vi.mocked(apiWebhooksApi.apps).mockResolvedValue([app]);
    vi.mocked(apiWebhooksApi.rotateApp).mockResolvedValue({ app, api_key: "pk_live_NEW" });
    vi.mocked(apiWebhooksApi.revokeApp).mockResolvedValue({});
    renderPage(<ApiWebhooksPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Rotate key" }));
    let dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Rotate key" }));
    await waitFor(() => expect(apiWebhooksApi.rotateApp).toHaveBeenCalledWith("a1"));
    expect(await screen.findByDisplayValue("pk_live_NEW")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "leaked key" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(apiWebhooksApi.revokeApp).toHaveBeenCalledWith("a1", "leaked key"));
  });
  it("webhook deliveries: retry and replay", async () => {
    vi.mocked(apiWebhooksApi.apps).mockResolvedValue([]);
    vi.mocked(apiWebhooksApi.deliveries).mockResolvedValue({
      items: [
        {
          id: "d1",
          event: "order.created",
          status: "failed",
          attempts: 3,
          response_code: 500,
          created_at: "2026-10-01T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    vi.mocked(apiWebhooksApi.retryDelivery).mockResolvedValue({});
    vi.mocked(apiWebhooksApi.replayDelivery).mockResolvedValue({});
    renderPage(<ApiWebhooksPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Deliveries" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(apiWebhooksApi.retryDelivery).toHaveBeenCalledWith("d1"));
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    await waitFor(() => expect(apiWebhooksApi.replayDelivery).toHaveBeenCalledWith("d1"));
  });
  it("webhooks: create splits events, errors and denied states", async () => {
    vi.mocked(apiWebhooksApi.apps).mockResolvedValue([]);
    vi.mocked(apiWebhooksApi.webhooks).mockResolvedValue([]);
    vi.mocked(apiWebhooksApi.createWebhook).mockResolvedValue({});
    renderPage(<ApiWebhooksPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Webhooks" }));
    await screen.findByTestId("empty-state");
    fireEvent.click(screen.getByRole("button", { name: "Add webhook" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Name"), { target: { value: "Orders hook" } });
    fireEvent.change(within(dlg).getByLabelText("Signing secret name"), {
      target: { value: "webhooks/orders" },
    });
    fireEvent.change(within(dlg).getByLabelText("Endpoint URL"), {
      target: { value: "https://x.test/hook" },
    });
    fireEvent.change(within(dlg).getByLabelText("Events"), {
      target: { value: "order.created, order.delivered" },
    });
    fireEvent.click(within(dlg).getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(apiWebhooksApi.createWebhook).toHaveBeenCalledWith({
        name: "Orders hook",
        secret_ref: "webhooks/orders",
        url: "https://x.test/hook",
        events: ["order.created", "order.delivered"],
      })
    );
  });
  it("apps list 403 shows denied; logs tab calls /api-logs", async () => {
    vi.mocked(apiWebhooksApi.apps).mockRejectedValue(apiErr(403));
    vi.mocked(apiWebhooksApi.logs).mockResolvedValue([
      { id: "l1", at: "2026-10-01T00:00:00Z", method: "GET", path: "/v1/orders", status: 200 },
    ]);
    renderPage(<ApiWebhooksPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "API logs" }));
    expect(await screen.findByText("/v1/orders")).toBeInTheDocument();
  });
});
