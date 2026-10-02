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
The routine creation-guidance contract is frozen in `WP03-G2 — Approved creation-guidance design/contract` below. Three changes stay outside routine implementation until a separate approval: the Malayalam-name requirement, any new Product-status policy that defaults or forces Inactive at creation, and any rule that refuses SKU activation unless readiness is READY.

## Milestones
- [x] WP03-G1 — Current-state / creation-flow audit
- [x] WP03-G2 — Creation-guidance design/contract
- [x] WP03-G3 — Implementation package decomposition
- [x] WP03-G4 — Implementation — pushed
- [x] WP03-G5 — Independent implementation audit — PASS
- [x] WP03-G6 — Authenticated/live verification — COMPLETED AND VERIFIED
- [ ] WP03-G7 — Merge/post-merge/documentation closure

## Gate ledger
### WP03-G1 — Current-state / creation-flow audit
Document current Product/SKU creation architecture, live contracts, current behaviour, scope boundaries and classification.

Status: [x] COMPLETED AND VERIFIED from the repository and read-only live evidence in this package.

### WP03-G2 — Creation-guidance design/contract
Freeze the future UX/business contract for immediately after Product creation, first SKU creation, immediately after SKU creation, readiness/remediation presentation, the period before activation, legitimate defer/partial completion, and navigation to specialist authorities.

No application implementation belongs in G2. The frozen contract is the input to G3.

Status: [x] COMPLETED AND VERIFIED at documentation level from repository and read-only live evidence. The guidance contract is frozen. The Malayalam-name requirement change remains a separate high-risk decision and is excluded from routine implementation.

### WP03-G3 — Implementation package decomposition
Determine exact client/server packages after G2. Prefer the current server contracts. Any newly discovered server, schema, authorization or business-rule requirement remains high-risk and requires Plan, independent review, then implementation.

Status: [x] COMPLETED AND VERIFIED at documentation level. Routine G4 is one client-only package. No server, permission, or business-rule change is required.

### WP03-G4 — Implementation
Routine bounded client work may use autonomous implementation only after G2 and G3 establish the contract.

Status: [x] COMPLETED AND PUSHED. No server change. Malayalam-name requirement, Product status at creation, and activation eligibility are unchanged. Implementation commit `1337556808dec39523c10655f1f7db1b50220f94`.

### WP03-G5 — Independent implementation audit
The pushed GitHub implementation is audited independently.

Status: [x] PASS. No correction pass was required. The audited implementation commit is `1337556808dec39523c10655f1f7db1b50220f94` on `feat/wp03-g4-creation-guidance`. `main` remained `f22b36ca7077fcf70943112fb0aee6380af93e8d`. Files audited: `js/products.js`, `public/sw.js`, `scripts/product-sku-lifecycle-smoke.mjs`, `docs/master-data-costing/WP-03-CREATION-GUIDANCE.md`, and `docs/master-data-costing/MASTER_PROGRAMME.md`.

### WP03-G6 — Authenticated/live verification
Representative creation and remediation journeys are verified.

Status: [x] COMPLETED AND VERIFIED. Authenticated journeys that already exist in live data passed. Scenarios that would require manufacturing data or permissions stay on the G5 static proof. No production test mutation.

### WP03-G7 — Merge/post-merge/documentation closure
Closure only after explicit approval.

Status: [ ] NOT STARTED

## Current Gate
`WP03-G6 — Authenticated/live verification` is completed and verified. The work pack remains open until G7.

## Gate Status
[x] WP03-G1 COMPLETED AND VERIFIED

[x] WP03-G2 COMPLETED AND VERIFIED at documentation level

[x] WP03-G3 COMPLETED AND VERIFIED at documentation level

[x] WP03-G4 COMPLETED AND PUSHED at `1337556808dec39523c10655f1f7db1b50220f94`

[x] WP03-G5 PASS. No correction pass required. `main` remained `f22b36ca7077fcf70943112fb0aee6380af93e8d`.

[x] WP03-G6 COMPLETED AND VERIFIED

## Required to close
G1 through G6 are recorded. Closing WP03 still requires G7. Do not treat this work pack as complete.

## Next gate
`WP03-G7 — Merge/post-merge/documentation closure`

