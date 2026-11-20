# Executive MIS Dashboard — Programme Workflow and Continuation Ledger

**Established:** 19 November 2026 (IST)  
**Scope:** Executive MIS Dashboard only (`executive-mis-dashboard`)  
**Control status:** Documentation baseline; no MIS release or database migration authorized by this document  
**Current gate:** MIS-G7 — value-layer design and OFFLINE validation ONLY (no live SQL authorized)  
**Next action:** Review draft G7 server contract and synthetic tests, resolve data/security hold points; obtain separate explicit authorization before any live SQL  
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
| MIS-G6 | Production value semantics and source/rate feasibility | **METHODOLOGY APPROVED (CONDITIONAL)** | Owner approved 20 Nov 2026, subject to documented materials-stores, plan freeze, event, joint-process and permission checks; no live SQL approval |
| MIS-G7 | Production value implementation and parity | **OPEN — DESIGN/OFFLINE ONLY** | G6 methodology approved; draft server contract and synthetic tests, no SQL installation, merge or release authority |
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

## 8A. Execution ownership and credit-efficient Claude collaboration (decision 19 Nov 2026)

**Approved division:** ChatGPT is the *server-side workstream owner* for source discovery, Supabase SQL/RPC/view design, approved execution through authenticated tooling, schema/security/performance verification, data reconciliation and server acceptance evidence. Claude Code is the *client-side implementation agent* for bounded, context-rich bulk packages, including HTML/JS/CSS, responsive UX and client tests. The owner is the final authority for semantic decisions, live database mutation, PR merge, deployment and release. ChatGPT also coordinates contracts, independently audits Claude's diff/evidence, and updates this MIS ledger. Do not assume that a successful client mock test proves the backend.

**Server-first handshake:** (1) ChatGPT pins source definitions and current git/deployment reality, (2) drafts a server contract with exact object names, parameters, response fields, null semantics, access behavior and representative fixtures, (3) obtains approval before live SQL mutations, (4) applies and verifies server changes using available authenticated tools, (5) marks the contract **SERVER ACCEPTED**, and only then (6) emits Claude's bulk client package. If tools cannot authenticate, report BLOCKED and provide a bounded executable/read-only SQL handoff; never imply the change was applied. Claude should not modify server definitions, run migrations or broaden scope in response to a missing API.

**Claude bulk-package design, optimized for fewer credit-consuming iterations:**

- Bundle **related client tasks that share files and accepted server contracts**, not unrelated gates: for example, post-G7 Production monetary display + secondary KPI styling + contextual info labels + responsive tests may fit one package *after* G7 contract acceptance. Do not include Alerts, Sales drilldown or unrelated Costing/e-Aushadhi work in that package.
- Each package contains: current `main` SHA and candidate branch, repository paths, implementation goal, exact approved server contracts/fixtures, in/out-of-scope changes, visual design tokens, behavioral and accessibility requirements, failure/null/loading behavior, regression expectations, acceptance matrix, protected paths, no-write and stop rules. Give Claude enough context to act autonomously **within the authorized boundary**, without continual clarification.
- Claude may inspect relevant code, plan its own bounded edit/test loop, run static/smoke/mobile tests, fix problems within scope, self-review, commit/push and open **one draft PR**. It should provide a concise receipt: base/head SHAs, changed-file list, tests and failures, screenshots/evidence when useful, unresolved issues, exact server-contract consumption, and a statement that it did not merge/deploy.
- Aim for **one review cycle per cohesive package**: ChatGPT performs independent diff, contract and regression review; any correction is sent as a narrow follow-up to the *same* draft PR; avoid repeatedly spawning new agents, branches and speculative changes. Never trade away contract safety, tested permissions or current-gate discipline for lower tool usage.
- Claude must not directly choose new SQL business semantics, invent response fields, change master-data authority, touch Supabase migration history, alter service-worker cache names, Electron release files or Costing release assets, or silently change a source contract to make the client pass.
- **Synchronization receipt:** record `SERVER ACCEPTED` source signature and verification date; Claude package ID/PR SHA; reviewed client head; owner acceptance; and whether code remains draft, merged, deployed or NOT TESTED. A package is not complete merely because Claude reports success.
- If the current active gate is discovery-only (G6), **do not launch a client bulk package** yet. Client-side aesthetic changes may be bundled into the next authorized Production implementation package, avoiding extra sessions and release disruption.
- Budget discipline: reuse the canonical doc and concise evidence excerpts instead of pasting whole chat histories, specify expected outcomes and bounded fallback conditions, use existing shared helpers, and batch deterministic checks; do not demand needless repeated end-to-end tests after no relevant changes.

**Workflow reporting rule — mandatory in every MIS reply, including new chats:** Always include a visible, compact **Executive MIS Progress** indicator at the end of each reply, even for a minor clarification, prompt, SQL or error. The indicator must show the completed stage count, current gate, next bounded action, blocking issue or approval status, and independence from the Costing Suite Electron release. Use stable gate labels G0–G10, and distinguish owner-reported PASS from independently verified closure. A suitable baseline until new acceptance is: `G0–G5: 6/11 gate labels owner-reported PASS | G6: OPEN (server valuation discovery) | G7–G10: pending/parked | Next: inspect cost/UOM sources read-only | Costing release: unaffected`. This is *workflow-gate progress*, not percentage of engineering effort; never fabricate a time-to-completion estimate.

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
| MIS-D12 | ChatGPT owns server work; Claude handles cohesive, contract-pinned client bulk packages; owner retains approval authority | ACCEPTED 19 Nov 2026 |
| MIS-D13 | Include visible Executive MIS Progress indicator in every MIS response and fresh-chat continuation | ACCEPTED 19 Nov 2026 |

## 10. Session protocol and continuous progress

Each new MIS conversation begins by reading this file and verifying the GitHub head, not by restarting completed steps. Keep the **one current gate** in focus; log newly proposed ideas under the appropriate future gate. **Every reply**, including short confirmations, must end with the **Executive MIS Progress** indicator defined in §8A. Every material response should also contain a compact cumulative status (completed gates / current gate / next action / blockers / release separation). Keep factual evidence and decisions distinct; mark uncertainty.

