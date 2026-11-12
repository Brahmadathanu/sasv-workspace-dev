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
