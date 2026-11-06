# Backend validation matrix

Run these against a disposable Supabase development project after all four migrations apply.
Do not run them against a production project or with real payment-provider credentials.

| Test | Setup / action | Expected database-enforced result |
|---|---|---|
| Cross-tenant relationship | Insert an institution A child referencing an institution B parent | Composite FK rejects it. |
| Customer isolation | Query another customer's loan, repayment, KYC case or document | RLS returns no row/object. |
| Staff permission | Use a staff identity with no relevant permission | Trusted function raises `permission denied`. |
| Direct deny | Grant a role permission and a user-level deny | `has_permission` returns false. |
| Self approval | Use maker identity as checker | Approval RPC rejects it. |
| Cross-tenant checker | Checker belongs to another institution | Approval RPC rejects it. |
| Duplicate callback | Submit the same provider event concurrently | Exactly one provider event is persisted; the other conflicts. |
| Concurrent repayments | Process two events for one loan concurrently | Trusted repayment RPC locks loan/installments; balances and allocations remain consistent. |
| Overpayment | Confirm amount greater than due components | Allocations stop at due amounts; residual creates `unapplied_cash`. |
| Reversal | Reverse a partially allocated repayment | Reversal references original allocations and posts a compensating journal. |
| Unbalanced journal | Attempt to post draft with fewer than two lines or unequal totals | `post_journal_entry` raises an exception. |
| Posted journal mutation | Update/delete posted entry or its lines | Trigger rejects mutation. |
| Sensitive documents | Staff without `document.read_sensitive` requests KYC file | No direct object access or signed URL. |
| Suspended staff | Suspend staff profile or membership and invoke a trusted operation | Access/permission check fails. |
| Duplicate disbursement | Create two requests for one loan | Unique `loan_account_id` constraint rejects the second. |

## Provider sandbox cases

For Daraja, PayHero, and Finoq separately, confirm the current vendor contract for: request
authentication; STK acceptance and final callback shape; B2C support; callback authentication;
duplicate delivery; status queries; timeouts; reversal rules; and sandbox versus live endpoints.
No fallback provider is attempted after an accepted/unknown disbursement request until status
reconciliation rules decide it is safe.
