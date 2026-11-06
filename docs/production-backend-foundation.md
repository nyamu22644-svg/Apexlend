# Production backend foundation

## Status and scope

The existing UI and mock workflows are the reference behaviour. They are not a financial system of record. No current migration is approved for execution against a shared or production Supabase project.

This document is the canonical foundation for replacing the three legacy SQL drafts. It does not set institutional lending, accounting, tax, retention, or payment-waterfall policy. Those rules must be approved and configured before live money movement is enabled.

## Security invariants

- Every operational record carries `institution_id` and uses same-institution composite foreign keys where relationships cross institution-owned records.
- Supabase Auth identity is never accepted from a client payload. Trusted functions derive the actor from `auth.uid()`.
- Staff have multiple roles. Permission resolution is: direct deny, then direct allow, then any assigned-role allow, otherwise deny.
- Maker and checker are distinct active staff identities in the same institution. Approval limits and operation-specific permissions are checked in trusted database/server code.
- Customers cannot create payment confirmations, alter balances, post journals, approve KYC, or write audit records directly.
- Audit and posted financial data are append-only. Corrections use linked compensating records.

## Canonical relational domains

### Identity, tenancy and access

`institutions`, `profiles`, `staff_members`, `roles`, `permissions`, `role_permissions`, `staff_role_assignments`, `staff_permission_overrides`, `staff_invitations`, and `security_events` separate an Auth identity from customer/staff application access.

### Customer, privacy and documents

`customers`, `customer_identity_records`, `kyc_cases`, `kyc_verification_events`, `documents`, `document_access_grants`, `consent_versions`, and `customer_consents` retain identity/KYC history without treating an Auth profile as a lending record.

### Credit lifecycle

`loan_products`, `loan_product_versions`, `loan_applications`, `application_documents`, `credit_assessments`, `application_decisions`, `approval_requests`, `approval_actions`, `loan_accounts`, `loan_contract_snapshots`, and `repayment_installments` preserve immutable terms and decision history.

### Payments, disbursements and accounting

`payment_provider_connections`, `payment_requests`, `provider_events`, `disbursement_requests`, `disbursement_attempts`, `repayment_transactions`, `payment_allocations`, `payment_reversals`, `unapplied_cash`, `ledger_accounts`, `journal_entries`, and `journal_lines` are the sole source of truth for money movement.

Provider events and requests use provider/institution/event-type/external-reference uniqueness and internal idempotency keys. Loan balance changes and journal posting happen in one trusted transaction only.

### Operations

`collection_cases`, `collection_interactions`, `promise_to_pay`, `complaints`, `complaint_events`, `notifications`, `notification_deliveries`, `institution_settings`, `report_snapshots`, and `audit_events` cover the existing staff modules without storing operational history only in React state.

## Payment-provider design

Daraja, PayHero, and Finoq are separate server-side adapters. The frontend submits an internal payment or disbursement request; it never receives or stores provider credentials.

Each connection has an institution, provider (`daraja`, `payhero`, or `finoq`), capability (`stk_push`, `c2b`, `b2c`, `status_query`, or `reversal`), state, priority, encrypted credential reference, and routing policy. The application records every request and callback before processing. Failover is allowed only before a provider has accepted a request; a new request uses a new idempotency key and retains the failed attempt history. It must never send a second disbursement merely because a first provider timed out.

The confirmed provider payload, callback-authentication method, sandbox/live endpoints, idempotency semantics, and B2C capability must be verified from each provider's current contract before an adapter is activated.

## Storage

Use private buckets: `kyc-documents`, `application-documents`, `statements`, and `institution-assets`. Object paths begin with `institution_id/customer_id/...`. Customer uploads and reads are constrained to their own private path; document metadata and signed URLs are issued by trusted operations. Staff access requires a specific document permission. KYC files are never public.

## Migration sequence

1. Identity, institutions, RBAC, customers, privacy and document metadata.
2. Product versions, applications, assessments, approvals, contracts and schedules.
3. Provider requests/events, disbursements, repayments, allocation records and collections.
4. Ledger, posted-entry immutability, trusted transaction functions, audit and notifications.
5. RLS, Storage policies, function grants, seed roles and adversarial SQL tests.

The legacy migrations will be deleted only when this replacement chain is present and has been syntax-checked in a disposable local/Supabase development project.

## Required institutional decisions before activation

- Payment allocation waterfall, fee treatment, rounding, settlement, restructuring and write-off rules.
- Approval limits and which actions require maker-checker separation.
- KYC evidence, retention, consent text, document access and complaint procedures.
- Provider contracts, callback verification, failover policy and reconciliation ownership.
