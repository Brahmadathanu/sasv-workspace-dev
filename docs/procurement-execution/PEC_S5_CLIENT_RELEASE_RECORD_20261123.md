# PEC S5 — unified planning client, redundant-code cleanup and v6.4.0 (issue #508)

**Server:** migration `20261122191542` (installed in production, source merged in PR #509; LF SHA-256 `c1661a3b…8486`). **Not modified, not reapplied.** This package is client + release only: no SQL, grants, RLS or migrations; the five historical CRLF migration files are untouched.

## What changed (client)
| Area | Change |
|---|---|
| One planning flow | RM Normal, RM JIT, PM and IND use one form and one review dialog. Class is now required (no "All Classes"). Method selector: **Plan-based requirement** / **Plan + Historical Consumption**; defaults RM Normal=hybrid, RM JIT=plan, PM=hybrid, IND=plan; an explicit choice survives a route change. Preview = `proc_pec_s5_review_plan`; writer = `proc_pec_s5_generate_pr` with the reviewed `plan_signature`. |
| History comparison | A labelled switch in the review. Plain-English hint per method: in *plan* it shows what history suggests beside the plan; in *hybrid* history already drives the quantity and is always shown. Toggling re-reviews, clears the acknowledgement, and never changes a recommended quantity (tested ON vs OFF). |
| Invalidation | Class, scope, months, method, comparison or an IND-plan save clears the preview and confirmation; a stale server signature at the writer shows "review again" and resets Generate. |
| IND | **Operational Planned Requirement** editor (`proc_pec_ind_list_planned_requirements` / `proc_pec_ind_set_planned_requirement` only): month chips with *missing* flags, explicit zero, active toggle, editable reason (≥10 chars), read-only for View-only, nothing saved until Save; empty plan gives an honest empty state. Labelled "not production MRP". |
| Manual quantity reason | Changing a PR line quantity immediately prefills the Reason cell with `Manual quantity adjustment during PR review: <old> to <new>.` (same wording as the server fallback); typed custom reasons are never overwritten; both are saved together via `proc_pr_set_manual_delta`. The old placeholder blocker for ordinary edits is gone (add-line keeps its explicit justification prefix). |
| Evidence/lifecycle | S5 PRs (`s5_mode`) are treated like S4 PRs for frozen evidence; reconcile/rebuild stay blocked for them. S4/JIT historic PR evidence still renders. |

## Verified-redundant client elements removed
Retired CCF-approval writer (`openCcfApply`, `applyCcfToDraft`, `canApplyCcfLine`, apply modal `ccfApplyModalBackdrop`, its handlers, Escape branch and styles, `data-ccf-line-id` buttons); unwired legacy modals `prEditReqModalBackdrop` / `prEditDeltaModalBackdrop` (no JS referenced them); the JIT-specific client route (`s4PlanRoute`, `s4JitServerMissing`, `s4IsMissingRpc`, `proc_pec_jit_*` and `proc_pec_s4_generate_pr` calls, JIT route note/help); 15 unused CSS rules (preflight scroller, approve button, compact-metrics, `.pec-ccf-sub`, route-help, apply-modal rules). Each was proven unreferenced by a caller/CSS-usage audit and is now guarded by static-smoke assertions. **Retained deliberately:** the server RPCs `proc_pec_s4_*`, `proc_pec_jit_*`, `proc_pec_ccf_*` and legacy `create_pr_from_mrp_plan` (installed legacy clients may still call them; server cleanup is a later, separately audited step) and `proc_pec_s4_new_pr_plan` for the S4 reconcile dialog.

## Evidence
Layout smoke (1440px and 390px) with 51 `#508` assertions plus the existing suites; mutation checks (wrong method in the writer, removed auto-reason) fail the smoke. Screenshots: `docs/procurement-execution/evidence/s5-client-20261123/` (synthetic fixtures).

## Not tested (honest limits)
Authenticated signed-in browser acceptance, an installed Windows upgrade, and live IND plan entry were not performed here; the server proof is the owner's rolled-back fixtures. The installer is unsigned.
