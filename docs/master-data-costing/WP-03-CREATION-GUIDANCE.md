# WP-03 — Creation-Time Guided Completeness

## Objective
Design post-creation guidance that supports legitimate partial completion without faking READY.

WP03 determines how creation guides a user from Product creation, to a saved Product, to SKU creation, to a saved inactive SKU, to canonical readiness, and then to guided remediation. It does not move specialist downstream authorities into Manage Products, and it is not a wizard that requires every downstream dependency to be authored inside Product creation.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Entry criteria result
Satisfied. WP00, WP01 and WP02 are completed and verified. WP02 remains **COMPLETED, VERIFIED, MERGED AND CLOSED**. This audit did not find a WP02 regression and does not reopen WP02.

Audit repository: Git `main` `f22b36ca7077fcf70943112fb0aee6380af93e8d`. That SHA matches the independent fetch of `origin/main` for this gate. It had not moved from the pre-gate reference `f22b36ca7077fcf70943112fb0aee6380af93e8d`.

Live server evidence in this gate is read-only. No production row was inserted, updated, or deleted.

## Scope
Post-creation guidance after a Product and then an inactive SKU have been saved through the existing governed create contracts, using canonical readiness to show what remains. Legitimate partial completion stays incomplete. Manage Products-remediable master issues stay distinct from specialist downstream dependencies.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes. The OUT OF SCOPE list below is binding for this work pack.

## Current-state findings
### Repository and client
Current `main` Manage Products client is `js/products.js`.

- Product create uses `rpc_create_product`.
- SKU create uses `rpc_create_product_sku` and sends `p_is_active: false`.
- SKU activation uses the separate `rpc_set_product_sku_active`. SKU pack update uses `rpc_update_product_sku` and does not send an active flag.
- Readiness uses `rpc_get_product_sku_readiness` with `p_context_type = 'LIVE_AS_OF'`, the period from `rpc_get_latest_governed_cost_period_start()`, and `p_refresh_run_id = null`.
- SKU and Readiness lenses stay hidden until a saved Product is selected. `setWorkspaceTab` refuses `skus` and `readiness` when there is no selected Product or the screen is still in new-Product mode. SKU creation itself returns immediately unless `selectedId` is set.

Successful Product creation currently does this, and nothing more:

1. Call `rpc_create_product`.
2. Require the returned Product id.
3. Show `Product created successfully.`
4. Reload the Product catalog.
5. Leave new-Product mode and load the saved Product.
6. Leave the Product dialog in non-editing view.

Loading the saved Product makes the existing SKU and Readiness lenses available. There is still no structured post-create completeness journey, no guided first-SKU step, and no representation of a saved Product with no SKU as an explicit incomplete state. That is the central WP03 gap.

The browser form also applies local checks before the Product create RPC: loaded-catalog duplicate name by lower-case text, required Malayalam name, conversion required when base UOM is set, season profile required when Seasonal is checked, and non-negative lead time required when LLT is checked. Those checks are current client behaviour. They are not a new server contract, and the loaded-catalog duplicate check is not the server `normalize_key` duplicate rule.

### Live Product create contract
`public.rpc_create_product(p_item text, p_sub_group_id integer, p_malayalam_name text, p_status text, p_uom_base text, p_conversion_to_base numeric, p_is_seasonal boolean, p_is_llt boolean, p_manufacture_lead_time_months integer, p_season_profile_id integer, p_is_pto boolean, p_reason text, p_approval_reference text)` requires `module:manage-products` edit and an authenticated actor.

Live validation:

- Product name is required.
- Business reason is required.
- Status must be Active or Inactive.
- A valid existing Product subgroup is required.
- Base UOM and conversion-to-base must both be supplied or both be null.
- Base UOM, when supplied, must be `Kg`, `L`, or `Nos`.
- Conversion-to-base, when supplied, must be greater than zero.
- Manufacture lead time, when supplied, cannot be negative.
- A supplied season profile must exist.
- Duplicate names are rejected by `public.normalize_key`.
- Creation is written to `public.product_master_audit`.

