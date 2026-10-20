-- INTENTIONALLY NOT DEPLOYABLE: migration design incomplete; fail closed on execution.
do $$ begin raise exception 'G2 HOLD: approval wiring, locking, and immutable evidence controls not yet verified'; end $$;
-- G2 migration draft: append-only confirmation record, no live execution.
create table costing.route_repetition_confirmation (
 id bigint generated always as identity primary key,
 route_kind text not null check(route_kind in ('FAMILY','PRODUCT')),
 family_route_id bigint references costing.production_route_family_route(id),
 product_route_id bigint references costing.product_process_route(id),
 route_version integer not null check (route_version > 0),
 step_digest text not null check (step_digest ~ '^[a-f0-9]{64}
 confirmed_at timestamptz not null default now()
);
alter table costing.route_repetition_confirmation enable row level security;
revoke all on costing.route_repetition_confirmation from anon,authenticated;
),
 step_evidence jsonb not null check (jsonb_typeof(step_evidence) = 'array' and jsonb_array_length(step_evidence) > 0),
 confirmed_by uuid not null default auth.uid(),
 constraint route_target_exclusive check ((route_kind='FAMILY' and family_route_id is not null and product_route_id is null) or (route_kind='PRODUCT' and product_route_id is not null and family_route_id is null)),
 confirmed_at timestamptz not null default now()
);
alter table costing.route_repetition_confirmation enable row level security;
revoke all on costing.route_repetition_confirmation from anon,authenticated;

create index on costing.route_repetition_confirmation(family_route_id,route_version);
create index on costing.route_repetition_confirmation(product_route_id,route_version);
create function costing.reject_route_repetition_confirmation_mutation() returns trigger language plpgsql as $$ begin raise exception 'Route repetition confirmation is immutable'; end $$;
create trigger protect_route_repetition_confirmation before update or delete on costing.route_repetition_confirmation for each row execute function costing.reject_route_repetition_confirmation_mutation();
