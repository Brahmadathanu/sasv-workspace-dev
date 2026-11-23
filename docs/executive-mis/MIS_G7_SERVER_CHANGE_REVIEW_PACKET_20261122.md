# Executive MIS G7 — Exact server change review packet (22 November 2026)

**STATUS: REVIEW-ONLY. NOT INSTALLED. NO PRODUCTION AUTHORIZATION.**
Repository: `Brahmadathanu/sasv-workspace-dev`. Supabase: `qhmoqtxpeasamtlxaoak`. Existing sole browser monetary RPC: `public.get_mis_production_value_summary(date,date)`.
Owner has approved G7 C1–C3/T1–T3 business rules, latest eligible APPROVED costing reference and locked finalized valuation receipts, **not production SQL**.
This packet is an **exact bounded proposed delta and rollback/fixture contract**, not a runnable migration or a claim that SQL was syntax-tested. Store all future migration sources under the repository's real Supabase migration naming convention, allocated only at implementation authorization. Do **not** run snippets against production.

## A. Baseline and authoritative sources

1. Existing canonical RPC definition inspected from `pg_get_functiondef`: `STABLE SECURITY DEFINER`, `SET search_path TO 'pg_catalog','pg_temp'`, `auth.uid()` and `public.app_has_permission('module:executive-mis-dashboard','view')` before data access. `anon` EXECUTE false; `authenticated` true. It currently selects `(report_month - 1 month)` approved run, and computes **FG bulk receipt** reference subtotal, not C1 formal completed-output or SKU transfer manufacturing COP. Formal completion, plan achievement and log reconciliation deliberately NULL/NOT_VERIFIED.
2. Approved source: `costing.v_costing_period_run_status` with `approved_run_id`, `period_start`, `approved_run_valuation_date`; cross-check `costing.v_costing_run_effective_designation` latest designation `APPROVED`, and `costing.costing_refresh_run.overall_status='SUCCESS'`, `valuation_context_source='CAPTURED_AT_REQUEST'`. Current deterministic read-only result: Oct run **143**, valuation **2026-10-22**; Nov run 152 DRAFT; Sep 122 approved.
3. SKU reference: `costing.sku_internal_loaded_cost_snapshot` with `refresh_run_id, sku_id, manufacturing_cop_per_sku, manufacturing_cop_status, pack_size, pack_uom`, unique indexed `(refresh_run_id,sku_id)`. Six of seven Nov exception SKU IDs have a READY row in approved run143; SKU1350 absent. No rate from draft may be substituted.
4. Tally evidence: `public.tally_fg_transfer_voucher_lines` carries `as_of_date,voucher_date,transfer_store,voucher_guid,inventory_line_no,batch_line_no,batch_code,qty_value,qty_unit_text,transfer_amount`. The existing reconciled SKU projection is `public.v_fg_transfer_reconciliation`, **too expensive for an unbounded browser RPC**. Use a source-indexed bounded transfer cohort only after proving identity, grouping and latest snapshot semantics.
5. A name-scoped catalogue scan did not reveal an existing finalized MIS valuation receipt table; this does **not** prove no alternate store exists. Confirm against whole schema and repository before any new table.

## B. Proposed server change sets (separate, narrowly gated)

### G7-S1: private approved-run resolver — additive, no new public RPC

Inside existing permission-guarded MIS function (or a **private non-exposed schema helper** with no anon/authenticated EXECUTE), replace the immediate-previous-month lookup with the following **exact proposed SQL selection block**, applied only after owner authorization, SQL diff review and performance proof:

```sql
SELECT s.approved_run_id,
       s.period_start,
       s.approved_run_valuation_date
INTO v_run, v_reference_cost_period, v_valuation
FROM costing.v_costing_period_run_status AS s
JOIN costing.v_costing_run_effective_designation AS d
  ON d.refresh_run_id = s.approved_run_id
 AND d.period_start = s.period_start
 AND d.designation = 'APPROVED'
JOIN costing.costing_refresh_run AS r
  ON r.id = s.approved_run_id
 AND r.period_start = s.period_start
 AND r.overall_status = 'SUCCESS'
 AND r.valuation_context_source = 'CAPTURED_AT_REQUEST'
WHERE s.approved_run_id IS NOT NULL
  AND s.period_start <= v_eligible_cost_period_upper_bound
ORDER BY s.period_start DESC, s.approved_run_id DESC
LIMIT 1;
```

**Declaration changes:** `v_reference_cost_period date`, `v_eligible_cost_period_upper_bound date`. For latest-current-reference report, set eligible upper bound server-side to first of current IST month; never permit client-provided run ID. A selected newer approved run will automatically replace older reference on subsequent live requests. For historic report generated today, clearly identify this as today's approved-cost **revaluation**; do not assert that today's run was approved on the original historical date. For a deliberately time-limited as-known historical valuation, use an immutable finalized receipt, *not* the current effective designation view.

**No-approval branch:** retain NULL covered reference and comparable status; add explicit reason `NO_APPROVED_REFERENCE`; preserve existing response fields for current callers.

**G7-S1 gate:** synthetic approved Sep122/Oct143/Nov draft152 -> 143; synthetic later Nov APPROVED -> newer run; revoke newer -> nearest still-approved fallback; revoke all -> N/A. Test period cutoff, concurrent approval, and cache freshness. Do not mutate real `costing_run_designation` to simulate fixtures.

### G7-S2: SKU transfer reference valuation — additive field only

