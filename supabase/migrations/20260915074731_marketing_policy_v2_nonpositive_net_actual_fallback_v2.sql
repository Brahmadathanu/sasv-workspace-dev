-- SOURCE-CONTROL PARITY
-- Already applied live as:
--   20260915074731_marketing_policy_v2_nonpositive_net_actual_fallback_v2
-- DO NOT reapply to production.
--
-- Extends regional scenario CHECK for NON_POSITIVE_NET_ACTUAL_HISTORY.
-- Live already has this CHECK; CREATE OR REPLACE apply body lives in the
-- prospective cutover migration.

alter table costing.regional_sales_allocation_default_policy
  drop constraint if exists regional_sales_allocation_default_policy_scenario_chk;

alter table costing.regional_sales_allocation_default_policy
  add constraint regional_sales_allocation_default_policy_scenario_chk
  check (
    scenario_code = any (
      array[
        'NO_ELIGIBLE_REGIONAL_HISTORY'::text,
        'NO_POSITIVE_REGIONAL_HISTORY'::text,
        'NON_POSITIVE_NET_ACTUAL_HISTORY'::text
      ]
    )
  );
