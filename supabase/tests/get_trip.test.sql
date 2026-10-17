-- get_trip returns the trip snapshot by share token (spec 5.3, 2.4, 5.5).
begin;

select plan(13);

insert into private.trips (id, share_token, title, start_date, end_date)
values ('10000000-0000-4000-8000-000000000001', 'getTripTestToken000000', '정렬 확인', '2026-11-20', '2026-11-21');

-- Inserted out of order. Expected order: date, start_time nulls last, created_at, id.
insert into private.items (id, trip_id, date, title, memo, start_time, end_time, emoji, created_at)
values
  ('10000000-0000-4000-8000-0000000000f6', '10000000-0000-4000-8000-000000000001',
   '2026-11-21', 'day 2', null, '08:00', null, null, '2026-10-17 00:00:00+00'),
  ('10000000-0000-4000-8000-0000000000f5', '10000000-0000-4000-8000-000000000001',
   '2026-11-20', 'untimed later', null, null, null, null, '2026-10-17 00:00:02+00'),
  ('10000000-0000-4000-8000-0000000000f4', '10000000-0000-4000-8000-000000000001',
   '2026-11-20', 'untimed earlier', null, null, null, null, '2026-10-17 00:00:01+00'),
  ('10000000-0000-4000-8000-0000000000f3', '10000000-0000-4000-8000-000000000001',
   '2026-11-20', 'nine, created later', null, '09:00', null, null, '2026-10-17 00:00:00.000001+00'),
  ('10000000-0000-4000-8000-0000000000f2', '10000000-0000-4000-8000-000000000001',
   '2026-11-20', 'nine, higher id', null, '09:00', null, null, '2026-10-17 00:00:00+00'),
  ('10000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000001',
   '2026-11-20', 'nine, lower id', '메모', '09:00', '01:30', '🍜', '2026-10-17 00:00:00+00'),
  ('10000000-0000-4000-8000-0000000000f0', '10000000-0000-4000-8000-000000000001',
   '2026-11-20', 'dinner', null, '19:00', null, null, '2026-10-16 00:00:00+00');

set local role anon;

select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.get_trip('getTripTestToken000000')) k),
  array['end_date', 'items', 'start_date', 'title'],
  'the snapshot has exactly title, start_date, end_date and items (no internal id or token)');

select is(public.get_trip('getTripTestToken000000')->>'title', '정렬 확인', 'title');
select is(public.get_trip('getTripTestToken000000')->>'start_date', '2026-11-20', 'start_date is YYYY-MM-DD');
select is(public.get_trip('getTripTestToken000000')->>'end_date', '2026-11-21', 'end_date is YYYY-MM-DD');

select is(
  (select array_agg(i->>'title' order by n)
   from jsonb_array_elements(public.get_trip('getTripTestToken000000')->'items') with ordinality as t(i, n)),
  array['nine, lower id', 'nine, higher id', 'nine, created later', 'dinner',
        'untimed earlier', 'untimed later', 'day 2'],
  'items are ordered by date, start_time nulls last, created_at, id');

select is(
  (select array_agg(k order by k)
   from jsonb_object_keys(public.get_trip('getTripTestToken000000')->'items'->0) k),
  array['created_at', 'date', 'emoji', 'end_time', 'id', 'memo', 'start_time', 'title'],
  'each item has exactly the snapshot fields (no trip_id)');

select is(
  public.get_trip('getTripTestToken000000')->'items'->0,
  jsonb_build_object(
    'id', '10000000-0000-4000-8000-0000000000f1', 'date', '2026-11-20', 'title', 'nine, lower id',
    'memo', '메모', 'start_time', '09:00', 'end_time', '01:30', 'emoji', '🍜',
    'created_at', '2026-10-17T00:00:00.000000Z'),
  'item values: times as HH:MM, created_at as fixed-width UTC');

select is(
  public.get_trip('getTripTestToken000000')->'items'->2->>'created_at',
  '2026-10-17T00:00:00.000001Z',
  'created_at keeps microseconds');

select is(
  public.get_trip('getTripTestToken000000')->'items'->4,
  jsonb_build_object(
    'id', '10000000-0000-4000-8000-0000000000f4', 'date', '2026-11-20', 'title', 'untimed earlier',
    'memo', null, 'start_time', null, 'end_time', null, 'emoji', null,
    'created_at', '2026-10-17T00:00:01.000000Z'),
  'empty optional fields are JSON null');

reset role;
insert into private.trips (share_token, title, start_date, end_date)
values ('getTripEmptyToken00000', '빈 여행', '2026-12-01', '2026-12-01');
set local role anon;

select is(public.get_trip('getTripEmptyToken00000')->'items', '[]'::jsonb,
  'a trip without items has an empty items array');

select throws_ok($$select public.get_trip('noSuchTripToken0000000')$$, 'P0001', 'TRIP_NOT_FOUND',
  'an unknown token raises TRIP_NOT_FOUND');
select throws_ok($$select public.get_trip(null)$$, 'P0001', 'TRIP_NOT_FOUND',
  'a null token raises TRIP_NOT_FOUND');

reset role;
set local role authenticated;

select throws_ok($$select public.get_trip('getTripTestToken000000')$$, '42501', null,
  'only anon may execute get_trip');

reset role;

select * from finish();
rollback;
