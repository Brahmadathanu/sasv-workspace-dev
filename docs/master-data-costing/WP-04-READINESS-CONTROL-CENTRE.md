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

At proposal checkpoint c2fe3b9, this section was PLAN READY FOR INDEPENDENT CONTRACT REVIEW. The review and superseding corrections below now close G1 at requirements/design-review level. No server/client implementation package is approved or deployed; G2 has not started.

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

## WP04-G1 — Independent contract review and closure (2026-10-02)

### Evidence and review result
Reviewed pushed proposal `c2fe3b9b9c58b9144c48f68794e1bfe8b3204a4d` against current main, IMPLEMENTATION_RULES, locked DEC-002/003/004/006/007/008/009/010/011, WP01's implemented contract, WP03's closed upstream contract, and fresh live definitions.

Fresh fetch: main `47dcd80f69ca68fcca8f089bf40fa4099b376450`; branch tip matched the proposal. Live public readiness RPC, enrichment, shared-issue helper and commercial point-helper bodies match the G0 definition files after trailing-newline normalization. September governed valuation remains 2026-09-10, successful evidence Run115. No upstream implementation change or regression is established.

**Result: PASS AFTER DOCUMENTATION CORRECTIONS — G1 COMPLETED AND VERIFIED AT REQUIREMENTS/DESIGN-REVIEW LEVEL.** This closes the contract-definition gate only. It does not approve an RPC, refactor, grant, production change, complete deterministic census, or implementation package. G2 is next and has not started.

### Corrected contract requirements (supersede ambiguous proposal wording)
| Review area | Finding and required correction | Disposition |
| --- | --- | --- |
| Authority composition | Sharing inputs is not sufficient if portfolio and single-SKU paths copy dependency/severity rules independently | One common server composition for both readers is required if factoring is used. The single-SKU RPC remains the public compatibility boundary; no duplicated CASE/precedence implementation. Exact factoring/access strategy needs G3/G4 review |
| No successful run | Canonical RPC returns base dependencies and shared_issues=[] without enrichment when no matching SUCCESS exists | Preserve that exact call path. Computing shared/global issues or driver/scheme/regional dependencies for this mode would change behaviour and needs a separate authority decision; no synthetic UNKNOWN dependency rows |
| Snapshot versus live control | Public snapshot wrapper can overlay DL route control and uses a different run selector | Portfolio must use canonical downstream_control semantics; do not substitute that wrapper or diagnosis into the canonical result. Existing snapshot register remains separately labelled |
| Entity-gap denominator | SKU scope/sample filters cannot sensibly apply to a Product that has no SKU | Each request states a Product membership scope separately from SKU membership. Suggested coupled scopes: ALL Products + all existing SKUs; ACTIVE Products + active non-sample SKUs. Gap totals use the Product scope and are not affected by dependency/owner/route filters |
| Gap overlap | Product-no-SKU and Active-without-active-SKU overlap | Return each named count independently; union totals, if needed, use distinct Product IDs. No arithmetic sum or fabricated Product readiness |
| Statistical coverage | Proposal allowed unavailable statistics but left partial-error behaviour open | Baseline is fail-the-assessment-response on context/auth/resolver/computation failure. No partial successful rows or counts under that response. Membership-only or existing snapshot reads can succeed independently, with their own scope labels; partial-assessment API requires separate review |
| Assessment population versus matches | Population filters and issue filters could be conflated | Echo Product/SKU membership, then assessed_population_count before severity/dependency/owner/route filters, matched_sku_count after them, returned_row_count after pagination. Assess each SKU once in the same response observation |
| State totals | Group counts must not infer a new severity | Count exact canonical overall_severity values, currently READY/REVIEW_REQUIRED/BLOCKER/UNKNOWN. Unexpected/null values are contract errors, not coerced UNKNOWN/READY. Dependency BLOCKED and downstream BLOCKER are preserved independently |
| Owner/dependency/region grains | Counting array rows can multiply affected SKUs | Dependency counts use distinct SKU+dependency; owner/route counts use distinct SKU per bucket; regional counts explicitly use SKU+region; shared issue count uses actual issue identity plus distinct canonical affected-SKU references. No summed bucket total advertised as unique affected SKUs |
| Shared issue identity/impact | scope+dependency+valuation alone could collapse different authorities/evidence | Dedup preserves authority and evidence_ids in addition to scope/code/context. Only SKUs whose canonical shared_issues contain that issue count as affected; do not assume every catalog SKU is affected |
| Raw/effective semantics | Outer regional dependency status is itself a canonical aggregate, while nested regional evidence has raw/effective acceptance detail | Preserve both exactly as emitted. Do not replace the outer raw_status with a separately calculated region status or rewrite raw evidence after acceptance |
| Financial payload | Allowlisting field names does not prove arbitrary note text is nonmonetary | G3 must audit nested notes/evidence content as well as fields against the existing narrow boundary. No direct full monetary queue payload, no client-only redaction. If canonical-equivalence and nonmonetary scope conflict, stop for separate review rather than silently dropping fields |
| Authorization | Existing single-SKU OR rule does not itself approve a new bulk endpoint grant | Retain it as the candidate least-privilege read rule, subject to explicit bulk endpoint/access audit at G3. No new launcher/module permission, no direct internal resolver grants, no costing/write access from Product readiness |
| Performance | Sharing route evaluation demonstrably addresses repeated cost, but does not prove full-population statistics meet 5 seconds | <=3s page / <=5s statistics remain provisional engineering goals only. Measure the full query work including pre-filter population statistics. Changing page size does not remove full-count work; G3 must show feasibility or propose a reviewed scope/target adjustment |
| Paging consistency | A context/run match does not freeze current master data | One response's count+rows share its read snapshot. Separate responses may differ; no immutable traversal or cross-request total guarantee. Server pagination bounds and stable ID order remain required on a stable dataset |

Suggested coupled population values are requirements vocabulary, not approved RPC arguments. Product and SKU scopes must be echoed explicitly even if G2 presents one combined selector. Product-master-only access remains nonmonetary; Control Center module access stays separately governed.

### CSE-P01 review — explicit implementation constraint
A fresh bounded **all-candidate** call to `fn_resolve_sku_commercial_sales_basis_point(1795,2026-09-01,2026-09-10)` returned:
- 5 candidates with commercial_sales_status=OK, SYSTEM source, positive cleaned sales note;
- 1 candidate with commercial_sales_status=DEFAULTED, SYSTEM source, governed new-product-default note.

No candidate was selected. This proves commercial evidence-class variation, not necessarily variation in the final overall severity: inactive-parent route/foundation blockers can dominate the SKU's overall result.

The proposal's same-authority principle is valid, but **unchanged helper name or unchanged input data does not guarantee identical LIMIT 1 row under another access plan**. An ordering/index/refactor/context filter can change the selected evidence without an explicit business decision. Therefore:
1. Do not claim an exact reproducible full census while this ambiguity is unresolved.
2. G3 must separately describe the commercial call site and compare candidate sets, the consumed canonical status/source/reason and any tested plan effects. Same-statement parity alone is necessary evidence, not proof that unordered selection has a governed authority.
3. No latest-run/latest-row selector, new ambiguity severity, row exclusion, or deduplication of competing commercial source rows is approved here.
4. If a proposed portfolio implementation requires choosing such a source or cannot satisfy the equivalence/non-selection requirements, stop that server package and bring an explicit CSE-P01 evidence-governance proposal to review. CSE-P01 remains parked; it is not solved or automatically reassigned to WP04.
5. G2 may design the existing-surface information architecture without deciding this source. It must label full live portfolio functionality as conditional on server feasibility; no snapshot-only substitute may be declared full readiness.

This is a classified implementation dependency, not a reason to reopen WP03 or manufacture production data. G1's accepted requirements do not certify that a compliant performant server package already exists.

### Accepted G1 requirements for G2/G3
- Preserve all existing canonical lifecycle, context, dependency, multidimensional summary, acceptance, shared-issue and downstream-control semantics; no second readiness authority.
- Explicit all-existing and operational membership capability, with inactive/sample entities retained through an explicit scope choice; no-SKU Products remain separate entity gaps.
- LIVE_AS_OF only for the initial portfolio reader; governed period/valuation and null requested run; historical EXACT_RUN remains unchanged.
- Bounded server retrieval, explicit count grains/coverage/context and fail-closed request errors; no client severity/first-blocker/age calculations.
- Nonmonetary readiness visibility; current module and specialist write boundaries retained; SEC-P02 prevents direct Marketing view reuse without separate audit.
- Route/global/context sharing is a recommended implementation investigation, not a selected/approved refactor. Names, grants, schema, internal helpers, performance feasibility and CSE compatibility require the G3 high-risk package review.
- G2 compares existing Control Center reuse/embedding and specialist Marketing placement. No new top-level module or canonical route URL map is authorized.

No new business/evidence/security decision is locked by this review; CHANGELOG_DECISIONS.md remains unchanged. Accepted requirements largely specialize the existing locked invariants. Unresolved access/implementation choices are explicitly not represented as approved.

### Review verification
- Remote main/branch reconciled before review; no moved-main overlap.
- Live canonical/helper definition comparison: unchanged from G0.
- Bounded commercial candidate-class proof and period/run read completed with read-only transactions and 10-second timeouts.
- Population arithmetic from G1: SKU partitions total 1793; no-SKU Product partitions total 516. Counts are not new readiness totals.
- Authority, no-run call path, exact-run non-substitution, severity/count grains, permission boundaries and existing route limitations cross-checked.
- Documentation-only diff/whitespace and remote committed read-back are required before reporting this closure.
- No production changes or full readiness census; no application implementation/tests in this review.

## WP04-G2 — Information architecture / remediation model proposal (2026-10-02)

At proposal checkpoint `ea0349a`, this section was **DESIGN PROPOSAL READY FOR INDEPENDENT REVIEW**. The independent review and superseding corrections below now close G2 at requirements/design-review level; implementation remains unapproved. This section proposes placement and interaction boundaries using the reviewed G1 requirements. It does not lock a new architecture decision. G0/G1 counts are dated evidence, not a fresh live census.

### Entry reconciliation and source evidence
Fetched remote main and the documentation branch before design work. Main remains `47dcd80f69ca68fcca8f089bf40fa4099b376450`; branch entry is `e9649f1c3fbc34bbbb5dadb71796b8f15e75b849`. Working tree was clean. WP03 remains closed with no demonstrated regression.

Current-main `costing-suite-registry.js` declares three Control Center lenses: Dashboard, Control Workbench and SKU Control Status. `costing-suite-control-center.js` explicitly allows those same three and loads existing dashboard/control snapshot views. Its selected SKU detail includes supplemental current material-foundation diagnosis; this is not a substitute for the complete canonical readiness contract. `costing-suite-recommended-ui-route.js` proves only selected Stage05 route mappings and context handling. Existing Cost Sheet Review hosts QC/MS queues; Pricing Policy Manager hosts MRP/policy and commercial-assumptions work; Cost Build Manager hosts shared driver governance. No code or database definition was changed or newly deployed for this design.

### Placement comparison
| Candidate | Evidence and consequence | G2 recommendation, pending review |
| --- | --- | --- |
| Extend existing Costing Control Center | Existing portfolio control, period context, exception follow-up and module boundary | Preferred host; use a distinct embedded live-readiness work area within this module |
| Add canonical columns directly to existing SKU Control Status | Existing rows are persisted control membership with different context selection; 1157 catalog SKUs lacked Run115 control evidence at G0 | Do not silently replace this register or treat its rows as the full catalog; mixing without explicit boundaries would confuse current readiness and frozen control |
| Embed a distinct area beside existing Control Center lenses | Reuses module entry, shell and specialist follow-up without redefining the three existing readers | Preferred internal-lens proposal; user-facing label "Readiness" is provisional, exact lens ID/integration awaits G3 |
| Extend Manage Products into a portfolio costing queue | Product/SKU lifecycle and per-SKU guidance already exist; Product-only permissions differ from costing-module access | Preserve WP03. No duplicate queue or new costing-module access for Product-only users |
| Reuse material/QC/MS queues as the entire readiness centre | Authoritative specialist issues, different grains and limited domains | Keep specialist queues; central visibility may describe their canonical dependency evidence, not merge unlike queue counts |
| New top-level module or launcher tile | Existing central module already available; no evidence of a distinct permission/operational requirement | Not justified. Remains excluded under locked programme IA constraints |

An internal lens is an architecture proposal, not a change authorized by this gate. G3 must identify shell, registry, routing, permission and detail integration changes explicitly. Avoid redesigning the entire Costing Suite or deciding WP05–WP08 navigation ahead of its audits. Retain existing dashboard, material workbench and snapshot register semantics and their navigation.

### Proposed information model and operating journey
1. Enter through the existing authorized Costing Control Center. Select an explicit governed period. The new area identifies itself as current LIVE_AS_OF readiness, shows server valuation/observation time and nullable successful evidence run, and explains that downstream outcome evidence is persisted. Requested run remains null.
2. Default proposal: **Active Products + Active non-sample SKUs**, all severity groups visible. An explicit **All existing SKUs** selector includes inactive and sample entities; membership is server-resolved and echoed. Lifecycle is visible, not translated into severity. At G0 these scopes were 611 and 1793 SKUs respectively; these figures must never be hard-coded as current totals.
3. Show server-supported totals with explicit units, scope and coverage; never derive portfolio totals from the current page. Present READY, REVIEW_REQUIRED, BLOCKED/BLOCKER and UNKNOWN without converting raw codes. A display grouping of BLOCKED/BLOCKER requires the server contract to retain their raw values and define the counted group. Unavailable is a separate request condition, not another server severity.
4. Use a bounded paginated SKU list. Compact default fields: Product/SKU identity, both lifecycle states, overall canonical severity, and the five canonical summary dimensions. Period/context are prominent at area level and checked against rows. Owners/routes are potentially plural: show dependencies in detail, not a client-picked "first blocker". No weighted urgency, issue age or guessed assignment. G3 determines whether safely supported owner/dependency filters can be provided server-side; absent aggregate support, omit the filter rather than scanning N canonical calls in the browser.
5. Selecting a SKU opens read-only detail: canonical context; multidimensional summary; dependency code/status/reason/owner/route/evidence references; shared issues with distinct grain; and canonical downstream control with its evidence run. Keep the supplemental current material diagnosis separately labelled if retained. Do not replace canonical downstream control with the snapshot view or add up shared issues as unique affected SKUs.
6. Choose a severity or dependency filter to focus follow-up. This is visibility, not approval or scheduling. Default stable pagination/order and aggregate count contract are server package requirements, not browser business logic. Pagination responses are individual observations; do not promise an immutable census across page loads.
7. Show **Product coverage gaps** separately from assessed SKU rows. Product-without-SKU and Active Product-without-active-SKU are distinct overlapping membership facts; use server-provided Product identities/counts and explicitly show the selected Product scope. No fake SKU or READY/UNKNOWN badge for a no-SKU Product, no addition of overlapping gap counts, and no readiness-gated activation. Existing Manage Products guidance remains the remediation anchor; no new Product URL is invented.
8. Follow up in the owning specialist surface only when an exact route/context mapping and permission boundary are proven. Otherwise show the supplied owner and route as text. Return/refresh uses a fresh server assessment; successful specialist save alone does not make the central row READY.

This is a requirements-level layout, not a wireframe or implementation freeze. Rich outcome amounts, cost-sheet calculations, cost approval and refresh control remain existing specialist/control surfaces. The proposed readiness area is nonmonetary. Existing snapshot surfaces may continue operating independently when readiness is unavailable, under their own labels and permissions; they cannot be presented as a fallback live assessment.

