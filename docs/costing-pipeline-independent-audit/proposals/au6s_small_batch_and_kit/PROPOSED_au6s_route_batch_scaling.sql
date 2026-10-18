-- PROPOSED (NOT APPLIED, NOT BUILT INTO WRITERS). AU-6S batch-size-scaled route workload.
-- Status: design + config DDL only. The writer hook (POH and DL workload writers) has to be built and tested
-- locally plus a run-126 replay, following the AU-6Q pattern, after the user picks option A or B.
-- Keep this OUT of supabase/migrations.
--
-- Problem: route step factors are per batch and do not depend on batch mass. Per-unit cost = rate x factor / bs,
--   so a 2 kg Kvatha batch carries the same washing/drying/grinding workload as a 150 kg batch
--   (10x the family median per kg).
-- Policy kept: batch_size_ref stays the batch reference; no time-based spreading; full pool absorption;
--   insert-path only; effective-dated from a chosen period; Sep run 122 untouched.
--
-- Method: scaled step factor f'_s = f_s x (bs / ref_bs)^b(resource_class)
--   ref_bs = median batch_size_ref of the product's route family within the same base UOM
--            (frozen per run in the workload snapshot for audit)
--   Option A (symmetric):        scale = (bs/ref)^b      (small batches lighter, large batches heavier)
--   Option B (small-batch only): scale = least(1, (bs/ref)^b)   (RECOMMENDED: only relieves small batches)
--   b reflects how much of the step's effort grows with batch mass: 0 = fully per batch (fixed),
--   1 = fully per kg.
--   QC is NOT scaled: tests per batch are genuinely fixed (AU-6Q per-batch QC stays).

begin;
do $g$ begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then
    raise exception 'AU6S-R: a costing run is in progress'; end if;
end $g$;

create table if not exists costing.route_step_scale_exponent (
  resource_class_code text primary key,
  exponent numeric not null check (exponent between 0 and 1),
  rationale text not null,
  approval_reference text not null,
  created_at timestamptz not null default now()
);

insert into costing.route_step_scale_exponent (resource_class_code, exponent, rationale, approval_reference) values
 ('GRINDER',0.8,'throughput-bound; time ~ mass','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('TABLET_OR_CAPSULE_EQUIPMENT',0.9,'machine run time ~ units','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('MANUAL',0.7,'handling ~ mass, some setup','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('FILTRATION_SYSTEM',0.7,'volume-bound','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('MIXING_EQUIPMENT',0.6,'charge/clean fixed, run partly mass','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('PROCESSING_VESSEL',0.5,'heating cycle partly fixed','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('EXTRACTION_SYSTEM',0.5,'cycle partly fixed','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('DRYER_OR_OVEN',0.5,'cycle time fixed, loading ~ mass','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('FERMENTATION_VESSEL',0.4,'occupancy time fixed','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('CALCINATION',0.3,'puta cycles fixed','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('TRADITIONAL_FURNACE',0.3,'firing cycle fixed','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('STORAGE_OCCUPANCY',0.3,'occupancy mostly time','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('GENERAL_AREA',0.0,'per batch','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>'),
 ('EXTERNAL_JOB_WORK',0.0,'per batch','USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>')
on conflict do nothing;
-- Unlisted classes default to 0.5 in the simulation; the writer must instead BLOCK a run when it finds an unmapped class.

create table if not exists costing.route_batch_scaling_switch (
  id bigserial primary key,
  mode text not null check (mode in ('OFF','SYMMETRIC','SMALL_BATCH_ONLY')),
  effective_from date not null check (effective_from >= date '2026-10-01'),
  effective_to date,
  approval_reference text not null,
  created_at timestamptz not null default now()
);

create or replace function costing.fn_route_batch_scale(p_bs numeric, p_ref_bs numeric, p_exponent numeric, p_mode text)
returns numeric language sql immutable as $f$
  select case
    when p_mode is null or p_mode = 'OFF' or p_bs is null or p_ref_bs is null or p_bs <= 0 or p_ref_bs <= 0 then 1::numeric
    when p_mode = 'SMALL_BATCH_ONLY' then least(1::numeric, power(p_bs / p_ref_bs, coalesce(p_exponent, 0.5)))
    else power(p_bs / p_ref_bs, coalesce(p_exponent, 0.5)) end
$f$;

-- Seed (choose ONE mode at approval):
-- insert into costing.route_batch_scaling_switch (mode, effective_from, approval_reference)
-- values ('SMALL_BATCH_ONLY', date '2026-11-01', 'USER-APPROVAL-AU6S-ROUTE-SCALING-<DATE>');

-- Writer hook (to be built): in the POH step/workload writer and the DL step/workload writer, for runs whose
-- period_start >= switch.effective_from:
--   step_factor_effective = step_factor x fn_route_batch_scale(bs, family_ref_bs, exponent(resource_class), mode)
--   route_factor = sum(step_factor_effective); labour intensity is scaled the same way per labour step.
--   Persist ref_bs, scale and the raw factor in the snapshot (new nullable columns) so the derivation is auditable.
--   The rate is re-derived from the full pool (full absorption); any rounding goes to batch_true_absorption_variance.
rollback;
