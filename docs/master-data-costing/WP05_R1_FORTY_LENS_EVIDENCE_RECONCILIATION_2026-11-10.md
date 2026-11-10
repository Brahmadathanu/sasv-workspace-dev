# WP05 R1 — exact forty-lens evidence credit and critical-gap classification

**Date:** 10 November 2026. **Status:** REPOSITORY-ONLY RECONCILIATION, NO LENS STATUS PROMOTED. Binding [B1 §11](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md): WP12 receives integrated B1-T2/T3 only; all individual lens evidence stays in WP05. Source: [AE1 40-lens frozen baseline](WP05_AE1_AUTHENTICATED_EVIDENCE_RECONCILIATION_2026-11-08.md), [AE2 local evidence-credit proposal](WP05_AE2_LOCAL_EVIDENCE_CREDIT_PROPOSAL_2026-11-08.md), [owner D2 bounded S2/S9 ruling](WP05_OWNER_DECISIONS_2026-11-09.md), [W5-06 scoped confidentiality sign-off](WP05_W506_CONF_01_OWNER_RESIDUAL_DISPOSITION_2026-11-10.md).

**Method:** Directly parsed all forty AE1 numbered table rows and matched AE2's fifteen observation-number rows by exact row number. No user files on D: were re-read; AE2's local-evidence extraction remains repository-sourced secondary evidence. No browser, RPC, Supabase or production changes.

## Status accounting — immutable AE1 baseline

| Category | Count | Interpretation |
|---|---:|---|
| P | 13 | Scoped historically proven lenses |
| F | 4 | Historical failure retained even if later recovery is reported |
| NA | 2 | Trace-role restricted for ID-V; data path not tested |
| NT | 19 | No complete accepted per-lens proof |
| NT / PARTIAL | 2 | Useful independently proven subpaths, incomplete overall |
| **Total** | **40** | **13 P / 4 F / 2 NA / 21 NT including the 2 partial** |

Of the **21 NT** rows, AE2 contributes **15 v391/OFF render/data-presence sub-observations** without promoting them to PASS. **Six NT rows without AE2 credit** are #9 Staff Governance, #33 Route Family Mapping Review, #34 Foundation Review, #36 Route Family Route Editor, #37 Product Route Editor, and #38 Historical Candidate Review. These may have *different bounded* earlier evidence documented by AE1, not zero history. Prioritise these six and the four historical F cases for specialist review before asking anyone to repeat 40 screens.

## Source-linked 40-row ledger

"AE2 render" means `RD-v391/OFF` only, not v392/v393 live functional acceptance. The status column preserves exact AE1 historical classification (with NT/PARTIAL counted under NT).

| # | Module | Exact lens/workspace | AE1 status | AE2 render | Additional bounded evidence / unresolved context |
|---:|---|---|---|---|---|
| 1 | CCC | `dashboard` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 2 | CCC | `costing-review-workbench` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 3 | CCC | `sku-control-status` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 4 | CCC | `portfolio-readiness` | P | — | Historical missing readiness build recovered on later authorised build |
| 5 | MCM | `manual-rate-manager` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 6 | MCM | `rm-cost-trace` | NA | — | Correct restricted identity result; not data-path pass |
| 7 | MCM | `pm-cost-trace` | NA | — | Correct restricted identity result; not data-path pass |
| 8 | CBM | `cost-governance` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 9 | CBM | `staff-governance` | NT / PARTIAL | — | v393 live view-only restriction PASS; authorised editor PASS; 7 rendered pool rows vs 42 source across periods is scoped, not full unrestricted-lens PASS |
| 10 | CBM | `manual-provisions` | P | — | Retain prior scoped PASS |
| 11 | CBM | `driver-governance` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 12 | PPM | `sku-overview` | P | — | Retain prior scoped PASS |
| 13 | PPM | `sku-mrp-policies` | P | — | Retain prior scoped PASS |
| 14 | PPM | `product-derivation-policies` | P | — | Retain prior scoped PASS |
| 15 | PPM | `mrp-proposals` | P | — | Retain prior scoped PASS |
| 16 | PPM | `proposal-decisions` | P | — | Retain prior scoped PASS |
| 17 | PPM | `approved-for-application` | P | — | Retain prior scoped PASS |
| 18 | PPM | `applied-proposal-history` | P | — | Retain prior scoped PASS |
| 19 | PPM | `scheme-master` | F | — | Historical HTTP 57014; owner reports 7 schemes and 3/3 refresh after index; timed ID-V recovery unproven |
| 20 | PPM | `scheme-rule-register` | P | — | Retain prior scoped PASS |
| 21 | PPM | `commercial-sales-assumptions` | P | — | Period/rows PASS; modal 4/4 is owner-reported and separately bounded |
| 22 | CSR | `sku-cost-sheet` (SKU Cost Details) | NT | RD-v391/OFF (render only) | Owner PAR1 S2 comparison accepted on run 149; 2 MATCH and SKU 105 NULL-as-designed PARTIAL; full lens still NT |
| 23 | CSR | `printable-cost-sheet` | F | — | Historical 57014; later untimed owner functional recovery and bounded S2 comparison are separate |
| 24 | CSR | `cost-comparison` | F | — | Historical 57014; later owner functional recovery untimed |
| 25 | CSR | `scheme-comparison` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 26 | CSR | `qc-action-queue` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 27 | CSR | `materials-stores-action-queue` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 28 | PRM | `route-readiness` | P | — | Route readiness selector/handoff verified |
| 29 | PRM | `product-route-assignments` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 30 | PRM | `product-subgroup-mappings` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 31 | PRM | `shared-workload-preview` | NT | RD-v391/OFF (render only) | Only rendered data-present; preview RPC safety not established: do not click |
| 32 | PRM | `route-families` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |
| 33 | PRM | `route-family-mapping-review` | NT | — | Frozen run 82 zero rows needs context classification |
| 34 | PRM | `route-family-foundation-review` | NT | — | Frozen run 82 zero rows needs context classification |
| 35 | PRM | `production-cost-centres` | F | — | Historical unknown RPC; #178 corrected and owner reports recovery, no new timed ID-V proof |
| 36 | PRM | `route-family-route-editor` | NT / PARTIAL | — | History/detail read PASS, preview button blocked by safety guard; do not allowlist |
| 37 | PRM | `product-route-editor` | NT | — | Product-specific route version not sampled |
| 38 | PRM | `historical-candidate-review` | NT | — | VOLATILE SECURITY DEFINER preview candidates need independently approved no-side-effect assessment |
| 39 | PRM | `effective-route-viewer` | P | — | Existing effective route viewer PASS |
| 40 | PRM | `archived-routes` | NT | RD-v391/OFF (render only) | AE2 v391 render-only; determine if any functional check still material |