Proposed **server-only** mapping pipeline:
1. Identify single latest **complete** Tally snapshot at/before requested as-of; select only voucher dates inside requested IST report month, preserve `as_of_date` and `voucher_guid` plus line identity. Before using as of a prior date, verify complete snapshot semantics; an as-of timestamp alone does not reproduce historic source mutation state.
2. Resolve each original transfer line to exact `sku_id` using the **existing tested Tally->SKU mapping**, not product-name string guesses and not a whole-history full join. The reviewed six voucher groups have mapped SKU 892/969/1091/1271/1273/1308; Anulomana SP873 has 1350. Never multiply quantities if same voucher contains split lines (Chirattai July example 479+1), duplicate inventory lines or multiple stores.
3. Join on `costing.sku_internal_loaded_cost_snapshot.refresh_run_id=v_run AND sku_id=canonical_sku_id`; accept only `manufacturing_cop_status='READY'`, non-null nonnegative cost, pack size/UOM matching SKU's authoritative definition, and reliable source quantity as **pack count**. *Do not multiply a normalized Kg value by a per-pack rate.*
4. Value each covered line `pack_count * manufacturing_cop_per_sku`. For uncovered: `NULL` and reason `SKU_NOT_IN_APPROVED_RUN`, `SKU_UNMAPPED`, `RATE_REVIEW_REQUIRED`, `RATE_BLOCKED`, `PACK_UOM_MISMATCH`, `QTY_NOT_PACK_COUNT` or `NO_APPROVED_REFERENCE`. Do not use drafts, internal loaded cost including admin, MRP or Tally book value as COP.
5. Return **additive** top-level `approved_cost_reference` JSON from the existing RPC:
```json
{
  "valuation_kind": "TALLY_TRANSFER_AT_LATEST_APPROVED_MANUFACTURING_COP_REFERENCE",
  "reference_run_id": 143,
  "reference_cost_period": "2026-10-01",
  "reference_valuation_date": "2026-10-22",
  "evaluated_at_ist": "<server generated>",
  "tally_snapshot_as_of": "<actual>",
  "covered_reference_subtotal": null,
  "covered_line_count": 0,
  "uncovered_line_count": 0,
  "total_source_line_count": 0,
  "coverage_status": "NOT_CHECKED",
  "transfer_log_reconciliation": "NOT_CHECKED"
}
```
The numbers/nulls above are **schema examples, not actual live results**. No completed production or achievement assertion from this transfer reference; keep source reconciliation independent. Large raw batch/voucher details should stay server-only, not exposed in aggregate RPC. Never report a partial subtotal as full coverage.

**G7-S2 gate:** prove same source cohort (lines, stores, snapshot as-of) as existing Tally book subtotal, avoid unbounded `v_fg_transfer_reconciliation` fanout, verify UOM and duplicate/reversal behavior, 6/7 inspected SKU fixture, and 8-second authenticated timeout with actual p95 budget.

### G7-S3: immutable report finalization receipt — **separate writer, separately gated**

Do **NOT** add a finalized-receipt write to the dashboard's STABLE read RPC. Proposed **private-schema** table concept only; exact DDL requires final authority, FK/retention, immutable trigger and concurrency review:

```text
mis_report_valuation_receipt:
  receipt_id uuid primary key (server generated)
  report_kind text, report_month date, report_as_of_date date
  finalized_at timestamptz, finalized_by canonical server-derived principal
  reference_cost_period date, approved_cost_run_id bigint
  reference_valuation_date date, reference_selected_at timestamptz
  tally_snapshot_as_of date, source_fingerprint text
  source_event_count bigint, covered_line_count bigint, uncovered_line_count bigint
  frozen_report_payload jsonb, frozen_payload_digest text
  report_contract_version text, supersedes_receipt_id uuid nullable
  idempotency_token text unique
```

**Transaction:** permitted actor only with separate finalize permission; verify current approved designation and report/source fingerprint *at finalization*; store **full frozen approved aggregate values and coverage**, not just cost run ID; single transaction + idempotent retry; never update/delete a finalized receipt; revaluation creates a new receipt referencing original; enforce immutable report ownership/permissions. When older cost snapshots are pruned under Costing Suite retention, frozen receipt remains an independently interpretable outcome. Do not create orphaned FKs to soon-deleted run rows without an agreed retention protocol.

**G7-S3 gate:** owner authorizes durable writer and finalization workflow *separately*. Reconcile Costing archival policy, private schema/privileges, security definer search path/ownership and actor checks, source payload size/retention, and backup/revision behavior. Until authorized and installed, dashboard may show `FINALIZATION_NOT_AVAILABLE`; must not promise final reports are locked.

### G7-S4: independently gated formal completion and cross-source transfer quality

Do **not** combine C1 whole-batch completion with G7-S1/S2 pricing implementation without route/BMR signoff evidence. Preserve `completed_reference_value=NULL`, `completed_status=NOT_VERIFIED`, `plan_achievement_pct=NULL`. Siddha Google Sheet historical records and Supabase logs must be externally provenance-mapped before exact event parity; never query Google Sheets synchronously in an 8s browser monetary RPC; no fake bulk/packaging events. Six November missing-log vouchers and one MRP notional-price exception remain visible until separately verified.

## C. Exact migration review checklist (before install request)

1. Obtain the current main version and blob/hash of the **installed RPC's canonical source SQL** from repo; confirm against live `pg_get_functiondef` (current function source already inspected; GitHub code search found client invocation `public/shared/js/executive-mis-dashboard.js` and `scripts/mis-c1` harness, but has **not** established a single checked-in canonical SQL migration file).
2. Construct actual runnable migration by copying the whole current RPC definition and modifying **only** approved sections: declarations, approval selector and additive result construction, preserving existing permission guard, receipt behavior and response fields. Never apply a partial function skeleton or unreviewed broad replacement.
3. Complete G7-S2 source-key mapping query, indexes/EXPLAIN and per-line identity handling. Exact source mapping is **not** demonstrated sufficiently to finalize a production-ready replacement in this packet. Treat as **BLOCKER** rather than drafting unsafe SQL that guesses SKU mapping.
4. G7-S3 finalized receipt table DDL separate from S1/S2; owner decision on the writer, retention, roles, readonly finalized report viewer.
5. Self-review full diff and PostgreSQL syntax on isolated synthetic/staging database, run contract/role/performance cases, then request owner authorization for **specific validated migration digest and rollback**.

## D. Exact rollback policy

**Before any future deployment**, archive authoritative pre-change `pg_get_functiondef('public.get_mis_production_value_summary(date,date)'::regprocedure)` (current output independently inspected) in repository-approved rollback artifact with checksum. The S1/S2 proposed deployment is a single `CREATE OR REPLACE FUNCTION` retaining signature, SECDEF, stable volatility, fixed search path and execute grants. Rollback (if separately authorized) is **restoration of that exact full pre-change function definition**, not an approximated body, not dropping the public RPC; verify grants and 401/403/allowed responses thereafter. For S3, do **not** drop finalized receipts to roll back a client feature: disable privileged writer/revoke its precise EXECUTE, preserve immutable data, and use separately approved archival/restoration plan. No destructive `DROP ... CASCADE` and no production transaction rehearsals without authorization.

## E. Acceptance fixtures (synthetic first; no real approval mutations)

