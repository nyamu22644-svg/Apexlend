insert into public.permissions(code,description) values ('disbursement.create','Prepare approved loans for disbursement') on conflict(code) do nothing;
insert into public.role_permissions(role_id,institution_id,permission_code) select id,institution_id,'disbursement.create' from public.roles where code='super_admin' on conflict do nothing;

create or replace function public.get_staff_disbursement_queue()
returns table(disbursement_id uuid,loan_account_id uuid,account_number text,customer_name text,destination_phone text,amount numeric,status text,contract_accepted_at timestamptz,maker_name text,checker_name text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select d.id,l.id,l.account_number,p.full_name,d.destination_phone,d.amount,d.status,c.accepted_at,m.full_name,ch.full_name,d.created_at from public.disbursement_requests d join public.loan_accounts l on l.id=d.loan_account_id and l.institution_id=d.institution_id join public.loan_contract_snapshots c on c.loan_account_id=l.id and c.institution_id=l.institution_id join public.customers cu on cu.profile_id=l.customer_profile_id and cu.institution_id=l.institution_id join public.profiles p on p.id=cu.profile_id and p.institution_id=cu.institution_id left join public.approval_requests ar on ar.id=d.approval_request_id left join public.profiles m on m.id=ar.maker_profile_id left join public.approval_actions aa on aa.approval_request_id=ar.id left join public.profiles ch on ch.id=aa.checker_profile_id where d.institution_id=public.current_institution_id() and (public.has_permission('disbursement.create') or public.has_permission('disbursement.approve')) order by d.created_at;
$$;
create or replace function public.create_disbursement_request(p_loan_account_id uuid,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); actor uuid:=auth.uid(); amount numeric; phone text; request_id uuid; existing uuid;
begin
 if not public.has_permission('disbursement.create') then raise exception 'permission denied'; end if;
 select l.principal_outstanding,coalesce(c.mpesa_phone_number,p.phone_number) into amount,phone from public.loan_accounts l join public.customers c on c.profile_id=l.customer_profile_id and c.institution_id=l.institution_id join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id join public.loan_contract_snapshots s on s.loan_account_id=l.id and s.institution_id=l.institution_id where l.id=p_loan_account_id and l.institution_id=inst and l.status='pending_disbursement' and s.accepted_at is not null for update;
 if amount is null or phone is null then raise exception 'accepted pending-disbursement loan with M-Pesa phone is required'; end if;
 select id into existing from public.disbursement_requests where loan_account_id=p_loan_account_id; if existing is not null then return existing; end if;
 insert into public.approval_requests(institution_id,subject_type,subject_id,maker_profile_id,required_permission,amount,idempotency_key) values(inst,'disbursement',p_loan_account_id,actor,'disbursement.approve',amount,p_idempotency_key) returning id into request_id;
 insert into public.disbursement_requests(institution_id,loan_account_id,approval_request_id,amount,destination_phone,status,idempotency_key) values(inst,p_loan_account_id,request_id,amount,phone,'pending_approval',p_idempotency_key) returning id into existing;
 insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id) values(inst,actor,'DISBURSEMENT_PREPARED','disbursement_request',existing); return existing;
end $$;
create or replace function public.approve_disbursement_request(p_disbursement_id uuid,p_action text,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); actor uuid:=auth.uid(); maker uuid; amount numeric; approval_id uuid;
begin
 if p_action not in ('approved','rejected') or (p_action='rejected' and length(trim(p_reason))<5) then raise exception 'valid decision required'; end if;
 select ar.maker_profile_id,d.amount,d.approval_request_id into maker,amount,approval_id from public.disbursement_requests d join public.approval_requests ar on ar.id=d.approval_request_id where d.id=p_disbursement_id and d.institution_id=inst and d.status='pending_approval' and ar.status='pending' for update;
 if maker is null or maker=actor or not public.has_permission('disbursement.approve') or not exists(select 1 from public.staff_members where profile_id=actor and institution_id=inst and is_active and approval_limit>=amount) then raise exception 'permission, separation, or approval limit denied'; end if;
 insert into public.approval_actions(institution_id,approval_request_id,checker_profile_id,action,reason) values(inst,approval_id,actor,p_action,nullif(trim(p_reason),'')); update public.approval_requests set status=p_action,resolved_at=now() where id=approval_id; update public.disbursement_requests set status=case when p_action='approved' then 'approved' else 'cancelled' end where id=p_disbursement_id; insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id) values(inst,actor,'DISBURSEMENT_'||upper(p_action),'disbursement_request',p_disbursement_id);
end $$;
revoke all on function public.get_staff_disbursement_queue() from public; grant execute on function public.get_staff_disbursement_queue() to authenticated;
revoke all on function public.create_disbursement_request(uuid,uuid) from public; grant execute on function public.create_disbursement_request(uuid,uuid) to authenticated;
revoke all on function public.approve_disbursement_request(uuid,text,text) from public; grant execute on function public.approve_disbursement_request(uuid,text,text) to authenticated;
