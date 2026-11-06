-- Production foundation 1/4: identity, tenancy, access control and customer records.
-- Do not apply to an existing project containing the legacy draft schema. Use a disposable
-- development project until the complete migration chain and adversarial test suite are approved.

create extension if not exists pgcrypto;

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  legal_name text not null,
  trade_name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'inactive')),
  is_default boolean not null default false,
  currency_code char(3) not null default 'KES',
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index institutions_one_default on public.institutions (is_default) where is_default;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  user_type text not null check (user_type in ('customer', 'staff')),
  email text not null,
  full_name text not null,
  phone_number text,
  status text not null default 'active' check (status in ('pending', 'active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  unique (institution_id, email)
);

create table public.staff_members (
  profile_id uuid primary key,
  institution_id uuid not null,
  employee_number text not null,
  department text,
  job_title text,
  approval_limit numeric(18,2) not null default 0 check (approval_limit >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (profile_id, institution_id) references public.profiles(id, institution_id) on delete restrict,
  unique (profile_id, institution_id),
  unique (institution_id, employee_number)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  code text not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, institution_id),
  unique (institution_id, code)
);

create table public.permissions (
  code text primary key,
  description text not null
);

create table public.role_permissions (
  role_id uuid not null,
  institution_id uuid not null,
  permission_code text not null references public.permissions(code) on delete restrict,
  primary key (role_id, permission_code),
  foreign key (role_id, institution_id) references public.roles(id, institution_id) on delete cascade
);

create table public.staff_role_assignments (
  staff_profile_id uuid not null,
  role_id uuid not null,
  institution_id uuid not null,
  assigned_by uuid references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (staff_profile_id, role_id),
  foreign key (staff_profile_id, institution_id) references public.staff_members(profile_id, institution_id) on delete cascade,
  foreign key (role_id, institution_id) references public.roles(id, institution_id) on delete restrict
);

create table public.staff_permission_overrides (
  staff_profile_id uuid not null,
  institution_id uuid not null,
  permission_code text not null references public.permissions(code) on delete restrict,
  effect text not null check (effect in ('allow', 'deny')),
  granted_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (staff_profile_id, permission_code),
  foreign key (staff_profile_id, institution_id) references public.staff_members(profile_id, institution_id) on delete cascade
);

create table public.customers (
  profile_id uuid primary key,
  institution_id uuid not null,
  customer_number text not null,
  national_id_ciphertext text,
  national_id_hash text,
  kra_pin_ciphertext text,
  date_of_birth date,
  residential_address text,
  county text,
  town text,
  employment_status text,
  employer_name text,
  monthly_income numeric(18,2),
  mpesa_phone_number text,
  kyc_status text not null default 'pending' check (kyc_status in ('pending', 'under_review', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, institution_id) references public.profiles(id, institution_id) on delete restrict,
  unique (profile_id, institution_id),
  unique (institution_id, customer_number),
  unique (institution_id, national_id_hash)
);

create table public.kyc_cases (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  customer_profile_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'under_review', 'verified', 'rejected')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (customer_profile_id, institution_id) references public.customers(profile_id, institution_id) on delete restrict,
  unique (id, institution_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  customer_profile_id uuid not null,
  kyc_case_id uuid,
  bucket_id text not null check (bucket_id in ('kyc-documents', 'application-documents', 'statements', 'institution-assets')),
  object_path text not null,
  document_type text not null,
  sha256 text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  status text not null default 'uploaded' check (status in ('uploaded', 'verified', 'rejected', 'superseded')),
  created_at timestamptz not null default now(),
  foreign key (customer_profile_id, institution_id) references public.customers(profile_id, institution_id) on delete restrict,
  foreign key (kyc_case_id, institution_id) references public.kyc_cases(id, institution_id) on delete restrict,
  unique (institution_id, bucket_id, object_path),
  unique (id, institution_id)
);

create table public.kyc_verification_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  kyc_case_id uuid not null,
  document_id uuid,
  status text not null check (status in ('submitted', 'under_review', 'verified', 'rejected')),
  notes text,
  actor_profile_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (kyc_case_id, institution_id) references public.kyc_cases(id, institution_id) on delete restrict,
  foreign key (document_id, institution_id) references public.documents(id, institution_id) on delete restrict
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  actor_profile_id uuid references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  request_id uuid,
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz not null default now()
);

create index idx_profiles_institution_type on public.profiles (institution_id, user_type, status);
create index idx_customers_institution_kyc on public.customers (institution_id, kyc_status);
create index idx_kyc_cases_customer on public.kyc_cases (institution_id, customer_profile_id, status);
create index idx_documents_customer on public.documents (institution_id, customer_profile_id, created_at desc);
create index idx_audit_events_institution_time on public.audit_events (institution_id, occurred_at desc);

-- Public signup can create customers only. Staff accounts are provisioned by a trusted
-- administrative operation after the identity exists; user metadata can never create staff access.
create or replace function public.provision_customer_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare default_institution uuid; resolved_name text; resolved_phone text;
begin
  select id into default_institution from public.institutions where is_default and status = 'active';
  if default_institution is null then
    raise exception 'no active default institution is configured';
  end if;
  resolved_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Customer');
  resolved_phone := nullif(new.raw_user_meta_data ->> 'phone', '');
  insert into public.profiles (id, institution_id, user_type, email, full_name, phone_number, status)
  values (new.id, default_institution, 'customer', coalesce(new.email, new.id::text), resolved_name, resolved_phone, 'active');
  insert into public.customers (profile_id, institution_id, customer_number, mpesa_phone_number)
  values (new.id, default_institution, 'CUST-' || upper(substr(replace(new.id::text, '-', ''), 1, 12)), resolved_phone);
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.provision_customer_profile();

create or replace function public.current_institution_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.institution_id from public.profiles p where p.id = auth.uid() and p.status = 'active'
$$;

create or replace function public.has_permission(required_permission text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare actor_id uuid := auth.uid(); actor_institution uuid;
begin
  select institution_id into actor_institution from public.staff_members
  where profile_id = actor_id and is_active;
  if actor_institution is null then return false; end if;
  if exists (select 1 from public.staff_permission_overrides o where o.staff_profile_id = actor_id and o.institution_id = actor_institution and o.permission_code = required_permission and o.effect = 'deny') then return false; end if;
  if exists (select 1 from public.staff_permission_overrides o where o.staff_profile_id = actor_id and o.institution_id = actor_institution and o.permission_code = required_permission and o.effect = 'allow') then return true; end if;
  return exists (
    select 1 from public.staff_role_assignments a join public.role_permissions rp on rp.role_id = a.role_id and rp.institution_id = a.institution_id
    where a.staff_profile_id = actor_id and a.institution_id = actor_institution and a.revoked_at is null and rp.permission_code = required_permission
  );
end $$;

revoke all on function public.current_institution_id() from public;
revoke all on function public.has_permission(text) from public;
grant execute on function public.current_institution_id() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_members enable row level security;
alter table public.customers enable row level security;
alter table public.kyc_cases enable row level security;
alter table public.documents enable row level security;
alter table public.kyc_verification_events enable row level security;
alter table public.audit_events enable row level security;

create policy institutions_read_members on public.institutions for select to authenticated using (id = public.current_institution_id());
create policy profiles_read_self_or_permitted_staff on public.profiles for select to authenticated using (id = auth.uid() or (institution_id = public.current_institution_id() and public.has_permission('customer.read')));
create policy customers_read_self_or_permitted_staff on public.customers for select to authenticated using (profile_id = auth.uid() or (institution_id = public.current_institution_id() and public.has_permission('customer.read')));
create policy customers_update_self_limited on public.customers for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid() and institution_id = public.current_institution_id());
create policy kyc_read_self_or_permitted_staff on public.kyc_cases for select to authenticated using (customer_profile_id = auth.uid() or (institution_id = public.current_institution_id() and public.has_permission('kyc.read')));
create policy documents_read_self_or_permitted_staff on public.documents for select to authenticated using (customer_profile_id = auth.uid() or (institution_id = public.current_institution_id() and public.has_permission('document.read_sensitive')));

-- No browser-facing insert/update/delete policy is granted for staff access, audit, or KYC decisions.
-- Those mutations are exposed only through later trusted RPC/server functions.
