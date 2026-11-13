# PEC Phase A — authenticated-role and migration reconciliation runbook

**Date:** 13 November 2026  
**Scope:** Governance and verification only. **No production data creation, writes, test accounts, permission grants, migration-history DML, SQL replay, release merge or deletion authorized by this runbook.**

## 1. Source and live evidence ledger

- Integration PR #347 remains a staging candidate; R1–R2c client UI is owner accepted, not production-promoted.
- Add Line source: draft PR #374, exact SQL `supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql`.
- Following owner authorization, the wrapper `public.proc_indent_add_line(bigint,bigint,bigint,bigint,numeric,text)` was deployed directly. A **read-only, independent repeat check** confirms `pg_get_functiondef` MD5 `a19fabfd29ffba4d937df1bbf09453c2`; guard predicate present; `authenticated` wrapper EXECUTE true; `anon` wrapper EXECUTE false; `authenticated` internal EXECUTE false.
- Live snapshot at this read-only review: 45 indent headers, **all approved**, and 1,593 indent lines. These are inventory observations, not before/after change proofs. **No existing draft manual indent exists to exercise a positive new-line test without creating business test data.**
- Exact expected migration versions below: **0/11 registered** in `supabase_migrations.schema_migrations`. An unrelated 20261112 laboratory migration is registered. Distinguish effective objects from official migration registration; do not replay these files simply to make history green.

## 2. Exact PEC migration manifest (do not auto-apply)

| Source | Version | Filename / purpose | Official history |
|---|---|---|---|
| #317 | 20261112110000 | `pec_four_gram_material_bom_normalization` | NOT REGISTERED |
| #317 | 20261112114000 | `pec_uom_and_internal_pr_guard` | NOT REGISTERED |
| #317 | 20261112122500 | `pec_revision_and_manual_indent_internal_guard` | NOT REGISTERED |
| #317 | 20261112133000 | `pec_manual_pr_internal_item_guards` | NOT REGISTERED |
| #317 | 20261112143000 | `pec_safe_resync_preserve_manual_lines` | NOT REGISTERED |
| #317 | 20261112150000 | `pec_mrp_uom_factor_auth_rbac` | NOT REGISTERED |
| #317 | 20261112152000 | `pec_mrp_rollup_use_strict_factor` | NOT REGISTERED |
| #323 | 20261112170000 | `pec_g1_five_paged_read_contracts` | NOT REGISTERED |
| #323 | 20261112173000 | `pec_g1_filtered_paged_read_contracts` | NOT REGISTERED |
| #323 | 20261112174500 | `pec_g1_vendor_operational_paging` | NOT REGISTERED |
| #374 | 20261112220000 | `pec_r2_add_line_new_row_status_guard` | NOT REGISTERED (effective wrapper live) |

**Correction to older shorthand:** “ten missing PEC entries” describes #317 + #323 only. Including the now-live #374 wrapper produces **eleven unregistered PEC migration versions**. None should be marked applied in history without official reviewed reconciliation.

## 3. Genuine-identity acceptance matrix

Use **real, currently authorized sign-in accounts** over the actual deployed API/PWA; inspect the grants and data responses, not just hidden client controls. A test-role account cannot be impersonated with synthetic `SET ROLE` or a fixture GUC. Record host/build SHA, timestamp, signed-in role *classification* (not identity), RPC name, response HTTP/SQLSTATE, request correlation, and exact expected versus observed outcome. Never disclose JWTs, API keys, email addresses or individual procurement record values.

| Test | Real account | Expected result | Status |
|---|---|---|---|
| Editor: draft manual new line | PEC Edit enabled | Successful permitted new line only on genuinely draft non-PR indent | NOT TESTED — no existing draft in live snapshot; needs separately authorized reversible test fixture or genuine business draft |
| Editor: approved nonexisting line | PEC Edit enabled | SQLSTATE 23514; no new line | NOT TESTED |
| Editor: issued nonexisting line | PEC Edit enabled | SQLSTATE 23514; no new line | NOT TESTED — no issued header in current snapshot |
| Editor: draft PR-linked nonexisting line | PEC Edit enabled | SQLSTATE 23514; no new line | NOT TESTED — no draft PR-linked header in current snapshot |
| Editor: approved existing line with reason | PEC Edit enabled | Governed correction as per existing-line policy | NOT TESTED — **do not change an approved live business quantity just to test** |
| Editor: approved existing line without reason | PEC Edit enabled | Reason-required denial; no change | NOT TESTED |
| View-only: any Add Line | PEC View yes, Edit no | Unauthorized / SQLSTATE 42501; no mutation | NOT TESTED |
| Denied: any PEC API read/write | no module View/Edit | Denied; no sensitive rows leak | NOT TESTED |
| Anonymous: wrapper invoke | no session | EXECUTE not granted; fail closed | ACL PASS read-only; end-to-end HTTP NOT TESTED |
| Concurrent approval + insert | genuine authorized test fixture | No line created after lifecycle transition | NOT TESTED — requires isolated transactional concurrency fixture, not production data |

**Safe ordering:** run negative calls only with an authorized operator and **non-mutating known-ineligible inputs**; inspect zero affected line count before/after. Positive tests require business-approved, reversible fixture controls and must not be run against existing approved real procurement quantities.

## 4. Reconciliation pathway, subject to separate owner approval

1. Acquire the official Supabase CLI/migration deployment mechanism and verify installed version/help. Snapshot existing schema definitions, grants, owner and `supabase_migrations.schema_migrations` from read-only sources.
2. Verify each of #317's seven and #323's three historical SQL *effects* against the live function/table/column inventory, including grants, data checks and relevant rollback/regression evidence. Resolve any drift or partial application first.
3. Verify #374 effective wrapper MD5 and signing provenance against the immutable PR artifact. Keep the missing migration registration distinct from DDL application.
4. Produce a **version-by-version evidence matrix** (APPLIED EFFECT VERIFIED / PARTIAL / NOT PRESENT / UNVERIFIED). If any mismatch, hold the whole affected batch.
5. Submit the proposed **official history reconciliation command(s)**, flags, backup/snapshot and recovery plan for **a separate exact owner authorization**. Never blindly replay already-effective SQL, insert directly into schema_migrations, or conflate SQL applied with migration registered.
6. Re-check version listing, all critical function MD5s, ACLs, zero unplanned business mutations, negative-role tests and CI after authorized action.

## 5. Release and cleanup blockers

- G0–G5 **0/6 formally closed**. R2c owner mobile UX acceptance is valid but bounded.
- Installed PWA online/offline cache transition, Windows packaged Electron, authentic Editor/View-only/denied roles and source-matched live release are NOT TESTED.
- The intermittent Action Queue→Excess failed request remains unconfirmed; keep diagnostics/Retry and collect sanitized evidence on recurrence.
- No cleanup of historical migration trail, original R2/R2b/R2c evidence, procurement audit, or legitimate purchase records. After approved release, remove only identified disposable local fixture artifacts/builds/profiles with retained evidence and a reversible cleanup ledger.

**Decision boundary:** do not initiate positive live write tests or migration-history repair without separate explicit owner approval.
