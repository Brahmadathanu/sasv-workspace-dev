# WP-07 Codex packages (replaces pending Cursor messages), prepared 29 Oct 2026 IST

For the owner: paste block 0 first, once, in a new Codex session. Then paste one package at a time. Send me Codex's reply (plan or commit hash) and I audit it before the next step.
Branch tip when written: `78cf8a6` (UX-3 B1) on `feat/wp07-ux1-worklist`, cache `hub-cache-v376`.

## 0. Codex handover brief (paste first, once)
```text
You are taking over client implementation of WP-07 (e-Aushadhi Review) from Cursor. Same working style.

Repo: Brahmadathanu/sasv-workspace-dev
Branch: feat/wp07-ux1-worklist (current tip 78cf8a6, cache hub-cache-v376)
Worktree on this PC: D:\ELECTRON PROJECTS\daily-worklog-app-wt-wp07-ux1-worklist
The owner is not a coder and uses Windows cmd. Any command you ask him to run must be a single cmd line with no downloads.

Workflow (plan-first and audit):
1. You audit the current code and reply with a PLAN only (what changes, what does not change, files, tests). No code.
2. Jarvis (the owner's reviewer) audits the plan. Wait for the owner to paste "approved".
3. You build, run the smoke scripts, commit, and push to the feature branch only.
4. Jarvis audits the build; the owner checks on screen.
A package marked "build directly" has a fixed scope and skips step 1.

Standing rules (never break these):
- Client code only. Do not touch Supabase: no SQL, no migrations, no functions, tables, grants or data.
- No direct client writes to regulatory tables; use the existing RPCs only.
- No client-supplied integrity authority: the client never builds tokens, hashes or approvals that the server should trust.
- No automatic source verification.
- The portal's final Submit is permanently excluded: never clicked, shown or reachable.
- Each native portal Save needs an explicit authorization by an Approver for that Save.
- Never mint, forge or scrape tokens or sessions.
- No merges to main and no push to main. Push only to the named feature branch.
- Do not bump the cache number (hub-cache-v376) unless the package says so; the merge plan sets it.
- Product 262 (Karpooradi Thailam) stays closed and read-only.
- Operator-visible text in plain English.

Reporting format for every reply:
- Branch and full commit SHA (or "plan only, no commit").
- Changed files (path list).
- Exact test commands run and their results (pass/fail counts per smoke script).
- Anything you could not do, and open questions.
```

## Status of earlier Cursor packages
| Package | File | Status | Action |
|---|---|---|---|
| UX-1, UX-1.1, UX-1.2 | UX1_*_CURSOR_*.md | Done (523b542 … 2ee89d3) | None |
| UX-2 | UX2_*.md | Done (9a0593c, 851804c) | None |
| UX-5 | UX5_CURSOR_PACKAGE.md | Done (a5877f4) | None |
| UX-5.1 | UX5_1_CURSOR_MESSAGE.md | Done (e3183cc) | None |
| UX-3 Phase A / A-fix / B audit / B1 | UX3_CURSOR_PACKAGE.md, UX3_AUDIT_FIRST_CURSOR_MESSAGE.md | Done (a61d3d6, f20eec8, 3603ea7, 78cf8a6) | Remaining part = F1 (package A) and B2 (package C) |
| UX-3 remaining steps: Composition and QC fill in the stepper | UX3_CURSOR_PACKAGE.md | Pending, blocked (Composition needs PKG3b design; QC needs the QC package) | Not rewritten now; covered by C/D when unblocked |
| QC across many products | QC_MULTI_CURSOR_PACKAGE.md | Pending, blocked on server Part A approval and the COA naming convention (TO CONFIRM) | Rewritten as package D, do not send yet |

