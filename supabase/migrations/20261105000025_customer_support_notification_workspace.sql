-- Live customer notification and support-tracking workspace.  These functions
-- deliberately expose only the authenticated customer's own records.
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.customer_notifications(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  provider text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  error_message text,
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(notification_id, channel)
);

create or replace function public.mark_my_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.customer_notifications
  set read_at=coalesce(read_at,now())
  where id=p_notification_id and customer_profile_id=auth.uid() and institution_id=public.current_institution_id();
  if not found then raise exception 'notification not found'; end if;
end $$;

create or replace function public.get_my_support_workspace()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'complaints',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'complaint_number',c.complaint_number,'subject',c.subject,'description',c.description,
      'status',c.status,'created_at',c.created_at) order by c.created_at desc)
      from public.complaints c where c.customer_profile_id=auth.uid() and c.institution_id=public.current_institution_id()),'[]'::jsonb),
    'closure_requests',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'reason',r.reason,'status',r.status,'requested_at',r.requested_at,'resolved_at',r.resolved_at) order by r.requested_at desc)
      from public.account_closure_requests r where r.customer_profile_id=auth.uid() and r.institution_id=public.current_institution_id()),'[]'::jsonb)
  );
$$;

revoke all on function public.mark_my_notification_read(uuid) from public;
revoke all on function public.get_my_support_workspace() from public;
grant execute on function public.mark_my_notification_read(uuid) to authenticated;
grant execute on function public.get_my_support_workspace() to authenticated;
