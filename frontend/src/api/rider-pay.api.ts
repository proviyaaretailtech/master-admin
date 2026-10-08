import { httpGet, httpPut, num, str, toPage } from "./_http";
import type { Row } from "./_http";

export interface City {
  id: string;
  name: string;
  state?: string;
}
export interface RateCard {
  city_id?: string;
  base_minor: number;
  per_km_minor: number;
  min_minor: number;
  active: boolean;
  updated_at?: string;
}
export interface RiderPolicy {
  city_id?: string;
  withdraw_min_minor: number;
  withdraw_max_minor: number;
  withdraw_per_day: number;
  default_cash_limit_minor: number;
  unavailable_wait_seconds: number;
  updated_at?: string;
}

export const riderPayApi = {
  async cities(): Promise<City[]> {
    const pg = toPage<Row>(await httpGet("/cities"), "cities");
    return pg.items.map((c) => ({ id: String(c.city_id ?? c.id), name: String(c.name) }));
  },
  async getRateCard(cityId: string): Promise<RateCard | null> {
    const r = await httpGet<Row>(`/rider-pay/rate-cards/${encodeURIComponent(cityId)}`);
    const c = r.rate_card as Row | null;
    return c
      ? {
          city_id: cityId,
          base_minor: num(c.base_minor),
          per_km_minor: num(c.per_km_minor),
          min_minor: num(c.min_minor),
          active: c.active === true,
          updated_at: str(c.created_at),
        }
      : null;
  },
  putRateCard: (cityId: string, b: RateCard) =>
    httpPut(`/rider-pay/rate-cards/${encodeURIComponent(cityId)}`, {
      base_minor: b.base_minor,
      per_km_minor: b.per_km_minor,
      min_minor: b.min_minor,
      active: b.active,
    }),
  async getPolicy(cityId: string): Promise<RiderPolicy | null> {
    const r = await httpGet<Row>(`/rider-pay/policies/${encodeURIComponent(cityId)}`);
    const p = r.policy as Row | null;
    return p
      ? {
          city_id: cityId,
          withdraw_min_minor: num(p.withdraw_min_minor),
          withdraw_max_minor: num(p.withdraw_max_minor),
          withdraw_per_day: num(p.withdraw_per_day),
          default_cash_limit_minor: num(p.default_cash_limit_minor),
          unavailable_wait_seconds: num(p.unavailable_wait_seconds),
          updated_at: str(p.updated_at),
        }
      : null;
  },
  putPolicy: (cityId: string, b: RiderPolicy) =>
    httpPut(`/rider-pay/policies/${encodeURIComponent(cityId)}`, {
      withdraw_min_minor: b.withdraw_min_minor,
      withdraw_max_minor: b.withdraw_max_minor,
      withdraw_per_day: b.withdraw_per_day,
      default_cash_limit_minor: b.default_cash_limit_minor,
      unavailable_wait_seconds: b.unavailable_wait_seconds,
    }),
};
