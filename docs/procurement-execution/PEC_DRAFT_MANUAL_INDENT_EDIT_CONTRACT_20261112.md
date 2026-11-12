# PEC draft manual-indent editing — server contract and acceptance gates (12 Nov 2026)

**Status: DESIGN / NON-PRODUCTION. No RPC, migration, client handler, permission grant, or table write deployed.** Tracker #284. Separate from existing consolidated UI/paging PR #347 and hybrid replenishment #305.

## Independently observed live schema / writer inventory
- `public.proc_indent_header`: `indent_id`, `status`, `indent_date NOT NULL`, `approved_date`, `source_pr_id`, `updated_at`, `updated_by`. Dates have **distinct meaning** and must not be conflated.
- `public.proc_indent_line`: `indent_line_id`, `indent_id`, `requested_qty numeric NOT NULL`, `uom_id`, `manual_reason`, `updated_at`. `proc_pr_indent_line_map` supplies direct line lineage; `proc_pr_to_indent_map` tracks header associations.
- `v_proc_indent_line_balance` and `v_proc_indent_fifo_allocation` expose allocated quantity; `proc_indent_line_sourcing_decision` records vendor selection. Do not rely only on quantity or source_pr_id to identify an unlinked manual line.
- Existing public `proc_indent_create`, `proc_indent_add_line`, `proc_indent_set_status`, `proc_indent_set_vendor_selection` wrappers invoke `require_permission('module:procurement-execution-console','t')` under SECURITY DEFINER. No purpose-built public edit-date or set-manual-line-quantity RPC found in live `proc_indent_*` inventory.
- `proc_request_snapshot_refresh` is the existing governed publication request. No direct snapshot table writes or synchronous publication by a new edit writer.
- The original #284 request explicitly requires draft manual/non-PR quantity and date edits. Five-lens C1/C2/paging completion does **not** satisfy this.

## Proposed G1 contract — requires independent review/owner approval before production
1. **Header date:** `proc_indent_update_draft_date(p_indent_id bigint, p_indent_date date, p_reason text)`. Require PEC **Edit** permission through established `require_permission`, actual authenticated user, header row lock, `status='draft'`, `source_pr_id IS NULL`, no active PR-header linkage (check `proc_pr_to_indent_map`) and no PR line mappings; do not touch approved/issued dates. Require valid nonnull date and bounded mandatory reason. Preserve indent number and existing line order. Audit old/new and who/when using established governed audit mechanism (to be identified; do not invent silently).
2. **Manual line quantity:** `proc_indent_update_draft_manual_line_qty(p_indent_line_id bigint, p_requested_qty numeric, p_reason text)`. Same permission and header lock, line lock, draft status, verified manual lineage (no record in `proc_pr_indent_line_map`) and no purchase allocation/receipt against that line. Require finite, strictly positive quantity and preserved UOM, material class, item, indent_line_id and canonical `indent_line_sort_no`. Do not permit zero as implicit delete. Add prior/new quantities, user, reason and timestamp to an append-only audit trail. Update `updated_at` and any existing supported actor field, not unrelated rows.
3. **Conservatism:** Reject edits if ownership, allocation, source provenance, lock/state, audit write or refresh semantics cannot be proved. Do not bypass internal material procurement exclusions or create a purchasing path for internal-classified items.
4. **Snapshot:** identify current generation/revision contract and invoke the **existing authorized refresh request** only if it is necessary for draft visibility; avoid publishing on every keystroke and do not trigger automated PR, PO or MRP mutations. UI must display save/readback and snapshot freshness truthfully.
5. **Concurrency:** assert expected previous value/date or revision if supported, and reject stale editor changes; use row locks, no silent last-write-wins.
6. **Client:** expose only for Edit permission + eligible draft, use canonical shared HTML/JS, server remains authoritative. Keep date field separate from approval date. Show genuine denied/stale errors; wait for actual server success before updating the visible row.

## Required evidence matrix — all must pass before merging an implementation
| Boundary | Positive case | Negative / tamper case |
|---|---|---|
| Role | genuine PEC editor JWT | VIEW-only, no-access, anon, no JWT |
| Status | manual draft indent | approved, issued, closed, cancelled |
| Lineage | manual line, no PR mappings | linked header or mapped PR line, detached PR lineage edge |
| Quantity | valid positive decimal | zero, negative, NaN / nonfinite, incompatible UOM, wrong indent |
| Allocation | no allocated or received quantity | purchase allocation or related posted purchase |
| Date | valid new date on eligible draft | null, wrong-status header, concurrent stale value |
| Audit | reason/user/old/new persisted exactly | missing reason / audit failure rolls back |
| Integrity | same canonical serial and line identity | no reorder, duplicate, delete or hidden approval change |
| Refresh | correct live readback + truthful freshness | failed/lagging snapshot not misrepresented as published |
| Platform | signed-in PWA and next packaged Electron | cached old client, hostile direct RPC, narrow mobile layout |

## Release relationship and non-actions
This feature must be a **separate narrow server/client PR chain**. Do not place speculative untested writers into #347 or release them with the already-tested paging stack. Do not touch live records, migrate SQL, repair PEC migration history, merge or deploy pending contract review. Existing 10 missing migration-history versions remain independently gated. Hybrid #305 is separate and has not been approved for a purchasing writer.

## Research questions before code
- Identify the canonical procurement audit event table/function and acceptable actor capture; verify row triggers and check constraints for both target tables.
- Identify allocation references that remain authoritative even for a draft / historical linked line; confirm lifecycle and transaction semantics.
- Confirm whether business policy should permit **any** manual line on a PR-origin draft, or whether entire PR-origin headers must be excluded (this draft defaults to exclusion).
- Confirm allowed indent-date backdating and whether date affects numbered indent identity or purchase snapshots.
- Confirm read model fields available to client for eligibility, revision and snapshot state.
