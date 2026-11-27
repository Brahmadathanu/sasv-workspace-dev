-- G7 zero-cost synthetic acceptance fixtures (23 Nov 2026)
-- No fixture touches real costing designations or transfer stock.
-- Safe on existing project only as SELECTs under READ ONLY transaction.
BEGIN READ ONLY;
SET LOCAL statement_timeout='6500ms';
WITH runs(id,period,designation,status) AS (
 VALUES (122,'2026-09-01'::date,'APPROVED','SUCCESS'),
        (143,'2026-10-01'::date,'APPROVED','SUCCESS'),
        (152,'2026-11-01'::date,'DRAFT','SUCCESS'),
        (153,'2026-11-01'::date,'REVOKED','SUCCESS'),
        (154,'2026-11-01'::date,'APPROVED','FAILED')
),
scenarios(case_id,r152,r143,expected) AS (
 VALUES ('draft_ignored','DRAFT','APPROVED',143),
        ('newly_approved','APPROVED','APPROVED',152),
        ('revoked_fallback','REVOKED','APPROVED',143),
        ('all_current_revoked','REVOKED','REVOKED',122)
),
chosen AS (
 SELECT s.case_id,s.expected,
 (SELECT r.id FROM runs r WHERE r.status='SUCCESS'
 AND (CASE WHEN r.id=152 THEN s.r152 WHEN r.id=143 THEN s.r143 ELSE r.designation END)='APPROVED'
 ORDER BY r.period DESC,r.id DESC LIMIT 1) selected FROM scenarios s
)
SELECT case_id,selected,expected,selected=expected AS pass FROM chosen ORDER BY case_id;

WITH fixtures(id,qty,unit,rate,rate_status,mapped,pack_match,is_cancelled,is_optional,expected) AS (
 VALUES
 (1,5::numeric,'Btl',12::numeric,'READY',true,true,false,false,'COVERED'),
 (2,2::numeric,'Pkt',8::numeric,'READY',true,true,true,false,'EXCLUDED_CANCELLED'),
 (3,2::numeric,'Pkt',8::numeric,'READY',true,true,false,true,'EXCLUDED_OPTIONAL'),
 (4,1::numeric,'Kg',8::numeric,'READY',true,true,false,false,'QUANTITY_NOT_IN_PACKS'),
 (5,1::numeric,'Btl',8::numeric,'REVIEW_REQUIRED',true,true,false,false,'RATE_UNUSABLE'),
 (6,1::numeric,'Btl',8::numeric,'READY',false,true,false,false,'SKU_UNMAPPED'),
 (7,1::numeric,'Btl',8::numeric,'READY',true,false,false,false,'PACK_DEFINITION_MISMATCH'),
 (8,-1::numeric,'Btl',8::numeric,'READY',true,true,false,false,'QUANTITY_UNUSABLE'),
 (9,1::numeric,'Btl',NULL::numeric,'READY',true,true,false,false,'RATE_UNUSABLE')
),
classified AS (
 SELECT id,expected,qty,rate,
 CASE WHEN is_cancelled THEN 'EXCLUDED_CANCELLED'
 WHEN is_optional THEN 'EXCLUDED_OPTIONAL'
 WHEN NOT mapped THEN 'SKU_UNMAPPED'
 WHEN rate IS NULL OR rate_status IS DISTINCT FROM 'READY' OR rate<0 THEN 'RATE_UNUSABLE'
 WHEN NOT pack_match THEN 'PACK_DEFINITION_MISMATCH'
 WHEN public.f_norm_key(unit) NOT IN ('btl','bottle','nos','no','pcs','piece','pack','pkt',
                                     'box','jar','tin','tube','sachet','strip','unit','units')
 THEN 'QUANTITY_NOT_IN_PACKS'
 WHEN qty IS NULL OR qty<=0 THEN 'QUANTITY_UNUSABLE'
 ELSE 'COVERED' END actual FROM fixtures
)
SELECT id,expected,actual,expected=actual AS pass,
CASE WHEN actual='COVERED' THEN qty*rate ELSE NULL END AS reference_value
FROM classified ORDER BY id;
COMMIT;
