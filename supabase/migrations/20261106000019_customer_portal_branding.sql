-- Customer-facing payment instructions must come from the institution's saved branding,
-- never from a browser-only default or a hard-coded Paybill.
create or replace function public.get_my_customer_portal_branding()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
   'institutionName', coalesce(i.branding->>'institutionName',i.trade_name),
   'shortName', coalesce(i.branding->>'shortName',i.trade_name),
   'tagline', coalesce(i.branding->>'tagline',''),
   'primaryColor', coalesce(i.branding->>'primaryColor','#167D78'),
   'secondaryColor', coalesce(i.branding->>'secondaryColor','#101C2C'),
   'accentColor', coalesce(i.branding->>'accentColor','#D6A85F'),
   'supportPhone', coalesce(i.branding->>'supportPhone',''),
   'supportEmail', coalesce(i.branding->>'supportEmail',''),
   'mpesaPaybill', coalesce(i.branding->>'mpesaPaybill',''),
   'mpesaAccountPrefix', coalesce(i.branding->>'mpesaAccountPrefix','')
 ) from public.institutions i where i.id=public.current_institution_id();
$$;
revoke all on function public.get_my_customer_portal_branding() from public;
grant execute on function public.get_my_customer_portal_branding() to authenticated;
notify pgrst,'reload schema';
