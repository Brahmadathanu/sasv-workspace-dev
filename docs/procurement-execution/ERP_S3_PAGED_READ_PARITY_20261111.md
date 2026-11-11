# PEC ERP S3 — Paged-read parity contract (11 November 2026)

**Status:** independently gathered read-only evidence; implementation proposal, NOT owner approval. No production mutation. Parent #284, client C1 PR #291.

## 1. Why Excess Purchases is first
Live view row counts at inspection: PR headers 7; indent headers 41; excess purchases **13,297**; excess acceptance audit 0; vendor-wise buying list 829. Current Excess load calls `proc_pec_purchase_excess()` for the entire view then applies client filters, global sort, and in-memory page slicing. A bounded, permission-gated server-filtered/page RPC is the highest-value first increment. Do **not** conflate total view rows with default filtered rows.

Read-only bounded snapshot case `voucher_date BETWEEN 2026-10-12 AND 2026-11-11`: 169 rows, 169 distinct `purchase_fact_id`, zero NULL net quantities; sorting with `net_unallocated_qty DESC NULLS LAST, voucher_date DESC NULLS LAST, purchase_fact_id DESC` gives 30 on first page and 31 as next row. This is a **single observed window**, not a long-term uniqueness proof. No actual new RPC has been installed.

## 2. UI contract pinned from shared JS, C1 commit 2182bcc
- PR headers: status exact, class ID numeric equality, case-insensitive substring search on `pr_number`; visible order `pr_id DESC`. Existing read RPC order instead `updated_at DESC NULLS LAST, pr_id DESC`. The page display currently shows page number but uses the **current page length**, not the full filtered count, for meta/tab counts; corrected server-paged UI should use returned total.
- Indent headers: same filters on `status`, `material_class_id`, substring `indent_number`; visible order `indent_id DESC`; live read RPC initially sorts by `updated_at DESC NULLS LAST, indent_id DESC`. Existing conditional `indent_date` column is real and MUST remain.
- Excess: quick search substring `stock_item_name`; filter material class via `canonicalMaterialClassCode` (semantic normalization must be matched, not naively compared); minimum `net_unallocated_qty`; inclusive `voucher_date` from/to; vendor name substring `vendor_display_name`; item name OR code substring; `unmappedOnly` means NULL or empty vendor display name. Display order **net_unallocated_qty DESC, voucher_date DESC**; add `purchase_fact_id DESC` as stable third tie-breaker after assessing client tie parity.
- Default Excess date preset: client's local calendar day minus 30 days through today inclusive; choices 7d (minus 7), fy (actually rolling 365 days), custom. The client must pass ISO resolved dates to the server, never shift them by timezone; clarify the misleading `fy` label separately.
- Acceptance audit: sorted `accepted_at ?? created_at` descending in client, database existing order `accepted_at DESC NULLS LAST, acceptance_id DESC`. New stable ordering should define NULL/fallback tie explicitly, retain full count.
- Vendor list: filtered RPC already accepts `p_material_class_id,p_rm_scope,p_rate_status,p_assignment_status,p_q` but delivers whole result; client applies operational vendor bucket, split-only membership from separate `proc_vendorwise_buylist_split_items` call, vendor-filter key, then locale-aware sorting by operational bucket name/item/UOM/vendor. **Do not paginate ahead of split or vendor filters** or the total/order will be inaccurate. Need server-side split + bucket filter parity, or defer real paging for this lens.
- Exports: Vendor-wise CSV/TSV explicitly calls `fetchAllVendorBuylistRows()` and terminal bucket sorting; new paging must not make exports page-limited or silently omit rows. Other exports must be inspected for authoritative full-filter semantics before conversion.
- Action Queue is already genuinely paged and should not be reimplemented.

## 3. Proposed initial S3-E RPC (not implemented)
`proc_pec_purchase_excess_paged(p_search text,p_material_class_code text,p_date_from date,p_date_to date,p_min_qty numeric,p_vendor_q text,p_item_q text,p_unmapped_only boolean,p_limit integer,p_offset integer)` RETURNS governed data rows plus `total_count` in one transactionally consistent statement. Prefer record metadata envelope (`row_data jsonb,total_count bigint`) or explicit typed returns; choose only after client adapter design. `p_limit` capped (suggest 1..200), nonnegative `p_offset`; no privilege widened; server `require_permission('module:procurement-execution-console', false)`. Make SQL substring semantics escape-wildcard safe (`strpos(lower(...),lower(query))>0` is closer to JS includes than raw `ILIKE '%query%'`). Avoid fetching all 13k records and paginating in PL/pgSQL memory.

