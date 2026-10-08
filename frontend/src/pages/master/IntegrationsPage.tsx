import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { INTEGRATION_CATEGORIES, integrationApi } from "../../api/integrations.api";
import type { Integration, IntegrationMapping, MappingKind } from "../../api/integrations.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  ConfirmDialog,
  ReasonDialog,
  DataTable,
  Drawer,
  EmptyBox,
  ErrorBox,
  KV,
  Modal,
  Notice,
  PageHeader,
  PageState,
  SelectInput,
  StatusBadge,
  TabPanel,
  Tabs,
  TextInput,
} from "../../components/master/ui";
import { useAction, useResource } from "../../components/master/useResource";

type Category = "crm" | "cms";
const KINDS: Record<Category | "all", MappingKind[]> = {
  crm: ["crm_field"],
  cms: ["cms_content", "cms_placement"],
  all: ["crm_field", "cms_content", "cms_placement"],
};

const MappingsEditor: React.FC<{ integration: Integration; canManage: boolean }> = ({
  integration,
  canManage,
}) => {
  const { t } = useTranslation();
  const res = useResource(() => integrationApi.mappings(integration.id), [integration.id]);
  const [rows, setRows] = useState<IntegrationMapping[] | null>(null);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const kinds =
    KINDS[(integration.category as Category) in KINDS ? (integration.category as Category) : "all"];
  const current = rows ?? res.data ?? [];

  const update = (next: IntegrationMapping[]) => {
    setRows(next);
    setSaved(false);
  };
  const save = async () => {
    const r = await action.run(() =>
      integrationApi.putMappings(
        integration.id,
        current.filter((m) => m.source.trim() && m.target.trim())
      )
    );
    if (r !== undefined) {
      setSaved(true);
      setRows(null);
      res.reload();
    }
  };
  return (
    <PageState loading={res.loading} error={res.error} denied={res.denied} onRetry={res.reload}>
      {current.length === 0 && <EmptyBox text={t("m.integrations.noMappings")} />}
      <ul className="space-y-2">
        {current.map((m, i) => (
          <li key={m.id ?? i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <SelectInput
              label={t("m.integrations.mappingKind")}
              value={m.kind}
              disabled={!canManage}
              onChange={(e) =>
                update(
                  current.map((x, j) =>
                    j === i ? { ...x, kind: e.target.value as MappingKind } : x
                  )
                )
              }
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {t(`m.integrations.kind.${k}`)}
                </option>
              ))}
            </SelectInput>
            <TextInput
              label={t("m.integrations.source")}
              value={m.source}
              disabled={!canManage}
              onChange={(e) =>
                update(current.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))
              }
            />
            <TextInput
              label={t("m.integrations.target")}
              value={m.target}
              disabled={!canManage}
              onChange={(e) =>
                update(current.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))
              }
            />
            {canManage && (
              <Button
                variant="ghost"
                aria-label={t("m.integrations.removeMapping")}
                onClick={() => update(current.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <div className="mt-3 flex gap-2">
          <Button onClick={() => update([...current, { kind: kinds[0], source: "", target: "" }])}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("m.integrations.addMapping")}
          </Button>
          <Button variant="primary" busy={action.busy} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      )}
      {saved && (
        <div className="mt-2">
          <Notice>{t("m.integrations.mappingsSaved")}</Notice>
        </div>
      )}
      {action.error ? (
        <div className="mt-2">
          <ErrorBox error={action.error} />
        </div>
      ) : null}
    </PageState>
  );
};

