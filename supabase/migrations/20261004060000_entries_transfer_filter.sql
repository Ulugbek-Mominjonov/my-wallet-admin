-- E24 tuzatish: ro'yxatda faqat byudjetga taalluqli o'tkazmalar qolsin.
-- `private.budget_lines` dagi qoida: o'tkazma ajratma hisoblanadi faqat bir
-- tomoni 👤 shaxsiy fond bo'lsa (BR-061). Hisoblar orasidagi oddiy o'tkazma
-- (karta → naqd, valyuta almashuvi) byudjetga ta'sir qilmaydi va ro'yxatda
-- ko'rinmasligi kerak — aks holda ro'yxat jami hisobotdagi "Xarajat" bilan
-- to'g'ri kelmaydi.
create or replace function private.month_entries(p_household uuid, p_month public.month_start)
returns table (id uuid, line text, occurred_on date, created_at timestamptz,
               amount bigint, name text, category text, account text, note text)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id,
         case
           when t.kind = 'income' then 'income'
           when t.kind = 'transfer' then 'allocation'
           when a.type = 'personal_fund' then 'fund_spent'
           else 'expense'
         end,
         t.occurred_on,
         t.created_at,
         case when t.kind = 'transfer' and a.type = 'personal_fund'
              then -t.amount_base else t.amount_base end,
         case when t.kind = 'transfer'
              then coalesce(ta.name, a.name)
              else coalesce(nullif(t.payee, ''), c.name, a.name) end,
         case when t.kind = 'transfer'
              then (select sys.name from public.categories sys
                     where sys.household_id = t.household_id
                       and sys.system_code = 'personal_allocation')
              else c.name end,
         a.name,
         nullif(t.note, '')
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    left join public.accounts ta on ta.id = t.to_account_id
    left join public.categories c on c.id = t.category_id
   where t.household_id = p_household and t.budget_month = p_month
     and t.deleted_at is null
     and (t.kind <> 'transfer'
          or (a.type = 'personal_fund') <> (ta.type = 'personal_fund'))
$$;
