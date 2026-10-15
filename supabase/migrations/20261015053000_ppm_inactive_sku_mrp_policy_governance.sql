-- Govern MRP for existing canonical SKUs regardless of operational activity.
-- No SKU activation, historical policy mutation or changed RPC privileges.
-- Retains original security-definer permission check and temporal chain safeguards.

CREATE OR REPLACE FUNCTION public.rpc_set_sku_mrp_policy(p_sku_id bigint, p_mrp_ik numeric, p_mrp_ok numeric, p_ok_pct numeric, p_calc_mode text, p_effective_from date, p_reason text, p_approval_reference text DEFAULT NULL::text)
 RETURNS TABLE(policy_id bigint, sku_id bigint, mrp_ik numeric, mrp_ok numeric, ok_pct numeric, calc_mode text, effective_from date, effective_to date, status text, reason text, approval_reference text, previous_policy_id bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare
    v_effective_from date;
    v_reason text;
    v_approval_reference text;

    v_normalized record;

    v_previous
        costing.sku_mrp_policy%rowtype;

    v_saved
        costing.sku_mrp_policy%rowtype;
begin
    perform public.require_permission(
        'module:pricing-policy-manager',
        true
    );


    if p_sku_id is null then
        raise exception
            'SKU ID is required';
    end if;


    if not exists (
        select 1
        from public.product_skus ps
        where ps.id = p_sku_id
          -- Pricing policy is independent of operational active status.
    ) then
        raise exception
            'SKU not found';
    end if;


    v_effective_from :=
        coalesce(
            p_effective_from,
            current_date
        );


    v_reason :=
        nullif(
            btrim(
                coalesce(
                    p_reason,
                    ''
                )
            ),
            ''
        );


    if v_reason is null then
        raise exception
            'MRP revision reason is required';
    end if;


    v_approval_reference :=
        nullif(
            btrim(
                coalesce(
                    p_approval_reference,
                    ''
                )
            ),
            ''
        );


    select *
    into v_normalized
    from costing.fn_normalize_sku_mrp(
        p_mrp_ik,
        p_mrp_ok,
        p_ok_pct,
        p_calc_mode
    );


    -- Serialize revisions for this SKU and prevent concurrent overlap.
    perform pg_advisory_xact_lock(
        hashtextextended(
            'sku-mrp-policy:'
            || p_sku_id::text,
            0
        )
    );


    select *
    into v_previous
    from costing.sku_mrp_policy p
    where p.sku_id = p_sku_id
      and p.status = 'APPROVED'
      and p.effective_to is null
    order by
        p.effective_from desc,
        p.id desc
    limit 1
    for update;


    if found then

        if v_effective_from
           <= v_previous.effective_from then
            raise exception
                'New MRP effective date must be after the existing open policy date %',
                v_previous.effective_from;
        end if;


        update costing.sku_mrp_policy p
        set
            effective_to =
                v_effective_from - 1,

            closed_at = now(),
            closed_by = auth.uid()

        where p.id = v_previous.id;

    end if;


    insert into costing.sku_mrp_policy (
        sku_id,
        mrp_ik,
        mrp_ok,
        ok_pct,
        calc_mode,
        effective_from,
        effective_to,
        status,
        reason,
        approval_reference,
        source_type,
        source_quality,
        source_snapshot,
        previous_policy_id,
        created_at,
        created_by
    )
    values (
        p_sku_id,
        v_normalized.mrp_ik,
        v_normalized.mrp_ok,
        v_normalized.ok_pct,
        v_normalized.calc_mode,
        v_effective_from,
        null,
        'APPROVED',
        v_reason,
        v_approval_reference,
        'MANUAL_ENTRY',
        'GOVERNED',

        jsonb_build_object(
            'submitted_mrp_ik',
                p_mrp_ik,
            'submitted_mrp_ok',
                p_mrp_ok,
            'submitted_ok_pct',
                p_ok_pct,
            'submitted_calc_mode',
                p_calc_mode,
            'normalized_mrp_ik',
                v_normalized.mrp_ik,
            'normalized_mrp_ok',
                v_normalized.mrp_ok,
            'normalized_ok_pct',
                v_normalized.ok_pct,
            'normalized_calc_mode',
                v_normalized.calc_mode
        ),

        case
            when v_previous.id is not null
                then v_previous.id
            else null
        end,

        now(),
        auth.uid()
    )
    returning *
    into v_saved;


    return query
    select
        v_saved.id,
        v_saved.sku_id,
        v_saved.mrp_ik,
        v_saved.mrp_ok,
        v_saved.ok_pct,
        v_saved.calc_mode,
        v_saved.effective_from,
        v_saved.effective_to,
        v_saved.status,
        v_saved.reason,
        v_saved.approval_reference,
        v_saved.previous_policy_id,
        v_saved.created_at;
end;
$function$
