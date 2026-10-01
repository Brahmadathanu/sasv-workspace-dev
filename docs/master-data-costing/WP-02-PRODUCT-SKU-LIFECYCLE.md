# WP-02 — Product + SKU Lifecycle Redesign

## Objective
Audit and redesign Product → SKU(s) → operational foundations → costing foundations without assuming activation policy.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Scope
Product detail is the lifecycle anchor. Governed child-SKU create/update/activate/deactivate actions belong under the Product lifecycle surface. Per-SKU WP01 readiness/remediation is shown separately and consumed from the canonical server contract. Activation remains explicit and independent from readiness.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes; no direct table writes; no client-side duplicate readiness authority; no exact-run/history browser in Product Master; no mutation of downstream effective-dated evidence.

## Current-state findings
### WP02-G1 — current lifecycle surface / contract-consumption audit
- Entry criteria are satisfied: WP00 and WP01 are completed and verified; current main is `142c7fe5850af24efb2634582b354103e2d92845`.
- Current Product client `js/products.js` already uses governed Product mutation RPCs:
  - `rpc_create_product`
  - `rpc_update_product`
  Product deactivation is implemented as a governed Product update to status `Inactive`.
- Current Product client does not expose child-SKU lifecycle management and does not consume the WP01 readiness RPC.
- Live server already exposes the governed child-SKU lifecycle RPCs required by WP02:
  - `rpc_create_product_sku(p_product_id, p_pack_size, p_uom, p_is_active, p_is_sample, p_reason, p_approval_reference)`
  - `rpc_update_product_sku(p_sku_id, p_pack_size, p_uom, p_is_sample, p_reason, p_approval_reference)`
  - `rpc_set_product_sku_active(p_sku_id, p_is_active, p_reason, p_approval_reference)`
- Live server already exposes the canonical WP01 readiness contract:
  - `rpc_get_product_sku_readiness(p_sku_id, p_period_start, p_context_type, p_refresh_run_id)`
- Live server enforces Product/SKU activation consistency through:
  - `fn_guard_active_sku_requires_active_product`
  - `fn_guard_product_inactivation_requires_no_active_skus`
  Therefore an active SKU cannot belong to an inactive Product, and a Product cannot be inactivated while any child SKU remains active.
- Live lifecycle inventory at G1:
  - Products: 1,342 total = 639 Active + 703 Inactive.
  - SKUs: 1,793 total = 637 Active + 1,156 Inactive.
  - 54 Active Products have no SKU at all.
  - 179 Active Products have no Active SKU.
  - 0 Inactive Products have an Active SKU.
- These counts prove that Product Active, presence of SKU, presence of Active SKU, and WP01 readiness are distinct conditions. Existing data must not be auto-normalised or activation inferred from completeness.
- No server lifecycle mutation gap was found for Product/SKU create/update/activation. The missing piece is the Product lifecycle client surface and correct consumption of the already-governed readiness contract.

### WP02-G2 additional evidence
- `rpc_create_product_sku` requires `module:manage-products` edit permission, positive pack size, nonblank UOM and business reason; it prevents duplicate Product + pack-size + UOM identities and writes `product_sku_master_audit`.
- `rpc_update_product_sku` edits pack size, UOM and sample flag only; it does not change activation. It requires a business reason, prevents duplicate Product + pack-size + UOM identities and writes an UPDATE audit event.
- `rpc_set_product_sku_active` is the dedicated lifecycle transition authority. It requires a business reason and writes ACTIVATE/DEACTIVATE audit events.
- The current Product client already has the reusable module permission model, governance-reason/approval-reference modal, busy/loading state and RPC error surfacing required by SKU lifecycle actions.
- `rpc_get_product_sku_readiness` currently requires `module:costing-control-center` view permission. Live permissions prove this cannot be assumed for Product users: three users currently have `module:manage-products`, while only one of those also has `module:costing-control-center`.
- The readiness RPC returns status/remediation metadata rather than monetary costing values. Its LIVE_AS_OF result includes lifecycle, identity, dimension summaries, dependency statuses/reason codes/owner routes, shared issues and downstream control status.
- LIVE_AS_OF requires an explicit governed `period_start`; it resolves valuation date and latest SUCCESS refresh context server-side. Product Master must not synthesize valuation dates or refresh-run identity.
- Current governed cost periods are 2026-03, 2026-06, 2026-07, 2026-08 and 2026-09; latest governed period by `period_start` is 2026-09-01 with valuation date 2026-09-10.
- EXACT_RUN is intentionally excluded from Product Master WP02. Exact historical evidence remains a specialist costing/audit concern.

