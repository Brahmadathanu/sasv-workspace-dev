# PEC S4 — Consolidated UX correction / Claude Code bulk package
**Date:** 22 Nov 2026, IST  
**Owner:** SASV final approval authority  
**Target PWA branch/PR:** `fix/pec-s4-mobile-modals-20261122` / #498  
**Electron RC:** `release/v6.3.0-pec-s4` / draft #497  
**Baseline PWA patch at assignment:** `f66bbf32742b6ea43946c76d8264515d0890bedc` (refresh live head before editing)  
**Baseline Electron RC at assignment:** `24fc2677a50b9e1a7fc7f4900c15866f031c872e` (refresh live head)  
**Implementation status:** NOT ASSIGNED TO AN AUTONOMOUS AGENT BY THIS DOCUMENT. This is an implementation brief; do not mark executed without actual code/CI evidence.

## Objective

Resolve PEC modal/toolbar UX as **one coherent, bounded client package** based on authenticated owner mobile and desktop screenshots. Prior piecemeal fixes improved some elements, but created a crowded Generate PR modal, ambiguous quantity terminology and inconsistent scroll behavior. Deliver an ERP-grade responsive design preserving every functional server guard. **Do not reopen the already accepted S4 replenishment business rules.** The PWA accepts core S4 functionality; only UX acceptance is outstanding.

## Governing boundaries

- Strictly presentation and client state-machine changes in `public/shared/procurement-execution-console.html` and `public/shared/js/procurement-execution-console.js`, plus relevant browser tests.
- Preserve the existing IDs, server RPC names, writer permissions and error handling wherever possible; migrate IDs only with complete reference/CI/test updates.
- No Supabase SQL or migrations, no real PR/indent/PO writes, no deleting old history, no version bump, no installer publication, no updater-feed modifications.
- Do not merge #498 into main, merge #497, publish Electron or close issue #305 without owner gate.
- No implementation to invent extra fields or silently change S4 planning calculations; preserve current frozen evidence semantics, zero-month denominator 12, max independent plans, stock and approved/issued indent deductions, MOQ rounding, exceptions, audit and optimistic tokens.
- Keep honest View-only UI: no writer actions available to an unauthorized user, including menu items and dialogs; do not only visually conceal without the existing canonical permission checks.
- All tests must be non-writing or synthetic/rolled-back. Do not create a real PR to test.

## Task A — Generate Draft PR: primary form + separate requirement-review modal

Current Generate modal is excessively tall and has inner `genS4PreviewPanel` with long summary, search, scrollable exception panel and a checkbox whose label is visually misaligned (owner screenshot 18:02). **Implement a 2-stage flow:**

1. Primary **Create Draft PR** modal with PR number, effective-from date, start/end planning months, material class, conditional RM scope, notes. Keep existing mobile fullscreen behavior, aligned input heights, no overlap and clean header/footer.
2. Primary action **Review requirements** opens a separate **Requirement Review** modal: full-screen at narrow widths, structured panel/modal at desktop with one scroll region; show the counts by auto-eligible/review-required/zero-MRP/consumption-only and a searchable compact item list. Show review exceptions first; make detailed evidence expandable. No desktop double scrollbars, no excessive whitespace or nested scrolling.
3. A clearly aligned, clickable acknowledgement checkbox + concise 1–2 sentence explanation belongs **in the review modal**, near its sticky footer. Use semantic `label for`, flex align-start, 20+ px tap target, clear focus and keyboard interaction. Footer **Back** and **Confirm Review** buttons. Confirm closes the preview and returns focus to primary form, showing `Requirements reviewed` with count + `Review again` action. The **Generate** button is enabled only after this valid confirmation; it alone invokes the guarded `proc_pec_s4_generate_pr` writer.
4. On cancel/back without confirmation, primary form retains values but Generate stays disabled. If horizon months/material class/RM scope changes after confirmation, invalidate plan/signature, clear confirmation and require another preview. On PR number/effective date/notes changes preserve or explicitly review whether they affect server plan; **never ignore fields that are part of plan signature**.
5. Preserve single-flight and latest-wins sequence handling (`s4PlanRequestSeq`), modal focus return, overlay/escape conventions, loading/error states, and server recomputation at writer. No confirmation may create a draft or modify any source row.
6. Eliminate old inline preview and its nested scrollbar, while preserving consumption-only results, review-required gates and auto-eligible details.
7. Ensure 390px iPhone Safari and desktop keyboard/focus pass, including safe-area footer.

