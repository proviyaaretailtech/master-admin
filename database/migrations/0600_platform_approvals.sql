-- 0600_platform_approvals.sql
-- Layer 1A (Master Governance): platform-wide approvals on top of the existing approval engine.
-- Founder decision 1: tiered limits, Controller + Backup Controller, sideways escalation, 48-hour expiry.
--
-- What it does
--   * approval_requests / approval_decisions gain a platform scope (organization_id empty only when scope = 'platform').
--   * New action types for platform work (payout release, ledger adjustment, rule publish, setting change, UI release,
--     partner reactivation, credit issue). Existing action types are unchanged.
--   * New table platform_approval_tiers: amount bands per action (who approves, expiry, escalation). Kept separate from
--     approval_policies so partner-side refunds never pick up a platform tier.
--   * New functions platform_approval_route / _create / _decide / _consume / _escalate_due.
--   * approval_decisions_guard: a platform branch is added in front; the organization branch is unchanged.
--
-- What it does NOT change
--   * approval_required, approval_request_create, approval_decide, approval_consume, approval_expire_stale,
--     approval_requests_guard: untouched. Partner refunds and team tasks behave exactly as before.
--   * No existing rows are modified (the approval tables were empty when this was written, 2026-10-23).
--
-- Apply: run this whole file once (it is one transaction). Undo: 0600_platform_approvals.rollback.sql.

begin;

-- ---------------------------------------------------------------- 1. requests: platform scope + escalation
alter table public.approval_requests
  add column scope text not null default 'org',
  add column escalate_at timestamptz,
  add column escalation_roles text[] not null default '{}',
  add column escalated_at timestamptz;

alter table public.approval_requests
  add constraint approval_requests_scope_check check (scope in ('org', 'platform'));

alter table public.approval_requests alter column organization_id drop not null;
alter table public.approval_requests
  add constraint approval_requests_scope_org check ((scope = 'org') = (organization_id is not null));

alter table public.approval_requests drop constraint approval_requests_action_type_check;
alter table public.approval_requests
  add constraint approval_requests_action_type_check check (action_type = any (array[
    'refund', 'pos_refund', 'pos_void', 'price_override', 'payout_adjustment', 'stock_adjustment', 'other',
    'payout_release', 'ledger_adjustment', 'rule_publish', 'setting_change', 'ui_release', 'partner_reactivation', 'credit_issue'
  ]));

create index approval_requests_platform_open on public.approval_requests (status, created_at desc) where scope = 'platform';

-- ---------------------------------------------------------------- 2. decisions: platform rows carry no organization
alter table public.approval_decisions alter column organization_id drop not null;

-- ---------------------------------------------------------------- 3. tiers
create table public.platform_approval_tiers (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in ('refund', 'ledger_adjustment', 'payout_release', 'rule_publish', 'setting_change',
                                                   'ui_release', 'partner_reactivation', 'credit_issue', 'other')),
  min_minor bigint not null default 0 check (min_minor >= 0),          -- band starts above this amount (exclusive), 0 = from the first paisa
  max_minor bigint check (max_minor is null or max_minor > min_minor), -- band ends at this amount (inclusive), null = no upper limit
  requires_approval boolean not null default true,                     -- false = the requester may act alone in this band
  approver_roles text[] not null default '{}',
  backup_roles text[] not null default '{}',
  expiry_hours integer not null default 48 check (expiry_hours between 1 and 720),
  escalate_after_minutes integer check (escalate_after_minutes is null or escalate_after_minutes between 5 and 10080),
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  label text not null check (char_length(btrim(label)) between 3 and 120),
  enabled boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_approval_tiers_roles check (not requires_approval or cardinality(approver_roles) > 0),
  constraint platform_approval_tiers_band_uq unique (action_type, min_minor)
);

alter table public.platform_approval_tiers enable row level security;
create policy platform_approval_tiers_platform_read on public.platform_approval_tiers
  for select to authenticated using (public.is_platform_admin());

create trigger platform_approval_tiers_audit after insert or update or delete on public.platform_approval_tiers
  for each row execute function public.audit_row_change();