## Approved design / contract
### Product-detail information architecture
1. Keep the existing two-pane Manage Products surface and existing Product list/search as the page anchor.
2. The right-side Product detail remains the Product master editor.
3. Add a distinct **SKUs & readiness** section below Product master fields for an existing selected Product.
4. Hide the SKU section while creating a new unsaved Product because no Product identity exists yet.
5. The section header shows active/total SKU count and an **Add SKU** action when the user has Manage Products edit permission.
6. Render one compact row/card per child SKU. The collapsed summary shows:
   - SKU identity / ID;
   - pack size + UOM;
   - Sample marker when applicable;
   - lifecycle badge: Active or Inactive;
   - readiness badge: READY, REVIEW_REQUIRED, BLOCKER/blocked, or UNKNOWN from the server contract;
   - governed readiness period label.
7. Selecting/expanding a SKU reveals two deliberately separate groups:
   - **SKU master** — pack size, UOM and Sample; edit/save/cancel controls.
   - **Readiness & remediation** — server-provided dimension statuses and applicable dependency issues/actions.
8. Do not render activation as an editable checkbox beside pack fields. Activation/deactivation is a separate governed lifecycle action.

### SKU mutation/action contract
9. Create SKU only through `rpc_create_product_sku`.
10. Default a newly created SKU to **Inactive** in the WP02 Product lifecycle UI. Activation is a subsequent explicit action. This avoids silently making an incomplete SKU operational while still allowing creation-time completion work in WP03.
11. Update SKU master only through `rpc_update_product_sku`; editable fields are pack size, UOM and Sample exactly matching the server contract.
12. Activate/deactivate only through `rpc_set_product_sku_active`.
13. Every SKU create/update/activate/deactivate action uses the existing governance modal:
   - business reason required;
   - approval reference optional;
   - explicit confirmation text naming the Product/SKU and target change.
14. Client soft validation may check obvious blank/positive values for UX, but server validation and duplicate prevention remain authoritative.
15. After a successful SKU mutation, reload child SKUs and readiness for the selected Product. Do not patch a derived readiness state locally.

### Product lifecycle interaction
16. Product Active/Inactive remains independent from child readiness.
17. Product inactivation is not cascaded. If active child SKUs exist, the UI explains that they must be individually deactivated first and leaves the server guard authoritative.
18. Product activation does not activate any child SKU.
19. SKU activation against an inactive Product is not bypassed; surface the server guard error and guide the user to activate the Product deliberately if appropriate.
20. Existing data with Active Product + zero/no-active SKU is displayed as-is; WP02 does not auto-repair historical state.

### Readiness consumption contract
21. Product Master consumes the existing WP01 readiness authority; it does not calculate dependency precedence or aggregate readiness in JavaScript.
22. Product Master uses `LIVE_AS_OF` only:
   - `p_context_type = 'LIVE_AS_OF'`;
   - `p_refresh_run_id = null`;
   - explicit governed `p_period_start`.
23. Default readiness context is the **latest governed costing period by `period_start`**, resolved from server-governed cost-period data. The client must not derive a valuation date or latest-success run itself.
24. Show the period on the SKU section so readiness is never presented as timeless.
25. Render server fields, not reinterpreted client states:
   - lifecycle Product/SKU state;
   - `product_master_foundation_status`;
   - `sku_master_foundation_status`;
   - `costing_foundation_status`;
   - `evidence_quality_status`;
   - `costing_outcome_status`;
   - `overall_severity`;
   - dependency `raw_status`/`effective_status`, reason/note and recommended route when present.
26. The primary row badge follows server `overall_severity`; labels may be humanized, but severity must never be upgraded/downgraded.
27. Dependency remediation may be shown as guidance/navigation only. WP02 does not implement downstream specialist editors.

### Readiness authorization contract
28. A Product user with `module:manage-products` view permission must be able to read the Product/SKU readiness status needed by this lifecycle surface even when they do not have Costing Control Center access.
29. Do **not** grant Manage Products users Costing Control Center module permission.
30. G3 must make the narrowest server authorization change that preserves the single canonical WP01 readiness implementation. The preferred implementation is to allow the existing canonical readiness RPC to authorize either:
   - `module:costing-control-center` view; or
   - `module:manage-products` view.
31. This permission broadening is limited to the readiness RPC, which exposes status/remediation metadata and no monetary costing values. Costing mutation/approval APIs and specialist modules remain unchanged.
32. The Product client uses only LIVE_AS_OF even though the canonical RPC supports EXACT_RUN.

