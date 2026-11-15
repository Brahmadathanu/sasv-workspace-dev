> **SUBSEQUENT IMPLEMENTATION:** this design is implemented as default-off source and unapplied proposal 06 in draft #442. [Independent review](WP10_G2_IMPACT_PREVIEW_INDEPENDENT_REVIEW_2026-11-16.md) is complete for corrected source with 286 offline PASS; owner source-merge decision remains pending. The original design-only status below is historical; no endpoint is installed, no SQL applied and no flag activated.

# WP10 G2 — Counterfactual subgroup-impact preview contract (draft)

**Design for review, not implemented or applied.** This closes the ambiguity in the proposed design; it does not close the implementation or acceptance gate. WP10 OPEN; programme 10/13. It introduces no override, permission target, writer or change to the existing readiness/activation contracts.

## Exact proposed surface

`public.rpc_wp10_preview_product_subgroup_impact(p_product_id integer, p_proposed_sub_group_id integer) returns jsonb`.

One read-only, STABLE request evaluates the stored and proposed subgroup under the same database statement snapshot and today's IST date. It requires a signed-in identity with the existing `module:manage-products` View permission. Internal helpers remain in `costing`, with no public/anon/authenticated EXECUTE; only the reviewed endpoint would receive authenticated EXECUTE in an **unapplied** proposal. No grant is executed by this design.

The caller supplies neither the existing subgroup nor permission assertions. The endpoint reads the product, verifies that both the product and proposed subgroup exist, and counts current active child SKUs. Missing/invalid inputs reject; they are not fabricated as zero-impact products. It performs no UPDATE, temporary row substitution, rollback-based dry run, builder or writer RPC.

## Context closure that implementation must preserve

| Captured function | Counterfactual requirement |
|---|---|
| `fn_resolve_route_family_for_product(product,date)` | Explicit proposed-subgroup context must preserve product-map first, subgroup-map second, group-map third; group comes from the **proposed** subgroup. Preserve approved/non-archived/effective-window filters, inclusive ends and exact tie-breaks. Product-map precedence remains independent of subgroup. |
| `fn_resolve_effective_route_family_route(product,date)` | Select against the context-resolved family, with approved/superseded, non-archived, date-window and effective-from/version/id ordering identical to the capture. Calling this function unchanged would re-read stored subgroup through its callee. |
| `fn_validate_effective_product_process_route(product,date)` | Preserve the requirement for an approved family mapping and a selected family route **before** selecting a product route. Preserve product-route ambiguity and normal inherited/product precedence. Merely calling the existing effective validator cannot evaluate a proposed subgroup. |
| `fn_validate_product_process_route(route)` | Its internal family lookup uses `route.product_id` and `coalesce(route.effective_from,current_date)`. A proposed-subgroup context must reach **this nested lookup at its own date**, not only the outer today's-date selector. Otherwise the preview can evaluate the proposed family and validate the old family context. |
| `fn_effective_product_process_route_steps(route)` | Captured SQL reads the selected product route, its base family route, base steps and overrides; no product subgroup lookup. Reuse it unchanged while the captured definition matches. |
| `fn_validate_route_family_route(route)` | No product subgroup/date argument; its static/per-route dependencies remain canonical. Reuse unchanged while the captured definition matches. |

Implementation options are bounded: add private explicit-context selectors and a mechanically derived context-aware product validator, or refactor canonical functions only under separate exact authority. **Recommended draft option:** new private helpers only, leaving every live function untouched. Derive the context-aware validator from the captured definition, changing only the named family lookup to the context-aware equivalent. Assert parity against the original body after that one substitution; a broad reimplementation is unacceptable. Use a statement-stable explicit evaluation date and retain the product validator's fixed route-effective-date semantics. Any uncaptured dependency, malformed result or evaluation exception yields UNKNOWN, never a valid/safe result.

The date-neutral helper chain and its source hashes come from the existing committed independent catalogs; no repeat production investigation is required for drafting. A fresh definition/absence check remains necessary before eventual application.

## Response and classification

Return product id, stored/proposed subgroup ids, evaluated IST date, current active-SKU count, and separate `before` / `proposed` results. Each result contains closed `VALID|INVALID|UNKNOWN` state, route source, family id, family-route id, product-route id and bounded structured reason codes. Do not expose raw SQL exception text as HTML. Include `assessment_kind: PRODUCT_SUBGROUP_ROUTE_IMPACT`, `authoritative_for_save: false`, and `review_required`.

| Before / proposed | Required presentation |
|---|---|
| Same subgroup | No subgroup change; no route-loss claim needed. |
| No active children | State the observed count and route assessment; do not imply future activation will pass. |
| VALID → INVALID with active children | Route loss detected; review/remediate before retry. Existing proposal 05 still decides inside the writer transaction. |
| Any UNKNOWN | Impact not proven; review required. Never substitute missing/invalid/zero children. |
| VALID → VALID | No new route loss observed at this snapshot; show changed route identity, if any, for review. No activation/readiness guarantee. |
| INVALID → INVALID | Existing route problem remains; show both reason sets. Do not describe the product as ready. |
| INVALID → VALID | Proposed route resolves at this snapshot; no guarantee about save/activation or concurrent changes. |

The preview cannot approve a write, mint an approval token, suppress the transactional guard or authorize a privileged re-parent. No exception or approval-reference bypass is added. A context digest may support detecting stale UI results, but it must never be treated as authorization.

## Client integration and verification gate

Use the existing Manage Products update confirmation behind default-off `WP10_SAFEGUARDS_V1`. Run only for an existing product with a changed subgroup. Bind the result to product id, stored subgroup, proposed subgroup and one dialog attempt; discard after selection/draft/permission changes, cancellation or remount. Serialize the entire import/preview/confirmation/submission lifecycle and revalidate immediately before the existing writer. Present the stored/proposed route and remediation; do not label preview success as costing READY. An absent endpoint is explicitly unavailable, with no fabricated assessment. The product writer and its server guard remain authoritative.

Required isolated fixtures: stored-context parity; product/subgroup/group precedence; proposed subgroup in a different group; inclusive windows and superseded selection; missing mapping/route; overlapping product routes; **product-route family lookup at route.effective_from differs from today's lookup**; overrides and inherited routes; malformed/error→UNKNOWN; no active SKU; invalid→invalid; permission/no identity; and zero business-data/audit/epoch mutation from repeated previews. Mutants must detect ignoring proposed subgroup in both the outer selector and the nested product validator, dropping product-map precedence, or returning VALID on an exception.

Require mocked Chromium at 390/1280 for off-path parity, read-only call surface, changed selection/subgroup while pending, repeated confirmation, stale/cancelled response, endpoint absent, unknown and server rejection after a favourable preview. Any new read-only RPC allowance must be exact and re-pinned; no broad WP08/PEC guard exemption. Add proposal 06 to preflight/receipt/rollback and static inventories together, keeping all SQL under the documentation proposal directory and unapplied.

This contract is concrete input for the remaining implementation; no new live endpoint, client call, SQL file, grant or migration is created by this document. Production execution, performance and real-role/installed-client acceptance remain separate owner gates.
