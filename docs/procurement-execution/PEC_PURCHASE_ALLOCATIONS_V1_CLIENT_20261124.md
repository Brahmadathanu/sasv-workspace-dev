# PEC Purchase Allocations lens — Client PR B (frozen V1 contract)

Status: client implementation complete against the frozen V1 interface. The server migration
`20261124134249_pec_purchase_allocations_reporting_v1.sql` is deployed (server PR #527, merged as `80821cd`);
see "Server verification" for what was and was not verified.

## Design

One module, `public/shared/js/pec-purchase-allocations.js` (imported with a version suffix because
`public/sw.js` is protected on client PRs):

1. **core** (DOM-free): Asia/Kolkata date presets (default Yesterday), coordinated lens state, per-UOM exact
   totals, canonical ordering, complete-retrieval integrity, CSV and print builders.
2. **adapter** (DOM-free): the *only* place that knows RPC names, parameters and response fields. Maps V1 rows
   to a camelCase view-model and raises `PaContractError` on drift (missing field, unknown `row_kind`,
   allocation row without an indent line).
3. **lens controller** (`initPurchaseAllocationsLens(ctx)`): reuses the console's `createFeed` (latest-wins,
   abort, infinite scroll), shared filter drawer, search, export menu, card tables, `pec-dialog` drill-down
   and the modal stack. No FIFO or balance computation exists on the client.

## Contract mapping

| V1 element | Client use |
|---|---|
| `p_date_from/p_date_to` (inclusive voucher dates) | from the date control, Asia/Kolkata; an invalid range sends no request |
| `p_material_class_code` | RM / PM / IND (`PLM` normalised to `PM`) |
| `p_q` | the search field (material) |
| `p_indent_q`, `p_vendor_q` | filter drawer |
| `p_status` | `all` / `allocated` / `partial` / `unallocated` (receipt level) |
| `p_limit` (1–200) / `p_offset` | feeds use 30; exports and drill-downs use 200; clamped client-side |
| `proc_pec_purchase_alloc_summary` | counts, per-UOM totals, `coverage`, `balance_basis` (no paging args) |
| `…_indent_paged` | Indent-wise cards, server order (numeric indent number) |
| `…_material_paged` | Material-wise rows incl. fully unallocated and returned materials |
| `…_vendor_paged` | Vendor-wise rows keyed by `vendor_key` |
| `…_trail_paged` (+ `p_indent_id/p_stock_item_id/p_uom_id/p_vendor_key/p_purchase_fact_id`) | indent lines, drill-downs, exports, print |

Safeguards implemented on the client side of the contract:

- **No double counting.** Receipt quantities repeat on every trail row: receipt aggregates are de-duplicated by
  `purchase_fact_id`; period balances repeat per receipt: indent-line summaries are de-duplicated by
  `indent_line_id`.
- **Zero-effective returned receipts** are labelled "Returned (nil effective)", never "Unallocated".
- **Indent filter.** The summary shows "Allocated (any indent)" and "Allocated to filtered indent" separately;
  a receipt drill-down states how much is allocated to other indents and that it is *not excess*. Unallocated is
  always the server's receipt-wide figure.
- **Balances** are shown as server values, labelled reconstructed (opening, closing) or live (current).
- **Unmapped vendors** stay separate by `vendor_key`; drill-down uses `vendor_key`.
- **Per-UOM only.** No quantity is ever totalled across UOMs.
- **Exports** fetch every page (200 per page) and refuse a partial, repeated or drifting dataset.

## Verification (offline; synthetic contract-shaped fixtures)

- `scripts/pec-purchase-allocations-model.test.mjs` — 22 unit tests (dates, state, request contract, mapping,
  drift errors, decimals, de-duplication, returned/unallocated, filtered receipts, ordering, CSV, print).
