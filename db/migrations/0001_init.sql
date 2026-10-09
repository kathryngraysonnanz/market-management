-- 0001_init.sql
-- Baseline schema for Market Management.
--
-- Forward-only: never edit this file after it has been applied to any database. The
-- migration runner stores a SHA-256 checksum of every applied file and will fail the next
-- run if the content changes. Correct a mistake with a new, higher-numbered migration.
--
-- Applied inside a single transaction by scripts/migrate.ts. Do not add BEGIN/COMMIT here.

-- Keeps updated_at honest without application code having to remember.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- The root entity. Every future feature (weather by location, budgets, email integration
-- state) is scoped to a market, so this is the one table the baseline needs.
create table if not exists markets (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  timezone    text        not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger markets_set_updated_at
  before update on markets
  for each row execute function set_updated_at();
