-- R4: guarded, resumable, per-run detail purge. Apply after R1, R2*, R3. PostgreSQL 17.
-- NOTHING here runs a purge. It installs: reviewed allowlist, catalog inventory, drift/dependency blockers, a resumable
-- one-table-per-call step function, scoped DELETE exception in the terminal-snapshot guard, and append-only receipts.
-- Supersedes S3K (run-87 archive workflow; superseded by owner decision — no archive prerequisite). S3K must never be applied
-- alongside this file (it aborts if costing_retention exists).
-- Hard rules enforced in code: no CASCADE, no TRUNCATE, no trigger disable, no header delete, never a designated run (any
-- designation history), never the displayed/approved pointer run, never a non-terminal run, fail closed on schema drift,
-- on unclassified run-linked relations, on permanent->purgeable FK edges, on unindexed edges without a recorded waiver.
BEGIN;
SET LOCAL lock_timeout='5s';

CREATE TABLE costing_retention.purge_allowlist (
 table_schema text NOT NULL, table_name text NOT NULL, run_column text NOT NULL,
 classification text NOT NULL CHECK (classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE','PERMANENT','SUMMARY_KEEP')),
 note text, reviewed_by text NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 index_waiver_reason text,   -- explicit owner waiver when run/FK column is unindexed on a large relation
 PRIMARY KEY (table_schema,table_name)
);
CREATE TABLE costing_retention.purge_context (   -- transaction-scoped authority written ONLY by purge_run_step
 backend_pid integer NOT NULL, transaction_id xid8 NOT NULL, refresh_run_id bigint NOT NULL, table_name text NOT NULL,
 PRIMARY KEY (backend_pid,transaction_id)
);
CREATE TABLE costing_retention.purge_step_receipt (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, purge_receipt_id uuid NOT NULL,
 refresh_run_id bigint NOT NULL REFERENCES costing.costing_refresh_run(id) ON DELETE RESTRICT,
 table_name text NOT NULL, deleted_rows bigint NOT NULL CHECK (deleted_rows>=0), residual_after bigint,
 executed_by text NOT NULL DEFAULT session_user, transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 executed_at timestamptz NOT NULL DEFAULT clock_timestamp(), kind text NOT NULL CHECK (kind IN ('STEP','FINAL'))
);
CREATE TRIGGER purge_step_receipt_append_only BEFORE UPDATE OR DELETE ON costing_retention.purge_step_receipt
 FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_reject_evidence_mutation();
CREATE TRIGGER purge_step_receipt_no_truncate BEFORE TRUNCATE ON costing_retention.purge_step_receipt
 FOR EACH STATEMENT EXECUTE FUNCTION costing_retention.fn_reject_evidence_mutation();
REVOKE ALL ON ALL TABLES IN SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE costing_retention.purge_allowlist ENABLE ROW LEVEL SECURITY;

-- Catalog inventory of every relation directly linked to a run header by a single-column FK (+ multi-column = drift).
CREATE FUNCTION costing_retention.fn_run_linked_inventory()
RETURNS TABLE(table_schema text,table_name text,run_column text,fk_name text,fk_columns int,classification text,
              run_column_indexed boolean,allocated_bytes bigint,has_business_triggers boolean,keyless boolean)
LANGUAGE sql STABLE SET search_path=pg_catalog,costing_retention AS $$
 SELECT n.nspname::text,c.relname::text,coalesce(a.attname::text,'<multi>'),con.conname::text,array_length(con.conkey,1),
   coalesce(al.classification,'UNCLASSIFIED'),
   EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisvalid AND i.indkey[0]=con.conkey[1]),
   pg_total_relation_size(c.oid),
   EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal AND t.tgenabled<>'D'),
   NOT EXISTS(SELECT 1 FROM pg_constraint pk WHERE pk.contype='p' AND pk.conrelid=c.oid)
 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=con.conkey[1] AND array_length(con.conkey,1)=1
 LEFT JOIN costing_retention.purge_allowlist al ON al.table_schema=n.nspname AND al.table_name=c.relname
 WHERE con.contype='f' AND con.confrelid='costing.costing_refresh_run'::regclass $$;