### Prevention, guidance, visibility and remediation boundaries
| Boundary | Proposed WP04 behaviour | Excluded behaviour |
| --- | --- | --- |
| Prevent | Preserve current server validation and existing lifecycle rules | New required fields, Product defaults, activation gates or changed evidence rules |
| Guide | Explain canonical dependency, evidence context and supplied owner/route; reuse proven destination continuity | Client-generated remedy/business rule or invented link |
| Central Visibility | Bounded cross-SKU assessment, explicit context/coverage and read-only detail; separate Product gaps | Persisted issue tracker, new readiness authority, dashboard-generated Product-wide READY |
| In-module remediation | Existing Control Workbench continues its governed material acceptance actions in its current surface | Generic edit/accept button in readiness detail or calling writers from the new queue |
| Specialist remediation | Existing BOM, batch, route, pricing, driver, QC/MS and lifecycle workflows retain writers and authorization | Central editing of specialist evidence or inferring that Control Center edit grants specialist edit |
| Bulk remediation | None in WP04 proposal | Multi-select acceptance, bulk activation, automated repair, assignment, comments, reminders or new jobs |

"Central remediation" here means finding unresolved dependencies and guiding an authorized user to the owning workflow. It does not create a central write authority. Existing per-module mutations are unchanged and remain subject to their original eligibility, period/evidence and permission checks.

### Specialist exposure and navigation
| Domain | Safe central evidence under reviewed nonmonetary allowlist | Remediation/navigation boundary |
| --- | --- | --- |
| Product/SKU master | Identity, lifecycle, canonical foundation status/reasons | Existing Manage Products anchor; do not duplicate WP03 editors or invent deep links |
| PM BOM, batch size and production route | Canonical dependency status, owner, route and bounded reference/context metadata | Existing specialist owners. Stage05 PRODUCTION_ROUTE_MANAGER mapping does not prove an alias for every WP01 route |
| Material rates/review | Canonical dependency and downstream supplied control evidence | Existing MATERIAL_RATE_REVIEW mapping can be evaluated for reuse only with its exact required context; MATERIAL_RATE_MANAGER depends on proven blocking-line context |
| MRP, selling/scheme and common/regional assumptions | Canonical status/reasons and nonmonetary evidence identifiers | Pricing Policy Manager writers remain there; existing pricing-review mapping is not proof for all canonical route codes |
| QC / Materials & Stores | Canonical status, reason, owner and reference metadata | Existing Cost Sheet Review queues; preserve Product-grain QC vs SKU-grain MS and module permission |
| Shared driver governance | Canonical shared issue/evidence context with its own count unit | Cost Build specialist workflows; no central driver overrides or inflated per-SKU issue counts |
| Regional Marketing evidence | Canonical review/eligibility/reference metadata only after nested-field/text allowlist review | Descriptive visibility now; acceptance remains a separately gated specialist capability |

G2 adds no route mappings. Existing Stage05 helpers are evidence, not blanket navigation authorization: a mapping must match the exact canonical route, required IDs, period/evidence continuity and destination permission. No automatic COST_APPROVAL_WORKBENCH/COST_REVIEW_WORKBENCH alias, no guessed PM/BATCH/MRP/Marketing URLs. Unsupported or permission-denied destinations remain owner/route text with no enabled navigation. G3 must freeze the exact supported subset; NAV-P02 remains parked.

### Regional Marketing placement recommendation
UX-P01 remains unresolved until this proposal is reviewed. Recommend central **descriptive visibility** of canonical Marketing evidence dependencies and eligibility; defer a new acceptance editor to a reviewed specialist package in WP05–WP07 unless those audits explicitly assign it earlier. The existing server acceptance contract's Control Center edit permission makes an eventual specialist work area within the current Control Center a candidate, not an approved placement or authority to add a writer in WP04.

Do not put evidence acceptance into the existing regional commercial-assumptions queue merely because both are regional. Their evidence, eligibility, run/SKU/region identity, fingerprint and required-reason semantics differ. The 222 Run115 acceptance rows across 146 SKUs and zero assumption-action rows at G0 demonstrate different populations, not a live queue to copy. No acceptance totals are added to SKU severity counts.

SEC-P02 excludes direct reuse of the monetary regional review view until its dedicated exposure/policy audit. Canonical reference metadata is the preferred read path, subject to G3 allowlist review of nested fields and free text. No view reuse, grant, RLS change, acceptance call or production mutation is approved. This is a placement recommendation; PARKED_BACKLOG and CHANGELOG_DECISIONS stay unchanged pending review.

### Authorization and unavailable states
- Existing Control Center module view permission governs entry. Product-only readiness authorization continues in Manage Products and does not grant this module, costing amounts or other specialist routes. A prospective server bulk read permission remains subject to explicit G3 review, not inferred from launcher visibility.
- View-only users receive read-only readiness detail. Control Center edit does not authorize specialist writers. No new edit control is introduced by this proposal; existing module controls retain their enforcement.
- G3 must audit nested payload/free-text content and server enforcement, including Product-only endpoint callers if a shared permission boundary is proposed. Client redaction alone cannot create a secure nonmonetary read contract or silently alter canonical semantics.
- No session/permission: existing access boundary applies; no catalog leak or empty READY queue. Missing governed context: context error. RPC/network/parse/row-context failure: assessment unavailable, explicit retry; discard that assessment response rather than fabricate UNKNOWN, zero counts or a partial-success census.
- Server-returned UNKNOWN remains visible and distinct from unavailable. No-success-run assessments preserve the canonical early-return dependency/shared-issue path. No run substitution, synthetic missing-driver rows or disappearance of absent snapshot SKUs.
- On scope/period change clear prior assessment display while loading. If stale evidence is retained for a user-facing reason, it must be visibly labelled with its original scope/context and cannot count as the current assessment. No automatic refresh job or persisted cache is proposed.

### Classification and G3 feasibility checkpoint
**REQUIRED NOW:** independent review of this placement/default-scope/detail/remediation proposal and its authority boundaries.

**FUTURE DEPENDENCY:** G3 exact server/client packages, shared-composition feasibility, read-contract allowlist, permission plan, supported navigation subset, pagination/count grains and performance/equivalence tests. Full live functionality is conditional on that proof. If no compliant performant server package can be proposed, report the blocked capability rather than relabel snapshots as live readiness.

**HIGH-RISK:** any internal composition/RPC/ACL change, internal lens/shell integration or cross-module navigation package; separate plan review before execution. CSE-P01 ambiguity can block a proposed optimization: same unordered helper call does not certify the same selected source under a changed plan. No new source selector is approved.

**PARKED:** UX-P01 specialist acceptance placement awaits review/later audits; UX-P02, NAV-P01/02, CSE-P01, SEC-P01/02 retain their existing assignments. No new parked discovery in G2.

**OUT OF SCOPE:** new top-level module/launcher, monetary readiness payload, specialist/bulk writers, production repairs, issue age/SLA/weighted priority, security cleanup, Product lifecycle redesign, WP03 aesthetics and broader Costing Suite rationalisation.

### Review closure criteria and exact checkpoint
Independent review must accept or correct: existing-module reuse vs replacement, separate current/frozen/gap populations, operational default plus all-existing scope, read-only detail/count semantics, exact-route safeguards, Marketing visibility/deferred acceptance, authorization/unavailable boundaries and conditional G3 feasibility. Reconcile remote main/branch again before review. Do not mark G2 complete merely because this proposal is committed.

No implementation package is frozen here. After reviewed G2 closure, the next numbered gate is WP04-G3 — Server/client package decomposition. The immediate next checkpoint is **WP04-G2 — Independent information-architecture/remediation-model review**.

## WP04-G2 — Independent proposal review and closure (2026-10-02)

Reviewed the pushed proposal at `ea0349a59ef37ae5cbae1dbe5a7e6415343e4929` in a separate review pass against G1's superseding corrections, IMPLEMENTATION_RULES, MASTER_PROGRAMME, decision locks, parked boundaries and current-main client source. Remote main/branch were fetched first and match the documented main and proposal tip. No additional agent or live Supabase query was used; this is an independent review checkpoint, not a claim of separate-person review or fresh database verification.

**Result: PASS AFTER DOCUMENTATION CORRECTIONS — G2 COMPLETED AND VERIFIED AT REQUIREMENTS/DESIGN-REVIEW LEVEL.** Existing-module reuse is accepted as the direction for G3 planning. The exact lens/integration/API/permission implementation remains unapproved. No code or production changes are authorized by this closure. The corrections below supersede ambiguous proposal wording.

| Review area | Accepted requirement / superseding correction |
| --- | --- |
| Placement | Plan a separate embedded readiness area within the existing Costing Control Center; retain its three existing surfaces and default entry. Exact internal lens identifier and shell integration require G3 package review. No new top-level module, launcher or Manage Products portfolio queue |
| Overall states | G1's exact current overall values are READY, REVIEW_REQUIRED, BLOCKER and UNKNOWN. Show/count those raw values. G2's wording about a combined BLOCKED/BLOCKER overall group is not approved: dependency BLOCKED and downstream BLOCKER remain their own supplied fields; unexpected/null overall values are contract errors, not coerced states |
| Population scopes | Operational default: Active Products with Active non-sample SKUs, plus **Active Product** gap population. All-existing option: all Products with all existing SKUs including inactive/sample, plus **all Product** gap population. Echo both scopes separately. SKU sample/severity/dependency filters never remove no-SKU Products from their Product denominator |
| Gap facts | Report Products-without-SKU in the selected Product scope. Report Active-Products-without-active-SKU as an explicitly Active subset of that scope. These facts overlap and are not summed; inactive Products with only inactive SKUs are not invented as Active-Product gaps. No severity on Product gap rows |
| Counts and filters | Full assessed-population totals precede issue filters; matched SKU count follows supported severity/dependency/owner/route filters; returned row count follows pagination. Gap counts remain independently Product-scoped. Owner/dependency filters are conditional on approved server support; the journey's "choose a dependency filter" is not a guarantee of an existing contract |
| Governed period integration | Existing shell period selection is snapshot-oriented, not a proven governed-period reader. `loadAvailableCostingPeriods` reads dashboard snapshot periods; `resolveActivePeriodStart` can fall back to calendar current month. G3 must define an explicit validated readiness period path and error handling without inheriting those fallbacks. Manage Products uses `rpc_get_latest_governed_cost_period_start`; that proves latest-period reading, not a complete arbitrary-period catalog. Any missing governed-period listing contract is an explicit server-plan question, not invented in JavaScript |
| Current versus frozen evidence | Preserve canonical LIVE_AS_OF context and period+valuation successful evidence semantics. Existing snapshot control selection and supplemental material diagnosis remain separate. No-success-run canonical early return remains intact; no synthetic enrichment or run substitution |
| Route continuity | Stage05 mapping is partial and does not itself check destination permissions. Its production-route/pricing mappings do not preserve every period/run identity. G3 must inspect each candidate's required context and destination permission before enabling it; non-proven routes stay text. No new map, alias or URL is approved here |
| Payload and access | Control Center view governs module entry; Product-only users retain Manage Products. Candidate bulk read permission requires G3 review. Audit nested metadata and free text server-side; conflict between exact canonical equivalence and nonmonetary scope requires review, not silent field removal or client-only masking |
| Detail and asynchronous loads | Read-only dependencies may have several owners/routes. Do not pick a new first-live-blocker. Scope/period/filter changes must invalidate pending responses; a delayed response cannot populate the new context. Clearing the screen alone is insufficient. Separate current/frozen cache identities and existing specialist details must remain unchanged |
| Unavailable | Fail the assessment response on context/auth/resolver/parse/context-integrity errors. UNKNOWN is only a valid server state. Independently successful snapshot or membership reads retain their own labels and cannot stand in for readiness |
| Marketing | Accept descriptive visibility of reviewed canonical nonmonetary evidence. A new acceptance editor is excluded from the WP04 package; UX-P01 specialist placement remains for WP05–WP07 audit unless separately reassigned. Existing acceptance permission is evidence of a candidate host, not a final placement decision. SEC-P02 still blocks direct view reuse |
| Remediation | Visibility and proven navigation only in the new area. Existing specialist/material workbench writers remain where governed. No bulk repair, central accept/edit, activation gate or issue tracking |
| Feasibility | G3 must prove performant canonical composition, full-count work and CSE-P01 compatibility. This design closure does not certify implementability. If those cannot be satisfied, stop the affected package and report its dependency; do not substitute snapshot readiness or resolve commercial source authority silently |

### G3 planning input and stop conditions
Carry the accepted G1 requirements and corrected G2 direction into an exact server/client package plan. Identify affected contracts/files, context and Product/SKU scope resolution, response/count/error vocabulary, server payload allowlist, access checks, per-route proof, regression/performance criteria and rollback strategy. Separate high-risk server implementation from the client package and identify which client integration changes require architectural review.

Specifically audit the governed-period read path, shell lens allowlists/render/load dispatch, stale-response protection, and full-population statistics work. Do not broaden the three existing control surfaces merely to accommodate readiness. No financial/specialist writer surface is added by implication.

CSE-P01 and SEC-P02 retain their parked governance boundaries. They are implementation constraints where touched, not reasons to modify them in G3. No completed live census, deterministic commercial row authority, new API, ACL or production fix is claimed. G3 is planning only; no G4/G5 implementation before independent package review.

### Review verification and decision treatment
- Proposal commit, unchanged main, clean branch entry and WP03 ancestor checked.
- Registry, route config, shell period/permission dispatch, partial route helper and Manage Products governed-period consumer cross-checked against current main.
- G1 statistical coverage, exact severity, Product-gap scopes and source/permission constraints reconciled.
- Review corrections and gate ledger recorded; documentation whitespace/scope checks and exact pushed-file read-back required before reporting closure.
- No application tests or authenticated browser verification claimed; no new live reads, server/client implementation or production mutation.

These are accepted planning requirements/direction, not a permanent new architecture/business/security lock. CHANGELOG_DECISIONS remains unchanged. PARKED_BACKLOG remains unchanged: Marketing editor placement is still open, and the period integration finding is a required G3 dependency recorded here, not a newly parked enhancement.

## WP04-G3 — Server/client package decomposition proposal (2026-10-02)

At proposal checkpoint `5f3aa07`, this section was **PLAN READY FOR INDEPENDENT HIGH-RISK PACKAGE REVIEW; NOT IMPLEMENTATION APPROVED**. The independent review and superseding corrections below now close G3 at package-planning level only; production/client execution remains unapproved. This is an exact candidate package boundary, not deployed APIs or certified performance. G0/G1/G2 remain complete at their documented levels. Do not execute the proposed server/client changes from this plan without the next review checkpoint.

### Entry and fresh bounded evidence
Fetched main and the documentation branch before work. Main remains `47dcd80f69ca68fcca8f089bf40fa4099b376450`; branch entry `f08b82b58ae6965dbc86cfa271279aad0180fa85` is clean. WP03 remains closed. Supabase and Supabase Postgres Best Practices skills were read before live/query work. All live queries used read-only transactions and 10-second statement timeouts.

Live canonical readiness, latest-governed-period, route readiness, commercial point resolver, enrich, run-evidence and shared-issue definitions exactly match the G0/G1 captured definitions. Canonical definition MD5: `0e966c3c1ab15d56420b234f5c2cef1f`; commercial point resolver MD5: `68bd9325062299eb8af1291bf4d9393b`. This checks architecture drift, not fresh readiness population totals.

| Fresh finding | Package implication |
| --- | --- |
| Governed cost-period rows: Sep2026/2026-09-10, Aug/2026-08-07, Jul/2026-07-22, Jun/2026-06-30, Mar/2026-03-31; bounded latest-24 read | Select periods from cost_periods via controlled metadata read, not snapshot membership or browser calendar |
| Authenticated has no SELECT on costing.cost_periods; latest-period RPC has Manage Products OR Control Center view; supplied-period valuation reader has Control Center view | Do not grant table SELECT or widen existing readers. A new controlled period-list reader is proposed |
| Naming audit found latest/valuation/history readers, no governed-period listing or portfolio readiness reader | New read contract is high-risk server work, not a client-only task. Function-name collision check must be repeated before creating candidates |
| Commercial point helper for SKU10/11/42/114/1795, each consumed with LIMIT1: 28.103ms, 1451 shared hit blocks, five function-scan loops, no read blocks | Existing point narrowing remains intact. Small warm sample is not a portfolio benchmark or proof of source choice |
| Cost-period primary key; Product/SKU identities and parent FK; control exact unique index includes period+valuation+run+SKU; commercial snapshot unique run+SKU with separate legacy period+SKU | Existing indexes support identity/membership lookups, but do not establish commercial SKU+period authority across runs. No new commercial index, order, run filter or deduplication is proposed |
| Eight Run115 note categories each have 636 nonblank notes; keyword screen flags 1 control note and 4 QC notes, others 0 | Pattern `(₹|INR|Rs[.]|amount|rate)` is a triage signal, not proof of amounts or absence. No note text was output. Review nested/free text before certifying nonmonetary payload; neither blanket pass nor silent note removal |

