# WP-04 — Central Master Data / Costing Readiness Control Centre

## Objective
Audit existing SKU/status surfaces and establish an authoritative portfolio readiness/remediation capability only if justified. Reuse proven authorities and surfaces; no second readiness calculator.

## Authority and entry criteria
Live Supabase → current Git main → approved programme/WP MD → chat supporting context.

WP00–WP03 and the prerequisite control plane are completed and verified. WP03 remains COMPLETED, VERIFIED, MERGED AND CLOSED. Its merge `dd7da3a6fa2f447a71d92ca091f3d18921e32968` and verified feature tip `3894ce43798e4d9d919dfac54c8ab11aa7168733` are ancestors of the audited main. No demonstrated upstream regression was found; WP03 is not reopened.

Remote main was fetched through GitHub first, then `git fetch origin main` independently confirmed `47dcd80f69ca68fcca8f089bf40fa4099b376450`. It matched the entry reference. Dedicated branch: `docs/wp04-g0-readiness-control-centre-audit`, based on that exact main. Isolated fresh checkout; no existing checkout/worktree was modified.

Mandatory inputs read: MASTER_PROGRAMME, IMPLEMENTATION_RULES, WORKPACK_HANDOVER_TEMPLATE, this WP, PARKED_BACKLOG, CHANGELOG_DECISIONS, and closed WP03. WP00 dependency matrix was also consulted and reconciled against current source/live definitions. No repository AGENTS.md was found.

## Scope and explicit exclusions
G0 is a read-only repository/live audit plus documentation. No launcher tile, module, dashboard, queue, route mapping, schema, RPC, permission, business rule, bulk writer, activation rule, release, tag, merge, or production mutation.

Preserve distinct Product/SKU entities and lifecycle; new Manage Products SKU remains Inactive; explicit activation remains separate and ungated by readiness. Product Active does not imply SKU Active or Costing Ready. UNKNOWN is not READY; review stays review; missing evidence stays incomplete; BLOCKER/BLOCKED cannot be bypassed. No Product-wide READY calculation. Saved Product without SKU remains a legitimate incomplete entity state without a fabricated readiness verdict.

Malayalam-name mismatch, Product status choice at creation, and readiness-gated activation remain unresolved high-risk decisions, outside WP04. UX-P02→WP11; NAV-P01/NAV-P02→WP08; CSE-P01 and SEC-P01 stay parked.

## WP04-G0 — Current-state audit (2026-10-02)

### Existing client surfaces
| Existing surface and source | Portfolio/queue behaviour and authority | Reuse boundary |
| --- | --- | --- |
| Manage Products, `manage-products.html`, `js/products.js` | Full Product catalog; saved Product’s SKU/Readiness lenses; per-SKU canonical LIVE_AS_OF calls; no-SKU guidance and master editor actions | Lifecycle anchor, not portfolio costing centre. Do not duplicate WP03 |
| Costing Control Center, `public/shared/costing-control-center.html`, `costing-suite-control-center.js` | Dashboard, Control Workbench, SKU Control Status; portfolio counts, material exceptions, primary control/route, secondary material evidence, exact frozen detail | Strongest existing central operational surface; snapshot costing control is not WP01 live readiness |
| Control Center selected-row foundation detail | `rpc_get_current_material_foundation_diagnosis(product_id,sku_id)`: current RM BOM and PM requirement presence | Supplemental CURRENT_SOURCE_STATE diagnosis, not readiness or approved frozen PM-BOM proof; no-SKU PM is NOT_EVALUATED_NO_SKU |
| Material Cost Manager, `costing-suite-material-cost.js` | Manual Rate Manager action queue/register/history; RM/PM trace; material acceptance writer | Existing specialist remediation, preserve its permission and exact evidence |
| Cost Sheet Review, `costing-suite-cost-sheet.js`, `costing-suite-shell.js` | SKU cost details/diagnosis, printable sheets, comparisons, scheme viability; cost confidence vs commercial viability | Existing downstream outcome/explanation, not entity lifecycle |
| QC and Materials/Stores queues, `costing-suite-qc-action-queue.js`, `costing-suite-materials-stores-action-queue.js` | Paged RPC-backed exceptions with recommended actions; Product-grain QC and SKU-grain MS | Specialist-owned follow-up and explain views; no central editing presumed |
| Production Route Manager, `costing-suite-production-route*.js` | Product route readiness, assignments, mapping/foundation review, cost centres, workload, draft/validate/submit/approve editors | Set-wise route readiness only; inherited approved family route can validly resolve |
| Pricing Policy Manager, `costing-suite-pricing-policy.js`, commercial-sales-assumptions and MRP modules | SKU overview; MRP reference readiness, proposals, decisions, application/history; selling/scheme policies; common/regional assumptions/defaults | Effective-dated specialist commercial authority, not Marketing evidence acceptance |
| Cost Build Manager, `costing-suite-cost-build.js`, driver-governance modules | Unmapped expense heads, unclassified staff, manual provisions, seven-element driver registry, policy lifecycle | Shared/global governance distinct from SKU remediation |
| PM BOM Manager, `manage-pm-bom.html`; Supply Batch Plan/batch-size references | PM authoring and frozen revision governance; preferred/min/max effective batch-size lifecycle | Foundation owners; row absence alone is not a universal readiness rule |
| MRP Master Data Console, `public/shared/mrp-master-data-console.html` | MOQ Policy, RM Form Conversion, Season Profiles, RM Seasonal Mapping registers | Procurement/planning master data; not a Product/SKU costing readiness centre |