-- Drift / dependency findings that are independent of any particular run (empty set = structurally safe).
CREATE FUNCTION costing_retention.fn_purge_structural_blockers()
RETURNS TABLE(blocker text,detail text)
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,costing_retention AS $$
BEGIN
 RETURN QUERY SELECT 'UNCLASSIFIED_RUN_LINKED_RELATION',i.table_schema||'.'||i.table_name FROM costing_retention.fn_run_linked_inventory() i WHERE i.classification='UNCLASSIFIED';
 RETURN QUERY SELECT 'MULTI_COLUMN_RUN_FK',i.table_schema||'.'||i.table_name FROM costing_retention.fn_run_linked_inventory() i WHERE i.fk_columns<>1;
 RETURN QUERY SELECT 'ALLOWLIST_RUN_COLUMN_MISMATCH',al.table_schema||'.'||al.table_name FROM costing_retention.purge_allowlist al
   JOIN costing_retention.fn_run_linked_inventory() i ON i.table_schema=al.table_schema AND i.table_name=al.table_name AND i.run_column IS DISTINCT FROM al.run_column;
 RETURN QUERY SELECT 'ALLOWLIST_RELATION_MISSING',al.table_schema||'.'||al.table_name FROM costing_retention.purge_allowlist al
   WHERE al.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE') AND NOT EXISTS (SELECT 1 FROM costing_retention.fn_run_linked_inventory() i WHERE i.table_schema=al.table_schema AND i.table_name=al.table_name);
 -- every FK that references a purgeable relation must come from another purgeable relation of the same closure
 RETURN QUERY SELECT 'NON_PURGEABLE_REFERENCES_PURGEABLE',cn.nspname||'.'||cc.relname||' -> '||pn.nspname||'.'||pc.relname
   FROM pg_constraint k JOIN pg_class cc ON cc.oid=k.conrelid JOIN pg_namespace cn ON cn.oid=cc.relnamespace
   JOIN pg_class pc ON pc.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
   JOIN costing_retention.purge_allowlist pal ON pal.table_schema=pn.nspname AND pal.table_name=pc.relname AND pal.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE')
   LEFT JOIN costing_retention.purge_allowlist cal ON cal.table_schema=cn.nspname AND cal.table_name=cc.relname
   WHERE k.contype='f' AND (cal.table_name IS NULL OR cal.classification NOT IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE'));
 RETURN QUERY SELECT 'SELF_REFERENCING_PURGEABLE_FK',cn.nspname||'.'||cc.relname FROM pg_constraint k JOIN pg_class cc ON cc.oid=k.conrelid
   JOIN pg_namespace cn ON cn.oid=cc.relnamespace JOIN costing_retention.purge_allowlist pal ON pal.table_schema=cn.nspname AND pal.table_name=cc.relname
   AND pal.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE') WHERE k.contype='f' AND k.conrelid=k.confrelid;
 -- non-cascading only
 RETURN QUERY SELECT 'CASCADING_FK_ON_PURGEABLE',cn.nspname||'.'||cc.relname||'.'||k.conname FROM pg_constraint k JOIN pg_class cc ON cc.oid=k.conrelid
   JOIN pg_namespace cn ON cn.oid=cc.relnamespace JOIN pg_class pc ON pc.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
   JOIN costing_retention.purge_allowlist pal ON pal.table_schema=pn.nspname AND pal.table_name=pc.relname AND pal.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE')
   WHERE k.contype='f' AND k.confdeltype IN ('c','n','d');
 -- unindexed run column or unindexed child FK edge without an explicit waiver
 RETURN QUERY SELECT 'UNINDEXED_RUN_COLUMN_NO_WAIVER',i.table_schema||'.'||i.table_name FROM costing_retention.fn_run_linked_inventory() i
   JOIN costing_retention.purge_allowlist al ON al.table_schema=i.table_schema AND al.table_name=i.table_name
   WHERE al.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE') AND NOT i.run_column_indexed AND al.index_waiver_reason IS NULL AND i.allocated_bytes>8*1024*1024;
 RETURN QUERY SELECT 'UNINDEXED_CHILD_FK_NO_WAIVER',cn.nspname||'.'||cc.relname||'.'||k.conname FROM pg_constraint k JOIN pg_class cc ON cc.oid=k.conrelid
   JOIN pg_namespace cn ON cn.oid=cc.relnamespace JOIN pg_class pc ON pc.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
   JOIN costing_retention.purge_allowlist pal ON pal.table_schema=pn.nspname AND pal.table_name=pc.relname AND pal.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE')
   JOIN costing_retention.purge_allowlist cal ON cal.table_schema=cn.nspname AND cal.table_name=cc.relname
   WHERE k.contype='f' AND k.confrelid<>'costing.costing_refresh_run'::regclass
     AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=cc.oid AND i.indisvalid AND i.indkey[0]=k.conkey[1])
     AND cal.index_waiver_reason IS NULL AND pg_total_relation_size(cc.oid)>8*1024*1024;
 -- legacy acceptance->snapshot FKs (R2C) must be gone
 RETURN QUERY SELECT 'R2C_NOT_APPLIED',cn.nspname||'.'||cc.relname||'.'||k.conname FROM pg_constraint k JOIN pg_class cc ON cc.oid=k.conrelid
   JOIN pg_namespace cn ON cn.oid=cc.relnamespace JOIN pg_class pc ON pc.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
   JOIN costing_retention.purge_allowlist pal ON pal.table_schema=pn.nspname AND pal.table_name=pc.relname AND pal.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE')
   WHERE k.contype='f' AND cc.relname IN ('regional_marketing_evidence_acceptance','sales_allocation_quantity_driver_acceptance');