const IntegrationDrawer: React.FC<{
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}> = ({ id, onClose, onChanged }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const canManage = can(FEAT.INTEGRATIONS.id, FEAT.INTEGRATIONS.manage);
  const [tab, setTab] = useState("overview");
  const [rotate, setRotate] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [notice, setNotice] = useState("");
  const action = useAction();
  const res = useResource(() => integrationApi.get(id as string), [id], { enabled: Boolean(id) });
  const logs = useResource(() => integrationApi.logs(id as string), [id], {
    enabled: Boolean(id) && tab === "logs",
  });
  const it = res.data;

  const doIt = async (fn: () => Promise<unknown>, msg: string) => {
    setNotice("");
    const r = await action.run(fn);
    if (r !== undefined) {
      setNotice(msg);
      res.reload();
      logs.reload();
      onChanged();
    }
  };
  return (
    <>
      <Drawer open={Boolean(id)} title={it?.name ?? t("m.integrations.detail")} onClose={onClose}>
        <PageState
          loading={res.loading}
          error={res.error}
          denied={res.denied}
          onRetry={res.reload}
          empty={!it}
        >
          {it && (
            <>
              <Tabs
                label={t("m.integrations.detail")}
                active={tab}
                onChange={setTab}
                tabs={[
                  { id: "overview", label: t("m.integrations.tab.overview") },
                  { id: "mappings", label: t("m.integrations.tab.mappings") },
                  { id: "logs", label: t("m.integrations.tab.logs") },
                ]}
              />
              <TabPanel id="overview" active={tab}>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <KV label={t("m.integrations.provider")}>{it.provider}</KV>
                  <KV label={t("m.integrations.category")}>
                    {t(`m.integrations.cat.${it.category}`, { defaultValue: it.category })}
                  </KV>
                  <KV label={t("common.status")}>
                    <StatusBadge code={it.status} />
                  </KV>
                  <KV label={t("m.integrations.lastSync")}>
                    {it.last_sync_at ? f.dateTime(it.last_sync_at) : t("common.never")}
                  </KV>
                  <KV label={t("m.integrations.rotated")}>
                    {it.credentials_rotated_at
                      ? f.dateTime(it.credentials_rotated_at)
                      : t("common.never")}
                  </KV>
                </dl>
                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        doIt(() => integrationApi.test(it.id), t("m.integrations.tested"))
                      }
                    >
                      {t("m.integrations.test")}
                    </Button>
                    <Button
                      onClick={() =>
                        doIt(() => integrationApi.sync(it.id), t("m.integrations.synced"))
                      }
                    >
                      {t("m.integrations.sync")}
                    </Button>
                    {it.status === "disabled" ? (
                      <Button
                        onClick={() =>
                          doIt(() => integrationApi.enable(it.id), t("m.integrations.enabled"))
                        }
                      >
                        {t("m.integrations.enable")}
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        onClick={() => {
                          action.clear();
                          setDisabling(true);
                        }}
                      >
                        {t("m.integrations.disable")}
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        action.clear();
                        setRotate(true);
                      }}
                    >
                      {t("m.integrations.rotate")}
                    </Button>
                  </div>
                )}
                <div className="mt-3 space-y-2">
                  {notice && <Notice>{notice}</Notice>}
                  {!rotate && !disabling && action.error ? <ErrorBox error={action.error} /> : null}
                </div>
              </TabPanel>
              <TabPanel id="mappings" active={tab}>
                <MappingsEditor integration={it} canManage={canManage} />
              </TabPanel>
              <TabPanel id="logs" active={tab}>
                <PageState
                  loading={logs.loading}
                  error={logs.error}
                  denied={logs.denied}
                  onRetry={logs.reload}
                  empty={(logs.data ?? []).length === 0}
                  emptyText={t("m.integrations.noLogs")}
                >
                  <ul className="space-y-1 text-xs text-slate-600">
                    {(logs.data ?? []).map((l) => (
                      <li key={l.id}>
                        {f.dateTime(l.at)} — <b>{l.event}</b>
                        {l.message ? `: ${l.message}` : ""}
                      </li>
                    ))}
                  </ul>
                </PageState>
              </TabPanel>
            </>
          )}
        </PageState>
      </Drawer>
      <ReasonDialog
        open={disabling}
        danger
        title={t("m.integrations.disableTitle")}
        description={t("m.integrations.disableBody")}
        confirmLabel={t("m.integrations.disable")}
        busy={action.busy}
        error={action.error}
        onConfirm={async (reason) => {
          await doIt(
            () => integrationApi.disable(id as string, reason),
            t("m.integrations.disabled")
          );
          setDisabling(false);
        }}
        onClose={() => setDisabling(false)}
      />
      <ConfirmDialog
        open={rotate}
        danger
        title={t("m.integrations.rotateTitle")}
        description={t("m.integrations.rotateBody")}
        confirmLabel={t("m.integrations.rotate")}
        busy={action.busy}
        error={action.error}
        onConfirm={async () => {
          await doIt(
            () => integrationApi.rotateCredentials(id as string),
            t("m.integrations.rotatedOk")
          );
          setRotate(false);
        }}
        onClose={() => setRotate(false)}
      />
    </>
  );
};

