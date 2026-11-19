# Executive MIS Dashboard — Programme Workflow and Continuation Ledger

**Established:** 19 November 2026 (IST)  
**Scope:** Executive MIS Dashboard only (`executive-mis-dashboard`)  
**Control status:** Documentation baseline; no MIS release or database migration authorized by this document  
**Current gate:** MIS-G6 — production monetary valuation discovery and definition (READ-ONLY)  
**Next action:** Inspect available production planning, batch, cost-rate and valuation sources; establish a valid monetary basis before SQL or UI mutation  
**Release separation:** Costing Suite Electron release readiness takes precedence. Do not use this document/branch/PR to block, amend, rebase, merge into, or trigger that release.

## 1. Purpose, authority and navigation

Maintain one clear and independently continuable work programme for an accurate, fast, mobile-capable Executive MIS Dashboard. Record what was built, tested, still uncertain, deliberately parked, and exactly where work should resume. This is **not** a copy of the Costing Suite or e-Aushadhi workflow and does not change their controlling ledgers or release criteria.

This document is the MIS programme index, live status ledger, decision register, source map, gate plan, acceptance register and handover. Update it at the end of every accepted MIS gate; avoid duplicate competing status documents. Historical observations are evidence, not a claim about today's data.

**Repository:** `Brahmadathanu/sasv-workspace-dev`  
**Canonical client paths:** `public/shared/executive-mis-dashboard.html`; `public/shared/js/executive-mis-dashboard.js`.  
**Backend:** Supabase `public` schema, with existing source views/RPCs and an executive summary materialized view.  
**Approval authority:** owner. Implementation agents may prepare draft PRs, diagnostics and review packages; they do not approve production changes, merges, deployment or release.

### Status vocabulary

- **PASS (reported):** owner completed the listed functional checks; not a claim of independent automated acceptance.
- **IMPLEMENTED / UNVERIFIED:** code or SQL reported created, awaiting acceptance evidence.
- **OPEN:** next authorized planning/review action remains.
- **PARKED:** consciously deferred; do not silently promote into the active gate.
- **BLOCKED:** unmet dependency or missing evidence.
- **NOT TESTED:** no supportable test evidence.
- **CLOSED:** owner accepted required evidence and recorded closure.

## 2. Scope and non-goals

The dashboard comprises executive financial position, sales, manufacturing inventory, finished goods, production operations and eventually alerts. It is a **read-only management reporting surface**, not an accounting ledger, transaction approval screen, stock movement writer, costing run designation authority, or a replacement for source business modules.

Maintain distinct semantics and source dates. Do not pretend reports with different source cutoffs are a coherent same-day snapshot. Never relabel old source data as live simply because the page was refreshed. No unapproved changes to payroll, staff confidentiality, permissions, costing run selection, Tally ETL, e-Aushadhi, shared launcher, service worker, installer, Electron packaging or release workflows.

### Reporting contracts

1. **Finance:** Sundry Creditors payables, Sundry Debtors receivables, net = receivables minus payables. Preserve signed Tally balances; do not sum absolute bill lines into an MIS total.
2. **Sales:** latest available sales period (not necessarily current calendar month); distinguish quantity units, billed units, sales value, and available selling days.
3. **Manufacturing Inventory:** RM/PLM/Consumables/Fuel only; finished goods separately.
4. **Finished Goods:** SKU and location quantities, forecasts, MOS, valued stock; zero-stock is separate from nonzero below-one-month cover.
5. **Production:** stage counts and quantities by stage; cross-UOM total base quantities are **not financially or physically additive** and must not be presented as a coherent aggregate output.
6. **Alerts:** not yet implemented; definitions, severity and provenance need a separate design gate.

## 3. As-built baseline (owner-reported functional acceptance)

