# S3F — read-only archive fixture for historical costing run 87

**Status:** source code written and offline unit tested; no production export, restore or deletion has been executed. This is a two-table archive only, **NOT a complete run backup**.

Tools use the repository's existing `pg` dependency and are excluded from Electron installers. They are restricted to September run 87 and the two leaf tables `costing.marketing_signed_billed_sales_evidence_snapshot` and `costing.marketing_regional_sales_evidence_snapshot`.

For a separately authorised read-only export, provide `SASV_ARCHIVE_DATABASE_URL` privately to the local process; do not commit/paste credentials or output sales data into GitHub. Run in the repository after `npm ci`:

```powershell
node docs/master-data-costing/tools/archive-run87.mjs --run-id 87 --out "D:\\PRIVATE-SASV-ARCHIVE\\run87"
node docs/master-data-costing/tools/verify-run87.mjs "D:\\PRIVATE-SASV-ARCHIVE\\run87"
node --test docs/master-data-costing/tools/archive-run87.test.mjs
```

The exporter uses `REPEATABLE READ READ ONLY`, fixed allowlisted SQL, primary-key keyset pagination, raw PostgreSQL `row_to_json(t)::text` (no JS numeric conversion), gzip JSONL, expected **108,982 rows per table**, and SHA-256 of uncompressed JSONL bytes. An incomplete export is rejected and removed. The separate verifier checks the manifest and both compressed data files offline. Archive output contains sensitive sales data: use an encrypted restricted folder, independently verify backup, and **do not store archive bytes in the source repository**.

**Not proven:** row restoration, durability after machine loss, full 64-table per-run completeness, RLS-consistent round trip, production physical storage reclamation, October-to-November costing cutover, or monthly scheduling. The manifest explicitly marks `restoreVerified:false` and `productionDeletionAuthorised:false`. Restore must be independently rehearsed to a separately authorised isolated Postgres database, preserving identity-by-default primary keys and foreign keys, before S3E staging deletion rehearsal or any permanent cleanup.

**Staging status:** no Supabase development branch existed at the last check; creating a billable branch requires separate cost approval. No live cleanup DML or DDL is authorized by these tools.

## S3G — typed restore verification on an isolated PostgreSQL database

`restore-verify-run87.mjs` validates S3F's two archived evidence tables using transaction-local temporary tables, matching PostgreSQL types and independent re-serialization SHA-256. It is **not** a production restore, an end-to-end backup or a deletion executor.

Operator prerequisite: independently verify that `SASV_ISOLATED_STAGE_DATABASE_URL` points to an isolated staging database, not the SASV production project or production pooler. An environment-variable attestation is additional defense, not authoritative environment isolation.

```powershell
# Set the confidential staging DB URL through secure local configuration only.
$env:SASV_STAGE_RESTORE_ATTESTATION = "ISOLATED_STAGE_RESTORE_RUN87_NOT_PRODUCTION"
node docs/master-data-costing/tools/restore-verify-run87.mjs "D:\\PRIVATE-SASV-ARCHIVE\\run87"
node --test docs/master-data-costing/tools/*.test.mjs
Remove-Item Env:SASV_STAGE_RESTORE_ATTESTATION
```

The tool verifies compressed archive hashes before initiating a DB transaction, creates temporary tables corresponding to the two original leaf relations, converts JSON using `jsonb_populate_record`, checks row totals and UTC-normalized row JSON serialization hashes, and executes `ROLLBACK` in `finally`. No data is imported into original tables. A successful receipt attests only **isolated typed temp-table restoration**, not production-recovery or purge authority.

This script has not been executed against an isolated staging DB; no project branch, data export, or production write was created.

## One-time actual historical archive — operational gate (NOT YET EXECUTED)

After confirming an encrypted, access-restricted, independently backed-up local drive, a credentialed SASV database operator can perform the following on a **local trusted workstation only** (never GitHub Actions, project files, a chat attachment or a shared drive):

```powershell
# Use a *private read-only PostgreSQL credential* with SELECT on the costing
# schema, provided from approved local secret storage; do not paste it in chat.
# $env:SASV_ARCHIVE_DATABASE_URL = ...   # securely supplied
node docs/master-data-costing/tools/archive-run87-direct-fks.mjs --run-id 87 --out "D:\\SASV-SECURE-RETENTION\\run87-direct" --expected-relations 64
node docs/master-data-costing/tools/verify-run87-direct-fks.mjs "D:\\SASV-SECURE-RETENTION\\run87-direct"
Remove-Item Env:SASV_ARCHIVE_DATABASE_URL
```

**Hard stop conditions:** refuse if the archive directory is populated, live FK topology differs from 64, run87 identity/status changes, run87 becomes designated/displayed, any table count diverges during the repeatable-read snapshot, or checksum verification fails. The output is confidential business data, and no archive should be transferred into CI. Independently copy/verify the encrypted archive to a separately secured backup location before considering any production change. This first archive covers **64 direct FK relations only**; it does **not** certify nested FK-consistent business recovery or cross-run isolation, and its manifest must remain `productionDeletionAuthorised:false`.

The assistant's current connected Supabase SQL interface does not supply a private PostgreSQL DSN or a secure local archive destination. **It cannot perform this workstation-only sensitive export directly through that interface.** The above commands are the required operator handoff, not evidence that any real backup exists.

## S3R — Windows secure operator archive (24 November 2026)

**Preferred single-command path on the authorised SASV developer workstation, NOT GitHub Actions:**
```powershell
# First configure and validate a private PostgreSQL SELECT-only account locally.
# Securely set SASV_ARCHIVE_DATABASE_URL in the current process; never paste
# the password, URL, archive or raw business rows in a chat, GitHub or logs.
# The DSN must specify TLS, preferably sslmode=verify-full.
# Ensure Node dependencies are installed in the existing repo via npm ci.
pwsh -NoProfile -File docs/master-data-costing/tools/run87-secure-archive-windows.ps1 `
  -ArchiveDriveRoot "D:\\SASV-RETENTION" `
  -BackupDriveRoot "E:\\SASV-RETENTION"
Remove-Item Env:SASV_ARCHIVE_DATABASE_URL
```
The illustrated drive letters are **examples only**, not known existing drives. Both roots must already exist, be local Windows volumes with BitLocker ProtectionStatus **On**, and be on distinct drive letters. The operator must separately establish that these are truly **independent physical media**; two partitions on the same disk do not count as independent backups. Ordinary unencrypted folders and network drives are refused. A complete archive creates precisely 64 compressed relation files plus manifest under `SASV-run87-direct` on each protected drive; existing directories are never overwritten. The script independently rechecks SHA hashes and original row counts in each archive copy, then compares compressed file hashes primary versus backup. It records metadata only in a local `SASV-run87-archive-receipt.json` file.

The receipt is intentionally marked `restoreVerified:false`, `foreignKeyBusinessParityVerified:false`, `productionDeletionAuthorised:false`. **Do not use this receipt to justify deleting production data.** A separate full FK-preserving restore and business-consumer validation are still required.

**Preflight as of 24 Nov:** production read-only catalog confirms historical run 87 is SUCCESS, not designated/approved/displayed, and all 64 directly linked relations are ordinary/partitioned tables. No dedicated production PostgreSQL connection/password is available to this conversation; actual archive operator execution therefore remains pending. This script does not create credentials or modify production.
