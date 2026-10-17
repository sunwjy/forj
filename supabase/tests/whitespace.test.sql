-- Whitespace normalization (spec 5.4) treats every character the client's
-- String.prototype.trim() strips as whitespace, not only the ASCII space:
-- titles are trimmed, a memo that is only whitespace is stored as null, and
-- any other memo is stored as written.
begin;

select plan(13);

insert into private.trips (id, share_token, title, start_date, end_date)
values ('40000000-0000-4000-8000-000000000001', 'whitespaceTripToken000', '공백', '2026-11-20', '2026-11-22');

set local role anon;

-- Trip titles ----------------------------------------------------------------

select throws_ok(
  $$select public.create_trip(E'\t\n\r\u3000\u00a0\ufeff', '2026-11-20', '2026-11-22')$$,
  'P0001', 'INVALID_INPUT', 'create_trip rejects a title of tabs, newlines and Unicode spaces');

create temp table created on commit drop as
  select public.create_trip(E'\t\u3000오사카\n\u2003', '2026-11-20', '2026-11-22') as token;

select is(
  public.get_trip((select token from created))->>'title', '오사카',
  'create_trip trims tabs, newlines and Unicode spaces from the title');

select throws_ok(
  $$select public.update_trip_title('whitespaceTripToken000', E'\n\t\u3000')$$,
  'P0001', 'INVALID_INPUT', 'update_trip_title rejects a whitespace-only title');

select lives_ok(
  $$select public.update_trip_title('whitespaceTripToken000', E'\u3000교토 \t')$$,
  'update_trip_title accepts a padded title');

select is(
  public.get_trip('whitespaceTripToken000')->>'title', '교토',
  'update_trip_title trims Unicode spaces and tabs');

-- Item titles and memos ------------------------------------------------------

select throws_ok(
  $$select public.create_item('whitespaceTripToken000', '40000000-0000-4000-8000-000000000101',
      '2026-11-20', E'\t\u3000\n', null, null, null, null)$$,
  'P0001', 'INVALID_INPUT', 'create_item rejects a whitespace-only title');

select lives_ok(
  $$select public.create_item('whitespaceTripToken000', '40000000-0000-4000-8000-000000000101',
      '2026-11-20', E'\u3000라멘\t', E'\n\t\u3000\u00a0', null, null, null)$$,
  'create_item accepts a padded title and a whitespace-only memo');

select is(
  public.get_trip('whitespaceTripToken000')->'items'->0->>'title', '라멘',
  'create_item trims the title');

select is(
  public.get_trip('whitespaceTripToken000')->'items'->0->'memo', 'null'::jsonb,
  'create_item stores a memo of tabs, newlines and Unicode spaces as null');

select lives_ok(
  $$select public.update_item('whitespaceTripToken000', '40000000-0000-4000-8000-000000000101',
      jsonb_build_object('memo', E'\n  2터미널\n짐 맡기기  \n'))$$,
  'update_item accepts a memo with whitespace at its edges');

select is(
  public.get_trip('whitespaceTripToken000')->'items'->0->>'memo', E'\n  2터미널\n짐 맡기기  \n',
  'a memo with other text is stored as written, edges included');

select lives_ok(
  $$select public.update_item('whitespaceTripToken000', '40000000-0000-4000-8000-000000000101',
      jsonb_build_object('memo', E'\u2028\t'))$$,
  'update_item accepts a whitespace-only memo');

select is(
  public.get_trip('whitespaceTripToken000')->'items'->0->'memo', 'null'::jsonb,
  'update_item stores a whitespace-only memo as null');

reset role;

select * from finish();
rollback;