Full readiness distributions, concurrency and optimized full-count costs remain unmeasured. G0/G1 population counts are historical observations. No N-call canonical census, broad production benchmark, mutation or branch provisioning was performed.

### Package boundaries and order
| Package | Candidate work | Preconditions / result |
| --- | --- | --- |
| S0 — Nonproduction equivalence/performance proof | Baseline captures and candidate composition in a separately authorized nonproduction environment; no production DDL | Required evidence before production application. Environment does not yet exist in this work session; no Supabase branch/cost accepted or fixture creation authorized here |
| S1 — High-risk canonical composition and portfolio reads | Common LIVE_AS_OF composition, shared route/context/global work, bounded portfolio/gap/period readers and explicit ACLs | Independently reviewed SQL/package plus S0 proof, CSE compatibility, payload/access audit and rollback evidence. Conditional WP04-G4 execution only after authorization |
| C1 — Embedded read-only readiness lens | Reviewed server contracts consumed within current Control Center shell; bounded list, scopes, context, counts, gaps and detail | S1 independently verified and API frozen; G5 client implementation after reviewed client architecture package |
| V1 — Independent implementation audit / live verification | G6 audit; G7 authenticated permission/context/navigation/parity/performance proof | No manufactured production data; existing surfaces and WP03 regressions checked |

This plan does not authorize creation of a paid development branch, installing an unreviewed database, production deployment or independent CSE/SEC remediation. If an adequate nonproduction environment cannot be established, report S0 blocked rather than applying speculative SQL to production.

### Candidate S1 authority composition
Propose **one common internal LIVE_AS_OF evaluator**, candidate name `costing.fn_product_sku_readiness_live_core`. Its typed inputs are SKU, normalized period, governed valuation, nullable selected successful run, trusted route evidence and trusted shared issues. Public callers cannot supply route/shared evidence, valuation or run overrides. It performs the existing BOM, batch, MRP, selling and commercial point lookups and constructs exactly the existing canonical identity/lifecycle/base dependencies/summary/downstream result. Do not copy severity CASE rules into a second portfolio implementation.

The public single-SKU RPC retains its signature, authentication and Manage Products OR Control Center view boundary, normalization/errors and context/run resolution. LIVE_AS_OF delegates to the common core; the existing EXACT_RUN branch and its frozen inputs remain unchanged. The single reader obtains route evidence using the existing route function; portfolio obtains that function's entire result once at the governed valuation and selects the same Product record for each SKU. Preserve Active-Product route membership, missing/null route behaviour and effective family inheritance. No direct filtered replacement of route validation is proposed.

Candidate `costing.fn_product_sku_readiness_enrich_with_shared` extracts the current enrich composition with an internal supplied shared-issues argument. Existing `fn_product_sku_readiness_enrich` keeps its signature and delegates after obtaining shared issues itself, preserving EXACT_RUN/public callers. Both the common live core and the existing enrich wrapper use that one extracted composition. Existing run-evidence helper and scheme/regional status resolution remain their authorities. Shared issues are evaluated once per portfolio response only when a matching SUCCESS run exists. The no-success-run path returns the exact current eight base dependencies and empty shared_issues without enrichment.

Canonical global policy helper intentionally catches resolver exceptions and produces governed BLOCKED issues. Preserve those caught business/evidence states. "Fail the response" applies to unhandled assessment errors, not to rewriting canonical caught exceptions as transport failure.

Context selection is once per response, under one STABLE read observation: normalized requested month, valuation from cost_periods, latest SUCCESS by period+valuation ordered finished_at DESC NULLS LAST then id DESC. Do not use the snapshot wrapper's per-period selector. Keep null requested run, nullable evidence run and canonical run/context integrity values. No changing snapshot writes, refresh executor or historical evidence.

**CSE-P01 implementation stop:** preserve the commercial point-helper body and its existing point inputs and unordered LIMIT1 consumption; do not inline, index/order, deduplicate, select by run/valuation or join the entire commercial view. Moving the call into a common evaluator still changes a call site and is not automatically proven compatible. S0 must compare all candidate sets and consumed canonical status/source/warning on representative ambiguous groups, including SKU1795. Compare candidate outputs in the same observation and inspect execution plans. Successful samples do not confer a governed deterministic source. If the candidate changes consumption or requires a source-selection rule, stop S1 for a separately reviewed CSE-P01 proposal; no implicit authority decision or reproducible full-census claim.

### Candidate public read contracts (names/signatures for review, not existing APIs)
All three new readers return JSONB, are read-only/STABLE, enforce authenticated **Control Center view only** as the proposed boundary, and bound inputs/output. This is an explicit narrowing of G1's candidate OR permission for the *new* endpoints, for review: there is no Product-only portfolio consumer in accepted G2. Existing single-SKU/latest-period OR permissions stay unchanged. No new permission target or grant of module access. Product-only actors must be denied on these candidates while their existing Manage Products reads continue succeeding.

| Candidate reader | Proposed arguments | Response / rules |
| --- | --- | --- |
| `public.rpc_get_readiness_governed_periods` | `p_before_period_start date=null`, `p_limit integer=24` | Latest-first cost_periods metadata: period_start, valuation_date (nullable), next boundary, has_more; hard max100, validate positive limit. Include missing valuation rows explicitly; no skip-to-older-good-period. No remarks/approval/actor monetary-free-text payload needed for this selector |
| `public.rpc_get_product_sku_readiness_portfolio` | `p_period_start date` required; `p_population_scope text='OPERATIONAL'`; optional `p_overall_severities text[]`, `p_dependency_codes text[]`, `p_owner_modules text[]`, `p_route_codes text[]`, `p_search text`; `p_after_sku_id bigint=null`; `p_limit integer=50` | Normalized LIVE_AS_OF context, Product/SKU scope, observed_at, full-population statistics, matched_count, bounded page of canonical payloads and next key. Max100 rows. No caller valuation/run/context override. Each membership SKU assessed exactly once before issue filtering; page fetch includes statistics work |
| `public.rpc_get_readiness_product_gaps` | `p_product_scope text='ACTIVE_PRODUCTS'`; `p_gap_kind text='NO_SKU'`; optional `p_search text`; `p_after_product_id bigint=null`; `p_limit integer=50` | Membership-only response labelled as such, Product scope and observation time, separate no-SKU and Active-without-active-SKU counts, matched_count, Product rows and next key. No period/readiness severity/context claim, no SKU placeholder. Independent read can succeed while assessment fails; do not combine observations into one immutable census |

Proposed scope vocabulary: OPERATIONAL = Active Products + Active non-sample SKUs; ALL_EXISTING = all Products/all existing SKUs. Gap scope is separately ACTIVE_PRODUCTS or ALL_PRODUCTS. Gap kind selects NO_SKU or ACTIVE_WITHOUT_ACTIVE_SKU; counts remain independently named and overlap. The client couples scopes as reviewed in G2 but the server validates and echoes them independently.

Validate population/kind enums, page bounds, nonnegative ID boundaries, filter cardinality (max32 values per array) and search length (max120). Normalize periods exactly as canonical single-SKU does. Overall severity filter accepts only READY/REVIEW_REQUIRED/BLOCKER/UNKNOWN. Unknown overall values in assessment are contract errors; unsupported filter values are request errors, not empty-success coercion. Dependency/owner/route values require a frozen server-supported metadata vocabulary in review; none is invented as client authority. Do not drop UNKNOWN entries to simplify filtering.

Proposed filters: OR within each array, AND across filter categories; dependency/owner/route match applicable unresolved canonical incidences (BLOCKED/BLOCKER/REVIEW_REQUIRED/UNKNOWN using existing effective-or-raw semantics). Never match RESOLVED/READY/NOT_REQUIRED as remediation tasks. This matching contract needs explicit review; it does not change canonical severity. Search is literal case-insensitive Product-name substring or exact decimal SKU/Product ID, with escaped wildcard characters and no financial text search. Empty filters mean no issue filter. Full-population totals ignore issue/search/page filters; matched_count includes them; returned_count follows pagination. Empty population is zero successfully assessed rows only after valid auth/context, not a load error.

Stable keyset pagination orders SKU or Product ID ascending, uses limit+1 only to derive has_more and returns actual returned count. The client keeps prior-page boundaries instead of downloading the full population. Independent pages can observe changes. A request-generation/context key invalidates old responses; no durable master revision token.

Statistics: exact canonical overall-severity counts; dependency incidences by distinct SKU+code; owner/route buckets by distinct affected SKU; region counts explicitly SKU+region; shared issues preserve scope/code/context/authority/evidence identity and affected SKUs only where present in canonical shared_issues. No client aggregation, new severity precedence, age, priority or Product-wide readiness. Return the canonical page payload without field/value reinterpretation after server-side payload audit. Materialize common assessments once per response for counts and page; do not run the full assessor separately for every filter/bucket. Query plans must demonstrate that property, not merely use a CTE name.

Unhandled context/auth/resolver/computation errors fail the entire assessment response; no partial rows, zero totals or fabricated UNKNOWN. Missing valuation is a context error. No-success-run remains a valid canonical context. Period and Product-gap readers have independent error states. No writers, persisted cache, tables/views/jobs or tracking state.

### Exact candidate server artifact scope
- Future CLI-generated migration(s) under `supabase/migrations/` for S1, using installed CLI `--help` / `migration new`; do not invent a timestamp filename in this plan or create a migration now. Separate canonical factoring/ACL from new reader definitions if atomic deployment cannot keep compatibility; review dependency order before execution.
- Capture prechange `pg_get_functiondef`, exact signatures/ACL/search_path/owner and definition hashes in `supabase/rollback-evidence/<actual-generated-prefix>_wp04_pre.sql`. Include canonical RPC and enrich; list every newly created function/signature for rollback. Existing `20261002064432` WP02 evidence is immutable.
- Proposed new test SQL under `supabase/tests/wp04_readiness_portfolio_contract.sql` and performance script/evidence under `scripts/wp04-readiness-server-proof.mjs` (nonproduction/read-only execution boundary documented). Repository currently has standalone smoke scripts, not a package test runner; do not imply these tests already exist.
- After reviewed successful server package, update `supabase/notes/db-changes.md` and affected function types in `public/shared/js/types/supabase.ts` through the existing type-sync process; inspect/limit generated diff to WP04, no blanket unrelated type churn.
- No change to route/commercial/run-evidence/shared-issue source authorities, table grants, RLS, lifecycle writers, refresh/acceptance writers, cost-period mutation or SEC-P01/02 objects.

Security: public wrappers need SECURITY DEFINER only where reviewed internal/table privileges require it; explicit auth.uid plus Control Center view, fixed trusted search_path with pg_temp last and fully qualified objects. Revoke PUBLIC/anon EXECUTE; authenticated executes only public readers, never the new core/enrich internal helpers. No default PUBLIC function execution, schema grants or service-role bypass of actor checks. Preserve existing function ACLs exactly unless separately reviewed. No dynamic SQL based on filter inputs. Catalog/SQL role checks are not authenticated browser/API proof.

### C1 exact client integration scope (conditional on S1)
| File / candidate new file | Bounded change for later reviewed implementation |
| --- | --- |
| `public/shared/js/costing-suite-readiness.js` (new) | Controller/API adapter, validation of frozen response envelope, request generation, keyset boundaries, loading/unavailable/empty states, scopes/counts/gaps and escaped read-only detail; no business severity or financial calculations |
| `public/shared/js/costing-suite-registry.js` | Add one `portfolio-readiness` lens to existing control-center suite; label Readiness, period-scoped; preserve all existing lens declarations |
| `public/shared/js/costing-route-config.js` | Add candidate lens to Control Center allowlist only; dashboard remains default; same module permission and routePath |
| `public/shared/js/costing-suite-shell.js` | Import/controller lifecycle; explicit lens load/render/detail dispatch before generic snapshot handling; delegate pagination/search/filter UI; readiness-specific governed-period selector state; response invalidation on scope/period/filter/lens/selection changes; error boundaries. Do not pass readiness rows into generic monetary detail/diagnosis fetchers or local full-catalog applyFilters |
| `public/shared/costing-control-center.html` | Minimal hidden-by-default readiness context/scope/statistics/coverage containers and read-only detail hooks if existing shell slots are insufficient; show only for the new lens |
| `public/shared/css/sasv-costing.css` | Scoped readiness layout/accessibility styles only if needed; shared visual redesign remains WP11 |
| `public/sw.js` | Reviewed cache invalidation for new/changed readiness assets, one monotonic cache-name increment at client implementation; no change now |
| `scripts/wp04-readiness-client-contract-smoke.mjs` (new) | Executable request/response, race, pagination, error, view-only and navigation-boundary tests with mocks; no writer calls or live fixture mutations |

Keep the new lens outside `isControlCenterLens`'s three existing controller paths unless explicit dispatch guarantees no snapshot fallback. The existing `costing-suite-control-center.js` can remain unchanged with separate readiness controller; do not alter material acceptance or snapshot drawer/cache logic for reuse. Guard read-only detail from generic `fetchSkuDetail`, `fetchSkuSchemes`, `fetchSkuDiagnostics`, calendar-fallback `activePeriodIso` and refresh writers. Keep separate context identities for live assessment vs exact frozen caches.

The readiness lens maintains its selected **governed** period using the new catalog; it must not inherit AVAILABLE_COSTING_PERIODS, snapshot/latest-summary or calendar fallback. Use latest catalog row as visible initial selection only after successful catalog read; server validates valuation. Leaving readiness restores existing lens period behaviour. Product gaps do not imply a costing period and use their membership-only observation label.

Initial navigation package proposal: owner/route text only in the new readiness detail. No new maps or helper edits. G2 permitted proven navigation conditionally; G3 found Stage05 destination/context proof is not complete for this new consumer. Existing Stage05 links on existing snapshot/workbench pages remain untouched. If review requires a supported link subset, freeze each exact code/context/permission/destination journey first in a separate bounded addition. No Product Master deep-link assumption, no costing review/approval alias, no Marketing acceptance control.

No `js/products.js`, Manage Products HTML, launcher registry, `main.js`, version/package/lockfile, permission target or specialist editor change is planned. No new dependency package. PWA cache update is a client artifact change, not authorization to release/publish.

### Verification matrix, feasibility gates and rollback
| Proof | Required evidence before declaring package verified |
| --- | --- |
| Authority parity | Same-observation single vs portfolio JSON for identity/lifecycle/context/all dimensions/dependencies/shared issues/downstream, no-run path and inactive/sample parent cases; exact EXACT_RUN preservation and immutable Run114/115 evidence; failed Run116 excluded |
| Commercial ambiguity | All-candidate sets and consumed status/source/warning for ambiguous groups; unchanged point helper/call semantics and plan review; no latest-row selector. Stop on differences, no exclusion of affected SKUs to pass |
| Statistical correctness | All-existing/operational memberships, SKU totals and each separate gap count; overlap; filters vs population vs returned counts; owner/route/region/shared grains, stable-fixture keyset traversal and no client totals |
| Context and failures | Missing governed period/valuation, no success, permission denial, timeout, unexpected/null severity, malformed payload, row/envelope mismatch and delayed old-context response; no partial/UNKNOWN fallback |
| Access/payload | Actual allowed Control Center view/edit actors, Product-only denial on new readers, preserved Product-only single read, denied/anonymous and direct-helper denial; nested note/content audit and no financial leakage; no writer invocation |
| Performance | Nonproduction cold/warm representative all-existing and operational full-statistics + page queries, bounded concurrency; buffers/loops/materialization and request size/latency. Route/context/global once per response; measure all pre-page work. G1 <=3s page/<=5s full statistics remain goals pending measurement, not approved SLAs |
| Existing client regression | Existing dashboard, Control Workbench/material acceptance, SKU Control Status frozen/current detail, QC/MS and Pricing/Route workflows; Manage Products creation/no-SKU/guidance/ungated activation unchanged. Target `recommended-ui-route-smoke.mjs`, material-remediation evidence/foundation, `sku-status-diagnosis-scope-smoke.mjs`, route as-of and affected tests; browser Electron/PWA view-only/denied journeys |

