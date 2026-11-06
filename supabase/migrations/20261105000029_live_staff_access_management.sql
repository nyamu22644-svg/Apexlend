insert into public.permissions(code,description) values ('staff.manage','Invite, assign roles to, and suspend staff') on conflict(code) do nothing;
insert into public.role_permissions(role_id,institution_id,permission_code) select id,institution_id,'staff.manage' from public.roles where code='super_admin' on conflict do nothing;

create or replace function public.provision_invited_staff(p_profile_id uuid,p_employee_number text,p_department text,p_job_title text,p_role_code text,p_approval_limit numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); actor uuid:=auth.uid(); role_id uuid;
begin
 if not public.has_permission('staff.manage') then raise exception 'permission denied'; end if;
 if p_approval_limit<0 or length(trim(p_employee_number))<2 then raise exception 'employee number and non-negative approval limit are required'; end if;
 select id into role_id from public.roles where institution_id=inst and code=p_role_code;
 if role_id is null then raise exception 'role is unavailable'; end if;
 if not exists(select 1 from public.profiles where id=p_profile_id and institution_id=inst and user_type='customer') then raise exception 'invited identity is unavailable'; end if;
 delete from public.customers where profile_id=p_profile_id and institution_id=inst;
 update public.profiles set user_type='staff',status='active',updated_at=now() where id=p_profile_id and institution_id=inst;
 insert into public.staff_members(profile_id,institution_id,employee_number,department,job_title,approval_limit,is_active) values(p_profile_id,inst,trim(p_employee_number),nullif(trim(p_department),''),nullif(trim(p_job_title),''),p_approval_limit,true);
 insert into public.staff_role_assignments(staff_profile_id,role_id,institution_id,assigned_by) values(p_profile_id,role_id,inst,actor);
 insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor,'STAFF_INVITED','staff_member',p_profile_id,jsonb_build_object('role',p_role_code,'approval_limit',p_approval_limit));
end $$;
create or replace function public.get_staff_directory()
returns table(profile_id uuid,full_name text,email text,phone_number text,employee_number text,department text,job_title text,approval_limit numeric,is_active boolean,role_code text,role_name text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.full_name,p.email,p.phone_number,s.employee_number,s.department,s.job_title,s.approval_limit,s.is_active,r.code,r.name,s.created_at from public.staff_members s join public.profiles p on p.id=s.profile_id and p.institution_id=s.institution_id left join public.staff_role_assignments a on a.staff_profile_id=s.profile_id and a.institution_id=s.institution_id and a.revoked_at is null left join public.roles r on r.id=a.role_id and r.institution_id=a.institution_id where s.institution_id=public.current_institution_id() and public.has_permission('staff.manage') order by s.created_at;
$$;
create or replace function public.set_staff_active(p_profile_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id();
begin if not public.has_permission('staff.manage') or p_profile_id=auth.uid() then raise exception 'permission denied'; end if; update public.staff_members set is_active=p_active where profile_id=p_profile_id and institution_id=inst; update public.profiles set status=case when p_active then 'active' else 'suspended' end where id=p_profile_id and institution_id=inst; if not found then raise exception 'staff member unavailable'; end if; end $$;
revoke all on function public.provision_invited_staff(uuid,text,text,text,text,numeric) from public; grant execute on function public.provision_invited_staff(uuid,text,text,text,text,numeric) to authenticated;
revoke all on function public.get_staff_directory() from public; grant execute on function public.get_staff_directory() to authenticated;
revoke all on function public.set_staff_active(uuid,boolean) from public; grant execute on function public.set_staff_active(uuid,boolean) to authenticated;