## Server changes
None in this gate.

## Client changes
None in this gate.

## Tests / verification
Read-only live signature, validation, foundation-predicate, inventory and period checks, plus repository inspection of `js/products.js`, `manage-products.html` and the WP01/WP02 contracts. G2 added read-only Product-field population, Malayalam nullability, and readiness route-code checks. No application tests were required because no application code changed.

## Decisions created
None locked. G2 preserves the existing create, activation and readiness contracts. The Malayalam-name requirement is an open high-risk decision and is not recorded as LOCKED. A proposal to default Product creation to Inactive, or to forbid Active at creation, is also not locked.

## Risks
- A post-create screen could be mistaken for a second readiness calculator.
- A saved Product with no SKU could be shown as an error or as READY.
- Guidance could be implemented by guessing missing specialist data.
- Readiness could be turned into a new activation prerequisite without a separate approved business rule.
- Portfolio queues or specialist editors could be pulled forward from WP04 or later work packs.
- The existing LIVE_AS_OF performance correction could be reopened while changing presentation only.

## Parked discoveries
UX-P02, broader Product / Master Data navigation, and commercial-sales LIVE_AS_OF multi-row authority remain parked. G2 adds NAV-P02: canonical `recommended_ui_route` codes have no Manage Products URL map. Display the server text. Do not invent links.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current. The G2 contract does not meet work-pack exit.

## Final handover
Not started. The next chat starts at WP03-G3 and decomposes the routine client package. It must not implement the excluded high-risk decisions, and it must not start application implementation inside the G2 chat.

## Repository audit record
- Audited `main`: `f22b36ca7077fcf70943112fb0aee6380af93e8d`
- G1 documentation commit: `0f01cec1e62c8a212e4cc86bdfa35eb798c6116c` on `docs/wp03-g1-creation-guidance-audit`
- G2 documentation branch: `docs/wp03-g2-creation-guidance-contract`, based on that G1 commit
- `main` had not moved at the G2 fetch. No overlap required reconciliation.

## WP03-G2 — Approved creation-guidance design/contract

This contract governs future Manage Products creation guidance. It uses the existing Products, SKUs and Readiness lenses and the existing Product, SKU and Readiness dialogs. It does not add a launcher tile or a second readiness calculator.

Normative words mean: MUST and MUST NOT are binding for routine implementation; SHOULD is the preferred behaviour when more than one safe presentation exists; MAY is optional.

### 1. Product create field contract

| Field | Contract |
| --- | --- |
| Name | MUST remain mandatory. The server requires a non-blank name and rejects a duplicate `normalize_key`. |
| Malayalam name | See the mismatch conclusion below. Until that decision is approved, routine implementation MUST NOT change either the client `required` flag or the server rule. |
| Category, sub-category and product group | The server create RPC does not receive these as separate arguments. The client uses them to choose a subgroup. They MUST remain the client path to a valid subgroup. |
| Sub-group | MUST remain mandatory. The server requires an existing subgroup. |
| Status | MUST remain an explicit Active or Inactive choice. See the lifecycle conclusion below. |
| Base UOM and conversion-to-base | MUST remain optional together at creation. Both supplied or both null is the server rule. When both are null, later canonical readiness reports Product-master foundation `BLOCKED`. The create form MUST NOT be given a new prohibition that forces these fields. |
| PTO | Optional flag. The column defaults false and the RPC stores the supplied boolean. It is not a Product-master foundation predicate. |
| Seasonal | Optional flag. The server stores it and does not require a season profile merely because it is true. |
| Season profile | Conditionally required by the current client when Seasonal is checked. The server requires only that a supplied profile exists. Routine implementation SHOULD keep that client pairing. |
| LLT | Optional flag. |
| Manufacture lead time | Conditionally required by the current client when LLT is checked, and it must be non-negative. The server rejects a negative supplied value and allows null. Routine implementation SHOULD keep that client pairing. |

Governance reason remains mandatory for the create call. Approval reference remains optional. Those are existing governance fields, not new master fields.

### 2. Malayalam-name mismatch conclusion

**HIGH-RISK DECISION REQUIRED. Not locked.**

Evidence used:

- `products.malayalam_name` is nullable. `rpc_create_product` and `rpc_update_product` do not reject a blank value. Update stores a trimmed value, which may be empty.
- Product identity and duplicate detection use the Product name through `public.normalize_key`, not the Malayalam name.
- Of 1342 Products, 1341 have a non-blank Malayalam name. The one blank row is Product 1060, status Inactive. All 639 Active Products have a non-blank Malayalam name.
- Views and other modules project the column, including `v_product_details` and `v_sku_catalog_enriched`. That projection does not add a non-null rule.
- The Manage Products form and the pre-RPC client check mark Malayalam Name required. The Product register also shows the column.

The server contract treats Malayalam name as optional descriptive metadata. It is not required to create a Product identity. The browser requirement is stricter than the server and is not itself the business rule.

Closing the mismatch needs a choice that this gate does not make:

- making the field optional in the form, which changes what a user must type today; or
- making the server reject a blank value, which is a new server validation rule.

Neither choice is approved. Routine WP03 implementation MUST leave both sides as they are. The decision needs separate human review before any client or server change.

### 3. Product create lifecycle / status treatment

Product creation MUST continue to offer an explicit Active or Inactive choice, with no preselected status. That matches the live selector, which starts at `-- Select --`, and the server rule that status is only Active or Inactive.

Live evidence does not justify a new rule. Product Active does not imply a SKU. The catalog already contains Active Products with no SKU, and the server accepts Active at creation.

Defaulting a new Product to Inactive, or refusing Active at creation, is **HIGH-RISK DECISION REQUIRED** and is not part of this contract. Routine implementation MUST NOT add either behaviour.

### 4. Post-Product-create behaviour

After `rpc_create_product` returns an id, the Product MUST stay saved even if the user leaves immediately.

The client MUST keep the current success sequence: toast, catalog reload, select the saved Product, and leave the Product dialog out of edit mode. It MUST NOT open a wizard that has to be finished before the Product exists.

When the saved Product has no SKU, the SKUs lens MUST become the quiet next step. It uses the empty state in section 5. The existing actions are:

- **Add SKU**, for an edit user, as the next structural step;
- the existing Product dialog, already open in view mode, when the user wants to continue Product details;
- **Close** on that dialog when the user wants to finish later. Closing MUST NOT roll back the Product.

### 5. Product-with-no-SKU guidance

A saved Product with no child SKU is an entity state. Canonical readiness is SKU-scoped, so this state MUST NOT call `rpc_get_product_sku_readiness` and MUST NOT show READY, REVIEW_REQUIRED, BLOCKER, BLOCKED or UNKNOWN.

The SKUs lens MUST say, in substance:

> Product saved. No SKU exists yet, so SKU readiness has not been assessed.

An edit user MUST see the existing **Add SKU** action. A view-only user MUST see the same sentence without Add SKU, plus the view-only wording in section 14.

This state is not an error and not a failed RPC.

### 6. SKU create contract

SKU creation MUST keep the current fields only: pack size, UOM, Sample, business reason, and optional approval reference.

The create call MUST send `p_is_active: false`. The server insert MUST remain the authority, including its inactive default when the flag is omitted.

The form MUST NOT add PM-BOM, route, batch size, MRP, selling policy, scheme, commercial evidence, or costing-driver fields.

### 7. Post-SKU-create behaviour

After a successful `rpc_create_product_sku`, the client MUST reload that Product's SKUs, select the new SKU, and request canonical LIVE_AS_OF readiness for it.

The user MUST be told that the SKU was created and that its lifecycle is Inactive. The existing toast may carry that sentence. The existing Readiness lens and Readiness dialog are the only readiness surfaces. The SKU dialog MAY point to that Readiness dialog. It MUST NOT render a second copy of the dependency list.

The user MAY close the dialogs and leave the SKU Inactive and incomplete.

### 8. Readiness display contract

For each saved SKU, Manage Products MUST render the canonical payload it already consumes:

- lifecycle Active or Inactive from the SKU row;
- `summary.overall_severity` as the primary status, without upgrading or downgrading it;
- the dimension statuses already shown on the Readiness register;
- the governed period label;
- dependency and shared-issue rows that are not READY, RESOLVED or NOT_REQUIRED, using server status, reason, note, owner and route.

