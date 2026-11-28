-- Typed stand-ins for upstream relations. Finance and alert definitions below
-- are the installed baseline as of the 28 November 2026 production preflight.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema app_private;
create schema costing;
create schema extensions;
create extension btree_gist with schema extensions;
grant usage on schema auth,app_private to authenticated,service_role,anon;
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims',true),'')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$
  select (auth.jwt()->>'sub')::uuid;
$$;
create table public.permission_targets (key text primary key,kind text,label text,is_assignable boolean,meta jsonb);
create table public.user_permissions_canonical (
  user_id uuid,target text,can_view boolean,can_edit boolean,primary key(user_id,target));
create table public.regions (id integer primary key,code text unique,name text);
create table public.godowns (id integer primary key,code text,region_id integer references public.regions,name text);
create table costing.scheme_master (id bigint primary key,scheme_name text,is_active boolean);
create table public.tally_group_outstanding_snapshot (
  id bigint primary key,as_of_date date,group_name text,bill_date_text text,bill_ref text,vendor_name text,
  opening_amount_value numeric,outstanding_amount_value numeric,source_key text,inserted_at timestamptz);
create table public.mv_mis_executive_summary (financial_position_date date);
create table public.v_mis_inventory_tab_summary (report_date date,valuation_gap_item_count bigint,
  unclassified_item_count bigint,duplicate_item_row_count bigint,missing_item_id_count bigint);
create table public.v_mis_batch_pipeline (overdue_work_in_process_batch_count bigint);
create table public.v_fg_transfer_reconciliation (transfer_date date,recon_status text);
grant select on public.regions,public.godowns,public.permission_targets,public.tally_group_outstanding_snapshot,
  public.mv_mis_executive_summary,public.v_mis_inventory_tab_summary,public.v_mis_batch_pipeline,
  public.v_fg_transfer_reconciliation to authenticated,service_role;

insert into public.regions values (1,'IK','Inside Kerala'),(2,'OK','Outside Kerala');
insert into public.godowns values (10,'HO_IK',1,'Kerala HQ'),(20,'HO_OK',2,'Outside HQ');
insert into costing.scheme_master values (1,'No Scheme',true),(2,'Seasonal',true),(3,'Old scheme',false);
insert into public.mv_mis_executive_summary values ('2026-11-28');
insert into public.v_mis_inventory_tab_summary values ('2026-11-28',0,4,1,2);
insert into public.v_mis_batch_pipeline values (4);
insert into public.v_fg_transfer_reconciliation values (current_date,'MISSING_LOG'),(current_date,'MATCH');
insert into public.user_permissions_canonical values
 ('00000000-0000-0000-0000-000000000001','module:executive-mis-dashboard',true,false),
 ('00000000-0000-0000-0000-000000000001','role:ei-debtor-kyc',true,true),
 ('00000000-0000-0000-0000-000000000002','module:executive-mis-dashboard',true,false),
 ('00000000-0000-0000-0000-000000000002','role:ei-debtor-kyc',true,false),
 ('00000000-0000-0000-0000-000000000003','module:executive-mis-dashboard',true,false),
 ('00000000-0000-0000-0000-000000000004','module:executive-mis-dashboard',true,false),
 ('00000000-0000-0000-0000-000000000004','role:ei-debtor-commercial',true,true),
 ('00000000-0000-0000-0000-000000000005','role:ei-debtor-kyc',true,true),
 ('00000000-0000-0000-0000-000000000006','module:executive-mis-dashboard',true,false),
 ('00000000-0000-0000-0000-000000000006','role:ei-debtor-commercial',true,false);
insert into public.tally_group_outstanding_snapshot
  (id,as_of_date,group_name,bill_date_text,bill_ref,vendor_name,outstanding_amount_value,source_key)
