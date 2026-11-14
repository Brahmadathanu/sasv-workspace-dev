# PEC release migration matrix, integration order and CLI repair plan (issue #388, Batch D)

**13 Nov 2026 · PLAN/EVIDENCE ONLY. Nothing here was executed against production. No `repair`, `db push`, `db reset`, history DML or replay was run.**
Evidence provenance: source facts (blob SHAs, DDL/ACL/DML inventory, topology) were computed by this session from Git. **Baseline live-effect columns derive from owner-recorded read-only audits R1–R7 (`PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md`). A subsequent independent live read-only check on 14 November 2026 compared migration #2's exact `v_mrp_material_gross_requirement_rm` view SQL to `pg_get_viewdef(..., true)` and found exact whitespace-normalised equality.** Anything not in those audits is UNVERIFIED.

## 1. Eleven-version matrix (one row = one independent owner decision)
`blob` = git blob SHA-1 (first 10) of the file on the branch that carries it (#317/#323 blobs are byte-identical on staging #347 `b97af2b0`; #374's is only on its branch `e2522775`). `Top-level effect` = what runs when the file executes (function bodies are DDL only; counts exclude DML inside function bodies except where noted).

| # | version | blob | top-level effect (DDL / ACL / data) | live effect evidence (R1–R7) | verdict | registered | risks | shortlist for FUTURE owner approval |
|---|---|---|---|---|---|---|---|---|
| 1 | 20261112110000 four-gram BOM | 0c2e5f3e30 | **DATA**: `UPDATE inv_stock_item`, `UPDATE rm_bom_line` (4 masters, 13 BOM tuples); no DDL/ACL | 4/4 masters in g, 13/13 BOM targets, factor 1000, 0 stray UOMs | **PASS (data, bounded)** | NO | data migration: marking applied is only truthful if effect proven *at repair time*; re-run read-only check immediately before | **Candidate** |
| 2 | 20261112114000 UOM / internal PR guard | 36ef982499 | 6 `CREATE OR REPLACE FUNCTION`, **1 `CREATE OR REPLACE VIEW`**; no ACL | function bodies matched (last effective def); **view definition compared live 14 Nov: 1,130 characters each and exact after whitespace normalisation** | **PASS (bounded definition parity)** | NO | current effective bodies may be superseded by later versions; original runtime/roles not thereby proven | **Candidate** – fresh pre-repair check required |
| 3 | 20261112122500 revision / manual-indent guard | dfafbac830 | 2 functions; no DDL/ACL | 2/2 bodies match | **PASS (functions, normalized)** | NO | normalization hides literal-only diffs | **Candidate** |
| 4 | 20261112133000 manual PR guards | 928910a753 | 2 functions; no DDL/ACL | 2/2 bodies match | **PASS (functions, normalized)** | NO | **superseded by R10 (#389) if that applies** – repair this version first, apply R10 as new version | **Candidate** (order matters) |
| 5 | 20261112143000 SAFE resync | 05c6f6cd2c | 1 function; no DDL/ACL | body matches; isolated PG17 SAFE/RESET PASS; **historical data PARTIAL (#383)** | **HOLD** | NO | #383 anomalies undispositioned; behaviour changes under R10 | **NO – HOLD** until #383 disposition |
| 6 | 20261112150000 strict-factor RBAC | b3bd8ae986 | **ACL only** (2 GRANT/REVOKE) | helper SECURITY DEFINER, EXECUTE authenticated+service_role, anon/PUBLIC denied, `inv_uom_conversion` not readable | **PASS (ACL, bounded)** | NO | ACL-only: repair must not hide later ACL drift – re-read ACL at repair time | **Candidate** |
| 7 | 20261112152000 strict-factor rollup | 9fbec18768 | 1 function (body contains MRP table DML, not run at install) | body matches; no live rebuild run | **PASS (function, normalized)** | NO | behavioural MRP effect untested | **Candidate** |
| 8 | 20261112170000 five paged reads | 2555bf1850 | 5 functions + 10 ACL stmts | 5/5 bodies, SECDEF, search_path, ACL | **PASS (bounded)** | NO | JWT execution untested | **Candidate** |
| 9 | 20261112173000 filtered paged reads | e310f8cdfc | 3 functions + 6 ACL | 3/3 | **PASS (bounded)** | NO | same | **Candidate** |
| 10 | 20261112174500 vendor operational | 218424161e | 2 functions + 4 ACL | 2/2 | **PASS (bounded)** | NO | live full-export concurrency untested | **Candidate** |
| 11 | 20261112220000 Add Line wrapper (#374) | 319e517092 (branch only) | 1 function; ACL retained by REPLACE | live wrapper MD5 `a19fabfd…`, ACL verified; body match | **PASS (bounded)** | NO | file not on staging; separate owner approval covered install, **not** registration | **Candidate** (after file lands in the release source) |

Not part of the 11: `20261112050000` (lab), and **proposed, unapplied R10 files** `20261113170715` (guard + lock order), `20261113172424` (preview RPC + new ACL) and `20261114013211` (source-PR reassignment lock prelude, no ACL change) from #389 — they sort after all eleven so a normal forward `db push` applies them after reconciliation.

**Rule:** a version may be repaired only when its row is a PASS, a fresh read-only preflight repeats the check on the day, and the owner approves *that version by number*. No blanket approval; #5 stays HOLD.

## 2. Git integration order / branch topology (minimise replay risk)
Facts (computed): staging #347 `b97af2b0` carries the exact blobs of #317's 7 and #323's 3 migrations (10/10 byte-identical) although neither PR head is an ancestor of staging; #374 (`e2522775`, base `547db163`) is **not** in staging; #385/#389 add only scripts/proposed SQL. `main` is `4a857c02`.
Recommendation (single path, no double-merge): 
1. Do **not** merge #317/#323 to `main` separately — their blobs already live in #347; merging both would duplicate/conflict.
2. Land #374's one migration into staging first via **#392** (current-staging merge of #374 + pinned protected-path exception; identical file, no conflicts) — do not also merge #374 — so the release source contains all 11 files.
3. After owner sign-off of gates: merge **#347 → main once** (one atomic set containing all 11 versions + client). Close #317/#323 as superseded **only on owner decision**.
4. R10 (#389) and client (#390) merge into staging *after* migration history is reconciled, and only after owner approval of the new ACL; they are separate versions and never edit historical files.
5. Hosting deploy hooks must never run `db push` on the already-live versions (see §3).
Until acceptance nothing merges to `main`.

## 3. CLI plan (DRY-RUN / APPROVAL PACKAGE — not executed)
Pinned and inspected in this session: **Supabase CLI 3.1.0** (`npm i supabase@3.1.0`). Flag names differ across majors (older CLIs used `--linked`), so the operator re-checks `--help` on the machine that runs it.
```
supabase migration list --help      # FLAGS: --remote[=<ref|branch|url>]  --password/-p   (read-only)
supabase migration repair --help    # USAGE: supabase migration repair [flags] [<version...>]
                                    # FLAGS: --status <applied|reverted>  --remote[=...]  --password/-p
```
**Never run:** `db push`, `migration up --remote`, `db reset`, `INSERT` into `supabase_migrations.schema_migrations`, multi-version `repair`.
Per approved version `V` (operator terminal, DB password supplied interactively/ENV, never committed):
1. Preflight (read-only): `supabase migration list --remote` → record that `V` is local-only; run the §1 verification for `V` (function-def parity, `has_function_privilege`, data selects) and save timestamped output. Any drift → STOP.
2. Backup: `select version,name,statements from supabase_migrations.schema_migrations order by version` saved to an evidence file.
3. Execute exactly one: `supabase migration repair V --status applied --remote` (history metadata only; no DDL replay).
4. Postflight: `supabase migration list --remote` shows `V` matched and **no other row changed**; re-run the version's checks; compare history snapshot (diff = exactly one new row).
5. Recovery if wrong: `supabase migration repair V --status reverted --remote` (returns it to missing; verified choices `applied|reverted`), then re-snapshot. No data/DDL rollback is involved because repair touches only history.
6. Stop after each version; next version needs a new explicit approval.
Evidence record fields: CLI version, `--help` hash, operator (role only), UTC time, before/after snapshot hashes, check outputs.

## 14 November source-view parity follow-up

Independently inspected `supabase/migrations/20261112114000_pec_uom_and_internal_pr_guard.sql` on PEC staging and retrieved live `pg_get_viewdef('public.v_mrp_material_gross_requirement_rm'::regclass,true)` using read-only Supabase SQL. Removing the source `CREATE OR REPLACE VIEW ... AS` prefix, extra statement semicolon and whitespace yielded **exact equality** (both body texts 1,130 characters before normalization). The original #2 **PARTIAL view-definition** gap is therefore **PASS (bounded current-state view parity)**. This does not establish historical transaction provenance, role-specific behaviour, or authorise a migration history repair. The version remains unregistered, requires new per-version preflight and explicit owner approval. Migration `20261112143000` remains on HOLD under #383.
