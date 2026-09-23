-- E30-T04 (mobil, BR-011..013): byudjet a'zolari — bitta RPC.
--
-- Admin panel jadvallarni to'g'ridan-to'g'ri o'qiydi (RLS bilan), mobil
-- klient esa faqat RPC bilan ishlaydi (ARXITEKTURA 5): a'zolar ro'yxati,
-- rollari va ismlari (`profiles`) bitta javobda.
create or replace function public.household_members(p_household uuid)
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

  select coalesce(jsonb_agg(to_jsonb(x) order by x.joined_at, x.name), '[]'::jsonb)
    into v_result
    from (
      select m.user_id,
             coalesce(p.display_name, '—')::text as name,
             m.role::text,
             m.joined_at,
             m.user_id = (select auth.uid()) as is_me
        from public.household_members m
        left join public.profiles p on p.user_id = m.user_id
       where m.household_id = p_household
    ) x;
  return v_result;
end;
$$;

comment on function public.household_members(uuid) is
  'BR-011: byudjet a''zolari — ism, rol va qo''shilgan sana (mobil uchun).';

grant execute on function public.household_members(uuid) to authenticated;
