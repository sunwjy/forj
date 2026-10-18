-- Change signals (spec 5.6, ADR 0002): every statement that touches trips or
-- items calls realtime.send once per affected trip, on `trip:<token>`, with
-- the `changed` event, an empty payload and a public channel.
--
-- Signals are counted in realtime.messages, which realtime.send writes to.
-- realtime.send swallows its own errors, and the table's daily partitions are
-- created by the Realtime service, so this file needs Realtime running.
begin;

select plan(14);

-- Counts the signals sent since the last call, per topic, and forgets them.
create function pg_temp.take_signals() returns jsonb language plpgsql as $$
declare v jsonb;
begin
  select coalesce(jsonb_object_agg(topic, n), '{}'::jsonb) into v
  from (select topic, count(*)::int as n from realtime.messages
        where topic like 'trip:%' group by topic) s;
  delete from realtime.messages where topic like 'trip:%';
  return v;
end $$;

select ok(
  exists (select 1 from pg_inherits
          where inhparent = 'realtime.messages'::regclass
            and inhrelid::regclass::text = 'realtime.messages_' || to_char(now() at time zone 'utc', 'YYYY_MM_DD')),
  'today''s realtime.messages partition exists (Realtime is running)');

select pg_temp.take_signals();

-- trips: insert / update ----------------------------------------------------

insert into private.trips (id, share_token, title, start_date, end_date)
values
  ('30000000-0000-4000-8000-000000000001', 'signalTripA00000000000', 'A', '2026-11-20', '2026-11-22'),
  ('30000000-0000-4000-8000-000000000002', 'signalTripB00000000000', 'B', '2026-11-20', '2026-11-22');

select is(pg_temp.take_signals(),
  '{"trip:signalTripA00000000000": 1, "trip:signalTripB00000000000": 1}'::jsonb,
  'inserting two trips in one statement signals each trip once');

update private.trips set title = title || '!' where share_token = 'signalTripA00000000000';

select is(pg_temp.take_signals(), '{"trip:signalTripA00000000000": 1}'::jsonb,
  'updating a trip signals that trip once');

-- items: insert / update / delete ---------------------------------------------

insert into private.items (id, trip_id, date, title)
values
  ('30000000-0000-4000-8000-0000000000a1', '30000000-0000-4000-8000-000000000001', '2026-11-20', 'a1'),
  ('30000000-0000-4000-8000-0000000000a2', '30000000-0000-4000-8000-000000000001', '2026-11-20', 'a2'),
  ('30000000-0000-4000-8000-0000000000a3', '30000000-0000-4000-8000-000000000001', '2026-11-21', 'a3'),
  ('30000000-0000-4000-8000-0000000000b1', '30000000-0000-4000-8000-000000000002', '2026-11-20', 'b1');

select is(pg_temp.take_signals(),
  '{"trip:signalTripA00000000000": 1, "trip:signalTripB00000000000": 1}'::jsonb,
  'inserting items of two trips in one statement signals each trip once');

update private.items set title = title || '!'
where trip_id = '30000000-0000-4000-8000-000000000001';

select is(pg_temp.take_signals(), '{"trip:signalTripA00000000000": 1}'::jsonb,
  'updating three items of one trip signals that trip once');

update private.items set title = title || '?';

select is(
  (pg_temp.take_signals() - 'trip:devExampleTrip00000000'),
  '{"trip:signalTripA00000000000": 1, "trip:signalTripB00000000000": 1}'::jsonb,
  'updating items of several trips in one statement signals each trip once');

update private.items set title = 'none' where false;

select is(pg_temp.take_signals(), '{}'::jsonb, 'a statement that touches no row sends nothing');

delete from private.items where id = '30000000-0000-4000-8000-0000000000a3';

select is(pg_temp.take_signals(), '{"trip:signalTripA00000000000": 1}'::jsonb,
  'deleting an item signals its trip once');

-- The RPCs go through the same triggers.
set local role anon;
select public.update_item('signalTripB00000000000', '30000000-0000-4000-8000-0000000000b1', '{"title": "rpc"}');
reset role;

select is(pg_temp.take_signals(), '{"trip:signalTripB00000000000": 1}'::jsonb,
  'an RPC write signals its trip once');

-- The signal itself -----------------------------------------------------------

update private.trips set title = 'shape' where share_token = 'signalTripB00000000000';

select results_eq(
  $$select event, private, payload - 'id', extension from realtime.messages
    where topic = 'trip:signalTripB00000000000'$$,
  $$values ('changed'::text, false, '{}'::jsonb, 'broadcast'::text)$$,
  'the signal is a public `changed` broadcast with an empty payload');

select pg_temp.take_signals();

-- trips: delete -----------------------------------------------------------------

delete from private.trips where share_token = 'signalTripA00000000000';

select is(pg_temp.take_signals(), '{"trip:signalTripA00000000000": 1}'::jsonb,
  'deleting a trip signals it once with the old token; its cascaded items add nothing');

select is((select count(*)::int from private.items where trip_id = '30000000-0000-4000-8000-000000000001'), 0,
  'the cascade removed the deleted trip''s items');

select is(
  (select prosecdef from pg_proc where oid = 'private.signal_trips_changed'::regproc), true,
  'the trips trigger function is security definer (only postgres may call realtime.send)');

select is(
  (select prosecdef from pg_proc where oid = 'private.signal_items_changed'::regproc), true,
  'the items trigger function is security definer');

select * from finish();
rollback;
