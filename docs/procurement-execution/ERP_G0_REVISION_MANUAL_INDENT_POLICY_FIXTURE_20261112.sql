-- Read-only policy oracle for forward revisions and legacy-safe manual indents.
-- Verify the policy and document its limits without creating live PR/indent records.
WITH cases(label,internal,old_qty,new_qty,expected_block) AS (
 VALUES
 ('new internal positive',true,0::numeric,10::numeric,true),
 ('internal increase',true,5,6,true),
 ('internal unchanged',true,5,5,false),
 ('internal decrease',true,5,3,false),
 ('internal zero',true,5,0,false),
 ('normal RM increase',false,0,10,false),
 ('new internal zero',true,0,0,false)
), out AS (
 SELECT label,expected_block,
 (internal AND coalesce(new_qty,0)>coalesce(old_qty,0) AND coalesce(new_qty,0)>0)
 AS actual_block FROM cases
)
SELECT *,expected_block=actual_block AS pass FROM out ORDER BY label;

WITH source AS (
 SELECT l.pr_id,h.pr_number,l.stock_item_id,l.requested_qty,l.manual_delta_qty,
        i.subcategory_code,i.active,l.material_class_id
 FROM public.proc_pr_line l
 JOIN public.proc_pr_header h ON h.pr_id=l.pr_id
 JOIN public.v_inv_stock_item_with_class i ON i.stock_item_id=l.stock_item_id
 WHERE h.status='active' AND h.pr_id IN (1,5)
)
SELECT pr_number,count(*) source_lines,
 count(*) FILTER(WHERE active AND
    (material_class_id<>1 OR subcategory_code NOT IN
      ('finished_bulk_material','semifinished_goods'))) future_revision_lines,
 count(*) FILTER(WHERE subcategory_code IN
    ('finished_bulk_material','semifinished_goods')) excluded_internal_lines
FROM source GROUP BY pr_number ORDER BY pr_number;

-- Legacy approved/issued open indent population for governed reconciliation.
SELECT count(*) open_legacy_internal_lines
FROM public.v_proc_indent_line_balance b
JOIN public.v_inv_stock_item_with_class i ON i.stock_item_id=b.stock_item_id
WHERE b.remaining_qty>0
AND i.subcategory_code IN ('finished_bulk_material','semifinished_goods');
