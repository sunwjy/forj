-- create_item, update_item and delete_item (spec 5.3, 5.4, 5.5).
begin;

select plan(50);

insert into private.trips (id, share_token, title, start_date, end_date)
values
  ('20000000-0000-4000-8000-000000000001', 'itemTestTripToken00000', '일정 확인', '2026-11-20', '2026-11-22'),
  ('20000000-0000-4000-8000-000000000002', 'itemOtherTripToken0000', '다른 여행', '2026-11-20', '2026-11-22');

insert into private.items (id, trip_id, date, title)
values ('20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000002', '2026-11-20', '다른 여행의 일정');

set local role anon;

-- create_item --------------------------------------------------------------

select lives_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '2026-11-20', '  라멘  ', '   ', '12:00', '13:30', '🍜')$$,
  'create_item stores a new item');

select is(
  (public.get_trip('itemTestTripToken00000')->'items'->0) - 'created_at',
  jsonb_build_object(
    'id', '20000000-0000-4000-8000-000000000101', 'date', '2026-11-20', 'title', '라멘',
    'memo', null, 'start_time', '12:00', 'end_time', '13:30', 'emoji', '🍜'),
  'the title is trimmed and a blank memo is stored as null');

select lives_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '2026-11-21', '다른 내용', null, null, null, null)$$,
  'creating the same id in the same trip again succeeds');

select is(
  public.get_trip('itemTestTripToken00000')->'items'->0->>'title', '라멘',
  'a repeated create does not compare or overwrite the content (idempotent)');

select is(jsonb_array_length(public.get_trip('itemTestTripToken00000')->'items'), 1,
  'a repeated create adds nothing');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-0000000000a1',
      '2026-11-20', '훔치기', null, null, null, null)$$,
  'P0001', 'INVALID_INPUT', 'an id that exists in another trip is rejected');

select throws_ok(
  $$select public.create_item('noSuchTripToken0000000', '20000000-0000-4000-8000-000000000102',
      '2026-11-20', '제목', null, null, null, null)$$,
  'P0001', 'TRIP_NOT_FOUND', 'create_item on an unknown token');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000102',
      '2026-11-19', '전날', null, null, null, null)$$,
  'P0001', 'DATE_OUT_OF_RANGE', 'a date before the trip');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000102',
      '2026-11-23', '다음 날', null, null, null, null)$$,
  'P0001', 'DATE_OUT_OF_RANGE', 'a date after the trip');

select lives_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000102',
      '2026-11-22', '마지막 날', null, '20:00', '01:00', null)$$,
  'the last day is in range, and an end time before the start time means the next day');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', null,
      '2026-11-20', '제목', null, null, null, null)$$,
  'P0001', 'INVALID_INPUT', 'a missing id');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000103',
      null, '제목', null, null, null, null)$$,
  'P0001', 'INVALID_INPUT', 'a missing date');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000103',
      '2026-11-20', '   ', null, null, null, null)$$,
  'P0001', 'INVALID_INPUT', 'a blank title');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000103',
      '2026-11-20', repeat('가', 101), null, null, null, null)$$,
  'P0001', 'INVALID_INPUT', 'a title over 100 characters');

select lives_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000103',
      '2026-11-20', repeat('가', 100), repeat('메', 2000), null, null, null)$$,
  'a 100 character title and a 2,000 character memo');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000104',
      '2026-11-20', '제목', repeat('메', 2001), null, null, null)$$,
  'P0001', 'INVALID_INPUT', 'a memo over 2,000 characters');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000104',
      '2026-11-20', '제목', null, '09:00:30', null, null)$$,
  'P0001', 'INVALID_INPUT', 'a start time with seconds');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000104',
      '2026-11-20', '제목', null, '09:00', '10:00:01', null)$$,
  'P0001', 'INVALID_INPUT', 'an end time with seconds');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000104',
      '2026-11-20', '제목', null, '24:00', null, null)$$,
  'P0001', 'INVALID_INPUT', '24:00 is not a time of day');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000104',
      '2026-11-20', '제목', null, null, '10:00', null)$$,
  'P0001', 'INVALID_INPUT', 'an end time without a start time');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000104',
      '2026-11-20', '제목', null, null, null, '')$$,
  'P0001', 'INVALID_INPUT', 'an empty emoji');

select throws_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000104',
      '2026-11-20', '제목', null, null, null, repeat('😀', 17))$$,
  'P0001', 'INVALID_INPUT', 'an emoji over 16 code points');

select lives_ok(
  $$select public.create_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000104',
      '2026-11-20', '가족', null, null, null, '👨‍👩‍👧‍👦')$$,
  'a multi code point emoji (7 code points)');

