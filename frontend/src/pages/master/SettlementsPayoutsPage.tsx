import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { financeApi } from "../../api/finance.api";
import type { Payout, Settlement } from "../../api/finance.api";
import type { Money } from "../../api/_http";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { todayIso } from "../../lib/units";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  ConfirmDialog,
  DataTable,
  ErrorBox,
  FilterBar,
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
import { useMasterScope } from "../../components/master/MasterContext";
import { useAction, useResource } from "../../components/master/useResource";

/** The payout sum, line by line: food due - clawback - commission - GST on commission - debt in = net (a shortfall is carried as debt). */
const SettlementBreakdownList: React.FC<{ s: Settlement }> = ({ s }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const b = s.breakdown;
  const m = (v: Money) => f.moneyMinor(v.amount_minor, { currency: v.currency });
  const lines: Array<[string, string, Money, boolean?]> = [
    ["", t("m.settlements.foodDue"), b.foodDue],
    ["−", t("m.settlements.clawback"), b.clawback],
    ["−", t("m.settlements.commission"), b.commission],
    ["−", t("m.settlements.commissionGst"), b.commissionGst],
  ];
  if (b.debtIn.amount_minor) lines.push(["−", t("m.settlements.debtIn"), b.debtIn]);
  lines.push(["=", t("m.settlements.net"), s.net, true]);
  if (b.debtOut.amount_minor) lines.push(["", t("m.settlements.debtOut"), b.debtOut]);
  return (
    <div className="min-w-[14rem] text-[12px] leading-5">
      <dl>
        {lines.map(([sign, label, v, strong]) => (
          <div key={label} className={`flex justify-between gap-3 ${strong ? "border-t border-slate-200 font-semibold" : ""}`}>
            <dt>
              <span className="inline-block w-3 text-slate-500" aria-hidden="true">
                {sign}
              </span>
              {label}
            </dt>
            <dd className="tabular-nums">{m(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[11px] text-slate-500">
        {t("m.settlements.deliveryFeeKept", { amount: m(b.deliveryFee) })}
      </p>
    </div>
  );
};

const SettlementsPanel: React.FC<{ onNotice: (s: string) => void }> = ({ onNotice }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const scope = useMasterScope();
  const canRun = can(FEAT.FINANCE.id, FEAT.FINANCE.run);
  const canApprove = can(FEAT.FINANCE.id, FEAT.FINANCE.approveSettlement);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({
    organization_id: "",
    period_start: todayIso(),
    period_end: todayIso(),
  });
  const [approving, setApproving] = useState<Settlement | null>(null);
  const action = useAction();
  const res = useResource(() => financeApi.settlements(), []);
  const rows = res.data?.items ?? [];

  const run = async () => {
    const r = await action.run(() => financeApi.runSettlement(form));
    if (r !== undefined) {
      setRunning(false);
      onNotice(t("m.settlements.ran"));
      res.reload();
    }
  };
  const approve = async () => {
    if (!approving) return;
    const r = await action.run(() => financeApi.approveSettlement(approving.id));
    if (r !== undefined) {
      setApproving(null);
      onNotice(t("m.settlements.approved"));
      res.reload();
    }
  };
  return (
    <div>
      {canRun && (
        <div className="mb-3">
          <Button
            variant="primary"
            onClick={() => {
              action.clear();
              setForm({
                organization_id: scope.orgId,
                period_start: todayIso(),
                period_end: todayIso(),
              });
              setRunning(true);
            }}
          >
            {t("m.settlements.run")}
          </Button>
        </div>
      )}
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.settlements.empty")}
      >
        <DataTable
          caption={t("m.settlements.title")}
          rows={rows}
          rowKey={(s) => s.id}
          columns={[
            {
              key: "o",
              header: t("m.orders.organization"),
              render: (s) => s.organization_name ?? s.organization_id ?? t("common.dash"),
            },
            {
              key: "p",
              header: t("m.settlements.period"),
              render: (s) => `${f.date(s.period_start)} – ${f.date(s.period_end)}`,
            },
            {
              key: "n",
              header: t("m.settlements.net"),
              render: (s) => f.moneyMinor(s.net.amount_minor, { currency: s.net.currency }),
            },
            {
              key: "b",
              header: t("m.settlements.breakdown"),
              render: (s) => <SettlementBreakdownList s={s} />,
            },
            {
              key: "s",
              header: t("common.status"),
              render: (s) => <StatusBadge code={s.status} />,
            },
            {
              key: "a",
              header: t("common.actions"),
              render: (s) =>
                canApprove && s.status === "draft" ? (
                  s.created_by_me ? (
                    <span className="text-[11px] text-slate-500">{t("m.makerChecker")}</span>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => {
                        action.clear();
                        setApproving(s);
                      }}
                    >
                      {t("m.settlements.approve")}
                    </Button>
                  )
                ) : null,
            },
          ]}
        />
      </PageState>
      <Modal
        open={running}
        title={t("m.settlements.run")}
        onClose={() => setRunning(false)}
        footer={
          <>
            <Button onClick={() => setRunning(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              busy={action.busy}
              disabled={!form.organization_id || !form.period_start || !form.period_end}
              onClick={run}
            >
              {t("m.settlements.run")}
            </Button>
          </>
        }
      >
        <SelectInput
          label={t("m.orders.organization")}
          value={form.organization_id}
          onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
        >
          <option value="">{t("m.invitations.chooseOrg")}</option>
          {(scope.context?.organizations ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectInput>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label={t("m.settlements.periodStart")}
            type="date"
            value={form.period_start}
            onChange={(e) => setForm({ ...form, period_start: e.target.value })}
          />
          <TextInput
            label={t("m.settlements.periodEnd")}
            type="date"
            value={form.period_end}
            onChange={(e) => setForm({ ...form, period_end: e.target.value })}
          />
        </div>
        {action.error ? <ErrorBox error={action.error} /> : null}
      </Modal>
      <ConfirmDialog
        open={approving !== null}
        title={t("m.settlements.approveTitle")}
        description={
          approving
            ? t("m.settlements.approveBody", {
                amount: f.moneyMinor(approving.net.amount_minor, {
                  currency: approving.net.currency,
                }),
              })
            : undefined
        }
        confirmLabel={t("m.settlements.approve")}
        busy={action.busy}
        error={action.error}
        onConfirm={approve}
        onClose={() => setApproving(null)}
      />
    </div>
  );
};

const PayoutsPanel: React.FC<{ onNotice: (s: string) => void }> = ({ onNotice }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const canApprovePayout = can(FEAT.FINANCE.id, FEAT.FINANCE.approvePayout);
  const canMarkPaid = can(FEAT.FINANCE.id, FEAT.FINANCE.markPaid);
  const [status, setStatus] = useState("all");
  const [approving, setApproving] = useState<Payout | null>(null);
  const [paying, setPaying] = useState<Payout | null>(null);
  const [reference, setReference] = useState("");
  const action = useAction();
  const res = useResource(() => financeApi.payouts({ status }), [status]);
  const rows = res.data?.items ?? [];

  const approve = async () => {
    if (!approving) return;
    const r = await action.run(() => financeApi.approvePayout(approving.id));
    if (r !== undefined) {
      setApproving(null);
      onNotice(t("m.payouts.approved"));
      res.reload();
    }
  };
  const pay = async () => {
    if (!paying) return;
    const r = await action.run(() => financeApi.markPaid(paying.id, reference.trim()));
    if (r !== undefined) {
      setPaying(null);
      onNotice(t("m.payouts.paid"));
      res.reload();
    }
  };
  return (
    <div>
      <FilterBar>
        <SelectInput
          label={t("common.status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">{t("common.all")}</option>
          {["pending", "approved", "paid", "failed"].map((s) => (
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
        emptyText={t("m.payouts.empty")}
      >
        <DataTable
          caption={t("m.payouts.title")}
          rows={rows}
          rowKey={(p) => p.id}
          columns={[
            { key: "n", header: t("m.payouts.payee"), render: (p) => p.payee_name ?? p.id },
            {
              key: "a",
              header: t("common.amount"),
              render: (p) => f.moneyMinor(p.amount.amount_minor, { currency: p.amount.currency }),
            },
            {
              key: "s",
              header: t("common.status"),
              render: (p) => <StatusBadge code={p.status} />,
            },
            {
              key: "r",
              header: t("m.payouts.reference"),
              render: (p) => p.reference ?? t("common.dash"),
            },
            {
              key: "x",
              header: t("common.actions"),
              render: (p) => {
                if (p.status === "pending" && canApprovePayout)
                  return p.created_by_me ? (
                    <span className="text-[11px] text-slate-500">{t("m.makerChecker")}</span>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => {
                        action.clear();
                        setApproving(p);
                      }}
                    >
                      {t("m.payouts.approve")}
                    </Button>
                  );
                if (p.status === "approved" && canMarkPaid)
                  return (
                    <Button
                      variant="primary"
                      onClick={() => {
                        action.clear();
                        setReference("");
                        setPaying(p);
                      }}
                    >
                      {t("m.payouts.markPaid")}
                    </Button>
                  );
                return null;
              },
            },
          ]}
        />
      </PageState>
      <ConfirmDialog
        open={approving !== null}
        title={t("m.payouts.approveTitle")}
        description={
          approving
            ? t("m.payouts.approveBody", {
                amount: f.moneyMinor(approving.amount.amount_minor, {
                  currency: approving.amount.currency,
                }),
              })
            : undefined
        }
        confirmLabel={t("m.payouts.approve")}
        busy={action.busy}
        error={action.error}
        onConfirm={approve}
        onClose={() => setApproving(null)}
      />
      <Modal
        open={paying !== null}
        title={t("m.payouts.markPaid")}
        onClose={() => setPaying(null)}
        footer={
          <>
            <Button onClick={() => setPaying(null)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              busy={action.busy}
              disabled={reference.trim().length < 3}
              onClick={pay}
            >
              {t("m.payouts.markPaid")}
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600">{t("m.payouts.paidBody")}</p>
        <TextInput
          label={t("m.payouts.reference")}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          required
        />
        {action.error ? <ErrorBox error={action.error} /> : null}
      </Modal>
    </div>
  );
};

export const SettlementsPayoutsPage: React.FC = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "payouts" ? "payouts" : "settlements");
  const [notice, setNotice] = useState("");
  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.finance")}
        title={t("m.settlements.pageTitle")}
        subtitle={t("m.settlements.subtitle")}
      />
      {notice && (
        <div className="mb-3">
          <Notice>{notice}</Notice>
        </div>
      )}
      <Tabs
        label={t("m.settlements.pageTitle")}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "settlements", label: t("m.settlements.title") },
          { id: "payouts", label: t("m.payouts.title") },
        ]}
      />
      <TabPanel id="settlements" active={tab}>
        <SettlementsPanel onNotice={setNotice} />
      </TabPanel>
      <TabPanel id="payouts" active={tab}>
        <PayoutsPanel onNotice={setNotice} />
      </TabPanel>
    </div>
  );
};
