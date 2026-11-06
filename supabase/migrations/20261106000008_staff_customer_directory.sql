-- Tenant-scoped staff customer directory, internal notes and borrowing restriction controls.
insert into public.permissions(code,description) values
 ('customer.manage','Manage customer borrowing restrictions and internal notes') on conflict(code) do nothing;
insert into public.role_permissions(role_id,institution_id,permission_code)
select r.id,r.institution_id,x.code from public.roles r cross join (values('customer.read'),('customer.manage'))x(code)
where r.code in ('super_admin','admin','operations_manager','support_officer') on conflict do nothing;

alter table public.customers add column if not exists borrowing_restricted boolean not null default false,
 add column if not exists borrowing_restriction_reason text,
 add column if not exists borrowing_restricted_at timestamptz,
 add column if not exists borrowing_restricted_by uuid references auth.users(id) on delete restrict;

create table if not exists public.customer_internal_notes(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete restrict,
 customer_profile_id uuid not null, author_profile_id uuid not null references auth.users(id) on delete restrict,
 note text not null check(length(trim(note)) between 1 and 4000), created_at timestamptz not null default now(),
 foreign key(customer_profile_id,institution_id) references public.customers(profile_id,institution_id) on delete restrict
);
alter table public.customer_internal_notes enable row level security;

create or replace function public.get_staff_customer_directory()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',c.profile_id,'customer_number',c.customer_number,'full_name',p.full_name,'email',p.email,'phone',coalesce(c.mpesa_phone_number,p.phone_number),
 'national_id','Restricted','kra_pin','Restricted','date_of_birth',c.date_of_birth,'county',c.county,'town',c.town,'residential_address',c.residential_address,
 'employment_status',c.employment_status,'employer_name',c.employer_name,'occupation',c.occupation,'monthly_income',c.monthly_income,'other_income_sources',c.other_income_sources,
 'mpesa_phone_number',c.mpesa_phone_number,'bank_name',c.bank_name,'bank_account_name',c.bank_account_name,'bank_branch_code',c.bank_branch_code,
 'kyc_status',c.kyc_status,'account_status',case when c.borrowing_restricted then 'Restricted' else 'Good standing' end,'restriction_reason',c.borrowing_restriction_reason,
 'available_credit_limit',public.get_customer_credit_limit(c.profile_id),'active_loan_count',(select count(*) from public.loan_accounts l where l.institution_id=c.institution_id and l.customer_profile_id=c.profile_id and l.status='active'),
 'total_loans_settled',(select count(*) from public.loan_accounts l where l.institution_id=c.institution_id and l.customer_profile_id=c.profile_id and l.status='settled'),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'type',d.document_type,'status',d.status,'file_name',split_part(d.object_path,'/',array_length(string_to_array(d.object_path,'/'),1))) order by d.created_at desc) from public.documents d where d.institution_id=c.institution_id and d.customer_profile_id=c.profile_id),'[]'::jsonb),
 'notes',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'author',ap.full_name,'author_role',coalesce((select r.code from public.staff_role_assignments a join public.roles r on r.id=a.role_id where a.staff_profile_id=n.author_profile_id and a.revoked_at is null limit 1),'staff'),'created_at',n.created_at,'note',n.note) order by n.created_at desc) from public.customer_internal_notes n join public.profiles ap on ap.id=n.author_profile_id where n.institution_id=c.institution_id and n.customer_profile_id=c.profile_id),'[]'::jsonb)
 ) order by p.full_name),'[]'::jsonb)
 from public.customers c join public.profiles p on p.id=c.profile_id and p.institution_id=c.institution_id
 where c.institution_id=public.current_institution_id() and public.has_permission('customer.read');
$$;

create or replace function public.add_staff_customer_note(p_customer_profile_id uuid,p_note text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); note_id uuid;
begin
 if not public.has_permission('customer.manage') then raise exception 'permission denied'; end if;
 insert into public.customer_internal_notes(institution_id,customer_profile_id,author_profile_id,note) values(inst,p_customer_profile_id,auth.uid(),trim(p_note)) returning id into note_id;
 insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,auth.uid(),'CUSTOMER_NOTE_ADDED','customer',p_customer_profile_id,jsonb_build_object('note_id',note_id)); return note_id;
end $$;

create or replace function public.set_staff_customer_borrowing_restriction(p_customer_profile_id uuid,p_restricted boolean,p_reason text default '')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id();
begin
 if not public.has_permission('customer.manage') then raise exception 'permission denied'; end if;
 if p_restricted and length(trim(p_reason))<5 then raise exception 'a restriction reason of at least 5 characters is required'; end if;
 update public.customers set borrowing_restricted=p_restricted,borrowing_restriction_reason=case when p_restricted then trim(p_reason) else null end,borrowing_restricted_at=case when p_restricted then now() else null end,borrowing_restricted_by=case when p_restricted then auth.uid() else null end,updated_at=now() where profile_id=p_customer_profile_id and institution_id=inst;
 if not found then raise exception 'customer unavailable'; end if;
 insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,auth.uid(),case when p_restricted then 'CUSTOMER_BORROWING_RESTRICTED' else 'CUSTOMER_BORROWING_REACTIVATED' end,'customer',p_customer_profile_id,jsonb_build_object('reason',nullif(trim(p_reason),'')));
end $$;

revoke all on function public.get_staff_customer_directory(),public.add_staff_customer_note(uuid,text),public.set_staff_customer_borrowing_restriction(uuid,boolean,text) from public;
grant execute on function public.get_staff_customer_directory(),public.add_staff_customer_note(uuid,text),public.set_staff_customer_borrowing_restriction(uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
