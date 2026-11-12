# PEC G1 — Five additive paged read contracts (12 Nov 2026)

**Server:** live SASV Supabase project `qhmoqtxpeasamtlxaoak`. **Trackers:** #284 and #305. **Client:** Claude C1/C2/C3 stacked draft PRs #291 → #301 → #320; separate shared resync bug PR #319; server correction draft #317.

## Contract

The five new `SECURITY DEFINER`, `STABLE` functions are **read-only**, require `require_permission('module:procurement-execution-console',false)` and allow EXECUTE only to `authenticated` and `service_role` (not `PUBLIC`/`anon`). The functions do not change the existing nonpaged APIs and do not broaden access to their source views.

| RPC | Inputs | Stable order |
|---|---|---|
| `proc_pec_pr_headers_paged` | `p_limit`, `p_offset` | `updated_at DESC NULLS LAST,pr_id DESC` |
| `proc_pec_indent_headers_paged` | `p_limit`, `p_offset` | `updated_at DESC NULLS LAST,indent_id DESC` |
| `proc_vendorwise_buylist_filtered_paged` | Same 5 filters as existing filtered RPC; `p_limit`, `p_offset` | `vendor_bucket_key,material_class_id,stock_item_id,uom_id` ascending |
| `proc_pec_purchase_excess_paged` | `p_limit`, `p_offset` | `voucher_date DESC NULLS LAST,purchase_fact_id DESC` |
| `proc_pec_excess_acceptance_audit_paged` | `p_limit`, `p_offset` | `accepted_at DESC NULLS LAST,acceptance_id DESC` |

**Common return**: `TABLE(row_data jsonb,total_count bigint)`, matching the established Action Queue envelope. `row_data` contains the same columns as the original source row (including existing vendor-wise `indent_breakdown` JSONB). `total_count` counts the filtered dataset before pagination and repeats on each returned row.

**Boundaries:** defaults `p_limit=100,p_offset=0`; `1<=p_limit<=200`, `0<=p_offset<=100000`. Other values raise a descriptive SQL exception. On an empty first page the function returns **zero rows**, not a synthetic empty row. Clients should interpret empty offset 0 as total 0; if an offset beyond the end returns zero rows, they must not assume the underlying dataset has total zero.

**Important:** offset pagination provides deterministic ordering **within a snapshot**, not an immutable snapshot across concurrent changes. Client must reset offset/selection on filter/sort changes, use latest-wins cancellation, deduplicate by server key and keep export semantics separately verified. A future keyset cursor may be required if live concurrent writes demonstrate drift. Avoid claiming an infinite-scroll guarantee until real-account UX acceptance passes.

## Source / verification

- New additive migration: `supabase/migrations/20261112170000_pec_g1_five_paged_read_contracts.sql` is exact live function source and explicit grants.
- Regression: `scripts/pec-g1-paged-read-contract-verify.sql` executed on production and passed all five permission/SECURITY DEFINER and stable-key checks.
- Current datasets: PR headers **7/7** unique keys, Indents **45/45**, Purchase Excess **13,311/13,311**, Excess audit **0/0**, Vendor-wise **834/834**.
- Independent source-equivalent direct-view first-page checks returned 3 unique rows for all nonempty datasets, in the expected sort order. No signed-in user token was available through the administrative connector: direct public RPC calls correctly returned `Not authenticated`, so **functional successful caller-side page reads are not claimed**.
- No production PR/indent lines, stock or historical MRP details modified; only five new function objects were created.
- The current client uses old unpaged endpoints. **Claude #320 does not call these new RPCs.** A separate reviewed follow-up client PR should switch them using page-aware filter and export semantics. Do not silently retrofit #320 while it is undergoing review.

## Review and release conditions

1. Real PEC viewer/editor JWT read; check first/next/end page, total_count, role removal and unauthorized denial.
2. Verify server-side filtering parity for VWL and stable key/indent breakdown, including CSV/TSV/PDF export completeness beyond visible page.
3. Benchmark Purchase Excess under real production-like page loads (13,311 rows in source); `count(*) OVER()` may still compute a full count and is not proof of p95 improvement. Add index/performance work only with query plans and timing evidence.
4. If filters for PR/Indents/Excess remain client-only, do not claim true server pagination under filtered views until the exact filter parameters and consistent total_count semantics are added.
5. Rebase against moving main, independent code/CI review and explicit owner merge before declaring G1 contract delivered or PWA deployed.

