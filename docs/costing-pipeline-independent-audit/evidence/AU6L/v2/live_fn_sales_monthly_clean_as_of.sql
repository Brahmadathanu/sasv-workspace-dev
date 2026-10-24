CREATE OR REPLACE FUNCTION public.fn_sales_monthly_clean_as_of(p_as_of_date date)
 RETURNS TABLE(sku_id integer, product_id bigint, region_id integer, godown_id integer, month_start date, qty_clean numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    with context as (
        select
            (
                date_trunc(
                    'month',
                    p_as_of_date
                )
                - interval '36 months'
            )::date as cleaning_start,

            date_trunc(
                'month',
                p_as_of_date
            )::date as cleaning_end_exclusive
    ),

    source_rows as materialized (
        select
            m.sku_id,
            m.product_id,
            m.region_id,
            m.godown_id,
            m.month_start,
            m.qty_units
        from public.sales_monthly m
        cross join context c
        where p_as_of_date is not null
          and m.month_start >= c.cleaning_start
          and m.month_start < c.cleaning_end_exclusive
    ),

    group_bounds as materialized (
        select
            s.sku_id,
            s.region_id,
            s.godown_id,

            percentile_cont(0.25)
                within group (
                    order by s.qty_units::double precision
                ) as q1,

            percentile_cont(0.75)
                within group (
                    order by s.qty_units::double precision
                ) as q3

        from source_rows s

        where s.qty_units is not null

        group by
            s.sku_id,
            s.region_id,
            s.godown_id
    )

    select
        s.sku_id,
        s.product_id,
        s.region_id,
        s.godown_id,
        s.month_start,

        case
            when s.qty_units is null
                then null::numeric

            when s.qty_units < 0
                then null::numeric

            when s.qty_units::double precision >=
                 (
                     b.q1
                     - 1.5 * greatest(
                         b.q3 - b.q1,
                         0
                     )
                 )
             and s.qty_units::double precision <=
                 (
                     b.q3
                     + 1.5 * greatest(
                         b.q3 - b.q1,
                         0
                     )
                 )
                then s.qty_units

            else null::numeric
        end as qty_clean

    from source_rows s

    join group_bounds b
      on b.sku_id = s.sku_id
     and b.region_id = s.region_id
     and b.godown_id = s.godown_id;
$function$