REVIEW_REQUIRED, BLOCKER, BLOCKED and a server UNKNOWN MUST stay those values. A client failure uses section 15 and is not one of those values.

### 9. Manage Products remediation treatment

A dependency whose `owner_module` or `recommended_ui_route` is `MANAGE_PRODUCTS` is remediable in this module. The current examples are Product master (`PRODUCT_BASE_UOM_CONTEXT_INVALID`) and SKU master (`SKU_PACK_CONTEXT_INVALID`).

For an edit user, the guidance MUST lead to the existing Product dialog or SKU dialog. The client MUST NOT re-code the server predicate. The server dependency is what classifies the issue as in-module.

These rows SHOULD appear before specialist rows in the existing remediation list. That order is presentation only. It MUST NOT change severity.

### 10. Specialist dependency treatment

Other dependencies stay specialist. Current route codes supplied by the readiness RPC and its costing helpers are:

`PM_BOM_MANAGER`, `BATCH_SIZES`, `PRODUCTION_ROUTE_MANAGER`, `MRP_GOVERNANCE`, `SELLING_SCHEME_POLICIES`, `COMMERCIAL_SALES_ASSUMPTIONS`, `DRIVER_GOVERNANCE`, `MATERIALS_STORES_ACTION_QUEUE`, `QC_ACTION_QUEUE`, `REGIONAL_MARKETING_REVIEW`.

The UI MUST show the server status, reason, owner and route text, continuing the current `Resolve in:` line.

Manage Products MUST NOT write specialist data and MUST NOT embed those editors. It MUST NOT build a portfolio queue.

There is no client map from these codes to a page URL. A link MUST NOT be invented. Click-through is NAV-P02 and stays parked for WP08. `REGIONAL_MARKETING_REVIEW` also remains UX-P01: the server route may be shown, and the missing acceptance screen is not built here.

### 11. Pre-activation guidance treatment

**Activate** remains an explicit governed action through `rpc_set_product_sku_active`.

The existing activation confirmation MUST show, when a canonical payload for that SKU is already loaded:

- the SKU is Inactive before the action;
- the server overall severity;
- the governed period;
- a plain statement that activating the SKU does not set costing readiness to READY.

When no payload is loaded, the confirmation MUST say that readiness is unavailable. It MUST still allow the governed activation.

The control MUST NOT be hidden or disabled because severity is BLOCKER, BLOCKED, REVIEW_REQUIRED or UNKNOWN.

A hard stop that allows activation only when readiness is READY is **HIGH-RISK BUSINESS RULE — separate approval required**. It is excluded from routine WP03 implementation.

### 12. Defer / resume treatment

Completion in one sitting is optional. The saved Product, its SKU rows and the canonical readiness call are the only resume state. The client MUST NOT store a wizard step.

On a later visit the user selects the Product and reads:

- no SKU: the entity sentence in section 5;
- one or more SKUs: each row's Inactive or Active lifecycle and that SKU's server severity;
- a failed readiness call: section 15 on that SKU only.

### 13. Multiple-SKU treatment

Each SKU keeps its own lifecycle, pack identity, readiness payload and remediation.

The post-Product-create hint about a first SKU applies only while the Product has zero SKUs. After that, **Add SKU** creates another Inactive SKU. Completeness MUST NOT be collapsed into one Product READY flag in JavaScript. A Product-level rollup needs a future server contract and belongs with WP04, not this lens.

### 14. View-only treatment

`module:manage-products` view access may inspect Products, SKUs and readiness. Edit access is required to create, save or activate.

A view-only user MUST NOT see Add SKU, Create SKU, Save SKU, Activate, Product save, or Product deactivate. Owner and route text MAY be shown as description. Guidance MUST NOT say that this user can fix the issue in place.

The existing view-only banner remains.

### 15. Readiness-unavailable treatment

If the readiness call fails, the period is missing, or the payload is empty, the SKU row MUST remain visible with its lifecycle. The readiness text MUST be `Readiness unavailable`.

The UI MUST NOT replace that failure with READY, BLOCKER or a locally computed status. A retry MAY be offered by opening the existing Readiness dialog again. Server `overall_severity = UNKNOWN` is a payload value and MUST be shown as returned. It is not the label for a failed call.

