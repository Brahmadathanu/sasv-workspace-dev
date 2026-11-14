# WP08 G2-0 corrective #416 — fail-closed writer controls and BOM mobile viewport (14 Nov 2026)

**Issue:** [#416](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/416). **Evidence:** authenticated Run 2 (`WP08_G2_0_AUTHENTICATED_PWA_ACCEPTANCE_EVIDENCE_RUN2_2026-11-14.md`, PR #415). **Base:** `main` `7392b1d25b24388204eb2b3ac3e36eec77d136cc`.
**Status:** implementation candidate for independent review. **Not merged, not deployed, registry SQL not applied, no permission/RPC/flag change.** WP08 remains **OPEN (8/13)**.
Scope reminder: this is a client **presentation / control-surface** correction. Run 2 showed writer-looking controls on denied pages; it did **not** demonstrate a server authorisation bypass or any mutation, and this document does not claim one. The database remains the sole authority.

## 1. Defect (measured on the base before changing anything, stubbed backend, 1280 px)

| Page | Denied | View-only |
|---|---|---|
| Products | `newInlineBtn` ("+") visible **and enabled** | disabled (correct) |
| RM BOM | `saveBtn` visible and enabled | `saveBtn` visible **and enabled** (also wrong) |
| SP BOM | `saveBtn` visible and enabled | `saveBtn` visible **and enabled** (also wrong) |
| PM BOM | `saveBtn` and header fields (`tplCode`, `refQty`, `lossPct`, `refUom`) enabled | header fields enabled; Save hidden by tab state |
Cause: the denied/early-return/bootstrap-failure paths never reached the pages' own `applyAccessChrome()` / `applyPermissionUi()`, and the BOM Save controls were never gated for view-only.

## 2. Correction (one shared mechanism, no new feature flag)

`public/shared/js/master-data-write-guard.js` (new, single source for Electron and PWA) keeps one access state on `<html data-md-access>`:

| State | When | Effect |
|---|---|---|
| `locked` | **default in static HTML before any script**; also after no session, session error/throw, permission RPC error/throw/non-array, denied, missing grant row | writer controls `display:none` (CSS), governed fields `pointer-events:none`, all of them `inert` + `aria-disabled` |
| `view` | permission verified: view without edit | writers visible but inert/dimmed; fields inert |
| `edit` | permission verified: view **and** edit | guard releases everything it set; the pages' own enable/disable logic is untouched |

- `inert` is used instead of rewriting `disabled`/`readOnly`, so the pages' existing state is never overwritten and is fully intact in `edit`.
- Elements opt in by static attributes: `data-md-writer` (buttons that start/confirm a write) and `data-md-field` (governed inputs). Counts: Products 10 + 19, RM 11 + 14, SP 10 + 14, PM 21 + 14.
- A **capture-phase** click/submit/keydown guard blocks writer elements unless the state is `edit` (this also stops a programmatic `.click()`).
- Each page wraps its permission resolution: any failure resets `PERM_CAN_VIEW/EDIT` to false and locks; success sets view/edit. Products locks in `setAccessDenied()` and derives the state in `applyAccessChrome()`.
- **Handler guards inspected:** Products already guards every writer function with `canWriteModule()`; PM already had `PERM_CAN_EDIT` guards on save/override/map/rebuild paths (which now fail closed because the flags are reset on failure). Added `requireEdit()` to the unguarded BOM entry points: RM/SP `saveBom`, create/clone/edit-header/delete-header confirm and open handlers, line-delete confirm; PM renumber, new/edit template open, create/apply template, delete-template confirm. No RPC name, argument, table or permission key changed (tested).

Registry/feature flags: unchanged. Permission keys unchanged (`module:manage-products`, `module:manage-rm-bom`, `module:manage-sp-bom`, **`module:pm-templates`**).

## 3. Viewport
`<meta name="viewport" content="width=device-width, initial-scale=1" />` added to `manage-rm-bom.html`, `manage-pm-bom.html`, `manage-sp-bom.html` (Products already had it). Layout width at a 390 px device is now 390 (was 980). **This is not a responsive PASS:** PM BOM keeps its known horizontal overflow (**UX-P05, WP11**); layout/acceptance remains WP11. No new overflow was introduced on RM, SP or Products at 390 px (measured).

## 4. Service-worker note
`master-data-write-guard.js` is a new module script. It is added to the existing network-first pattern in `public/sw.js` (still no `CACHE_NAME` change; the URL was never cached before) and to the G2-0 deployment gate manifest, so step A's gate token now covers it and has been re-stamped. Residual: devices still running the previously deployed service worker fetch this new URL cache-first once and may keep that copy until their worker updates (`skipWaiting` + `claim`).

## 5. Tests (see the PR for results)
`scripts/wp08-g2-0-shared-master-data/fail-closed.test.mjs` (Chromium, stubbed backend, Electron-root and PWA-public): per page and platform — denied, no session, session throws, permission RPC error / non-array / throw, wrong key, delayed permission answer (locked from first paint, then correct view-only), view-only strictly read-only, editor keeps governed controls (nothing pressed), denied at 390 px, programmatic activation of every writer reaches no writer RPC; viewport meta; and **mutation tests** that re-create the pre-fix behaviour (guard module permissive, lock CSS/attributes stripped) and require the same assertions to detect operable writers. `source.test.mjs` proves HTML differs from the merged G2-0 pages only by guard attributes/CSS/viewport and JS differs only by guard wiring with an unchanged RPC/table/permission surface.

## 6. Still required after merge and deployment (not done here)
Authenticated **positive** view and editor identities on the served PWA with real read data and **no writer pressed**, before any PWA registry activation (Issue #416 gate; Run 2 only exercised a denied identity).
