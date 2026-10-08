import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { financeApi } from "../../api/finance.api";
import type { Money } from "../../api/_http";
import { useFormat } from "../../i18n/useFormat";
import {
  Card,
  DataTable,
  FilterBar,
  PageHeader,
  PageState,
  Pager,
  StatusBadge,
  TabPanel,
  Tabs,
  TextInput,
} from "../../components/master/ui";
import { useResource } from "../../components/master/useResource";

const TABS = ["overview", "payments", "ledger", "reconciliation", "riderEarnings"] as const;

const Overview: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const res = useResource(() => financeApi.overview({ from, to }), [from, to]);
  const d = res.data;
  const kpi = (key: string, m?: Money) => (
    <Card key={key}>
      <div className="text-[11px] font-bold uppercase text-slate-400">
        {t(`m.finance.kpi.${key}`)}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900" data-testid={`kpi-${key}`}>
        {m ? f.moneyMinor(m.amount_minor, { currency: m.currency }) : t("common.dash")}
      </div>
      <div className="text-[11px] text-slate-500">{t(`m.finance.kpi.${key}Hint`)}</div>
    </Card>
  );
  return (
    <div>
      <FilterBar>
        <TextInput
          label={t("m.orders.from")}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextInput
          label={t("m.orders.to")}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </FilterBar>
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={!d}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpi("collected", d?.collected)}
          {kpi("earned", d?.earned)}
          {kpi("owed", d?.owed)}
          {kpi("paid", d?.paid)}
        </div>
        <div className="mt-4 text-xs">
          <Link className="font-semibold text-[#337400] underline" to="/finance/settlements">
            {t("m.finance.toSettlements")}
          </Link>
        </div>
      </PageState>
    </div>
  );
};

const Payments: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const res = useResource(() => financeApi.payments({ page }), [page]);
  const rows = res.data?.items ?? [];
  return (
    <PageState
      loading={res.loading}
      error={res.error}
      denied={res.denied}
      onRetry={res.reload}
      empty={rows.length === 0}
      emptyText={t("m.finance.noPayments")}
    >
      <DataTable
        caption={t("m.finance.tab.payments")}
        rows={rows}
        rowKey={(p) => p.id}
        columns={[
          {
            key: "o",
            header: t("m.orders.number"),
            render: (p) =>
              p.order_id ? (
                <Link className="hover:underline" to={`/orders/${p.order_id}`}>
                  {p.order_id}
                </Link>
              ) : (
                t("common.dash")
              ),
          },
          { key: "m", header: t("m.finance.method"), render: (p) => p.method ?? t("common.dash") },
          {
            key: "a",
            header: t("common.amount"),
            render: (p) => f.moneyMinor(p.amount.amount_minor, { currency: p.amount.currency }),
          },
          { key: "s", header: t("common.status"), render: (p) => <StatusBadge code={p.status} /> },
          { key: "d", header: t("common.date"), render: (p) => f.dateTime(p.created_at) },
        ]}
      />
      <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
    </PageState>
  );
};

const Ledger: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const [orderId, setOrderId] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const res = useResource(
    () => financeApi.ledger({ order_id: orderId, type, page }),
    [orderId, type, page]
  );
  const rows = res.data?.items ?? [];
  return (
    <div>
      <FilterBar>
        <TextInput
          label={t("m.finance.orderId")}
          value={orderId}
          onChange={(e) => {
            setOrderId(e.target.value);
            setPage(1);
          }}
        />
        <TextInput
          label={t("common.type")}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
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
        emptyText={t("m.finance.noLedger")}
      >
        <DataTable
          caption={t("m.finance.tab.ledger")}
          rows={rows}
          rowKey={(e) => e.id}
          columns={[
            { key: "d", header: t("common.date"), render: (e) => f.dateTime(e.created_at) },
            { key: "t", header: t("common.type"), render: (e) => e.type },
            {
              key: "o",
              header: t("m.orders.number"),
              render: (e) => e.order_id ?? t("common.dash"),
            },
            {
              key: "dir",
              header: t("m.finance.direction"),
              render: (e) => (e.direction ? t(`m.finance.dir.${e.direction}`) : t("common.dash")),
            },
            {
              key: "a",
              header: t("common.amount"),
              render: (e) => f.moneyMinor(e.amount.amount_minor, { currency: e.amount.currency }),
            },
          ]}
        />
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
      </PageState>
    </div>
  );
};