-- update_item --------------------------------------------------------------

select lives_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"title": "  돈코츠 라멘 ", "memo": "  줄 서기  "}')$$,
  'update_item changes the fields in the patch');

select is(
  (public.get_trip('itemTestTripToken00000')->'items'->0) - 'created_at',
  jsonb_build_object(
    'id', '20000000-0000-4000-8000-000000000101', 'date', '2026-11-20', 'title', '돈코츠 라멘',
    'memo', '  줄 서기  ', 'start_time', '12:00', 'end_time', '13:30', 'emoji', '🍜'),
  'the title is trimmed, the memo is kept as written and fields without a key are kept');

select lives_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"memo": null, "emoji": null, "start_time": "18:00", "end_time": null}')$$,
  'null clears a field');

select is(
  (public.get_trip('itemTestTripToken00000')->'items'->0) - 'created_at',
  jsonb_build_object(
    'id', '20000000-0000-4000-8000-000000000101', 'date', '2026-11-20', 'title', '돈코츠 라멘',
    'memo', null, 'start_time', '18:00', 'end_time', null, 'emoji', null),
  'memo, emoji and end time are cleared');

select lives_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"memo": "   "}')$$,
  'a blank memo in a patch');
select is(
  public.get_trip('itemTestTripToken00000')->'items'->0->'memo', 'null'::jsonb,
  'a blank memo in a patch is stored as null');

select lives_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"date": "2026-11-22"}')$$,
  'moving an item to another day of the trip');
select is(
  (select i->>'date' from jsonb_array_elements(public.get_trip('itemTestTripToken00000')->'items') i
   where i->>'id' = '20000000-0000-4000-8000-000000000101'),
  '2026-11-22', 'the item moved');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"date": "2026-11-23"}')$$,
  'P0001', 'DATE_OUT_OF_RANGE', 'moving an item outside the trip');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"start_time": "09:00"}')$$,
  'P0001', 'INVALID_INPUT', 'start_time without end_time');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"end_time": "09:00"}')$$,
  'P0001', 'INVALID_INPUT', 'end_time without start_time');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"start_time": null, "end_time": "09:00"}')$$,
  'P0001', 'INVALID_INPUT', 'clearing the start time but keeping an end time');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"title": null}')$$,
  'P0001', 'INVALID_INPUT', 'the title cannot be cleared');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"date": null}')$$,
  'P0001', 'INVALID_INPUT', 'the date cannot be cleared');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"date": "11월 20일"}')$$,
  'P0001', 'INVALID_INPUT', 'a date that does not parse');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"start_time": "아침", "end_time": null}')$$,
  'P0001', 'INVALID_INPUT', 'a time that does not parse');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"title": 3}')$$,
  'P0001', 'INVALID_INPUT', 'a value that is not a string');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '{"trip_id": "20000000-0000-4000-8000-000000000002"}')$$,
  'P0001', 'INVALID_INPUT', 'a key that is not an item field');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101',
      '["title"]')$$,
  'P0001', 'INVALID_INPUT', 'a patch that is not an object');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-0000000000ff', '{"title": "x"}')$$,
  'P0001', 'ITEM_NOT_FOUND', 'updating an item that does not exist');

select throws_ok(
  $$select public.update_item('itemTestTripToken00000', '20000000-0000-4000-8000-0000000000a1', '{"title": "x"}')$$,
  'P0001', 'ITEM_NOT_FOUND', 'updating an item of another trip');

select throws_ok(
  $$select public.update_item('noSuchTripToken0000000', '20000000-0000-4000-8000-000000000101', '{"title": "x"}')$$,
  'P0001', 'TRIP_NOT_FOUND', 'update_item on an unknown token');

-- delete_item --------------------------------------------------------------

select lives_ok(
  $$select public.delete_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101')$$,
  'delete_item removes an item');
select lives_ok(
  $$select public.delete_item('itemTestTripToken00000', '20000000-0000-4000-8000-000000000101')$$,
  'deleting an item that is already gone succeeds');
select lives_ok(
  $$select public.delete_item('itemTestTripToken00000', '20000000-0000-4000-8000-0000000000a1')$$,
  'deleting an item of another trip succeeds without touching it');

reset role;
select is(
  (select array_agg(id::text order by id) from private.items
   where id in ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-0000000000a1')),
  array['20000000-0000-4000-8000-0000000000a1'],
  'only the item of this trip was deleted');
set local role anon;

select throws_ok(
  $$select public.delete_item('noSuchTripToken0000000', '20000000-0000-4000-8000-000000000101')$$,
  'P0001', 'TRIP_NOT_FOUND', 'delete_item on an unknown token');

reset role;

select * from finish();
rollback;