- Resolver: Sep approved122; Oct approved143; Nov draft152 => 143; later approved newer => newer; revoked newer => fallback; no approvals => N/A; finalized receipt old version remains unchanged.
- SKU coverage: six ready approved/run143 rows and absent SKU1350; 6/7 inspected sources, **not global coverage**; review/block/null; UOM mismatch; mL vs Kg normalized quantity; zero, negative, duplicate voucher lines; split inventory line; cancellation/optional flag semantics.
- Reconciliation: historical Siddha source exists but November voucher exact match unavailable; Chirattai Nov 480 vs separate July 479+1 voucher; Mailanchi production logs without SKU packing ledger; do not declare MATCHED.
- Security: genuine MIS View, no MIS View, anonymous; finalization requires independently distinct privilege; verify security_invoker/SECDEF policies and no new direct raw costing grants.
- Performance: representative bounded Nov/as-of data, warm/cold tests, p95 under authenticated 8s timeout, stable cache behavior on approval transition, 390px client only after separately authorized client delivery.

## F. Gate and disposition

**Prepared:** review-only exact S1 resolver SQL + explicit S2/S3 delta/rollback and remaining blockers. **NOT** compile-tested, **NOT** installed, **NOT** ready for production authorization until S2 mapping, complete migrated RPC text and S3 schema governance are independently reviewed. Canonical workflow remains formal **6/11 (~55%)**, G7 OPEN. Draft docs PR #485 unmerged. Completed Costing Suite Electron release untouched.


## G. S2 blocker resolution — voucher-line alias mapping independently verified (22 Nov 2026 IST)

**Evidence advancement:** Previously S2's Tally-to-SKU mapping was unproved; it is now **PROVEN at the read-only 1–21 Nov 2026 fixture scope**, independently from the existing aggregated reconciliation view. Exact repository SQL read-only fixture:

`docs/executive-mis/MIS_G7_S2_APPROVED_TRANSFER_REFERENCE_READONLY_PROOF_20261122.sql`

The **exact checked-in fixture** was fetched and re-executed under `BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms';` with no data writes. Results:

| Coverage | Original voucher lines | Tally book value | Approved Oct143 manufacturing reference subtotal |
|---|---:|---:|---:|
| COVERED | 224 | ₹37,02,135.26 | **₹39,84,998.88** |
| NO_APPROVED_RATE | 2 | ₹9,715.30 | NULL |
| ALL Tally | 226 | ₹37,11,850.56 | **partial covered reference only** |

All 226 lines had SKU aliases, quantity, distinct original line identities; zero cancelled/optional. Two missing rates: **SKU1350 Anulomana Sookshma Choornam/SP873 174 Pkt** (voucher TN/IK/TVM/345, 02-Nov, book 9422.10), and **SKU41 Dhanyamlam/6957 10 Btl** (voucher TN/IK/TVM/350, 09-Nov, book 293.20). October approved run143 does not have either SKU cost; November draft cannot substitute. These 2 are outside the covered reference subtotal, which is **not** an all-SKU manufacturing value and **not** a completed-production figure. Source date strictly `as_of_date=2026-11-22`; voucher dates through 21-Nov only. Reference price period October valuation 22-Oct.

**Mapping lineage:** existing `public.v_tally_fg_transfer_normalized` derives SKU via `public.sku_aliases.alias_key=public.f_norm_key(item_name)` then `public.v_sku_catalog_enriched`. It is based on `app_private.mv_tally_fg_transfer_snapshot_latest` with unique group key `(transfer_store,transfer_date,item_name,batch_code)`, NOT original voucher line identity. For auditable financial reference, the reviewed bounded SQL instead starts with `public.tally_fg_transfer_voucher_lines` whose unique index covers `(as_of_date,transfer_store,voucher_guid,inventory_line_no,batch_line_no)`; it applies the exact same alias resolver and joins `public.product_skus` for pack identity and `costing.sku_internal_loaded_cost_snapshot` for approved-run per-SKU manufacturing COP. It does **not** substitute aggregate Kg quantity or Tally accounting value for SKU packs.

**Planner evidence:** `EXPLAIN (COSTS)` for bounded read-only cohort showed bitmap index scans on voucher `as_of_date` and `voucher_date`, unique index lookup on `sku_aliases.alias_key` and index-only scan on approved `sku_internal_loaded_cost_snapshot(refresh_run_id,sku_id)`. This is favorable *static planner* evidence, **not actual authenticated latency or p95 guarantee**. Keep 8s role timeout acceptance separately pending.

**Resolved:** source-to-SKU mapping + exact bounded reference coverage for inspected month; no need for new alias mapping tables or permanent duplicative SKU resolver.

**Still NOT production-install ready:**
1. Current live RPC must be reconstructed as a full exact diff; no isolated syntax-checked new full function yet. Preserve all existing result fields and auth.
2. Robust latest complete historical snapshot selection by requested as-of (this fixture hardcodes 22-Nov). Snapshot completeness/fingerprint and retroactive corrections need final contract.
3. Verify full cohort vs current Tally source totals, transfer correction/reversal semantics, and zero/negative movement treatment beyond the clean fixture; avoid unconstrained full joins.
4. S3 privileged immutable finalized-report receipt is an independent writer + retention policy gate and **must not** be silently put into the STABLE summary RPC.
5. Actual synthetic run switch/revocation and full genuine role+performance acceptance are pending.

**Gate:** S2 mapping read-only proof PASSED at exact bounded fixture, G7 implementation NOT INSTALLED; formal programme 6/11 (55%). Next small step: assemble exact additive current RPC replacement review diff using this verified line cohort, test in isolated environment, archive current source checksum and rollback, and seek owner installation permission separately.


## H. Full canonical RPC candidate prepared (review-only, not PostgreSQL-compiled)

A **complete source-derived `CREATE OR REPLACE FUNCTION` candidate**, reconstructed from read-only live `pg_get_functiondef('public.get_mis_production_value_summary(date,date)'::regprocedure)`, is saved at:

`docs/executive-mis/MIS_G7_S1_S2_CANONICAL_RPC_REPLACEMENT_REVIEW_ONLY_20261122.sql` (commit `60b4a80ca6fe199c2d501443aea471eca04700b5`).

