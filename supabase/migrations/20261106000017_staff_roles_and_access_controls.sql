-- Clear, operational staff roles. A role describes a job; permissions describe the
-- exact actions that job may perform. Super administrators retain every permission.

insert into public.roles(institution_id, code, name, is_system)
select i.id, r.code, r.name, true
from public.institutions i cross join (values
  ('super_admin', 'Super Administrator'),
  ('operations_manager', 'Operations Manager'),
  ('kyc_officer', 'KYC Officer'),
  ('credit_officer', 'Credit Officer'),
  ('loan_approver', 'Loan Approver'),
  ('disbursement_preparer', 'Disbursement Preparer'),
  ('disbursement_approver', 'Disbursement Approver'),
  ('finance_officer', 'Finance & Reconciliation Officer'),
  ('collections_agent', 'Collections Officer'),
  ('support_officer', 'Customer Support Officer'),
  ('compliance_auditor', 'Compliance Auditor'),
  ('product_settings_admin', 'Product & Settings Administrator')
) as r(code, name)
on conflict(institution_id, code) do update set name = excluded.name;

-- Roles are deliberately narrow. Financial makers and checkers are separate roles.
with grants(role_code, permission_code) as (values
 ('operations_manager','dashboard.read'), ('operations_manager','dashboard.configure'), ('operations_manager','customer.read'), ('operations_manager','customer.manage'), ('operations_manager','loan.read'), ('operations_manager','repayment.read'), ('operations_manager','collections.read'), ('operations_manager','collections.manage'), ('operations_manager','servicing.manage'), ('operations_manager','complaint.read'), ('operations_manager','complaint.manage'), ('operations_manager','account_closure.manage'),
 ('kyc_officer','kyc.read'), ('kyc_officer','kyc.decide'), ('kyc_officer','document.read_sensitive'), ('kyc_officer','customer.read'),
 ('credit_officer','application.read'), ('credit_officer','application.assess'), ('credit_officer','customer.read'),
 ('loan_approver','application.read'), ('loan_approver','application.approve'), ('loan_approver','customer.read'), ('loan_approver','loan.read'),
 ('disbursement_preparer','disbursement.create'), ('disbursement_preparer','loan.read'), ('disbursement_preparer','customer.read'),
 ('disbursement_approver','disbursement.approve'), ('disbursement_approver','loan.read'), ('disbursement_approver','customer.read'),
 ('finance_officer','repayment.read'), ('finance_officer','repayment.reverse'), ('finance_officer','provider.read'), ('finance_officer','loan.read'),
 ('collections_agent','collections.read'), ('collections_agent','collections.manage'), ('collections_agent','loan.read'), ('collections_agent','customer.read'),
 ('support_officer','complaint.read'), ('support_officer','complaint.manage'), ('support_officer','account_closure.manage'), ('support_officer','customer.read'), ('support_officer','customer.manage'),
 ('compliance_auditor','audit.read'), ('compliance_auditor','dashboard.read'), ('compliance_auditor','customer.read'), ('compliance_auditor','loan.read'), ('compliance_auditor','repayment.read'),
 ('product_settings_admin','product.read'), ('product_settings_admin','product.manage'), ('product_settings_admin','product.publish'), ('product_settings_admin','credit_policy.manage'), ('product_settings_admin','settings.manage')
)
insert into public.role_permissions(role_id, institution_id, permission_code)
select r.id, r.institution_id, g.permission_code
from grants g join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

-- Super Admin always has every permission, including permissions introduced later.
insert into public.role_permissions(role_id, institution_id, permission_code)
select r.id, r.institution_id, p.code
from public.roles r cross join public.permissions p
where r.code = 'super_admin'
on conflict do nothing;

