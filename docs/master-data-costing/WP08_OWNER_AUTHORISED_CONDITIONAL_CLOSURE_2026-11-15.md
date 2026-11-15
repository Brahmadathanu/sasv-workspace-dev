# WP08 — Final owner-authorised conditional closure and handover (15 November 2026)

**Decision:** **WP08 CLOSED — OWNER ACCEPTED WITH EXPLICITLY TRANSFERRED BOUNDED RESIDUALS.** This is an owner-authorised *conditional* work-package closure, **not** unconditional functional/release acceptance. The owner expressly approved **all five** independent-audit residual dispositions on 15 November 2026 and instructed that WP08 close only once the exact WP12 receipt, closure documentation and clean repository reconciliation are verified. Do not infer the approval of live test identities, grants, SQL, writer RPCs, feature flags, Electron Step B or a PWA/Electron/Windows release.

**Source/main pin at preparation:** `e7da97a105f2355a66ca5cf7697605a912a279d5` (docs-only PR #430 merged independent audit); this closure record is effective **upon successful merge of its documentation PR**, with the resulting squash SHA recorded as the GitHub merge receipt and in the latest WP08/MASTER_PROGRAMME status banners.

## 1. Positive, independently established completion scope

| Milestone | Accepted evidence | Outcome |
|---|---|---|
| G1 Product/SKU/Costing route and source audit | Source-pinned report `WP08_G1_SOURCE_PINNED_NAVIGATION_AUDIT_REPORT_2026-11-14.md` | **PASS** |
| G2-0 shared Electron/PWA Product/RM/PM/SP modules | PRs #409/#416; one canonical shared source; isolated security/parity checks | **PASS within source/mocked scope** |
| G2-0 production PWA registration and launcher | Exact guarded Step A applied with owner approval, four PWA registrations verified; `APPLY_RECEIPT 2026-11-14 15:00:14.880955+00`; four launcher routes and positive-role reads PASS | **PASS**; original Electron routes unchanged, Step B NOT EXECUTED |
| G2-1 resolver, permission gate, identity contracts and handoffs | PR #427 merge `63b536f3712b91d63aff55ece1990844309f91dd`, 7/7 CI PASS, LF/CRLF/Chromium tests; zero mocked writer, preview/rebuild calls | **PASS within code/isolated scope** |
| G2-1 hosted positive-role PWA navigation | `WP08_G2_1_HOSTED_ACCEPTANCE_REPORT_2026-11-15.md`, PR #428 merge `f284682726a4eb3669b8236392481bba75b14d27`; Product 1/SKU 1, RM BOM 18 lines, PM Overrides, SP owner 1100/37 lines, Product→RM/PM/PRM and RM→Product, invalid ID and history | **PASS within observed positive-role scope** |
| Deployed G2-1 bytes | Operator-attested G2-0 gate PASS `g2-0-23f194af7e8fbdf8277a36946e370cd0` + 11 changed `public/` asset digests | **PASS — operator evidence** |
| Independent gate audit | `WP08_INDEPENDENT_AUDIT_AND_CONDITIONAL_CLOSURE_RECOMMENDATION_2026-11-15.md`, PR #430 merge `e7da97a105f2355a66ca5cf7697605a912a279d5` | **PASS** |
| Owner five residual dispositions | Explicit user approval, 15 November 2026; this record and linked WP12 receiving ledger | **ACCEPTED AS RESIDUAL TRANSFERS**, not test PASS |

## 2. Exact five owner-approved residual dispositions

**D1 — Pricing:** `MRP_GOVERNANCE` / `SELLING_SCHEME_POLICIES` remain **TEXT ONLY**, pending a separate governed PPM workspace selection + Product/SKU identity consumer. `sku-mrp-policies` and `sku-overview` are candidate workspaces, **not** approved active route mappings.

**D2 — Reverse bridges:** Defer Costing→Master Data `MANAGE_PRODUCTS` / `PM_BOM_MANAGER` route links until exact destination, URL consumer and permission evidence exist; do not create guessed navigation. WP12 receives four existing proven Costing-side route live checks; this is different from the unimplemented reverse bridges.

**D3 — Unknown ownership:** `BATCH_SIZES` / `REGIONAL_MARKETING_REVIEW` stay **UNMAPPED**. No new module/permission/launcher entry.

**D4 — Security/release:** Retain real denied/view-only **NOT TESTED**, hosted Costing-side four-code click tests **NOT TESTED**, actual new-tab **PARTIAL**, installed-PWA service-worker acceptance **NOT TESTED**, and actual Electron/Windows **NOT TESTED** in named WP12 final-build cases. Isolated/mock PASS does not substitute.

**D5 — Electron Step B:** Original four Electron client routes stay unchanged; `03_optional_repoint_electron_routes.sql` remains **NOT EXECUTED / NOT AUTHORISED**. WP12 receives a separate gate to collect Electron legacy/new route proof and obtain new explicit owner approval *if ever necessary*.

## 3. Binding receivers / remaining failures

- **WP12:** [eight-case explicit receiving ledger](WP08_WP12_OWNER_AUTHORISED_RECEIVING_LEDGER_2026-11-15.md), IDs **W12-WP08-01…08**, receiving milestone: provenance-verified final 11-flag, cross-module, PWA/Electron/Windows security acceptance before any release. Preserve every PASS / FAIL / PARTIAL / NOT TESTED, existing WP05 B1 and WP07 residuals; no release authority from WP08 closure.
- **WP11:** **PM BOM 390px overflow remains FAIL** (page scrollWidth **563px at 390px**, existing **UX-P05**); SKU dialog Deactivate label contrast invisible, [issue #429](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/429); no live Deactivate click authorised.
- **WP09:** Information architecture, wider launcher entry/group rationalisation, not an evidence-backed reason to delete current entries during WP08.
- **Future PPM governance/route-owner decision:** retain D1–D3 as non-navigable pending actual consumer and ownership proofs.

## 4. Closure verification and guardrails

At the point of documenting: repository G1/G2-0/G2-1 commits and accepted hosted report are merged; audit #430 merged; owner has given *explicit* residual transfer approval; separate WP12 receiver ledger exists and is linked from the WP12 workpack; no application/SQL/permission/flag/Electron route change in this closure documentation package. The G2-0 Step A apply receipt is preserved; no Step B or rollback. The source code and accepted test statuses are unaffected.

**Work-package closure count:** WP00–WP08 **9/13** CLOSED **only upon merging this closure documentation**; WP09–WP12 remain OPEN. Historical prior-date 8/13 statements are retained as history, never as current status. The parent master programme and WP08 workpack are updated in the same docs-only PR; the WP12 receiver remains OPEN. Do not mark WP12 accepted-release or any source unverified test PASS.

**Closure declaration on merge:** In response to the owner's five-disposition approval, **WP08 is conditionally closed**, with the named obligations transferred without extinguishing risks or implying validation. This record is the bounded sign-off/release distinction; final Electron and 11-flag integrated release acceptance remain WP12 obligations.