| Gate | Scope | Status | Evidence / qualification |
|---|---|---|---|
| MIS-G0 | Module shell, summary MV, compact executive cards, planning notice, refresh-time indicator, scheduled MV refresh | PASS (reported) | `mv_mis_executive_summary`, `mis_summary_id=1`, source timestamp `mv_refreshed_at`; morning 03:00 UTC and night 22:00 UTC refresh scheduling was reported; job identity/current health require independent recheck |
| MIS-G1 | Finance tab: source views, signed balance logic, party page RPC, bill modal | PASS (reported) | 192 payable parties / 1,315 receivable parties; “asha” search 6; bill modal and pagination accepted |
| MIS-G2 | Sales tab: summary, product RPC, pagination/search and initial loading mask | PASS (reported), performance observation OPEN | 410 products, 509 SKUs, “arishta” search 19, last reported month May 2026; tab loads but is noticeably slow |
| MIS-G3 | Manufacturing Inventory tab | PASS (reported) | 1,628 items; RM 789, PLM 795, Consumables 38, Fuel 6; “oil” search 56, masks/sticky headers/paging accepted |
| MIS-G4 | Finished Goods tab and MRP filter explanation | PASS (reported) | 622 SKUs; zero 54, nonzero MOS <1: 104, MOS 1–3: 221, MOS >6: 101; “murivenna” 5; client label “Same IK/OK MRP” while RPC argument remains `shaded` |
| MIS-G5 | Production summary-only tab | PASS (reported), semantic correction OPEN | Plan/pipeline tables and secondary cards render; planned 929,887.73 mixed base units; active 412; overdue WIP 59 |
| MIS-G6 | Production value semantics and source/rate feasibility | **OPEN — CURRENT** | No accepted basis yet for planned-value or bulk-produced-value; read-only discovery first |
| MIS-G7 | Production value implementation and parity | NOT STARTED | Contingent on G6 decision and explicit server approval |
| MIS-G8 | Alerts discovery, definitions, severity, actionable drilldowns | PARKED | Start only after G7 or express reprioritization |
| MIS-G9 | Cross-tab hardening, freshness, authorization, load/performance and full acceptance | NOT STARTED | Preserve prior tab evidence; retest changed surfaces |
| MIS-G10 | Independent MIS release decision | HOLD / NOT AUTHORIZED | Must not be coupled to the immediate Costing Suite Electron release |

**Important:** The numbers above are *historical test fixtures captured around 31 May / 1 June 2026*, not current November 2026 values or current production readiness. Always re-measure before a fresh acceptance. The attached/refactored client reported by the owner was accepted in the conversation; its exact HEAD/commit and deployment status were not formally pinned here.

## 4. Data source and UI contract inventory

| Surface | Server objects / selected flow | Notes |
|---|---|---|
| Executive KPI | `mv_mis_executive_summary` | Single served executive summary; UI queries row `mis_summary_id=1`; browser Refresh reads, does **not** refresh the MV |
| Finance | `v_mis_finance_outstanding_detail`, `v_mis_finance_outstanding_party_summary`, `v_mis_finance_tab_summary`, `get_mis_finance_party_page` | Sign-aware aggregate, server-side search, bill modal |
| Sales | `v_sales_daily_normalized`, `v_mis_sales_tab_summary`, `get_mis_sales_product_page` | `products.item` is the product-name column; not `products.product_name` |
| Inventory | `v_stock_current_by_item`, `v_mis_inventory_tab_summary`, `get_mis_inventory_item_page` | `source_kind`: `rm`, `plm`, `consumable`, `fuel`; quantity units cannot be summed across unlike stock item UOMs for physical interpretation |
| FG | `v_stock_checker`, `v_mis_finished_goods_tab_summary`, `get_mis_finished_goods_sku_page` | Locations: IK, KKD, OK. `shade_flag` is an **MRP equality condition**, not an alert: `coalesce(mrp_ik,-1)=coalesce(mrp_ok,-2)`. Filter value `shaded` is retained for compatibility, label “Same IK/OK MRP” |
| Production | `v_mis_batch_pipeline`, `v_mis_production_position`, `v_mis_production_tab_summary`; upstream `v_product_bulk_consolidated_effective`, `v_batch_canonical_in_process_keyed`, `v_fg_transfer_reconciliation` | Plan, achievement, stage counts, and transfer value; bulk/plan unit sums require qualified treatment |
| Alerts | None accepted | Do not invent an API/source |