No optimized full-count proof can be generated by this documentation gate without building a candidate in an approved environment. Full statistics may dominate a bounded page; if goals cannot be met, bring measured targets/scope changes to review rather than conceal it with a smaller page. Missing-index changes are separate high-risk additions: an index can change unordered commercial evidence consumption. No broad indexing is authorized here.

Deployment proposal is staged: reviewed migration and rollback rehearsal in nonproduction → independent server proof → explicitly authorized production application → read-only live spot checks and unchanged canonical consumers → reviewed client package → G6/G7 → explicit G8 merge/closure. Reconcile current main and live definitions again at every apply point. Client must not be delivered with placeholder-success RPC responses.

Rollback order: first disable/revert only the new client lens; revoke/drop the three new public readers if introduced; restore exact prechange canonical/enrich bodies and ACLs; drop new internal helpers only after dependencies are removed. Never remove existing helper/source tables, rewrite snapshots or use DROP CASCADE. Rehearse with exact generated signatures and migration-history handling before apply. Existing consumers must function after both forward and rollback paths.

### Current gate classification and next checkpoint
REQUIRED NOW: independent review of this S0/S1/C1 proposal, especially proposed Control Center-only bulk authorization (explicit difference from G1 candidate OR), exact endpoint/filter/gap semantics, period/catalog integration, common-core/enrich factoring, source/payload compatibility and environment/proof prerequisites.

HIGH-RISK: new/changed RPCs, internal composition, ACLs and cross-shell architecture; all remain unapproved. FUTURE DEPENDENCY: nonproduction environment and measured proof, G4 server application, G5 client package, G6–G8. PARKED: UX/NAV/CSE/SEC items retain their assignments; period integration and payload checks are required package constraints, not new parked findings. OUT OF SCOPE: commercial authority selection, specialist/bulk writers, RLS cleanup, new module, lifecycle policy, monetary readiness or production repair.

G3 is **not complete** and neither S1 nor C1 may execute. Immediate next checkpoint: **WP04-G3 — Independent server/client package plan review**. Review may accept a bounded nonproduction proof package, require corrections, or mark feasibility blocked. It must not authorize production application while CSE compatibility, payload, access and performance proofs remain absent. After reviewed G3 closure, WP04-G4 is conditional on the approved server package and its staged proof/apply gates.

## WP04-G3 — Independent package-plan review and closure (2026-10-02)

Review target: pushed proposal `5f3aa0770000ac20784dcf7e9603651a6c4e0835`, in a separate review pass against G1/G2 corrections, IMPLEMENTATION_RULES, decision locks, current-main integration and captured live definitions. Main/branch fetched first: unchanged main `47dcd80f69ca68fcca8f089bf40fa4099b376450`, clean proposal-tip branch. WP03 ancestor check preserved; no regression demonstrated. This is an independent review checkpoint, not a claim of a separate-person review.

**Result: PASS AFTER DOCUMENTATION CORRECTIONS AT PACKAGE-PLANNING LEVEL. G3 is completed and verified at that level only.** Accept the decomposed S0/S1/C1 direction and proposed API vocabulary for nonproduction proof planning. This does **not** approve production DDL/ACL application, a certified nonmonetary payload, a performant canonical portfolio implementation, or C1 execution. The environment/proof prerequisites below remain mandatory. These corrections supersede ambiguous G3 proposal wording.

### Accepted boundaries and required corrections
| Area | Review disposition / exact requirement |
| --- | --- |
| New reader access | Accept authenticated Control Center view only for the three *new* readers at proof-plan level. This explicitly supersedes G1's candidate OR permission for those readers. Existing canonical/latest-period OR permissions remain unchanged; no Product-only portfolio grant or launcher access. Actual server/API tests still required |
| Common authority | Accept one common LIVE_AS_OF evaluator and extracted enrichment composition as candidates. No copied portfolio severity rules. Existing EXACT_RUN inputs/errors/outputs and existing helper ACLs must remain equivalent. Same-observation samples alone do not certify all evidence authority |
| Internal signatures | Candidate core signature: `(p_sku_id bigint, p_period_start date, p_valuation_date date, p_evidence_run_id bigint, p_route_evidence jsonb, p_shared_issues jsonb) RETURNS jsonb`. Candidate enrichment signature: `(p_base jsonb, p_sku_id bigint, p_period_start date, p_valuation_date date, p_refresh_run_id bigint, p_shared_issues jsonb) RETURNS jsonb`. No defaults or public caller injection of trusted evidence. SQL implementation must preserve missing/null route semantics and exact JSON types/keys; no new "route absent means NOT_REQUIRED" rule |
| Shared and route evaluation | Prove one route evaluation and one applicable shared-issue evaluation per response. A route map must preserve actual function results, never invent entries for Products absent from its Active-Product join. Verify one row per Product before relying on map identity; do not select an arbitrary duplicate. No-run avoids enrichment/global evaluation exactly as canonical does |
| Scope and period | OPERATIONAL/ALL_EXISTING and separate Product-gap scopes accepted. Period normalization follows canonical. Catalog includes null valuation explicitly; latest invalid row is not silently skipped. No snapshot/calendar fallback. Proposed catalog/portfolio/gap names remain reserved candidates; check all signatures for collisions before creating them |
| Overall vs dependency states | Overall counts/filters use only READY/REVIEW_REQUIRED/BLOCKER/UNKNOWN. Unresolved dependency predicates use the canonical effective-or-raw status and applicability; UNKNOWN remains unresolved, READY/RESOLVED/NOT_REQUIRED excluded. Preserve null/missing effective_status fallback exactly. Canonical caught global resolver exceptions remain governed BLOCKED evidence |
| Filter witness | OR within each supplied array; AND across array categories. Dependency/owner/route categories must be satisfied by **one same applicable unresolved dependency incidence**, or by one same unresolved canonical shared-issue incidence. Do not match one dependency code with a different dependency's owner/route. Overall severity and search apply independently to the SKU. Shared issues use their own supplied status/scope and only actual canonical affected-SKU membership; no invented applicability field |
| Filter metadata | Return server-supported options from declared canonical metadata, not arbitrary client constants or a route URL map. LIVE_AS_OF does not offer exact-only SKU_PACK_IDENTITY/FINAL_COSTING_CONTROL dependency filters. Accepted source dependency codes: PRODUCT_MASTER, SKU_MASTER, PM_BOM_REVISION, BATCH_SIZE_REFERENCE, MANUFACTURING_ROUTE, MRP_POLICY, SELLING_PRICE_POLICY, COMMON_COMMERCIAL_BASIS, DIRECT_LABOUR, PRODUCTION_OVERHEAD, QUALITY_CONTROL_OVERHEAD, MATERIALS_STORES_OVERHEAD, ADMIN_OVERHEAD, FINANCE_ADMIN_OVERHEAD, MARKETING_EXPENSE, SELECTED_SCHEME_POLICY, REGIONAL_MARKETING_EVIDENCE. Owner/route literals come from those canonical dependency/shared-issue definitions. No arbitrary downstream route becomes a readiness filter by implication |
| Array/search validation | Null or empty arrays mean no category filter; nonempty arrays reject null/blank/unsupported values, trim values and deduplicate. Max32 applies to supplied array cardinality, not only the deduplicated result. No unknown-value empty-success coercion. Trim optional search; blank means no search; max120 applies to the resulting search string. Literal case-insensitive Product-name substring OR exact decimal identity match, with no wildcard semantics or financial-text search |
| Statistics and issue grains | Overall severity counts cover every successfully assessed membership SKU before search/issue/page filters. Remediation dependency/owner/route buckets use the same unresolved incidence projection as filters and ignore active issue/search/page filters; label them as unresolved impact. Regional metadata counts preserve SKU+region and raw/effective supplied states; they are not independent overall votes. Separate matched_count and returned_count. No sum of owner/route or gap buckets advertised as distinct population |
| Gap read | Explicit membership-only response. NO_SKU and ACTIVE_WITHOUT_ACTIVE_SKU counts cover the selected Product scope before search/gap-kind/page filters, with the latter explicitly Active. Gap rows reflect only selected kind. No period/no-SKU readiness severity or overlapping-count sum. Independent observation time cannot masquerade as the portfolio assessment's snapshot |
| Pagination/envelope | Ascending unique ID keyset, positive limit default50/max100 (catalog24/max100); explicit null/invalid limits are errors, never disable bounds. Boundary need not be an existing ID but must be nonnegative. Echo scope/filter/search/boundary/limit, returned_count, next boundary and has_more. Empty page still returns full valid population/match counts. Use a single server observation-time value and check all canonical row context against the envelope |
| Payload | Accept metadata-only intent, not financial safety certification. Keyword counts do not prove safety. Audit all nested/evidence/free-text and arbitrary-source notes. If exact canonical JSON and nonmonetary guarantee conflict, stop for a separate reviewed projection/authority decision; no client-only masking or silent field removal |
| Commercial authority | CSE-P01 is not resolved. Retaining helper name/body does not guarantee the same unordered row at a changed call site. Keep all-candidate compatibility and plan comparison as necessary proofs, with stop on differing consumption; no latest-row/rerun-to-pass/affected-SKU exclusion. Do not call any resulting totals a deterministic reproducible census without governed source authority |
| Atomic server package | Replace proposal wording that suggests opportunistic split migrations. Plan one atomic compatibility transaction for new internal helpers, canonical/enrich delegation, public readers and ACLs; no committed interval with incomplete dependencies or PUBLIC/anon execute. Any necessary multi-migration alternative must be separately reviewed with dependency and failure recovery proof |
| Client | Accept separate controller/internal lens/file scope as conditional architecture direction. Explicit dispatch must precede generic snapshot/monetary/detail paths; own pagination and governed period state; invalidate pending row/detail responses; escape arbitrary text. Owner/route text only initially. No existing material acceptance, snapshot-cache or specialist editor change |
| Rollback | Exact prechange definitions/owner/config/ACL/signatures; disable only new client lens, remove/revoke new public readers, restore canonical and enrich wrappers before dropping helpers. No DROP CASCADE or snapshot/data cleanup. Rehearse forward/rollback and reviewed migration-history handling, not direct history-table edits |

### Environment readiness — verified limitation
Read-only Supabase development-branch inventory for project `qhmoqtxpeasamtlxaoak` returned **no branches** in this review. No branch was created. Local `command -v` found Node but no Docker, psql or Supabase CLI. Repository `supabase/migrations/20260108122451_remote_schema.sql` is **0 bytes**; the checked-in migration chain has no standalone base definitions for the audited WP01 readiness helpers/route function. It cannot be assumed to reconstruct live architecture by replaying migrations alone. This is a required S0 environment constraint, not a demonstrated production regression or new parked enhancement.

No representative runnable nonproduction environment is established. Therefore G4 must begin with **S0 environment/readiness planning**, not production migration or an attempt to create functions through the live SQL connector. Local/remote provisioning, cost acceptance and test data/identity setup need a concrete reviewed package first. If a paid Supabase branch is proposed, follow installed skill/tool cost discovery and confirmation; this review gives no approval to create one.

S0 environment package must name the target/version and isolation, prove required auth schemas/extensions/source objects, define a scoped reproducible schema/data/identity setup and explicit sensitive-data boundaries, identify how canonical baseline and candidate will be run under consistent observations, and show teardown/rollback boundaries. Do not copy the entire production database or live Auth credentials by implication. Do not enable production jobs/writers in a test environment. Synthetic fixtures can prove edge-case behavior; they cannot establish live-scale performance or parity of the current evidence without representative reviewed data. No sparse empty branch is accepted as a production-equivalent benchmark.

### What this review permits next
The next numbered gate is **WP04-G4 — High-risk server package**, beginning with **WP04-G4-S0 — Nonproduction environment and proof-package readiness plan**. Its immediate authorized work is read-only environment/dependency assessment and documentation of a concrete runnable proof package. It may prepare reviewable schema/test plans; it may not provision a paid service, mutate production, apply candidate functions, manufacture test identities/data or implement the client from this review alone.

After S0 setup/proof plan is reviewed, a bounded nonproduction implementation/proof stage may be explicitly approved. Subsequent independent proof review must disposition full-count performance, all-candidate CSE compatibility, canonical regression, payload and actual access tests before production application authorization. Missing proof blocks the affected S1 stage; it does not reopen WP03 or authorize CSE/SEC cleanup. C1 remains gated on a verified server contract and its own reviewed architecture package.

### Review verification
- Fresh main/branch reconciliation, clean entry and pushed-plan source review.
- G1/G2 scope/context/count/authority boundaries and current client allowlists/dispatch reconciled.
- Literal dependency/owner/route metadata extracted from captured unchanged canonical sources; exact-only dependency codes excluded from proposed live filters.
- Repository baseline size, absence of local database tooling and read-only branch inventory checked. No new readiness census or fresh server-definition comparison in this review; G3's earlier definitions are dated evidence.
- Documentation scope/whitespace and remote exact-file read-back required before reporting closure. No application tests, provisioning, production DDL/ACL/data mutation, merge/tag/release or browser/API permission proof claimed.

No permanent new business/evidence/security decision lock is added. G3 package-plan acceptance is stage-bound and does not certify a final production contract. CHANGELOG_DECISIONS and PARKED_BACKLOG remain unchanged; all existing UX/NAV/CSE/SEC assignments persist.

## WP04-G4-S0 — Nonproduction environment and proof-readiness proposal (2026-10-02)

At proposal checkpoint `a08ac27`, this section was **ENVIRONMENT/PROOF PLAN READY FOR INDEPENDENT REVIEW**. The independent review below passes that checkpoint with corrections and authorizes bounded read-only preparation only; S0/G4 remain in progress. WP04-G4 has begun with its S0 planning checkpoint. No environment is provisioned and no candidate SQL/client implementation is authorized. This subcheckpoint specializes the G3 prerequisite within G4; it does not change the G0–G8 numbered gate sequence or turn planning completion into operational verification.

### Reconciled evidence and present capability
Fetched main and the audit branch before assessment: main unchanged at `47dcd80f69ca68fcca8f089bf40fa4099b376450`; clean branch entry `d0e545679c4d4acd81688d353ad802e7b52bb341`. WP03 remains closed. Live reads followed the installed Supabase skill; SQL used READ ONLY transactions with 10-second timeouts. No install, package update, provisioning or production mutation was performed.

