import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { organizationApi } from "../../api/organization.api";
import { organizationOpsApi } from "../../api/organization-ops.api";
import type { OrgLocationInput } from "../../api/organization-ops.api";
import { planApi } from "../../api/plan.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { codeLabel } from "../../i18n/labels";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  DataTable,
  ErrorBox,
  FilterBar,
  Modal,
  Notice,
  PageHeader,
  PageState,
  Pager,
  SelectInput,
  StatusBadge,
  TextInput,
} from "../../components/master/ui";
import { TopbarAction } from "../../components/master/TopbarSlot";
import { useAction, useResource } from "../../components/master/useResource";
import type { Organization } from "../../@types";

const DOMAINS = ["Restaurant", "Service", "Logistics"];
const STEPS = ["business", "plan", "owner", "location", "ordering"] as const;
type Step = (typeof STEPS)[number];

interface WizardForm {
  business_name: string;
  domain: string;
  email: string;
  phone_number: string;
  plan_code: string;
  owner_email: string;
  locations: OrgLocationInput[];
  ordering_open: boolean;
}
const EMPTY: WizardForm = {
  business_name: "",
  domain: "Restaurant",
  email: "",
  phone_number: "",
  plan_code: "",
  owner_email: "",
  locations: [{ name: "", city: "" }],
  ordering_open: false,
};

export const CreateOrganizationWizard: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("business");
  const [form, setForm] = useState<WizardForm>(EMPTY);
  const action = useAction();
  const plans = useResource(() => planApi.getAll({ status: "Published" }), [], { enabled: open });

  React.useEffect(() => {
    if (open) {
      setStep("business");
      setForm(EMPTY);
      action.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const idx = STEPS.indexOf(step);

  // Presence checks only (the backend validates the real rules).
  const stepOk: Record<Step, boolean> = {
    business: Boolean(
      form.business_name.trim() && form.domain && form.email.trim() && form.phone_number.trim()
    ),
    plan: Boolean(form.plan_code),
    owner: Boolean(form.owner_email.trim()),
    location: form.locations.some((l) => l.name.trim()),
    ordering: true,
  };

  const submit = async () => {
    const res = await action.run(() =>
      organizationOpsApi.create({
        ...form,
        locations: form.locations.filter((l) => l.name.trim()),
      })
    );
    if (res !== undefined) onCreated();
  };

  const planItems = plans.data?.plans ?? [];
  return (
    <Modal
      open={open}
      title={t("m.orgs.wizard.title")}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          {idx > 0 && <Button onClick={() => setStep(STEPS[idx - 1])}>{t("common.back")}</Button>}
          {idx < STEPS.length - 1 ? (
            <Button
              variant="primary"
              disabled={!stepOk[step]}
              onClick={() => setStep(STEPS[idx + 1])}
            >
              {t("common.next")}
            </Button>
          ) : (
            <Button variant="primary" busy={action.busy} onClick={submit}>
              {t("m.orgs.wizard.create")}
            </Button>
          )}
        </>
      }
    >
      <ol className="mb-1 flex flex-wrap gap-1 text-[11px]" aria-label={t("m.orgs.wizard.steps")}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={s === step ? "step" : undefined}
            className={`rounded-full border px-2 py-0.5 ${s === step ? "border-[#65D000] bg-[#EEF9E8] font-bold text-[#337400]" : "border-slate-200 text-slate-500"}`}
          >
            {i + 1}. {t(`m.orgs.wizard.step.${s}`)}
          </li>
        ))}
      </ol>

      {step === "business" && (
        <div className="space-y-3">
          <TextInput
            label={t("m.orgs.wizard.businessName")}
            value={form.business_name}
            onChange={(e) => set("business_name", e.target.value)}
            required
          />
          <SelectInput
            label={t("m.orgs.wizard.domain")}
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {codeLabel(t, "orgs.directory.domain", d)}
              </option>
            ))}
          </SelectInput>
          <TextInput
            label={t("common.email")}
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
          <TextInput
            label={t("common.phone")}
            type="tel"
            value={form.phone_number}
            onChange={(e) => set("phone_number", e.target.value)}
            required
          />
        </div>
      )}
      {step === "plan" && (
        <div className="space-y-3">
          {plans.error ? <ErrorBox error={plans.error} onRetry={plans.reload} /> : null}
          <SelectInput
            label={t("m.orgs.wizard.plan")}
            value={form.plan_code}
            onChange={(e) => set("plan_code", e.target.value)}
          >
            <option value="">{t("m.orgs.wizard.planPlaceholder")}</option>
            {planItems.map((p) => (
              <option key={p.id} value={p.plan_code}>
                {p.name} ({p.plan_code})
              </option>
            ))}
          </SelectInput>
        </div>
      )}
      {step === "owner" && (
        <TextInput
          label={t("m.orgs.wizard.ownerEmail")}
          hint={t("m.orgs.wizard.ownerHint")}
          type="email"
          value={form.owner_email}
          onChange={(e) => set("owner_email", e.target.value)}
          required
        />
      )}
      {step === "location" && (
        <div className="space-y-3">
          {form.locations.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <TextInput
                label={t("m.orgs.wizard.locationName", { n: i + 1 })}
                value={l.name}
                onChange={(e) =>
                  set(
                    "locations",
                    form.locations.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                  )
                }
              />
              <TextInput
                label={t("m.orgs.wizard.locationCity")}
                value={l.city ?? ""}
                onChange={(e) =>
                  set(
                    "locations",
                    form.locations.map((x, j) => (j === i ? { ...x, city: e.target.value } : x))
                  )
                }
              />
              <Button
                variant="ghost"
                aria-label={t("m.orgs.wizard.removeLocation", { n: i + 1 })}
                disabled={form.locations.length <= 1}
                onClick={() =>
                  set(
                    "locations",
                    form.locations.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button onClick={() => set("locations", [...form.locations, { name: "", city: "" }])}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("m.orgs.wizard.addLocation")}
          </Button>
        </div>
      )}
      {step === "ordering" && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-xs text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#65D000]"
              checked={form.ordering_open}
              onChange={(e) => set("ordering_open", e.target.checked)}
            />
            <span>
              <span className="block font-semibold">{t("m.orgs.wizard.orderingOpen")}</span>
              <span className="block text-slate-500">{t("m.orgs.wizard.orderingHint")}</span>
            </span>
          </label>
          <dl className="rounded-xl bg-slate-50 p-3 text-xs">
            <div>
              {t("m.orgs.wizard.summary", {
                name: form.business_name,
                plan: form.plan_code,
                owner: form.owner_email,
              })}
            </div>
          </dl>
        </div>
      )}
      {action.error ? <ErrorBox error={action.error} /> : null}
    </Modal>
  );
};

