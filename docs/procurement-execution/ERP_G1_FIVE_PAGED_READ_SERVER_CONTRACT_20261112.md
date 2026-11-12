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
