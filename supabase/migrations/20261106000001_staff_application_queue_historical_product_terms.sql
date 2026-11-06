-- Staff must be able to review applications after their product version has been
-- retired. The customer quote function intentionally excludes retired versions,
-- so calculate the staff display quote from the version already linked to each
-- application instead.
create or replace function public.get_staff_application_queue()
returns table (
  application_id uuid, application_number text, status text, submitted_at timestamptz,
  customer_profile_id uuid, customer_number text, customer_name text, customer_email text, phone_number text,
  product_name text, requested_amount numeric, requested_term_months integer, loan_purpose text, product_terms jsonb,
  monthly_installment numeric, total_interest_fees numeric, total_repayable numeric,
  assessment_score numeric, debt_service_ratio numeric, assessment_findings jsonb, risk_tier text,
  maker_decision text, proposed_amount numeric, proposed_term_months integer, rationale text,
  maker_name text, maker_profile_id uuid, recommendation_at timestamptz,
  approval_request_id uuid, approval_status text, checker_name text, checker_action text, checker_reason text, resolved_at timestamptz
) language sql stable security definer set search_path = public, pg_temp as $$
  select a.id,a.application_number,a.status,a.submitted_at,c.profile_id,c.customer_number,p.full_name,p.email,coalesce(c.mpesa_phone_number,p.phone_number),
    lp.name,a.requested_amount,a.requested_term_months,a.loan_purpose,pv.terms,
    q.monthly_installment,q.total_interest+q.total_fees,q.total_repayable,
    ca.score,ca.debt_service_ratio,ca.findings,
    coalesce(ca.findings->>'risk_tier',case when ca.score is null then null when ca.score>=750 then 'Low' when ca.score>=600 then 'Medium' else 'High' end),
    d.decision,d.proposed_amount,d.proposed_term_months,d.rationale,maker.full_name,d.made_by,d.created_at,
    ar.id,ar.status,checker.full_name,aa.action,aa.reason,ar.resolved_at
  from public.loan_applications a
  join public.customers c on c.profile_id=a.customer_profile_id and c.institution_id=a.institution_id
  join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id
  join public.loan_product_versions pv on pv.id=a.product_version_id and pv.institution_id=a.institution_id
  join public.loan_products lp on lp.id=pv.product_id and lp.institution_id=pv.institution_id
  left join lateral (
    select round(calc.payment,2) as monthly_installment,
      round(calc.payment*input.term_months-input.principal,2) as total_interest,
      calc.fee+tax.excise as total_fees,
      round(calc.payment*input.term_months+calc.fee+tax.excise,2) as total_repayable
    from lateral (
      select coalesce((select x.proposed_amount from public.application_decisions x where x.application_id=a.id and x.institution_id=a.institution_id order by x.created_at desc limit 1),a.requested_amount) as principal,
        coalesce((select x.proposed_term_months from public.application_decisions x where x.application_id=a.id and x.institution_id=a.institution_id order by x.created_at desc limit 1),a.requested_term_months) as term_months,
        pv.terms as terms
    ) input
    cross join lateral (
      select coalesce((input.terms->>'interest_rate_per_month')::numeric,0)/100 as monthly_rate,
        coalesce((input.terms->>'processing_fee_percent')::numeric,0)/100 as fee_rate,
        coalesce((input.terms->>'excise_duty_percent')::numeric,20)/100 as excise_rate
    ) rates
    cross join lateral (
      select case when rates.monthly_rate=0 then input.principal/input.term_months else input.principal*(rates.monthly_rate*power(1+rates.monthly_rate,input.term_months))/(power(1+rates.monthly_rate,input.term_months)-1) end as payment,
        round(input.principal*rates.fee_rate,2) as fee
    ) calc
    cross join lateral (select round(calc.fee*rates.excise_rate,2) as excise) tax
  ) q on true
  left join lateral (select * from public.credit_assessments x where x.application_id=a.id and x.institution_id=a.institution_id and x.status='completed' order by x.created_at desc limit 1) ca on true
  left join lateral (select * from public.application_decisions x where x.application_id=a.id and x.institution_id=a.institution_id order by x.created_at desc limit 1) d on true
  left join public.profiles maker on maker.id=d.made_by
  left join public.approval_requests ar on ar.subject_type='application' and ar.subject_id=a.id and ar.institution_id=a.institution_id
  left join public.approval_actions aa on aa.approval_request_id=ar.id and aa.institution_id=ar.institution_id
  left join public.profiles checker on checker.id=aa.checker_profile_id
  where a.institution_id=public.current_institution_id() and public.has_permission('application.read')
  order by a.submitted_at asc;
$$;

revoke all on function public.get_staff_application_queue() from public;
grant execute on function public.get_staff_application_queue() to authenticated;
notify pgrst, 'reload schema';
