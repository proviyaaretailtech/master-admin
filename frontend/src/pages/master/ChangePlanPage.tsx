import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { organizationOpsApi } from "../../api/organization-ops.api";
import { planApi } from "../../api/plan.api";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  Card,
  ErrorBox,
  PageHeader,
  PageState,
  ReasonDialog,
  SelectInput,
  StatusBadge,
} from "../../components/master/ui";
import { useAction, useResource } from "../../components/master/useResource";

export const ChangePlanPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [planCode, setPlanCode] = useState("");
  const [confirm, setConfirm] = useState(false);
  const action = useAction();

  const org = useResource(() => organizationOpsApi.get360(id), [id]);
  const plans = useResource(() => planApi.getAll({ status: "Published" }), []);
  const ent = useResource(() => organizationOpsApi.getEntitlements(id), [id]);

  const list = plans.data?.plans ?? [];
  const current = org.data?.plan?.code;
  const chosen = list.find((p) => p.plan_code === planCode);

  const submit = async (reason: string) => {
    const r = await action.run(() => organizationOpsApi.changePlan(id, planCode, reason));
    if (r !== undefined) navigate(`/organizations/${id}/360`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={org.data?.business_name}
        title={t("m.plan.title")}
        subtitle={t("m.plan.subtitle")}
        actions={
          <Link
            className="text-xs font-semibold text-[#337400] underline"
            to={`/organizations/${id}/360`}
          >
            {t("common.back")}
          </Link>
        }
      />
      <PageState
        loading={org.loading || plans.loading}
        error={org.error ?? plans.error}
        denied={org.denied || plans.denied}
        onRetry={() => {
          org.reload();
          plans.reload();
        }}
      >
        <div className="space-y-4">
          <Card title={t("m.plan.current")}>
            <p className="text-xs text-slate-700">
              {org.data?.plan
                ? `${org.data.plan.name ?? org.data.plan.code} (${org.data.plan.code})`
                : t("m.plan.none")}
            </p>
          </Card>
          <Card title={t("m.plan.new")}>
            <SelectInput
              label={t("m.plan.choose")}
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
            >
              <option value="">{t("m.orgs.wizard.planPlaceholder")}</option>
              {list.map((p) => (
                <option key={p.id} value={p.plan_code} disabled={p.plan_code === current}>
                  {p.name} ({p.plan_code})
                </option>
              ))}
            </SelectInput>
            {chosen && (
              <p className="mt-2 text-xs text-slate-500">
                {t("m.plan.price", {
                  price: f.moneyFrom(chosen as unknown as Record<string, unknown>, "price"),
                })}
              </p>
            )}
          </Card>
          <Card title={t("m.plan.entitlementsNow")}>
            {ent.error ? <ErrorBox error={ent.error} onRetry={ent.reload} /> : null}
            <ul className="grid gap-2 sm:grid-cols-2">
              {(ent.data?.modules ?? []).map((m) => (
                <li
                  key={m.key}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs"
                >
                  <span>{m.name ?? m.key}</span>
                  <StatusBadge code={m.enabled ? "enabled" : "disabled"} />
                </li>
              ))}
            </ul>
          </Card>
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={!planCode || planCode === current}
              onClick={() => setConfirm(true)}
            >
              {t("m.plan.submit")}
            </Button>
          </div>
        </div>
      </PageState>
      <ReasonDialog
        open={confirm}
        title={t("m.plan.confirmTitle")}
        description={t("m.plan.confirmBody", { plan: planCode })}
        confirmLabel={t("m.plan.confirm")}
        busy={action.busy}
        error={action.error}
        onConfirm={submit}
        onClose={() => {
          setConfirm(false);
          action.clear();
        }}
      />
    </div>
  );
};
