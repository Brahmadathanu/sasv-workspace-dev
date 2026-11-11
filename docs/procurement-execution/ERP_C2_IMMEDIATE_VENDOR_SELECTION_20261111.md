# PEC-ERP-C2 — Immediate vendor selection from Indents

**Issued:** 2026-11-11 · **Tracker:** #284 · **Package:** #294 · **Status:** candidate PR, not merged, not deployed.
**Branch base:** `claude/pec-erp-c2-immediate-vendor-selection` is **stacked on the C1 branch** `claude/pec-ui-ux-modernisation-hx5g2n` (PR #291, unmerged) because C2 relies on the C1 design layer and dynamic action labels. The C2 PR targets `main`, so until #291 merges its diff also contains C1; review C2 as the last commit(s) (`git diff claude/pec-ui-ux-modernisation-hx5g2n...HEAD`). If #291 is rebased or squash-merged, C2 must be rebased onto the new main.

## 1. Behaviour
An operator with PEC Edit can open an indent, select a line, press **Select Vendor** and assign an active vendor immediately — no wait for the published Action Queue / Vendor-wise Buying List snapshot.

| Aspect | Implementation |
|---|---|
| Entry point | `#iBtnSelectVendor` in the indent modal toolbar (`icon-btn primary`, "user-check" icon, `aria-label`/`title` "Select Vendor"). C1's label observer gives it a visible label on wide screens (>820px) and icon-only below. |
| Eligibility | `indentAllowsVendorSelection`: status draft / approved / issued; plus `canWriteModule()` (PEC Edit). Closed, cancelled, read-only and unauthorised: button hidden; forced click is rejected (`canPerformEditAction` / status guard) and no RPC is called. Re-checked again in `saveVendorSelection` for indent-origin saves. Server remains authoritative. |
| Modal reuse | Existing `openVendorModal(row, { origin: "indent" })`; no second modal or writer. Row = live `proc_pec_indent_lines` row spread plus parent `indent_number`/`indent_id`/status. |
| Recommendations | `buildSuggestedVendorsFromRow` still reads only L1–L3 fields present on the row (none on indent lines → none shown). If the line row carries the server's current `recommended_vendor_id`, it is listed as "Recommended" with its own `recommended_rate`. Nothing is invented. No candidate rates or balances are shown otherwise. |
| No recommendation | Explicit note ("No recommendation is available for this line yet…") and the existing active-vendor search (`proc_vendor_lookup`, `p_active_only: true`). Inactive vendors cannot be listed; a server rejection is mapped to "Selected vendor is inactive." |
| Reason rules | Unchanged `isVendorSelectionReasonRequired`: required for manual choice without recommendation, deviation from recommendation, and pending rate. |
| Save | Existing `proc_indent_set_vendor_selection` (still the only call site). `modal.saving` re-entry guard + disabled/`aria-busy` Save; close is ignored mid-save. On failure the modal stays open, Save re-enabled, line unchanged. |
| After success | Modal closes, success toast, then `refreshIndentAfterVendorSelection`: `loadIndentLines(…, { preserveView, selectLineId })` (keeps selection, filter, search, scroll, visible count) and a best-effort header refresh. Action Queue refresh is fired without awaiting and only if it was loaded; Vendor-wise Buying List is **not** queried (draft indents are not placed in the published list). |
| Races | `loadIndentLines` gained a latest-wins sequence and ignores results if another indent is open. |
| Accessibility | Indent line rows are keyboard-selectable (`tabindex=0`, Enter/Space, `aria-selected`). Focus returns to the Select Vendor button on close. |

Unchanged: statuses/transitions, serial/insertion ordering (`indent_line_sort_no`), PR-link traceability, exports, Action Queue vendor flow (origin `action-queue` path identical, including its AQ/VWL refresh), snapshot four-stage process.

## 2. Files
`public/shared/js/procurement-execution-console.js`, `public/shared/procurement-execution-console.html` (button), `scripts/pec-erp-c2-vendor-selection-smoke.mjs` (new), `scripts/pec-erp-c1-static-smoke.mjs` (+2 checks), `scripts/pec-wp01-indent-serial-smoke.mjs` (test DOM stub gained `setAttribute/removeAttribute` and a no-op for the new UI hook; assertions unchanged), this doc, `evidence/pec-erp-c2/*.png`. No SQL, migrations, RLS, new RPC names, `public/sw.js`, cache version or Electron/package changes.

## 3. Conflicts / interactions with PR #291 (C1)
- **Stylesheet:** C2 adds no CSS; the button uses C1's `.icon-btn.primary` tokens and `sasv-procurement-execution-console.css`.
- **Dynamic labels:** the button is static HTML and is labelled by C1's `applyResponsiveActionLabels`/observer. It is `hidden` until eligible; `[hidden]` is enforced by the C1 `body.sasv-pec [hidden]` rule.
- **Same-file overlap:** both PRs edit `procurement-execution-console.js/.html`; C2 is based on C1 to avoid conflicts. Merge order must be C1 then C2.
- **PWA cache policy:** C1's release gate (network-first for PEC JS/CSS) applies equally to C2; not addressed here.

## 4. Tests (2026-11-11)
| Command | Result |
|---|---|
| `node scripts/pec-erp-c2-vendor-selection-smoke.mjs --shots docs/procurement-execution/evidence/pec-erp-c2` | PASS (39 checks) |
| `node scripts/pec-erp-c1-static-smoke.mjs` | PASS |
| `node scripts/pec-erp-c1-layout-smoke.mjs` | PASS (118) |
| `node scripts/pec-wp01-indent-serial-smoke.mjs`, `pec-vwl-search-reliability-smoke.mjs`, `pec-pr-scope-smoke.mjs`, `pec-plm-pm-canonical-smoke.mjs`, `pec-pr-pdf-continuation-header-smoke.mjs` | PASS (PDF runtime part skipped: jsPDF not installed) |
| `node --test scripts/fg-bit-ux-1/sw-freshness.test.mjs` | 11/11 |

C2 smoke scenarios (synthetic fixtures, real module): status eligibility for draft/approved/issued/closed/cancelled; read-only (hidden, forced click → no modal/RPC); no line selected; no recommendation (nothing fabricated, explanatory note); manual reason required; recommended vendor with rate needs no reason; deviation requires reason; pending rate requires reason and saves `null`; inactive-vendor server rejection; save failure keeps modal open; vendor search always `p_active_only: true`; triple-click save → exactly one RPC; immediate line refresh with selection and `# 1,2` order preserved; no Action Queue/Vendor-wise Buying List read before selecting; PR-linked approved indent allowed; mobile 390px icon-only, modal fits viewport; wide label "Select Vendor".

Screenshots (synthetic data): `docs/procurement-execution/evidence/pec-erp-c2/c2-wide-indent-modal.png`, `c2-wide-vendor-modal-draft.png`, `c2-mobile-vendor-modal.png`.

## 5. Acceptance matrix
| Item | State |
|---|---|
| Select Vendor from draft/approved/issued indent lines, no snapshot wait | PASS (fixture) |
| Closed/cancelled/read-only/unauthorised not exposed | PASS (fixture) |
| Reason / pending-rate / active-only / save-failure / duplicate-submit | PASS (fixture) |
| Desktop + mobile layout | PASS (fixture) |
| No fabricated L1–L3, rates or balances | PASS (fixture + review) |
| Server acceptance of each reason combination, live recommendation ids on `proc_pec_indent_lines` rows | **DEFER — signed-in test with real data** |
| Whether live rows carry `recommended_vendor_id`/`selected_vendor_id` (modal degrades to "reason always required" if absent) | **DEFER — verify on live contract** |
| Signed-in operator acceptance in PWA and Electron, role matrix (editor / view-only / no access) | **DEFER — not claimed** |
| Interaction of selection with later snapshot publication (Action Queue / buy-list parity) | **DEFER — needs real publication cycle** |
| PWA cache policy for new JS | DEFER (see C1 §4b) |