const Reconciliation: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const res = useResource(() => financeApi.reconciliation(), []);
  const rows = res.data ?? [];
  const m = (x?: Money) =>
    x ? f.moneyMinor(x.amount_minor, { currency: x.currency }) : t("common.dash");
  return (
    <PageState
      loading={res.loading}
      error={res.error}
      denied={res.denied}
      onRetry={res.reload}
      empty={rows.length === 0}
      emptyText={t("m.finance.noRecon")}
    >
      <p className="mb-2 text-xs text-slate-500">{t("m.finance.reconNote")}</p>
      <DataTable
        caption={t("m.finance.tab.reconciliation")}
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: "l", header: t("m.finance.check"), render: (r) => r.label },
          { key: "e", header: t("m.finance.expected"), render: (r) => m(r.expected) },
          { key: "a", header: t("m.finance.actual"), render: (r) => m(r.actual) },
          { key: "x", header: t("m.finance.difference"), render: (r) => m(r.difference) },
          { key: "s", header: t("common.status"), render: (r) => <StatusBadge code={r.status} /> },
        ]}
      />
    </PageState>
  );
};

const RiderEarnings: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const res = useResource(() => financeApi.riderEarnings(), []);
  const rows = res.data ?? [];
  return (
    <PageState
      loading={res.loading}
      error={res.error}
      denied={res.denied}
      onRetry={res.reload}
      empty={rows.length === 0}
      emptyText={t("m.finance.noEarnings")}
    >
      <DataTable
        caption={t("m.finance.tab.riderEarnings")}
        rows={rows}
        rowKey={(r) => r.rider_id}
        columns={[
          {
            key: "n",
            header: t("m.riders.rider"),
            render: (r) => (
              <Link className="hover:underline" to={`/riders?open=${r.rider_id}`}>
                {r.rider_name ?? r.rider_id}
              </Link>
            ),
          },
          { key: "d", header: t("m.riders.deliveries"), render: (r) => f.number(r.deliveries) },
          {
            key: "e",
            header: t("m.finance.kpi.earned"),
            render: (r) => f.moneyMinor(r.earned.amount_minor, { currency: r.earned.currency }),
          },
          {
            key: "p",
            header: t("m.finance.kpi.paid"),
            render: (r) => f.moneyMinor(r.paid.amount_minor, { currency: r.paid.currency }),
          },
          {
            key: "o",
            header: t("m.finance.kpi.owed"),
            render: (r) => f.moneyMinor(r.owed.amount_minor, { currency: r.owed.currency }),
          },
        ]}
      />
    </PageState>
  );
};

export const FinanceControlPage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>("overview");
  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.finance")}
        title={t("m.finance.title")}
        subtitle={t("m.finance.subtitle")}
      />
      <Tabs
        label={t("m.finance.title")}
        active={tab}
        onChange={setTab}
        tabs={TABS.map((x) => ({ id: x, label: t(`m.finance.tab.${x}`) }))}
      />
      <TabPanel id="overview" active={tab}>
        <Overview />
      </TabPanel>
      <TabPanel id="payments" active={tab}>
        <Payments />
      </TabPanel>
      <TabPanel id="ledger" active={tab}>
        <Ledger />
      </TabPanel>
      <TabPanel id="reconciliation" active={tab}>
        <Reconciliation />
      </TabPanel>
      <TabPanel id="riderEarnings" active={tab}>
        <RiderEarnings />
      </TabPanel>
    </div>
  );
};
