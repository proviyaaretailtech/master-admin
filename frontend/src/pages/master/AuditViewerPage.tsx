import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auditApi } from "../../api/audit.api";
import type { AuditLog } from "../../api/audit.api";
import { diffObjects, showValue } from "../../lib/diff";
import { useFormat } from "../../i18n/useFormat";
import {
  DataTable,
  Drawer,
  FilterBar,
  KV,
  PageHeader,
  PageState,
  Pager,
  TextInput,
} from "../../components/master/ui";
import { useMasterScope } from "../../components/master/MasterContext";
import { useResource } from "../../components/master/useResource";

const KIND_CLS = {
  added: "bg-green-50 text-green-800",
  removed: "bg-red-50 text-red-800",
  changed: "bg-amber-50 text-amber-900",
  same: "text-slate-500",
} as const;

export const AuditDiff: React.FC<{ log: AuditLog }> = ({ log }) => {
  const { t } = useTranslation();
  const rows = diffObjects(log.before, log.after);
  if (rows.length === 0) return <p className="text-xs text-slate-500">{t("m.audit.noDiff")}</p>;
  return (
    <table className="w-full text-left text-xs">
      <caption className="sr-only">{t("m.audit.diff")}</caption>
      <thead>
        <tr className="text-[11px] uppercase text-slate-400">
          <th scope="col" className="py-1 pr-2">
            {t("m.audit.field")}
          </th>
          <th scope="col" className="py-1 pr-2">
            {t("m.audit.before")}
          </th>
          <th scope="col" className="py-1">
            {t("m.audit.after")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} data-kind={r.kind} className={KIND_CLS[r.kind]}>
            <th scope="row" className="py-1 pr-2 font-semibold">
              {r.key}
            </th>
            <td className="break-all py-1 pr-2">{showValue(r.before)}</td>
            <td className="break-all py-1">{showValue(r.after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const AuditViewerPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const scope = useMasterScope();
  const [params] = useSearchParams();
  const org = params.get("org") || scope.orgId;
  const [actor, setActor] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState(params.get("entity_id") ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditLog | null>(null);
  const res = useResource(
    () =>
      auditApi.list({ actor, entity_type: entityType, entity_id: entityId, org, from, to, page }),
    [actor, entityType, entityId, org, from, to, page]
  );
  const rows = res.data?.items ?? [];
  const reset = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.accessControl")}
        title={t("m.audit.title")}
        subtitle={t("m.audit.subtitle")}
      />
      <FilterBar>
        <TextInput label={t("m.audit.actor")} value={actor} onChange={reset(setActor)} />
        <TextInput
          label={t("m.audit.entityType")}
          value={entityType}
          onChange={reset(setEntityType)}
        />
        <TextInput label={t("m.audit.entityId")} value={entityId} onChange={reset(setEntityId)} />
        <div className="grid grid-cols-2 gap-2">
          <TextInput
            label={t("m.orders.from")}
            type="date"
            value={from}
            onChange={reset(setFrom)}
          />
          <TextInput label={t("m.orders.to")} type="date" value={to} onChange={reset(setTo)} />
        </div>
      </FilterBar>
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.audit.empty")}
      >
        <DataTable
          caption={t("m.audit.title")}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setOpen}
          columns={[
            { key: "d", header: t("common.date"), render: (r) => f.dateTime(r.created_at) },
            { key: "a", header: t("m.audit.actor"), render: (r) => r.actor ?? t("common.dash") },
            {
              key: "ac",
              header: t("m.audit.action"),
              render: (r) => (
                <button
                  type="button"
                  className="font-semibold hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(r);
                  }}
                >
                  {r.action}
                </button>
              ),
            },
            {
              key: "e",
              header: t("m.audit.entity"),
              render: (r) => `${r.entity_type}${r.entity_id ? ` · ${r.entity_id}` : ""}`,
            },
          ]}
        />
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
      </PageState>
      <Drawer open={open !== null} title={t("m.audit.detail")} onClose={() => setOpen(null)}>
        {open && (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <KV label={t("m.audit.action")}>{open.action}</KV>
              <KV label={t("m.audit.actor")}>{open.actor ?? t("common.dash")}</KV>
              <KV label={t("m.audit.entity")}>{open.entity_type}</KV>
              <KV label={t("common.date")}>{f.dateTime(open.created_at)}</KV>
              {open.reason && <KV label={t("common.reason")}>{open.reason}</KV>}
            </dl>
            <AuditDiff log={open} />
          </>
        )}
      </Drawer>
    </div>
  );
};
