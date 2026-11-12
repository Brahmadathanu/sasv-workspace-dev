# PEC server-paging client integration — acceptance ledger (12 Nov 2026)

**Tracking:** #284, #305 · **Server contract:** draft PR #323 (migrations `20261112170000/173000/174500`, ten additive read functions) · **Status:** draft client PR, not merged/deployed. Formal G0 stays 0/6; nothing here promotes G0 or G4.

## 1. Branch, dependency and conflict report
| Item | Fact |
|---|---|
| Base | `origin/claude/pec-c1-five-lens-fast-track-20261112` (#320, `ff5c6d83`) + `main` `c47b3f96` merged (no conflicts). Chain: **#291 → #301 → #320 → this PR**. All four were still open/unmerged when this branch was cut (`main` has none of them), so this PR's full diff against `main` includes the stack; review the delta with `git diff claude/pec-c1-five-lens-fast-track-20261112...HEAD`. Rebase onto `main` after the stack merges. |
| #319 (Full → `reset`) | **Integrated** (commit `1bd98ab0`): the identical one-line change (`"full" ? "reset" : "safe"`) and the byte-identical `scripts/pec-resync-mode-contract-smoke.mjs`, merged by hand because #320's success-toast edit sat next to that line. Merge order with #319 is conflict-neutral (identical hunk). |
| #320 / #301 / #291 / #317 / #323 branches | Not modified. No SQL, RLS, migrations, grants, `public/sw.js`, cache or app versions. No server gap was found, so no server PR was opened. |

## 2. Contract map as implemented
| UI | RPC | Client mapping (server-side filter BEFORE paging) |
|---|---|---|
| PR Workbench | `proc_pec_pr_headers_filtered_paged` | `p_status`←status select, `p_material_class_id`←class (number), `p_q`←search (PR number), `p_limit`←page size 30, `p_offset`←page×30 |
| Indents | `proc_pec_indent_headers_filtered_paged` | same mapping (search = indent number) |
| Excess | `proc_pec_purchase_excess_filtered_paged` | `p_q`←quick search, `p_material_class_code`←canonical code, `p_date_from/p_date_to`←existing `getExcessDateRange()` ISO dates (30d / 7d / 365d / custom, **always sent** because the server defaults to unrestricted), `p_min_qty`, `p_vendor_q`, `p_item_q`, `p_unmapped_only` |
| Excess audit | `proc_pec_excess_acceptance_audit_paged` | `p_limit`, `p_offset` |
| Vendor-wise | `proc_vendorwise_buylist_operational_paged` | existing `buildVwlRpcFilterParams()` (5 upstream filters) + `p_operational_filter` (= `getVwlOperationalFilterValue` values `vendor:<id>`, `bucket:LOCAL_PURCHASE`, `bucket:UNASSIGNED`), limit 75 |
| Vendor-wise options | `proc_vendorwise_buylist_operational_options` | the same 5 upstream filters only. Fetched **before** the page and only when those filters change or on an explicit reload (after mutations/refresh); never for a page or vendor-choice change; an unavailable vendor choice is cleared before it is sent |
| Action Queue | `proc_procurement_action_queue_paged` | untouched |

Shape handling: `unpackPagedRows` reads `row_data`/`total_count` (total from the first row); empty page `[]` ⇒ total 0. Pages/totals come from `total_count`; Next is disabled by `(page+1)×size ≥ total` (no more "short page" guessing). An empty non-first page (offset out of range because data shrank) recovers to the last real page using page 0's total (`fetchPageWithRecovery`); an empty first page is the genuine empty state. Limits clamped to 1..200. Tab-count badges now use `total_count` of 1-row pages instead of three full-table reads at boot. Server order is authoritative (no client re-sort of a page).

**Latest-wins:** new `createLatestWins()` per lens (PR, Indents, Excess, Audit) aborts the previous request (`abortSignal` where available) and drops stale responses; Vendor-wise keeps the PR #238 sequence/abort guard. Any filter/search change resets the page to 0.

**Pre-existing defect fixed on the way:** `setTabPanelControlsLoading` restored a snapshot of control state taken at load start, overwriting pager buttons the renderer had just set (e.g. Prev stayed disabled after moving to page 2). `setPagerDisabled` updates the snapshot; covered by the large-fixture test.

## 3. Exports
- Vendor-wise PDF/CSV/TSV: unchanged transport (`proc_vendorwise_buylist_filtered`, the existing full read) with the same upstream filters + operational filter, so they cover **all matching rows**, not the visible page (fixture: 500 rows exported vs 75 shown; with a vendor filter, exactly that vendor's rows; canonical `IND-… (n)` serial preserved).
- New guard: more than `PEC_EXPORT_MAX_ROWS` (50 000) rows is **refused** with an explicit message ("nothing was truncated"), never truncated and never reported complete.
- Other lenses: PR/Indent line exports (PR-form PDF/CSV, indent form) are per-document and untouched; the Excess lens exposes no export.

## 4. Known limits / DEFER
| Item | State |
|---|---|
| "Show split only" in Vendor-wise | No server filter parameter exists → that single mode keeps the legacy full read + client filter (documented, tested by the VWL smoke). **DEFER:** server split filter. |
| Real signed-in editor / view-only / no-access acceptance | **BLOCKED** — no legitimate session here; nothing was faked or claimed. Fixtures only. |
| Live RPC success against the deployed backend | **Not tested** (no token). The fixtures emulate the SQL in `scripts/lib/pec-paged-shim.mjs`; they prove client mapping, not backend behaviour. |
| Excess query cost (~1.12 s/100-row page, one server run) | Server performance is not a gate here; not measured client-side. |
| Packaged Electron | Not inspected (shared-source parity by repository inspection only, see #320 ledger). |
| PWA cache policy for PEC JS/CSS | Still the C1 §4b release gate; stale-SW behaviour not changed here (`sw-freshness` suite passes). |
| PR PDF runtime | jsPDF not installed in this environment → skipped, **not verified**. |
| Three unreachable modals (`vendorAliasMap`, `prEditReq`, `prEditDelta`) | DEFER in the inventory; unchanged. |

## 5. Tests (this environment)
| Command | Result |
|---|---|
| `node scripts/pec-paging-contract-smoke.mjs --shots docs/procurement-execution/evidence/pec-paging-live-acceptance` | PASS (72 checks) — fixtures: 250 indents, 230 PRs, 450 excess (13 % in 30 days), 250 audit rows, 500 vendor-wise rows (+50 001 for the export guard). Covers limit/offset/page maths, no duplicates, descending order, PR/Indent search hit beyond page 1, no-match empty, out-of-range recovery, status/class filter mapping, 30d/7d/365d dates, Excess order, audit paging, VWL options-from-later-page, options refetch rules, operational filters, export all-rows/TSV/serial/filtered/oversize refusal, stale slow response, rapid tab toggling, paged-failure error state, 1440/820/390 pagers |
| Mutation check | with latest-wins disabled the stale-response checks **fail** (verified), so the test is discriminating |
| `node scripts/pec-five-lens-inventory.mjs` | PASS — FAIL **and FIX** rows are now fatal; the three unreachable modals stay DEFER |
| `pec-erp-c1-layout-smoke`, `pec-erp-c2-vendor-selection-smoke`, `pec-c1-five-lens-fasttrack-smoke`, `pec-erp-c1-static-smoke`, `pec-wp01-indent-serial`, `pec-pr-scope`, `pec-resync-mode-contract`, `pec-pr-pdf-continuation-header` | PASS (stubs now answer the paged RPCs via the shared shim; static smoke allows exactly the six new paged RPC names and nothing else) |
| `pec-vwl-search-reliability-smoke`, `pec-plm-pm-canonical-smoke` | **Updated and PASS**: they pinned the old full-read flow (`proc_vendorwise_buylist_filtered` as the list call; client-side Excess class compare). Race/abort/error/recovery assertions are unchanged; harness now serves the paged shape and the options RPC; PLM check now asserts the canonical code is sent to the server read and that `p_material_class_code` appears in no write payload |
| `node --test scripts/fg-bit-ux-1/sw-freshness.test.mjs` | 11/11 |

## 6. Per-lens matrix (fixture evidence only; **no real-account PASS**)
| Lens | Server filter → page | total/pages | Latest-wins | Empty/error/out-of-range | Exports | Layout 1440/820/390 | Real accounts |
|---|---|---|---|---|---|---|---|
| PR | PASS (F) | PASS (F) | PASS (F) | PASS (F) | n/a (per-document) | PASS (F) | BLOCKED |
| Indents | PASS (F) | PASS (F) | PASS (F, stale slow response) | PASS (F) | n/a | PASS (F) | BLOCKED |
| Action Queue | unchanged | unchanged | unchanged | unchanged | unchanged | PASS (F) | BLOCKED |
| Vendor-wise | PASS (F); split-only DEFER | PASS (F) | PASS (F, #238 guard + new options order) | PASS (F) | PASS (F) all rows + oversize refusal | PASS (F) | BLOCKED |
| Excess (+ audit) | PASS (F) dates always sent | PASS (F) | PASS (F) | PASS (F) | no export | PASS (F) | BLOCKED |

## 7. Backend contract compatibility checklist (for ChatGPT acceptance)
- [x] Only the six paged/options names added; arguments exactly as the contract map; defaults/bounds respected (limit 30/75 ≤ 200; offsets ≥ 0).
- [x] `row_data` unpacked; legacy column names unchanged; `operational_filter_value` extra column ignored safely.
- [x] Empty page `[]` handled; total repeated per row used from row 0.
- [x] No page-then-filter in JS for PR/Indent/Excess/Vendor-wise (except documented split-only).
- [ ] Authenticated call of each RPC with a real PEC VIEW token — **NOT DONE**.
- [ ] Observed permission class of a legitimate session — **NOT AVAILABLE**.

---

# Final correction package (review findings P1/P2) — 12 Nov 2026

## 8. P1 — Jump to Indent across all pages
**Root cause:** `jumpToIndent(id)` reset filters, loaded page 0 and then did `state.indentsRows.find(...)`. After paging moved server-side, `indentsRows` holds only the current page (live: 45 indents, 15 outside page 1), so any indent beyond page 1 silently did nothing.
**Fix:** `jumpToIndent(id, number)` now resolves the header by exact id through `resolveIndentHeaderById`: (1) a cheap PEC-VIEW-gated `proc_pec_indent_headers_filtered_paged` lookup by indent number (limit 200, exact id match required); (2) on a miss or without a number, the existing full-header read `proc_pec_indent_headers` (still VIEW-gated; used only for this navigation, never for ordinary paging). Missing/inaccessible → toast "Indent … was not found or is not accessible." and no modal; read errors are reported. A `jumpToIndentSeq` token makes the latest navigation win; stale results are dropped after every await. The modal/selection/focus path is the unchanged `openIndentViewModal`, using the loaded list row when it is on the page.
**Tests (paging smoke, Jump block):** first-page indent (#250); page-2 indent (#200, asserted absent from page 0) resolved via the paged lookup (no full read); stale number with valid id → fallback to the full-header read opens the right indent; nonexistent id (#9999) → message, no modal; competing navigation (slow older jump vs fast newer) → newer wins. Mutation check: forcing `isCurrent = () => true` makes the competing-navigation test FAIL.

## 9. P2 — Excess count badge
**Finding:** the badge elements (`#tabCountIndents/#tabCountPr/#tabCountExcess`) **do not exist** in the markup (also absent on `main`), so these counts were never displayed — and my earlier boot probes (including a windowed Excess count over ~13k rows) were invisible, wasted reads.
**Decision:** (a) one shared `buildExcessRpcParams()` now builds the Excess read for both the table page and any count, so they cannot disagree; (b) badge meaning, if ever rendered, = rows matching the lens' **active filters (default last 30 days)**, never all-history; (c) `refreshAllTabCounts()` skips the probes entirely when no badge element exists (no invisible server cost). No new UI was added.
**Tests:** current markup → no badge elements and zero Excess probe calls at boot; with an emulated badge element: boot value = default 30-day count (124 of 450 fixture, not 450), probe sends the same date range as the lens, lens total equals badge, follows the 365-day preset (→450) and the quick search, stays empty (not a wrong number) when the read fails.

## 10. P2 — Vendor-wise export completeness (>1,000 rows)
**Verification:** `supabase/config.toml` sets `max_rows = 1000` (also the Supabase default) — PostgREST silently caps an unpaged function result. `proc_vendorwise_buylist_filtered` is unpaged, so the previous export/split-only paths could return **at most 1000 rows without any error**. (The live project's configured value could not be read from here; the repo config/default is the evidence.) Live scale today is 834 groups, i.e. no truncation yet, but growth would have truncated silently.
**Fix (no new server function):** `fetchAllVendorBuylistPagedRows()` pages `proc_vendorwise_buylist_operational_paged` (200 rows/page, never capped) with the same upstream filters and the operational vendor choice, verifies `rows.length === total_count` and **aborts with "Incomplete retrieval … nothing was exported" on any mismatch**; refuses a total above 50 000 after the first page (before fetching more) with an explicit message. CSV/TSV/PDF and the split-only list now use it; split-only still filters client-side with the split lookup (no server parameter exists — DEFER), operational filter is applied server-side for exports, and the existing sort/serial/quantity mapping is unchanged.
**Evidence (executable runtime vs synthetic):**
| Evidence | Kind | Result |
|---|---|---|
| Emulated max_rows: unpaged full RPC over 1500 fixture rows returns 1000 | synthetic emulation of PostgREST cap | shown in the test (documents why the old path was unsafe) |
| CSV: 1500 rows, 1500 distinct items, Σ qty = 7500 (1500×5), canonical `IND-26-1xx (n)` in every row | real client code, synthetic data | PASS |
| TSV: 1500 rows + header | same | PASS |
| Operational vendor choice: export row count == server total for that vendor (25) | same | PASS |
| **PDF: real jsPDF 2.5.1 + autotable 3.8.2 running in Chromium, text extracted with `pdftotext`: 1500 distinct item names across 26 pages, canonical serial present** | **executable runtime (real libraries), synthetic data** | PASS |
| `pec-pr-pdf-continuation-header-smoke` runtime (3-page PR PDF) | executable runtime, synthetic | PASS (previously SKIPPED; libs installed in a scratch dir, `PEC_JSPDF_ROOT`) |
| Reliability harness: 450 rows over 3 pages collected; empty page when total=450 → "Incomplete retrieval" abort; 50001 → refused after page 1 | unit, mocked RPC | PASS (39 checks) |
Not evidenced: real backend row counts/performance, real `max_rows` of the live project, large-PDF memory/time on user hardware (26 pages for 1500 rows in this run).

## 11. Integrity re-check
All five lenses re-verified by the suite below: server filtering before paging; totals/page boundaries; out-of-range recovery; latest-wins/abort; vendor options from all upstream-filtered rows; Safe/Full resync mode (`full`→`reset`, #319 test passes); role/edit gating (C1/C2 smokes); 1440/820/390 layouts; no stuck loading or disabled pagers; single shared source (static smoke: only `public/shared/…` copies). The inventory still fails on **FAIL and FIX** and keeps the three unreachable modals as DEFER.

## 12. Commands and results (12 Nov 2026; `PEC_JSPDF_ROOT` pointing at a scratch `node_modules` with jspdf 2.5.1 + jspdf-autotable 3.8.2)
| Command | Before this package | After |
|---|---|---|
| `node scripts/pec-paging-contract-smoke.mjs` | 72 PASS | **94 PASS** (jump 6, badge 7, export/transport/PDF 12 added/changed; PDF runtime runs only when `PEC_JSPDF_ROOT` is set, else prints SKIP) |
| `node scripts/pec-vwl-search-reliability-smoke.mjs` | 33 | **39** PASS |
| `node scripts/pec-plm-pm-canonical-smoke.mjs` | PASS | PASS (assertion follows `buildExcessRpcParams`) |
| `node scripts/pec-five-lens-inventory.mjs` | 0 FAIL/FIX | 0 FAIL/FIX (253 controls) |
| C1 layout 118 · C2 53 · fast-track 23 · static 17 · wp01 serial · pr-scope · resync-mode 3/3 · pr-pdf-continuation (runtime now PASS) | PASS | PASS |
| `node --test scripts/fg-bit-ux-1/sw-freshness.test.mjs` | 11/11 | 11/11 |
Fixture sizes: 250 indents, 230 PRs, 450 excess, 250 audit, 500 vendor-wise (1500 for the export block, 50 001 for the size guard).
Changed files (this package): `public/shared/js/procurement-execution-console.js`, `scripts/lib/pec-paged-shim.mjs`, `scripts/pec-paging-contract-smoke.mjs`, `scripts/pec-vwl-search-reliability-smoke.mjs`, `scripts/pec-plm-pm-canonical-smoke.mjs`, this document. No SQL, migrations, RLS, grants, `public/sw.js`, versions or unrelated modules.

## 13. Remaining acceptance blockers (honest status)
- **BLOCKED:** genuine signed-in editor / view-only / no-access sessions; live RPC success with a PEC VIEW token; live `max_rows` value; real row volumes. Nothing here is authenticated-backend acceptance.
- **Not verified:** packaged Electron; installed-PWA JS/CSS freshness (C1 §4b release gate; `sw-freshness` unit suite only); production performance (incl. Excess ~1.1 s/page server note).
- **DEFER:** server-side split-only filter; the three unreachable modals; badge UI (not rendered).
- Formal G0 remains 0/6; G4 not promoted.
