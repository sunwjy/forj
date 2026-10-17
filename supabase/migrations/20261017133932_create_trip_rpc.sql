-- create_trip: checks the kill switch and the input, stores the trip, and
-- returns only its share token (spec 3, 5.3, 5.4, 5.5, 8).
-- Limits are constants here so redefining the function changes them.

create or replace function public.create_trip(title text, start_date date, end_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_title_length constant int := 100;
  max_period_days constant int := 30;
  v_title text := btrim(title);
  v_token text;
begin
  if not (select s.trip_creation_enabled from private.app_settings s) then
    raise exception 'TRIP_CREATION_DISABLED'
      using detail = 'Trip creation is switched off in private.app_settings.';
  end if;

  if v_title is null or char_length(v_title) not between 1 and max_title_length then
    raise exception 'INVALID_INPUT' using detail = 'title';
  end if;

  if start_date is null or end_date is null
     or end_date < start_date
     or end_date - start_date + 1 > max_period_days then
    raise exception 'INVALID_PERIOD'
      using detail = format('A trip lasts 1 to %s days.', max_period_days);
  end if;

  -- 128 random bits as unpadded base64url: 22 characters.
  v_token := rtrim(
    translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'),
    '=');

  insert into private.trips (share_token, title, start_date, end_date)
  values (v_token, v_title, create_trip.start_date, create_trip.end_date);

  return v_token;
end;
$$;

revoke execute on function public.create_trip(text, date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.create_trip(text, date, date) to anon;
