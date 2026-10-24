-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table costing.production_route_behaviour (
  code text primary key,label text not null,description text not null,is_active boolean not null default true,sort_order integer not null default 100,created_at timestamptz not null default now()
);
insert into costing.production_route_behaviour(code,label,description,sort_order) values
 ('FULLY_ATTENDED','Fully attended','Continuous operator attention is normally required.',10),
 ('INTERMITTENT_ATTENDED','Intermittently attended','Periodic operator intervention is required during the process.',20),
 ('SUPERVISION_ONLY','Supervision only','The process mainly requires monitoring or control.',30),
 ('UNATTENDED_PROCESS','Unattended process','The process proceeds independently after setup.',40),
 ('WAITING_OR_COOLING','Waiting or cooling','A necessary route state with minimal active attention.',50);

create table costing.production_resource_class (
  code text primary key,label text not null,description text not null,is_active boolean not null default true,sort_order integer not null default 100,created_at timestamptz not null default now()
);
insert into costing.production_resource_class(code,label,description,sort_order) values
 ('MANUAL','Manual','Primarily manual production resource.',10),('GRINDER','Grinder','Grinding, pulverising or levigation resource.',20),
 ('DRYER_OR_OVEN','Dryer or oven','Drying or oven resource.',30),('PROCESSING_VESSEL','Processing vessel','General processing vessel or cooker.',40),
 ('FERMENTATION_VESSEL','Fermentation vessel','Fermentation vessel or governed fermentation area.',50),('CALCINATION','Calcination','Putam, furnace or other calcination resource.',60),
 ('PACKING_MACHINE','Packing machine','Filling, packing or packaging equipment.',70),('GENERAL_AREA','General production area','Area-based production resource without mandatory machinery.',80),
 ('EXTRACTION_SYSTEM','Extraction system','Pressurised, open-vessel or other extraction system.',90),('DISTILLATION_UNIT','Distillation unit','Distillation resource.',100),
 ('TABLET_OR_CAPSULE_EQUIPMENT','Tablet or capsule equipment','Granulation, punching or capsule equipment.',110),('PILL_PROCESSING','Pill processing','Pill or Gulika production resource.',120),
 ('FILTRATION_SYSTEM','Filtration system','Filtration or separation resource.',130),('TRADITIONAL_FURNACE','Traditional furnace','Traditional heating or furnace resource.',140),
 ('STORAGE_OCCUPANCY','Storage occupancy','Temporary WIP holding or passive production occupancy.',150);

create table costing.production_cost_centre (
 id bigserial primary key,cost_centre_code text not null unique,cost_centre_name text not null,
 cost_centre_type text not null check(cost_centre_type in('EQUIPMENT_CENTRED','PROCESS_AREA_CENTRED','SERVICE_CENTRED')),
 section_id integer references public.sections(id) on delete restrict,subsection_id integer references public.subsections(id) on delete restrict,
 area_id integer references public.areas(id) on delete restrict,plant_id integer references public.plant_machinery(id) on delete restrict,
 default_resource_class_code text references costing.production_resource_class(code) on delete restrict,
 pool_scope text not null default 'SHARED_ROUTE' check(pool_scope in('PRODUCTION_OVERHEAD','DIRECT_LABOUR','SHARED_ROUTE','EXCLUDED_OTHER_POOL')),
 effective_from date not null default current_date,effective_to date,status text not null default 'DRAFT' check(status in('DRAFT','APPROVED','INACTIVE')),
 approval_reference text,approved_by uuid,approved_at timestamptz,created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>=effective_from),check(plant_id is null or area_id is not null),check(cost_centre_type<>'EQUIPMENT_CENTRED' or plant_id is not null)
);

