# Free local test DB (PostgreSQL 17) with schema parity to live
Built 2026-10-15 ~19:15 IST on the Grok box. No paid Supabase branch. No connection string was used: the schema was rebuilt from live DDL fetched **read-only** through catalog functions (`extract.sql`: pg_get_functiondef, pg_get_viewdef, pg_get_constraintdef, pg_get_indexdef, pg_get_triggerdef).

## Rebuild
1. `sudo apt-get install postgresql-17`, then `initdb -D data -U postgres --auth=trust`, then `pg_ctl -D data -o "-p 54329 -k /tmp" start`.
2. Run `extract.sql` read-only against live and save the single JSON value as `live_ddl.json`. It is not committed because it is ~5.6 MB of full schema DDL in a public repo.
3. `createdb costing_local` and `alter database costing_local set timezone='UTC'`. Then run `python3 load.py`. `bootstrap.sql` adds **local stand-ins** for Supabase platform objects: roles, `auth.uid()`, the `cron.job` table and the extensions schema. These are not live DDL.
4. Re-run `extract.sql` on the local DB, save it as `local_ddl.json`, and compare (see `parity.json`).

## Parity proof (scope: schemas costing, public, app_private; md5 of each definition text)
| Kind | Live | Identical | Differ | Missing |
|---|---|---|---|---|
| constraint | 1067 | 1067 | 0 | 0 |
| fk | 478 | 476 | 0 | 2 |
| function | 1075 | 1070 | 0 | 5 |
| index | 688 | 688 | 0 | 0 |
| matview | 11 | 11 | 0 | 0 |
| sequence | 218 | 218 | 0 | 0 |
| table | 310 | 310 | 0 | 0 |
| trigger | 210 | 210 | 0 | 0 |
| type | 7 | 7 | 0 | 0 |
| view | 440 | 428 | 1 | 11 |

**4485/4504 definitions are byte-identical (md5).**

Remainder (explained):
- **18 objects missing.** They depend on schemas outside scope (`hr`, `lab`, `regulatory`): 5 functions, 11 views, 2 FKs.
- **1 view differs** (`public.v_forecast_baseline_effective`): extra-parenthesis deparse only, semantically equal.
- **1 extra local sequence**: an identity sequence whose name is truncated at 63 characters.

No data is loaded. Tests seed synthetic fixtures. To diff the DDL yourself, run `extract.sql` on both databases and compare hashes.
