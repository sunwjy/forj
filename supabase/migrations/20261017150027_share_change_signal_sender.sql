-- Change signals (spec 5.6, ADR 0002): one sender for the four loops the
-- trigger functions repeated. The triggers stay as they are; only their
-- functions are redefined.

-- Sends one empty `changed` broadcast on the public topic `trip:<token>` for
-- each distinct token. Only the trigger functions, which run as postgres, call it.
create or replace function private.signal_trips(tokens text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  for v_token in select distinct t from unnest(tokens) as t where t is not null loop
    perform realtime.send('{}'::jsonb, 'changed', 'trip:' || v_token, false);
  end loop;
end;
$$;

revoke execute on function private.signal_trips(text[]) from public, anon, authenticated, service_role;

create or replace function private.signal_trips_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- On delete the trip is gone, so the token comes from the old rows.
  if tg_op = 'DELETE' then
    perform private.signal_trips(array(select o.share_token from old_rows o));
  else
    perform private.signal_trips(array(select n.share_token from new_rows n));
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
begin
  -- Items deleted by a trip's cascade find no trip here and are skipped;
  -- the trips trigger signals that trip.
  if tg_op = 'DELETE' then
    perform private.signal_trips(array(
      select t.share_token from old_rows o join private.trips t on t.id = o.trip_id));
  else
    perform private.signal_trips(array(
      select t.share_token from new_rows n join private.trips t on t.id = n.trip_id));
  end if;
  return null;
end;
$$;