`costing-suite-registry.js` and `costing-route-config.js` already register six Costing Suite modules and their lenses. Live `v_app_module_registry` proves the existing Control Center, Material, Cost Build, Pricing, and Cost Sheet routes for Electron/PWA. No new module is justified at G0.

### Existing server contracts and stored evidence
Inspected live pg_proc signatures/bodies, pg_views definitions, relation/column inventories, grants, view options, and targeted indexes.

| Contract/object | Grain/context | Finding |
| --- | --- | --- |
| `public.rpc_get_product_sku_readiness(bigint,date,text,bigint)` | One SKU + explicit governed period + context type; exact run additionally pinned | Canonical multidimensional readiness, jsonb; no array/list/page argument |
| `rpc_get_latest_governed_cost_period_start()` | Governed period | Returned 2026-09-01 under verified authorized actor context |
| `costing.fn_product_sku_readiness_enrich`, `...run_evidence`, `...shared_issues` | SKU/run evidence plus valuation-date global policies | Seven driver dependencies, scheme, regional acceptance, shared issues; enrich summary on server |
| `costing.fn_resolve_sku_commercial_sales_basis_point` | SKU + period + valuation date | WP02 point lookup remains in live readiness. Multiple snapshot rows remain unresolved authority (CSE-P01) |
| `costing.v_current_successful_costing_refresh_run` | Latest SUCCESS with CAPTURED_AT_REQUEST per period | Existing snapshot reader context, not identically defined to readiness’s period+governed valuation SUCCESS selection |
| `public.v_costing_pricing_sku_control_status_snapshot` | Persisted SKU/period/valuation/run, current successful projection | Existing set-wise portfolio costing control. Joins DL and can overlay DIRECT_LABOUR_ROUTE_BLOCKED. Not full live master readiness |
| `costing.sku_costing_control_status_snapshot` | Frozen exact-run SKU | Unique period+valuation+run+SKU index; material, manufacturing, pricing, selling, outcome, first control, severity/route; monetary fields |
| `costing.costing_control_dashboard_snapshot` and public control-dashboard/business-KPI/dashboard views | Period/run summary | Existing counts/integrity/operational visibility |
| Material queue/drilldown, review-workbench summary/top-action/drilldown snapshots and public wrappers | Material/issue and affected Product/SKU/run | Existing portfolio remediation priority/impact evidence, not canonical readiness |
| `rpc_get_current_material_foundation_diagnosis` | Selected Product + optional SKU, current source | RM header/line counts and PM requirement count; separate from effective approved BOM revision |
| `rpc_get_qc_action_queue`, `costing.v_qc_action_queue_current` | Product/period/run | Paged exception contract; cost-sheet-review view permission |
| `rpc_get_materials_stores_action_queue`, `costing.v_materials_stores_action_queue_current` | SKU/period/run | Paged exception contract, max 500 rows; cost-sheet-review view permission |
| `rpc_get_regional_marketing_action_queue`, regional action snapshot/current view | SKU+region/period/run | Pricing-policy-manager view; assumption/basis actions, distinct from acceptance queue |
| `costing.v_regional_marketing_evidence_review_queue`, `fn_regional_marketing_review_status` | SKU+region+run/evidence fingerprint | Raw REVIEW_REQUIRED rows plus eligible fingerprinted acceptance yield effective status |
| `costing.rpc_accept_regional_marketing_review`, `regional_marketing_evidence_acceptance` | Exact evidence fingerprint, SKU+region | Costing-control-center edit; required reason, eligibility validation; no current-main invoking client found |
| PRM live/exact readiness RPCs, `fn_product_process_route_readiness` | Product/as-of or exact run; paged | Specialist set-wise contract, not whole Product/SKU readiness |
| Driver registry/detail RPCs and `v_cost_driver_policy_registry` | Global cost element/policy | All seven elements; shared issues must not be multiplied into fake SKU edit tasks |
| `costing_refresh_run`, stages, refresh status/context RPCs | Run/stage | Failures/context integrity and final run counts already stored; refresh writers were not called |
| Detailed-cost-sheet, status-diagnosis, Product summary and MRP reference-readiness views | Various Product/SKU/period projections | Existing specialist summary/diagnosis; not interchangeable with canonical live readiness |

There is **no identified set-wise full WP01 portfolio readiness contract** in live function/relation inventory or current consumers. Set-wise costing control, specialist route readiness and queues do exist. G0 creates no bulk contract.

### Canonical readiness unit and context
The assessment unit is **SKU + governed period + valuation/context semantics**, not Product-wide readiness or lifecycle Active. LIVE_AS_OF accepts one SKU, requires explicit period, reads governed valuation, rejects a refresh-run argument, and uses current master foundations with latest SUCCESS evidence matching period and valuation. Payload exposes `evidence_refresh_run_id` separately; requested `refresh_run_id` remains null.

EXACT_RUN requires a run, retains frozen evidence semantics, and does not substitute unfrozen Product/lifecycle truth. Persisted costing-control key is period+valuation+run+SKU. Regional acceptance additionally needs region and fingerprint. The Product without SKU has no assessment key; record its entity gap separately.

Existing snapshot reader chooses latest CAPTURED_AT_REQUEST SUCCESS per period; canonical readiness chooses latest SUCCESS matching current governed valuation. Both currently resolve September evidence to Run115, but G1 must preserve and explicitly reconcile those selectors rather than equating them by assumption.

