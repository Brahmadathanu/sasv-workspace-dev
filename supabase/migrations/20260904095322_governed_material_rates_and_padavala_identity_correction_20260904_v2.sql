-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

insert into costing.material_manual_rates
(stock_item_id, rate_value, rate_uom_id, effective_from, effective_to, reason, status, created_by, last_updated_by, rate_origin)
values
(1218, 980.00, 1, date '2026-09-04', null, 'Governed costing decision 2026-09-04: Iruvi (D) manual costing rate approved at INR 980/kg due non-availability of qualifying purchase/valuation rate.', 'ACTIVE', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'MANUAL_ENTRY'),
(1197, 3000.00, 1, date '2026-09-04', null, 'Governed costing decision 2026-09-04: Kalthamara manual costing rate approved at INR 3000/kg as an explicit costing assumption where no qualifying rate evidence exists.', 'ACTIVE', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'MANUAL_ENTRY'),
(478, 100.00, 1, date '2026-09-04', null, 'Governed costing decision 2026-09-04: Kollankova Kizhangu (D) manual costing rate approved at INR 100/kg as an explicit costing assumption where no qualifying rate evidence exists.', 'ACTIVE', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'MANUAL_ENTRY'),
(1243, 70.00, 1, date '2026-09-04', null, 'Governed costing decision 2026-09-04: Pavakka (F) manual costing rate approved at INR 70/kg due absence of qualifying purchase/valuation rate.', 'ACTIVE', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'MANUAL_ENTRY');

update sp_bom_line
set stock_item_id = 444,
    remarks = concat_ws(' | ', nullif(remarks,''), 'Governed identity correction 2026-09-04: legacy Padavala Thandu (D) replaced with current Tally identity Kattu Padavala Thandu (D); quantity/UOM unchanged.')
where id in (354,621)
  and stock_item_id = 731;

commit;