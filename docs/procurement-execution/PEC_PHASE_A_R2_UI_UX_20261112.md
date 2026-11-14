# PEC Phase A R2 — owner-directed UI/UX revision (12 Nov 2026)

**Scope:** issue #369 (owner's hands-on mobile review supersedes the R1 fixture-only visual PASS). Client only: `public/shared/procurement-execution-console.{html,js}` and `css/sasv-procurement-execution-console.css` (one shared source for PWA and Electron). No SQL, migrations, functions, permissions, `public/sw.js`, Electron/package versions or procurement records. Phase B draft editing and hybrid replenishment are not touched. **This is not genuine-session or owner acceptance; formal G0–G5 stay 0/6; promotion of Phase A to main stays ON HOLD.**

## 1. Identity
| Item | Value |
|---|---|
| Base | `integration/pec-erp-staging-20261112` @ `547db163` |
| Branch / draft PR | `claude/pec-r2-ui-ux` → target `integration/pec-erp-staging-20261112` |
| Client code under test | `3c09463a` (all `public/shared/*` changes). Later commits add tests/evidence/docs only. Visual run recorded at `3c09463a`; Electron run at `02bd6a0c` |
| Environment | Linux VM, Node 22, Playwright Chromium headless, Electron 36.8.1 (linux-unpacked via electron-builder) under Xvfb, jsPDF 2.5.1 + pdftotext. **Synthetic fixtures only.** Netlify preview unreachable from here (HTTP 000) |

## 2. What was implemented, per lens
**Shared mechanism (one implementation, no parallel renderers):**
- `createFeed()` / `createFeedFooter()`: bounded **server-backed incremental loading** replaces every numbered pager. Pages of 30 (75 for Vendor-wise/Action Queue) come from the existing paged RPCs; filters are snapshotted at reset; superseded responses are dropped and aborted (latest wins); the offset advances by what the server returned and duplicate keys are skipped; filter/search change resets to offset 0 and scroll 0; loading near the bottom is automatic; an always-visible **Load more** button (keyboard/screen-reader fallback) and a **Retry** state for a failed next page; `Showing X of N` / `End of list` status in a polite live region; loading stops at `PEC_FEED_MAX_ROWS` (1000) with an honest message (exports still cover every matching row — unchanged paged `fetchAllVendorBuylistPagedRows`).
- One header per lens: `h2` lens title + exact count right-aligned in the same row (`.pec-lens-head`); the former per-table titles ("Lines", "Buying List"), count rows and pagers were removed (markup, JS and CSS; no consumer remained — proven by the test suites).
- Search fields use the Stock Checker semantic fill (`--sasv-search-select-bg/-border`, focus → control background); filter buttons sit left of their search fields in all lenses and in the PR/indent **line** toolbars.
- **Cards ≤640 px**: every `table.erp-table` row becomes a labelled card through one CSS rule set; `data-label` comes from the column headings (`applyRowCards`); rows that open a detail are keyboard-reachable (Enter/Space). Tables are unchanged ≥641 px.
- Narrow chrome: ≤520 px the lens selector is the title and shows the active count; spacing/padding reduced; form/detail dialogs use the **whole viewport** with sticky header and sticky actions.

| Lens | Implemented |
|---|---|
| **Purchase Requisitions** (renamed from PR Workbench; ids unchanged) | feed + count `230 PRs`; new-PR (`+`) dialog full-viewport on phones with sticky actions; PR detail: **PR number is the header and a disclosure button** (aria-expanded) that expands the secondary info, **status pill immediately right**; redundant "Active — create an Indent or Close when done." hint removed (other hints kept); line filter left of line search; detail lines as cards with the same Load more fallback |
| **Purchase Indents** (renamed) | feed + count; dialog header: title/status/meta, close beside the title, and the **six actions (Open Source PR, Create PR Revision, Set Source PR, Resync, Delete Draft, Export) on their own row spread edge-to-edge (`space-between`) ≤820 px**; indent lines as cards; **Add Line restricted (see §4)** |
| **Vendor-wise Buying List** | feed + count; Export kept beside the count; row detail dialog is full-screen on phones and its breakdown is a list of labelled cards (no nested table); vendor/bucket semantics and exports unchanged; "split only" still uses the complete paged retrieval then client filter (no server parameter yet) |
| **Action Queue** | same footer/Load more on its existing `p_limit/p_offset` loader (75/page), count `N lines`, cards, simplified heading; priority order/eligibility untouched |
| **Excess Purchases** (renamed from Excess & Overshoot) | one workflow; feed + count; **Acceptance Audit on the first header line, right-aligned**; the explanation is preserved and shown permanently ≥641 px but collapsed behind an **About excess purchases** disclosure on phones; filter summary (e.g. "last 30 days") is separate from the count; audit dialog is a full-screen feed; reasons/audit traceability unchanged. #284's terminology concern is **not** marked resolved (needs deployment + owner acceptance) |

