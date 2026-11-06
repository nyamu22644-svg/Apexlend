-- `external_reference` is also a named result column of this function; use a
-- table alias in the idempotency lookup so PostgreSQL never confuses the two.
create or replace function public.create_my_stk_request(p_loan_account_id uuid,p_amount numeric,p_idempotency_key uuid,p_phone_number text)
returns table(payment_request_id uuid,external_reference text,phone_number text,customer_name text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid; balance numeric; phone text; name text; pid uuid; reference text; digits text;
begin
 digits:=regexp_replace(coalesce(p_phone_number,''),'[^0-9]','','g'); phone:=case when digits ~ '^0[17][0-9]{8}$' then '254'||substr(digits,2) when digits ~ '^254[17][0-9]{8}$' then digits when digits ~ '^[17][0-9]{8}$' then '254'||digits else null end;
 if phone is null then raise exception 'enter a valid Kenyan M-Pesa number'; end if;
 select l.institution_id,l.principal_outstanding+l.interest_outstanding+l.fee_outstanding+l.penalty_outstanding,p.full_name into inst,balance,name from public.loan_accounts l join public.profiles p on p.id=l.customer_profile_id and p.institution_id=l.institution_id where l.id=p_loan_account_id and l.customer_profile_id=auth.uid() and l.status='active' for update;
 if inst is null then raise exception 'active loan account unavailable'; end if; if p_amount<=0 or p_amount>balance then raise exception 'payment amount must not exceed the outstanding balance'; end if;
 select pr.id,coalesce(pr.external_reference,pr.provider_reference) into pid,reference from public.payment_requests pr where pr.institution_id=inst and pr.idempotency_key=p_idempotency_key;
 if pid is not null then return query select pid,reference,phone,name; return; end if;
 update public.payment_requests set status='cancelled',updated_at=now() where institution_id=inst and customer_profile_id=auth.uid() and loan_account_id=p_loan_account_id and request_type='stk_push' and status in ('routing','submitted','accepted','unknown');
 update public.customers set mpesa_phone_number=phone,updated_at=now() where profile_id=auth.uid() and institution_id=inst; update public.profiles set phone_number=phone,updated_at=now() where id=auth.uid() and institution_id=inst;
 reference:='STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)); insert into public.payment_requests(institution_id,customer_profile_id,loan_account_id,request_type,amount,destination_reference,idempotency_key,status,provider_reference,external_reference) values(inst,auth.uid(),p_loan_account_id,'stk_push',p_amount,phone,p_idempotency_key,'routing',reference,reference) returning id into pid;
 return query select pid,reference,phone,name;
end $$;
notify pgrst, 'reload schema';
