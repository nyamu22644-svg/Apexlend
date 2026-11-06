-- Extend the safe customer workspace with non-sensitive profile fields used by the Profile screen.
drop function if exists public.get_my_customer_workspace();
create or replace function public.get_my_customer_workspace()
returns table (
  profile_id uuid, customer_number text, full_name text, email text, phone_number text,
  date_of_birth date, residential_address text, county text, town text,
  employment_status text, employer_name text, occupation text, monthly_income numeric, other_income_sources text, existing_monthly_obligations numeric,
  mpesa_phone_number text, bank_name text, bank_account_name text, bank_branch_code text,
  nationality text, gender text, kyc_status text, created_at timestamptz
)
language sql stable security definer set search_path=public,pg_temp as $$
  select c.profile_id,c.customer_number,p.full_name,p.email,p.phone_number,c.date_of_birth,c.residential_address,c.county,c.town,
    c.employment_status,c.employer_name,c.occupation,c.monthly_income,c.other_income_sources,c.existing_monthly_obligations,
    c.mpesa_phone_number,c.bank_name,c.bank_account_name,c.bank_branch_code,c.nationality,c.gender,c.kyc_status,c.created_at
  from public.customers c join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id
  where c.profile_id=auth.uid() and p.status='active';
$$;
