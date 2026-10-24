-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view lab.v_analysis_header as
select
  ar.id,
  ar.analysis_register_no,
  ar.analysis_subject_type,
  ar.stream_code,
  ar.status,
  ar.analysis_mode,
  ar.has_outsourced_tests,
  ar.sample_received_date,
  ar.analysis_completed_date,
  ar.mfg_date,
  ar.exp_date,
  ar.batch_no_snapshot,
  ar.batch_size_snapshot,
  u.code as batch_uom_code,
  ar.system_lot_no,
  ar.supplier_lot_no,
  ar.supplier_name_snapshot,
  ar.physical_register_ref,
  ar.analysed_by_name_snapshot,
  ar.analysed_by_designation_snapshot,
  ar.person_in_charge_name_snapshot,
  ar.person_in_charge_designation_snapshot,
  ar.product_id,
  ar.stock_item_id,
  pd.product_name,
  si.name as stock_item_name,
  coalesce(pd.product_name, si.name) as item_name,
  ar.bmr_id
from lab.analysis_record ar
left join public.inv_uom u on u.id = ar.batch_uom_id
left join public.v_product_details pd on pd.product_id = ar.product_id
left join public.inv_stock_item si on si.id = ar.stock_item_id;