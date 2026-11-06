-- Production foundation 3/4: provider routing, disbursements, repayments and double-entry journals.
-- Provider credentials are stored outside these tables (for example, an encrypted server-side secret reference).

create table public.payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  provider text not null check (provider in ('daraja', 'payhero', 'finoq')),
  capability text not null check (capability in ('stk_push', 'c2b', 'b2c', 'status_query', 'reversal')),
  environment text not null check (environment in ('sandbox', 'live')),
  status text not null default 'disabled' check (status in ('disabled', 'testing', 'active', 'degraded')),
  priority smallint not null default 100 check (priority > 0),
  credential_reference text not null,
  routing_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, institution_id),
  unique (institution_id, provider, capability, environment)
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  customer_profile_id uuid references auth.users(id) on delete restrict,
  loan_account_id uuid,
  request_type text not null check (request_type in ('stk_push', 'b2c_disbursement', 'reversal', 'status_query')),
  amount numeric(18,2) not null check (amount > 0),
  currency_code char(3) not null default 'KES',
  destination_reference text not null,
  idempotency_key uuid not null,
  status text not null default 'created' check (status in ('created', 'routing', 'submitted', 'accepted', 'failed', 'unknown', 'completed', 'cancelled')),
  selected_connection_id uuid,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_profile_id, institution_id) references public.customers(profile_id, institution_id) on delete restrict,
  foreign key (loan_account_id, institution_id) references public.loan_accounts(id, institution_id) on delete restrict,
  foreign key (selected_connection_id, institution_id) references public.payment_provider_connections(id, institution_id) on delete restrict,
  unique (id, institution_id),
  unique (institution_id, idempotency_key)
);

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  connection_id uuid not null,
  payment_request_id uuid,
  event_type text not null,
  external_reference text,
  event_hash text not null,
  processing_status text not null default 'received' check (processing_status in ('received', 'processing', 'processed', 'ignored', 'failed')),
  raw_payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  foreign key (connection_id, institution_id) references public.payment_provider_connections(id, institution_id) on delete restrict,
  foreign key (payment_request_id, institution_id) references public.payment_requests(id, institution_id) on delete restrict,
  unique (id, institution_id),
  unique (connection_id, event_type, external_reference),
  unique (connection_id, event_hash)
);

create table public.disbursement_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  loan_account_id uuid not null,
  approval_request_id uuid not null,
  amount numeric(18,2) not null check (amount > 0),
  destination_phone text not null,
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'submitted', 'completed', 'failed', 'unknown', 'cancelled')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  foreign key (loan_account_id, institution_id) references public.loan_accounts(id, institution_id) on delete restrict,
  foreign key (approval_request_id, institution_id) references public.approval_requests(id, institution_id) on delete restrict,
  unique (id, institution_id), unique (loan_account_id), unique (institution_id, idempotency_key)
);

create table public.disbursement_attempts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  disbursement_request_id uuid not null,
  payment_request_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  status text not null check (status in ('created', 'submitted', 'accepted', 'failed', 'unknown', 'completed')),
  provider_response jsonb,
  created_at timestamptz not null default now(),
  foreign key (disbursement_request_id, institution_id) references public.disbursement_requests(id, institution_id) on delete restrict,
  foreign key (payment_request_id, institution_id) references public.payment_requests(id, institution_id) on delete restrict,
  unique (disbursement_request_id, sequence_number), unique (payment_request_id)
);

create table public.repayment_transactions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  loan_account_id uuid,
  customer_profile_id uuid,
  provider_event_id uuid,
  amount numeric(18,2) not null check (amount > 0),
  currency_code char(3) not null default 'KES',
  transaction_reference text not null,
  status text not null default 'received' check (status in ('received', 'allocated', 'partially_allocated', 'unapplied', 'reversed')),
  received_at timestamptz not null default now(),
  foreign key (loan_account_id, institution_id) references public.loan_accounts(id, institution_id) on delete restrict,
  foreign key (customer_profile_id, institution_id) references public.customers(profile_id, institution_id) on delete restrict,
  foreign key (provider_event_id, institution_id) references public.provider_events(id, institution_id) on delete restrict,
  unique (id, institution_id), unique (institution_id, transaction_reference), unique (provider_event_id)
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  repayment_transaction_id uuid not null,
  installment_id uuid not null,
  component text not null check (component in ('principal', 'interest', 'fee', 'penalty')),
  amount numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (repayment_transaction_id, institution_id) references public.repayment_transactions(id, institution_id) on delete restrict,
  foreign key (installment_id, institution_id) references public.repayment_installments(id, institution_id) on delete restrict,
  unique (id, institution_id)
);

