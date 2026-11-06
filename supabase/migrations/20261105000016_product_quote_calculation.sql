-- Single authoritative quote calculation based on immutable product-version terms.
create or replace function public.get_my_loan_quote(p_product_version_id uuid, p_amount numeric, p_term_months integer)
returns table (monthly_installment numeric, total_interest numeric, processing_fee numeric, excise_duty numeric, total_fees numeric, total_repayable numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare t jsonb; r numeric; payment numeric; interest numeric; fee numeric; excise numeric;
begin
  select terms into t from public.loan_product_versions where id=p_product_version_id and status='active' and institution_id=public.current_institution_id();
  if t is null then raise exception 'loan product is unavailable'; end if;
  if p_amount < (t->>'min_amount')::numeric or p_amount > (t->>'max_amount')::numeric or p_term_months < (t->>'min_term_months')::integer or p_term_months > (t->>'max_term_months')::integer then raise exception 'requested amount or term is outside product limits'; end if;
  r:=coalesce((t->>'interest_rate_per_month')::numeric,0)/100;
  if r=0 then payment:=p_amount/p_term_months; else payment:=p_amount*(r*power(1+r,p_term_months))/(power(1+r,p_term_months)-1); end if;
  interest:=round(payment*p_term_months-p_amount,2); payment:=round(payment,2); fee:=round(p_amount*coalesce((t->>'processing_fee_percent')::numeric,0)/100,2); excise:=round(fee*coalesce((t->>'excise_duty_percent')::numeric,20)/100,2);
  return query select payment,interest,fee,excise,fee+excise,round(p_amount+interest,2);
end;
$$;
revoke all on function public.get_my_loan_quote(uuid,numeric,integer) from public;
grant execute on function public.get_my_loan_quote(uuid,numeric,integer) to authenticated;
