-- Allow the borrower to select the M-Pesa line for a payment.  The chosen
-- number is normalised, validated and saved as the repayment line before STK.
create or replace function public.create_my_stk_request(p_loan_account_id uuid,p_amount numeric,p_idempotency_key uuid,p_phone_number text)
returns table(payment_request_id uuid,external_reference text,phone_number text,customer_name text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid; balance numeric; phone text; name text; pid uuid; reference text; digits text;
begin
  digits:=regexp_replace(coalesce(p_phone_number,''),'[^0-9]','','g');
  phone:=case when digits ~ '^0[17][0-9]{8}$' then '254'||substr(digits,2) when digits ~ '^254[17][0-9]{8}$' then digits when digits ~ '^[17][0-9]{8}$' then '254'||digits else null end;
  if phone is null then raise exception 'enter a valid Kenyan M-Pesa number'; end if;
  select l.institution_id,l.principal_outstanding+l.interest_outstanding+l.fee_outstanding+l.penalty_outstanding,p.full_name
    into inst,balance,name from public.loan_accounts l join public.profiles p on p.id=l.customer_profile_id and p.institution_id=l.institution_id
    where l.id=p_loan_account_id and l.customer_profile_id=auth.uid() and l.status='active' for update;
  if inst is null then raise exception 'active loan account unavailable'; end if;
  if p_amount<=0 or p_amount>balance then raise exception 'payment amount must not exceed the outstanding balance'; end if;
  select id,provider_reference into pid,reference from public.payment_requests where institution_id=inst and idempotency_key=p_idempotency_key;
  if pid is not null then return query select pid,reference,phone,name; return; end if;
  update public.customers set mpesa_phone_number=phone,updated_at=now() where profile_id=auth.uid() and institution_id=inst;
  update public.profiles set phone_number=phone,updated_at=now() where id=auth.uid() and institution_id=inst;
  reference:='STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  insert into public.payment_requests(institution_id,customer_profile_id,loan_account_id,request_type,amount,destination_reference,idempotency_key,status,provider_reference)
    values(inst,auth.uid(),p_loan_account_id,'stk_push',p_amount,phone,p_idempotency_key,'routing',reference) returning id into pid;
  return query select pid,reference,phone,name;
end $$;

-- Callback processing is idempotent. Apply every component due in order:
-- penalty, fee, interest, then principal; close the loan only when all ledger
-- balances are zero.
create or replace function public.process_payhero_repayment(p_external_reference text,p_provider_reference text,p_amount numeric,p_success boolean,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pr record; txid uuid; remaining numeric; instrow record; allocation numeric; total_outstanding numeric;
begin
  select * into pr from public.payment_requests where provider_reference=p_external_reference or provider_reference=p_provider_reference for update;
  if pr.id is null then raise exception 'payment reference not found'; end if;
  if not p_success then update public.payment_requests set status='failed',updated_at=now() where id=pr.id; return; end if;
  if p_amount<>pr.amount then raise exception 'callback amount does not match payment request'; end if;
  update public.payment_requests set status='completed',updated_at=now() where id=pr.id;
  insert into public.repayment_transactions(institution_id,loan_account_id,customer_profile_id,amount,transaction_reference,status)
    values(pr.institution_id,pr.loan_account_id,pr.customer_profile_id,p_amount,p_provider_reference,'received')
    on conflict(institution_id,transaction_reference) do nothing returning id into txid;
  if txid is null then return; end if;
  remaining:=p_amount;
  for instrow in select * from public.repayment_installments where loan_account_id=pr.loan_account_id and institution_id=pr.institution_id and status not in ('paid','waived') order by installment_number for update loop
    allocation:=least(remaining,instrow.penalty_due-instrow.penalty_paid); if allocation>0 then insert into public.payment_allocations(institution_id,repayment_transaction_id,installment_id,component,amount) values(pr.institution_id,txid,instrow.id,'penalty',allocation); update public.repayment_installments set penalty_paid=penalty_paid+allocation where id=instrow.id; remaining:=remaining-allocation; end if;
    allocation:=least(remaining,instrow.fee_due-instrow.fee_paid); if allocation>0 then insert into public.payment_allocations(institution_id,repayment_transaction_id,installment_id,component,amount) values(pr.institution_id,txid,instrow.id,'fee',allocation); update public.repayment_installments set fee_paid=fee_paid+allocation where id=instrow.id; remaining:=remaining-allocation; end if;
    allocation:=least(remaining,instrow.interest_due-instrow.interest_paid); if allocation>0 then insert into public.payment_allocations(institution_id,repayment_transaction_id,installment_id,component,amount) values(pr.institution_id,txid,instrow.id,'interest',allocation); update public.repayment_installments set interest_paid=interest_paid+allocation where id=instrow.id; remaining:=remaining-allocation; end if;
    allocation:=least(remaining,instrow.principal_due-instrow.principal_paid); if allocation>0 then insert into public.payment_allocations(institution_id,repayment_transaction_id,installment_id,component,amount) values(pr.institution_id,txid,instrow.id,'principal',allocation); update public.repayment_installments set principal_paid=principal_paid+allocation where id=instrow.id; remaining:=remaining-allocation; end if;
    update public.repayment_installments set status=case when principal_paid>=principal_due and interest_paid>=interest_due and fee_paid>=fee_due and penalty_paid>=penalty_due then 'paid' when principal_paid+interest_paid+fee_paid+penalty_paid>0 then 'partial' else status end where id=instrow.id;
    exit when remaining=0;
  end loop;
  update public.loan_accounts set principal_outstanding=greatest(0,principal_outstanding-(select coalesce(sum(amount),0) from public.payment_allocations where repayment_transaction_id=txid and component='principal')),interest_outstanding=greatest(0,interest_outstanding-(select coalesce(sum(amount),0) from public.payment_allocations where repayment_transaction_id=txid and component='interest')),fee_outstanding=greatest(0,fee_outstanding-(select coalesce(sum(amount),0) from public.payment_allocations where repayment_transaction_id=txid and component='fee')),penalty_outstanding=greatest(0,penalty_outstanding-(select coalesce(sum(amount),0) from public.payment_allocations where repayment_transaction_id=txid and component='penalty')) where id=pr.loan_account_id;
  if remaining>0 then insert into public.unapplied_cash(institution_id,repayment_transaction_id,customer_profile_id,amount) values(pr.institution_id,txid,pr.customer_profile_id,remaining); update public.repayment_transactions set status='unapplied' where id=txid; else update public.repayment_transactions set status='allocated' where id=txid; end if;
  select principal_outstanding+interest_outstanding+fee_outstanding+penalty_outstanding into total_outstanding from public.loan_accounts where id=pr.loan_account_id for update;
  if total_outstanding=0 then update public.loan_accounts set status='settled' where id=pr.loan_account_id; end if;
  insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) values(pr.institution_id,pr.customer_profile_id,case when total_outstanding=0 then 'Loan settled' else 'Payment received' end,case when total_outstanding=0 then 'Your M-Pesa payment of KES '||p_amount||' has settled this loan.' else 'Your M-Pesa payment of KES '||p_amount||' has been verified and allocated.' end,'payment');
end $$;

create or replace function public.get_my_payments_workspace()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'mpesa_phone_number',(select c.mpesa_phone_number from public.customers c where c.profile_id=auth.uid() and c.institution_id=public.current_institution_id()),
  'loans',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'loan_number',l.account_number,'status',l.status,'outstanding',l.principal_outstanding+l.interest_outstanding+l.fee_outstanding+l.penalty_outstanding) order by l.created_at desc) from public.loan_accounts l where l.customer_profile_id=auth.uid() and l.institution_id=public.current_institution_id()),'[]'::jsonb),
  'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'type','repayment','amount',r.amount,'reference',r.transaction_reference,'status',r.status,'received_at',r.received_at,'loan_number',l.account_number) order by r.received_at desc) from public.repayment_transactions r left join public.loan_accounts l on l.id=r.loan_account_id and l.institution_id=r.institution_id where r.customer_profile_id=auth.uid() and r.institution_id=public.current_institution_id()),'[]'::jsonb));
$$;
revoke all on function public.create_my_stk_request(uuid,numeric,uuid,text) from public;
grant execute on function public.create_my_stk_request(uuid,numeric,uuid,text) to authenticated;