create table costing.product_group_process_route (
 id bigserial primary key,product_group_id integer not null references public.product_groups(id) on delete restrict,route_code text not null,route_version integer not null check(route_version>0),route_name text not null,
 status text not null default 'DRAFT' check(status in('DRAFT','REVIEW_REQUIRED','APPROVED','SUPERSEDED','REJECTED','INACTIVE')),
 effective_from date,effective_to date,source_type text not null default 'MANUAL' check(source_type in('MANUAL','HISTORICAL_CANDIDATE','COPIED_VERSION')),
 evidence_status text not null default 'MANUAL_COMPLETE' check(evidence_status in('MANUAL_COMPLETE','HISTORICAL_COMPLETE','PARTIAL_EVIDENCE','NO_EVIDENCE')),
 approval_reference text,approved_by uuid,approved_at timestamptz,supersedes_route_id bigint references costing.product_group_process_route(id) on delete restrict,
 route_note text,created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(product_group_id,route_version),unique(route_code,route_version),check(effective_to is null or effective_from is not null),check(effective_to is null or effective_to>=effective_from),
 check(status<>'APPROVED' or(effective_from is not null and approval_reference is not null and approved_at is not null and evidence_status in('MANUAL_COMPLETE','HISTORICAL_COMPLETE')))
);

create table costing.product_group_process_route_step (
 id bigserial primary key,group_route_id bigint not null references costing.product_group_process_route(id) on delete cascade,step_key text not null,sequence_no numeric(12,4) not null check(sequence_no>0),
 activity_id integer not null references public.activities(id) on delete restrict,cost_centre_id bigint not null references costing.production_cost_centre(id) on delete restrict,
 section_id integer not null references public.sections(id) on delete restrict,subsection_id integer not null references public.subsections(id) on delete restrict,area_id integer not null references public.areas(id) on delete restrict,
 plant_id integer references public.plant_machinery(id) on delete restrict,behaviour_code text not null references costing.production_route_behaviour(code) on delete restrict,
 resource_class_code text not null references costing.production_resource_class(code) on delete restrict,
 route_step_scope text not null check(route_step_scope in('BOUNDARY_RM_ISSUE','PRODUCTION_PROCESS','INTERMEDIATE_WIP_HOLD','BOUNDARY_FG_TRANSFER','QC_OTHER_POOL','STORES_OTHER_POOL','NON_PRODUCTION')),
 expected_occurrence_count numeric(12,4) not null default 1 check(expected_occurrence_count>0),standard_cycle_count numeric(12,4) not null default 1 check(standard_cycle_count>0),
 is_mandatory boolean not null default true,allows_repeat boolean not null default false,allows_skip_with_approval boolean not null default false,
 production_overhead_scope text not null default 'INCLUDE' check(production_overhead_scope in('INCLUDE','PASSIVE','EXCLUDE_OTHER_POOL')),
 direct_labour_scope text not null default 'INCLUDE' check(direct_labour_scope in('INCLUDE','SUPERVISION','EXCLUDE_OTHER_POOL')),
 step_note text,created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(group_route_id,step_key),unique(group_route_id,sequence_no),
 check((route_step_scope in('QC_OTHER_POOL','STORES_OTHER_POOL','NON_PRODUCTION') and production_overhead_scope='EXCLUDE_OTHER_POOL') or route_step_scope not in('QC_OTHER_POOL','STORES_OTHER_POOL','NON_PRODUCTION'))
);

create table costing.product_process_route (
 id bigserial primary key,product_id integer not null references public.products(id) on delete restrict,base_group_route_id bigint not null references costing.product_group_process_route(id) on delete restrict,
 route_version integer not null check(route_version>0),route_code text not null,status text not null default 'DRAFT' check(status in('DRAFT','REVIEW_REQUIRED','APPROVED','SUPERSEDED','REJECTED','INACTIVE')),
 effective_from date,effective_to date,batch_size_ref_id bigint not null references public.production_batch_size_ref(id) on delete restrict,
 source_type text not null default 'MANUAL' check(source_type in('MANUAL','HISTORICAL_CANDIDATE','GROUP_ROUTE_ONLY','COPIED_VERSION')),
 evidence_status text not null default 'MANUAL_COMPLETE' check(evidence_status in('MANUAL_COMPLETE','HISTORICAL_COMPLETE','PARTIAL_EVIDENCE','NO_EVIDENCE')),
 approval_reference text,approved_by uuid,approved_at timestamptz,supersedes_route_id bigint references costing.product_process_route(id) on delete restrict,
 route_note text,created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(product_id,route_version),unique(route_code,route_version),check(effective_to is null or effective_from is not null),check(effective_to is null or effective_to>=effective_from),
 check(status<>'APPROVED' or(effective_from is not null and approval_reference is not null and approved_at is not null and evidence_status in('MANUAL_COMPLETE','HISTORICAL_COMPLETE')))
);

