-- Staff dashboard: configurable, tenant-scoped reporting definitions and immutable daily snapshots.
-- Defaults are starting policy values, not UI constants. An authorized administrator can change them
-- through save_staff_dashboard_reporting_policy before relying on operational reporting.

insert into public.permissions(code,description) values
  ('dashboard.read','Read institution dashboard metrics'),
  ('dashboard.configure','Configure institution dashboard reporting policy')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,institution_id,permission_code)
select r.id,r.institution_id,'dashboard.read' from public.roles r
where r.code in ('super_admin','admin','operations_manager','credit_officer','loan_approver','disbursement_officer','collections_agent','compliance_auditor','support_officer')
on conflict do nothing;
insert into public.role_permissions(role_id,institution_id,permission_code)
select r.id,r.institution_id,'dashboard.configure' from public.roles r
where r.code in ('super_admin','admin') on conflict do nothing;

create table if not exists public.staff_dashboard_reporting_policies (
  institution_id uuid primary key references public.institutions(id) on delete restrict,
  reporting_timezone text not null default 'Africa/Nairobi',
  comparison_period text not null default 'month_over_month' check (comparison_period in ('day_over_day','month_over_month')),
  par_days_past_due integer not null default 30 check (par_days_past_due >= 1),
  portfolio_statuses text[] not null default array['active']::text[],
  include_interest_in_portfolio boolean not null default true,
  include_fees_in_portfolio boolean not null default true,
  include_penalties_in_portfolio boolean not null default false,
  repayment_statuses text[] not null default array['allocated','partially_allocated','unapplied']::text[],
  gateway_provider text not null default 'finoq',
  gateway_capability text not null default 'b2c',
  gateway_display_name text not null default 'Safaricom M-Pesa Gateway',
  gateway_window_minutes integer not null default 1440 check (gateway_window_minutes between 5 and 43200),
  gateway_healthy_success_percent numeric(5,2) not null default 99.50 check (gateway_healthy_success_percent between 0 and 100),
  gateway_degraded_success_percent numeric(5,2) not null default 95.00 check (gateway_degraded_success_percent between 0 and 100),
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (gateway_degraded_success_percent <= gateway_healthy_success_percent)
);
insert into public.staff_dashboard_reporting_policies(institution_id)
select id from public.institutions on conflict do nothing;
alter table public.staff_dashboard_reporting_policies enable row level security;

create table if not exists public.staff_dashboard_daily_snapshots (
  institution_id uuid not null references public.institutions(id) on delete restrict,
  snapshot_date date not null,
  customer_count bigint not null,
  active_loan_count bigint not null,
  portfolio_balance numeric(18,2) not null,
  par_balance numeric(18,2) not null,
  disbursed_amount numeric(18,2) not null,
  repayment_amount numeric(18,2) not null,
  policy_version jsonb not null,
  captured_at timestamptz not null default now(),
  primary key(institution_id,snapshot_date)
);
alter table public.staff_dashboard_daily_snapshots enable row level security;

create or replace function public.capture_staff_dashboard_snapshot(p_snapshot_date date default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); policy public.staff_dashboard_reporting_policies%rowtype; day date;
begin
 if not public.has_permission('dashboard.configure') then raise exception 'permission denied'; end if;
 select * into policy from public.staff_dashboard_reporting_policies where institution_id=inst;
 day:=coalesce(p_snapshot_date,(now() at time zone policy.reporting_timezone)::date);
 insert into public.staff_dashboard_daily_snapshots(institution_id,snapshot_date,customer_count,active_loan_count,portfolio_balance,par_balance,disbursed_amount,repayment_amount,policy_version)
 select inst,day,
  (select count(*) from public.customers c join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id where c.institution_id=inst and p.status='active'),
  (select count(*) from public.loan_accounts l where l.institution_id=inst and l.status=any(policy.portfolio_statuses)),
  (select coalesce(sum(l.principal_outstanding + case when policy.include_interest_in_portfolio then l.interest_outstanding else 0 end + case when policy.include_fees_in_portfolio then l.fee_outstanding else 0 end + case when policy.include_penalties_in_portfolio then l.penalty_outstanding else 0 end),0) from public.loan_accounts l where l.institution_id=inst and l.status=any(policy.portfolio_statuses)),
  (select coalesce(sum(l.principal_outstanding + case when policy.include_interest_in_portfolio then l.interest_outstanding else 0 end + case when policy.include_fees_in_portfolio then l.fee_outstanding else 0 end + case when policy.include_penalties_in_portfolio then l.penalty_outstanding else 0 end),0) from public.loan_accounts l where l.institution_id=inst and l.status=any(policy.portfolio_statuses) and exists(select 1 from public.repayment_installments i where i.institution_id=inst and i.loan_account_id=l.id and i.due_date < day-policy.par_days_past_due and i.status not in ('paid','waived'))),
  (select coalesce(sum(d.amount),0) from public.disbursement_requests d where d.institution_id=inst and d.status='completed' and (d.created_at at time zone policy.reporting_timezone)::date=day),
  (select coalesce(sum(r.amount),0) from public.repayment_transactions r where r.institution_id=inst and r.status=any(policy.repayment_statuses) and (r.received_at at time zone policy.reporting_timezone)::date=day),
  to_jsonb(policy)
 on conflict(institution_id,snapshot_date) do update set customer_count=excluded.customer_count,active_loan_count=excluded.active_loan_count,portfolio_balance=excluded.portfolio_balance,par_balance=excluded.par_balance,disbursed_amount=excluded.disbursed_amount,repayment_amount=excluded.repayment_amount,policy_version=excluded.policy_version,captured_at=now();
end $$;

