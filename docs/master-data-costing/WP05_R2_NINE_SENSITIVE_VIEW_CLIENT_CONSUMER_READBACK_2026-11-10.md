# WP05 R2 — nine sensitive view clients after CONF-01

**Date:** 10 November 2026. **Status: SOURCE-ONLY CLIENT CONSUMER AUDIT, NO PERMISSION CHANGE.** This updates the bounded nine-view examples in [the original 49-view inventory](WP05_W506_49_VIEW_COLUMN_SENSITIVITY_CONSUMER_INVENTORY_2026-11-09.md) using current `main` source searches and direct client file inspection. The earlier inventory was captured *before* W5-06 confidentiality rollout; this addendum supersedes its historical `.select('*')` observations for the three Staff Governance views only. **No production view body/row read, app RPC, or identity change.**

| View | Actual client consumer on main | Current projection / exposure signal | Governance disposition |
|---|---|---|---|
| `v_costing_staff_classification_register` | `costing-suite-cost-build.js` | `.select(STAFF_GOVERNANCE_COLUMNS.register)`, guarded by `personnelViewAllowed()` requiring CBM View+Edit | W5-06 accepted: restricted user's network query suppressed; no `select('*')` |
| `v_costing_unclassified_staff_for_costing` | `costing-suite-cost-build.js` | `.select(STAFF_GOVERNANCE_COLUMNS.review)`, same guard | W5-06 accepted with explicit CSR-only NOT TESTED residual |
| `v_costing_staff_cost_pool_summary` | `costing-suite-cost-build.js` | `.select(STAFF_GOVERNANCE_COLUMNS.pool)` with `period_start` filter; no nested `staff_details` in projection | W5-06 accepted aggregate view; server masks nested staff_details to restricted callers |
| `v_costing_staff_costing_class_options` | `costing-suite-cost-build.js` | Still uses `.select('*')` for classification options; no individually salaried columns are listed in original inventory | Inspect least-privilege optional-column scope separately; do not break legitimate metadata |
| `v_costing_material_review_acceptance_register` | `costing-suite-material-cost.js` | `.select('*').eq('period_start',periodStart)`; named staff actor/email, reason/note may flow to client | **Needs explicit role and min-column policy**, CCC/MCM overlapping reader paths |
| `v_costing_material_manual_rate_register` | `costing-suite-material-cost.js` | `.select('*')`; source vendor, negotiated rate and remarks may flow to browser | **Needs explicit business sensitivity policy**, MCM/CCC consumer overlap |
| `v_costing_pricing_cost_sheet_line_traceability` | `costing-suite-cost-sheet.js` | Exported `TRACEABILITY_VIEW` constant and client traceability usage; field-level minimum projection not proven in this bounded search | Preserve trace/lineage restrictions; follow actual call chain before classifying safe |
| `v_costing_pricing_cost_sheet_rm_line_traceability` | No exact direct `public/` client path found in repository code search | Original inventory records no authenticated SELECT grant; no client use proved | **No direct client verified** is not proof of no consumer or no indirect RPC |
| `v_costing_scheme_master_audit` | `costing-suite-pricing-policy.js` | `.select('*').eq('scheme_id',schemeId).limit(200)`; audit actor IDs and prior scheme text may reach authorised module | **Need minimum-column and role review** while retaining legitimate audit history |

## Policy implications and next safe package

1. **Do not reopen the three Staff Governance projection fixes.** Their current explicit projections and true signed-in v393 view-only tests supersede the older pre-C1 `.select('*')` warnings. No claim that all other 49 views are safe is implied.
2. **Prioritise three `.select('*')` groups for column-minimum review:** material acceptance actors, material manual vendor rates, and Scheme Master audit actors. Class-options metadata can follow as low-risk clean-up, not a release blocker absent a concrete leak.
3. **Resolve P-W506-VIEW with owner:** current live one-of-four shared reader helper means cross-module View may reach sensitive shared costing views. The Staff Governance View+Edit exception does not make the helper least privilege for other business views. Propose per-view intended business reader and any explicit cross-module exception **before** schema/view GRANT changes.
4. **No preview or candidate RPC execution** in this audit. F1 live body text parity is now proven separately, but the restricted privileged data read scope still awaits independent review and owner authorisation before a preview allowlist change.
5. **Do not claim a security violation simply because `.select('*')` exists:** exposure requires data availability and actual permissions; the current audit identifies fields that could be transmitted, not proof of unauthorised retrieval.

**Further decisions:** owner may select narrow business policy for CCC/MCM/CSR/PPM shared roles, or formally retain a broad Costing-wide reader helper with documented sensitivity/consumer exceptions. Prepare a proposed matrix and isolated tests before any changes. Parent WP05 OPEN, programme 6/13, WP12 B1 receipt pending execution.