### Queue field feasibility and state grouping
| Desired field | Existing authoritative support | Limitation |
| --- | --- | --- |
| Product/SKU identity and lifecycle | canonical context/identity/lifecycle; products/product_skus | Product no-SKU is an entity row, not a readiness result |
| Period, valuation, evidence run/context integrity | canonical context; governed-period RPC; exact snapshots | Must retain LIVE_AS_OF vs frozen outcome distinction |
| Overall severity and all five foundation/evidence/outcome dimensions | canonical summary | Not available together in current set-wise control view |
| Dependency code, status, applicability, owner, route, reason/note, evidence IDs | canonical dependencies/shared_issues | Owner/route are dependency-level; no single canonical row owner |
| First blocking dependency | dependency array and downstream first_control_status | No canonical “first blocking live dependency” scalar or approved cross-dimension priority. Do not manufacture one in JavaScript |
| Downstream control state | canonical downstream_control and persisted snapshot | Can be absent/UNKNOWN while current foundations block |
| Affected Product/SKU impact and action priority | existing specialist/material queues | Grain differs; cannot sum duplicate issues into fake portfolio totals |
| Age/staleness | snapshot_refreshed_at, run timestamps, material rate dates, acceptance timestamps | These are distinct clocks. No authoritative readiness issue first-seen age, SLA or stale threshold exists |

Display groups may use READY, REVIEW_REQUIRED, BLOCKED/BLOCKER, UNKNOWN while retaining raw server codes. Client request/load failure is separately Unavailable, never server UNKNOWN. NOT_REQUIRED/RESOLVED are dependency semantics, not portfolio READY votes. No client severity precedence, Product READY rollup, or rule selecting one of multiple commercial snapshot rows is approved.

### Live inventory and bounded proof
Project `qhmoqtxpeasamtlxaoak`; read-only observations on 2026-10-02. Every query used BEGIN READ ONLY and a 10-second statement timeout. Targeted permission-checking reads used transaction-local actor claim for the supplied actor after verifying existing permissions, then ROLLBACK. This is SQL audit evidence, not browser-session verification. No persistent permission/claim/data change.

| Population | Count |
| --- | ---: |
| Products / Active / Inactive | 1342 / 639 / 703 |
| SKUs / Active / Inactive | 1793 / 637 / 1156 |
| Sample SKUs / active non-sample SKUs under Active Products | 29 / 611 |
| Products with no SKU / Active Products with no SKU | 516 / 54 |
| Active Products with no active SKU | 179 |
| Products / SKUs failing current basic master foundation predicates | 0 / 0 |
| Run115 control rows / READY / REVIEW_REQUIRED / BLOCKER / UNKNOWN | 636 / 489 / 147 / 0 / 0 |
| Active SKUs missing Run115 control / all SKUs missing Run115 control | 1 / 1157 |
| Material action queue rows, Run115 | 820, all REVIEW_REQUIRED / MATERIAL_RATE_REVIEW |
| QC action queue, September | 2 REVIEW_REQUIRED_QC_ABSORPTION_BASIS |
| Materials/Stores action queue, September | 2 REVIEW_MONTHLY_ALLOCATION_BASIS |
| Regional assumption action queue, September | 0 |
| Regional Marketing acceptance review rows, Run115 | 222, across 146 distinct SKUs; IK 95 / OK 127 |
| Acceptance review eligibility / accepted | 222 eligible / 0 accepted; all effective REVIEW_REQUIRED |

Run115 SUCCESS: September period, valuation 2026-09-10, finished 2026-09-27T21:00:00.058881Z. Latest Run116 FAILED at material stage: NO_EFFECTIVE_PM_BOM_REVISION, missing SKU114. Failed runs are excluded from readiness evidence selection.

Snapshot route distribution: COST_APPROVAL_WORKBENCH 489; COST_REVIEW_WORKBENCH 146; MATERIAL_RATE_REVIEW 1. Snapshot first controls: READY_FOR_COST_REVIEW 489; PRICING_BRIDGE_REVIEW_REQUIRED 143; PRIME_COST_REVIEW_REQUIRED 3; MATERIAL_REVIEW_REQUIRED 1. These are snapshot outcomes/routes, not canonical portfolio owner totals.

| Run115 dependency evidence code | READY | REVIEW_REQUIRED |
| --- | ---: | ---: |
| DIRECT_LABOUR | 632 | 4 |
| PRODUCTION_OVERHEAD | 632 | 4 |
| QUALITY_CONTROL_OVERHEAD | 632 | 4 |
| MATERIALS_STORES_OVERHEAD | 634 | 2 |
| ADMIN_OVERHEAD | 634 | 2 |
| FINANCE_ADMIN_OVERHEAD | 634 | 2 |
| MARKETING_EXPENSE | 560 | 76 |

These direct persisted driver counts do not represent full live dependency frequencies; regional acceptance adds separate effective review evidence. Do not add the table rows to obtain unique affected SKUs.

