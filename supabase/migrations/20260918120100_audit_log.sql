-- E01-T03: audit jurnali — kim, qachon, nima, eski → yangi (BR-008).
--
-- Jadval public sxemada: admin panel a'zolarga RLS orqali o'qitadi (E05).
-- Klient yoza olmaydi — faqat private.audit() triggeri (security definer).

create table public.audit_log (
  id          bigint generated always as identity primary key,
  household_id uuid,
  actor_id    uuid,
  table_name  text        not null,
  record_id   text,
  action      text        not null check (action in ('insert', 'update', 'delete')),
  old_values  jsonb,
  new_values  jsonb,
  at          timestamptz not null default now()
);

comment on table public.audit_log is
  'BR-008: biznes jadvallardagi o''zgarishlar. Saqlash muddati 180 kun (jobs.purge).';

-- Admin "Audit jurnali" sahifasi: byudjet bo'yicha, eng yangisi birinchi.
create index audit_log_household_at_idx on public.audit_log (household_id, at desc);

alter table public.audit_log enable row level security;
-- O'qish siyosati E05 da (a'zolik funksiyalari bilan) qo'shiladi.
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

-- AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW.
--
-- UPDATE da faqat o'zgargan maydonlar yoziladi; texnik maydonlar
-- (row_version, updated_at) shovqin sifatida tashlanadi. Hech narsa
-- o'zgarmagan UPDATE jurnalga tushmaydi.
--
-- Ommaviy ishlarda (import, qayta joylash) har qator uchun yozuv kerak emas:
-- `set local app.skip_audit = 'on'` — ish o'zi bitta xulosa yozadi.
create or replace function private.audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_after  jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_ref    jsonb := coalesce(v_after, v_before);
  v_old    jsonb;
  v_new    jsonb;
begin
  if current_setting('app.skip_audit', true) = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(a.key, a.value)
      into v_new
      from jsonb_each(v_after) as a
     where a.key not in ('row_version', 'updated_at')
       and a.value is distinct from v_before -> a.key;

    if v_new is null then
      return null;
    end if;

    select jsonb_object_agg(k.key, v_before -> k.key)
      into v_old
      from jsonb_object_keys(v_new) as k(key);
  else
    v_old := v_before;
    v_new := v_after;
  end if;

  insert into public.audit_log (household_id, actor_id, table_name, record_id, action, old_values, new_values)
  values (
    coalesce(
      (v_ref ->> 'household_id')::uuid,
      case when tg_table_name = 'households' then (v_ref ->> 'id')::uuid end
    ),
    auth.uid(),
    tg_table_name,
    coalesce(v_ref ->> 'id', v_ref ->> 'user_id'),
    lower(tg_op),
    v_old,
    v_new
  );
  return null;
end;
$$;

comment on function private.audit() is
  'BR-008: umumiy audit triggeri. app.skip_audit=on bo''lsa yozmaydi (ommaviy ishlar).';