END $$;

-- Child-first order over purgeable relations (Kahn, in memory; no temp tables so it is callable repeatedly in one txn). Raises on cycle.
CREATE FUNCTION costing_retention.fn_purge_order()
RETURNS TABLE(ord int,table_schema text,table_name text,run_column text)
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,costing_retention AS $$
DECLARE remaining text[]; pick text[]; k text; n int:=0;
BEGIN
 SELECT array_agg(al.table_schema||'.'||al.table_name) INTO remaining FROM costing_retention.purge_allowlist al
  WHERE al.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE');
 IF remaining IS NULL THEN RETURN; END IF;
 WHILE cardinality(remaining)>0 LOOP
  -- a relation is deletable now if no still-remaining purgeable relation references it
  pick:=ARRAY(SELECT r FROM unnest(remaining) r WHERE NOT EXISTS (
     SELECT 1 FROM pg_constraint c JOIN pg_class cc ON cc.oid=c.conrelid JOIN pg_namespace cn ON cn.oid=cc.relnamespace
     JOIN pg_class pc ON pc.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
     WHERE c.contype='f' AND c.conrelid<>c.confrelid AND pn.nspname||'.'||pc.relname=r AND (cn.nspname||'.'||cc.relname)=ANY(remaining)) ORDER BY r);
  IF cardinality(pick)=0 THEN RAISE EXCEPTION 'PURGE_ORDER_CYCLE among purgeable relations'; END IF;
  FOREACH k IN ARRAY pick LOOP
   n:=n+1;
   RETURN QUERY SELECT n,al.table_schema,al.table_name,al.run_column FROM costing_retention.purge_allowlist al WHERE al.table_schema||'.'||al.table_name=k;
  END LOOP;
  remaining:=ARRAY(SELECT r FROM unnest(remaining) r WHERE NOT r=ANY(pick));
 END LOOP;
END $$;

