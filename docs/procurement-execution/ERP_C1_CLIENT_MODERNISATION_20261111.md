# PEC-ERP-C1 — Client modernisation: implementation facts, audit matrix, acceptance

**Issued:** 2026-11-11 · **Tracker:** #284 · **Package:** #288 · **Brief:** `ERP_CLAUDE_CLIENT_BULK_BRIEF_20261111.md` (branch `docs/pec-erp-g0-baseline-20261111`, draft PR #287 — not on main at time of writing).
**Status:** candidate PR for independent review. Not merged, not deployed, no Electron/PWA version change.

## 1. What changed (client only)
| File | Change |
|---|---|
| `public/shared/css/sasv-procurement-execution-console.css` (new) | Token-based design layer scoped to `body.sasv-pec`, loaded after the inline legacy `<style>` (same pattern as `sasv-stock-checker.css`). Typography (Inter via `--sasv-font-sans`), colours (semantic action/status tokens replace ad-hoc blues/greys), spacing, buttons, tabs, tables, modals, banners, focus ring, responsive rules. |
| `public/shared/procurement-execution-console.html` | `lang="en-GB"`, `data-sasv-theme`, `body.sasv-pec`, canonical header (`sasv-module-title`, header actions), HOME markup, `iThIndentDate` column header (hidden unless contract supplies data), Excess section note. |
| `public/shared/js/procurement-execution-console.js` | `mountModuleHome`; `applyResponsiveActionLabels`; ARIA tab semantics + arrow/Home/End keyboard; `renderTableStateRow` empty/error states for PR, Indents, Action Queue, Excess, Acceptance Audit; conditional Indent Date; vendor-snapshot readiness wording on indent-create toasts. |
| `scripts/pec-erp-c1-static-smoke.mjs`, `scripts/pec-erp-c1-layout-smoke.mjs` (new) | Regression guards (below). |

Single shared source is preserved: the module and the new CSS live only under `public/shared/`; nothing is copied into Electron- or PWA-specific paths. `public/sw.js`, `supabase/`, package/Electron versions are untouched (asserted by the static smoke).

**Defect found and fixed during testing:** `.page-shell { display:flex }` overrode the `hidden` attribute, so for a user without module access `mainPanel.hidden = true` did not hide the panel (tab strip stayed visible; no data loads because the script returns early). `body.sasv-pec [hidden]{display:none!important}` restores intended behaviour. Also fixed: global `style.css` `td{white-space:nowrap}` clipped long item names into horizontal scroll; PEC data cells now wrap (dates/numbers stay single-line).

## 2. Element-by-element audit and acceptance matrix
Legend — PASS: verified by an automated test in this PR against **synthetic fixtures** (not signed-in operations); DEFER: needs signed-in verification or server contract.