values
  (1,'2026-11-28','Sundry Debtors','14-Oct-26','A','Alpha',-100,'a'),
  (2,'2026-11-28','Sundry Debtors','1-Nov-26','B','Alpha',200,'b'),
  (3,'2026-11-28','Sundry Debtors','30-Feb-26','C','Alpha',-5,'c'),
  (4,'2026-11-28','Sundry Debtors','10-Oct-26','D','Bravo',30,'d'),
  (5,'2026-11-28','Sundry Debtors','10-Oct-26','On Account','Draft',-16,'e'),
  (6,'2026-11-28','Sundry Debtors','29-Nov-2026','G','Draft',-2,'g'),
  (7,'2026-11-28','Sundry Creditors','14-Oct-26','H','Alpha',40,'h'),
  (8,'2026-11-28','Sundry Creditors','10-Oct-26','I','Creditor',-10,'i'),
  (9,'2026-11-28','Sundry Creditors','1-Nov-26',null,'Creditor',2,'j'),
  (10,'2026-10-28','Sundry Debtors','14-Oct-26','Z','Historical only',-5,'historical'),
  (11,'2026-11-28','Sundry Debtors','05-Oct-26','K','Unregistered',-1,'k');
-- Simulate a ledger first arriving after migration.
delete from public.tally_group_outstanding_snapshot where id=11;

create schema fixture;
grant usage on schema fixture to authenticated,anon,service_role;
create function fixture.check(p_label text,p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL %',p_label; end if;
  raise notice 'PASS %',p_label;
end;
$$;
create function fixture.denied(p_label text,p_query text,p_sqlstate text default '42501')
returns void language plpgsql as $$
begin
  execute p_query;
  raise exception 'FAIL % (statement unexpectedly succeeded)',p_label;
exception when others then
  if sqlstate<>p_sqlstate then raise; end if;
  raise notice 'PASS %',p_label;
end;
$$;
create function fixture.claim(p_actor integer,p_anonymous boolean default false) returns void language sql as $$
  select set_config('request.jwt.claims',
    case when p_actor is null then '' else jsonb_build_object('sub',
      '00000000-0000-0000-0000-'||lpad(p_actor::text,12,'0'),'is_anonymous',p_anonymous)::text end,false);
$$;

create function public.app_has_permission_core(p_user_id uuid,p_target text,p_mode text default 'view')
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select case p_mode when 'view' then can_view when 'edit' then can_edit end
    from public.user_permissions_canonical where user_id=p_user_id and target=p_target),false);
$$;
create function public.app_has_permission(p_target text,p_mode text default 'view')
returns boolean language sql stable set search_path = pg_catalog, public as $$
  select public.app_has_permission_core(auth.uid(),p_target,p_mode);
$$;

CREATE OR REPLACE FUNCTION public.ei_can_read_executive()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$ SELECT CASE WHEN current_user IN ('postgres','service_role') THEN true ELSE auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false') <> 'true' AND coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) END $function$;

