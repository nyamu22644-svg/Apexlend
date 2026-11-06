-- Read-only operational queue for callbacks intentionally held pending until a
-- provider-status reconciliation confirms their final outcome.
create or replace function public.get_staff_repayment_workspace()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'reference',r.transaction_reference,'amount',r.amount,'status',r.status,'received_at',r.received_at,'loan_number',l.account_number,'customer_name',p.full_name,'phone',coalesce(c.mpesa_phone_number,p.phone_number),'allocations',coalesce((select jsonb_object_agg(component,total) from(select component,sum(amount) total from public.payment_allocations where repayment_transaction_id=r.id group by component)x),'{}'::jsonb))) from public.repayment_transactions r left join public.loan_accounts l on l.id=r.loan_account_id left join public.customers c on c.profile_id=r.customer_profile_id left join public.profiles p on p.id=r.customer_profile_id where r.institution_id=public.current_institution_id()),'[]'::jsonb),
  'unapplied',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'amount',u.amount,'status',u.status,'reference',r.transaction_reference,'customer_name',p.full_name)) from public.unapplied_cash u join public.repayment_transactions r on r.id=u.repayment_transaction_id left join public.profiles p on p.id=u.customer_profile_id where u.institution_id=public.current_institution_id() and u.status='open'),'[]'::jsonb),
  'pending_callbacks',coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'type',pr.request_type,'amount',pr.amount,'reference',coalesce(pr.external_reference,pr.provider_reference),'status',pr.status,'created_at',pr.created_at,'loan_number',l.account_number,'customer_name',p.full_name)) from public.payment_requests pr left join public.loan_accounts l on l.id=pr.loan_account_id left join public.profiles p on p.id=pr.customer_profile_id where pr.institution_id=public.current_institution_id() and pr.status in ('routing','submitted') and pr.created_at < now()-interval '10 minutes'),'[]'::jsonb),
  'today_total',coalesce((select sum(amount) from public.repayment_transactions where institution_id=public.current_institution_id() and received_at::date=current_date and status in('allocated','unapplied')),0)
 ) where public.has_permission('repayment.read');
$$;
revoke all on function public.get_staff_repayment_workspace() from public;
grant execute on function public.get_staff_repayment_workspace() to authenticated;
