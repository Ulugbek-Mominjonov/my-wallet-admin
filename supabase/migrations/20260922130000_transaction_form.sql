-- E23-T02: admin amal formasi. Amal va uning teglari bitta tranzaksiyada
-- (`save_transaction`); joy nomi avto-to'ldirish (BR-056).

-- Yaratish (p_id yo'q) yoki to'liq tahrirlash — forma holati butunicha.
-- Security invoker: RLS, ustun grant'lari va amal triggeri (havolalar, tegishli
-- oy, asosiy valyuta, oy qulfi) odatdagidek ishlaydi. Teglar — ro'yxatdagilar
-- qoladi/qo'shiladi, qolganlari o'chiriladi (tombstone, sinxron uchun).
create or replace function public.save_transaction(
  p_household uuid,
  p_kind public.transaction_kind,
  p_account_id uuid,
  p_amount bigint,
  p_occurred_on date,
  p_to_account_id uuid default null,
  p_to_amount bigint default null,
  p_fx_rate numeric default null,
  p_category_id uuid default null,
  p_payee text default null,
  p_budget_month date default null,
  p_planned_item_id uuid default null,
  p_debt_id uuid default null,
  p_note text default null,
  p_tag_ids uuid[] default '{}',
  -- Tahrirlanadigan amal; yo'q — yangi.
  p_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  -- Oy berilsa — qo'lda tanlangan (BR-042), aks holda trigger hisoblaydi
  -- (yangi qatorda sana oyi — faqat NOT NULL uchun o'rinbosar).
  v_source public.budget_month_source :=
    (case when p_budget_month is null then 'auto' else 'manual' end)::public.budget_month_source;
  v_month date := coalesce(p_budget_month, date_trunc('month', p_occurred_on::timestamp)::date);
begin
  if p_household not in (select private.my_writable_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.transactions (household_id, kind, account_id, to_account_id, amount, to_amount, fx_rate,
                                     category_id, payee, occurred_on, budget_month, budget_month_source,
                                     planned_item_id, debt_id, note, source)
    values (p_household, p_kind, p_account_id, p_to_account_id, p_amount, p_to_amount, p_fx_rate,
            p_category_id, nullif(btrim(p_payee), ''), p_occurred_on, v_month, v_source,
            p_planned_item_id, p_debt_id, nullif(btrim(p_note), ''), 'manual')
    returning id into v_id;
  else
    update public.transactions t
       set kind = p_kind, account_id = p_account_id, to_account_id = p_to_account_id,
           amount = p_amount, to_amount = p_to_amount, fx_rate = p_fx_rate,
           category_id = p_category_id, payee = nullif(btrim(p_payee), ''),
           occurred_on = p_occurred_on, budget_month_source = v_source,
           -- Avto rejimda saqlangan oy qoladi: trigger faqat kirishlar (tur,
           -- kategoriya, sana, reja) o'zgarsa qayta hisoblaydi — izoh tahriri
           -- eski daromadni yangi siljishga ko'chirmaydi (BR-043).
           budget_month = coalesce(p_budget_month, t.budget_month),
           planned_item_id = p_planned_item_id, debt_id = p_debt_id, note = nullif(btrim(p_note), '')
     where t.household_id = p_household and t.id = p_id and t.deleted_at is null
    returning t.id into v_id;
    if v_id is null then
      raise exception 'transaction_not_found' using errcode = 'P0001';
    end if;
  end if;

  update public.transaction_tags x
     set deleted_at = now()
   where x.transaction_id = v_id and x.deleted_at is null
     and x.tag_id <> all (coalesce(p_tag_ids, '{}'));
  insert into public.transaction_tags (household_id, transaction_id, tag_id)
  select p_household, v_id, tag_id from unnest(coalesce(p_tag_ids, '{}')) as tag_id
  on conflict (transaction_id, tag_id) where deleted_at is null do nothing;

  return v_id;
end;
$$;

-- BR-056: joy nomi tarixdan — har nom bir marta, oxirgi kategoriya va hisobi
-- bilan; boshidan mos kelganlari oldin, keyin eng so'nggi ishlatilgan.
-- Security definer: RLS ostida trgm indeksi ishlamaydi (E23-T01 bilan bir xil
-- sabab); a'zolik aniq tekshiriladi.
create or replace function public.payee_suggestions(
  p_household uuid,
  p_query text,
  p_kind public.transaction_kind default 'expense',
  p_limit integer default 8
)
returns table (payee text, category_id uuid, account_id uuid, last_used date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query
  select s.payee::text, s.category_id, s.account_id, s.occurred_on
    from (
      select distinct on (lower(t.payee)) t.payee, t.category_id, t.account_id, t.occurred_on
        from public.transactions t
       where t.household_id = p_household and t.deleted_at is null and t.kind = p_kind
         and t.payee ilike private.like_pattern(btrim(p_query))
       order by lower(t.payee), t.occurred_on desc, t.id desc
    ) s
   -- like_pattern '%q%' → 'q%' (ekranlangan) — boshidan mos kelishi.
   order by s.payee ilike substr(private.like_pattern(btrim(p_query)), 2) desc, s.occurred_on desc, s.payee
   limit least(greatest(coalesce(p_limit, 8), 1), 20);
end;
$$;

grant execute on function
  public.save_transaction(uuid, public.transaction_kind, uuid, bigint, date, uuid, bigint, numeric,
                          uuid, text, date, uuid, uuid, text, uuid[], uuid),
  public.payee_suggestions(uuid, text, public.transaction_kind, integer)
to authenticated;
