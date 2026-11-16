# Costing Suite — consolidated bulk-execution and deferred-work gate (16 November 2026)

**Status:** BOUNDED READ-ONLY PRODUCTION RECHECK COMPLETE; WP10/WP11/WP12 OPEN, programme **10/13** formally closed. This record does **not** approve SQL deployment, flags, grants, permissions, legacy fleet cutover, build publication, business writes, or formal workpack closure.

## 1. What is actually verified in this pass

Supabase project `qhmoqtxpeasamtlxaoak` was confirmed `ACTIVE_HEALTHY` on PostgreSQL 17.4.1.45. All SQL below was catalog SELECT within READ ONLY transactions, with 8-second statement timeout; no writer, preview, lifecycle, costing run, role impersonation, or scheduler executed.

| Check | Observed |
|---|---|
| WP10 private helper names `costing.fn_wp10_%` | 9 present |
| WP10 public read endpoints (operational horizon / subgroup impact preview) | 2 present |
| Applied migration history versions (Phase 1 four, Phase 2 classification two) | 6 present |
| Guard 04/05 proposed functions | 0 installed |
| Guard 04/05 proposed triggers | 0 installed |
| `rpc_set_product_sku_active` function MD5 | `7c70608b714e52b935bcb1957997ea3f` |
| `rpc_update_product` function MD5 | `edfa3694c7fffda0145b52bb78f413a2` |
| `fn_guard_sku_activation_completeness` function MD5 | `880ac36e442438d151a58d7eeb066fc3` |
| `rpc_wp10_get_operational_expiry_horizon` function MD5 | `454e9af693c50c81824bb0ff99ff6af9` |
| `rpc_wp10_preview_product_subgroup_impact` function MD5 | `9a538ac657ea32bad5db6b29c4ac3703` |

The historical Phase 1 receipt and server-first 12-CRUD-RPC installation receipt remain authoritative for full ACL/function coverage. This spot-check does not independently recertify those 12 RPCs, role behaviour, or any production-scale workload.

## 2. WP10 independent concurrency and guard disposition

The existing [Phase 2 independent lock-closure review](WP10_PHASE2_INDEPENDENT_LOCK_CLOSURE_REVIEW_2026-11-16.md) had already identified an **unproven activation-vs-subgroup-edit concurrency interleaving**. The fresh live definitions independently support its limited source observation: activation locks an SKU row `FOR UPDATE`, reads the parent route through ordinary SELECTs, and does not explicitly lock the product row. Product update locks the parent product row, while proposed guard 05 scans active children without a shared product/SKU serialization lock. The trigger catalog has not established an implicit lock that settles the interaction. This is **NOT a reproduced race** and must not be labelled PASS or a proven production incident.

- **04:** UNAPPLIED, potentially policy-consistent; still requires exact approval, privileged inactive+reparent audit-path disposition, and isolated test evidence.
- **05:** **HOLD — NOT SAFE TO SUBMIT FOR APPLICATION** on existing synthetic evidence alone. Original source and hash remain immutable. Require isolated PostgreSQL two-session reproduction/negative controls, complete parent/child/trigger lock closure, corrected SQL if warranted, independent review, replacement hashes/manifest, bounded rollback and separate explicit owner approval.
- **CL15:** parent-lock and privileged activation route-concurrency are distinct acceptance subjects; no live writer test, override, migration or optimistic downgrade.
- **Route Manager / subgroup reassignment:** preserve parallel route-map mutation safety and privileged-write residuals, not covered by 04/05 alone.
- **12 classification RPCs:** installed and server-receipted; client source #445 merged; four management routes remain **Electron-only**. Existing authenticated four-master direct DML grants remain until installed Electron fleet cutover; no REVOKE without a separate owner decision.
- Keep `WP10_SAFEGUARDS_V1` OFF by default and **do not** rerun 01/02/03/06 or the classification installation migrations.

## 3. Deferred-work reconciliation — different obligations, not a blanket waiver

