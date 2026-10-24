-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;
alter extension btree_gist set schema extensions;
alter extension citext set schema extensions;
alter extension pg_trgm set schema extensions;
commit;