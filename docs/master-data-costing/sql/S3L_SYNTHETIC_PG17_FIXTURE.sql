-- S3L isolated synthetic PostgreSQL 17 fixture. NEVER connect to SASV production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE sasv_retention_executor LOGIN NOINHERIT PASSWORD 'fixture_only';
CREATE SCHEMA costing;
CREATE TABLE costing.costing_refresh_run(id bigint PRIMARY KEY,period_start date NOT NULL,overall_status text NOT NULL);
CREATE TABLE costing.costing_run_designation(refresh_run_id bigint REFERENCES costing.costing_refresh_run(id),designation text NOT NULL);
CREATE TABLE costing.material_review_acceptance_register(source_refresh_run_id bigint);
CREATE TABLE costing.regional_marketing_evidence_acceptance(source_refresh_run_id bigint);
CREATE TABLE costing.sales_allocation_quantity_driver_acceptance(source_refresh_run_id bigint);
CREATE TABLE costing.cost_driver_policy_cutover_acceptance(accepted_refresh_run_id bigint);
CREATE TABLE costing.manufacturing_cost_behaviour_split(reference_refresh_run_id bigint);
CREATE TABLE costing.costing_period_refresh_authorization(consumed_by_run_id bigint);
CREATE VIEW costing.v_costing_run_effective_designation AS SELECT refresh_run_id,designation FROM costing.costing_run_designation;
CREATE VIEW costing.v_costing_period_run_status AS SELECT * FROM (VALUES
 (DATE '2026-09-01',122::bigint,122::bigint),
 (DATE '2026-10-01',143::bigint,143::bigint),
 (DATE '2026-11-01',153::bigint,NULL::bigint)
) AS x(period_start,displayed_run_id,approved_run_id);
INSERT INTO costing.costing_refresh_run VALUES
(87,'2026-09-01','SUCCESS'),(122,'2026-09-01','SUCCESS'),(128,'2026-10-01','SUCCESS'),(143,'2026-10-01','SUCCESS'),(148,'2026-10-01','SUCCESS'),(152,'2026-11-01','SUCCESS'),(153,'2026-11-01','SUCCESS');
INSERT INTO costing.costing_run_designation VALUES(122,'APPROVED'),(128,'REVOKED'),(143,'APPROVED');
CREATE TABLE costing.marketing_signed_billed_sales_evidence_snapshot(id bigint PRIMARY KEY,refresh_run_id bigint REFERENCES costing.costing_refresh_run(id),marker text NOT NULL);
CREATE TABLE costing.marketing_regional_sales_evidence_snapshot(id bigint PRIMARY KEY,refresh_run_id bigint REFERENCES costing.costing_refresh_run(id),marker text NOT NULL);
INSERT INTO costing.marketing_signed_billed_sales_evidence_snapshot SELECT s,87,'synthetic-'||s FROM generate_series(1,1100) s;
INSERT INTO costing.marketing_regional_sales_evidence_snapshot SELECT s,87,'synthetic-'||s FROM generate_series(1,1100) s;
INSERT INTO costing.marketing_signed_billed_sales_evidence_snapshot VALUES (3001,122,'approved'),(3002,153,'november');
INSERT INTO costing.marketing_regional_sales_evidence_snapshot VALUES (3001,122,'approved'),(3002,153,'november');
CREATE OR REPLACE FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
    v_refresh_run_id bigint;
    v_status text;
begin
    if tg_op = 'DELETE' then
        v_refresh_run_id := old.refresh_run_id;
    else
        v_refresh_run_id := new.refresh_run_id;
    end if;

    if v_refresh_run_id is null then
        return case
            when tg_op = 'DELETE' then old
            else new
        end;
    end if;

    select r.overall_status
    into v_status
    from costing.costing_refresh_run r
    where r.id = v_refresh_run_id;

    if not found then
        raise exception
            'Refresh run % does not exist.',
            v_refresh_run_id;
    end if;

    if v_status not in (
        'QUEUED',
        'RUNNING',
        'FAILED'
    ) then
        raise exception
            'Snapshot mutation is prohibited for terminal refresh run % with status %.',
            v_refresh_run_id,
            v_status;
    end if;

    return case
        when tg_op = 'DELETE' then old
        else new
    end;
end;
$function$;

CREATE OR REPLACE FUNCTION costing.fn_guard_designated_run_rows()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_run bigint; v_des text;
begin
  v_run := case when tg_op='DELETE' then old.refresh_run_id else new.refresh_run_id end;
  if tg_op='UPDATE' and old.refresh_run_id is distinct from new.refresh_run_id then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=old.refresh_run_id;
    if v_des in ('REFERENCE','APPROVED','REVOKED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', old.refresh_run_id, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  if v_run is not null then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=v_run;
    if v_des in ('REFERENCE','APPROVED','REVOKED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', v_run, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $function$;

REVOKE ALL ON FUNCTION costing.fn_guard_designated_run_rows() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_signed_designated BEFORE INSERT OR DELETE OR UPDATE ON costing.marketing_signed_billed_sales_evidence_snapshot FOR EACH ROW EXECUTE FUNCTION costing.fn_guard_designated_run_rows();
CREATE TRIGGER trg_signed_terminal BEFORE INSERT OR DELETE OR UPDATE ON costing.marketing_signed_billed_sales_evidence_snapshot FOR EACH ROW EXECUTE FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot();
CREATE TRIGGER trg_regional_designated BEFORE INSERT OR DELETE OR UPDATE ON costing.marketing_regional_sales_evidence_snapshot FOR EACH ROW EXECUTE FUNCTION costing.fn_guard_designated_run_rows();
CREATE TRIGGER trg_regional_terminal BEFORE INSERT OR DELETE OR UPDATE ON costing.marketing_regional_sales_evidence_snapshot FOR EACH ROW EXECUTE FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot();
SELECT p.proname,md5(pg_get_functiondef(p.oid)) AS stage_guard_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname IN ('fn_guard_designated_run_rows','fn_enforce_mutable_refresh_run_snapshot') ORDER BY p.proname;