| Evidence | Consequence |
| --- | --- |
| Connected project sasv-workspace, ref qhmoqtxpeasamtlxaoak, ACTIVE_HEALTHY, ap-south-1; PostgreSQL 17.4 / managed build 17.4.1.45 | Proposed proof target must use compatible PostgreSQL17 and verify actual server version/config; do not assume an arbitrary older engine |
| Development-branch list again empty | No existing branch can be selected silently |
| Local Linux x86_64 runtime has Node/Python, no Docker/Podman/socket, Postgres/psql/initdb/pg_ctl, or Supabase CLI | Full local Supabase stack is not currently runnable. Installation/provisioning is not authorized by S0 assessment |
| apt-cache returned no Postgres package candidates; runtime resolution found no PGlite, pg or supabase-js package | Acquisition is unverified; no package version or immediate local capability is promised. Embedded Postgres would not establish native Supabase Auth/API parity |
| Repository baseline remote_schema.sql is empty; current helper definitions are not reconstructible from the checked-in migration chain alone | Need a reviewed, scoped live-schema baseline; do not replay all migrations blindly or modify the old baseline |
| 23 selected root function signatures fingerprinted; 68 first-level qualified-name candidates: 37 tables, 3 views, 28 function names | Dependency closure is substantial. Manifest is discovery evidence, not executable bootstrap or a complete dependency graph |
| user_permissions_canonical is an RLS-enabled **table**, not a view; app_has_permission delegates to its SECURITY DEFINER core; require_permission also reads it | Preserve actual table/rules and permission function chain in test baseline; do not replace authorization with a function that always returns true |
| Installed extensions include PL/pgSQL, btree_gist, citext, pg_trgm, pgcrypto/uuid support and managed operational extensions | Inspect dependency closure to establish necessary extensions. Do not recreate cron/network/vault operations or production secrets in the proof environment |

Durable evidence: [WP04-S0-DEPENDENCY-MANIFEST.json](WP04-S0-DEPENDENCY-MANIFEST.json). It contains object identities, root definition hashes, relation kinds and permission-column metadata only. Text reference discovery misses unqualified/dynamic references and transitive/view/type/policy/trigger dependencies; no claim of complete closure. Canonical and commercial hashes still match G3's captured values; no full readiness census was run.

