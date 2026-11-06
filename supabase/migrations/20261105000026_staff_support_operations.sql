insert into public.permissions(code,description) values
  ('complaint.read','Read customer complaints'),('complaint.manage','Resolve customer complaints'),('account_closure.manage','Approve or reject account closure requests')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,institution_id,permission_code)
select r.id,r.institution_id,p.code from public.roles r cross join (values ('complaint.read'),('complaint.manage'),('account_closure.manage')) as p(code)
where r.code='super_admin' on conflict do nothing;

alter table public.complaints add column if not exists resolution_note text;
alter table public.complaints add column if not exists resolved_at timestamptz;
alter table public.complaints add column if not exists resolved_by uuid references auth.users(id) on delete restrict;

create or replace function public.get_staff_support_workspace()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare inst uuid;
begin
  if not public.has_permission('complaint.read') then raise exception 'permission denied'; end if;
  inst:=public.current_institution_id();
  return jsonb_build_object(
    'complaints',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'complaint_number',c.complaint_number,'status',c.status,'subject',c.subject,'description',c.description,'created_at',c.created_at,'resolution_note',c.resolution_note,'customer_name',p.full_name,'customer_number',cu.customer_number,'email',p.email) order by c.created_at desc) from public.complaints c join public.profiles p on p.id=c.customer_profile_id and p.institution_id=c.institution_id join public.customers cu on cu.profile_id=c.customer_profile_id and cu.institution_id=c.institution_id where c.institution_id=inst),'[]'::jsonb),
    'closure_requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'reason',r.reason,'requested_at',r.requested_at,'customer_name',p.full_name,'customer_number',cu.customer_number) order by r.requested_at desc) from public.account_closure_requests r join public.profiles p on p.id=r.customer_profile_id and p.institution_id=r.institution_id join public.customers cu on cu.profile_id=r.customer_profile_id and cu.institution_id=r.institution_id where r.institution_id=inst),'[]'::jsonb)
  );
end $$;

create or replace function public.resolve_staff_complaint(p_complaint_id uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); cid uuid; actor uuid:=auth.uid();
begin
  if not public.has_permission('complaint.manage') then raise exception 'permission denied'; end if;
  if p_status not in ('investigating','resolved','closed') or length(trim(p_note))<3 then raise exception 'a valid status and resolution note are required'; end if;
  update public.complaints set status=p_status,resolution_note=trim(p_note),resolved_at=case when p_status in ('resolved','closed') then now() else null end,resolved_by=case when p_status in ('resolved','closed') then actor else null end where id=p_complaint_id and institution_id=inst returning customer_profile_id into cid;
  if cid is null then raise exception 'complaint not found'; end if;
  insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) values(inst,cid,'Complaint update','Your complaint has been marked as '||replace(p_status,'_',' ')||'. '||trim(p_note),case when p_status='resolved' then 'success' else 'info' end);
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor,'COMPLAINT_'||upper(p_status),'complaint',p_complaint_id,jsonb_build_object('note',trim(p_note)));
end $$;

create or replace function public.decide_account_closure(p_request_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); cid uuid; actor uuid:=auth.uid(); next_status text;
begin
  if not public.has_permission('account_closure.manage') then raise exception 'permission denied'; end if;
  if length(trim(p_note))<3 then raise exception 'a decision note is required'; end if;
  select customer_profile_id into cid from public.account_closure_requests where id=p_request_id and institution_id=inst and status='requested' for update;
  if cid is null then raise exception 'closure request unavailable'; end if;
  if p_approve and exists(select 1 from public.loan_accounts where institution_id=inst and customer_profile_id=cid and status not in ('settled','closed')) then raise exception 'all loan balances must be settled before approval'; end if;
  next_status:=case when p_approve then 'approved' else 'rejected' end;
  update public.account_closure_requests set status=next_status,resolved_at=now(),resolved_by=actor where id=p_request_id;
  insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) values(inst,cid,'Account closure request update',case when p_approve then 'Your account closure request was approved. Our operations team will complete the closure.' else 'Your account closure request was not approved. '||trim(p_note) end,case when p_approve then 'success' else 'alert' end);
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor,case when p_approve then 'ACCOUNT_CLOSURE_APPROVED' else 'ACCOUNT_CLOSURE_REJECTED' end,'account_closure_request',p_request_id,jsonb_build_object('note',trim(p_note)));
end $$;

revoke all on function public.get_staff_support_workspace() from public; grant execute on function public.get_staff_support_workspace() to authenticated;
revoke all on function public.resolve_staff_complaint(uuid,text,text) from public; grant execute on function public.resolve_staff_complaint(uuid,text,text) to authenticated;
revoke all on function public.decide_account_closure(uuid,boolean,text) from public; grant execute on function public.decide_account_closure(uuid,boolean,text) to authenticated;
