-- Seed the first truthful dashboard observation for each institution at deployment time.
-- Earlier balances cannot be inferred from current outstanding balances and are intentionally not backfilled.
insert into public.staff_dashboard_daily_snapshots(institution_id,snapshot_date,customer_count,active_loan_count,portfolio_balance,par_balance,disbursed_amount,repayment_amount,policy_version)
select i.id,(now() at time zone p.reporting_timezone)::date,
  (select count(*) from public.customers c join public.profiles pr on pr.id=c.profile_id and pr.institution_id=c.institution_id where c.institution_id=i.id and pr.status='active'),
  (select count(*) from public.loan_accounts l where l.institution_id=i.id and l.status=any(p.portfolio_statuses)),
  (select coalesce(sum(l.principal_outstanding+case when p.include_interest_in_portfolio then l.interest_outstanding else 0 end+case when p.include_fees_in_portfolio then l.fee_outstanding else 0 end+case when p.include_penalties_in_portfolio then l.penalty_outstanding else 0 end),0) from public.loan_accounts l where l.institution_id=i.id and l.status=any(p.portfolio_statuses)),
  (select coalesce(sum(l.principal_outstanding+case when p.include_interest_in_portfolio then l.interest_outstanding else 0 end+case when p.include_fees_in_portfolio then l.fee_outstanding else 0 end+case when p.include_penalties_in_portfolio then l.penalty_outstanding else 0 end),0) from public.loan_accounts l where l.institution_id=i.id and l.status=any(p.portfolio_statuses) and exists(select 1 from public.repayment_installments ri where ri.institution_id=i.id and ri.loan_account_id=l.id and ri.due_date<(now() at time zone p.reporting_timezone)::date-p.par_days_past_due and ri.status not in ('paid','waived'))),
  (select coalesce(sum(d.amount),0) from public.disbursement_requests d where d.institution_id=i.id and d.status='completed' and (d.created_at at time zone p.reporting_timezone)::date=(now() at time zone p.reporting_timezone)::date),
  (select coalesce(sum(r.amount),0) from public.repayment_transactions r where r.institution_id=i.id and r.status=any(p.repayment_statuses) and (r.received_at at time zone p.reporting_timezone)::date=(now() at time zone p.reporting_timezone)::date),
  to_jsonb(p)
from public.institutions i join public.staff_dashboard_reporting_policies p on p.institution_id=i.id
on conflict(institution_id,snapshot_date) do nothing;
