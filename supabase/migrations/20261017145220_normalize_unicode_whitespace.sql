-- Whitespace normalization that matches the client (spec 5.4).
-- btrim(x) strips only the ASCII space, so a title of tabs or ideographic
-- spaces was stored, and a memo of newlines was kept. Whitespace here is every
-- character JavaScript's String.prototype.trim() strips: the ECMAScript
-- WhiteSpace and LineTerminator sets.
--
-- Titles are trimmed. A memo is not trimmed: it is stored as written unless it
-- is empty or only whitespace, in which case it is stored as null.

create or replace function private.trim_whitespace(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(value, E'\t\n\x0b\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff');
$$;

revoke all on function private.trim_whitespace(text)
  from public, anon, authenticated, service_role;

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
  title := private.trim_whitespace(title);
  if title is null or char_length(title) not between 1 and max_title_length then
    raise exception 'INVALID_INPUT' using detail = 'title';
  end if;

  if private.trim_whitespace(memo) = '' then
    memo := null;
  end if;
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

create or replace function public.create_trip(title text, start_date date, end_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_title_length constant int := 100;
  max_period_days constant int := 30;
  v_title text := private.trim_whitespace(title);
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

create or replace function public.update_trip_title(token text, title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_title_length constant int := 100;
  v_title text := private.trim_whitespace(title);
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
