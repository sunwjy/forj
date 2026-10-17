-- Tables live in a schema that PostgREST does not expose. The browser reaches
-- them only through `security definer` RPCs in `public` (spec 4, 5.1, 5.2).
-- The database enforces only PK, FK, not null and unique; RPCs validate values.

create schema private;

revoke all on schema private from public, anon, authenticated;

create table private.trips (
  id uuid primary key default gen_random_uuid(),
  share_token text not null unique,
  title text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create table private.items (
  id uuid primary key,
  trip_id uuid not null references private.trips (id) on delete cascade,
  date date not null,
  title text not null,
  memo text,
  start_time time,
  end_time time,
  emoji text,
  created_at timestamptz not null default now()
);

create index items_trip_id_idx on private.items (trip_id);

create table private.app_settings (
  trip_creation_enabled boolean not null
);

insert into private.app_settings (trip_creation_enabled) values (true);

revoke all on all tables in schema private from public, anon, authenticated;
alter default privileges in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema private
  revoke all on functions from public, anon, authenticated;
alter default privileges in schema private
  revoke all on sequences from public, anon, authenticated;