## A. F1 text fix (build directly; text only)
```text
Task: WP-07 UX-3 F1 text fix. Build directly (scope fixed). Client code only, no logic change.

Branch: feat/wp07-ux1-worklist, start from 78cf8a6.

In public/shared/js/eaushadhi-review-helpers.js (Readiness "Fill on portal" model):
- Remove the "both Approvers saved" state: constant PORTAL_BOTH_APPROVERS_SAVED_COPY, screenState "both_approvers_saved", and field bothApproversSaved.
- Replace it with state "multiple_savers":
  - constant PORTAL_MULTIPLE_SAVERS_COPY =
    "More than one person saved steps for review on this product, including you. An Approver who saved none of them must authorize the portal Save."
  - screenState "multiple_savers"; model field multipleSavers.
  - Shown only when the viewer saved at least one step AND someone else saved another step (the same condition the old state used: not closed, savedByMe and savedByOther).
- Reason: the client cannot know whether the other saver is an Approver, so the text must not claim it.
- Update every reference in public/shared/js/eaushadhi-review-control.js if any.

Update scripts/eaushadhi-ux3-phase-a-smoke.mjs to import and assert the new constant, state and field, and assert that the old names are gone.

Do not change: any other copy, gate logic, RPC calls, the worker, Product 262 handling, Supabase. Cache stays hub-cache-v376.

Run and report counts:
  node scripts/eaushadhi-ux3-phase-a-smoke.mjs   (baseline B1: 33)
  UX-5 smoke   (baseline 36)
  UX-1 smoke   (baseline 91)
  UX-2 smoke   (baseline 28)
(Use the existing script names for UX-5, UX-1 and UX-2 in scripts/; list the exact commands you ran.)
Also run: git grep -n "both_approvers\|BOTH_APPROVERS\|bothApprovers"  (must return nothing).

Commit message: "WP-07 UX-3 F1: multiple savers copy in Fill on portal (text only)."
Push to feat/wp07-ux1-worklist only. Report SHA, changed files, commands and results.
```

## B. UX-6 modal polish (plan only)
```text
Task: WP-07 UX-6 modal polish. AUDIT AND PLAN ONLY. Do not edit code in this turn.

Branch: feat/wp07-ux1-worklist (tip after F1). Client code only.

Subject: the per-row product modal (opens when a worklist row is clicked; includes its tabs such as Product Details, Classification, Composition and Readiness): its vertical scrolling and field arrangement.

Goals (from the acceptance checklist):
1. The main action buttons (Save for review / Approve / next-step) are always reachable without hunting, on every tab.
2. The modal header (product name, id, stage pills) stays fixed; only the body scrolls.
3. No horizontal scroll at 1366x768 or larger; no content cut off at the bottom.
4. Fields grouped logically, in the same order as the portal where practical, labels next to fields, read-only fields visibly different.
5. One scroll area only (no scroll-inside-scroll), mouse wheel and keyboard scroll work.
6. Esc closes the modal (with the existing in-page "Stay / Leave without saving" dialog if dirty); focus returns to the row; Tab order follows the visual order.
7. No layout jump when data loads, when a refusal reason appears, or when switching tabs.
8. Works on a small laptop screen (1366x768, Windows display scaling 100% and 125%).

Deliver (plan only):
1. Audit of current behaviour per tab: what scrolls, where buttons sit, any problems against goals 1-8, with file, CSS selector and function names.
2. Proposed changes, smallest first; what does NOT change (all logic, four-eyes, locks, autosave, RPCs, Product 262, Submit exclusion).
3. Files touched; whether the cache number needs a bump (do not bump now).
4. Tests: smoke assertions you can add, plus a manual check list for the owner.
5. Risks and open questions.
Wait for approval before coding. The owner will add on-screen findings; include them if given below.
Owner findings: <paste here, or "none yet">
```

