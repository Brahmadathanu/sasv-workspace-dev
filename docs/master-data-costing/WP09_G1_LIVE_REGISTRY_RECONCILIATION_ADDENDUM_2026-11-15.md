> **Later 15-Nov reconciliation update:** the blockers described below are historical findings against Claude's original 77-row mapping. The same draft PR #434 now contains 79 exact live-key mapping rows, source-only separation, corrected PWA relative-route resolution, PASS 21/21 registry rows and PASS 22/22 mutation checks. Option C is recomputed as 36 Electron / 24 PWA top-level tiles. See [corrected G1 report](WP09_G1_BULK_AUDIT_REPORT_2026-11-15.md). G1 is technically ready for owner completion decision; **G2 authority remains HOLD** pending owner design decisions, WP09 OPEN, 9/13. Original capture and discrepancy history below are preserved.

# WP09 G1 — Independent live-registry reconciliation addendum (15 November 2026)

**Status: LIVE REGISTRY ROW CAPTURE COMPLETED; G2 DESIGN FREEZE NOT YET PASSED.** This supplements, not erases, `WP09_G1_BULK_AUDIT_REPORT_2026-11-15.md` authored in Claude's separate container. That container lacked Supabase access; the ChatGPT owner-side connector subsequently ran read-only `SELECT` and committed `WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json` to the same draft PR. This is **metadata-only**: no user permissions, personnel/customer data, credentials, writers, grants, changes or feature flags.

## Live authority and counts

Source: project `qhmoqtxpeasamtlxaoak`, `public.v_app_module_registry`, `public.app_modules`, `public.app_nav_sections`; SELECT-only, 15 Nov 2026.

| Subject | Observed |
|---|---|
| Registered module definitions | **85**, with **6 inactive** |
| Client-specific registry rows | **120** = **79 Electron + 41 PWA** |
| Active navigable Electron | **79** |
| Active navigable PWA | **41** (all also Electron); **38 Electron-only** |
| Active section definitions | **11** |
| Duplicate active route paths within either client | **None** (earlier aggregate G0 query independently confirmed) |
| Active module section assignments without section record | **None** (earlier aggregate G0 query independently confirmed) |
| Identical section+sort slot pairs | MRP `plant-occupancy` and `vendor-master` (110); Product/Reference `pricing-policy-manager` and `production-route-manager` (95), in both clients — deterministic label ordering, not confirmed defect |

**Note:** These are registry registrations; actual visibility for individual users depends on verified permissions. Real authenticated role comparison remains **NOT TESTED**.

## Direct mapping comparison to Claude's 77-row source candidate

The committed `WP09_G1_EVIDENCE/module-group-mapping.csv` is only a **candidate page-to-key mapping**; it must not be mistaken for all 79 active Electron registry module keys.

**Seven live active Electron entries absent from the candidate mapping:**

| Live module_key | Current section | Actual route |
|---|---|---|
| `coa-print` | `qa-qc` | `public/shared/coa-print.html` |
| `edit-log-entry` | `work-log` | `edit-log-entry.html` |
| `lab-workflow-access-control-manager` | `admin` | `public/shared/lab-workflow-access-control.html` |
| `sop-editor` | `sops` | `sop-editor.html` |
| `sop-viewer` | `sops` | `sop-viewer.html` |
| `tally-inv-mapping` | `inventory-sales` | `manage-tally-inv-mapping.html` |
| `test-method-master-manager` | `qa-qc` | `public/shared/test-method-master.html` |

**Five inferred/source mapping keys without a corresponding active Electron registry key:**

`production-overrides`, `manage-season-profiles`, `manage-tally-inv-mapping`, `lab-test-method-master`, `lab-workflow-access-control`.

Three of these are clear page/key mismatches that must be **rebound to the live key rather than treated as separate modules**: `manage-tally-inv-mapping` → `tally-inv-mapping`, `lab-test-method-master` → `test-method-master-manager`, `lab-workflow-access-control` → `lab-workflow-access-control-manager`. Validate the intended group/family and actual route for every row. `production-overrides` is **not registered**; repair/retirement of its broken HTML is optional legacy-source hygiene, not current launcher-card removal. `manage-season-profiles` is **not registered** as a standalone launcher; overlapping `season_profile` writers remain source-governance concern but cannot be described as a confirmed pair of live launcher cards.

Other important corrections:
- `coa-print`, `edit-log-entry`, `sop-editor`, `sop-viewer` were classified as non-launcher child pages in the source audit but **are registered launcher destinations**. Do not silently delete these registry entries or infer they should be hidden; determine whether direct card visibility is intentional.
- WP09 Option C's projected **30 top-level tiles** is based on 77 source mapping rows, not the reconciled live **79 Electron cards**. Treat the estimate as **provisional and not a G2 sign-off metric** until mapping and group count are rederived.
- The historical G0 aggregate counts were accurate. Earlier audit wording claiming G1 capture is BLOCKED is a time-specific description of Claude's container, not the latest overall project state.

## Required pre-G2 reconciliation

1. Adapt `module-group-mapping.csv` / `module-mapping.mjs` to **every live registered module_key** including the seven missing rows, replace wrong inferred keys using exact live IDs, and clearly keep source-only nonregistered pages in a separate legacy/technical inventory. Do not silently lose child pages that the registry exposes.
2. Run `node scripts/wp09-g1-launcher-audit/registry-verify.mjs docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json` in a checkout with the 15 Nov registry export, fix any verified route/key normalization concerns, and retain the results as PASS/FAIL with tests for missing-key negative controls.
3. Recompute exact Option A/B/C coverage and top-level family estimates from **actual live module keys**. Document any business decision necessary for grouping the Costing six, QA/QC child pages and Work Log actions.
4. Reconcile the G1 main report and WP09 workpack superseding the original blocked/candidate caveat **without rewriting original evidence history**; keep live-role, installed PWA and packaged Electron **NOT TESTED**.
5. Only after the mapping gate and independent PR review may the owner decide **A → C** (recommended low-risk) versus B. **No implementation, registry modification, permission change, SQL, flags, deployment or WP09 closure** is authorised by this addendum.

**Current owner G2 verdict: HOLD.** One bounded reconciliation update on existing PR #434 is sufficient; no repeated handover cycles or reopening WP08/PEC. WP09 remains OPEN and programme stays **9/13**.