create or replace function public.get_staff_dashboard()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); policy public.staff_dashboard_reporting_policies%rowtype; today date; previous date; current_snapshot public.staff_dashboard_daily_snapshots%rowtype; prior_snapshot public.staff_dashboard_daily_snapshots%rowtype; gateway_total bigint; gateway_success bigint;
begin
 if not public.has_permission('dashboard.read') then raise exception 'permission denied'; end if;
 select * into policy from public.staff_dashboard_reporting_policies where institution_id=inst;
 today:=(now() at time zone policy.reporting_timezone)::date;
 previous:=case when policy.comparison_period='day_over_day' then today-1 else (date_trunc('month',today)::date-1) end;
 select * into current_snapshot from public.staff_dashboard_daily_snapshots where institution_id=inst and snapshot_date=today;
 select * into prior_snapshot from public.staff_dashboard_daily_snapshots where institution_id=inst and snapshot_date=previous;
 select count(*),count(*) filter(where pr.status='completed') into gateway_total,gateway_success from public.payment_requests pr join public.payment_provider_connections pc on pc.id=pr.selected_connection_id and pc.institution_id=pr.institution_id where pr.institution_id=inst and pc.provider=policy.gateway_provider and pc.capability=policy.gateway_capability and pr.created_at>=now()-make_interval(mins=>policy.gateway_window_minutes) and pr.status in ('completed','failed');
 return jsonb_build_object(
  'reporting_date',today,'timezone',policy.reporting_timezone,'comparison_period',policy.comparison_period,
  'metrics',jsonb_build_object('customers',case when current_snapshot.institution_id is null then null else current_snapshot.customer_count end,'active_loans',case when current_snapshot.institution_id is null then null else current_snapshot.active_loan_count end,'portfolio_balance',case when current_snapshot.institution_id is null then null else current_snapshot.portfolio_balance end,'today_repayments',(select coalesce(sum(amount),0) from public.repayment_transactions where institution_id=inst and status=any(policy.repayment_statuses) and (received_at at time zone policy.reporting_timezone)::date=today),'total_disbursed',case when current_snapshot.institution_id is null then null else current_snapshot.disbursed_amount end,'par_balance',case when current_snapshot.institution_id is null then null else current_snapshot.par_balance end,'awaiting_payout',(select count(*) from public.disbursement_requests where institution_id=inst and status='approved'),'underwriting_queue',(select count(*) from public.loan_applications where institution_id=inst and status in ('submitted','under_review'))),
  'growth',jsonb_build_object('customers',case when prior_snapshot.customer_count>0 then round((current_snapshot.customer_count-prior_snapshot.customer_count)*100.0/prior_snapshot.customer_count,2) end,'active_loans',case when prior_snapshot.active_loan_count>0 then round((current_snapshot.active_loan_count-prior_snapshot.active_loan_count)*100.0/prior_snapshot.active_loan_count,2) end,'portfolio_balance',case when prior_snapshot.portfolio_balance>0 then round((current_snapshot.portfolio_balance-prior_snapshot.portfolio_balance)*100.0/prior_snapshot.portfolio_balance,2) end,'today_repayments',null,'total_disbursed',case when prior_snapshot.disbursed_amount>0 then round((current_snapshot.disbursed_amount-prior_snapshot.disbursed_amount)*100.0/prior_snapshot.disbursed_amount,2) end,'par_balance',case when prior_snapshot.par_balance>0 then round((current_snapshot.par_balance-prior_snapshot.par_balance)*100.0/prior_snapshot.par_balance,2) end),
  'portfolio_trend',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(snapshot_date,'Mon'),'label',to_char(snapshot_date,'Mon YYYY'),'value',portfolio_balance) order by snapshot_date) from (select distinct on (date_trunc('month',s.snapshot_date)) s.snapshot_date,s.portfolio_balance from public.staff_dashboard_daily_snapshots s where s.institution_id=inst and s.snapshot_date>=date_trunc('month',today)::date-interval '5 months' order by date_trunc('month',s.snapshot_date),s.snapshot_date desc)x),'[]'::jsonb),
  'recent_applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'customer_name',p.full_name,'phone',coalesce(c.mpesa_phone_number,p.phone_number),'requested_amount',a.requested_amount,'status',a.status,'submitted_at',a.submitted_at) order by a.submitted_at desc) from (select * from public.loan_applications where institution_id=inst order by submitted_at desc nulls last limit 4)a join public.customers c on c.profile_id=a.customer_profile_id and c.institution_id=a.institution_id join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id),'[]'::jsonb),
  'recent_activity',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',case when e.action ilike '%PAYMENT%' then 'check' when e.action ilike '%DISBURSE%' then 'send' else 'clock' end,'title',replace(e.action,'_',' '),'description',coalesce(e.after_state->>'summary',e.target_type),'occurred_at',e.occurred_at) order by e.occurred_at desc) from (select * from public.audit_events where institution_id=inst order by occurred_at desc limit 4)e),'[]'::jsonb),
  'gateway',jsonb_build_object('name',policy.gateway_display_name,'sample_size',gateway_total,'success_percent',case when gateway_total>0 then round(gateway_success*100.0/gateway_total,2) end,'state',case when gateway_total=0 then 'unavailable' when gateway_success*100.0/gateway_total>=policy.gateway_healthy_success_percent then 'healthy' when gateway_success*100.0/gateway_total>=policy.gateway_degraded_success_percent then 'degraded' else 'unhealthy' end),
  'snapshot_available',(current_snapshot.institution_id is not null)
 );
end $$;

revoke all on function public.capture_staff_dashboard_snapshot(date),public.get_staff_dashboard() from public;
grant execute on function public.capture_staff_dashboard_snapshot(date),public.get_staff_dashboard() to authenticated;
notify pgrst,'reload schema';
