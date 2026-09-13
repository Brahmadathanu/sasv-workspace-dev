-- SOURCE-CONTROL PARITY
-- Already applied in production as
-- 20260912105216_regional_sales_default_policy_source_constraints
-- DO NOT reapply to production.
--
-- Captured from linked project qhmoqtxpeasamtlxaoak via
-- pg_get_constraintdef for:
--   costing.sku_regional_marketing_basis_source_chk
--   costing.sku_regional_marketing_allocation_value_source_chk
-- Bodies below match the live CHECK definitions.

alter table costing.sku_regional_marketing_allocation_basis_snapshot
  drop constraint if exists sku_regional_marketing_basis_source_chk;

alter table costing.sku_regional_marketing_allocation_basis_snapshot
  add constraint sku_regional_marketing_basis_source_chk
  check (
    regional_basis_source = any (
      array[
        'REGIONAL_ACTUAL_UNITS'::text,
        'REGIONAL_ASSUMPTION_UNITS'::text,
        'REGION_SCALED_COMMON_BASIS'::text,
        'REGIONAL_DEFAULT_POLICY_UNITS'::text,
        'AMBIGUOUS_REGIONAL_ASSUMPTION'::text,
        'NO_PRODUCT_REGION_MONETARY_SOURCE'::text,
        'NO_POSITIVE_PRODUCT_REGION_PHYSICAL_SHARE'::text,
        'INVALID_COMMON_BASIS'::text,
        'UNRESOLVED'::text
      ]
    )
  );

alter table costing.sku_regional_marketing_expense_allocation_snapshot
  drop constraint if exists sku_regional_marketing_allocation_value_source_chk;

alter table costing.sku_regional_marketing_expense_allocation_snapshot
  add constraint sku_regional_marketing_allocation_value_source_chk
  check (
    marketing_value_source = any (
      array[
        'ACTUAL_SIGNED_BILLED_SALES'::text,
        'APPROVED_REGIONAL_ASSUMPTION'::text,
        'GOVERNED_REGIONAL_DEFAULT'::text,
        'NO_ELIGIBLE_HISTORY'::text
      ]
    )
  );
