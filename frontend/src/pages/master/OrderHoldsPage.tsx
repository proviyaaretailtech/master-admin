import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { HOLD_STATUSES, orderHoldApi } from "../../api/order-holds.api";
import type { HoldDecision, HoldReason, OrderHoldRow } from "../../api/order-holds.api";
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
  TextInput,
} from "../../components/master/ui";
import { useAction, useResource } from "../../components/master/useResource";

/** One sentence per hold reason (One Local server/order-risk.ts codes); unknown codes show as the code. */
const ReasonText: React.FC<{ r: HoldReason }> = ({ r }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
  const params = {
    item: String(r.item ?? ""),
    qty: f.number(n(r.qty)),
    limit:
      r.code === "cash_total" || r.code === "first_cash_total"
        ? f.money(n(r.limit))
        : f.number(n(r.limit)),
    total: f.money(n(r.total)),
    recent: f.number(n(r.recent)),
  };
  return <>{t(`m.holds.reason.${r.code}`, { ...params, defaultValue: r.code })}</>;
};

const HoldDrawer: React.FC<{ id: string | null; onClose: () => void; onChanged: () => void }> = ({
  id,
  onClose,
  onChanged,
}) => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const canDecide = can(FEAT.ORDERS.id, FEAT.ORDERS.decideHolds);
  const [pending, setPending] = useState<HoldDecision | null>(null);
  const [done, setDone] = useState<HoldDecision | null>(null);
  const action = useAction();
  const res = useResource(() => orderHoldApi.get(id as string), [id], { enabled: Boolean(id) });
  const h = res.data;
  const dash = t("common.dash");

  const confirm = async (reason: string) => {
    if (!pending || !id) return;
    const out = await action.run(() => orderHoldApi.decide(id, pending, reason));
    if (out !== undefined) {
      setDone(pending);
      setPending(null);
      onChanged();
      res.reload();
    }
  };
  const close = () => {
    setDone(null);
    onClose();
  };

  return (
    <>
      <Drawer open={Boolean(id)} title={t("m.holds.drawerTitle")} onClose={close}>
        <PageState
          loading={res.loading}
          error={res.error}
          denied={res.denied}
          onRetry={res.reload}
          empty={!h}
        >
          {h && (
            <div className="space-y-4">
              {done && <Notice>{t(`m.holds.done.${done}`)}</Notice>}
              <dl className="grid gap-3 sm:grid-cols-2">
                <KV label={t("common.status")}>
                  <StatusBadge code={h.status} />
                </KV>
                <KV label={t("m.holds.heldAt")}>{f.dateTime(h.created_at)}</KV>
                <KV label={t("m.holds.store")}>{h.store_name ?? h.organization_name ?? dash}</KV>
                <KV label={t("m.holds.city")}>{h.city_id ?? dash}</KV>
                <KV label={t("common.total")}>
                  {f.moneyMinor(h.total.amount_minor, { currency: h.total.currency })}
                </KV>
                <KV label={t("m.holds.payment")}>
                  {[h.payment_method, h.payment_status].filter(Boolean).join(" · ") || dash}
                </KV>
                <KV label={t("m.holds.order")}>
                  <span className="break-all font-mono text-[11px]">{h.order_id}</span>
                </KV>
                {h.decided_at && (
                  <KV label={t("m.holds.decidedAt")}>
                    {f.dateTime(h.decided_at)}
                    {h.decided_by_name ? ` · ${h.decided_by_name}` : ""}
                  </KV>
                )}
                {h.note && <KV label={t("common.reason")}>{h.note}</KV>}
              </dl>
              <section>
                <h3 className="mb-1 text-xs font-bold text-slate-700">{t("m.holds.why")}</h3>
                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                  {h.reasons.map((r, i) => (
                    <li key={`${r.code}-${i}`}>
                      <ReasonText r={r} />
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-bold text-slate-700">{t("m.holds.items")}</h3>
                {h.items.length === 0 ? (
                  <p className="text-xs text-slate-500">{dash}</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {h.items.map((it, i) => (
                      <li key={`${it.name}-${i}`} className="flex justify-between gap-3">
                        <span>
                          {f.number(it.qty)} × {it.name}
                        </span>
                        <span>
                          {it.line_total
                            ? f.moneyMinor(it.line_total.amount_minor, {
                                currency: it.line_total.currency,
                              })
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {canDecide && h.status === "held" && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button
                    variant="primary"
                    onClick={() => {
                      action.clear();
                      setPending("release");
                    }}
                  >
                    {t("m.holds.action.release")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      action.clear();
                      setPending("reject");
                    }}
                  >
                    {t("m.holds.action.reject")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </PageState>
      </Drawer>
      <ReasonDialog
        open={pending !== null}
        required
        danger={pending === "reject"}
        title={pending ? t(`m.holds.dialog.${pending}.title`) : ""}
        description={pending ? t(`m.holds.dialog.${pending}.body`) : undefined}
        confirmLabel={pending ? t(`m.holds.action.${pending}`) : ""}
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

export const OrderHoldsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const [status, setStatus] = useState("held");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const res = useResource(() => orderHoldApi.list({ status, q, page }), [status, q, page], {
    refreshMs: 30000,
  });
  const rows: OrderHoldRow[] = res.data?.items ?? [];
  const counts = res.data?.counts ?? {};
  const dash = t("common.dash");

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.operations")}
        title={t("m.holds.title")}
        subtitle={t("m.holds.subtitle")}
      />
      <FilterBar>
        <TextInput
          label={t("common.search")}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t("m.holds.searchPlaceholder")}
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
          {HOLD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
              {counts[s] !== undefined ? ` (${f.number(counts[s])})` : ""}
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
        emptyText={t("m.holds.empty")}
      >
        <DataTable
          caption={t("m.holds.title")}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          columns={[
            {
              key: "t",
              header: t("m.holds.heldAt"),
              render: (r) => (
                <button
                  type="button"
                  className="text-left font-semibold text-slate-900 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenId(r.id);
                  }}
                >
                  {f.dateTime(r.created_at)}
                </button>
              ),
            },
            {
              key: "s",
              header: t("m.holds.store"),
              render: (r) => r.store_name ?? r.organization_name ?? dash,
            },
            {
              key: "a",
              header: t("common.total"),
              render: (r) => f.moneyMinor(r.total.amount_minor, { currency: r.total.currency }),
            },
            {
              key: "i",
              header: t("m.holds.items"),
              render: (r) => f.number(r.item_qty),
            },
            {
              key: "w",
              header: t("m.holds.why"),
              render: (r) => (
                <span className="text-xs">
                  {r.reasons.map((x, i) => (
                    <span key={`${x.code}-${i}`} className="block">
                      <ReasonText r={x} />
                    </span>
                  ))}
                </span>
              ),
            },
            {
              key: "st",
              header: t("common.status"),
              render: (r) => <StatusBadge code={r.status} />,
            },
          ]}
        />
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
      </PageState>
      <HoldDrawer id={openId} onClose={() => setOpenId(null)} onChanged={res.reload} />
    </div>
  );
};
