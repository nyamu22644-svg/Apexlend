-- Persist the customer-entered application details already represented in the UI.
alter table public.loan_applications
  add column if not exists loan_purpose text,
  add column if not exists crb_consent_at timestamptz,
  add column if not exists terms_consent_at timestamptz;

create or replace function public.submit_my_loan_application(
  p_product_version_id uuid,
  p_requested_amount numeric,
  p_requested_term_months integer,
  p_loan_purpose text,
  p_crb_consent boolean,
  p_terms_consent boolean,
  p_idempotency_key uuid
)
returns table (application_id uuid, application_number text, application_status text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare actor_id uuid := auth.uid(); inst uuid; product_terms jsonb; existing_id uuid; app_number text;
begin
  if length(trim(coalesce(p_loan_purpose, ''))) < 3 then raise exception 'loan purpose is required'; end if;
  if not coalesce(p_crb_consent, false) or not coalesce(p_terms_consent, false) then raise exception 'required consents have not been provided'; end if;
  select c.institution_id into inst from public.customers c join public.profiles p on p.id = c.profile_id and p.institution_id = c.institution_id where c.profile_id = actor_id and p.status = 'active' and c.kyc_status = 'verified';
  if inst is null then raise exception 'KYC approval is required before applying for a loan'; end if;
  select id into existing_id from public.loan_applications where institution_id = inst and idempotency_key = p_idempotency_key;
  if existing_id is not null then return query select a.id, a.application_number, a.status from public.loan_applications a where a.id = existing_id; return; end if;
  select terms into product_terms from public.loan_product_versions where id = p_product_version_id and institution_id = inst and status = 'active';
  if product_terms is null then raise exception 'The selected loan product is no longer available'; end if;
  if p_requested_amount < (product_terms->>'min_amount')::numeric or p_requested_amount > (product_terms->>'max_amount')::numeric or p_requested_term_months < (product_terms->>'min_term_months')::integer or p_requested_term_months > (product_terms->>'max_term_months')::integer then raise exception 'Requested amount or term is outside product limits'; end if;
  app_number := 'APP-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.loan_applications (institution_id, customer_profile_id, product_version_id, application_number, requested_amount, requested_term_months, loan_purpose, crb_consent_at, terms_consent_at, status, idempotency_key, submitted_at)
  values (inst, actor_id, p_product_version_id, app_number, p_requested_amount, p_requested_term_months, trim(p_loan_purpose), now(), now(), 'submitted', p_idempotency_key, now()) returning id into existing_id;
  insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id, after_state) values (inst, actor_id, 'LOAN_APPLICATION_SUBMITTED', 'loan_application', existing_id, jsonb_build_object('requested_amount', p_requested_amount, 'term_months', p_requested_term_months, 'purpose', trim(p_loan_purpose), 'product_version_id', p_product_version_id));
  return query select a.id, a.application_number, a.status from public.loan_applications a where a.id = existing_id;
end;
$$;

revoke all on function public.submit_my_loan_application(uuid, numeric, integer, text, boolean, boolean, uuid) from public;
grant execute on function public.submit_my_loan_application(uuid, numeric, integer, text, boolean, boolean, uuid) to authenticated;
