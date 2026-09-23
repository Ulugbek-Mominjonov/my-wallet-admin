-- E26-T04: qo'llab-quvvatlash uchun foydalanuvchilar ro'yxati (BR-213).
--
-- Faqat agregat: byudjetlar soni, ro'yxatdan o'tgan sana, oxirgi kirish.
-- Amallar, summalar va byudjet ichidagi ma'lumot ko'rinmaydi — platforma
-- admini ham a'zo bo'lmagan byudjetni o'qiy olmaydi (RLS).
create or replace function public.platform_users(
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_result jsonb;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  with matched as (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
           p.display_name, p.locale
      from auth.users u
      join public.profiles p on p.user_id = u.id
     where u.deleted_at is null
       and (v_query is null
            or u.email ilike '%' || v_query || '%'
            or p.display_name ilike '%' || v_query || '%')
  ), page as (
    select m.*,
           (select count(*) from public.household_members hm where hm.user_id = m.id) as households,
           exists (select 1 from public.platform_admins a where a.user_id = m.id) as is_admin
      from matched m
     order by m.created_at desc
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', x.id,
               'email', x.email,
               'display_name', x.display_name,
               'locale', x.locale,
               'created_at', x.created_at,
               'last_sign_in_at', x.last_sign_in_at,
               'blocked', x.banned_until is not null and x.banned_until > now(),
               'households', x.households,
               'is_admin', x.is_admin)
             order by x.created_at desc)
        from page x), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Bloklash: GoTrue `banned_until` ni tekshiradi — kirish to'xtaydi, ma'lumot
-- o'chmaydi (BR-015 dagi o'chirishdan farqli).
create or replace function public.platform_set_blocked(p_user uuid, p_blocked boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'self_block' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.platform_admins a where a.user_id = p_user) then
    raise exception 'admin_block' using errcode = 'P0001';
  end if;

  v_until := case when p_blocked then 'infinity'::timestamptz end;
  update auth.users set banned_until = v_until, updated_at = now()
   where id = p_user and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return jsonb_build_object('user_id', p_user, 'blocked', p_blocked);
end;
$$;

grant execute on function
  public.platform_users(text, integer, integer),
  public.platform_set_blocked(uuid, boolean)
to authenticated;
