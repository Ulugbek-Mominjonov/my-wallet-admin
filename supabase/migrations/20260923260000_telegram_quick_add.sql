-- E31-T01 (BR-220): botga yozilgan matndan amal yozish.
--
-- Bot service kaliti bilan chaqiradi; foydalanuvchi `telegram_links.chat_id`
-- orqali topiladi. Kategoriya va hisob — joy nomi tarixidan (BR-056), aks
-- holda shu turdagi eng ko'p ishlatilgan kategoriya va hisob.
create or replace function private.telegram_target(p_chat_id bigint)
returns table (user_id uuid, household_id uuid, locale text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.user_id, pr.last_household_id, pr.locale
    from public.telegram_links l
    join public.profiles pr on pr.user_id = l.user_id
   where l.chat_id = p_chat_id and pr.last_household_id is not null
$$;

create or replace function public.telegram_quick_add(
  p_chat_id bigint,
  p_kind text,
  p_amount bigint,
  p_payee text default null,
  p_occurred_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_kind public.transaction_kind := (case when p_kind = 'income' then 'income' else 'expense' end)::public.transaction_kind;
  v_payee text := nullif(btrim(coalesce(p_payee, '')), '');
  v_category uuid;
  v_account uuid;
  v_date date;
  v_id uuid;
  v_result jsonb;
begin
  select * into v_target from private.telegram_target(p_chat_id);
  if v_target.household_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_linked');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  v_date := coalesce(p_occurred_on, private.household_today(v_target.household_id));

  -- BR-056: shu nom bilan oxirgi amal — kategoriya va hisob o'shandan.
  if v_payee is not null then
    select t.category_id, t.account_id into v_category, v_account
      from public.transactions t
     where t.household_id = v_target.household_id and t.kind = v_kind
       and t.deleted_at is null and lower(t.payee) = lower(v_payee)
     order by t.occurred_on desc, t.created_at desc
     limit 1;
  end if;

  -- Aks holda — shu turda eng ko'p ishlatilgani.
  if v_category is null then
    select t.category_id into v_category
      from public.transactions t
     where t.household_id = v_target.household_id and t.kind = v_kind
       and t.deleted_at is null and t.category_id is not null
     group by t.category_id
     order by count(*) desc
     limit 1;
  end if;
  if v_category is null then
    select c.id into v_category
      from public.categories c
     where c.household_id = v_target.household_id and c.deleted_at is null
       and c.archived_at is null and c.system_code is null
       and c.kind = (case when v_kind = 'income' then 'income' else 'expense' end)::public.category_kind
     order by c.sort_order
     limit 1;
  end if;
  if v_account is null then
    select a.id into v_account
      from public.accounts a
     where a.household_id = v_target.household_id and a.deleted_at is null
       and a.archived_at is null and a.type <> 'personal_fund'
     order by (a.type = 'card') desc, a.sort_order
     limit 1;
  end if;
  if v_category is null or v_account is null then
    return jsonb_build_object('ok', false, 'code', 'setup_required');
  end if;

  begin
    insert into public.transactions (household_id, kind, account_id, amount, category_id, payee,
                                     occurred_on, source, created_by)
    values (v_target.household_id, v_kind, v_account, p_amount, v_category, v_payee,
            v_date, 'telegram', v_target.user_id)
    returning id into v_id;
  exception when others then
    return jsonb_build_object('ok', false,
      'code', case when sqlstate = 'P0001' then sqlerrm else sqlstate end);
  end;

  select jsonb_build_object(
           'ok', true, 'transaction_id', v_id, 'locale', v_target.locale,
           'amount', t.amount, 'payee', t.payee, 'kind', t.kind,
           'occurred_on', t.occurred_on, 'budget_month', t.budget_month,
           'category', c.name, 'account', a.name,
           'household', h.name)
    into v_result
    from public.transactions t
    join public.categories c on c.id = t.category_id
    join public.accounts a on a.id = t.account_id
    join public.households h on h.id = t.household_id
   where t.id = v_id;
  return v_result;
end;
$$;

-- Tugmalar uchun kategoriyalar (eng ko'p ishlatilgani oldinda).
create or replace function public.telegram_categories(
  p_chat_id bigint,
  p_kind text default 'expense',
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_kind public.category_kind := (case when p_kind = 'income' then 'income' else 'expense' end)::public.category_kind;
begin
  select * into v_target from private.telegram_target(p_chat_id);
  if v_target.household_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_linked');
  end if;
  return jsonb_build_object('ok', true, 'categories', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name) order by x.uses desc, x.sort_order)
      from (
        select c.id, c.name, c.sort_order,
               (select count(*) from public.transactions t
                 where t.category_id = c.id and t.deleted_at is null) as uses
          from public.categories c
         where c.household_id = v_target.household_id and c.kind = v_kind
           and c.deleted_at is null and c.archived_at is null and c.system_code is null
         order by uses desc, c.sort_order
         limit v_limit
      ) x
  ), '[]'::jsonb));
end;
$$;

-- Tugmadan kategoriya tanlash (faqat o'zi bot orqali yozgan amal).
create or replace function public.telegram_set_category(
  p_chat_id bigint,
  p_transaction uuid,
  p_category uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_name text;
begin
  select * into v_target from private.telegram_target(p_chat_id);
  if v_target.household_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_linked');
  end if;
  update public.transactions t
     set category_id = p_category
   where t.id = p_transaction and t.household_id = v_target.household_id
     and t.created_by = v_target.user_id and t.source = 'telegram' and t.deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select c.name into v_name from public.categories c where c.id = p_category;
  return jsonb_build_object('ok', true, 'category', v_name, 'locale', v_target.locale);
end;
$$;

-- "❌ Bekor qilish" — tombstone (sinxron orqali qurilmalarga ham yetadi).
create or replace function public.telegram_undo(p_chat_id bigint, p_transaction uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
begin
  select * into v_target from private.telegram_target(p_chat_id);
  if v_target.household_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_linked');
  end if;
  update public.transactions t
     set deleted_at = now()
   where t.id = p_transaction and t.household_id = v_target.household_id
     and t.created_by = v_target.user_id and t.source = 'telegram' and t.deleted_at is null;
  return jsonb_build_object('ok', found, 'locale', v_target.locale);
end;
$$;

revoke execute on function
  public.telegram_quick_add(bigint, text, bigint, text, date),
  public.telegram_categories(bigint, text, integer),
  public.telegram_set_category(bigint, uuid, uuid),
  public.telegram_undo(bigint, uuid)
from authenticated, anon;
grant execute on function
  public.telegram_quick_add(bigint, text, bigint, text, date),
  public.telegram_categories(bigint, text, integer),
  public.telegram_set_category(bigint, uuid, uuid),
  public.telegram_undo(bigint, uuid)
to service_role;
