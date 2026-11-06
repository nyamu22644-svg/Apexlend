/**
 * The executable source of truth is `supabase/migrations/`.
 * These strings are intentionally informational: they prevent the settings UI from exposing
 * obsolete draft SQL that differs from the migration chain.
 */
export const SQL_MIGRATION_1 = `Production backend foundation

Migration 1: identity, tenant isolation, multi-role RBAC, customers, KYC metadata,
private document metadata, append-only audit events, and restrictive RLS defaults.

Migration 2: immutable loan-product versions, applications, assessments, maker-checker
requests, loan contracts, installments, collections, and complaints.

Run only the ordered SQL files in supabase/migrations against a disposable development project.`;

export const SQL_MIGRATION_2 = `Money-movement and provider foundation

Migration 3: Daraja, PayHero, and Finoq provider routing records; callbacks; disbursement
attempts; repayments; allocations; reversals; unapplied cash; and double-entry journals.

Migration 4: private Supabase Storage buckets/policies, trusted-operation guardrails, and the
required adversarial validation matrix.

No payment provider, M-Pesa STK push, or B2C transfer is activated by these migrations.`;
