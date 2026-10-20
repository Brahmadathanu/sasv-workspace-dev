-- G2 migration draft: append-only confirmation record, no live execution.
create table costing.route_repetition_confirmation (
 id bigint generated always as identity primary key,
 route_kind text not null check(route_kind in ('FAMILY','PRODUCT')),
 route_id bigint not null,
 route_version integer not null,
 step_digest text not null,
 step_evidence jsonb not null,
 confirmed_by uuid not null,
 confirmed_at timestamptz not null default now()
);
alter table costing.route_repetition_confirmation enable row level security;
revoke all on costing.route_repetition_confirmation from anon,authenticated;
