# Accidental Costing Refresh #150 — Failure Diagnosis and Governance Disposition
**Date:** 5 November 2026 · **State:** final diagnosis verified; no corrective costing write authorised

## Incident and immutable live evidence

The owner reported accidentally clicking **Refresh Cost Run** during the authenticated Cost Sheet Review PWA checks. Live `costing.costing_refresh_run` confirms an authentic `UI_TOOLBAR` request:

| Attribute | Verified |
|---|---|
| Run ID | **150** |
| Period | 2026-11-01 |
| Valuation date | **2026-11-02** |
| Request | 2026-11-05 10:31:04.325522 UTC (16:01:04 IST) |
| Started | 2026-11-05 10:35:00.073536 UTC (16:05 IST) |
| Finished | **2026-11-05 10:40:00.067079 UTC (16:10 IST)** |
| Final overall status | **FAILED** |
| Error stage | `02_MATERIAL_SNAPSHOT` |
| Error | `NO_EFFECTIVE_PM_BOM_REVISION: valuation_date=2026-11-02 missing_count=2 missing_sku_ids=255,1350` |
| Successful final snapshot | None; final counters null |

This is the final persisted failure, not merely an earlier RUNNING/QUEUED observation.

## Specific BOM evidence and cause

Both identified SKUs are **active** with `price_list_ik=false`, `price_list_ok=false`. Their BOM headers exist and their revisions are approved, but approvals have **future effective dates relative to the run's captured 2 November valuation date**.

| SKU | Product/pack | BOM revision | Status | Effective from | Cutoff eligibility |
|---|---|---:|---|---|---|
| 255 | Kayyonyadi Enna 200 mL | **689** | APPROVED | **2026-11-04** | **Not effective** on 2026-11-02 |
| 1350 | Anulomana Sookshma Choornam 100 g | **688** | APPROVED | **2026-11-03** | **Not effective** on 2026-11-02 |

The approvals' independent purposes are valid: SKU 255 uses the existing 200 mL pack template, SKU 1350 the 100 g powder PP packing template. The error is the absence of a date-effective approved PM BOM for the historical valuation context, **not** proof of a missing BOM header or an invalid current approval. No revisions were created, changed, backdated, superseded or cancelled during investigation.

## Governed selection impact

Read-only query of `costing.v_current_successful_costing_refresh_run` after run 150 failed:

- **November 2026:** run **149**, valuation 2026-11-02, `LATEST_SUCCESS` — working draft, **not approved**.
- **October 2026:** run **143**, valuation 2026-10-22, `APPROVED` — remains selected.
- Run **150** is FAILED and is not selected. No run designation/approval was made.

The separate [owner-reported CSR PWA acceptance](CSR_OWNER_READ_RETEST_ACCEPTANCE_2026-11-05.md) establishes three read screens passed after statistics maintenance. It does **not** approve run 150, imply that run 150 succeeded, or by itself close a formal work pack.

## Decision and future controls

1. **Preserve failure evidence:** retain run 150 and original error; no deletion or direct status mutation.
2. **Do not backdate** legitimate approved PM BOM revisions just to satisfy the historical valuation cutoff. This could corrupt audit-effective costing lineage.
3. **Do not retry** until the requested period's **governed valuation-date policy** and all current active-SKU PM BOM eligibility are reconciled; a future later cutoff requires explicit owner-governed decision, not silent use of today.
4. **Do not approve, publish or synchronise run 150** to pricing, worksheets or master data.
5. **Design improvement candidate (not implemented):** pre-request read-only eligibility check for the captured valuation date, identifying active SKUs lacking effective approved PM BOMs; confirmation and warning for `FULL_COSTING_REFRESH` UI action so a read-only test is not accidentally turned into a costly refresh. Any change must be a separately reviewed client/server work item with permissions, acceptance tests and no bypass of server write gates.

## Programme continuation

The authoritative [programme ledger](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md) remains **WP00–WP04 formally closed, 5/13 (38%)**. WP05/WP06/WP12 owner acceptance and eleven-flag ON/OFF regression gates remain open. The incidental failed refresh does not reopen the completed Cost Sheet Review read-retest sub-gate and does not automatically close or reopen a formal work pack.

**This checkpoint made read-only queries and documentation changes only.** No production SQL/DDL/DML, run approvals, BOM policy changes, flags, PWA/client builds, cache changes or Electron release.
