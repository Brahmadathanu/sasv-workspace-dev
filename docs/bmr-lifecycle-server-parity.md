# BMR lifecycle — live server migration parity and verification

Status: SERVER DEPLOYED / EXACT DEPLOYED SQL RECOVERED TO REPOSITORY (2026-10-20).

This document inventories migrations already applied directly to the live SASV Supabase project `qhmoqtxpeasamtlxaoak`. **Do not replay these migrations against live production.** All six matching `supabase/migrations/<version>_<name>.sql` files have now been recovered verbatim from `supabase_migrations.schema_migrations.statements[1]` and committed on this branch. Deployment and historical data were not changed by restoring the files. Fresh-database replay testing remains pending.

| Live version | Migration name |
| --- | --- |
| 20261020103653 | bmr_lifecycle_superseded_primary_operational_guards |
| 20261020103827 | bmr_lifecycle_mrp_and_not_initiated_exclusions_v2 |
| 20261020103906 | bmr_lifecycle_final_mrp_exclusion |
| 20261020111231 | bmr_admin_future_remap_auto_supersede |
| 20261020111318 | bmr_lifecycle_override_write_and_effective_read_guards |
| 20261020112810 | bmr_superseded_identity_immutability_guard |

## Live findings

- `bmr_details.lifecycle_status`: `ACTIVE`, `SUPERSEDED`, `CANCELLED`; existing active records default ACTIVE.
- Historical predecessors: 3036 (Chukku Podi SP876), 3037 (Nellikka Podi SP877), and 3050 (historical BMR 5340) are SUPERSEDED.
- Current replacements 3069/3070 are ACTIVE.
- `lab.v_sample_receipt_fg_batch_picker`, `v_bmr_with_map_flag`, `v_bmr_batch_sizes`, `bmr_card_not_initiated`, and the principal RM MRP views exclude superseded operational candidates.
- `batch_plan_batches` and `lab.analysis_record` have active-identity insert/update guards.
- `production_batch_overrides` and `production_batch_overrides_staging` have active-identity guards, and the effective override view filters inactive identities.
- Completed `REMAP_BMR` correction insert has an auto-supersede trigger with product, replacement lifecycle, and plan-link checks.
- A new table trigger prevents identity or lifecycle mutation and physical deletion of SUPERSEDED/CANCELLED BMRs, preserving retained historical rows.
- Free-text `map_batch_to_bmr_by_bn` resolves via `bmr_card_not_initiated`; batch-plan write trigger independently guards the resulting BMR.

## Verified negative checks

A transaction-contained attempt to stage a production override referencing superseded BMR 3036 was rejected, leaving no test row. A subsequent intended positive-path test was blocked by tool safety checks before execution; it is **not** counted as passed. Queries verified zero predecessor rows in the lab batch picker, active BMR map view, BMR batch-sizes view, not-initiated view and principal RM MRP batch views.

## Open closure gates

1. **SQL source parity complete:** six exact SQL statements recovered from live migration history and checked into corresponding versioned files. Fresh-database replay compatibility is unverified.
2. Positive-path transactional regression: legitimate active override, authorized future remap, and unchanged operational outputs, using safe rollback or staging — no artificial durable production records.
3. Audit broader downstream consumer paths and production regressions before merged client deployment.
4. Historical correction BMR-AC-2026-000010: the immutable before_snapshot confirms predecessor 3050 was **Hridayasudhi / 30 Kg** when the remap to BMR 3064 (Hridayasudhi / 30 Kg) was performed, and the reason says it had been entered in the regular BMR series. The current predecessor row instead reads **Panchadeepakkini Choornam / 10 Kg**, while still carrying product_id 913. This appears to be a *later change to the retained historical row*, not an invalid original remap. Preserve the correction and investigate post-remap mutation of superseded BMR identity/size; enforce immutability before closure.

Client branch remains unmerged pending closure authorization.

## 2026-10-20 additional read-only verification

- All 2,115 ACTIVE BMR identities are represented by the laboratory FG picker; zero active BMRs were missing and zero non-ACTIVE BMRs were present.
- 2,115 records each appeared in the active BMR map and batch-size views.
- Zero inactive production-plan links, zero inactive lab analysis links, and zero completed remaps with non-SUPERSEDED predecessors.
- The production override effective view currently has zero rows, as the source table has zero active overrides. This does not constitute a positive-path pass.
- One attempted positive-path test was blocked by connector safety checks and was not executed; it remains unverified.

## 2026-10-20 final read-only integration check

- Confirmed 2,115 active and 3 non-active BMR identities.
- Confirmed zero inactive identities in the active BMR map and lab FG picker.
- Confirmed zero rows referencing superseded identities in current RM reservation, PM reservation, and canonical in-process views (matched by BMR identity/product and batch number as available).
- Confirmed six recovered SQL files exactly equal their respective `supabase_migrations.schema_migrations.statements[1]` values (6/6 byte-for-byte string equality).
- Feature branch was 12 commits ahead and 0 behind main during this check.
- **Not verified:** positive-path transactional writes under authenticated user roles, clean replay to an isolated database, full client browser UI smoke. Therefore merge remains held.

## Identity and guard audit — 2026-10-20

- Enabled PostgreSQL triggers confirmed: `trg_active_bmr_batch_plan`, `trg_active_bmr_lab_analysis`, `trg_bmr_historical_identity`.
- Active mapping-view set-difference checks both ways returned zero missing or invalid BMR identities; this exceeds mere count parity.
- Existing production-plan references to non-ACTIVE BMRs: zero.
- Existing laboratory analysis references to non-ACTIVE BMRs: zero.
- This is read-only structural/identity evidence, **not** a substitute for authenticated positive-path workflow testing.

### Last execution gate

Run in an isolated local/Supabase test project with fixtures (never write disposable data into the live production project): create an ACTIVE BMR and map it, stage an active override, execute authorized REMAP_BMR from distinct identities and ensure predecessor SUPERSEDED, then assert further mapping/analysis/override use of predecessor fails and historical audit still resolves. Apply the six versioned SQL migrations in historical order to a compatible reconstructed baseline. Separately run authenticated Manage BMR browser checks for ACTIVE/History/All, two historical records and action denials. Archive test output and schema version before authorizing merge.