### 16. Period-context treatment

Every SKU readiness display MUST show the period returned by `rpc_get_latest_governed_cost_period_start()`. The call MUST use `LIVE_AS_OF`, that period, and a null refresh-run id.

The client MUST NOT use the browser's current month. EXACT_RUN stays out of Manage Products. The no-SKU sentence is not a readiness result and MUST NOT be given a fake period verdict. The period label MAY remain visible so a later SKU is understood to use that period.

### 17. Navigation and action hierarchy

Ordinary create stays on Product identity, classification, measure and planning. Costing dependencies are not shown on the create form.

1. Save Product.
2. If there is no SKU, show the entity sentence and Add SKU.
3. Save the Inactive SKU.
4. Show that SKU on the existing Readiness lens.
5. In-module master issues open the existing Product or SKU dialog.
6. Specialist issues remain text with the server route.
7. Activate stays a separate confirmation and is not blocked by severity.

### 18. Explicit exclusions

- A second readiness authority or a Product-wide READY boolean.
- Automatic Product or SKU activation.
- A READY gate on activation.
- Specialist editors inside Manage Products.
- Invented route URLs.
- WP04 queues, bulk remediation or a control centre.
- Guessed master data used to turn a status green.
- EXACT_RUN history in Manage Products.
- e-Aushadhi work and WP11 visual redesign.
- A new top-level module.

### 19. High-risk decisions still requiring separate approval

1. Whether Malayalam name becomes optional in the form or required on the server.
2. Whether Product creation should default to Inactive or refuse Active.
3. Whether SKU activation should be refused unless canonical readiness is READY.

None of these is approved. None is locked in `CHANGELOG_DECISIONS.md`.

### 20. Implementation boundaries for G3

G3 may decompose only routine client presentation inside Manage Products that this contract already allows:

- the no-SKU entity sentence and the existing Add SKU action;
- post-create selection of the new Inactive SKU and display of the existing Readiness surface;
- ordering of `MANAGE_PRODUCTS` remediation ahead of specialist text in the existing list;
- activation-confirmation wording that quotes the loaded server severity and states that activation is not costing readiness;
- view-only hiding of mutation actions;
- the existing unavailable and period behaviour.

G3 MUST treat any new RPC, schema, permission, activation eligibility, Malayalam requirement, or Product-status policy as high-risk. Those stop for a separate plan and review. G3 MUST NOT begin application edits in the same chat as this contract.

### G2 classification

**REQUIRED NOW**, using existing screens and RPCs: sections 4–17 except the three high-risk decisions.

**HIGH-RISK DECISION REQUIRED**: section 19.

**FUTURE DEPENDENCY**: WP04 portfolio rollup and control centre; NAV-P02 route-to-page links under WP08.

**PARKED ENHANCEMENT**: UX-P02 to WP11; UX-P01 regional Marketing acceptance surface; CSE-P01 commercial-sales multi-row authority.

**OUT OF SCOPE**: the exclusion list in section 18.

## WP03-G3 — Implementation package decomposition

Audited `main` `f22b36ca7077fcf70943112fb0aee6380af93e8d` had not moved. This gate reads the client on the G2 commit. No application file is changed here.

The routine presumption holds: G4 is client-only and reuses the existing RPCs. No new RPC, schema, permission, or business rule is required.

G4 is **one package**. The gaps share `js/products.js` and one regression script.

### Behaviour already satisfying G2