Bounded canonical LIVE_AS_OF proof, all using September and null requested run:
- SKU11, Product14: Active, READY; all foundation dimensions RESOLVED; outcome READY.
- SKU10, Product14: Inactive, BLOCKER; master foundation RESOLVED but PM_BOM_REVISION, MRP_POLICY, SELLING_PRICE_POLICY and COMMON_COMMERCIAL_BASIS block; driver/scheme evidence UNKNOWN, outcome UNKNOWN.
- SKU42, Product51: Active, REVIEW_REQUIRED; REGIONAL_MARKETING_EVIDENCE owned by COSTING_CONTROL_CENTER / REGIONAL_MARKETING_REVIEW; foundation RESOLVED.
- SKU114, Product133: Active, BLOCKER, outcome UNKNOWN; same four blocking codes as SKU10; absent successful-run control.
- Across this deliberately selected four-SKU sample, each of those four blocking codes appears twice; regional acceptance review appears once. This is representative proof, not a random sample or catalog frequency estimate.

Full 1793-SKU LIVE_AS_OF READY/review/blocker/UNKNOWN totals and full canonical owner/route/dependency frequencies were **not safely obtained** because measured RPC cost makes an N-call census inappropriate. They remain an explicit G1 evidence/contract requirement. Snapshot counts must not be labelled those missing counts.

Historical refresh failures: 11 recorded failures, grouped as material stage 4, cost build 4, control maintenance 3. PM-BOM missing-revision failures recur in Run110 and Run116. Other recorded failures include FK constraints, ambiguous column, duplicate drilldown key, route context, DL pool mismatch and integrity checks; historical occurrence does not prove each defect remains current. No repair attempted.

### Performance and portfolio feasibility
Measured bounded `EXPLAIN (ANALYZE, BUFFERS)` for canonical SKU11 LIVE_AS_OF:
- Server execution 1762.132 ms; shared hit blocks 221199; shared read/dirtied/written blocks 0.
- One measurement, not a concurrency benchmark or guaranteed SLA.
- Illustrative serial multiplication: 637 active calls ≈18.7 minutes; 1793 calls ≈52.7 minutes if equal cost. These are extrapolations, not measured portfolio timings. Parallel fan-out would add load, not establish acceptable performance.

Measured existing set-wise snapshot severity aggregation: 3.29 ms, 1992 shared hit blocks. Different scope and semantics; it demonstrates inexpensive existing visibility, not equivalence to readiness.

Canonical RPC calls the Product-wide route readiness function then filters by Product, plus multiple effective resolvers, per-run evidence and shared driver evaluation. The route function is SQL STABLE SECURITY DEFINER with active-Product base; actual predicate pushdown/internal bottleneck was not isolated. Shared/global evaluation also repeats per call. Context/SKU indexes exist; their presence does not make full RPC fan-out cheap.

Manage Products currently uses Promise.all over only the selected Product’s SKUs. Do not expand that pattern to the whole catalog. Preserve the existing commercial-sales point helper and CSE-P01 multi-row uncertainty. No old full commercial-sales scan is reintroduced. A performant **server-side portfolio contract is likely required** for full live readiness, subject to G1/G3 design/review; wrapping N unchanged calls is not proven sufficient. Existing snapshots alone can support only their accurately labelled control scope.

### Permission findings and Marketing placement
Canonical readiness is SECURITY DEFINER with explicit auth.uid and either manage-products view OR costing-control-center view. EXECUTE grants inspected: authenticated and service_role (plus owner), not PUBLIC/anon. Narrow readiness visibility does not authorize monetary cost views or mutations.

Control Center snapshot wrapper is security_invoker=true, authenticated SELECT with explicit costing-control-center view filter (privileged audit roles separately allowed). Monetary fields exist; do not copy that payload into Product-only access without authorization design.

QC/MS reads require cost-sheet-review view. Regional assumption action queue requires pricing-policy-manager view. Marketing acceptance requires costing-control-center edit and server eligibility/fingerprint/reason. Existing supplied actor has view/edit for all seven inspected modules; no permissions were changed. View-only/denied browser journeys were not manufactured.

UX-P01 is confirmed: no current-main client invocation of Marketing acceptance or regional queue RPC outside generated types was found. Readiness visibility can show Marketing evidence centrally, but acceptance is a specialist governed mutation distinct from assumption/default editing. G2 should compare existing Control Center follow-up versus a later WP05–WP07 specialist acceptance surface; no placement or editor is approved in G0.

**New parked security finding SEC-P02:** regional evidence-review view grants authenticated SELECT, costing schema grants authenticated USAGE, view lacks security_invoker=true and module predicate; underlying review-status helper is SECURITY DEFINER without its own permission check. View includes monetary fields. This differs from narrow nonmonetary readiness authorization. Record for dedicated access/exposure/policy audit before direct reuse; this audit does not prove configured Data API schema exposure or test an unauthorized user. No grant/RLS/view change is made.

### Central remediation boundaries
| Boundary | Meaning | G0 treatment |
| --- | --- | --- |
| Prevent | Existing server validation at save/lifecycle | Preserve; no new activation or required-field rules |
| Guide | WP03 saved-entity/per-SKU guidance and master dialog actions | Closed upstream; preserve |
| Central Visibility | Cross-Product status/context/owner/impact follow-up | Reuse existing evidence where its semantics fit; full-live contract unresolved |
| Navigation | Proven existing module/lens destinations | Inspect only; no mappings/links added |
| In-module remediation | Existing master editors or owned material workflows | Stay under current owner and edit permission |
| Specialist | PM BOM, batch, route, pricing, drivers, QC/MS, Marketing acceptance | Safe descriptive code/status/owner visibility; central editing not presumed |
| Bulk Remediation | Multi-entity mutation, approval or evidence rewrite | No generic bulk remediation contract identified; high-risk and excluded |

