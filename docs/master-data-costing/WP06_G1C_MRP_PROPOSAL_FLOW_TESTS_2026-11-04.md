# WP06-G1c — MRP proposal workflow payload/permission tests — 4 Nov 2026

Test-only (`scripts/costing-wp06-g1c/mrp-proposal-flows.test.mjs`, 15 tests). Baseline `main` `195b13c`. **No source, RPC, flag, metadata, permission or governance change; D7 (no maker-checker) is neither implemented nor altered.** The real handler factories (`createMrpProposalHandlers`, `createMrpDecisionHandlers`, `createMrpApplicationHandlers`) are driven through their real event bindings with a mocked `costingRpc` and a fake DOM.

## What is pinned
| Step | RPC | Payload (exact) | Guards verified |
|---|---|---|---|
| Generate | `rpc_generate_product_mrp_proposal` | `p_derivation_policy_id, p_proposed_effective_from, p_reason` (+ `p_approval_reference` only when typed) | product required, date required, reason required, policy must be CONFIRMED (only Confirmed offered when any exist), view-only refused, date defaults to today IST |
| Adjust (auto/manual) | `rpc_adjust_product_mrp_proposal_line` | `SET_AUTO`: `p_proposed_mrp_ik`, `p_proposed_mrp_ok:null`, `p_proposed_ok_pct` = UI % / 100; `SET_MANUAL`: IK and OK, `p_proposed_ok_pct:null` | reason, IK > 0, OK > 0 in manual mode, uplift ≥ 0; only DRAFT proposal, PENDING, unapplied, ELIGIBLE, non-reference line; view-only refused |
| Reset | same RPC | `p_action:"RESET"`, null MRP/pct, reason | reason required; only a manually adjusted line (same eligibility); view-only refused |
| Submit | `rpc_submit_product_mrp_proposal` | `p_proposal_id, p_submission_note` | DRAFT only, proposal must exist, note required, view-only refused |
| Decide | `rpc_decide_product_mrp_proposal_line` | `p_proposal_line_id, p_decision, p_decision_reason` — **three keys, no actor** | approve needs ELIGIBLE + PENDING + unapplied + SUBMITTED/PARTIALLY_DECIDED; reject drops only the eligibility requirement; reason required; refused at open and re-checked at save; one RPC on double click; error keeps modal and allows retry |
| Apply | `rpc_apply_product_mrp_proposal` | `p_proposal_id` (+ `p_application_note` only when typed) | proposal APPROVED with ≥ 1 awaiting line; rejected/blocked/pending/applied lines excluded; unique affected SKUs invalidated; failure shows the no-partial-application notice, reloads, keeps modal; view-only refused at open and at save |
Scope guards: the four MRP modules call exactly the five write RPCs above, have no direct table write and no approval/finalise/acceptance family; each decision is a single line (no bulk loop); no module reads the current user or compares `submitted_by`/`decided_by` (display fields only).

## Mutation evidence (each fails the suite)
untrimmed reason; dropped approve-eligibility check; extra `p_actor` payload field; removed decision permission guard; removed APPROVED-status gate for apply; removed apply permission guard; note always sent; removed CONFIRMED check; OK-pct not divided by 100; removed DRAFT gate for submit; reset allowed without a manual adjustment; adjust eligibility/status gates dropped.

## Findings
| ID | Finding | Handling |
|---|---|---|
| F-9 | `closeDecisionModal`, `closeApplyModal` (and the generate/adjust/reset/submit closers) set their `...Saving` flag to `false`. Closing a modal while its RPC is pending therefore allows a second submission for the same line/proposal. Characterised (pins today's behaviour) for decisions and apply. The server is authoritative (decision/apply are server-validated, apply is atomic), so no data-integrity claim is made. | Fix pattern is the same as WP06-G1d (flag belongs to the request, completion only touches its own session). Separate small package per module, owner OK needed; the characterisation tests must be flipped by that PR. |
| D7 | The client sends no actor and performs no submitter≠decider check. | Policy decision; unchanged. |

## Next independent packages
WP06-G1e: F-9 fix for the MRP modals (one PR per module, shared pattern of G1d). Applied-history (`costing-suite-mrp-applied-history.js`) is read-only and not covered here.