**Data freshness:** executive `mv_refreshed_at` denotes the materialized-view refresh instant, not browser reload, nor an assertion that each upstream system is fresh. Finance/Tally, Sales, Inventory, FG and Production should display actual source date / report-period notes wherever supported. Current production source may differ from historical examples.

**FG filter partition:** `ZERO_STOCK` takes precedence; `BELOW_1_MONTH` excludes zeros; `ONE_TO_THREE_MONTHS` covers [1,3]; `ABOVE_6_MONTHS` covers >6; `NORMAL` is remaining nonzero rows, including (3,6] and potentially null MOS. “Same IK/OK MRP” is an overlapping independent filter, not a MOS status. Do not assume categories sum to total without accounting for normal and null cases.

## 5. Current gate MIS-G6 — production monetary valuation

### Confirmed issue

The currently displayed `planned_production_base_qty`, `bulk_produced_base_qty` and `transferred_to_finished_goods_base_qty` combine base quantities for products measured in kilograms, litres, numbers and potentially other bases. These should never be used as a headline total for meaningful physical output or an achievement denominator across different UOMs. Stage counts are valid counts; quantities may be useful only in homogeneous product/UOM-level detail. A reported FG transfer **value** already exists, but its valuation basis, cutoff and completeness require proof.

### Desired executive answers

- What is the *planned production value* for the report month?
- What is the *actual bulk completed value* for the same month under a comparable basis?
- What is the *actual FG transfer value* in that reporting period?
- How do plan versus actual compare in rupees and percentages, with explicit coverage/exclusions?
- Can missing rates, ambiguous UOM conversions, partial batches, cost vintages and time cutoffs be surfaced rather than silently imputed?

### Decision and calculation principles

1. Select the economic basis **before** computation: preferably a governed, explicitly versioned manufacturing cost basis compatible across planned and actual quantities; actual costing and standard/reference costing must not be silently mixed.
2. Require a common **product/SKU identity and normalized unit rate**, with verifiable conversions (g/kg, mL/L, Nos, pack sizes), effective dates, base UOM, and stated scope. Do not multiply unrelated product pack rates and bulk base quantities.
3. Distinguish plan, physical bulk completion, FG transfer, and stock movement. Prevent double counting, including partial batches, conversions and historical transferred-only batches.
4. Keep source provenance, snapshot date, completeness, null/missing-rate count, and monetary reconciliation visible.
5. The reported Tally transfer value may use a valuation basis different from proposed plan/bulk values: compare only after establishing equivalence or mark as *different valuation basis*.
6. If no valid rate mapping is proven, display “Not Available / Not Comparable” rather than a manufactured monetary total.
7. Do **not** make new production SQL/RPC or costing-policy changes until a proposal with controls and rollback has been reviewed and explicitly authorized.

### MIS-G6 read-only discovery checklist

- Inspect column catalog and sample rows for `v_product_bulk_consolidated_effective`.
- Inspect column catalog and sample rows for `v_batch_canonical_in_process_keyed`.
- Locate candidate approved/reference production cost, base cost-rate, valuation or FG transfer rate tables/views; verify precise business definitions and access.
- Determine available product/SKU keys, UOMs, timestamps, planning versions, batch states, transfer state and valuation cutoff.
- Run **read-only** coverage probes: eligible plan products, completed batches, mapped/unmapped rates, UOM compatibility, duplicates, no-rate rows, rate vintage, null/zero forecast, and independently sum transfer value.
- Produce an **option matrix**: governed approved cost vs standard cost vs Tally transfer cost vs selling/MRP proxy. Do not call an MRP proxy “production cost”.
- Record chosen basis, explicit owner decision, exception policy, proposed SQL, security/RLS/explain-cost review and rollback strategy. Then and only then open G7.

