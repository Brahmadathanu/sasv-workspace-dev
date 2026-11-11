# PEC-ERP-C1 — Claude autonomous client bulk execution brief

**Issued:** 2026-11-11. **Tracker:** [#284](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/284). **Status:** Authorized for bounded client-only analysis/implementation in parallel with ChatGPT server G0/G1; not authorized to merge/deploy or change database contracts.

## Goal and division
Deliver ERP-grade consistent design across **all five PEC lenses** using the existing SASV global design system demonstrated by Stock Checker, Stock & Purchase Explorer, FG Bulk Internal Transfer. Claude owns client HTML/CSS/JS, static tests, branch PR and self-review. ChatGPT owns Supabase, PR replenishment logic, draft-edit RPC definitions, permission and snapshot freshness, server-side decisions, independent client audit and integration. Do not block safe UI groundwork waiting for server features.

## Source-of-truth constraints
- Start from latest `main`, separate branch/worktree; don't modify protected local WIP or costing/e-Aushadhi tasks.
- Canonical shared assets: `public/shared/procurement-execution-console.html`, `public/shared/js/procurement-execution-console.js`; inspect actual CSS and Electron/PWA loading paths to confirm one shared source. Do NOT copy assets to separate Electron/PWA locations.
- Preserve existing permissions and module activation; preserve client latest-wins and cancellation from PR #238, SQL performance behaviour from R2, manual-insertion ordering, canonical indent serials and financial totals.
- Existing docs: `docs/procurement-execution/{README,MASTER_PROGRAMME,IMPLEMENTATION_RULES,CHANGELOG_DECISIONS,ERP_MODERNISATION_G0_20261111}.md`; check previous PR PDF and legacy followups. New authoritative documentation is tracked in draft PR #287 until merged; base from existing file or pull its content for reference, do not assume PR #287 is on main.

## Autonomous work sequence (one bulk PR, minimise handovers)
1. Audit HTML, JS, CSS and layout for the five lens tabs (`tab-pr`, `tab-action`, `tab-indents`, `tab-vendor-buylist`, `tab-excess`), including modals, dialogs, forms, toolbars, footers, exports, date columns, paging/search, permissions and narrow screens. Record a concise component-by-component matrix: present/mismatch/fix/test.
2. Identify canonical tokens and patterns in three reference modules, choosing shared tokens over ad-hoc inline styles. Correct typography, font sizes/weights, colour semantics, spacing, section title and home/back parity, consistent wide-screen icon+label actions and narrow-screen icon-only mode with `aria-label`/title, focus, tooltips. Screen widths: wide, tablet, narrow mobile; handle overflowing tables and long text without clipping.
3. Safe data-independent UX: expose separate `Indent date` and `Approved date` when fields are already present in read RPC; otherwise prepare component contract without invented data. Refine `Excess & Overshoot` language **only where actual semantics are validated from current code;** if two distinct operations, present clear subordinate headings. Preserve exports.
4. Infinite-scroll inventory for **every** applicable table; implement only on current server-side paginated contracts with validated stable cursor/offset, deterministic sort, latest-wins, scroll-reset on filters and no duplication. For tables with unpaged RPCs, document exact server paging contract required and implement non-invasive presentation scaffolding; **do not simulate infinite scroll by fetching entire tables** or invent SQL.
5. Make new-indent vendor-mapping readiness experience clear (loading/success/error/readiness text) without retries or faux immediate availability until server contract is approved. Do not change snapshot semantics.
6. For draft manual-indent qty/date edit, build a presentation/validation proposal and a clear server RPC contract request; do **not** call nonexistent RPC or enable a write route until ChatGPT confirms and tests actual server contract. Keep eligibility denied for PR-linked/non-draft indents, including malicious client path tests.
7. Run relevant PEC smoke scripts and shared suite, add explicit responsive/interaction regression cases, self-review accessibility, no overflow, no double submits, no stale responses, no races, no permission weakening. Repair failures, document environment limitations.
8. Create **one** reviewable PR (no merge), with changed files, risk list, screenshots at multiple widths, exact tests/results and follow-up server dependency matrix. Update canonical PEC docs in branch only for material facts; avoid duplicating programme documents.

## Required acceptance detail
- Audit 100% of visible controls and table actions, not merely named ten requirements.
- Wide buttons labelled and icon-supported; narrow icon controls accessible, visually aligned, not overlapping.
- All five lenses and modal/dialog paths tested, including read-only, editing and unauthorized role.
- Correct search/sorting/pagination; existing row order, totals, selections, exports and hidden permissions preserved.
- Dates accurately distinguished: indent vs approval. No unapproved change of historical records.
- No direct PWA/Electron duplicate source. Do not bump `public/sw.js` or publish Electron, PWA or client version.
- No modifications to `supabase/migrations`, SQL, grants, RLS, Edge Functions, snapshot refresh policies or procurement business calculations.
- Maintain a short acceptance checklist with PASS/FAIL/DEFER and concrete evidence; never mark operator UI PASS from source inspection alone.

## Explicit coordination boundaries
Client may proceed on purely visual improvements and stable existing read contracts in parallel with server audit. Stop only for ambiguous business policy, missing server contract, security issues, cross-module conflict or risky merge. Server owner will send one consolidated contract delta covering manual draft edits, replenishment preview, and immediate mapping before client activates those capabilities. Rebase/review against then-current main and independent audit before any merge.

## Progress and release
Programme 0/6 verified; G0 server baseline active; C1 client bulk independently active once Claude executor picks it up. Client PR existence is not an accepted gate. PWA changes only after authorized merge and deployed asset verification; Electron follows subsequent release.
