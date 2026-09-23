-- E25-T02 (BR-180): byudjetning to'liq JSON zaxirasi. Owner/admin oladi —
-- fayl butun byudjet ma'lumotini o'z ichiga oladi. O'chirilgan (tombstone)
-- qatorlar kirmaydi: zaxira "hozirgi holat" nusxasi.
--
-- Chek fayllari (Storage) zaxiraga kirmaydi — `attachments` da faqat yo'l va
-- o'lchami bo'ladi.
create or replace function public.export_household(p_household uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_household not in (select private.my_admin_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'version', private.api_schema_version(),
    'exported_at', now(),
    'household', (
      select to_jsonb(h) - 'id' || jsonb_build_object('id', h.id)
        from public.households h where h.id = p_household
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', m.user_id, 'role', m.role, 'joined_at', m.joined_at)
             order by m.joined_at), '[]'::jsonb)
        from public.household_members m where m.household_id = p_household
    ),
    'accounts', private.export_rows('accounts', p_household),
    'categories', private.export_rows('categories', p_household),
    'tags', private.export_rows('tags', p_household),
    'recurring_rules', private.export_rows('recurring_rules', p_household),
    'quick_actions', private.export_rows('quick_actions', p_household),
    'category_limits', private.export_rows('category_limits', p_household),
    'debts', private.export_rows('debts', p_household),
    'goals', private.export_rows('goals', p_household),
    'months', private.export_rows('months', p_household),
    'planned_items', private.export_rows('planned_items', p_household),
    'transactions', private.export_rows('transactions', p_household),
    'transaction_tags', private.export_rows('transaction_tags', p_household),
    'attachments', private.export_rows('attachments', p_household)
  ) into v_result;
  return v_result;
end;
$$;

-- Bitta jadvalning shu byudjetdagi tirik qatorlari (ustunlar o'zgarsa —
-- eksport ham o'zgaradi: qo'lda ro'yxat yuritilmaydi).
create or replace function private.export_rows(p_table text, p_household uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  -- Jadval nomi — shu funksiyadagi qat'iy ro'yxatdan (foydalanuvchi kiritmaydi).
  if p_table not in ('accounts', 'categories', 'tags', 'recurring_rules', 'quick_actions',
                     'category_limits', 'debts', 'goals', 'months', 'planned_items',
                     'transactions', 'transaction_tags', 'attachments') then
    raise exception 'invalid_table' using errcode = 'P0001';
  end if;
  execute format(
    $q$ select coalesce(jsonb_agg(to_jsonb(t) order by t.%I), '[]'::jsonb)
          from public.%I t
         where t.household_id = $1 %s $q$,
    case when p_table = 'months' then 'month' else 'created_at' end,
    p_table,
    case when p_table = 'months' then '' else 'and t.deleted_at is null' end)
  into v_rows using p_household;
  return v_rows;
end;
$$;

grant execute on function private.export_rows(text, uuid) to authenticated;
grant execute on function public.export_household(uuid) to authenticated;
