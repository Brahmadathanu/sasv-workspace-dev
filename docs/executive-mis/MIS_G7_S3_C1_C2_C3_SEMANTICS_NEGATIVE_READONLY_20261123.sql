-- MIS G7: C1/C2/C3 output-recognition policy tests.
-- SYNTHETIC only, READ ONLY, no production materialized data or writes.
BEGIN READ ONLY;
SET LOCAL statement_timeout='6000ms';
WITH events(case_id,source_table,reason_code,qty,route_signed,
  excess_authorized,book_transfer,expected) AS (
 VALUES
 ('signed_full_bulk','daily_work_log','FG bulk storage',10::numeric,true,false,false,'BULK_RECEIPT_ROUTE_VERIFIED_ONLY'),
 ('old_bulk_unverified','daily_work_log','FG bulk storage',10::numeric,false,false,false,'BULK_RECEIPT_UNVERIFIED'),
 ('pack_depletion','event_skus','Bottling (SKU)',-3::numeric,false,false,false,'PACKAGING_CONSUMPTION'),
 ('fg_transfer_activity','packaging_events','Transfer to FG store',3::numeric,false,false,true,'FG_TRANSFER_ACTIVITY_ONLY'),
 ('force_close','fn_fg_force_close','manual_adjustment',-2::numeric,false,false,false,'FORCE_CLOSE_NOT_PRODUCTION'),
 ('auto_zero','fn_fg_auto_zero','auto_zero_epsilon',-0.001::numeric,false,false,false,'AUTO_ZERO_NOT_PRODUCTION'),
 ('interplant_out','fg_bulk_internal_transfer','FG bulk internal transfer out',-5::numeric,false,false,false,'INTERNAL_MOVE_NOT_PRODUCTION'),
 ('interplant_in','fg_bulk_internal_transfer','FG bulk internal transfer in',5::numeric,false,false,false,'INTERNAL_MOVE_NOT_PRODUCTION'),
 ('unsigned_excess','proposed_excess_bulk','excess_bulk',1::numeric,false,false,false,'EXCESS_UNAUTHORIZED'),
 ('signed_excess','proposed_excess_bulk','excess_bulk',1::numeric,false,true,false,'EXCESS_AUTHORIZED_SEPARATE_FROM_PRODUCTION')
), classified AS (
 SELECT case_id,expected,CASE
 WHEN source_table='proposed_excess_bulk' AND NOT excess_authorized THEN 'EXCESS_UNAUTHORIZED'
 WHEN source_table='proposed_excess_bulk' AND excess_authorized THEN 'EXCESS_AUTHORIZED_SEPARATE_FROM_PRODUCTION'
 WHEN source_table='fg_bulk_internal_transfer' THEN 'INTERNAL_MOVE_NOT_PRODUCTION'
 WHEN source_table='fn_fg_force_close' THEN 'FORCE_CLOSE_NOT_PRODUCTION'
 WHEN source_table='fn_fg_auto_zero' THEN 'AUTO_ZERO_NOT_PRODUCTION'
 WHEN source_table='packaging_events' AND book_transfer THEN 'FG_TRANSFER_ACTIVITY_ONLY'
 WHEN source_table='event_skus' THEN 'PACKAGING_CONSUMPTION'
 WHEN source_table='daily_work_log' AND reason_code='FG bulk storage' AND route_signed THEN 'BULK_RECEIPT_ROUTE_VERIFIED_ONLY'
 WHEN source_table='daily_work_log' AND reason_code='FG bulk storage' THEN 'BULK_RECEIPT_UNVERIFIED'
 ELSE 'OTHER_REVIEW' END actual FROM events
)
SELECT case_id,expected,actual,expected=actual pass FROM classified ORDER BY case_id;
COMMIT;
-- Even a route-verified bulk receipt does not prove a complete *monthly* value
-- without signed full completion, proper valuation and historical correction parity.
-- Synthetic "signed_excess" represents proposed policy, NOT a deployed event.
