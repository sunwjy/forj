-- A trip holds at most 500 items (spec 2.1, 5.3), and the item RPCs are anon-only (spec 5.2).
begin;

select plan(6);

insert into private.trips (id, share_token, title, start_date, end_date)
values ('30000000-0000-4000-8000-000000000001', 'itemLimitTripToken0000', '꽉 찬 여행', '2026-11-20', '2026-11-20');

insert into private.items (id, trip_id, date, title)
select gen_random_uuid(), '30000000-0000-4000-8000-000000000001', '2026-11-20', 'item ' || n
from generate_series(1, 499) n;

set local role anon;

select lives_ok(
  $$select public.create_item('itemLimitTripToken0000', '30000000-0000-4000-8000-000000000500',
      '2026-11-20', '500번째', null, null, null, null)$$,
  'the 500th item fits');

select throws_ok(
  $$select public.create_item('itemLimitTripToken0000', '30000000-0000-4000-8000-000000000501',
      '2026-11-20', '501번째', null, null, null, null)$$,
  'P0001', 'ITEM_LIMIT_REACHED', 'the 501st item is rejected');

select lives_ok(
  $$select public.create_item('itemLimitTripToken0000', '30000000-0000-4000-8000-000000000500',
      '2026-11-20', '500번째', null, null, null, null)$$,
  'retrying a create that already succeeded still succeeds at the limit');

reset role;
set local role authenticated;

select throws_ok(
  $$select public.create_item('itemLimitTripToken0000', '30000000-0000-4000-8000-000000000502',
      '2026-11-20', 'x', null, null, null, null)$$,
  '42501', null, 'only anon may execute create_item');
select throws_ok(
  $$select public.update_item('itemLimitTripToken0000', '30000000-0000-4000-8000-000000000500', '{}')$$,
  '42501', null, 'only anon may execute update_item');
select throws_ok(
  $$select public.delete_item('itemLimitTripToken0000', '30000000-0000-4000-8000-000000000500')$$,
  '42501', null, 'only anon may execute delete_item');

reset role;

select * from finish();
rollback;