**At the end of each gate:** update table in §3, decision and exceptions §9, the current gate and next action at top, newly created server/client object paths and contract changes, test evidence (date/environment/inputs/results), pending approval and a minimal fresh-chat handover. Avoid unnecessary bookkeeping commits on otherwise stable branches.

### New-chat opening handover (copy as first message)

> Continue the SASV Executive MIS Dashboard programme using `docs/executive-mis/EXECUTIVE_MIS_WORKFLOW.md` in `Brahmadathanu/sasv-workspace-dev` as the MIS continuation ledger. First verify current repository `main`, any open MIS draft PR and actual deployed/client state, then reconcile with this document. Keep the Costing Suite Electron morning release completely separate: no release/HOLD changes, no merge, no cache bump or production SQL without explicit approval. Existing owner-accepted first versions: executive summary, Finance, Sales (slow loading observed), Manufacturing Inventory, Finished Goods and Production summary-only. Current MIS gate is **G6, read-only production monetary valuation discovery**. Mixed-UOM aggregate production quantities are not meaningful achievement measures; inspect production planning, batch, cost/valuation rates and UOM identity and propose a defensible monetary basis and missing-data policy. Do not implement G7 prematurely. Production secondary-card styling is an open design item, and Sales SKU drilldown/Alerts are parked. Use ChatGPT for server-side discovery, authorized server execution and independent review; use Claude for context-rich, credit-efficient client bulk packages only after server contracts are accepted. Always include a visible Executive MIS Progress indicator in every reply (completed gates, current gate, next bounded action, blocker, Costing release isolation). Return an evidence-based current-gate result plus a cumulative workflow recap.

## 11. Next bounded task and explicit stop condition

**Do next:** complete *read-only* MIS-G6 discovery and prepare an evidence-backed rate/basis proposal. Review source definitions and schema before suggesting money formulas. Report coverage and any blocking unknowns. **Stop before any schema change, migration, production write, Electron release action, or client refactor.**

**Release protection checkpoint (19 Nov 2026):** Creating this workflow document is organizational only. The Costing Suite release is governed elsewhere; no MIS evidence, design work or PR shall be inserted into its release candidate or acceptance checklist.


## 12. MIS-G6 read-only evidence checkpoint — 20 November 2026

**Scope and state:** authenticated read-only Supabase probes only; G6 remains CURRENT / OPEN. No SQL migration, view change, approval designation, client merge, deployment, service worker or Electron release change. PR #486 MIS-C1 independent client review is recorded on its PR; draft only, not accepted production evidence.

### Source and valuation audit

- `costing.v_costing_period_run_status`: October 2026 approved run **143**, valuation **2026-10-22**; November 2026 draft run **152**, valuation **2026-11-16**, no November approved run. Never use draft run 152 as approved.
- Positive November planning lines in `v_product_bulk_consolidated_effective`: **100 on later live probe**, against **101 on earlier probe**, proving the current view is not an immutable planning snapshot; determine stable plan version/as-of before a reproducible KPI.
- For the 100 positive-plan products on the later probe, **100/100** have a positive manufacturing-COP SKU mapping in approved run 143; **44/100** have multiple SKU formats. This is **product-presence coverage only**, not verified per-bulk-unit-cost coverage. Do not arbitrarily select a SKU or multiply cost per pack by bulk quantity.
- Planning product breakdown: Kg **64** products / source quantity **10,905.16**; L **30** / **27,942.50**; Nos **6** / **437,500**. Unlike UOM quantities are not additive. All 100 have positive `products.conversion_to_base`; observed conversion factors include **0.001**, **0.00091** (oil/ghritham group) and **1**. The meaning and multiplicative direction of `final_make_qty` require source-level proof before normalization.
- `v_mis_production_position` currently sums `expected_output_base_qty` using `last_fg_bulk_updated`, with selected final states, not a demonstrated actual completed-volume event series; it also omits `MIXED` state (seven November-updated records observed). Do not assert valid bulk actual/achievement from that legacy figure.
- More promising actual bulk event source: `public.fg_bulk_stock_ledger` rows with `source_table='daily_work_log'` and `reason_code='FG bulk storage'` for November: **79 positive rows / 61 distinct (product_id,batch_number) keys / 52 products**, dates 2–19 Nov. **18 batch keys** have two postings; none had nonpositive summed quantity. Confirm whether these are incremental completions, reposts/corrections, or multiple locations before deciding whether to sum or deduplicate. Separate packing outflows, force-close adjustments, and paired internal transfers from production inflows.
- November `v_fg_transfer_reconciliation`: 99 Tally records, total **₹32,60,278.34**, book-transfer amount equal to `tally_total_amount` in the audited summary; 94 MATCHED/valuation OK, 4 MISSING_LOG/valuation OK, 1 MATCHED/NOT_VALUED. Arithmetic parity **does not establish** an equivalent cost basis to approved manufacturing COP.
- `costing.v_product_rm_standard_cost`: 534 products, two without positive RM rate and four with blocking lines in prior probe. RM standard cost is partial manufacturing cost, not a substitute for governed full manufacturing COP.

### Pending G6 exit proofs (not yet owner-approved)

1. Demonstrate `final_make_qty` physical units and precise direction/meaning of product conversion factors, particularly 0.00091; derive a product-base-unit rate from approved SKU manufacturing COP without double counting packaging/other SKU-level conversion costs. Document joint-process and multi-SKU policy.
2. Validate `fg_bulk_stock_ledger` posting identity and correction/reversal semantics, including multiple postings per batch and cutoff consistency, and reconcile ledger output to batch canonical records and documented daily work logs.
3. Pin an explicit plan-as-of (or immutable month snapshot), report month and same valuation vintage for plan and bulk actual. Quantify approved-rate coverage by *valid unit normalization*, not just matching product IDs.
4. Retain Tally book FG value as a separately labeled basis until parity with reference manufacturing COP is independently demonstrated; keep exception counts and dates.
5. Present exact SQL/RPC contract, security/EXPLAIN and rollback proposal; obtain owner method approval and independent SQL authorization before G7.

