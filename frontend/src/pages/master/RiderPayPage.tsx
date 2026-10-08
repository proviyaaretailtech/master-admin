import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { riderPayApi } from "../../api/rider-pay.api";
import type { RateCard, RiderPolicy } from "../../api/rider-pay.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { isApiError } from "../../lib/api-error";
import { majorStringToMinor, minorToMajorString } from "../../lib/units";
import {
  Button,
  Card,
  ErrorBox,
  Notice,
  PageHeader,
  PageState,
  SelectInput,
  TextInput,
} from "../../components/master/ui";
import { useAction, useResource } from "../../components/master/useResource";

const orNull = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch (e) {
    if (isApiError(e) && e.status === 404) return null;
    throw e;
  }
};

const RateCardForm: React.FC<{ cityId: string; canEdit: boolean }> = ({ cityId, canEdit }) => {
  const { t } = useTranslation();
  const res = useResource(() => orNull(riderPayApi.getRateCard(cityId)), [cityId]);
  const [v, setV] = useState({ base: "", perKm: "", min: "", active: true });
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const action = useAction();

  useEffect(() => {
    const d = res.data;
    setV({
      base: minorToMajorString(d?.base_minor),
      perKm: minorToMajorString(d?.per_km_minor),
      min: minorToMajorString(d?.min_minor),
      active: d?.active ?? true,
    });
    setSaved(false);
    setInvalid(false);
  }, [res.data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = majorStringToMinor(v.base);
    const perKm = majorStringToMinor(v.perKm);
    const min = majorStringToMinor(v.min);
    if (base === null || perKm === null || min === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const body: RateCard = {
      base_minor: base,
      per_km_minor: perKm,
      min_minor: min,
      active: v.active,
    };
    const r = await action.run(() => riderPayApi.putRateCard(cityId, body));
    if (r !== undefined) {
      setSaved(true);
      res.reload();
    }
  };

  return (
    <Card title={t("m.riderPay.rateCard")}>
      <PageState loading={res.loading} error={res.error} denied={res.denied} onRetry={res.reload}>
        <form onSubmit={save} className="space-y-3" aria-label={t("m.riderPay.rateCard")}>
          <p className="text-xs text-slate-500">{t("m.riderPay.rupeesHint")}</p>
          {res.data === null && (
            <p className="text-xs text-amber-700">{t("m.riderPay.noRateCard")}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput
              label={t("m.riderPay.base")}
              inputMode="decimal"
              value={v.base}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, base: e.target.value })}
            />
            <TextInput
              label={t("m.riderPay.perKm")}
              inputMode="decimal"
              value={v.perKm}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, perKm: e.target.value })}
            />
            <TextInput
              label={t("m.riderPay.minPay")}
              inputMode="decimal"
              value={v.min}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, min: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#65D000]"
              checked={v.active}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, active: e.target.checked })}
            />
            {t("m.riderPay.active")}
          </label>
          {invalid && <Notice tone="error">{t("m.riderPay.invalidAmount")}</Notice>}
          {saved && <Notice>{t("m.riderPay.saved")}</Notice>}
          {action.error ? <ErrorBox error={action.error} /> : null}
          {canEdit && (
            <Button type="submit" variant="primary" busy={action.busy}>
              {t("common.save")}
            </Button>
          )}
        </form>
      </PageState>
    </Card>
  );
};

