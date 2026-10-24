-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop function if exists costing.fn_approve_group_process_route(bigint,text);
drop function if exists costing.fn_validate_group_process_route(bigint);
drop function if exists costing.fn_preview_product_group_route_candidate(integer,date,integer);
drop function if exists costing.fn_approve_product_process_route(bigint,text);

drop table if exists costing.product_group_process_route_step;
drop function if exists costing.fn_group_route_step_immutable();
drop table if exists costing.product_group_process_route;

alter table costing.product_process_route
  drop constraint if exists product_process_route_source_type_check;

alter table costing.product_process_route
  add constraint product_process_route_source_type_check
  check (source_type = any (array[
    'MANUAL'::text,
    'HISTORICAL_CANDIDATE'::text,
    'ROUTE_FAMILY_ONLY'::text,
    'COPIED_VERSION'::text
  ]));