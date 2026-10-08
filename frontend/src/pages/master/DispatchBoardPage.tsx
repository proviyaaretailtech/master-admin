import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CANCEL_CODES, EXCEPTION_OUTCOMES, dispatchApi } from "../../api/dispatch.api";
import type { DispatchJob } from "../../api/dispatch.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  Drawer,
  EmptyBox,
  ErrorBox,
  KV,
  Modal,
  Notice,
  PageHeader,
  PageState,
  ReasonDialog,
  SelectInput,
  StatusBadge,
  TextInput,
} from "../../components/master/ui";
import { useMasterScope } from "../../components/master/MasterContext";
import { useAction, useResource } from "../../components/master/useResource";

export const JOB_STATES = [
  "created",
  "offered",
  "assigned",
  "at_pickup",
  "picked_up",
  "at_drop",
  "exception",
  "delivered",
  "cancelled",
];
type Pending = "reassign" | "cancel";

export const DispatchBoardPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const canManage = can(FEAT.DISPATCH.id, FEAT.DISPATCH.manage);
  const scope = useMasterScope();
  const [params] = useSearchParams();
  const statusFilter = params.get("status") ?? "all";
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [resolving, setResolving] = useState(false);
  const [outcome, setOutcome] = useState(EXCEPTION_OUTCOMES[0]);
  const [note, setNote] = useState("");
  const [cancelCode, setCancelCode] = useState(CANCEL_CODES[CANCEL_CODES.length - 1]);
  const [notice, setNotice] = useState("");
  const action = useAction();

  const res = useResource(
    () => dispatchApi.jobs({ status: statusFilter, org: scope.orgId }),
    [statusFilter, scope.orgId],
    { refreshMs: 30000 }
  );
  const detail = useResource(() => dispatchApi.job(openId as string), [openId], {
    enabled: Boolean(openId),
  });
  const jobs = res.data?.items ?? [];
  const job = detail.data;

  const byState = (s: string) => jobs.filter((j) => j.status === s);
  const other = jobs.filter((j) => !JOB_STATES.includes(j.status));
  const columns =
    statusFilter === "all" ? JOB_STATES : JOB_STATES.filter((s) => s === statusFilter);

  const done = (msg: string) => {
    setPending(null);
    setResolving(false);
    setNotice(msg);
    res.reload();
    detail.reload();
  };
  const confirm = async (reason: string) => {
    if (!pending || !openId) return;
    const r = await action.run(() =>
      pending === "reassign"
        ? dispatchApi.reassign(openId, reason)
        : dispatchApi.cancel(openId, reason, cancelCode)
    );
    if (r !== undefined) done(t(`m.dispatch.done.${pending}`));
  };
  const resolve = async () => {
    if (!job?.exception_id) return;
    const r = await action.run(() =>
      dispatchApi.resolveException(job.exception_id as string, outcome, note.trim())
    );
    if (r !== undefined) done(t("m.dispatch.done.resolve"));
  };

  const renderCard = (j: DispatchJob) => (
    <li key={j.id}>
      <button
        type="button"
        onClick={() => {
          action.clear();
          setOpenId(j.id);
        }}
        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-left text-xs shadow-2xs hover:border-[#65D000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#65D000]/50"
      >
        <div className="font-bold text-slate-900">{j.order_number ?? j.order_id ?? j.id}</div>
        <div className="truncate text-slate-500">{j.organization_name}</div>
        <div className="mt-1 text-slate-600">{j.rider_name ?? t("m.dispatch.unassigned")}</div>
        {j.exception_reason && <div className="mt-1 text-red-600">{j.exception_reason}</div>}
      </button>
    </li>
  );

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.operations")}
        title={t("m.dispatch.title")}
        subtitle={t("m.dispatch.subtitle")}
        actions={<Button onClick={res.reload}>{t("common.retry")}</Button>}
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
        empty={jobs.length === 0}
        emptyText={t("m.dispatch.empty")}
      >
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          role="list"
          aria-label={t("m.dispatch.board")}
        >
          {[...columns, ...(other.length ? ["__other"] : [])].map((s) => {
            const list = s === "__other" ? other : byState(s);
            return (
              <section
                key={s}
                role="listitem"
                aria-label={s === "__other" ? t("m.dispatch.other") : t(`status.${s}`)}
                className="w-60 shrink-0 rounded-2xl bg-slate-100/70 p-2.5"
              >
                <h2 className="mb-2 flex items-center justify-between text-[11px] font-extrabold uppercase text-slate-600">
                  <span>{s === "__other" ? t("m.dispatch.other") : t(`status.${s}`)}</span>
                  <span className="rounded-full bg-white px-1.5">{list.length}</span>
                </h2>
                <ul className="space-y-2">{list.map(renderCard)}</ul>
              </section>
            );
          })}
        </div>
      </PageState>

      <Drawer
        open={Boolean(openId)}
        title={t("m.dispatch.jobTitle", { id: job?.order_number ?? openId ?? "" })}
        onClose={() => {
          setOpenId(null);
          setNotice("");
        }}
      >
        <PageState
          loading={detail.loading}
          error={detail.error}
          denied={detail.denied}
          onRetry={detail.reload}
          empty={!job}
        >
          {job && (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <KV label={t("common.status")}>
                  <StatusBadge code={job.status} />
                </KV>
                <KV label={t("m.dispatch.rider")}>
                  {job.rider_name ?? t("m.dispatch.unassigned")}
                </KV>
                <KV label={t("m.dispatch.pickup")}>{job.pickup ?? t("common.dash")}</KV>
                <KV label={t("m.dispatch.drop")}>{job.drop ?? t("common.dash")}</KV>
              </dl>
              {job.exception_reason && <Notice tone="error">{job.exception_reason}</Notice>}
              {(job.events ?? []).length === 0 ? (
                <EmptyBox text={t("m.dispatch.noEvents")} />
              ) : (
                <ol
                  aria-label={t("m.dispatch.events")}
                  className="space-y-1 text-xs text-slate-600"
                >
                  {(job.events ?? []).map((e) => (
                    <li key={e.id}>
                      {f.dateTime(e.at)} — {t(`status.${e.status}`, { defaultValue: e.status })}
                      {e.note ? ` (${e.note})` : ""}
                    </li>
                  ))}
                </ol>
              )}
              {canManage && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button
                    onClick={() => {
                      action.clear();
                      setPending("reassign");
                    }}
                  >
                    {t("m.dispatch.reassign")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      action.clear();
                      setPending("cancel");
                    }}
                  >
                    {t("m.dispatch.cancel")}
                  </Button>
                  {job.exception_id && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        action.clear();
                        setResolving(true);
                      }}
                    >
                      {t("m.dispatch.resolve")}
                    </Button>
                  )}
                </div>
              )}
              {!pending && !resolving && action.error ? <ErrorBox error={action.error} /> : null}
            </>
          )}
        </PageState>
      </Drawer>

      <ReasonDialog
        open={pending !== null}
        danger={pending === "cancel"}
        title={pending ? t(`m.dispatch.dialog.${pending}.title`) : ""}
        description={pending ? t(`m.dispatch.dialog.${pending}.body`) : undefined}
        confirmLabel={pending ? t(`m.dispatch.${pending}`) : ""}
        busy={action.busy}
        error={action.error}
        onConfirm={confirm}
        onClose={() => {
          setPending(null);
          action.clear();
        }}
      >
        {pending === "cancel" && (
          <SelectInput
            label={t("m.dispatch.cancelCode")}
            value={cancelCode}
            onChange={(e) => setCancelCode(e.target.value)}
          >
            {CANCEL_CODES.map((c) => (
              <option key={c} value={c}>
                {t(`m.dispatch.cancelCodes.${c}`)}
              </option>
            ))}
          </SelectInput>
        )}
      </ReasonDialog>
      <Modal
        open={resolving}
        title={t("m.dispatch.dialog.resolve.title")}
        onClose={() => setResolving(false)}
        footer={
          <>
            <Button onClick={() => setResolving(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              busy={action.busy}
              disabled={note.trim().length < 3}
              onClick={resolve}
            >
              {t("m.dispatch.resolve")}
            </Button>
          </>
        }
      >
        <SelectInput
          label={t("m.dispatch.outcome")}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          {EXCEPTION_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {t(`m.dispatch.outcomes.${o}`)}
            </option>
          ))}
        </SelectInput>
        <TextInput
          label={t("common.notes")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
        />
        {action.error ? <ErrorBox error={action.error} /> : null}
      </Modal>
    </div>
  );
};
