import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { organizationOpsApi } from "../../api/organization-ops.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  Card,
  DataTable,
  EmptyBox,
  KV,
  Notice,
  PageHeader,
  PageState,
  ReasonDialog,
  StatusBadge,
  TabPanel,
  Tabs,
} from "../../components/master/ui";
import { TopbarAction } from "../../components/master/TopbarSlot";
import { useAction, useResource } from "../../components/master/useResource";

type Lifecycle = "suspend" | "reactivate" | "archive" | "restore" | "ordering";
const TAB_IDS = [
  "overview",
  "members",
  "locations",
  "subscription",
  "ordering",
  "orders",
  "audit",
] as const;

export const Organization360OpsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const { id = "" } = useParams();
  const { can } = usePermissions();
  const canSuspend = can(FEAT.ORG_OPS.id, FEAT.ORG_OPS.suspend);
  const canArchive = can(FEAT.ORG_OPS.id, FEAT.ORG_OPS.archive);
  const canOrdering = can(FEAT.ORG_OPS.id, FEAT.ORG_OPS.ordering);
  const canPlan = can(FEAT.SUBSCRIPTION.id, FEAT.SUBSCRIPTION.plan);
  const [tab, setTab] = useState<string>("overview");
  const [dialog, setDialog] = useState<Lifecycle | null>(null);
  const [done, setDone] = useState(false);
  const action = useAction();

  const res = useResource(() => organizationOpsApi.get360(id), [id]);
  const ent = useResource(() => organizationOpsApi.getEntitlements(id), [id], {
    enabled: tab === "subscription",
  });
  const o = res.data;

  const confirm = async (reason: string) => {
    if (!dialog || !o) return;
    const calls: Record<Lifecycle, () => Promise<unknown>> = {
      suspend: () => organizationOpsApi.suspend(id, reason),
      reactivate: () => organizationOpsApi.reactivate(id, reason),
      archive: () => organizationOpsApi.archive(id, reason),
      restore: () => organizationOpsApi.restore(id, reason),
      ordering: () => organizationOpsApi.setOrdering(id, !o.ordering.accepting, reason),
    };
    const r = await action.run(calls[dialog]);
    if (r !== undefined) {
      setDialog(null);
      setDone(true);
      res.reload();
    }
  };

  const archived = Boolean(o?.archived_at);
  const suspended = (o?.status ?? "").toLowerCase() === "suspended";

  return (
    <div>
      <PageHeader
        eyebrow={t("m.org360.eyebrow")}
        title={o?.business_name ?? t("m.org360.title")}
        subtitle={o?.domain}
        actions={
          o ? (
            <>
              {archived ? (
                canArchive && (
                  <Button onClick={() => setDialog("restore")}>{t("m.org360.restore")}</Button>
                )
              ) : (
                <>
                  {canSuspend &&
                    (suspended ? (
                      <Button onClick={() => setDialog("reactivate")}>
                        {t("m.org360.reactivate")}
                      </Button>
                    ) : (
                      <Button variant="danger" onClick={() => setDialog("suspend")}>
                        {t("m.org360.suspend")}
                      </Button>
                    ))}
                  {canArchive && (
                    <Button onClick={() => setDialog("archive")}>{t("m.org360.archive")}</Button>
                  )}
                </>
              )}
            </>
          ) : undefined
        }
      />
      {o && canPlan && (
        <TopbarAction>
          <Link
            to={`/organizations/${id}/change-plan`}
            className="text-xs font-semibold text-[#337400] underline"
          >
            {t("m.plan.title")}
          </Link>
        </TopbarAction>
      )}
      {done && (
        <div className="mb-3">
          <Notice>{t("m.org360.updated")}</Notice>
        </div>
      )}
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={!o}
      >
        {o && (
          <>
            <Tabs
              label={t("m.org360.tabs")}
              active={tab}
              onChange={setTab}
              tabs={TAB_IDS.map((x) => ({ id: x, label: t(`m.org360.tab.${x}`) }))}
            />
            <TabPanel id="overview" active={tab}>
              <Card>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <KV label={t("common.status")}>
                    <StatusBadge code={archived ? "archived" : o.status} />
                  </KV>
                  <KV label={t("common.email")}>{o.email ?? t("common.dash")}</KV>
                  <KV label={t("common.phone")}>{o.phone_number ?? t("common.dash")}</KV>
                  <KV label={t("m.org360.openOrders")}>{f.number(o.open_orders ?? 0)}</KV>
                  <KV label={t("m.org360.orders30d")}>{f.number(o.orders_30d ?? 0)}</KV>
                  <KV label={t("m.org360.gmv30d")}>
                    {o.gmv_30d
                      ? f.moneyMinor(o.gmv_30d.amount_minor, { currency: o.gmv_30d.currency })
                      : t("common.dash")}
                  </KV>
                  <KV label={t("m.org360.created")}>{f.date(o.created_at)}</KV>
                </dl>
              </Card>
            </TabPanel>
            <TabPanel id="members" active={tab}>
              {o.member_counts && o.member_counts.total > 0 && (
                <div className="mb-3">
                  <Card>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <KV label={t("m.org360.membersActive")}>
                        {f.number(o.member_counts.active)}
                      </KV>
                      <KV label={t("m.org360.membersTotal")}>{f.number(o.member_counts.total)}</KV>
                    </dl>
                    <Link
                      className="mt-3 inline-block text-xs font-semibold text-[#337400] underline"
                      to="/invitations"
                    >
                      {t("m.org360.manageMembers")}
                    </Link>
                  </Card>
                </div>
              )}
              {o.members.length === 0 ? (
                <EmptyBox text={t("m.org360.noMembers")} />
              ) : (
                <DataTable
                  caption={t("m.org360.tab.members")}
                  rows={o.members}
                  rowKey={(m) => m.id}
                  columns={[
                    { key: "n", header: t("common.name"), render: (m) => m.name },
                    { key: "e", header: t("common.email"), render: (m) => m.email },
                    {
                      key: "r",
                      header: t("m.org360.role"),
                      render: (m) => m.role ?? t("common.dash"),
                    },
                    {
                      key: "s",
                      header: t("common.status"),
                      render: (m) => <StatusBadge code={m.status} />,
                    },
                  ]}
                />
              )}
            </TabPanel>
            <TabPanel id="locations" active={tab}>
              {o.locations.length === 0 ? (
                <EmptyBox text={t("m.org360.noLocations")} />
              ) : (
                <DataTable
                  caption={t("m.org360.tab.locations")}
                  rows={o.locations}
                  rowKey={(l) => l.id}
                  columns={[
                    { key: "n", header: t("common.name"), render: (l) => l.name },
                    {
                      key: "c",
                      header: t("m.org360.city"),
                      render: (l) => l.city ?? t("common.dash"),
                    },
                    {
                      key: "s",
                      header: t("common.status"),
                      render: (l) => <StatusBadge code={l.status} />,
                    },
                  ]}
                />
              )}
            </TabPanel>
            <TabPanel id="subscription" active={tab}>
              <Card
                title={t("m.org360.subscription")}
                actions={
                  canPlan && (
                    <Link
                      className="text-xs font-semibold text-[#337400] underline"
                      to={`/organizations/${id}/change-plan`}
                    >
                      {t("m.plan.title")}
                    </Link>
                  )
                }
              >
                <dl className="mb-4 grid gap-4 sm:grid-cols-3">
                  <KV label={t("m.org360.plan")}>
                    {o.plan ? `${o.plan.name ?? o.plan.code} (${o.plan.code})` : t("common.dash")}
                  </KV>
                  <KV label={t("common.status")}>
                    <StatusBadge code={o.plan?.status} />
                  </KV>
                  <KV label={t("m.org360.since")}>
                    {o.plan?.since ? f.date(o.plan.since) : t("common.dash")}
                  </KV>
                </dl>
                <PageState
                  loading={ent.loading}
                  error={ent.error}
                  denied={ent.denied}
                  onRetry={ent.reload}
                  empty={(ent.data?.modules ?? []).length === 0}
                  emptyText={t("m.org360.noEntitlements")}
                >
                  <ul className="grid gap-2 sm:grid-cols-2" aria-label={t("m.org360.entitlements")}>
                    {(ent.data?.modules ?? []).map((m) => (
                      <li
                        key={m.key}
                        className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs"
                      >
                        <span>{m.name ?? m.key}</span>
                        <StatusBadge code={m.enabled ? "enabled" : "disabled"} />
                      </li>
                    ))}
                  </ul>
                </PageState>
              </Card>
            </TabPanel>
            <TabPanel id="ordering" active={tab}>
              <Card title={t("m.org360.orderingTitle")}>
                <p className="mb-3 text-xs text-slate-600">
                  {o.ordering.accepting ? t("m.org360.orderingOpen") : t("m.org360.orderingPaused")}
                  {o.ordering.reason ? ` — ${o.ordering.reason}` : ""}
                </p>
                {canOrdering && (
                  <Button
                    variant={o.ordering.accepting ? "danger" : "primary"}
                    onClick={() => setDialog("ordering")}
                  >
                    {o.ordering.accepting
                      ? t("m.org360.pauseOrdering")
                      : t("m.org360.resumeOrdering")}
                  </Button>
                )}
              </Card>
            </TabPanel>
            <TabPanel id="orders" active={tab}>
              {(o.recent_orders ?? []).length === 0 ? (
                <EmptyBox text={t("m.org360.noOrders")} />
              ) : (
                <DataTable
                  caption={t("m.org360.tab.orders")}
                  rows={o.recent_orders ?? []}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      key: "n",
                      header: t("m.orders.number"),
                      render: (r) => (
                        <Link className="font-semibold hover:underline" to={`/orders/${r.id}`}>
                          {r.number ?? r.id}
                        </Link>
                      ),
                    },
                    {
                      key: "s",
                      header: t("common.status"),
                      render: (r) => <StatusBadge code={r.status} />,
                    },
                    {
                      key: "t",
                      header: t("common.total"),
                      render: (r) =>
                        r.total
                          ? f.moneyMinor(r.total.amount_minor, { currency: r.total.currency })
                          : t("common.dash"),
                    },
                    { key: "d", header: t("common.date"), render: (r) => f.dateTime(r.created_at) },
                  ]}
                />
              )}
              <div className="mt-3">
                <Link
                  className="text-xs font-semibold text-[#337400] underline"
                  to={`/orders?org=${id}`}
                >
                  {t("m.org360.allOrders")}
                </Link>
              </div>
            </TabPanel>
            <TabPanel id="audit" active={tab}>
              {(o.audit ?? []).length === 0 ? (
                <EmptyBox text={t("m.org360.noAudit")} />
              ) : (
                <DataTable
                  caption={t("m.org360.tab.audit")}
                  rows={o.audit ?? []}
                  rowKey={(r) => r.id}
                  columns={[
                    { key: "d", header: t("common.date"), render: (r) => f.dateTime(r.created_at) },
                    { key: "a", header: t("m.audit.action"), render: (r) => r.action },
                    {
                      key: "u",
                      header: t("m.audit.actor"),
                      render: (r) => r.actor ?? t("common.dash"),
                    },
                  ]}
                />
              )}
              <div className="mt-3">
                <Link
                  className="text-xs font-semibold text-[#337400] underline"
                  to={`/access-control/audit-logs?org=${id}`}
                >
                  {t("m.org360.fullAudit")}
                </Link>
              </div>
            </TabPanel>
          </>
        )}
      </PageState>
      <ReasonDialog
        open={dialog !== null}
        title={dialog ? t(`m.org360.dialog.${dialog}.title`) : ""}
        description={
          dialog ? t(`m.org360.dialog.${dialog}.body`, { name: o?.business_name ?? "" }) : undefined
        }
        confirmLabel={dialog ? t(`m.org360.dialog.${dialog}.confirm`) : ""}
        danger={
          dialog === "suspend" ||
          dialog === "archive" ||
          (dialog === "ordering" && Boolean(o?.ordering.accepting))
        }
        busy={action.busy}
        error={action.error}
        onConfirm={confirm}
        onClose={() => {
          setDialog(null);
          action.clear();
        }}
      />
    </div>
  );
};
