-- E27-T05: import bitta tranzaksiyada bajariladi va qatorlar ko'p bo'lsa
-- `authenticated` rolidagi 8 soniyalik chegaraga urilib qolardi (config.toml).
-- O'lchov: 4 yillik byudjet (2 700 xarajat, 180 daromad) — dry-run ~28 s.
-- Shuning uchun faqat shu funksiyaga kengroq chegara beriladi; qolgan
-- so'rovlar avvalgidek 8 soniyada qoladi.
--
-- Funksiya tanasi o'zgarmaydi — faqat `statement_timeout` qo'shiladi.
alter function public.import_legacy_v1(uuid, jsonb, boolean)
  set statement_timeout = '300s';