- `scripts/pec-purchase-allocations-ui-smoke.mjs` — real browser against the real console with a page-side
  mock of the five V1 RPCs: navigation order, defaults and request arguments, three modes, drill-downs,
  return path, latest-wins, errors/retry, empty and invalid states, paging, complete CSV and print, drift
  refusal, 390/820/1440 px layouts, view-only role, regression of the other lenses.
- `scripts/pec-modal-stack-smoke.mjs` sweeps every dialog pair, including the new drill-down.
- Screenshots: `docs/procurement-execution/evidence/pec-purchase-allocations/`.

These prove client behaviour against the **contract shapes**. They do not prove server correctness, the
23 Nov acceptance values on live data, authenticated-browser behaviour or Windows Electron behaviour.

## Server verification (added at integration)

- **Isolated PostgreSQL fixture** (`scripts/pec-purchase-allocations-pg-fixture.sql`, CI workflow
  `pec-purchase-allocations-pg17.yml` on `postgres:17`): loads the REAL repository SQL (chronological FIFO /
  return-adjusted receipt views and the V1 reporting migration) over stand-in tables for the live-only base views,
  with synthetic data. 109+ assertions: grants (no anon, helper not executable by any API role), permission gate
  (no permission denied, view-only allowed), argument validation and paging bounds, fact 169565 allocations and
  balances, approval-date semantics for opening / new demand, multi-receipt indent lines, returned (nil effective)
  receipts, positive unallocated receipts with accepted excess, partial PM receipt, fully unallocated Nos, mapped
  vendors grouped by id with several source labels, unmapped suppliers kept apart, indent-filter reconciliation
  (other-indent allocation is not excess), whole-indent balances unchanged by vendor filters, per-UOM
  reconciliation of summary / material / vendor / trail / indent modes against an independent base-view query,
  date boundaries, class filters and the PLM alias, fractional exactness, ordering and paging, empty ranges and
  read-only behaviour. Local run: PostgreSQL 16.15; CI runs 17.
- **Repeated timing at fixture scale** (3,000 facts, 1,500 lines, 15 runs, local PG16): summary median
  ~474 ms / p95 ~555 ms; 200-row trail median ~27 ms / p95 ~36 ms. This is fixture-scale evidence only, not a
  production p95 (ChatGPT's single production observations: trail ~1.3 s, 1-23 Nov summary ~0.88 s).
- **Contract parity** (`pec-purchase-allocations-pg-export.sql` + `pec-purchase-allocations-contract-parity.test.mjs`):
  the real RPC output of the fixture is passed through the client adapter. This found and fixed one client defect:
  indent numbers are text on the server; a non-numeric number such as `X7` became `NaN`. Numeric indent numbers
  still sort numerically; text numbers sort after them.

## Live acceptance (owner steps; not performed by the assistant)

No authenticated access to production was available to the assistant, so no authenticated-browser or live
acceptance is claimed. The owner can verify, signed in with PEC view permission on the deployed build:
1. Purchase Allocations -> Yesterday / specific date 2026-11-23: summary shows the server's current figures
   (timestamped observations at integration: 39 facts, 10 indents, 40 lines; Kg 9369.455 purchased,
   9086.463741 allocated, 282.991259 unallocated; L 35; Nos 41066 / 30000 / 11066). These counts are mutable.
2. Indent-wise: indent 84/107 = 5, 156/170 = 50, 191/198 = 80 Kg for purchase fact 169565; closing 0 / 0 / 20.
3. Indent #247 shows serial 1 (110 Kg) and serial 2 (62 Kg) with opening 0 and closing 0.
4. Material-wise and Vendor-wise drill-downs, an indent filter (other-indent allocation is not excess), CSV
   export (complete data) and the print statement; "Open indent" returns to the lens.

## Release gate

Merge of the lens requires the server deployment (done), contract parity (done against the real SQL output) and
a green integrated suite. The consolidated release PR then adds network-first treatment for
`pec-modal-stack.js` and `pec-purchase-allocations.js` and advances the service-worker cache and Electron
versions after re-checking current main and the latest release.
