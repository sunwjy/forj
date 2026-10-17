-- update_trip_title, set_trip_dates: editing a trip's title and period
-- (spec 2.6, 5.3, 5.4, 5.5, ADR 0003).
-- Limits are constants here so redefining the functions changes them.

-- update_trip_title: stores the trimmed title.
create or replace function public.update_trip_title(token text, title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_title_length constant int := 100;
  v_title text := btrim(title);
begin
  if v_title is null or char_length(v_title) not between 1 and max_title_length then
    raise exception 'INVALID_INPUT' using detail = 'title';
  end if;

  update private.trips t
  set title = v_title
  where t.share_token = update_trip_title.token;

  if not found then
    raise exception 'TRIP_NOT_FOUND' using detail = 'no trip has this share token';
  end if;
end;
$$;

revoke execute on function public.update_trip_title(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_trip_title(text, text) to anon;

-- set_trip_dates: changes the period and deletes the items on dates that left
-- it, but only if those are exactly the items the user confirmed. Under the
-- trip lock no item write can slip a new item onto a leaving date meanwhile.
-- A null confirmed list means "nothing to delete".
create or replace function public.set_trip_dates(
  token text,
  start_date date,
  end_date date,
  confirmed_deleted_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_period_days constant int := 30;
  v_trip_id uuid;
  v_doomed uuid[];
  v_confirmed uuid[];
begin
  select t.id into v_trip_id
  from private.trips t
  where t.share_token = set_trip_dates.token
  for update;

  if not found then
    raise exception 'TRIP_NOT_FOUND' using detail = 'no trip has this share token';
  end if;

  if set_trip_dates.start_date is null or set_trip_dates.end_date is null
     or set_trip_dates.end_date < set_trip_dates.start_date
     or set_trip_dates.end_date - set_trip_dates.start_date + 1 > max_period_days then
    raise exception 'INVALID_PERIOD'
      using detail = format('A trip lasts 1 to %s days.', max_period_days);
  end if;

  select coalesce(array_agg(i.id order by i.id), '{}') into v_doomed
  from private.items i
  where i.trip_id = v_trip_id
    and i.date not between set_trip_dates.start_date and set_trip_dates.end_date;

  -- Compared as sets: order and duplicates do not matter.
  select coalesce(array_agg(distinct c order by c), '{}') into v_confirmed
  from unnest(confirmed_deleted_ids) c
  where c is not null;

  if v_doomed <> v_confirmed then
    raise exception 'DELETION_MISMATCH'
      using detail = 'the items outside the new period differ from the confirmed ones';
  end if;

  delete from private.items i where i.id = any (v_doomed);

  update private.trips t
  set start_date = set_trip_dates.start_date,
      end_date = set_trip_dates.end_date
  where t.id = v_trip_id;
end;
$$;

revoke execute on function public.set_trip_dates(text, date, date, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.set_trip_dates(text, date, date, uuid[]) to anon;
