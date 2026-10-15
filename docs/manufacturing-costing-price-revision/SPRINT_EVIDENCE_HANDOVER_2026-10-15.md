# Manufacturing Costing / Board Price Revision — Governed Sprint Handover
**Evidence cut:** 2026-10-15 IST. **Status:** financial-source audit completed; next gate is expense-detail and packing denominator evidence. **This is a distinct calculation stream, NOT WP05 Costing Suite UX rationalisation.**

## Authority, repository and non-negotiable rules
- Repository: `Brahmadathanu/sasv-workspace-dev`; handover branch `docs/costing-finance-oct15-continuation` starts from observed main `c5980839902b98ae9140340e7420dd0781b63e1c`. Recheck latest main at resumption; do not assume this SHA is current.
- Before action read `docs/master-data-costing/{IMPLEMENTATION_RULES,MASTER_PROGRAMME,CHANGELOG_DECISIONS,WORKPACK_HANDOVER_TEMPLATE}.md`, plus relevant programme/WP docs. Do not conflate this stream with unstarted WP05.
- Live Supabase is authority for server facts; current Git main for repository; approved programme docs for gates. This handover captures verified results, not unchangeable real-time state.
- Server ownership: ChatGPT, read live first; high-risk changes reviewed, narrowly scoped, verified and fail-closed. No automatic server migration merely for documentation. Never mutate historical run snapshots or overwrite effective-dated evidence. Client agent handles bounded client work only under branch/plan-review gates. No unapproved merge, publish, version/tag or release. Do not modify e-Aushadhi or unrelated programme branches.
- User is time-constrained/non-coder: sprint in cohesive independent bounded gates; no repetitive orientation, speculative redesign, arbitrary data, broad refactors or requests for manual copy/paste when connected tools can inspect directly. Summarise action and cumulative workflow after each step. Update this document on a documentation branch after meaningful verified gates; repo documentation is an audit ledger, not permission to alter financial data.

## Locked business/technical decisions
1. Manufacturing costs absorbed by production output, **not sales**. Normal standard costing at preferred manufacturing batch, including process-loss-aware net output, then governed product-to-SKU conversion. Multi-SKU products share product manufacturing base cost with distinct packaging/packing labour; do not duplicate manufacturing batch costs for each SKU.
2. Canonical manufacturing batch reference is `public.production_batch_size_ref` (minimum, preferred, maximum; effective dated). Do not infer from plans, BMR or FG transfer quantities; no automatic change to refs due to older above-max batches. Legacy BMR process belongs to later control gate.
3. Manufacturing direct labour uses existing route-attendance workload; packing labour uses separately governed packing/package-unit driver; production overhead uses its existing workload architecture. Preserve `MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS` structure. Do not use commercial sales allocation as standard manufacturing production denominator.
4. Actual Tally FG transfers are reliable **movement evidence**, not necessarily manufacturing completion dates, counts or quantities. Group by unique `(product_id,batch_code)` over period; multiple transfer dates of same batch do not create new batches. Do not infer extra batches by dividing by preferred/max quantity.
5. Current WIP / positive FG Bulk / positive Bottled Stock **live views only** for presence screening; historic `FG bulk storage` ledger entries are not current stock. The user specifically asked that live-present identities be set aside provisionally from a fully-cleared frequency sample; presence itself is not proof unfinished manufacture, and absence is not proof completion. Bottled stock can be finished inventory. Do not turn this screen into a new blanket statutory completion rule.
6. No silent approval of staff/overhead normal budget, fixed/variable/mixed splits, capacity, or rates. `UNKNOWN != READY`; review and blocked states persist on missing evidence.
7. Later BMR gate: proposed batches must validate effective minimum and maximum; preferred is default, not absolute cap when <=maximum. For emergencies outside effective bounds, formally review/update batch reference *before* authorization, preserve the reference version used and historical traceability. Do NOT pull BMR into current costing gate.