It keeps existing canonical function name/signature, SECDEF+STABLE, restricted search_path, MIS View/identity authorization check, receipt-basis logic and legacy output fields, while proposing **newest currently valid approved run** resolution (S1) and additive `approved_cost_reference` JSON from per-original-voucher-line SKU/READY approved manufacturing-cost joins (S2). It does **not** implement G7 S3 report-finalization writer, C1 completed-production certification or cross-source Siddha event matching; these stay separate. When no approved reference exists the candidate explicitly emits `NO_APPROVED_REFERENCE` instead of the old misleading `NO_PREVIOUS_MONTH_APPROVED_COST`; client/backward-compatibility review must accept this status delta before merge.

**Strict review status:** This full-function candidate has been read back and its key placements checked, but **has NOT been installed, parsed by PostgreSQL as a replacement, migration-compiled, isolated-staging tested, runtime performance-tested or permission-regression-tested**. It is *not* an approved runnable production migration. A clean source diff and syntax/staging verification against current main, full candidate cost-coverage reconciliation and fresh source-digest evidence remain required before requesting install authorization.

**Known finite review findings:** (1) current `transfer_snapshot` chooses `max(as_of_date) <= requested v_cutoff`, not a proven complete snapshot/fingerprint; (2) original current Tally book subtotal does not filter cancelled/optional, whereas additive S2 marks these excluded in rate coverage—cross-field difference must be deliberate/visible; (3) current approved-run selector is dynamic at evaluation time and must never claim historical as-known valuation; (4) historical finalized reports still need separately authorized immutable S3 writer and independent frozen payload (cost retention); (5) the one-month 226-line cohort had no cancellations/optional/negative quantities, so those future/legacy edge conditions require synthetic fixture testing; (6) no supplier or user-identifying source details should enter public aggregate JSON.

**Technical next gate:** independent full source diff, exact SQL parser/synthetic deployment in isolated/staging environment; replay no-approved/draft-to-approved/revocation cases; explain/p95, genuine 3-role permission acceptance; archive pre-change full function and digest for rollback; then ask owner permission for the *precisely reviewed migration*, not blanket permission. No production mutation or release work.


## I. Independent candidate review and source-equivalence/performance receipt (22 Nov 2026)

**Approval scope:** read-only verification and review artifacts only; no installation.

**Exact source reconciliation:** captured the current live `pg_get_functiondef('public.get_mis_production_value_summary(date,date)'::regprocedure)` and saved its unmodified full function body with an introductory non-executable comment to `docs/executive-mis/MIS_G7_PRECHANGE_LIVE_RPC_ROLLBACK_BASELINE_20261122.sql` (commit `23bf1a558bfd13b44c6f4b609a28ff56670e722e`). This is the **rollback reference**, not authorization to execute it. Candidate `MIS_G7_S1_S2_CANONICAL_RPC_REPLACEMENT_REVIEW_ONLY_20261122.sql` was mechanically compared line-by-line to live source: 82 novel lines and five removed or replaced lines (line-membership diagnostic, not canonical unified-diff count). Changes are restricted to (a) one new `v_reference_cost_period` declaration, (b) replacement of immediate-previous-month selector with effective latest APPROVED run selection, (c) replacement of the no-approved fallback label/adding reference status, (d) appended `transfer_ref_lines` / `transfer_ref_rollup` CTEs and (e) additive `approved_cost_reference` JSON. Existing authentication/MIS View guard, return signature, SECURITY DEFINER, explicit search_path, receipt logic and other fields were retained in text comparison. No new public SQL function or raw table grants.

**Snapshot proof:** `tally_fg_transfer_voucher_lines` as-of **21-Nov** and **22-Nov** both contain 226 lines and exactly ₹37,11,850.56 accounting book value for voucher dates 1–21 Nov. Scoped `EXCEPT ALL` in both directions over original store/voucher GUID/inventory line/batch line and all relevant quantity/value/status fields yielded **0 removed/changed and 0 added/changed** lines, so the 21-Nov as-of query and 22-Nov observed fixture are source-equivalent *for this inspected cohort*, not globally proven snapshot-complete.

**Performance:** read-only `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` for bounded S2 reference SQL with **21-Nov** snapshot completed with observed PostgreSQL execution time **~9.6 ms** in one run; planner uses indexed source and SKU cost lookups. This is **not** signed-in RPC p95 or end-to-end API latency, and it does not evaluate full candidate PL/pgSQL. Do not claim the production 8-second guard passed merely from this query timing.

**Independent review status:** full candidate is a **source-derived review artifact, not PostgreSQL-parsed/installed**. No isolated PostgreSQL staging session or valid parser compilation was executed. **Do not mark G7-S1/S2 INSTALL READY** until syntax/staging tests and genuine role/latency checks finish.

**Specific corrections to review before any installation:**
- The new `approved_cost_reference` valuation uses current approval at evaluation time and must be clearly labelled a live revaluation. Old report-month values may change when the next approved rate arrives.
- `source_line_count` and `uncovered_line_count` in candidate include canceled/optional source lines as uncovered, whereas clean November fixture had none. Final contract should distinguish *excluded* vs *eligible but uncovered* and preserve book value separately.
- Current snapshot picker `max(as_of_date) <= v_cutoff` gives a bounded as-of key but not a verified complete-voucher-data certification or frozen historical event state. Require trustworthy snapshot completeness metadata and robust replays before production approval; fallback to explicitly `NOT_VERIFIED` if not proven.
- `FULL_SOURCE_RATE_COVERAGE` only proves rate/UOM coverage of Tally lines, not reconciliation with work logs, actual production completion or historical full COP; keep separate statuses in client.
- Source aliases and SKU pack definitions may change after original voucher dates; historical-as-known meaning needs frozen mapping provenance. Final report locking (S3) remains independent and needs an authorized immutable receipt + full aggregate/source-hash persistence.
- No-owner-approved display status change should silently break existing client; test `NO_APPROVED_REFERENCE` vs existing `NO_PREVIOUS_MONTH_APPROVED_COST` handling.
- Archive exact rollback SQL and an independently repeatable cryptographic digest before the install authorization; GitHub commit is evidence of versioned archive, **not an independently verified SHA-256 digest of live function body**.

**Next bounded action:** independent SQL parser/staging acceptance with synthetic approval transitions, corrective negative/optional/duplicate fixtures and full-function EXPLAIN/runtime, then genuine View/no-View/anon and cached browser acceptance. Freeze reviewed install/rollback checksum before specific owner installation authorization. No production changes or broader schema modifications.


