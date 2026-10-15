-- Read-only candidate rate and scope diagnostic. Not an approval or refresh trigger.
with candidate(label,labour_workload,oh_workload) as (
 values ('NARROW_PREVIOUS_COHORT',10939.4::numeric/12,11897::numeric/12),
 ('FIRST_TRANSFER_DEDUP_12M',11615.9::numeric/12,12660.5::numeric/12),
 ('ALL_PRODUCT_MIN_BATCH_MODEL',5519.35::numeric,5373.5::numeric)
)
select label,labour_workload,oh_workload,
 round(706203::numeric/labour_workload,6) labour_rate,
 round(361578.68166667::numeric/oh_workload,6) fixed_overhead_rate,
 round(654456.6::numeric/oh_workload,6) variable_overhead_rate
from candidate;
-- Independent policy-source reconciliation; all approved amounts currently zero.
select * from costing.fn_preview_manufacturing_behaviour_split_conservation(119);
select * from costing.fn_preview_manufacturing_rate_cutover_gate(119);
-- The ALL_PRODUCT_MIN_BATCH_MODEL is a counterfactual baseline, NOT certified actual activity.
-- Historical first-transfer dates are not manufacturing-completion dates.
-- None of the three candidate denominators is approval-ready without production programme and period parity.
