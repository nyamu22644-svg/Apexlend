create table public.staff_notifications (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete restrict,
 staff_profile_id uuid not null references public.staff_members(profile_id) on delete restrict,
 title text not null, message text not null, notification_type text not null default 'info' check(notification_type in ('info','action','urgent','success')),
 action_path text, action_label text, related_entity_id uuid, event_key text not null, read_at timestamptz, email_required boolean not null default false, created_at timestamptz not null default now(),
 unique(staff_profile_id,event_key)
);
alter table public.staff_notifications enable row level security;
create policy staff_reads_own_notifications on public.staff_notifications for select to authenticated using(staff_profile_id=auth.uid() and institution_id=public.current_institution_id());

create or replace function public.create_staff_notifications(p_institution_id uuid,p_permission text,p_title text,p_message text,p_type text,p_event_key text,p_related_id uuid default null,p_exclude uuid default null,p_email_required boolean default false)
returns void language sql security definer set search_path=public,pg_temp as $$
 insert into public.staff_notifications(institution_id,staff_profile_id,title,message,notification_type,event_key,related_entity_id,email_required)
 select p_institution_id,s.profile_id,p_title,p_message,p_type,p_event_key||':'||s.profile_id,p_related_id,p_email_required
 from public.staff_members s
 where s.institution_id=p_institution_id and s.is_active and s.profile_id is distinct from p_exclude
 and not exists(select 1 from public.staff_permission_overrides o where o.staff_profile_id=s.profile_id and o.institution_id=p_institution_id and o.permission_code=p_permission and o.effect='deny')
 and (exists(select 1 from public.staff_permission_overrides o where o.staff_profile_id=s.profile_id and o.institution_id=p_institution_id and o.permission_code=p_permission and o.effect='allow') or exists(select 1 from public.staff_role_assignments a join public.role_permissions rp on rp.role_id=a.role_id and rp.institution_id=a.institution_id where a.staff_profile_id=s.profile_id and a.institution_id=p_institution_id and a.revoked_at is null and rp.permission_code=p_permission))
 on conflict(staff_profile_id,event_key) do nothing;
$$;

create or replace function public.notify_staff_from_audit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare assigned uuid;
begin
 case new.action
 when 'KYC_SUBMITTED_FOR_REVIEW' then perform public.create_staff_notifications(new.institution_id,'kyc.decide','KYC review needed','A customer has submitted identity documents for review.','action','kyc:'||new.target_id,new.target_id,new.actor_profile_id,false);
 when 'LOAN_APPLICATION_SUBMITTED' then perform public.create_staff_notifications(new.institution_id,'application.assess','New loan application','A customer loan application is ready for assessment.','action','application-assess:'||new.target_id,new.target_id,null,false);
 when 'LOAN_APPLICATION_RECOMMENDED' then perform public.create_staff_notifications(new.institution_id,'application.approve','Loan decision needs approval','A credit recommendation is waiting for an independent approval.','action','application-approve:'||new.target_id,new.target_id,new.actor_profile_id,false);
 when 'LOAN_CONTRACT_ACCEPTED' then perform public.create_staff_notifications(new.institution_id,'disbursement.create','Loan ready for payment','The customer accepted the loan contract. Prepare the disbursement.','action','disbursement-ready:'||new.target_id,new.target_id,null,false);
 when 'CUSTOMER_COMPLAINT_SUBMITTED' then perform public.create_staff_notifications(new.institution_id,'complaint.manage','New customer complaint','A customer complaint needs attention.','action','complaint:'||new.target_id,new.target_id,null,false);
 when 'ACCOUNT_CLOSURE_REQUESTED' then perform public.create_staff_notifications(new.institution_id,'account_closure.manage','Account closure request','A customer has requested account closure.','action','closure:'||new.target_id,new.target_id,null,false);
 when 'COLLECTION_CASE_ASSIGNED' then assigned:=nullif(new.after_state->>'assigned_staff_profile_id','')::uuid; if assigned is not null then insert into public.staff_notifications(institution_id,staff_profile_id,title,message,notification_type,event_key,related_entity_id) values(new.institution_id,assigned,'Collection case assigned','A collection case has been assigned to you.','action','collection-assigned:'||new.target_id||':'||assigned,new.target_id) on conflict(staff_profile_id,event_key) do nothing; end if;
 when 'STAFF_ACCESS_UPDATED' then insert into public.staff_notifications(institution_id,staff_profile_id,title,message,notification_type,event_key,related_entity_id,email_required) values(new.institution_id,new.target_id,'Your staff access changed','Your role, approval limit or individual access was updated by a Super Administrator.','urgent','access:'||new.id,new.target_id,true) on conflict(staff_profile_id,event_key) do nothing;
 when 'PAYMENT_RECEIVED' then perform public.create_staff_notifications(new.institution_id,'staff.manage','Payment received','A verified customer payment was received.','urgent','payment-received:'||new.target_id,new.target_id,null,true);
 when 'LOAN_DISBURSED' then perform public.create_staff_notifications(new.institution_id,'staff.manage','Loan disbursed','A loan was successfully disbursed to the customer.','urgent','loan-disbursed:'||new.target_id,new.target_id,null,true);
 else null;
 end case; return new;
end $$;
drop trigger if exists staff_notifications_from_audit on public.audit_events;
create trigger staff_notifications_from_audit after insert on public.audit_events for each row execute function public.notify_staff_from_audit();

create or replace function public.notify_staff_disbursement_status()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare maker uuid;
begin
 select maker_profile_id into maker from public.approval_requests where id=new.approval_request_id;
 if tg_op='INSERT' and new.status='pending_approval' then perform public.create_staff_notifications(new.institution_id,'disbursement.approve','Disbursement needs approval','A prepared disbursement needs an independent approval.','action','disbursement-approve:'||new.id,new.id,maker,false); end if;
 if tg_op='UPDATE' and new.status='failed' and old.status is distinct from new.status then perform public.create_staff_notifications(new.institution_id,'disbursement.create','Disbursement failed','A payout failed and needs investigation or retry.','urgent','disbursement-failed:'||new.id,new.id,null,true); end if;
 return new;
end $$;
drop trigger if exists staff_notifications_disbursement_status on public.disbursement_requests;
create trigger staff_notifications_disbursement_status after insert or update of status on public.disbursement_requests for each row execute function public.notify_staff_disbursement_status();

create or replace function public.get_my_staff_notifications()
returns table(id uuid,title text,message text,notification_type text,action_path text,action_label text,related_entity_id uuid,read_at timestamptz,created_at timestamptz,email_required boolean)
language sql stable security definer set search_path=public,pg_temp as $$ select id,title,message,notification_type,action_path,action_label,related_entity_id,read_at,created_at,email_required from public.staff_notifications where staff_profile_id=auth.uid() and institution_id=public.current_institution_id() order by created_at desc limit 50 $$;
create or replace function public.mark_my_staff_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin update public.staff_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and staff_profile_id=auth.uid() and institution_id=public.current_institution_id(); if not found then raise exception 'notification not found'; end if; end $$;
revoke all on function public.get_my_staff_notifications(),public.mark_my_staff_notification_read(uuid),public.create_staff_notifications(uuid,text,text,text,text,text,uuid,uuid,boolean) from public;
grant execute on function public.get_my_staff_notifications(),public.mark_my_staff_notification_read(uuid) to authenticated;
notify pgrst,'reload schema';
