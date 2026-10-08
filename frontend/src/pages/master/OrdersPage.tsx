import React, { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { orderApi } from "../../api/orders.api";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  Card,
  DataTable,
  EmptyBox,
  FilterBar,
  KV,
  PageHeader,
  PageState,
  Pager,
  SelectInput,
  StatusBadge,
  TextInput,
} from "../../components/master/ui";
import { useMasterScope } from "../../components/master/MasterContext";
import { useResource } from "../../components/master/useResource";

const ORDER_STATUSES = [
  "new",
  "in_billing",
  "sent_to_kitchen",
  "ready",
  "awaiting_payment",
  "paid",
  "delivered",
  "cancelled",
];

export const OrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const scope = useMasterScope();
  const org = params.get("org") || scope.orgId;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const res = useResource(
    () => orderApi.list({ org, status, channel, q, from, to, page }),
    [org, status, channel, q, from, to, page]
  );
  const rows = res.data?.items ?? [];
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.operations")}
        title={t("m.orders.title")}
        subtitle={t("m.orders.subtitle")}
      />
      <FilterBar>
        <TextInput
          label={t("common.search")}
          type="search"
          value={q}
          placeholder={t("m.orders.searchPlaceholder")}
          onChange={(e) => reset(setQ)(e.target.value)}
        />
        <SelectInput
          label={t("common.status")}
          value={status}
          onChange={(e) => reset(setStatus)(e.target.value)}
        >
          <option value="all">{t("common.all")}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </SelectInput>
        <TextInput
          label={t("m.orders.channel")}
          value={channel}
          onChange={(e) => reset(setChannel)(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <TextInput
            label={t("m.orders.from")}
            type="date"
            value={from}
            onChange={(e) => reset(setFrom)(e.target.value)}
          />
          <TextInput
            label={t("m.orders.to")}
            type="date"
            value={to}
            onChange={(e) => reset(setTo)(e.target.value)}
          />
        </div>
      </FilterBar>
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.orders.empty")}
      >
        <DataTable
          caption={t("m.orders.title")}
          rows={rows}
          rowKey={(o) => o.id}
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          columns={[
            {
              key: "n",
              header: t("m.orders.number"),
              render: (o) => (
                <Link
                  className="font-semibold text-slate-900 hover:underline"
                  to={`/orders/${o.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {o.number ?? o.id}
                </Link>
              ),
            },
            {
              key: "o",
              header: t("m.orders.organization"),
              render: (o) => o.organization_name ?? t("common.dash"),
            },
            {
              key: "c",
              header: t("m.orders.channel"),
              render: (o) => o.channel ?? t("common.dash"),
            },
            {
              key: "s",
              header: t("common.status"),
              render: (o) => <StatusBadge code={o.status} />,
            },
            {
              key: "t",
              header: t("common.total"),
              render: (o) =>
                o.total
                  ? f.moneyMinor(o.total.amount_minor, { currency: o.total.currency })
                  : t("common.dash"),
            },
            { key: "d", header: t("common.date"), render: (o) => f.dateTime(o.created_at) },
          ]}
        />
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
      </PageState>
    </div>
  );
};

export const Order360Page: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const { id = "" } = useParams();
  const res = useResource(() => orderApi.get(id), [id]);
  const o = res.data;
  return (
    <div>
      <PageHeader
        eyebrow={t("m.orders.title")}
        title={o ? t("m.orders.detailTitle", { number: o.number ?? o.id }) : t("m.orders.detail")}
        actions={
          <Link to="/orders">
            <Button>{t("common.back")}</Button>
          </Link>
        }
      />
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={!o}
      >
        {o && (
          <div className="space-y-4">
            <Card>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KV label={t("common.status")}>
                  <StatusBadge code={o.status} />
                </KV>
                <KV label={t("m.orders.organization")}>
                  {o.organization_name ?? t("common.dash")}
                </KV>
                <KV label={t("m.orders.channel")}>{o.channel ?? t("common.dash")}</KV>
                <KV label={t("common.total")}>
                  {o.total
                    ? f.moneyMinor(o.total.amount_minor, { currency: o.total.currency })
                    : t("common.dash")}
                </KV>
                <KV label={t("m.orders.payment")}>
                  <StatusBadge code={o.payment_status} />
                </KV>
                <KV label={t("m.orders.delivery")}>
                  <StatusBadge code={o.delivery_status} />
                </KV>
                <KV label={t("m.orders.customer")}>{o.customer_name ?? t("common.dash")}</KV>
                <KV label={t("common.date")}>{f.dateTime(o.created_at)}</KV>
              </dl>
            </Card>
            {(o.items ?? []).length > 0 && (
              <Card title={t("m.orders.items")}>
                <ul className="divide-y divide-slate-100 text-xs">
                  {(o.items ?? []).map((it, i) => (
                    <li key={i} className="flex justify-between py-1.5">
                      <span>
                        {it.quantity} × {it.name}
                      </span>
                      <span>
                        {it.total
                          ? f.moneyMinor(it.total.amount_minor, { currency: it.total.currency })
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card title={t("m.orders.timeline")}>
              {o.timeline.length === 0 ? (
                <EmptyBox text={t("m.orders.noTimeline")} />
              ) : (
                <ol
                  aria-label={t("m.orders.timeline")}
                  className="space-y-3 border-l-2 border-slate-200 pl-4"
                >
                  {o.timeline.map((e) => (
                    <li key={e.id} className="relative text-xs">
                      <span
                        className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-[#65D000]"
                        aria-hidden="true"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-slate-800">{e.kind}</b>
                        {e.status && <StatusBadge code={e.status} />}
                        <span className="text-slate-400">{f.dateTime(e.at)}</span>
                      </div>
                      {(e.actor || e.note) && (
                        <div className="text-slate-500">
                          {[e.actor, e.note].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            {o.order_trace && (
              <details className="rounded-2xl border border-slate-200/90 bg-white p-4 text-xs">
                <summary className="cursor-pointer font-bold text-slate-800">
                  {t("m.orders.trace")}
                </summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px]">
                  {JSON.stringify(o.order_trace, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </PageState>
    </div>
  );
};