create trigger platform_approval_tiers_updated_at before update on public.platform_approval_tiers
  for each row execute function public.set_updated_at();

-- Founder decision 1 (2026-10-21). Amounts in paise.
insert into public.platform_approval_tiers
  (action_type, min_minor, max_minor, requires_approval, approver_roles, backup_roles, expiry_hours, escalate_after_minutes, label)
values
  ('refund',            0,       50000, false, '{}',             '{}',                   48, null, 'Refund up to ₹500: support agent alone'),
  ('refund',        50000,      500000, true,  '{finance}',      '{controller}',         48, 240,  'Refund ₹501 to ₹5,000: Finance'),
  ('refund',       500000,        null, true,  '{controller}',   '{backup_controller}',  48, 240,  'Refund above ₹5,000: Controller'),
  ('ledger_adjustment',  0,    1000000, true,  '{finance}',      '{controller}',         48, 240,  'Adjustment up to ₹10,000: Finance (never alone)'),
  ('ledger_adjustment', 1000000,  null, true,  '{controller}',   '{backup_controller}',  48, 240,  'Adjustment above ₹10,000: Controller'),
  ('payout_release',     0,       null, true,  '{controller}',   '{backup_controller}',  48, 240,  'Every payout release: Controller');

-- ---------------------------------------------------------------- 4. escalation fields change only by escalation
create or replace function public.platform_approval_escalation_guard()
  returns trigger
  language plpgsql
  set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.scope is distinct from old.scope or new.escalate_at is distinct from old.escalate_at then
    raise exception 'APPROVAL_IMMUTABLE: scope and escalation time cannot be changed after the request is made';
  end if;
  if (new.escalation_roles, new.escalated_at) is distinct from (old.escalation_roles, old.escalated_at) then
    if old.escalated_at is not null or old.status <> 'pending' or new.escalated_at is null or cardinality(new.escalation_roles) = 0 then
      raise exception 'APPROVAL_IMMUTABLE: a request is escalated once, while pending';
    end if;
  end if;
  return new;
end $function$;

create trigger approval_requests_escalation_guard before update on public.approval_requests
  for each row execute function public.platform_approval_escalation_guard();

-- ---------------------------------------------------------------- 5. decision guard: platform branch in front
create or replace function public.approval_decisions_guard()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
declare r public.approval_requests%rowtype; v_role text;
begin
  select * into r from public.approval_requests where id = new.approval_request_id for update;
  if not found then raise exception 'APPROVAL_NOT_FOUND: approval request not found'; end if;
  -- 0600: platform requests. Master checks the decider's staff permission; the database checks the role is one the
  -- request names (or its escalation roles) and that nobody decides their own request.
  if r.scope = 'platform' then
    new.organization_id := null;
    if r.status <> 'pending' then raise exception 'APPROVAL_WRONG_STATE: this request is already %', r.status; end if;
    if r.expires_at <= now() then raise exception 'APPROVAL_EXPIRED: this request has expired'; end if;
    if new.decision in ('approved','rejected') then
      if new.decided_by = r.requested_by then raise exception 'APPROVAL_SELF_APPROVAL: the person who asked cannot approve or reject their own request'; end if;
      if new.decided_role is null or not (new.decided_role = any (r.approver_roles || r.escalation_roles)) then
        raise exception 'APPROVAL_FORBIDDEN: your role is not allowed to decide this request';
      end if;
    elsif new.decided_by <> r.requested_by and (new.decided_role is null or not (new.decided_role = any (r.approver_roles || r.escalation_roles))) then
      raise exception 'APPROVAL_FORBIDDEN: only the requester or an approver can cancel this request';
    end if;
    return new;
  end if;
  new.organization_id := r.organization_id;
  if r.status <> 'pending' then raise exception 'APPROVAL_WRONG_STATE: this request is already %', r.status; end if;
  if r.expires_at <= now() then raise exception 'APPROVAL_EXPIRED: this request has expired'; end if;
  -- the decider's role must be one the request names AND must hold approval.decide (permission = ceiling, request list = subset)
  select ro.slug into v_role from public.org_users ou join public.roles ro on ro.id = ou.role_id
    where ou.user_id = new.decided_by and ou.organization_id = r.organization_id and ou.status = 'active' and ro.slug = any (r.approver_roles)
      and exists (select 1 from public.role_permissions rp where rp.role_id = ro.id and rp.resource = 'approval' and rp.action = 'decide')
    order by ro.slug limit 1;
  if new.decision in ('approved','rejected') then
    if new.decided_by = r.requested_by then raise exception 'APPROVAL_SELF_APPROVAL: the person who asked cannot approve or reject their own request'; end if;
    if v_role is null then raise exception 'APPROVAL_FORBIDDEN: your role is not allowed to decide this request'; end if;
  else  -- cancelled: the requester may withdraw, or an approver
    if new.decided_by <> r.requested_by and v_role is null then raise exception 'APPROVAL_FORBIDDEN: only the requester or an approver can cancel this request'; end if;
  end if;
  new.decided_role := v_role;
  return new;
