-- PEC UOM correction inventory: SELECT ONLY. Owner policy: items 64,291,424,517 => g.
-- Review every proposed BOM change before any execution. NEVER update historical
-- MRP/PR/indent quantities by replacing their UOM without a governed lifecycle.
WITH owner_policy(stock_item_id,target_uom) AS (
 VALUES (64::bigint,'g'),(291,'g'),(424,'g'),(517,'g')
)
SELECT l.id bom_line_id,l.rm_bom_id,l.stock_item_id,s.name,
       u.code current_bom_uom,l.qty_per_reference_output current_qty,
       p.target_uom,
       CASE WHEN u.code='Kg' THEN l.qty_per_reference_output*1000
            WHEN u.code='g' THEN l.qty_per_reference_output
            ELSE NULL::numeric END AS proposed_same_mass_qty_g,
       CASE WHEN u.code='Kg' THEN 'CONVERT_KG_TO_G_AFTER_BOM_GOVERNANCE'
            WHEN u.code='g' THEN 'ALREADY_G_NO_CHANGE'
            ELSE 'INCOMPATIBLE_UNIT_BLOCK' END AS disposition
FROM public.rm_bom_line l
JOIN owner_policy p USING(stock_item_id)
JOIN public.inv_stock_item s ON s.id=l.stock_item_id
JOIN public.inv_uom u ON u.id=l.uom_id
ORDER BY l.stock_item_id,l.id;
