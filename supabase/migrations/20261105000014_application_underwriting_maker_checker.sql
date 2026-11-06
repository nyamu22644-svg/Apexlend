-- Production workflow 14: staff underwriting recommendation and maker-checker decision.

insert into public.permissions (code, description) values
  ('application.assess', 'Prepare credit assessments and recommendations'),
  ('application.approve', 'Approve or reject loan application recommendations')
on conflict (code) do nothing;

-- Existing super-admins retain full operational access after new permissions are introduced.
insert into public.role_permissions (role_id, institution_id, permission_code)
select r.id, r.institution_id, p.code
from public.roles r cross join public.permissions p
where r.code = 'super_admin' and p.code in ('application.assess', 'application.approve')
on conflict do nothing;

create or replace function public.get_staff_application_queue()
returns table (
  application_id uuid, application_number text, status text, submitted_at timestamptz,
  customer_profile_id uuid, customer_number text, customer_name text, customer_email text, phone_number text,
  product_name text, requested_amount numeric, requested_term_months integer, product_terms jsonb,
  assessment_score numeric, debt_service_ratio numeric, assessment_findings jsonb,
  maker_decision text, proposed_amount numeric, proposed_term_months integer, rationale text,
  maker_name text, maker_profile_id uuid, recommendation_at timestamptz,
  approval_request_id uuid, approval_status text, checker_name text, checker_action text, checker_reason text, resolved_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id, a.application_number, a.status, a.submitted_at,
    c.profile_id, c.customer_number, p.full_name, p.email, coalesce(c.mpesa_phone_number, p.phone_number),
    lp.name, a.requested_amount, a.requested_term_months, pv.terms,
    ca.score, ca.debt_service_ratio, ca.findings,
    d.decision, d.proposed_amount, d.proposed_term_months, d.rationale,
    maker.full_name, d.made_by, d.created_at,
    ar.id, ar.status, checker.full_name, aa.action, aa.reason, ar.resolved_at
  from public.loan_applications a
  join public.customers c on c.profile_id = a.customer_profile_id and c.institution_id = a.institution_id
  join public.profiles p on p.id = c.profile_id and p.institution_id = c.institution_id
  join public.loan_product_versions pv on pv.id = a.product_version_id and pv.institution_id = a.institution_id
  join public.loan_products lp on lp.id = pv.product_id and lp.institution_id = pv.institution_id
  left join lateral (select * from public.credit_assessments x where x.application_id = a.id and x.institution_id = a.institution_id and x.status = 'completed' order by x.created_at desc limit 1) ca on true
  left join lateral (select * from public.application_decisions x where x.application_id = a.id and x.institution_id = a.institution_id order by x.created_at desc limit 1) d on true
  left join public.profiles maker on maker.id = d.made_by
  left join public.approval_requests ar on ar.subject_type = 'application' and ar.subject_id = a.id and ar.institution_id = a.institution_id
  left join public.approval_actions aa on aa.approval_request_id = ar.id and aa.institution_id = ar.institution_id
  left join public.profiles checker on checker.id = aa.checker_profile_id
  where a.institution_id = public.current_institution_id()
    and public.has_permission('application.read')
  order by a.submitted_at asc;
$$;

create or replace function public.recommend_loan_application(
  p_application_id uuid, p_score numeric, p_debt_service_ratio numeric, p_findings jsonb,
  p_decision text, p_proposed_amount numeric, p_proposed_term_months integer, p_rationale text, p_idempotency_key uuid
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor_id uuid := auth.uid(); inst uuid; requested numeric; app_status text; request_id uuid;
begin
  if actor_id is null or not public.has_permission('application.assess') then raise exception 'permission denied'; end if;
  if p_decision not in ('approve', 'decline', 'request_information') then raise exception 'invalid recommendation'; end if;
  if length(trim(coalesce(p_rationale, ''))) < 5 then raise exception 'a rationale of at least 5 characters is required'; end if;
  select institution_id, requested_amount, status into inst, requested, app_status from public.loan_applications
    where id = p_application_id for update;
  if inst is null or inst <> public.current_institution_id() then raise exception 'application is unavailable'; end if;
  if app_status not in ('submitted', 'under_review', 'information_requested') then raise exception 'application is not available for underwriting'; end if;
  if exists (select 1 from public.approval_requests where institution_id = inst and subject_type = 'application' and subject_id = p_application_id) then raise exception 'a recommendation has already been submitted for checking'; end if;
  if p_decision = 'approve' and (p_proposed_amount is null or p_proposed_amount <= 0 or p_proposed_amount > requested or p_proposed_term_months is null or p_proposed_term_months <= 0) then raise exception 'proposed terms are invalid'; end if;
  insert into public.credit_assessments (institution_id, application_id, assessed_by, status, score, debt_service_ratio, findings)
    values (inst, p_application_id, actor_id, 'completed', p_score, p_debt_service_ratio, coalesce(p_findings, '{}'::jsonb));
  insert into public.application_decisions (institution_id, application_id, decision, proposed_amount, proposed_term_months, rationale, made_by)
    values (inst, p_application_id, p_decision, p_proposed_amount, p_proposed_term_months, trim(p_rationale), actor_id);
  if p_decision = 'request_information' then
    update public.loan_applications set status = 'information_requested' where id = p_application_id and institution_id = inst;
    insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id, after_state)
      values (inst, actor_id, 'LOAN_APPLICATION_INFORMATION_REQUESTED', 'loan_application', p_application_id, jsonb_build_object('rationale', trim(p_rationale)));
    return null;
  end if;
  insert into public.approval_requests (institution_id, subject_type, subject_id, maker_profile_id, required_permission, amount, idempotency_key)
    values (inst, 'application', p_application_id, actor_id, 'application.approve', coalesce(p_proposed_amount, 0), p_idempotency_key)
    returning id into request_id;
  update public.loan_applications set status = 'under_review' where id = p_application_id and institution_id = inst;
  insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id, after_state)
    values (inst, actor_id, 'LOAN_APPLICATION_RECOMMENDED', 'loan_application', p_application_id, jsonb_build_object('decision', p_decision, 'approval_request_id', request_id));
  return request_id;