| Requirement | Current behaviour |
| --- | --- |
| New SKU inactive | `createSku` sends `p_is_active: false`. |
| Pack update | `saveSkuPack` calls `rpc_update_product_sku` and does not send `p_is_active`. |
| Activation writer | `toggleSkuActive` calls only `rpc_set_product_sku_active`. The button is not disabled from severity. |
| Post-create reload and selection | `createSku` calls `loadChildSkus`, then `selectSku(createdSkuId)`. `loadChildSkus` calls `loadAllSkuReadiness`, which calls canonical LIVE_AS_OF readiness for each saved SKU. The toast already says the SKU was created inactive. |
| Readiness presentation | `renderSkuList`, `renderSkuReadiness`, `showSelectedSkuReadiness`, and `openReadinessDetail` are the only surfaces. Period text is `renderSkuSummary` / `#skuPeriodLabel`. |
| Period | `loadGovernedPeriodStart` calls `rpc_get_latest_governed_cost_period_start`. `fetchSkuReadiness` sends `LIVE_AS_OF` and `p_refresh_run_id: null`. |
| No readiness call without a SKU | `loadAllSkuReadiness` returns before `fetchSkuReadiness` when `skuRows.length === 0`. |
| Specialist routes | `appendRemediation` writes `Resolve in:` plus the server route. There is no link. |
| Remediation order | The live LIVE_AS_OF payload emits `PRODUCT_MASTER` and `SKU_MASTER` before specialist dependencies. `renderSkuReadiness` keeps that order. A client reorder is not required. |
| View-only SKU actions | `syncSkuAccessChrome` hides Add SKU, Create SKU, Save SKU, and Activate unless `canWriteModule()`. Product save stays hidden unless the user can edit and the form is dirty. |
| Load failure | `showSelectedSkuReadiness` sets the detail text to `Readiness unavailable` and does not mark the SKU READY. The SKU row stays in the register. |

### Exact gaps for G4

| Requirement | Current behaviour | Gap | File | Surface | Minimal change | Test | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| No-SKU sentence | `renderSkuList` clears the registers and paints nothing when `skuRows` is empty. | The entity sentence is missing. | `js/products.js` | `renderSkuList`, section `#skuLifecycleSection` | When a saved Product is selected and `skuRows.length === 0`, show: “Product saved. No SKU exists yet, so SKU readiness has not been assessed.” Do not call the readiness RPC. Keep Add SKU only for edit users. | Extend `scripts/product-sku-lifecycle-smoke.mjs` to require the sentence and the zero-row early return. | Routine client |
| Server UNKNOWN versus load failure | `readinessBadgeLabel` maps every non-READY / non-review / non-blocked value, including `UNKNOWN`, to `Unavailable`. Detail failure text is already `Readiness unavailable`. | A returned `overall_severity` of `UNKNOWN` is not shown as returned. | `js/products.js` | `readinessBadgeLabel` | If severity is `UNKNOWN`, show `UNKNOWN`. Keep `Unavailable` for a missing value. Do not change the failure text. | Smoke: `UNKNOWN` branch stays distinct from `Readiness unavailable`. | Routine client |
| In-module editor action | `appendRemediation` prints route text only. | An edit user is not led to the existing dialog. | `js/products.js` | `renderSkuReadiness` dependency loop and `appendRemediation` | When `recommended_ui_route` is `MANAGE_PRODUCTS` and `dependency_code` is `PRODUCT_MASTER`, an edit user gets a control that opens the existing Product dialog through `openSelectedProductDialog`. When the code is `SKU_MASTER`, the control calls `selectSku` for the selected SKU. View-only users get the route text only. No other route gets a control. | Smoke: those two codes are the only action map; specialist routes stay plain text. | Routine client |
| Activation confirmation | `toggleSkuActive` says the SKU will become Active. It does not quote severity or the period. | The pre-activation sentence is missing. | `js/products.js` | `toggleSkuActive` prompt message | If `skuReadinessById` already has the SKU, append the loaded `overall_severity`, `governedPeriodStart`, and the sentence that activation does not set costing readiness. If it does not, append `Readiness unavailable` and still open the confirmation. Do not fetch, and do not disable Activate. | Smoke: the activation message includes the loaded-severity path and the unavailable path, and does not disable the button from severity. | Routine client |
| View-only Product deactivate | `applyAccessChrome` shows `#inlineDeleteBtn` for a selected Product and only disables it when the user cannot edit. | A view-only user can still see Deactivate. | `js/products.js` | `applyAccessChrome` | Set display to `none` when `canWriteModule()` is false. | Smoke: view-only hides `#inlineDeleteBtn`. | Routine client |
| Cache generation | `public/sw.js` is `hub-cache-v331`. `js/products.js` is cache-first. | A client edit will stay stale until the cache name changes. | `public/sw.js` and the lifecycle smoke | `CACHE_NAME` | Bump once to `hub-cache-v332` and update only the smoke that pins `hub-cache-v331`. | The lifecycle smoke asserts the new name. | Routine client |