## J. 23-Nov-2026 read-only full-SQL candidate verification and exclusion-semantic repair

**Scope**: owner-authorized evidence, no production changes, no authenticated browser session or isolated database branch.

1. **Environment check:** `mcp__Supabase__list_branches` returned **zero development branches** on project `qhmoqtxpeasamtlxaoak`. Therefore **isolated full PL/pgSQL compile/deploy was NOT possible/performed**, and production function was never replaced. A live `EXPLAIN` is not equivalent to a CREATE FUNCTION parser or full installed-session test.
2. **Whole candidate reporting SELECT verified read-only:** took CTE through final `jsonb_build_object` from `MIS_G7_S1_S2_CANONICAL_RPC_REPLACEMENT_REVIEW_ONLY_20261122.sql`, substituted bounded November fixture local values (Nov 2026 reporting, as-of Nov 21, approved run143, reference Oct cost period/Oct22 valuation), and executed **standalone PostgreSQL SELECT under BEGIN READ ONLY**. `EXPLAIN (COSTS)` parsed/planned the full SELECT; one `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` execution showed ~**638.3 ms** DB execution and **10.4 ms** planning, well below 8s in this single fixture **but not signed-in RPC p95**. It includes preexisting receipt-costing CTEs, unlike narrow 9.6 ms S2-only query.
3. **Exact output fixture after correction:** `approved_cost_run_id=143`, `approved_cost_reference` reference Oct period / valuation Oct22; Tally original **226 lines / book ₹37,11,850.56**; **226 eligible, 0 excluded, 224 covered, 2 uncovered NO_APPROVED_RATE, covered reference ₹39,84,998.88**. Existing response fields continue to show `receipt_event_count=80`, `receipt_unvalued_count=2`, `receipt_value_status=PARTIAL_COVERAGE`, `completed_reference_value=NULL`, `completed_status=NOT_VERIFIED`, `plan_achievement_pct=NULL`, `transfer_reconciliation_status=NOT_CHECKED_BY_BOOK_TOTAL`. Output field preservation was observed in standalone SQL only, not full authenticated RPC. Current preexisting receipt covered value is as-of-bound and can vary with source snapshot—do not import fixed fixture values into governance without dates.
4. **Candidate correction committed:** `MIS_G7_S1_S2_CANONICAL_RPC_REPLACEMENT_REVIEW_ONLY_20261122.sql` updated in **`e63d7a640aae1df925104e8906d5a4eb41c335aa`**, to count `eligible_line_count`, `excluded_line_count`, `covered_line_count` and `uncovered_line_count` separately; excluded CANCELLED/OPTIONAL source rows no longer masquerade as missing manufacturing rates. The clean observed Nov cohort has 0 excluded; test cases with actual excluded source rows are still synthetic-only. Added `NO_ELIGIBLE_TRANSFER_LINES` and `FULL_ELIGIBLE_RATE_COVERAGE` states for this distinction. Review backcompat before install.
5. **Cryptographic live rollback baseline:** live `sha256(convert_to(pg_get_functiondef('public.get_mis_production_value_summary(date,date)'::regprocedure),'UTF8'))` returned **`909f19b2475811c07fd3497edf80f199e7721ce8684950b35e2b9cae4e59bd8d`**, full rendered function **8347 characters**. The function body is archived in `MIS_G7_PRECHANGE_LIVE_RPC_ROLLBACK_BASELINE_20261122.sql` with only a leading explanatory comment; verify same digest on the exact comment-stripped archive prior to any rollback rehearsal. This SHA is for **live function source**, not a computed digest of the candidate.
6. **No evidence claim inflation:** G7-S1/S2 candidate is **not** yet syntax-compiled as PL/pgSQL, installed or signed-in role-tested. G7-S3 finalized receipt writer and G7 C1 completion/signoff are not installed. Remaining requirements: isolate actual staging Postgres (user-authorized if creating/using external resources), full create-function compile/synthetic tests, row-correction and cancelled/optional cases, source completeness, actual role/security/p95/cache acceptance, finalize write governance, and distinct exact reviewed production install authorization. Source logs and costing release untouched.

**G7 status:** 6/11 (55%), OPEN; evidence advanced, no formal gate closure. PR #485 draft/unmerged. Next bounded action should avoid re-running the same live November source checks; focus on isolated full-function validation and review of candidate risk/compatibility.


## K. Owner direction — no paid Supabase branch; free/local acceptance first (23 Nov 2026 IST)

**Owner explicitly directed:** use assistant's available capabilities for validation **instead of purchasing/provisioning a paid Supabase environment branch**. This supersedes any suggestion that a paid branch is a prerequisite for G7. Do not create/pay for Supabase development branch or other paid environment. Do not reinterpret this direction as approval for live SQL DDL/DML, creating functions, installing current RPC candidate or changing privileges.

**Actual environment availability:** local container has `pg_config` but **not `postgres`, `initdb`, `psql`, Docker or Python PostgreSQL parser libraries**; attempted pip retrieval of `pglast` failed because package network/DNS unavailable. Supabase project `list_branches` returned zero dev branches. Therefore **full PL/pgSQL CREATE FUNCTION compilation cannot be claimed** using this runtime. Prior full reporting SQL was independently PostgreSQL-parsed and executed under read-only production transaction (not DDL) and measured ~638 ms DB execution in one November fixture; this remains meaningful bounded data/SQL evidence.

**Additional free test evidence, executed without touching production:**

- Existing checked-in full S1/S2 RPC review candidate statically inspected for: exact canonical signature; MIS permission and `auth.uid` guard; restricted security-definer search_path; APPROVED designation gate; SUCCESS run gate; per-SKU READY filter; eligible/excluded separation; read function without report writer DML; explicit unverified completion/reconciliation; latest Tally snapshot selector. **11/11 PASS** at the syntactic text/assertion level. These are *not* database role security tests.
- JavaScript synthetic policy harness executed in memory for: current draft excluded -> Oct143, simulated Nov approval -> switch to Nov, simulated revoke -> revert to Oct143, all revoked -> NULL, eligible vs cancelled/optional distinct counts, only valid pack+READY+positive qty included in valuation, previously frozen run reference unaffected by new approval. **7/7 PASS**. These check expected policy behavior, not SQL implementation on mutation fixtures.
- Existing verified READ ONLY G7 November cohort: 226 unique original voucher lines, 224 approved-rate covered, 2 no approved rate, partial latest-approved manufacturing reference ₹39,84,998.88 and distinct Tally book ₹37,11,850.56. No need to rerun source archaeology.

