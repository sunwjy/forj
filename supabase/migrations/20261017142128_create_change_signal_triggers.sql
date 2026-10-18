-- Change signals (spec 5.6, ADR 0002). After every statement that touches
-- trips or items, send one empty `changed` broadcast per affected trip on the
-- public topic `trip:<token>`. Clients take it only as a hint to refetch.
--
-- Postgres allows transition tables only on single-event triggers, so each
-- table gets three triggers (insert, update, delete) sharing one function.
-- The functions are security definer because only postgres may execute
-- realtime.send.

create or replace function private.signal_trips_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  -- On delete the trip is gone, so the token comes from the old rows.
  if tg_op = 'DELETE' then
    for v_token in select distinct o.share_token from old_rows o loop
      perform realtime.send('{}'::jsonb, 'changed', 'trip:' || v_token, false);
    end loop;
  else
    for v_token in select distinct n.share_token from new_rows n loop
      perform realtime.send('{}'::jsonb, 'changed', 'trip:' || v_token, false);
    end loop;
  end if;
  return null;
end;
$$;

create or replace function private.signal_items_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  -- Items deleted by a trip's cascade find no trip here and are skipped;
  -- the trips trigger signals that trip.
  if tg_op = 'DELETE' then
    for v_token in
      select distinct t.share_token from old_rows o join private.trips t on t.id = o.trip_id
    loop
      perform realtime.send('{}'::jsonb, 'changed', 'trip:' || v_token, false);
    end loop;
  else
    for v_token in
      select distinct t.share_token from new_rows n join private.trips t on t.id = n.trip_id
    loop
      perform realtime.send('{}'::jsonb, 'changed', 'trip:' || v_token, false);
    end loop;
  end if;
  return null;
end;
$$;

revoke execute on function private.signal_trips_changed() from public, anon, authenticated, service_role;
revoke execute on function private.signal_items_changed() from public, anon, authenticated, service_role;

create trigger trips_signal_insert after insert on private.trips
  referencing new table as new_rows
  for each statement execute function private.signal_trips_changed();
create trigger trips_signal_update after update on private.trips
  referencing new table as new_rows
  for each statement execute function private.signal_trips_changed();
create trigger trips_signal_delete after delete on private.trips
  referencing old table as old_rows
  for each statement execute function private.signal_trips_changed();

create trigger items_signal_insert after insert on private.items
  referencing new table as new_rows
  for each statement execute function private.signal_items_changed();
create trigger items_signal_update after update on private.items
  referencing new table as new_rows
  for each statement execute function private.signal_items_changed();
create trigger items_signal_delete after delete on private.items
  referencing old table as old_rows
  for each statement execute function private.signal_items_changed();