## 3. Before/after screenshots (synthetic data)
`docs/procurement-execution/evidence/pec-r2-claude-visual/before-after/` — R1 (merged #365) vs R2 for all five lenses at 390 and 1440 px. Full R2 set (320/390/820/1440 × five lenses, drawers, dialogs, error/empty/view-only/no-access): `evidence/pec-r2-claude-visual/<width>px-<NN>-<state>.png`; Electron: `…/electron/`. The earlier R1 directory is retained untouched.

## 4. Approved/issued Add Line — client lane
Before: `canAddIndentLine()` returned true for `draft | approved | issued`. Now `canAddIndentLine()` = editor ∧ not PR-linked ∧ **draft**. Enforced at four points: button visibility (`renderIndentLinesActions`: hidden for any non-draft; disabled-with-message for draft PR-linked), click handler, `openIndentAddLineModal`, and **`saveIndentAddLine`** (a forced/stale dialog is rejected before any RPC). The shared dialog also serves the existing-line quantity correction (`existingLineId`); that path keeps its own rule (`canEditExistingIndentLineQty`: editor, manual indent, approved/issued, selected line, **same item/UOM** — a tampered dialog that would insert another item is blocked). Finding: the *Edit Line Qty* button (`#iBtnEditLineQty`) is **not present in the markup** (on `main` either), so that correction path is currently unreachable from the UI; its code and guards are preserved unchanged in behaviour.
**This is a client guard only.** `proc_indent_add_line` / `proc_indent_add_line_pec_internal` still accept new approved/issued lines server-side (INSERT … ON CONFLICT DO UPDATE with a reason). A direct RPC under a valid editor JWT is not blocked by this PR; nothing here claims otherwise. **Server dependency (ChatGPT):** additive versioned migration with a status guard on the new-row path + negative tests, existing-line quantity semantics preserved, no rewrite of live migrations, no production SQL without separate approval.

## 5. Tests (this environment; `PEC_JSPDF_ROOT` set)
| Suite | Result |
|---|---|
| `pec-r2-ui-smoke` (new) | **80 PASS** — Add Line for draft/approved/issued/closed/draft-PR-linked + read-only, forced click/save, tampered edit dialog; lens names; filter-left/search-fill/one-heading at 1440 & 390; PR dialogs; six-action spread at 390 & 320; Vendor-wise detail; Excess help/audit; retry; duplicate-free overlapping pages; Action Queue feed |
| `pec-paging-contract-smoke` (rewritten for the feed) | **128 PASS** — first page only, scroll append, Load more by keyboard, offsets, no duplicates, filter reset to offset 0/scroll 0, exact counts, shrinking server data, stale slow response, rapid tab toggling, paged failure state, jump-to-indent, badge semantics, exports >1000 rows incl. real jsPDF PDF, **cards + keyboard rows + counts at 1440/820/390/320** |
| `pec-phase-a-visual-acceptance` (R2 evidence) | **164 PASS / 0 FAIL** at 320/390/820/1440 |
| `pec-phase-a-narrow-regression` | 8 PASS (pager assertions replaced by card/count/no-pager assertions) |
| `pec-erp-c1-layout` 118 · `c2-vendor-selection` 53 · `c1-five-lens-fasttrack` 23 · `c1-static` 17 · `five-lens-inventory` 0 FAIL/FIX (245 controls; 3 unreachable modals DEFER) · `vwl-search-reliability` 39 · `plm-pm-canonical` · `wp01-indent-serial` · `pr-scope` · `resync-mode` 3/3 · `pr-pdf-continuation-header` | PASS (harnesses updated only where they pinned removed pager code; assertions otherwise unchanged) |
| `pec-pwa-cache-freshness.test` 13 · `pec-vwl-offset-export-integrity.test` 6 · `fg-bit-ux-1/sw-freshness.test` 11 | pass, 0 fail |
| `pec-electron-acceptance` (packaged **Linux** Electron 36.8.1 at `02bd6a0c`) | **33 PASS / 0 FAIL / 2 NOT TESTED**: `app.asar` holds exactly the 3 canonical PEC files, byte-identical to the repo and to what the packaged app serves; five lenses at 1200/820/480; CSV and PDF export |
Totals (count-based suites above): **PASS 693 · FAIL 0 · NOT TESTED 2** (Electron authenticated roles; Windows/macOS builds). Test-harness quirk: `supabase/migrations/*` show CRLF-only worktree noise on this checkout; they were flagged `skip-worktree` locally and never staged.

## 6. Known defects and limitations
- Vendor-wise: the Export button occupies its own right-aligned row on phones (cosmetic).
- `Edit Line Qty` button absent from the markup (pre-existing); not restored here.
- Feed rendering re-renders the loaded list on each page (≤1000 rows, bounded); Vendor-wise and Action Queue keep their existing loaders and only adopt the shared footer/seed.
- Three unreachable modals remain DEFER; "split only" lacks a server filter.
- Lines of a single document (PR/indent detail) are one bounded read revealed in steps (not a server feed).

## 7. Needs ChatGPT / owner
ChatGPT: server-side Add Line status guard + tests (see §4); installed-PWA freshness and hosted preview test; Windows packaged build. Owner: **hands-on phone review** of every lens and dialog above; genuine Editor/View-only/no-access sessions (A01–A08) — none were available, nothing was faked and no mock session is claimed as security acceptance.
