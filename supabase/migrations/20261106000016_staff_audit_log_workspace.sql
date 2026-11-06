-- Read-only staff audit workspace. Audit entries themselves continue to be written
-- by the relevant operational workflows; this function never fabricates entries.
insert into public.permissions(code, description)
values ('audit.read', 'View the institution audit trail')
on conflict (code) do nothing;

insert into public.role_permissions(role_id, institution_id, permission_code)
select id, institution_id, 'audit.read'
from public.roles
where code in ('super_admin', 'admin', 'compliance_auditor')
on conflict do nothing;

create or replace function public.get_staff_audit_events(p_limit integer default 1000)
returns table(
  audit_id uuid,
  occurred_at timestamptz,
  actor_name text,
  actor_role text,
  action text,
  target_type text,
  target_id text,
  category text,
  details text,
  before_state jsonb,
  after_state jsonb
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    e.id,
    e.occurred_at,
    coalesce(p.full_name, 'System'),
    coalesce((
      select r.code
      from public.staff_role_assignments a
      join public.roles r on r.id = a.role_id
      where a.staff_profile_id = e.actor_profile_id
        and a.institution_id = e.institution_id
        and a.revoked_at is null
      order by a.assigned_at desc
      limit 1
    ), 'system'),
    e.action,
    e.target_type,
    coalesce(e.target_id::text, 'System / institution'),
    case
      when e.action ~* 'LOAN|APPLICATION|CREDIT' then 'Credit'
      when e.action ~* 'DISBURSE' then 'Disbursement'
      when e.action ~* 'PAYMENT|REPAY' then 'Repayment'
      when e.action ~* 'CUSTOMER|KYC|COMPLAINT|ACCOUNT_CLOSURE' then 'Customer'
      when e.action ~* 'SETTINGS|INSTITUTION|POLICY|PRODUCT' then 'Configuration'
      when e.action ~* 'STAFF|SECURITY|ACCESS' then 'Security'
      when e.action ~* 'COLLECTION|PROMISE' then 'Collections'
      else 'Other'
    end,
    coalesce(e.after_state::text, e.before_state::text, 'No additional detail recorded'),
    e.before_state,
    e.after_state
  from public.audit_events e
  left join public.profiles p on p.id = e.actor_profile_id
  where e.institution_id = public.current_institution_id()
    and public.has_permission('audit.read')
  order by e.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 1000), 2000));
$$;

revoke all on function public.get_staff_audit_events(integer) from public;
grant execute on function public.get_staff_audit_events(integer) to authenticated;
