-- Snapshot capture is automated at 00:05 Africa/Nairobi (21:05 UTC), after the
-- reporting day closes. The job writes a corrected same-day snapshot if it reruns.
create extension if not exists pg_cron;

create or replace function public.refresh_all_staff_dashboard_snapshots()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.staff_dashboard_daily_snapshots(institution_id,snapshot_date,customer_count,active_loan_count,portfolio_balance,par_balance,disbursed_amount,repayment_amount,policy_version)
  select i.id,(now() at time zone p.reporting_timezone)::date,
    (select count(*) from public.customers c join public.profiles pr on pr.id=c.profile_id and pr.institution_id=c.institution_id where c.institution_id=i.id and pr.status='active'),
    (select count(*) from public.loan_accounts l where l.institution_id=i.id and l.status=any(p.portfolio_statuses)),
    (select coalesce(sum(l.principal_outstanding+case when p.include_interest_in_portfolio then l.interest_outstanding else 0 end+case when p.include_fees_in_portfolio then l.fee_outstanding else 0 end+case when p.include_penalties_in_portfolio then l.penalty_outstanding else 0 end),0) from public.loan_accounts l where l.institution_id=i.id and l.status=any(p.portfolio_statuses)),
    (select coalesce(sum(l.principal_outstanding+case when p.include_interest_in_portfolio then l.interest_outstanding else 0 end+case when p.include_fees_in_portfolio then l.fee_outstanding else 0 end+case when p.include_penalties_in_portfolio then l.penalty_outstanding else 0 end),0) from public.loan_accounts l where l.institution_id=i.id and l.status=any(p.portfolio_statuses) and exists(select 1 from public.repayment_installments ri where ri.institution_id=i.id and ri.loan_account_id=l.id and ri.due_date<(now() at time zone p.reporting_timezone)::date-p.par_days_past_due and ri.status not in ('paid','waived'))),
    (select coalesce(sum(d.amount),0) from public.disbursement_requests d where d.institution_id=i.id and d.status='completed'),
    (select coalesce(sum(r.amount),0) from public.repayment_transactions r where r.institution_id=i.id and r.status=any(p.repayment_statuses) and (r.received_at at time zone p.reporting_timezone)::date=(now() at time zone p.reporting_timezone)::date),
    to_jsonb(p)
  from public.institutions i join public.staff_dashboard_reporting_policies p on p.institution_id=i.id
  on conflict(institution_id,snapshot_date) do update set customer_count=excluded.customer_count,active_loan_count=excluded.active_loan_count,portfolio_balance=excluded.portfolio_balance,par_balance=excluded.par_balance,disbursed_amount=excluded.disbursed_amount,repayment_amount=excluded.repayment_amount,policy_version=excluded.policy_version,captured_at=now();
end $$;

do $$ begin
  if exists(select 1 from cron.job where jobname='staff-dashboard-daily-snapshot') then
    perform cron.unschedule('staff-dashboard-daily-snapshot');
  end if;
  perform cron.schedule('staff-dashboard-daily-snapshot','5 21 * * *','select public.refresh_all_staff_dashboard_snapshots()');
end $$;

revoke all on function public.refresh_all_staff_dashboard_snapshots() from public;
