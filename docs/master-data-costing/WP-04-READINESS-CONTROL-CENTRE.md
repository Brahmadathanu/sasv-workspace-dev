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
| WP04-G4 — High-risk server package, if required | [x] COMPLETED AND VERIFIED — C contract committed and independently verified; native signed-in runtime proof explicitly deferred to mandatory G7; performance ACCEPTED WITH MEASURED LIMITATION |
| WP04-G5 — Client implementation | [ ] OPENING BOUNDARY FROZEN — reviewed client package ready; implementation not started |
| WP04-G6 — Independent implementation audit | [ ] Audit pushed implementation, consolidate corrections |
| WP04-G7 — Authenticated/live verification | [ ] Context, severities, permissions, specialist destinations, performance; no manufactured production test data |
| WP04-G8 — Merge/post-merge closure and final handover | [ ] Explicit approval required; update progress only after verified closure |

## WP04-G4 — Withdrawal of environment/tooling detour and scope correction (2026-10-04)

User explicitly instructed removal of the test-environment detour and safe reversion of related changes. This instruction supersedes its prior stage-specific plans and acceptances. Paid hosted project/branch proposals, cost/organization selection steps, private-input/actor-runner/launcher work and their extended planning/audit instructions are withdrawn. They are not WP04 requirements or approved next actions. Their history remains recoverable in Git; active documentation contains this concise disposition instead of carrying obsolete instructions. No new business/readiness/security rule is approved.

Removal scope: all detour files under supabase/tests/wp04 on both unmerged audit/test branches; WP-04-S0-CURSOR-TEST-RUNNER-PLAN.md, WP-04-S0-OPERATOR-LAUNCHER-PLAN.md and WP-04-S0-WINDOWS-PRIVATE-INPUT-PROOF.md wherever tracked on those branches. MASTER_PROGRAMME and this document corrected. No Git history rewriting, branch deletion, main merge or unrelated checkout cleanup. The recorded Windows temporary fake-console script and empty parent were subsequently removed after exact hash verification, as reported below. Other unmatched local copies remain unverified and withdrawn from use. Do not supply credentials to them.

Application/server audit: detour changed offline test tooling/docs only. No WP04 client application code, production schema/RPC/ACL/RLS/data, Auth actor/fixture, paid resource or background service was created/applied through this detour. Thus no production rollback or disabling of an existing module is required. Main remains 6e5d11ea2b7503931dbe4dcb840ec753ce8f986f; e-Aushadhi and closed upstream WPs remain untouched. The committed dependency manifest is retained only as dated read-only architecture evidence, not an executable baseline or an environment prerequisite. Its unrelated local invalid edit is preserved unchanged.

G0–G3 evidence and design/planning conclusions stand. G3's high-risk refactor is a proposed means, not permission to execute it or incur costs. Before implementation, reassess the minimum server change needed to deliver useful central visibility in the existing Costing Suite; distinguish existing snapshot/control visibility from canonical LIVE_AS_OF readiness. No duplicate top-level module, client readiness calculation, N-call portfolio fan-out, fabricated route link, bulk writer, lifecycle rule or silent scope reduction. Existing production supports bounded read-only analysis. Review the exact necessary server package, rollback and proportionate verification under DEC-014 before authorizing application. Replacing previously required nonproduction/native proof with an alternative needs explicit reviewed evidence; user withdrawal of the test tool does not turn missing proof into PASS or permit risky production experiments.

Only work necessary for the agreed WP04 outcome may interrupt the active gate. Do not reopen generic harness/console/catalog loops, propose paid infrastructure as a default dependency, or ask the user to make coding/security design decisions. Server analysis/review/application/verification stays ChatGPT-owned; client implementation stays Cursor/Codex-owned after its bounded package and proven server contract. Git is traceability for server work, not its delivery prerequisite.

## Current Gate
WP04-G5 — OPENING BOUNDARY FROZEN. G4 is formally CLOSED / COMPLETED AND VERIFIED. Reviewed client package and independent package review are frozen; implementation has not started and no Cursor/Codex task has been issued.

## Gate Status
[x] G4 COMPLETED AND VERIFIED. [ ] G5 implementation NOT STARTED; opening boundary/package frozen and reviewed. All G4 proof obligations are closed, accepted with measured limitation, or explicitly deferred under governance. Native Auth/API runtime remains mandatory G7 verification, not a waived proof. Programme remains 4/13 because WP04 itself is not complete until G8.

## Required to close
G4 has no remaining closure requirement. Before G5 implementation begins, use only the frozen/reviewed WP-04-G5-CLIENT-PACKAGE.md. Any discovered server/RPC/permission/auth/business-rule or broader architecture need stops G5 implementation and returns to review; do not invent a backend contract in the client.

## Next gate
WP04-G5 — Client implementation from the frozen/reviewed bounded package only. This checkpoint does not start implementation. After pushed implementation, WP04-G6 performs independent audit; WP04-G7 then performs mandatory authenticated/live context, permission/native API, navigation and performance verification; G8 alone can merge/close WP04.

## Server changes
None from the withdrawn detour. No production rollback needed.

## Client changes
None from the withdrawn detour. Offline test artifacts removed on unmerged branches; no application-client rollback needed.

## Verification and handover
Verify exact removal paths and corrected MD through remote readback, absence of active references to removed plans, unchanged main/upstream refs and preserved unrelated local edits. No application test rerun is necessary for deletion of unused offline tooling/document correction. Branches remain unmerged; no tag/release.

Workflow: concrete minimum package → high-risk review → authorized direct server implementation/live verification → bounded Cursor/Codex client package → independent audit.
WP progress: G0–G3 complete at documented levels; G4 active, WP04 incomplete.
Programme progress: 4 of 13.
Current gate: minimum server-package/verification review.
Next: concrete minimum server-package plan review.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02 unchanged.
Locked: canonical server authority, lifecycle/readiness separation, fail-closed evidence, governed context, specialist ownership and DEC-014 preserved; WP03 closed.


## Reported Windows cleanup closure — 2026-10-04
Cursor/user reports removal commits verified, isolated feature worktree fast-forwarded from 24746d6 to 016bd4585598ecf11fc6968bb625e21130ceb60c with tracked files clean, dirty original checkout unchanged. Exact recorded temporary script hash 99cbecd224f9b87955cab357da810955f4ccbbe1e7949e26471c94e030d8e7c3 verified before removal; script and empty parent directory removed. This is reported Windows evidence, not a local filesystem observation by ChatGPT. Two other Windows TEMP copies (wp04-fake-console-aqlux2x_ and wp04-fake-console-vafwc9mc) have unmatched hash aa9d2576… and remain unverified/untouched; untracked __pycache__ also remains. No blanket cleanup or claim all local copies were removed. They confer no execution authority and do not block WP04.

Independent fetch confirms main 6e5d11ea, docs removal dddff348 and feature removal 016bd458 unchanged. Infrastructure detour withdrawal and scoped cleanup closed; no further tool development/console/cost gate. Current/next WP04-G4 minimum required server-package and verification review unchanged. Programme 4 of 13; WP03 closed; DEC-014/parked/locks preserved; no production/provider mutation, credentials, merge/tag/release.


## WP04-G4 — Direct live Supabase minimum-package review (2026-10-04)

Entry fetch: main 6e5d11ea2b7503931dbe4dcb840ec753ce8f986f, docs fec4309dbeda7ee26b74d7cd9d869316a6ed8aef and feature-removal 016bd4585598ecf11fc6968bb625e21130ceb60c unchanged. Re-read IMPLEMENTATION_RULES, G3 accepted scope/constraints and current Control Center client dispatch. Followed installed Supabase skill. Connected target sasv-workspace / qhmoqtxpeasamtlxaoak / ACTIVE_HEALTHY / provider PG17 build 17.4.1.45. All SQL used BEGIN READ ONLY, SET LOCAL statement_timeout='10s' and ROLLBACK. No DDL/data/grant/RLS/Auth/fixture/cost/provisioning/refresh writer; transaction-local actor claim only for one authorized canonical sample. That is SQL inspection, not a native API login/denial proof.

