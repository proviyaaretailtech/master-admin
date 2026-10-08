import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { riderApi } from "../../api/riders.api";
import type { CashDeposit, RiderAction, RiderRow } from "../../api/riders.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  DataTable,
  Drawer,
  FilterBar,
  KV,
  Notice,
  PageHeader,
  PageState,
  Pager,
  ReasonDialog,
  SelectInput,
  StatusBadge,
  TabPanel,
  Tabs,
  TextInput,
} from "../../components/master/ui";
import { useAction, useResource } from "../../components/master/useResource";

const RIDER_STATUSES = [
  "draft",
  "submitted",
  "verification_pending",
  "approved",
  "rejected",
  "documents_expired",
  "suspended",
];
/** Which buttons to offer per status; the database still validates the transition. */
const ACTIONS_FOR: Record<string, RiderAction[]> = {
  draft: ["approve", "reject"],
  submitted: ["approve", "reject"],
  verification_pending: ["approve", "reject"],
  approved: ["suspend"],
  documents_expired: ["approve", "suspend"],
  suspended: ["reactivate"],
  rejected: [],
};

export const RiderDrawer: React.FC<{
  riderId: string | null;
  onClose: () => void;
  onChanged: () => void;
}> = ({ riderId, onClose, onChanged }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const allowed: Record<RiderAction, boolean> = {
    approve: can(FEAT.RIDERS.id, FEAT.RIDERS.approve),
    reject: can(FEAT.RIDERS.id, FEAT.RIDERS.reject),
    suspend: can(FEAT.RIDERS.id, FEAT.RIDERS.suspend),
    reactivate: can(FEAT.RIDERS.id, FEAT.RIDERS.reactivate),
  };
  const [pending, setPending] = useState<RiderAction | null>(null);
  const action = useAction();
  const res = useResource(() => riderApi.get(riderId as string), [riderId], {
    enabled: Boolean(riderId),
  });
  const r = res.data;

  const confirm = async (reason: string) => {
    if (!pending || !riderId) return;
    const out = await action.run(() => riderApi.act(riderId, pending, reason));
    if (out !== undefined) {
      setPending(null);
      onChanged();
      res.reload();
    }
  };
  const statusKey = (r?.status ?? "").toLowerCase();
  return (
    <>
      <Drawer
        open={Boolean(riderId)}
        title={r?.name ?? t("m.riders.drawerTitle")}
        onClose={onClose}
      >
        <PageState
          loading={res.loading}
          error={res.error}
          denied={res.denied}
          onRetry={res.reload}
          empty={!r}
        >
          {r && (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <KV label={t("common.status")}>
                  <StatusBadge code={r.status} />
                </KV>
                <KV label={t("m.riders.kyc")}>
                  <StatusBadge code={r.kyc_status} />
                </KV>
                <KV label={t("common.phone")}>{r.phone ?? t("common.dash")}</KV>
                <KV label={t("m.riders.city")}>{r.city ?? t("common.dash")}</KV>
                <KV label={t("m.riders.deliveries")}>{f.number(r.deliveries_total ?? 0)}</KV>
                <KV label={t("m.riders.cashInHand")}>
                  {r.cash_in_hand
                    ? f.moneyMinor(r.cash_in_hand.amount_minor, {
                        currency: r.cash_in_hand.currency,
                      })
                    : t("common.dash")}
                </KV>
                <KV label={t("m.riders.cashLimit")}>
                  {r.cash_limit
                    ? f.moneyMinor(r.cash_limit.amount_minor, { currency: r.cash_limit.currency })
                    : t("common.dash")}
                </KV>
                <KV label={t("m.riders.wallet")}>
                  {r.wallet_balance
                    ? f.moneyMinor(r.wallet_balance.amount_minor, {
                        currency: r.wallet_balance.currency,
                      })
                    : t("common.dash")}
                </KV>
              </dl>
              {(r.documents ?? []).length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-bold text-slate-700">
                    {t("m.riders.documents")}
                  </h3>
                  <ul className="space-y-1">
                    {(r.documents ?? []).map((d) => (
                      <li key={d.type} className="flex justify-between text-xs">
                        <span>{d.type}</span>
                        <StatusBadge code={d.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(r.history ?? []).length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-bold text-slate-700">{t("m.riders.history")}</h3>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {(r.history ?? []).map((h) => (
                      <li key={h.id}>
                        {f.dateTime(h.created_at)} — {h.action}
                        {h.reason ? ` (${h.reason})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(ACTIONS_FOR[statusKey] ?? []).some((a) => allowed[a]) && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {(ACTIONS_FOR[statusKey] ?? [])
                    .filter((a) => allowed[a])
                    .map((a) => (
                      <Button
                        key={a}
                        variant={a === "approve" || a === "reactivate" ? "primary" : "danger"}
                        onClick={() => {
                          action.clear();
                          setPending(a);
                        }}
                      >
                        {t(`m.riders.action.${a}`)}
                      </Button>
                    ))}
                </div>
              )}
            </>
          )}
        </PageState>
      </Drawer>
      <ReasonDialog
        open={pending !== null}
        required={pending !== "approve"}
        danger={pending === "reject" || pending === "suspend"}
        title={pending ? t(`m.riders.dialog.${pending}.title`) : ""}
        description={
          pending ? t(`m.riders.dialog.${pending}.body`, { name: r?.name ?? "" }) : undefined
        }
        confirmLabel={pending ? t(`m.riders.action.${pending}`) : ""}
        busy={action.busy}
        error={action.error}
        onConfirm={confirm}
        onClose={() => {
          setPending(null);
          action.clear();
        }}
      />
    </>
  );
};

const DepositsPanel: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const canCash = can(FEAT.RIDERS.id, FEAT.RIDERS.cash);
  const [status, setStatus] = useState("pending");
  const [target, setTarget] = useState<{ d: CashDeposit; kind: "confirm" | "reject" } | null>(null);
  const [notice, setNotice] = useState("");
  const action = useAction();
  const res = useResource(() => riderApi.deposits({ status }), [status]);
  const rows = res.data?.items ?? [];

  const submit = async (note: string) => {
    if (!target) return;
    const call = target.kind === "confirm" ? riderApi.confirmDeposit : riderApi.rejectDeposit;
    const r = await action.run(() => call(target.d.id, note));
    if (r !== undefined) {
      setTarget(null);
      setNotice(t(target.kind === "confirm" ? "m.deposits.confirmed" : "m.deposits.rejected"));
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
      <FilterBar>
        <SelectInput
          label={t("common.status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">{t("common.all")}</option>
          {["pending", "confirmed", "rejected"].map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </SelectInput>
      </FilterBar>
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.deposits.empty")}
      >
        <DataTable
          caption={t("m.deposits.title")}
          rows={rows}
          rowKey={(d) => d.id}
          columns={[
            { key: "r", header: t("m.riders.rider"), render: (d) => d.rider_name ?? d.rider_id },
            {
              key: "a",
              header: t("common.amount"),
              render: (d) => f.moneyMinor(d.amount.amount_minor, { currency: d.amount.currency }),
            },
            {
              key: "s",
              header: t("common.status"),
              render: (d) => <StatusBadge code={d.status} />,
            },
            { key: "d", header: t("common.date"), render: (d) => f.dateTime(d.created_at) },
            {
              key: "x",
              header: t("common.actions"),
              render: (d) =>
                canCash && d.status === "pending" ? (
                  <span className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        action.clear();
                        setTarget({ d, kind: "confirm" });
                      }}
                    >
                      {t("m.deposits.confirm")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        action.clear();
                        setTarget({ d, kind: "reject" });
                      }}
                    >
                      {t("m.deposits.reject")}
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
      </PageState>
      <ReasonDialog
        open={target !== null}
        required={target?.kind === "reject"}
        danger={target?.kind === "reject"}
        title={target ? t(`m.deposits.dialog.${target.kind}.title`) : ""}
        description={
          target
            ? t(`m.deposits.dialog.${target.kind}.body`, {
                name: target.d.rider_name ?? target.d.rider_id,
              })
            : undefined
        }
        reasonLabel={t("m.deposits.note")}
        confirmLabel={target ? t(`m.deposits.${target.kind}`) : ""}
        busy={action.busy}
        error={action.error}
        onConfirm={submit}
        onClose={() => {
          setTarget(null);
          action.clear();
        }}
      />
    </div>
  );
};

export const RidersPage: React.FC = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "deposits" ? "deposits" : "riders");
  const [status, setStatus] = useState("all");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(params.get("open"));

  useEffect(() => {
    const o = params.get("open");
    if (o) setOpenId(o);
  }, [params]);

  const res = useResource(() => riderApi.list({ status, city, q, page }), [status, city, q, page], {
    enabled: tab === "riders",
  });
  const rows: RiderRow[] = res.data?.items ?? [];
  const close = () => {
    setOpenId(null);
    if (params.get("open")) {
      params.delete("open");
      setParams(params, { replace: true });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.operations")}
        title={t("m.riders.title")}
        subtitle={t("m.riders.subtitle")}
      />
      <Tabs
        label={t("m.riders.tabs")}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "riders", label: t("m.riders.tab.riders") },
          { id: "deposits", label: t("m.riders.tab.deposits") },
        ]}
      />
      <TabPanel id="riders" active={tab}>
        <FilterBar>
          <TextInput
            label={t("common.search")}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t("m.riders.searchPlaceholder")}
          />
          <SelectInput
            label={t("common.status")}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t("common.all")}</option>
            {RIDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </SelectInput>
          <TextInput
            label={t("m.riders.city")}
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
          />
        </FilterBar>
        <PageState
          loading={res.loading}
          error={res.error}
          denied={res.denied}
          onRetry={res.reload}
          empty={rows.length === 0}
          emptyText={t("m.riders.empty")}
        >
          <DataTable
            caption={t("m.riders.title")}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpenId(r.id)}
            columns={[
              {
                key: "n",
                header: t("common.name"),
                render: (r) => (
                  <button
                    type="button"
                    className="font-semibold text-slate-900 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(r.id);
                    }}
                  >
                    {r.name}
                  </button>
                ),
              },
              { key: "p", header: t("common.phone"), render: (r) => r.phone ?? t("common.dash") },
              { key: "c", header: t("m.riders.city"), render: (r) => r.city ?? t("common.dash") },
              {
                key: "s",
                header: t("common.status"),
                render: (r) => <StatusBadge code={r.status} />,
              },
              {
                key: "k",
                header: t("m.riders.kyc"),
                render: (r) => <StatusBadge code={r.kyc_status} />,
              },
              {
                key: "o",
                header: t("m.riders.online"),
                render: (r) => (r.online ? t("common.yes") : t("common.no")),
              },
            ]}
          />
          <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
        </PageState>
      </TabPanel>
      <TabPanel id="deposits" active={tab}>
        <DepositsPanel />
      </TabPanel>
      <RiderDrawer riderId={openId} onClose={close} onChanged={res.reload} />
    </div>
  );
};
