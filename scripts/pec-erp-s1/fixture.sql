-- PEC S1 isolated-only synthetic fixture. No live project, no network, no production records.
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to authenticated;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create or replace function public.require_permission(p_target text,p_need_edit boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_target <> 'module:procurement-execution-console' or
    (p_need_edit and current_setting('pec.fixture.edit',true) is distinct from 'yes')
 then raise exception 'Permission denied';
 end if;
end $$;
create table public.proc_indent_header (
 indent_id bigint primary key, indent_number text not null unique,
 status text not null, source_pr_id bigint, indent_date date not null,
 approved_date date, updated_at timestamptz not null default now(),
 updated_by uuid
);
create table public.proc_indent_line (
 indent_line_id bigint primary key, indent_id bigint not null references public.proc_indent_header,
 material_class_id bigint not null,stock_item_id bigint not null,uom_id bigint not null,
 requested_qty numeric not null,manual_reason text, updated_at timestamptz not null default now()
);
create table public.proc_pr_to_indent_map (
 indent_id bigint not null references public.proc_indent_header,
 pr_id bigint not null,is_active boolean not null
);
create table public.proc_indent_line_sourcing_decision (
 indent_line_id bigint references public.proc_indent_line,
 selected_vendor_id bigint,recommended_vendor_id bigint
);
create table public.pec_fixture_audit (
 event_type text,entity_type text,entity_id bigint,reason text,before_state jsonb,after_state jsonb
);
create or replace function public.proc_lifecycle_audit_write_internal(
 p_event_type text,p_entity_type text,p_entity_id bigint,
 p_parent_entity_type text default null,p_parent_entity_id bigint default null,
 p_reason text default null,p_before_state jsonb default null,
 p_after_state jsonb default null,p_context jsonb default '{}'::jsonb
) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.pec_fixture_audit(event_type,entity_type,entity_id,reason,before_state,after_state)
 values (p_event_type,p_entity_type,p_entity_id,p_reason,p_before_state,p_after_state);
 return 1;
end $$;
create or replace function public.pec_fixture_indent_audit_trg()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.pec_fixture_audit(event_type,entity_type,entity_id,reason,before_state,after_state)
 values ('INDENT_UPDATED','indent',new.indent_id,null,to_jsonb(old),to_jsonb(new));
 return new;
end $$;
create or replace function public.pec_fixture_line_audit_trg()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.pec_fixture_audit(event_type,entity_type,entity_id,reason,before_state,after_state)
 values ('INDENT_LINE_CHANGED','indent_line',new.indent_line_id,new.manual_reason,to_jsonb(old),to_jsonb(new));
 return new;
end $$;
create trigger t_header after update on public.proc_indent_header
 for each row execute function public.pec_fixture_indent_audit_trg();
create trigger t_line after update on public.proc_indent_line
 for each row execute function public.pec_fixture_line_audit_trg();
insert into public.proc_indent_header(indent_id,indent_number,status,indent_date,source_pr_id,updated_at)
values
 (1,'233','draft','2026-11-11',null,'2026-11-11 12:00:00+00'),
 (2,'234','approved','2026-11-11',null,'2026-11-11 12:00:00+00'),
 (3,'235','draft','2026-11-11',42,'2026-11-11 12:00:00+00'),
 (4,'236','draft','2026-11-11',null,'2026-11-11 12:00:00+00'),
 (5,'IND/2026-11/RM/001','draft','2026-11-11',null,'2026-11-11 12:00:00+00'),
 (6,'237','draft','2026-11-11',null,'2026-11-11 12:00:00+00');
insert into public.proc_indent_line(indent_line_id,indent_id,material_class_id,stock_item_id,uom_id,requested_qty)
values (11,1,1,101,1,10),(12,2,1,101,1,10),(13,3,1,101,1,10),(14,4,1,101,1,10),(15,5,1,101,1,10),(16,6,1,101,1,10);
insert into public.proc_pr_to_indent_map values (4,77,true);
insert into public.proc_indent_line_sourcing_decision(indent_line_id,selected_vendor_id) values(16,8);