The server deliberately permits a Product to be created with base UOM and conversion both omitted. This gate does not add a mandatory server rule for those fields.

The audited function does not reject a blank Malayalam name. The current client form does. G1 does not change either side.

### Live SKU create contract
`public.rpc_create_product_sku(p_product_id bigint, p_pack_size numeric, p_uom text, p_is_active boolean, p_is_sample boolean, p_reason text, p_approval_reference text)` requires `module:manage-products` edit.

Live validation:

- Product identity is required and the Product must exist.
- Pack size must be present and greater than zero.
- UOM must be non-blank.
- Business reason is required.
- Duplicate Product + pack size + UOM identity is rejected.
- Creation is written to `public.product_sku_master_audit`.
- The inserted active flag is `coalesce(p_is_active, false)`.

Manage Products sends `p_is_active: false`. A new SKU from this surface therefore remains Inactive. Activation stays a later explicit action through `rpc_set_product_sku_active`. The live activation function does not mention readiness and does not require a READY result.

### Canonical readiness
`public.rpc_get_product_sku_readiness(p_sku_id bigint, p_period_start date, p_context_type text, p_refresh_run_id bigint)` remains the only readiness authority for this work pack.

Product Master use stays:

- `LIVE_AS_OF`
- explicit server-governed period
- null refresh-run id

Live behaviour confirms `LIVE_AS_OF` requires `p_period_start` and rejects a non-null refresh-run id. Direct read of `costing.cost_periods` at this audit shows latest `period_start` `2026-09-01`. The unauthenticated SQL role cannot call `rpc_get_latest_governed_cost_period_start()`; that is the existing permission boundary, not a missing period source. Manage Products already obtains the period through that RPC when an authorized user is signed in.

The RPC returns lifecycle, summary dimensions, dependencies, shared issues and downstream control status. Summary fields include `product_master_foundation_status`, `sku_master_foundation_status`, `costing_foundation_status`, `evidence_quality_status`, `costing_outcome_status` and `overall_severity`.

For `LIVE_AS_OF`, the current foundation predicates are:

- Product master is `RESOLVED` only when base UOM is non-blank and conversion-to-base is greater than zero. Otherwise it is `BLOCKED`, with reason `PRODUCT_BASE_UOM_CONTEXT_INVALID`, owner `MANAGE_PRODUCTS`, route `MANAGE_PRODUCTS`.
- SKU master is `RESOLVED` only when pack size is greater than zero and UOM is non-blank. Otherwise it is `BLOCKED`, with reason `SKU_PACK_CONTEXT_INVALID`, owner `MANAGE_PRODUCTS`, route `MANAGE_PRODUCTS`.

Both null base UOM and conversion are therefore valid creation and still incomplete Product-master foundation when readiness is later evaluated. Omission is not READY.

Readiness is SKU-scoped. A saved Product with no SKU has no canonical readiness result. That state is a legitimate incomplete journey. It is not a create error and it is not READY.

Downstream costing-foundation dependencies already carry their own codes, owners and routes. Audited examples begin with `PM_BOM_REVISION`, `BATCH_SIZE_REFERENCE`, `MANUFACTURING_ROUTE`, `MRP_POLICY` and `SELLING_PRICE_POLICY`. WP03 surfaces the server-supplied owner and recommended route. It does not rebuild that dependency logic in JavaScript, and it does not host those specialist editors.

The WP02 LIVE_AS_OF commercial-sales performance helper remains in place. This gate does not alter it.

### Live inventory
Read-only counts at this audit, unchanged from the recorded WP02 inventory:

| Condition | Count |
| --- | ---: |
| Products | 1342 |
| Active Products | 639 |
| Inactive Products | 703 |
| Other Product status | 0 |
| SKUs | 1793 |
| Active SKUs | 637 |
| Inactive SKUs | 1156 |
| Active Products with no SKU | 54 |
| Active Products with no Active SKU | 179 |
| Products failing the current Product-master foundation predicate | 0 |
| Active Products failing that predicate | 0 |
| SKUs failing the current basic SKU-master foundation predicate | 0 |

