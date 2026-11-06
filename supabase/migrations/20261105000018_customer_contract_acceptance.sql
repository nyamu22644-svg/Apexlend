-- Customer acceptance is required before a pending-disbursement loan can be released.
create or replace function public.accept_my_loan_contract(p_loan_account_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare inst uuid; accepted boolean;
begin
  select l.institution_id, c.accepted_at is not null into inst, accepted
  from public.loan_accounts l join public.loan_contract_snapshots c on c.loan_account_id=l.id and c.institution_id=l.institution_id
  where l.id=p_loan_account_id and l.customer_profile_id=auth.uid() and l.status='pending_disbursement' for update;
  if inst is null or inst<>public.current_institution_id() then raise exception 'loan contract is unavailable'; end if;
  if accepted then raise exception 'loan contract has already been accepted'; end if;
  update public.loan_contract_snapshots set accepted_at=now() where loan_account_id=p_loan_account_id and institution_id=inst;
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,auth.uid(),'LOAN_CONTRACT_ACCEPTED','loan_account',p_loan_account_id,jsonb_build_object('accepted_at',now()));
end; $$;

create or replace function public.get_my_pending_contracts()
returns table (loan_account_id uuid, account_number text, product_name text, terms jsonb, accepted_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select l.id,l.account_number,p.name,c.terms,c.accepted_at from public.loan_accounts l
  join public.loan_contract_snapshots c on c.loan_account_id=l.id and c.institution_id=l.institution_id
  join public.loan_product_versions v on v.id=c.product_version_id and v.institution_id=c.institution_id
  join public.loan_products p on p.id=v.product_id and p.institution_id=v.institution_id
  where l.customer_profile_id=auth.uid() and l.institution_id=public.current_institution_id() and l.status='pending_disbursement';
$$;
revoke all on function public.accept_my_loan_contract(uuid) from public;
revoke all on function public.get_my_pending_contracts() from public;
grant execute on function public.accept_my_loan_contract(uuid) to authenticated;
grant execute on function public.get_my_pending_contracts() to authenticated;