**Disposition:** G6 ongoing, no monetary MIS KPI accepted. G0–G5 owner-reported PASS preserved; MIS-C1 PR #486 remains draft and review-only. Costing Suite Electron release independent.


## 13. MIS-G6 source-semantics and rate-spread checkpoint — 20 November 2026

**Evidence type:** authenticated read-only SQL against Supabase project `qhmoqtxpeasamtlxaoak`; dates and counts are observed fixtures, not frozen monthly facts. No production writes, migrations, client code, release action or gate advancement.

### Rate normalization: approved run 143

- `costing.sku_internal_loaded_cost_snapshot`: approved run 143 has **627 SKU rows / 453 products**, with no missing or nonpositive `manufacturing_cop_per_sku`. Among the **100 November positive-plan products observed**, approved run 143 maps to **160 SKU rows**. Each has positive `pack_size * v_sku_catalog_enriched.conversion_to_base`.
- Naïve normalized **SKU manufacturing COP / (pack_size * conversion_to_base)** is **different in all 44 multi-SKU planned products**. In **41/44** the maximum/minimum ratio exceeds 1.05; worst observed ratio ~**3.19**. Examples: Jumbolene Capsule 3.19x; Rejuliv Forte Capsule 3.02x; Murivenna 1.57x. Therefore **do not choose a SKU, average SKU COP, or call SKU COP per bulk unit a product bulk production rate**.
- Crucial positive evidence: `costing.sku_material_cost_snapshot.rm_cost_per_base_unit` is **consistent within every one of the 44 multi-SKU planned products**, and within all **453** multi-SKU product groups of approved run 143. The approved product-level RM base rate is therefore a plausible *component*, but excludes labour, production overhead and possibly other bulk-stage inputs. `costing.sku_production_overhead_allocation_snapshot` has 160 mapped records / 100 products and no missing `production_overhead_cost_per_base_uom`, but SKU allocation semantics must be checked for separation of bulk versus packing overhead. Product workload snapshot exists for all 453 approved-run products. **No complete bulk COP rate is yet authorized.**
- The source-derived planned demand view `v_product_bulk_required_monthly` already calculates `net_units * pack_size * conversion_to_base` and aggregates by product/UOM. Do **not apply the product conversion factor again** to `final_make_qty` without proving a separate semantic need; the live plan mixes Kg/L/Nos but its source values are already expressed on the product bulk-base scale.

### Actual bulk storage versus formal completion

- All 79 November `fg_bulk_stock_ledger` positive receipts (`source_table='daily_work_log'`, `reason_code='FG bulk storage'`) are traceable to valid distinct daily_work_log IDs, with matching ledger/log dates and recorded `storage_qty`.
- Status split: **58 receipt rows / 40 distinct batch keys** come from work logs with `status='Done'` and non-null `completed_on`; **21 rows / 21 distinct batch keys** are `In Storage` with null `completed_on`. No completion date precedes its log date in the audited set. Receipt date and formal completion date are distinct and may span days. Multiple receipts per batch have distinct IDs and different storage quantities; further event lifecycle checks needed before classifying as incremental production output.
- Recommendation: independently label **Bulk Stored (physical receipts by storage entry date)** versus **Bulk Completed (formal completion event by completion date)**. Do not use the legacy expected-output sum as verified actual production. Exclude internal transfer, bottling, force-close adjustment and stock count effects from *newly produced* amounts unless separate explicitly documented treatment permits them.

### Plan provenance

- November `sku_forecast_monthly_base` contains **1,974 source rows across 7 run IDs**. `forecast_run` has provenance including `as_of_date`, `status`, `module_slot`, `closed_at` and `frozen_after_day`; latest shown historical successful runs 122–124 as-of 26 Oct. `production_qty_overrides` has **506 active November rows**, newest update timestamp 2026-10-30 06:59:51+00.
- These fields help establish plan provenance but **do not prove the present derived plan is immutable**: WIP, current stock/forecast inputs and other joins may change. Fix a reproducible plan-as-of/snapshot contract before G7.

### Updated G6 design recommendation and blocking proof

**Proposed semantic contract (not approved):** Plan at an explicit version/as-of; rate = approved **bulk-stage** manufacturing cost in product base UOM, assembled from proven governed components without packaged-only costs; actual = reconciled distinct bulk receipt/completion evidence with explicit event timing; transfer value = separately sourced Tally book value. Report money only for verifiably mapped rows; disclose missing-rate/quantity/status coverage and provenance. Set `N/A` for non-comparable achievement, not a false percentage.

**Remaining G6 checks:** verify shared product RM base rate against row-level BOM and complete bulk-stage labour/overhead definitions; inspect daily work-log status transitions and storage ledger idempotence; identify exact plan run membership and stable cutoff; prove approved-rate coverage for all eligible *actual* products, not merely planned products; independently check database privileges/EXPLAIN on prospective reporting route. Do not implement G7 until owner approves method and subsequently authorizes live SQL separately.

**Programme status:** G0–G5 owner-reported PASS; G6 current OPEN; G7 pending, G8 parked, G9–G10 pending. MIS-C1 #486 draft review only; Costing Suite Electron release wholly independent.


## 14. G6 fast-track and product-route work-log compatibility — 20 November 2026

### Owner requirements and quality bar

The owner explicitly intends to upgrade the current `daily_work_log` structure to a **product-process-route-oriented logging system**. Executive MIS must remain **ERP-styled, future-proof and maintainable**, not bind its public-facing reporting contract to `daily_work_log` columns, row statuses or UI implementation. Explain progress and decisions in plain English first; make technical details subordinate. Execute an **accelerated, evidence-led sequence** with parallel independent packages where safe, but never weaken tests, permissions, review gates or release isolation.