The foundation counts use the live `LIVE_AS_OF` predicates above. They show that a present, foundation-valid master record is a separate fact from SKU existence, SKU activation and costing readiness. Historical rows are not rewritten to normalise those states.

## Prevent vs Guide vs Specialist vs WP04
| Boundary | What it covers in the current architecture | WP03 treatment |
| --- | --- | --- |
| Prevent | The existing create RPCs already reject an invalid Product or SKU: missing identity, invalid status, invalid subgroup, inconsistent or non-positive base conversion, negative lead time, unknown season profile, duplicate Product name, missing or non-positive pack, blank SKU UOM, and duplicate pack identity. | Preserve these server rules. Do not add a new creation prohibition in order to make readiness green. |
| Guide | After a valid save, tell the user what remains: no SKU yet, inactive SKU, Manage Products master gaps, or server-supplied downstream issues. | This is the WP03 guidance contract to freeze in G2. Missing evidence stays incomplete. UNKNOWN is not READY. |
| Specialist | PM-BOM, batch size, manufacturing route, pricing policy, batch/costing drivers and other non-Manage-Products dependencies. | Show the server owner and recommended route. Do not move those editors into Manage Products and do not generate their data automatically. |
| WP04 | Portfolio readiness queues, cross-product remediation, the central control centre and bulk remediation. | Future dependency. Do not implement it here. |

## REQUIRED NOW
1. Preserve the existing Product and SKU server validation at creation, including legitimate omission of base UOM and conversion when both are null.
2. Introduce a future post-create guidance contract after Product creation. The current success toast, catalog reload and selection of the saved Product are not that contract.
3. Represent a saved Product with no SKU as a legitimate incomplete journey, not as an error and not as READY.
4. Preserve creation of new Manage Products SKUs as Inactive.
5. After SKU creation, use `rpc_get_product_sku_readiness(...)` to guide what remains.
6. Distinguish Manage Products-remediable master issues from specialist downstream dependencies.
7. Surface the owner and recommended route supplied by the server instead of recreating dependency logic.

## FUTURE DEPENDENCY
**WP04 — Central Master Data / Costing Readiness Control Centre**

Portfolio-wide remediation, cross-product readiness queues, central control-centre behaviour, bulk remediation and similar functionality belong there. They are not part of WP03.

## PARKED ENHANCEMENT
Preserved from WP02 closure. They are not WP03 scope.

### WP08
Broader Product / Master Data navigation rationalisation.

### WP11
Remaining Manage Products visual density, dialog ergonomics, narrow-layout polish and broader visual hardening. This is UX-P02.

### Costing/commercial-sales evidence governance
Commercial-sales LIVE_AS_OF row authority remains ambiguous when multiple snapshot rows exist for one SKU/period. WP03 does not choose a snapshot row.

## OUT OF SCOPE
- EXACT_RUN / history browser.
- Client-side readiness computation.
- Automatic Product-to-SKU or SKU-to-Product activation.
- Automatic generation of downstream specialist master data.
- Moving PM-BOM, production route, pricing policy, batch-size, costing-driver or other specialist editors into Manage Products.
- Guessed or defaulted business master data merely to make readiness green.
- Portfolio-wide WP04 functionality.
- Unrelated e-Aushadhi work.
- Aesthetic WP11 redesign.

## Activation-policy boundary
No rule of the form "SKU may activate only when canonical readiness is READY" exists in the current activation RPC, and none is approved here.

Creation validity, master completeness, operational activation and costing readiness remain distinct. WP03 may later present readiness prominently before activation. Changing activation eligibility because of readiness would be a new high-risk business and server rule and would require an explicit Plan, independent review and implementation decision. G1 does not encode that rule.

## Approved design / contract
Not yet approved. G2 must freeze it before any application implementation.

