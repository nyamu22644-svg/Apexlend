-- Customer-only payment history and balances. No payment initiation is enabled here.
create or replace function public.get_my_payments_workspace()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'loans',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'loan_number',l.account_number,'status',l.status,'outstanding',l.principal_outstanding+l.interest_outstanding+l.fee_outstanding+l.penalty_outstanding) order by l.created_at desc) from public.loan_accounts l where l.customer_profile_id=auth.uid() and l.institution_id=public.current_institution_id()),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'type','repayment','amount',r.amount,'reference',r.transaction_reference,'status',r.status,'received_at',r.received_at,'loan_number',l.account_number) order by r.received_at desc) from public.repayment_transactions r left join public.loan_accounts l on l.id=r.loan_account_id and l.institution_id=r.institution_id where r.customer_profile_id=auth.uid() and r.institution_id=public.current_institution_id()),'[]'::jsonb)
  );
$$;
revoke all on function public.get_my_payments_workspace() from public;
grant execute on function public.get_my_payments_workspace() to authenticated;
