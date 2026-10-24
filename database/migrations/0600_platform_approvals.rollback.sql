-- 0600_platform_approvals.rollback.sql
-- Undoes 0600_platform_approvals.sql. Run only if 0600 must be removed.
-- Refuses to run if any platform approval request exists, so no approval history is ever lost.

begin;

do $$
begin
  if exists (select 1 from public.approval_requests where scope = 'platform') then
    raise exception 'ROLLBACK_BLOCKED: platform approval requests exist; keep 0600 or archive them first';
  end if;
end $$;

-- functions
drop function if exists public.platform_approval_escalate_due();
drop function if exists public.platform_approval_consume(uuid, text, text, text, bigint, uuid);
drop function if exists public.platform_approval_decide(uuid, text, text, uuid, text);
drop function if exists public.platform_approval_create(text, text, text, bigint, text, uuid, jsonb);
drop function if exists public.platform_approval_route(text, bigint);

-- decision guard back to its original body (organization branch only)
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

-- escalation guard
drop trigger if exists approval_requests_escalation_guard on public.approval_requests;
drop function if exists public.platform_approval_escalation_guard();

-- tiers
drop table if exists public.platform_approval_tiers;

-- decisions
alter table public.approval_decisions alter column organization_id set not null;

-- requests
drop index if exists public.approval_requests_platform_open;
alter table public.approval_requests drop constraint approval_requests_action_type_check;
alter table public.approval_requests
  add constraint approval_requests_action_type_check check (action_type = any (array[
    'refund', 'pos_refund', 'pos_void', 'price_override', 'payout_adjustment', 'stock_adjustment', 'other'
  ]));
alter table public.approval_requests drop constraint approval_requests_scope_org;
alter table public.approval_requests alter column organization_id set not null;
alter table public.approval_requests drop constraint approval_requests_scope_check;
alter table public.approval_requests
  drop column escalated_at,
  drop column escalation_roles,
  drop column escalate_at,
  drop column scope;

commit;
