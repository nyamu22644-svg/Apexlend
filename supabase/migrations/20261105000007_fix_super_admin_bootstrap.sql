-- Correct the initial super-admin bootstrap permission lookup.
-- Migration 20261105000005 referenced a non-existent permissions.permission_code column.

create or replace function public.bootstrap_first_super_admin(
  target_auth_user_id uuid,
  target_employee_number text,
  target_job_title text default 'Super Administrator'
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare target_institution uuid; super_admin_role_id uuid;
begin
  if exists (select 1 from public.staff_members) then
    raise exception 'a staff account already exists; first-admin bootstrap is permanently closed';
  end if;

  select p.institution_id into target_institution
  from public.profiles p
  where p.id = target_auth_user_id and p.user_type = 'customer' and p.status = 'active';

  if target_institution is null then
    raise exception 'target must be an active customer profile provisioned by Supabase Auth';
  end if;

  update public.profiles set user_type = 'staff', updated_at = now()
  where id = target_auth_user_id and institution_id = target_institution;

  delete from public.customers
  where profile_id = target_auth_user_id and institution_id = target_institution;

  insert into public.staff_members (profile_id, institution_id, employee_number, job_title, approval_limit, is_active)
  values (target_auth_user_id, target_institution, target_employee_number, target_job_title, 999999999999.99, true);

  insert into public.roles (institution_id, code, name, is_system)
  values (target_institution, 'super_admin', 'Super Administrator', true)
  on conflict (institution_id, code) do update set name = excluded.name
  returning id into super_admin_role_id;

  insert into public.role_permissions (role_id, institution_id, permission_code)
  select super_admin_role_id, target_institution, code from public.permissions
  on conflict do nothing;

  insert into public.staff_role_assignments (staff_profile_id, role_id, institution_id, assigned_by)
  values (target_auth_user_id, super_admin_role_id, target_institution, target_auth_user_id);

  insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id, after_state)
  values (target_institution, target_auth_user_id, 'FIRST_SUPER_ADMIN_BOOTSTRAPPED', 'profile', target_auth_user_id,
    jsonb_build_object('employee_number', target_employee_number, 'role', 'super_admin'));

  return target_auth_user_id;
end $$;

revoke all on function public.bootstrap_first_super_admin(uuid, text, text) from public;
grant execute on function public.bootstrap_first_super_admin(uuid, text, text) to service_role;