export const IntegrationsPage: React.FC<{ category?: Category }> = ({ category }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const canManage = can(FEAT.INTEGRATIONS.id, FEAT.INTEGRATIONS.manage);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ category: string; provider: string; name: string }>({
    category: category ?? "crm",
    provider: "",
    name: "",
  });
  const [notice, setNotice] = useState("");
  const action = useAction();
  const res = useResource(() => integrationApi.list(category), [category]);
  const rows = res.data ?? [];
  const titleKey = category ? `m.integrations.title.${category}` : "m.integrations.title.centre";

  const create = async () => {
    const r = await action.run(() => integrationApi.create(form));
    if (r !== undefined) {
      setCreating(false);
      setNotice(t("m.integrations.created"));
      res.reload();
    }
  };
  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.integrations")}
        title={t(titleKey)}
        subtitle={t("m.integrations.subtitle")}
        actions={
          canManage && (
            <Button
              variant="primary"
              onClick={() => {
                action.clear();
                setForm({ category: category ?? "crm", provider: "", name: "" });
                setCreating(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("m.integrations.add")}
            </Button>
          )
        }
      />
      <div className="mb-3">
        <Notice>{t("m.integrations.providerNote")}</Notice>
      </div>
      {notice && (
        <div className="mb-3">
          <Notice>{notice}</Notice>
        </div>
      )}
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.integrations.empty")}
      >
        <DataTable
          caption={t(titleKey)}
          rows={rows}
          rowKey={(i) => i.id}
          onRowClick={(i) => setOpenId(i.id)}
          columns={[
            {
              key: "n",
              header: t("common.name"),
              render: (i) => (
                <button
                  type="button"
                  className="font-semibold hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenId(i.id);
                  }}
                >
                  {i.name}
                </button>
              ),
            },
            {
              key: "c",
              header: t("m.integrations.category"),
              render: (i) => t(`m.integrations.cat.${i.category}`, { defaultValue: i.category }),
            },
            { key: "p", header: t("m.integrations.provider"), render: (i) => i.provider },
            {
              key: "s",
              header: t("common.status"),
              render: (i) => <StatusBadge code={i.status} />,
            },
            {
              key: "l",
              header: t("m.integrations.lastSync"),
              render: (i) => (i.last_sync_at ? f.relative(i.last_sync_at) : t("common.never")),
            },
          ]}
        />
      </PageState>
      <IntegrationDrawer id={openId} onClose={() => setOpenId(null)} onChanged={res.reload} />
      <Modal
        open={creating}
        title={t("m.integrations.add")}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              busy={action.busy}
              disabled={!form.provider.trim() || !form.name.trim()}
              onClick={create}
            >
              {t("common.create")}
            </Button>
          </>
        }
      >
        {!category && (
          <SelectInput
            label={t("m.integrations.category")}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {INTEGRATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`m.integrations.cat.${c}`)}
              </option>
            ))}
          </SelectInput>
        )}
        <TextInput
          label={t("m.integrations.provider")}
          value={form.provider}
          onChange={(e) => setForm({ ...form, provider: e.target.value })}
        />
        <TextInput
          label={t("common.name")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {action.error ? <ErrorBox error={action.error} /> : null}
      </Modal>
    </div>
  );
};

export const CrmIntegrationPage: React.FC = () => <IntegrationsPage category="crm" />;
export const CmsIntegrationPage: React.FC = () => <IntegrationsPage category="cms" />;