### Recommended migration-safe boundary

Introduce an MIS-owned, **read-only versioned production-event normalization contract**, initially adapted from the existing work logs and bulk-stock ledger, later replaceable by the product-route event source without rewriting MIS views/JS. Proposed canonical fields (names provisional): `source_system`, `source_record_id`, `product_id`, `batch_identity`, `route_id`, `route_step_id`, `event_type`, `event_effective_on`, `recorded_at`, `physical_quantity_base`, `product_base_uom`, `completion_state`, `source_version`, `lineage_ref`, `is_correction`, `supersedes_event_id`; null route IDs are permitted for legacy. The adapter must preserve source identity, distinguish *recording storage* from *formal completion* and physical *transfers*, handle reversal/supersession, and prevent double counting. Do **not** create these schema objects under G6 without separate owner authorization.

For the dashboard: report *receipt into FG bulk storage* separately from *formally completed bulk*, avoid interpreting `In Storage` as approved completion, and never use historical `expected_output_base_qty` as actual produced. Use a stable plan version/as-of and independently tagged approved cost run/version. Retain source freshness and unvalued/exception counters. Keep all source changes behind reporting adapters so G7 client work has no dependency on future work-log table layout.

### New independent live G6 component findings

- Approved run 143 contains `costing.product_direct_labour_workload_snapshot` for all **453 products**, exposing the **manufacturing labour product allocation**, monthly product base quantity, and a manufacturing labour component pool identifier; the cost suite separately models packing labour in `costing.sku_direct_labour_allocation_snapshot` (`manufacturing_direct_labour_cost_per_sku` and `packing_labour_cost_per_sku`).
- For all **100 currently positive-planned November products**, approved run 143 has populated **RM cost per product base unit**, a **positive monthly manufacturing labour quantity driver and product labour allocation**, **production overhead per product base UOM** and **QC overhead per product base UOM**. This is *component-presence coverage*, not validation of the final aggregate bulk-COP policy.
- Across the **124 multi-SKU product groups** in approved run 143's overhead snapshot, `production_overhead_cost_per_base_uom` is internally consistent across packs. The same **124** multi-SKU groups have consistent `qc_cost_per_product_base_uom`. Previous checks found RM base rates consistent across the approved product groups. Therefore product-level RM + **manufacturing-only** labour + route production overhead + appropriate QC are plausible core bulk cost components; inspect inclusion of any material-conversion or stores costs and joint-process co-product sharing, plus exact cost/policy treatment, before monetary publication.
- Among 18 November product/batch keys with two positive FG bulk-storage receipts, both entries are currently `Done` and hold a formal completion date; one example has two different completion dates within the same batch. Distinct source IDs suggest separate records, but **do not assume two completions**. A future event adapter must reconcile physical receipt totals separately from the single canonical batch closure lifecycle.

### Fast-track sequencing (while G6 remains current)

1. **ChatGPT server lane now:** complete bounded cost-component reconciliation and actual output event acceptance, pin approved cost vintage and forecast as-of, draft read-only G7 SQL/RPC and permission/tests with no production installation.
2. **Claude client lane:** MIS-C1 #486 remains a **separate draft**; authenticated testing can be prepared without merging. Any later G7 valuation UI package must use only an approved stable reporting contract and should be assigned as a coherent bulk package (not piecemeal) after owner method acceptance. Avoid client changes during discovery that force premature or misleading numbers.
3. **Owner decision:** present plain-English formula, interpretations, exceptions, fallback and proof matrix in one approval checkpoint; only after explicit approval authorize bounded live SQL separately.
4. **Independent acceptance:** mock contract tests, negative-access/RLS, responsive/mobile, cross-tab stale request, data parity, latency/EXPLAIN and browser acceptance. Do not bundle or expedite an unsafe release, and do not merge MIS into the Costing Suite Electron candidate.

**Status:** G6 OPEN and urgent; G7 unopened pending owner methodology approval; G8 parked; G9–G10 future. G0–G5 owner-reported PASS unchanged. No production SQL/client/release mutations in this checkpoint.


## 15. G6 provisional monetary method / owner decision checkpoint — 20 November 2026

**Observation pin:** authenticated read-only Supabase queries on 2026-11-20 approximately **20:58 IST**; November plan remains a mutable live view, so figures below are **test outputs and NOT approved KPIs**. No production SQL or client writes executed. Owner requested accelerated, future-proof, plain-English implementation; future route-oriented logging to use a replaceable event adapter.

### Feasible component basis

- Approved October costing **run 143** is the only vetted approved source examined for November reporting; November run 152 is draft and must not be substituted.
- Candidate rate per product base UOM: approved **raw material cost per base unit** (`sku_material_cost_snapshot.rm_cost_per_base_unit`, consistent across SKU formats) + **manufacturing-only direct labour per base unit** (`product_direct_labour_workload_snapshot.product_direct_labour_allocation / monthly_product_base_qty`) + **route production overhead per base UOM** (`sku_production_overhead_allocation_snapshot.production_overhead_cost_per_base_uom`, consistent across SKU formats) + **product QC per base UOM** (`product_qc_allocation_snapshot.qc_cost_per_product_base_uom`, consistent across SKU formats) + **applicable internal material conversion per product base UOM** (`sku_internal_material_conversion_snapshot.internal_conversion_cost_per_product_base_uom`, consistent across SKU formats).
- All **100 positive November planned products** have present, nonnegative core components and a positive product manufacturing labour quantity driver. The internal material conversion component is populated but **zero for all 100 planned products** in approved run 143; other products in the approved run do have positive internal conversion components, so never hard-code zero.
- Packing materials and packing labour are **excluded** from candidate bulk rate; packing-only amounts exist separately in costing. Other overhead families, product internal-source materials-stores costs, joint-process co-product treatment, policy stages and unit identity require reconciliation before authorization. Do not label this candidate as the approved full bulk COP until reconciliation and owner approval.
- **Numerical dry-run only:** multiplying the *current live November planned quantity* by the candidate component rate yields **₹64,04,326.16 across 100 products**; this is **indicative / NOT a publishable production value**, because plan is not frozen and component scope has not been formally accepted.
- November FG bulk-storage receipts comprise 79 positive rows across 52 products, with **50 products / 77 receipts** covered by candidate approved costing run 143 components. Candidate product-rate multiplication yields **₹32,04,140.56 across 77 covered receipts only**, *excluding* two unvalued receipt quantities. This is **not a complete actual output value**, not a completed-production metric, and must never be compared as equivalent to Tally FG book transfer.
- Explicit no-rate exceptions: **Kayyonyadi Enna** (product_id 220; 30 Kg receipt 9 Nov; `In Storage`, no completion) and **Anulomana Sookshma Choornam** (product_id 1049; 3.4 Kg receipt 2 Nov; `Done`, completed 3 Nov). Neither has an October run 143 cost snapshot. No rate imputation or substitution of a draft costing run.
- `daily_work_log` receipt rows have status and `completed_on` that may postdate receipt. Normalize storage receipts and formal batch completion separately; do not sum repeated completion dates as additional production. When product-route logging replaces legacy data, migrate the *adapter*, not the reporting contract or MIS client.
- Forecast monthly base tables are traceable to `forecast_run` runs (November source has 7 run IDs), while 506 active November `production_qty_overrides` and evolving stock/WIP contribute to a derived plan; explicitly freeze a complete plan version for reproducible management reporting.

