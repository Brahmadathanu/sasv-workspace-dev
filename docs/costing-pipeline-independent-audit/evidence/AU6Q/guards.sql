CREATE OR REPLACE FUNCTION costing.fn_guard_designated_run_rows() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'costing', 'public', 'pg_temp' AS $function$
declare v_run bigint; v_des text;
begin
  v_run := case when tg_op='DELETE' then old.refresh_run_id else new.refresh_run_id end;
  if tg_op='UPDATE' and old.refresh_run_id is distinct from new.refresh_run_id then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=old.refresh_run_id;
    if v_des in ('REFERENCE','APPROVED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', old.refresh_run_id, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  if v_run is not null then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=v_run;
    if v_des in ('REFERENCE','APPROVED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', v_run, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $function$;
CREATE OR REPLACE FUNCTION costing.fn_guard_snapshot_truncate() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'costing', 'public', 'pg_temp' AS $function$
begin
  raise exception 'AU2_SNAPSHOT_TRUNCATE_PROHIBITED: TRUNCATE on costing.% would destroy run history', tg_table_name using errcode='P0001';
end $function$;
CREATE OR REPLACE FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'costing', 'public', 'pg_temp' AS $function$
declare v_refresh_run_id bigint; v_status text;
begin
    if tg_op = 'DELETE' then v_refresh_run_id := old.refresh_run_id; else v_refresh_run_id := new.refresh_run_id; end if;
    if v_refresh_run_id is null then return case when tg_op = 'DELETE' then old else new end; end if;
    select r.overall_status into v_status from costing.costing_refresh_run r where r.id = v_refresh_run_id;
    if not found then raise exception 'Refresh run % does not exist.', v_refresh_run_id; end if;
    if v_status not in ('QUEUED','RUNNING','FAILED') then
        raise exception 'Snapshot mutation is prohibited for terminal refresh run % with status %.', v_refresh_run_id, v_status;
    end if;
    return case when tg_op = 'DELETE' then old else new end;
end; $function$;
CREATE OR REPLACE FUNCTION costing.fn_wp04_readiness_bump_source_epoch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'costing', 'public', 'pg_temp' AS $function$
DECLARE v_relation text := format('%I.%I',TG_TABLE_SCHEMA,TG_TABLE_NAME);
BEGIN
  UPDATE costing.readiness_portfolio_source_epoch SET epoch=epoch+1, touched_at=clock_timestamp() WHERE source_relation=v_relation;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unregistered readiness source relation %',v_relation; END IF;
  RETURN NULL;
END $function$;
CREATE TRIGGER trg_au2_designated_run_guard BEFORE INSERT OR DELETE OR UPDATE ON costing.product_qc_allocation_snapshot FOR EACH ROW EXECUTE FUNCTION costing.fn_guard_designated_run_rows();
CREATE TRIGGER trg_au2_snapshot_truncate_guard BEFORE TRUNCATE ON costing.product_qc_allocation_snapshot FOR EACH STATEMENT EXECUTE FUNCTION costing.fn_guard_snapshot_truncate();
CREATE TRIGGER trg_product_qc_allocation_snapshot_mutable_run BEFORE INSERT OR DELETE OR UPDATE ON costing.product_qc_allocation_snapshot FOR EACH ROW EXECUTE FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot();
CREATE TRIGGER trg_au2_designated_run_guard BEFORE INSERT OR DELETE OR UPDATE ON costing.sku_qc_allocation_snapshot FOR EACH ROW EXECUTE FUNCTION costing.fn_guard_designated_run_rows();
CREATE TRIGGER trg_au2_snapshot_truncate_guard BEFORE TRUNCATE ON costing.sku_qc_allocation_snapshot FOR EACH STATEMENT EXECUTE FUNCTION costing.fn_guard_snapshot_truncate();
CREATE TRIGGER trg_sku_qc_allocation_snapshot_mutable_run BEFORE INSERT OR DELETE OR UPDATE ON costing.sku_qc_allocation_snapshot FOR EACH ROW EXECUTE FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot();
CREATE TRIGGER wp04_readiness_epoch_bd8d5d9c2de5 AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON costing.sku_qc_allocation_snapshot FOR EACH STATEMENT EXECUTE FUNCTION costing.fn_wp04_readiness_bump_source_epoch();
