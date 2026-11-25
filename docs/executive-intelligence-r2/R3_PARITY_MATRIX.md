# Executive Intelligence R3 — Sales Viewer parity / improvement matrix (preparation only)

Read at base `3dae0a6` from `public/shared/sales-viewer.html` / `public/shared/js/sales-viewer.js` (existing viewer: `fetchWindowed()`, `fetchFreshness()` on `v_sdv_freshness`, `sdv_zero_sellers_abs`, trend/mix/top-bottom renderers, IK/OK table, ASP KPIs).
No R3 code or endpoint exists in R2. The legacy Sales Viewer and its independent permissions stay untouched.

Status key: **Existing** = in Sales Performance lens today · **R3 contract** = needs a frozen bounded server contract first · **Tested** = covered by R2 tests · **Deferred** = explicitly not in R2.

| Capability | Legacy viewer | EI Sales Performance (R2) | Status / R3 dependency |
|---|---|---|---|
| Anchor = latest mapped date (not wall clock) | yes | yes (`report_date`) | Existing, Tested |
| Month-to-date window | partial | yes (month start to latest mapped day) | Existing, Tested |
| Arbitrary anchor / month / window picker | yes | no | R3 contract (bounded windows, server-validated) |
| Quantity vs value basis | yes | actual units, billed units, billed value shown separately | Existing, Tested |
| ASP (weighted) basis | yes | no | R3 contract: accepted weighted-ASP and zero-denominator definition required |
| Monthly overview, comparable periods | yes | no | R3 contract; no partial-current vs full-prior comparison without explicit coverage |
| MoM / YoY / L3M / L12M | yes | no (never fabricated) | R3 contract |
| IK / OK / godown split | yes | no | R3 contract (no hard-coded dimensions) |
| Region / product / SKU trends | yes | product table (MTD only) | R3 contract |
| Category / subcategory composition | yes | no | R3 contract |
| Rankings (top/bottom) | yes | table ordered by billed value, server-side | Existing (partial); full rankings R3 |
| SKU x month grid | yes | no | R3 contract (bounded) |
| Search / page | client-side over a windowed fetch | server-side search + paging (stable `product_id` tie-break) | Existing, Tested |
| Filter | yes | none yet | R3 contract |
| Export | yes | none | Deferred (existing supported CSV paths only; none added) |
| Zero sellers | `sdv_zero_sellers_abs` | no | R3 contract / access decision |
| Freshness | `v_sdv_freshness` | report date + mapped-day context | Existing; richer freshness R3 |
| Missing-as-zero | n/a | never (NULL shown as "Not reported") | Tested |
| Mixed-UOM aggregation | n/a | never | Tested (no aggregation in client) |
| Bulk windowed fetch in browser | yes | none, by design | R3 must stay server-bounded |

Access: 8 Sales Viewer viewers, 7 without MIS. Never grant them whole MIS and never remove the old viewer; R3/R6 access contracts and retirement are separately governed.