Source orientation: `s4ParametersForGenerate`, `s4InvalidatePreview`, `s4UpdateGenerateReady`, `s4PreviewForGenerate`, `s4RenderExceptions`, `generateDraftPr`, `openGeneratePrModal`, DOM IDs `genS4PreviewPanel`, `genS4Acknowledged`, `genS4PreviewExceptions`, `btnGenS4Preview`, `btnGenPrConfirm`.

## Task B — Consumption Coverage Review: semantic clarity and density

Current narrow-screen card shows `MRP / 12m Usage / Stock / Coverage: 4,000` for item `450 ML x 12 Nos - Carton`. This is misleading: 4,000 is **not months covered or stock coverage**. It is the **illustrative additional procurement quantity** after stock, outstanding indents and MOQ. Suggested user label: **Suggested additional Qty** (or `Additional requirement` if compactness requires). Preserve `Review only` when eligibility gate blocks application. Add the material UOM alongside quantity. Do **not** label the number `approved`, `order`, `purchase quantity`, or `stock coverage`.

Specific grounded example: `53,762 Nos / 12 * 2 = 8,960.333... Nos gross two-month usage; -2,155 stock -4,000 outstanding indents = 2,805.333...; MOQ 2,000 Nos => illustrative 4,000 Nos`. Source may show truncated formatted monthly average; do not reverse-compute an exact value from rounded UI. Historical 12-month usage is not a forecast guaranteed to occur.

Rename user-facing concept `Coverage Review` to **Consumption-based Requirement Review** or **Consumption Requirement Review** where appropriate, avoiding unnecessary long toolbar buttons. Desktop table should use `Suggested additional Qty` rather than `Illustrative Floor` or `Coverage` when referring to the numeric recommendation, with contextual `Illustrative · review only` copy. Preserve server field names and backend nomenclature; this is presentation only. The design must distinguish `MRP quantity`, `existing PR final`, `12m usage`, `stock`, `open indents`, `suggested additional`, and `review state` without implying MRP and usage plans are additive.

At mobile widths, compact row should primarily show item/UOM, recommended additional quantity and review badge, optionally one useful comparative value; move secondary quantities to a well-labelled expandable details section. Owner wants significantly less vertical height, not another 4-column metric card that reads like a dashboard. At desktop width preserve a legible table with sticky header; use one modal scroll region, not nested independent vertical scrollbars.

Introduce a restrained ERP style (light-filled filter select, subtle row separators, careful visual hierarchy, muted backgrounds, status contrast) consistent with existing module design; avoid gaudy decoration. Keep explanatory detail collapsed on mobile but discoverable, retain accessible legends and semantics, support dark theme where present.

DOM orientation: `ccfPreviewModalBackdrop`, `ccfPreviewFilter`, `ccfPreviewSummary`, `ccfPreviewTbody`, `renderCcfPreview`, `openCcfPreview`, `canApplyCcfLine`.

## Task C — PR Detail toolbar and More actions

The desktop header previously rendered long labels including the **internal S4 marker**. Use concise operational names. Keep frequent actions visible, less-frequent/reversible/destructive actions logically grouped under `More actions`, respecting draft/active/terminal state and View-only permissions. **More actions must close on:**
- click/tap outside,
- focus moving outside (including Tab),
- Escape,
- selection of a menu action,
- closing the parent PR modal,
- switching/reloading selected PR.

Implement with accessible keyboard semantics and a stable trigger; avoid accidental closing before nested confirmation opens. Restore focus to trigger when appropriate. Do not create duplicate listeners or a global click handler that breaks modal overlays. Avoid clipping menu in narrow/fullscreen modal, use correct z-index and placement; consider `popover` only if supported by target Electron 45/Chromium and PWA Safari, otherwise robust local disclosure/event delegation.

