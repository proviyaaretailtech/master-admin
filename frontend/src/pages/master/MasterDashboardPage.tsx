import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dashboardApi } from "../../api/dashboard.api";
import { useFormat } from "../../i18n/useFormat";
import { Button, FilterBar, PageHeader, PageState, TextInput } from "../../components/master/ui";
import { useResource } from "../../components/master/useResource";

const REFRESH_MS = 30000;

export const MasterDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const res = useResource(() => dashboardApi.summary({ from, to }), [from, to], {
    refreshMs: REFRESH_MS,
  });
  const d = res.data;

  const tiles: Array<{ key: string; value: string; to: string; alert?: boolean }> = d
    ? [
        { key: "ordersToday", value: f.number(d.orders_today), to: "/orders" },
        {
          key: "gmv",
          value: f.moneyMinor(d.gmv.amount_minor, { currency: d.gmv.currency }),
          to: "/finance",
        },
        { key: "ridersOnline", value: f.number(d.riders_online), to: "/riders" },
        { key: "activeDeliveries", value: f.number(d.active_deliveries), to: "/dispatch" },
        {
          key: "failedDeliveries",
          value: f.number(d.failed_deliveries),
          to: "/dispatch?status=exception",
          alert: d.failed_deliveries > 0,
        },
        {
          key: "lateDeliveries",
          value: f.number(d.late_deliveries),
          to: "/dispatch",
          alert: d.late_deliveries > 0,
        },
        {
          key: "pendingApprovals",
          value: f.number(d.pending_approvals),
          to: "/finance/settlements",
          alert: d.pending_approvals > 0,
        },
        {
          key: "openExceptions",
          value: f.number(d.open_exceptions),
          to: "/dispatch?status=exception",
          alert: d.open_exceptions > 0,
        },
        {
          key: "settlementsPending",
          value: f.number(d.settlements_pending),
          to: "/finance/settlements",
        },
        {
          key: "payoutsPending",
          value: f.number(d.payouts_pending),
          to: "/finance/settlements?tab=payouts",
        },
        {
          key: "failedPayments",
          value: f.number(d.failed_payments),
          to: "/finance",
          alert: d.failed_payments > 0,
        },
      ]
    : [];

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.overview")}
        title={t("m.dashboard.title")}
        subtitle={t("m.dashboard.subtitle", { seconds: REFRESH_MS / 1000 })}
        actions={<Button onClick={res.reload}>{t("m.dashboard.refresh")}</Button>}
      />
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
        <ul
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label={t("m.dashboard.title")}
        >
          {tiles.map((k) => (
            <li key={k.key}>
              <Link
                to={k.to}
                className={`block rounded-2xl border bg-white p-4 shadow-2xs transition-colors hover:border-[#65D000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#65D000]/50 ${k.alert ? "border-red-200" : "border-slate-200/90"}`}
              >
                <div className="text-[11px] font-bold uppercase text-slate-400">
                  {t(`m.dashboard.kpi.${k.key}`)}
                </div>
                <div
                  className={`mt-1 text-2xl font-extrabold ${k.alert ? "text-red-600" : "text-slate-900"}`}
                  data-testid={`kpi-${k.key}`}
                >
                  {k.value}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </PageState>
    </div>
  );
};
