create table if not exists public.complaint_evidence (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  complaint_id uuid not null references public.complaints(id) on delete restrict,
  customer_profile_id uuid not null,
  object_path text not null,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check(size_bytes>0),
  sha256 text not null,
  created_at timestamptz not null default now(),
  foreign key(customer_profile_id,institution_id) references public.customers(profile_id,institution_id) on delete restrict,
  unique(institution_id,object_path)
);
alter table public.complaint_evidence enable row level security;
create policy complaint_evidence_read_owner_or_support on public.complaint_evidence for select to authenticated using(customer_profile_id=auth.uid() or (institution_id=public.current_institution_id() and public.has_permission('complaint.read')));

create or replace function public.register_my_complaint_evidence(p_complaint_id uuid,p_object_path text,p_file_name text,p_content_type text,p_size_bytes bigint,p_sha256 text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inst uuid; evidence_id uuid;
begin
  select institution_id into inst from public.customers where profile_id=auth.uid();
  if inst is null or not exists(select 1 from public.complaints where id=p_complaint_id and institution_id=inst and customer_profile_id=auth.uid()) then raise exception 'complaint not found'; end if;
  insert into public.complaint_evidence(institution_id,complaint_id,customer_profile_id,object_path,file_name,content_type,size_bytes,sha256) values(inst,p_complaint_id,auth.uid(),p_object_path,p_file_name,p_content_type,p_size_bytes,p_sha256) returning id into evidence_id;
  insert into public.audit_events(institution_id,actor_profile_id,action,target_type,target_id) values(inst,auth.uid(),'COMPLAINT_EVIDENCE_UPLOADED','complaint',p_complaint_id);
  return evidence_id;
end $$;
revoke all on function public.register_my_complaint_evidence(uuid,text,text,text,bigint,text) from public;
grant execute on function public.register_my_complaint_evidence(uuid,text,text,text,bigint,text) to authenticated;
