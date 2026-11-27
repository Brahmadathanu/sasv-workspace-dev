-- G7 approval reference — installed FG transfer latest-alteration parity test
-- Runs only in READ ONLY; synthetic VALUES; not a migration.
BEGIN READ ONLY;
SET LOCAL statement_timeout='6500ms';
WITH revisions(id,store,guid,inventory_line_no,batch_line_no,godown,alterid,quantity,amount,cancelled,optional) AS (
 VALUES
 (1,'IK','v1',1,1,'A',1,5::numeric,100::numeric,false,false),
 (2,'IK','v1',1,1,'A',2,6::numeric,120::numeric,false,false),
 (3,'IK','v2',1,1,'A',1,4::numeric,80::numeric,false,false),
 (4,'IK','v2',1,1,'A',2,0::numeric,0::numeric,true,false),
 (5,'IK','v3',1,1,'A',1,3::numeric,60::numeric,false,false),
 (6,'IK','v3',1,1,'A',2,3::numeric,60::numeric,false,true),
 (7,'IK','v4',1,1,'A',1,2::numeric,40::numeric,false,false),
 (8,'IK','v4',1,1,'B',1,2::numeric,40::numeric,false,false)
), ranked AS (
 SELECT *,row_number() OVER (
 PARTITION BY store,coalesce(nullif(guid,''),'__NO_GUID__'),
 inventory_line_no,batch_line_no,coalesce(godown,'')
 ORDER BY alterid DESC,id DESC
 ) rn
 FROM revisions
), classified AS (
 SELECT *,CASE
 WHEN rn>1 THEN 'EXCLUDED_SUPERSEDED'
 WHEN cancelled THEN 'EXCLUDED_CANCELLED'
 WHEN optional THEN 'EXCLUDED_OPTIONAL'
 ELSE 'COVERED' END status
 FROM ranked
), result AS (
 SELECT status,count(*) line_count,
        coalesce(sum(amount),0) raw_amount,
        coalesce(sum(amount) FILTER(WHERE status='COVERED'),0) covered_book
 FROM classified GROUP BY status
)
SELECT *, CASE status
WHEN 'COVERED' THEN line_count=3 AND covered_book=200
WHEN 'EXCLUDED_SUPERSEDED' THEN line_count=3 AND covered_book=0
WHEN 'EXCLUDED_CANCELLED' THEN line_count=1 AND covered_book=0
WHEN 'EXCLUDED_OPTIONAL' THEN line_count=1 AND covered_book=0
ELSE false END pass
FROM result ORDER BY status;
COMMIT;
-- Verified PostgreSQL READ ONLY: COVERED 3 rows ₹200;
-- EXCLUDED_SUPERSEDED 3, CANCELLED 1, OPTIONAL 1; no excluded book valuation.
-- This fixture is intentionally minimal and does not prove full PL/pgSQL compilation.
