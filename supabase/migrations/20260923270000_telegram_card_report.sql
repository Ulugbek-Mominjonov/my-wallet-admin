-- E31-T02, T03: karta xabarnomasi (BR-222), `/hisobot` va `/til` (BR-221).

-- Karta oxirgi 4 raqami — xabarnomadagi karta shu hisobga moslanadi.
alter table public.accounts add column card_last4 text check (card_last4 ~ '^[0-9]{4}$');

comment on column public.accounts.card_last4 is
  'BR-222: karta xabarnomasidagi oxirgi 4 raqam — hisobni topish uchun.';

grant insert (card_last4), update (card_last4) on public.accounts to authenticated;

-- Bitta karta — bitta hisob: bot xabarnomani aniq hisobga yozadi. Indeks
-- `telegram_quick_add` dagi (household_id, card_last4) qidiruvini ham qoplaydi.
create unique index accounts_card_last4_key on public.accounts (household_id, card_last4)
  where card_last4 is not null and deleted_at is null;

-- Bot uchun faol shablonlar (naqsh JS tomonda qo'llanadi).
create or replace function public.telegram_card_templates()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'bank', t.bank, 'pattern', t.pattern, 'kind', t.kind,
           'amount_unit', t.amount_unit, 'currency', t.currency)
         order by t.sort_order, t.bank), '[]'::jsonb)
    from public.card_message_templates t
   where t.active
$$;

-- Oylik yakun (BR-221 `/hisobot [oy]`): oy berilmasa — joriy oy.
create or replace function public.telegram_report(p_chat_id bigint, p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_month date;
  v_facts record;
begin
  select * into v_target from private.telegram_target(p_chat_id);
  if v_target.household_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_linked');
  end if;
  v_month := coalesce(
    date_trunc('month', p_month::timestamp)::date,
    date_trunc('month', private.household_today(v_target.household_id)::timestamp)::date);

  select * into v_facts from private.month_facts(v_target.household_id, v_month, v_month);
  return jsonb_build_object(
    'ok', true,
    'locale', v_target.locale,
    'household', (select h.name from public.households h where h.id = v_target.household_id),
    'month', v_month,
    'income', v_facts.income,
    'expense', v_facts.expense,
    'balance', v_facts.income - v_facts.expense,
    'saved', v_facts.income - v_facts.expense + v_facts.allocated - v_facts.fund_spent,
    'unpaid', v_facts.unpaid);
end;
$$;

-- `/til uz|ru|en` — profil tili (bot va bildirishnomalar tili).
create or replace function public.telegram_set_locale(p_chat_id bigint, p_locale text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
begin
  if p_locale not in ('uz', 'ru', 'en') then
    return jsonb_build_object('ok', false, 'code', 'invalid_locale');
  end if;
  select * into v_target from private.telegram_target(p_chat_id);
  if v_target.user_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_linked');
  end if;
  update public.profiles set locale = p_locale where user_id = v_target.user_id;
  return jsonb_build_object('ok', true, 'locale', p_locale);
end;
$$;

-- Karta xabarnomasidagi karta raqami bo'yicha hisob (E31-T02).
create or replace function public.telegram_quick_add(
  p_chat_id bigint,
  p_kind text,
  p_amount bigint,
  p_payee text default null,
  p_occurred_on date default null,
  p_card_last4 text default null
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

  -- BR-222: karta raqami bo'yicha hisob (xabarnomada bo'lsa).
  if p_card_last4 is not null then
    select a.id into v_account
      from public.accounts a
     where a.household_id = v_target.household_id and a.deleted_at is null
       and a.card_last4 = p_card_last4
     limit 1;
  end if;

  -- BR-056: shu nom bilan oxirgi amal — kategoriya (va hisob topilmagan bo'lsa — hisob ham).
  if v_payee is not null then
    select t.category_id, coalesce(v_account, t.account_id) into v_category, v_account
      from public.transactions t
     where t.household_id = v_target.household_id and t.kind = v_kind
       and t.deleted_at is null and lower(t.payee) = lower(v_payee)
     order by t.occurred_on desc, t.created_at desc
     limit 1;
  end if;

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

-- Eski imzo (5 argument) endi kerak emas: bot yangisini chaqiradi.
drop function if exists public.telegram_quick_add(bigint, text, bigint, text, date);

revoke execute on function
  public.telegram_quick_add(bigint, text, bigint, text, date, text),
  public.telegram_card_templates(),
  public.telegram_report(bigint, date),
  public.telegram_set_locale(bigint, text)
from authenticated, anon;
grant execute on function
  public.telegram_quick_add(bigint, text, bigint, text, date, text),
  public.telegram_card_templates(),
  public.telegram_report(bigint, date),
  public.telegram_set_locale(bigint, text)
to service_role;
