# BMR lifecycle — live server migration parity and verification

Status: SERVER DEPLOYED / REPOSITORY SQL PARITY PENDING (2026-10-20).

This document inventories migrations already applied directly to the live SASV Supabase project `qhmoqtxpeasamtlxaoak`. **Do not replay these migrations against live production.** The exact authoritative migration SQL must be recovered and matched to live database definitions before check-in. This inventory is **not** a substitute for migration source files.

| Live version | Migration name |
| --- | --- |
| 20261020103653 | bmr_lifecycle_superseded_primary_operational_guards |
| 20261020103827 | bmr_lifecycle_mrp_and_not_initiated_exclusions_v2 |
| 20261020103906 | bmr_lifecycle_final_mrp_exclusion |
| 20261020111231 | bmr_admin_future_remap_auto_supersede |
| 20261020111318 | bmr_lifecycle_override_write_and_effective_read_guards |

## Live findings

- `bmr_details.lifecycle_status`: `ACTIVE`, `SUPERSEDED`, `CANCELLED`; existing active records default ACTIVE.
- Historical predecessors: 3036 (Chukku Podi SP876), 3037 (Nellikka Podi SP877), and 3050 (historical BMR 5340) are SUPERSEDED.
- Current replacements 3069/3070 are ACTIVE.
- `lab.v_sample_receipt_fg_batch_picker`, `v_bmr_with_map_flag`, `v_bmr_batch_sizes`, `bmr_card_not_initiated`, and the principal RM MRP views exclude superseded operational candidates.
- `batch_plan_batches` and `lab.analysis_record` have active-identity insert/update guards.
- `production_batch_overrides` and `production_batch_overrides_staging` have active-identity guards, and the effective override view filters inactive identities.
- Completed `REMAP_BMR` correction insert has an auto-supersede trigger with product, replacement lifecycle, and plan-link checks.
- Free-text `map_batch_to_bmr_by_bn` resolves via `bmr_card_not_initiated`; batch-plan write trigger independently guards the resulting BMR.

## Verified negative checks

A transaction-contained attempt to stage a production override referencing superseded BMR 3036 was rejected, leaving no test row. Queries verified zero predecessor rows in the lab batch picker, active BMR map view, BMR batch-sizes view, not-initiated view and principal RM MRP batch views.

## Open closure gates

1. Preserve/reconstruct byte-equivalent migration source from authoritative server change records and verify function/view parity; do not fabricate SQL or duplicate migration-history entries.
2. Positive-path transactional regression: legitimate active override, authorized future remap, and unchanged operational outputs, using safe rollback or staging — no artificial durable production records.
3. Audit broader downstream consumer paths and production regressions before merged client deployment.
4. Historical correction BMR-AC-2026-000010: the immutable before_snapshot confirms predecessor 3050 was **Hridayasudhi / 30 Kg** when the remap to BMR 3064 (Hridayasudhi / 30 Kg) was performed, and the reason says it had been entered in the regular BMR series. The current predecessor row instead reads **Panchadeepakkini Choornam / 10 Kg**, while still carrying product_id 913. This appears to be a *later change to the retained historical row*, not an invalid original remap. Preserve the correction and investigate post-remap mutation of superseded BMR identity/size; enforce immutability before closure.

Client branch remains unmerged pending closure authorization.
