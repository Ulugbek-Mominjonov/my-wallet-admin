-- E29-T07 (mobil, BR-191): kurslarni lokal bazaga olish uchun bitta RPC.
--
-- Jadvalning o'zi ham o'qishga ochiq (RLS: `exchange_rates_select`), lekin
-- mobil klient faqat RPC bilan ishlaydi (ARXITEKTURA 5). `p_since` — klient
-- oxirgi olgan sana: har sinxronda faqat yangi qatorlar keladi.
create or replace function public.fx_rates(p_since date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
           jsonb_agg(jsonb_build_object('currency', e.currency,
                                        'rate_date', e.rate_date,
                                        'rate_to_base', e.rate_to_base)
                     order by e.currency, e.rate_date),
           '[]'::jsonb)
    from public.exchange_rates e
   where e.rate_date >= p_since
$$;

comment on function public.fx_rates(date) is
  'BR-191: `p_since` dan boshlab valyuta kurslari (mobil lokal nusxasi uchun).';

grant execute on function public.fx_rates(date) to authenticated;
