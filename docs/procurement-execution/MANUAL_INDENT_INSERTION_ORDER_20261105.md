# PEC — Manual indent insertion-order correction (2026-11-05)

## Business requirement
For an indent created manually in Procurement Execution Console (source_pr_id IS NULL), show lines in the order they were added. A subsequently added item must appear after prior lines. A PR-origin indent continues to use its existing governed PR/classification ordering. Indent lines shown in the console and requisition PDF/CSV/TSV must use the same serials.

## Root cause and ownership
The client `public/shared/js/procurement-execution-console.js` reads `proc_pec_indent_lines` and explicitly sorts the result by `indent_line_sort_no` for screen and requisition exports. This is correct and remains unchanged. The authoritative `v_proc_indent_lines_console_ordered` view previously computed the serial using an alphabetical/classification-derived `indent_line_sort_key` even for manual indents.

## Server implementation
Live migration `20261105091814_pec_manual_indent_insertion_order` changes only the computed sort-key CASE branch in `public.v_proc_indent_lines_console_ordered` for indent headers with `source_pr_id IS NULL`. It orders by the existing monotonically assigned `indent_line_id`, with zero-padded numeric text to avoid lexicographic ID mistakes. The existing row_number() partition and ordering, RPC contract, purchase quantities, edit functions, permissions, schema, PR-derived ordering and dependent exports remain unchanged.

The SQL migration includes a source-definition baseline guard. It is intended as a one-time migration and must not be reapplied manually to an already migrated view.

## Live verification (2026-11-05 IST)
- 29 manual indents, 550 manual indent lines: **550/550** canonical serials match `row_number() over(partition by indent_id order by indent_line_id)`.
- 1,025 PR-origin indent lines: **0** received the `MANUAL_INSERTION` sort-key branch; no missing serials.
- 550/550 manual lines received the new branch; no missing serials.
- Scope of verification: SQL-level data and definition; no signed-in Electron GUI or printed PDF acceptance yet.

## Release / acceptance
This is a **server-only behavior fix**. The existing Electron client and PWA already use this shared read RPC; no client code or cache bump is needed for this ordering correction. Any next Electron release will inherit the server behavior. Do **not** mark an Electron build as published on the basis of this server migration.

Signed-in acceptance: open an existing manual indent with differently alphabetized items; verify lines are in addition order, append one new item, refresh and confirm it remains last, and compare requisition PDF/CSV/TSV ordering. Separately verify a PR-created indent keeps its prior order. No change to purchase quantities, approvals or other workstreams is allowed.