**Zero-cost validation sequence replacing paid-branch plan:** (1) keep review-only source/rollback digest and review exact SQL diff; (2) run local or in-memory deterministic synthetic tests, static SQL lint/guard checks, and safe read-only SQL SELECT/EXPLAIN against existing production for real cohort parity; (3) if a free PostgreSQL runtime becomes available locally, execute `CREATE FUNCTION` and negative fixtures **only in that disposable local database**, without production connectivity or secrets; (4) do not falsely claim full function compilation until actually achieved; (5) after owner authorizes a precisely reviewed installation, apply only the approved migration and use genuine authorization/latency/browser checks to validate installed behavior. Do not use production for `BEGIN; CREATE FUNCTION; ROLLBACK;` as a claimed read-only test; this is DDL and outside authorization even if rolled back.

**Residual acceptance:** full PL/pgSQL compiled syntax (currently unavailable without an independent free local PostgreSQL engine), definitive snapshot completeness, correction and cancelled/optional SQL fixtures, real signed-in MIS View/no View/anon role and p95, S3 immutable report-finalization writer separately governed. **No paid branch dependency**. Formal 6/11 (55%), G7 OPEN, docs PR #485 draft/unmerged; Costing Suite Electron release completed and untouched.


## L. Free PostgreSQL read-only synthetic fixtures and legacy-client status compatibility (23 November 2026)

**Owner-directed zero-cost work:** no paid branch and no live DDL; no local PostgreSQL server or parser in current runtime. Reproducible SQL `MIS_G7_APPROVAL_AND_TRANSFER_EDGE_FIXTURES_READ_ONLY_20261123.sql` committed as **`1ee9ca88f99899d238aeea131c863a13f0c9153e`** and executed against genuine PostgreSQL under `BEGIN READ ONLY`. All fixtures use temporary-in-query `VALUES`, **no inserted records or modified approval**.

**Approval transition fixtures — 4/4 PASS:** October approved 143 remains selected while November 152 DRAFT; simulated November 152 APPROVED selects 152; simulated November revoked falls back to October143; simulated November+October revoked selects September122. Test is a genuine SQL SELECT with synthetic rows, not an actual change to governed designations. Remaining cases such as all months revoked and approval concurrency are not proven by this four-case fixture.

**Transfer classification fixtures — 9/9 PASS:** READY valid packs covered (5×₹12 = ₹60); CANCELLED and OPTIONAL excluded; Kg source unit not mistaken for packs; REVIEW_REQUIRED rejected; SKU unmapped; pack-definition mismatch; negative quantity; missing approved rate. Each case returned its expected classification and only the valid line generated reference value. These demonstrate SQL CASE semantics, not full validation of a production source snapshot or the *whole* candidate PL/pgSQL.

**Independent actual-client compatibility finding:** current `main` `public/shared/js/executive-mis-dashboard.js` explicitly uses `d.status === 'NO_PREVIOUS_MONTH_APPROVED_COST'` in **two** no-run paths, and recognizes that status in `PV_STATUS_LABELS`. An S1/S2 candidate switching only to new top-level `NO_APPROVED_REFERENCE` would cause a client misclassification before a client upgrade. **Review-only candidate repaired** in commit **`e39186f426a8c6b7c7ad688436ae65e3f75cef8e`**: preserve old top-level `NO_PREVIOUS_MONTH_APPROVED_COST` solely for legacy client compatibility and include precise new `approved_cost_reference.coverage_status='NO_APPROVED_REFERENCE'` and explanatory basis note. Existing UI copy still says *previous month*, so client update should later improve displayed wording to *no eligible approved costing run*, but the old unavailable-state logic remains functional. No client code was changed.

**Free environment limit:** container has no `postgres`, `initdb`, `psql`, Docker or PG parser installed. Do not claim CREATE FUNCTION compilation, isolated staging, signed-in role test or browser integration. Existing standalone full reporting SELECT read-only success and one 638ms database execution remain relevant but not a p95. The current S1/S2 function is **review only, not production install ready**.

**Next bounded task:** freeze candidate exact SQL diff after compatibility correction, replay standalone full-query regression with added fields, and review precise proof of role/freshness and source completeness. For true PL/pgSQL compilation and production installation, preserve separate explicit approval and no-paid-branch preference; do not perform unapproved production DDL even with rollback. Formal G7 OPEN 6/11 (~55%), no gate advancement for docs or synthetic tests.


## M. 23-Nov-2026 latest candidate regression and source snapshot integrity safeguards (read-only)

**Owner gate:** free-capability SQL verification and documentation only; production DDL/DML, grants, client/deploy and paid environments not authorized.

**Corrected candidate live read-only full SELECT:** fetched latest `MIS_G7_S1_S2_CANONICAL_RPC_REPLACEMENT_REVIEW_ONLY_20261122.sql`, extracted entire current-and-additive reporting SELECT and evaluated with Nov1–21 / Oct approved run143. Successful, preserving old response values: 80 FG bulk receipt events, two unvalued, formal completion `NOT_VERIFIED`, Tally book transfer amount **₹37,11,850.56**. Additive reference returned 226 original Tally voucher lines, 226 eligible, 0 excluded, 224 rate-covered and 2 `NO_APPROVED_RATE`, partial approved manufacturing reference **₹39,84,998.88**. New `snapshot_completeness_status=NOT_CERTIFIED`, `source_lineage_status=TALLY_VOUCHER_LINES_ONLY`, and process matching `NOT_VERIFIED`; the aggregate was not falsely called certified production or completion. Current no-approved fallback still emits client-compatible top-level `NO_PREVIOUS_MONTH_APPROVED_COST`.

**Snapshot bounded discovery:** Nov19–23 Tally `public.tally_fg_transfer_voucher_lines` snapshots show both IK and OK source stores by as-of date. As-of Nov21, Nov22 and Nov23: IK has 171 November voucher lines at book ₹30,93,159.09 and OK has 55 at ₹6,18,691.47 (226 and ₹37,11,850.56 total). These repeated totals **do not certify data completeness**, and a date-only `max(as_of_date)` can still select incomplete or retrospectively revised sources. No `is_complete`, `snapshot_status`, `source_fingerprint` or `load_status` fields were found on inspected transfer tables; authoritative ETL completion manifest linkage still requires design proof. Latest inspected Nov22 cohort has no cancelled/optional/negative/zero lines or null original GUID/line number.

