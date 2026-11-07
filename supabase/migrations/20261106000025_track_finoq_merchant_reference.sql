-- Keep our immutable request reference separately from Finoq's merchant
-- reference. Callback matching accepts either value so callbacks arriving
-- during deployment and older submitted records remain processable.
create or replace function public.process_finoq_disbursement(p_external_reference text,p_provider_reference text,p_success boolean,p_amount numeric,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pr record; did uuid;
begin
  select * into pr
  from public.payment_requests
  where request_type='b2c_disbursement'
    and (external_reference=p_external_reference or provider_reference=p_external_reference or provider_reference=p_provider_reference)
  for update;
  if pr.id is null or pr.amount<>p_amount then raise exception 'disbursement callback unavailable'; end if;
  if pr.status='completed' then return; end if;
  select disbursement_request_id into did from public.disbursement_attempts where payment_request_id=pr.id;
  update public.payment_requests set status=case when p_success then 'completed' else 'failed' end,updated_at=now() where id=pr.id;
  update public.disbursement_attempts set status=case when p_success then 'completed' else 'failed' end,provider_response=p_payload where payment_request_id=pr.id;
  update public.disbursement_requests set status=case when p_success then 'completed' else 'failed' end where id=did;
  if p_success then
    update public.loan_accounts set status='active' where id=pr.loan_account_id and status='pending_disbursement';
    insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type)
    select pr.institution_id,l.customer_profile_id,'Loan disbursed','Your loan of KES '||pr.amount||' has been disbursed to your M-Pesa line.','success'
    from public.loan_accounts l where l.id=pr.loan_account_id;
  end if;
end $$;

notify pgrst, 'reload schema';