### Plain-English decision package to present to owner (G6 still OPEN)

**Question A — definition of bulk value:** use a **reference cost estimate** (the sum of approved raw materials, manufacturing-only labour, production overhead, relevant QC and proven internal conversion costs) rather than the packaged SKU selling price or packaged COP. This is a benchmark, **not** actual expenditure. Confirm additional eligible bulk-stage overhead and joint-production allocation policy after component parity proof.

**Question B — actual production event:** dashboard should display distinct quantities for **received in bulk storage** (physical movements) and **formally completed** (batch completion, with one canonical event per batch); use the former for a clearly labelled provisional physical receipt measure, not conflate with completed output. Source-independent versioned event adapter must accommodate the future route-based work log.

**Question C — reporting vintage:** pin an approved costing run and planning snapshot/cutoff independently; optionally show latest live indicative plan clearly separate from frozen monthly baseline. Exceptions must be visible in product counts, quantities by UOM and excluded-value status. Do not turn missing values into zero.

**Question D — separation from FG transfer accounting:** continue to show transferred FG value from Tally separately as book transfer value and with reconciliation exceptions, not as manufacturing COP.

**Decision status:** Method proposal only, **NOT owner-approved**. G7 remains unopened, SQL authorization not granted, MIS client #486 draft and Costing Suite release untouched. Next bounded verification: product source-coproduction and additional overhead overlap, entitlement/EXPLAIN planning, frozen plan mechanism; owner approval on semantic package before any production SQL deployment.


## 16. MIS-G6 exact approved cost decomposition and method-ready recommendation — 20 November 2026

**Read-only evidence, no live change.** The previous G6 provisional sum was dry-run only; the following checks establish exact *approved SKU manufacturing COP* accounting decomposition and the separability of product bulk manufacturing components. G6 is **method-ready but not owner-approved or closed**.

### Exact costing decomposition, independent read-only checks

- Across **all 627 SKU rows** of **approved October run 143**, `manufacturing_cop_per_sku` equals `material_cost_per_sku + direct_labour_cost_per_sku + production_overhead_cost_per_sku + quality_control_overhead_cost_per_sku + materials_stores_overhead_cost_per_sku + internal_conversion_cost_per_sku`: **627/627 PASS**, zero differences at paisa threshold and returned max absolute difference rounded to **0.000000**.
- If internal conversion is wrongly omitted, **7 of 627** SKU rows differ by more than ₹0.01; in all seven the difference exactly equals the `sku_internal_material_conversion_snapshot.internal_conversion_cost_per_sku` amount. This confirms that separate conversion component must remain eligible where actually present.
- Across **627/627** approved rows, `direct_labour_cost_per_sku = manufacturing_direct_labour_cost_per_sku + packing_labour_cost_per_sku`; **zero** differences >₹0.01. For all **627** rows, the independently derived `manufacturing_direct_labour_cost_per_sku / sku_base_qty_per_unit` matches `product_direct_labour_workload_snapshot.product_direct_labour_allocation / monthly_product_base_qty` within ₹0.01; zero mismatches (max gap rounded 0.0000). Hence manufacturing-only labour has an independently cross-validated product bulk-unit rate.
- Across **627/627**, `production_overhead_cost_per_sku` matches `production_overhead_cost_per_base_uom * sku_base_qty_per_unit` within ₹0.01. Product base overhead and QC are also constant across all 124 multi-SKU groups in the approved run.
- This DOES NOT mean that the complete **bulk COP** equals packaged manufacturing COP: packaged raw materials may include packing materials; packing labour and SKU materials-stores costs need stage classification. The proposed bulk cost uses product RM base + product manufacturing labour base + product route overhead base + QC base + applicable internal conversion base. `materials_stores_overhead_cost_per_sku` is **not blindly included**; product internal-source materials-stores snapshots cover five distinct source products and have no direct join to the 100 planned product IDs (may require source→beneficiary mapping). This is a scope/exception gate, not reason to invent a blanket per-pack rate.

### Joint process — policy evidence and non-double-counting rule