Existing Stage-05 `costing-suite-recommended-ui-route.js` proves a **partial** route resolver: Production Route Manager, conditional material manager, material review, and pricing-review workspace destinations. COST_APPROVAL_WORKBENCH and unknown tokens stay non-navigable; COST_REVIEW_WORKBENCH is not handled. This does not supersede NAV-P02: canonical WP01 route vocabulary is not fully mapped, and Manage Products specialist routes intentionally remain text. Current-foundation RM_BOM_MANAGEMENT/PM_REQUIREMENT_MANAGEMENT are explicitly unverified in Control Center. No URLs are invented.

### Placement comparison (recommendation only)
| Option | Evidence | G0 assessment |
| --- | --- | --- |
| Extend existing Costing Control Center | Already portfolio/queues/control context and permissions | Best candidate for G2 comparison; no approved design yet |
| Extend Product/Master Data area | Catalog reaches Product users and zero-SKU entities | Could expose nonmonetary entity gaps; preserve lifecycle anchor and avoid duplicate costing authority |
| Embed readiness queue in existing surface | Shared context and proven remediation destinations | Plausible after performant contract/permission review |
| Reuse existing queue/control only | Fast and operationally established | Adequate for frozen downstream control; misses inactive/new SKU foundations and Product no-SKU population |
| New top-level module | No gap demonstrated that requires a new launcher destination | Not justified; DEC-005 reserves this until WP05/WP07/WP08 evidence or explicit superseding decision |

### Classification
- **REQUIRED NOW:** entry reconciliation, surface/contract/key inventory, bounded counts, authority/context differences, performance/permission limits, durable gate ledger. Completed at G0.
- **FUTURE DEPENDENCY:** G1 portfolio population/context/contract; G2 placement/remediation model; G3 package decomposition. Full canonical severity/owner/frequency census requires safe portfolio retrieval. Marketing acceptance placement remains UX-P01.
- **HIGH-RISK:** any new/changed server contract, set-wise authority/aggregation semantics, authorization, RLS, schema/index/view changes, central writers, top-level module, cross-module architecture, issue priority/age rules. Separate Plan → ChatGPT review → Implementation.
- **PARKED:** UX-P01, UX-P02, NAV-P01, NAV-P02, CSE-P01, SEC-P01; new SEC-P02 access audit.
- **OUT OF SCOPE:** production mutations/repairs, activation policy, Malayalam/status harmonisation, aesthetic hardening, broader launcher/navigation redesign, historical rewriting, e-Aushadhi.

## WP04-G1 — Portfolio readiness contract proposal (2026-10-02)

### Entry and execution status
G0 is completed at audit/documentation level at `5f7ec89c17c3c4720060b33c60b4d2bf5c6c3ff4`. Fresh fetch confirmed main remains `47dcd80f69ca68fcca8f089bf40fa4099b376450` and the audit branch had not moved. G1 continues on the same dedicated documentation branch. WP01's final contract was read as upstream authority; WP03 remains closed.

**PLAN READY FOR INDEPENDENT CONTRACT REVIEW.** This is a proposal, not approval to change server/client architecture. G1 remains [~] IN PROGRESS until that review passes. No decision is locked, no contract exists live, and G2 has not started.

### Additional live evidence
Read-only transactions, 10-second timeout; no full readiness census or production mutation.

| Population partition | Count |
| --- | ---: |
| Active Product, Active SKU, non-sample | 611 |
| Active Product, Active SKU, sample | 26 |
| Active Product, Inactive SKU, non-sample | 730 |
| Active Product, Inactive SKU, sample | 2 |
| Inactive Product, Inactive SKU, non-sample | 423 |
| Inactive Product, Inactive SKU, sample | 1 |
| Active Product without SKU | 54 |
| Inactive Product without SKU | 462 |

All 1793 existing SKUs are accounted for. No currently Active SKU has an Inactive parent; this observation is not a new lifecycle constraint. Product/SKU SELECT policies currently permit authenticated rows with auth.uid present, and RLS is enabled; the readiness RPC separately enforces its module permissions. These reads do not justify broadening readiness or costing authorization.

A targeted route query for Product14 returned a **Function Scan**, evaluated 639 active Products and removed 638 rows by filter: **1762.331 ms / 214813 shared hit blocks**. A bounded commercial point-helper call for SKU11 with LIMIT 1 took **8.870 ms / 1501 shared hit blocks**. Single measurements are not SLAs or concurrency proof. Route-wide evaluation is a demonstrated major cost, rather than only a suspected bottleneck.

**CSE-P01 quantified, not resolved:** September sales-allocation snapshots contain 17350 rows across 685 SKU groups; all 685 are multirow (up to 26 rows each). 681 groups span multiple valuation dates. Source tuples (coalesced SKU units, Product units, SKU base quantity, lookback interval) differ in 379 groups, including 376 Active SKU groups. One group, inactive SKU1795 under inactive Product794, has both positive and nonpositive SKU-sales evidence.

The point helper filters SKU/period and the current cost_periods valuation, but does not constrain the source snapshot's valuation or run; the readiness caller consumes LIMIT 1 without ordering. Thus latest-success driver/outcome pinning **does not establish common-commercial source-row authority**. Do not filter those source rows to Run115, choose highest ID, newest timestamp or one valuation date in WP04. Different source tuples do not by themselves prove different readiness severities. No row was chosen or rewritten in this gate.

