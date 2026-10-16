-- AU-2c DRAFT. DO NOT RUN without explicit user approval + production evidence (GOV-015).
-- Ends in ROLLBACK by design; an approver changes it to COMMIT only after sign-off.
-- Each statement is guarded on the exact current value, so it is a no-op/abort if data moved.
-- Usage: psql -v meha_output=<16|32> -f this_file  (the approver must choose; no default). Live values re-verified 2026-10-16 10:40 IST: 2283=28039, 2289=320, 2379=2697, P696 factor 0.02.
-- Apply between costing runs (no QUEUED/RUNNING run); takes effect only in the NEXT run (frozen runs untouched).
\if :{?meha_output}
\else
\echo 'AU2C: set -v meha_output=16 or 32'
\quit
\endif
begin;
set local lock_timeout = '5s';
do $$ begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then
    raise exception 'AU2C: a costing run is in progress';
  end if;
end $$;

-- 1) SKU 859 / P678 Ilaneer Kuzhambu: BOM 2283 reference output 28039 -> 28.039 Kg
update public.rm_bom_header set reference_output_qty = 28.039, last_updated_at = now(),
       notes = coalesce(notes||' | ','')||'AU-2c 2026-10: ref output 28039->28.039 Kg (x1000 entry error); approval ref: <fill>'
 where id = 2283 and product_id = 678 and reference_output_qty = 28039 and reference_output_uom_id = 1;

-- 2) SKU 1277 / P1038 Palthulli: NO CHANGE until BMR evidence (candidate 2697 -> 2.697 conflicts with 5.44 Kg inputs).
-- update public.rm_bom_header set reference_output_qty = <evidence value> where id = 2379 and product_id = 1038 and reference_output_qty = 2697;

-- 3) SKU 879 / P696 Mehasamani: factor and BOM output must change TOGETHER
update public.products set conversion_to_base = 0.001
 where id = 696 and uom_base = 'Kg' and conversion_to_base = 0.02;
update public.rm_bom_header set reference_output_qty = :'meha_output'::numeric, last_updated_at = now(),
       notes = coalesce(notes||' | ','')||'AU-2c 2026-10: ref output 320->'||:'meha_output'||' Kg with factor 0.02->0.001; approval ref: <fill>'
 where id = 2289 and product_id = 696 and reference_output_qty = 320 and reference_output_uom_id = 1;

-- verification (expect exactly the intended rows)
select id, product_id, reference_output_qty from public.rm_bom_header where id in (2283,2289,2379);
select id, conversion_to_base from public.products where id = 696;
do $$ begin if (select reference_output_qty from public.rm_bom_header where id=2289) not in (16,32,320) then raise exception 'AU2C: unexpected 2289 value'; end if; end $$;
rollback;  -- change to COMMIT only with written approval
