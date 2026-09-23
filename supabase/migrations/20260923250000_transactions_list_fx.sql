-- E29-T04: amallar ro'yxatida qo'llangan kurs ham qaytadi — tahrirlashda
-- forma o'sha kursni ko'rsatadi (BR-193). Ustun qo'shiladi, qolgani o'zgarmaydi.
--
-- `returns table` o'zgargani uchun avval o'chiriladi (ustun qo'shish
-- `create or replace` bilan mumkin emas).
drop function if exists public.transactions_list(uuid, jsonb, date, uuid, integer);

create function public.transactions_list(
  p_household uuid,
  p_filters jsonb default '{}',
  p_after_date date default null,
  p_after_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  kind public.transaction_kind,
  account_id uuid,
  to_account_id uuid,
  amount bigint,
  to_amount bigint,
  amount_base bigint,
  fx_rate numeric,
  category_id uuid,
  payee text,
  occurred_on date,
  budget_month date,
  budget_month_source public.budget_month_source,
  planned_item_id uuid,
  debt_id uuid,
  note text,
  source public.transaction_source,
  created_by uuid,
  tag_ids uuid[],
  has_receipt boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.kind, t.account_id, t.to_account_id, t.amount, t.to_amount, t.amount_base,
         t.fx_rate, t.category_id, t.payee, t.occurred_on, t.budget_month, t.budget_month_source,
         t.planned_item_id, t.debt_id, t.note, t.source, t.created_by,
         coalesce((select array_agg(x.tag_id order by x.tag_id)
                     from public.transaction_tags x
                    where x.transaction_id = t.id and x.deleted_at is null), '{}'),
         exists (select 1 from public.attachments a
                  where a.transaction_id = t.id and a.deleted_at is null)
    from private.transactions_page(
           p_household,
           coalesce(p_filters, '{}'),
           coalesce(p_after_date, 'infinity'::date),
           coalesce(p_after_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid),
           -- 1000 — PostgREST max_rows: UI 50 tadan, CSV eksport 1000 tadan oladi.
           least(greatest(coalesce(p_limit, 50), 1), 1000)) t
   order by t.occurred_on desc, t.id desc
$$;

grant execute on function public.transactions_list(uuid, jsonb, date, uuid, integer) to authenticated;
