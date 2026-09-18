-- E05-T04..T06: ro'yxatdan o'tish, byudjet va a'zolik RPC'lari, app_bootstrap.
-- Qoidalar: BR-010..015, BR-214. Xato kodlari — contracts/api.md.

-- ─── Ichki yordamchilar ────────────────────────────────────────────────────
-- Yangi byudjet + owner a'zolik. Standart spravochniklar (kategoriyalar,
-- hisoblar) E06-T08 da private.seed_household orqali qo'shiladi.
create or replace function private.create_household_for(
  p_user uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
begin
  insert into public.households (name, created_by)
  values (btrim(p_name), p_user)
  returning id into v_household;

  insert into public.household_members (household_id, user_id, role)
  values (v_household, p_user, 'owner');

  return v_household;
end;
$$;

-- Joriy foydalanuvchi berilgan byudjetda kerakli rolga egami; aks holda xato.
create or replace function private.require_household_role(
  p_household uuid,
  p_roles public.member_role[]
)
returns public.member_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
begin
  select m.role into v_role
    from public.household_members m
   where m.household_id = p_household and m.user_id = (select auth.uid());
  if v_role is null or not v_role = any (p_roles) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return v_role;
end;
$$;

-- ─── BR-010: ro'yxatdan o'tganda profil + shaxsiy byudjet ───────────────────
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_locale text := case
    when v_meta ->> 'locale' in ('uz', 'ru', 'en') then v_meta ->> 'locale'
    else 'uz'
  end;
  v_name text := left(coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  ), 100);
  v_household uuid;
begin
  insert into public.profiles (user_id, display_name, locale)
  values (new.id, coalesce(v_name, ''), v_locale);

  v_household := private.create_household_for(
    new.id,
    case v_locale
      when 'ru' then 'Личный бюджет'
      when 'en' then 'Personal budget'
      else 'Shaxsiy byudjet'
    end
  );

  update public.profiles set last_household_id = v_household where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ─── Byudjet yaratish (oilaviy byudjet uchun) ──────────────────────────────
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  return private.create_household_for((select auth.uid()), p_name);
end;
$$;

-- ─── Takliflar (BR-012) ────────────────────────────────────────────────────
-- 8 belgili kod, adashtiradigan belgilarsiz; 7 kun; bir martalik.
create or replace function private.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
           substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(b, i) % 32) + 1, 1), ''
         )
    from extensions.gen_random_bytes(8) as b, generate_series(0, 7) as i
$$;

create or replace function public.create_invite(
  p_household uuid,
  p_role public.member_role default 'member'
)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform private.require_household_role(p_household, array['owner', 'admin']::public.member_role[]);
  if p_role = 'owner' then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;

  -- Kod to'qnashuvi juda kam — bir necha urinish yetarli.
  for attempt in 1..5 loop
    v_code := private.generate_invite_code();
    begin
      insert into public.household_invites (household_id, code, role, created_by)
      values (p_household, v_code, p_role, (select auth.uid()))
      returning household_invites.code, household_invites.expires_at into code, expires_at;
      return next;
      return;
    exception when unique_violation then
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.household_invites;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  select * into v_invite
    from public.household_invites i
   where i.code = upper(btrim(coalesce(p_code, '')))
   for update;

  if v_invite.id is null then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite_used' using errcode = 'P0001';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.household_members m
     where m.household_id = v_invite.household_id and m.user_id = v_user
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_user, v_invite.role);

  update public.household_invites
     set accepted_by = v_user, accepted_at = now()
   where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

-- ─── A'zolikni boshqarish (BR-011, BR-014) ─────────────────────────────────
create or replace function public.leave_household(p_household uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Oxirgi owner — protect_last_owner triggeri 'last_owner' bilan rad etadi.
  delete from public.household_members
   where household_id = p_household and user_id = (select auth.uid());
  if not found then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.transfer_ownership(p_household uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_household_role(p_household, array['owner']::public.member_role[]);
  if p_new_owner = (select auth.uid()) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  -- Avval yangi owner, keyin eskisi admin — oxirgi owner himoyasi buzilmaydi.
  update public.household_members set role = 'owner'
   where household_id = p_household and user_id = p_new_owner;
  if not found then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  update public.household_members set role = 'admin'
   where household_id = p_household and user_id = (select auth.uid());
end;
$$;

-- owner/admin boshqa a'zoning rolini o'zgartiradi; owner roli faqat
-- transfer_ownership orqali; admin owner'ga tegolmaydi.
create or replace function public.set_member_role(
  p_household uuid,
  p_user uuid,
  p_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role public.member_role :=
    private.require_household_role(p_household, array['owner', 'admin']::public.member_role[]);
  v_target_role public.member_role;
begin
  if p_role = 'owner' then
    raise exception 'use_transfer_ownership' using errcode = 'P0001';
  end if;
  select m.role into v_target_role from public.household_members m
   where m.household_id = p_household and m.user_id = p_user;
  if v_target_role is null then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if v_target_role = 'owner' and v_caller_role <> 'owner' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.household_members set role = p_role
   where household_id = p_household and user_id = p_user;
end;
$$;

create or replace function public.remove_member(p_household uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role public.member_role :=
    private.require_household_role(p_household, array['owner', 'admin']::public.member_role[]);
  v_target_role public.member_role;
begin
  if p_user = (select auth.uid()) then
    raise exception 'use_leave_household' using errcode = 'P0001';
  end if;
  select m.role into v_target_role from public.household_members m
   where m.household_id = p_household and m.user_id = p_user;
  if v_target_role is null then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if v_target_role = 'owner' and v_caller_role <> 'owner' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  delete from public.household_members where household_id = p_household and user_id = p_user;
end;
$$;

-- ─── app_bootstrap (E05-T06) ───────────────────────────────────────────────
-- Ilova ochilganda BITTA so'rov: profil, byudjetlar (rol bilan), sozlamalar.
create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', private.api_schema_version(),
    'is_platform_admin', private.is_platform_admin(),
    'profile', (
      select jsonb_build_object(
        'user_id', p.user_id,
        'display_name', p.display_name,
        'locale', p.locale,
        'last_household_id', p.last_household_id
      )
        from public.profiles p where p.user_id = (select auth.uid())
    ),
    'households', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', h.id,
                 'name', h.name,
                 'role', m.role,
                 'base_currency', h.base_currency,
                 'timezone', h.timezone
               ) order by h.created_at
             )
        from public.household_members m
        join public.households h on h.id = m.household_id
       where m.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'app_config', coalesce((select jsonb_object_agg(c.key, c.value) from public.app_config c), '{}'::jsonb)
  )
$$;

-- ─── Huquqlar ──────────────────────────────────────────────────────────────
grant execute on function
  public.create_household(text),
  public.create_invite(uuid, public.member_role),
  public.accept_invite(text),
  public.leave_household(uuid),
  public.transfer_ownership(uuid, uuid),
  public.set_member_role(uuid, uuid, public.member_role),
  public.remove_member(uuid, uuid),
  public.app_bootstrap()
to authenticated;
