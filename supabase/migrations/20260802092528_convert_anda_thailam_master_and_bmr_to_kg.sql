-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
    v_product_id integer := 867;
    v_bmr_id bigint := 685;
    v_density_kg_per_ml numeric := 12::numeric / 11.1::numeric / 1000::numeric;
    v_product_uom text;
    v_product_factor numeric;
    v_bmr_uom text;
    v_bmr_batch_size numeric;
begin
    select uom_base, conversion_to_base
      into v_product_uom, v_product_factor
    from public.products
    where id = v_product_id
    for update;

    if not found then
        raise exception 'Anda Thailam product % does not exist', v_product_id;
    end if;

    select uom, batch_size
      into v_bmr_uom, v_bmr_batch_size
    from public.bmr_details
    where id = v_bmr_id
      and product_id = v_product_id
    for update;

    if not found then
        raise exception 'Anda Thailam BMR row % does not exist', v_bmr_id;
    end if;

    if v_product_uom is distinct from 'L'
       or v_product_factor is distinct from 0.001::numeric
       or v_bmr_uom is distinct from 'L'
       or v_bmr_batch_size is distinct from 11.1::numeric then
        raise exception
            'Anda Thailam master changed unexpectedly. Product % / %, BMR % / %',
            v_product_uom,
            v_product_factor,
            v_bmr_uom,
            v_bmr_batch_size;
    end if;

    alter table public.bmr_details
      drop constraint fk_bmr_product_uom;

    update public.products
       set uom_base = 'Kg',
           conversion_to_base = v_density_kg_per_ml
     where id = v_product_id;

    update public.bmr_details
       set batch_size = 12::numeric,
           uom = 'Kg'
     where id = v_bmr_id
       and product_id = v_product_id;

    alter table public.bmr_details
      add constraint fk_bmr_product_uom
      foreign key (product_id, uom)
      references public.products(id, uom_base)
      on delete restrict;
end
$$;