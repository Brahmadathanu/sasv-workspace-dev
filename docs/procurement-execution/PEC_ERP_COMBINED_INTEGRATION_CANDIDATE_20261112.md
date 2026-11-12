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