create table costing.product_process_route_override (
 id bigserial primary key,product_route_id bigint not null references costing.product_process_route(id) on delete cascade,
 operation_type text not null check(operation_type in('ADD_STEP','BYPASS_STEP','REPLACE_STEP','ALTER_LOCATION','ALTER_RESOURCE','ALTER_CYCLE','ALTER_MANDATORY_STATUS')),
 base_step_id bigint references costing.product_group_process_route_step(id) on delete restrict,override_step_key text,sequence_no numeric(12,4),activity_id integer references public.activities(id) on delete restrict,
 cost_centre_id bigint references costing.production_cost_centre(id) on delete restrict,section_id integer references public.sections(id) on delete restrict,subsection_id integer references public.subsections(id) on delete restrict,
 area_id integer references public.areas(id) on delete restrict,plant_id integer references public.plant_machinery(id) on delete restrict,behaviour_code text references costing.production_route_behaviour(code) on delete restrict,
 resource_class_code text references costing.production_resource_class(code) on delete restrict,route_step_scope text check(route_step_scope in('BOUNDARY_RM_ISSUE','PRODUCTION_PROCESS','INTERMEDIATE_WIP_HOLD','BOUNDARY_FG_TRANSFER','QC_OTHER_POOL','STORES_OTHER_POOL','NON_PRODUCTION')),
 expected_occurrence_count numeric(12,4) check(expected_occurrence_count is null or expected_occurrence_count>0),standard_cycle_count numeric(12,4) check(standard_cycle_count is null or standard_cycle_count>0),
 is_mandatory boolean,allows_repeat boolean,allows_skip_with_approval boolean,production_overhead_scope text check(production_overhead_scope in('INCLUDE','PASSIVE','EXCLUDE_OTHER_POOL')),
 direct_labour_scope text check(direct_labour_scope in('INCLUDE','SUPERVISION','EXCLUDE_OTHER_POOL')),override_reason text not null,created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((operation_type='ADD_STEP' and base_step_id is null and override_step_key is not null and sequence_no is not null and activity_id is not null and cost_centre_id is not null and section_id is not null and subsection_id is not null and area_id is not null and behaviour_code is not null and resource_class_code is not null and route_step_scope is not null) or(operation_type<>'ADD_STEP' and base_step_id is not null)),
 unique(product_route_id,base_step_id,operation_type),unique(product_route_id,override_step_key)
);

create index idx_pg_process_route_effective on costing.product_group_process_route(product_group_id,status,effective_from,effective_to);
create index idx_product_process_route_effective on costing.product_process_route(product_id,status,effective_from,effective_to);
create index idx_product_process_override_route on costing.product_process_route_override(product_route_id,operation_type);
insert into public.permission_targets(key,kind,label,sort_order,is_assignable,meta) values('module:production-route-manager','module','Production Route Manager',635,true,jsonb_build_object('scope','product-to-process-master')) on conflict(key) do update set label=excluded.label,sort_order=excluded.sort_order,is_assignable=excluded.is_assignable,meta=excluded.meta;
revoke all on costing.production_route_behaviour,costing.production_resource_class,costing.production_cost_centre,costing.product_group_process_route,costing.product_group_process_route_step,costing.product_process_route,costing.product_process_route_override from anon,authenticated;