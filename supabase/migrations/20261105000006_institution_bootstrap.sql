-- Production foundation 6/6: one-time establishment of the initial institution.
-- This intentionally requires operator-supplied legal/business values. Do not replace these
-- arguments with invented license, tax, regulatory, or payment-provider information.

create or replace function public.bootstrap_first_institution(
  institution_slug text,
  institution_legal_name text,
  institution_trade_name text,
  institution_currency_code char(3) default 'KES'
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare created_institution_id uuid;
begin
  if exists (select 1 from public.institutions) then
    raise exception 'an institution already exists; first-institution bootstrap is permanently closed';
  end if;

  if institution_slug !~ '^[a-z0-9-]{3,64}$' then
    raise exception 'institution slug must contain only lowercase letters, digits, and hyphens';
  end if;

  insert into public.institutions (slug, legal_name, trade_name, currency_code, is_default)
  values (institution_slug, institution_legal_name, institution_trade_name, upper(institution_currency_code), true)
  returning id into created_institution_id;

  return created_institution_id;
end $$;

revoke all on function public.bootstrap_first_institution(text, text, text, char) from public;
grant execute on function public.bootstrap_first_institution(text, text, text, char) to service_role;

-- After migrations are applied, execute as the project owner in the SQL editor:
-- select public.bootstrap_first_institution(
--   'your-institution-slug',
--   'Registered Legal Name Limited',
--   'Customer-Facing Trade Name',
--   'KES'
-- );
-- Run this exactly once, before inviting/registering the first customer or staff identity.
