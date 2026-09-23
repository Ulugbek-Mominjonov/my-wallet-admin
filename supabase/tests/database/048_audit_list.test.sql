-- E25-T05: audit jurnali ro'yxati — filtr (jadval, a'zo, davr), keyset
-- sahifalash, huquq. Qoidalar: BR-008, BR-011.
begin;
select plan(8);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'member');

-- O'zgarish: yangi teg, keyin nomi tahrirlanadi (update — faqat o'zgargan maydon).
insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'Bozor');
insert into ref select 'tag', t.id from public.tags t
  where t.household_id = (select id from ref where name = 'h') and t.name = 'Bozor';
update public.tags set name = 'Bozorlik' where id = (select id from ref where name = 'tag');

select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));
select throws_ok(
  $$ select * from public.audit_list((select id from ref where name = 'h')) $$,
  'P0001', 'forbidden', 'BR-011: audit jurnali — owner/admin'
);

select tests.authenticate_as((select id from u where name = 'alice'));

select is(
  (select count(*) from public.audit_list((select id from ref where name = 'h'),
                                          p_tables => array['tags'])),
  2::bigint,
  'BR-008: jadval filtri — teg qo''shildi va tahrirlandi'
);
select results_eq(
  $$ select action, old_values ->> 'name', new_values ->> 'name'
       from public.audit_list((select id from ref where name = 'h'), p_tables => array['tags'])
      order by id $$,
  $$ values ('insert', null, 'Bozor'), ('update', 'Bozor', 'Bozorlik') $$,
  'BR-008: update''da faqat o''zgargan maydon — eski va yangi qiymat bilan'
);
select is(
  (select count(*) from public.audit_list((select id from ref where name = 'h'),
                                          p_actors => array[(select id from u where name = 'bob')])),
  1::bigint,
  'a''zo filtri — bob faqat taklifni qabul qilgan'
);

-- Keyset: birinchi sahifa 1 ta, keyingisi undan keyingi (takrorlanmaydi).
create temporary table page (n int, id bigint, at timestamptz) on commit drop;
grant all on page to authenticated;
insert into page
  select 1, a.id, a.at from public.audit_list((select id from ref where name = 'h'), p_limit => 1) a;
insert into page
  select 2, a.id, a.at
    from public.audit_list((select id from ref where name = 'h'), p_limit => 1,
                           p_after_at => (select at from page where n = 1),
                           p_after_id => (select id from page where n = 1)) a;
select is(
  (select count(distinct id) from page), 2::bigint,
  'keyset: ikkinchi sahifa birinchisini takrorlamaydi'
);
select ok(
  (select id from page where n = 1) > (select id from page where n = 2),
  'tartib — eng yangisi birinchi'
);
select is(
  (select count(*) from public.audit_list((select id from ref where name = 'h'),
                                          p_from => (current_date + 1))),
  0::bigint,
  'davr filtri: ertangi kundan — bo''sh'
);
select is(
  (select count(*) from public.audit_list((select id from ref where name = 'h'),
                                          p_from => current_date, p_to => current_date,
                                          p_tables => array['tags'])),
  2::bigint,
  'davr filtri: `p_to` kuni ham kiradi (byudjet vaqt zonasida)'
);

select * from finish();
rollback;
