# AU-3c — Revoke `authenticated` INSERT/UPDATE/DELETE on `public.tally_expenses_snapshot`: caller-impact check (DRAFT)

Status: draft SQL only (`AU3C_REVOKE_AUTH_WRITES.sql`, rollback `AU3C_REVOKE_ROLLBACK.sql`). Not applied. Needs explicit user approval. Independent of #68 and of the AU-3b mode switch.

## Current state (live, read-only, 2026-10-15 ~19:20 IST)
- Grants: postgres (all), service_role (all), **authenticated: SELECT, INSERT, UPDATE, DELETE**. anon: none.
- RLS on (not forced). Single policy `tally_expenses_snapshot_authenticated_crud`: **FOR ALL to authenticated, using/with check `auth.uid() is not null`**. Any logged-in app user can insert, alter or delete cost inputs.
- No triggers. No database function writes the table. Readers: `costing.v_expense_head_monthly_provision`, `costing.v_unmapped_expense_heads_for_costing`, `public.v_mis_expense_position`.

## Proof that no legitimate client path writes it
| Check | Result |
|---|---|
| `pg_stat_statements` writes since stats reset (2026-08-11 22:02 IST, 2 months) | **Only `service_role`**: 125 INSERT + 131 DELETE calls, PostgREST shape (the external Tally ETL worker, delete-by-as_of_date then insert) |
| Any statement at all by `authenticated` or `anon` on the table, same window | **0** |
| Database functions/RPCs that write it | **0** (none reference it with INSERT/UPDATE/DELETE) |
| Repo (`origin/main`) client code `.from('tally_expenses_snapshot')` / rpc | **0**. It appears only in generated `supabase.ts` types and in `.temp/sa2-table-access-scan.json`, where it is listed under `priorityMiss` (not referenced by any client file) |
| Daily ingestion still occurring | Yes, 12–25 rows/day through 2026-10-15, all from the service_role path, which this change does not touch |

Caveats: pg_stat_statements can evict rare statements. Writes from before 2026-08-11 or from a non-repo tool (e.g. the Supabase dashboard as postgres, which is unaffected) are not covered. Desktop or other app builds outside this repo were not inspected. The external worker's credentials were not inspected (by design); its role is inferred from the statement log.

## Effect
- Logged-in users keep **read** access (new SELECT-only policy). Views and MIS are unaffected (they keep SELECT).
- The ETL is unaffected (service_role bypasses RLS and keeps its grants).
- Any hidden end-user write path would fail with `permission denied`. Rollback restores the exact prior grants and policy in one transaction.

## Local verification
Run on the local PG17 parity DB, seeded with the live ACL (`seed-live-acl-local.sql`). After the revoke: authenticated INSERT is refused (`permission denied`), authenticated SELECT still works, and service_role INSERT still works. After the rollback, grants and policy are IDENTICAL to before (`RESULTS-AU3C-2026-10-15.txt`).
