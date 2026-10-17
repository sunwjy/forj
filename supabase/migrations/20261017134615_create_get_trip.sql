-- get_trip(token): the trip snapshot for a share token (spec 5.3).
-- The snapshot never exposes trips.id or the token, and items come in the
-- shared order `date, start_time nulls last, created_at, id` (spec 2.4).
-- created_at is formatted as fixed-width UTC with microseconds so the client
-- can order it by plain string comparison and agree with this query.

create or replace function public.get_trip(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_trip private.trips;
begin
  select t.* into v_trip
  from private.trips t
  where t.share_token = get_trip.token;

  if not found then
    raise exception 'TRIP_NOT_FOUND' using detail = 'no trip has this share token';
  end if;

  return jsonb_build_object(
    'title', v_trip.title,
    'start_date', to_char(v_trip.start_date, 'YYYY-MM-DD'),
    'end_date', to_char(v_trip.end_date, 'YYYY-MM-DD'),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'date', to_char(i.date, 'YYYY-MM-DD'),
          'title', i.title,
          'memo', i.memo,
          'start_time', to_char(i.start_time, 'HH24:MI'),
          'end_time', to_char(i.end_time, 'HH24:MI'),
          'emoji', i.emoji,
          'created_at', to_char(i.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        )
        order by i.date, i.start_time nulls last, i.created_at, i.id
      )
      from private.items i
      where i.trip_id = v_trip.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_trip(text) from public, anon, authenticated, service_role;
grant execute on function public.get_trip(text) to anon;