Sorting must be applied AFTER all filters and BEFORE OFFSET/LIMIT. Total is the filtered count, not the page count. Tie-breaker should be deterministic across requests; snapshot consistency during concurrent purchases must be considered (offset pages can shift on inserts; keyset or fixed as-of may be needed for infinite scroll). Clearly differentiate server pagination from client-side infinite scrolling.

## 4. Mandatory parity/security tests before implementation acceptance
1. All 7 Excess filters separately + combinations, including case-insensitive literal `%` and `_`, NULL vendor, zero min qty, partial item name/code, inclusive date boundaries.
2. Exact membership and count parity against existing client semantics for representative fixture windows, including 0, 1, 30, 31, 169, and high-cardinality result sets.
3. Page concatenation has no gaps/duplicates and respects the stable quantity/date/ID order; test equal quantities and voucher dates.
4. Read-only permission succeeds, no-view/unauthenticated denied; untrusted filters cannot alter the query; no grant to `anon`.
5. Existing view/RPC and Action Queue unaffected. UI error, no-results, latest-wins and filter resets. Export obtains all filtered matches, not just loaded page.
6. Measure default 30-day and wider history p50/p95 timings **from signed-in production** only with owner-approved read-only timing procedure; read-only SQL here does not prove p95.

## 5. Release sequencing and dependencies
Initial milestone: *S3-E* (Excess) server read contract + separate client adapter PR. PR and indent header paging can follow after the contract proves stable, but given 7/41 live rows this is not a performance emergency. Vendor-wise paging is a separate workpack because the split lookup and vendor grouping are correctness-sensitive. Do not merge C1 #291 / C2 #294 as a prerequisite without owner review. PWA PEC JS/CSS cache policy remains separate release gate.

**Gate:** G0 active, 0/6 formal verified. Read-only evidence gathered; no SQL/grants/service worker/production-data changes.

## 6. S3-E review-only SQL candidate and initial validation checkpoint

Created `ERP_S3_EXCESS_PAGED_SQL_CANDIDATE_20261111.sql` and `scripts/pec-erp-s3-excess-contract-smoke.mjs` on PR #287. Candidate is a **new** `proc_pec_purchase_excess_paged` read-only `STABLE SECURITY DEFINER` endpoint, preserving the existing `proc_pec_purchase_excess`. It uses `require_permission(...,false)`, explicit `PUBLIC/anon` EXECUTE revocation, a 1..200 page limit, nonnegative offset and full filtered `total_count` returned even for empty/out-of-range pages. Payload is `{rows,total_count,limit,offset}`. No client has been changed to call it.

Client filter parity encoded in SQL: case-insensitive **literal substring** rather than ILIKE wildcard treatment; `PLM` alias canonicalised as `PM`, inclusive date bounds, nonpositive min-qty treated as absent, item-name-or-code matching, NULL/empty vendor unmapped detection, stable descending quantity/date/fact ID ordering. Potential client-to-SQL locale/collation differences are a runtime parity check, not presumed resolved.

Independent source-invariant inspection: **14/14 PASS**. This is not SQL compilation, installation, role execution or SQL fixture parity. No local `psql`/PostgreSQL binaries available for actual installation tests; no production RPC deployment. A separate script was committed for reproducible source assertions but not run from a full repository checkout in this session.

Read-only live *existing view* test, **not the candidate RPC**: between `2026-10-12` and `2026-11-11`, date-window count = 169; additionally filtering material class RM and quantity ≥1 gives 161 rows / 161 distinct fact IDs, first 30 and second 30 and remainder 101 under proposed stable sort. Another case (name/code contains 'oil' alongside those filters) returns zero, useful for no-results coverage. These read-only results do not prove installed candidate parity, query latency or UI behaviour.

**STOP before migration:** isolated PG17.4 installation and role tests; stable keyset/offset strategy under concurrent ingestion; count and ordering parity over 13k historical rows and varied dates; client incremental paging and full exports; owner review; PWA asset freshness; authenticated acceptance. G0 active, 0/6 formal gates verified.
