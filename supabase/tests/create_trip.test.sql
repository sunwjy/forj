-- create_trip checks the kill switch and the input, then returns only a
-- share token (spec 3, 5.3, 5.4, 5.5, 8).
begin;

select plan(17);

-- Callers

select function_privs_are('public', 'create_trip', array['text', 'date', 'date'],
  'anon', array['EXECUTE'], 'anon can execute create_trip');
select function_privs_are('public', 'create_trip', array['text', 'date', 'date'],
  'authenticated', array[]::text[], 'authenticated cannot execute create_trip');

-- Success

set local role anon;

create temp table created on commit drop as
  select public.create_trip('  오사카 먹방 여행  ', '2026-11-20', '2026-11-23') as token;

reset role;

select matches((select token from created), '^[A-Za-z0-9_-]{22}$',
  'returns a 22-character base64url token');
select results_eq(
  $$select t.title, t.start_date, t.end_date
      from private.trips t join created c on t.share_token = c.token$$,
  $$values ('오사카 먹방 여행'::text, '2026-11-20'::date, '2026-11-23'::date)$$,
  'stores the trimmed title and the period under the token');

set local role anon;

select lives_ok($$select public.create_trip('당일치기', '2026-11-20', '2026-11-20')$$,
  'a one-day trip is allowed');
select lives_ok($$select public.create_trip('한 달', '2026-11-01', '2026-11-30')$$,
  'a 30-day trip is allowed');
select lives_ok($$select public.create_trip('지난 여행', '2001-01-01', '2001-01-02')$$,
  'past dates are allowed');
select lives_ok($$select public.create_trip(repeat('가', 100), '2026-11-20', '2026-11-20')$$,
  'a 100-code-point title is allowed');
select lives_ok($$select public.create_trip(repeat('😀', 100), '2026-11-20', '2026-11-20')$$,
  'title length counts code points, not bytes');
select isnt(public.create_trip('a', '2026-11-20', '2026-11-20'),
  public.create_trip('a', '2026-11-20', '2026-11-20'), 'tokens differ per trip');

-- INVALID_INPUT

select throws_ok($$select public.create_trip('   ', '2026-11-20', '2026-11-20')$$,
  'P0001', 'INVALID_INPUT', 'a blank title is rejected');
select throws_ok($$select public.create_trip(null, '2026-11-20', '2026-11-20')$$,
  'P0001', 'INVALID_INPUT', 'a missing title is rejected');
select throws_ok($$select public.create_trip(repeat('가', 101), '2026-11-20', '2026-11-20')$$,
  'P0001', 'INVALID_INPUT', 'a 101-code-point title is rejected');

-- INVALID_PERIOD

select throws_ok($$select public.create_trip('x', '2026-11-21', '2026-11-20')$$,
  'P0001', 'INVALID_PERIOD', 'an end date before the start date is rejected');
select throws_ok($$select public.create_trip('x', '2026-11-01', '2026-12-01')$$,
  'P0001', 'INVALID_PERIOD', 'a 31-day trip is rejected');
select throws_ok($$select public.create_trip('x', null, '2026-11-20')$$,
  'P0001', 'INVALID_PERIOD', 'a missing date is rejected');

-- TRIP_CREATION_DISABLED

reset role;
update private.app_settings set trip_creation_enabled = false;
set local role anon;

select throws_ok($$select public.create_trip('x', '2026-11-20', '2026-11-20')$$,
  'P0001', 'TRIP_CREATION_DISABLED', 'the kill switch blocks creation');

reset role;

select * from finish();
rollback;
