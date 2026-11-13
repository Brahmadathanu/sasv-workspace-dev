# PEC Phase A — migration-effect audit R1 (read-only)

**13 November 2026 | GitHub source #317/#323/#374 against SASV live PostgreSQL**  
**Authority:** evidence collection only, not approval to register, rerun or reconcile SQL. No production writes.

## Scope / method

Fetched the exact 7 files of PR #317 at `ca1d9a01f891ee480068f7964c56d4863a457c39`, 3 files of PR #323 at `359de7a287ca345fc2f27391f2e557911aadd2de`, and the existing #374 wrapper at the reviewed head. Used independent read-only `pg_proc`, `pg_get_functiondef`, `has_function_privilege`, and exact nonmutating `inv_uom`/`rm_bom_line` selects against live Supabase. **Function existence and superficial guard presence are not source-body equivalence.** Full hash, object/owner/grant, transactional regression, and role-token testing are separate work.

## Evidence ledger

| Migration | Independently verified effect | R1 disposition |
|---|---|---|
| 20261112110000 four-material g correction | Governed Kg→g factor=1000: 1; stock masters 64,291,424,517 in g: **4/4**; thirteen exact BOM id/item/quantity/uom targets in g: **13/13**; other BOM UOMs among those stock items: **0** | **Targeted live data parity PASS**, historical migration unregistered |
| 20261112114000 UOM/internal PR guard | Six named server functions present, unique signatures | **Function presence only**; body/parity not established |
| 20261112122500 revision/manual indent guard | Two expected internal writer functions present, unique signatures | **Function presence only** |
| 20261112133000 manual PR guards | Two expected internal writer functions present, unique signatures | **Function presence only** |
| 20261112143000 SAFE resync | Target function present | **Function presence only**; SAFE/RESET functional invariants NOT TESTED in this pass |
| 20261112150000 strict factor RBAC | `mrp_uom_factor_strict(bigint,bigint)` is SECURITY DEFINER | **Selected metadata observed**; full grants and definition parity NOT TESTED |
| 20261112152000 strict-factor rollup | `mrp_rm_plan_rebuild_month_active(date,text,text)` present | **Function presence only**; no MRP rebuild executed |
| 20261112170000 five paged reads | Five functions present; each unique signature, SECURITY DEFINER, authenticated EXECUTE yes, anon/PUBLIC EXECUTE no, visible PEC permission check in definition | **Selected signature/ACL/guard parity PASS**; body/result equivalence and genuine JWT call NOT TESTED |
| 20261112173000 three filtered paged reads | Three functions with same read-side ACL/permission conditions | **Selected signature/ACL/guard parity PASS**; filtered result equivalence NOT TESTED |
| 20261112174500 two operational vendor reads | Two functions with same read-side ACL/permission conditions | **Selected signature/ACL/guard parity PASS**; live full-export concurrency and paged equivalence NOT TESTED |
| 20261112220000 Add Line writer | Production wrapper MD5 `a19fabfd29ffba4d937df1bbf09453c2`, expected draft-manual/non-PR guard present; authenticated wrapper EXECUTE yes, anon wrapper EXECUTE no, authenticated internal EXECUTE no; PG17 isolated fixture PASS | **Deployed function/ACL check PASS**; authentic role & concurrency negative tests NOT TESTED |

**Version tracking:** all eleven PEC versions above have zero entries in `supabase_migrations.schema_migrations`. This is a distinct governance gap, not evidence that every effect is absent. The unrelated 20261112 lab migration is not part of PEC.

**Function inventory:** the twenty expected legacy/paged function names plus the Add Line wrapper all exist in `public` with **one overload each**. This is necessary but insufficient for full migration parity.

## Release implications and negative tests

1. Keep formal **G0–G5 = 0/6 closed**; no certification of complete PR #317/#323 effects.
2. The genuine-session non-mutating operator harness already exists at `scripts/pec-phase-a-operator-browser-check.mjs`, supports `--role=editor|view-only|no-access` with an interactive self-sign-in and no credential capture. This runbook does not claim to have executed it. Use only the known trusted staging host and capture sanitized observations.
3. A live approved/nonexistent-line call made with a genuine Edit-role JWT should fail `23514`; View-only should fail permission check; no-access reads must be denied. **Do not use an approved record with a real line identity or mutate quantity as a test.** One needs an authorized operator and non-mutating, uniquely nonexistent line identity. No live draft manual header exists in the observed inventory (45/45 approved); positive new-line testing needs a separately approved disposable fixture or actual draft business transaction.
4. For full #317/#323 migration equivalence, next compare normalized live function definitions against exact source plus source grants, verify internal RM exclusion and SAFE resync invariants, and conduct bounded real-role paged/filtered API reads. Differences or unavailable proof remain **UNVERIFIED**, not PASS.
5. Official migration repair, whether CLI repair marking already-applied versions or any alternate supported mechanism, requires a reviewed **per-version** effect ledger, clear owner signoff, and backup/recovery plan. **No direct history DML, blind SQL replay or silent migration-claim changes.**
6. Installed-PWA and packaged Windows Electron remain outside this database-only audit. Preserve evidence, old test snapshots and migration artifacts. No cleanup of historical rows or snapshots.

## Progress and decision register

- **Client UI:** R1–R2c owner visual PASS.
- **Live Add Line security:** deployed and independently read back PASS.
- **Migration source registration:** 0/11 registered; **remediation NOT AUTHORIZED**.
- **Selected migration effects:** #317 gram data target PASS, #323 selected read RPC ACL/guard checks PASS, remaining bodies NOT VERIFIED.
- **Real authenticated-role negative matrix:** NOT TESTED.
- **Formal release:** 0/6 signed closed, no merge to `main`.

This document deliberately maintains source/provenance and test distinctions. Future work should amend it with exact SHA and evidence for each remaining check instead of erasing the historical gaps.