## Action tiers without duplicated full-suite retesting

**Critical security/side effects (do not execute):** #31 `shared-workload-preview`, #36 route-family-route-editor preview call and #38 `historical-candidate-review`: the renderer loading safely does not prove preview RPC safe. Existing F1 click attempted `rpc_preview_route_family_route_steps` and was blocked before backend invocation. Server function side effects and wrapper/body parity need independent trace; never add preview to read allowlist based on its name.

**Historical failures:** #19 `scheme-master` (#224 post-index later owner recovery), #23 `printable-cost-sheet`, #24 `cost-comparison` (57014), #35 `production-cost-centres` (unknown RPC since fixed #178 with later owner recovery). Keep historical F in AE1; later results are distinct evidence. Prioritise only if material uncertainty remains, with read-only timings and no raw costing/staff exports.

**Business-context gaps:** #33/#34 frozen run-82 zero rows; run 80/82 should not be conflated with moving/current as-of. #37 Product-specific version not sampled; select an actual existing version before browsing. #9 Staff Governance historically NT/PARTIAL but newer v393 restricted staff/aggregate confidentiality tests **passed**; still need avoid falsely crediting authorised staff edit workflow as exercised, because Save/Close was deliberately out of scope.

**Low-risk rendered NT:** the other AE2 rows may need business-data accuracy confirmation, but should not be rerun merely to reproduce table visibility. WP12's accepted B1-T2/T3 will separately handle final-build *cross-module* UX/flag breadth.

## v392→current source-change containment

GitHub compare `883a9f1c...main` returned 55 commits and four served-path changes (cost-build manager, shell, procurement execution, sw cache). Direct old/new source inspection of the costing shell and cost-build script identifies new personnel View+Edit fail-closed logic, in-flight response invalidation, sign-out purge, explicit salary-safe projections and export guarding. Thus the **known relevant served source drift is confined to shared shell and CBM staff paths** among the six-module acceptance code in this comparison; an entire v393 72/72 asset parity or zero-regression statement is **not** demonstrated. The separate procurement change is outside the six Costing Suite modules. The prior v392 proof remains scoped to v392; W5-06 v393 live tests cover only their observed Staff Governance cases.

## Next independent verification (R1 continuation)

1. Cross-reference existing PRM F1, C5/D5, SEC-A1/A2 and historical failures against repository-fixed code and latest live catalog snapshots without invoking write/unknown RPCs.
2. Produce a bounded evidence decision per risky retained row: historical result, current code contract, permission class, safe read path, specific remaining owner question; do not promote status on a static source inspection.
3. Only then prepare a small, allowlisted read-only browser package for any unresolved **critical** functional test. All other AE1 statuses remain as frozen until fresh per-lens provenance is actually available.

**No production/auth/database/flag/deploy/Electron action taken. WP05 OPEN, programme 6/13.**
