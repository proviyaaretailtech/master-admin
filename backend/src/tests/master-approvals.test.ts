/**
 * Layer 1A platform approvals (0600, founder decision 1): tiers route requests to Finance / Controller,
 * the requester can never decide, the wrong band is refused, an approval is used once, overdue Controller
 * requests escalate sideways to the Backup Controller, and only founders change the limits.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../index";
import { query } from "../config/database.config";
import { createStaff, cleanup, TestStaff } from "./helpers/testkit";
import { staffWith, bearer, tag } from "./helpers/master-kit";

const staffIds: string[] = [];
const roleKeys: string[] = [];
let requester: TestStaff;
let finance: TestStaff;
let controller: TestStaff;
let backup: TestStaff;
let founder: TestStaff;

const ask = (who: TestStaff, body: Record<string, unknown>) =>
  request(app).post("/api/approvals").set(bearer(who)).send({ subject_type: "test", subject_id: `t-${tag()}`, reason: "Test request", ...body });

describe("platform approvals (0600)", () => {
  beforeAll(async () => {
    requester = await staffWith({ feat_approvals: ["view_approvals", "request_approval"] }, roleKeys);
    finance = await staffWith({ feat_approvals: ["view_approvals", "approve_as_finance"] }, roleKeys);
    controller = await staffWith({ feat_approvals: ["view_approvals", "approve_as_controller", "request_approval"] }, roleKeys);
    backup = await staffWith({ feat_approvals: ["view_approvals", "approve_as_backup_controller"] }, roleKeys);
    founder = await createStaff({ roleKey: "super_admin" });
    staffIds.push(requester.id, finance.id, controller.id, backup.id, founder.id);
  });
  afterAll(async () => {
    await cleanup({ staffIds, roleKeys });
  });

  it("lists the decision 1 limits", async () => {
    const res = await request(app).get("/api/approvals/tiers").set(bearer(requester));
    expect(res.status).toBe(200);
    const refund = res.body.tiers.filter((t: { action_type: string }) => t.action_type === "refund");
    expect(refund.map((t: { min_minor: string }) => Number(t.min_minor))).toEqual([0, 50000, 500000]);
    expect(refund[0].requires_approval).toBe(false);
  });

  it("a refund up to ₹500 needs no approval", async () => {
    const res = await ask(requester, { action_type: "refund", amount_minor: 50000 });
    expect(res.status).toBe(200);
    expect(res.body.result.required).toBe(false);
  });

  it("a ₹2,000 refund goes to Finance; Finance approves; the requester cannot", async () => {
    const subject = `refund-${tag()}`;
    const res = await ask(requester, { action_type: "refund", amount_minor: 200000, subject_id: subject });
    expect(res.status).toBe(201);
    const id = res.body.result.id;
    const again = await ask(requester, { action_type: "refund", amount_minor: 200000, subject_id: subject });
    expect(again.body.result.id).toBe(id); // a double tap returns the open request, never a second one

    const mine = await request(app).get("/api/approvals?view=mine").set(bearer(finance));
    expect(mine.body.approvals.map((a: { id: string }) => a.id)).toContain(id);
    const notMine = await request(app).get("/api/approvals?view=mine").set(bearer(requester));
    expect(notMine.body.approvals.map((a: { id: string }) => a.id)).not.toContain(id);

    const wrongBand = await request(app).post(`/api/approvals/${id}/decide`).set(bearer(controller)).send({ decision: "approved" });
    expect(wrongBand.status).toBe(403);

    const ok = await request(app).post(`/api/approvals/${id}/decide`).set(bearer(finance)).send({ decision: "approved", note: "fine" });
    expect(ok.status).toBe(200);
    expect(ok.body.approval.status).toBe("approved");
    expect(ok.body.decisions[0].decided_role).toBe("finance");

    const twice = await request(app).post(`/api/approvals/${id}/decide`).set(bearer(finance)).send({ decision: "rejected", note: "changed my mind" });
    expect(twice.status).toBe(409);
  });

  it("the person who asked can never approve, even holding the right role", async () => {
    const res = await ask(controller, { action_type: "payout_release", amount_minor: 1000 });
    const id = res.body.result.id;
    const self = await request(app).post(`/api/approvals/${id}/decide`).set(bearer(controller)).send({ decision: "approved" });
    expect(self.status).toBe(409);
  });

  it("rejecting needs a reason", async () => {
    const res = await ask(requester, { action_type: "payout_release", amount_minor: 1000 });
    const bad = await request(app).post(`/api/approvals/${res.body.result.id}/decide`).set(bearer(controller)).send({ decision: "rejected" });
    expect(bad.status).toBe(400);
  });

  it("an approval is used once, for exactly what was asked", async () => {
    const res = await ask(requester, { action_type: "payout_release", amount_minor: 2500, subject_id: "payout-1" });
    const id = res.body.result.id;
    await request(app).post(`/api/approvals/${id}/decide`).set(bearer(controller)).send({ decision: "approved" });
    await expect(query(`SELECT public.platform_approval_consume($1, 'payout_release', 'test', 'payout-1', 9999, $2);`, [id, requester.id])).rejects.toThrow(/APPROVAL_MISMATCH/);
    await query(`SELECT public.platform_approval_consume($1, 'payout_release', 'test', 'payout-1', 2500, $2);`, [id, requester.id]);
    await expect(query(`SELECT public.platform_approval_consume($1, 'payout_release', 'test', 'payout-1', 2500, $2);`, [id, requester.id])).rejects.toThrow(/APPROVAL_ALREADY_USED/);
  });

  it("an overdue Controller request escalates sideways to the Backup Controller, never to founders", async () => {
    const res = await ask(requester, { action_type: "payout_release", amount_minor: 3000 });
    const id = res.body.result.id;
    // before its escalation time the Backup Controller cannot decide, and nothing escalates early
    expect((await request(app).post(`/api/approvals/${id}/decide`).set(bearer(backup)).send({ decision: "approved" })).status).toBe(403);
    expect(await query(`SELECT public.platform_approval_escalate_due() AS n;`).then((r) => r.rows[0].n)).toBe(0);
    // the escalation time comes from the tier at creation (escalate_at cannot be edited afterwards)
    const t = await query<{ id: string }>(`SELECT id FROM platform_approval_tiers WHERE action_type = 'payout_release';`);
    await query(`UPDATE platform_approval_tiers SET escalate_after_minutes = 5 WHERE id = $1;`, [t.rows[0].id]);
    const res2 = await ask(requester, { action_type: "payout_release", amount_minor: 3001 });
    const id2 = res2.body.result.id;
    const row = await query<{ escalate_at: Date; escalation_roles: string[] }>(`SELECT escalate_at, escalation_roles FROM approval_requests WHERE id = $1;`, [id2]);
    expect(row.rows[0].escalation_roles).toEqual([]);
    expect(new Date(row.rows[0].escalate_at).getTime() - Date.now()).toBeLessThanOrEqual(5 * 60_000 + 5_000);
    await query(`UPDATE platform_approval_tiers SET escalate_after_minutes = 240 WHERE id = $1;`, [t.rows[0].id]);
    // escalation can only be applied once, while pending, with roles
    await expect(query(`UPDATE approval_requests SET escalation_roles = '{}', escalated_at = now() WHERE id = $1;`, [id2])).rejects.toThrow(/APPROVAL_IMMUTABLE/);
    await query(`UPDATE approval_requests SET escalation_roles = '{backup_controller}', escalated_at = now() WHERE id = $1;`, [id2]);
    const escalated = await request(app).get("/api/approvals?view=mine").set(bearer(backup));
    expect(escalated.body.approvals.map((a: { id: string }) => a.id)).toContain(id2);
    expect((await request(app).post(`/api/approvals/${id2}/decide`).set(bearer(backup)).send({ decision: "approved" })).status).toBe(200);
    const founderInbox = await request(app).get("/api/approvals?view=escalated").set(bearer(founder));
    expect(founderInbox.status).toBe(200);
  });

  it("the requester can withdraw a pending request; nobody else can", async () => {
    const res = await ask(requester, { action_type: "setting_change", amount_minor: 0 });
    const id = res.body.result.id;
    expect((await request(app).post(`/api/approvals/${id}/cancel`).set(bearer(finance)).send({})).status).toBe(403);
    const ok = await request(app).post(`/api/approvals/${id}/cancel`).set(bearer(requester)).send({ note: "not needed" });
    expect(ok.status).toBe(200);
    expect(ok.body.approval.status).toBe("cancelled");
  });

  it("only founders change approval limits, with a reason", async () => {
    const t = await query<{ id: string }>(`SELECT id FROM platform_approval_tiers WHERE action_type = 'refund' AND min_minor = 50000;`);
    const tierHolder = await staffWith({ feat_approvals: ["view_approvals", "edit_approval_limits"] }, roleKeys);
    staffIds.push(tierHolder.id);
    const notFounder = await request(app).put(`/api/approvals/tiers/${t.rows[0].id}`).set(bearer(tierHolder)).send({ expiry_hours: 24, reason: "shorter" });
    expect(notFounder.status).toBe(403);
    const noReason = await request(app).put(`/api/approvals/tiers/${t.rows[0].id}`).set(bearer(founder)).send({ expiry_hours: 24 });
    expect(noReason.status).toBe(400);
    const ok = await request(app).put(`/api/approvals/tiers/${t.rows[0].id}`).set(bearer(founder)).send({ expiry_hours: 24, reason: "shorter" });
    expect(ok.status).toBe(200);
    expect(ok.body.tier.expiry_hours).toBe(24);
    await request(app).put(`/api/approvals/tiers/${t.rows[0].id}`).set(bearer(founder)).send({ expiry_hours: 48, reason: "restore" });
  });

  it("partner-side approval functions still ignore platform requests", async () => {
    const r = await query<{ n: number }>(`SELECT count(*)::int AS n FROM approval_requests WHERE scope = 'platform' AND organization_id IS NOT NULL;`);
    expect(r.rows[0].n).toBe(0);
    await expect(query(`INSERT INTO approval_requests (scope, organization_id, action_type, subject_type, subject_id, requested_by, reason, approver_roles, expires_at)
                        VALUES ('org', NULL, 'refund', 'x', 'y', $1, 'abc', '{finance}', now() + interval '1 hour');`, [requester.id])).rejects.toThrow();
  });
});
