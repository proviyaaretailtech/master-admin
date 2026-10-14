import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { APPLICATION_STATUSES, partnerApplicationApi } from "../../api/partner-applications.api";
import type {
  ApplicationDecision,
  DecisionResult,
  PartnerApplication,
  PartnerApplicationRow,
} from "../../api/partner-applications.api";
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

/** Only submitted or reviewing applications can be decided; the database enforces it again. */
const DECIDABLE = new Set(["submitted", "reviewing"]);

const Chips: React.FC<{ values: string[] }> = ({ values }) => {
  const { t } = useTranslation();
  if (!values.length) return <span className="text-slate-400">{t("common.dash")}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((v) => (
        <span
          key={v}
          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
        >
          {v}
        </span>
      ))}
    </span>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
    <h3 className="mb-2 text-xs font-bold text-slate-700">{title}</h3>
    <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>
  </section>
);

const LoginState: React.FC<{ a: PartnerApplication }> = ({ a }) => {
  const { t } = useTranslation();
  if (a.applicant_user_id) {
    return (
      <span>
        {a.applicant_login_email ?? t("common.dash")} ·{" "}
        {t(
          a.applicant_login_confirmed
            ? "m.applications.login.confirmed"
            : "m.applications.login.unconfirmed"
        )}
      </span>
    );
  }
  if (a.login_match?.found) {
    return (
      <span>
        {t(
          a.login_match.confirmed
            ? "m.applications.login.matchConfirmed"
            : "m.applications.login.matchUnconfirmed"
        )}
      </span>
    );
  }
  return <span>{t("m.applications.login.none")}</span>;
};