## Milestones
- [x] WP03-G1 — Current-state / creation-flow audit
- [ ] WP03-G2 — Creation-guidance design/contract
- [ ] WP03-G3 — Implementation package decomposition
- [ ] WP03-G4 — Implementation
- [ ] WP03-G5 — Independent implementation audit
- [ ] WP03-G6 — Authenticated/live verification
- [ ] WP03-G7 — Merge/post-merge/documentation closure

## Gate ledger
### WP03-G1 — Current-state / creation-flow audit
Document current Product/SKU creation architecture, live contracts, current behaviour, scope boundaries and classification.

Status: [x] COMPLETED AND VERIFIED from the repository and read-only live evidence in this package.

### WP03-G2 — Creation-guidance design/contract
Freeze the future UX/business contract for immediately after Product creation, first SKU creation, immediately after SKU creation, readiness/remediation presentation, the period before activation, legitimate defer/partial completion, and navigation to specialist authorities.

No application implementation until G2 is approved.

Status: [ ] NOT STARTED

### WP03-G3 — Implementation package decomposition
Determine exact client/server packages after G2. Prefer the current server contracts. Any newly discovered server, schema, authorization or business-rule requirement remains high-risk and requires Plan, independent review, then implementation.

Status: [ ] NOT STARTED

### WP03-G4 — Implementation
Routine bounded client work may use autonomous implementation only after G2 and G3 establish the contract.

Status: [ ] NOT STARTED

### WP03-G5 — Independent implementation audit
The pushed GitHub implementation is audited independently.

Status: [ ] NOT STARTED

### WP03-G6 — Authenticated/live verification
Representative creation and remediation journeys are verified.

Status: [ ] NOT STARTED

### WP03-G7 — Merge/post-merge/documentation closure
Closure only after explicit approval.

Status: [ ] NOT STARTED

## Current Gate
`WP03-G1 — current-state / creation-flow audit` is completed and verified. The work pack remains open.

## Gate Status
[x] WP03-G1 COMPLETED AND VERIFIED

[ ] WP03-G2 NOT STARTED

## Required to close
G1 is closed by the evidence in this document. Closing WP03 still requires G2 through G7. Do not treat this work pack as complete.

## Next gate
`WP03-G2 — Creation-guidance design/contract`

## Server changes
None in this gate.

## Client changes
None in this gate.

## Tests / verification
Read-only live signature, validation, foundation-predicate, inventory and period checks, plus repository inspection of `js/products.js` and the WP01/WP02 contracts. No application tests were required because no application code changed. Results are recorded in the findings above.

## Decisions created
None. Existing DEC-002, DEC-003, DEC-006, DEC-008 and DEC-009 already lock server-authoritative readiness, the separation of Active from costing readiness, and inactive-by-default SKU creation as a WP02 contract. This gate does not add a new decision.

## Risks
- A post-create screen could be mistaken for a second readiness calculator.
- A saved Product with no SKU could be shown as an error or as READY.
- Guidance could be implemented by guessing missing specialist data.
- Readiness could be turned into a new activation prerequisite without a separate approved business rule.
- Portfolio queues or specialist editors could be pulled forward from WP04 or later work packs.
- The existing LIVE_AS_OF performance correction could be reopened while changing presentation only.

## Parked discoveries
UX-P02, broader Product / Master Data navigation, and commercial-sales LIVE_AS_OF multi-row authority remain parked as recorded above and in PARKED_BACKLOG.md. No new parked discovery was created by this gate beyond recording those existing items in the programme backlog.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current. G1 evidence alone does not meet work-pack exit.

## Final handover
Not started. The next chat starts at WP03-G2 and must not implement application behaviour until the G2 contract is approved.

## Repository audit record
- Audited `main`: `f22b36ca7077fcf70943112fb0aee6380af93e8d`
- Documentation branch: `docs/wp03-g1-creation-guidance-audit`
- Overlap with `docs/master-data-costing/` or Product/SKU lifecycle since the pre-gate SHA: none, because `main` had not moved.
