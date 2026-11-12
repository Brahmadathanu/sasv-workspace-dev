# PEC ERP G0/G1 consolidated integration candidate — 12 November 2026

**Status:** NON-PRODUCTION DRAFT PR #347; source stack integration for independent verification only. **Not authorization to merge this combined PR or bypass the dependency chain.** Programme issue #284, hybrid S4 #305. Formal programme gates **0/6 independently verified**.

## Exact composition
Base: Claude paged client branch PR #335 head `93dcaaa2bdadb086d267c132851462be48583e0a` (already contains C1/C2/five-lens stack and the #319 Full→`reset` client equivalent). Then **24 explicit PEC-only paths** were imported from the immutable source PR branches without modifying those PR branches:
- 10 paths (7 ordered SQL migration files, 2 SQL acceptance scripts, 1 ledger) copied from server G0 correction #317 `fix/pec-g0-uom-writer-integration-20261112`.
- 9 paths (3 ordered server read-paging migrations, 3 SQL verification scripts, 3 docs) copied from G1 server #323 `feat/pec-g1-paged-read-contracts-20261112`.
- 4 additive files (CI workflow, regression test, two docs) and precise `public/sw.js` edit copied from #342 `fix/pec-pwa-cache-freshness-20261112`.

The client baseline contributes the shared canonical PEC HTML, JS and CSS, 253-control inventory, responsive screenshot evidence, tests, latest-wins, server filters, full export integrity guard and GitHub browser CI. Importing 24 paths adds no changes to unrelated Costing, laboratory or Tally code.

## Non-production source compatibility checks
- GitHub candidate compared with PR #335 = **24 files added/changed, 0 behind**, all PEC/SQL/SW paths. Candidate was mergeable with current `main` when checked.
- The 10 commits in `main` not contained by this integration candidate affect only WP05 Costing documents, **not** PEC functional files or `public/sw.js`; rebase/recheck before any owner-approved merge.
- Candidate `public/sw.js` is exactly #342, and removing its added PEC JS/CSS network-first checks yields **byte-identical current-main SW source**; both cache names are `hub-cache-v393`.
- Live Supabase verified **10/10** G1 read functions SECURITY DEFINER, module VIEW permission guard, authenticated role EXECUTE, anonymous EXECUTE denied. Live aggregate view counts read-only: PR 7; Indents 45; Vendor-wise 834; Excess 13,311. No migration action or approved-record edit performed.
- The ten `20261112` PEC migration versions from #317/#323 remain **0/10** in `supabase_migrations.schema_migrations`; live objects had already been applied manually. Official migration history repair remains on hold for owner/governed approval and precise source/live parity. See `PEC_ERP_RELEASE_READINESS_20261112.md` for safe procedure; DO NOT blindly apply DML.

## CI / acceptance
- Existing PR #335 clean-runner integrated browser suite PASS on head `93dcaaa2` ([run #43207216830](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43207216830)): paging, 39-check VWL reliability, 1,500-item real PDF 26 pages, C1/C2/five-lens/layout/WP01/PR scope, 390/820/1440 widths. Vendor-wise mutation-sensitive offset export 6/6 PASS.
- PR #342 mocked service-worker freshness (plus FG non-regression) PASS on prior branch head ([run #43203370965](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43203370965)).
- New **combined candidate PR #347** triggers its own PEC integrated browser, offset export, PEC PWA, FG and unrelated WP05 CI. Record its actual HEAD + job conclusions before promoting this candidate beyond review.
- Genuine PEC editor/VIEW-only/no-access JWT, actual hosted RPC results, installed-PWA freshness, packaged Electron and representative Excess latency **remain BLOCKED/NOT ACCEPTED**. Neither source-only role grant checks nor preview CI prove user-session acceptance.

## Release rule
Keep original source PRs for owner-governed order: **server #317→#323**, client **#291→#301→#320→#335** (reconcile #319 once), PWA #342 at or before the client deployment. Candidate #347 **must not be merged as a shortcut**, nor used to trigger production migrations. Do not enable hybrid S4/MRP rebase/Tally actions.

## 12 Nov — Source/live migration-parity deep audit (read-only)

A direct read-only source audit compared `CREATE OR REPLACE FUNCTION` definitions from the **exact ten staged G0+G1 migration files** against live Supabase `pg_get_functiondef`, removing SQL whitespace only for lexical comparison. The migration set has **20 distinct final functions**:

- **G1 10/10:** all `pg_get_functiondef` bodies and declaration tokens match the staged `20261112170000/173000/174500` SQL. `proc_vendorwise_buylist_filtered_paged` had only nonsemantic newline/layout differences.
- **G0 10/10 final-state parity:** eight source definitions matched directly; `proc_pr_set_manual_delta_pec_internal` matched apart from a terminal LF in the live function source, and `mrp_uom_factor_strict` matched after applying the **explicit** `20261112150000` security-definer `ALTER FUNCTION` that follows its initial definition in `20261112114000`. This is *expected migration-chain state*, not an unauthorized discrepancy. `mrp_rm_plan_rebuild_month_active` matches the last `20261112152000` definition.
- Guarded material migration `20261112110000`: exact **13/13** specified BOM lines now use the 1000× quantity and gram UOM; **4/4** affected `inv_stock_item.default_uom_id` values use gram; **21/21** related BOM lines use gram; **zero** remaining non-gram related BOM lines.
- Live metadata: all **10 G1** paging functions have `SECURITY DEFINER`, authenticated EXECUTE, PEC VIEW permission guard, and no anonymous EXECUTE. G0 eight internal writer/conversion functions are not directly executable by authenticated; the strict helper is intentionally SECDEF/authenticated and anon-denied. G0/ G1 regression verifier files executed live PASS.
- `supabase_migrations.schema_migrations` query confirms **0/10 registered versions** despite the objects being live. The previously established official CLI history repair (no SQL replay) remains **unexecuted**.

**Limit:** lexical SQL definition equivalence and governed BOM state cover the known changed objects, not all schema dependencies, arbitrary concurrent DML, signed-in RPC authorization or pre/post migrated-row fingerprints for every system table. The owner's migration-history repair approval and signed-in functional acceptance are still separate release conditions. No production object, master, approved indent or MRP record was changed by this audit.

## 12 Nov — G0 self-contained migration correction synchronized

PR #317 identified an unmerged migration portability defect: its first G0 migration checked all four stock masters were in grams, but did not convert their old Kg defaults. The revised `20261112110000_pec_four_gram_material_bom_normalization.sql` now requires each of the four masters to be exactly Kg or g and converts old Kg masters to g **before** processing the 13 known BOM lines; all target master/BOM quantities and UOMs remain strictly validated. Source commit `4ca3e236`, G0 acceptance addendum `ca1d9a01`; candidate synchronized those changes. Latest live production already has all four default UOMs and all 21 relevant BOM lines in grams; replaying the revised migration inside a PostgreSQL transaction ending in `ROLLBACK` succeeded (no live change). **Fresh old-Kg test with real triggers remains pending** in an isolated clone, so parity alone is not an end-to-end installation test.

The G0 and G1 exact source/live audit found **20/20 expected final function definitions**, accounting for the explicit strict-UOM helper security-definer migration and a nonsemantic final newline in a PR helper. All 10 G1 definitions lexically matched production; 13/13 prescribed BOM lines and 4/4 masters match corrected final state; 0/10 PEC migration history versions recorded. Do not apply production migrations or repair history without owner-approved preflight and exact source/instance parity.
