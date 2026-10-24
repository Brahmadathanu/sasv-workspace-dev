# CI-012 and CI-034: deployed corrections and verification (20 Oct 2026)

**Both are LIVE and postchecked on 20 October 2026.** The former PREPARED files were removed from the pending queue after byte-identical copies were preserved under `evidence/CI012/`. Original SQL and historical Git commits remain auditable.

## CI-012: `evidence/CI012/CI012_APPLIED_20261020162117.sql`
- **Live evidence (read-only):** effective dates earlier than the creation date are routine in most masters over the last 120 days. Examples: selling price policy 656 of 656 rows, route product map 259 of 440, MRP derivation 115 of 117. The capacity tables have 0 such rows (see `evidence/CI012/backdate_history.json`). A blanket refusal would break existing workflows, so the guard is set per table, in tiers:
  - **FORWARD_ONLY** (8 tables): capacity profile, fallback, step rule, plant-aware switch, cost-head ledger and the 3 DVS-1 masters. It refuses an effective_from or effective_to earlier than today (IST) or on or before the frozen-through date.
  - **NOT_INTO_FROZEN:** refuses dates on or before the frozen-through date, i.e. the latest valuation date of a LOCKED/CLOSED period or of an approved/reference run. That is 16 Oct 2026 today.
  - **AUDIT_ONLY** (all other effective-dated costing masters): allows the write but logs it to `costing.effective_date_backdate_log`. Proposal: review after two weeks, then promote to NOT_INTO_FROZEN.
- **Excluded:** QC tables (Jarvis's WP07 area), registers and snapshots, and the event register.
- **Local test (`evidence/CI012/ci012_test_result.json`), all passed:**
  - frozen-through = 2026-10-16;
  - inserts or closures dated yesterday or 10 Oct are refused, while today or tomorrow is allowed;
  - updates to other columns are allowed;
  - backdated DVS override and backdated ledger row are refused;
  - an AUDIT_ONLY backdated update is allowed and logged;
  - NOT_INTO_FROZEN refuses 10 Oct and allows 17 Oct;
  - the refresh output is identical with the guard installed;
  - runs 122/128 are unchanged.
- **Consequence:** after install, any later prepared change to a FORWARD_ONLY table must be dated on or after its apply day.

## CI-034: `evidence/CI012/CI034_APPLIED_20261020162105.sql`
- **What was affected:** in the refresh, the only value still taken from the CURRENT_DATE-anchored `public.v_sales_monthly_clean` was the stored diagnostic label `allocation_basis_status`. All quantities already use the valuation-anchored functions.
- **Fix (costing-only path):**
  - The refresh RPC now computes that label from its own valuation-anchored 12-month totals, using the same rules as the view.
  - `v_sales_monthly_clean`, `v_fill_inputs` (forecasting) and `v_sku_sales_volume_allocation_basis` are untouched.
  - The fix is applied as a guarded in-place edit of one expression. It works on the pre-DVS or the DVS-1 RPC and refuses any other version.
- **Local test (`evidence/CI034/ci034_test_result.json`):**
  - **Before the fix,** simulating a run on another day (the view's window moved) changed 81 status labels (162 row differences).
  - **After the fix,** the same simulation gives 0 differences.
  - On the same day, the output is identical to the current RPC and to run 128 (0 label changes, 0 other differences).
  - Re-applying the fix is refused.

## Deployment verification (20 October)
- CI-012 migration `20261020162117`: eight FORWARD_ONLY plus 37 AUDIT_ONLY rows, 45 corresponding triggers, frozen-through 2026-10-16.
- CI-034 migration `20261020162105`: patched sales allocation snapshot refresh RPC contains valuation-anchored diagnostic status marker; live definition md5 `458e55c7fd569d9cb5003582d6ee64cc`.
- Previously staged duplicates removed from `closure/prepared/`. **Do not reapply these already live migrations.** New costing refresh and numerical reconciliation remain separate gates.