end $function$;

-- ---------------------------------------------------------------- 6. platform functions
-- Which band applies to an action and amount. No enabled band = fail closed: Controller must approve.
create or replace function public.platform_approval_route(p_action text, p_amount_minor bigint)
  returns table (tier_id uuid, requires_approval boolean, approver_roles text[], backup_roles text[], expiry_hours integer,
                 escalate_after_minutes integer, label text)
  language sql
  stable security definer
  set search_path to 'public', 'pg_temp'
as $function$
  select * from (
    select t.id, t.requires_approval, t.approver_roles, t.backup_roles, t.expiry_hours, t.escalate_after_minutes, t.label
      from public.platform_approval_tiers t
     where t.enabled and t.action_type = p_action
       and (coalesce(p_amount_minor, 0) > t.min_minor or (t.min_minor = 0 and coalesce(p_amount_minor, 0) = 0))
       and (t.max_minor is null or coalesce(p_amount_minor, 0) <= t.max_minor)
     order by t.min_minor desc limit 1
  ) band
  union all
  select null::uuid, true, array['controller'], array['backup_controller'], 48, 240, 'No band configured: Controller'
   where not exists (
     select 1 from public.platform_approval_tiers t
      where t.enabled and t.action_type = p_action
        and (coalesce(p_amount_minor, 0) > t.min_minor or (t.min_minor = 0 and coalesce(p_amount_minor, 0) = 0))
        and (t.max_minor is null or coalesce(p_amount_minor, 0) <= t.max_minor));
$function$;

