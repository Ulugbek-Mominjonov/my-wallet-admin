-- E25-T04 (BR-043): qayta joylashdan oldin aynan qaysi daromadlar ko'chishi.
-- Jamlangan preview (`recalc_income_months_preview`) "nechta va qayerdan
-- qayerga" deydi; bu yerda har yozuv ko'rinadi: sana, joy, turi (daromad
-- kategoriyasi), summa, eski oy → yangi oy.
--
-- Ro'yxat cheklangan (`p_limit`), `total` esa — hammasi: tasdiqda aynan shu
-- son `recalc_income_months_apply` ga beriladi.
create or replace function public.recalc_income_months_rows(
  p_household uuid,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 1000);
  v_result jsonb;
begin
  if p_household not in (select private.my_admin_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  with drift as materialized (
    select d.id, d.from_month, d.to_month, d.amount_base
      from private.income_month_drift(p_household) d
  ), page as (
    select d.id, t.occurred_on, t.payee, c.name as category,
           d.amount_base, d.from_month, d.to_month
      from drift d
      join public.transactions t on t.id = d.id
      join public.categories c on c.id = t.category_id
     order by t.occurred_on desc, d.id desc
     limit v_limit
  )
  select jsonb_build_object(
           'total', (select count(*) from drift),
           'rows', coalesce(
             (select jsonb_agg(to_jsonb(p) order by p.occurred_on desc, p.id desc) from page p),
             '[]'::jsonb))
    into v_result;
  return v_result;
end;
$$;

grant execute on function public.recalc_income_months_rows(uuid, integer) to authenticated;