**Formal programme gates: 0/6 verified; G0 active. S4 hybrid writer still disabled.**

## 12 Nov follow-up: two-page source ordering acceptance

The reproducible verifier `scripts/pec-g1-paged-read-contract-verify.sql` was extended (commit `8ceabcc`) with a **read-only, source-equivalent first/second 200-row page disjointness check**:

- Purchase Excess `13,311` total: first 200, second 200, **overlap 0** (stable `voucher_date DESC NULLS LAST,purchase_fact_id DESC` ordering).
- Vendor-wise `834` total: first 200, second 200, **overlap 0** on `(vendor_bucket_key,material_class_id,stock_item_id,uom_id)`.
- All five function definitions continue to have module VIEW checks and `authenticated` EXECUTE true, `anon` false. Live script outcome **`PEC_G1_FIRST_TWO_SOURCE_PAGES_PASS`**.

This is a **source-equivalent administrator SELECT check**, not a signed-in invocation of the actual security-definer paging RPC, no concurrency/latency guarantee and no guarantee the client filters match the server's page boundary. Actual client-side adoption and JWT-dependent acceptance remain open. No table writes.

## Client dependency note

Claude's #320 full PR is stacked on #291/#301; **do not merge its current broad diff blindly**. An independent compare of `claude/pec-erp-c2-immediate-vendor-selection...claude/pec-c1-five-lens-fast-track-20261112` unexpectedly includes **23 commits** and unrelated WP05/lab/SW files, so the suggested branch diff is not a safe narrow review boundary. This risk was recorded directly on #320. After prerequisite merges, derive a clean PEC-only delta and validate #319's Full→RESET behaviour.

## 12 Nov — Vendor ordering regression fixed, SQL replay verified

**Issue discovered:** the first version of `proc_vendorwise_buylist_filtered_paged` ordered by `vendor_bucket_key,material_class_id,stock_item_id,uom_id` rather than the canonical buyer-facing order from the legacy function (`UNASSIGNED` **last**, `vendor_bucket_name`, `stock_item_name`, `uom_code`). That could reorder the entire buying list during client pagination. Corrected the live paged RPC to match the legacy business order exactly, adding unique group keys *only as deterministic ties*. Updated existing as-yet-unmerged migration in PR #323 (commit `d051cd9`), no new migration/production purchase writes.

**Evidence:** real legacy function ordering captured by `WITH ORDINALITY`; source-equivalent new ordering compared across all **834** live Vendor-wise grouped rows. **0 position mismatches**; **635 assigned groups** precede the first `UNASSIGNED` group at **position 636**. First 200 and second 200 still disjoint. Regression SQL appended to `scripts/pec-g1-paged-read-contract-verify.sql`, using a dynamic row count for future data growth; live result `PEC_G1_VENDOR_LEGACY_ORDER_PARITY_PASS`. Full migration definition replay in `BEGIN/ROLLBACK` succeeded, with corrected order present.

**Single-run diagnostic, not a performance SLA:** `EXPLAIN (ANALYZE, BUFFERS,FORMAT JSON)` on underlying Purchase Excess view:
- new paged-query equivalent (first 100 with `count(*) OVER()` and `to_jsonb`): observed execution **1,116.887 ms**, shared buffer hits **18,253**, 100 output rows;
- existing unpaged `SELECT * ... ORDER BY ...`: observed execution **943.077 ms**, shared buffer hits **18,285**, 13,311 output rows.

These are **two isolated administrator plans**, not controlled repetitions, network transmission timings, p95, signed-in RPC executions, or statistically valid comparison. They show that `count(*) OVER()` can require full-data computation even with a bounded response, so **the new RPC should not be described as a proven latency improvement**. Its bounded result helps transfer/render size, not necessarily database execution cost. Need realistic authenticated runs, client-side total/filter semantics, repeated latency benchmarking and possible separate count/optimized paging strategy before performance acceptance.

