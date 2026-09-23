-- E25-T05 (BR-008): audit jurnali sahifasi — filtr (jadval, a'zo, davr) va
-- keyset sahifalash. O'qish huquqi RLS'da (owner/admin); bu yerdagi
-- tekshiruv — bo'sh ro'yxat o'rniga tushunarli xato uchun.
--
-- Tartib va kursor — `(at, id)` kamayishi bo'yicha: `audit_log_household_at_idx`
-- aynan shu tartibda, ya'ni chuqur sahifa ham indeksdan o'qiladi.
-- Davr chegarasi byudjet vaqt zonasida (BR-002): `p_to` — shu kun ham kiradi.
create or replace function public.audit_list(
  p_household uuid,
  p_tables text[] default null,
  p_actors uuid[] default null,
  p_from date default null,
  p_to date default null,
  p_after_at timestamptz default null,
  p_after_id bigint default null,
  p_limit integer default 50
)
returns table (
  id bigint,
  at timestamptz,
  actor_id uuid,
  table_name text,
  record_id text,
  action text,
  old_values jsonb,
  new_values jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_tz text;
begin
  if p_household not in (select private.my_admin_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select h.timezone into v_tz from public.households h where h.id = p_household;

  return query
    select a.id, a.at, a.actor_id, a.table_name, a.record_id, a.action, a.old_values, a.new_values
      from public.audit_log a
     where a.household_id = p_household
       and (p_tables is null or a.table_name = any(p_tables))
       and (p_actors is null or a.actor_id = any(p_actors))
       and (p_from is null or a.at >= pg_catalog.timezone(v_tz, p_from::timestamp))
       and (p_to is null or a.at < pg_catalog.timezone(v_tz, (p_to + 1)::timestamp))
       and (p_after_at is null or (a.at, a.id) < (p_after_at, coalesce(p_after_id, 0)))
     order by a.at desc, a.id desc
     limit v_limit;
end;
$$;

grant execute on function
  public.audit_list(uuid, text[], uuid[], date, date, timestamptz, bigint, integer)
to authenticated;
