-- Production workflow 10: permissioned KYC review queue and staff decisions.

create or replace function public.get_kyc_review_queue()
returns table (
  kyc_case_id uuid,
  customer_profile_id uuid,
  customer_number text,
  full_name text,
  email text,
  phone_number text,
  status text,
  opened_at timestamptz,
  document_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    k.id,
    c.profile_id,
    c.customer_number,
    p.full_name,
    p.email,
    coalesce(c.mpesa_phone_number, p.phone_number),
    k.status,
    k.opened_at,
    count(d.id) filter (where d.status = 'uploaded')
  from public.kyc_cases k
  join public.customers c
    on c.profile_id = k.customer_profile_id and c.institution_id = k.institution_id
  join public.profiles p
    on p.id = c.profile_id and p.institution_id = c.institution_id
  left join public.documents d
    on d.kyc_case_id = k.id and d.institution_id = k.institution_id
  where k.institution_id = public.current_institution_id()
    and k.status in ('pending', 'under_review')
    and public.has_permission('kyc.read')
  group by k.id, c.profile_id, c.customer_number, p.full_name, p.email, c.mpesa_phone_number, p.phone_number, k.status, k.opened_at
  order by k.opened_at asc;
$$;

create or replace function public.decide_kyc_case(
  p_kyc_case_id uuid,
  p_decision text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  target_institution uuid;
  target_customer uuid;
  document_count integer;
begin
  if actor_id is null or not public.has_permission('kyc.decide') then
    raise exception 'permission denied';
  end if;
  if p_decision not in ('verified', 'rejected') then
    raise exception 'invalid KYC decision';
  end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_notes, ''))) < 5 then
    raise exception 'a rejection reason is required';
  end if;

  select institution_id, customer_profile_id into target_institution, target_customer
  from public.kyc_cases
  where id = p_kyc_case_id and status in ('pending', 'under_review')
  for update;

  if target_institution is null or target_institution <> public.current_institution_id() then
    raise exception 'KYC case is unavailable';
  end if;

  select count(*) into document_count
  from public.documents
  where kyc_case_id = p_kyc_case_id and institution_id = target_institution and status = 'uploaded';
  if p_decision = 'verified' and document_count < 2 then
    raise exception 'two identity documents are required before approval';
  end if;

  update public.kyc_cases
  set status = p_decision, closed_at = now()
  where id = p_kyc_case_id and institution_id = target_institution;
  update public.customers
  set kyc_status = p_decision, updated_at = now()
  where profile_id = target_customer and institution_id = target_institution;
  update public.documents
  set status = case when p_decision = 'verified' then 'verified' else 'rejected' end
  where kyc_case_id = p_kyc_case_id and institution_id = target_institution and status = 'uploaded';

  insert into public.kyc_verification_events (institution_id, kyc_case_id, status, notes, actor_profile_id)
  values (target_institution, p_kyc_case_id, p_decision, nullif(trim(p_notes), ''), actor_id);
  insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id, after_state)
  values (target_institution, actor_id, 'KYC_' || upper(p_decision), 'kyc_case', p_kyc_case_id,
    jsonb_build_object('decision', p_decision, 'notes', nullif(trim(p_notes), '')));
end;
$$;

revoke all on function public.get_kyc_review_queue() from public;
revoke all on function public.decide_kyc_case(uuid, text, text) from public;
grant execute on function public.get_kyc_review_queue() to authenticated;
grant execute on function public.decide_kyc_case(uuid, text, text) to authenticated;
