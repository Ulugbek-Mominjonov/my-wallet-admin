-- E26-T01 (BR-222): karta xabarnomalari shablonlari — bank botidan forward
-- qilingan xabardan summa, sana, joy va karta oxirgi 4 raqami ajratiladi.
-- Tahlilning o'zi E31 da (telegram-webhook); bu yerda — spravochnik.
--
-- Naqsh — JS (Edge Function) regex'i nomlangan guruhlar bilan:
-- `amount` (majburiy), `date`, `payee`, `card`. Uzunlik cheklangan: naqshni
-- faqat platforma admini yozadi, lekin u foydalanuvchi matniga qo'llanadi.
create table public.card_message_templates (
  id          uuid primary key default private.uuid_v7(),
  bank        public.entity_name not null,
  pattern     text not null check (char_length(pattern) between 8 and 500
                                   and pattern like '%(?<amount>%'),
  kind        public.transaction_kind not null default 'expense' check (kind <> 'transfer'),
  -- Xabardagi summa birligi: `major` — so'm, `minor` — tiyin (BR-001).
  amount_unit text not null default 'major' check (amount_unit in ('major', 'minor')),
  currency    text not null default 'UZS' references public.currencies (code),
  -- Anonimlashtirilgan namuna: shablon nimaga mos kelishini ko'rsatadi.
  sample      text check (char_length(sample) <= 500),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.card_message_templates is
  'BR-222: karta xabarnomasi shablonlari (E31 tahlilchisi uchun; CRUD — E26-T01).';

create trigger card_message_templates_touch before update on public.card_message_templates
  for each row execute function private.touch_updated_at();

alter table public.card_message_templates enable row level security;

-- Boshqa tizim spravochniklaridan farqi: naqshlarni faqat platforma admini
-- ko'radi (klientga kerak emas; bot service kalit bilan ishlaydi).
create policy card_message_templates_admin on public.card_message_templates for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

revoke all on public.card_message_templates from authenticated;
grant select, insert, update, delete on public.card_message_templates to authenticated;
