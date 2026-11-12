# Claude Code execution brief — PEC paging + live acceptance fast track (12 November 2026)

**Purpose:** single bounded client integration package for the existing PEC ERP five-lens UI. The server paging contracts are already **live** and in draft PR #323; use them, do not invent/redeploy or replace unrelated RPCs. User is final merge approval authority. ChatGPT remains independent acceptance reviewer. Keep all work in the canonical shared PWA/Electron PEC files, not duplicated.

## Dependencies and branch safety

1. Check current `main` and PR status. Preserve chronological upstream Claude branches **#291 → #301 → #320**, and integrate standalone **#319** Full→`reset` RPC mode fix. The actual #320 PR changed-file list is PEC-only; a previous broad 23-commit branch ancestry comparison was misleading and explicitly retracted.
2. Wait for or rebase on the resolved dependencies before finalizing. Use **one fresh, isolated client branch/draft PR** for paging integration; do not modify the active #320 branch, server PR #317 or #323. No changes to SQL, RLS, migrations, grants, Supabase data or `public/sw.js` in the client PR.
3. If any server gap is genuinely found, create a **separate minimal draft server PR with deterministic SQL tests and a documented fixture**, not live database DML, and inform the owner. Do not independently apply dangerous migration or merge it.
4. Do not merge or deploy without owner approval. No production PR/indent/MRP recomputation or Tally PO.

## Live server contract map (all additive, authenticated PEC view-gated)

| UI | RPC | Arguments |
|---|---|---|
| PRs | `proc_pec_pr_headers_filtered_paged` | `p_status,p_material_class_id,p_q,p_limit,p_offset` |
| Indents | `proc_pec_indent_headers_filtered_paged` | `p_status,p_material_class_id,p_q,p_limit,p_offset` |
| Excess | `proc_pec_purchase_excess_filtered_paged` | `p_q,p_material_class_code,p_date_from,p_date_to,p_min_qty,p_vendor_q,p_item_q,p_unmapped_only,p_limit,p_offset` |
| Excess audit | `proc_pec_excess_acceptance_audit_paged` | `p_limit,p_offset` |
| Vendor-wise | `proc_vendorwise_buylist_operational_paged` | `p_material_class_id,p_rm_scope,p_rate_status,p_assignment_status,p_q,p_operational_filter,p_limit,p_offset` |
| Vendor-wise filter options | `proc_vendorwise_buylist_operational_options` | `p_material_class_id,p_rm_scope,p_rate_status,p_assignment_status,p_q` |
| Action Queue | `proc_procurement_action_queue_paged` | Already in use; leave stable |

Paged calls return `[{row_data: {...legacy columns}, total_count: n}, ...]`, with the total repeated across rows. They return `[]` on an empty page, **not** `{total_count:0}`. The operational options RPC instead returns `[{filter_value,filter_label,filter_type,group_count},...]`. All require authenticated user with PEC module **VIEW**. Only module editor may invoke mutating actions. Page bounds `1..200`, offset `0..100000`; default 100. The old full-read RPCs are unchanged and can temporarily support complete exports.

## Client correctness requirements — MUST all pass

1. **Server filter before page**: never fetch a page then apply PR/Indent/Excess/Vendor filters only in JS. Map the current UI filters exactly to each server parameter, preserving case-insensitive literal substring search. For Excess, calculate default last-30-day/7-day/365-day/custom ISO start/end dates from existing UI logic and pass them; server defaults to **unrestricted dates** if omitted.
2. **Page shape & total**: unpack `row_data`, compute total/pages from `total_count`, and distinguish empty first page from an out-of-range page (reset/back one page as appropriate). Preserve existing PR/Indent/Excess pagination, action queue server paging, keyboard and aria. Keep current business sort: PR/Indent descending ID; Excess net-unallocated-desc/date-desc; Vendor assigned-first, UNASSIGNED-last, vendor/item/UOM names. Do not apply an extra client sort to only one server page.
3. **Vendor-wise operational choice**: `p_operational_filter` must match `vendor:<id>`, `bucket:LOCAL_PURCHASE`, `bucket:UNASSIGNED` from existing `getVwlOperationalFilterValue`. Fetch dropdown **options for all upstream-filtered rows** through `proc_vendorwise_buylist_operational_options`; do not derive dropdown from currently displayed page. Rerun options when material class/RM scope/rate/assignment/search filters change, not when just current vendor choice/page changes. Preserve split-vendor warning and canonical serial `Indent (line)`.
4. **Latest-wins**: preserve the PR #238 Vendor-wise abort/sequence guard. Add equivalent latest-wins or request cancellation for every paged lens: typing/search, changing filters, switching pages and rapidly toggling tabs must never paint older data. Reset page to 0 on any filter change; loading, error and empty states must not stick.
5. **Exports**: PDF/CSV/TSV and indent exports must use **all rows matching the current filters**, not merely visible page. Where no dedicated paged export exists, temporarily use the existing full RPC, apply the *same filter semantics*, and explicitly limit/notify for unsafe oversized exports rather than silently truncate. Validate totals, canonical indent serial, quantities, vendor buckets, date range and quotation/download behaviour. Avoid false 'export complete' indication.
6. **Role/security**: editor/view-only/no-access state and blocked writes tested with real signed-in sessions when available; otherwise state **BLOCKED**, do not invent JWT or claim live acceptance. Do not bypass module security.
7. **Cross-platform**: shared source must be used by PWA and Electron. Test desktop/tablet/narrow (e.g. 1440/820/390 widths), overlay focus, horizontal table scrolling and stale SW/client JS. Document packaged Electron not inspected if unavailable.

## Automated test demands

- Fixture at least **>200 rows**, matched rows beyond first page, no-match filtered results, out-of-range offset, filter changes during in-flight responses, vendor options present only on later page, 30-day Excess filter and both PR/Indent searches; pagination dedup/ordering.
- Regression under current C1/C2/#320 tests, source inventory with both **FAIL and FIX rows fatal** (keep three unreachable modals explicitly DEFER), service-worker freshness, and export parity fixtures.
- Actual backend read-only contract verification and snapshot of observed selected account permission class when legitimate session exists. Do not turn synthetic fixture PASS into real-user PASS.
- Retain independent existing UI elements and no unrelated WP05/lab/SW file changes.

## Server evidence and blockers

Draft server PR #323: https://github.com/Brahmadathanu/sasv-workspace-dev/pull/323 . Source migration sequence:
- `20261112170000_pec_g1_five_paged_read_contracts.sql`
- `20261112173000_pec_g1_filtered_paged_read_contracts.sql`
- `20261112174500_pec_g1_vendor_operational_paging.sql`

All **10 additive read functions** present and migration replayed in `BEGIN...ROLLBACK`. Source-level SQL regression PASS for PR/Indent/Excess and Vendor operations; underlying database includes 7 PRs, 45 Indents, 834 vendor groups (68 choices), and 13,311 historical Excess rows. DB windowed count can still be expensive; one observed Excess 100-row page query ~1.12 s (one run, not p95). Performance optimization is **not** an accepted gate. No signed-in token for real RPC success here. Server PR #317 carries separate UOM/internal-material writer fixes; do not introduce server edits into client PR.

## Output

One client-only **draft PR** with small coherent commits, actual changed-file list, reproducible test commands/results, per-lens PASS/FAIL/DEFER matrix, desktop/tablet/mobile evidence, backend contract compatibility checklist, status of authorized-editor tests, and conflict/rebase report. User retains final merge approval.

**Formal G0 remains 0/6**; completion of client fixtures does not automatically pass G0 or G4.