For long strings, retain accessibility names while keeping visible text short. Existing `applyResponsiveActionLabels` auto-appends `title` to `.icon-btn`; review these interactions instead of sprinkling CSS overrides. Avoid internal development markers in any visible labels. Preserve existing DOM button IDs and event handlers `btnPrS4Reconcile`, `btnPrCoveragePreview`, `btnPrRebuildFromMrp`, `btnPrDeleteDraft`, `btnPrClosePr`.

## Task D — New console error triage

Reported in Netlify preview:
`Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`.

Likely extension/message-channel injection, **but this is an inference, not confirmed**. Determine provenance before classifying: inspect stack and script origin, test in clean browser profile if possible, distinguish chrome extension messaging from app's own `chrome.runtime.sendMessage` or injected scripts. Do not install `window.onunhandledrejection` suppression to mask unrelated errors. If app-owned, fix exact async listener/promise response lifecycle and add regression. If extension-owned, document NOT APPLICATION BLOCKER with reproducible evidence. Earlier `cdn.segment.com ... net::ERR_BLOCKED_BY_CLIENT` originates from Netlify preview analytics and is unrelated unless new evidence contradicts.

## Acceptance/test matrix (mandatory)

1. Mobile 390px and desktop approx 1280px: Create form stays compact, first/last fields aligned and no overflow; review opens **different dialog**; Back/Confirm state and focus work; checkbox inline with its explanatory sentence; only Generate calls write RPC.
2. Invalid/missing dates, preview error, double click, stale response and changed parameters cannot leave Generate enabled. Cancel preview does not approve. Reopening after close does not reuse stale acceptance.
3. Mobile review dense: item name + UOM + **Suggested additional Qty** and review state prominent; expand shows supporting numbers and 12-month evidence. No `Coverage 4,000` terminology.
4. Desktop review one vertically scrollable results area, desktop table stays readable, filter select subtle fill, no nested vertical scrollbar; header and exit reachable.
5. More menu closes on outside click, focus loss, Escape, action selection and PR change; no hijacked handlers; permissions and status gating unchanged.
6. Existing `scripts/pec-erp-c1-layout-smoke.mjs`, `scripts/pec-erp-c1-static-smoke.mjs`, PEC Integrated Browser Acceptance, vendor-wise export integrity and Windows Electron smoke remain green; add targeted behavioral test(s) for modal/focus/confirm/one-scroll gate. Screenshots/readable test receipts, not bare assertions.
7. Do not trigger a production PR write. Use mocked/synthetic browser RPCs and strictly read-only authenticated PWA acceptance. Check PR-2026-07/08 remain DRAFT and unmodified.
8. Do not publish any installer. Once PWA UX accepted and PR #498 merged by separately approved owner action, bring the matching client changes into draft PR #497, rebuild/checksum the **exact** final v6.3.0 candidate and validate package manifest.

## Work coordination / output contract

One client bulk package, one coherent PR (#498) for PWA and mirror tested client changes into existing draft release PR #497. Do not create competing PRs or duplicate cherry-picks. Keep log of exact commit SHAs; don't confuse GitHub CI PR merge refs with source heads. Record before/after desktop and 390px browser evidence; stop if required test capability unavailable. Before commit, inspect and preserve current branches, owner changes and ongoing CI to avoid overwriting later work. Do not mark DONE without actual implementation and acceptance.

**Required report:** concise changes by A/B/C/D, tests with PASS/FAIL/NOT TESTED and run links, precise remaining release gates, server untouched assertion, PWA preview link, PRs #498/#497 head SHAs, and progress indicator `Server | Client | CI | PWA acceptance | Production PR reconciliation | Electron v6.3.0`.

## Owner decisions already recorded

- S4 business policy and approved PR #496 merge accepted; no reopening.
- Core PWA S4 read-only acceptance 5/5 PASS.
- PR-2026-07 and PR-2026-08 live reconciliation owner-approved separately but **not executed** due to missing real authenticated Editor executor; same-day safeguard must not be bypassed after date rollover.
- v6.3.0 publication remains **HOLD** pending owner authorization; prior unpublished Windows build and smoke receipts are not valid for newly changed client files.
