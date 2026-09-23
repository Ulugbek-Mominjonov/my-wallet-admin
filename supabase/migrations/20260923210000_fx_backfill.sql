-- E29-T01 (BR-192): valyuta kurslarini tarixiy to'ldirish.
--
-- `fx-sync` har kuni joriy kurslarni oladi; bu yerda — orqaga qarab
-- to'ldirish: eng eski yozuv sanasigacha bo'lgan ish kunlari uchun CBU'dan
-- kurs so'raladi. Holat `private` sxemada: klientga (app_bootstrap) tegishli
-- emas.
create table private.fx_state (
  id             boolean primary key default true check (id),
  backfill_until date,
  updated_at     timestamptz not null default now()
);

comment on table private.fx_state is
  'E29-T01: kurslarni tarixiy to''ldirish kursori (qaysi sanagacha ko''rildi).';

/*
 * Keyingi paket: kursordan orqaga, ish kunlari, kursi yo'q sanalar.
 * Natija: {dates: ["YYYY-MM-DD", …], done: boolean}.
 */
create or replace function public.fx_backfill_dates(p_limit integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 60), 1), 200);
  v_first date;
  v_cursor date;
  v_dates jsonb;
begin
  -- Eng eski yozuv sanasi: undan oldingi kurs hech qayerda ishlatilmaydi.
  select min(t.occurred_on) into v_first
    from public.transactions t where t.deleted_at is null;
  if v_first is null then
    return jsonb_build_object('dates', '[]'::jsonb, 'done', true);
  end if;

  select coalesce(s.backfill_until, current_date) into v_cursor from private.fx_state s;
  v_cursor := coalesce(v_cursor, current_date);
  if v_cursor <= v_first then
    return jsonb_build_object('dates', '[]'::jsonb, 'done', true);
  end if;

  select coalesce(jsonb_agg(to_char(x.day, 'YYYY-MM-DD') order by x.day desc), '[]'::jsonb)
    into v_dates
    from (
      select d::date as day
        from generate_series(v_cursor - 1, v_first, interval '-1 day') as d
       -- CBU dam olish kunlarida kurs e'lon qilmaydi.
       where extract(isodow from d) < 6
         and not exists (
           select 1 from public.exchange_rates r where r.rate_date = d::date)
       limit v_limit
    ) x;

  return jsonb_build_object('dates', v_dates, 'done', false);
end;
$$;

-- Paket tugagach kursor shu sanaga suriladi (keyingi chaqiruv undan orqaga).
create or replace function public.fx_backfill_mark(p_until date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.fx_state (id, backfill_until) values (true, p_until)
  on conflict (id) do update
    set backfill_until = least(private.fx_state.backfill_until, excluded.backfill_until),
        updated_at = now();
end;
$$;

-- Faqat server (fx-sync, service kaliti bilan) chaqiradi.
revoke execute on function
  public.fx_backfill_dates(integer), public.fx_backfill_mark(date)
from authenticated, anon;
grant execute on function
  public.fx_backfill_dates(integer), public.fx_backfill_mark(date)
to service_role;
