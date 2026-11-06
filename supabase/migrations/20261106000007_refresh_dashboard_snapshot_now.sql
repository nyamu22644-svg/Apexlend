-- Populate the current reporting-day snapshot immediately after enabling automation.
select public.refresh_all_staff_dashboard_snapshots();
