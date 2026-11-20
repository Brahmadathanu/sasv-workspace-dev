# Claude Code handoff — PEC-C1 client five-lens fast track (12 Nov 2026)

**Executor:** Claude Code in repo `Brahmadathanu/sasv-workspace-dev`. **Owner:** user. **Server owner/independent reviewer:** ChatGPT. **Tracking:** #284, #305. **Required source:** `docs/procurement-execution/ERP_CLAUDE_CLIENT_BULK_BRIEF_20261111.md`; use this as its latest bounded delta, not a separate programme.

## Exact task, one branch and one draft PR
Start from the **latest** `main` in a clean isolated worktree. Execute the broad five-lens PEC UI acceptance/UX package within the current shared PWA+Electron assets **only**:
- `public/shared/procurement-execution-console.html`
- `public/shared/js/procurement-execution-console.js`
- existing canonical shared CSS as necessary; tests and one concise ledger.
No Electron/PWA duplicate. No production DB modifications, SQL, migrations, RLS, grants, snapshot policy, generated PR/indent or SW cache version. Do not merge or deploy; owner approves after ChatGPT independent review.

## Grounded baseline (not conjecture)
- Current main has five main panes: `tab-pr`, `tab-action`, `tab-indents`, `tab-vendor-buylist`, `tab-excess`.
- ID-bearing DOM control counts in main tab sections: **8 PR, 10 Action, 9 Indents, 16 Vendor-wise, 16 Excess**. These exclude modal controls, delegated dynamic buttons, roles and event handlers. Source evidence: `ERP_G0_FIVE_LENS_DOM_STATIC_MATRIX_20261112.md` and `ERP_G0_CURRENT_MAIN_CLIENT_RPC_INVENTORY_20261112.md` on #287; 43 unique literal RPC symbols (44 calls).
- The Indents table currently shows only `Approved Date` among date columns. **Both `indent_date` and `approved_date` are already present in live `v_proc_indent_console`**, returned by `proc_pec_indent_headers`; add a distinct `Indent Date` display while preserving Approved Date null semantics, widths, sort, exports, responsive overflow and canonical indent serial.
- **DO NOT overlap draft client PR #319:** it corrects `confirmIndentResync` to send `reset` for full UI resync (server rejects `full`) and includes a focused test. Rebase after #319 is resolved or explicitly drop/reconcile its one-line overlap, with a documented conflict decision.
- **DO NOT overlap draft server PR #317:** this already implements four gram-standard materials and server-side internal material exclusions, including safe resync preserving manual lines. Do not change server RPC signatures, permissions, or stock calculations.
- Preserve existing vendor-wise search latest-wins and split lookup fix (#238), manual indent insertion ordering, PDF continuation header, canonical serial `Indent (line)`, user roles, exports and vendor sourcing behavior.

## Concrete client work (autonomous bounded order)
1. Build an exhaustive HTML/JS/CSS cross-reference inventory of every visible and dynamically created control, modal/drawer, export, form validation, table header, filter, sort, row action, and permission state across five lenses; use PASS/FIX/DEFER matrix with exact element ID and source reference. Inspect actual Electron path before claiming shared-source parity.
2. Resolve fully client-side gaps: `Indent Date` column with genuine server value, reliable narrow/wide action toolbar and accessible labels, typography/overflow, consistent home/section design tokens, loading/empty/error states, keyboard/focus/aria patterns. Review Excess & Overshoot labels against real data semantics; no unsupported renaming.
3. For each table, verify server paging capability before implementing infinite scroll. Existing PR/Indent Prev/Next are explicit; Action Queue uses `proc_procurement_action_queue_paged`. Do **not** simulate paging by loading entire tables. Report specific missing RPC paging contracts as DEFER, do not invent them.
4. Inspect create PR/PR revision/indent resync controls against newly deployed server exclusions; use truthful messages for internal finished-bulk/semi-finished rejection and reflect safe vs reset semantics after #319. Never broaden writes for direct manual edit of approved/PR-linked indents.
5. Validate authenticated read-only/editor/unauthorized UI states when legitimate acceptance session is available; otherwise mark BLOCKED with reproducible fixture and never claim real-account success.
6. Run relevant current-main Node/static tests and browser responsive checks (desktop/tablet/narrow widths); preserve existing export parity, filter order, request race safeguards. Add regression tests appropriate to changes. Document command, result, environment and any blockers.
7. Deliver **one client-only draft PR** with screenshot/DOM evidence for every lens, changed files, tests, risk list and exact server dependencies for ChatGPT independent acceptance. No merge.

## Completion/report format
- 5 lenses × Controls/UX/Accessibility/Responsive/Exports/Permissions/Paging acceptance coverage.
- Label each criterion `PASS`, `FAIL` or `DEFER` with test evidence; do not promote G0/G1 gate independently.
- State source `main` commit and note any overlap with draft PR #319; make zero SQL changes.
- Preserve owner final approval authority. The user wants rapid completion with minimal round trips; do all safe client-only work in one bounded package.

**Status:** task instructions prepared and source-controlled, **not proof that Claude Code was launched**. Formal PEC modernisation gates remain **0/6** until independent acceptance.