**Further design caveat:** the new PR, Indents and Excess paged functions currently lack corresponding server filter inputs used by their client lists. Running existing client-side filters only on each page could omit matching results. **Do not switch those lenses to paged RPCs without synchronized server-filter contracts** and relevant export semantics; only Vendor-wise has the existing five upstream filters and even there client search/selection/export must be checked.

## 12 Nov: Client parity of all three remaining sort orders

Direct inspection of the current canonical shared JS found the actual **post-filter, pre-page** sort:
- PR Workbench: `rows.sort(compareNumDesc(pr_id))`, i.e. `pr_id DESC`, **not** `updated_at DESC`.
- Indents: `rows.sort(compareNumDesc(indent_id))`, i.e. `indent_id DESC`, **not** `updated_at DESC`.
- Excess & Overshoot: `net_unallocated_qty DESC` (JS treats null as zero); tie `voucher_date DESC`; the legacy source read already sorted by `voucher_date DESC,purchase_fact_id DESC`, so JS stable sort preserves `purchase_fact_id DESC` as final tie-breaker.

The first version of PR #323 had different orders for all three. **Live RPC definitions and the as-yet-unmerged migration were corrected** (commit `be12b7f`) to the above exact semantics. Excess verified against a source SQL reconstruction of the stable client sort on **all 13,311 records**: **0 position mismatches**; PR/Indent RPC sort clauses confirmed by the live function source. The same server migration also preserves the canonical Vendor-wise business sort as separately recorded. Regression `scripts/pec-g1-paged-read-contract-verify.sql` updated with real function-source assertions and full Excess/Vendor ordering parity; result `PEC_G1_LEGACY_CLIENT_SORT_PARITY_PASS` (commit `ab899f4`). This is **catalogue and source-equivalent parity**, not a signed-in UI acceptance.

## G1 next contract: server filtering BEFORE paging, not after it

The current client makes the following filters **before** `slicePage`. These must become server filters if switching to true paged reads, otherwise the UI can show a misleadingly empty page and wrong `total_count` despite matches on another server page:

| Lens | Current client filters | Sorting |
|---|---|---|
| PR | exact status, material class ID, PR number contains-text | PR ID descending |
| Indents | exact status, material class ID, indent number contains-text | Indent ID descending |
| Excess | quick item-name contains-text; canonical class code; explicit date from/to (default rolling 30 days, calculated in browser); minimum net unallocated quantity; vendor display name contains-text; item name/code contains-text; unmapped-only vendor | net unallocated qty descending; voucher date descending; purchase fact ID descending (tie) |
| Audit | no filter currently, ordered acceptance timestamp DESC then ID | accepted_at descending |
| Vendor-wise | material class ID, RM scope, rate status, assignment status, search via existing upstream RPC; **also** check the operational vendor-bucket local filter and split indicators before adopting paging | assigned groups first, UNASSIGNED last, vendor/item/UOM; deterministic technical ties |

**Required future server contract:** apply all filters inside the data selection **before** `count(*) OVER()` and `LIMIT/OFFSET`; reset page on filter changes; make date bounds ISO dates provided by client (do not recompute based on database timezone); preserve use of SQL literal-safe parameters, empty search as no filter, null handling, identity/duplicate ordering and complete exports. Consider new separately versioned filtered RPCs or carefully review signature migration before replacing currently deployed additive calls. Until this is done, the current PR/Indent/Excess endpoints are **building blocks, not production-ready replacements for the filtered UI**.

**Performance checkpoint:** single-run Purchase Excess query-equivalent 100-row page with count measured ~1.117 seconds, while an unpaged result computed ~0.943 seconds on another single run. No p95/real JWT evidence or conclusion of speedup.

## PR #320 diff correction

A previous reviewer warning misclassified a **23-commit branch-to-branch ancestry comparison** against old C2 as an unexpected merged-scope risk. Rechecking GitHub's **actual PR #320 changed-file list** and the current-main diff returned **52/52 PEC-scoped files, zero WP05/lab/SW files**. The earlier warning was explicitly retracted on #320 (comment `6819885243`). This is **not a current unrelated-file merge blocker**. Genuine requirements remain stacked merge order #291→#301→#320, #319 Full→RESET reconciliation and the control-inventory FAIL/FIX test improvement.
