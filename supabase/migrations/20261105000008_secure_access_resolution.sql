-- Production foundation 8/8: expose only the signed-in user's effective access.
-- The browser must never infer a staff role or read RBAC assignment tables directly.

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_role_assignments enable row level security;
alter table public.staff_permission_overrides enable row level security;

create or replace function public.get_my_access()
returns table (
  profile_id uuid,
  institution_id uuid,
  user_type text,
  email text,
  full_name text,
  phone_number text,
  profile_status text,
  employee_number text,
  department text,
  approval_limit numeric,
  role_codes text[],
  permission_codes text[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.institution_id,
    p.user_type,
    p.email,
    p.full_name,
    p.phone_number,
    p.status,
    s.employee_number,
    s.department,
    s.approval_limit,
    coalesce(roles.codes, '{}'::text[]),
    coalesce(effective_permissions.codes, '{}'::text[])
  from public.profiles p
  left join public.staff_members s
    on s.profile_id = p.id
   and s.institution_id = p.institution_id
   and s.is_active
  left join lateral (
    select array_agg(distinct r.code order by r.code) as codes
    from public.staff_role_assignments a
    join public.roles r
      on r.id = a.role_id
     and r.institution_id = a.institution_id
    where a.staff_profile_id = p.id
      and a.institution_id = p.institution_id
      and a.revoked_at is null
  ) roles on true
  left join lateral (
    select array_agg(code order by code) as codes
    from (
      select rp.permission_code as code
      from public.staff_role_assignments a
      join public.role_permissions rp
        on rp.role_id = a.role_id
       and rp.institution_id = a.institution_id
      where a.staff_profile_id = p.id
        and a.institution_id = p.institution_id
        and a.revoked_at is null
        and not exists (
          select 1
          from public.staff_permission_overrides denied
          where denied.staff_profile_id = p.id
            and denied.institution_id = p.institution_id
            and denied.permission_code = rp.permission_code
            and denied.effect = 'deny'
        )
      union
      select allowed.permission_code
      from public.staff_permission_overrides allowed
      where allowed.staff_profile_id = p.id
        and allowed.institution_id = p.institution_id
        and allowed.effect = 'allow'
    ) effective
  ) effective_permissions on true
  where p.id = auth.uid()
    and p.status = 'active';
$$;

revoke all on function public.get_my_access() from public;
grant execute on function public.get_my_access() to authenticated;