-- Authority check used by the terminal-snapshot guard (DELETE only, exact run + table, same backend + transaction).
CREATE FUNCTION costing_retention.is_authorized_purge_delete(p_run bigint,p_table text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing_retention AS $$
 SELECT EXISTS(SELECT 1 FROM costing_retention.purge_context x WHERE x.backend_pid=pg_backend_pid()
   AND x.transaction_id=pg_current_xact_id() AND x.refresh_run_id=p_run AND x.table_name=p_table) $$;
REVOKE ALL ON FUNCTION costing_retention.is_authorized_purge_delete(bigint,text) FROM PUBLIC,anon,authenticated,service_role;

-- Retention clock (Asia/Kolkata calendar). A private fixed-date table may exist ONLY in isolated test databases.
CREATE FUNCTION costing_retention.fn_today_ist() RETURNS date LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE d date;
BEGIN
 IF to_regclass('costing_retention.test_clock') IS NOT NULL THEN EXECUTE 'SELECT fixed_today FROM costing_retention.test_clock' INTO d; END IF;
 RETURN coalesce(d,(now() AT TIME ZONE 'Asia/Kolkata')::date);
END $$;
-- Per-run blockers (empty = this run may be purged now).
CREATE FUNCTION costing_retention.fn_purge_run_blockers(p_run bigint)
RETURNS TABLE(blocker text,detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE l costing.costing_run_retention_ledger; r costing.costing_refresh_run; v_disp bigint; v_appr bigint; k record; x boolean;
BEGIN
 SELECT * INTO l FROM costing.costing_run_retention_ledger WHERE refresh_run_id=p_run;
 SELECT * INTO r FROM costing.costing_refresh_run WHERE id=p_run;
 IF l.refresh_run_id IS NULL OR r.id IS NULL THEN RETURN QUERY SELECT 'RUN_NOT_FOUND',p_run::text; RETURN; END IF;
 IF l.detail_state='DETAILS_PURGED' THEN RETURN QUERY SELECT 'ALREADY_PURGED',p_run::text; END IF;
 IF r.overall_status IN ('QUEUED','RUNNING') THEN RETURN QUERY SELECT 'RUN_NOT_TERMINAL',r.overall_status; END IF;
 IF EXISTS(SELECT 1 FROM costing.costing_run_designation d WHERE d.refresh_run_id=p_run)
  THEN RETURN QUERY SELECT 'DESIGNATION_HISTORY','designated runs are never purged by this package'; END IF;
 SELECT s.displayed_run_id,s.approved_run_id INTO v_disp,v_appr FROM costing.v_costing_period_run_status s WHERE s.period_start=r.period_start;
 IF v_appr=p_run THEN RETURN QUERY SELECT 'APPROVED_POINTER',p_run::text; END IF;
 -- the displayed (non-approved) run of a month inside the maximum retention window (current + previous 3 months) is protected;
 -- outside the window an unapproved displayed draft may go, leaving an explicit "no current run" for that old month (R3).
 IF v_disp=p_run AND r.period_start >= (date_trunc('month',costing_retention.fn_today_ist())-interval '3 months')::date
  THEN RETURN QUERY SELECT 'DISPLAYED_RUN_IN_RETENTION_WINDOW',p_run::text; END IF;
 IF EXISTS(SELECT 1 FROM costing.costing_refresh_run x WHERE x.period_start=r.period_start AND x.overall_status IN ('QUEUED','RUNNING'))
  THEN RETURN QUERY SELECT 'ACTIVE_RUN_IN_PERIOD',r.period_start::text; END IF;
 IF EXISTS(SELECT 1 FROM costing.costing_period_refresh_authorization a WHERE a.consumed_by_run_id=p_run)
  THEN RETURN QUERY SELECT 'CONSUMED_REFRESH_AUTHORISATION',p_run::text; END IF;
 IF r.period_start >= date_trunc('month',costing_retention.fn_today_ist())::date
  THEN RETURN QUERY SELECT 'CURRENT_OR_FUTURE_MONTH_PROTECTED',r.period_start::text; END IF;
 -- cross-run dependency: a row of ANOTHER run (or no run) referencing a row of this run in the purgeable closure
 FOR k IN SELECT con.conname,cn.nspname cs,cc.relname ct,ca.attname ccol,pn.nspname ps,pc.relname pt,pa.attname pcol,
            cal.run_column crun,pal.run_column prun,array_length(con.conkey,1) nc
   FROM pg_constraint con JOIN pg_class cc ON cc.oid=con.conrelid JOIN pg_namespace cn ON cn.oid=cc.relnamespace
   JOIN pg_class pc ON pc.oid=con.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
   JOIN costing_retention.purge_allowlist pal ON pal.table_schema=pn.nspname AND pal.table_name=pc.relname AND pal.classification IN ('SNAPSHOT_PURGEABLE','CACHE_PURGEABLE')
   JOIN costing_retention.purge_allowlist cal ON cal.table_schema=cn.nspname AND cal.table_name=cc.relname
   LEFT JOIN pg_attribute ca ON ca.attrelid=cc.oid AND ca.attnum=con.conkey[1]
   LEFT JOIN pg_attribute pa ON pa.attrelid=pc.oid AND pa.attnum=con.confkey[1]
   WHERE con.contype='f' AND con.confrelid<>'costing.costing_refresh_run'::regclass LOOP
  IF k.nc<>1 THEN RETURN QUERY SELECT 'MULTI_COLUMN_NESTED_FK',k.conname::text; CONTINUE; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I c JOIN %I.%I p ON p.%I=c.%I WHERE p.%I=$1 AND c.%I IS DISTINCT FROM $1)',
    k.cs,k.ct,k.ps,k.pt,k.pcol,k.ccol,k.prun,k.crun) INTO x USING p_run;
  IF x THEN RETURN QUERY SELECT 'CROSS_RUN_REFERENCE',k.cs||'.'||k.ct||'.'||k.conname; END IF;
 END LOOP;
 RETURN QUERY SELECT * FROM costing_retention.fn_purge_structural_blockers();