**G6 exit:** owner accepts a reproducible source inventory, rate/quantity identity and unit-contract, complete/incomplete coverage, defined fiscal/time period, and a bounded implementation brief. Any contested accounting interpretation stays BLOCKED.

## 6. Future gates and acceptance

**MIS-G7 — Implement value layer (server first):** create a separately identifiable reporting view/RPC where justified, do not silently redefine historical `v_mis_production_position`. Carry source/version references; show plan value, bulk value, transfer value, variances and comparable achievement %, with N/A if plan missing or inputs invalid. Require SQL transaction/migration governance, grants, read-only select tests, negative-access tests, plan/actual parity, no-row duplication, and owner acceptance prior to client implementation. Then update UI to prioritize monetary values and demote mixed-UOM totals to correctly labeled source diagnostics or by-UOM details. Refresh KPI semantics only after independent parity proof.

**MIS-G8 — Alerts:** separately define alert catalogue, thresholds, significance, owner action, window/source date, severity, permission class and deduplication; treat zero stock, overdue WIP, low/high MOS, finance aging and missing data as candidates only until sourced.

**MIS-G9 — Hardening:** server-side pagination across large tables, latest-request-wins protection (search and filter races), loading/error/empty-state behavior, responsive 320/390/520/768/desktop, sticky headers, modal focus/ESC, permission deny-by-default, RPC grants/RLS, data freshness consistency, signed Tally reconciliation, FG status partition, acceptable query latency. Sales performance currently has a **known non-blocking owner observation** and deserves measured optimization, not guessed index changes. Re-evaluate live load tests without stressing production.

**MIS-G10 — MIS delivery/release:** future distinct owner decision after G9. Do not attach the programme to the currently impending Costing Suite Electron release or require its doc PR to be merged for that release.

## 7. UI design guidance and pending refinements

- Primary KPI cards live at module top. Within Production, small secondary indicators should have a subtitle (“Production Summary”), softer surfaces, restrained borders, smaller numbers and different hierarchy; use theme tokens, **not hard-coded palette values**, for maintainability.
- No redundant second-level KPI cards in Finance/Sales/Inventory/FG; one compact scope/period line, short explanation, search/filter toolbar, paginated table, sticky headers and table-scoped loading.
- Small screen: universal HOME with icon+label on desktop and icon only at <=520px; preserve existing module pattern, compact controls and touch targets.
- Server-side filter/search must operate over full result set; do not client-filter only current page. Debounce searches; suppress stale response overwrite (latest-wins) in hardening.
- Sales product row → SKU breakdown → optional dated sales trend is **PARKED**, not current gate. Finance bill modal is already functional.
- Distinguish “No data” from “Loading” and “Error”; avoid flashing false empty states. Production cards may be redesigned independently, but do not obscure critical stock/valuation caveats.

## 8. Governance, isolation and release safety

1. Before any change, check current `main` SHA, active release candidate branch/PR, and relevant deployment pins. Never assume historical chat SHA is current.
2. Use an isolated `docs/executive-mis/` directory. No changes to `docs/master-data-costing/`, Costing Suite/e-Aushadhi files, workflows, Electron metadata, dependencies, service worker cache versions, build assets, migrations or production during **documentation setup**.
3. Documentation changes occur on an independent branch, as a **draft PR only**. Do **not** merge it or make it a release gate. Do not trigger unrelated CI deliberately.
4. Future code work: one bounded proposal and draft PR per gate; specify files, SQL signatures, baseline source values, expected behavior, test/rollback plan and exact stop condition. Owner explicitly authorizes production SQL, merge and release separately.
5. Keep database privileges least-privilege; do not expose finance or staff details to unauthorized users. Client permission checks are not server enforcement. No batch/source mutators from MIS.
6. Preserve Costing Suite release HOLD/approval state as governed by its own authorities. This MIS programme must **not delay the morning release work** and must not suggest a new installer or package.
7. Audit and note whether a change is only a design proposal, has been coded, applied in DB, staged, merged or accepted. These are not equivalent.
8. If a blocker arises, log it and stop at the gate; do not jump into unrelated backlog or rewrite completed work.

