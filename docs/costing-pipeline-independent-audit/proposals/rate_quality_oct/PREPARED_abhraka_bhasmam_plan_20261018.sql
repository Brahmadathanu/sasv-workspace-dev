-- PREPARED, NOT APPLIED. Run after migration 20261018001500, before the October rerun.
-- Abhraka Bhasmam (product 54): governed new-product volume plan equal to Abhraka Chendooram's actual monthly
-- volume (0.33 kg/month; identical route family 78, route factor 203.25). Owner: user. Expires 2027-09-30.
insert into costing.new_product_volume_plan
  (product_id, sku_id, planned_monthly_base_qty, basis_note, owner_user_id, approval_reference, effective_from, expires_on, created_by)
select 54, null, 0.33,
  'Matched to Abhraka Chendooram (760) actual monthly max 0.33 kg; same route 78 / factor 203.25; no Abhraka Bhasmam sales in 12m.',
  'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'USER-APPROVAL-AU6-ABHRAKA-PLAN-<DATE>', '2026-10-01', '2027-09-30',
  'dff17104-c02a-4bca-95b1-e8ddff46a9b6'
where not exists (select 1 from costing.new_product_volume_plan where product_id=54 and status='APPROVED');
-- check: exactly 1 APPROVED plan for product 54
