create table public.staff_notification_deliveries(
 id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.staff_notifications(id) on delete cascade,
 channel text not null default 'email' check(channel='email'), status text not null default 'queued' check(status in('queued','sent','failed','skipped')),
 provider text, provider_message_id text, error_message text, attempted_at timestamptz, unique(notification_id,channel)
);
alter table public.staff_notification_deliveries enable row level security;
create or replace function public.get_urgent_staff_notifications_for_delivery()
returns table(notification_id uuid,recipient_email text,recipient_name text,title text,message text)
language sql stable security definer set search_path=public,pg_temp as $$
 select n.id,p.email,p.full_name,n.title,n.message from public.staff_notifications n join public.profiles p on p.id=n.staff_profile_id and p.institution_id=n.institution_id
 where n.email_required and p.status='active' and not exists(select 1 from public.staff_notification_deliveries d where d.notification_id=n.id and d.channel='email' and d.status='sent')
 $$;
revoke all on function public.get_urgent_staff_notifications_for_delivery() from public;
grant execute on function public.get_urgent_staff_notifications_for_delivery() to service_role;
