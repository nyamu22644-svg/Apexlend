-- Use a distinct local name for the immutable product terms. PostgreSQL otherwise
-- cannot distinguish the PL/pgSQL variable from loan_product_versions.terms.
create or replace function public.resolve_loan_application_approval(p_approval_request_id uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor_id uuid:=auth.uid(); inst uuid; app_id uuid; maker_id uuid; approved_amount numeric;
  request_status text; recommendation text; proposed numeric; proposed_term integer;
  app_number text; loan_id uuid; version_id uuid; product_terms jsonb; r numeric;
  payment numeric; balance numeric; installment_number integer; interest_part numeric;
  principal_part numeric; fee numeric; excise numeric;
begin
  if p_action not in ('approved','rejected') then raise exception 'invalid approval action'; end if;
  select institution_id,subject_id,maker_profile_id,amount,status
    into inst,app_id,maker_id,approved_amount,request_status
    from public.approval_requests where id=p_approval_request_id and subject_type='application' for update;
  if inst is null or inst<>public.current_institution_id() then raise exception 'approval request is unavailable'; end if;
  if request_status<>'pending' then raise exception 'approval request is already resolved'; end if;
  if actor_id is null or actor_id=maker_id then raise exception 'maker cannot approve or reject their own recommendation'; end if;
  if not public.has_permission('application.approve') then raise exception 'permission denied'; end if;
  if not exists(select 1 from public.staff_members where profile_id=actor_id and institution_id=inst and is_active and approval_limit>=approved_amount) then raise exception 'approval limit exceeded'; end if;
  if p_action='rejected' and length(trim(coalesce(p_reason,'')))<5 then raise exception 'a rejection reason of at least 5 characters is required'; end if;
  select d.decision,d.proposed_amount,d.proposed_term_months,a.application_number,a.product_version_id
    into recommendation,proposed,proposed_term,app_number,version_id
    from public.application_decisions d join public.loan_applications a on a.id=d.application_id and a.institution_id=d.institution_id
    where d.application_id=app_id and d.institution_id=inst order by d.created_at desc limit 1;
  insert into public.approval_actions(institution_id,approval_request_id,checker_profile_id,action,reason)
    values(inst,p_approval_request_id,actor_id,p_action,nullif(trim(p_reason),''));
  update public.approval_requests set status=case when p_action='approved' then 'approved' else 'rejected' end,resolved_at=now() where id=p_approval_request_id;
  if p_action='approved' and recommendation='approve' then
    select v.terms into product_terms from public.loan_product_versions v where v.id=version_id and v.institution_id=inst;
    if product_terms is null then raise exception 'approved product terms are unavailable'; end if;
    r:=coalesce((product_terms->>'interest_rate_per_month')::numeric,0)/100;
    if r=0 then payment:=round(proposed/proposed_term,2); else payment:=round(proposed*(r*power(1+r,proposed_term))/(power(1+r,proposed_term)-1),2); end if;
    fee:=round(proposed*coalesce((product_terms->>'processing_fee_percent')::numeric,0)/100,2);
    excise:=round(fee*coalesce((product_terms->>'excise_duty_percent')::numeric,20)/100,2);
    update public.loan_applications set status='approved' where id=app_id and institution_id=inst;
    insert into public.loan_accounts(institution_id,customer_profile_id,application_id,account_number,status,principal_outstanding,interest_outstanding,fee_outstanding)
      select inst,customer_profile_id,id,'LN-'||replace(app_number,'APP-',''),'pending_disbursement',proposed,round(payment*proposed_term-proposed,2),fee+excise from public.loan_applications where id=app_id returning id into loan_id;
    insert into public.loan_contract_snapshots(institution_id,loan_account_id,product_version_id,terms)
      values(inst,loan_id,version_id,jsonb_build_object('principal',proposed,'term_months',proposed_term,'interest_rate_per_month',product_terms->>'interest_rate_per_month','monthly_installment',payment,'processing_fee',fee,'excise_duty',excise,'total_repayable',round(payment*proposed_term+fee+excise,2),'repayment_frequency',coalesce(product_terms->>'repayment_frequency','monthly'),'grace_period_days',coalesce(product_terms->>'grace_period_days','0'),'product_terms',product_terms));
    balance:=proposed;
    for installment_number in 1..proposed_term loop
      interest_part:=round(balance*r,2); principal_part:=case when installment_number=proposed_term then balance else round(payment-interest_part,2) end; balance:=round(balance-principal_part,2);
      insert into public.repayment_installments(institution_id,loan_account_id,installment_number,due_date,principal_due,interest_due,fee_due,status)
        values(inst,loan_id,installment_number,(current_date+(installment_number||' months')::interval)::date,principal_part,interest_part,case when installment_number=1 then fee+excise else 0 end,'pending');
    end loop;
  else
    update public.loan_applications set status='declined' where id=app_id and institution_id=inst;
  end if;
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state)
    values(inst,actor_id,'LOAN_APPLICATION_'||upper(p_action),'loan_application',app_id,jsonb_build_object('approval_request_id',p_approval_request_id,'reason',nullif(trim(p_reason),'')));
end $$;

drop function public.get_staff_application_queue();
create function public.get_staff_application_queue()
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
  left join lateral (select * from public.credit_assessments x where x.application_id=a.id and x.institution_id=a.institution_id and x.status='completed' order by x.created_at desc limit 1) ca on true
  left join lateral (select * from public.application_decisions x where x.application_id=a.id and x.institution_id=a.institution_id order by x.created_at desc limit 1) d on true
  left join lateral public.get_my_loan_quote(a.product_version_id,coalesce(d.proposed_amount,a.requested_amount),coalesce(d.proposed_term_months,a.requested_term_months)) q on true
  left join public.profiles maker on maker.id=d.made_by
  left join public.approval_requests ar on ar.subject_type='application' and ar.subject_id=a.id and ar.institution_id=a.institution_id
  left join public.approval_actions aa on aa.approval_request_id=ar.id and aa.institution_id=ar.institution_id
  left join public.profiles checker on checker.id=aa.checker_profile_id
  where a.institution_id=public.current_institution_id() and public.has_permission('application.read')
  order by a.submitted_at asc;
$$;
revoke all on function public.get_staff_application_queue() from public;
grant execute on function public.get_staff_application_queue() to authenticated;
