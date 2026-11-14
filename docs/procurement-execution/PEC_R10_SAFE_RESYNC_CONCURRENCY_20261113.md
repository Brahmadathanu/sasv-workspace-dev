# PEC R10 — SAFE resync collision guard + lock ordering (issue #388, Batch A)

Status: **DRAFT SOURCE + DISPOSABLE-DB EVIDENCE ONLY. Not applied to any live database.** Migration `20261113170715_pec_safe_resync_collision_guard_lock_order.sql` was created with `supabase migration new` (CLI 3.1.0). `20261112143000` and every other historical migration are untouched. The migration issues no GRANT/REVOKE (CI-enforced), so SECURITY DEFINER, owner and ACLs are retained by `CREATE OR REPLACE`; `anon`/`authenticated`/`PUBLIC` privileges are not broadened. #383 stays open and `20261112143000` stays on HOLD.

## Policy implemented (from R8/R9, #385)
SAFE on a draft indent raises SQLSTATE `23514` **before any business write** when an *unmapped* indent line has the same (class,item,UOM) as a positive source-PR final line and `requested_qty` OR `nullif(btrim(manual_reason),'')` differs. Fully matching unmapped line → adopted into the mapping. Independent unmatched manual lines remain. RESET unchanged (destructive; UI must confirm). No approved/issued row is reachable (status gate unchanged).