| Area / control | Finding (before) | Fix | Evidence | Status |
|---|---|---|---|---|
| Page title / subtitle | `h1` colour/size ad hoc; subtitle 0.95rem | Canonical 1.125rem/600 title, 0.8125rem muted subtitle, hidden ≤520px | layout smoke (3 viewports) | PASS |
| HOME | Title-case `Home`, local icon-btn markup, not canonical | `mountModuleHome` (icon + `HOME`, `aria-label`/`title` = `HOME`), label hidden ≤520px | layout smoke | PASS |
| Header actions (Workflow Guide, Refresh snapshots) | Icon-only at all widths | Refresh gets visible label >820px; guide stays icon-only; `aria-label` retained | layout smoke | PASS |
| Lens tabs (5) | No `role=tab`/`aria-selected`, no keyboard model, ad-hoc blue | WAI-ARIA tabs, roving tabindex, ←/→/Home/End, `tabpanel` roles, SASV action colours; mobile `<select>` retained | layout smoke (all 5 × 3 widths + keyboard) | PASS |
| Toolbar buttons (Filters, Generate PR, New Indent, Create from PR, Export, Acceptance Audit, Refresh) | Icon-only everywhere | Wide: icon + label from `aria-label`; ≤820px icon-only with accessible name; pagers/clear/close stay icon-only by design | layout smoke | PASS |
| Pagers (all lenses) | Icon-only (kept) | Names verified | layout smoke (no unnamed buttons) | PASS |
| Search inputs, filter drawers | Ad-hoc borders/focus | Token borders, SASV focus ring, drawer `max-width` viewport-safe | layout smoke (no h-overflow) | PASS |
| Tables (PR, Indents, Action Queue, VWL, Excess, Audit, line tables) | Inconsistent header styling; long text clipped by global nowrap | Token header/divider styles, wrapping data cells, tabular numerals, scroll containers retained | screenshots, layout smoke | PASS |
| Empty / error states | Toast only (PR, Indents, Action Queue, Excess, Audit) | Inline `role=status`/`alert` state rows; AQ error not wiped by final render | layout smoke (empty + error scenarios) | PASS |
| Loading states | Existing masks/aria-busy | Retained unchanged | existing behaviour | PASS (retained) |
| Indent vs Approved date | Only `approved_date` shown | Separate `Indent Date` column/meta/detail row **only when `indent_date` is present in the read result**; never derived from `approved_date` | layout smoke (present and absent); live contract confirmed by server audit (PR comment 2026-11-11) | PASS |
| Excess & Overshoot wording | Heading only | Subtitle derived from current code semantics (excess purchase → accept with reason → Acceptance Audit). Tab name unchanged | review | PASS |
| New-indent vendor readiness | Silent | Create-success toasts and AQ empty state say that **Action Queue recommendations and the Vendor-wise Buying List are published-snapshot based** and may not show new lines yet; they explicitly state manual vendor selection is not affected (per server delta: manual selection is allowed on draft/approved/issued). No retry, polling or faux availability | static review | PASS (text only) |
| Dynamic / re-rendered buttons (indent status actions, modal upgrades) | Labels injected once at boot would miss them or be wiped by `toIconBtn` | Coalesced `MutationObserver` re-applies labels (idempotent); long tooltips shortened for the visible label (e.g. `Close Strict`) | layout smoke: modal status actions labelled wide / hidden narrow | PASS (indent modal); other modals covered by the same observer, not individually screenshotted |
| Modals/dialogs (≈30) | Mixed fonts/colours | Token typography, buttons, radius, max-width, close buttons 36px | static + screenshots of host pages; modals **not individually screenshotted** | PASS (tokens) / DEFER per-modal visual sign-off |
| Read-only role | Banner present | Verified banner visible, edit actions gated by existing code | layout smoke | PASS |
| Unauthorised role | Panel stayed visible (bug) | `[hidden]` rule fix | layout smoke | PASS |
| Exports (PDF/CSV/TSV) | — | Untouched; no logic change | static smoke (RPC/exports unchanged) | PASS (unchanged) |
| Signed-in operation of every lens with real data | — | — | none | **DEFER** |

## 3. Infinite-scroll inventory
| Table | Current data contract | Result |
|---|---|---|
| Action Queue | `proc_procurement_action_queue_paged` (`p_limit`/`p_offset`, `total_count`), scroll-append, latest-wins (`aqRequestSeq`), reset on filter | Already infinite scroll on a real paged contract — **preserved**; error/empty rows added |
| Vendor-wise Buying List | `proc_vendorwise_buylist_filtered` returns the full filtered set; client sorts/groups, then slices (Prev/Next) | Not server-paged → **not converted** |
| PR headers, Indent headers | `proc_pec_pr_headers` / `proc_pec_indent_headers` return whole sets; client filter + slice | Not server-paged → not converted |
| Excess purchases, Acceptance audit | `proc_pec_purchase_excess` / `proc_pec_excess_acceptance_audit` whole sets; client slice | Not server-paged → not converted |
| PR lines / Indent lines (modals) | `proc_pec_pr_lines` / `proc_pec_indent_lines` per-document sets; existing scroll reveal | Bounded by document; unchanged |

Faking infinite scroll over fully-fetched sets was deliberately not done.

## 4. Server contracts / confirmations needed (for ChatGPT)
1. **Paged read RPCs** with deterministic keyset order and `total_count`: `proc_pec_indent_headers` (order `indent_id desc`, filters status/class/search), `proc_pec_pr_headers` (`pr_id desc`), `proc_pec_purchase_excess` (`net_unallocated_qty desc, voucher_date desc, purchase_fact_id desc`, plus the date/min-qty/item/unmapped filters currently applied client-side), `proc_pec_excess_acceptance_audit` (`accepted_at desc`), and `proc_vendorwise_buylist_filtered` (stable vendor-group ordering with cursor; client currently sorts across the whole set, including the split-only/vendor-key filters).
2. **Indent date:** CONFIRMED by the server audit — `proc_pec_indent_headers()` returns `v_proc_indent_console`, which exposes `indent_date` and `approved_date`. Still to confirm: whether Action Queue `row_data` carries it (the detail row renders it only if present).
3. **Draft manual-indent qty/date edit:** needs a new RPC (draft-only; rejects PR-linked and non-draft indents server-side; preserves canonical `indent_line_sort_no`/insertion order; returns updated line). Client UI proposal: inline numeric/date editors on draft manual lines in the indent modal with the same pattern as PR manual delta (disabled for PR-linked/non-draft, optimistic lock, single in-flight submit). **Nothing is wired**; the static smoke asserts no such RPC is referenced.
4. **Immediate vendor mapping for new indents:** needs a contract stating when candidates are available (synchronous vs snapshot). Until then the UI only states the snapshot dependency.
5. **Hybrid replenishment / snapshot-generation changes:** no client work done.