### Not in G4

- HTML. The sentence and the two in-module controls can be created from the existing section and remediation item. `#skuAddBtn`, `#productDialog`, `#skuDetail`, and `#readinessDetailSurface` stay as they are.
- CSS. Reuse `sku-period-label` or the existing remediation item. No new visual language.
- Remediation reorder. The server array is already in the required order.
- Opening the Readiness dialog after create. Reload, selection, the readiness call, and the inactive toast already exist. A pointer from the SKU dialog is optional and is not a G4 item.
- Specialist URL map. NAV-P02 stays parked.
- Malayalam name, Product status at create, and a READY gate on activation.
- Supabase, schema, RPCs, permissions, and production data.

### G4 package

One branch. Touch only:

- `js/products.js`
- `public/sw.js` for the single cache bump
- `scripts/product-sku-lifecycle-smoke.mjs`

No other smoke should be retargeted. Authenticated journeys listed for G6 stay out of G4 automation: saved Product with no SKU, several SKUs, a new Inactive SKU, BLOCKER, REVIEW_REQUIRED, READY, a failed readiness load, activation with and without a loaded payload, a view-only user, and a narrow layout. Do not insert production rows for that proof.

### Classification

**Routine:** the six rows in the gap table.

**High-risk and excluded:** Malayalam requirement, Product-status policy, readiness-gated activation, and any new server or permission contract.

**Parked:** no new item. UX-P02, NAV-P01, NAV-P02, UX-P01, and CSE-P01 stay as recorded.

## WP03-G4 — Implementation

- Branch: `feat/wp03-g4-creation-guidance`
- Base: `3f8822df8ff9d45a4dd517884817f72a22356818`
- `main` at implementation: `f22b36ca7077fcf70943112fb0aee6380af93e8d`, unchanged
- Implementation commit: `1337556808dec39523c10655f1f7db1b50220f94`
- WP03-G5 independent audit: PASS. No correction pass required.
- Current gate: WP03-G6 completed and verified; work pack still open
- Next gate: WP03-G7

Files changed:

- `js/products.js`
- `public/sw.js`
- `scripts/product-sku-lifecycle-smoke.mjs`
- `docs/master-data-costing/WP-03-CREATION-GUIDANCE.md`
- `docs/master-data-costing/MASTER_PROGRAMME.md`

Implemented:

1. `renderNoSkuGuidance` shows the exact no-SKU sentence on `#skuLifecycleSection` for a saved Product with zero SKUs. It does not call readiness.
2. `readinessBadgeLabel` returns `UNKNOWN` for canonical `UNKNOWN`. A missing value stays `Unavailable`. A failed detail call stays `Readiness unavailable`.
3. `manageProductsRemediationAction` adds Open Product and Open SKU only when the server route is `MANAGE_PRODUCTS` and the dependency code is `PRODUCT_MASTER` or `SKU_MASTER`, and only for an edit user. Other routes stay text.
4. `activationReadinessNotice` adds loaded severity and period, or the unavailable sentence, to the Activate confirmation. It does not fetch and does not disable Activate.
5. Product Deactivate is shown only for an edit user with a saved Product selected.
6. Service worker cache is `hub-cache-v332`.

Tests: `node scripts/product-sku-lifecycle-smoke.mjs` passed, including the prior lifecycle assertions. `node --check` on a module copy of `js/products.js` passed. `git diff --check` is required before commit.

Server changes: none. Malayalam-name requirement, Product status at creation, and activation eligibility are unchanged. No new parked item.

## WP03-G6 — Authenticated / live verification

`WP03-G6 — COMPLETED AND VERIFIED`

An existing Manage Products edit session was used in the G4 client at `http://localhost:3000`. The served client was `hub-cache-v332` and contained the no-SKU sentence. No Product, SKU, activation, readiness evidence, or permission was changed. After the activation preview, SKU `10` was still Inactive in the database.

`main` remained `f22b36ca7077fcf70943112fb0aee6380af93e8d`. The branch remains unmerged. Next gate: WP03-G7.

### Journey record

