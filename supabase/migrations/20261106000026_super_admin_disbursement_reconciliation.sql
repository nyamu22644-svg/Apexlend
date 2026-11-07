-- Exceptional operational control for a confirmed provider payout whose
-- callback was not processed. This is deliberately restricted to an active
-- Super Administrator, requires a provider reference and a written reason,
-- and records the action in the immutable audit log.
create or replace function public.reconcile_confirmed_finoq_disbursement(
  p_disbursement_id uuid,
  p_finoq_reference text,
  p_reason text
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor_id uuid := auth.uid();
  inst uuid;
  payment record;
  original_reference text;
begin
  select s.institution_id into inst
  from public.staff_members s
  join public.staff_role_assignments a on a.staff_profile_id=s.profile_id and a.institution_id=s.institution_id and a.revoked_at is null
  join public.roles r on r.id=a.role_id and r.institution_id=a.institution_id
  where s.profile_id=actor_id and s.is_active and r.code='super_admin';

  if inst is null then raise exception 'only an active super administrator may reconcile a disbursement'; end if;
  if length(trim(coalesce(p_finoq_reference,''))) < 6 then raise exception 'a valid Finoq reference is required'; end if;
  if length(trim(coalesce(p_reason,''))) < 20 then raise exception 'enter a reconciliation note of at least 20 characters'; end if;

  select pr.* into payment
  from public.disbursement_requests d
  join public.disbursement_attempts da on da.disbursement_request_id=d.id and da.institution_id=d.institution_id
  join public.payment_requests pr on pr.id=da.payment_request_id and pr.institution_id=da.institution_id
  where d.id=p_disbursement_id and d.institution_id=inst and d.status='submitted' and pr.status='submitted'
  order by da.sequence_number desc
  limit 1
  for update of pr;

  if payment.id is null then raise exception 'submitted disbursement is unavailable for reconciliation'; end if;
  original_reference := coalesce(payment.external_reference, payment.provider_reference);

  update public.payment_requests
  set external_reference=original_reference,
      provider_reference=trim(p_finoq_reference),
      updated_at=now()
  where id=payment.id;

  perform public.process_finoq_disbursement(
    original_reference,
    trim(p_finoq_reference),
    true,
    payment.amount,
    jsonb_build_object(
      'source','super_admin_manual_reconciliation',
      'finoq_reference',trim(p_finoq_reference),
      'reason',trim(p_reason),
      'reconciled_by',actor_id,
      'reconciled_at',now()
    )
  );

  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state)
  values (inst,actor_id,'FINOQ_DISBURSEMENT_MANUALLY_RECONCILED','disbursement_request',p_disbursement_id,
    jsonb_build_object('payment_request_id',payment.id,'external_reference',original_reference,'finoq_reference',trim(p_finoq_reference),'reason',trim(p_reason),'amount',payment.amount));
end $$;

revoke all on function public.reconcile_confirmed_finoq_disbursement(uuid,text,text) from public;
grant execute on function public.reconcile_confirmed_finoq_disbursement(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
