-- E30-T02 (BR-011): oilaviy byudjetda a'zo kesimi — kim qancha sarfladi.
--
-- `created_by` bo'yicha: o'tkazmalar (ichki ko'chirish) hisobga olinmaydi,
-- summalar asosiy valyutada (BR-191). Ism — `profiles` dan (a'zolar
-- bir-birining ismini ko'radi, RLS).
create or replace function public.report_members(p_household uuid, p_month public.month_start)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'month', p_month,
    'members', coalesce(jsonb_agg(to_jsonb(x) order by x.expense desc, x.name), '[]'::jsonb))
    into v_result
    from (
      select m.user_id,
             coalesce(p.display_name, '—') as name,
             coalesce(sum(t.amount_base) filter (where t.kind = 'expense'), 0)::bigint as expense,
             coalesce(sum(t.amount_base) filter (where t.kind = 'income'), 0)::bigint as income,
             count(t.id) filter (where t.kind <> 'transfer') as count
        from public.household_members m
        left join public.profiles p on p.user_id = m.user_id
        left join public.transactions t
               on t.household_id = m.household_id and t.created_by = m.user_id
              and t.budget_month = p_month and t.deleted_at is null and t.kind <> 'transfer'
       where m.household_id = p_household
       group by m.user_id, p.display_name
    ) x;
  return v_result;
end;
$$;

grant execute on function public.report_members(uuid, public.month_start) to authenticated;