export const ApplicationDrawer: React.FC<{
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}> = ({ id, onClose, onChanged }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const allowed: Record<ApplicationDecision, boolean> = {
    approve: can(FEAT.PARTNER_REVIEW.id, FEAT.PARTNER_REVIEW.approve),
    reject: can(FEAT.PARTNER_REVIEW.id, FEAT.PARTNER_REVIEW.reject),
  };
  const [pending, setPending] = useState<ApplicationDecision | null>(null);
  const [done, setDone] = useState<DecisionResult | null>(null);
  const action = useAction();
  const res = useResource(() => partnerApplicationApi.get(id as string), [id], {
    enabled: Boolean(id),
  });
  const a = res.data;
  const dash = t("common.dash");

  const confirm = async (reason: string) => {
    if (!pending || !id) return;
    const out = await action.run(() => partnerApplicationApi.decide(id, pending, reason));
    if (out !== undefined) {
      setPending(null);
      setDone(out);
      onChanged();
      res.reload();
    }
  };
  const close = () => {
    setDone(null);
    onClose();
  };
  const buttons = (["approve", "reject"] as const).filter(
    (d) => allowed[d] && a && DECIDABLE.has(a.status)
  );

  return (
    <>
      <Drawer
        open={Boolean(id)}
        title={a?.business_name ?? t("m.applications.drawerTitle")}
        onClose={close}
      >
        <PageState
          loading={res.loading}
          error={res.error}
          denied={res.denied}
          onRetry={res.reload}
          empty={!a}
        >
          {a && (
            <div className="space-y-4">
              {done && (
                <Notice>
                  {done.status === "approved"
                    ? t(
                        done.owner_membership
                          ? "m.applications.done.approvedMember"
                          : "m.applications.done.approvedInvited"
                      )
                    : t("m.applications.done.rejected")}
                </Notice>
              )}
              <Section title={t("m.applications.section.review")}>
                <KV label={t("common.status")}>
                  <StatusBadge code={a.status} />
                </KV>
                <KV label={t("m.applications.reference")}>{a.reference}</KV>
                <KV label={t("m.applications.submittedAt")}>
                  {a.created_at ? f.dateTime(a.created_at) : dash}
                </KV>
                <KV label={t("m.applications.source")}>
                  {a.source
                    ? t(`m.applications.sourceName.${a.source}`, { defaultValue: a.source })
                    : dash}
                </KV>
                {a.reviewed_at && (
                  <KV label={t("m.applications.reviewedAt")}>
                    {f.dateTime(a.reviewed_at)}
                    {a.reviewed_by_name ? ` · ${a.reviewed_by_name}` : ""}
                  </KV>
                )}
                {a.review_note && <KV label={t("m.applications.reviewNote")}>{a.review_note}</KV>}
                {a.organization_id && (
                  <KV label={t("m.applications.organization")}>
                    <Link
                      className="font-semibold text-slate-900 underline"
                      to={`/organizations/${a.organization_id}/360`}
                    >
                      {a.organization_name ?? a.organization_id}
                    </Link>
                  </KV>
                )}
              </Section>
              <Section title={t("m.applications.section.business")}>
                <KV label={t("common.name")}>{a.business_name}</KV>
                <KV label={t("m.applications.partnerType")}>
                  {a.partner_type
                    ? t(`m.applications.partnerTypeName.${a.partner_type}`, {
                        defaultValue: a.partner_type,
                      })
                    : dash}
                </KV>
                <KV label={t("m.applications.categoryFamily")}>{a.category_family ?? dash}</KV>
                <KV label={t("m.applications.categories")}>
                  <Chips values={a.categories} />
                </KV>
                <KV label={t("m.applications.subcategories")}>
                  <Chips values={a.subcategories} />
                </KV>
                <KV label={t("m.applications.businessType")}>{a.business_type ?? dash}</KV>
                <KV label={t("m.applications.outlets")}>
                  {a.outlets === undefined ? dash : f.number(a.outlets)}
                </KV>
                <KV label={t("m.applications.services")}>
                  <Chips
                    values={a.services.map((s) =>
                      t(`m.applications.serviceName.${s}`, { defaultValue: s })
                    )}
                  />
                </KV>
                <KV label={t("m.applications.ownDelivery")}>
                  {a.own_delivery ? t("common.yes") : t("common.no")}
                </KV>
              </Section>
              <Section title={t("m.applications.section.owner")}>
                <KV label={t("m.applications.owner")}>{a.owner_name ?? dash}</KV>
                <KV label={t("common.phone")}>{a.phone ?? dash}</KV>
                <KV label={t("common.email")}>{a.email ?? dash}</KV>
                <KV label={t("m.applications.whatsapp")}>
                  {a.whatsapp_ok ? t("common.yes") : t("common.no")}
                </KV>
                <KV label={t("m.applications.login.label")}>
                  <LoginState a={a} />
                </KV>
              </Section>
              <Section title={t("m.applications.section.address")}>
                <KV label={t("common.address")}>{a.address ?? dash}</KV>
                <KV label={t("m.applications.pinCode")}>{a.pin_code ?? dash}</KV>
                <KV label={t("m.applications.city")}>{a.city_name ?? a.city_id ?? dash}</KV>
              </Section>
              <Section title={t("m.applications.section.compliance")}>
                <KV label={t("m.applications.gstin")}>{a.gstin ?? dash}</KV>
                <KV label={t("m.applications.fssai")}>{a.fssai ?? dash}</KV>
                <KV label={t("m.applications.consent")}>
                  {a.consent_version ?? dash}
                  {a.consent_at ? ` · ${f.dateTime(a.consent_at)}` : ""}
                </KV>
                <KV label={t("common.notes")}>{a.notes ?? dash}</KV>
              </Section>
              {a.history.length > 0 && (
                <section className="border-t border-slate-100 pt-3">
                  <h3 className="mb-1 text-xs font-bold text-slate-700">
                    {t("m.applications.history")}
                  </h3>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {a.history.map((h) => (
                      <li key={h.id}>
                        {f.dateTime(h.created_at)} —{" "}
                        {t(`m.applications.audit.${h.action.replace(/\./g, "_")}`, {
                          defaultValue: h.action,
                        })}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {buttons.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {buttons.map((d) => (
                    <Button
                      key={d}
                      variant={d === "approve" ? "primary" : "danger"}
                      onClick={() => {
                        action.clear();
                        setPending(d);
                      }}
                    >
                      {t(`m.applications.action.${d}`)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </PageState>
      </Drawer>
      <ReasonDialog
        open={pending !== null}
        required={pending === "reject"}
        danger={pending === "reject"}
        title={pending ? t(`m.applications.dialog.${pending}.title`) : ""}
        description={
          pending
            ? t(`m.applications.dialog.${pending}.body`, { name: a?.business_name ?? "" })
            : undefined
        }
        reasonLabel={t(pending === "approve" ? "m.applications.noteOptional" : "common.reason")}
        confirmLabel={pending ? t(`m.applications.action.${pending}`) : ""}
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

export const PartnerApplicationsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const [status, setStatus] = useState("submitted");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const res = useResource(() => partnerApplicationApi.list({ status, q, page }), [status, q, page]);
  const rows: PartnerApplicationRow[] = res.data?.items ?? [];
  const counts = res.data?.counts ?? {};
  const dash = t("common.dash");

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.organization")}
        title={t("m.applications.title")}
        subtitle={t("m.applications.subtitle")}
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
          placeholder={t("m.applications.searchPlaceholder")}
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
          {APPLICATION_STATUSES.map((s) => (
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
        emptyText={t("m.applications.empty")}
      >
        <DataTable
          caption={t("m.applications.title")}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          columns={[
            {
              key: "b",
              header: t("m.applications.business"),
              render: (r) => (
                <button
                  type="button"
                  className="text-left font-semibold text-slate-900 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenId(r.id);
                  }}
                >
                  {r.business_name}
                  <span className="block text-[11px] font-normal text-slate-500">
                    {r.reference}
                  </span>
                </button>
              ),
            },
            {
              key: "c",
              header: t("m.applications.categories"),
              render: (r) => <Chips values={r.categories} />,
            },
            {
              key: "o",
              header: t("m.applications.owner"),
              render: (r) => (
                <span>
                  {r.owner_name ?? dash}
                  <span className="block text-[11px] text-slate-500">{r.phone ?? ""}</span>
                </span>
              ),
            },
            { key: "city", header: t("m.applications.city"), render: (r) => r.city_id ?? dash },
            {
              key: "s",
              header: t("common.status"),
              render: (r) => <StatusBadge code={r.status} />,
            },
            {
              key: "d",
              header: t("m.applications.submittedAt"),
              render: (r) => (r.created_at ? f.dateTime(r.created_at) : dash),
            },
          ]}
        />
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
      </PageState>
      <ApplicationDrawer id={openId} onClose={() => setOpenId(null)} onChanged={res.reload} />
    </div>
  );
};
