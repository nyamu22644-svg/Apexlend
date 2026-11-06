-- Production workflow 9: authenticated customer KYC submission and document registration.
-- Sensitive identifiers arrive already encrypted by the server route; plaintext is never
-- written to public tables or browser-accessible logs.

create or replace function public.register_my_kyc_document(
  p_document_id uuid,
  p_object_path text,
  p_document_type text,
  p_sha256 text,
  p_content_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_institution uuid;
  active_case_id uuid;
begin
  select c.institution_id into actor_institution
  from public.customers c
  join public.profiles p on p.id = c.profile_id and p.institution_id = c.institution_id
  where c.profile_id = actor_id and p.status = 'active';

  if actor_institution is null then
    raise exception 'an active customer account is required';
  end if;

  if p_object_path !~ ('^' || actor_institution::text || '/' || actor_id::text || '/' || p_document_id::text || '/[^/]+$') then
    raise exception 'invalid KYC document path';
  end if;

  if p_document_type not in ('national_id_front', 'national_id_back', 'passport_front', 'passport_back', 'alien_id_front', 'alien_id_back') then
    raise exception 'unsupported KYC document type';
  end if;

  if p_content_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     or p_size_bytes <= 0 or p_size_bytes > 5242880 then
    raise exception 'invalid KYC document metadata';
  end if;

  select id into active_case_id
  from public.kyc_cases
  where institution_id = actor_institution
    and customer_profile_id = actor_id
    and status in ('pending', 'under_review')
  order by opened_at desc
  limit 1;

  if active_case_id is null then
    insert into public.kyc_cases (institution_id, customer_profile_id, status)
    values (actor_institution, actor_id, 'pending')
    returning id into active_case_id;
  end if;

  insert into public.documents (
    id, institution_id, customer_profile_id, kyc_case_id, bucket_id, object_path,
    document_type, sha256, content_type, size_bytes
  ) values (
    p_document_id, actor_institution, actor_id, active_case_id, 'kyc-documents', p_object_path,
    p_document_type, p_sha256, p_content_type, p_size_bytes
  );

  insert into public.kyc_verification_events (institution_id, kyc_case_id, document_id, status, actor_profile_id)
  values (actor_institution, active_case_id, p_document_id, 'submitted', actor_id);

  insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id)
  values (actor_institution, actor_id, 'KYC_DOCUMENT_UPLOADED', 'document', p_document_id);

  return p_document_id;
end;
$$;

create or replace function public.submit_my_kyc(
  p_full_name text,
  p_phone_number text,
  p_date_of_birth date,
  p_residential_address text,
  p_county text,
  p_town text,
  p_national_id_ciphertext text,
  p_national_id_hash text,
  p_kra_pin_ciphertext text,
  p_mpesa_phone_number text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_institution uuid;
  active_case_id uuid;
  document_count integer;
begin
  select c.institution_id into actor_institution
  from public.customers c
  join public.profiles p on p.id = c.profile_id and p.institution_id = c.institution_id
  where c.profile_id = actor_id and p.status = 'active';

  if actor_institution is null then
    raise exception 'an active customer account is required';
  end if;

  if length(trim(p_full_name)) < 2 or p_date_of_birth >= current_date
     or length(trim(p_residential_address)) < 5 or length(trim(p_county)) < 2
     or length(trim(p_town)) < 2 or p_national_id_ciphertext = ''
     or p_national_id_hash = '' or p_kra_pin_ciphertext = '' then
    raise exception 'incomplete KYC submission';
  end if;

  select count(*) into document_count
  from public.documents
  where institution_id = actor_institution
    and customer_profile_id = actor_id
    and status = 'uploaded'
    and document_type in ('national_id_front', 'national_id_back', 'passport_front', 'passport_back', 'alien_id_front', 'alien_id_back');

  if document_count < 2 then
    raise exception 'two identity-document sides are required';
  end if;

  update public.profiles
  set full_name = trim(p_full_name), phone_number = trim(p_phone_number), updated_at = now()
  where id = actor_id and institution_id = actor_institution;

  update public.customers
  set national_id_ciphertext = p_national_id_ciphertext,
      national_id_hash = p_national_id_hash,
      kra_pin_ciphertext = p_kra_pin_ciphertext,
      date_of_birth = p_date_of_birth,
      residential_address = trim(p_residential_address),
      county = trim(p_county),
      town = trim(p_town),
      mpesa_phone_number = trim(p_mpesa_phone_number),
      kyc_status = 'under_review',
      updated_at = now()
  where profile_id = actor_id and institution_id = actor_institution;

  select id into active_case_id
  from public.kyc_cases
  where institution_id = actor_institution
    and customer_profile_id = actor_id
    and status in ('pending', 'under_review')
  order by opened_at desc
  limit 1
  for update;

  if active_case_id is null then
    insert into public.kyc_cases (institution_id, customer_profile_id, status)
    values (actor_institution, actor_id, 'under_review')
    returning id into active_case_id;
  end if;

  update public.kyc_cases set status = 'under_review' where id = active_case_id;
  insert into public.kyc_verification_events (institution_id, kyc_case_id, status, actor_profile_id)
  values (actor_institution, active_case_id, 'under_review', actor_id);
  insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id)
  values (actor_institution, actor_id, 'KYC_SUBMITTED_FOR_REVIEW', 'kyc_case', active_case_id);

  return active_case_id;
end;
$$;

revoke all on function public.register_my_kyc_document(uuid, text, text, text, text, bigint) from public;
revoke all on function public.submit_my_kyc(text, text, date, text, text, text, text, text, text, text) from public;
grant execute on function public.register_my_kyc_document(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.submit_my_kyc(text, text, date, text, text, text, text, text, text, text) to authenticated;