- `costing.joint_process_policy` policy 1 `KSHEERABALA_AVARTHI_JOINT` uses **OUTPUT_MASS**, effective **2026-10-23** onward, approved by `PRP_STEP72_USER_APPROVAL_20261022`; policy 2 is the preceding one-day version effective 22–23 Oct. Approved output quantities are **105 Kg** product 183 (101 Avarthi) and **5 Kg** product 184 (41 Avarthi). Stages 1389–1392 contain 41 shared cycles and 60 continuation cycles assigned to product 183.
- November's positive bulk receipts include product **183**, **3 receipts / 167.36 Kg**, and none for product **184**. Both have zero planned November quantity in current derived plan. Therefore no synthetic co-product receipt or planned quantity is allowed. Apply each product's **approved product-level allocated reference rate once to its own verified actual output**, retaining policy ID/cutoff and joint-process lineage; do not allocate the same common-process costs again or force output-ratio co-production from a single receipt.
- The cost snapshot's individual product RM and labour allocations are positive, but a full independent batch-level joint-process cost reconciliation remains a subsequent acceptance check; pre-existing approved costing policy is authoritative, not reconstructed by MIS.

### Current exceptions and reporting contract recommendations

- Planned 100 positive products have complete positive approved reference rates for the five candidate components and no negative components. **Indicative planned ₹64,04,326.16** only, on live mutable plan.
- Of **52** unique actual receipt products and **79** positive receipt records, **50 products / 77 records** map to run 143. **Kayyonyadi Enna** (30 Kg, in storage) and **Anulomana Sookshma Choornam** (3.4 Kg, done) must be flagged missing approved rate; **indicative covered-receipt ₹32,04,140.56** is incomplete and not a formal completed-production metric.
- Separate **bulk received** by ledger movement date from **bulk completed** by canonical batch completion event date. Do not count each daily-work-log `Done` row as a separate batch closure; 18 batch keys have two receipts and shared/possibly differing completion dates.
- Pin and disclose **approved cost vintage = run 143 as of 22 Oct**, **explicit plan version/as-of** and **actual event reporting cutoff**. Never silently replace approved rates with November draft 152. Transfer value remains separately labeled Tally book value with reconciliation exceptions. The future product-route logging migration must only replace the production-event adapter; the client and reporting contract remain stable.

### Fast-track G6 owner-method decision (requires affirmative decision, not authorization to install SQL)

Recommended accept in principle:
1. Define *planned bulk production value* as sum of source product-base quantity × governed approved **bulk-stage** product-unit component cost; no mixing UOMs as physical quantities.
2. Show *FG bulk received value* as costed positive physical receipts with explicit coverage and source date; show **completed bulk** separately on independently reconciled canonical batch lifecycle.
3. Keep *Tally book FG transfer value* on its own basis; show no derived cross-basis achievement ratio unless equivalent scope is proven.
4. Missing approved rates, incomplete cost-scope classifications, joint-process anomalies, non-frozen plans and unmatched actual event coverage must show as **unvalued/under review**, never zero/imputed.
5. Route work-log modernization through an adapter, preserve ERP styling and narrow-screen accessibility, bulk assign Claude after stable G7 server contract, keep Costing Suite 6.2.0 release isolated.

**Remaining pre-SQL design proofs:** confirm and explicitly classify any bulk-stage materials stores overhead and joint-process edge cases, design frozen plan-as-of strategy, RPC access control and EXPLAIN. These may be done as bounded G7 design after owner method acceptance, **without authorizing production mutation**. G6 remains open until owner decision; G7 not yet opened.


## 17. MIS-G7 design authorization and offline validation receipt — 20 November 2026

**Owner decision:** `I approve the proposed Executive MIS G6 valuation methodology subject to the documented checks. Proceed with G7 design and offline validation only. Do not execute production SQL, merge PRs, or touch the Costing Suite release without separate authorization.` **G6 methodology is conditionally approved; G7 is DESIGN/OFFLINE only.** No completed-gate count increment: G0–G5 remain 6/11 owner-reported PASS. G6 final administrative closure and G7 implementation acceptance remain subject to their own evidence/decisions.