## Verified Supabase state (re-query before relying on it)
Project `qhmoqtxpeasamtlxaoak`. Historic immutable costing run `119`, period start 2026-09-01, valuation date 2026-09-10, created 2026-10-14; do not refresh until cutover gates pass.
- `costing.fn_preview_standard_batch_workload(119)`: 460 route-supported products (5,149.75 labour and 4,947.50 OH units for one preferred batch of each, **not** annual denominators). `costing.fn_preview_standard_batch_net_output(119)`: net output after process loss. Governed `costing.fn_resolve_standard_sku_base_quantity(sku_id)`: 635 active SKUs.
- SKU exceptions: 865 Kashaya Vasthi Kit 275 g = 1 Nos/packet, 878 Karkkidaka Kanji 500 g = 1 Nos/packet. Existing `public.v_tally_fg_transfer_normalized` was *actually fixed* in Supabase by migration `fg_transfer_governed_base_quantity_exception_fix` using approved `costing.sku_base_quantity_exception`. Full-history affected 23 records: Kanji 22, 109,338 Nos correct vs 54,669,000 incorrect; Vasthi 1, 199 Nos vs 54,725. Post-apply 5,622 applicable transfer rows had 0 governed conversion mismatches. Do not revert or duplicate.
- Historical FG transfer window: 2025-10-01..2026-09-30: 1,448 `(product_id,batch_code)` identities with product mapping. Live-presence check: 3 WIP, 15 positive FG Bulk, 6 positive bottled; 24 flagged, no overlap; 1,424 provisionally unflagged. Live sources: `public.v_wip_batches`, `public.v_fg_bulk_batch_balance` qty_base>0, `public.v_ppq_bottled_stock_by_batch_product_base` bottled_on_hand_base_qty>0. Snapshot changes over time: recheck before recalculation.
- 1,424 unflagged across 419 products; 1,412 match run119 route workload, 12 unmatched. Frequency-weighted indicative annual 10,939.40 manufacturing-labour route units and 11,897.00 OH units; descriptive 12-month averages 911.6167 and 991.4167 units/month. These are *proxy observations based on first FG transfer*, NOT production-completion dates or approved normal capacity.
- Screening 1,424: 1,001 transfer quantities between 50% min and 101% max, 345 above 101% max, 66 below 50% min, 12 unmatched. These are descriptive **not exclusions**. Of 345 above max, 5 involve 1kg ref; 340 span 124 products. Historic batches may exceed current preference and can be valid.
- 12 unmatched identities: six active products with no batch ref/route (IDs 156,160,228,237,240,246); two active products 746 Sivanar Amritham Capsule (current route READY, preferred 30,000 Nos but not in run119 labour/OH snapshots) and 1016 Urai Mathirai (no approved route-family mapping, preferred 25,000 Nos); four inactive (794,1064,1204,1238). All eight active products in exception list have no **active SKUs**. Run119 foundation is derived from its labour+OH snapshots, not all approved routes. Never invent route or activate SKU just for coverage.
- Illustrative ONLY: Sep 2026 manufacturing labour 40 staff ₹706,203; packing 50 staff ₹621,599, separate. ₹706,203 / 911.6167 = ₹774.67/manufacturing workload unit, **not approved rate**. Overhead supervision ₹41,055 plus historical higher-of-FY expense provisions ₹974,980.2817 = ₹1,016,035.2817; /991.4167 = ₹1,024.83/OH workload unit, **not approved**. Other staff classes remain in canonical pools (stores, QC, general admin, finance).
- `costing.fn_preview_manufacturing_component_coverage(119)`: direct labour ₹1,327,802 with zero unmapped; production overhead ₹1,016,035.2817 with zero unmapped. `costing.fn_preview_manufacturing_rate_cutover_gate(119)`: ten component total ₹1,722,238.2817; 0 classified, 0 approved classification, 0 approved rate policy; `BLOCKED_CLASSIFICATION_APPROVAL`. `costing.manufacturing_cost_behaviour_split`, `costing.manufacturing_standard_rate_policy` empty as last verified.
- `costing.fn_preview_manufacturing_rate_approval_inputs(119)`: ten source components (manufacturing labour, production supervision, eight expense heads), all need behaviour, normal budget, capacity approval. `costing.fn_preview_manufacturing_rate_readiness(119)`: packing separate; no approved normal rates.

