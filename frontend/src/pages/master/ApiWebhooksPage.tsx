import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Plus } from "lucide-react";
import { apiWebhooksApi } from "../../api/api-webhooks.api";
import type {
  ApiApp,
  ApiAppSecret,
  WebhookDelivery,
  WebhookEndpoint,
} from "../../api/api-webhooks.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  ConfirmDialog,
  ReasonDialog,
  DataTable,
  ErrorBox,
  Modal,
  Notice,
  PageHeader,
  PageState,
  Pager,
  StatusBadge,
  TabPanel,
  Tabs,
  TextInput,
  inputCls,
} from "../../components/master/ui";
import { useAction, useResource } from "../../components/master/useResource";

/** The raw key exists only in this component's state, only until the dialog is closed. */
export const KeyOnceDialog: React.FC<{ secret: ApiAppSecret | null; onClose: () => void }> = ({
  secret,
  onClose,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [stored, setStored] = useState(false);
  React.useEffect(() => {
    setCopied(false);
    setStored(false);
  }, [secret]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret?.api_key ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Modal
      open={secret !== null}
      title={t("m.api.keyOnce.title")}
      onClose={() => stored && onClose()}
      footer={
        <Button variant="primary" disabled={!stored} onClick={onClose}>
          {t("common.done")}
        </Button>
      }
    >
      <Notice tone="error">{t("m.api.keyOnce.warning")}</Notice>
      <div>
        <label htmlFor="api-key-once" className="mb-1 block text-xs font-semibold text-slate-700">
          {t("m.api.keyOnce.label")}
        </label>
        <div className="flex gap-2">
          <input
            id="api-key-once"
            readOnly
            value={secret?.api_key ?? ""}
            className={`${inputCls} font-mono`}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button onClick={copy}>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            {t("m.api.keyOnce.copy")}
          </Button>
        </div>
        <div role="status" className="mt-1 text-[11px] text-[#3E8800]">
          {copied ? t("m.api.keyOnce.copied") : ""}
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#65D000]"
          checked={stored}
          onChange={(e) => setStored(e.target.checked)}
        />
        {t("m.api.keyOnce.stored")}
      </label>
    </Modal>
  );
};

const AppsPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<ApiAppSecret | null>(null);
  const [target, setTarget] = useState<{ app: ApiApp; kind: "rotate" | "revoke" } | null>(null);
  const action = useAction();
  const res = useResource(() => apiWebhooksApi.apps(), []);
  const rows = res.data ?? [];

  const create = async () => {
    const r = await action.run(() => apiWebhooksApi.createApp({ name: name.trim() }));
    if (r) {
      setCreating(false);
      setSecret(r);
      setName("");
      res.reload();
    }
  };
  const confirm = async (reason?: string) => {
    if (!target) return;
    if (target.kind === "rotate") {
      const r = await action.run(() => apiWebhooksApi.rotateApp(target.app.id));
      if (r) {
        setTarget(null);
        setSecret(r);
        res.reload();
      }
    } else {
      const r = await action.run(() => apiWebhooksApi.revokeApp(target.app.id, reason ?? ""));
      if (r !== undefined) {
        setTarget(null);
        res.reload();
      }
    }
  };
  return (
    <div>
      {canManage && (
        <div className="mb-3">
          <Button
            variant="primary"
            onClick={() => {
              action.clear();
              setCreating(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("m.api.apps.create")}
          </Button>
        </div>
      )}
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.api.apps.empty")}
      >
        <DataTable
          caption={t("m.api.tab.apps")}
          rows={rows}
          rowKey={(a) => a.id}
          columns={[
            { key: "n", header: t("common.name"), render: (a) => a.name },
            {
              key: "k",
              header: t("m.api.apps.prefix"),
              render: (a) => <code>{a.key_prefix ? `${a.key_prefix}…` : t("common.dash")}</code>,
            },
            {
              key: "s",
              header: t("common.status"),
              render: (a) => <StatusBadge code={a.status} />,
            },
            {
              key: "u",
              header: t("m.api.apps.lastUsed"),
              render: (a) => (a.last_used_at ? f.relative(a.last_used_at) : t("common.never")),
            },
            {
              key: "x",
              header: t("common.actions"),
              render: (a) =>
                canManage && a.status !== "revoked" ? (
                  <span className="flex gap-2">
                    <Button
                      onClick={() => {
                        action.clear();
                        setTarget({ app: a, kind: "rotate" });
                      }}
                    >
                      {t("m.api.apps.rotate")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        action.clear();
                        setTarget({ app: a, kind: "revoke" });
                      }}
                    >
                      {t("m.api.apps.revoke")}
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
      </PageState>
      <Modal
        open={creating}
        title={t("m.api.apps.create")}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              busy={action.busy}
              disabled={name.trim().length < 2}
              onClick={create}
            >
              {t("common.create")}
            </Button>
          </>
        }
      >
        <TextInput
          label={t("m.api.apps.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {action.error ? <ErrorBox error={action.error} /> : null}
      </Modal>
      <ReasonDialog
        open={target?.kind === "revoke"}
        danger
        title={t("m.api.apps.dialog.revoke.title")}
        description={
          target ? t("m.api.apps.dialog.revoke.body", { name: target.app.name }) : undefined
        }
        confirmLabel={t("m.api.apps.revoke")}
        busy={action.busy}
        error={action.error}
        onConfirm={confirm}
        onClose={() => setTarget(null)}
      />
      <ConfirmDialog
        open={target?.kind === "rotate"}
        danger
        title={target ? t(`m.api.apps.dialog.${target.kind}.title`) : ""}
        description={
          target ? t(`m.api.apps.dialog.${target.kind}.body`, { name: target.app.name }) : undefined
        }
        confirmLabel={target ? t(`m.api.apps.${target.kind}`) : ""}
        busy={action.busy}
        error={action.error}
        onConfirm={() => confirm()}
        onClose={() => setTarget(null)}
      />
      <KeyOnceDialog secret={secret} onClose={() => setSecret(null)} />
    </div>
  );
};

const WebhooksPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", events: "", secret_ref: "" });
  const [notice, setNotice] = useState("");
  const [disabling, setDisabling] = useState<WebhookEndpoint | null>(null);
  const action = useAction();
  const res = useResource(() => apiWebhooksApi.webhooks(), []);
  const rows = res.data ?? [];

  const create = async () => {
    const events = form.events
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    const r = await action.run(() =>
      apiWebhooksApi.createWebhook({
        name: form.name.trim(),
        url: form.url.trim(),
        events,
        secret_ref: form.secret_ref.trim(),
      })
    );
    if (r !== undefined) {
      setCreating(false);
      setForm({ name: "", url: "", events: "", secret_ref: "" });
      res.reload();
    }
  };
  const test = async (w: WebhookEndpoint) => {
    setNotice("");
    const r = await action.run(() => apiWebhooksApi.testWebhook(w.id));
    if (r !== undefined) setNotice(t("m.api.webhooks.tested"));
  };
  const disable = async (reason: string) => {
    if (!disabling) return;
    const r = await action.run(() => apiWebhooksApi.disableWebhook(disabling.id, reason));
    if (r !== undefined) {
      setDisabling(null);
      res.reload();
    }
  };
  return (
    <div>
      {canManage && (
        <div className="mb-3">
          <Button
            variant="primary"
            onClick={() => {
              action.clear();
              setCreating(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("m.api.webhooks.create")}
          </Button>
        </div>
      )}
      {notice && (
        <div className="mb-3">
          <Notice>{notice}</Notice>
        </div>
      )}
      {!creating && !disabling && action.error ? (
        <div className="mb-3">
          <ErrorBox error={action.error} />
        </div>
      ) : null}
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.api.webhooks.empty")}
      >
        <DataTable
          caption={t("m.api.tab.webhooks")}
          rows={rows}
          rowKey={(w) => w.id}
          columns={[
            {
              key: "u",
              header: t("m.api.webhooks.url"),
              render: (w) => <span className="block max-w-[18rem] truncate">{w.url}</span>,
            },
            { key: "e", header: t("m.api.webhooks.events"), render: (w) => w.events.join(", ") },
            {
              key: "s",
              header: t("common.status"),
              render: (w) => <StatusBadge code={w.status} />,
            },
            {
              key: "x",
              header: t("common.actions"),
              render: (w) =>
                canManage ? (
                  <span className="flex gap-2">
                    <Button onClick={() => test(w)}>{t("m.api.webhooks.test")}</Button>
                    {w.status !== "disabled" && (
                      <Button
                        variant="danger"
                        onClick={() => {
                          action.clear();
                          setDisabling(w);
                        }}
                      >
                        {t("m.api.webhooks.disable")}
                      </Button>
                    )}
                  </span>
                ) : null,
            },
          ]}
        />
      </PageState>
      <Modal
        open={creating}
        title={t("m.api.webhooks.create")}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              busy={action.busy}
              disabled={!form.name.trim() || !form.url.trim() || !form.secret_ref.trim()}
              onClick={create}
            >
              {t("common.create")}
            </Button>
          </>
        }
      >
        <TextInput
          label={t("common.name")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <TextInput
          label={t("m.api.webhooks.url")}
          type="url"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <TextInput
          label={t("m.api.webhooks.secretRef")}
          hint={t("m.api.webhooks.secretRefHint")}
          value={form.secret_ref}
          onChange={(e) => setForm({ ...form, secret_ref: e.target.value })}
        />
        <TextInput
          label={t("m.api.webhooks.events")}
          hint={t("m.api.webhooks.eventsHint")}
          value={form.events}
          onChange={(e) => setForm({ ...form, events: e.target.value })}
        />
        {action.error ? <ErrorBox error={action.error} /> : null}
      </Modal>
      <ReasonDialog
        open={disabling !== null}
        danger
        title={t("m.api.webhooks.disableTitle")}
        description={t("m.api.webhooks.disableBody")}
        confirmLabel={t("m.api.webhooks.disable")}
        busy={action.busy}
        error={action.error}
        onConfirm={disable}
        onClose={() => setDisabling(null)}
      />
    </div>
  );
};

const DeliveriesPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const action = useAction();
  const res = useResource(() => apiWebhooksApi.deliveries({ page }), [page]);
  const rows = res.data?.items ?? [];
  const act = async (d: WebhookDelivery, kind: "retry" | "replay") => {
    setNotice("");
    const r = await action.run(() =>
      kind === "retry" ? apiWebhooksApi.retryDelivery(d.id) : apiWebhooksApi.replayDelivery(d.id)
    );
    if (r !== undefined) {
      setNotice(t(`m.api.deliveries.${kind}Done`));
      res.reload();
    }
  };
  return (
    <div>
      {notice && (
        <div className="mb-3">
          <Notice>{notice}</Notice>
        </div>
      )}
      {action.error ? (
        <div className="mb-3">
          <ErrorBox error={action.error} />
        </div>
      ) : null}
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.api.deliveries.empty")}
      >
        <DataTable
          caption={t("m.api.tab.deliveries")}
          rows={rows}
          rowKey={(d) => d.id}
          columns={[
            { key: "e", header: t("m.api.webhooks.event"), render: (d) => d.event },
            {
              key: "u",
              header: t("m.api.webhooks.url"),
              render: (d) => (
                <span className="block max-w-[14rem] truncate">
                  {d.endpoint_url ?? t("common.dash")}
                </span>
              ),
            },
            {
              key: "s",
              header: t("common.status"),
              render: (d) => <StatusBadge code={d.status} />,
            },
            {
              key: "a",
              header: t("m.api.deliveries.attempts"),
              render: (d) => f.number(d.attempts),
            },
            {
              key: "c",
              header: t("m.api.deliveries.response"),
              render: (d) => d.response_code ?? t("common.dash"),
            },
            { key: "d", header: t("common.date"), render: (d) => f.dateTime(d.created_at) },
            {
              key: "x",
              header: t("common.actions"),
              render: (d) =>
                canManage ? (
                  <span className="flex gap-2">
                    {d.status === "failed" && (
                      <Button onClick={() => act(d, "retry")}>{t("m.api.deliveries.retry")}</Button>
                    )}
                    <Button onClick={() => act(d, "replay")}>{t("m.api.deliveries.replay")}</Button>
                  </span>
                ) : null,
            },
          ]}
        />
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
      </PageState>
    </div>
  );
};

const LogsPanel: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const res = useResource(() => apiWebhooksApi.logs(), []);
  const rows = res.data ?? [];
  return (
    <PageState
      loading={res.loading}
      error={res.error}
      denied={res.denied}
      onRetry={res.reload}
      empty={rows.length === 0}
      emptyText={t("m.api.logs.empty")}
    >
      <DataTable
        caption={t("m.api.tab.logs")}
        rows={rows}
        rowKey={(l) => l.id}
        columns={[
          { key: "d", header: t("common.date"), render: (l) => f.dateTime(l.at) },
          { key: "m", header: t("m.api.logs.method"), render: (l) => l.method },
          { key: "p", header: t("m.api.logs.path"), render: (l) => l.path },
          { key: "s", header: t("common.status"), render: (l) => l.status },
          { key: "a", header: t("m.api.logs.app"), render: (l) => l.app_name ?? t("common.dash") },
        ]}
      />
    </PageState>
  );
};

export const ApiWebhooksPage: React.FC = () => {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canManage = can(FEAT.API.id, FEAT.API.manage);
  const [tab, setTab] = useState("apps");
  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.integrations")}
        title={t("m.api.title")}
        subtitle={t("m.api.subtitle")}
      />
      <Tabs
        label={t("m.api.title")}
        active={tab}
        onChange={setTab}
        tabs={["apps", "webhooks", "deliveries", "logs"].map((x) => ({
          id: x,
          label: t(`m.api.tab.${x}`),
        }))}
      />
      <TabPanel id="apps" active={tab}>
        <AppsPanel canManage={canManage} />
      </TabPanel>
      <TabPanel id="webhooks" active={tab}>
        <WebhooksPanel canManage={canManage} />
      </TabPanel>
      <TabPanel id="deliveries" active={tab}>
        <DeliveriesPanel canManage={canManage} />
      </TabPanel>
      <TabPanel id="logs" active={tab}>
        <LogsPanel />
      </TabPanel>
    </div>
  );
};
