-- create_item, update_item, delete_item: the item writes (spec 5.3, 5.4, 5.5, 6.1).
-- Writes that place an item on a date lock the trip row first, so they cannot
-- race a period change into leaving an item outside the trip (ADR 0003).
-- Limits are constants here so redefining the functions changes them.

-- Validates and normalizes item fields shared by create_item and update_item.
-- Raises INVALID_INPUT with the field name in detail; returns the cleaned values.
create or replace function private.check_item_fields(
  inout title text,
  inout memo text,
  start_time time,
  end_time time,
  emoji text
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  max_title_length constant int := 100;
  max_memo_length constant int := 2000;
  max_emoji_length constant int := 16;
begin
  title := btrim(title);
  if title is null or char_length(title) not between 1 and max_title_length then
    raise exception 'INVALID_INPUT' using detail = 'title';
  end if;

  memo := nullif(btrim(memo), '');
  if char_length(memo) > max_memo_length then
    raise exception 'INVALID_INPUT' using detail = 'memo';
  end if;

  -- `time` accepts 24:00 and fractional seconds; items use whole minutes of a day.
  if start_time is not null
     and (start_time > '23:59' or extract(second from start_time) <> 0) then
    raise exception 'INVALID_INPUT' using detail = 'start_time';
  end if;
  if end_time is not null
     and (start_time is null or end_time > '23:59' or extract(second from end_time) <> 0) then
    raise exception 'INVALID_INPUT' using detail = 'end_time';
  end if;

  -- Whether the emoji is one grapheme is checked only by the client (spec 5.4).
  if emoji is not null and char_length(emoji) not between 1 and max_emoji_length then
    raise exception 'INVALID_INPUT' using detail = 'emoji';
  end if;
end;
$$;

revoke all on function private.check_item_fields(text, text, time, time, text)
  from public, anon, authenticated, service_role;

-- create_item: the client generates the id, so a retried request is a no-op.
create or replace function public.create_item(
  token text,
  id uuid,
  date date,
  title text,
  memo text,
  start_time time,
  end_time time,
  emoji text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_items constant int := 500;
  v_trip private.trips;
  v_existing_trip_id uuid;
  v_title text;
  v_memo text;
begin
  select t.* into v_trip
  from private.trips t
  where t.share_token = create_item.token
  for update;

  if not found then
    raise exception 'TRIP_NOT_FOUND' using detail = 'no trip has this share token';
  end if;

  if create_item.id is null then
    raise exception 'INVALID_INPUT' using detail = 'id';
  end if;

  select i.trip_id into v_existing_trip_id
  from private.items i
  where i.id = create_item.id;

  if found then
    if v_existing_trip_id = v_trip.id then
      -- Same trip, same id: an earlier attempt already succeeded.
      return;
    end if;
    raise exception 'INVALID_INPUT' using detail = 'id';
  end if;

  select f.title, f.memo into v_title, v_memo
  from private.check_item_fields(
    create_item.title, create_item.memo,
    create_item.start_time, create_item.end_time, create_item.emoji) f;

  if create_item.date is null then
    raise exception 'INVALID_INPUT' using detail = 'date';
  end if;
  if create_item.date not between v_trip.start_date and v_trip.end_date then
    raise exception 'DATE_OUT_OF_RANGE' using detail = 'the date is outside the trip';
  end if;

  if (select count(*) from private.items i where i.trip_id = v_trip.id) >= max_items then
    raise exception 'ITEM_LIMIT_REACHED'
      using detail = format('A trip holds at most %s items.', max_items);
  end if;

  insert into private.items (id, trip_id, date, title, memo, start_time, end_time, emoji)
  values (
    create_item.id, v_trip.id, create_item.date, v_title, v_memo,
    create_item.start_time, create_item.end_time, create_item.emoji);
end;
$$;

revoke execute on function public.create_item(text, uuid, date, text, text, time, time, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_item(text, uuid, date, text, text, time, time, text) to anon;

-- update_item: applies only the keys present in the patch; null clears a field.
-- start_time and end_time travel together (spec 6.1).
create or replace function public.update_item(token text, item_id uuid, patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip private.trips;
  v_item private.items;
  v_key text;
  v_title text;
  v_memo text;
begin
  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'INVALID_INPUT' using detail = 'patch';
  end if;

  for v_key in select jsonb_object_keys(patch) loop
    if v_key not in ('date', 'title', 'memo', 'start_time', 'end_time', 'emoji') then
      raise exception 'INVALID_INPUT' using detail = v_key;
    end if;
    if jsonb_typeof(patch -> v_key) not in ('string', 'null') then
      raise exception 'INVALID_INPUT' using detail = v_key;
    end if;
  end loop;

  if (patch ? 'start_time') <> (patch ? 'end_time') then
    raise exception 'INVALID_INPUT' using detail = 'start_time';
  end if;

  -- Moving to another date is checked against the period under the trip lock.
  if patch ? 'date' then
    select t.* into v_trip from private.trips t where t.share_token = update_item.token for update;
  else
    select t.* into v_trip from private.trips t where t.share_token = update_item.token;
  end if;

  if not found then
    raise exception 'TRIP_NOT_FOUND' using detail = 'no trip has this share token';
  end if;

  select i.* into v_item
  from private.items i
  where i.id = update_item.item_id and i.trip_id = v_trip.id
  for update;

  if not found then
    raise exception 'ITEM_NOT_FOUND' using detail = 'no item has this id in the trip';
  end if;

  begin
    if patch ? 'date' then v_item.date := (patch ->> 'date')::date; end if;
  exception when others then
    raise exception 'INVALID_INPUT' using detail = 'date';
  end;
  begin
    if patch ? 'start_time' then
      v_item.start_time := (patch ->> 'start_time')::time;
      v_item.end_time := (patch ->> 'end_time')::time;
    end if;
  exception when others then
    raise exception 'INVALID_INPUT' using detail = 'start_time';
  end;
  if patch ? 'title' then v_item.title := patch ->> 'title'; end if;
  if patch ? 'memo' then v_item.memo := patch ->> 'memo'; end if;
  if patch ? 'emoji' then v_item.emoji := patch ->> 'emoji'; end if;

  select f.title, f.memo into v_title, v_memo
  from private.check_item_fields(
    v_item.title, v_item.memo, v_item.start_time, v_item.end_time, v_item.emoji) f;

  if v_item.date is null then
    raise exception 'INVALID_INPUT' using detail = 'date';
  end if;
  if patch ? 'date' and v_item.date not between v_trip.start_date and v_trip.end_date then
    raise exception 'DATE_OUT_OF_RANGE' using detail = 'the date is outside the trip';
  end if;

  if patch = '{}'::jsonb then
    return;
  end if;

  update private.items i
  set date = v_item.date,
      title = v_title,
      memo = v_memo,
      start_time = v_item.start_time,
      end_time = v_item.end_time,
      emoji = v_item.emoji
  where i.id = v_item.id;
end;
$$;

revoke execute on function public.update_item(text, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.update_item(text, uuid, jsonb) to anon;

-- delete_item: deleting an item that is already gone is a success.
create or replace function public.delete_item(token text, item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
begin
  select t.id into v_trip_id from private.trips t where t.share_token = delete_item.token;

  if not found then
    raise exception 'TRIP_NOT_FOUND' using detail = 'no trip has this share token';
  end if;

  delete from private.items i
  where i.id = delete_item.item_id and i.trip_id = v_trip_id;
end;
$$;

revoke execute on function public.delete_item(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_item(text, uuid) to anon;