## Writers inventoried and lock order
| Writer | Locks taken (in order) | Change |
|---|---|---|
| `proc_indent_resync_from_pr_pec_internal` | indent header `FOR UPDATE` → source PR header `FOR SHARE` → indent lines `FOR UPDATE` (by id) | **new** |
| `proc_indent_add_line` wrapper (#374) | indent header `FOR UPDATE` | none (already first-lock compatible) |
| `proc_indent_set_status` / approval | row `UPDATE` on indent header (conflicts with the resync's `FOR UPDATE`) | none |
| `proc_pr_add_line_pec_internal` | PR header `FOR UPDATE` → PR lines | **new** header lock |
| `proc_pr_set_manual_delta_pec_internal` | PR header `FOR UPDATE` (status re-read under lock) → PR line | **new** header lock |
| `proc_indent_set_source_pr` public wrapper (**R10b, new migration `20261114013211`**) | indent header `FOR UPDATE` → new source PR header `FOR SHARE` → delegates unchanged to `_pec_internal` | **new** lock prelude |
| PR status changes (activate/supersede) | row `UPDATE` on PR header (conflicts with resync `FOR SHARE`) | none |

Order is always indent-header → PR-header → lines; PR writers never take an indent header lock, so no cycle exists among these. Row locks only, no table locks, READ COMMITTED retained (the `FOR UPDATE/SHARE` re-check after a wait makes the second statement see the committed row).

### Why adequate / residual gaps (stated, not hidden)
* Adequate: the check→update window in resync is now closed against the guarded Add Line wrapper, status transitions, PR-final edits and PR status flips, and against a second resync of the same indent.
* Gap 1: service-role *internal* callers that insert a **new** indent line without the header lock are outside this contract (existing lines are covered by the line-level lock). Not reachable by `authenticated`.
* Gap 2 (**closed for `proc_indent_set_source_pr` by R10b**, see below): `proc_indent_create_from_pr`, `proc_pr_rebuild_from_mrp` and revision writers are still not re-audited line-by-line; creating a *new* indent cannot cycle (new row).
* Gap 3: tested on PG17 (CI) / PG16 (local) with synthetic schemas; live trigger/RLS/extra triggers on production tables are unverified.

## Test evidence (disposable DB only)
`scripts/pec-r10/run-ci.sh` → `concurrency-harness.sh <guarded|legacy|r9proto>`; workflow `PEC R10 SAFE resync concurrency PG17`. Separate sessions; barrier = advisory lock 777 held by the controller + a test-only statement trigger, with ordering established by polling `pg_stat_activity` wait events (not sleeps).
* Guarded source: S1–S9 (qty/reason/NULL/''/whitespace normalization, adopt, independence, idempotence, RESET, denials mutate nothing via state md5) and T1–T7 (manual-edit vs resync, PR status flip, PR edit+activation, approval, same-indent resync, no unnecessary blocking, 20-round deadlock probe) all PASS.
* **Negative controls (must fail):** `legacy` (143000) fails S1,S2,S3a,S3c,T1(lost manual edit demonstrated),T2–T5,T7; `r9proto` (#385, no locks) fails T1–T5,T7. `run-ci.sh` exits non-zero if a control does *not* fail.
* Local run: PG 16.15 (this container). PG17 exact-head result is recorded on the PR (CI).

## Rollback plan
Forward migration only: re-issue the `20261112143000` / `20261112133000` function bodies via a new `supabase migration new`. No DROP. Apply only after separate owner approval; this PR never applies SQL.

## Apply plan (owner-approved step, NOT executed)
1. Review diff vs live `pg_get_functiondef` for the three functions (body parity + ACL via `pg_proc.proacl`).
2. Apply in a transaction on a staging copy, run harness S/T set against it.
3. Owner approves production apply + history registration separately (see migration reconciliation matrix).

## Batch B server contract — read-only collision preview (proposed, second migration)
`20261113172424_pec_safe_resync_collision_preview_ro.sql` (also CLI-created): `proc_indent_resync_collision_preview(p_indent_id bigint) RETURNS jsonb`, STABLE SECURITY DEFINER, enforces PEC **View** permission server-side, never writes (verified inside a `READ ONLY` transaction), returns for each colliding line the item, indent qty/reason and source-PR final qty/reason plus SAFE/RESET consequence counts; ineligible indents (not draft / no source PR / PR not active) return `eligible=false`. **New ACL**: `REVOKE ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated, service_role` (same pattern as the approved #323 reads) — this needs its own owner approval; it is not covered by the #374 approval. The preview is advisory; the writer re-checks and remains the only authority. Harness tests P1–P5 (content, READ ONLY, preview-vs-writer agreement over 5 states, ineligibility, ACL) PASS on PG16 locally. Item names come from `v_proc_indent_lines_console_ordered` (`stock_item_name`, `uom_code`), which the client already uses; the column names there are **not verified against the live schema** (fixture uses a stub view) — confirm before apply.

## R10b — source-PR reassignment lock contract (`20261114013211_pec_indent_set_source_pr_lock_prelude.sql`)
Finding: `proc_indent_set_source_pr_pec_internal(bigint,bigint,text)` checks indent/PR status **before** taking locks; only its later UPDATE locks the indent, so a concurrent approval, PR status flip, Add Line or resync could commit in between (stale decision). **The internal body is not in the repository** (it predates c8a, which only renamed it), so it is deliberately **not replaced**: business rules and audit metadata stay byte-for-byte. The public wrapper (same signature, `SECURITY DEFINER`, `search_path`, same `require_permission(...,true)` as the c8a template) now takes indent header `FOR UPDATE` then the new PR header `FOR SHARE` *before* delegating, so the internal checks run under those locks. No GRANT/REVOKE (CI-enforced, comments ignored); ACL retained.
Tests (guarded must pass; `legacy`/`r9proto` controls with the unlocked c8a wrapper must fail SR2–SR4): SR1 reassignment waits for an in-flight SAFE resync and the resync maps to one source; SR2 an indent approved in flight is **not** reassigned (control: it IS reassigned — the real defect); SR3 a just-superseded PR cannot become the source; SR4 Add Line cannot slip an unmapped manual line into a freshly PR-linked indent; SR5 unrelated indents not blocked; SR6 20-round four-writer deadlock probe; SR7 signature/default/ACL unchanged; SR8 permission denial happens first, no mutation.
**Honest limits:** the harness uses a *model* of the internal function reconstructed from the owner's read-only description (status checks → pause → UPDATE + link maps); a DB reviewer must confirm the live `pg_get_functiondef` has no additional writers or locks (e.g. line-map mutation, triggers) before apply. **Residual risks:** `service_role`/`postgres` callers can call the `_pec_internal` function or write tables directly and bypass every wrapper lock (authenticated/anon DML is revoked by c8a; internal EXECUTE is revoked from authenticated/anon/PUBLIC); a direct service-role insert of a *new* indent line is not serialized by the header lock and is therefore outside the collision guarantee (existing lines are covered by the line-level lock in resync). Not claimed safe: any caller that does not use the public wrappers.
