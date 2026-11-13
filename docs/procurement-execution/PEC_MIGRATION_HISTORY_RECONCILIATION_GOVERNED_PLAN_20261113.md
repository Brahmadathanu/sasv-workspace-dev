# PEC — Governed migration-history reconciliation plan

**Prepared 13 November 2026 | NO EXECUTION AUTHORITY | production write prohibited without separate explicit approval**

## Current independently observed state

- The current PEC integration candidate is staging PR #347; latest reviewed staging documentation commit `ba8e7581551e361922e15202ad3d7830cf6f9a3d` passed 8/8 GitHub CI and Netlify preview SUCCESS.
- PR #317 (7 SQL migrations) and PR #323 (3 SQL migrations) are **open, not merged to main**. PR #374 (1 SQL migration) is draft/unmerged; **its public Add Line wrapper body was directly installed** in live Supabase following owner approval.
- Eleven 20261112 PEC migration versions are missing in `supabase_migrations.schema_migrations`: 7 from #317 + 3 from #323 + 1 from #374. The laboratory migration from that date is unrelated.
- Reviewed source-to-live PL/pgSQL body comparison: 21/21 normalized matches; 10/10 paged-read ACL and metadata checks; four gram masters and thirteen BOM lines target-state parity; Add Line wrapper installed, ACL confirmed. These are bounded evidence, not a comprehensive proof of every data/grant/DDL invariant.
- Genuine signed-in Editor, View-only and no-access tests, packaged Windows Electron and installed-PWA acceptance have **not** passed any release gate. Formal G0–G5 remain 0/6 closed.

## Official method, confirmed from current Supabase documentation

Supabase CLI provides `supabase migration list --remote` for comparing filesystem migration versions with official remote history. If the effects were **already applied manually and proved equivalent**, the supported `supabase migration repair <version> --status applied --remote` updates **migration tracking only**, without replaying DDL or data migrations. The CLI version must be pinned and its `supabase migration repair --help` checked at execution, because CLI versions and flags can change. Current official reference: https://supabase.com/docs/reference/cli/introduction ; guide: https://supabase.com/docs/guides/deployment/database-migrations .

**DO NOT run** `supabase db push --remote` or `supabase migration up --remote` on the eleven missing-history versions: they may execute already-effective migrations again. **DO NOT run** `db reset --remote`, ad hoc `INSERT` into `supabase_migrations.schema_migrations`, or blanket `repair` without verified per-version facts. No current authorization exists for any history changes.

## Prerequisites and staged decision gates

1. **Freeze immutable sources:** exact PR #317/#323/#374 file hashes and commit SHAs, current integration/main SHA, live object definitions and existing migration history. Back up history and current relevant schema/data metadata. Record official CLI version.
2. **Integration decision:** preserve the three source PRs and original migration filenames. Reconcile an approved repository merge plan **before** history repair; confirm each expected migration file exists at the authorized release source. Do not silently merge these server changes or PR #347 into main. The present open source PRs create a Git-versus-live-history divergence if marked applied without an agreed source integration.
3. **Version-specific effect audit:** check the 20261112110000 gram corrections (4 masters, 13 BOM lines), #317 internal RM exclusions, manual PR/indent guards, SAFE resync preservation, helper grants/RBAC and strict MRP UOM future rollup. For #323, verify ten read RPCs/ACL and read equivalence via existing fixtures. For #374, validate Add Line wrapper's exact source body and grants, and its live direct-role negative behaviour. Classify each `EFFECT VERIFIED`, `PARTIAL`, `NOT PRESENT`, or `UNVERIFIED`; do not call every migration applied because 21 function bodies matched.
4. **Actual account evidence:** run authorized session tests with real Editor, View-only, no-access identities on the accepted staging preview, capture only sanitized statuses/build provenance; if identities or devices are unavailable record `BLOCKED`. Do not change live approved indent quantities or fabricate a draft production indent.
5. **Owner decision package:** propose *only those specific versions* whose effects are independently verified as already effective. Present versions, verified source SHA, verified live evidence, CLI `--help` output, targeted remote destination, expected history before/after, audit log, recovery procedure and halt-on-drift guard for explicit approval.
6. **If separately approved:** execute official CLI `migration repair --status applied --remote` only on that named reviewed set; never replay their SQL. Verify `migration list --remote`, each postflight function/ACL, relevant data invariants, role tests and absence of unexpected changes. Preserve a timestamped signed evidence record. Any mismatch: STOP and do not bulk mark remaining versions.
7. **Formal release:** independently close G0–G5 with owner signoff, then consider promotion of #347 to main, PWA/Electron build lineage, and deferred disposable artifact cleanup. Preserve historical migrations, approved procurement records and audit trail.

## Exact pending versions

| PR | Migration version | Verification result so far | Registration |
|---|---|---|---|
| #317 | 20261112110000 | 4/4 g masters, 13/13 specific BOM targets, no incorrect UOM | UNREGISTERED |
| #317 | 20261112114000 | Final functions body-matched; whole DDL/data effects still PARTIAL | UNREGISTERED |
| #317 | 20261112122500 | Final internal functions body-matched, direct role permissions checked; wider guards PARTIAL | UNREGISTERED |
| #317 | 20261112133000 | Internal manual PR writer definitions matched; wider data effects PARTIAL | UNREGISTERED |
| #317 | 20261112143000 | Final SAFE resync definition matched; functional invariants need independent acceptance | UNREGISTERED |
| #317 | 20261112150000 | Strict UOM helper metadata and definition checked; full grant analysis pending | UNREGISTERED |
| #317 | 20261112152000 | Active MRP rollup function definition checked; no live rebuild executed | UNREGISTERED |
| #323 | 20261112170000 | 5/5 read bodies, relevant ACLs and search path match | UNREGISTERED |
| #323 | 20261112173000 | 3/3 filtered bodies, relevant ACLs and search path match | UNREGISTERED |
| #323 | 20261112174500 | 2/2 vendor bodies, relevant ACLs and search path match | UNREGISTERED |
| #374 | 20261112220000 | Owner-approved live wrapper deployed, source body/ACL match; genuine negative-role still needed | UNREGISTERED |

**Status:** PLAN ONLY. No server migrations merged; no migration-history repair, production DDL/DML, change to role grants, or release promotion authorized by this document.

## R6 hold — historical SAFE-resync mapping anomaly (13 November 2026)

The independent read-only [R6 migration-effect audit](PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md) detected 3 PR-to-indent stock-item identity mismatches and 2 unmapped PR-linked indent lines (all created before 12 Nov, no update on/after). See [issue #383](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/383). **Migration `20261112143000` must not be selected for official history-only repair** until mapping provenance and SAFE/RESET disposable fixture behaviour are reviewed and a specific owner disposition is recorded. Function body parity alone does not discharge this hold. No live writes authorized.
