# Migration drift check (read-only)

`scripts/migration-drift-check.mjs` compares the live migration history with `supabase/migrations`. It never connects to a database. You give it a JSON export made by a read-only query.

1. Export the live history. Run this as a SELECT-only query, e.g. through the Supabase SQL editor or MCP `execute_sql`, and save the result as `live.json`:
   ```sql
   select json_agg(json_build_object('version',version,'name',name,'statements',statements) order by version)
   from supabase_migrations.schema_migrations;
   ```
2. Run it:
   ```
   node scripts/migration-drift-check.mjs --live-json live.json [--since 20261014000000] [--json]
   ```
3. It reports:
   - `missing_in_repo`: live, but no file for that version or name.
   - `extra_in_repo`: a file not applied live.
   - `renamed`: the same name or content under a different version, such as a server-assigned version.
   - `name_mismatch` and `content_mismatch`: content means the file bytes differ from `statements` joined with `\n`. `whitespace_only` marks differences that are whitespace only.
4. Exit codes: 0 means no drift, 1 means drift, 2 means a usage error.

Files are compared byte-for-byte, so do not reformat backfilled migration files. Use `--since` to scope the check, because the repo does not hold the full pre-2026 history.
