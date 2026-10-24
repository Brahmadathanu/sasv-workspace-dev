-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table public.inv_material_identity_part
    add constraint uq_inv_material_identity_part_id_identity unique (id, material_identity_id);

alter table public.inv_material_stock_item_map
    add constraint fk_inv_material_stock_item_map_part_identity
    foreign key (material_part_id, material_identity_id)
    references public.inv_material_identity_part(id, material_identity_id)
    on delete restrict;