## C. B2 worker unlock (plan refinement only; ON HOLD until the owner picks the first product)
```text
Task: WP-07 UX-3 Part B2, worker unlock for one non-262 product. REFINE THE PLAN ONLY. Do not edit code.
Do not send a build until the owner has chosen the first product and approved this plan.

Branch: feat/wp07-ux1-worklist. Read docs/eaushadhi/UX3_PHASE_B_WORKER_AUDIT.md first.
First product: <owner fills: product id and name>   Approved-copy filename rule: <owner fills>   Blank sub type "-" (portal 31/32) allowed: <yes/no>

Live server contract (PKG3a, already applied; do NOT change it, do not ask for a nonce):
- Gate: rpc_eaushadhi_portal_entry_gate_get_v1(p_product_id int) returns product_id, enabled, enabled_by, enabled_at, notes, updated_at.
  rpc_eaushadhi_portal_entry_gate_set_v1(p_product_id int, p_enabled bool, p_reason text) returns jsonb, Approver only. Today only 262 is enabled.
- rpc_eaushadhi_worker_run_begin(p_product_id, p_expected_workflow_row_version, p_expected_content_hash, p_expected_payload_hash, p_start_context)
  calls regulatory.eaushadhi_portal_save_authorize_v1(actor, product_id, start_context).
- start_context MUST carry: save_authorization: {confirmed: true, typed_confirmation: "SAVE PRODUCT <id>"} with the real product id.
  There is NO nonce, NO expiry (TTL) and NO single-use token in this contract. Do not invent one in the client.
  The server writes its own authorization record into the run's start_context with final_submit: EXCLUDED.
- Refusals: PORTAL_ENTRY_NOT_ENABLED, APPROVER_ROLE_REQUIRED, PORTAL_STAGE_NOT_VERIFIED, FOUR_EYES_SAME_PERSON (all SQLSTATE 42501);
  PORTAL_SAVE_AUTHORIZATION_REQUIRED (22023). Show each in plain words and stop; no retry.
- Strict two-person rule: the authorizer must be an Approver who saved none of the steps (Details, Classification, any line) on that product.

Plan must cover:
1. Remove the static 262 allow-list: FIRST_CONTROLLED_PRODUCT_ID / isFirstControlledProduct in electron/eaushadhi-worker/product-lock.js,
   productIds [262] in product-details-live-arm.js, and FIRST_CONTROLLED_PRODUCT_ID / isFirstControlledEntryProduct in the renderer helpers.
   Replace with a server-driven check (gate enabled AND run_begin authorization accepted), failing closed on any error or missing answer.
   Product 262 stays refused for portal entry (closed).
   List every other file that uses these names (approved-copy-resolve.js, dry-run.js, index.js, executor, field-map, live-adapters,
   trusted, qc-*) and say which change in B2 and which stay 262-locked (Composition, QC stay locked).
2. Build the Product Details field map and the approved-copy filename from governed content (approved records and loaded portal options),
   not hard-coded Karpooradi values. Any mismatch (name, option id, label, filename) is a hard stop before Save.
3. Wire the typed "SAVE PRODUCT <id>" into start_context.save_authorization; the worker passes it to run_begin and accepts only the server's answer.
4. One product only: until the first Save for the chosen product is accepted (CONFIRMED), no other product may start (operational limit via the gate; say if any client check is added).
5. Keep stop / no-retry / ambiguous-Save handling exactly as today; an ambiguous Save stops and is reported, never repeated.
6. Final Submit permanently excluded; one native Save per authorization.
7. Tests: list smoke scripts and assertions, including: 262 refused; non-enabled product refused; no run_begin without save_authorization;
   typed text must match the product id; Submit unreachable; each refusal code mapped to plain text.
8. What does NOT change; files touched; cache stays v376; risks; open questions.
Reply with the plan only.
```

## D. QC across many products (plan only; NOT YET — blocked)
Send only after the owner approves the QC server Part A (Jarvis) and agrees the COA file naming convention (TO CONFIRM).
```text
Task: WP-07 QC across many products, app part. PLAN ONLY; do not edit code.
Read docs/eaushadhi/WP-07_QC_REGISTER.md, WP-07_QC_SAVE_RUNBOOK.md, electron/eaushadhi-worker/qc-*.js and
public/shared/js/eaushadhi-review-control.js.
Goal: (1) COA PDF intake by the naming convention <owner fills>, matching each file to one product and refusing mismatches;
(2) the typed confirmation becomes SAVE <product_id> for the open product; (3) a QC readiness view.
Hard rules: QC data only from COA PDFs. Never click the final portal Submit. Keep the existing two-key Save guard and
single-use server pre-save token; never create tokens in the client. No Supabase changes. Product 262 stays read-only.
Deliver: audit of current code paths, step plan, acceptance tests and smoke scripts, risks. Wait for approval.
```
Note: the QC path has its own server pre-save token (single-use, 120 s). The Product Details path (package C) does not. Do not mix them.
