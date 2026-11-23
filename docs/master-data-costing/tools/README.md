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