**Review-only candidate safeguard** commit `55e35027fbbab891295cedb2a47b03098eb2bd88`: adds explicit `approved_cost_reference.snapshot_completeness_status='NOT_CERTIFIED'`, `source_lineage_status='TALLY_VOUCHER_LINES_ONLY'`, and distinct `NO_SNAPSHOT` rate-coverage status when no eligible as-of date exists. Leaves existing top-level RPC and book/receipt fields intact. This is conservative disclosure, **not** implementation of complete-source certification or full transfer reconciliation.

**Reproducible synthetic SQL fixture:** `MIS_G7_SNAPSHOT_INTEGRITY_SYNTHETIC_READ_ONLY_20261123.sql` committed `17e21e7ff7abb07d6a98575372a70ea7f50dcf97`. PostgreSQL READ ONLY `VALUES` cases **4/4 PASS** for apparent both-store snapshot without false certification, missing expected store, missing snapshot and empty snapshot. Source correction detection using bidirectional `EXCEPT ALL` caught an in-place value change under the same voucher identity (**1 removed/changed and 1 added/changed**, PASS). Store expectations in the fixture are not universal and must come from a future governed ETL source manifest, never hardcoded as completeness policy.

**Remaining installation blockers, no repeated auditing:** full PostgreSQL PL/pgSQL compilation in a genuinely free isolated environment, source-ingestion completion/fingerprint semantics and correct report as-of cutoff, correction/reversal parity across Tally and logs, genuine signed-in MIS View/denied/anon + p95/cache, reviewed precise migration and immutable S3 report-finalization design. Preserve owner gate: no live DDL or production changes. Formal G7 OPEN, programme **6/11 (~55%)**, PR #485 draft/unmerged, G8 parked; completed Costing Suite Electron release untouched.


## N. Existing transfer ETL finalization governance found — no new tracking table assumed (23 Nov 2026 IST)

**Authoritative live discovery, all production READ ONLY**: `public.fg_transfer_all_chunks_present(text,date,jsonb)` and `public.finalize_fg_transfer_snapshot(text,date,jsonb)` **already installed**. Source migration `supabase/migrations/20260806085429_harden_etl_source_validation_and_status_audit.sql` introduced fetch/parse validation and job-status audit. Live finalizer is substantially more rigorous than date-max snapshot selection: accepts **externally supplied expected source keys**, demands every expected `FETCH_XML` and `PARSE_FG_TRANSFER_CHUNK` job be `done` and `parse_status=SUCCESS`, source hash/size/count/time evidence valid, single company, no source-scope gaps/overlap, final scope equals as-of; **then writes** by invoking `public.rebuild_fg_transfer_snapshot_window`. **Do not execute either finalizer or rebuild** without separately granted production-write authorization. `fg_transfer_all_chunks_present` is an installed read-only function and was executed safely.

**Read-only observed 23-Nov as-of source cohort**: per store IK/OK each has **8 distinct monthly source chunks**, 8 successful matching fetches, 8 successful parses, 8 valid structured parse-evidence records, **0 date-scope gaps/overlap**, scopes **2026-04-01 through 2026-11-23**, parsed count identical to published per-source row count (IK **2471** lines, OK **631**). Calling existing `fg_transfer_all_chunks_present` with the eight **observed published source keys** returned **true for both** stores. This and continuous scopes are strong evidence for source ingestion and publisher governance; no need to build speculative new ETL completion ledger.

**Critical proof boundary:** the expected-key arrays above were generated from the **already published source rows**. This alone **cannot certify** that every planned chunk exists: a zero-row chunk may leave no source key among voucher lines. Nor does the read-only call identify a durable *finalizer execution receipt*, certification timestamp, job group or independent manifest guaranteeing both stores were published atomically. Finalizer has stronger validation but was **not called or altered** this turn. Therefore leave candidate `approved_cost_reference.snapshot_completeness_status=NOT_CERTIFIED` until independent expected-chunk manifest + successful governed publication evidence or equivalent verified source chain is demonstrated. Separate completeness of Tally ingestion from cross-source DWL/Siddha log parity and C1 production completion.

**Next safe division of labor:** ChatGPT owns any live bounded SQL, source truth and owner approval. A self-contained **Claude Code bulk offline repository-only work package** is prepared in `docs/executive-mis/MIS_G7_CLAUDE_BULK_OFFLINE_ETL_PROVENANCE_HANDOFF_20261123.md`, commit `f246e2f779b82d0db11236dc488f777d62c8c581`. Claude may trace actual expected-file generation, finalizer invocation and any durable receipt, build deterministic negative offline fixtures and produce **one new draft PR**, **no merges/deployments or production changes**. This is legitimate autonomous client/repository work that does not interfere with pending G7 SQL authorization or completed Electron release.

**Status:** G7 owner business policy APPROVED; server evidence stronger, **G7 OPEN**, formal **6/11 (~55%)**; no paid Supabase branch, no production writes, no hidden S3 report finalization, G8 parked.


## O. Independent review of Claude draft PR #517 and installed publication semantics (23 Nov 2026 IST)

**Draft-only PR:** `feat/mis-g7-etl-provenance-offline-20261123`, head `9a3a8db2ee430a5f8c9ce88491757e951cc409cf`, base `main` `62b1f12c51eee3c3e3d06990f1577ec7981da0f4`, exactly 3 new files/365 insertions/0 deletions; draft, unmerged, separate from #485. Claude reports 17/17 Node tests; reviewer independently inspected all three files but did **not** execute Node. Review findings posted to PR #517 comment `7095223505`. Linked operational checkout has five dirty Nov12 migration files reported by Claude; **DO NOT DISCARD** even if line endings appear to be the cause, without explicit separate owner authorization.

