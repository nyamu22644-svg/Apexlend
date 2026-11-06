insert into public.permissions(code,description) values('credit_policy.manage','Configure customer credit-limit policy') on conflict do nothing;
insert into public.role_permissions(role_id,institution_id,permission_code)
select r.id,r.institution_id,p.code from public.roles r cross join (values('credit_policy.manage'),('repayment.read'),('loan.read')) p(code) where r.code='super_admin' on conflict do nothing;

create table if not exists public.credit_limit_policies(
 institution_id uuid primary key references public.institutions(id) on delete restrict,
 enabled boolean not null default true, initial_limit numeric(18,2) not null default 5000 check(initial_limit>=0),
 repeat_multiplier numeric(9,4) not null default 1.5 check(repeat_multiplier>=1), maximum_limit numeric(18,2) not null default 100000 check(maximum_limit>=0),
 require_no_overdue boolean not null default true, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.credit_limit_policies(institution_id) select id from public.institutions on conflict do nothing;
alter table public.credit_limit_policies enable row level security;

create or replace function public.get_customer_credit_limit(p_customer_profile_id uuid)
returns numeric language plpgsql stable security definer set search_path=public,pg_temp as $$
declare inst uuid; policy public.credit_limit_policies%rowtype; settled_count integer; last_principal numeric; active_balance numeric; has_overdue boolean; proposed_limit numeric;
begin
 select institution_id into inst from public.customers where profile_id=p_customer_profile_id;
 if inst is null then return 0; end if;
 select * into policy from public.credit_limit_policies where institution_id=inst;
 if not coalesce(policy.enabled,false) or not exists(select 1 from public.customers where profile_id=p_customer_profile_id and institution_id=inst and kyc_status='verified') then return 0; end if;
 select count(*),coalesce(max((s.terms->>'principal')::numeric),0) into settled_count,last_principal from public.loan_accounts l join public.loan_contract_snapshots s on s.loan_account_id=l.id and s.institution_id=l.institution_id where l.customer_profile_id=p_customer_profile_id and l.institution_id=inst and l.status='settled';
 select exists(select 1 from public.repayment_installments i join public.loan_accounts l on l.id=i.loan_account_id and l.institution_id=i.institution_id where l.customer_profile_id=p_customer_profile_id and l.institution_id=inst and i.status='overdue') into has_overdue;
 select coalesce(sum(principal_outstanding+interest_outstanding+fee_outstanding+penalty_outstanding),0) into active_balance from public.loan_accounts where customer_profile_id=p_customer_profile_id and institution_id=inst and status='active';
 if policy.require_no_overdue and has_overdue then return 0; end if;
 proposed_limit:=case when settled_count=0 then policy.initial_limit else least(policy.maximum_limit,greatest(policy.initial_limit,last_principal*policy.repeat_multiplier)) end;
 return greatest(0,proposed_limit-active_balance);
end $$;

create or replace function public.get_credit_limit_policy()
returns table(enabled boolean,initial_limit numeric,repeat_multiplier numeric,maximum_limit numeric,require_no_overdue boolean)
language sql stable security definer set search_path=public,pg_temp as $$ select enabled,initial_limit,repeat_multiplier,maximum_limit,require_no_overdue from public.credit_limit_policies where institution_id=public.current_institution_id() and public.has_permission('credit_policy.manage'); $$;
create or replace function public.save_credit_limit_policy(p_enabled boolean,p_initial_limit numeric,p_repeat_multiplier numeric,p_maximum_limit numeric,p_require_no_overdue boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_permission('credit_policy.manage') then raise exception 'permission denied'; end if;
 if p_initial_limit<0 or p_repeat_multiplier<1 or p_maximum_limit<p_initial_limit then raise exception 'invalid credit-limit policy'; end if;
 insert into public.credit_limit_policies(institution_id,enabled,initial_limit,repeat_multiplier,maximum_limit,require_no_overdue,updated_by,updated_at) values(public.current_institution_id(),p_enabled,p_initial_limit,p_repeat_multiplier,p_maximum_limit,p_require_no_overdue,auth.uid(),now()) on conflict(institution_id) do update set enabled=excluded.enabled,initial_limit=excluded.initial_limit,repeat_multiplier=excluded.repeat_multiplier,maximum_limit=excluded.maximum_limit,require_no_overdue=excluded.require_no_overdue,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
end $$;

create or replace function public.submit_my_loan_application(p_product_version_id uuid,p_requested_amount numeric,p_requested_term_months integer,p_loan_purpose text,p_crb_consent boolean,p_terms_consent boolean,p_idempotency_key uuid)
returns table(application_id uuid,application_number text,application_status text) language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_id uuid:=auth.uid();inst uuid;product_terms jsonb;existing_id uuid;app_number text;available_limit numeric;policy_enabled boolean;
begin
 if length(trim(coalesce(p_loan_purpose,'')))<3 then raise exception 'loan purpose is required'; end if;
 if not coalesce(p_crb_consent,false) or not coalesce(p_terms_consent,false) then raise exception 'required consents have not been provided'; end if;
 select c.institution_id into inst from public.customers c join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id where c.profile_id=actor_id and p.status='active' and c.kyc_status='verified'; if inst is null then raise exception 'KYC approval is required before applying for a loan'; end if;
 select id into existing_id from public.loan_applications where institution_id=inst and idempotency_key=p_idempotency_key; if existing_id is not null then return query select id,application_number,status from public.loan_applications where id=existing_id; return; end if;
 select terms into product_terms from public.loan_product_versions where id=p_product_version_id and institution_id=inst and status='active'; if product_terms is null then raise exception 'The selected loan product is no longer available'; end if;
 if p_requested_amount<(product_terms->>'min_amount')::numeric or p_requested_amount>(product_terms->>'max_amount')::numeric or p_requested_term_months<(product_terms->>'min_term_months')::integer or p_requested_term_months>(product_terms->>'max_term_months')::integer then raise exception 'Requested amount or term is outside product limits'; end if;
 select enabled into policy_enabled from public.credit_limit_policies where institution_id=inst;
 available_limit:=public.get_customer_credit_limit(actor_id); if coalesce(policy_enabled,false) and p_requested_amount>available_limit then raise exception using message='requested amount exceeds your available credit limit of KES '||available_limit; end if;
 app_number:='APP-'||to_char(now() at time zone 'UTC','YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.loan_applications(institution_id,customer_profile_id,product_version_id,application_number,requested_amount,requested_term_months,loan_purpose,crb_consent_at,terms_consent_at,status,idempotency_key,submitted_at) values(inst,actor_id,p_product_version_id,app_number,p_requested_amount,p_requested_term_months,trim(p_loan_purpose),now(),now(),'submitted',p_idempotency_key,now()) returning id into existing_id;
 insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor_id,'LOAN_APPLICATION_SUBMITTED','loan_application',existing_id,jsonb_build_object('requested_amount',p_requested_amount,'available_credit_limit',available_limit)); return query select id,application_number,status from public.loan_applications where id=existing_id;
end $$;

create or replace function public.get_staff_repayment_workspace()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('transactions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'reference',r.transaction_reference,'amount',r.amount,'status',r.status,'received_at',r.received_at,'loan_number',l.account_number,'customer_name',p.full_name,'phone',coalesce(c.mpesa_phone_number,p.phone_number),'allocations',coalesce((select jsonb_object_agg(component,total) from(select component,sum(amount) total from public.payment_allocations where repayment_transaction_id=r.id group by component)x),'{}'::jsonb))) from public.repayment_transactions r left join public.loan_accounts l on l.id=r.loan_account_id left join public.customers c on c.profile_id=r.customer_profile_id left join public.profiles p on p.id=r.customer_profile_id where r.institution_id=public.current_institution_id()),'[]'::jsonb),'unapplied',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'amount',u.amount,'status',u.status,'reference',r.transaction_reference,'customer_name',p.full_name)) from public.unapplied_cash u join public.repayment_transactions r on r.id=u.repayment_transaction_id left join public.profiles p on p.id=u.customer_profile_id where u.institution_id=public.current_institution_id() and u.status='open'),'[]'::jsonb),'today_total',coalesce((select sum(amount) from public.repayment_transactions where institution_id=public.current_institution_id() and received_at::date=current_date and status in('allocated','unapplied')),0)) where public.has_permission('repayment.read');
$$;

revoke all on function public.get_customer_credit_limit(uuid),public.get_credit_limit_policy(),public.save_credit_limit_policy(boolean,numeric,numeric,numeric,boolean),public.get_staff_repayment_workspace() from public;
grant execute on function public.get_customer_credit_limit(uuid),public.get_credit_limit_policy(),public.save_credit_limit_policy(boolean,numeric,numeric,numeric,boolean),public.get_staff_repayment_workspace() to authenticated;

-- Expose the calculated limit to the authenticated customer dashboard. The loan-submit
-- function remains the authoritative enforcement point.
drop function if exists public.get_my_customer_workspace();
create function public.get_my_customer_workspace()
returns table (
  profile_id uuid, customer_number text, full_name text, email text, phone_number text,
  date_of_birth date, residential_address text, county text, town text,
  employment_status text, employer_name text, occupation text, monthly_income numeric, other_income_sources text, existing_monthly_obligations numeric,
  mpesa_phone_number text, bank_name text, bank_account_name text, bank_branch_code text,
  nationality text, gender text, kyc_status text, created_at timestamptz, available_credit_limit numeric
)
language sql stable security definer set search_path=public,pg_temp as $$
  select c.profile_id,c.customer_number,p.full_name,p.email,p.phone_number,c.date_of_birth,c.residential_address,c.county,c.town,
    c.employment_status,c.employer_name,c.occupation,c.monthly_income,c.other_income_sources,c.existing_monthly_obligations,
    c.mpesa_phone_number,c.bank_name,c.bank_account_name,c.bank_branch_code,c.nationality,c.gender,c.kyc_status,c.created_at,
    public.get_customer_credit_limit(c.profile_id)
  from public.customers c join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id
  where c.profile_id=auth.uid() and p.status='active';
$$;
revoke all on function public.get_my_customer_workspace() from public;
grant execute on function public.get_my_customer_workspace() to authenticated;
