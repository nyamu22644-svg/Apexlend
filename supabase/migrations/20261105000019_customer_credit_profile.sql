-- Core customer credit-file data for real underwriting; account numbers remain encrypted.
alter table public.customers
  add column if not exists nationality text,
  add column if not exists gender text,
  add column if not exists occupation text,
  add column if not exists other_income_sources text,
  add column if not exists existing_monthly_obligations numeric(18,2) not null default 0 check (existing_monthly_obligations >= 0),
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_ciphertext text,
  add column if not exists bank_branch_code text;

create or replace function public.submit_my_kyc(
  p_full_name text, p_phone_number text, p_date_of_birth date, p_residential_address text, p_county text, p_town text,
  p_national_id_ciphertext text, p_national_id_hash text, p_kra_pin_ciphertext text, p_mpesa_phone_number text,
  p_nationality text, p_gender text, p_employment_status text, p_employer_name text, p_occupation text,
  p_monthly_income numeric, p_other_income_sources text, p_existing_monthly_obligations numeric,
  p_bank_name text, p_bank_account_name text, p_bank_account_ciphertext text, p_bank_branch_code text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_id uuid:=auth.uid(); inst uuid; case_id uuid; document_count integer;
begin
  select c.institution_id into inst from public.customers c join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id where c.profile_id=actor_id and p.status='active';
  if inst is null then raise exception 'an active customer account is required'; end if;
  if length(trim(p_full_name))<2 or p_date_of_birth>=current_date or length(trim(p_residential_address))<5 or length(trim(p_county))<2 or length(trim(p_town))<2 or p_national_id_ciphertext='' or p_national_id_hash='' or p_kra_pin_ciphertext='' or coalesce(p_monthly_income,0)<0 or coalesce(p_existing_monthly_obligations,0)<0 then raise exception 'incomplete KYC submission'; end if;
  select count(*) into document_count from public.documents where institution_id=inst and customer_profile_id=actor_id and status='uploaded' and document_type in ('national_id_front','national_id_back','passport_front','passport_back','alien_id_front','alien_id_back'); if document_count<2 then raise exception 'two identity-document sides are required'; end if;
  update public.profiles set full_name=trim(p_full_name),phone_number=trim(p_phone_number),updated_at=now() where id=actor_id and institution_id=inst;
  update public.customers set national_id_ciphertext=p_national_id_ciphertext,national_id_hash=p_national_id_hash,kra_pin_ciphertext=p_kra_pin_ciphertext,date_of_birth=p_date_of_birth,residential_address=trim(p_residential_address),county=trim(p_county),town=trim(p_town),mpesa_phone_number=trim(p_mpesa_phone_number),nationality=nullif(trim(p_nationality),''),gender=nullif(trim(p_gender),''),employment_status=nullif(trim(p_employment_status),''),employer_name=nullif(trim(p_employer_name),''),occupation=nullif(trim(p_occupation),''),monthly_income=coalesce(p_monthly_income,0),other_income_sources=nullif(trim(p_other_income_sources),''),existing_monthly_obligations=coalesce(p_existing_monthly_obligations,0),bank_name=nullif(trim(p_bank_name),''),bank_account_name=nullif(trim(p_bank_account_name),''),bank_account_ciphertext=nullif(p_bank_account_ciphertext,''),bank_branch_code=nullif(trim(p_bank_branch_code),''),kyc_status='under_review',updated_at=now() where profile_id=actor_id and institution_id=inst;
  select id into case_id from public.kyc_cases where institution_id=inst and customer_profile_id=actor_id and status in ('pending','under_review') order by opened_at desc limit 1 for update; if case_id is null then insert into public.kyc_cases(institution_id,customer_profile_id,status) values(inst,actor_id,'under_review') returning id into case_id; end if;
  update public.kyc_cases set status='under_review' where id=case_id; insert into public.kyc_verification_events(institution_id,kyc_case_id,status,actor_profile_id) values(inst,case_id,'under_review',actor_id); insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor_id,'KYC_SUBMITTED_FOR_REVIEW','kyc_case',case_id,jsonb_build_object('employment_status',p_employment_status,'monthly_income',p_monthly_income,'existing_monthly_obligations',p_existing_monthly_obligations)); return case_id;
end; $$;
revoke all on function public.submit_my_kyc(text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text,numeric,text,text,text,text) from public;
grant execute on function public.submit_my_kyc(text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text,numeric,text,text,text,text) to authenticated;