export const OrganizationsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [wizard, setWizard] = useState(false);
  const [created, setCreated] = useState(false);

  const res = useResource(
    () =>
      organizationApi.getAll({
        page,
        limit: 20,
        search,
        status: status === "all" ? undefined : status,
      }),
    [page, search, status]
  );
  const orgs: Organization[] = res.data?.organizations ?? [];
  const canManage = can(FEAT.ORG_OPS.id, FEAT.ORG_OPS.create);

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.organization")}
        title={t("m.orgs.title")}
        subtitle={t("m.orgs.subtitle")}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setWizard(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("m.orgs.create")}
            </Button>
          )
        }
      />
      <TopbarAction>
        <Link
          to="/organizations/pipeline"
          className="text-xs font-semibold text-[#337400] underline"
        >
          {t("m.orgs.pipelineLink")}
        </Link>
      </TopbarAction>
      {created && (
        <div className="mb-3">
          <Notice>{t("m.orgs.created")}</Notice>
        </div>
      )}
      <FilterBar>
        <TextInput
          label={t("common.search")}
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("m.orgs.searchPlaceholder")}
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
          {["Active", "Pending", "Suspended", "Inactive"].map((s) => (
            <option key={s} value={s}>
              {codeLabel(t, "status", s)}
            </option>
          ))}
        </SelectInput>
      </FilterBar>
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={orgs.length === 0}
        emptyText={t("m.orgs.empty")}
      >
        <DataTable
          caption={t("m.orgs.title")}
          rows={orgs}
          rowKey={(o) => o.id}
          onRowClick={(o) => navigate(`/organizations/${o.id}/360`)}
          columns={[
            {
              key: "name",
              header: t("common.name"),
              render: (o) => (
                <Link
                  className="font-semibold text-slate-900 hover:underline"
                  to={`/organizations/${o.id}/360`}
                >
                  {o.business_name}
                </Link>
              ),
            },
            {
              key: "domain",
              header: t("m.orgs.domain"),
              render: (o) => codeLabel(t, "orgs.directory.domain", o.domain),
            },
            {
              key: "email",
              header: t("common.email"),
              render: (o) => <span className="block max-w-[14rem] truncate">{o.email}</span>,
            },
            {
              key: "status",
              header: t("common.status"),
              render: (o) => <StatusBadge code={o.status} />,
            },
            { key: "created", header: t("m.orgs.created_at"), render: (o) => f.date(o.created_at) },
          ]}
        />
        <Pager page={page} totalPages={res.data?.pagination?.totalPages ?? 1} onPage={setPage} />
      </PageState>
      <CreateOrganizationWizard
        open={wizard}
        onClose={() => setWizard(false)}
        onCreated={() => {
          setWizard(false);
          setCreated(true);
          res.reload();
        }}
      />
    </div>
  );
};
