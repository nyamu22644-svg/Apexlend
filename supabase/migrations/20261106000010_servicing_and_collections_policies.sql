-- Institution-owned servicing and collections policy. Values are configurable database policy,
-- never UI constants. Financial execution requires a later approved maker-checker workflow.
create table if not exists public.loan_servicing_policies(
 institution_id uuid primary key references public.institutions(id) on delete restrict,
 minimum_restructure_term_months integer not null default 1 check(minimum_restructure_term_months>0), maximum_restructure_term_months integer not null default 60 check(maximum_restructure_term_months>=minimum_restructure_term_months),
 restructure_requires_maker_checker boolean not null default true, write_off_requires_maker_checker boolean not null default true,
 settlement_quote_validity_days integer not null default 5 check(settlement_quote_validity_days between 1 and 90),
 settlement_rebate_method text not null default 'policy_required' check(settlement_rebate_method in ('policy_required','none')),
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.loan_servicing_policies(institution_id) select id from public.institutions on conflict do nothing;
alter table public.loan_servicing_policies enable row level security;
insert into public.permissions(code,description) values('collections.read','Read collections workspace'),('collections.manage','Log collection follow-ups and assignments'),('servicing.manage','Configure loan servicing policy') on conflict(code) do nothing;
insert into public.role_permissions(role_id,institution_id,permission_code) select r.id,r.institution_id,x.code from public.roles r cross join(values('collections.read'),('collections.manage'),('servicing.manage'))x(code) where r.code in ('super_admin','admin','operations_manager','collections_agent') on conflict do nothing;

create or replace function public.get_staff_collections_workspace()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('cases',coalesce((select jsonb_agg(jsonb_build_object('id',coalesce(cc.id,l.id),'loan_id',l.id,'loan_number',l.account_number,'customer_name',p.full_name,'phone',coalesce(c.mpesa_phone_number,p.phone_number),'overdue_arrears',o.overdue_amount,'days_past_due',o.days_past_due,'ageing_bucket',case when o.days_past_due<=30 then 'PAR 1-30' when o.days_past_due<=60 then 'PAR 31-60' when o.days_past_due<=90 then 'PAR 61-90' else 'PAR 90+' end,'assigned_officer',coalesce(ap.full_name,'Unassigned'),'last_contact_date',(select max(ci.occurred_at) from public.collection_interactions ci where ci.collection_case_id=cc.id),'next_follow_up_date',null,'status',coalesce(cc.status,'open')) order by o.days_past_due desc) from public.loan_accounts l join public.customers c on c.profile_id=l.customer_profile_id and c.institution_id=l.institution_id join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id join lateral(select coalesce(sum(i.principal_due+i.interest_due+i.fee_due+i.penalty_due-i.principal_paid-i.interest_paid-i.fee_paid-i.penalty_paid),0) overdue_amount,greatest(0,current_date-min(i.due_date)) days_past_due from public.repayment_installments i where i.loan_account_id=l.id and i.institution_id=l.institution_id and i.due_date<current_date and i.status not in ('paid','waived'))o on o.overdue_amount>0 left join public.collection_cases cc on cc.loan_account_id=l.id and cc.institution_id=l.institution_id and cc.status in ('open','paused') left join public.profiles ap on ap.id=cc.assigned_staff_profile_id where l.institution_id=public.current_institution_id()),'[]'::jsonb)) where public.has_permission('collections.read');
$$;
revoke all on function public.get_staff_collections_workspace() from public; grant execute on function public.get_staff_collections_workspace() to authenticated;
