# PEC ERP — Server G1 contract proposal (11 November 2026)

**Status:** design proposal, NOT production approval. Owner project #284; independently verified live definitions and constraints. No migration executed. Separate external client candidate #291.

## A. Confirmed live facts
- `proc_pec_indent_headers() RETURNS SETOF v_proc_indent_console`. Live view has **both** `indent_date` and `approved_date`; #291 can display these without schema changes.
- Header fields: `status`, `source_pr_id`, `indent_date`, `approved_date`; status check draft/approved/issued/closed/cancelled. Lines unique (indent_id, material_class_id, stock_item_id, uom_id).
- `proc_indent_add_line_pec_internal` is a legacy UPSERT: updates existing `requested_qty`, permitting approved/issued with reason. This is **not** suitable as the new restricted manual-draft edit contract without server-side restrictions. Preserve legacy behaviour until impact analysis/approval.
- Approval enqueues `proc_request_snapshot_refresh('indent_approved')`, but snapshot publication is asynchronous. Buylist and bulk vendor recommendation read the published generation, which explains transient absence. The individual recommendation path reads live ranking. Need consistency decision.
- `create_pr_from_mrp_plan_pec_internal` writes draft PR lines from `sum(v_mrp_procurement_plan.procure_qty)`; underlying recursive plan already accounts for opening stock, production need, carry-forward and MOQ. A separate naive stock top-up risks double counting.
- `public/sw.js` v393 navigations network-first, PEC JS/CSS generic cache-first. PR #291 introduces new CSS. Coordinated release policy must guarantee fresh assets for installed PWAs; not within live SQL scope.

## B. Suggested server delivery packages
### S1 — Draft independent-indent edits (bounded writer)
Two new permission-checked public RPCs with internal core implementation or a single discriminated safe RPC (choose after signature impact check): update an existing line quantity, and update the header indent date. Require `module:procurement-execution-console` edit; `status='draft'`; `source_pr_id IS NULL`; no active `proc_pr_to_indent_map`; no existing allocation/purchase/sourcing downstream mutation incompatible with edit. Lock header/line, validate numeric strictly positive quantity, unchanged class/item/UOM, valid date, expected `updated_at` for optimistic concurrency, mandatory reason and immutable audit; return canonical updated record. Preserve line ID and manual insertion order; do not touch approved/issued data. Consider whether metadata `generation_filters.indent_date` requires a synchronized value only for independent manually created records.

### S2 — Snapshot-readiness and vendor-action integrity
Expose lightweight governed status (`published_revision`, `requested_revision`, ready/not ready, latest run outcome) alongside eligible indent readiness, so the client can show deterministic `Preparing vendor options` then reveal actual candidates when **published generation contains its lines**. Do not claim ready from success of enqueue alone. Evaluate source-dependent batch recommendations and live individual vendor ranking for parity. Prefer scoped refresh/read-after-publish over redundant global re-queries; establish acceptable refresh latency via measurement before replacing orchestration. No hidden, repeated refresh storms.

### S3 — Server-paged lenses
Add read-only governed paged RPCs for PR and indent header, excess, audit and vendor-wise grouped list. Preserve existing wrappers for compatibility. Define every filter/order/export contract and stable sort tie-breaker; report total_count and snapshot/cursor semantics; cap p_limit; guard view permissions; empty/error state; prove sums/rows parity against existing unpaged sources. Client #291 already leaves these deferred; introduce progressively after read contracts are independently verified.

### S4 — Hybrid PR replenishment
Develop **preview only** first. Choose replenishment target based on stock policies, demand history, consumption variability, vendor lead time, seasonality and buffer days; no invented defaults. Demand model must treat opening usable stock, firm incoming supplies, existing indents/POs/PRs, allocation/expiry and present MRP production demand without double counting. For each item show production_need, replenishment_need, overlapping_need, stock/inbound offsets, net recommended qty, MOQ/pack rounding and method/source date. Only after representative item-level parity and owner approval add persisted generation mode/version and governed PR creation path. Do not mutate existing draft/historical PR automatically.

## C. Explicit decision and acceptance gates
- S1: Confirm zero/negative quantity policy (recommend reject), allowed date boundaries, audit/mandatory reason, whether unlinked `draft` can have sourcing decisions and their consequences.
- S2: Confirm whether procurement candidate actions are only for approved/issued (current bulk gate) vs draft preselection. Recommend retain approved/issued and make readiness visible; avoid fake instant draft vendor mapping.
- S3: Agree pagination defaults and compatibility; use server-side exact sort and filters. Export remains full approved filtered data, not loaded viewport.
- S4: Decide inventory protection horizon, reorder point vs min/max, item eligibility, existing requisition commitments and handling of intermittent/seasonal supplies. Do not infer business defaults from one product illustration.
- PWA/Electron: #291 is not a release; agree exact PEC asset SW network-first/fallback and version/release checks separately.

## D. Progress and authority
G0 active, 0/6 verified. This is a reviewed proposal candidate only. No SQL applied, permissions modified, user data edited, snapshot refresh requested, client PR merged or PWA deployed. When gates are explicitly accepted: ChatGPT owns server migration verification and implementation; Claude owns client integration via one consolidated contract delta.
