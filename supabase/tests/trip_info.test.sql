-- update_trip_title and set_trip_dates (spec 2.6, 5.3, 5.5, ADR 0003).
begin;

select plan(26);

insert into private.trips (id, share_token, title, start_date, end_date)
values
  ('30000000-0000-4000-8000-000000000001', 'tripInfoTestToken00000', '오사카', '2026-11-20', '2026-11-23'),
  ('30000000-0000-4000-8000-000000000002', 'tripInfoOtherToken0000', '다른 여행', '2026-11-20', '2026-11-20');

insert into private.items (id, trip_id, date, title)
values
  ('30000000-0000-4000-8000-0000000000a0', '30000000-0000-4000-8000-000000000001', '2026-11-20', '첫날'),
  ('30000000-0000-4000-8000-0000000000a1', '30000000-0000-4000-8000-000000000001', '2026-11-21', '둘째 날'),
  ('30000000-0000-4000-8000-0000000000a2', '30000000-0000-4000-8000-000000000001', '2026-11-23', '마지막 날 1'),
  ('30000000-0000-4000-8000-0000000000a3', '30000000-0000-4000-8000-000000000001', '2026-11-23', '마지막 날 2'),
  ('30000000-0000-4000-8000-0000000000b0', '30000000-0000-4000-8000-000000000002', '2026-11-20', '다른 여행의 일정');

set local role anon;

-- update_trip_title --------------------------------------------------------

select lives_ok(
  $$select public.update_trip_title('tripInfoTestToken00000', '  오사카 먹방  ')$$,
  'update_trip_title changes the title');

select is(public.get_trip('tripInfoTestToken00000')->>'title', '오사카 먹방', 'the title is trimmed');

select throws_ok(
  $$select public.update_trip_title('tripInfoTestToken00000', '   ')$$,
  'P0001', 'INVALID_INPUT', 'a blank title');

select throws_ok(
  $$select public.update_trip_title('tripInfoTestToken00000', null)$$,
  'P0001', 'INVALID_INPUT', 'a missing title');

select lives_ok(
  $$select public.update_trip_title('tripInfoTestToken00000', repeat('가', 100))$$,
  'a 100 code point title');

select throws_ok(
  $$select public.update_trip_title('tripInfoTestToken00000', repeat('가', 101))$$,
  'P0001', 'INVALID_INPUT', 'a 101 code point title');

select throws_ok(
  $$select public.update_trip_title('noSuchTripToken0000000', '제목')$$,
  'P0001', 'TRIP_NOT_FOUND', 'update_trip_title on an unknown token');

select is(public.get_trip('tripInfoOtherToken0000')->>'title', '다른 여행', 'other trips keep their title');

-- set_trip_dates: INVALID_PERIOD ---------------------------------------------

select throws_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-23', '2026-11-20', '{}')$$,
  'P0001', 'INVALID_PERIOD', 'the end date before the start date');

select throws_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-01', '2026-12-01', '{}')$$,
  'P0001', 'INVALID_PERIOD', 'a period of 31 days');

select throws_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', null, '2026-11-23', '{}')$$,
  'P0001', 'INVALID_PERIOD', 'a missing start date');

select throws_ok(
  $$select public.set_trip_dates('noSuchTripToken0000000', '2026-11-20', '2026-11-23', '{}')$$,
  'P0001', 'TRIP_NOT_FOUND', 'set_trip_dates on an unknown token');

-- set_trip_dates: extending ----------------------------------------------------

select lives_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-19', '2026-11-25', '{}')$$,
  'extending the period at both ends needs no confirmed deletions');

select is(
  (select jsonb_build_array(t->'start_date', t->'end_date', jsonb_array_length(t->'items'))
   from public.get_trip('tripInfoTestToken00000') t),
  '["2026-11-19", "2026-11-25", 4]'::jsonb,
  'the period grows and every item stays');

select lives_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-01', '2026-11-30', null)$$,
  'a 30 day period, with a null list meaning nothing to delete');

-- set_trip_dates: DELETION_MISMATCH ---------------------------------------------

select throws_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-20', '2026-11-22', '{}')$$,
  'P0001', 'DELETION_MISMATCH', 'shrinking past items without confirming them');

select throws_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-20', '2026-11-22',
      '{30000000-0000-4000-8000-0000000000a2}')$$,
  'P0001', 'DELETION_MISMATCH', 'confirming only some of the items that would go');

select throws_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-20', '2026-11-22',
      '{30000000-0000-4000-8000-0000000000a2,30000000-0000-4000-8000-0000000000a3,30000000-0000-4000-8000-0000000000a1}')$$,
  'P0001', 'DELETION_MISMATCH', 'confirming an item that would stay');

select throws_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-20', '2026-11-22',
      '{30000000-0000-4000-8000-0000000000a2,30000000-0000-4000-8000-0000000000a3,30000000-0000-4000-8000-0000000000b0}')$$,
  'P0001', 'DELETION_MISMATCH', 'confirming an item of another trip');

select is(
  (select jsonb_build_array(t->'start_date', t->'end_date', jsonb_array_length(t->'items'))
   from public.get_trip('tripInfoTestToken00000') t),
  '["2026-11-01", "2026-11-30", 4]'::jsonb,
  'a mismatch changes nothing');

-- set_trip_dates: shrinking ------------------------------------------------------

select lives_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-20', '2026-11-22',
      '{30000000-0000-4000-8000-0000000000a3,30000000-0000-4000-8000-0000000000a2,30000000-0000-4000-8000-0000000000a3}')$$,
  'confirming exactly the items that go, in any order and with duplicates');

select is(
  (select jsonb_build_array(t->'start_date', t->'end_date') from public.get_trip('tripInfoTestToken00000') t),
  '["2026-11-20", "2026-11-22"]'::jsonb,
  'the period shrinks');

select is(
  (select array_agg(i->>'title' order by i->>'date')
   from jsonb_array_elements(public.get_trip('tripInfoTestToken00000')->'items') i),
  array['첫날', '둘째 날'],
  'items on the dates that left are deleted and the rest stay');

select lives_ok(
  $$select public.set_trip_dates('tripInfoTestToken00000', '2026-11-21', '2026-11-21',
      '{30000000-0000-4000-8000-0000000000a0}')$$,
  'shrinking from the start to a single day');

select is(
  (select array_agg(i->>'title') from jsonb_array_elements(public.get_trip('tripInfoTestToken00000')->'items') i),
  array['둘째 날'],
  'the item before the new start is deleted');

select is(
  jsonb_array_length(public.get_trip('tripInfoOtherToken0000')->'items'), 1,
  'other trips keep their items');

select * from finish();
rollback;