create table public.payment_reversals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  repayment_transaction_id uuid not null,
  approval_request_id uuid not null,
  amount numeric(18,2) not null check (amount > 0),
  reason text not null,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (repayment_transaction_id, institution_id) references public.repayment_transactions(id, institution_id) on delete restrict,
  foreign key (approval_request_id, institution_id) references public.approval_requests(id, institution_id) on delete restrict,
  unique (id, institution_id)
);

create table public.unapplied_cash (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  repayment_transaction_id uuid not null,
  customer_profile_id uuid,
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'open' check (status in ('open', 'allocated', 'refunded')),
  created_at timestamptz not null default now(),
  foreign key (repayment_transaction_id, institution_id) references public.repayment_transactions(id, institution_id) on delete restrict,
  foreign key (customer_profile_id, institution_id) references public.customers(profile_id, institution_id) on delete restrict
);

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  is_active boolean not null default true,
  unique (id, institution_id), unique (institution_id, code)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed')),
  source_type text not null,
  source_id uuid not null,
  idempotency_key uuid not null,
  reversal_of_id uuid,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (reversal_of_id, institution_id) references public.journal_entries(id, institution_id) on delete restrict,
  unique (id, institution_id), unique (institution_id, source_type, source_id), unique (institution_id, idempotency_key), unique (reversal_of_id)
);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  journal_entry_id uuid not null,
  ledger_account_id uuid not null,
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  currency_code char(3) not null default 'KES',
  created_at timestamptz not null default now(),
  foreign key (journal_entry_id, institution_id) references public.journal_entries(id, institution_id) on delete restrict,
  foreign key (ledger_account_id, institution_id) references public.ledger_accounts(id, institution_id) on delete restrict,
  check ((debit = 0) <> (credit = 0))
);

create index idx_provider_events_unprocessed on public.provider_events (institution_id, processing_status, received_at);
create index idx_payment_requests_status on public.payment_requests (institution_id, status, created_at);
create index idx_repayments_loan on public.repayment_transactions (institution_id, loan_account_id, received_at desc);
create index idx_journal_posted on public.journal_entries (institution_id, posted_at desc) where status = 'posted';

create or replace function public.post_journal_entry(entry_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare entry_institution uuid; debit_total numeric(18,2); credit_total numeric(18,2); line_count integer;
begin
  select institution_id into entry_institution from public.journal_entries where id = entry_id and status = 'draft' for update;
  if entry_institution is null then raise exception 'journal entry is not a draft'; end if;
  select count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0) into line_count, debit_total, credit_total from public.journal_lines where journal_entry_id = entry_id and institution_id = entry_institution;
  if line_count < 2 or debit_total <> credit_total then raise exception 'journal entry must have at least two balanced lines'; end if;
  update public.journal_entries set status = 'posted', posted_at = now() where id = entry_id and institution_id = entry_institution;
end $$;

create or replace function public.prevent_posted_journal_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' and old.status = 'posted' then raise exception 'posted journal entries are immutable'; end if;
  if tg_op = 'UPDATE' and old.status = 'posted' then raise exception 'posted journal entries are immutable'; end if;
  return coalesce(new, old);
end $$;

create or replace function public.prevent_posted_journal_line_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.journal_entries e where e.id = old.journal_entry_id and e.institution_id = old.institution_id and e.status = 'posted') then
    raise exception 'lines of a posted journal entry are immutable';
  end if;
  return coalesce(new, old);
end $$;

create trigger journal_entries_immutable before update or delete on public.journal_entries for each row execute function public.prevent_posted_journal_mutation();
create trigger journal_lines_immutable before update or delete on public.journal_lines for each row execute function public.prevent_posted_journal_line_mutation();

revoke all on function public.post_journal_entry(uuid) from public;
grant execute on function public.post_journal_entry(uuid) to service_role;

alter table public.payment_provider_connections enable row level security;
alter table public.payment_requests enable row level security;
alter table public.provider_events enable row level security;
alter table public.disbursement_requests enable row level security;
alter table public.disbursement_attempts enable row level security;
alter table public.repayment_transactions enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_reversals enable row level security;
alter table public.unapplied_cash enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy repayment_read_owner_or_permitted on public.repayment_transactions for select to authenticated using (customer_profile_id = auth.uid() or (institution_id = public.current_institution_id() and public.has_permission('repayment.read')));
create policy provider_connections_read_permitted on public.payment_provider_connections for select to authenticated using (institution_id = public.current_institution_id() and public.has_permission('provider.read'));
-- Inserts, updates, allocation, journal posting and reversals are server/RPC-only by design.