-- Opens a platform approval request, or reports that none is needed. Retries with the same ask return the open request.
create or replace function public.platform_approval_create(p_action text, p_subject_type text, p_subject_id text, p_amount_minor bigint,
                                                           p_reason text, p_requested_by uuid, p_details jsonb default '{}'::jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
declare t record; v_id uuid;
begin
  if p_requested_by is null then raise exception 'APPROVAL_BAD_REQUEST: requester is required'; end if;
  select * into t from public.platform_approval_route(p_action, p_amount_minor);
  if not t.requires_approval then
    return jsonb_build_object('required', false, 'label', t.label);
  end if;
  select id into v_id from public.approval_requests
   where scope = 'platform' and action_type = p_action and subject_type = p_subject_type and subject_id = p_subject_id
     and amount_minor is not distinct from p_amount_minor and requested_by = p_requested_by
     and status in ('pending', 'approved') and expires_at > now()
   order by created_at desc limit 1;
  if v_id is null then
    insert into public.approval_requests (scope, organization_id, action_type, subject_type, subject_id, amount_minor, currency_code,
                                          requested_by, reason, details, approver_roles, expires_at, escalate_at)
    values ('platform', null, p_action, p_subject_type, p_subject_id, coalesce(p_amount_minor, 0), 'INR', p_requested_by, p_reason,
            coalesce(p_details, '{}'::jsonb) || jsonb_build_object('tier_id', t.tier_id, 'tier_label', t.label, 'backup_roles', t.backup_roles),
            t.approver_roles, now() + make_interval(hours => t.expiry_hours),
            case when t.escalate_after_minutes is not null then now() + make_interval(mins => t.escalate_after_minutes) end)
    returning id into v_id;
  end if;
  return jsonb_build_object('required', true, 'id', v_id, 'label', t.label);
end $function$;

-- Records a decision. Master has already checked that the actor holds p_actor_role.
create or replace function public.platform_approval_decide(p_request uuid, p_decision text, p_note text, p_actor uuid, p_actor_role text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
declare r public.approval_requests%rowtype;
begin
  if p_decision not in ('approved','rejected','cancelled') then raise exception 'APPROVAL_BAD_REQUEST: decision must be approved, rejected or cancelled'; end if;
  if p_actor is null then raise exception 'APPROVAL_BAD_REQUEST: who is deciding?'; end if;
  select * into r from public.approval_requests where id = p_request and scope = 'platform' for update;
  if not found then raise exception 'APPROVAL_NOT_FOUND: approval request not found'; end if;
  if r.status = 'pending' and r.expires_at <= now() then
    update public.approval_requests set status = 'expired' where id = r.id;
    return jsonb_build_object('id', r.id, 'status', 'expired');
  end if;
  insert into public.approval_decisions (approval_request_id, organization_id, decision, decided_by, decided_role, note)
  values (r.id, null, p_decision, p_actor, p_actor_role, p_note);
  update public.approval_requests set status = p_decision, decided_at = now(), decision_note = p_note,
         approver_id = case when p_decision in ('approved','rejected') then p_actor end where id = r.id;
  return jsonb_build_object('id', r.id, 'status', p_decision);
end $function$;

-- Uses an approval exactly once, for exactly what was asked.
create or replace function public.platform_approval_consume(p_request uuid, p_action text, p_subject_type text, p_subject_id text,
                                                            p_amount_minor bigint, p_actor uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
declare r public.approval_requests%rowtype;
begin
  select * into r from public.approval_requests where id = p_request and scope = 'platform' for update;
  if not found then raise exception 'APPROVAL_NOT_FOUND: approval request not found'; end if;
  if r.action_type <> p_action or r.subject_type <> p_subject_type or r.subject_id <> p_subject_id or r.amount_minor is distinct from coalesce(p_amount_minor, 0) then
    raise exception 'APPROVAL_MISMATCH: this approval was given for something else';
  end if;
  if r.status = 'executed' then raise exception 'APPROVAL_ALREADY_USED: this approval was already used'; end if;
  if r.status <> 'approved' then raise exception 'APPROVAL_NOT_APPROVED: request is %', r.status; end if;
  if r.expires_at <= now() then raise exception 'APPROVAL_EXPIRED: this approval has expired'; end if;
  update public.approval_requests set status = 'executed', executed_at = now() where id = r.id;
end $function$;

-- Adds the backup roles to pending platform requests past their escalation time. Sideways only, never to founders.
create or replace function public.platform_approval_escalate_due()
  returns integer
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
declare n integer;
begin
  update public.approval_requests r
     set escalation_roles = coalesce(array(select jsonb_array_elements_text(r.details -> 'backup_roles')), '{}'), escalated_at = now()
   where r.scope = 'platform' and r.status = 'pending' and r.escalated_at is null and r.escalate_at is not null and r.escalate_at <= now()
     and r.expires_at > now() and jsonb_array_length(coalesce(r.details -> 'backup_roles', '[]'::jsonb)) > 0;
  get diagnostics n = row_count;
  return n;
end $function$;

-- Only the server (Master backend) may call these.
revoke all on function public.platform_approval_route(text, bigint) from public, anon, authenticated;
revoke all on function public.platform_approval_create(text, text, text, bigint, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.platform_approval_decide(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.platform_approval_consume(uuid, text, text, text, bigint, uuid) from public, anon, authenticated;
revoke all on function public.platform_approval_escalate_due() from public, anon, authenticated;
revoke all on function public.platform_approval_escalation_guard() from public, anon, authenticated;
revoke all on table public.platform_approval_tiers from anon;
revoke insert, update, delete, truncate on table public.platform_approval_tiers from authenticated;

select public.schema_ledger_record('0600_platform_approvals.sql', null, 'Layer 1A: platform approvals, tiers, Controller escalation (founder decision 1)');

commit;
