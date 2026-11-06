-- Production workflow 11: controlled loan-product version publishing.

insert into public.permissions (code, description) values
  ('product.manage', 'Create and edit draft loan-product versions'),
  ('product.publish', 'Publish or retire loan-product versions')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, institution_id, permission_code)
select r.id, r.institution_id, p.code
from public.roles r
join public.permissions p on p.code in ('product.manage', 'product.publish')
where r.code = 'super_admin'
on conflict do nothing;

create or replace function public.get_staff_loan_products()
returns table (product_id uuid, code text, name text, product_status text, version_id uuid, version_number integer, version_status text, effective_from timestamptz, terms jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.code, p.name, p.status, v.id, v.version_number, v.status, v.effective_from, v.terms
  from public.loan_products p
  left join public.loan_product_versions v on v.product_id = p.id and v.institution_id = p.institution_id
  where p.institution_id = public.current_institution_id() and public.has_permission('product.read')
  order by p.code, v.version_number desc;
$$;

create or replace function public.publish_loan_product_version(
  p_product_id uuid,
  p_code text,
  p_name text,
  p_terms jsonb
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare actor_id uuid := auth.uid(); inst uuid := public.current_institution_id(); resolved_product uuid; next_version integer; version_id uuid;
begin
  if actor_id is null or inst is null or not public.has_permission('product.manage') or not public.has_permission('product.publish') then raise exception 'permission denied'; end if;
  if p_code !~ '^[A-Z0-9-]{3,40}$' or length(trim(p_name)) < 3 then raise exception 'invalid product identity'; end if;
  if coalesce((p_terms->>'min_amount')::numeric, 0) <= 0 or coalesce((p_terms->>'max_amount')::numeric, 0) < (p_terms->>'min_amount')::numeric or coalesce((p_terms->>'min_term_months')::integer, 0) <= 0 or coalesce((p_terms->>'max_term_months')::integer, 0) < (p_terms->>'min_term_months')::integer or coalesce((p_terms->>'interest_rate_per_month')::numeric, -1) < 0 then raise exception 'invalid product terms'; end if;
  if p_product_id is null then
    insert into public.loan_products (institution_id, code, name, status) values (inst, p_code, trim(p_name), 'active') returning id into resolved_product;
  else
    select id into resolved_product from public.loan_products where id = p_product_id and institution_id = inst for update;
    if resolved_product is null then raise exception 'product unavailable'; end if;
    update public.loan_products set name = trim(p_name), status = 'active' where id = resolved_product and institution_id = inst;
  end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.loan_product_versions where product_id = resolved_product and institution_id = inst;
  update public.loan_product_versions set status = 'retired', effective_to = now() where product_id = resolved_product and institution_id = inst and status = 'active';
  insert into public.loan_product_versions (institution_id, product_id, version_number, status, effective_from, terms, created_by)
  values (inst, resolved_product, next_version, 'active', now(), p_terms, actor_id) returning id into version_id;
  insert into public.audit_events (institution_id, actor_profile_id, action, target_type, target_id, after_state)
  values (inst, actor_id, 'LOAN_PRODUCT_VERSION_PUBLISHED', 'loan_product_version', version_id, p_terms);
  return version_id;
end;
$$;

revoke all on function public.get_staff_loan_products() from public;
revoke all on function public.publish_loan_product_version(uuid, text, text, jsonb) from public;
grant execute on function public.get_staff_loan_products() to authenticated;
grant execute on function public.publish_loan_product_version(uuid, text, text, jsonb) to authenticated;
