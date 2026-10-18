-- PROPOSAL (approved by user 2026-10-16; NOT APPLIED). Classify 7 active unclassified staff.
-- Idempotent: inserts only where no active open classification exists. Mirrors existing class->pool mapping.
-- effective_from 2026-06-01 so June-Sep open periods pick them up (flat-salary policy).
begin;
with v(code, cls, pool) as (values
  ('15894','FINANCE_ADMIN','FINANCE_ADMIN_OVERHEAD'),
  ('19935','FINANCE_ADMIN','FINANCE_ADMIN_OVERHEAD'),
  ('20018','FINANCE_ADMIN','FINANCE_ADMIN_OVERHEAD'),
  ('16018','PACKING_LABOUR','DIRECT_LABOUR'),
  ('15770','PACKING_LABOUR','DIRECT_LABOUR'),
  ('16657','PACKING_LABOUR','DIRECT_LABOUR'),
  ('17315','PACKING_LABOUR','DIRECT_LABOUR'))
insert into costing.staff_costing_classification
  (staff_id, costing_class, allocation_pool, effective_from, allocation_weight, remarks, is_active)
select s.id, v.cls, v.pool, date '2026-06-01', 1, 'AU4-7STAFF-20261016 user-approved classification', true
from v join hr.staff s on s.employee_code = v.code and s.is_active
where not exists (select 1 from costing.staff_costing_classification k
                  where k.staff_id = s.id and k.is_active and k.effective_to is null);
-- Expect 7 rows; verify: select count(*) from public.v_costing_staff_classification_register where classification_status='UNCLASSIFIED'; -- 0
commit;

-- ROLLBACK:
-- delete from costing.staff_costing_classification where remarks = 'AU4-7STAFF-20261016 user-approved classification';