**Bounded design deliverables (draft PR #485 branch only):**
- `docs/executive-mis/MIS_G7_SERVER_CONTRACT_DRAFT.md`: plain-English valuation semantics, versioned event/plan/rate adapter model, proposed response API, null/coverage states, approval-run pins, permissions and isolation, independently testable acceptance/rollback gates. **Not a migration or executable production SQL.**
- `scripts/mis-g7/g7_offline_fixture_test.py`: deterministic synthetic-only unit test of value arithmetic, duplicate-source protection, missing-rate handling, mixed UOM, cutoff, In Storage vs Done, internal transfer exclusion, UOM mismatches, density-sensitive conversions, cost-run pin and no-comparable-percentage/no-view stub.
- **Offline runner executed in local isolated runtime:** `python /mnt/data/mis_g7_offline/g7_contract_offline_test.py` yielded **12/12 PASS** on synthetic fixtures; this is *not* production SQL execution, real permission-negative verification, genuine cost-scope parity or a UI/browser test. The committed repo fixture script mirrors those 12 cases, but was not independently executed from a checked-out repository in this session.
- **Security inspection from read-only Supabase catalog:** `costing.sku_material_cost_snapshot`, `costing.sku_internal_loaded_cost_snapshot` and `costing.product_direct_labour_workload_snapshot` currently **deny authenticated SELECT**. Existing four MIS page RPCs are security-invoker, authenticated-executable and not anon-executable. `v_user_permissions_effective` has user/target/can_view fields; `public.app_has_permission` checks auth.uid and canonical permission core. G7 must use server-side MIS view authorization and least-privileged private aggregation; **do not grant costing table reads**. Supabase docs confirm security-definer public views/functions can bypass RLS; any privileged interface must be reviewed with strict grants, fixed search_path, no dynamic SQL and negative-access tests. Actual authenticated deny/pass **NOT TESTED**.
- **Safe reporting contract:** expense sources are not to be exposed in raw detail. Two missing approved-run rate products (Kayyonyadi Enna and Anulomana Sookshma Choornam) remain unvalued. No comparison of Tally book values with COP totals or use of expected batch output as actual. Future route-based work logging swaps the adapter rather than the UI contract.
- **Status:** draft documentation commits only on independent workflow branch. No production SQL installation/migration, no MIS-C1 #486 merge, no Electron/Costing release changes. No SERVER ACCEPTED claim.

**Unresolved, in order:** (1) precise stage eligibility/beneficiary mapping for materials-stores overhead, (2) frozen plan snapshot/cutoff, (3) multi-posting and completion lifecycle/reversal parity, (4) joint-process beneficiary verification, (5) bounded SQL implementation proposal and EXPLAIN/performance review, (6) server-only permission-negative tests after independently authorized installation. Any failed item must be explicit **BLOCKED / NOT VERIFIED**; do not fabricate a complete KPI.

**Next action:** independently review design and classify the outstanding source-scope questions, prepare exact SQL proposal offline; ask the owner for a separate narrowly bounded production-SQL authorization only after satisfactory review. Subsequent Claude UI bulk package waits for SERVER ACCEPTED; Costing Suite release is independent.


## 18. MIS-G7 SELECT-only SQL design and offline test expansion — 20 November 2026

**Status:** G7 DESIGN/OFFLINE ONLY, no production SQL, migration, function creation, grant, client merge, deployment or Costing Suite release activity. Owner's exact boundary remains controlling. New design artifacts on the **independent draft-doc branch**:
- `docs/executive-mis/MIS_G7_READONLY_SQL_DESIGN.sql` (commit `e3454676feab5e19a96613abe4aebdaf57575f4e`): **SELECT-only, unauthenticated privileged-design sketch** for explicitly pinned October approved run 143 and bounded November event cutoff, unique-product source rates, source-event receipt accounting, separately Tally transfer value, missing-rate counts, and purposely NULL formal completion and achievement. **NOT RUN on production**, **not an authenticated callable RPC**, and **not an accepted completed bulk manufacturing value**. Uses existing catalog-known sources, but requires independent static SQL/EXPLAIN review before any actual execute authorization.
- `scripts/mis-g7/g7_contract_matrix_test.py` (commit `789567509df2d0da7cac2e2bbbf7220d0f756095`): 20 synthetic contract cases for cost-run refusal, simulated permission denial, distinct and duplicate receipts, cutoff, UOM, unvalued quantities, cross-basis achievement suppression. An equivalent local Python 20-test suite was run and passed 20/20; exact committed GitHub script independently execution-tested **NOT TESTED** in this session. Earlier 12-fixture Python program was independently run locally 12/12 PASS. These prove **only synthetic policy arithmetic**, not actual SQL execution, RLS, source parity, performance or browser integration.

### Material scope: new key reason for provisional-only reports

Approved run 143's `sku_internal_loaded_cost_snapshot` has **627/627 positive `materials_stores_overhead_cost_per_sku` rows across all 453 products**, unlike the sparse `product_internal_source_materials_stores_allocation_snapshot` (only five distinct *source* products, a different allocation basis). These SKU charges are **not a validated product bulk-base rate** and cannot be dropped as known zero or arbitrarily divided by a single chosen SKU size. Reporting will carry `BULK_COMPONENT_SCOPE_UNAPPROVED` until stage/beneficiary allocation is separately governed; provisional rates exclude unclassified costs with explicit estimate disclaimer. Present provisional totals only as covered subtotals, **never as complete bulk COP**.

### Security review (design only)

Existing `costing` snapshots deny `authenticated` SELECT; existing MIS RPCs are invoker and denied to `anon`. Canonical `public.app_has_permission('executive-mis-dashboard','view')` provides a user-authenticated permission check; a narrow authorization-gated aggregation must be designed server side. Beware public definer views/functions bypassing RLS and default PUBLIC EXECUTE on newly created functions. The SELECT-only file is **not safe to expose as a public view**. Future SQL design must explicitly choose private precomputed snapshots, vetted definer gateway with fixed `search_path`, narrowed grants and actual negative-access tests; no broad permissions on costing. No client changes until SERVER ACCEPTED.

### Actual production and planning

November ledger source has 79 positive FG bulk-storage receipts and separate 86 SKU bottling outflows, 37 manual force-close adjustments, 4 epsilon closures and paired internal transfers. New receipt adapter must include source identity, event type, reversal/adjustment provenance and prevent reusing packing/transfer records as fresh production. Source `forecast_run` IDs date a model result but do not freeze the whole derived plan (stock/WIP/overrides). A frozen plan-as-of is still required before any comparable achievement KPI.

**Next bounded G7 actions:** independently scrutinize the SELECT-only SQL draft and source rate identity; specify a freeze/snapshot strategy with immutable provenance and cost-component-scope policy; develop a minimal reviewable permission-gated migration proposal with rollback and separately gated authorization. Explicitly do **not** execute or merge until owner independently approves the exact package. G8 stays parked and Costing Suite release isolated.


## 19. G7 offline design review — frozen baseline and common cutoff — 20 November 2026

**Control:** G7 DESIGN/OFFLINE only. No production SQL, DDL, grants, RPC installation, application client work, merge or Costing Suite Electron release changes. Conditionally owner-approved G6 method preserved; G7 not SERVER ACCEPTED.

- Reviewed `docs/executive-mis/MIS_G7_READONLY_SQL_DESIGN.sql` by inspection and corrected its **asymmetric reporting dates**: the earlier draft cut bulk receipts off at 20 November while including all dated FG transfers in the month. Revised **one common inclusive report cutoff bounded to the requested month** for both. Use `book_transfer_value` explicitly instead of mistaking `tally_total_amount` for a guaranteed identical source column, count NULL transfer book values, exclude nonpositive reference rates and give covered-only reporting a named completeness status. Revision commit `65d7b48688f0978d6e81881d8b64685138a7ba15`. The SQL is **unexecuted** and still NOT a permission-gated user-facing function.
- Authenticated **catalog/aggregate SELECT only**: November 79 positive storage ledger receipts all match their product's declared base UOM: 74 Kg, four L and one Nos. No mismatches in this observed sample; still preserve unit validation in the contract. The live FG transfer reconciliation has since changed versus prior observed fixtures: current query returned **100 rows** (95 MATCHED/OK, four MISSING_LOG/OK, one MATCHED/NOT_VALUED), demonstrating why reporting-as-of provenance and refresh consistency matter. Do not treat a dynamic view as frozen.
- October approved 143: **all 627 SKU rows, 453 products have positive per-SKU materials-stores allocation**, and amounts vary across SKU packaging. Distinguish this from the five *source* product `product_internal_source_materials_stores_allocation_snapshot` records. The G7 proposed full bulk manufacturing rate remains **BLOCKED on cost scope**; provisional core components may only appear as clearly labelled partial reference estimates. Do not discard materials-stores as zero or arbitrarily normalize SKU stores overhead.
- Created `docs/executive-mis/MIS_G7_FREEZE_AND_SECURITY_DESIGN.md` (commit `c09c2a1d4d351d264a15fc22c04a7627ce09c852`): immutable plan-as-of with source forecast, overrides, WIP/stock and input digest; independent approved-cost vintage and event cutoff; correction/supersession lifecycle; legacy-to-route event adapter and anti-double-counting; management-only read API with fail-closed server authorization; retention interoperability with possible Costing history cleanup but **no policy modifications**.
- **Important acceptance separation:** the presence of committed fixture scripts and draft SQL does not prove execution of those *exact repository bytes*; no end-to-end authenticated RLS, SQL EXPLAIN, frozen plan or browser acceptance is claimed. Do not promote G7 on the strength of mock tests.
- **Next bounded work:** independent static SQL review with source column/type verification, compile-time/offline tests, cost-stage classification and snapshot freeze implementation plan; seek distinct owner authorization only after a concrete migration/security/rollback package and confirmed scope decision. G8 remains parked; Costing Suite release isolated.


## 20. G7 accelerated materials-stores RM/PM attribution — 20 November 2026

**Owner direction:** Materials-stores expense is manufacturing-support overhead and ought to contribute to bulk-production valuation. **Critical nuance discovered immediately:** the approved policy `MATERIALS_STORES_STANDARD_RM_PM_V1` explicitly incorporates RM **and packing material (PM)** handling, so including the full SKU stores amount in bulk would mistakenly include packing-stage activity. Accelerated recommendation (design-level): include the **RM-associated materials-stores share** in bulk stage; leave **PM-associated share** at packaging stage.

**Live read-only data proofs:** approved Oct run 143 has 627/627 populated, positive, additive RM+PM workload rows across 453 products; the full ₹2,60,508.25 stores allocation reconciles to RM ₹2,713.94 + PM ₹2,57,794.31 (₹0.00 reported residual). All 453 products have a nonzero valid derived product base denominator, all 100 November planned products covered. Formula: `sum(sku_monthly_stores_allocation * sku_rm_workload/sku_unified_workload) / sum(sku_monthly_sku_base_qty)` by approved product and run; no arbitrary SKU selection or average. It is an **ideal-case workload attribution**, not measured issue activity or a standalone Costing policy change. Five special internal-source products have a different manufacturing labour forecast denominator; use the stores model's denominator, not the labour one.

**Draft updated only:** `docs/executive-mis/MIS_G7_READONLY_SQL_DESIGN.sql` at `9144712909efc074dad159435f7a3873ed6be095` now joins product-level RM stores handling rate from existing approved RM/PM workload split; `MIS_G7_FREEZE_AND_SECURITY_DESIGN.md` at `b693e45457094682cc13a67e17d2307c15ea67a4` records method and examples. Neither SQL nor any new grants, RPCs or tables were run/installed; client/Costing release untouched.

**Next:** avoid additional sprawling discovery; do a bounded static/contract validation of the exact proposed rate and permission design, isolate any source exceptions, and present one concise owner decision on source-scope and SQL installation package. G7 remains DESIGN/OFFLINE ONLY pending separate live authorization. G0–G5 owner-reported PASS (6/11), G6 method conditionally approved, G8 parked.


## 21. MIS-G7 consolidated server review — 20 November 2026

**Owner instruction:** rush-hour consolidated G7 review, preserve DESIGN/OFFLINE-only boundary. **Added** `docs/executive-mis/MIS_G7_CONSOLIDATED_IMPLEMENTATION_REVIEW_2026-11-20.md`, commit `6a07a7a772e7ee3b4de7e65c82275c5f4be9d822`, summarizing the exact calculation, separate stage-specific RM/PM stores rate, frozen plan/vintage/actual cutoffs, source provenance and exceptions, security gateway, acceptance and rollback plan. **No SQL was executed or installed**; no permission change, merge, deployment, client implementation or Costing Suite release activity.

**Independent catalog and key check:** approved run 143 uniquely identifies 627 RM, stores allocation and stores workload SKU keys and 453 product QC records; 453 stores RM rate products have nonnegative rates and valid denominators. Current 79 November bulk receipts align their recorded UOM with product base UOM (74 Kg, four L, one Nos); a future event adapter must still validate all new records. Reporting SQL draft revised to interpret the timestamp-with-time-zone receipt date explicitly in `Asia/Kolkata` and use the same inclusive local report cutoff as FG book-transfer dates (commit `da138887c746de20df63a5f9a1c2f45417e82ac5`). Date extraction in a WHERE clause is a **performance caveat**, to be replaced by sargable indexed UTC timestamp bounds after approved EXPLAIN.

**Review status:** selected SQL column/key checks PASS; stage-scope design consistent; **the SQL proposal itself has not been executed or parsed against Postgres**, and there is no actual authenticated role-negative testing, approved frozen-plan creation, SQL performance benchmark or complete G7 installation migration. G7 remains **DESIGN/OFFLINE**, NOT SERVER ACCEPTED. This proposal is **not** an authorization request for immediate installation; prepare exact minimal migration and rollback only as a separate bounded draft with independent checks, then seek separate owner action.

**Progress:** G0–G5 owner-reported PASS (6/11); G6 methodology conditionally approved; G7 current DESIGN/OFFLINE only; G8 parked; G9–G10 pending. Draft PR #485 remains unmerged; Claude #486 remains unmerged. Costing Suite Electron release isolated.