Fresh findings:

| Evidence | Result / implication |
| --- | --- |
| Function inventory and full canonical/enrich/shared bodies | No full portfolio readiness reader; canonical remains one SKU + governed period/context. It calls whole Product-route readiness then selects Product; enrichment calls shared/global policy checks per SKU. No new authority or upstream regression found |
| Canonical definition MD5 | 0e966c3c1ab15d56420b234f5c2cef1f, matches committed dated manifest |
| Enrich definition MD5 | 65b40f9ac648ee077641c84eaee18497, matches committed dated manifest |
| Shared issues / route / commercial point-helper MD5 | 7467604a4929b59412181c3c7481e0e8 / 29835ce9be925dfe0afdea8133d8217a / 68bd9325062299eb8af1291bf4d9393b; current bodies remain reviewed authority, no modifications |
| Product/SKU population | 1342 Products (639 Active), 1793 SKUs (637 Active); OPERATIONAL membership 611; 516 Products without SKU; 179 Active Products without active SKU. Gap counts overlap and are not readiness verdicts |
| Context | Latest governed period September2026, valuation 2026-09-10; Run115 SUCCESS, newer Run116 FAILED. Canonical excludes FAILED and selects SUCCESS for period+valuation; existing snapshot selector uses per-period CAPTURED_AT_REQUEST SUCCESS. Still distinct contracts |
| Run115 base control rows | 489 READY + 147 REVIEW_REQUIRED =636. Frozen control counts, not full live-readiness population/severity totals; current public view can additionally overlay direct-labour route blocking |
| Existing client / public control view | sku-control-status reads v_costing_pricing_sku_control_status_snapshot; existing dashboard/workbench reused. Public view contains monetary columns and frozen outcomes, not all canonical foundation/dependency dimensions. Cannot be renamed full LIVE_AS_OF readiness |
| Bounded route EXPLAIN ANALYZE | Function Scan returned Product14, removed638 rows (639 assessed), one loop; execution2388.847ms, shared-hit214474/read336/dirtied1/written0. One observation, not SLA/concurrency/portfolio benchmark. Buffer dirtied statistic is not logical application-data mutation; transaction was read-only. Full N-SKU scan not run |
| Authorization | anon cannot EXECUTE canonical/latest-period; authenticated can. Internal readiness/route helpers not callable by anon/authenticated. Existing canonical body enforces auth.uid and Manage Products OR Control Center view. Supplied actor has both view permissions; no assignments changed |
| Canonical sample | SKU11 LIVE_AS_OF September, requested run null, evidence115: READY, five foundation/evidence/outcome dimensions preserved,17 dependencies,0 shared issues. No other full-payload/new permission proof inferred |
| Exact candidate reader names | Zero overload/name collisions for rpc_get_readiness_governed_periods, rpc_get_product_sku_readiness_portfolio, rpc_get_readiness_product_gaps. They do not yet exist |

**Review conclusion:** existing Control Center remains the placement; a client-only change or relabelled snapshot does not fulfill the accepted G1/G2 full-live scope. N per-SKU calls are inappropriate. G3's shared-evaluation server direction is still justified by live evidence. No smaller implementation has been proven to deliver the same contract; do not silently narrow it. No paid infrastructure/test-tool programme needed for this direct review, and withdrawn artifacts stay withdrawn.

Minimum package recommendation (already stage-bound in G3, not apply authorization):
1. Three bounded read-only public contracts: governed-period metadata, canonical portfolio readiness, separately labelled Product gaps. New readers enforce existing Control Center view; existing single-SKU/latest-period permissions unchanged. No new module/permission target/table/view/cache/job/writer.
2. Factor existing canonical base assessment and enrichment into private reusable helpers as specified by G3; share governed context, complete route result and applicable shared/global issues once per response. Existing canonical/enrich wrappers delegate while preserving public signatures and LIVE_AS_OF/EXACT_RUN payload/semantics. Keep commercial point-helper, unordered consumption and CSE-P01 unresolved; no row selection/index/order change. This is the necessary high-risk compatibility seam, not a second readiness calculator.
3. Existing Costing Suite gains the reviewed readiness lens only after server verification. Manage Products and specialist queues/editors remain upstream contracts. Owner/route text initially; no invented URLs or central specialist edits.

Verification still required: exact canonical old/new equivalence including no-run/EXACT_RUN and caught global exceptions; CSE candidate/consumption compatibility; nested payload/notes monetary exposure; complete scopes/filter witness/count/page semantics; actual denied/view-only access; complete statistics/page cost; atomic forward/rollback and unchanged upstream consumers. Existing SQL reads do not discharge those requirements. No proof-stage substitution, new environment or production experiment is authorized here. Any unresolved proof must be explicitly dispositioned in the exact package review, not concealed or translated into an automatic spending prerequisite.

Required now: prepare one exact atomic server SQL package with precondition hashes, complete affected definitions/ACLs/signatures, explicit rollback and bounded operation-specific verification plan for review under DEC-014. No application yet. Future dependency: reviewed server application/live verification, then G5 client package. High-risk: helper factoring/new RPCs/ACL/security-sensitive payload. Parked/out-of-scope unchanged.

Direct read-only reassessment COMPLETED at review/evidence level. Current gate: WP04-G4 — Exact minimum server-package preparation. Next checkpoint: WP04-G4 — Concrete atomic server-package and verification/rollback review. Programme4 of13; WP03closed; G0–G3 retained; G4active. No production mutation/spend/merge/tag/release; audit/test branches unmerged; unrelated local invalid manifest preserved.


## WP04-G4 — Exact atomic SQL draft prepared (2026-10-04)

The concrete unapplied package is recorded in [REVIEW.md](server-packages/wp04-g4/REVIEW.md), [forward draft](server-packages/wp04-g4/forward-draft.sql), [exact rollback](server-packages/wp04-g4/rollback-draft.sql), [captured source](server-packages/wp04-g4/source-before.json) and [package manifest](server-packages/wp04-g4/package-manifest.json). These files are review traceability under DEC-014, not a Git delivery prerequisite or authorization to execute SQL.

Scope follows the existing G3 proposal: replace two existing wrappers, add two private shared-composition helpers and three bounded public readers for governed periods, Product membership gaps and canonical SKU portfolio readiness. Existing Control Center remains the intended surface. No client code, tables, views, indexes, jobs, writers, permission assignments, lifecycle rules, route URLs or commercial evidence authority choices are introduced. New function EXECUTE grants/revokes are explicitly high-risk proposed package operations, not applied permission changes.

Fresh read-only source capture matches the recorded canonical/enrich definitions. Static checks confirm seven exact body fingerprints and rollback guards, retained EXACT_RUN branch, unchanged commercial point lookup expression and exact old-definition restoration text. Source whitespace is deliberately retained where required for exact captured definition identity. These checks do not establish PostgreSQL compilation, full JSON parity, native/API authorization coverage, CSE compatibility, full-catalog performance or forward/rollback rehearsal. All remain NOT_RUN. Arbitrary notes/nested payload remain uncertified nonmonetary; bounded note-pattern screening is only triage. No absent proof is converted to PASS.

The complete forward draft is atomic with source/ACL/attribute and name-collision guards, closed new ACLs and fixed search paths. Rollback rejects absent/drifted candidate bodies, restores exact captured wrappers and removes only package functions, without CASCADE or business-data cleanup. Independent review must settle payload conflicts and a proportionate concrete verification approach before application; the withdrawn paid-environment/offline-tooling programme stays withdrawn. No production experimentation is authorized by draft preparation.

Workflow: exact draft preparation complete → independent high-risk package/proof review → separately authorized direct server implementation/live verification → bounded client package → independent audit.
WP progress: G0–G3 complete at documented levels; G4 active; WP04 incomplete.
Programme progress: 4 of 13.
Current gate: WP04-G4 — Concrete atomic server-package draft prepared, independent review pending.
Next gate: WP04-G4 — Independent exact package/rollback/security/verification review.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02 unchanged.
Locked: canonical authority, lifecycle/readiness separation, fail-closed evidence, governed context, specialist ownership and DEC-014 preserved; WP03 closed. No production mutation, spend, merge, tag or release.


