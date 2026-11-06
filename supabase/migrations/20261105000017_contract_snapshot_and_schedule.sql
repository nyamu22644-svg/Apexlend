-- Create immutable approved-loan terms and an amortized repayment schedule before disbursement.
create or replace function public.get_my_loan_quote(p_product_version_id uuid, p_amount numeric, p_term_months integer)
returns table (monthly_installment numeric, total_interest numeric, processing_fee numeric, excise_duty numeric, total_fees numeric, total_repayable numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare t jsonb; r numeric; payment numeric; interest numeric; fee numeric; excise numeric;
begin
  select terms into t from public.loan_product_versions where id=p_product_version_id and status='active' and institution_id=public.current_institution_id();
  if t is null then raise exception 'loan product is unavailable'; end if;
  if p_amount < (t->>'min_amount')::numeric or p_amount > (t->>'max_amount')::numeric or p_term_months < (t->>'min_term_months')::integer or p_term_months > (t->>'max_term_months')::integer then raise exception 'requested amount or term is outside product limits'; end if;
  r:=coalesce((t->>'interest_rate_per_month')::numeric,0)/100;
  if r=0 then payment:=p_amount/p_term_months; else payment:=p_amount*(r*power(1+r,p_term_months))/(power(1+r,p_term_months)-1); end if;
  interest:=round(payment*p_term_months-p_amount,2); payment:=round(payment,2); fee:=round(p_amount*coalesce((t->>'processing_fee_percent')::numeric,0)/100,2); excise:=round(fee*coalesce((t->>'excise_duty_percent')::numeric,20)/100,2);
  return query select payment,interest,fee,excise,fee+excise,round(p_amount+interest+fee+excise,2);
end; $$;

create or replace function public.resolve_loan_application_approval(p_approval_request_id uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor_id uuid:=auth.uid(); inst uuid; app_id uuid; maker_id uuid; approved_amount numeric; request_status text; recommendation text; proposed numeric; proposed_term integer; app_number text; loan_id uuid; version_id uuid; terms jsonb; r numeric; payment numeric; balance numeric; i integer; interest_part numeric; principal_part numeric; fee numeric; excise numeric;
begin
  if p_action not in ('approved','rejected') then raise exception 'invalid approval action'; end if;
  select institution_id,subject_id,maker_profile_id,amount,status into inst,app_id,maker_id,approved_amount,request_status from public.approval_requests where id=p_approval_request_id and subject_type='application' for update;
  if inst is null or inst<>public.current_institution_id() then raise exception 'approval request is unavailable'; end if;
  if request_status<>'pending' then raise exception 'approval request is already resolved'; end if;
  if actor_id is null or actor_id=maker_id then raise exception 'maker cannot approve or reject their own recommendation'; end if;
  if not public.has_permission('application.approve') then raise exception 'permission denied'; end if;
  if not exists(select 1 from public.staff_members where profile_id=actor_id and institution_id=inst and is_active and approval_limit>=approved_amount) then raise exception 'approval limit exceeded'; end if;
  if p_action='rejected' and length(trim(coalesce(p_reason,'')))<5 then raise exception 'a rejection reason of at least 5 characters is required'; end if;
  select d.decision,d.proposed_amount,d.proposed_term_months,a.application_number,a.product_version_id into recommendation,proposed,proposed_term,app_number,version_id from public.application_decisions d join public.loan_applications a on a.id=d.application_id and a.institution_id=d.institution_id where d.application_id=app_id and d.institution_id=inst order by d.created_at desc limit 1;
  insert into public.approval_actions(institution_id,approval_request_id,checker_profile_id,action,reason) values(inst,p_approval_request_id,actor_id,p_action,nullif(trim(p_reason),''));
  update public.approval_requests set status=case when p_action='approved' then 'approved' else 'rejected' end,resolved_at=now() where id=p_approval_request_id;
  if p_action='approved' and recommendation='approve' then
    select terms into terms from public.loan_product_versions where id=version_id and institution_id=inst;
    r:=coalesce((terms->>'interest_rate_per_month')::numeric,0)/100;
    if r=0 then payment:=round(proposed/proposed_term,2); else payment:=round(proposed*(r*power(1+r,proposed_term))/(power(1+r,proposed_term)-1),2); end if;
    fee:=round(proposed*coalesce((terms->>'processing_fee_percent')::numeric,0)/100,2); excise:=round(fee*coalesce((terms->>'excise_duty_percent')::numeric,20)/100,2);
    update public.loan_applications set status='approved' where id=app_id and institution_id=inst;
    insert into public.loan_accounts(institution_id,customer_profile_id,application_id,account_number,status,principal_outstanding,interest_outstanding,fee_outstanding) select inst,customer_profile_id,id,'LN-'||replace(app_number,'APP-',''),'pending_disbursement',proposed,round(payment*proposed_term-proposed,2),fee+excise from public.loan_applications where id=app_id returning id into loan_id;
    insert into public.loan_contract_snapshots(institution_id,loan_account_id,product_version_id,terms) values(inst,loan_id,version_id,jsonb_build_object('principal',proposed,'term_months',proposed_term,'interest_rate_per_month',terms->>'interest_rate_per_month','monthly_installment',payment,'processing_fee',fee,'excise_duty',excise,'total_repayable',round(payment*proposed_term+fee+excise,2),'repayment_frequency',coalesce(terms->>'repayment_frequency','monthly'),'grace_period_days',coalesce(terms->>'grace_period_days','0'),'product_terms',terms));
    balance:=proposed;
    for i in 1..proposed_term loop
      interest_part:=round(balance*r,2); principal_part:=case when i=proposed_term then balance else round(payment-interest_part,2) end; balance:=round(balance-principal_part,2);
      insert into public.repayment_installments(institution_id,loan_account_id,installment_number,due_date,principal_due,interest_due,fee_due,status) values(inst,loan_id,i,(current_date+(i||' months')::interval)::date,principal_part,interest_part,case when i=1 then fee+excise else 0 end,'pending');
    end loop;
  else update public.loan_applications set status='declined' where id=app_id and institution_id=inst; end if;
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,actor_id,'LOAN_APPLICATION_'||upper(p_action),'loan_application',app_id,jsonb_build_object('approval_request_id',p_approval_request_id,'reason',nullif(trim(p_reason),'')));
end; $$;
