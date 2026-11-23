-- G7 S3 frozen receipt payload: deterministic ordering, source correction,
-- costing-rate revision and immutable-signed-value synthetic fixtures.
-- All values synthetic. Zero production writes.
BEGIN READ ONLY;
SET LOCAL statement_timeout='6000ms';
WITH original(line_id,qty,cop,book) AS (
 VALUES ('A',5::numeric,10::numeric,60::numeric),
        ('B',2::numeric,20::numeric,35::numeric)
), reordering AS (
 SELECT * FROM original ORDER BY line_id DESC
), corrected AS (
 SELECT line_id,CASE WHEN line_id='A' THEN qty+1 ELSE qty END qty,cop,book FROM original
), changed_rate AS (
 SELECT line_id,qty,CASE WHEN line_id='A' THEN cop+1 ELSE cop END cop,book FROM original
), hashes AS (
 SELECT 'original' variant,encode(sha256(convert_to(
  (SELECT jsonb_agg(jsonb_build_array(line_id,qty,cop,book) ORDER BY line_id)::text FROM original),'UTF8')),'hex') digest,
  (SELECT sum(qty*cop) FROM original) calc
 UNION ALL
 SELECT 'reordered',encode(sha256(convert_to(
  (SELECT jsonb_agg(jsonb_build_array(line_id,qty,cop,book) ORDER BY line_id)::text FROM reordering),'UTF8')),'hex'),
  (SELECT sum(qty*cop) FROM reordering)
 UNION ALL
 SELECT 'correction',encode(sha256(convert_to(
  (SELECT jsonb_agg(jsonb_build_array(line_id,qty,cop,book) ORDER BY line_id)::text FROM corrected),'UTF8')),'hex'),
  (SELECT sum(qty*cop) FROM corrected)
 UNION ALL
 SELECT 'new_cost_run',encode(sha256(convert_to(
  (SELECT jsonb_agg(jsonb_build_array(line_id,qty,cop,book) ORDER BY line_id)::text FROM changed_rate),'UTF8')),'hex'),
  (SELECT sum(qty*cop) FROM changed_rate)
)
SELECT
 (SELECT digest FROM hashes WHERE variant='original')=
 (SELECT digest FROM hashes WHERE variant='reordered') AS ordering_stable,
 (SELECT digest FROM hashes WHERE variant='original')<>
 (SELECT digest FROM hashes WHERE variant='correction') AS correction_changes_digest,
 (SELECT digest FROM hashes WHERE variant='original')<>
 (SELECT digest FROM hashes WHERE variant='new_cost_run') AS cost_revision_changes_digest,
 (SELECT calc FROM hashes WHERE variant='original')=90::numeric AS original_signed_value_retained,
 (SELECT calc FROM hashes WHERE variant='correction')=100::numeric AS correction_requires_new_version,
 (SELECT calc FROM hashes WHERE variant='new_cost_run')=95::numeric AS new_rate_requires_new_version;
COMMIT;
-- Deliberately does NOT UPDATE a receipt: earlier stored payloads and digest
-- must remain unchanged, with corrections becoming new immutable versions.
-- This is a decision/source-projection fixture, not a concurrency/signing test.
