create table if not exists public.promise_to_pay(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null, collection_case_id uuid not null,
 amount numeric(18,2) not null check(amount>0), promised_for date not null, status text not null default 'open' check(status in ('open','kept','broken','cancelled')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(collection_case_id,institution_id) references public.collection_cases(id,institution_id) on delete restrict
);
alter table public.promise_to_pay enable row level security;

create or replace function public.log_staff_collection_followup(p_loan_account_id uuid,p_channel text,p_outcome text,p_notes text,p_promise_amount numeric default null,p_promise_date date default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid:=public.current_institution_id(); case_id uuid;
begin
 if not public.has_permission('collections.manage') then raise exception 'permission denied'; end if;
 if length(trim(p_notes))<3 or length(trim(p_channel))<2 or length(trim(p_outcome))<2 then raise exception 'contact details are required'; end if;
 select id into case_id from public.collection_cases where institution_id=inst and loan_account_id=p_loan_account_id and status in ('open','paused') order by opened_at desc limit 1 for update;
 if case_id is null then insert into public.collection_cases(institution_id,loan_account_id,assigned_staff_profile_id,status) values(inst,p_loan_account_id,auth.uid(),'open') returning id into case_id; end if;
 insert into public.collection_interactions(institution_id,collection_case_id,actor_profile_id,interaction_type,notes) values(inst,case_id,auth.uid(),trim(p_channel)||' · '||trim(p_outcome)||' · '||trim(p_notes));
 if p_promise_amount is not null or p_promise_date is not null then
   if p_promise_amount is null or p_promise_amount<=0 or p_promise_date is null or p_promise_date<current_date then raise exception 'a valid future promise amount and date are required'; end if;
   insert into public.promise_to_pay(institution_id,collection_case_id,amount,promised_for,created_by) values(inst,case_id,p_promise_amount,p_promise_date,auth.uid());
 end if;
 insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id,after_state) values(inst,auth.uid(),'COLLECTION_FOLLOWUP_LOGGED','collection_case',case_id,jsonb_build_object('outcome',p_outcome));
end $$;

revoke all on function public.log_staff_collection_followup(uuid,text,text,text,numeric,date) from public;
grant execute on function public.log_staff_collection_followup(uuid,text,text,text,numeric,date) to authenticated;
