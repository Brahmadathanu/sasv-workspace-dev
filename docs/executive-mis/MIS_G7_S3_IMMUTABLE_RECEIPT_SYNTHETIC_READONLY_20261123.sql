-- G7 S3 immutable financial report receipt: bounded design assertions.
-- SYNTHETIC ONLY, READ ONLY, NO MIGRATION. PostgreSQL sha256(bytea) built-in.
-- Canonical versioned numeric fields and source digests only; no volatile rendered timestamp.
BEGIN READ ONLY;
SET LOCAL statement_timeout='6500ms';
WITH scenario(report_version,run_id,book,reference,missing,source_fp) AS (
 VALUES (1,143,3711850.56::numeric,3984998.88::numeric,2,'old-source'),
        (1,143,3711850.56::numeric,3984998.88::numeric,2,'old-source'),
        (2,153,3711850.56::numeric,4025000.00::numeric,0,'new-source')
), payload AS (
 SELECT report_version,
        jsonb_build_object('schema_version',1,'report_month','2026-11-01',
          'cutoff','2026-11-21','book',book,'covered_reference',reference,
          'missing_rate_count',missing,'source_digest',source_fp,
          'approved_run_id',run_id) canonical
 FROM scenario
), hashed AS (
 SELECT report_version,encode(sha256(convert_to(canonical::text,'UTF8')),'hex') digest
 FROM payload
)
SELECT (SELECT count(DISTINCT digest) FROM hashed WHERE report_version=1)=1 AS duplicate_is_idempotent,
       (SELECT count(DISTINCT digest) FROM hashed)=2 AS revision_has_distinct_digest,
       (SELECT count(*) FROM hashed WHERE length(digest)=64)=3 AS digest_length_64;
COMMIT;

-- This validates SHA-256 + deterministic jsonb text *for one PostgreSQL version/test fixture only*.
-- Production canonical encoding must be explicitly versioned and stable across deployments.
-- Transaction locks, insert-only grants, immutable triggers, concurrent writers, and actual
-- signed-in role checks require separately authorized installation acceptance.
