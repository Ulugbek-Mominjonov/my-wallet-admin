-- E03-T05: health() — keep-alive va smoke testlar uchun.
begin;
select plan(4);

select tests.authenticate_as_anon();
select is((public.health() ->> 'ok')::boolean, true, 'health(): anon chaqira oladi, ok=true');
select is((public.health() ->> 'schema_version')::int, 1, 'health(): shartnoma versiyasi');
select isnt(public.health() ->> 'time', null, 'health(): server vaqti');
select tests.clear_authentication();

select ok(
  has_function_privilege('anon', 'public.health()', 'execute'),
  'anon health() ni chaqira oladi (keep-alive publishable kalit bilan)'
);

select * from finish();
rollback;