### Proposed assessment population
- Read boundary covers all existing SKUs, including inactive and sample SKUs. A selectable **Active Products + Active non-sample SKUs** operational scope is a membership filter, not readiness or activation eligibility.
- Population must always be explicit. Suggested initial scope values: ALL_EXISTING_SKUS and ACTIVE_NON_SAMPLE_SKUS_UNDER_ACTIVE_PRODUCTS. G2 chooses presentation/default scope; all population membership is resolved on server.
- Existing SKU with inactive parent remains assessable through current canonical semantics. Do not translate missing Active-Product route evidence into NOT_REQUIRED or hide the SKU.
- Product-without-SKU is a separate entity-gap population with Product identity/lifecycle and `sku_count=0`. No canonical severity, costing outcome, or fabricated SKU is assigned.
- Active Product without active SKU is a separate membership fact, overlapping no-SKU where applicable. Do not add overlapping gap counts to obtain distinct Products.
- Sample inclusion/exclusion is explicit and echoed. Neither samples nor inactive entities are silently converted to READY.
- Data load failure is a request failure, not membership absence, empty catalog, or server UNKNOWN.

### Proposed context contract
Initial portfolio assessment is **LIVE_AS_OF only**: explicit governed period from the existing period RPC, server-resolved valuation, null requested refresh-run ID. No browser current-month or caller-supplied valuation override.

The request envelope must echo context type, period, governed valuation, successful evidence run (nullable), its status/context integrity, and server observation time. Every row's canonical context must agree with the envelope. Select persisted driver/outcome evidence by the canonical period+valuation SUCCESS rules, not by substituting the existing snapshot view's per-period selector.

No successful evidence run is a valid assessment context when a governed valuation exists: current master foundations may still resolve/block, while absent downstream evidence remains canonical UNKNOWN or null as currently returned. Missing governed valuation is a context error, not an all-UNKNOWN result or empty queue.

Product identity, lifecycle and current effective foundations remain current; run outcomes remain frozen. New portfolio lookup must not reinterpret EXACT_RUN; current specialist historical readers and the canonical single-SKU EXACT_RUN RPC retain their existing contracts.

One response must be internally consistent under a single database read snapshot. Independent pages/requests may see changing master data. A period/run match alone does not prove unchanged master data. Do not invent a durable master revision token or freeze current master evidence. Echo observation time, treat each response's counts as its own observation, and avoid combining responses into a purported immutable census.

### Proposed retrieval and authority architecture
**Recommendation for later reviewed server package:** a parameterized, authenticated, read-only portfolio read boundary using the **same canonical server composition** as the single-SKU RPC. Exact RPC/helper names and schema/ACL changes are deferred to G3's implementation plan.

| Approach | Contract assessment |
| --- | --- |
| Client invokes readiness once per catalog SKU | Reject for portfolio retrieval: measured N-call cost; duplicate context/read overhead |
| New RPC loops unchanged canonical RPC N times | Authority reused, but demonstrated route work remains repeated; not an acceptable performance solution without proof |
| Current snapshot control views alone | Retain for downstream control visibility; cannot claim full live readiness or include absent/inactive SKU evidence |
| Shared server composition, shared route/global/context evaluation | Preferred proposal: evaluate shared context/route/global policy once per request, reuse governed per-SKU resolvers, preserve all readiness outputs |
| New SQL/JavaScript copy of severity/dependency rules | Reject: creates competing authority |

If factoring shared composition requires changing the single-SKU RPC or internal helpers, that is a high-risk package with separate plan review, rollback evidence and upstream regression tests. G1 authorizes none of those changes. Product route results must retain the existing Active-Product/applicability behaviour, effective family inheritance and original validation authority.

CSE-P01 stays parked. Any bulk optimization must delegate to the existing commercial point-helper consumption without adding a selection rule. Reuse is not proof of deterministic cross-request results for ambiguous source groups. G3 must either prove its access-plan changes do not select a new authority, or stop for a separately reviewed CSE-P01 decision; it cannot waive equivalence or silently settle that backlog. A full deterministic readiness census is not promised while this source authority remains unresolved.

No new persisted readiness table/cache, refresh job, materialized view, tracking queue, or issue-age store is proposed. A schema-free read boundary is the preference, subject to feasibility proof rather than an assumed implementation fact.

### Proposed response and count semantics
All names in this table beyond current canonical fields are **provisional envelope vocabulary**, not live API names or approved schema.

| Component | Required content / semantics |
| --- | --- |
| Context | Explicit LIVE_AS_OF period/valuation/evidence context and observed_at; no monetary values |
| Population | Scope, lifecycle/sample membership filters, assessed SKU count and separate entity-gap counts |
| Page | Bounded server pagination; proposed default 50/max 100, deterministic SKU-ID tie/order; caller cannot disable the bound |
| SKU rows | Product/SKU identity, lifecycle, all five canonical foundation/evidence/outcome dimensions, raw overall_severity, downstream status metadata |
| Dependencies | Code, dimension, applicability, raw/effective status, resolution source, reason/note, server owner/route, authority and evidence IDs |
| Shared issues | Existing global/shared issue metadata deduplicated by authoritative scope/dependency/valuation identity; affected-SKU counts are distinct membership counts, not new defect rows |
| Statistics | Server-produced distinct SKU counts by canonical severity; dependency/owner/route counts with their unit and denominator stated |
| Entity gaps | Product-without-SKU and Active-without-active-SKU facts separately from readiness groups |
| Failure | Explicit request/context/auth/load error; never fabricated zero/READY/UNKNOWN portfolio |

