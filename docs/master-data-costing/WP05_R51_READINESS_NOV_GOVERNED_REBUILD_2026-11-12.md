# WP05 R51 — Governed November Readiness recovery (12 November 2026)

**OWNER-APPROVED PRODUCTION DERIVED-EVIDENCE REBUILD SUCCESSFUL.** Owner expressly authorised a controlled November 2026 Readiness portfolio rebuild through the preexisting governed server function, required fingerprint verification, and preservation of CCC-only test-account permissions. R50 owner screenshot showed **Readiness unavailable — Unavailable — READINESS_BUILD_STALE**, with LIVE_AS_OF period 2026-11-01 and governed valuation 2026-11-02. This is **not** evidence of a CCC access denial.

## Root cause, independently identified before rebuild

- Current November build #6 was `COMPLETED` and `is_current=true`, but its persisted `source_fingerprint_digest` was `dd3b49c421f0d61890ef94888fd00a99`, while the live source fingerprint computed by `costing.fn_wp04_readiness_source_fingerprint('2026-11-01')` was `c421cdb50018184eeb8ccfa522007aa6`.
- Source epoch digest differed; source definition and schema digests **matched**. Tracked epoch changes included cost periods 195→204, costing refresh run/stage 300→313, and allocation snapshots. This is an expected freshness fail-closed state, not sufficient evidence of a broken UI or module privilege.
- Existing function `costing.fn_wp04_build_readiness_portfolio(date)` is the governed build path: obtains an advisory transaction lock, computes start/end fingerprints, assembles SKU assessments, validates rows and only promotes the new build after source consistency check. This function was **not** edited.

## Exactly scoped execution

Under the owner's explicit approval, a single guarded `BEGIN`/`COMMIT` transaction checked the unique designated test account's six expected canonical module permissions (**CCC View only; all Edit false**), and verified November current source digest differed from the stored build. It then ran **exactly once**:

`SELECT costing.fn_wp04_build_readiness_portfolio('2026-11-01'::date);`

The returned new build ID was **7**. No Costing run approval, Price/MRP change, view policy DDL, staff data or permission modification was made.

## Independent live post-execution verification

- Build **#7**, period 2026-11-01, governed valuation 2026-11-02, evidence refresh run **149**: `status=COMPLETED`, `is_current=true`, `error_text=NULL`.
- Source fingerprint `c421cdb50018184eeb8ccfa522007aa6` **exactly equals** the independently recomputed current digest; source epoch map equals current source epochs.
- Build #7 carries **1,793 total SKU assessments / 603 operational**.
- Previous build **#6** set to `SUPERSEDED`, `is_current=false`; it remains as provenance.
- Separate `public.v_user_permissions_effective` readback confirmed designated test account **CCC View true**, CBM/CSR/MCM/PPM/PRM View false, all six Edit false; no account change.
- This work did **not** invoke the authenticated Readiness RPC as the actual browser session. Actual PWA display under CCC-only is **NOT RE-TESTED** at time of this record.

## Owner acceptance follow-up

Under existing CCC-only signed-in account, refresh `Costing Control Center → Readiness`. Expected: a populated Readiness table/portfolio, no `READINESS_BUILD_STALE` (assuming source fingerprint has not changed again). The owner should report **populated/empty/error** and, for an error, exact visible text only. Do not share SKU values, cost amounts, account tokens, JSON payload or staff information.

The previous R50 Stage 2 outcome remains **3 PASS / 1 ERROR** until the owner observes a successful retest, then it may be credited as recovery (not rewritten history). Do **not** switch account to MCM-only prematurely. W5-06 OPEN, WP05 formal 6/13. Periodic upstream updates could stale this derived build again; tracking cadence and refresh governance should be reviewed separately, not bypass freshness validation.