create view public.v_mis_finance_outstanding_detail with (security_barrier=true,security_invoker=true) as
SELECT report_date,
    group_name,
    mis_group_name,
    bill_date_text,
    bill_ref,
    party_name,
    opening_amount_tally_value,
    outstanding_amount_tally_value,
    opening_amount_abs_line_value,
    outstanding_amount_abs_line_value,
    source_key,
    inserted_at
   FROM ( WITH latest_snapshot AS (
                 SELECT max(tally_group_outstanding_snapshot.as_of_date) AS report_date
                   FROM tally_group_outstanding_snapshot
                ), base AS (
                 SELECT t.as_of_date AS report_date,
                    t.group_name,
                        CASE
                            WHEN t.group_name = 'Sundry Creditors'::text THEN 'Payables — Sundry Creditors'::text
                            WHEN t.group_name = 'Sundry Debtors'::text THEN 'Receivables — Sundry Debtors'::text
                            ELSE t.group_name
                        END AS mis_group_name,
                    t.bill_date_text,
                    t.bill_ref,
                    t.vendor_name AS party_name,
                    COALESCE(t.opening_amount_value, 0::numeric) AS opening_amount_tally_value,
                    COALESCE(t.outstanding_amount_value, 0::numeric) AS outstanding_amount_tally_value,
                    abs(COALESCE(t.opening_amount_value, 0::numeric)) AS opening_amount_abs_line_value,
                    abs(COALESCE(t.outstanding_amount_value, 0::numeric)) AS outstanding_amount_abs_line_value,
                    t.source_key,
                    t.inserted_at
                   FROM tally_group_outstanding_snapshot t
                     JOIN latest_snapshot l ON l.report_date = t.as_of_date
                  WHERE t.group_name = ANY (ARRAY['Sundry Creditors'::text, 'Sundry Debtors'::text])
                )
         SELECT base.report_date,
            base.group_name,
            base.mis_group_name,
            base.bill_date_text,
            base.bill_ref,
            base.party_name,
            base.opening_amount_tally_value,
            base.outstanding_amount_tally_value,
            base.opening_amount_abs_line_value,
            base.outstanding_amount_abs_line_value,
            base.source_key,
            base.inserted_at
           FROM base) ei_row
  WHERE ( SELECT ei_can_read_executive() AS ei_can_read_executive);

create view public.v_mis_finance_outstanding_party_summary with (security_barrier=true,security_invoker=true) as
SELECT report_date,
    group_name,
    mis_group_name,
    party_name,
    bill_count,
    signed_outstanding_tally_value,
    outstanding_amount_mis_value,
    absolute_bill_line_total,
    earliest_bill_date_text,
    latest_bill_date_text
   FROM ( SELECT v_mis_finance_outstanding_detail.report_date,
            v_mis_finance_outstanding_detail.group_name,
            v_mis_finance_outstanding_detail.mis_group_name,
            v_mis_finance_outstanding_detail.party_name,
            count(*) AS bill_count,
            sum(v_mis_finance_outstanding_detail.outstanding_amount_tally_value) AS signed_outstanding_tally_value,
            abs(sum(v_mis_finance_outstanding_detail.outstanding_amount_tally_value)) AS outstanding_amount_mis_value,
            sum(v_mis_finance_outstanding_detail.outstanding_amount_abs_line_value) AS absolute_bill_line_total,
            min(v_mis_finance_outstanding_detail.bill_date_text) AS earliest_bill_date_text,
            max(v_mis_finance_outstanding_detail.bill_date_text) AS latest_bill_date_text
           FROM v_mis_finance_outstanding_detail
          GROUP BY v_mis_finance_outstanding_detail.report_date, v_mis_finance_outstanding_detail.group_name, v_mis_finance_outstanding_detail.mis_group_name, v_mis_finance_outstanding_detail.party_name) ei_row
  WHERE ( SELECT ei_can_read_executive() AS ei_can_read_executive);

