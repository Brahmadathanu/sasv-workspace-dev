-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
    v_source costing.sku_commercial_sales_assumption%rowtype;
    v_base record;
    v_scheme record;
    v_mrp record;
    v_price record;
    v_existing_id bigint;
    v_now timestamptz := clock_timestamp();
    v_basic_price numeric;
    v_discount_amount numeric;
    v_billed_price numeric;
    v_assumed_value numeric;
begin
    select *
    into v_source
    from costing.sku_commercial_sales_assumption
    where id = 2
      and period_start = date '2026-07-01'
      and sku_id = 1792
      and approval_reference = 'EVP-3I2C12C.5.11AG'
      and assumed_sales_units = 11
      and abs(assumed_sales_value - 211786.6666666667) < 0.000001;

    if not found then
        raise exception 'Approved Abhraka common assumption source was not found with the locked business values.';
    end if;

    select id
    into v_existing_id
    from costing.sku_regional_commercial_sales_assumption
    where period_start = date '2026-07-01'
      and sku_id = 1792
      and region_code = 'IK'
      and closed_at is null
    order by created_at desc, id desc
    limit 1;

    if v_existing_id is not null then
        raise notice 'Abhraka IK regional assumption already exists as ID %; migration is idempotently skipped.', v_existing_id;
        return;
    end if;

    select * into strict v_base
    from costing.fn_resolve_sku_commercial_base_context(1792);

    select * into strict v_scheme
    from costing.fn_resolve_selected_scheme_policy_as_of(
        1792,
        'IK',
        date '2026-07-01'
    );

    select * into strict v_mrp
    from costing.fn_resolve_sku_mrp_as_of(
        1792,
        date '2026-07-01'
    );

    select * into strict v_price
    from costing.fn_resolve_sku_selling_price_policy_as_of(
        1792,
        date '2026-07-01'
    );

    if v_base.resolution_status <> 'RESOLVED'
       or v_scheme.resolution_status not in ('RESOLVED_POLICY', 'DEFAULT_NO_SCHEME')
       or v_mrp.resolution_status <> 'RESOLVED'
       or v_price.resolution_status <> 'RESOLVED'
    then
        raise exception 'Current governed commercial context is not fully resolved for Abhraka IK.';
    end if;

    if v_scheme.scheme_name <> 'No Scheme'
       or v_scheme.paid_qty <> 1
       or v_scheme.free_qty <> 0
       or v_mrp.mrp_ik <> 28880
       or v_price.gst_percent <> 5
    then
        raise exception 'Current governed context no longer matches the approved Abhraka assumption basis.';
    end if;

    v_basic_price := v_mrp.mrp_ik / (1 + v_price.gst_percent / 100.0);
    v_discount_amount := v_basic_price * 30 / 100.0;
    v_billed_price := v_basic_price - v_discount_amount;
    v_assumed_value := 11 * v_billed_price;

    if abs(v_assumed_value - v_source.assumed_sales_value) > 0.000001 then
        raise exception 'Derived regional value % does not match approved common value %.', v_assumed_value, v_source.assumed_sales_value;
    end if;

    insert into costing.sku_regional_commercial_sales_assumption (
        id,
        period_start,
        sku_id,
        region_code,
        assumption_basis,
        assumed_paid_units,
        assumed_free_units,
        assumed_total_units,
        sku_base_qty_per_unit,
        assumed_total_base_qty,
        product_base_uom,
        scheme_id,
        scheme_name,
        scheme_paid_qty,
        scheme_free_qty,
        scheme_total_qty,
        scheme_resolution_source,
        scheme_policy_reference,
        mrp_policy_id,
        selling_price_policy_id,
        resolved_mrp,
        resolved_gst_percent,
        resolved_basic_price,
        standard_discount_percent,
        standard_discount_amount_per_paid_unit,
        standard_billed_price_per_paid_unit,
        commercial_resolution_mode,
        override_discount_percent,
        override_discount_amount_per_paid_unit,
        override_billed_price_per_paid_unit,
        approved_total_value_override,
        override_reason,
        resolved_discount_percent,
        resolved_discount_amount_per_paid_unit,
        resolved_billed_price_per_paid_unit,
        standard_derived_sales_value,
        derived_assumed_sales_value,
        resolved_assumed_sales_value,
        value_resolution_source,
        remarks,
        approval_reference,
        effective_from,
        effective_to,
        status,
        previous_assumption_id,
        created_at,
        created_by,
        updated_at,
        updated_by,
        closed_at,
        closed_by
    ) values (
        nextval('costing.sku_regional_commercial_sales_assumption_id_seq'),
        date '2026-07-01',
        1792,
        'IK',
        'BULK_ORDER_ESTIMATE',
        11,
        0,
        11,
        v_base.sku_base_qty_per_unit,
        11 * v_base.sku_base_qty_per_unit,
        v_base.product_base_uom,
        v_scheme.scheme_id,
        v_scheme.scheme_name,
        v_scheme.paid_qty,
        v_scheme.free_qty,
        v_scheme.total_qty,
        v_scheme.policy_source,
        case when v_scheme.policy_rule_id is null then null else concat(v_scheme.policy_source, ':', v_scheme.policy_rule_id) end,
        v_mrp.policy_id,
        v_price.policy_id,
        v_mrp.mrp_ik,
        v_price.gst_percent,
        v_basic_price,
        0,
        0,
        v_basic_price,
        'APPROVED_DISCOUNT_PERCENT',
        30,
        null,
        null,
        null,
        'Approved temporary 30% bulk-order discount carried forward from the governed common assumption into the canonical IK regional register.',
        30,
        v_discount_amount,
        v_billed_price,
        11 * v_basic_price,
        v_assumed_value,
        v_assumed_value,
        'APPROVED_DISCOUNT_OVERRIDE',
        concat(
            'Regional migration of approved July Abhraka Bhasmam 1000 g bulk-order assumption. Source common assumption ID ',
            v_source.id,
            '; Inside Kerala; No Scheme; 11 paid units; approved 30% discount. Original remarks: ',
            v_source.remarks
        ),
        v_source.approval_reference,
        date '2026-07-01',
        date '2026-07-31',
        'ACTIVE',
        null,
        v_now,
        v_source.created_by,
        v_now,
        v_source.created_by,
        null,
        null
    );
end;
$migration$;