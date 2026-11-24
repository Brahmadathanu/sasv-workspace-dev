# PEC-UX-01 / PEC-UX-02 — Modal stack and secondary dialog modernization (Client PR A)

Scope: Procurement Execution Console only. Client-side; no server, migration, `public/sw.js`,
version or release change. Business-action handlers are untouched.

## 1. Defect and root cause (PEC-UX-01)

Reported: with an indent selected, opening a secondary dialog from the indent modal and pressing
Escape closed the **primary** indent modal.

Root cause (reproduced in Chromium against the real module):

1. Every PEC dialog is a `.modal-backdrop` with the same z-index, so what is *visually* on top is
   decided by **DOM order**.
2. Escape was handled by a hard-coded priority array in one document handler. Its order disagreed
   with DOM order for **more than 20 dialog pairs** (for example `vendorModalBackdrop`, opened from an
   indent line, is above the indent modal on screen but ranked below it in the array, so Escape closed
   the indent modal underneath it; same for `stockPicker` over `indentAddLine`).
3. A held key (auto-repeat) was not ignored, so one physical press could dismiss several layers
   (dialog, then the indent modal beneath it).
4. Escape was handled in four independent places (drawer/menu capture handler, PR "More" menu
   capture handler, the CCF-preview capture handler and the array loop), with no shared notion of the
   active visual layer. `vendorAliasMapModalBackdrop` is an unreachable template with no opener.
5. The PR line inline-quantity editor reverted its edit on Escape but let the event bubble, so the PR
   modal around it was also dismissed.

## 2. Fix

`public/shared/js/pec-modal-stack.js` — one stack manager and the only Escape dismisser:

- Open order is stack order; each open dialog gets `z-index = 9000 + 10·depth`, so the visual stack and
  the Escape order cannot disagree (below the 10000 toast layer; the inline `z-index: 10001` on the
  stock picker is removed because the manager owns it).
- The stack is reconciled **synchronously at each keydown** (pending MutationObserver records are
  flushed), so there is no timing window with the asynchronous observer.
- One physical press dismisses at most one layer. `e.repeat` and IME composition never dismiss.
- A top dialog whose closer refuses (busy writer, e.g. `s4CloseReconciliation`; or
  `data-pec-escape="protect"`) **consumes** the key; nothing underneath closes.
- Drawers, export menus and the PR "More" menu are transient layers owned by a dialog (via their
  trigger). They take Escape first only when they belong to the topmost layer.
- Focus returns to the control focused when the dialog opened, unless the closer already moved focus
  to a real control. Primary-modal state (search, scroll, selection) is never touched.
- Dynamically created dialogs join the stack automatically; with no registered closer they are
  dismissed through their own `.modal-close-btn` / `[data-pec-dismiss]` control.
- Escape runs the dialogs' *existing* cancel/close functions only. It never calls a confirm handler.

Removed competing handlers: the array loop, the drawer/menu capture handler, the PR "More" menu
keydown listener and the CCF-preview capture handler. The handler stays in the bubble phase so local
popovers (vendor/item search results) that `stopPropagation()` still dismiss their own layer first.

Existing parent→child cleanup is preserved and encoded in the test: closing a PR view also closes its
coverage preview; closing Generate PR also closes its S4 review / IND plan editor.

Import path carries a version suffix (`?v=20261124a`) because `public/sw.js` is protected on client
PRs (release PR only). **Release PR follow-up:** add `pec-modal-stack.js` to the network-first list in
`public/sw.js` and advance `CACHE_NAME`, after re-checking the current cache version.

## 3. Secondary dialog design (PEC-UX-02)

Reported dialog: Recommend & Accept Vendors used an `erp-modal-header` that had no layout rule
(close icon fell beneath the heading), hard-coded blue/grey colours in an inline `<style>` block, and
unstyled radios and footer.

Reusable `pec-dialog` treatment (token-only CSS in `sasv-procurement-execution-console.css`):
compact 44px header (title left, subdued context such as `Indent #161`, close icon right on the same
row), uniform 16px gutters (14px narrow), neutral surfaces, accent-coloured compact radios/checkboxes,
Cancel (neutral outline) then primary Confirm in an aligned footer, safe-area padding, visible focus.
Narrow screens keep the established S4 full-viewport dialog sheet.

Applied to indent-originated dialogs: Recommend & Accept Vendors, Indent action (approve/issue/close),
Set Source PR, Resync, Add Line, Clear Vendor Assignment, Select Vendor, Export, Delete Draft, Stock
Picker. PR-side siblings that shared the identical markup and showed the same uneven padding in the
visual audit: Change PR Status, Add PR Line, Refresh Snapshots, Accept Excess. Not touched: the
full-page indent/PR modals, S4/IND/CCF/reconcile dialogs, create-indent, indent-from-PR, PR rebuild,
Generate PR.

Preserved: both vendor-handling choices and wording, the default (clear inactive recommendations
only), permission checks, confirmation semantics and all element ids.

## 3a. Review hardening (after independent review of a468de5)

Each item was first reproduced by a failing test, then fixed:

1. **Same-turn opens in reverse DOM order** fell back to DOM order (the stack was rebuilt from a DOM
   scan). The manager now applies the ordered `MutationRecord`s (`attributeOldValue`), so actual open
   order wins and a re-opened dialog moves to the top.
2. **Focus left on a hidden element**: when the dismissed dialog's focused control stayed attached but
   invisible, focus ended on `<body>`. Focus is now treated as lost when it is inside the dismissed
   dialog or on any non-rendered element, and returns to the initiator.
3. **Busy dialogs**: the in-flight Delete Draft confirm could be dismissed mid-write. It is now marked
   `data-pec-escape="protect"` for the duration of the write (the reconcile and IND-plan writers were
   already guarded). `aria-busy="true"` is also honoured.
4. **Drawer stacking**: portaled filter drawers carried a fixed `z-index: 2147483647`, so they covered
   dialogs opened above their owner. Their z-index now comes from `modalStack.transientZ` (owner + 5).
   Export menus and the PR More menu live inside their dialog and already stack correctly.
5. Lint/syntax: `node --check` on all changed JS; ESLint 9 with the repository config. The 16
   pre-existing `no-unused-vars` / `no-useless-catch` errors in `procurement-execution-console.js` are
   identical on main; the new files are clean.

Module import version suffix advanced to `?v=20261124b`.

## 4. Evidence

- Screenshots: `docs/procurement-execution/evidence/pec-modal-ux/{before,after}` at 1440 px and 390 px
  (regenerate with `node scripts/pec-modal-ux-evidence.mjs <dir>`). Offline synthetic fixture; the
  non-real-flow dialogs are forced open for a layout audit only.
- Interaction: `scripts/pec-modal-stack-smoke.mjs` (real browser, real module, synthetic Supabase stub):
  870 ordered dialog pairs, the real Recommend flow with focus/state preservation, held-key and rapid
  presses, three-level unwind, protected and dynamic dialogs, IME, drawer/menu precedence, and a
  no-mutation check. Wired into `.github/workflows/pec-integrated-browser-acceptance.yml`.
- The same script run against unmodified main fails (defect reproduction). Results are in the PR.

Limitations: automated offline acceptance only. Authenticated-browser acceptance on the deployed PWA
and real Windows Electron acceptance are not claimed.
