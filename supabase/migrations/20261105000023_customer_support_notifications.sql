-- Customer support, notifications, and controlled account closure requests.
create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, customer_profile_id uuid not null,
  title text not null, message text not null, notification_type text not null default 'info' check (notification_type in ('info','success','alert','payment')),
  read_at timestamptz, created_at timestamptz not null default now(),
  foreign key (customer_profile_id,institution_id) references public.customers(profile_id,institution_id) on delete restrict
);
create table if not exists public.account_closure_requests (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, customer_profile_id uuid not null,
  reason text not null, status text not null default 'requested' check(status in ('requested','approved','rejected','completed','cancelled')),
  requested_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid,
  foreign key (customer_profile_id,institution_id) references public.customers(profile_id,institution_id) on delete restrict
);
create unique index if not exists one_open_closure_request_per_customer on public.account_closure_requests(customer_profile_id) where status in ('requested','approved');

create or replace function public.submit_my_complaint(p_subject text,p_description text)
returns table (complaint_id uuid, complaint_number text) language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid; cid uuid; num text;
begin
  select institution_id into inst from public.customers where profile_id=auth.uid(); if inst is null then raise exception 'customer account required'; end if;
  if length(trim(p_subject))<3 or length(trim(p_description))<10 then raise exception 'provide a subject and detailed complaint'; end if;
  num:='CMP-'||to_char(now() at time zone 'UTC','YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.complaints(institution_id,customer_profile_id,complaint_number,subject,description) values(inst,auth.uid(),num,trim(p_subject),trim(p_description)) returning id into cid;
  insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) values(inst,auth.uid(),'Complaint received','Your complaint '||num||' has been recorded for staff review.','info');
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id) values(inst,auth.uid(),'CUSTOMER_COMPLAINT_SUBMITTED','complaint',cid);
  return query select cid,num;
end $$;
create or replace function public.request_my_account_closure(p_reason text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid; rid uuid;
begin
  select institution_id into inst from public.customers where profile_id=auth.uid(); if inst is null then raise exception 'customer account required'; end if;
  if exists(select 1 from public.loan_accounts where customer_profile_id=auth.uid() and institution_id=inst and status not in ('settled','closed')) then raise exception 'account closure requires all loan balances to be settled'; end if;
  if length(trim(p_reason))<3 then raise exception 'closure reason is required'; end if;
  insert into public.account_closure_requests(institution_id,customer_profile_id,reason) values(inst,auth.uid(),trim(p_reason)) returning id into rid;
  insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) values(inst,auth.uid(),'Closure request received','Your account closure request is awaiting staff review.','alert');
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id) values(inst,auth.uid(),'ACCOUNT_CLOSURE_REQUESTED','account_closure_request',rid); return rid;
end $$;
create or replace function public.get_my_notifications()
returns table(id uuid,title text,message text,notification_type text,read_at timestamptz,created_at timestamptz) language sql stable security definer set search_path=public,pg_temp as $$
 select id,title,message,notification_type,read_at,created_at from public.customer_notifications where customer_profile_id=auth.uid() and institution_id=public.current_institution_id() order by created_at desc limit 50;
$$;
revoke all on function public.submit_my_complaint(text,text) from public; revoke all on function public.request_my_account_closure(text) from public; revoke all on function public.get_my_notifications() from public;
grant execute on function public.submit_my_complaint(text,text) to authenticated; grant execute on function public.request_my_account_closure(text) to authenticated; grant execute on function public.get_my_notifications() to authenticated;
