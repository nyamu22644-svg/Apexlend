-- Production foundation 2/4: products, underwriting, approvals and loan servicing.

create table public.loan_products (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  unique (id, institution_id), unique (institution_id, code)
);

create table public.loan_product_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  product_id uuid not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  effective_from timestamptz,
  effective_to timestamptz,
  terms jsonb not null,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (product_id, institution_id) references public.loan_products(id, institution_id) on delete restrict,
  unique (id, institution_id), unique (product_id, version_number),
  check (effective_to is null or effective_from is null or effective_to > effective_from)
);

create table public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  customer_profile_id uuid not null,
  product_version_id uuid not null,
  application_number text not null,
  requested_amount numeric(18,2) not null check (requested_amount > 0),
  requested_term_months integer not null check (requested_term_months > 0),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'under_review', 'information_requested', 'approved', 'declined', 'cancelled', 'expired')),
  idempotency_key uuid not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (customer_profile_id, institution_id) references public.customers(profile_id, institution_id) on delete restrict,
  foreign key (product_version_id, institution_id) references public.loan_product_versions(id, institution_id) on delete restrict,
  unique (id, institution_id), unique (institution_id, application_number), unique (institution_id, idempotency_key)
);

create table public.credit_assessments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  application_id uuid not null,
  assessed_by uuid not null references auth.users(id) on delete restrict,
  status text not null check (status in ('draft', 'completed', 'superseded')),
  score numeric(9,4),
  debt_service_ratio numeric(9,4),
  findings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (application_id, institution_id) references public.loan_applications(id, institution_id) on delete restrict,
  unique (id, institution_id)
);

create table public.application_decisions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  application_id uuid not null,
  decision text not null check (decision in ('approve', 'decline', 'request_information')),
  proposed_amount numeric(18,2),
  proposed_term_months integer,
  rationale text,
  made_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (application_id, institution_id) references public.loan_applications(id, institution_id) on delete restrict,
  unique (id, institution_id)
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  subject_type text not null check (subject_type in ('application', 'disbursement', 'restructure', 'write_off', 'fee_waiver')),
  subject_id uuid not null,
  maker_profile_id uuid not null references auth.users(id) on delete restrict,
  required_permission text not null references public.permissions(code) on delete restrict,
  amount numeric(18,2) not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'executed')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (id, institution_id), unique (institution_id, subject_type, subject_id), unique (institution_id, idempotency_key)
);

create table public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  approval_request_id uuid not null,
  checker_profile_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now(),
  foreign key (approval_request_id, institution_id) references public.approval_requests(id, institution_id) on delete restrict,
  unique (approval_request_id)
);

create table public.loan_accounts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  customer_profile_id uuid not null,
  application_id uuid not null,
  account_number text not null,
  status text not null check (status in ('pending_disbursement', 'active', 'settled', 'written_off', 'closed')),
  principal_outstanding numeric(18,2) not null check (principal_outstanding >= 0),
  interest_outstanding numeric(18,2) not null default 0 check (interest_outstanding >= 0),
  fee_outstanding numeric(18,2) not null default 0 check (fee_outstanding >= 0),
  penalty_outstanding numeric(18,2) not null default 0 check (penalty_outstanding >= 0),
  currency_code char(3) not null default 'KES',
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (customer_profile_id, institution_id) references public.customers(profile_id, institution_id) on delete restrict,
  foreign key (application_id, institution_id) references public.loan_applications(id, institution_id) on delete restrict,
  unique (id, institution_id), unique (institution_id, account_number), unique (application_id)
);

create table public.loan_contract_snapshots (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  loan_account_id uuid not null,
  product_version_id uuid not null,
  terms jsonb not null,
  agreement_document_id uuid,
  agreement_sha256 text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (loan_account_id, institution_id) references public.loan_accounts(id, institution_id) on delete restrict,
  foreign key (product_version_id, institution_id) references public.loan_product_versions(id, institution_id) on delete restrict,
  foreign key (agreement_document_id, institution_id) references public.documents(id, institution_id) on delete restrict,
  unique (loan_account_id)
);

