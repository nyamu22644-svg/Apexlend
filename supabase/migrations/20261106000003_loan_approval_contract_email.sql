alter table public.customer_notifications add column if not exists action_path text;
alter table public.customer_notifications add column if not exists action_label text;
alter table public.customer_notifications add column if not exists related_entity_id uuid;
create unique index if not exists one_loan_approval_notification on public.customer_notifications(customer_profile_id,related_entity_id) where title='Loan approved — action required';

create or replace function public.queue_loan_approval_notification()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='pending_disbursement' then
    insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type,action_path,action_label,related_entity_id)
    values(new.institution_id,new.customer_profile_id,'Loan approved — action required','Your loan has been approved. Review and accept your loan terms in the customer portal before disbursement can proceed.','success','/?customerView=loans','Review and accept terms',new.application_id)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists loan_approval_notification on public.loan_accounts;
create trigger loan_approval_notification after insert on public.loan_accounts for each row execute function public.queue_loan_approval_notification();

create or replace function public.get_loan_approval_notification(p_approval_request_id uuid)
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
  select n.id from public.approval_requests r join public.customer_notifications n on n.related_entity_id=r.subject_id and n.institution_id=r.institution_id
  where r.id=p_approval_request_id and r.subject_type='application' and r.institution_id=public.current_institution_id() and public.has_permission('application.approve')
  order by n.created_at desc limit 1;
$$;
grant execute on function public.get_loan_approval_notification(uuid) to authenticated;
notify pgrst, 'reload schema';