## 4b. Release gate — PWA cache policy (NOT changed in this PR)
Independent audit finding: `public/sw.js` (v393) serves navigations network-first, but `/shared/js/procurement-execution-console.js` and the new `/shared/css/sasv-procurement-execution-console.css` fall under the generic static cache-first path, so an installed PWA could pair fresh HTML with cached old JS/CSS. C1 deliberately does **not** edit `sw.js` or bump the cache version. A separately reviewed change is required for a network-first-with-fallback policy limited to these exact PEC assets, with mocked online/offline SW tests and installed-PWA verification after an approved merge. **PWA immediate-update parity must not be claimed until then.**

## 5. Tests (exact commands and results, 2026-11-11)
| Command | Result |
|---|---|
| `node scripts/pec-erp-c1-static-smoke.mjs` | PASS (15 checks) |
| `node scripts/pec-erp-c1-layout-smoke.mjs --shots docs/procurement-execution/evidence/pec-erp-c1` | PASS (118 checks: 3 viewports × 5 lenses, keyboard, indent-date present/absent, read-only, empty/error incl. colspan vs visible headers, dynamic modal buttons, unauthorised) |
| `node scripts/pec-wp01-indent-serial-smoke.mjs` | PASS |
| `node scripts/pec-vwl-search-reliability-smoke.mjs` | PASS (31 checks) |
| `node scripts/pec-pr-scope-smoke.mjs` | OK |
| `node scripts/pec-plm-pm-canonical-smoke.mjs` | passed |
| `node scripts/pec-pr-pdf-continuation-header-smoke.mjs` | OK (runtime PDF portion SKIPPED — jsPDF libs not installed in this environment) |
| `node --test scripts/fg-bit-ux-1/sw-freshness.test.mjs` | 11/11 pass |

The layout smoke runs the real module and HTML in Chromium; only `js/supabaseClient.js` is replaced with a synthetic fixture. Widths: 1440 (wide), 820 (tablet), 390 (narrow mobile). Screenshots: `docs/procurement-execution/evidence/pec-erp-c1/{wide,tablet,mobile}-{pr,indents,vendor-buylist,action,excess}.png` — **synthetic data; layout evidence only**.

## 6. Acceptance checklist
| Item | State |
|---|---|
| Design-language parity (tokens, typography, header, HOME) | PASS (fixture) |
| Wide icon+label / narrow icon-only with accessible names | PASS (fixture) |
| No horizontal page overflow at 1440/820/390, all five lenses | PASS (fixture) |
| Empty / error / loading states | PASS (empty/error fixture; loading retained) |
| Indent vs approved date | PASS (UI) / DEFER (live contract) |
| Infinite scroll where server-paged | PASS (Action Queue preserved); others DEFER on server paging |
| Draft-edit, hybrid replenishment, immediate mapping | DEFER (server) |
| No SQL/RLS/migration/SW/Electron change | PASS (static smoke) |
| Signed-in operator acceptance in PWA and Electron | **DEFER — not claimed** |
| PWA asset cache policy for PEC JS/CSS | **DEFER — release blocker, separate PR** |
| PR PDF runtime path | **Not verified** (jsPDF skipped in test environment) |
| Per-modal visual sign-off with real data | DEFER |

## 7. Risks
- The inline legacy CSS (~1,900 lines) still exists; the new layer overrides it by scope + order. Removing legacy rules is a later clean-up.
- `[hidden]{display:none!important}` is global to the page; any future code must not rely on `hidden` plus a display rule to show an element.
- Action-label injection reads `aria-label`; new icon buttons need that attribute to receive a visible label.
- Visual review in real Electron/PWA is still required before release.