CREATE OR REPLACE FUNCTION public.get_mis_finance_party_page(p_group_filter text DEFAULT 'payables'::text, p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(report_date date, mis_group_name text, party_name text, bill_count bigint, signed_outstanding_tally_value numeric, outstanding_amount_mis_value numeric, absolute_bill_line_total numeric, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with filtered as (
    select
      report_date,
      mis_group_name,
      party_name,
      bill_count,
      signed_outstanding_tally_value,
      outstanding_amount_mis_value,
      absolute_bill_line_total
    from public.v_mis_finance_outstanding_party_summary
    where
      (
        p_group_filter = 'all'
        or (p_group_filter = 'payables' and mis_group_name = 'Payables — Sundry Creditors')
        or (p_group_filter = 'receivables' and mis_group_name = 'Receivables — Sundry Debtors')
      )
      and (
        coalesce(trim(p_search), '') = ''
        or party_name ilike '%' || trim(p_search) || '%'
        or mis_group_name ilike '%' || trim(p_search) || '%'
      )
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.report_date,
    f.mis_group_name,
    f.party_name,
    f.bill_count,
    f.signed_outstanding_tally_value,
    f.outstanding_amount_mis_value,
    f.absolute_bill_line_total,
    c.total_rows
  from filtered f
  cross join counted c
  where (select public.ei_can_read_executive())
  order by f.outstanding_amount_mis_value desc, f.party_name asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;

CREATE OR REPLACE FUNCTION public.ei_management_alerts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) THEN RAISE EXCEPTION 'Executive access denied' USING ERRCODE='42501'; END IF;
 WITH inventory AS (
 SELECT CASE WHEN count(*)=1 THEN max(report_date) END AS report_date,CASE WHEN count(*)=1 THEN max(valuation_gap_item_count) END AS valuation_gap_item_count,CASE WHEN count(*)=1 THEN max(unclassified_item_count) END AS unclassified_item_count,CASE WHEN count(*)=1 THEN max(duplicate_item_row_count) END AS duplicate_item_row_count,CASE WHEN count(*)=1 THEN max(missing_item_id_count) END AS missing_item_id_count FROM public.v_mis_inventory_tab_summary
 ), pipeline AS (
 SELECT CASE WHEN count(*)=1 THEN max(overdue_work_in_process_batch_count) END AS overdue_work_in_process_batch_count FROM public.v_mis_batch_pipeline
 ), fg AS (
 SELECT count(*) AS observed_groups,count(*) FILTER(WHERE recon_status='MISSING_LOG') AS missing_log_groups,max(transfer_date) AS evidence_date
 FROM public.v_fg_transfer_reconciliation WHERE transfer_date>=date_trunc('month',current_date)::date AND transfer_date<=current_date
 ), alerts AS (
 SELECT v.key,v.label,i.report_date AS evidence_date,v.findings FROM inventory i CROSS JOIN LATERAL (VALUES
 ('inventory.valuation_gap','Inventory valuation gaps',i.valuation_gap_item_count),
 ('inventory.unclassified','Unclassified inventory',i.unclassified_item_count),
 ('inventory.duplicate_identity','Duplicate inventory identities',i.duplicate_item_row_count),
 ('inventory.missing_identity','Missing inventory identities',i.missing_item_id_count)) v(key,label,findings)
 UNION ALL SELECT 'production.overdue_wip','Overdue work in process',current_date,overdue_work_in_process_batch_count FROM pipeline
 UNION ALL SELECT 'fg.missing_log','FG transfer groups missing production log',evidence_date,CASE WHEN observed_groups>0 THEN missing_log_groups END FROM fg
 )
 SELECT jsonb_build_object('catalogue','INVENTORY_WIP_FG_INTEGRITY','coverage','PARTIAL_CATALOGUE','rows',coalesce(jsonb_agg(to_jsonb(alerts)||jsonb_build_object('state',CASE WHEN findings IS NULL THEN 'UNAVAILABLE' WHEN findings>0 THEN 'REVIEW' ELSE 'CLEAR' END,'severity','REVIEW_ONLY') ORDER BY key),'[]'::jsonb)) INTO result FROM alerts;
 RETURN result;
END $function$;

create view public.v_mis_finance_tab_summary with (security_invoker=true) as
select report_date,abs(sum(signed_outstanding_tally_value) filter(where group_name='Sundry Creditors')) as payables_sundry_creditors,
  abs(sum(signed_outstanding_tally_value) filter(where group_name='Sundry Debtors')) as receivables_sundry_debtors
from public.v_mis_finance_outstanding_party_summary group by report_date;
grant select on public.v_mis_finance_outstanding_detail,public.v_mis_finance_outstanding_party_summary,
  public.v_mis_finance_tab_summary to authenticated,service_role;
revoke execute on function public.ei_management_alerts(),public.get_mis_finance_party_page(text,text,integer,integer) from public,anon;
grant execute on function public.ei_management_alerts(),public.get_mis_finance_party_page(text,text,integer,integer) to authenticated,service_role;