### Period-context acquisition
33. G3 must provide a server-governed way for Manage Products to obtain the latest governed costing `period_start`; it must not hard-code September 2026 or derive a month from the browser clock.
34. Prefer a small read-only RPC/projection that returns the latest governed period identity for lifecycle-readiness consumption, protected by Manage Products view permission. It must not expose valuation mutation or refresh controls.
35. If an existing server endpoint is proven to provide the same contract with appropriate authorization, reuse it instead of adding a duplicate.

### Permissions and UX
36. Existing `module:manage-products` permission continues to control the surface:
   - view permission: browse Products, child SKUs and readiness;
   - edit permission: Product and SKU create/update/lifecycle actions.
37. View-only users see lifecycle/readiness but no SKU mutation actions.
38. A readiness load failure does not hide the SKU itself. Show lifecycle/master identity and a clear `Readiness unavailable`/UNKNOWN state; never imply READY.
39. Product/SKU mutation busy state disables conflicting actions until completion.
40. Unsaved Product edits and SKU edits are separate edit states. Switching Product or leaving the page must protect either dirty state from accidental loss.

## Independent G2 design audit
PASS with one REQUIRED NOW server access dependency captured above.

Audit checks:
- No direct `product_skus` mutation is introduced.
- Existing SKU RPC field boundaries are preserved.
- Activation is kept separate from master editing and readiness.
- No automatic Product↔SKU activation cascade is introduced.
- No existing lifecycle inconsistency is auto-rewritten.
- Readiness aggregation remains server-authoritative.
- LIVE_AS_OF context remains explicit and period-scoped.
- EXACT_RUN/history is not leaked into a general Product lifecycle UX.
- Manage Products permission is not replaced with Costing Control Center permission.
- Required readiness visibility is solved at the narrow RPC authorization boundary rather than by duplicating server logic.
- Product-detail architecture introduces no new top-level module and does not pre-empt WP04's central readiness/control-centre scope.

## Milestones
- [x] Current-state/audit gate
- [x] Design/contract gate
- [x] Implementation gate — WP02-G3 completed and verified at `4b3a5a15e5fa74637c5ce9f3808dba04710ca1ff`
- [~] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof
- [ ] Final handover

## Current Gate
`WP02-G4 — focused verification`

## Gate Status
[x] WP02-G3 COMPLETED AND VERIFIED at `4b3a5a15e5fa74637c5ce9f3808dba04710ca1ff`, before the branch sync with current main.

[~] WP02-G4 IN PROGRESS — focused verification. The high-risk Manage Products UX plan was independently approved. The ERP master-detail workspace is implemented. G4 stays open until a person confirms the wide layout, the stacked layout at about 1024px portrait, and the layout at 520px and below.

## Required to close
Complete the focused verification set against the synced branch. Keep G4 in progress if authenticated UI verification cannot be performed. Do not merge from this gate.

## Next gate
The next existing gate after G4 is independent audit of the verification evidence, then merge/post-merge proof. Do not enter that gate from this verification pass.

## Server changes
Applied live and committed as `supabase/migrations/20260930073040_wp02_manage_products_readiness_read_access.sql`:
- `rpc_get_product_sku_readiness` keeps its live composition and now accepts `module:manage-products` view or `module:costing-control-center` view.
- New `rpc_get_latest_governed_cost_period_start()` returns `max(period_start)` from `costing.cost_periods`, or null.
- Both functions are `STABLE SECURITY DEFINER` with `search_path = public, costing, pg_temp`. Execute is granted to `authenticated` and `service_role`, and revoked from `PUBLIC` and `anon`.
- SKU writer RPCs and Product/SKU guard functions were not changed.
- Child SKU listing uses existing authenticated SELECT on `public.product_skus`. No list RPC was created.

## Client changes
Manage Products keeps one master-detail workspace. The Product explorer stays beside the workspace on wide screens and stacks above it at 1080px and below. The selected Product context strip is display-only. Product fields stay in Identity, Classification, Measure, and Planning groups, with the same control IDs. SKUs use a compact register, and readiness is a server-value grid with remediation kept separate.
- Create, pack/UOM/sample update, and activate/deactivate use only the three existing SKU writer RPCs.
- New SKUs are created inactive. Pack save does not send an active flag.
- Create SKU, Save SKU, and Activate/Deactivate stay mutually exclusive by the existing draft and dirty-state rules.
- Readiness calls `LIVE_AS_OF` with a null refresh-run id and the server period.
- Product `unsaved` and SKU `skuDirty` are separate.
- Service worker cache is `hub-cache-v329`.