Full assessed-population severity totals precede optional issue filters; matching count and page count are separate. READY + REVIEW_REQUIRED + BLOCKER + UNKNOWN must equal the assessed SKU population when every assessment succeeds. Preserve raw BLOCKED/BLOCKER meanings; dependency statuses do not become independent overall-severity votes.

An unassessed/failed computation is not server UNKNOWN. If complete statistics cannot be computed, the response must fail or explicitly mark statistics unavailable with covered/unassessed counts; it must not return a complete-looking partial census. Returning partial rows requires an explicitly reviewed error contract, not silent row skipping.

Issue filters are limited to existing server dependency/effective-or-raw status, owner and route metadata. Unknown dependency evidence remains visible. RESOLVED/READY and NOT_REQUIRED are not remediation tasks. No client computes a first-live-blocker scalar, weighted urgency, age, severity, or priority. Current downstream first_control_status remains a distinctly labelled frozen control field.

Dependency counts count distinct SKU+dependency incidences. Owner/route distributions count distinct affected SKUs per owner/route; one SKU can appear in several buckets, so bucket totals need not equal population. Regional row counts (SKU+region) remain distinct from SKU counts. Shared/global issue counts remain distinct issues plus distinct affected-SKU impact. No Product-wide READY is introduced.

All counts must be scoped to the explicitly echoed membership and observed database snapshot. Full canonical totals remain **not obtained** at G1: this section defines their proposed contract, not their measured values.

### Proposed permission and payload boundary
- Reuse the canonical readiness visibility rule: authenticated actor with Manage Products view OR Costing Control Center view. A new portfolio endpoint still requires explicit authorization review before any grant.
- The existing Control Center page continues requiring its module permission. This proposal does not give Product-only users a Control Center launch route or monetary costing access. G2 decides whether/where a nonmonetary consumer is needed.
- Public payload contains readiness/status/owner/route/evidence-reference metadata only; no rates, price/margin figures, salaries, allocations or acceptance monetary evidence. Inspect every returned field in G3/G4, including nested arrays.
- No direct authenticated grants on internal composition/resolver helpers. If a controlled SECURITY DEFINER wrapper is necessary, review fixed search_path, explicit auth/module checks and deny PUBLIC/anon EXECUTE. Do not add it just to mask a permissions error.
- Portfolio visibility grants no activation/edit/acceptance/refresh rights. Destination access and writes remain governed independently.
- SEC-P02 direct Marketing-view reuse remains excluded pending separate exposure/policy audit. Canonical nonmonetary Marketing status/eligibility/reference metadata can be reused under the existing controlled composition.
- Read-only audit-role SQL is not proof of view-only or denied-user application access; later authenticated tests must cover both.

### Proposed performance and verification criteria
Candidate review targets, **not existing or approved SLAs**: p95 server execution <=3 seconds for a 100-row page and <=5 seconds for complete selected-population statistics, at current 1793-SKU scale; capture cold/warm observations and bounded concurrency in an approved test environment. G3 may revise these targets with measurements and explicit review.

Require query-plan proof that route/global/context evaluation is shared, not repeated per SKU; measure actual buffers/CPU/query work as well as response time. No production-wide load benchmark in this planning gate. If safe criteria cannot be met, narrow the deliverable explicitly rather than mislabelling snapshots/partial rows as full readiness.

Later verification must establish:
1. Canonical equivalence for all dimensions, dependency applicability/status/owner/route/evidence IDs and downstream context, using the same data observation. No independent aggregation precedence.
2. Representative READY, REVIEW_REQUIRED, BLOCKER, missing-run UNKNOWN dimensions, inactive/sample/parent states, no-SKU Product gaps and overlap of gap counts.
3. Single-SKU LIVE_AS_OF and EXACT_RUN regressions, including Run114 immutability, Run115 evidence and failed Run116 exclusion; Manage Products/WP03 contracts unchanged.
4. Deterministic pagination identity and no duplicate/missing SKU within a stable test dataset; changing-data observations not claimed immutable.
5. Complete statistics reconcile to population; distinct dependency/owner/region/global counts cannot inflate SKU totals.
6. Missing governed context, missing evidence, RPC timeout and permission failure remain distinguishable; no fallback-to-READY/UNKNOWN or zero counts.
7. Authorization for Product-only read, Control Center read, view-only, denied/anonymous actors; no financial leakage or specialist write rights.
8. Ambiguous commercial source groups explicitly covered. Equivalence tests must not silently select a latest row or exclude affected SKUs to pass.
9. Route inheritance, all seven driver families, NOT_REQUIRED regional absence and raw/effective acceptance remain canonical.
10. Targeted nonproduction tests may use fixtures for absent/global-error states; no production mutations to manufacture cases.

### Review checklist and remaining decisions
The independent G1 review must accept/correct population, context, count grains, payload allowlist, authorization proposal and performance criteria. It must assess whether the commercial ambiguity permits a same-authority implementation proposal, and identify any separate prerequisite decision. It must not lock CSE-P01, Marketing placement, first-blocker/age logic or a new top-level module.

**G1 closure requirement:** reviewed contract proposal and classified unresolved dependencies, not a claimed deployed RPC or invented full census. G2 then addresses existing-surface placement/remediation architecture. G3 must resolve implementation feasibility and explicitly review any high-risk server package before G4. Keep review and implementation as separate gates.

