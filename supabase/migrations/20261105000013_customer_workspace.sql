-- Production workflow 13: safe customer workspace read model. Sensitive identifiers remain encrypted-only.

create or replace function public.get_my_customer_workspace()
returns table (
  profile_id uuid, customer_number text, full_name text, email text, phone_number text,
  date_of_birth date, residential_address text, county text, town text,
  employment_status text, employer_name text, monthly_income numeric,
  mpesa_phone_number text, kyc_status text, created_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.profile_id, c.customer_number, p.full_name, p.email, p.phone_number,
    c.date_of_birth, c.residential_address, c.county, c.town,
    c.employment_status, c.employer_name, c.monthly_income,
    c.mpesa_phone_number, c.kyc_status, c.created_at
  from public.customers c
  join public.profiles p on p.id = c.profile_id and p.institution_id = c.institution_id
  where c.profile_id = auth.uid() and p.status = 'active';
$$;
revoke all on function public.get_my_customer_workspace() from public;
grant execute on function public.get_my_customer_workspace() to authenticated;
