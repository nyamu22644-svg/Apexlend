-- Read-only servicing workspace. Financial mutations remain unavailable until a maker-checker servicing policy is approved.
create or replace function public.get_staff_loan_accounts_workspace()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('loans',coalesce((select jsonb_agg(jsonb_build_object(
  'id',l.id,'loan_number',l.account_number,'customer_id',l.customer_profile_id,'customer_name',p.full_name,'phone',coalesce(c.mpesa_phone_number,p.phone_number),
  'product_name',coalesce(s.terms->'product_terms'->>'name','Product name unavailable'),'status',l.status,
  'principal_amount',coalesce((s.terms->>'principal')::numeric,l.principal_outstanding),'disbursed_amount',coalesce(d.amount,0),
  'outstanding_principal',l.principal_outstanding,'outstanding_interest',l.interest_outstanding,'outstanding_balance',l.principal_outstanding+l.interest_outstanding+l.fee_outstanding+l.penalty_outstanding,
  'total_paid',coalesce((select sum(r.amount) from public.repayment_transactions r where r.institution_id=l.institution_id and r.loan_account_id=l.id and r.status in ('allocated','partially_allocated','unapplied')),0),
  'term_months',coalesce((s.terms->>'term_months')::integer,0),'monthly_installment',coalesce((s.terms->>'monthly_installment')::numeric,0),'interest_rate',coalesce((s.terms->>'interest_rate_per_month')::numeric,0),
  'disbursed_at',d.created_at,'next_due',(select min(i.due_date) from public.repayment_installments i where i.institution_id=l.institution_id and i.loan_account_id=l.id and i.status not in ('paid','waived')),
  'days_in_arrears',greatest(0,current_date-coalesce((select min(i.due_date) from public.repayment_installments i where i.institution_id=l.institution_id and i.loan_account_id=l.id and i.due_date<current_date and i.status not in ('paid','waived')),current_date)),
  'installments',coalesce((select jsonb_agg(jsonb_build_object('installment_number',i.installment_number,'due_date',i.due_date,'principal',i.principal_due,'interest',i.interest_due,'total_due',i.principal_due+i.interest_due+i.fee_due+i.penalty_due,'status',i.status) order by i.installment_number) from public.repayment_installments i where i.institution_id=l.institution_id and i.loan_account_id=l.id),'[]'::jsonb)
 ) order by l.created_at desc) from public.loan_accounts l join public.customers c on c.profile_id=l.customer_profile_id and c.institution_id=l.institution_id join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id left join public.loan_contract_snapshots s on s.loan_account_id=l.id and s.institution_id=l.institution_id left join lateral(select * from public.disbursement_requests x where x.loan_account_id=l.id and x.status='completed' order by x.created_at desc limit 1)d on true where l.institution_id=public.current_institution_id()),'[]'::jsonb))
 where public.has_permission('loan.read');
$$;
revoke all on function public.get_staff_loan_accounts_workspace() from public;
grant execute on function public.get_staff_loan_accounts_workspace() to authenticated;
