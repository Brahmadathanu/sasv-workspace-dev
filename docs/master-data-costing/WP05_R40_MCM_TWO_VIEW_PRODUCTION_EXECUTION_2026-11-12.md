# WP05 R40 — Owner-authorised MCM full rate provenance: two-view production execution (12 November 2026)

**PRODUCTION VIEW CHANGE APPLIED AND CATALOGUE VERIFIED.** The owner first approved Q-R38-MCM **MCM View only** for full Material Rate Register and History, with no implicit CCC/CBM/CSR or other-module read entitlement. The separate follow-up "Go ahead" was accepted as permission to proceed with the prepared, tested two-view execution in draft PR #327, **conditional on a fresh exact-state production preflight**. No other business-policy decision was made for CCC acceptance or CSR Cost Sheet/lineage.

## Source and operation

- Project: SASV Supabase `qhmoqtxpeasamtlxaoak`.
- Exact approved candidate file: `docs/master-data-costing/candidates/WP05_R39_MCM_TWO_VIEWS_APPLY_REVIEW_ONLY.sql` in [draft PR #327](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/327), unchanged Git blob `556bb061cbe47661c665b06ad8efadff74c8e28b`.
- Database execution: the exact reviewed `BEGIN … COMMIT` guarded SQL passed to Supabase `execute_sql` once. It performs `CREATE OR REPLACE VIEW` on only **`public.v_costing_material_manual_rate_history`** and **`public.v_costing_material_manual_rate_register`**, in dependency order; retains full source SQL, joins and output fields; changes ordinary user WHERE check to `public.app_has_permission('module:material-cost-manager','view')`; explicitly preserves `WITH (security_invoker=false)`; changes no table content, helper functions or SQL grants.
- Original SQL ACL on both views: `{postgres=arwdDxtm/postgres,authenticated=r/postgres}`. Retained. `anon` and `service_role` have no SQL SELECT privilege. A technical `current_user` branch remains in the WHERE predicate; it **does not** grant SQL SELECT.
- Guarded rollback exists in draft #327: `WP05_R39_MCM_TWO_VIEWS_ROLLBACK_REVIEW_ONLY.sql`; **not run**. It requires exact candidate fingerprints for both views and refuses intervening changes. Future rollback requires fresh state verification and incident/owner approval.

## Exact live pre-/post-execution metadata

| View | Original `pg_get_viewdef` MD5 | Post-deployment MD5 | Columns |
|---|---|---|---:|
| `v_costing_material_manual_rate_history` | `e827e401cc2bb8ccadf782ee5b98add4` | **`01029a39e47a300aa7860d17b2f39cae`** | 32 |
| `v_costing_material_manual_rate_register` | `8a4c73fd3f4562679af3ed0638fa87e4` | **`38b4262bfae719ca3f736185784fd047`** | 34 |

Both post-change definitions **exactly** match the previously tested disposable PostgreSQL 17.11 fixture. Owner `postgres`, ACL, `security_invoker=false`, 32/34 output field counts, `authenticated` SQL SELECT, `anon=false` and `service_role=false` all persist. Before execution, exact output column **names/types** were read and verified against original; the guarded `CREATE OR REPLACE VIEW` contract and post-deployment MD5 check establish the expected unchanged projection. Read-only after-state inspection shows the two new outer predicates specify only MCM View for ordinary authenticated users.

### Other protected definitions unchanged

Post-deployment read-only MD5 checks show:
- `v_costing_material_review_acceptance_register`: `df6c6771423c2aecb0130822a804a239`.
- `v_costing_pricing_sku_detailed_cost_sheet`: `85585c98e6f184fb9a4eb3351b008c2e`.
- `v_costing_pricing_cost_sheet_line_traceability`: `b67b4ee28e0eb19804c073cb83e14e11`.
- Previously corrected `v_costing_scheme_master_audit`: `e2b9eb3c1b86d073183cd376f704cf58`.

Shared function `md5(prosrc)` unchanged:
- `app_has_permission`: `12727b365c1728d3830eeab039b6e344`.
- `app_has_permission_core`: `b75d5b4ee5cc6c464149c5743e165b95`.
- `fn_costing_view_allowed`: `b7efb09b90fa3e9332915ba5d223568c`.

## Verification and limitations

- Exact-head draft #327 isolated PostgreSQL 17.11 GitHub Actions [43188508188](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43188508188): **8/8 PASS** including source-equivalent 32/34-column views, nested Register→History, MCM-only and mixed positive, CCC/CBM/CSR/PPM/procurement-only denied, unchanged SQL grants and options, apply/rollback and drift guards.
- **Production DDL/catalogue PASS:** executed guarded SQL and independently re-read both definitions/ACL/options. **Real signed-in MCM View-only PWA/REST read: NOT TESTED. Real signed-in CCC/CBM/CSR-only negative access: NOT TESTED.** Synthetic PG17 tests do not substitute for normal user sessions. Denied view WHERE predicate can return an empty array with HTTP 200; do not claim negative access from an empty response alone.
- No material rate/stock/vendor rows accessed or modified, no account role/permission changes, no JWT impersonation, no writers, no PWA flag/cache changes, no app code release.
- Operation executed as guarded SQL through Supabase `execute_sql`, **not registered via migration history**. The exact deployed SQL remains in draft PR #327 and this ledger; do not silently replay it later as an unapplied migration.

## Governance disposition

- Q-R38-MCM owner policy: **APPROVED**.
- MCM two-view production execution and catalogue invariants: **PASS**.
- Signed-in access matrix: **NOT TESTED**.
- Remaining Q-R38-CCC and Q-R38-CSR policy selections: **PENDING owner approval**; their views untouched.
- W5-06 **OPEN**; WP05 formal **6/13**. D-1 writer-denial behavioural test NOT TESTED (owner bounded acceptance); D-4 Cost Comparison p95 target HOLD; historic AE1 baseline retained.

No blanket module permission change or automatic promotion of W5-06 is authorised by this production result.
