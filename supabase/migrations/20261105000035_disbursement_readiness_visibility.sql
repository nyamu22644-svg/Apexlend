-- A pending-disbursement account has two staff-visible stages: waiting for the
-- borrower to accept the immutable contract, then ready for payout preparation.
create or replace function public.get_staff_disbursement_readiness()
returns table(loan_account_id uuid,account_number text,customer_name text,destination_phone text,amount numeric,contract_accepted_at timestamptz,readiness_status text)
language sql stable security definer set search_path=public,pg_temp as $$
 select l.id,l.account_number,p.full_name,coalesce(c.mpesa_phone_number,p.phone_number),l.principal_outstanding,s.accepted_at,
   case when s.accepted_at is null then 'awaiting_customer_acceptance' else 'ready_to_prepare' end
 from public.loan_accounts l
 join public.loan_contract_snapshots s on s.loan_account_id=l.id and s.institution_id=l.institution_id
 join public.customers c on c.profile_id=l.customer_profile_id and c.institution_id=l.institution_id
 join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id
 where l.institution_id=public.current_institution_id() and l.status='pending_disbursement'
   and not exists(select 1 from public.disbursement_requests d where d.loan_account_id=l.id)
   and public.has_permission('disbursement.create')
 order by s.accepted_at nulls first, l.created_at;
$$;
revoke all on function public.get_staff_disbursement_readiness() from public;
grant execute on function public.get_staff_disbursement_readiness() to authenticated;
