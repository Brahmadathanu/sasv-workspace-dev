# PEC-C1 five-lens fast-track — acceptance ledger (12 Nov 2026)

**Tracking:** #284, #305 · **Brief:** `ERP_CLAUDE_CLIENT_BULK_BRIEF_20261111.md` + the 12 Nov handoff delta · **Status:** draft PR, client only, not merged/deployed. Formal PEC gates are **not** promoted by this document.

## 1. Base and overlap decisions
| Item | Fact / decision |
|---|---|
| Source `main` | `0bb06576` (merged into this branch; no conflicts). |
| Branch base | **Owner-chosen: stacked.** `main` still lacks C1 (#291) and C2 (#301), which already deliver the Indent Date column, labels/ARIA/responsive layer, empty/error states and Select Vendor. This branch = `main` + C1 (`2182bcc`) + C2 (`9b7f2bc`) + the delta below. Review the delta with `git diff claude/pec-erp-c2-immediate-vendor-selection...HEAD`. Merge order is C1 → C2 → this PR; if #291/#301 merge first this PR shrinks to the delta; this PR must not be merged ahead of them. |
| Draft PR #319 (resync `full`→`reset`) | **DROPPED here, no overlap.** `confirmIndentResync` still contains `const mode = bd.dataset.mode === "full" ? "full" : "safe"` and sends it as `p_mode`; this PR does not touch that line or add #319's test. **Until #319 merges, "Full" resync sends `full`, which the server rejects** (`Invalid p_mode … Use safe or reset`) — the new message maps that rejection to plain language. Success/copy text uses the UI label (Safe/Full), independent of the wire value, so it is correct before and after #319. Rebase after #319 merges. |
| Draft PR #317 (server exclusions) | Not touched. Client only adds truthful wording for its guards; no RPC signature, permission or calculation change. |
| SQL / RLS / migrations / `sw.js` / versions | Zero changes (asserted by `pec-erp-c1-static-smoke.mjs`). |
| Electron path | `main.js` loads pages by URL (`http://localhost:3000/…`, `open-module-url`); no PEC-specific file, copy or registry entry exists outside `public/shared/` (grep over repo, excluding docs/scripts). Single shared source **PASS** by repository inspection; a packaged Electron build was **not** inspected. |

## 2. Delta in this PR (beyond C1/C2)
1. **Accessibility defects found by the new inventory and fixed:** ~40 form controls in reachable modals had a `<label>` with no association (Create Indent, Indent from PR, Generate PR, Add line ×2, Accept Excess, Approve/Close action, Set Source PR, Set status, Export form, stock picker, split-vendor picker) → `for=` added / `aria-label` added; two dialogs had empty static titles (runtime-filled, now recognised).
2. **Truthful server-guard wording** (`mapPecServerGuardMessage`, applied to resync, create indent, create from PR, PR revision, set source PR, PR rebuild, generate PR, PR add line, indent add line): internal finished-bulk/semi-finished rejection, no-purchasable-lines, draft-only resync, source PR must be active, rebuild/revision status rules, not-editable status, reason-required, MRP UOM factor. Unrelated errors keep their original text.
3. **Resync modal copy** states that Safe keeps manual lines and Full removes them, that it is draft-only and needs an active source PR, and that internal materials are excluded server-side. Generate-PR and Rebuild modals carry the same exclusion note.
4. **Control inventory tool** `scripts/pec-five-lens-inventory.mjs` (+ `--md`): static DOM × JS cross-reference; gate used by the new smoke.
5. **Finding (not changed):** three modals have no JS opener or handler at all — `vendorAliasMapModalBackdrop`, `prEditReqModalBackdrop`, `prEditDeltaModalBackdrop` (dead markup). Left in place; owner to decide on removal. They are reported DEFER in the inventory, not counted as PASS.

## 3. Five-lens coverage (PASS / FAIL / DEFER)
Evidence level: **F** = synthetic-fixture browser test, **S** = static source/inventory, **—** = none. Nothing below is signed-in acceptance.

| Lens | Controls | UX states | Accessibility | Responsive 1440/820/390 | Exports | Permissions (edit / view / none) | Paging |
|---|---|---|---|---|---|---|---|
| PR Workbench (`tab-pr`) | PASS (S) 9 id-bearing, all named + wired | PASS (F) empty/error rows | PASS (S,F) tab ARIA, labelled modal fields | PASS (F) | PASS-unchanged (PR export lives in PR modal; code untouched; PDF runtime **not verified**) | PASS (F) fixtures; **BLOCKED** real accounts | Explicit Prev/Next over client-sliced full read (`proc_pec_pr_headers`, no params) → **DEFER** server paging contract |
| Action Queue (`tab-action`) | PASS (S) 11 | PASS (F) empty + error (error row survives final render) | PASS (S,F) | PASS (F) | PASS-unchanged | PASS (F); BLOCKED real | **PASS (S)** `proc_procurement_action_queue_paged` (`p_limit/p_offset`, `total_count`), scroll-append, latest-wins — preserved |
| Indents (`tab-indents`) | PASS (S) 10 | PASS (F) | PASS (S,F) + keyboard line selection | PASS (F) | PASS-unchanged | PASS (F) incl. Select Vendor gating; BLOCKED real | Prev/Next over client slice (`proc_pec_indent_headers`) → **DEFER** |
| Vendor-wise Buying List (`tab-vendor-buylist`) | PASS (S) 17 | PASS (F) existing empty/error rows retained | PASS (S,F) | PASS (F) | PASS-unchanged (VWL CSV/TSV/PDF untouched) | PASS (F); BLOCKED real | Client slice of full `proc_vendorwise_buylist_filtered` → **DEFER** server paging + stable cursor |
| Excess & Overshoot (`tab-excess`) | PASS (S) 15 | PASS (F) empty/error incl. audit modal | PASS (S,F) | PASS (F) | No export exposed in this lens | PASS (F); BLOCKED real | Client slice (`proc_pec_purchase_excess`, `proc_pec_excess_acceptance_audit`) → **DEFER** |

ID-bearing control counts (this tool's definition: any `button/input/select/textarea/a[href]/role=…` with an `id` inside the pane, including controls added by C1/C2 and filter-drawer inputs) were pr=9, action=11, indents=10, vendor-buylist=17, excess=15; the handoff's baseline (8/10/9/16/16) uses a different counting scope, so the two are **not reconcilable by number** (+1 per lens is not asserted to be a specific control, and Excess is one lower). Full per-element detail: `evidence/pec-c1-fasttrack/control-inventory.md` (253 controls, 0 FAIL, 28 DEFER rows for the three unreachable modals).

Other required items: Indent Date column PASS (F; present/absent contract cases; live contract confirmed by server review, `indent_date` + `approved_date` null semantics preserved); Excess & Overshoot wording **unchanged** except the validated section note from C1 (no new renaming); infinite scroll **not simulated** for any table with an unpaged RPC; real-account read-only/editor/unauthorised acceptance **BLOCKED** (no acceptance session in this environment; fixtures are reproducible via the scripts below).

## 4. Tests (this environment, 12 Nov 2026)
| Command | Result |
|---|---|
| `node scripts/pec-c1-five-lens-fasttrack-smoke.mjs` | PASS (23 checks: inventory gate, 11 guard mappings, resync copy/label/RPC/rejection ×2 modes) |
| `node scripts/pec-five-lens-inventory.mjs --md …` | PASS (253 controls, 0 FAIL) |
| `node scripts/pec-erp-c1-layout-smoke.mjs --shots docs/procurement-execution/evidence/pec-c1-fasttrack` | PASS (118) — screenshots for 5 lenses × 3 widths |
| `node scripts/pec-erp-c2-vendor-selection-smoke.mjs` | PASS (53) |
| `node scripts/pec-erp-c1-static-smoke.mjs`, `pec-wp01-indent-serial-smoke`, `pec-vwl-search-reliability-smoke`, `pec-pr-scope-smoke`, `pec-plm-pm-canonical-smoke`, `pec-pr-pdf-continuation-header-smoke` | PASS (PDF runtime portion SKIPPED: jsPDF not installed) |
| `node --test scripts/fg-bit-ux-1/sw-freshness.test.mjs` | 11/11 |

## 5. Server / owner dependencies (for ChatGPT independent acceptance)
1. Paged read RPCs with deterministic keyset order and `total_count` for PR headers, Indent headers, Purchase excess, Excess acceptance audit, Vendor-wise buying list (details in `ERP_C1_CLIENT_MODERNISATION_20261111.md` §4).
2. #319 must merge for Full resync to work; until then Full is rejected by the server (message now explicit).
3. Owner decision on removing the three unreachable modals.
4. Authenticated editor / view-only / no-access sessions for real-account acceptance (BLOCKED here).
5. PWA cache policy for PEC JS/CSS (C1 §4b release gate) before claiming immediate PWA update parity.

## 6. Risks
Stacked scope (large diff until #291/#301 land); legacy inline CSS still overridden by cascade; `for=` association edits touch many modal labels (covered by inventory gate, not by per-modal real-data walkthrough); guard-message regexes depend on server message text and fall back to the original text if wording changes.
