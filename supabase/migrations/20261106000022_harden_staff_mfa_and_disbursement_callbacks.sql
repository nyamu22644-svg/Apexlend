-- A valid staff password alone is not sufficient for privileged operations.
create or replace function public.has_permission(required_permission text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare actor_id uuid := auth.uid(); actor_institution uuid;
begin
  select institution_id into actor_institution from public.staff_members where profile_id = actor_id and is_active;
  if actor_institution is null or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then return false; end if;
  if exists (select 1 from public.staff_permission_overrides o where o.staff_profile_id = actor_id and o.institution_id = actor_institution and o.permission_code = required_permission and o.effect = 'deny') then return false; end if;
  if exists (select 1 from public.staff_permission_overrides o where o.staff_profile_id = actor_id and o.institution_id = actor_institution and o.permission_code = required_permission and o.effect = 'allow') then return true; end if;
  return exists (select 1 from public.staff_role_assignments a join public.role_permissions rp on rp.role_id = a.role_id and rp.institution_id = a.institution_id where a.staff_profile_id = actor_id and a.institution_id = actor_institution and a.revoked_at is null and rp.permission_code = required_permission);
end $$;

-- Provider callback replays cannot post a second payout notification or state change.
create or replace function public.process_finoq_disbursement(p_external_reference text,p_provider_reference text,p_success boolean,p_amount numeric,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pr record; did uuid;
begin
 select * into pr from public.payment_requests where provider_reference=p_external_reference and request_type='b2c_disbursement' for update;
 if pr.id is null or pr.amount<>p_amount then raise exception 'disbursement callback unavailable'; end if;
 if pr.status='completed' then return; end if;
 select disbursement_request_id into did from public.disbursement_attempts where payment_request_id=pr.id;
 update public.payment_requests set status=case when p_success then 'completed' else 'failed' end,updated_at=now() where id=pr.id;
 update public.disbursement_attempts set status=case when p_success then 'completed' else 'failed' end,provider_response=p_payload where payment_request_id=pr.id;
 update public.disbursement_requests set status=case when p_success then 'completed' else 'failed' end where id=did;
 if p_success then update public.loan_accounts set status='active' where id=pr.loan_account_id and status='pending_disbursement'; insert into public.customer_notifications(institution_id,customer_profile_id,title,message,notification_type) select pr.institution_id,l.customer_profile_id,'Loan disbursed','Your loan of KES '||pr.amount||' has been disbursed to your M-Pesa line.','success' from public.loan_accounts l where l.id=pr.loan_account_id; end if;
end $$;
