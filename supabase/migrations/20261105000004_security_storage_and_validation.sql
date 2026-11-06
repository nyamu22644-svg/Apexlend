-- Production foundation 4/4: private storage policies, trusted-operation guardrails and SQL validation cases.

insert into storage.buckets (id, name, public)
values
  ('kyc-documents', 'kyc-documents', false),
  ('application-documents', 'application-documents', false),
  ('statements', 'statements', false),
  ('institution-assets', 'institution-assets', false)
on conflict (id) do update set public = false;

insert into public.permissions (code, description) values
  ('customer.read', 'Read tenant customer records'),
  ('kyc.read', 'Read KYC cases'),
  ('document.read_sensitive', 'Read sensitive customer documents'),
  ('product.read', 'Read non-active product versions'),
  ('application.read', 'Read tenant loan applications'),
  ('loan.read', 'Read tenant loan accounts'),
  ('repayment.read', 'Read tenant repayment records'),
  ('provider.read', 'Read payment-provider connection status'),
  ('application.approve', 'Approve loan applications'),
  ('disbursement.approve', 'Approve disbursements'),
  ('repayment.reverse', 'Approve repayment reversals'),
  ('kyc.decide', 'Approve or reject KYC cases')
on conflict (code) do nothing;

-- Object path convention: {institution_id}/{customer_profile_id}/{document_id}/{filename}.
-- Bucket policies are deliberately restrictive. Staff document access is issued through a
-- trusted signed-URL service after checking document.read_sensitive; it is not granted broadly.
create policy kyc_upload_own_path on storage.objects for insert to authenticated
with check (
  bucket_id = 'kyc-documents'
  and (storage.foldername(name))[1] = public.current_institution_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy kyc_read_own_path on storage.objects for select to authenticated
using (
  bucket_id = 'kyc-documents'
  and (storage.foldername(name))[1] = public.current_institution_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy application_upload_own_path on storage.objects for insert to authenticated
with check (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = public.current_institution_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy application_read_own_path on storage.objects for select to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = public.current_institution_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- The application uses trusted server actions/RPCs for all sensitive writes. This helper
-- prevents a client from calling a financial function with a forged actor identity.
create or replace function public.require_active_staff(required_permission text, required_amount numeric default 0)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.has_permission(required_permission) then
    raise exception 'permission denied';
  end if;
  if required_amount > 0 and not exists (
    select 1 from public.staff_members s
    where s.profile_id = actor_id and s.institution_id = public.current_institution_id()
      and s.is_active and s.approval_limit >= required_amount
  ) then
    raise exception 'approval limit exceeded';
  end if;
  return actor_id;
end $$;

revoke all on function public.require_active_staff(text, numeric) from public;
grant execute on function public.require_active_staff(text, numeric) to service_role;

-- Required adversarial tests before this chain is promoted beyond a disposable development project:
-- 1 Cross-tenant composite FK insertion fails.
-- 2 Customer cross-customer SELECT fails by RLS.
-- 3 Staff without permission cannot invoke a trusted operation.
-- 4 Explicit deny wins over a role grant in has_permission.
-- 5 Maker cannot approve own request; checker institution/permission/limit are validated in approval RPC.
-- 6 Simultaneous duplicate provider callbacks violate provider_events unique keys.
-- 7 Concurrent repayments lock loan/installment rows in a future process_repayment RPC.
-- 8 Overpayment creates unapplied_cash, never discarded funds.
-- 9 Posting an empty/unbalanced journal raises an exception.
-- 10 Update/delete of posted entries or lines raises an exception.
-- 11 Customer cannot read another customer's KYC object.
-- 12 Suspended staff fails current_institution_id/has_permission.
-- 13 Disbursement uniqueness prevents a second request for one loan.
