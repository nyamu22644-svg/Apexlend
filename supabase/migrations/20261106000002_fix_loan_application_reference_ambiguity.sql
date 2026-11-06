-- The return-table column application_number is visible as a PL/pgSQL variable.
-- Qualify table columns in both idempotent and newly-created return paths.
create or replace function public.submit_my_loan_application(p_product_version_id uuid,p_requested_amount numeric,p_requested_term_months integer,p_loan_purpose text,p_crb_consent boolean,p_terms_consent boolean,p_idempotency_key uuid)
returns table(application_id uuid,application_number text,application_status text) language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_id uuid:=auth.uid();inst uuid;product_terms jsonb;existing_id uuid;app_number text;available_limit numeric;policy_enabled boolean;
begin
 if length(trim(coalesce(p_loan_purpose,'')))<3 then raise exception 'loan purpose is required'; end if;
 if not coalesce(p_crb_consent,false) or not coalesce(p_terms_consent,false) then raise exception 'required consents have not been provided'; end if;
 select c.institution_id into inst from public.customers c join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id where c.profile_id=actor_id and p.status='active' and c.kyc_status='verified'; if inst is null then raise exception 'KYC approval is required before applying for a loan'; end if;
 select a.id into existing_id from public.loan_applications a where a.institution_id=inst and a.idempotency_key=p_idempotency_key;
 if existing_id is not null then return query select a.id,a.application_number,a.status from public.loan_applications a where a.id=existing_id; return; end if;
 select v.terms into product_terms from public.loan_product_versions v where v.id=p_product_version_id and v.institution_id=inst and v.status='active'; if product_terms is null then raise exception 'The selected loan product is no longer available'; end if;
 if p_requested_amount<(product_terms->>'min_amount')::numeric or p_requested_amount>(product_terms->>'max_amount')::numeric or p_requested_term_months<(product_terms->>'min_term_months')::integer or p_requested_term_months>(product_terms->>'max_term_months')::integer then raise exception 'Requested amount or term is outside product limits'; end if;
 select p.enabled into policy_enabled from public.credit_limit_policies p where p.institution_id=inst;
 available_limit:=public.get_customer_credit_limit(actor_id); if coalesce(policy_enabled,false) and p_requested_amount>available_limit then raise exception using message='requested amount exceeds your available credit limit of KES '||available_limit; end if;
 app_number:='APP-'||to_char(now() at time zone 'UTC','YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.loan_applications(institution_id,customer_profile_id,product_version_id,application_number,requested_amount,requested_term_months,loan_purpose,crb_consent_at,terms_consent_at,status,idempotency_key,submitted_at) values(inst,actor_id,p_product_version_id,app_number,p_requested_amount,p_requested_term_months,trim(p_loan_purpose),now(),now(),'submitted',p_idempotency_key,now()) returning id into existing_id;
 insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor_id,'LOAN_APPLICATION_SUBMITTED','loan_application',existing_id,jsonb_build_object('requested_amount',p_requested_amount,'available_credit_limit',available_limit));
 return query select a.id,a.application_number,a.status from public.loan_applications a where a.id=existing_id;
end $$;

grant execute on function public.submit_my_loan_application(uuid,numeric,integer,text,boolean,boolean,uuid) to authenticated;
notify pgrst, 'reload schema';