end;
$$;

create or replace function public.resolve_loan_application_approval(p_approval_request_id uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor_id uuid := auth.uid(); inst uuid; app_id uuid; maker_id uuid; amount numeric; request_status text; recommendation text; proposed numeric; app_number text;
begin
  if p_action not in ('approved', 'rejected') then raise exception 'invalid approval action'; end if;
  select institution_id, subject_id, maker_profile_id, amount, status into inst, app_id, maker_id, amount, request_status
    from public.approval_requests where id = p_approval_request_id and subject_type = 'application' for update;
  if inst is null or inst <> public.current_institution_id() then raise exception 'approval request is unavailable'; end if;
  if request_status <> 'pending' then raise exception 'approval request is already resolved'; end if;
  if actor_id is null or actor_id = maker_id then raise exception 'maker cannot approve or reject their own recommendation'; end if;
  if not public.has_permission('application.approve') then raise exception 'permission denied'; end if;
  if not exists (select 1 from public.staff_members where profile_id = actor_id and institution_id = inst and is_active and approval_limit >= amount) then raise exception 'approval limit exceeded'; end if;
  if p_action = 'rejected' and length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'a rejection reason of at least 5 characters is required'; end if;
  select decision, proposed_amount into recommendation, proposed from public.application_decisions where application_id = app_id and institution_id = inst order by created_at desc limit 1;
  insert into public.approval_actions (institution_id, approval_request_id, checker_profile_id, action, reason)
    values (inst, p_approval_request_id, actor_id, p_action, nullif(trim(p_reason), ''));
  update public.approval_requests set status = case when p_action = 'approved' then 'approved' else 'rejected' end, resolved_at = now() where id = p_approval_request_id;
  if p_action = 'approved' and recommendation = 'approve' then
    update public.loan_applications set status = 'approved' where id = app_id and institution_id = inst;
    select application_number into app_number from public.loan_applications where id = app_id;
    insert into public.loan_accounts (institution_id, customer_profile_id, application_id, account_number, status, principal_outstanding)
      select inst, customer_profile_id, id, 'LN-' || replace(app_number, 'APP-', ''), 'pending_disbursement', proposed from public.loan_applications where id = app_id;
  else
    update public.loan_applications set status = 'declined' where id = app_id and institution_id = inst;
  end if;
  insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id, after_state)
    values (inst, actor_id, 'LOAN_APPLICATION_' || upper(p_action), 'loan_application', app_id, jsonb_build_object('approval_request_id', p_approval_request_id, 'reason', nullif(trim(p_reason), '')));
end;
$$;

revoke all on function public.get_staff_application_queue() from public;
revoke all on function public.recommend_loan_application(uuid, numeric, numeric, jsonb, text, numeric, integer, text, uuid) from public;
revoke all on function public.resolve_loan_application_approval(uuid, text, text) from public;
grant execute on function public.get_staff_application_queue() to authenticated;
grant execute on function public.recommend_loan_application(uuid, numeric, numeric, jsonb, text, numeric, integer, text, uuid) to authenticated;
grant execute on function public.resolve_loan_application_approval(uuid, text, text) to authenticated;
