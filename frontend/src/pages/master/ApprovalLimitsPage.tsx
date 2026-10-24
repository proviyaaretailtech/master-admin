import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { APPROVER_ROLES, approvalsApi } from "../../api/approvals.api";
import type { ApprovalTier } from "../../api/approvals.api";
import { usePermissions } from "../../hooks/use-permissions";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  DataTable,
  ErrorBox,
  Field,
  Modal,
  Notice,
  PageHeader,
  PageState,
  StatusBadge,
  TextInput,
  inputCls,
} from "../../components/master/ui";
import { useAction, useResource } from "../../components/master/useResource";

type Form = { approvers: string[]; backup: string[]; expiry: string; escalate: string; requires: boolean; enabled: boolean; reason: string };

/** Founder decision 1: who must approve, by amount. Everyone with view access reads it; only founders change it. */
export const ApprovalLimitsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const { isSuperAdmin } = usePermissions();
  const [editing, setEditing] = useState<ApprovalTier | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [notice, setNotice] = useState("");
  const action = useAction();
  const res = useResource(() => approvalsApi.tiers(), []);
  const rows = res.data ?? [];

  const roleList = (rs: string[]) => rs.map((r) => t(`m.approvals.roles.${r}`, { defaultValue: r })).join(", ");
  const band = (r: ApprovalTier) =>
    r.min_minor === 0 && r.max_minor === null
      ? t("m.approvals.limits.any")
      : r.min_minor === 0
        ? t("m.approvals.limits.upTo", { max: f.moneyMinor(r.max_minor) })
        : r.max_minor === null
          ? t("m.approvals.limits.above", { min: f.moneyMinor(r.min_minor) })
          : t("m.approvals.limits.between", { min: f.moneyMinor(r.min_minor), max: f.moneyMinor(r.max_minor) });

  const open = (r: ApprovalTier) => {
    action.clear();
    setEditing(r);
    setForm({
      approvers: r.approver_roles,
      backup: r.backup_roles,
      expiry: String(r.expiry_hours),
      escalate: r.escalate_after_minutes === null ? "" : String(r.escalate_after_minutes),
      requires: r.requires_approval,
      enabled: r.enabled,
      reason: "",
    });
  };
  const toggle = (k: "approvers" | "backup", role: string) =>
    form && setForm({ ...form, [k]: form[k].includes(role) ? form[k].filter((x) => x !== role) : [...form[k], role] });

  const expiry = Number(form?.expiry);
  const escalate = form?.escalate.trim() === "" ? null : Number(form?.escalate);
  const valid =
    !!form &&
    Number.isInteger(expiry) && expiry >= 1 && expiry <= 720 &&
    (escalate === null || (Number.isInteger(escalate) && escalate >= 5 && escalate <= 10080)) &&
    (!form.requires || form.approvers.length > 0) &&
    form.reason.trim().length >= 3;

  const save = async () => {
    if (!editing || !form || !valid) return;
    const r = await action.run(() =>
      approvalsApi.updateTier(editing.id, {
        requires_approval: form.requires,
        approver_roles: form.approvers,
        backup_roles: form.backup,
        expiry_hours: expiry,
        escalate_after_minutes: escalate,
        enabled: form.enabled,
        reason: form.reason.trim(),
      })
    );
    if (r !== undefined) {
      setNotice(t("m.approvals.limits.saved"));
      setEditing(null);
      res.reload();
    }
  };

  const roleChecks = (k: "approvers" | "backup") => (
    <div className="flex flex-wrap gap-3">
      {APPROVER_ROLES.map((role) => (
        <label key={role} className="flex items-center gap-1.5 text-xs text-slate-700">
          <input type="checkbox" checked={!!form?.[k].includes(role)} onChange={() => toggle(k, role)} />
          {t(`m.approvals.roles.${role}`)}
        </label>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow={t("nav.sections.governance")} title={t("m.approvals.limits.title")} subtitle={t("m.approvals.limits.subtitle")} />
      {notice && (
        <div className="mb-3">
          <Notice>{notice}</Notice>
        </div>
      )}
      {!isSuperAdmin && <p className="mb-3 text-xs text-slate-600">{t("m.approvals.limits.foundersOnly")}</p>}
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.approvals.limits.empty")}
      >
        <DataTable<ApprovalTier>
          caption={t("m.approvals.limits.title")}
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "a", header: t("m.approvals.action"), render: (r) => t(`m.approvals.actions.${r.action_type}`, { defaultValue: r.action_type }) },
            { key: "b", header: t("m.approvals.limits.band"), render: band },
            {
              key: "w",
              header: t("m.approvals.limits.approvers"),
              render: (r) => (r.requires_approval ? roleList(r.approver_roles) : t("m.approvals.limits.alone")),
            },
            { key: "k", header: t("m.approvals.limits.backup"), render: (r) => (r.backup_roles.length ? roleList(r.backup_roles) : t("common.dash")) },
            {
              key: "x",
              header: t("m.approvals.limits.escalateAfter"),
              render: (r) =>
                r.escalate_after_minutes === null ? t("m.approvals.limits.never") : t("m.approvals.limits.minutes", { count: r.escalate_after_minutes }),
            },
            { key: "e", header: t("m.approvals.limits.expiry"), render: (r) => t("m.approvals.limits.hours", { count: r.expiry_hours }) },
            { key: "s", header: t("common.status"), render: (r) => <StatusBadge code={r.enabled ? "enabled" : "disabled"} /> },
            {
              key: "act",
              header: t("common.actions"),
              render: (r) => (isSuperAdmin ? <Button onClick={() => open(r)}>{t("m.approvals.limits.edit")}</Button> : null),
            },
          ]}
        />
      </PageState>

      <Modal
        open={!!editing && !!form}
        title={editing ? `${t(`m.approvals.actions.${editing.action_type}`, { defaultValue: editing.action_type })} · ${band(editing)}` : ""}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button variant="primary" disabled={!valid} busy={action.busy} onClick={save}>
              {t("m.approvals.limits.save")}
            </Button>
          </>
        }
      >
        {form && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={form.requires} onChange={() => setForm({ ...form, requires: !form.requires })} />
              {t("m.approvals.limits.requiresApproval")}
            </label>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-slate-700">{t("m.approvals.limits.approvers")}</legend>
              {roleChecks("approvers")}
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-slate-700">{t("m.approvals.limits.backup")}</legend>
              {roleChecks("backup")}
            </fieldset>
            <TextInput
              label={t("m.approvals.limits.expiryHours")}
              inputMode="numeric"
              value={form.expiry}
              onChange={(e) => setForm({ ...form, expiry: e.target.value })}
            />
            <TextInput
              label={t("m.approvals.limits.escalateMinutes")}
              inputMode="numeric"
              value={form.escalate}
              onChange={(e) => setForm({ ...form, escalate: e.target.value })}
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={form.enabled} onChange={() => setForm({ ...form, enabled: !form.enabled })} />
              {t("m.approvals.limits.enabled")}
            </label>
            <Field label={t("m.approvals.limits.reasonLabel")}>
              {(id) => (
                <textarea
                  id={id}
                  rows={2}
                  className={inputCls}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              )}
            </Field>
            {action.error ? <ErrorBox error={action.error} /> : null}
          </>
        )}
      </Modal>
    </div>
  );
};