const PolicyForm: React.FC<{ cityId: string; canEdit: boolean }> = ({ cityId, canEdit }) => {
  const { t } = useTranslation();
  const res = useResource(() => orNull(riderPayApi.getPolicy(cityId)), [cityId]);
  const [v, setV] = useState({ wMin: "", wMax: "", perDay: "", cash: "", wait: "" });
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const action = useAction();

  useEffect(() => {
    const d = res.data;
    setV({
      wMin: minorToMajorString(d?.withdraw_min_minor),
      wMax: minorToMajorString(d?.withdraw_max_minor),
      perDay: d ? String(d.withdraw_per_day) : "",
      cash: minorToMajorString(d?.default_cash_limit_minor),
      wait: d ? String(d.unavailable_wait_seconds) : "",
    });
    setSaved(false);
    setInvalid(false);
  }, [res.data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const wMin = majorStringToMinor(v.wMin);
    const wMax = majorStringToMinor(v.wMax);
    const cash = majorStringToMinor(v.cash);
    const intOk = (s: string) => /^\d+$/.test(s.trim());
    if (wMin === null || wMax === null || cash === null || !intOk(v.perDay) || !intOk(v.wait)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const body: RiderPolicy = {
      withdraw_min_minor: wMin,
      withdraw_max_minor: wMax,
      withdraw_per_day: Number(v.perDay),
      default_cash_limit_minor: cash,
      unavailable_wait_seconds: Number(v.wait),
    };
    const r = await action.run(() => riderPayApi.putPolicy(cityId, body));
    if (r !== undefined) {
      setSaved(true);
      res.reload();
    }
  };

  return (
    <Card title={t("m.riderPay.policy")}>
      <PageState loading={res.loading} error={res.error} denied={res.denied} onRetry={res.reload}>
        <form onSubmit={save} className="space-y-3" aria-label={t("m.riderPay.policy")}>
          {res.data === null && (
            <p className="text-xs text-amber-700">{t("m.riderPay.noPolicy")}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label={t("m.riderPay.withdrawMin")}
              inputMode="decimal"
              value={v.wMin}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, wMin: e.target.value })}
            />
            <TextInput
              label={t("m.riderPay.withdrawMax")}
              inputMode="decimal"
              value={v.wMax}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, wMax: e.target.value })}
            />
            <TextInput
              label={t("m.riderPay.withdrawPerDay")}
              inputMode="numeric"
              value={v.perDay}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, perDay: e.target.value })}
            />
            <TextInput
              label={t("m.riderPay.cashLimit")}
              inputMode="decimal"
              value={v.cash}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, cash: e.target.value })}
            />
            <TextInput
              label={t("m.riderPay.waitSeconds")}
              inputMode="numeric"
              value={v.wait}
              disabled={!canEdit}
              onChange={(e) => setV({ ...v, wait: e.target.value })}
            />
          </div>
          {invalid && <Notice tone="error">{t("m.riderPay.invalidAmount")}</Notice>}
          {saved && <Notice>{t("m.riderPay.saved")}</Notice>}
          {action.error ? <ErrorBox error={action.error} /> : null}
          {canEdit && (
            <Button type="submit" variant="primary" busy={action.busy}>
              {t("common.save")}
            </Button>
          )}
        </form>
      </PageState>
    </Card>
  );
};

export const RiderPayPage: React.FC = () => {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canEdit = can(FEAT.RIDER_PAY.id, FEAT.RIDER_PAY.edit);
  const cities = useResource(() => riderPayApi.cities(), []);
  const [cityId, setCityId] = useState("");
  useEffect(() => {
    if (!cityId && cities.data && cities.data.length > 0) setCityId(cities.data[0].id);
  }, [cities.data, cityId]);

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.sections.operations")}
        title={t("m.riderPay.title")}
        subtitle={t("m.riderPay.subtitle")}
      />
      <PageState
        loading={cities.loading}
        error={cities.error}
        denied={cities.denied}
        onRetry={cities.reload}
        empty={(cities.data ?? []).length === 0}
        emptyText={t("m.riderPay.noCities")}
      >
        <div className="mb-4 max-w-xs">
          <SelectInput
            label={t("m.riderPay.city")}
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
          >
            {(cities.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </div>
        {cityId && (
          <div className="grid gap-4 xl:grid-cols-2">
            <RateCardForm cityId={cityId} canEdit={canEdit} />
            <PolicyForm cityId={cityId} canEdit={canEdit} />
          </div>
        )}
      </PageState>
    </div>
  );
};
