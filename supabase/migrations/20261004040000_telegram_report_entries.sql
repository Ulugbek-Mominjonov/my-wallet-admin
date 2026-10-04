-- E31: `/hisobot` xabariga daromad va xarajatlar ro'yxati qo'shiladi —
-- "oyda nima bo'lgani" botda ham ko'rinsin (web hisoboti bilan bir xil
-- manbadan: `private.month_entries`).
--
-- Telegram xabari 4096 belgidan oshmasligi kerak, shuning uchun ro'yxat shu
-- yerda cheklanadi: daromadlar to'liq (odatda kam), xarajatlardan eng
-- kattalari; qolgani soni va jami summasi bilan bitta qatorga yig'iladi.
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
  v_incomes jsonb;
  v_expenses jsonb;
  v_rest record;
  c_income_limit constant integer := 12;
  c_expense_limit constant integer := 15;
begin
  select * into v_target from private.telegram_target(p_chat_id);
  if v_target.household_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_linked');
  end if;
  v_month := coalesce(
    date_trunc('month', p_month::timestamp)::date,
    date_trunc('month', private.household_today(v_target.household_id)::timestamp)::date);

  select * into v_facts from private.month_facts(v_target.household_id, v_month, v_month);

  select coalesce(jsonb_agg(jsonb_build_object(
           'date', e.occurred_on, 'name', e.name, 'amount', e.amount)
           order by e.occurred_on, e.created_at), '[]'::jsonb)
    into v_incomes
    from (select * from private.month_entries(v_target.household_id, v_month)
           where line = 'income' order by occurred_on, created_at
           limit c_income_limit) e;

  select coalesce(jsonb_agg(jsonb_build_object(
           'date', e.occurred_on, 'name', e.name, 'amount', e.amount,
           'from_fund', e.line = 'fund_spent')
           order by e.amount desc), '[]'::jsonb)
    into v_expenses
    from (select * from private.month_entries(v_target.household_id, v_month)
           where line in ('expense', 'fund_spent') order by amount desc
           limit c_expense_limit) e;

  -- Ro'yxatga sig'magan xarajatlar: soni va jami.
  select count(*)::integer as count, coalesce(sum(amount), 0)::bigint as amount
    into v_rest
    from (select amount from private.month_entries(v_target.household_id, v_month)
           where line in ('expense', 'fund_spent') order by amount desc
          offset c_expense_limit) rest;

  return jsonb_build_object(
    'ok', true,
    'locale', v_target.locale,
    'household', (select h.name from public.households h where h.id = v_target.household_id),
    'month', v_month,
    'income', v_facts.income,
    'expense', v_facts.expense,
    'balance', v_facts.income - v_facts.expense,
    'saved', v_facts.income - v_facts.expense + v_facts.allocated - v_facts.fund_spent,
    'unpaid', v_facts.unpaid,
    'incomes', v_incomes,
    'expenses', v_expenses,
    'expenses_rest', jsonb_build_object('count', v_rest.count, 'amount', v_rest.amount));
end;
$$;
