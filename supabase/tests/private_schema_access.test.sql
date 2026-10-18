-- The browser reaches the database only through RPCs; the tables in the
-- `private` schema must be unreachable for the API roles (spec 5.1, 5.2).
begin;

select plan(14);

select has_table('private', 'trips', 'private.trips exists');
select has_table('private', 'items', 'private.items exists');
select has_table('private', 'app_settings', 'private.app_settings exists');

select schema_privs_are('private', 'anon', array[]::text[],
  'anon has no privileges on the private schema');
select schema_privs_are('private', 'authenticated', array[]::text[],
  'authenticated has no privileges on the private schema');

set local role anon;

select throws_ok('select * from private.trips', '42501', null,
  'anon cannot read private.trips');
select throws_ok('select * from private.items', '42501', null,
  'anon cannot read private.items');
select throws_ok('select * from private.app_settings', '42501', null,
  'anon cannot read private.app_settings');
select throws_ok(
  $$insert into private.trips (share_token, title, start_date, end_date)
    values ('x', 'x', current_date, current_date)$$,
  '42501', null, 'anon cannot write private.trips');
select throws_ok('update private.app_settings set trip_creation_enabled = false',
  '42501', null, 'anon cannot change private.app_settings');

reset role;
set local role authenticated;

select throws_ok('select * from private.trips', '42501', null,
  'authenticated cannot read private.trips');
select throws_ok('select * from private.items', '42501', null,
  'authenticated cannot read private.items');
select throws_ok('select * from private.app_settings', '42501', null,
  'authenticated cannot read private.app_settings');

reset role;

select results_eq('select trip_creation_enabled from private.app_settings',
  array[true], 'app_settings holds exactly one row with trip creation enabled');

select * from finish();
rollback;
