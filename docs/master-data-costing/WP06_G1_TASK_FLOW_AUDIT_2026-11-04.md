# WP06-G1 — Pricing Policy Manager task-flow audit and deterministic tests — 4 Nov 2026

Baseline `main` `195b13c4df32a5fdcf22ee304066e96c1b138481`. **Test-only plus this audit; no source, flag, registry, metadata, RPC or business-rule change** (no maker-checker change D7, no C9 change). Tests: `scripts/costing-wp06-g1/csa-task-flows.test.mjs` (21 tests; real `createCommercialSalesAssumptionHandlers` driven through its real `bindEvents` with a mocked `costingRpc` and a fake DOM).

## 1. Task map (Pricing Policy Manager, W6 groups)
Source: `PRICING_POLICY_WORKSPACES` (`costing-suite-pricing-policy.js`), `COSTING_ROUTE_CONFIG["pricing-policy-manager"]`, `costing-suite-commercial-sales-assumptions.js`.
| W6 group | Workspace (id) | Period-scoped | User task | Write RPCs (existing) | Edit guard |
|---|---|---|---|---|---|
| MRP Policy Setup | `sku-mrp-policies`, `product-derivation-policies` | no | review/set SKU MRP policies, product derivation | per #130 A4 index (not re-audited here) | `canEditPricingPolicyActions` |
| MRP Change Workflow | `mrp-proposals`, `proposal-decisions`, `approved-for-application`, `applied-proposal-history` | no | propose, decide, apply, review applied | `rpc_decide_product_mrp_proposal_line` etc. (D7: no maker-checker, **not changed**) | same |
| Selling & Schemes | `sku-overview`, `scheme-master`, `scheme-rule-register` | no | SKU selling policy, schemes | per A4 index | same |
| (Commercial inputs) | `commercial-sales-assumptions` | **yes (only one)** | set / supersede / close SKU sales assumption; revise company and IK/OK regional default sales-quantity policies | `rpc_set_sku_sales_assumption`, `rpc_close_sku_sales_assumption`, `rpc_set_sales_allocation_default_policies_scoped` (+ reads and `rpc_preview_sales_allocation_default_policy_scope`) | `requireEditAccess` before every write |

This is the screen the independent audit identified as the existing remedy for the 57 no-sales-basis labour reviews and the Dhanyamlam OK regional basis. Coverage of this package is the Commercial Sales Assumptions manage modal (set/supersede/close) plus the pure default-policy selection logic. MRP proposal flows and the default-policy **revision modal** (scope preview + scoped save) are not covered here (see §4).

## 2. What the tests pin (all passing against unchanged code)
- Open assumption = `ACTIVE` with empty `effective_to`; pickers for company/regional defaults (open first, else latest `effective_from` then higher id; region **and** scenario must match); labels (`OK` → "Outside Kerala", `IK` → "Inside Kerala"); source-bucket classification and ordering are total.
- **Set**: exact `rpc_set_sku_sales_assumption` payload (`p_period_start, p_sku_id, p_assumption_basis, p_assumed_sales_units, p_assumed_sales_value, p_effective_from, p_remarks, p_approval_reference`); empty value/approval → `null`; the three bases; success toast, form reset, history re-read, mask on/off.
- **Validation matrix** (9 cases): invalid basis, empty/non-finite/zero/negative units, missing effective-from, blank remarks, non-numeric value — each refused client-side with its own message and **no write**.
- **Supersede**: effective-from must be strictly later than the open assumption's (equal/earlier refused, later sent); form title/section follow history; close section only when an open assumption exists **and** the user can edit; view-only label.
- **Close**: exact `rpc_close_sku_sales_assumption` payload; refused with no open assumption, missing date, missing remarks, or `effective_to` before `effective_from` (same day allowed).
- **Permissions**: view-only users blocked via `requireEditAccess` before validation/RPC, revocation re-checked at save time.
- **Context freshness**: workspace change, period change (`assertModalContextFresh` and `onPeriodChanged`) close the modal and refuse the write; same period keeps it.
- **Failures**: RPC error and thrown transport error surface the server message inline, keep the entered values, re-enable controls, send no success toast; retry works; double click issues exactly one RPC.
- **History race**: SKU A's late history answer after reopening for SKU B is discarded, and B's save is validated against B's history.
- **Scope guard**: the module calls exactly seven RPCs (3 reads, 1 preview, 3 writes), none of the approval/decision/acceptance families, and no write sits inside a loop.
Mutation checks (each makes the suite fail): equal-date supersede allowed, removed in-flight guard, renamed close RPC, removed stale-history guard, zero units allowed.

## 3. Findings (deterministic, from code reading and the tests; none changed here)
| ID | Finding | Severity | Evidence | Recommended handling |
|---|---|---|---|---|
| F-1 | `openManageModal` identifies a snapshot with `token: Date.now()`. Two opens within the same millisecond share a token, so the stale-answer guard (`token` + SKU id) cannot tell a re-open of the **same SKU** from the original; an out-of-order older history answer could overwrite the newer one. Real clicks are > 1 ms apart, so practical risk is very low; the test uses distinct tokens deliberately. | low | `costing-suite-commercial-sales-assumptions.js` L1025, L963 | later bounded fix: monotonic counter token (client-only); needs a test with a frozen clock |
| F-2 | `closeManageModal` sets `writeInFlight = false` while a write may still be in flight; closing during a save and opening another SKU allows a second concurrent write. Server side is authoritative, so no data-integrity claim. | low | L1042–1052 | later fix: keep the flag until the request settles |
| F-3 | File header comment lists `rpc_set_regional_sales_allocation_default_policy`; the code (and test) use `rpc_set_sales_allocation_default_policies_scoped` for regional saves. Documentation drift only. | info | header L8–9 vs `saveDefaultPolicyRevision` | comment fix in a code package |
| F-4 | `Number()` accepts `0x10`, `1e3`, `Infinity` is rejected, fractional units accepted; server validation is the authority. | info | validation matrix | owner/server to say whether integer units are required; no client change without that |
| F-5 | Set-mode button label is "Save Assumption" (not "Set Assumption") while the section title is "Set Assumption". Cosmetic. | info | `syncSetFormMode` | U11-style wording pass if desired |
| F-6 | No client-side maker-checker or second-approver step exists on assumption set/close or default-policy revision (consistent with D7 for MRP). Server contract unchanged. | policy | n/a | owner decision D7 |

No finding is an unambiguous, contract-specified defect with material user impact, so **no code fix is proposed in this package**; F-1/F-2 are candidates for a small follow-up (WP06-G1b) if the owner wants them.

## 4. Not covered / next independent packages
| Package | Content | Needs |
|---|---|---|
| WP06-G1b | default-policy revision modal: scenario/region validation, scope options, preview gating (`commit_allowed`), exact `rpc_set_sales_allocation_default_policies_scoped` payload for COMPANY and REGIONAL (IK/OK) | Chromium test against the real PPM page (the modal is rendered through DOM wiring the Node fake cannot drive) |
| WP06-G1c | MRP proposal flows (propose/decide/apply) payloads and guards, **without** changing D7 | existing RPC argument inventory (A4) |
| WP06-G1d | F-1/F-2 client fixes | owner OK; frozen-clock and close-during-save tests |
| WP06-G2 | C9 registry metadata | owner authority |
