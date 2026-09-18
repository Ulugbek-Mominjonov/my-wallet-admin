-- E07-T10: chek rasmlari — bucket, storage RLS, attachments va amal bilan
-- birga o'chirish/tiklash. Qoidalar: BR-009, BR-054, BR-201, BR-210.
begin;
select plan(10);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('carol', tests.create_user('carol@test.uz')),
  ('dave',  tests.create_user('dave@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select u.name, p.last_household_id from u join public.profiles p on p.user_id = u.id;
insert into ref select 'card', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'alice') and a.type = 'card';
insert into ref select 'c_kiyim', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'alice') and c.name = 'Kiyim';

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'alice'), 'viewer');
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'alice'), 'expense', (select id from ref where name = 'card'), 25000000,
          (select id from ref where name = 'c_kiyim'), '2026-10-05', '2026-10-01')
  returning id
)
insert into ref select 'tx', id from ins;
-- Fayl yo'li: {household_id}/{transaction_id}/{uuid}.jpg
insert into ref values ('file', gen_random_uuid());
create temporary table p (name text primary key, path text) on commit drop;
grant all on p to authenticated;
insert into p values
  ('own', format('%s/%s/%s.jpg', (select id from ref where name = 'alice'), (select id from ref where name = 'tx'),
                 (select id from ref where name = 'file'))),
  ('foreign', format('%s/%s/%s.jpg', (select id from ref where name = 'dave'), (select id from ref where name = 'tx'),
                     (select id from ref where name = 'file')));
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv));

-- ─── Bucket va storage RLS ─────────────────────────────────────────────────
select tests.clear_authentication();
select results_eq(
  $$ select public, file_size_limit from storage.buckets where id = 'receipts' $$,
  $$ values (false, 1048576::bigint) $$,
  'BR-201: receipts — yopiq bucket, fayl ≤ 1 MB'
);

select tests.authenticate_as((select id from u where name = 'alice'));
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner) values ('receipts', (select path from p where name = 'own'), auth.uid()) $$,
  'a''zo o''z byudjeti papkasiga chek yuklaydi'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner) values ('receipts', (select path from p where name = 'foreign'), auth.uid()) $$,
  '42501', null, 'BR-210: begona byudjet papkasiga yuklab bo''lmaydi'
);

select tests.authenticate_as((select id from u where name = 'carol'));
select isnt_empty(
  $$ select 1 from storage.objects where bucket_id = 'receipts' and name = (select path from p where name = 'own') $$,
  'viewer byudjet cheklarini ko''radi'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('receipts', (select path from p where name = 'own') || '.copy.jpg', auth.uid()) $$,
  '42501', null, 'BR-011: viewer chek yuklay olmaydi'
);

select tests.authenticate_as((select id from u where name = 'dave'));
select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'receipts' and name = (select path from p where name = 'own') $$,
  'BR-210: begona byudjet cheklari ko''rinmaydi'
);

-- ─── Biriktirmalar (BR-054, BR-201) ────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ insert into public.attachments (household_id, transaction_id, storage_path, mime, size_bytes)
     values ((select id from ref where name = 'alice'), (select id from ref where name = 'tx'),
             (select path from p where name = 'foreign'), 'image/jpeg', 120000) $$,
  '23514', null, 'fayl yo''li shu byudjet va shu amalga tegishli'
);
select lives_ok(
  $$ insert into public.attachments (household_id, transaction_id, storage_path, mime, size_bytes)
     values ((select id from ref where name = 'alice'), (select id from ref where name = 'tx'),
             (select path from p where name = 'own'), 'image/jpeg', 120000) $$,
  'BR-054: amalga chek biriktiriladi'
);

update public.transactions set deleted_at = now() where id = (select id from ref where name = 'tx');
select ok(
  (select a.deleted_at = t.deleted_at from public.attachments a join public.transactions t on t.id = a.transaction_id
    where a.transaction_id = (select id from ref where name = 'tx')),
  'BR-201: amal o''chirilsa chek ham o''chirish navbatiga tushadi'
);
update public.transactions set deleted_at = null where id = (select id from ref where name = 'tx');
select ok(
  (select a.deleted_at is null from public.attachments a where a.transaction_id = (select id from ref where name = 'tx')),
  'BR-009: amal tiklansa (undo) cheki ham qaytadi'
);

select * from finish();
rollback;