Classification: REQUIRED NOW — this contract proposal and supporting bounded evidence; FUTURE DEPENDENCY — G2 placement, G3 feasibility/package and G4 measured census; HIGH-RISK — shared-composition/RPC/ACL plan; PARKED — existing CSE-P01, SEC-P01/02, UX/NAV findings unchanged; OUT OF SCOPE — authority selection, central/bulk writers, lifecycle policy, new module and production repair.

## Approved design / contract
None. G1's contract proposal is ready for independent review; it is not approved for server/client implementation. CHANGELOG_DECISIONS.md unchanged.

## Proposed gate sequence
The original skeleton had unnumbered audit, contract, implementation, focused verification, independent audit, merge and handover milestones. The sequence below refines it because the audited full-live contract/performance gap needs explicit contract, IA and package gates; conditional server work remains separately reviewed.

| Gate | Scope/status |
| --- | --- |
| WP04-G0 — Entry criteria / current-state audit | [x] COMPLETED AND VERIFIED at audit/documentation level |
| WP04-G1 — Portfolio readiness contract | [~] Proposal and bounded supporting evidence documented; independent contract review required to close; no implementation |
| WP04-G2 — Control-centre information architecture / remediation model | [ ] Compare reuse/embedding, specialist and Marketing placement, proven navigation; design review, no implementation |
| WP04-G3 — Server/client package decomposition | [ ] Exact files/contracts/tests; separate high-risk plan approval before execution |
| WP04-G4 — High-risk server package, if required | [ ] Conditional; implement only reviewed/approved package, with canonical equivalence/performance/permission proof |
| WP04-G5 — Client implementation | [ ] Bounded reviewed contract; autonomous routine work only where applicable |
| WP04-G6 — Independent implementation audit | [ ] Audit pushed implementation, consolidate corrections |
| WP04-G7 — Authenticated/live verification | [ ] Context, severities, permissions, specialist destinations, performance; no manufactured production test data |
| WP04-G8 — Merge/post-merge closure and final handover | [ ] Explicit approval required; update progress only after verified closure |

## Current Gate
`WP04-G1 — Portfolio readiness contract / plan review`

## Gate Status
[~] IN PROGRESS — PLAN READY FOR INDEPENDENT REVIEW. G0 is completed at audit/documentation level. WP04 remains incomplete; G2 has not started. Branch unmerged.

## Required to close
Independent G1 contract review must accept/correct the proposal and classify unresolved implementation dependencies. Full canonical census remains unavailable and is not substituted with snapshot counts. No new architecture or authority decision is locked.

## Next gate
Immediate action: independent contract/plan review within WP04-G1. After G1 closure: `WP04-G2 — Control-centre information architecture / remediation model`. No implementation before the later reviewed package gates.

## Server changes
None. No production INSERT/UPDATE/DELETE, DDL, migration, RLS/grant, acceptance, refresh request or other writer.

## Client changes
None.

## Tests / verification
- Remote main and local origin/main reconciled to exact entry SHA; WP03 tip ancestor check passed.
- Source audit of mandatory governance files and current consumers; live pg_proc/pg_views/catalog/grants/index audit.
- Read-only master, run, control, driver and queue counts; bounded canonical SKU11/10/42/114 proof.
- Canonical versus snapshot-context selector difference preserved; sample114 demonstrates population/outcome gap.
- Bounded timing as recorded; no full N-call census/load test.
- Documentation diff/whitespace and changed-file scope checked before commit; committed/pushed branch will be independently read back.
- No application tests required for documentation-only change; no new tests mirroring docs.

## Risks and unresolved questions
1. G1 must define which populations are assessed: all existing SKUs, active subset, samples, inactive parents, and separate no-SKU entities. Route readiness currently uses Active Products; G0 does not reinterpret inactive lifecycle results.
2. Can server retrieval share route/global-policy/context evaluation and preserve exact single-SKU equivalence without rebuilding business rules?
3. How should full LIVE_AS_OF dimensions be paired with persisted outcomes and missing-run coverage, with explicit current-success selector differences?
4. No canonical first-live-blocker scalar/priority or readiness issue-age authority exists; any proposed rule needs review.
5. Marketing acceptance has distinct permissions and monetary evidence; SEC-P02 must be considered before direct view reuse.
6. Existing partial route maps do not establish full WP01 navigation continuity.
7. Snapshot READY is not live READY; absence is not READY; failed refresh must not erase last-success proof.
8. Performance measurement is bounded and single-user; no approved SLA, concurrency proof or full census yet.

## Parked discoveries
SEC-P02 added to PARKED_BACKLOG.md; existing items unchanged. No new decision approved.

## Exit criteria / final handover
WP04 is not complete. G0 is preserved; G1 proposal and evidence are documented for independent review. The unmerged audit branch contains documentation only. No tag/release/merge or branch cleanup.

Workflow: audit → contract/plan review for high-risk → package decomposition → approved implementation → independent audit → authenticated verification → explicit merge/post-merge closure.
WP progress: G0 closed at audit level; G1 proposal ready for review; G2 onward not started.
Programme progress: 4 of 13 unchanged.
Current gate: WP04-G1 plan review, in progress.
Next: independent G1 contract review; then G2 placement/remediation model after G1 closure.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02.
Locked: server readiness authority, lifecycle separation, fail-closed evidence, governed context, specialist ownership and no new top-level module without later IA evidence.
