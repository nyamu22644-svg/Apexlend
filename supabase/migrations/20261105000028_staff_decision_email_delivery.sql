-- Lock down internal notification tables and return the new notification ID
-- from staff decisions so the authorised email worker can deliver it.
alter table public.customer_notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.account_closure_requests enable row level security;
create policy customer_reads_own_notifications on public.customer_notifications for select to authenticated using(customer_profile_id=auth.uid() and institution_id=public.current_institution_id());
create policy customer_reads_own_closure_requests on public.account_closure_requests for select to authenticated using(customer_profile_id=auth.uid() and institution_id=public.current_institution_id());

create or replace function public.resolve_staff_complaint_and_notify(p_complaint_id uuid,p_status text,p_note text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); cid uuid; actor uuid:=auth.uid(); notification_id uuid;
begin
  if not public.has_permission('complaint.manage') then raise exception 'permission denied'; end if;
  if p_status not in ('investigating','resolved','closed') or length(trim(p_note))<3 then raise exception 'a valid status and resolution note are required'; end if;
  update public.complaints set status=p_status,resolution_note=trim(p_note),resolved_at=case when p_status in ('resolved','closed') then now() else null end,resolved_by=case when p_status in ('resolved','closed') then actor else null end where id=p_complaint_id and institution_id=inst returning customer_profile_id into cid;
  if cid is null then raise exception 'complaint not found'; end if;
  insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) values(inst,cid,'Complaint update','Your complaint has been marked as '||replace(p_status,'_',' ')||'. '||trim(p_note),case when p_status='resolved' then 'success' else 'info' end) returning id into notification_id;
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor,'COMPLAINT_'||upper(p_status),'complaint',p_complaint_id,jsonb_build_object('note',trim(p_note)));
  return notification_id;
end $$;

create or replace function public.decide_account_closure_and_notify(p_request_id uuid,p_approve boolean,p_note text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); cid uuid; actor uuid:=auth.uid(); next_status text; notification_id uuid;
begin
  if not public.has_permission('account_closure.manage') then raise exception 'permission denied'; end if;
  if length(trim(p_note))<3 then raise exception 'a decision note is required'; end if;
  select customer_profile_id into cid from public.account_closure_requests where id=p_request_id and institution_id=inst and status='requested' for update;
  if cid is null then raise exception 'closure request unavailable'; end if;
  if p_approve and exists(select 1 from public.loan_accounts where institution_id=inst and customer_profile_id=cid and status not in ('settled','closed')) then raise exception 'all loan balances must be settled before approval'; end if;
  next_status:=case when p_approve then 'approved' else 'rejected' end;
  update public.account_closure_requests set status=next_status,resolved_at=now(),resolved_by=actor where id=p_request_id;
  insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) values(inst,cid,'Account closure request update',case when p_approve then 'Your account closure request was approved. Our operations team will complete the closure.' else 'Your account closure request was not approved. '||trim(p_note) end,case when p_approve then 'success' else 'alert' end) returning id into notification_id;
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor,case when p_approve then 'ACCOUNT_CLOSURE_APPROVED' else 'ACCOUNT_CLOSURE_REJECTED' end,'account_closure_request',p_request_id,jsonb_build_object('note',trim(p_note)));
  return notification_id;
end $$;
revoke all on function public.resolve_staff_complaint_and_notify(uuid,text,text) from public; grant execute on function public.resolve_staff_complaint_and_notify(uuid,text,text) to authenticated;
revoke all on function public.decide_account_closure_and_notify(uuid,boolean,text) from public; grant execute on function public.decide_account_closure_and_notify(uuid,boolean,text) to authenticated;