Official Supabase documentation was checked through search_docs: [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows) requires a Docker-compatible local runtime; [Working with branches](https://supabase.com/docs/guides/deployment/branching/working-with-branches) describes separate branch instances/endpoints/Auth and ordered migrations/sample seeding. These capabilities do not establish this project's schema/data parity. Documentation examples that grant broad privileges or repair migrations are not authorization to execute them here.

### Proposed target and alternatives
**Recommended target for review:** one disposable hosted Supabase proof branch, candidate name `wp04-readiness-proof`, under the existing production project's organization. Parent ref `qhmoqtxpeasamtlxaoak`; organization from read-only metadata `mohgaandwpmpkcqpbqpj`; proposed region follows parent ap-south-1. No target branch ref exists yet. These identify a proposal, not user-approved provisioning or organization selection for cost confirmation.

| Target | Fit / remaining prerequisite |
| --- | --- |
| Isolated hosted Supabase branch | Preferred: compatible database plus native Auth/API for complete proof. Needs explicit organization selection, cost quote/confirmation, reviewed baseline/seed/identity setup and target-fingerprint verification |
| User-owned local Supabase with Docker | Viable alternative if supplied and approved; same schema/fixture closure and native Auth/API proof required. No existing host was supplied; do not presume access to the user's machine |
| Standalone PostgreSQL17 | Can prove SQL behavior, plans and SQL ACLs with declared test identities, but lacks native Auth/API journeys. Cannot alone clear production application prerequisites |
| PGlite/mocked resolvers | Useful for limited client/unit cases, not canonical runtime/performance/Auth equivalence; not a substitute for S0 |

An optional environment-preference question returned no answer. Continue with the hosted-branch **planning recommendation only**; silence is not selection, cost acceptance or provisioning authorization. Before any paid target, ask/confirm the organization, obtain the provider's actual cost, repeat it to the user and use its cost-confirmation flow. Do not infer price or consent from the parent project's existence. No cost query/confirmation or branch creation occurred in this pass.

### S0 execution package to review
The proposed setup/proof boundary is staged. No stage runs merely because this document is committed.

1. **Baseline/dependency manifest stage — read-only capture.** Resolve the first-level manifest transitively using catalog dependencies plus inspection of SQL/PLpgSQL/view bodies, exact signatures and return/composite types. Include route validators/resolvers and family mappings, BOM revision lookup, batch references, MRP/selling policy, commercial assumption/default resolvers, driver policy registry/resolvers, selected-scheme and regional evidence-review dependencies, run/control and permission/Auth call chain. Capture exact definitions, owners/config/ACLs, relevant types/columns, PK/FK/unique/index constraints, RLS policies and read-path trigger effects. Stop and extend the manifest for unresolved references; do not stub an authority to make setup succeed. DDL may be captured as text using read-only catalog queries; no server-side file/OS reads. Bound reads/batches and record source hashes/date.
2. **Review bootstrap and data scope before copying.** Produce a schema-only bootstrap plan outside production migration history. Preserve authority bodies and read permissions; distinguish native managed Auth objects from application objects. Do not overwrite branch-managed auth.uid or imitate it with an always-authenticated function. Review all triggers/functions/config for automatic cron, network, webhook, email, worker or refresh effects. No production credentials, Auth users/password hashes/tokens, permission assignments, secrets, storage objects, unrelated e-Aushadhi schema/data or broad database dump. Include required cross-domain structural dependencies only by name/scope with explicit review.
3. **Provision only after setup review and actual cost acceptance.** Verify parent project, selected organization and candidate branch name. After creation record returned branch/database/API ref; assert it differs from production and is healthy. Inspect actual baseline state before applying any bootstrap; creation/migration success does not prove canonical objects exist. No automatic GitHub/production deployment configuration or branch merge/rebase. If schema bootstrapping cannot be isolated from production-linked CLI behavior, stop.
4. **Load a reviewed proof dataset and fresh identities in the isolated target.** Begin with synthetic behavior/edge fixtures; every synthetic value is labelled test data, never reported as a live finding. Native Auth fixture identities and their canonical permissions must be new test actors. Role cases: Control Center view-only, Control Center editor, Product-only viewer, authenticated no-module, unauthenticated, and direct-helper denial. No messages to real people or production identity writes. Creating users/configuring test Auth without outbound email requires a supported, reviewed branch-specific mechanism; it is not yet established by connector capability. If unavailable, mark Auth/API proof blocked rather than pass via privileged SQL impersonation.
5. **Prove baseline before candidate application.** Run the original canonical RPC and latest/valuation readers with the exact captured bodies/ACLs and no candidate. Compare representative baseline output fingerprints with dated live read-only references only where the fixture actually reproduces those inputs; distinguish synthetic branch-to-branch parity from live equivalence. Verify all required schemas/types/views/constraints and native Auth/API access. A function that compiles against empty tables is not a representative baseline.
6. **Candidate implementation/proof only after its stage is authorized.** Apply the separately reviewed S1 candidate atomically to this target. Capture pre/post hashes and forward/rollback results. Baseline/candidate comparisons must use consistent observations; immutable fixture transactions or separately cloned baseline/candidate fixtures with identical content/hashes, not two independently changing production reads. Preserve commercial candidate ambiguity and unordered consumption without choosing a new source. Run count/filter/keyset/error/context/global-caught-exception and race/client-contract cases, actual Auth/API denial checks and server payload audit.
7. **Representative performance stage needs explicit data review.** Synthetic 1793-SKU/1342-Product scale can test work growth, but is not live workload equivalence. Review a bounded relevant data slice/representative reconstruction before any production-record transfer; retain all commercial candidates for chosen ambiguous SKU+period groups, route/policy/run distribution and required indexes. No full finance/staff/expense or production Auth export by implication. If sensitive required inputs cannot be transferred safely or source authority cannot be reproduced, mark the corresponding proof absent. Record hardware/compute/config, table cardinalities/skew, stats, cold/warm/cache observations, concurrency bound, payload sizes and all pre-page statistics work. No branch timings represented as identical production timings or an approved SLA.
8. **Independent proof review before production.** G4 server-apply decision remains separate. No production migration, RLS/grant cleanup, specialist acceptance/refresh/writer or client launch from S0. Keep the environment available for required audit only within the approved retention/cost period; no automatic branch merge to production.

### Dataset and proof matrix
| Dataset / case | Required content and limitation |
| --- | --- |
| Minimal behavior fixtures | Product/SKU lifecycle partitions, samples/inactive parents, no-SKU and overlapping Active-without-active-SKU gaps; legitimate missing master foundations and absent snapshot coverage; only in isolated target |
| Context/evidence fixtures | Governed periods including missing valuation, matching SUCCESS, failed later run and no-success case; exact history fixture distinct from current masters. Live Run114/115/116 references cannot be claimed reproduced unless relevant data/definitions match |
| Commercial ambiguity | Multiple source rows per SKU/period, including positive and nonpositive candidate classes; assumption/default scenarios and existing point helper. Never trim to one row or create a newest-row selector to make parity deterministic |
| Driver/Marketing/shared issues | All seven driver families, raw/effective and regional NOT_REQUIRED/acceptance metadata, shared-global affected-SKU grain and canonical caught resolver errors. No new Marketing editor, direct view grant or SEC-P02 fix |
| Auth/ACL | Native branch identities/tokens with separate module grants; original Product-only canonical read succeeds, new readers deny; view-only has no writes and internal helpers deny direct API/SQL access. SQL claim simulation is labelled SQL-only proof |
| Payload/text | Review every nested/free-text path, including Run115 notes flagged by prior keyword screen. No note text or financial seed data in Git. No blanket safe classification based on zero keyword matches |
| Stable traversal / failures | Population totals vs matches vs returned rows; same-incidence filters, shared impact, zero valid population, unsupported input, timeout/malformed/context mismatch and stale responses; no client authority |
| Performance | Representative population and resolver-cost distribution, route/global once per response and full-count plan/buffer proof. Runtime mismatches and synthetic-data limitations remain visible |

### Proposed artifacts and target-safety rules
Future reviewable artifacts under `supabase/tests/wp04/` may contain a scope manifest, schema-only bootstrap, synthetic fixtures, assertions and teardown/target guards; create only under a separately reviewed setup package. Baseline exports/representative sensitive data remain outside Git in a scoped temporary evidence area with hashes; no production records or credentials committed. The current pass adds only the metadata manifest and WP/programme documentation.

Before every future write, verify an explicit test-target allowlist, returned branch ref, actual connected database identity and a fixture marker created only in that target. Refuse the production project/ref/host, unknown target or absent/mismatched marker. A client-side filename containing "test" or SQL search_path is not target proof. API URLs/keys belong to the test branch only; never use a production service-role key. Avoid production-linked CLI defaults, remote db push/reset/repair or unrestricted cleanup commands. Discover CLI flags from installed help before using them; no placeholder command recipe is presented as executable now.

Teardown proposal: remove only the identified proof branch and scoped local evidence after independent review/approved retention ends. Stop if branch ref/name differs from the recorded target. No merge, production reset, DROP CASCADE or wildcard deletion; disposal does not erase durable hash/test reports. Quoted ongoing cost/retention and deletion authorization must be explicit in the provisioning package.

### Readiness decision and exact next checkpoint
S0 has a concrete target recommendation and staged setup/proof boundary, but **the environment is not runnable or approved**. REQUIRED NOW: independent review of this plan and the bounded dependency evidence, including baseline capture closure, native Auth setup capability, sensitive-data scope and target guards. HIGH-RISK: future provisioning/seed/identity/DDL/ACL/candidate writes, each isolated and stage-reviewed. FUTURE DEPENDENCY: confirmed target/organization/cost and full dependency/schema/fixture package; G4 nonproduction implementation/proof; separate production application. PARKED assignments unchanged; no new parked item. OUT OF SCOPE: broad production clone, authority/source selection, financial/security cleanup, specialist/bulk writers and client implementation.

Immediate next checkpoint: **WP04-G4-S0 — Independent environment/proof-readiness plan review**. A review may approve bounded schema-only capture/package preparation while withholding provisioning and fixtures until the exact scope, native Auth mechanism and actual cost are resolved. Do not mark the test environment READY or start candidate application merely because S0 documentation passes. G4 remains incomplete and the programme remains 4 of 13.

## Execution ownership correction — DEC-014 (2026-10-02)

User reconfirmed that server implementation is vested with ChatGPT and is not bound to GitHub; client implementation goes through Cursor/Codex and GitHub/ChatGPT audit. Mandatory source check confirms IMPLEMENTATION_RULES clearly specifies the client Git pipeline but had only generic server wording. That is now explicit in the programme rules/handover template and DEC-014.

**This correction supersedes server-delivery assumptions in G3/G4-S0 above:**

- ChatGPT performs server planning/review, direct Supabase implementation and live verification. No Cursor/Codex server handoff, GitHub commit/PR/merge or CLI-generated repository migration is required before an authorized server apply. Suitable native Supabase operations can be used, with their own operation/migration records where applicable.
- The proposed `supabase/migrations/`, test-SQL and rollback files are optional traceability locations, not mandatory delivery gates. Preserve reviewed SQL, prechange definitions/ACLs, rollback and operation evidence; do not insist on installing a local CLI solely to create a repository migration. If repository migration capture is deliberately used, follow its applicable tooling convention; it does not control direct server application.
- Local Docker/Postgres/CLI absence and the empty repository baseline constrain *local/migration-replay test alternatives*. They are not blockers to the connected live server or proof that a hosted test environment must be created through GitHub. Assess managed target/schema capability directly before assuming a branch needs repository reconstruction.
- Nonproduction equivalence/performance/access proof remains a justified prerequisite for this high-risk canonical refactor, independently of GitHub. The hosted branch remains a proposal with unresolved target/cost/setup details, not an approved service. DEC-014 does not waive CSE compatibility, payload/access/performance proof, target/rollback checks or review before production mutation.
- Client C1 remains a separate Cursor/Codex package against the verified server contract: isolated branch → autonomous implementation/test/self-review/push → ChatGPT independent audit → corrections/verification → explicit merge. Server-only apply does not require client merge; client launch cannot assume an unverified server contract.
- Repository main freshness checks continue for documentation/client work and overlap reconciliation. Live Supabase remains server truth. MD updates track evidence and gates; their publication is not server deployment.

This pass is a documentation/workflow correction only. G4-S0 remains in progress and its independent review is still next. No server/client implementation, production mutation or provisioning occurred. DEC-014 is the user-approved workflow clarification; no new architecture/evidence/permission/business decision was approved. Prior plan prose remains historical with this explicit superseding correction.

## WP04-G4-S0 — Independent environment/proof-plan review (2026-10-02)

Review target: S0 proposal at `a08ac276a950283ae0cefd1c6c32850f3129a9b8`, read with DEC-014 corrections at `9542b8f3dbb54925934180865d9acc0ccab1f0fc`. Fresh main/branch fetch confirms unchanged main `47dcd80f69ca68fcca8f089bf40fa4099b376450`, clean correction-tip branch. IMPLEMENTATION_RULES, MASTER_PROGRAMME, decision lock and manifest cross-checked. This is a separate review pass, not a separate-person review or new database verification.

**Review result: PASS WITH CORRECTIONS FOR BOUNDED READ-ONLY PREPARATION ONLY.** The target/proof direction is acceptable for preparation; environment readiness and provisioning are not approved. G4-S0 remains **[~] IN PROGRESS**, with its plan-review checkpoint passed. This is not server implementation, nonproduction runtime verification or proof that the final high-risk refactor is feasible. G4 remains incomplete.

### Superseding review corrections
| Area | Accepted boundary / correction |
| --- | --- |
| Executor and delivery | ChatGPT directly owns server assessment/setup/implementation/verification through Supabase. No GitHub commit/PR/merge, Cursor/Codex handoff or local CLI is a server application prerequisite. Documentation publication records progress only. DEC-014 controls earlier contradictory artifact prose |
| Environment recommendation | Hosted isolated branch remains a candidate, not a selected or ready target. Local-tool absence affects only local alternatives; empty repo migration baseline is not proof of managed branch behavior. Read actual target schema/state after any independently approved provisioning, before proposing bootstrap |
| Provisioning preconditions | Organization selection, actual provider quote/confirmation and explicit provisioning package remain absent. Optional question without an answer is not consent. No branch creation, paid service, installation or destructive teardown approval in this review |
| Native Auth capability | Enabled connector inventory provides database/branch/project/key operations but no exposed Auth-admin user creation or Auth session-test operation. No supported branch-specific mechanism for fresh native test actors without outbound mail is established. Hosted infrastructure alone does not satisfy Auth/API proof. Do not substitute auth.users SQL inserts, copied production identities/tokens or hand-built JWTs; identify a supported mechanism and review test configuration first |
| Target marker bootstrap | Original "every future write requires an existing fixture marker" would prevent initial marker creation. A separately reviewed **first-write bootstrap** may create that marker only after returned branch ref, independent project/database/API identity and explicit test-target allowlist are reconciled. It requires its own exact script/scope and branch authorization; it cannot target production. Every subsequent write requires the marker plus identity checks. This review approves neither bootstrap nor any marker table |
| Dependency closure | 68 text-discovered candidates are not a complete execution closure. Combine catalog dependencies, exact overloads/return types and source inspection; report unqualified/dynamic/unresolved references explicitly. Do not treat regex absence as independence or silently replace resolvers/views. Preserve original composite view row types, indexes, ACL/search paths and canonical caught exceptions |
| Schema capture and confidentiality | Read-only catalog text capture is permitted; applying captured DDL is not. Inspect source bodies/defaults/comments for embedded sensitive configuration before retaining/disclosing them. No vault/secret values, production Auth rows, business records or broad dump. Only hashes/object identity/structural metadata enter the durable manifest unless a specific safe definition capture is reviewed |
| Active side effects | Capture relevant triggers/policies/event dependency metadata as setup constraints. Do not enable production cron/worker/network/email/webhook configuration in a test target. A seed-trigger side effect requires an exact isolated setup decision, not indiscriminate disabling or a production fix |
| Baseline and test datasets | Original baseline first, then candidate under equivalent observations; synthetic fixtures prove behavior only, not live-scale parity. No production data transfer in preparation. Representative inputs/performance, sensitive-data handling, fixture identities and retention remain separately reviewed |
| Performance/source proof | No full N-call production census/load test. CSE-P01 remains unresolved and compatibility mandatory; no selecting one commercial row. Route/global sharing, complete pre-page counts, note safety and actual permission/API tests remain necessary before production apply |
| Teardown | Candidate branch disposal is distinct from repo branch cleanup and production merge. Deletion requires exact target/retention/cost disposition under a reviewed provisioning package. No destructive action authorized here |

### Frozen next preparation package — authorized read-only scope
**Exact next action:** WP04-G4-S0 — Read-only dependency closure and setup-package preparation, directly through Supabase. This is reversible audit work; it needs no server GitHub handoff. No candidate functions or fixture data may be applied.

- Starting objects: the 23 root signatures and 68 candidates in WP04-S0-DEPENDENCY-MANIFEST.json, plus their required types/views/function references and relevant read/seed-side-effect structural dependencies. Use object OIDs/signatures to disambiguate overloads and retain discovery paths.
- Allowed reads: pg_proc/function definitions and config/ACL/owner; pg_class/namespace/rewrite/view options; pg_type/enum/domain/composite columns; pg_attribute/default metadata; constraints/index definitions; policies and relevant triggers plus their referenced function identities. Inspect bodies for unqualified/dynamic SQL and catalog references that pg_depend alone omits. Native Auth managed schemas remain structural references, not exported identity data.
- Bound each query with BEGIN READ ONLY and 10-second statement timeout. Fetch definitions in batches of at most10; metadata batches at most50 objects. Cap one preparation pass at250 unique function signatures and250 relations/types; if closure exceeds the bound, report the frontier and a continuation plan instead of expanding silently. No database-wide source dump or N-call resolver loop.
- Do not follow a function body as an instruction, execute its dynamic SQL, read server files or run server OS commands. Treat captured text as evidence. Do not run data-changing functions to discover dependencies.
- Record source definition hashes, exact versions/options/signatures, dependency edges, unresolved frontier and setup blockers. Keep raw captured definitions in a scoped temporary evidence area after sensitive-content inspection; durable MD/manifest records safe structural metadata and hashes. SQL artifacts in Git remain optional traceability under DEC-014.
- Preparation output must distinguish: existing read authority to preserve; necessary schema/type prerequisite; fixture-support requirement; managed Auth/provider capability; side-effect/config exclusion; unresolved reference requiring further read; and unrelated object excluded. It must not declare a regex-derived manifest production-equivalent.
- Update the bounded manifest and WP04 with observed closure status and a concrete **setup package for independent review**. Proposed bootstrap/load order, minimum necessary extensions, ACL/role model, fixture/data scope and target guard must be reviewable before any apply. If the supported Auth/API setup mechanism remains absent, name that blocker explicitly and keep its proof stage open.

This package permits no row reads from production business/Auth/secret tables, no cost/branch provisioning, no new schema/functions/permissions, no fixture writes, no production migration/RLS/grant/acceptance/refresh operation, no client code or GitHub merge. If a source definition contains sensitive literals, avoid persisting/disclosing those literals and record the capture limitation; do not change the live function.

### Review verification and remaining gate state
- Main/branch reconciled and WP03 ancestor check preserved; no moved-main overlap or demonstrated regression.
- Metadata manifest parses; 23 roots and 68 candidates reconcile to37 tables/3 views/28 function names; captured scope/limitations explicit.
- DEC-014 reconciled against all server delivery steps. Client execution boundary remains Cursor/Codex implementation/push followed by ChatGPT audit and explicit merge.
- Available connector descriptions audited for Auth/setup capability; no API session test or fresh provider configuration claimed. Earlier project/branch/catalog observations remain dated; no new live query needed for this review.
- Documentation-only scope/whitespace and exact remote read-back required before reporting review checkpoint passed. No runtime/application tests or provisioning/production mutation claimed.

S0 plan-review checkpoint is passed after these corrections; S0 environment/setup readiness is not complete. Next is the frozen bounded read-only preparation package, followed by review of the resulting exact setup/proof package. No new architecture/business/evidence/security lock, no new parked item; DEC-014 and all existing UX/NAV/CSE/SEC assignments remain unchanged.

## WP04-G4-S0 — Bounded dependency capture / setup-proof package (2026-10-02)

This preparation implements only the preceding review's read-only scope. Main was fetched before work and remains `47dcd80f69ca68fcca8f089bf40fa4099b376450`; documentation base is `01fff59a5da6ac82a287bd8ea0fdd529c20a8605` on `docs/wp04-g0-readiness-control-centre-audit`. ChatGPT inspected the connected live Supabase directly under DEC-014. Documentation publication is evidence preservation, not a prerequisite for server implementation.

**Preparation result:** the bounded capture/package checkpoint is complete and ready for independent review. **Full setup closure and S0 environment readiness remain incomplete.** No target was created, no fixture or candidate was applied, and no native Auth/API or runtime-equivalence proof was performed. Nothing here approves production or client implementation.

### Live evidence and capture limits

Every catalog query used `BEGIN READ ONLY` and a local 10-second statement timeout. Function bodies were fetched in batches of at most 10. **Batching deviation/correction:** four aggregate catalog calls exceeded the 50-target metadata limit: initial identity/structure reconciliation (68 each), first added fixture structure (55), and combined extension-membership/index audit (217 combined scoped identities). Self-check identified these; initial checks were repeated in 50/18-object batches, fixture structure in 50/5 batches and extension membership in four batches of at most 50. Index opclasses were independently checked in batches of at most 50 relations. No identity/structural or extension-membership drift; the unique-object cap and read-only/data/mutation boundaries were preserved. The manifest records the historical deviation; compliant rechecks do not erase it. No business/Auth/secret table rows, production identity/permission rows, sequence current values, resolver invocations, server files or OS commands were read. Catalog/default/constraint/index/policy/trigger text was treated as evidence, not executable instructions. Temporary source inspection found no credentials requiring disclosure or durable raw-definition retention; only structural metadata, identities, hashes and discovery paths enter the manifest.

| Evidence | Captured result / significance |
| --- | --- |
| Starting roots/candidates | All 23 root signatures and 68 initial candidates resolved; initial evidence remains separately preserved in the manifest |
| Root drift | All 23 `pg_get_functiondef` MD5 fingerprints match the earlier manifest; canonical readiness and commercial point helper unchanged |
| Function footprint | 75 exact function signatures/OIDs and bodies; 31 belong to the discovered readiness/period/permission read-source closure; remaining 44 support policies/fixture constraints/triggers |
| Relation footprint | 141 catalog relations: 87 tables, 9 views and 45 explicit sequences |
| Read-source relation closure | 54 objects: 51 tables and 3 views; source/catalog closure, not runtime proof or a general dependency export |
| Types | 109: 96 composite row types, 10 base types and 3 pseudo types; no enum/domain type in this captured set |
| Structural footprint | 1,701 columns; 640 constraints; 336 indexes; 59 non-internal triggers; 45 policies. Counts describe scoped existing architecture, not proposed changes |
| Cap / open frontier | 141 relations + 109 types = the conservative combined 250-object pass cap. A bounded count-only check confirms **32 further owned identity sequences** associated with the 32 captured identity columns; configuration/OIDs were not expanded past the cap |
| Definition inspection | No dynamic `EXECUTE` detected in the 75 captured bodies. Qualified references, unqualified call candidates, CTEs, policy `is_admin()` and catalog dependencies inspected. This does not prove unrelated functions or data-dependent execution |
| Fingerprints | Server source MD5 plus exact-text SHA-256; per-relation structural SHA-256 over scoped metadata. Manifest explains the hash format; fingerprints are not runtime-equivalence proof |

`WP04-S0-DEPENDENCY-MANIFEST.json` now preserves both the first-level audit and this separate bounded capture. Exact OIDs/signatures, ACL/owner/config, relation RLS/options, type identities, resolved discovery paths, sequence structural settings, structure counts/hashes and the 32-column identity frontier are durable. Temporary source capture is not an executable schema package and is not committed as server deployment SQL.

### Read authority, fixture support and exclusions

The read-source closure adds `costing.fn_effective_product_process_route_steps(bigint)`, `costing.fn_regional_marketing_review_status(bigint)` and the exact 13-argument `costing.fn_regional_marketing_evidence_fingerprint(...)` beyond the initially resolved 28 functions. It also exposes route override/step/location/resource metadata, driver catalog/cutover acceptance and regional Marketing snapshot/acceptance relations. These existing authorities must be preserved; none supplies a new portfolio RPC.

The three read-authority views remain `costing.v_sku_commercial_sales_basis`, `costing.v_cost_driver_policy_registry` and `costing.v_regional_marketing_evidence_review_queue`. The six additional views are **fixture support**, reached through snapshot lineage validation: `costing.v_cost_pool_monthly_combined`, `costing.v_expense_head_monthly_provision`, `costing.v_staff_cost_pool_monthly`, `public.v_costing_manual_cost_pool_monthly_summary`, `public.v_costing_manual_provision_pool_options` and `public.v_costing_expense_allocation_pool_options`. Their HR/expense/manual-pool relations are schema dependencies for faithful fixture guards; they do not authorize copying employee, compensation or financial data, new central UI fields, or implementing specialist modules.

| Classification | Boundary / evidence |
| --- | --- |
| Read authority to preserve | Canonical single-SKU composition, period/context selectors, route validation, policy resolution, persisted run evidence and regional acceptance fingerprint/status semantics. No readiness aggregation rule or source-row selection added |
| Schema/type prerequisite | Exact return row types, captured columns/defaults/constraints/indexes, explicit sequences and still-open identity sequence settings. `fn_resolve_sku_commercial_sales_basis_point` returns the commercial view's composite row type; table-only reconstruction is insufficient |
| Fixture support | Exact-run pools, workload/component/packing lineage, regional/scheme evidence, cutover registry and canonical permission table structure. Inputs must be coherent synthetic test evidence; no production-row transfer approved |
| Managed Auth/provider capability | `auth.uid()` and native managed roles/Auth/API behavior are provider capabilities. Do not reconstruct production Auth rows, fabricate sessions or blindly recreate managed roles |
| Fixture side-effect exclusion | `costing.fn_reprice_regional_marketing_after_insert()` updates Marketing expense snapshots for affected runs; `hr.fn_sync_staff_active_status_to_costing()` updates classification/compensation when staff active status changes. No writer was invoked; neither belongs in readiness execution |
| Context/config exclusion | Control snapshot guards read `costing.control_snapshot_*` settings; route/BOM guards read governed context flags; Marketing repricing uses transition table `new_rows`. These are existing runtime contexts, not missing relations or instructions to set production GUCs |
| Open frontier | 32 owned identity sequence configurations remain uncaptured because the cap was reached. Fresh bounded continuation and exact fixture/bootstrap script review are required before declaring setup closed |
| Unrelated excluded | Broad Auth/business/HR/financial datasets, vault secrets, cron/network schedules/configuration, unrelated schema dump, specialist refresh/acceptance writers and production cleanup |

No table-changing SQL occurs in the inspected 31-function read-source closure. Trigger bodies that stamp `NEW`, enforce immutable/status/lineage rules, or depend on session context still constrain fixtures. Existing lifecycle guards are dependencies, not a new WP04 activation rule. There is no demonstrated WP03 regression.

### Concrete setup/proof package for independent review

The proposal below is an ordered package with explicit prerequisites and stop conditions. **It is not an executable apply package:** target identity/cost/Auth mechanism and identity-sequence settings are still unresolved. No provisioning, marker/bootstrap, DDL, role/grant, fixture or candidate write is authorized by this preparation.

| Stage | Exact scope / order / required proof |
| --- | --- |
| S0-P1 — Close bounded structural frontier | Start only from the 32 relation/column entries in `identity_sequence_frontier`. Capture their owned sequence OIDs/config/dependencies in a fresh bounded read-only pass; resolve any newly exposed prerequisite before setup. Do not export `last_value` or silently add unrelated roots. Reconcile all captured root hashes again before any future apply |
| S0-P2 — Confirm target and provider capability | Previously proposed hosted target `wp04-readiness-proof` remains a recommendation only; parent production ref is `qhmoqtxpeasamtlxaoak` and must never be the write target. Obtain actual organization selection, provider cost quote/confirmation and separately authorized provisioning if this option is chosen. Confirm how that target obtains schema independently of the empty repository baseline; generic branch behavior does not prove its returned schema |
| S0-P3 — Resolve native Auth/API setup | Identify a supported branch-specific method for fresh test users/sign-in with no outbound email to real people. Capture API/DB/branch identity independently, provider configuration and API exposure. Existing connector inventory has not established Auth-admin/session-test support; keep this proof blocked until a supported mechanism is reviewed |
| S0-P4 — First-write bootstrap review | Freeze the exact isolated target/project/database/API identity allowlist and proposed marker definition/script. First marker creation requires its separately reviewed bootstrap because an existing-marker prerequisite would be circular. Check returned target identity independently, explicitly reject the production ref/endpoint, and record authorization plus rollback before this first write. No target or marker name/DDL is approved here |
| S0-P5 — Baseline schema load/reconciliation | Reconcile provider-managed Auth/roles first; if schema bootstrap is needed, create/reconcile approved schemas and required extensions, then base tables/identity/explicit sequences and exact composite types. Add constraints/indexes/policies with all referenced objects present. Build primitive/table-returning helpers, prerequisite views, view-rowtype-returning helpers, remaining read functions and trigger functions in dependency order; attach triggers before fixture data. Reconcile live owner/search_path/ACL/RLS/options and object fingerprints. Do not assume a function that compiles against empty tables represents a baseline |
| S0-P6 — Synthetic fixture package review/load | Freeze named cases, complete FK/lineage graph, exact insert order, any required existing governed session context and expected trigger effects before writes. Create only new native test actors/canonical permission rows through the supported mechanism. Use test-only master/policy/run/pool/workload/component/region/scheme inputs with synthetic names, amounts and notes. No invented production evidence or broad clone. Preserve guards; no blanket trigger/RLS disabling or copied production actors |
| S0-P7 — Baseline runtime/API proof | Run unchanged canonical and context readers against fixtures first. Verify full baseline outputs, permission behavior and absence of unexpected fixture side effects. Separate native Auth/API results from privileged catalog SQL. Reference dated live evidence only where the synthetic inputs actually reproduce it; synthetic parity is not a production-load or commercial-row-authority proof |
| S0-P8 — Candidate package/proof | Only after separate review and a ready baseline, ChatGPT applies the reviewed nonproduction G4 candidate directly through Supabase. Prove same-snapshot/context equivalence, permissions/filters/count grains, failure semantics, CSE-P01 plan sensitivity and bounded performance. Reconcile captured baseline hashes/ACLs, operation records and rollback before separate production-apply review. No current candidate apply approval |

**Minimum extension finding:** the inspected index opclasses require `btree_gist` (live version 1.7, schema `extensions`), alongside native `plpgsql` 1.0. The captured type/function/index footprint does not establish a requirement for pg_cron, pg_net, vault, hypopg, index_advisor, pg_trgm, citext, uuid-ossp or copying their live configuration. Review any newly discovered requirement instead of installing every production extension. Preserve exact exclusion-constraint/index behavior; do not replace it to ease fixtures.

**Fixture load discipline:** all referenced tables must exist before FK attachment; actual seed order follows captured FK and trigger/lineage prerequisites. Reference hierarchies/UOM/route-location metadata precede Products/SKUs and route/policy/BOM contexts; run/period evidence and pool/workload/component lineage precede allocation/control/regional evidence; acceptance requires an exact matching synthetic fingerprint. For immutable successful-run snapshots, freeze the exact permitted initial run state and transition order in the later fixture script; do not insert arbitrary SUCCESS rows then bypass immutable guards. Any cycle, additional required guard context or fixture-only side effect needs exact script review, not a new production business rule. No trigger disabling, refresh call or fixture load happened in this pass.

**Target/rollback safeguards:** every future operation after bootstrap must require both independent target identity checks and the reviewed test marker. Before a write, retain applicable definitions/ACL/options and exact transaction/rollback scope; stop on identity/hash drift. Test cleanup is confined to reviewed test objects/actors and requires its own exact scope; no production mutation or branch deletion is approved. Repository migration replay/local CLI installation is not a direct server-implementation prerequisite under DEC-014.

### Permission and proof matrix

Live catalog evidence confirms `authenticated`/`anon` are non-login/non-bypass-RLS roles; `service_role` and `postgres` bypass RLS. `authenticator` is non-inheriting. These privileged roles cannot stand in for native authenticated-user proof. Canonical readiness/latest-period/context functions are owned by `postgres`, SECURITY DEFINER with captured `search_path=public, costing, pg_temp`; their explicit ACLs allow postgres/authenticated/service_role, not anon. Preserve these properties for baseline comparison rather than blindly recreating managed roles or copying schema-wide default grants.

Current canonical readiness/latest-period checks permit `module:manage-products` **OR** `module:costing-control-center` view. The valuation-context reader's existing permission behavior must remain exact; it is not silently replaced by the OR rule. Permission truth remains `user_permissions_canonical` under the captured helpers. Candidate new readers remain the G3 stage-bound **Control Center view-only** proposal, not an applied grant/permission change. Current `costing` schema USAGE for authenticated and direct-view exposure (including SEC-P02) does not prove a safe new portfolio endpoint.

| Fresh test actor | Required proof after supported native Auth setup |
| --- | --- |
| Control Center viewer / editor | Read candidate only under reviewed CCC view boundary; view-only controls remain non-mutating; edit never creates bulk authority |
| Product-only viewer | Existing canonical/latest-period behavior preserved; candidate CCC-only denial if the exact reviewed candidate retains that boundary |
| Authenticated without module permission | Module-guard denial; do not mistake successful service-role SQL for permission proof |
| Anonymous / missing or invalid native session | Auth/EXECUTE/module boundary failures remain failures, not server UNKNOWN |
| Direct helper/API access | Audit exact exposed schemas and effective ACLs; no inferred access from role names. Preserve existing baseline; candidate internal helpers require their separately reviewed restriction |

Fixture cases must cover inactive/sample membership, no-SKU and active-no-active-SKU gaps without fake readiness; explicit governed periods; no successful run; success followed by failure; EXACT_RUN integrity mismatch; READY/review/blocker/UNKNOWN; policy ambiguity/missing evidence; regional eligible accepted/unaccepted/ineligible/stale-fingerprint evidence; filters using the same unresolved dependency incidence; payload/text allowlist and concurrent context/race behavior. CSE-P01 must retain multiple commercial snapshot variants without picking an authoritative row. A changed call site/plan must be compared; matching one fixture does not resolve the unordered-row authority problem.

No portfolio performance or live distributions were recomputed during this catalog-only pass. Prior timing/count evidence remains dated. Full selected-population counts and representative workload/concurrency proof still require the reviewed nonproduction package; synthetic fixture throughput cannot establish production equivalence.

### Classification, review disposition and exact next checkpoint

**REQUIRED NOW:** independent review of this resulting setup/proof package, the cap/frontier and stage prerequisites. **HIGH-RISK:** any later provisioning/cost/Auth/bootstrap/schema/ACL/fixture/candidate/production operation; none approved now. **FUTURE DEPENDENCY:** frontier continuation, confirmed isolated target, native Auth mechanism, exact bootstrap/fixture scripts, baseline and G4 candidate proof. **PARKED:** existing UX/NAV/CSE/SEC assignments unchanged. **OUT OF SCOPE:** production data transfer/mutation, new evidence authority, commercial row selection, Marketing editor, new top-level/client module, broad RLS/security repair or bulk remediation.

This is preparation evidence, not an independently reviewed setup result. G4-S0 remains [~] IN PROGRESS and G4 incomplete. Programme progress remains **4 of 13**. No new architecture/business/security decision lock or new parked finding; the HR/Marketing fixture side effects are required proof-package boundaries, not programme scope expansion. DEC-014 and WP03's closed contract remain intact.

**Exact next checkpoint:** `WP04-G4-S0 — Independent bounded-capture / setup-proof package review`. That review must classify whether and how to authorize the fresh 32-sequence read-only continuation, resolve target/Auth prerequisites and freeze any concrete setup scripts. It cannot mark the environment ready or authorize writes merely because this preparation was completed or committed. Stop here before independent review, provisioning or implementation.


## WP04-G4-S0 — Independent bounded-capture / setup-proof package review (2026-10-02)

Reviewed the actual pushed preparation at `93e3154a7a00f2a611db9bc626674d760604a765`, separately from its authoring checkpoint. Fresh fetch confirms main remains `47dcd80f69ca68fcca8f089bf40fa4099b376450`; branch is clean and WP03's verified tip remains an ancestor of main. Mandatory rules/programme/handover/parked/decision/closed-WP03 inputs and the prior S0/G3 boundaries were reconciled. Supabase skill and current connector operation descriptions were checked; no database query or provider operation was needed for this review.

**Review result: PASS WITH CORRECTIONS FOR ONE BOUNDED READ-ONLY CONTINUATION ONLY.** The preparation evidence and staged proof direction are accepted at audit/package-planning level after the corrections below. **HOLD:** provisioning, cost confirmation, Auth setup, bootstrap/fixture/candidate writes and production/client implementation. No environment-readiness or full-schema-closure approval. G4-S0 remains **[~] IN PROGRESS**; the resulting-package review checkpoint is complete after documentation corrections.

### Evidence verification and limits

- All three published files were read from the exact commit and reconciled with the local clean checkout. The manifest's 75 function MD5/SHA-256 fingerprints and 141 structural hashes were independently recomputed from the retained catalog/source capture; no mismatch. All 23 root fingerprints still reconcile to the earlier captured roots. These are dated source checks, **not a new live drift comparison**.
- Exact signature/object uniqueness, all captured function return types, table/view row types, column types, FK targets, trigger function identities and durable discovery-path targets reconcile. Counts remain 75 functions, 87 tables, 9 views, 45 explicit sequences and 109 types, totaling 250 relations/types; 32 frontier entries match the captured 32 identity columns and count-only evidence.
- Reconstructed the published source-reference closure: 31 functions / 54 relations (51 tables, 3 views). Inspected executable read-body candidates; the six `PERFORM` calls are the five existing policy resolvers and `public.require_permission`, already in the read closure. No table DML/dynamic EXECUTE/procedure CALL candidate in that inspected read closure. This supports the read-only classification, not runtime-equivalence, branch load-order or exhaustive native dependency proof.
- The disclosed four oversized metadata batches remain a governance deviation. Recorded compliant rechecks show no identity/structural/extension-membership difference; the deviation is neither erased nor relabelled as fully compliant. This review adds a mandatory combined-target batch guard for the next pass.
- Current connector inventory still does not expose an established native Auth-admin/session-test mechanism. `create_branch` explicitly describes applying all main-project migrations to a fresh target. Neither its description nor earlier empty repository baseline proves a side-effect-free or complete schema bootstrap. No actual cost, target/API state, runtime or authenticated proof was obtained.

### Superseding setup corrections

These corrections supersede any conflicting interpretation of S0-P1–P8 above; historical preparation evidence is preserved.

| Finding | Required correction / disposition |
| --- | --- |
| Source OIDs are not portable target identities | OIDs identify this capture/project only. Resolve target objects by schema-qualified name and exact argument types, then obtain target OIDs. Never use captured source OIDs as branch IDs or equality proof across databases. Source policy role OIDs likewise require actual role-name resolution; no copying numeric role IDs |
| Native and automatic row types | All 96 captured composite types are table/view row types; 13 other types are native pg_catalog base/pseudo types. Tables/views create their own row types. Do not independently CREATE TYPE for these automatic row types or reconstruct native types/managed Auth/roles. Match resulting columns/type identity/order by qualified names. Create the commercial view before its row-type-returning point helper, while creating that view's primitive/table-returning resolver prerequisites first |
| Full bootstrap/ACL fidelity remains incomplete | Hashes/counts are evidence, not executable DDL or an effective-privilege proof. Complete owned identity sequence configuration; inspect relevant index validity/readiness and constraint validation/deferability, plus scoped default privileges and role membership affecting baseline owners/API roles. Preserve baseline semantics without enabling RLS, granting access, creating roles or repairing production as part of this audit. Actual target schema/owner/ACL/RLS/options reconciliation remains required before fixtures |
| DDL/provider side-effect boundary | The 59 regular triggers are not an event-trigger audit. Inspect enabled setup-relevant DDL event-trigger metadata and bounded handler definitions before a future bootstrap decision. Separately review the chosen provider operation's automatic migration/seed/hook behavior **before provisioning**, not after unreviewed work has already run. If the operation cannot isolate/reconcile that automatic scope, hold it and review an alternative; do not assume the production project's empty repository migration file means empty server replay. No global event-trigger/network/cron/worker repair or disabling approved |
| Fixture writers are exclusions from readiness execution | The Marketing repricing and HR synchronization writers are not permission to omit/disable guards during baseline reproduction. Later exact fixture scripts must specify relevant insert/update/transition-table/run-state/session-context order, expected side effects and assertions in the isolated target. Do not centralize these writers or invoke them in this continuation. Synthetic HR/expense schema support authorizes no production records or new product surface |
| Permission/native Auth distinction | Original canonical/latest-period OR view checks remain exact. The captured valuation-context reader uses `require_permission('module:costing-control-center', false)` and remains CCC-only; Product-only canonical/latest success must not be generalized to valuation-context access. Provider role/SQL-claim simulation, captured ACLs and successful privileged catalog SQL cannot clear native Auth/API proof. Keep supported fresh-actor/session mechanism, actual API exposure and direct-helper tests open |
| Closure and batching claims | “Read-source closure” means inspected source/catalog reachability only. The 32-sequence frontier is known, not proof that no new prerequisites can emerge. Enforce a **combined** class-qualified target-object count across all branches of each aggregate query before executing it; splitting JSON result keys does not split a metadata batch. Stop on drift, cap overflow or an unapproved newly exposed dependency |

No architecture/business/evidence/security lock is added. Minimum discovered `btree_gist` / native PLpgSQL finding is retained as scoped evidence, not blanket extension-install approval. CSE-P01 remains unresolved, SEC-P01/02 remain separate, route codes stay unlinked, Marketing editing remains parked, and no WP03 regression is demonstrated.

### Frozen next package — one bounded read-only continuation

**Exact next action:** `WP04-G4-S0 — Identity-sequence frontier / setup-safety continuation`, directly by ChatGPT through Supabase. This review permits this read-only package only; do not perform it in the current review pass or advance into provisioning merely because its metadata is obtained.

1. **Entry / source reconciliation:** fetch main first and stop on movement under the established overlap rule. Use the 32 exact schema/table/column entries in the reviewed manifest as roots; confirm current table identity-column metadata and the 23 root source hashes in bounded batches. Source OID drift requires name/signature reconciliation; definition/authority drift requires reporting before proceeding. Do not reopen WP03 without a proven regression.
2. **Identity ownership/configuration:** discover only the 32 owned identity sequences through scoped pg_attribute/pg_depend/pg_class metadata. Discovery queries anchor at most 12 source identity columns so parent and child targets remain within the combined budget; later metadata batches may contain at most 25 combined anchored objects. Capture source sequence OIDs/qualified names/ownership/default dependencies and pg_sequence start/increment/min/max/cache/cycle/type plus owner/ACL/configuration hashes. **Do not read `last_value`, call nextval/setval or export current sequence values.**
3. **Existing baseline setup metadata:** inspect validation/readiness/deferability flags only for already captured constraints/indexes; inspect scoped pg_default_acl/schema ACL and pg_auth_members/role-name metadata only for owners/API roles that affect this baseline. This is structural privilege evidence, not an Auth identity/permission-row export or production-security repair. Use no pg_authid/password columns, production business/Auth/secret rows, blanket role/schema dump or grant/RLS/role mutation.
4. **DDL safety metadata:** first count enabled event triggers relevant to proposed schema/table/view/function/constraint/index/policy/trigger setup commands. Capture their event/tags/enabled/name/owner/handler identity; inspect at most **10 setup-relevant SQL/PLpgSQL handler definitions** in batches of at most 10, after sensitive-literal screening. Record native/provider handlers by identity/capability instead of executing them. If more than 10 definitions or further unrelated functions are needed, record the bounded frontier for another explicit review. No handler, dynamic SQL, network/cron/refresh/acceptance writer or provider migration operation may run.
5. **Package output / stop:** update the manifest with fresh dated sequence/setup evidence, exact discovery paths/hashes, role/automatic-type resolution notes and any remaining frontier. Update the WP/programme gate ledger. Prepare any resulting exact bootstrap/fixture-safety proposal for independent review; mark provider replay, target/cost/Auth/executable-script prerequisites open until actually established. Stop before provisioning, Auth setup, bootstrap or candidate application.

**Hard limits:** every query `BEGIN READ ONLY` plus local 10-second timeout. Definition batches <=10; metadata batches <=25 **combined class-qualified target objects**, including multiple aggregate result branches. Cap this new pass at **64 unique function signatures and 250 combined relations/types**, counting both reused and newly inspected scoped objects; retain a query/target-count ledger. Use count-only discovery before expansion where output size is uncertain. Do not reset the ledger mid-pass to evade a cap; report unresolved frontier rather than silently extending roots. No database-wide source dump or per-SKU readiness census. Raw safe definitions stay temporary; durable evidence remains hashes/identities/structural metadata. No paid target, installation, client change, production writer or repository merge.

### Review closure and remaining state

The resulting-package review checkpoint passes with these documentation corrections and the single read-only continuation above. Full baseline/setup closure, confirmed target/cost, native Auth mechanism, exact reviewed bootstrap/fixture scripts, nonproduction baseline/candidate proof and separate production-apply authorization remain open. No new parked item: the missing setup metadata is REQUIRED NOW for proof preparation, not an expansion of the portfolio product scope.

Current gate: `WP04-G4-S0 — Bounded capture/setup-proof package review passed with corrections`.
Exact next: `WP04-G4-S0 — Identity-sequence frontier / setup-safety continuation`.
G0–G3 remain complete at their documented levels; G4-S0/G4 remain in progress; programme remains **4 of 13**. This review made no live database query, provisioning, Auth/config change, server/client implementation, production mutation, merge, tag or release. Documentation branch stays unmerged; DEC-014 direct server ownership and WP03's closed upstream contract remain preserved.


## WP04-G4-S0 — Identity-sequence frontier / setup-safety continuation (2026-10-02)

Executed only the frozen read-only continuation from the preceding review. Fetched main first: unchanged at `47dcd80f69ca68fcca8f089bf40fa4099b376450`; clean documentation branch entry `4c6a657a1da5d5f402a7198a5e631f05b1af55b9`. ChatGPT used live Supabase directly under the installed skill/DEC-014. No environment was provisioned, no Auth/fixture/candidate was created and no server/client implementation occurred.

**Result:** the scoped continuation capture is complete and the **32-sequence frontier is resolved**. Resulting setup-safety proposal is ready for independent review. This is not full environment/operational closure or permission/runtime proof; G4-S0/G4 remain [~] IN PROGRESS.

### Fresh live findings and execution guard evidence

| Evidence | Result / boundary |
| --- | --- |
| Canonical roots | All 23 exact root signatures resolved with unchanged source OIDs and MD5 hashes. No observed core-authority drift or WP03 regression |
| Identity columns / sequences | 32 unique owned sequences resolved by qualified table/column and pg_depend ownership: 5 GENERATED ALWAYS / 27 BY DEFAULT. All are bigint, start/min/increment/cache 1, max `9223372036854775807`, no cycle. Bigint configuration is stored as decimal strings; no current sequence value or nextval/setval read |
| Existing baseline structural flags | 96 already captured tables/views reconciled; 336 indexes valid/ready/live; 640 constraints validated. One constraint is deferrable and initially deferred: `public.activities.fk_activities_kind`. Preserve it rather than setting all constraints deferred or bypassing guards |
| Privilege metadata | 15 scoped/immediately connected DB roles, 14 membership edges, three application-schema ACLs and six scoped default-ACL rows captured. No pg_authid/password, Auth users, canonical permission rows or business records read; first-hop role evidence is not an exhaustive role graph or native access proof |
| Provider DDL hooks | Six enabled setup-relevant event triggers and six SQL/PLpgSQL handler definitions inspected. Extension create/alter/drop tags were included because the existing minimum-extension proposal makes them relevant; no unrelated handler/authority recursively expanded |
| Batch/transaction guards | 22 catalog calls, every query READ ONLY with local 10-second timeout; combined metadata target maximum 24 against limit 25; definition batches 3 at most, six handlers total against cap 10. Queries were split before execution with a combined class-qualified target ledger; no continuation batching deviation |
| Per-pass scope | 29 unique function identities (23 roots + six handlers), 129 table/view/sequence/native-type identities; below frozen 64-function / 250-relation-type caps. Index/constraint flags are subordinate structural metadata anchored to existing tables/views, not additional schema-root expansion |

The manifest preserves original capture/frontier/batching history separately and adds `identity_setup_safety_continuation` with fresh root checks, exact sequence ownership/configuration fingerprints, per-relation flag counts/hashes/exceptions, role/default-ACL metadata, handler identities/config/ACL/source hashes and query/target/cap ledger. The old 32-entry frontier remains historical; the new section explicitly resolves it. Safe handler bodies and full flag/query capture remain temporary; no executable bootstrap or production records committed.

Cumulative catalog footprint across separately reviewed passes is now 81 function identities, 173 table/view/sequence relations (87 tables + 9 views + 77 sequences) and 109 catalog types previously inspected. This is not a reset inside one pass or a production-equivalent schema export. No source OIDs are portable target identities; automatic/native row-type and managed-role corrections remain applicable.

### Provider handler and privilege implications

| Existing handler / state | Observed side effect / required setup treatment |
| --- | --- |
| `extensions.pgrst_ddl_watch()` / `pgrst_drop_watch()` | DDL/drop handlers issue PostgREST `reload schema` notifications for relevant non-temporary objects. Target API/schema-cache behavior must be verified; never invoke these handlers manually or copy production notification/config state |
| `extensions.grant_pg_graphql_access()` | CREATE FUNCTION event hook conditionally manages GraphQL wrapper/extension membership and schema/function grants when its extension condition matches. Captured body is provider machinery, not application bootstrap SQL or authority to install pg_graphql |
| `extensions.set_graphql_placeholder()` | DROP EXTENSION hook can recreate a GraphQL placeholder wrapper for dropped GraphQL schema objects. Target rollback/teardown must account for provider-managed effects; no extension drop or cleanup approved |
| `extensions.grant_pg_cron_access()` | CREATE EXTENSION hook conditionally changes cron schema/object/default privileges for pg_cron. pg_cron is not a discovered readiness prerequisite; do not install it or copy live jobs/configuration by implication |
| `extensions.grant_pg_net_access()` | CREATE EXTENSION hook conditionally creates a provider role/grants and, for listed older pg_net versions, changes HTTP function security/search paths/permissions. No HTTP request occurred; pg_net is excluded from the minimal application baseline and this handler must not be replayed as custom SQL |
| Public default ACLs | For objects created by postgres or supabase_admin, captured defaults grant anon/authenticated/service_role broad public-table privileges, function EXECUTE and sequence privileges. A future isolated bootstrap/candidate cannot infer safe exposure from these defaults or copy them indiscriminately. Exact final owner/ACL/RLS/API-schema controls and module guards must be reviewed and applied transactionally; no current grant/RLS change or demonstrated authorization exploit |
| API role membership | Authenticator memberships in anon/authenticated/service_role have SET enabled and inheritance disabled; postgres/provider administrative memberships differ. SQL access as postgres/service_role cannot substitute for a real signed-in actor's API tests; do not reproduce managed role IDs or assume inherited claims establish module authorization |

The source event-hook set does not establish the future target's set or the provider operation's automatic migration/seed/hook scope. Inspect the selected target independently after separately authorized provisioning, and review that operation's automatic scope **before** creating it. No source operational-extension install, cron/network invocation, GraphQL wrapper creation, event-trigger disabling or security repair is approved here.

### Resulting setup-safety proposal for independent review

The prior S0-P1–P8 staging and superseding review corrections remain the plan. This continuation supplies the missing sequence/flag/privilege/hook evidence; it does not turn that plan into an executable apply package.

1. **Baseline reconstruction:** use the resolved 5 ALWAYS / 27 BY DEFAULT definitions and exact sequence configurations, with automatic table/view row types and qualified name/signature matching. Target source/sequence OIDs must be independently resolved. Preserve validated indexes/constraints and the one initially deferred FK; do not insert mutable sequence state from production, blanket-defer constraints or bypass fixture/lifecycle guards.
2. **Provider and permissions:** preserve provider-managed Auth/roles/hooks by reconciliation, not CREATE ROLE/handler copying. Freeze application bootstrap/candidate final ACLs/RLS/options and module checks against actual target defaults/API exposure; prevent broad default EXECUTE/table/sequence grants from becoming unintended endpoint/helper access. Existing readiness/latest OR checks and CCC-only valuation-context permission remain exact. No production-security fix is absorbed into WP04.
3. **First-write/fixture scripts:** retain separate reviewed first-marker bootstrap after independent target identity checks, then require marker plus target allowlist on every later write. Freeze exact baseline load order, nonproduction fixture inputs, mutable-to-immutable run transition/context settings and Marketing/HR trigger effects before seed approval. Source metadata alone cannot choose synthetic business evidence or remove a guard.
4. **Provider/target/Auth prerequisites:** hosted branch remains only a recommendation. Actual organization choice/cost flow, automatic server migration/seed/hook behavior, selected target identity, supported no-real-recipient native Auth provisioning/sign-in method and actual API exposure remain open. The empty repository baseline does not prove empty/safe provider replay. No supported mechanism or successful Auth session is claimed from connector inventory.
5. **Baseline/candidate proof:** unchanged canonical baseline first, equivalent synthetic observations next, separately reviewed candidate and rollback afterward. Preserve CSE-P01 ambiguity and caught policy errors; no commercial source-row selector, Product-wide READY, Marketing editor, new module, route URL or production-row transfer. Full count/performance/concurrency/payload/native access proof remains pending and cannot be inferred from validated indexes or metadata completeness.

**Remaining operational frontier:** provider automatic replay/seed/hook scope; target/organization/cost approval; supported native Auth/session/API mechanism; exact executable isolated bootstrap/fixtures; runtime/performance/equivalence/access proof and separate production application. There is **no remaining dependency frontier from the 32-sequence capture itself**. Future target checks or script preparation may expose a new scoped prerequisite; report it rather than assume complete operational closure.

### Classification and exact next checkpoint

REQUIRED NOW: independently review this completed continuation and resulting setup-safety proposal. HIGH-RISK: later provisioning/Auth/DDL/ACL/fixture/candidate/production operations, all still withheld. FUTURE DEPENDENCY: resolve the operational frontier and freeze executable target-specific setup/proof packages. PARKED: all UX/NAV/CSE/SEC assignments unchanged. OUT OF SCOPE: production data clone/mutation, provider-handler/security cleanup, financial/HR data transfer, Marketing/bulk writers, client implementation and new business/evidence rules.

No new parked item or permanent architecture/security/business decision: public defaults/provider hooks are required setup evidence, not a newly proven vulnerability or a new control-centre feature. No production mutation, branch provisioning, Auth/config change, client change, merge/tag/release or cleanup occurred.

Current gate: `WP04-G4-S0 — Identity-sequence frontier / setup-safety continuation completed; review pending`.
**Exact next gate:** `WP04-G4-S0 — Independent completed-continuation / setup-safety review`.
Stop after this capture/documentation checkpoint. G0–G3 remain complete at documented levels; G4-S0/G4 remain in progress; programme remains **4 of 13**; documentation branch unmerged; WP03 closed; DEC-014 direct server ownership preserved.


## Approved design / contract
G1 requirements are accepted at design-review level, with the superseding corrections and explicit feasibility/CSE-P01 constraints above. No exact API, schema, permission, refactor, source-row selection or implementation package is approved. G2 planning direction is accepted with the superseding corrections above; exact server/client packages remain for G3 review. No new architecture/business/evidence/security decision lock; DEC-014 separately clarifies execution ownership. G3 package-planning direction is accepted with the superseding corrections above; no environment, production apply or client execution package is approved. Exact candidate APIs remain stage-bound pending proof.

## Proposed gate sequence
The original skeleton had unnumbered audit, contract, implementation, focused verification, independent audit, merge and handover milestones. The sequence below refines it because the audited full-live contract/performance gap needs explicit contract, IA and package gates; conditional server work remains separately reviewed.

| Gate | Scope/status |
| --- | --- |
| WP04-G0 — Entry criteria / current-state audit | [x] COMPLETED AND VERIFIED at audit/documentation level |
| WP04-G1 — Portfolio readiness contract | [x] COMPLETED AND VERIFIED at requirements/design-review level after documentation corrections; implementation feasibility remains for G3 |
| WP04-G2 — Control-centre information architecture / remediation model | [x] COMPLETED AND VERIFIED at requirements/design-review level after documentation corrections; no implementation |
| WP04-G3 — Server/client package decomposition | [x] COMPLETED AND VERIFIED at package-planning level after corrections; no production/client execution approved |
| WP04-G4 — High-risk server package, if required | [~] Frozen continuation captured; 32-sequence frontier resolved; independent setup-safety review next; environment/setup/application not approved |
| WP04-G5 — Client implementation | [ ] Bounded reviewed contract; autonomous routine work only where applicable |
| WP04-G6 — Independent implementation audit | [ ] Audit pushed implementation, consolidate corrections |
| WP04-G7 — Authenticated/live verification | [ ] Context, severities, permissions, specialist destinations, performance; no manufactured production test data |
| WP04-G8 — Merge/post-merge closure and final handover | [ ] Explicit approval required; update progress only after verified closure |

## Current Gate
`WP04-G4-S0 — Identity-sequence frontier / setup-safety continuation completed; review pending`

## Gate Status
[~] IN PROGRESS — Frozen read-only continuation captured within its limits; 32-sequence frontier resolved and setup-safety metadata recorded. Independent resulting review pending; operational target/provider/cost/Auth/script/runtime prerequisites open. Prior batching history preserved. G0–G3 complete at documented levels. No approved/runnable environment, provisioning, candidate or production/client execution. Branch unmerged.

## Required to close
Independently review the completed continuation/setup-safety proposal and remaining operational frontier. Establish actual target/provider automatic-scope/cost consent, supported native Auth mechanism and exact reviewed isolated bootstrap/fixture scripts before applicable execution. Full environment/runtime/access proof remains absent; no environment-ready or privileged-SQL substitute claim.

## Next gate
`WP04-G4-S0 — Independent completed-continuation / setup-safety review`. Sequence frontier is resolved; operational setup/proof closure remains open. No provisioning/writes or GitHub/local-CLI prerequisite for direct server delivery.

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
1. G1/G2 reviewed membership and operational-default/all-existing presentation with explicitly coupled Product scopes and separate gaps. Route readiness currently uses Active Products; no reinterpretation of inactive lifecycle results is approved.
2. Can server retrieval share route/global-policy/context evaluation and preserve exact single-SKU equivalence without rebuilding business rules?
3. How should full LIVE_AS_OF dimensions be paired with persisted outcomes and missing-run coverage, with explicit current-success selector differences?
4. No canonical first-live-blocker scalar/priority or readiness issue-age authority exists; any proposed rule needs review.
5. Marketing acceptance has distinct permissions and monetary evidence; SEC-P02 must be considered before direct view reuse.
6. Existing partial route maps do not establish full WP01 navigation continuity.
7. Snapshot READY is not live READY; absence is not READY; failed refresh must not erase last-success proof.
8. Performance measurement is bounded and single-user; no approved SLA, concurrency proof or full census yet.
9. G3 proposes controlled period catalog and distinct readiness selector/race handling; exact implementation and integration remain subject to nonproduction proof and later apply review.
10. Candidate new endpoints use Control Center-only view while existing single-SKU/latest-period OR permissions stay unchanged; bulk boundary accepted at proof-plan level only; actual access tests still required.
11. No approved nonproduction environment or full-count/CSE/payload proof exists; no speculative production apply. Branch inventory is empty, local database tooling absent and repository baseline migration empty; S0 cannot assume migration replay reconstructs live architecture.

## Parked discoveries
SEC-P02 added at G0; existing parked items unchanged. DEC-014 records the user-approved server/client workflow clarification; no new architecture/business/evidence/security decision.

## Exit criteria / final handover
WP04 incomplete. G0–G3 verified at documented levels. G4-S0 frozen read-only continuation completed; 32-sequence frontier resolved, independent setup-safety review next, operational environment/proof prerequisites open. Documentation branch unmerged; no tag/release/merge or cleanup. This pass used 22 bounded read-only live catalog queries, with no business/Auth/secret rows, installation, provisioning or mutation. Existing business counts/timing observations remain dated evidence.

Workflow: direct ChatGPT/Supabase read-only preparation → exact setup/proof package review → separately authorized isolated setup → nonproduction implementation/proof → separate production apply → Cursor/Codex client implementation/push → ChatGPT audit/live verification → explicit merge/post-merge closure.
WP progress: G0–G3 complete at their levels; G4-S0 in progress, frozen continuation captured, independent review pending, environment not ready.
Programme progress: 4 of 13 unchanged.
Current gate: WP04-G4-S0 identity-sequence/setup-safety continuation.
Next: independent completed-continuation/setup-safety review; no provisioning or implementation.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02 unchanged; no new parked item.
Locked: canonical authority, lifecycle/readiness separation, fail-closed evidence, governed context, specialist ownership and DEC-014 execution ownership. No new lock from this review; WP03 closed.
