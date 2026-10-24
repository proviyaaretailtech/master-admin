import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { approvalsApi } from "../../api/approvals.api";
import type { Approval, ApprovalView } from "../../api/approvals.api";
import { useAuth } from "../../hooks/use-auth";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  DataTable,
  Drawer,
  ErrorBox,
  KV,
  Notice,
  PageHeader,
  PageState,
  Pager,
  ReasonDialog,
  StatusBadge,
  Tabs,
} from "../../components/master/ui";
import { useAction, useResource } from "../../components/master/useResource";

/**
 * Layer 1A (founder decision 1): platform approvals. "Waiting for me" shows pending requests that name one of my
 * approver roles; the person who asked never sees their own request there and cannot decide it.
 */
export const ApprovalsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const { user } = useAuth();
  const [view, setView] = useState<ApprovalView>("mine");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"approve" | "reject" | "withdraw" | null>(null);
  const [notice, setNotice] = useState("");
  const action = useAction();
  const res = useResource(() => approvalsApi.list(view, page), [view, page], { refreshMs: 60_000 });
  const detail = useResource(() => approvalsApi.get(openId as string), [openId], { enabled: !!openId });
  const rows = res.data?.items ?? [];
  const myRoles = res.data?.myRoles ?? [];

  const actionLabel = (a: string) => t(`m.approvals.actions.${a}`, { defaultValue: a });
  const roleList = (rs: string[]) => rs.map((r) => t(`m.approvals.roles.${r}`, { defaultValue: r })).join(", ");

  const decide = async (note: string) => {
    if (!openId || !dialog) return;
    const r = await action.run(() =>
      dialog === "withdraw"
        ? approvalsApi.cancel(openId, note)
        : approvalsApi.decide(openId, dialog === "approve" ? "approved" : "rejected", note)
    );
    if (r !== undefined) {
      setNotice(t(dialog === "approve" ? "m.approvals.approved" : dialog === "reject" ? "m.approvals.rejected" : "m.approvals.withdrawn"));
      setDialog(null);
      setOpenId(null);
      res.reload();
    }
  };

  const open = detail.data?.approval;
  const isMine = open && user && open.requested_by === user.id;
  const pending = open?.effective_status === "pending";
  const mayDecide =
    !!open && pending && !isMine && [...open.approver_roles, ...open.escalation_roles].some((r) => myRoles.includes(r));

  return (
    <div>
      <PageHeader eyebrow={t("nav.sections.governance")} title={t("m.approvals.title")} subtitle={t("m.approvals.subtitle")} />
      {notice && (
        <div className="mb-3">
          <Notice>{notice}</Notice>
        </div>
      )}
      <p className="mb-3 text-xs text-slate-600">
        {myRoles.length > 0 ? t("m.approvals.yourRoles", { roles: roleList(myRoles) }) : t("m.approvals.noRoles")}
      </p>
      <Tabs
        label={t("m.approvals.title")}
        active={view}
        onChange={(id) => {
          setView(id as ApprovalView);
          setPage(1);
        }}
        tabs={[
          { id: "mine", label: t("m.approvals.viewMine") },
          { id: "escalated", label: t("m.approvals.viewEscalated") },
          { id: "all", label: t("m.approvals.viewAll") },
        ]}
      />
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t(view === "mine" ? "m.approvals.empty" : "m.approvals.emptyAll")}
      >
        <DataTable<Approval>
          caption={t("m.approvals.title")}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => {
            action.clear();
            setOpenId(r.id);
          }}
          columns={[
            { key: "a", header: t("m.approvals.action"), render: (r) => actionLabel(r.action_type) },
            { key: "m", header: t("m.approvals.amount"), render: (r) => f.moneyMinor(r.amount_minor) },
            { key: "q", header: t("m.approvals.requestedBy"), render: (r) => r.requested_by_name ?? t("common.dash") },
            {
              key: "w",
              header: t("m.approvals.approvers"),
              render: (r) => roleList([...r.approver_roles, ...r.escalation_roles]),
            },
            { key: "e", header: t("m.approvals.expires"), render: (r) => (r.expires_at ? f.relative(r.expires_at) : t("common.dash")) },
            { key: "s", header: t("common.status"), render: (r) => <StatusBadge code={r.effective_status} /> },
          ]}
        />
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
      </PageState>

      <Drawer
        open={!!openId}
        title={t("m.approvals.detailTitle")}
        onClose={() => setOpenId(null)}
        footer={
          open && pending ? (
            <>
              {isMine && (
                <Button
                  onClick={() => {
                    action.clear();
                    setDialog("withdraw");
                  }}
                >
                  {t("m.approvals.withdraw")}
                </Button>
              )}
              {mayDecide && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      action.clear();
                      setDialog("reject");
                    }}
                  >
                    {t("m.approvals.reject")}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      action.clear();
                      setDialog("approve");
                    }}
                  >
                    {t("m.approvals.approve")}
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {detail.loading && <p className="text-xs text-slate-500">{t("common.loading")}</p>}
        {detail.error ? <ErrorBox error={detail.error} onRetry={detail.reload} /> : null}
        {open && (
          <>
            {isMine && pending && <Notice>{t("m.approvals.selfNote")}</Notice>}
            <dl className="grid grid-cols-2 gap-3">
              <KV label={t("m.approvals.action")}>{actionLabel(open.action_type)}</KV>
              <KV label={t("common.status")}>
                <StatusBadge code={open.effective_status} />
              </KV>
              <KV label={t("m.approvals.amount")}>{f.moneyMinor(open.amount_minor)}</KV>
              <KV label={t("m.approvals.subject")}>{`${open.subject_type} · ${open.subject_id}`}</KV>
              <KV label={t("m.approvals.requestedBy")}>{open.requested_by_name ?? t("common.dash")}</KV>
              <KV label={t("m.approvals.band")}>{open.tier_label ?? t("common.dash")}</KV>
              <KV label={t("m.approvals.approvers")}>{roleList(open.approver_roles)}</KV>
              <KV label={t("m.approvals.escalated")}>
                {open.escalated_at ? `${roleList(open.escalation_roles)} · ${f.dateTime(open.escalated_at)}` : t("common.dash")}
              </KV>
              <KV label={t("m.approvals.expires")}>{open.expires_at ? f.dateTime(open.expires_at) : t("common.dash")}</KV>
              <KV label={t("m.approvals.created")}>{open.created_at ? f.dateTime(open.created_at) : t("common.dash")}</KV>
            </dl>
            <KV label={t("m.approvals.reason")}>{open.reason}</KV>
            <h3 className="pt-2 text-xs font-bold text-slate-800">{t("m.approvals.history")}</h3>
            {(detail.data?.decisions ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">{t("m.approvals.noDecisions")}</p>
            ) : (
              <ul className="space-y-2">
                {detail.data!.decisions.map((d) => (
                  <li key={d.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                    <StatusBadge code={d.decision} /> {d.decided_by_name ?? t("common.dash")}
                    {d.decided_role ? ` ${t("m.approvals.decidedAs", { role: roleList([d.decided_role]) })}` : ""}
                    {d.created_at ? ` · ${f.dateTime(d.created_at)}` : ""}
                    {d.note && <p className="mt-1 text-slate-600">{d.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Drawer>

      <ReasonDialog
        open={dialog !== null}
        title={t(dialog === "approve" ? "m.approvals.approve" : dialog === "reject" ? "m.approvals.reject" : "m.approvals.withdraw")}
        confirmLabel={t(dialog === "approve" ? "m.approvals.approve" : dialog === "reject" ? "m.approvals.reject" : "m.approvals.withdraw")}
        reasonLabel={t(dialog === "reject" ? "m.approvals.rejectReason" : "m.approvals.noteLabel")}
        required={dialog === "reject"}
        danger={dialog === "reject"}
        busy={action.busy}
        error={action.error}
        onConfirm={decide}
        onClose={() => setDialog(null)}
      />
    </div>
  );
};
