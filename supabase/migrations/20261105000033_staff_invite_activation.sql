-- An Auth invite is an identity first.  Do not depend on the customer-signup
-- trigger having made a profile before assigning the invited employee access.
create or replace function public.provision_invited_staff(p_profile_id uuid,p_employee_number text,p_department text,p_job_title text,p_role_code text,p_approval_limit numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  inst uuid:=public.current_institution_id();
  actor uuid:=auth.uid();
  role_id uuid;
  invited_email text;
  invited_name text;
  invited_phone text;
  existing_type text;
begin
  if not public.has_permission('staff.manage') then raise exception 'permission denied'; end if;
  if p_approval_limit < 0 or length(trim(p_employee_number)) < 2 then
    raise exception 'employee number and non-negative approval limit are required';
  end if;
  select id into role_id from public.roles where institution_id=inst and code=p_role_code;
  if role_id is null then raise exception 'role is unavailable'; end if;

  select email,
         coalesce(nullif(raw_user_meta_data ->> 'full_name',''), split_part(coalesce(email,''),'@',1), 'Staff member'),
         nullif(raw_user_meta_data ->> 'phone','')
    into invited_email, invited_name, invited_phone
  from auth.users where id=p_profile_id;
  if invited_email is null then raise exception 'invited identity is unavailable'; end if;

  select user_type into existing_type from public.profiles where id=p_profile_id and institution_id=inst;
  if existing_type is null then
    insert into public.profiles(id,institution_id,user_type,email,full_name,phone_number,status)
    values(p_profile_id,inst,'staff',invited_email,invited_name,invited_phone,'active');
  elsif existing_type='customer' then
    delete from public.customers where profile_id=p_profile_id and institution_id=inst;
    update public.profiles
      set user_type='staff', email=invited_email, full_name=invited_name,
          phone_number=coalesce(invited_phone,phone_number), status='active', updated_at=now()
      where id=p_profile_id and institution_id=inst;
  else
    update public.profiles set status='active', updated_at=now()
      where id=p_profile_id and institution_id=inst;
  end if;

  insert into public.staff_members(profile_id,institution_id,employee_number,department,job_title,approval_limit,is_active)
  values(p_profile_id,inst,trim(p_employee_number),nullif(trim(p_department),''),nullif(trim(p_job_title),''),p_approval_limit,true)
  on conflict(profile_id) do update set employee_number=excluded.employee_number, department=excluded.department,
    job_title=excluded.job_title, approval_limit=excluded.approval_limit, is_active=true;

  update public.staff_role_assignments set revoked_at=now()
    where staff_profile_id=p_profile_id and institution_id=inst and revoked_at is null;
  insert into public.staff_role_assignments(staff_profile_id,role_id,institution_id,assigned_by)
  values(p_profile_id,role_id,inst,actor)
  on conflict(staff_profile_id,role_id) do update set revoked_at=null, assigned_by=excluded.assigned_by, assigned_at=now();

  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state)
  values(inst,actor,'STAFF_INVITED','staff_member',p_profile_id,jsonb_build_object('role',p_role_code,'approval_limit',p_approval_limit));
end $$;