create table public.repayment_installments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  loan_account_id uuid not null,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  principal_due numeric(18,2) not null default 0 check (principal_due >= 0),
  interest_due numeric(18,2) not null default 0 check (interest_due >= 0),
  fee_due numeric(18,2) not null default 0 check (fee_due >= 0),
  penalty_due numeric(18,2) not null default 0 check (penalty_due >= 0),
  principal_paid numeric(18,2) not null default 0 check (principal_paid >= 0),
  interest_paid numeric(18,2) not null default 0 check (interest_paid >= 0),
  fee_paid numeric(18,2) not null default 0 check (fee_paid >= 0),
  penalty_paid numeric(18,2) not null default 0 check (penalty_paid >= 0),
  status text not null default 'due' check (status in ('pending', 'due', 'partial', 'paid', 'overdue', 'waived')),
  foreign key (loan_account_id, institution_id) references public.loan_accounts(id, institution_id) on delete restrict,
  unique (id, institution_id), unique (loan_account_id, installment_number)
);

create table public.collection_cases (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  loan_account_id uuid not null,
  assigned_staff_profile_id uuid references auth.users(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'paused', 'resolved', 'closed')),
  opened_at timestamptz not null default now(),
  foreign key (loan_account_id, institution_id) references public.loan_accounts(id, institution_id) on delete restrict,
  unique (id, institution_id)
);

create table public.collection_interactions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  collection_case_id uuid not null,
  actor_profile_id uuid not null references auth.users(id) on delete restrict,
  interaction_type text not null,
  notes text,
  occurred_at timestamptz not null default now(),
  foreign key (collection_case_id, institution_id) references public.collection_cases(id, institution_id) on delete restrict
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  customer_profile_id uuid not null,
  complaint_number text not null,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'closed')),
  subject text not null,
  description text not null,
  created_at timestamptz not null default now(),
  foreign key (customer_profile_id, institution_id) references public.customers(profile_id, institution_id) on delete restrict,
  unique (institution_id, complaint_number)
);

create index idx_applications_queue on public.loan_applications (institution_id, status, submitted_at);
create index idx_installments_due on public.repayment_installments (institution_id, due_date, status);
create index idx_collection_open on public.collection_cases (institution_id, status, opened_at);

alter table public.loan_products enable row level security;
alter table public.loan_product_versions enable row level security;
alter table public.loan_applications enable row level security;
alter table public.credit_assessments enable row level security;
alter table public.application_decisions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_actions enable row level security;
alter table public.loan_accounts enable row level security;
alter table public.loan_contract_snapshots enable row level security;
alter table public.repayment_installments enable row level security;
alter table public.collection_cases enable row level security;
alter table public.collection_interactions enable row level security;
alter table public.complaints enable row level security;

create policy products_read_active_or_permitted on public.loan_products for select to authenticated using (institution_id = public.current_institution_id() and (status = 'active' or public.has_permission('product.read')));
create policy product_versions_read_active_or_permitted on public.loan_product_versions for select to authenticated using (institution_id = public.current_institution_id() and (status = 'active' or public.has_permission('product.read')));
create policy applications_read_owner_or_permitted on public.loan_applications for select to authenticated using (customer_profile_id = auth.uid() or (institution_id = public.current_institution_id() and public.has_permission('application.read')));
create policy loans_read_owner_or_permitted on public.loan_accounts for select to authenticated using (customer_profile_id = auth.uid() or (institution_id = public.current_institution_id() and public.has_permission('loan.read')));
create policy installments_read_owner_or_permitted on public.repayment_installments for select to authenticated using (exists (select 1 from public.loan_accounts l where l.id = loan_account_id and l.institution_id = repayment_installments.institution_id and (l.customer_profile_id = auth.uid() or public.has_permission('loan.read'))));
create policy complaints_read_owner_or_permitted on public.complaints for select to authenticated using (customer_profile_id = auth.uid() or (institution_id = public.current_institution_id() and public.has_permission('complaint.read')));
