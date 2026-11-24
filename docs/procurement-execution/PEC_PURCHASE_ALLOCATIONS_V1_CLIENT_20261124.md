# PEC Purchase Allocations lens — Client PR B (frozen V1 contract)

Status: client implementation complete against the **approved V1 interface specification**. The server
endpoints are **not asserted to be deployed**; this PR must not be merged until the server deployment and
contract parity are verified (see "Release gate").

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

## Release gate

Not mergeable until: server deployment confirmed, live read-only contract parity (names, argument defaults,
response fields) verified against this mapping, integrated browser acceptance on the deployed PWA, and the
release PR adds network-first treatment for `pec-modal-stack.js` and `pec-purchase-allocations.js` and advances
the service-worker cache and Electron versions after re-checking current main and the latest release.
