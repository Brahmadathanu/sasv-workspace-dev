# PEC S4 consolidated UX package — execution record (22 Nov 2026)

Implements Tasks A–D of `PEC_S4_CONSOLIDATED_UX_CLAUDE_PACKAGE_20261122.md`. Presentation and client state only.
**Server untouched:** no SQL, migration, RPC name, permission or business-quantity change; no real PR/indent/PO written; no version bump, installer or updater-metadata change; nothing merged or published.

| Item | Value |
|---|---|
| PWA PR #498 | `fix/pec-s4-mobile-modals-20261122`, implementation commit `aef1a05716f6196c58e3ebbd9b562a6669ea8335` (baseline `b51a9593`) |
| Electron RC PR #497 (draft) | `release/v6.3.0-pec-s4`, sync commit `c946f6a55cab26e3ee68539bec7f1417e3963e54` (baseline `24fc2677`); shared client files byte-identical to #498 |

## Changes
**A — Create Draft PR.** Primary dialog collects parameters only; **Review requirements** opens a separate *Requirement Review* dialog (full screen at ≤680px, structured dialog on desktop, one scroll region, sticky footer with safe-area padding). It shows counts (auto-eligible / review-required / zero-MRP / consumption-only), a searchable compact list (review items first, evidence in expandable rows) and, near the footer, a semantic `label for` checkbox (22px, flex align-start, focus ring) with a two-sentence explanation plus **Back** / **Confirm Review**. Confirm closes the dialog, returns focus to *Review again*, and shows "Requirements reviewed · N materials". **Generate** is enabled only when the confirmed signature equals the current plan signature and is the only writer call (`proc_pec_s4_generate_pr`). Back/Close/Escape/backdrop never approve and discard the plan; reopening clears acknowledgement. Changing horizon months, material class or RM scope invalidates the plan and confirmation. PR number, effective-from and notes are not inputs of `proc_pec_s4_new_pr_plan`, so they do not enter the signature (the writer still validates them). Single-flight/latest-wins (`s4PlanRequestSeq`), error, missing-month and stale-response paths keep Generate disabled. The inline preview panel and nested scrollbar are removed.

**B — Consumption Requirement Review.** Renamed from "Coverage Review"; the numeric recommendation is **Suggested additional Qty** (with UOM; "Illustrative · review only"), never "Coverage", approved, order or purchase quantity. Mobile rows show item · UOM, the suggested quantity and review badge, with MRP qty / Existing PR final / 12m usage / Stock / Open indents / Increase vs MRP in a labelled expandable list (~97px collapsed, was a 4-metric card). Desktop keeps a sticky-header table in one scroll region; filter select has a subtle fill. Server field names unchanged.

**C — PR toolbar / More actions.** Concise labels (no internal marker). *More actions* is the existing `details` disclosure with `aria-expanded`; it closes on outside pointer-down, focus moving to another element, Escape (restores focus to trigger, closes only the menu), action selection, parent PR modal close and PR change. Document listeners exist only while open; an Escape race found by the new test (closed-menu listener briefly swallowing Escape) was fixed. The menu is hidden entirely for View-only; button IDs and handlers unchanged.

**D — Console error triage.** `A listener indicated an asynchronous response… message channel closed` is the Chrome **extension messaging** signature. Evidence: PEC client, HTML and `sw.js` contain no `chrome.runtime`/`browser.runtime`/`runtime.onMessage`; app message listeners (`sw.js`, hub-auth) are plain `message` events that cannot return a response promise; a clean extension-free Chromium profile shows zero unhandled rejections on the PEC flow. Classification: **NOT AN APPLICATION BLOCKER (extension-owned)** — inferred from static + clean-profile evidence; not reproduced with the reporter's extension set. No `unhandledrejection` suppression added (regression-guarded). The `cdn.segment.com ERR_BLOCKED_BY_CLIENT` is Netlify preview analytics, unrelated.

## Test evidence (synthetic fixtures; no network, no real writes)
| Check | Result |
|---|---|
| `pec-erp-c1-layout-smoke.mjs` (incl. new S4 A/B/C/D sections, 1440px and 390px) | PASS — 4 consecutive runs on #498 code; PASS on #497 tree |
| Mutation check (confirmation gate removed) | smoke FAILS as required |
| `pec-erp-c1-static-smoke.mjs` | PASS (clean tree; local checkout shows CRLF-only phantom diffs in five historical migrations, unrelated and not committed) |
| `pec-pwa-cache-freshness` 13/13, `pec-vwl-offset-export-integrity` 6/6, `pec-protected-path-guard`, `pec-r12-preview-contract`, `pec-operator-probe-contract` | PASS |
| Electron hardening / updater-compat / artifact-verify unit tests | 9 pass, 7 skipped (no Electron binary here) |
| Electron main-process smoke, packaged build | **NOT TESTED locally** — needs the Windows CI job on #497 head; no installer built or published |
| GitHub Actions on both heads | see PR checks (recorded in the completion report) |

Screenshots (synthetic fixture, no business data): `evidence/s4-ux-20261122/` — create form, requirement review, consumption requirement review and More actions at 1440px (`wide-*`) and 390px (`mobile-*`).

## Remaining gates
Owner PWA visual acceptance (390px iPhone + desktop, authenticated, read-only); merge #498 (owner action); PR-2026-07/08 stay DRAFT/unreconciled; Windows Electron smoke and package/checksum of the exact final v6.3.0 candidate; v6.3.0 publication HOLD; #305 open.

Progress: Server ✔ (untouched) | Client ✔ | CI ◔ (heads pushed; see PR checks) | PWA acceptance ○ | Production PR reconciliation ○ | Electron v6.3.0 ○
