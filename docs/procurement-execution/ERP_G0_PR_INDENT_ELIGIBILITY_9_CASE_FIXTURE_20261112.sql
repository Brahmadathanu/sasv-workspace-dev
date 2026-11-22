-- PEC writer eligibility fixture. SELECT-only; 9 cases; no live PR/indent records.
-- This tests the intended predicate, not end-to-end security or DB writer transactions.
WITH cases(case_id, material_class_id, subcategory_code, active, requested_qty, manual_delta_qty, expected) AS (
 VALUES
 ('ordinary_rm_positive',1,'plant_based',true,10::numeric,0::numeric,true),
 ('finished_bulk_positive',1,'finished_bulk_material',true,10,0,false),
 ('semi_finished_positive',1,'semifinished_goods',true,10,0,false),
 ('manual_added_internal',1,'finished_bulk_material',true,0,20,false),
 ('negative_effective_qty',1,'plant_based',true,2,-3,false),
 ('zero_effective_qty',1,'plant_based',true,0,0,false),
 ('packaging_positive',2,'packaging_material',true,10,0,true),
 ('inactive_rm',1,'plant_based',false,10,0,false),
 ('manual_added_external',1,'plant_based',true,0,10,true)
), results AS (
 SELECT case_id,expected,
 (active AND (material_class_id<>1 OR subcategory_code NOT IN('finished_bulk_material','semifinished_goods'))
 AND coalesce(requested_qty,0)+coalesce(manual_delta_qty,0)>0) actual
 FROM cases
)
SELECT case_id,expected,actual,(actual=expected) pass FROM results ORDER BY case_id;
