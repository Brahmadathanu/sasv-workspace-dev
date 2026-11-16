# WP12 — Seven sensitive Costing views: production metadata drift check (2026-11-16)

## Outcome
**PASS at catalog level — 7/7 exact view definitions, invoker settings, and authenticated SELECT grants unchanged.** Performed on production Supabase project `qhmoqtxpeasamtlxaoak`, using a SELECT-only SQL script: `scripts/wp12-readonly-seven-sensitive-view-catalog.sql`. It returned:
```json
{"wp12_seven_view_catalog":"PASS","expected_views":7,"passing_views":7,"deviations":[]}
```

The seven expected definition-MD5s are pinned to the already accepted 12-Nov WP05 R59/R63 governance record:
`v_costing_material_manual_rate_register`, `v_costing_material_manual_rate_history`, `v_costing_material_review_acceptance_register`, `v_costing_scheme_master_audit`, `v_costing_pricing_sku_detailed_cost_sheet`, `v_costing_pricing_cost_sheet_line_traceability`, and `v_costing_scheme_master_register`. The two latter security-invoker-true views are the SKU Detailed Cost Sheet and Scheme Master Register, as previously recorded; the other five are false/default.

The SQL does **not** execute the views or business data reads, switch roles, create identities, modify permissions or invoke writers. It therefore proves **no metadata drift**, not genuine cross-role effective denial.

## Genuine-role readiness (aggregate only)
Read-only aggregate of the canonical six Costing permission targets (no user IDs or personal data displayed): each of CCC, MCM, CBM and CSR had at least **one Editor assignment and two View-only assignments**; PPM and PRM had at least **two Editor assignments and two View-only assignments**. Aggregated qualifying identity categories across these six assignments: **two users have at least one Edit grant**, and **two distinct users have only View grants**. This confirms the presence of useful existing account permissions, but **not account login availability, correct user identity, or a suitable No-access identity**.

## Other verified live health
- The Costing period status query remains: Sep 2026 LOCKED/approved run **122**; Oct OPEN approved **143** with draft **148**; Nov OPEN, draft **152**, no approved run. No run approved or status changed.
- Recent five-minute cron stage-processor job **68** `succeeded` through 2026-11-16 16:20 UTC, including several prior entries. These are scheduler outcomes, not proof every business stage succeeded.
- Prior WP05 Cost Comparison recovery was real authenticated scoped-RPC HTTP 200/negative role evidence, accepted with performance residual; do not reopen solely because old base-view HTTP 500 appears in historical logs.

## Remaining release gates
- Seven **actual signed-in negative-role direct-view GETs**: **NOT TESTED**. Catalog parity cannot upgrade them to PASS.
- WP12 final six-module authenticated Editor/View-only/No-access acceptance and flag-ON browser-local restoration: **NOT TESTED** on final build.
- 4-second p95, October matched timing: **NOT PROVEN**, governed issue #273.
- Combined Electron/Windows installed acceptance deferred to the agreed Costing release; no interim installer.
- No REVOKE, CL15, route guard, pricing/costing run mutation or feature-flag change performed. Formal programme WP10/WP11/WP12 remains OPEN.

## Smallest next executable gate
Use the already prepared [WP12 minimal final owner read-only witness](WP12_MINIMAL_FINAL_READ_ONLY_OWNER_WITNESS_2026-11-16.md) with an existing Editor and one of the existing View-only users. Record only pass/fail, HTTP status, module and tested build—no credentials, JWTs, sensitive rows or raw price payloads. Without a suitable authorized authenticated browser, do not substitute catalog queries for JWT-denial evidence.
