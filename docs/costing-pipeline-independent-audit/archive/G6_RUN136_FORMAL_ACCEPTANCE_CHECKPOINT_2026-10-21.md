> **SUPERSEDED (24 Oct 2026) — see [../CURRENT_STATE.md](../CURRENT_STATE.md).** Dated history only; live-state statements below (approved runs 122/128/131/136/140, cron 60/61, the public price feed view) are out of date.

# G6 final acceptance checkpoint — 21 October 2026

**Status: NUMERICAL PASS / FORMAL G6 HOLD.** User explicitly requested G6 closure before Google Sheets, with no new costing run. This checkpoint distinguishes demonstrated run136 financial correctness from unverified release/security prerequisites. No Supabase writes or Sheets changes in this checkpoint.

## Direct live read-only evidence
- Run136 `costing.costing_refresh_run`: SUCCESS, 626 READY / 1 REVIEW_REQUIRED / 0 BLOCKED, valuation 2026-10-20. Run128 remains SUCCESS 590 READY /37 REVIEW_REQUIRED.
- Run136 `costing.costing_control_integrity_audit_snapshot`: 17 PASS of 17 present checks.
- Run136 independent 7-pool sum, see `RUN136_SEVEN_POOL_FINANCIAL_CONSERVATION_2026-10-21.md`: all seven cost pools conserve to currency precision with correct recipient grouping and internal-source component.
- Run135->136: all 627 material, internal loaded, IK marketing and OK marketing per-SKU amounts unchanged; frozen source denominator unchanged.
- `costing.costing_run_designation`: only approved run128 in query for (128,136); **no designation for run136**. No user-approved designation implied.
- One held SKU remains pricing review: SKU1771 Brihat Chagaladi Ghritham, IK, default new-SKU quantity, retained by explicit user policy. Do not force READY.

## Remaining formal G6 closure requirements
1. **G2 prospective route attestation HOLD**: prepared G2 SQL is not released/verified through full PostgreSQL permission, stale evidence and concurrent-update regression. Route161 physical correction and validated all-stage costing do not substitute for attestation controls. Follow `IMPLEMENTATION_RULES.md` and G2 hold evidence. This is a release dependency, not a newly discovered numeric divergence.
2. **Governed SQL change regressions**: verify exact deployed regional acceptance continuity and actual-monthly scaling on isolated PostgreSQL fixture with negative tests for defaults, changed policy/source, stale/future dates, revoked acceptance and unauthorised roles. Live run status and 17 queue/lineage tests do not cover those negatives.
3. **Security, write atomicity and permissions**: inspect G6 CI-019/CI-033 etc against live ACL/API, demonstrate forbidden callers cannot accept reviews/designate or mutate frozen data, and concurrency/transaction guarding. Prefer isolated tests, no production negative writes.
4. **Release provenance**: verify prepared vs applied guarded SQL hashes, branch PR#72 delta and migration runner placement, outstanding G2 staged migration, and reconcile programme/issue/decision registers before any merge.
5. **Owner acceptance/designation**: formal documented run136 G6 decision accounting for the single held review; never designate without specific separate owner approval.

## Gates
- G6-MONEY: PASS.
- G6-RUN-INTEGRITY: PASS on 17 documented checks and stable runs.
- G6-RELEASE/SECURITY/NEGATIVE CASES: HOLD until above verification.
- G6-OWNER-ACCEPTANCE / run136 designation: NOT YET REQUESTED/NOT EXECUTED.
- Google Sheets: BLOCKED by `IMPLEMENTATION_RULES.md` §15. Read-only mapping and destination discovery allowed.

## Next
Complete the PostgreSQL isolated negative/permission/concurrency verification of active functions; resolve G2 attestation file and deployment status; update status register and secure one explicit G6 acceptance and run136 designation decision. Do not rerun merely to repeat identical monetary results.


## 21 Oct owner decision addendum (supersedes G2 hold classification above for release)
Current-release **G2 numerical gate CLOSED / PASS**: route correction and runs135/136 financial verification accepted. Prospective G2 confirmation remains NONDEPLOYED FUTURE HARDENING; not a current G6 prerequisite solely by its absence. Remaining G6 independent security, negative/concurrency and release-provenance checks and explicit owner designation **STILL HOLD**. See `G2_BOUNDED_RELEASE_CLOSURE_2026-10-21.md`. Sheets BLOCKED.
