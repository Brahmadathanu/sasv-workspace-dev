-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- AU-5 re-based (normal batch volume) standard rates, user-approved 2026-10-16, effective 1 Oct 2026; switch ON effective-dated.
-- Calc (reproducible, run 122 inputs): rate = pool / SUM over 460 products with batch_size_ref>0 of
--   (route workload per batch) x (monthly product base qty / batch_size_ref)
--   POH: 670,935.04 / 1,583.472371 = 423.7112 per batch-equivalent workload unit
--   Labour: 706,203.00 / 1,399.062060 = 504.7689 per batch-equivalent workload unit
-- In NORMAL_VOLUME_RATE mode the engine re-derives the rate from each run's own pool and volume (variance = 0); these rows
-- record the approved basis and run-122 reference values for audit and for the APPROVED_RATE fallback path.
insert into costing.manufacturing_standard_rate_policy(policy_code,policy_version,allocation_pool,component_code,cost_behaviour,effective_from,normal_workload_units,normal_budget_amount,workload_unit_code,evidence_reference,approval_reference,status,approved_by,approved_at)
select * from (values
 ('AU5_LABOUR_NORMAL_VOLUME_RATE',3,'MANUFACTURING_LABOUR','MANUFACTURING_LABOUR','FIXED',date '2026-10-01',1399.062060::numeric,706203.00::numeric,'NORMAL_BATCH_EQUIVALENT_WORKLOAD_UNIT',
  'AU-5 re-based on normal batch volume; run 122 (Sep 2026) labour pool 706,203 / 1,399.062060 batch-equivalent units (460 products, batch_size_ref) = 504.7689. Supersedes 128.02 basis (policy id 7) from 1 Oct 2026. Calc: PR #72 docs/costing-pipeline-independent-audit/evidence/AU5.',
  'USER-APPROVAL-AU5-REBASED-20261016','APPROVED','dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid,now()),
 ('AU5_POH_NORMAL_VOLUME_RATE',2,'PRODUCTION_OVERHEAD','TOTAL_PRODUCTION_OVERHEAD','FIXED',date '2026-10-01',1583.472371::numeric,670935.04::numeric,'NORMAL_BATCH_EQUIVALENT_WORKLOAD_UNIT',
  'AU-5 re-based on normal batch volume; run 122 (Sep 2026) POH pool 670,935.04 / 1,583.472371 batch-equivalent units (460 products, batch_size_ref) = 423.7112. cost_behaviour FIXED = whole monthly pool absorbed over normal volume under AU-5; fixed/variable split design still pending. Calc: PR #72 docs/costing-pipeline-independent-audit/evidence/AU5.',
  'USER-APPROVAL-AU5-REBASED-20261016','APPROVED','dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid,now())
) v(a,b,c,d,e,f,g,h,i,j,k,l,m,n)
where not exists (select 1 from costing.manufacturing_standard_rate_policy p where p.policy_code=v.a and p.policy_version=v.b);
update costing.batch_true_standard_switch set is_enabled=true, rate_basis='NORMAL_VOLUME_RATE', effective_from=date '2026-10-01',
  changed_by='USER-APPROVAL-AU5-REBASED-20261016', changed_at=now(),
  note='ON for runs with valuation_date >= 2026-10-01 only (September run 122 and locked period unaffected)';