- Product `786`, no SKU: PASS — authenticated live. The SKUs lens opened, no SKU row appeared, and the text was `Product saved. No SKU exists yet, so SKU readiness has not been assessed.` No READY, UNKNOWN, BLOCKER, BLOCKED, or REVIEW_REQUIRED badge was fabricated. Add SKU was visible and was not used.
- Product `14`: PASS — authenticated live. SKU `10` was Inactive and Blocked. SKU `11` was Active and Ready. Selecting either row left the other row unchanged. There was no Product-wide READY roll-up.
- Product `51`: PASS — authenticated live. SKU `40` and SKU `41` were Inactive and Blocked. SKU `42` was Active and Review required. SKU `43` was Active and Ready.
- SKU `10` inactive readiness: PASS — authenticated live. Lifecycle stayed Inactive while readiness was Blocked for period `2026-09-01`.
- Governed period: PASS — authenticated live. The client displayed `Governed readiness period: 2026-09-01`. No browser current-month control and no EXACT_RUN control appeared.
- READY: PASS — authenticated live, on SKU `11` and SKU `43`.
- REVIEW_REQUIRED: PASS — authenticated live, on SKU `42`, displayed as Review required.
- BLOCKER/BLOCKED: PASS — authenticated live. SKU `10` overall severity was Blocked, and its costing foundation was BLOCKED.
- UNKNOWN: PASS — authenticated live where the server returned it. On SKU `10` the costing outcome and several specialist dependency rows were displayed as UNKNOWN. Overall severity for the inspected SKUs was Blocked, Review required, or Ready, so an overall UNKNOWN badge was not present. The G5 static proof still covers that badge branch.
- Readiness detail for SKU `10`: PASS — authenticated live. Status, reason, owner, and `Resolve in:` text were shown. Specialist examples included `PM_BOM_MANAGER`, `MRP_GOVERNANCE`, `SELLING_SCHEME_POLICIES`, `COMMERCIAL_SALES_ASSUMPTIONS`, `PRODUCTION_ROUTE_MANAGER`, `QC_ACTION_QUEUE`, `MATERIALS_STORES_ACTION_QUEUE`, and `DRIVER_GOVERNANCE`.
- Specialist routes: PASS — authenticated live. They were plain text. The readiness detail contained no hyperlinks.
- Manage Products remediation action: NOT SAFELY REPRODUCIBLE WITHOUT MUTATION — G5 static proof retained. Product master and SKU master for SKU `10` were RESOLVED, and no Open Product or Open SKU action appeared. No base UOM or pack value was changed to manufacture one.
- Activation confirmation, SKU `10`: PASS — authenticated live. The confirmation was titled Activate SKU and said the target would become Active, `Current costing readiness: BLOCKER for period 2026-09-01`, that activation does not set costing readiness to READY, and that a business reason is required. It was cancelled with the reason field empty. SKU `10` remained Inactive in the UI and in `product_skus.is_active`.
- Activation confirmation when readiness is unavailable: PASS — static/automated only. Connectivity was not broken.
- Edit-user controls: PASS — authenticated live. Add SKU was visible. The Product dialog for Product `14` showed Deactivate. The view-only banner stayed hidden. SKU `11` opened its existing dialog with Deactivate. No save or lifecycle write was submitted.
- View-only access: NOT SAFELY REPRODUCIBLE WITHOUT PERMISSION MUTATION — G5 static proof retained. Permissions were not changed.
- Narrow layout at 390px: PASS — authenticated live. The catalog, Products, SKUs, and Readiness lenses stayed reachable. The no-SKU sentence stayed readable. Product `14` compact rows stayed usable. Readiness detail opened and showed `Resolve in: PM_BOM_MANAGER`. Add SKU stayed visible.
- Authenticated regression: PASS — authenticated live. Product selection, the Product dialog, SKU selection, the SKU dialog, readiness detail, and lens switching worked. Product `786` still showed no SKU after other Products had been opened. Product and SKU master stayed separate.

### Automated recheck

- `node scripts/product-sku-lifecycle-smoke.mjs`: PASS
- `node --check` on a module copy of `js/products.js`: PASS
- `node --check public/sw.js`: PASS
- `git diff --check`: PASS

No G4 client defect was found. No server change was made. Programme completion remains 3 of 13. Do not start G7 in this verification commit.