## 9. Decisions and exceptions register

| ID | Decision / finding | State |
|---|---|---|
| MIS-D01 | Executive summary served from `mv_mis_executive_summary`, not a competing summary view | ACCEPTED historical |
| MIS-D02 | Manual browser refresh never starts MV refresh; freshness tied to MV timestamp | ACCEPTED historical |
| MIS-D03 | Finance uses signed Tally totals for MIS balances | ACCEPTED |
| MIS-D04 | FG zero stock is a distinct critical bucket; nonzero below-one-month is separate | ACCEPTED |
| MIS-D05 | Source `shade_flag` means equal IK/OK MRP; label “Same IK/OK MRP” not “Shaded” | ACCEPTED |
| MIS-D06 | Production first version is summary-only; batch detail deferred | ACCEPTED |
| MIS-D07 | Aggregating heterogeneous UOMs as a single physical “production total” is not financially meaningful | ACCEPTED finding; remediation OPEN |
| MIS-D08 | Production monetary valuation methodology, cost vintage and comparable benchmark | OPEN owner decision after read-only discovery |
| MIS-D09 | Production secondary KPI redesign using theme-safe mild styling | OPEN / client-only, non-release |
| MIS-D10 | Sales load slowness; measure and optimize later | OPEN non-blocking |
| MIS-D11 | Sales SKU drilldown and Alerts module | PARKED |

## 10. Session protocol and continuous progress

Each new MIS conversation begins by reading this file and verifying the GitHub head, not by restarting completed steps. Keep the **one current gate** in focus; log newly proposed ideas under the appropriate future gate. Every material response should end with a compact cumulative status (completed gates / current gate / next action / blockers / release separation). Keep factual evidence and decisions distinct; mark uncertainty.

**At the end of each gate:** update table in §3, decision and exceptions §9, the current gate and next action at top, newly created server/client object paths and contract changes, test evidence (date/environment/inputs/results), pending approval and a minimal fresh-chat handover. Avoid unnecessary bookkeeping commits on otherwise stable branches.

### New-chat opening handover (copy as first message)

> Continue the SASV Executive MIS Dashboard programme using `docs/executive-mis/EXECUTIVE_MIS_WORKFLOW.md` in `Brahmadathanu/sasv-workspace-dev` as the MIS continuation ledger. First verify current repository `main`, any open MIS draft PR and actual deployed/client state, then reconcile with this document. Keep the Costing Suite Electron morning release completely separate: no release/HOLD changes, no merge, no cache bump or production SQL without explicit approval. Existing owner-accepted first versions: executive summary, Finance, Sales (slow loading observed), Manufacturing Inventory, Finished Goods and Production summary-only. Current MIS gate is **G6, read-only production monetary valuation discovery**. Mixed-UOM aggregate production quantities are not meaningful achievement measures; inspect production planning, batch, cost/valuation rates and UOM identity and propose a defensible monetary basis and missing-data policy. Do not implement G7 prematurely. Production secondary-card styling is an open design item, and Sales SKU drilldown/Alerts are parked. Return an evidence-based current-gate result plus a cumulative workflow recap.

## 11. Next bounded task and explicit stop condition

**Do next:** complete *read-only* MIS-G6 discovery and prepare an evidence-backed rate/basis proposal. Review source definitions and schema before suggesting money formulas. Report coverage and any blocking unknowns. **Stop before any schema change, migration, production write, Electron release action, or client refactor.**

**Release protection checkpoint (19 Nov 2026):** Creating this workflow document is organizational only. The Costing Suite release is governed elsewhere; no MIS evidence, design work or PR shall be inserted into its release candidate or acceptance checklist.