create or replace function public.get_staff_access_management()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare inst uuid := public.current_institution_id();
begin
 if not public.has_permission('staff.manage') then raise exception 'permission denied'; end if;
 return jsonb_build_object(
  'staff', coalesce((select jsonb_agg(jsonb_build_object('profile_id',s.profile_id,'full_name',p.full_name,'email',p.email,'employee_number',s.employee_number,'department',s.department,'job_title',s.job_title,'approval_limit',s.approval_limit,'is_active',s.is_active,'role_code',r.code,'role_name',r.name,'allowed_permissions',coalesce((select jsonb_agg(o.permission_code order by o.permission_code) from public.staff_permission_overrides o where o.staff_profile_id=s.profile_id and o.institution_id=inst and o.effect='allow'),'[]'::jsonb),'denied_permissions',coalesce((select jsonb_agg(o.permission_code order by o.permission_code) from public.staff_permission_overrides o where o.staff_profile_id=s.profile_id and o.institution_id=inst and o.effect='deny'),'[]'::jsonb)) order by p.full_name) from public.staff_members s join public.profiles p on p.id=s.profile_id and p.institution_id=s.institution_id left join public.staff_role_assignments a on a.staff_profile_id=s.profile_id and a.institution_id=s.institution_id and a.revoked_at is null left join public.roles r on r.id=a.role_id where s.institution_id=inst),'[]'::jsonb),
  'roles', coalesce((select jsonb_agg(jsonb_build_object('code',r.code,'name',r.name,'description',case r.code when 'super_admin' then 'Can do everything in the application and manage staff access.' when 'operations_manager' then 'Oversees daily lending operations and assigns work.' when 'kyc_officer' then 'Checks customer identity documents and KYC.' when 'credit_officer' then 'Assesses loan applications and makes recommendations.' when 'loan_approver' then 'Independently approves or rejects credit recommendations.' when 'disbursement_preparer' then 'Prepares approved loans for payment.' when 'disbursement_approver' then 'Independently approves prepared payments.' when 'finance_officer' then 'Reviews repayments, reconciliation and payment exceptions.' when 'collections_agent' then 'Follows up overdue loans and payment promises.' when 'support_officer' then 'Handles complaints, closure requests and customer help.' when 'compliance_auditor' then 'Views audit records and reports without changing operations.' else 'Manages loan products, lending policies and settings.' end,'permissions',coalesce((select jsonb_agg(jsonb_build_object('code',p.code,'description',p.description) order by p.code) from public.role_permissions rp join public.permissions p on p.code=rp.permission_code where rp.role_id=r.id),'[]'::jsonb)) order by r.name) from public.roles r where r.institution_id=inst and r.code in ('super_admin','operations_manager','kyc_officer','credit_officer','loan_approver','disbursement_preparer','disbursement_approver','finance_officer','collections_agent','support_officer','compliance_auditor','product_settings_admin')),'[]'::jsonb),
  'permissions', coalesce((select jsonb_agg(jsonb_build_object('code',code,'description',description) order by code) from public.permissions),'[]'::jsonb)
 );
end $$;

create or replace function public.update_staff_access(p_staff_profile_id uuid,p_role_code text,p_approval_limit numeric,p_allowed_permissions text[] default array[]::text[],p_denied_permissions text[] default array[]::text[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); role_id uuid;
begin
 if not public.has_permission('staff.manage') or p_staff_profile_id=auth.uid() then raise exception 'permission denied'; end if;
 if p_approval_limit<0 then raise exception 'approval limit cannot be negative'; end if;
 select id into role_id from public.roles where institution_id=inst and code=p_role_code;
 if role_id is null or not exists(select 1 from public.staff_members where profile_id=p_staff_profile_id and institution_id=inst) then raise exception 'staff member or role is unavailable'; end if;
 if exists(select 1 from unnest(coalesce(p_allowed_permissions,array[]::text[])) x where not exists(select 1 from public.permissions where code=x)) or exists(select 1 from unnest(coalesce(p_denied_permissions,array[]::text[])) x where not exists(select 1 from public.permissions where code=x)) then raise exception 'an access item is unavailable'; end if;
 if p_role_code='super_admin' and (cardinality(coalesce(p_allowed_permissions,array[]::text[]))>0 or cardinality(coalesce(p_denied_permissions,array[]::text[]))>0) then raise exception 'super administrators always have all permissions and cannot have exceptions'; end if;
 update public.staff_role_assignments set revoked_at=now() where staff_profile_id=p_staff_profile_id and institution_id=inst and revoked_at is null;
 insert into public.staff_role_assignments(staff_profile_id,role_id,institution_id,assigned_by) values(p_staff_profile_id,role_id,inst,auth.uid());
 update public.staff_members set approval_limit=p_approval_limit where profile_id=p_staff_profile_id and institution_id=inst;
 delete from public.staff_permission_overrides where staff_profile_id=p_staff_profile_id and institution_id=inst;
 insert into public.staff_permission_overrides(staff_profile_id,institution_id,permission_code,effect,granted_by)
 select p_staff_profile_id,inst,x,'allow',auth.uid() from unnest(coalesce(p_allowed_permissions,array[]::text[])) x where not (x=any(coalesce(p_denied_permissions,array[]::text[])))
 union all select p_staff_profile_id,inst,x,'deny',auth.uid() from unnest(coalesce(p_denied_permissions,array[]::text[])) x;
 insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,auth.uid(),'STAFF_ACCESS_UPDATED','staff_member',p_staff_profile_id,jsonb_build_object('role',p_role_code,'approval_limit',p_approval_limit,'allowed_permissions',p_allowed_permissions,'denied_permissions',p_denied_permissions));
end $$;

revoke all on function public.get_staff_access_management(),public.update_staff_access(uuid,text,numeric,text[],text[]) from public;
grant execute on function public.get_staff_access_management(),public.update_staff_access(uuid,text,numeric,text[],text[]) to authenticated;
notify pgrst,'reload schema';