END $$;

-- Dry run: exact run-scoped row counts only for indexed run columns; unindexed relations report NULL (no unbounded scan).
CREATE FUNCTION costing_retention.fn_purge_run_preview(p_run bigint)
RETURNS TABLE(ord int,table_name text,run_column_indexed boolean,rows_for_run bigint,allocated_bytes bigint,est_run_bytes bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE o record; n bigint; ix boolean; sz bigint; tot bigint;
BEGIN
 FOR o IN SELECT * FROM costing_retention.fn_purge_order() LOOP
  SELECT i.run_column_indexed,i.allocated_bytes INTO ix,sz FROM costing_retention.fn_run_linked_inventory() i WHERE i.table_schema=o.table_schema AND i.table_name=o.table_name;
  n:=NULL; IF ix THEN EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I=$1',o.table_schema,o.table_name,o.run_column) INTO n USING p_run; END IF;
  SELECT greatest(c.reltuples,1)::bigint INTO tot FROM pg_class c WHERE c.oid=(quote_ident(o.table_schema)||'.'||quote_ident(o.table_name))::regclass;
  RETURN QUERY SELECT o.ord,o.table_name::text,ix,n,sz,CASE WHEN n IS NULL THEN NULL ELSE (sz::numeric*n/tot)::bigint END;
 END LOOP;
END $$;

-- Terminal guard: preserve the reviewed body, add ONLY a DELETE exception for an authorised purge context.
DO $$ DECLARE v_oid oid; v_def text; v_anchor text; v_n int; pin text:=coalesce(nullif(current_setting('costing_retention.terminal_guard_md5',true),''),'2fc573625296de9ccde5d722fdd4a3de');
BEGIN
 SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_enforce_mutable_refresh_run_snapshot';
 IF v_oid IS NULL THEN RAISE EXCEPTION 'R4: terminal snapshot guard not found'; END IF;
 v_def:=pg_get_functiondef(v_oid);
 IF position('is_authorized_purge_delete' IN v_def)>0 THEN RETURN; END IF;
 IF md5(v_def)<>pin THEN RAISE EXCEPTION 'R4: live terminal guard drifted from reviewed pin; re-review before install'; END IF;
 v_anchor:=$a$    if v_status not in (
        'QUEUED',
        'RUNNING',
        'FAILED'
    ) then
        raise exception$a$;
 v_n:=(length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor);
 IF v_n<>1 THEN RAISE EXCEPTION 'R4: guard anchor count %',v_n; END IF;
 v_def:=replace(v_def,v_anchor,$r$    if v_status not in ('QUEUED','RUNNING','FAILED')
       and not (tg_op='DELETE' and tg_table_schema='costing' and costing_retention.is_authorized_purge_delete(v_run_id_x,tg_table_name)) then
        raise exception$r$);
 v_def:=replace(v_def,'v_run_id_x','v_refresh_run_id');
 v_def:=replace(v_def,'SET search_path TO ''costing'', ''public'', ''pg_temp''','SET search_path TO ''costing'', ''costing_retention'', ''public'', ''pg_temp''');
 EXECUTE v_def;
END $$;

-- Resumable step: deletes up to p_max_rows from the next non-empty purgeable relation (child-first) for ONE run.
-- Each call is one transaction. Final call (all relations empty) verifies zero residual and seals DETAILS_PURGED.
CREATE FUNCTION costing_retention.purge_run_step(p_run bigint,p_max_rows integer DEFAULT 50000) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE r costing.costing_refresh_run; l costing.costing_run_retention_ledger; o record; v_n bigint; v_del bigint; b record; v_rcpt uuid;
        v_removed jsonb; v_digest text; v_total bigint:=0;
BEGIN
 IF p_max_rows IS NULL OR p_max_rows<1 OR p_max_rows>500000 THEN RAISE EXCEPTION 'PURGE_BAD_BATCH'; END IF;
 SELECT * INTO r FROM costing.costing_refresh_run WHERE id=p_run;
 IF NOT FOUND THEN RAISE EXCEPTION 'PURGE_RUN_NOT_FOUND %',p_run; END IF;
 -- serialise with approval / lock / supersession of the same period (same key as public.rpc_costing_approve_run) and other purges
 PERFORM pg_advisory_xact_lock(hashtextextended('cost-period-governance:'||r.period_start::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('costing-retention-purge:'||p_run::text,0));
 SELECT * INTO l FROM costing.costing_run_retention_ledger WHERE refresh_run_id=p_run FOR UPDATE;
 FOR b IN SELECT * FROM costing_retention.fn_purge_run_blockers(p_run) WHERE NOT (blocker='ALREADY_PURGED') LOOP
  -- a run already PURGE_IN_PROGRESS keeps being blocked only by hard blockers; none of them is state-based
  RAISE EXCEPTION 'PURGE_BLOCKED run %: % (%)',p_run,b.blocker,b.detail USING errcode='P0001';
 END LOOP;
 IF l.detail_state='DETAILS_PURGED' THEN RETURN jsonb_build_object('run',p_run,'done',true,'already_purged',true); END IF;
 IF l.detail_state NOT IN ('PURGE_IN_PROGRESS','DETAILS_UNVERIFIED','DETAILS_AVAILABLE','DETAILS_INCOMPLETE') THEN RAISE EXCEPTION 'PURGE_BAD_STATE %',l.detail_state; END IF;
 IF l.detail_state<>'PURGE_IN_PROGRESS' THEN UPDATE costing.costing_run_retention_ledger SET detail_state='PURGE_IN_PROGRESS',retention_decision='ELIGIBLE',last_blocker=NULL WHERE refresh_run_id=p_run; END IF;
 v_rcpt:=coalesce((SELECT s.purge_receipt_id FROM costing_retention.purge_step_receipt s WHERE s.refresh_run_id=p_run ORDER BY s.id LIMIT 1),gen_random_uuid());
 FOR o IN SELECT * FROM costing_retention.fn_purge_order() LOOP
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %I.%I WHERE %I=$1 LIMIT 1) q',o.table_schema,o.table_name,o.run_column) INTO v_n USING p_run;
  CONTINUE WHEN v_n=0;
  INSERT INTO costing_retention.purge_context(backend_pid,transaction_id,refresh_run_id,table_name)
   VALUES(pg_backend_pid(),pg_current_xact_id(),p_run,o.table_name);
  EXECUTE format('WITH d AS (DELETE FROM %I.%I WHERE ctid = ANY(ARRAY(SELECT ctid FROM %I.%I WHERE %I=$1 LIMIT $2 FOR UPDATE)) AND %I=$1 RETURNING 1) SELECT count(*) FROM d',
    o.table_schema,o.table_name,o.table_schema,o.table_name,o.run_column,o.run_column) INTO v_del USING p_run,p_max_rows;
  DELETE FROM costing_retention.purge_context WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id();
  IF v_del=0 THEN   -- a guard (possibly a silent-skip BEFORE trigger) prevented deletion although rows exist: fail closed
   RAISE EXCEPTION 'PURGE_NO_PROGRESS: % rows exist for run % in %.% but none could be deleted',v_n,p_run,o.table_schema,o.table_name; END IF;
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %I.%I WHERE %I=$1 LIMIT 1) q',o.table_schema,o.table_name,o.run_column) INTO v_n USING p_run;
  INSERT INTO costing_retention.purge_step_receipt(purge_receipt_id,refresh_run_id,table_name,deleted_rows,residual_after,kind)
   VALUES(v_rcpt,p_run,o.table_name,v_del,v_n,'STEP');
  RETURN jsonb_build_object('run',p_run,'done',false,'table',o.table_name,'deleted',v_del,'table_has_more',v_n>0,'receipt',v_rcpt);
 END LOOP;
 -- nothing left anywhere: independent verification, then seal.
 FOR o IN SELECT * FROM costing_retention.fn_purge_order() LOOP
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %I.%I WHERE %I=$1 LIMIT 1) q',o.table_schema,o.table_name,o.run_column) INTO v_n USING p_run;
  IF v_n<>0 THEN RAISE EXCEPTION 'PURGE_RESIDUAL % in %',v_n,o.table_name; END IF;
 END LOOP;
 SELECT coalesce(jsonb_object_agg(t,s),'{}'::jsonb),coalesce(sum(s),0) INTO v_removed,v_total
  FROM (SELECT table_name t,sum(deleted_rows) s FROM costing_retention.purge_step_receipt WHERE refresh_run_id=p_run AND kind='STEP' GROUP BY table_name) q;
 v_digest:=encode(sha256(convert_to(p_run::text||'|'||v_removed::text||'|zero-residual',  'UTF8')),'hex');
 INSERT INTO costing_retention.purge_step_receipt(purge_receipt_id,refresh_run_id,table_name,deleted_rows,residual_after,kind)
  VALUES(v_rcpt,p_run,'*',v_total,0,'FINAL');
 UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_PURGED',details_purged_at=clock_timestamp(),purge_receipt_id=v_rcpt,
   removed_row_counts=v_removed,verification_digest=v_digest,retention_reason='Verified zero residual detail; governance and run identity preserved' WHERE refresh_run_id=p_run;
 RETURN jsonb_build_object('run',p_run,'done',true,'total_deleted',v_total,'removed',v_removed,'receipt',v_rcpt,'verification_digest',v_digest);
END $$;
REVOKE ALL ON FUNCTION costing_retention.fn_today_ist(),costing_retention.fn_run_linked_inventory(),costing_retention.fn_purge_structural_blockers(),costing_retention.fn_purge_order(),
 costing_retention.fn_purge_run_blockers(bigint),costing_retention.fn_purge_run_preview(bigint),costing_retention.purge_run_step(bigint,integer)
 FROM PUBLIC,anon,authenticated,service_role;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sasv_retention_executor') THEN
  GRANT USAGE ON SCHEMA costing_retention TO sasv_retention_executor;
  GRANT EXECUTE ON FUNCTION costing_retention.fn_purge_run_blockers(bigint),costing_retention.fn_purge_run_preview(bigint),costing_retention.purge_run_step(bigint,integer) TO sasv_retention_executor;
 END IF;
END $$;
COMMIT;
