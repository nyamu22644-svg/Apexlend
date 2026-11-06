-- Customer STK requests, callback-safe allocation, and immutable repayment processing.
create or replace function public.create_my_stk_request(p_loan_account_id uuid,p_amount numeric,p_idempotency_key uuid)
returns table(payment_request_id uuid,external_reference text,phone_number text,customer_name text) language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid; balance numeric; phone text; name text; pid uuid; reference text;
begin
 select l.institution_id,l.principal_outstanding+l.interest_outstanding+l.fee_outstanding+l.penalty_outstanding,coalesce(c.mpesa_phone_number,p.phone_number),p.full_name into inst,balance,phone,name from public.loan_accounts l join public.customers c on c.profile_id=l.customer_profile_id and c.institution_id=l.institution_id join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id where l.id=p_loan_account_id and l.customer_profile_id=auth.uid() and l.status='active' for update;
 if inst is null then raise exception 'active loan account unavailable'; end if; if p_amount<=0 or p_amount>balance then raise exception 'payment amount must not exceed the outstanding balance'; end if; if phone is null or length(phone)<9 then raise exception 'a verified M-Pesa number is required'; end if;
 select id,provider_reference into pid,reference from public.payment_requests where institution_id=inst and idempotency_key=p_idempotency_key; if pid is not null then return query select pid,reference,phone,name; return; end if;
 reference:='STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)); insert into public.payment_requests(institution_id,customer_profile_id,loan_account_id,request_type,amount,destination_reference,idempotency_key,status,provider_reference) values(inst,auth.uid(),p_loan_account_id,'stk_push',p_amount,phone,p_idempotency_key,'routing',reference) returning id into pid;
 return query select pid,reference,phone,name;
end $$;
create or replace function public.record_payhero_stk_submission(p_payment_request_id uuid,p_provider_reference text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin update public.payment_requests set status='submitted',updated_at=now() where id=p_payment_request_id and status='routing'; end $$;
create or replace function public.process_payhero_repayment(p_external_reference text,p_provider_reference text,p_amount numeric,p_success boolean,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pr record; txid uuid; remaining numeric; instrow record; allocation numeric;
begin
 select * into pr from public.payment_requests where provider_reference=p_external_reference or provider_reference=p_provider_reference for update; if pr.id is null then raise exception 'payment reference not found'; end if;
 if not p_success then update public.payment_requests set status='failed',updated_at=now() where id=pr.id; return; end if;
 if p_amount<>pr.amount then raise exception 'callback amount does not match payment request'; end if;
 update public.payment_requests set status='completed',updated_at=now() where id=pr.id;
 insert into public.repayment_transactions(institution_id,loan_account_id,customer_profile_id,amount,transaction_reference,status) values(pr.institution_id,pr.loan_account_id,pr.customer_profile_id,p_amount,p_provider_reference,'received') on conflict(institution_id,transaction_reference) do nothing returning id into txid; if txid is null then return; end if;
 remaining:=p_amount;
 for instrow in select * from public.repayment_installments where loan_account_id=pr.loan_account_id and institution_id=pr.institution_id and status not in ('paid','waived') order by installment_number for update loop
  allocation:=least(remaining,instrow.fee_due-instrow.fee_paid); if allocation>0 then insert into public.payment_allocations(institution_id,repayment_transaction_id,installment_id,component,amount) values(pr.institution_id,txid,instrow.id,'fee',allocation); update public.repayment_installments set fee_paid=fee_paid+allocation where id=instrow.id; remaining:=remaining-allocation; end if;
  allocation:=least(remaining,instrow.interest_due-instrow.interest_paid); if allocation>0 then insert into public.payment_allocations(institution_id,repayment_transaction_id,installment_id,component,amount) values(pr.institution_id,txid,instrow.id,'interest',allocation); update public.repayment_installments set interest_paid=interest_paid+allocation where id=instrow.id; remaining:=remaining-allocation; end if;
  allocation:=least(remaining,instrow.principal_due-instrow.principal_paid); if allocation>0 then insert into public.payment_allocations(institution_id,repayment_transaction_id,installment_id,component,amount) values(pr.institution_id,txid,instrow.id,'principal',allocation); update public.repayment_installments set principal_paid=principal_paid+allocation where id=instrow.id; remaining:=remaining-allocation; end if;
  update public.repayment_installments set status=case when principal_paid>=principal_due and interest_paid>=interest_due and fee_paid>=fee_due then 'paid' when principal_paid+interest_paid+fee_paid>0 then 'partial' else status end where id=instrow.id; exit when remaining=0;
 end loop;
 update public.loan_accounts set principal_outstanding=greatest(0,principal_outstanding-(select coalesce(sum(amount),0) from public.payment_allocations where repayment_transaction_id=txid and component='principal')),interest_outstanding=greatest(0,interest_outstanding-(select coalesce(sum(amount),0) from public.payment_allocations where repayment_transaction_id=txid and component='interest')),fee_outstanding=greatest(0,fee_outstanding-(select coalesce(sum(amount),0) from public.payment_allocations where repayment_transaction_id=txid and component='fee')) where id=pr.loan_account_id;
 if remaining>0 then insert into public.unapplied_cash(institution_id,repayment_transaction_id,customer_profile_id,amount) values(pr.institution_id,txid,pr.customer_profile_id,remaining); update public.repayment_transactions set status='unapplied' where id=txid; else update public.repayment_transactions set status='allocated' where id=txid; end if;
 insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) values(pr.institution_id,pr.customer_profile_id,'Payment received','Your M-Pesa payment of KES '||p_amount||' has been verified and allocated.','payment');
end $$;
revoke all on function public.create_my_stk_request(uuid,numeric,uuid) from public; grant execute on function public.create_my_stk_request(uuid,numeric,uuid) to authenticated;
revoke all on function public.record_payhero_stk_submission(uuid,text) from public; revoke all on function public.process_payhero_repayment(text,text,numeric,boolean,jsonb) from public;
grant execute on function public.record_payhero_stk_submission(uuid,text) to service_role; grant execute on function public.process_payhero_repayment(text,text,numeric,boolean,jsonb) to service_role;
