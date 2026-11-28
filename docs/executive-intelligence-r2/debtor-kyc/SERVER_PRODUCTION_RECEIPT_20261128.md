# R8 Debtor KYC production receipt

The canonical migration `20261128084946_ei_r8_debtor_kyc_canonical` is installed once on project `qhmoqtxpeasamtlxaoak`, PostgreSQL 17.4. Supabase allocated the version at 14:19:46 IST on 28 November 2026. Its registration has one statement entry whose SHA-256 is `6d700fe90731f667a69f99fdfea1df664db9888afb48ec8dd944f085efc4af4a`, equal to the repository migration byte for byte. Implementation commit `adb5900cc79d8eeb863ec3a67fc33ced41f60f93` is in PR #552. The earlier Finance ageing and guarded Sales freshness migrations remained at their existing registered versions.

## Live reconciliation on the 28 November snapshot

| Ledger | Parties | Bills | Signed Tally amount (₹) | MIS amount (₹) |
| --- | ---: | ---: | ---: | ---: |
| Sundry Debtors | 1,286 | 4,502 | −22,553,369.10 | 22,553,369.10 |
| Sundry Creditors | 194 | 547 | 42,667,959.89 | 42,667,959.89 |
| Company net sundry position | | | | −20,114,590.79 |

- Default and custom ageing returned the same complete JSON before and after deployment. For age 31–90 with bounds 15, 30, 60, 90, 180, debtors had 863 bills for ₹6,339,465.00 and creditors had 81 bills for ₹9,057,237.00. All production undated counts were zero.
- The first 100 legacy party rows and the first 200 custom ageing-party rows matched their original-field fingerprints `429bf480f622a7246ce549a8e4885774` and `4a52c832e5658d34b70f91f1b93c7ef2`. Full live paging across both default party RPCs reconciled 1,480 rows each against the canonical party summary with 0 duplicates and 0 mismatches, including the ageing bucket-plus-undated reconciliation.
- IK and OK each had zero classified bills immediately after installation. The unclassified partition contained all 4,502 receivable bills and reconciled to the company receivable amount and buckets. The PG17 fixture separately verifies both classified regions and an opposing regional amount.
- The existing Management Alerts envelope and six rows matched exactly. The new `finance.debtor_kyc_incomplete` row reported `REVIEW`, 1,286 parties and ₹22,553,369.10 in exposure, with the 28 November evidence date and Finance Debtor KYC deep link. The authenticated production bill-page sample returned 2 rows with exact total 4,502.
- The migration seeded 1,900 historical identities with 1,900 primary aliases, 14 districts and 12 debtor types. Classifications, profiles, audit events, areas, coverage, commercial defaults and overrides all had zero rows. The two assignable role targets were visible under authenticated role. New permission assignments were zero and the existing executive permission fingerprint stayed `dcb1b7e42350379388eb4ec692bde6da`.
- All 11 KYC tables have RLS. The live catalogue returned zero direct client writes, direct client PII reads, direct commercial or audit table reads, anonymous RPC or private-helper execute grants and service-role KYC RPC grants. The service role retains Finance execution. An authenticated executive-only actor could read Finance and Alerts and received insufficient privilege on both KYC profile and commercial terms access. Both Finance views retained invoker and barrier security. Finance had one signature per RPC, zero parallel or versioned reporting endpoints and two interval exclusion constraints.
- Live `EXPLAIN (ANALYZE, BUFFERS)` on the 200-row all-group ageing party page returned 200 rows in 833.122 ms under the authenticated executive role. Supabase security and performance advisors returned informational findings for the deliberately RPC-only audit/terms tables, unindexed foreign keys and unused indexes on new objects. The excluded tables have RLS, no direct API policy, and verified revocations.

## Reproduction and test receipts

| Test | Command | Receipt |
| --- | --- | --- |
| Debtor regression, PostgreSQL 17.4 | `bash supabase/tests/mis_g7/debtor_kyc/run.sh` | 100 passed, 0 failed. Override, alias and master two-session contention observed in PostgreSQL. The combined 5,049-bill scale assertions ran in 518.890 ms. |
| Existing R3/R4 PostgreSQL acceptance, PostgreSQL 17.12 | `PG_BIN=/workspace/work/pg17/usr/lib/postgresql/17/bin node --test supabase/tests/mis_g7/ei_r3_r4_pg.test.mjs supabase/tests/mis_g7/ei_r3_r4_extended_pg.test.mjs supabase/tests/mis_g7/ei_r3_r4_access_pg.test.mjs` | 28 passed, 0 failed, 0 skipped. |
| v6.6.1 Finance ageing rules | `node --test scripts/mis-g7-reporting/finance-ageing-parity.test.mjs` | 7 passed, 0 failed, 0 skipped. |
| WP10 approved-scope and registration | `node --test scripts/wp10-g2-safeguards/source.test.mjs scripts/wp10-g2-safeguards/phase1-registration.test.mjs scripts/wp10-g2-safeguards/phase1-inventory.test.mjs` | 30 passed, 0 failed, 0 skipped. |
| PEC protected paths | `node --test scripts/pec-protected-path-guard.test.mjs`, `node scripts/pec-erp-c1-static-smoke.mjs`, `node scripts/pec-protected-path-mutation-smoke.mjs`, `node scripts/pec-r10-migration-hash-audit.mjs` | 216 guard assertions passed, static smoke passed, 3/3 working-tree mutations rejected and restored, three R10 migration hashes matched. |

Production registration used the Supabase connector's `apply_migration` with the exact tested SQL and migration name `ei_r8_debtor_kyc_canonical`. Read-only follow-up used [production catalogue and Finance reconciliation](../../../supabase/tests/mis_g7/debtor_kyc/production_receipt.sql) and [authenticated Alerts and permissions smoke](../../../supabase/tests/mis_g7/debtor_kyc/production_authenticated.sql). The authenticated smoke ran in a read-only transaction and rolled back. Synthetic data, grants and mutation tests ran in the isolated fixture.

The [consolidated R8 client assignment](CODEX_CLIENT_IMPLEMENTATION_ASSIGNMENT_20261128.md) uses the installed signatures. Stable Electron remains at v6.6.1 and R8 visual acceptance is recorded at 3/10.
