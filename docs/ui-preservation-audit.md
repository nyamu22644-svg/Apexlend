# Connected workflow UI preservation audit

The original mock interface is the presentation baseline. A connected workflow may replace its data source and action handlers, but it must retain the module's layout, fields, labels, filters, drawers, and modal flow unless a deliberate product change is approved.

## Completed repair

### Applications

- Restored the original table, search, status tabs, underwriting drawer, financial/credit/sign-off sections, and decline/request-information modals.
- Bound identity, product, amount, term, score, DSTI, maker, checker, and decision fields to the live staff application API.
- Values not yet produced by the live workflow (purpose, risk tier, installment, total repayable) are explicitly shown as pending/not collected. They are not fabricated.

## Audit queue

| Module | Current state | Required preservation work |
| --- | --- | --- |
| Customer workspace/dashboard | Real workspace identity is mapped into the existing customer model; loans, payments, and dashboard metrics still use mock state. | Keep the current phone UI, bind each card to live APIs as those workflows are built, and use empty/pending states rather than mock balances or dates. |
| KYC review | New connected staff module. | Compare its queue and review modal against the staff design system before further feature work; retain documents/review affordances while adding real case fields only. |
| Loan products | Connected module uses a compact replacement view. | Restore the original product configuration presentation and map live version data and publish actions into it. This is the next UI repair. |
| Customer application wizard | Original wizard presentation retained while catalog/submission actions are live. | Audit each step's calculated terms; show pending where schedule/fee calculations are not yet implemented. |

## Guardrail for all future work

Before connecting a module: capture the existing mock field and interaction contract, define a real-data mapping, then replace only data/actions. No module may be redesigned solely because its backend schema has fewer fields.