## Eight production-overhead expense-head history (monthly INR reference)
Data source: `costing.v_expense_head_monthly_provision` `comparison_details` for `period_start='2026-09-01' and allocation_pool='PRODUCTION_OVERHEAD'`. FY2025-26 is complete annual/12; FY2026-27 is partial FY running monthly equivalent (mostly thru 2026-07-31, Fuel thru 2026-06-30); selected is higher *per head*, NOT approved normal budget.
| Head | Completed FY25-26/month | FY26-27 partial/month | Selected/month |
|---|---:|---:|---:|
| Fuel & Gas (DE) | 161969.07 | 479589.60 | 479589.60 |
| Mess Expenses (DE) | 177224.92 | 133949.97 | 177224.92 |
| Electricity & Water (DE) | 149304.75 | 112935.00 | 149304.75 |
| Repairs & Maintenances (DE) | 41978.20 | 69457.91 | 69457.91 |
| Cleaning Expenses (DE) | 35511.10 | 32259.21 | 35511.10 |
| Factory Expenses (DE) | 29983.51 | 27139.55 | 29983.51 |
| Job Work Expense | 25562.25 | 8383.75 | 25562.25 |
| Printing & Stationery (DE) | 8346.24 | 2896.50 | 8346.24 |
| **Total** | **629880.04** | **866611.49** | **974980.28** |
Selected higher-of-FY is +₹345,100.24/month vs completed FY average. Fuel partial ₹1,438,768.80 through June/3 = ₹479,589.60 vs completed FY ₹1,943,628.88/12 = ₹161,969.07 (~2.96x). Do not infer cause without detailed transactions: potential concentrated posting/price/volume/etc. Job Work may require product/batch direct attribution instead of common OH; repairs may include exceptional spend. Never classify only by ledger-head name.

## The single ACTIVE next gate — FINANCE-SOURCE DETAIL AUDIT
1. Inspect actual Supabase schema and underlying `tally_expenses_snapshot`, item/head mapping, period/as-of dimensions and other transaction-level Tally sources available; never assume monthly source is transaction-level if it is a cumulative snapshot.
2. For Fuel & Gas, Job Work, Repairs & Maintenance (then other heads), compare FY2025-26 and available FY2026-27 detailed chronology; identify *what the existing granularity supports*, duplicated snapshots vs real incremental movement, unusually concentrated periods and directly attributable vouchers if accessible. Provide robust variance decomposition and evidence gaps; avoid guessing cause or changing numbers.
3. Evaluate separate packing-labour denominator from actual packing output/SKU responsibilities, not sales and not route batch frequency. Preserve existing responsibility rules including externally fully packed products. Only build a bounded auditable read-only preview before rate proposal.
4. Review normal activity representativeness and alternative evidence, not blind arithmetic average; distinguish production vs first FG transfer date and provisional live-screen restrictions.
5. Produce **one consolidated management decision docket**: source amount, eligible factory cost, fixed/variable/mixed recommendation with evidence and explicit unresolved decisions, normal budget candidate, proposed denominator, approval reference/authority, effect on rates. DO NOT insert approval rows automatically.
6. Once evidence and decisions are approved, targeted existing-engine driver correction, independent portfolio reconciliation, controlled cutover, new refresh, Board 509-SKU pricing tab. Maintain separate packing/direct-material/package material/overhead drivers. No sales-based reintroduction.
7. Later BMR reference enforcement at explicitly separate work pack.

## 10-stage workflow (cumulative recap required each substantive reply)
1. Canonical staff and expense sources — verified.
2. Batch refs, route workload — current run119 foundation verified; exceptions documented.
3. SKU conversion and net output — verified.
4. FG normalization and live-stock screening — normalized view fixed; historical screen documented.
5. Batch activity frequency baseline — provisional 1,412 matched and annual proxy established.
6. Manufacturing rate evidence/classification/packing driver — **ACTIVE; Finance detailed expense history next**.
7. Independent product/SKU financial reconciliation/audit — pending.
8. Governed rate and existing-engine cutover — pending.
9. Fresh refresh and Board 509 SKU price revision — pending.
10. Later BMR batch preference enforcement — parked, no premature implementation.

## Documentation discipline and next-chat handover protocol
- At start: re-read canonical programme files and this handover; inspect current Git SHA/branches and actual Supabase cutover gate/run. Distinguish this price-revision calculation sprint from unstarted WP05 UX programme. If live state differs, explain and reconcile, never assume prior result unchanged.
- At each *verified material gate*: update this same file's evidence/date/current gate, maintain append-only decision and exception subsections here or a separately approved ledger. Do not edit core `MASTER_PROGRAMME.md` or `CHANGELOG_DECISIONS.md` for this distinct stream without agreement to integrate programme control. Use a docs-only branch; no direct main edits. Preserve source snapshots; include SQL query identifiers, amounts, count, dates, tests, migration names, current main/branch SHA. Verify doc commit.
- For any repo write/merge: inspect scope and current main; no conflicting worktrees; no merge without approval. Only server changes get appropriate separate server review/validation.
- In each reply include: WORKFLOW / WP progress / PROGRAMME progress / CURRENT gate / NEXT / PARKED / LOCKED; concise but precise. Keep sprint pace and do not force the non-coder user to orchestrate technical work.