This review explicitly incorporates [PARKED_BACKLOG.md](PARKED_BACKLOG.md), [WP05 R63 accepted residuals](WP05_R63_W510_OWNER_AUTHORISED_CONDITIONAL_CLOSURE_2026-11-12.md), [WP06 owner deferrals](PARKED_BACKLOG.md#wp06-owner-approved-deferrals--8-november-2026), [WP07 closure](MDC07_WP07_OWNER_AUTHORISED_CONDITIONAL_CLOSURE_2026-11-14.md), [WP08 receiving ledger](WP08_WP12_OWNER_AUTHORISED_RECEIVING_LEDGER_2026-11-15.md), [WP09 final acceptance transfer](WP09_FINAL_AUDIT_AND_CONDITIONAL_CLOSURE_RECOMMENDATION_2026-11-15.md), [WP10 impact-preview receiving cases](WP10_WP12_IMPACT_PREVIEW_RECEIVING_CASES_2026-11-15.md), and the [final release gate](COSTING_SUITE_FINAL_RELEASE_CRITICAL_GATE_2026-11-16.md).

| Disposition class | Included items | Required treatment |
|---|---|---|
| **Release-gating evidence** | WP12 B1-T2/T3 11 flags and six-module role/navigation matrix; seven negative-role sensitive-view GETs; 390px PM BOM/Deactivate signed-in witness; installed PWA SW; exact Windows Electron build + update/rollback; hosted real session and pricing/run parity | PASS, or specific owner-bounded risk decision where permitted; never invent PASS. Any disclosure, incorrect cost or unauthorized write is a stop. |
| **Conditional flag/feature blocker** | LOCK-P01 View-only Close quarter affordance, default-OFF guard and restricted preview F1 | Must be corrected and safely accepted **before enabling affected feature**; not automatically a default-OFF release blocker. |
| **Previously accepted but not disproven** | #273 Cost Comparison scoped pilot functional recovery but 4s p95 and October timing NOT PROVEN, normal OFF legacy-view 500 risk; #224 Scheme Master 57014 monitoring; originally failed/untested 40-lens cases | Preserve separate positive evidence, timing limits, actual default-OFF user observation, follow-up issues; don't re-open a completed workpack or call a historical failure a present universal failure. |
| **WP10 separately governed** | 04/05, CL15, four-master REVOKE and legacy Electron cutover, Route Manager concurrency, owner/operator nomination | Exact proposal/authority and dependency gate. Optional redesign not part of the frozen immediate release without an explicit business/security choice. |
| **Parked noncritical and future** | UX-P01/02/03/04, CCC-P03 legacy views, PERF-P01, CDE-P01…P05, D3/D7/F4/C9/C6-O8 routing/policy issues, PREV-P01, test/CI/ops backlog | Keep durable backlog, named owner and dependency milestone; do not present as completed or silently elevate into this release's change scope. UX-P05/Deactivate source corrections are merged, pending real acceptance. |

## 4. Fastest safe release path (preserving full WP12 receiving contract)

1. **Freeze exact release candidate:** record main SHA, provenance of 74/74 hosted Costing assets, 12/12 Product/BOM assets and current SW versions; the two current hosted receipts and 21/21 inert Chrome flag sweep are *already* credited, not retried without drift.
2. **Genuine signed-in, bounded read-only acceptance:** use [minimal operator witness](WP12_MINIMAL_FINAL_READ_ONLY_OWNER_WITNESS_2026-11-16.md) for six modules; ordinary Cost Comparison OFF HTTP response/timing and Scheme Master list/history; existing Editor/View-only/No-access visibility; genuine 390px PM BOM and Deactivate label. Sensitive view direct GET negative tests require exact safe independent role procedure and must stay NT without one. Never click privileged writers.
3. **Flag-ON integration only under separate bounded browser-local authority:** all 11 OFF/individual ON/ALL_ON and restoration across 390/1280, no production writer; explicitly resolve LOCK-P01 before enabling lock screen for View-only users.
4. **Isolated WP10 synthetic race tests:** two real database sessions in disposable PostgreSQL 17, never live; capture the A/B final-state trace, SQLSTATE, final route and lock behavior; independently review a minimal corrected locking protocol if the gap is reproduced. Do not merge the broad #444 as an installation shortcut.
5. **Electron combined gate:** owner-deferred until Costing acceptance; verify four root classification pages, six JS helpers/source, PM BOM/Deactivate corrections, editor/view-only/denied roles, Windows installer/ASAR, update and rollback. Do not assume merged source equals installed version.
6. **Owner release decision:** one exact-version record listing every remaining NT/FAIL, accepted bounded deferral and its responsible owner. No publication or workpack closure by implication.

## 5. Execution controls and no-duplicate rules

- Do **not** repeat Phase 1 migrations (four) or Phase 2 classification RPC installation (two); live migration-history spot-check shows all six.
- Do **not** activate `WP10_SAFEGUARDS_V1`, `COSTING_CSR_SCOPED_COMPARISON_RPC_V1`, `COSTING_LOCK_SCREEN_V1` or the other flags merely to make a test pass; user-visible flag trials and defaults are separate decisions.
- Leave the five historic CRLF-only migration differences untouched; do not mix unrelated PEC/lab/pricing changes.
- Status **10/13 closed** remains fixed until individual formal WP10/WP11/WP12 owner closure; release-readiness completion is separate from formal package percentage.
- **Claude usage:** no bulk coding handoff is justified solely for this read-only review. If isolated tests demonstrate a race, dispatch one constrained client/server test-and-patch package with no production migration application or broad frontend redesign.

**Current result: WP10/11/12 OPEN. No new production SQL, business mutation, server privileges, flags, deployments or owner sign-off.** This document records a new bounded live inventory and a consolidated execution decision, not a replacement for the detailed authoritative receipts.
