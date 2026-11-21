# Selected Scheme Viability — replacement for all-scheme comparison (design only)
Date: 20 November 2026 IST. State: PROPOSAL / READ-ONLY. Owner final approval authority.
Source: connected production PostgreSQL 17.4, project qhmoqtxpeasamtlxaoak, and main client `public/shared/js/costing-suite-scheme-comparison.js`.
This proposal does not approve SQL, rollout, data deletion, scheduler alteration, merge, or client code change. Separate from WP10/WP12 formal closure and Executive MIS.

## Decision and plain-English purpose
**Recommend replace** the low-value exhaustive Scheme Comparison with **Selected Scheme Viability** in Cost Sheet Review. Display only schemes actually selected by the governed IK/OK scheme policy for a SKU, NOT every possible Scheme Master entry for every SKU. A SKU with a common IK/OK scheme yields one displayed scheme with both regional outcomes; a SKU with different selected schemes yields two regional scheme entries (or one SKU row with two distinct region cells). No scheme is chosen by the new screen: the existing Pricing Policy Manager and governed policy precedence remain sole authority. The view is read-only; no new policy-writing mechanism.

## Read-only observed facts
- Existing UI reads `public.v_costing_pricing_sku_scheme_comparison`, shows every scheme for each SKU, includes IK/OK outcomes and links to PPM SKU Policy Overview. It is owned by CSR and legacy PPM URLs redirect into CSR.
- The existing `costing.sku_selected_scheme_policy_context_snapshot` is run-pinned, keyed by period/valuation/run/SKU/region, and includes scheme_id, scheme_name, paid/free/total quantities, resolution status, effective policy metadata. It is the authoritative selection input for the proposed read model. Do not infer scheme from row ordering or current Scheme Master.
- `costing.sku_scheme_viability_snapshot` is the current run-pinned all-scheme result source, ~477 MiB allocated, ~240k estimated total rows as of 20 Nov. These bytes are NOT guaranteed immediately reclaimable.
- Live sampled exact counts, never approval inferred from SUCCESS:

| Run | Status / month | Existing all-scheme rows | SKU count | IK+OK policy rows | Distinct selected SKU-scheme pairs | Different IK/OK schemes | Missing schemes by SKU |
|---|---|---:|---:|---:|---:|---:|---:|
| 122 | September, APPROVED/LOCKED | 3,804 | 634 | 1,268 | 634 | 0 | 0 |
| 143 | October, APPROVED | 3,762 | 627 | 1,254 | 627 | 0 | 0 |
| 148 | October, draft | 3,768 | 628 | 1,256 | 628 | 0 | 0 |
| 152 | November, draft; NOT approved | 4,403 | 629 | 1,258 | 630 | 1 | 0 |

For approved 143: 3,762 -> 627 rows (83.3% fewer). Illustrative result only; NOT measured storage savings, query speed or general future outcome. The November exception proves NOT to impose a unique scheme per SKU across regions.

