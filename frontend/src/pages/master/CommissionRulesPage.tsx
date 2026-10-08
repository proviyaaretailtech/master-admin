import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { COMMISSION_CHANNELS, commissionApi } from "../../api/commission.api";
import type { CommissionRule } from "../../api/commission.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import {
  bpsToPercentString,
  majorStringToMinor,
  minorToMajorString,
  percentStringToBps,
} from "../../lib/units";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  ConfirmDialog,
  DataTable,
  ErrorBox,
  Modal,
  Notice,
  PageHeader,
  PageState,
  SelectInput,
  StatusBadge,
  TextInput,
} from "../../components/master/ui";
import { useMasterScope } from "../../components/master/MasterContext";
import { useAction, useResource } from "../../components/master/useResource";

const BLANK = { org: "", channel: "", pct: "", fixed: "", min: "", max: "" };

export const CommissionRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const scope = useMasterScope();
  const canEdit = can(FEAT.COMMISSION.id, FEAT.COMMISSION.edit);
  const [editing, setEditing] = useState<CommissionRule | "new" | null>(null);
  const [form, setForm] = useState(BLANK);
  const [invalid, setInvalid] = useState(false);
  const [deactivating, setDeactivating] = useState<CommissionRule | null>(null);
  const [notice, setNotice] = useState("");
  const action = useAction();
  const res = useResource(() => commissionApi.list(), []);
  const rows = res.data ?? [];

  const open = (r: CommissionRule | "new") => {
    action.clear();
    setInvalid(false);
    setForm(
      r === "new"
        ? BLANK
        : {
            org: r.organization_id ?? "",
            channel: r.channel ?? "",
            pct: bpsToPercentString(r.pct_bps),
            fixed: minorToMajorString(r.fixed_minor),
            min: minorToMajorString(r.min_minor),
            max: minorToMajorString(r.max_minor),
          }
    );
    setEditing(r);
  };

  const save = async () => {
    const pct = percentStringToBps(form.pct || "0");
    const fixed = majorStringToMinor(form.fixed || "0");
    const min = majorStringToMinor(form.min || "0");
    const max = form.max.trim() === "" ? null : majorStringToMinor(form.max);
    if (
      pct === null ||
      fixed === null ||
      min === null ||
      (form.max.trim() !== "" && max === null)
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const body = {
      organization_id: form.org || null,
      channel: form.channel.trim() || null,
      pct_bps: pct,
      fixed_minor: fixed,
      min_minor: min,
      max_minor: max,
    };
    const r = await action.run(() =>
      editing === "new" || editing === null
        ? commissionApi.create(body)
        : commissionApi.update(editing.id, body)
    );
    if (r !== undefined) {
      setNotice(t(editing === "new" ? "m.commission.created" : "m.commission.versioned"));
      setEditing(null);
      res.reload();
    }
  };
  const deactivate = async () => {
    if (!deactivating) return;
    const r = await action.run(() => commissionApi.deactivate(deactivating.id));
    if (r !== undefined) {
      setDeactivating(null);
      setNotice(t("m.commission.deactivated"));
      res.reload();
    }
  };
  const set =
    (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.operations")}
        title={t("m.commission.title")}
        subtitle={t("m.commission.subtitle")}
        actions={
          canEdit && (
            <Button variant="primary" onClick={() => open("new")}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("m.commission.create")}
            </Button>
          )
        }
      />
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
        emptyText={t("m.commission.empty")}
      >
        <DataTable
          caption={t("m.commission.title")}
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "o",
              header: t("m.commission.scope"),
              render: (r) =>
                r.organization_name ??
                (r.organization_id ? r.organization_id : t("m.commission.allOrgs")),
            },
            {
              key: "c",
              header: t("m.commission.channel"),
              render: (r) => r.channel ?? t("m.commission.allChannels"),
            },
            {
              key: "p",
              header: t("m.commission.percent"),
              render: (r) => `${f.number(r.pct_bps / 100)}%`,
            },
            {
              key: "f",
              header: t("m.commission.fixed"),
              render: (r) => f.moneyMinor(r.fixed_minor),
            },
            { key: "mn", header: t("m.commission.min"), render: (r) => f.moneyMinor(r.min_minor) },
            {
              key: "mx",
              header: t("m.commission.max"),
              render: (r) =>
                r.max_minor === null ? t("m.commission.noCap") : f.moneyMinor(r.max_minor),
            },
            { key: "v", header: t("common.version"), render: (r) => r.version ?? t("common.dash") },
            {
              key: "s",
              header: t("common.status"),
              render: (r) => <StatusBadge code={r.active ? "active" : "inactive"} />,
            },
            {
              key: "a",
              header: t("common.actions"),
              render: (r) =>
                canEdit && r.active ? (
                  <span className="flex gap-2">
                    <Button onClick={() => open(r)} aria-label={t("m.commission.editVersion")}>
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        action.clear();
                        setDeactivating(r);
                      }}
                    >
                      {t("m.commission.deactivate")}
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
      </PageState>

      <Modal
        open={editing !== null}
        title={editing === "new" ? t("m.commission.create") : t("m.commission.editVersion")}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button variant="primary" busy={action.busy} onClick={save}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        {editing !== "new" && editing !== null && <Notice>{t("m.commission.versionNote")}</Notice>}
        <SelectInput
          label={t("m.commission.organization")}
          value={form.org}
          onChange={set("org")}
          disabled={editing !== "new"}
        >
          <option value="">{t("m.commission.allOrgs")}</option>
          {(scope.context?.organizations ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          label={t("m.commission.channel")}
          hint={t("m.commission.channelHint")}
          value={form.channel}
          onChange={set("channel")}
          disabled={editing !== "new"}
        >
          <option value="">{t("m.commission.allChannels")}</option>
          {COMMISSION_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t(`m.commission.ch.${c}`)}
            </option>
          ))}
        </SelectInput>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label={t("m.commission.percentInput")}
            inputMode="decimal"
            value={form.pct}
            onChange={set("pct")}
          />
          <TextInput
            label={t("m.commission.fixedInput")}
            inputMode="decimal"
            value={form.fixed}
            onChange={set("fixed")}
          />
          <TextInput
            label={t("m.commission.minInput")}
            inputMode="decimal"
            value={form.min}
            onChange={set("min")}
          />
          <TextInput
            label={t("m.commission.maxInput")}
            inputMode="decimal"
            value={form.max}
            onChange={set("max")}
          />
        </div>
        {invalid && <Notice tone="error">{t("m.riderPay.invalidAmount")}</Notice>}
        {action.error ? <ErrorBox error={action.error} /> : null}
      </Modal>
      <ConfirmDialog
        open={deactivating !== null}
        danger
        title={t("m.commission.deactivateTitle")}
        description={t("m.commission.deactivateBody")}
        confirmLabel={t("m.commission.deactivate")}
        busy={action.busy}
        error={action.error}
        onConfirm={deactivate}
        onClose={() => setDeactivating(null)}
      />
    </div>
  );
};