## Tests / verification
- Verified current main SHA at implementation start: `738ca09ff5490c0c17ee8544da4c7690f9e6a171`.
- Earlier G1/G2 live Product/SKU, readiness, and period evidence remains as recorded above from main `142c7fe5850af24efb2634582b354103e2d92845`.
- Live readiness identity arguments matched `p_sku_id bigint, p_period_start date, p_context_type text, p_refresh_run_id bigint`, and the authorization anchor was exactly `perform public.require_permission('module:costing-control-center',false);`.
- After apply, readiness still contains the enrich helper, `LIVE_AS_OF`, and `EXACT_RUN`; `require_permission` is gone; both view modules are present. New period RPC ACL is `postgres`, `authenticated`, and `service_role` only. Security advisors did not name either function.
- Live child-SKU UOM values are `g`, `mL`, and `Nos`. The SKU UOM picker uses that live set. This is required for pack identity and was not guessed from Product base UOM (`Kg`, `L`, `Nos`).
- `scripts/product-sku-lifecycle-smoke.mjs`: PASS.
- Materials/Stores, QC, Trace launch, remediation foundation, dense restore, progressive density, production-route focus, and dashboard cardinality smokes: PASS.
- e-Aushadhi Product Details execution smoke and Composition offline-plan smoke: PASS.
- `node --check` on the new/modified MJS files and `public/sw.js`: PASS.
- `node --check js/products.js` fails before parsing because the file is a browser module and the package is not `"type": "module"`. The same source checked as a temporary `.mjs` copy: PASS.
- Independent live audit of the applied server contract passed for a Manage Products viewer without Costing Control Center permission: latest governed period `2026-09-01`, readiness valuation `2026-09-10`, successful evidence run 115. The migration was not changed for the client correction.
- Client correction smoke covers the verified payload fields, per-SKU readiness loading, `sku_id` reselection, and distinct create/update/activate/deactivate governance confirmations.
- After the second independent audit, remediation rendering now hides READY, RESOLVED, and NOT_REQUIRED dependencies, including `applicability === "NOT_REQUIRED"`, and displays server `shared_issues` without a client aggregate.
- Independent ChatGPT audit marked WP02-G3 COMPLETED AND VERIFIED at `4b3a5a15e5fa74637c5ce9f3808dba04710ca1ff`, recorded before the branch sync. Current main at that check was `23fb63f8c2704d158fd1da2b0ec8850f7307ad0a` and touched only e-Aushadhi composition files, with no WP02 path overlap.
- WP02-G4 automated and source checks against the synced branch passed: lifecycle smoke, Materials/Stores, QC, trace launch, remediation foundation, dense restore, progressive density, production-route focus, dashboard cardinality, both required e-Aushadhi smokes, and the syntax checks. Read-only catalog confirmation found migration `20260930073040`, both view permissions on the readiness RPC, the period RPC, the SKU writers, and both activation guards. Latest governed period on the server is `2026-09-01`. No authenticated user session was available, so a live `LIVE_AS_OF` caller and the logged-in Manage Products pass were not repeated. G4 stays in progress for that UI verification.
- Later authenticated visual verification on the feature branch proved the SKU section loads live data: 3 active / 5 total, governed period `2026-09-01`, and Ready and Blocked badges. The defect was `.details form { height: 100% }`, which stretched the Product form to the pane and pushed `SKUs & readiness` below a large blank area. That forced height is removed so the form keeps its content height.
- The high-risk UX plan then passed independent ChatGPT review. This branch implements that approved Manage Products workspace: compact explorer, product context strip, grouped Product master, SKU register, separate SKU master and lifecycle actions, and a server-field readiness grid. No schema, RPC, auth, or permission contract changed. Final human visual verification of the wide, about-1024px portrait, and 520px layouts remains. G4 stays in progress.

## Decisions created
- DEC-008 — Product detail is the Product/SKU lifecycle anchor; SKU master editing, lifecycle activation and readiness remain separate concepts/actions.
- DEC-009 — Manage Products consumes WP01 readiness as LIVE_AS_OF for a server-governed period; no client recomputation and no EXACT_RUN Product-Master browser.
- DEC-010 — Manage Products readiness visibility is authorized narrowly at the canonical readiness read boundary; Costing Control Center module permission is not granted merely to support Product lifecycle readiness.

## Risks
Permission broadening must stay limited to status/remediation reads; Product and SKU dirty-state interactions must not cause data loss; client must not turn UNKNOWN into READY; downstream remediation navigation must not imply Product Master owns specialist mutations.

## Parked discoveries
None added in G2. Regional Marketing evidence acceptance remains parked under the programme backlog for WP04/later IA placement.

G3 required-now detail: the SKU pack UOM picker must offer the live `product_skus.uom` values `g`, `mL`, and `Nos`. No future dependency, parked item, or out-of-scope functional change was added.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not started.
