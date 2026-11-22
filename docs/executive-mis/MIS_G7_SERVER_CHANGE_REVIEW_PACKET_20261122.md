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