## WP04-G4 — Independent exact package review (2026-10-04)

Reviewed audit draft 2adcbfd against IMPLEMENTATION_RULES, DEC-014, accepted G3 contracts and fresh live read-only catalogs. Main unchanged at 6e5d11ea; six live authority hashes/owners/ACLs/config match; no new-function collisions. Result **CORRECTIONS REQUIRED; application HOLD**. Detailed evidence and one consolidated correction list are in [package REVIEW.md](server-packages/wp04-g4/REVIEW.md#independent-plan-review-at-2adcbfd-2026-10-04). SQL/source bytes unchanged by this review.

G4-R01: shared-issue summary currently omits actual scope/context/authority/evidence identity and associated SKU references required by G3. Grouping by code alone is insufficient; no live conflation proven with current one-row-per-code registry. G4-R02: strengthen whole package identity/postconditions and rollback preconditions beyond AS-body-only guards, including exact approved defaults/attributes/ACLs. G4-R03: compile/parity/CSE/native-access/payload/full-population-performance/rollback proof absent; explicitly settle proportional verification capability before apply, without withdrawn environment/tooling or speculative production experiment. These are bounded REQUIRED NOW package findings, not new parked enhancements or architecture decisions.

Expanded Run115 note triage covered 636 rows each in eight note areas plus 1,272 scheme notes; zero digit-bearing notes. Broader lexical pattern hits occurred for all636 QC notes and one control note; neither hits nor lack of digits prove monetary disclosure/safety. Arbitrary notes, commercial warnings and all nested payloads remain uncertified. Exact canonical payload/nonmonetary contract conflict cannot be silently resolved by masking fields. Existing public default function grants require atomic revokes; SQL catalogs are not native/API access proof. No upstream regression demonstrated; WP03 not reopened.

Workflow: review completed → bounded draft correction/proof disposition → reviewed authorization → direct server implementation/live verification → bounded client package.
WP progress: G0–G3 complete at documented levels; G4 active, WP04 incomplete.
Programme progress: 4 of 13.
Current gate: WP04-G4 — Exact package review completed; corrections required, application HOLD.
Next: WP04-G4 — Corrected package and concrete verification disposition review.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02 unchanged.
Locked: canonical server authority, lifecycle/readiness separation, fail-closed evidence, governed context, specialist ownership and DEC-014 preserved; WP03 closed. No production mutation, spend, merge, tag or release.


## WP04-G4 — Bounded correction and capability checkpoint (2026-10-04)

G4-R01/R02 are corrected in the unapplied draft; see [REVIEW.md](server-packages/wp04-g4/REVIEW.md#bounded-draft-corrections-and-verification-disposition-2026-10-04). Shared summaries preserve complete canonical issue/evidence identity, response context and distinct observed SKU references. Identical seven-function forward-post/rollback-pre identity checks cover bodies, defaults/arguments/settings/owners and full direct ACLs. Six non-portfolio AS bodies and exact captured restoration text are unchanged. Bounded READ ONLY literal aggregation and existing catalog-expression checks passed; they do not establish candidate execution or native/API parity.

G4-R03 is a genuine execution-proof blocker: connected project list exposes only production; development branches empty; no PostgreSQL runtime found in this workspace; candidate functions absent. No new infrastructure proposal/requirement, cost, actor/fixture or production DDL was introduced. SELECT-only existing access supports source/payload/baseline checks but cannot compile/invoke absent candidate functions or rehearse exact forward/rollback. A production rollback-only rehearsal remains unauthorized. Required proof cannot be converted into PASS; any alternative or change to proof prerequisites needs explicit independent review under the unchanged MD. No general environment/tooling loop is reopened.

Workflow: bounded draft corrections/checks complete → corrected-package acceptance/proof-boundary disposition → authorized server implementation/live verification → bounded client package.
WP progress: G0–G3 complete at documented levels; G4 not complete, blocked at pre-application execution-proof boundary.
Programme progress: 4 of 13.
Current gate: WP04-G4 — Corrected draft prepared; execution proof BLOCKED.
Next: WP04-G4 — Corrected package acceptance and explicit proof-boundary disposition review.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02 unchanged.
Locked: canonical authority, lifecycle/readiness separation, fail-closed evidence, governed context, specialist ownership and DEC-014; WP03 closed. No production mutation/spend/merge/tag/release; branches unmerged.


## WP04-G4 — Corrected source acceptance / exact limited rehearsal proposal (2026-10-04)

Main advanced from6e5d11ea to4f14852b8529c0e41f2e0ca20b4eb3519208aaec through b1416800 plus merge4f14852. Inspected sole added migration20261004105934_eaushadhi_composition_final_stage_partial_guard.sql: e-Aushadhi Composition final verification requires PARTIAL; no WP04/readiness/costing/lifecycle/programme-document overlap. User instructed proceed after reported reconciliation. No silent rebase/merge. New reference fetch unchanged; source hashes and period/evidence remain unchanged.

G4-R01/R02 corrected draft source review accepted, within the stated static/read-only expression scope. No SQL application or runtime acceptance. The remaining execution blocker is addressed by one concrete **pending** [rehearsal proposal](server-packages/wp04-g4/REHEARSAL_PROPOSAL.md), not a paid-environment/tooling programme. Its exact SQL is complete and bound by SHA2567d85ee676a6e6df358069a9406b0e26685b1b1efe4342a1aa68e337a6e46e11f.

It would temporarily define the seven functions in a single production transaction, compare SKU11/1795 LIVE and SKU11 EXACT115 JSON against same-observation baseline, invoke period/gap readers with limit1, test exact restore and ROLLBACK. It does not invoke portfolio; no broad census/native/API/performance/monetary-payload proof claim or waiver. Locks/load are possible; this is production DDL even without COMMIT. All details, safeguards, failure recovery and exclusions are in the proposal.

**NOT AUTHORIZED / NOT_RUN.** Existing prohibition on production rollback-only rehearsal remains in force until explicit approval of this exact target/digest/limited operation. Approval would be a narrow exception for partial evidence only, not deployment, additional work, COMMIT, client implementation, spending or a general change to MD proof requirements. IMPLEMENTATION_RULES, DEC-014, approved scope and parked/locked decisions remain unchanged; no CHANGELOG decision approved.

Workflow: corrected draft source accepted → specific rehearsal authorization decision → limited execution/readback only if authorized → remaining proof review → separately authorized server/client implementation.
WP progress: G0–G3 retained; G4 incomplete; execution/application boundary blocked.
Programme progress: 4 of 13.
Current gate: WP04-G4 — Corrected source reviewed; exact limited rehearsal proposal awaiting authorization.
Next: explicit approval decision; if approved, fresh reconciliation and one rollback-only execution/readback, then stop to review evidence.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02 unchanged.
Locked: canonical authority, lifecycle/readiness separation, fail-closed evidence, governed context, specialist ownership and DEC-014; WP03 closed. No production mutation/spend/merge/tag/release; branches unmerged.


## WP04 re-orientation and execution-state reconciliation (2026-10-04)

Actual current refs: main01ce609df1ca7dc2082a6ecc81e877b1cb15c1d0; entry published audit5f6711d63695bea51e511cb5bc1ee81a26066af7; withdrawn-tool branch016bd4585598ecf11fc6968bb625e21130ceb60c. Main has not moved again since the reported stop. Compared all intervening changes since6e5d11ea: e-Aushadhi-only migration, Composition client/worker/tests and its own MD; no WP04/master-data/costing/lifecycle/shared governance overlap. No rebase/merge.

Re-read main and approved audit-branch MASTER_PROGRAMME, IMPLEMENTATION_RULES, WORKPACK_HANDOVER_TEMPLATE, CHANGELOG_DECISIONS, PARKED_BACKLOG, WP04 and closed WP03. Main has older workflow records; approved unmerged audit MD retains DEC-014 and G0–G3 evidence. This is an unmerged workflow-record difference, not a new decision or permission to overwrite main. Published5f6711d had materially stale corrected-review/next-action wording because later work was local only. These records and the exact pending proposal are now made reviewable; no scope/rule/decision/backlog redesign.

Fresh direct READ ONLY server recheck: six canonical/source definition hashes match, no five candidate functions exist, September valuation2026-09-10/SUCCESS115 and reviewed DDL event-trigger digest match. No proposal execution, committed function change or client feature exists. Proposal valid against current repository/live inputs at this bounded check; fresh guards remain required before any authorized operation.

Current execution state: **VERIFICATION / high-risk PLAN**. G4 blocked at production-rehearsal authorization and remaining proof; not autonomous server/client implementation. One bounded Cursor/Codex **read-only repository verification** may check the frozen proposal/MD consistency and return consolidated findings, without changing files, committing, running SQL, using Auth/API credentials, installing tools or adding tests. This is supporting evidence requested by the user, not transferred server ownership or a Git prerequisite. DEC-014 keeps actual server execution with ChatGPT. G5 remains unavailable until a verified contract and bounded client package exist.

Immediate action: issue the exact repository-only verification prompt; server rehearsal remains NOT_RUN/NOT_AUTHORIZED. After that report, ChatGPT dispositions concrete findings and the separate approval request for the one exact rehearsal; no retry/provisioning/tooling loop and no silent proof waiver.

Formal closure obligation (user reconfirmed): at verified WP04-G8 closure, finish programme/WP documentation and required decisions/backlog/evidence, then generate a comprehensive handover prompt directing the user to start WP05 in a **new chat in the same Project**. Do not begin WP05 in this chat or imply WP04 is closed now.

Workflow: re-oriented exact state → supporting read-only repository verification → explicit server-operation authorization decision → verified server/client gates → formal closure/new-chat handover.
WP progress: G0–G3 retained; G4 incomplete and execution blocked; G5–G8 not delivered.
Programme progress: 4 of 13.
Current gate: WP04-G4 — Corrected package reviewed, pending exact rehearsal authorization/remaining proof.
Next: bounded repository-only verification handoff; no server/client implementation authorization.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02 unchanged.
Locked: canonical authority, lifecycle/readiness separation, fail-closed evidence, governed context, specialist ownership and DEC-014; WP03 closed. No production mutation/spend/merge/tag/release.

## 2026-10-04 — Authorized limited rehearsal and independent readback

User explicitly approved main80246db and exact frozen script digest7d85ee676a6e6df358069a9406b0e26685b1b1efe4342a1aa68e337a6e46e11f for one rollback-only production rehearsal. Fresh guards passed; one execution passed; separate readback passed with original source/access/settings, candidate count0 and observed idle WP04 transactions0. [REHEARSAL_RESULT.md](server-packages/wp04-g4/REHEARSAL_RESULT.md) records exact authority, metadata and proof limits. Earlier NOT_RUN/NOT_AUTHORIZED records remain historical; this explicit narrow authorization is now consumed. Portfolio was not invoked. Remaining G4-R03 proof/application HOLD; no future operation/client work authorized. G0–G3 retained; G4 incomplete; programme4/13; WP03closed; DEC-014 and parked/locked unchanged. Stop after assessment.

## 2026-10-04 — Resume after e-Aushadhi WP-06 closure

Actual main4a8525c and auditf3311b6 verified; 80246db→4a8525c contains only four e-Aushadhi documentation changes, no WP04 overlap. Prior limited rehearsal/readback PASS retained and authorization consumed. Fresh READ ONLY source/ACL/attributes/event guards PASS; candidates0; Septembervaluation09-10/SUCCESS115 and operational611/firstSKU1 retained. Two-sample current-canonical aggregation check PASS under READ ONLY; no candidate definitions or invocation. [PROOF_DISPOSITION.md](server-packages/wp04-g4/PROOF_DISPOSITION.md) records proof matrix and one exact pending first-operational-portfolio proposal. Production definition/invocation is necessary to measure an absent candidate; requires separate exact explicit authorization. No SQL mutation/client work occurred at this checkpoint. G4 incomplete; G5 blocked; programme4/13; WP03closed; DEC-014, parked/locked and formal-closure handover requirements unchanged.

## 2026-10-04 — First operational portfolio execution and restoration assessed

Explicit exact scriptc4477062 authorization consumed by one execution. Fresh main4a8525c/audita33fa48/source/context/membership guards PASS; OPERATIONAL611 invocation completed with bounded count/envelope/firstSKU1 parity PASS. Latency10822.426ms exceeds3s/5s goals (not SLAs); resultJSONBtext14491bytes. Original definitions/ACL/attributes/event state independently read back PASS; candidates0/idleWP04transactions0. [PORTFOLIO_RESULT.md](server-packages/wp04-g4/PORTFOLIO_RESULT.md) records exact metadata, limits and measured-performance next gate. No deployment, client, timeout or retry; earlier evidence retained. G4 incomplete/application HOLD; remaining proof unresolved; programme4/13; DEC-014/parked/locked unchanged. Stop; next measured performance disposition is source/read-only analysis and bounded plan review, not optimization/application approval.

## 2026-10-04 — Measured performance source/read-only disposition

Main4a8525c/auditadf1da1 unchanged. Source/catalogue and EXPLAIN without ANALYZE confirm611private core evaluations, nested repeated evidence reads, once-per-response context/route/global resolution and full-statistics coupling before page. Existing run/SKU indexes available; literal plans sometimes use context-range filtering; timing distribution unproved. Operational611SKUs/460Products,151 repeated Product references. [PERFORMANCE_DISPOSITION.md](server-packages/wp04-g4/PERFORMANCE_DISPOSITION.md) ranks hypotheses and proposes common-enrichment evidence reuse plus relational aggregation, with conditional batching excluded until measured justification. No functional SQL correction, DDL, index, config, runtime portfolio test or client work. Original authority guards PASS; candidates0; prior evidence retained. Current analysis gate complete, bounded high-risk plan review pending; G4 incomplete/application HOLD, G5 blocked, programme4/13; DEC-014/parked/locked unchanged.

## 2026-10-04 — Independent bounded performance-plan review

Fresh main4a8525c/audit72765077 unchanged. [PERFORMANCE_PLAN_REVIEW.md](server-packages/wp04-g4/PERFORMANCE_PLAN_REVIEW.md) accepts/fixes the bounded A/B plan at plan scope only: preserve SQL null/empty and RESOLVED_POLICY semantics; retain full population/context checks and core-once reuse; no implicit timing instrumentation or extra evaluation. Exact executable package/proof still needs preparation/review and any production operation new explicit authorization. Historical SQL/evidence unchanged; no live query or mutation in this review; G0–G3 retained, G4 incomplete/application HOLD, G5 blocked, programme4/13, DEC-014/parked/locked unchanged. No new architecture decision or parked finding.

## 2026-10-04 — Exact unapplied A/B correction and proof checkpoint

Main4a8525c/auditc6e1671 unchanged. [AB_PROPOSAL_REVIEW.md](server-packages/wp04-g4/AB_PROPOSAL_REVIEW.md) and separate corrected manifest bind new forward/restore/proof/readback artifacts. Only common enrichment and portfolio orchestration bodies change; historical source/SQL/evidence untouched. Offline models/source/embedding/identity checks pass; database runtime NOT_RUN. Limited proof refines bounded aggregation to extracted old/new query fragments over3stored canonical inputs, not a public portfolio invocation; no speed/root-cause/G4 claim.18canonical invocations and zeroportfolio proposed in one noCOMMIT/finalROLLBACK operation, pending explicit target/digest authorization; independent readback separately required. Source/metadata inspection read-only; no candidate definition/mutation or client work. G4 incomplete/application HOLD/G5blocked/programme4/13; DEC-014/parked/locked unchanged.

## 2026-10-04 — Shared-main reconciliation after e-Aushadhi WP07 G2

Main advanced4a8525c→e421fe8df9b98b4956acdcd4cadeb36a3f9b923c; auditbdfc845 matched. Inspected six commits/four final paths: two e-Aushadhi regulatory QC migrations/two e-Aushadhi docs only. No material WP04/costing/canonical dependency/shared-contract overlap. Fresh live catalogue source/attributes/event unchanged;candidates0/idleWP040; no proof rerun. [AB_PROPOSAL_REVIEW.md](server-packages/wp04-g4/AB_PROPOSAL_REVIEW.md#current-main-reconciliation-after-e-aushadhi-wp-07-g2-merge-2026-10-04) records exact lineage/object/permission disposition and provenance override: unchanged script digeste29d4c395a36070d2e03f5cb01c71e969198811f408b88fe44022145e549c669, new authorization maine421fe8df9b98b4956acdcd4cadeb36a3f9b923c. Executable SQL and prior evidence byte-identical; no merge/rebase/main mutation/client work; unrelated draft preserved. Gate unchanged: G4 incomplete/application HOLD, explicit correctness authorization pending,G5blocked,programme4/13; DEC-014/parked/locked unchanged.

## 2026-10-04 — Authorized A/B attempt failed; independent original-state PASS

User “proceed” authorized reconciled target/main/digest; fresh Git/live guards matched. Exactlyone execute_sql attempt failed SQLSTATE42883 in proof-script empty-population assertion text-vs-JSONB, first historical aggregation block before corrected stage. No retry; explicit restore/finalROLLBACK not reached. Separate read-only original six definitions/attributes/ACLs/event match;candidates0/idleWP040. [AB_CORRECTNESS_RESULT.md](server-packages/wp04-g4/AB_CORRECTNESS_RESULT.md) records failure/limits and consumed authorization. Static review missed operator typing; no final correctness result or partial PASS promoted. Frozen SQL and prior evidence intact; next narrow proof-script correction/review, new digest/auth before execution. G4incomplete/applicationHOLD/G5blocked/programme4/13;DEC-014/parked/locked unchanged.

## 2026-10-04 — Narrow proof-script V2 correction/review

Main e421fe8/audit283826a unchanged. NewV2script fixes onlytwo rows JSONB assertions; failedV1/candidateSQL/allprior evidence preserved. [AB_CORRECTNESS_V2_REVIEW.md](server-packages/wp04-g4/AB_CORRECTNESS_V2_REVIEW.md) freezes digestfafa65b083fe46fd93628857a3b6659e49d93c556791c25aa6dd28cd1737e23b with separate manifest; allotherbytes/18embedded CREATEbodies unchanged. Literal-only SELECT checks6cases/operator typesPASS; no businessdata/function/candidate/fullscript execution. Narrow review complete; renewed explicit authorization pending. V1authorizationconsumed;V2NOT_RUN, G4incomplete/applicationHOLD/G5blocked/programme4/13;DEC-014/parked/locked unchanged.

## 2026-10-04 — Authorized V2 bounded correctness/readback PASS

Userexplicitlyauthorized exactV2 main/target/digest;freshguardspassed;oneoperationcompleted atlimitedscope.18canonicalinvocations/5fullJSONcases+missingexceptions,6boundedextractedquerycases,10literalcases,2contextrefusals,exactrestoreguards/finalROLLBACK. Emptyregion1795fullJSONparity included;0portfolioinvocations/performanceNOT_PROVED/nativeAPINOT_RUN. Separateoriginalsixdefinitions/attributes/ACL/event readbackPASS;candidates0/idleWP040. [AB_CORRECTNESS_V2_RESULT.md](server-packages/wp04-g4/AB_CORRECTNESS_V2_RESULT.md) and sanitizedJSONrecord result/independentG4limits. Authorizationconsumed;no retry/deployment/client. Next smallestcorrectedOPERATIONALperformanceproposal preparation/independentreview, then newexplicitauthorization. PriorV1failure/evidence/frozenSQL preserved;G4incomplete/applicationHOLD/G5blocked/programme4/13;DEC-014/parked/locked unchanged.

## 2026-10-04 — Exact corrected performance proposal/review

Main e421fe8/auditae4eacd unchanged. [CORRECTED_PERFORMANCE_PROPOSAL.md](server-packages/wp04-g4/CORRECTED_PERFORMANCE_PROPOSAL.md) freezes scriptdigestc55b2a79d575fbdedf52cce810c826d99412ef5efbad16c1d37f018628cab72e,exactacceptedABbodies/fullidentity/restore,oneportfolio/oneoriginalSKUbaseline,unchangedtimeouts/noCOMMIT/finalROLLBACK/noretry/readback. Read-onlymembershipcount611/460Products/first1/identityMD5eeba4bf20f54589fe5b037173a79ed82/context115fresh;no readiness/portfolio call. NewscriptNOT_AUTHORIZED/NOT_RUN;combinedtiminggoals notseparatepathcertification. PriorV2PASS/failedattempt/historicalSQL/evidence preserved. G4incomplete/applicationHOLD/G5blocked/programme4/13;DEC-014/parked/lockedunchanged.

## 2026-10-04 — Authorized corrected portfolio measurement / restoration / disposition

WP04-G4 — Single explicitly authorized corrected OPERATIONAL portfolio test completed. Bounded count/context/envelope/first-row parity PASS; latency8,174.908ms versus historical10,822.426ms (24.46% observed reduction), still above3s/5s goals. Exact restore/ROLLBACK and separate original-state readback PASS; candidates0/idleWP040. Authorization consumed; G4 incomplete/application HOLD, G5 blocked, programme4/13. Next measured corrected-performance disposition/remaining-proof review; no new test/optimization/deployment/client authorization. Main e421fe8 unchanged; DEC-014 preserved. See [CORRECTED_PERFORMANCE_RESULT.md](server-packages/wp04-g4/CORRECTED_PERFORMANCE_RESULT.md) and sanitized JSON for exact evidence/limits. Frozen SQL/prior evidence preserved. Stop after assessment.

## 2026-10-04 — Corrected measured-performance / remaining-proof review

WP04-G4 — Corrected measured-performance/remaining-proof review COMPLETE at evidence/plan scope. Retain bounded correctness/restoration PASS and8,174.908ms observation;3s/5s goals missed, p95/all-existing/inner attribution unproved. Source confirms611private assessments with once-per-response route/shared/context; no new runtime test. Next exact bounded read-only existing-helper diagnostic proposal preparation/independent review, then separate explicit read-load authorization if accepted. G4 incomplete/application HOLD; G5 blocked; programme4/13; main e421fe8 unchanged; DEC-014/parked/locked preserved. [CORRECTED_PERFORMANCE_REVIEW.md](server-packages/wp04-g4/CORRECTED_PERFORMANCE_REVIEW.md) ranks residual hypotheses, preserves proof limits and recommends at most eight existing-helper measurements at proposal scope only. No SQL/livetest/candidate/configuration/authority change this checkpoint; unrelated draft/frozen evidence preserved.

## 2026-10-04 — Exact bounded existing-helper diagnostic proposal / review

WP04-G4 — Exact bounded existing-helper diagnostic proposal/review COMPLETE; explicit authorization pending. Eight fixed read-only helper wrappers planned, zeroportfolio/canonicalreadiness/candidate definitions, unchangedtimeouts/noCOMMIT/finalROLLBACK/separatemetadatareadback. Fresh catalog20functions/3views/originalstate and context/sample guards match; measured diagnostic NOT_RUN. G4 incomplete/application HOLD,G5blocked,programme4/13;main e421fe8 unchanged;DEC-014/parked/locked preserved. [HELPER_DIAGNOSTIC_PROPOSAL.md](server-packages/wp04-g4/HELPER_DIAGNOSTIC_PROPOSAL.md) and separate manifest bind exact read-only script/source/metadata readback. Nested QC resolver VOLATILE metadata retained; inspected source reads only. Runtime diagnostic compilation/execution remainsNOT_RUN; metadata readback is not timing proof. Prior SQL/evidence/localdraftpreserved; no new decision/backlog/permission change.

## 2026-10-04 — Authorized existing-helper diagnostic / readback / disposition

WP04-G4 — Single authorized read-only helper diagnostic completed8measurements; separate original-state readback PASS. Route/map1819.717ms/639Products,shared8.331ms,evidence2.441–6.773ms,commercial2.262–4.648ms across3samples; no portfolio phase attribution/extrapolation. Authorization consumed; no candidate/data/function change. Next focused residual-cost correction/proof plan preparation/review, source-only. G4 incomplete/application HOLD,G5blocked,programme4/13;maine421fe8 unchanged;DEC-014/parked/locked preserved. [HELPER_DIAGNOSTIC_RESULT.md](server-packages/wp04-g4/HELPER_DIAGNOSTIC_RESULT.md) and sanitized JSON record exact evidence/limits. Existing route/core/snapshot source comparison is the next planning action, not performed as part of this diagnostic. Frozen artifacts/prior evidence/localdraftpreserved; no new decision/backlog/permission change.

## 2026-10-04 — Focused residual-cost correction/proof plan and source review

Source comparison complete; [RESIDUAL_CORRECTION_PLAN.md](server-packages/wp04-g4/RESIDUAL_CORRECTION_PLAN.md) recommends six run-snapshot cohort inputs and one shared canonical builder. [RESIDUAL_PLAN_REVIEW.md](server-packages/wp04-g4/RESIDUAL_PLAN_REVIEW.md) accepts this bounded direction at plan scope only. It preserves row-presence/null/context/JSON behavior, original helper-summary differences and existing route/commercial/statistics contracts. The affected original run-evidence helper expands high-risk replacement/restoration scope and requires exact review, not automatic permission. No implementation or live query at this checkpoint; no forecast from three samples. Next exact unapplied C package and staged proof preparation, then separate source/rollback/security/proof review. Programme Immediate next action corrected because the previously requested performance operation was already completed. Historical evidence and frozen SQL untouched; all authorizations consumed; G0–G3 retained, G4 incomplete/application HOLD, G5 blocked; programme 4/13; main e421fe8 unchanged; WP03 closed; DEC-014/parked/locked preserved. No new decision or parked finding. Formal WP04 closure and mandatory WP05 new-chat handover remain future gates.

## 2026-10-05 — Exact unapplied C package/correctness proposal prepared

[C_PACKAGE_DRAFT.md](server-packages/wp04-g4/C_PACKAGE_DRAFT.md) and separate c-package-manifest.json bind source/forward/restore/identities/correctness/readback artifacts. Twelve definitions: original canonical/enrich/run-evidence replacements plus nine absent candidates, including four added private helpers; one shared typed snapshot assembler preserves evidence composition. Fresh read-only catalog22functions/threeviews/sixunique runkeys/candidate0 and bounded context611/460Products/SUCCESS115/membership matched. Structural identity/embedding/transaction/hash checks PASS only; SQL parser/runtime NOT_RUN. No business-function invocation, candidate creation, production mutation or portfolio test. Correctness proposal call budget explicit; full611 output, live no-success/present-null fixture, nativeAPI/performance/committed rollback gaps retained. Independent exact C source/rollback/security/correctness-proof review next; no execution/application authorization. Previous SQL/results and unrelated draft preserved; G0–G3 retained; G4 incomplete/application HOLD, G5 blocked; programme4/13; main e421fe8 unchanged; WP03 closed; DEC-014/parked/locked and mandatory formal-closure WP05 new-chat handover unchanged.

## 2026-10-05 — Exact C review / same-WP continuation handover

[C_EXACT_REVIEW.md](server-packages/wp04-g4/C_EXACT_REVIEW.md) completes the source/rollback/security/proof review at source scope. Direction retained; REQUIRED NOW proof findings C-R01 (full611six-input equivalence) and C-R02 (present-row/null-status composite boundary) prevent authorization request for the current correctness script. These are coverage omissions, not demonstrated production regressions, new architecture decisions or parked enhancements. Next one narrow new versioned correctness proposal with explicit provenance/load/calls/restore/readback review, keeping frozen C SQL and all history unchanged. No live SQL/test/production mutation at this review; G0–G3 retained, G4 incomplete/application HOLD,G5blocked,programme4/13; main e421fe8 unchanged; DEC-014/WP03/parked/locked/consumed authorizations preserved. User expressly requested [WP04_CONTINUATION_HANDOVER.md](WP04_CONTINUATION_HANDOVER.md) at this clean pre-operation stopping point because of chat length; it permits continuation of this same WP04 in a fresh chat in the same Costing Project, not a restart/new WP. Formal WP04 closure and mandatory WP05 new-chat handover remain future gates.

## 2026-10-05 — C-R01/C-R02 correctness correction V2 source review

Prepared `server-packages/wp04-g4/c-correctness-proposal-v2.sql` as a new version; original correctness SQL and all historical evidence remain byte-unchanged. Final SHA-256: `3ed866cbfff9be29b251c17ddf163b12f159ee96cb70738b6e58d2919e15a69f`. `C_CORRECTNESS_V2_PROPOSAL.md` freezes provenance/load/failure/readback boundaries. `C_CORRECTNESS_V2_REVIEW.md` records SOURCE REVIEW PASS only: C-R01 is 611 x six complete input-selection parity with exact context/type/multiplicity guards and zero evaluator calls; C-R02 is eight pure-literal typed-record projection cases covering absent/six single-source present-null/all-six present-null, complete JSON and seven drivers. Three proposal-only review defects were corrected before freezing. SQL parser/runtime NOT_RUN; no live SQL or production operation. Application HOLD remains; any attempt now requires fresh explicit digest-bound authorization and separate independent readback.

## 2026-10-05 — C correctness V2 authorized attempt consumed / failed

Fresh repository, target, script/readback digest, source, index, governed-context and 611-membership guards all passed. The single authorized V2 attempt failed with SQLSTATE `42702`: PL/pgSQL variable `n` was ambiguous with the `source_counts.n` CTE column in C-R01. No retry occurred. Mandatory separate independent readback immediately PASS: candidate_count 0, all 22 definitions match, existing owner/ACL/search_path attributes match, column shape/event/textual callers match, idle WP04 transactions 0. C-R01/C-R02 runtime proof therefore remains incomplete, but no production/source residue or readiness regression was demonstrated. Consumed V2 must remain immutable. Next bounded action is a new versioned repository-only proposal correction/review; any later execution needs a new explicit authorization.

## 2026-10-05 — C correctness V3 frozen and source-reviewed

New file `c-correctness-proposal-v3.sql` frozen at SHA-256 `ccb961faac0192b2cd3bcc4fd52ac2da1489ccad10f000e0dd6820360cb80eca`; source review PASS only, runtime NOT_RUN. V3 preserves V2 and frozen C history, fixes the observed C-R01 ambiguity via distinct/qualified row-count names, and fixes seven latent C-R02 expected-value references from bare `case_name` to `r.case_name`. Static boundaries: no COMMIT, final ROLLBACK, zero canonical readiness/portfolio calls, one temporary assembler CREATE/DROP, frozen assembler/helper/membership guards retained. Any runtime now requires a new explicit authorization bound to this V3 digest and target/current main.

## 2026-10-05 — C correctness V3 one-attempt runtime PASS

All fresh guards passed. C-R01: 611 operational SKUs × 6 sources = 3666 comparisons, mismatches 0, type mismatches 0, multiplicity failures 0, readiness/canonical/core/portfolio calls 0. C-R02: 8 cases PASS, six sources/seven drivers, complete JSON compared, no persisted fixtures, no claim of live present-null rows. V3 returned application_authorized=false, performance_proved=false, full611_final_output_parity=NOT_RUN. Exact frozen independent readback was attempted immediately but platform-blocked before reaching Supabase. Compact restoration reconciliation then PASS: candidate_count0, temporary assembler absent, canonical/enrich/run-evidence/shared/route/commercial-point identities match, idle WP04 transactions0. This does not substitute for a full frozen independent-readback PASS. G4 remains incomplete/application HOLD; G5 blocked.

## 2026-10-05 — Independent readback-only completion PASS

A separate read-only completion package was frozen at SHA-256 `42ff34e909251f22938dbb971a65d232cdc9938cd3d2dcb643092e63c620fc02`, source-review PASS, then executed after fresh main/target/key-source guards. It returned `overall_pass=true`: database/owner context, all22 original definition identities, attributes, candidate absence, event fingerprint, six-table column shape, textual callers and no idle WP04 transactions all PASS. Boundary fields confirm `mutation_performed=false`, `v3_replayed=false`, `portfolio_invoked=false`. This closes only the independent-readback evidence gap; the historical platform block remains recorded, V3 remains consumed, and other G4 requirements remain unresolved. G4 stays incomplete/application HOLD; G5 blocked.

## 2026-10-05 — CSE compatibility read-only reassessment PASS

Fresh live catalog identities for the commercial point resolver and underlying commercial-sales view match the frozen C guards. Mechanical source comparison confirms the current canonical and frozen C private live core use the same exact commercial point resolver call with SKU/period/valuation inputs; no direct view query, alternate ordering, batching or invented row-selection path exists in C. This closes the G4 CSE compatibility question at source/catalog level only. It does not resolve or waive parked CSE-P01; existing ambiguous-row authority remains unchanged. No commercial resolver invocation, canonical/portfolio execution, DDL/DML, performance work, application, deployment, G5 or client work occurred.

## 2026-10-05 — Payload / nonmonetary / monetary-note audit PASS

Read-only source/content audit only. Candidate governed-period and Product-gap readers are nonmonetary metadata readers; portfolio returns canonical readiness assessments plus nonmonetary filters/statistics. Common core/enrich construct no explicit monetary amount/value/cost fields. Regional Marketing monetary columns are not projected into evidence JSON. Shared issues expose only codes/status/owner/route/authority/evidence IDs. Run115 scan: 5088 non-null driver/control notes and 1272 selected-scheme notes showed no currency symbols or INR/Rs/rupee markers; existing cost/rate/value terminology is explanatory. Source-level portfolio permission remains costing-control-center view only, but native Auth/API behavior is not claimed. Payload/nonmonetary/monetary-note obligation is closed; remaining G4 obligations include native Auth/API, ALL_EXISTING/filter behavior, live no-success, full611 final-output parity, performance and committed deployment/rollback.

## 2026-10-05 — Live no-success context compatibility PASS

Read-only real-context/source proof. Governed June and March 2026 periods each have a valuation date and no matching SUCCESS refresh run. Current canonical source and frozen C source preserve the same null-run branch: no run substitution, no cohort evidence, no shared-issue enrichment, no synthetic driver rows, downstream control only when a run exists, and direct return of base LIVE_AS_OF composition. Candidate portfolio source similarly uses empty cohort input when v_run is null. No candidate/canonical/portfolio/business function was invoked. This closes the live no-success obligation at source + governed-context level only. Remaining G4 obligations: ALL_EXISTING/filter behavior, native Auth/API behavior, full611 final-output parity, repeatable performance, committed deployment/rollback.

## 2026-10-05 — ALL_EXISTING / filter behavior compatibility PASS

Read-only live-membership/source proof. Current Product/SKU tables: 1793 ALL_EXISTING, 611 OPERATIONAL, operational fingerprint `eeba4bf20f54589fe5b037173a79ed82`. Frozen C source passes reviewed scope/filter contract: ALL_EXISTING no lifecycle/sample exclusion; OPERATIONAL Active Product + Active non-sample SKU; population before filtering; full statistics before matched/page; supported severities only; max32 validated arrays; unsupported values error; UNKNOWN retained; NOT_REQUIRED excluded; same unresolved incidence must satisfy dependency+owner+route filters; OR within arrays/AND across categories; Product-name substring/exact SKU/Product ID search; keyset pagination and separate matched/returned counts. No portfolio/canonical/helper execution occurred. This closes ALL_EXISTING/filter behavior at source + live-membership level. Remaining G4 obligations: native Auth/API, full611 final-output parity, repeatable performance, committed deployment/rollback.

## 2026-10-05 — Full-611 final-output parity proposal frozen / authorization required

No remaining G4 obligation can now be honestly closed by source/catalog inspection alone. A narrower full-611 parity proof was prepared at SHA-256 `81e30181fb7f1958f2b75b218135f26de97b83ac86519e8d6c091ff6acdac753`. It preserves all closed proofs and avoids 611 public canonical calls: one reviewed common LIVE composition is evaluated in two arms over the exact 611 operational membership—current original enrich/point-evidence versus C cohort-envelope/C enrich—and complete JSON is compared. It creates five previously absent proof-only functions within one repeatable-read production transaction, uses one temporary table, performs substantial reads, has lock_timeout 2s / statement_timeout 15s / idle timeout30s, contains no actual COMMIT, explicitly drops proof functions and ends ROLLBACK. Source review PASS; execution NOT AUTHORIZED. Any guard drift/timeout/error/mismatch => no retry, restoration/readback and stop. Native Auth/API, performance and committed deployment/rollback remain later obligations.

## 2026-10-05 — Full-611 final-output parity runtime timeout; clean restoration

Authorized package SHA-256 `81e30181fb7f1958f2b75b218135f26de97b83ac86519e8d6c091ff6acdac753` was executed exactly once after all fresh guards passed. PostgreSQL cancelled the proof with SQLSTATE57014 at the unchanged15s statement timeout while the original arm was resolving sales-allocation default policy/commercial basis. No retry occurred. Independent readback immediately after returned overall_pass=true, all22 original definitions match, candidate/proof functions absent, attributes/columns/event/textual callers match and idle WP04 transaction count0. Therefore production restoration is clean, authorization consumed, and full611 final-output parity remains unresolved rather than failed-by-mismatch. No portfolio/performance/deployment/application/G5/client work occurred.

## 2026-10-05 — Full-611 compositional semantic parity PASS

Following the consumed timeout, a read-only proof-method reassessment determined that duplicated evaluation of the unchanged commercial resolver is not a valid C-specific oracle and is unnecessarily expensive. Mechanical equivalence review: canonical LIVE base vs C common LIVE base exact after same-authority route-row substitution; base JSON tail exact; original run-evidence vs C assembler scheme/regional CTEs exact; complete evidence JSON tail exact; original vs C enrichment transformation exact after equal evidence/shared acquisition is abstracted. Combined with closed C-R01 full611 live input parity and C-R02 typed projection parity, this excludes any final-output difference attributable to the C cohort refactor over the bound611 membership. Full611 C-induced semantic parity is therefore PASS compositionally. The timed runtime proof remains consumed/not completed/no mismatch/restoration PASS/no retry. Remaining G4: native Auth/API, performance, committed deployment/rollback.

## 2026-10-05 — Native Auth/API structural preflight PASS / runtime NOT RUN

Read-only current-catalog/source/client/session-class audit completed. Candidate readers are authenticated-only at ACL source level and enforce auth.uid + module:costing-control-center view in body; Product-only is intentionally not accepted for the new readers. Existing canonical single-SKU RPC remains authenticated with Manage Products OR Control Center permission. Current main has no calls to new reader names. Suitable existing session-bearing actor classes exist for positive and denial cases, without creating users or permissions. A real PostgREST test cannot see uncommitted transaction-local candidates, so genuine native proof requires temporarily committed definitions and later explicit rollback. No native API request, token extraction, mutation, deployment or rollback was performed.

## 2026-10-05 — Native Auth/API conditional authorization NOT CONSUMED

User granted a conditional native Auth/API proof authorization only if a genuine already-signed-in client/session execution path could first be confirmed without extracting, exposing, minting or manufacturing user credentials. Prerequisite check failed in the current execution environment: connected Supabase tools can inspect SQL/catalog/API configuration but cannot reuse an existing frontend user's authenticated PostgREST session, and a native request as that user would require obtaining a bearer JWT/token. This is expressly outside the authorization boundary. Therefore no temporary candidate RPC was committed, no native API request was sent, no rollback was needed, and the conditional authorization remains NOT CONSUMED. Current main remains exactly e421fe8df9b98b4956acdcd4cadeb36a3f9b923c. Native runtime proof remains blocked pending an execution surface that can operate within an already-signed-in app/session without exposing credentials. Performance and committed deployment/rollback remain unresolved; no G5/client work.

## 2026-10-05 — Native Auth/API gate disposition: defer runtime proof to G7

Authoritative gate table already defines G7 as Authenticated/live verification covering context, severities, permissions, specialist destinations and performance. Because genuine native API proof requires the signed-in application surface, native runtime proof is reclassified from G4 blocker to mandatory G7 verification dependency, not marked PASS. G4 freezes ACL/function authorization; G5 must not invent/bypass it; G7 must test allowed Control Center, Manage-Products-only denial with canonical single-SKU preservation, neither-permission denial, anonymous denial and private-helper denial; any failure blocks G8. Structural preflight PASS / runtime NOT RUN / conditional authorization NOT CONSUMED / no credential extraction remain exact.

## 2026-10-05 — C repeatable performance proposal frozen / authorization required

Performance cannot be deferred entirely to G7 because G4 Required-to-close explicitly requires residual performance feasibility before client handoff and the latest corrected historical portfolio remained ~8.17s, above goals. `c-repeatable-performance-proposal.sql` frozen at SHA-256 `bfcc9176b7745fb4e2e6ef0cbe357bba16c917c3d47ec7633d96a812c7c5a75f`, source review PASS. It embeds exact frozen C, runs exactly two OPERATIONAL September limit1 calls (each still assesses all611/full statistics), records aggregate latency/size/count flags, keeps statement_timeout15s, no timeout increase, no COMMIT, final ROLLBACK, no native API/client work. Fresh explicit authorization required; committed deployment/rollback follows only after accepted performance disposition.

## 2026-10-05 — C repeatable performance proof completed; feasibility goal missed

Fresh guards PASS and authorized performance package executed exactly once. Observation1 6938.008ms; observation2 5084.304ms; each OPERATIONAL limit1 while still assessing all611/full statistics, response14491 bytes, matched611, returned1, severity-total611. Both exceeded5s and3s. The near-5s second run is not rounded/relabelled PASS. No timeout increase, retry or optimization loop. Independent restoration readback overall_pass=true, all22 original definitions and attributes/callers/columns/event clean, candidates absent, no idle WP04 tx. Performance feasibility remains unresolved/NOT MET; deployment must not proceed as if accepted. Next is bounded feasibility disposition only.

## 2026-10-05 — Bounded performance-feasibility disposition (recommendation only)

Read-only source analysis after the consumed two-run proof: C already batches governed run evidence and evaluates shared/route only once per response. Remaining bounded orchestration cleanup (relationalizing assessed rows and removing full-population JSON round-trip/consolidating aggregates) is real but unmeasured and not reasonably evidenced to guarantee both runs <5s. Route reader remains ~1.82s/639Products but reducing it requires a new subset-aware Production Route contract or persisted route state. Full611 synchronous canonical assessment/statistics is therefore the fundamental remaining cost. G1 explicitly says <=3s page/<=5s statistics are provisional engineering goals, not approved SLAs. Recommendation Option2: accept current measured feasibility for WP04 with goals UNMET/NON-BLOCKING, keep G7 live performance verification, and treat deeper performance architecture as a separate decision/work item. Recommendation does not yet change the gate or threshold; explicit authority acceptance required before committed deployment/rollback is considered.

## 2026-10-05 — Performance disposition accepted; deployment gate opened

Server performance feasibility recorded as **ACCEPTED WITH MEASURED LIMITATION**. Exact evidence remains 6938.008ms and 5084.304ms for full611 OPERATIONAL/full-statistics; both above3s/5s provisional goals, which remain UNMET and non-blocking. No threshold is re-labelled as passed. Restoration PASS and consumed authorization retained. No more speculative G4 optimization. Architectural performance redesigns move to a separate future decision/work item; G7 retains mandatory signed-in/live latency verification. Proceed only to committed deployment/rollback review; no production application yet.

## 2026-10-05 — Committed C deployment/rollback package frozen; authorization pending

Final G4 server gate prepared without production execution. Permanent deployment `c-committed-deployment.sql` SHA-256 `cfc07ee0a731e11ba57e12d2edd3dea58c22bc05fc42c50446c9032a6132da12` is mechanically identical to reviewed C forward source except header + final COMMIT replacing proof ROLLBACK. Permanent rollback `c-committed-rollback.sql` SHA-256 `38024dab44f4bb513588142437e2f360fc90f35e4beb17437e3266faaa008d88` is mechanically identical to reviewed rollback source except header + final COMMIT. Independent post-deploy read-only verification `c-post-deployment-verification.sql` SHA-256 `35aba23abc2409a8c1bc9b434fbb36c337302e4883e1e4c1f811dff72b29658e` verifies exact identities plus governed-period/gap/single-read and one portfolio functional smoke; not native API/performance proof. Conditional rollback, if deployment verification fails, must be followed by existing independent old-state readback SHA-256 `42ff34e909251f22938dbb971a65d232cdc9938cd3d2dcb643092e63c620fc02`. Source review recommends exactly one committed deployment attempt with one conditional rollback attempt. No production execution yet; explicit authorization required.

## 2026-10-05 — Committed deployment verified PASS

The exact authorized committed C package is now active in production. Pre-deployment old-state readback PASS; deployment executed once/COMMIT succeeded; independent post-deployment verification returned candidate_identity PASS, governed_period_reader PASS, product_gap_reader PASS, canonical_single_read PASS and portfolio_full611_smoke PASS. Verification remained read-only and did not establish native API or new performance evidence. Conditional rollback was unnecessary and remains unconsumed. This closes the committed deployment/rollback server gate. Stop here before G5/client action; next gate transition requires assessment of G4 closure state and handoff conditions.

## 2026-10-05 — WP04-G4 formal closure / G5 opening boundary

Formal acceptance reconciliation completed after the committed C deployment. G4 obligations: C-R01 PASS; C-R02 PASS; independent readback PASS; CSE compatibility PASS with CSE-P01 parked unchanged; payload/nonmonetary/monetary-note PASS; live no-success PASS; ALL_EXISTING/filter PASS; full611 C-induced semantic parity PASS compositionally; performance ACCEPTED WITH MEASURED LIMITATION at exact 6938.008ms/5084.304ms with provisional3s/5s goals UNMET/NON-BLOCKING; committed deployment and immediate independent verification PASS; rollback path frozen and conditional rollback NOT CONSUMED. Native Auth/API structural preflight PASS; genuine signed-in runtime proof remains NOT RUN and is explicitly deferred to mandatory G7 because G7 is the designated authenticated/live application verification gate. No unresolved G4 blocker remains. G4 is therefore **COMPLETED AND VERIFIED**.

Current-main client reconciliation found no conflicting architecture drift. Frozen [WP-04-G5-CLIENT-PACKAGE.md](WP-04-G5-CLIENT-PACKAGE.md) and independent [WP-04-G5-CLIENT-PACKAGE-REVIEW.md](WP-04-G5-CLIENT-PACKAGE-REVIEW.md) define the only allowed G5 boundary. Objective: add one read-only Portfolio Readiness lens to the existing Costing Control Center consuming the deployed period/gap/portfolio readers with server-authoritative statistics, filters, keyset paging, gaps and read-only canonical detail. No client severity/totals/readiness calculation, no new module, no Product/Manage Products change, no specialist writer, no invented route link, no permission/server change. G5 implementation is **NOT STARTED** and no Cursor/Codex task has been issued.

## 2026-10-05 — WP04-G5 Cursor/Codex handoff issued; implementation not yet observed

Frozen G5 package/review were revalidated against exact main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c` and handed off durably as GitHub issue #43, **WP04-G5 — Frozen Portfolio Readiness client implementation**. The handoff pins package blob `7aa0a5acfc6bdfc9b8b2d0069bc73ce7fb301a2b`, review blob `cba0d79eb4d3793aeef96801aa4caf74a64cd43d`, DEC-011 execution rules, exact allowed files/checks, stop conditions and all G4/DEC-015 locks. The currently connected tool surface does not expose a Cursor/Codex launch/assignment action, so no coding agent was falsely claimed to have started. No client branch/edit/commit/push has yet been observed. G5 remains implementation-pending; once a Cursor/Codex branch is pushed, ChatGPT must independently audit the actual GitHub diff before any merge authorization. No G6/G7/merge/release started.