## Required architecture and source-of-truth contract
1. The *selection* is `costing.sku_selected_scheme_policy_context_snapshot` as-of exactly the selected `(period_start, valuation_date, refresh_run_id)`, one policy per SKU and region IK/OK. A resolved scheme is selected only by governed policy; preserve unresolved/ambiguous/missing outcomes as explicit status, never silently default another scheme or drop the SKU.
2. Proposed `public.v_costing_pricing_selected_scheme_viability` (name subject to review) exposes per-SKU per-region selected scheme, selected scheme_id/name, policy resolution/status/source, margin, net realization, and lineage to immutable run and original viability record. Avoid a global `DISTINCT ON (sku_id)` or assuming one scheme always covers both regions.
3. UI option: one compact SKU row with IK and OK scheme label/value/status side by side; if schemes differ, display each clearly in its own region. Include period, approved/draft basis, outcome/status/search, link to PPM SKU Policy Overview; keep full policy detail in a drawer. This is easier for staff than duplicate rows and prevents false cross-scheme comparisons. ERP density/390px behaviour and no excessive vertical cards.
4. All historical approved runs are immutable. Even when future refresh produces only selected combos, preserve old all-scheme data until retention/preservation programme explicitly authorises archive/purge. Do not rewrite historical costing snapshots.
5. **Critical dependency:** `public.v_costing_pricing_printable_cost_sheet_lines` already joins the all-scheme table to actual IK/OK policy-context `scheme_id` to derive selected-scheme values. Other direct snapshot consumers include `costing.v_pricing_workflow_diagnostics`, `costing.v_pricing_workflow_dashboard_summary`, `public.v_costing_pricing_business_kpi_summary`, `public.v_costing_scheme_master_register`; indirect comparison views are `costing.v_sku_scheme_comparison`, `costing.v_sku_scheme_comparison_current`, `public.v_costing_pricing_sku_scheme_comparison`. Refresh chain, exact SKU control and cost-sheet traceability also reference the snapshot. No DROP or refresh-shortcut until EACH consumer has a reviewed replacement or explicit KEEP.
6. Scheme Master, policy creation/effective dating, regional IK/OK selected-scheme rules, selected policies, profitability viability, audit traces, printed Cost Sheet, and pricing-workbook semantics are **KEEP**. The retirement target is only exhaustive all-scheme enumeration/comparison, subject to independent dependency proof.
7. Run refresh: design a selected-only snapshot (or losslessly specialized selected projection) **after** evaluating how `rpc_refresh_sku_scheme_viability_snapshot` and the chain guarantee exact per-run selected values. Do not just filter the browser while still generating 6x/7x rows and claim storage solved. Consider stage ordering and policy-resolution anomalies. Test both same-scheme and different-scheme outcomes. Treat 0, 1 or 2 selected schemes per SKU as possible, and flag incomplete/invalid policy rather than assuming two valid selections.
8. Rollout: independent PR A adds new read model and numerical parity tests (read-only/staging); PR B changes CSR lens/menu/deep-link redirects with maintained backwards compatibility; PR C revises refresh to generate selected-only evidence *only if* the full dependency graph passes, preserving historical run evidence. PR D may retire obsolete RPC/view/table portions and reclaim space after separate owner approval and reversible backups. PPM deep links must remain useful and old Scheme Comparison links redirect safely.

## Acceptance gates (required; not performed)
- Exact per-run/region `EXCEPT ALL` parity for approved 122/143 and draft 148/152 against existing selected policy joins and printed Cost Sheet: selected scheme IDs, price bridge, quantities, IK/OK net realization, margins, status, NULL/missing/ambiguous resolution and lineage. Also test one SKU with two different regional schemes.
- No change to approved-run basis, 122 LOCKED, 143 approved, or any pricing calculations. Do not treat Nov 152 as approved. Verify selected scheme policies on representative effective dates and historical run contexts.
- Immutable approved snapshot fingerprint before/after; inspect row fanout and unique constraints; verify all named views, functions, cron 66/67/68, exports, pricing workbook, official printouts and old routes. No broken refresh orchestration.
- Exact existing authorised role read/negative checks, feature-flag/default-OFF, CSR load normal-path response/status/duration; 390px and desktop compact layout, keyboard/search/pagination/empty/REVIEW states.
- Read-only before/after table size baseline; demonstrate real savings on a disposable/staging refresh. DELETE does not automatically shrink allocated PostgreSQL files; maintenance and WAL/headroom require separate plan.

## Dependencies and governance
- Priority A Costing WP10/WP12 remains formally 11/13 closed until owner receipt. This enhancement is **Priority B, not a new WP12 closure blocker**; keep it in its own PRs and do not activate during remaining final acceptance.
- Previous Stage A four-master security applies in production; Stage B remains unexecuted. No production SQL, writer operation, DML/DELETE/DROP/GRANT/REVOKE, scheduled retention job, PR merge, releases or branch/worktree deletion is authorised by this document.
- Proposed approval gates: approve architecture separately from server SQL, client deployment, old-data deletion/maintenance, automated monthly retention, and any GitHub cleanup.
