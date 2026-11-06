# Staff dashboard reporting contract

The dashboard is read-only and tenant-scoped. Every visible metric is calculated in
`get_staff_dashboard()` using the institution's `staff_dashboard_reporting_policies` row.

| Dashboard field | Definition |
| --- | --- |
| Total Customers | Active customer profiles in the institution. |
| Active Loans | Loan accounts whose status is included in `portfolio_statuses`. |
| Portfolio Balance | Outstanding principal plus only the configured interest, fee, and penalty components for included loan statuses. |
| Today's Repayments | Sum of configured repayment statuses whose `received_at` falls on the reporting date in the configured timezone. |
| Total Disbursed (Batch) | Completed disbursement requests captured for the reporting date. |
| Overdue Portfolio (PAR) | Configured portfolio balance for accounts with an unpaid, non-waived instalment due before `reporting_date - par_days_past_due`. |
| Growth | Percentage change between daily snapshots using the configured day-over-day or month-over-month comparison point. It is unavailable until both snapshots exist. |
| Portfolio Trend | The latest daily snapshot from each of the previous six reporting months. |
| Gateway Health | Completed payment requests divided by completed plus failed requests, for the configured provider/capability and observation window. No sample means unavailable. |

Daily snapshots are immutable reporting records except for same-day correction. Run
`select public.capture_staff_dashboard_snapshot();` once after the operational day
closes in the institution's reporting timezone. It requires `dashboard.configure`.

The policy is deliberately stored in the database rather than in React. Before using it
for management or regulatory reporting, an authorized administrator must confirm the
institution's chosen statuses, PAR threshold, balance components, comparison interval,
and gateway service-level thresholds.
