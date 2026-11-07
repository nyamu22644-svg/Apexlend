-- Older B2C submissions remain in `routing` until their callback is handled.
-- They are legitimate candidates for the exceptional super-admin reconciliation
-- path, provided the parent request is still submitted.
create or replace function public.reconcile_confirmed_finoq_disbursement(
  p_disbursement_id uuid,
  p_finoq_reference text,
  p_reason text
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor_id uuid := auth.uid();
  inst uuid;
  payment record;
  original_reference text;
begin
  select s.institution_id into inst
  from public.staff_members s
  join public.staff_role_assignments a on a.staff_profile_id=s.profile_id and a.institution_id=s.institution_id and a.revoked_at is null
  join public.roles r on r.id=a.role_id and r.institution_id=a.institution_id
  where s.profile_id=actor_id and s.is_active and r.code='super_admin';

  if inst is null then raise exception 'only an active super administrator may reconcile a disbursement'; end if;
  if length(trim(coalesce(p_finoq_reference,''))) < 6 then raise exception 'a valid Finoq reference is required'; end if;
  if length(trim(coalesce(p_reason,''))) < 20 then raise exception 'enter a reconciliation note of at least 20 characters'; end if;

  select pr.* into payment
  from public.disbursement_requests d
  join public.disbursement_attempts da on da.disbursement_request_id=d.id and da.institution_id=d.institution_id
  join public.payment_requests pr on pr.id=da.payment_request_id and pr.institution_id=da.institution_id
  where d.id=p_disbursement_id
    and d.institution_id=inst
    and d.status='submitted'
    and pr.status in ('routing','submitted','accepted')
  order by da.sequence_number desc
  limit 1
  for update of pr;

  if payment.id is null then raise exception 'submitted disbursement is unavailable for reconciliation'; end if;
  original_reference := coalesce(payment.external_reference, payment.provider_reference);

  update public.payment_requests
  set external_reference=original_reference,
      provider_reference=trim(p_finoq_reference),
      updated_at=now()
  where id=payment.id;

  perform public.process_finoq_disbursement(
    original_reference,
    trim(p_finoq_reference),
    true,
    payment.amount,
    jsonb_build_object(
      'source','super_admin_manual_reconciliation',
      'finoq_reference',trim(p_finoq_reference),
      'reason',trim(p_reason),
      'reconciled_by',actor_id,
      'reconciled_at',now()
    )
  );

  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state)
  values (inst,actor_id,'FINOQ_DISBURSEMENT_MANUALLY_RECONCILED','disbursement_request',p_disbursement_id,
    jsonb_build_object('payment_request_id',payment.id,'external_reference',original_reference,'finoq_reference',trim(p_finoq_reference),'reason',trim(p_reason),'amount',payment.amount));
end $$;

-- Record the loan on the customer notification. This lets both callback and
-- manual-reconciliation delivery target the exact notification they created.
create or replace function public.process_finoq_disbursement(p_external_reference text,p_provider_reference text,p_success boolean,p_amount numeric,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pr record; did uuid; account text; first_due date; installment numeric; total numeric;
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
    select l.account_number,min(i.due_date),coalesce((array_agg(i.principal_due+i.interest_due+i.fee_due+i.penalty_due order by i.installment_number))[1],0),coalesce(sum(i.principal_due+i.interest_due+i.fee_due+i.penalty_due),0)
      into account,first_due,installment,total
    from public.loan_accounts l
    left join public.repayment_installments i on i.loan_account_id=l.id and i.institution_id=l.institution_id
    where l.id=pr.loan_account_id
    group by l.account_number;
    insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type,related_entity_id)
    select pr.institution_id,l.customer_profile_id,'Loan disbursed',
      'Your loan has been disbursed successfully.'||chr(10)||chr(10)||'Loan account: '||account||chr(10)||'Amount disbursed: KES '||to_char(pr.amount,'FM999,999,999,990.00')||chr(10)||'Sent to M-Pesa: '||pr.destination_reference||chr(10)||'First repayment due: '||coalesce(to_char(first_due,'DD Mon YYYY'),'See your repayment schedule')||chr(10)||'First instalment: KES '||to_char(installment,'FM999,999,999,990.00')||chr(10)||'Total repayable: KES '||to_char(total,'FM999,999,999,990.00')||chr(10)||chr(10)||'Please keep sufficient funds in your M-Pesa line before each due date.',
      'success',pr.loan_account_id
    from public.loan_accounts l where l.id=pr.loan_account_id;
  end if;
end $$;

notify pgrst, 'reload schema';
