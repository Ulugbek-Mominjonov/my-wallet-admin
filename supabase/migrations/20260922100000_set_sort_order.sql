-- E22-T01: spravochnik tartibi (drag & drop) — bitta so'rovda. PostgREST
-- upsert bilan bo'lmaydi (insert yo'li NOT NULL ustunlarni talab qiladi),
-- qatorma-qator PATCH esa N ta so'rov. Tartib — berilgan ID lar ketma-ketligi
-- (0, 1, 2, ...); o'zgarmagan qatorlar yozilmaydi (row_version, sinxron
-- trafigi behuda oshmaydi). Yozuv huquqi jadval RLS'i bilan bir xil.
create or replace function public.set_sort_order(
  p_household uuid,
  p_table text,
  p_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_roles public.member_role[];
  v_updated integer;
begin
  v_roles := case p_table
    when 'accounts' then array['owner', 'admin']
    when 'categories' then array['owner', 'admin']
    when 'recurring_rules' then array['owner', 'admin']
    when 'quick_actions' then array['owner', 'admin']
    when 'goals' then array['owner', 'admin', 'member']
  end::public.member_role[];
  if v_roles is null then
    raise exception 'invalid_table' using errcode = 'P0001';
  end if;
  perform private.require_household_role(p_household, v_roles);
  if coalesce(cardinality(p_ids), 0) > 1000 then
    raise exception 'invalid_batch' using errcode = 'P0001';
  end if;

  -- Jadval nomi — yuqoridagi oq ro'yxatdan (%I), qiymatlar — parametr.
  execute format(
    'update public.%I t
        set sort_order = o.ord - 1
       from unnest($1) with ordinality as o (id, ord)
      where t.household_id = $2
        and t.id = o.id
        and t.deleted_at is null
        and t.sort_order is distinct from o.ord - 1',
    p_table
  ) using p_ids, p_household;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

grant execute on function public.set_sort_order(uuid, text, uuid[]) to authenticated;
