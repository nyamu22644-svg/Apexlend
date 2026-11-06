-- A borrower can have one live STK prompt per loan. Older unfinished prompts
-- are closed whenever they choose to try again.
create or replace function public.create_my_stk_request(p_loan_account_id uuid,p_amount numeric,p_idempotency_key uuid,p_phone_number text)
returns table(payment_request_id uuid,external_reference text,phone_number text,customer_name text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid; balance numeric; phone text; name text; pid uuid; reference text; digits text;
begin
 digits:=regexp_replace(coalesce(p_phone_number,''),'[^0-9]','','g'); phone:=case when digits ~ '^0[17][0-9]{8}$' then '254'||substr(digits,2) when digits ~ '^254[17][0-9]{8}$' then digits when digits ~ '^[17][0-9]{8}$' then '254'||digits else null end;
 if phone is null then raise exception 'enter a valid Kenyan M-Pesa number'; end if;
 select l.institution_id,l.principal_outstanding+l.interest_outstanding+l.fee_outstanding+l.penalty_outstanding,p.full_name into inst,balance,name from public.loan_accounts l join public.profiles p on p.id=l.customer_profile_id and p.institution_id=l.institution_id where l.id=p_loan_account_id and l.customer_profile_id=auth.uid() and l.status='active' for update;
 if inst is null then raise exception 'active loan account unavailable'; end if; if p_amount<=0 or p_amount>balance then raise exception 'payment amount must not exceed the outstanding balance'; end if;
 select id,coalesce(external_reference,provider_reference) into pid,reference from public.payment_requests where institution_id=inst and idempotency_key=p_idempotency_key; if pid is not null then return query select pid,reference,phone,name; return; end if;
 update public.payment_requests set status='cancelled',updated_at=now() where institution_id=inst and customer_profile_id=auth.uid() and loan_account_id=p_loan_account_id and request_type='stk_push' and status in ('routing','submitted','accepted','unknown');
 update public.customers set mpesa_phone_number=phone,updated_at=now() where profile_id=auth.uid() and institution_id=inst; update public.profiles set phone_number=phone,updated_at=now() where id=auth.uid() and institution_id=inst;
 reference:='STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)); insert into public.payment_requests(institution_id,customer_profile_id,loan_account_id,request_type,amount,destination_reference,idempotency_key,status,provider_reference,external_reference) values(inst,auth.uid(),p_loan_account_id,'stk_push',p_amount,phone,p_idempotency_key,'routing',reference,reference) returning id into pid;
 return query select pid,reference,phone,name;
end $$;

-- Successful payout notification includes the actual schedule, not a vague amount-only message.
create or replace function public.process_finoq_disbursement(p_external_reference text,p_provider_reference text,p_success boolean,p_amount numeric,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pr record; did uuid; account text; first_due date; installment numeric; total numeric;
begin
 select * into pr from public.payment_requests where provider_reference=p_external_reference and request_type='b2c_disbursement' for update; if pr.id is null or pr.amount<>p_amount then raise exception 'disbursement callback unavailable'; end if;
 select disbursement_request_id into did from public.disbursement_attempts where payment_request_id=pr.id; update public.payment_requests set status=case when p_success then 'completed' else 'failed' end,updated_at=now() where id=pr.id; update public.disbursement_attempts set status=case when p_success then 'completed' else 'failed' end,provider_response=p_payload where payment_request_id=pr.id; update public.disbursement_requests set status=case when p_success then 'completed' else 'failed' end where id=did;
 if p_success then
   update public.loan_accounts set status='active' where id=pr.loan_account_id and status='pending_disbursement';
   select l.account_number,min(i.due_date),coalesce((array_agg(i.principal_due+i.interest_due+i.fee_due+i.penalty_due order by i.installment_number))[1],0),coalesce(sum(i.principal_due+i.interest_due+i.fee_due+i.penalty_due),0) into account,first_due,installment,total from public.loan_accounts l left join public.repayment_installments i on i.loan_account_id=l.id and i.institution_id=l.institution_id where l.id=pr.loan_account_id group by l.account_number;
   insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) select pr.institution_id,l.customer_profile_id,'Loan disbursed','Your loan has been disbursed successfully.'||chr(10)||chr(10)||'Loan account: '||account||chr(10)||'Amount disbursed: KES '||to_char(pr.amount,'FM999,999,999,990.00')||chr(10)||'Sent to M-Pesa: '||pr.destination_reference||chr(10)||'First repayment due: '||coalesce(to_char(first_due,'DD Mon YYYY'),'See your repayment schedule')||chr(10)||'First instalment: KES '||to_char(installment,'FM999,999,999,990.00')||chr(10)||'Total repayable: KES '||to_char(total,'FM999,999,999,990.00')||chr(10)||chr(10)||'Please keep sufficient funds in your M-Pesa line before each due date.','success' from public.loan_accounts l where l.id=pr.loan_account_id;
 end if;
end $$;
notify pgrst, 'reload schema';
