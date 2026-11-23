-- MIS G7 C2: clarify unknown-location old ledger source vs activity location.
-- Read-only as-of investigation, not an authorization to assign/repair location.
BEGIN READ ONLY;
SET LOCAL statement_timeout='8000ms';
WITH packing AS (
 SELECT l.id,l.product_id,l.batch_number,l.qty_base,l.source_id,
        wl.section_id activity_section,wl.subsection_id activity_subsection,
        wl.area_id activity_area,wl.plant_id activity_plant
 FROM public.fg_bulk_stock_ledger l
 JOIN public.event_skus es ON es.id=l.source_id
 JOIN public.packaging_events pe ON pe.id=es.packaging_event_id
 JOIN public.daily_work_log wl ON wl.id=pe.work_log_id
 WHERE l.source_table='event_skus'
   AND l.movement_date >= '2026-11-01T00:00:00+05:30'
   AND l.movement_date < '2026-11-22T00:00:00+05:30'
), candidate AS (
 SELECT p.id,p.product_id,p.batch_number,p.activity_area,
   (SELECT count(DISTINCT (r.section_id,r.subsection_id,r.area_id,r.plant_id))
     FROM public.fg_bulk_stock_ledger r
     WHERE r.product_id=p.product_id AND r.batch_number=p.batch_number
       AND r.section_id IS NOT NULL AND r.subsection_id IS NOT NULL AND r.area_id IS NOT NULL)
       as all_recorded_location_identities,
   (SELECT count(DISTINCT (r.section_id,r.subsection_id,r.area_id,r.plant_id))
     FROM public.fg_bulk_stock_ledger r
     WHERE r.product_id=p.product_id AND r.batch_number=p.batch_number
       AND r.source_table='daily_work_log' AND r.reason_code='FG bulk storage'
       AND r.qty_base>0) as original_receipt_location_identities,
   (SELECT r.area_id FROM public.fg_bulk_stock_ledger r
     WHERE r.product_id=p.product_id AND r.batch_number=p.batch_number
       AND r.source_table='daily_work_log' AND r.reason_code='FG bulk storage'
       AND r.qty_base>0 ORDER BY r.created_at DESC,r.id DESC LIMIT 1) store_area
 FROM packing p
)
SELECT c.activity_area,aa.area_name packaging_work_area,
       c.store_area,sa.area_name source_receipt_area,
       count(*) movements,
       count(DISTINCT(c.product_id,c.batch_number)) product_batches,
       count(*) FILTER(WHERE all_recorded_location_identities>1) ambiguous_stock_location,
       count(*) FILTER(WHERE original_receipt_location_identities=1) unique_orig_receipt_location
FROM candidate c
LEFT JOIN public.areas aa ON aa.id=c.activity_area
LEFT JOIN public.areas sa ON sa.id=c.store_area
GROUP BY c.activity_area,aa.area_name,c.store_area,sa.area_name
ORDER BY movements DESC;

-- Entire incomplete-location Nov cohort: candidate-count distribution only.
WITH location_count AS (
 SELECT product_id,batch_number,
        count(DISTINCT (section_id,subsection_id,area_id,plant_id))
        FILTER(WHERE section_id IS NOT NULL
                 AND subsection_id IS NOT NULL AND area_id IS NOT NULL)
        location_count
 FROM public.fg_bulk_stock_ledger
 GROUP BY product_id,batch_number
), unknowns AS (
 SELECT l.*,coalesce(x.location_count,0) candidate_locations
 FROM public.fg_bulk_stock_ledger l
 LEFT JOIN location_count x USING(product_id,batch_number)
 WHERE l.movement_date >= '2026-11-01T00:00:00+05:30'
   AND l.movement_date < '2026-11-22T00:00:00+05:30'
   AND (l.section_id IS NULL OR l.subsection_id IS NULL OR l.area_id IS NULL)
)
SELECT source_table,count(*) unknown_location_rows,
 count(*) FILTER(WHERE candidate_locations=0) no_candidate,
 count(*) FILTER(WHERE candidate_locations=1) single_recorded_candidate,
 count(*) FILTER(WHERE candidate_locations>1) multiple_recorded_candidates
FROM unknowns GROUP BY source_table ORDER BY unknown_location_rows DESC;
COMMIT;
-- Evidence categories are NOT reassignment authority: packaging WORK AREA can
-- differ from material stock's LINE-SIDE STORE. For batch 5/6831 the recorded
-- internal transfer changes plant 85 -> 84 within Fermentation Area (45), so
-- a "same area" is not equivalent to the same stock location. Do not flatten.
-- 5 packaging rows had source FG receipt Fermentation Area while packaging
-- work area is Filling & Packaging Arishtam/Asavam/Kashayam: require source
-- transfer/physical handover evidence before allocating stock.