**Live installed functions captured READ ONLY:** `public.finalize_fg_transfer_snapshot(text,date,jsonb)`, `public.rebuild_fg_transfer_snapshot_window(text,date,date)` and its 2-argument configured-start wrapper. Finalizer validates externally supplied expected keys, done fetch+parse, parsed row count/hash/size/time, single company and contiguous date coverage; then calls 3-arg rebuild. Rebuild:
1. bounds replacement start by configured `fg_transfer_authority_start_date`;
2. ranks original voucher lines over `(transfer_store, coalesce(nullif(voucher_guid,''),'__NO_GUID__'), inventory_line_no, batch_line_no, coalesce(raw_godown,''))` ordered by `coalesce(voucher_alterid,0) DESC, as_of_date DESC, id DESC`;
3. keeps latest rank **then** removes cancelled/optional;
4. calculates source count, qty and transfer amount; blocks empty source;
5. DELETEs only `public.tally_fg_transfer_snapshot` within **store + transfer_date [replace_from,as_of]**, INSERTs reaggregated latest lines and checks nonzero inserted rows and quantity/amount parity. Earlier dated facing snapshot rows are untouched. The function makes no explicit advisory lock in inspected body. PostgreSQL function statements participate in the caller transaction; **joint IK/OK atomicity and concurrent publication protection are not proven**. Neither finalizer nor rebuild was called this review.

**Bounded observed parity:** On 23-Nov as-of, total 3,102 original source lines (IK 2,471, OK 631) show zero superseded, cancelled, optional or nonpositive after latest-rank filtering; Nov 1–21 has 226 original/current lines, zero superseded/excluded, raw and canonical Tally book both ₹37,11,850.56. Thus earlier S1/S2 partial manufacturing reference remains valid for **this** fixture, but proposed direct raw-line pricing has **a real future semantic parity hole**: historical/future changed voucher alteration or cancellation may require latest-rank-before-filter instead of counting all input rows. **Block production installation until this is corrected and negative fixtures tested**.

**Offline PR review corrections required:** `scripts/mis-g7-etl/provenance-model.mjs` uses `parse_count` but live finalizer checks **`parsed_row_count`**; model requires source_size_bytes `>0` but finalizer evidence check accepts `>=0`; distinguish additional model-only published-row count check from current installed finalizer; `INDEPENDENT_MANIFEST` test flag is not evidence of a real externally independently generated manifest or durable finalization receipt. Audit report should incorporate live-verified rebuild and transactional semantics, while marking absence in *repo* accurately. Draft PR #517 is **not merge-accepted**. No new paid branch, server DDL, writes, client release or merge.

**Next bounded workflow**: Claude amends existing draft PR #517 with precise model field/threshold/audit corrections and reruns offline tests, leaving operational checkout untouched. ChatGPT separately prepares full G7 S1/S2 voucher latest-alteration correction in **review-only** candidate, verifies source with safe READ ONLY negative fixtures, then reconciles completion manifest and S3 immutable report receipt independently. G7 OPEN formal 6/11 (~55%); G8 parked.


## P. Review-only G7 S1/S2 voucher latest-alteration correction and PostgreSQL proof (23 Nov 2026)

**Exact installed authoritativeness:** `public.rebuild_fg_transfer_snapshot_window(text,date,date)` ranks voucher versions by (store, nonblank GUID fallback, inventory_line_no, batch_line_no, normalized raw_godown), then chooses descending `voucher_alterid`, as-of and ID; it excludes **latest-version** cancelled/optional after ranking. Existing G7 S1/S2 approved manufacturing valuation review candidate did not previously do this; future altered voucher source records might be double priced.

**Docs-only candidate correction** in `MIS_G7_S1_S2_CANONICAL_RPC_REPLACEMENT_REVIEW_ONLY_20261122.sql`, commit **`2e4a3049464b4c5b29bbfd8c7a9b84a9bebba022`**:
- new `transfer_ref_ranked` CTE reproduces installed publisher's voucher version priority, retaining source lineage;
- `transfer_ref_lines` first identifies `EXCLUDED_SUPERSEDED`, then excludes latest cancelled/optional and separately categorizes rates;
- `eligible_line_count`, `excluded_line_count`, `uncovered_line_count` exclude all superseded/cancelled/optional;
- `tally_source_book_amount` is canonical latest-active book, distinct from `tally_raw_book_amount` for original-row inspection;
- no change to legacy top-level fields, approval guard, no approved branch, source `NOT_CERTIFIED` or completion `NOT_VERIFIED`.
- **Never** conflate already-published facing transfer rows with raw source versions. This candidate is still review-only and not eligible for install until full PL/pgSQL compile + permission tests.

**Live READ ONLY checks:** Nov23 full source as-of **3102 raw lines** (IK2471, OK631) had zero superseded/cancelled/optional/nonpositive according to the publisher's ranking; Nov1–21 **226 lines**, zero superseded/excluded, raw and canonical source book both **₹37,11,850.56**. Extracted corrected full reporting SELECT from committed review candidate; PostgreSQL READ ONLY produced unchanged 80 bulk receipt events, `completed_status=NOT_VERIFIED`, 226 eligible / 224 covered / 2 NO_APPROVED_RATE and **₹39,84,998.88 partial manufacturing reference subtotal**, no change to current legacy output. No actual valuation provenance lock or completion is asserted.

Reproducible synthetic voucher-version fixture `MIS_G7_VOUCHER_LATEST_ALTERATION_SYNTHETIC_READONLY_20261123.sql`, commit **`935600c05f1ac69ad02eaa10a0c0f0b0e63239b7`**, fetched and re-executed in PostgreSQL `BEGIN READ ONLY`: **4/4 grouped classification assertions passed**. Source values include older and newer same-GUID alterations, later cancellation, optional latest version and same GUID in different raw godowns. Canonical result covered 3 latest-active rows (book ₹200), superseded 3 rows, cancelled 1 and optional 1, all excluded from canonical valuation. This tests **SELECT semantics only**, not full `CREATE FUNCTION` or authenticated API.

**PR #517 independent review status:** 17/17 reported Node offline tests, unmerged draft, corrections requested on `parse_count` vs live `parsed_row_count`, source size threshold, synthetic independent manifest truth, and live finalizer/rebuild review. Comment `7095223505`. No permission granted for wiping unrelated five dirty migration files from operational checkout; no paid branch, server write, merge or release.

**Next bounded gate:** Claude amends #517 only on its isolated worktree; ChatGPT reconciles amended offline model, source manifest provenance, true ETL publication receipt and S3 immutable MIS report locking. S1/S2 source selector and voucher latest-wins SELECT are bounded tested; full installed function security/p95 and source certificate remain pending. Formal G7 OPEN, 6/11 (~55%), G8 parked, #485 docs PR draft/unmerged.
