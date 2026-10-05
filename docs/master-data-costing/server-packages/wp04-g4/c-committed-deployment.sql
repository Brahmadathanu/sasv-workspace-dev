-- WP04-G4 COMMITTED C DEPLOYMENT. DO NOT EXECUTE WITHOUT EXACT EXPLICIT AUTHORIZATION.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
SET LOCAL idle_in_transaction_session_timeout='30s';
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'C unexpected owner'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_effective_product_process_route_steps(bigint)'))) IS DISTINCT FROM '0968054cfb097874f54239c1c2ce3ab5' THEN RAISE EXCEPTION 'C source drift: costing.fn_effective_product_process_route_steps(bigint)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)'))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'C source drift: costing.fn_product_process_route_readiness(date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'C source drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)'))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'C source drift: costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)'))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'C source drift: costing.fn_product_sku_readiness_shared_issues(date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric)'))) IS DISTINCT FROM 'efb984d40c84f26e8c19f1a82200e1ec' THEN RAISE EXCEPTION 'C source drift: costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_regional_marketing_review_status(bigint)'))) IS DISTINCT FROM 'a71c4c83b458d6a715afcb6852f5cb86' THEN RAISE EXCEPTION 'C source drift: costing.fn_regional_marketing_review_status(bigint)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_direct_labour_workload_policy(date)'))) IS DISTINCT FROM 'd48eac98fe033115d5735b37adbfa8d4' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_direct_labour_workload_policy(date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_effective_product_process_route(integer,date)'))) IS DISTINCT FROM '3c5a292804748daf679605382e1691fb' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_effective_product_process_route(integer,date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_effective_route_family_route(integer,date)'))) IS DISTINCT FROM '39f8f62fc99b856ee2e8be443e735be7' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_effective_route_family_route(integer,date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_marketing_allocation_policy(date)'))) IS DISTINCT FROM '989aa9b16d7381cd035390b78a1c7e95' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_marketing_allocation_policy(date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_materials_stores_workload_policy(date)'))) IS DISTINCT FROM 'f1f989960e838141786db38b018eb51c' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_materials_stores_workload_policy(date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_production_overhead_workload_policy(date)'))) IS DISTINCT FROM '2b0773e1e686a5a6a4eacfe3c14da56d' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_production_overhead_workload_policy(date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_qc_workload_policy(date)'))) IS DISTINCT FROM 'a276ecef7b4cd99002fd886abbe63141' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_qc_workload_policy(date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_route_family_for_product(integer,date)'))) IS DISTINCT FROM '641fd0f7eb7438eed53c1c6170deb0ec' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_route_family_for_product(integer,date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sales_allocation_default_policy_as_of(text,date)'))) IS DISTINCT FROM '425596466bb9da9dadfc391f96350566' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_sales_allocation_default_policy_as_of(text,date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)'))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_sales_assumption_as_of(date,bigint,date)'))) IS DISTINCT FROM 'b216b4dfdf3fbe3e7b837ceb3ee550f4' THEN RAISE EXCEPTION 'C source drift: costing.fn_resolve_sku_sales_assumption_as_of(date,bigint,date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_validate_effective_product_process_route(integer,date)'))) IS DISTINCT FROM 'a9396f97a23cba5bbaceada07bc6448a' THEN RAISE EXCEPTION 'C source drift: costing.fn_validate_effective_product_process_route(integer,date)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_validate_product_process_route(bigint)'))) IS DISTINCT FROM 'cc6cef1fac171ce812c9dd6702e4efbc' THEN RAISE EXCEPTION 'C source drift: costing.fn_validate_product_process_route(bigint)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_validate_route_family_route(bigint)'))) IS DISTINCT FROM '09cd3572e36000095b8b1eb1833491c8' THEN RAISE EXCEPTION 'C source drift: costing.fn_validate_route_family_route(bigint)'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' THEN RAISE EXCEPTION 'C source drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'C original ACL drift'; END IF;
 IF (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM 'postgres' THEN RAISE EXCEPTION 'C original owner drift'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'C original ACL drift'; END IF;
 IF (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM 'postgres' THEN RAISE EXCEPTION 'C original owner drift'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'C original ACL drift'; END IF;
 IF (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')) IS DISTINCT FROM 'postgres' THEN RAISE EXCEPTION 'C original owner drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_wp04_c_run_assemble') THEN RAISE EXCEPTION 'C name collision: fn_wp04_c_run_assemble'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_wp04_c_run_cohort') THEN RAISE EXCEPTION 'C name collision: fn_wp04_c_run_cohort'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_wp04_c_enrich') THEN RAISE EXCEPTION 'C name collision: fn_wp04_c_enrich'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_product_sku_readiness_enrich_with_shared') THEN RAISE EXCEPTION 'C name collision: fn_product_sku_readiness_enrich_with_shared'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_wp04_c_live_core') THEN RAISE EXCEPTION 'C name collision: fn_wp04_c_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_product_sku_readiness_live_core') THEN RAISE EXCEPTION 'C name collision: fn_product_sku_readiness_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_get_readiness_governed_periods') THEN RAISE EXCEPTION 'C name collision: rpc_get_readiness_governed_periods'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_get_readiness_product_gaps') THEN RAISE EXCEPTION 'C name collision: rpc_get_readiness_product_gaps'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_get_product_sku_readiness_portfolio') THEN RAISE EXCEPTION 'C name collision: rpc_get_product_sku_readiness_portfolio'; END IF;
 IF md5(pg_get_viewdef(to_regclass('costing.v_cost_driver_policy_registry'),true)) IS DISTINCT FROM '89167868eefda59b7c3d03b63936ac0a' THEN RAISE EXCEPTION 'C view drift'; END IF;
 IF md5(pg_get_viewdef(to_regclass('costing.v_regional_marketing_evidence_review_queue'),true)) IS DISTINCT FROM '8b08018061e8b800f1ea4843acad4b46' THEN RAISE EXCEPTION 'C view drift'; END IF;
 IF md5(pg_get_viewdef(to_regclass('costing.v_sku_commercial_sales_basis'),true)) IS DISTINCT FROM '1327ae5236481295aff6aa27d311f440' THEN RAISE EXCEPTION 'C view drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.uq_admin_finance_run_sku') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX uq_admin_finance_run_sku ON costing.sku_admin_finance_overhead_allocation_snapshot USING btree (refresh_run_id, sku_id) WHERE (refresh_run_id IS NOT NULL)') THEN RAISE EXCEPTION 'C run key drift: sku_admin_finance_overhead_allocation_snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.uq_direct_labour_run_sku') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX uq_direct_labour_run_sku ON costing.sku_direct_labour_allocation_snapshot USING btree (refresh_run_id, sku_id) WHERE (refresh_run_id IS NOT NULL)') THEN RAISE EXCEPTION 'C run key drift: sku_direct_labour_allocation_snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.uq_marketing_run_sku') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX uq_marketing_run_sku ON costing.sku_marketing_expense_allocation_snapshot USING btree (refresh_run_id, sku_id) WHERE (refresh_run_id IS NOT NULL)') THEN RAISE EXCEPTION 'C run key drift: sku_marketing_expense_allocation_snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.sku_materials_stores_allocation_snapshot_run_sku_uq') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX sku_materials_stores_allocation_snapshot_run_sku_uq ON costing.sku_materials_stores_allocation_snapshot USING btree (refresh_run_id, sku_id)') THEN RAISE EXCEPTION 'C run key drift: sku_materials_stores_allocation_snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.sku_production_overhead_allocation_sn_refresh_run_id_sku_id_key') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX sku_production_overhead_allocation_sn_refresh_run_id_sku_id_key ON costing.sku_production_overhead_allocation_snapshot USING btree (refresh_run_id, sku_id)') THEN RAISE EXCEPTION 'C run key drift: sku_production_overhead_allocation_snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.sku_qc_allocation_snapshot_run_sku_uq') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX sku_qc_allocation_snapshot_run_sku_uq ON costing.sku_qc_allocation_snapshot USING btree (refresh_run_id, sku_id)') THEN RAISE EXCEPTION 'C run key drift: sku_qc_allocation_snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='costing.sku_direct_labour_allocation_snapshot'::regclass AND attname='id' AND attnotnull AND NOT attisdropped) THEN RAISE EXCEPTION 'C presence key drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='costing.sku_production_overhead_allocation_snapshot'::regclass AND attname='id' AND attnotnull AND NOT attisdropped) THEN RAISE EXCEPTION 'C presence key drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='costing.sku_qc_allocation_snapshot'::regclass AND attname='id' AND attnotnull AND NOT attisdropped) THEN RAISE EXCEPTION 'C presence key drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='costing.sku_materials_stores_allocation_snapshot'::regclass AND attname='id' AND attnotnull AND NOT attisdropped) THEN RAISE EXCEPTION 'C presence key drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='costing.sku_admin_finance_overhead_allocation_snapshot'::regclass AND attname='id' AND attnotnull AND NOT attisdropped) THEN RAISE EXCEPTION 'C presence key drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='costing.sku_marketing_expense_allocation_snapshot'::regclass AND attname='id' AND attnotnull AND NOT attisdropped) THEN RAISE EXCEPTION 'C presence key drift'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_object('table',t.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull) ORDER BY t.relname,a.attnum) FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname='costing' AND t.relname=ANY(ARRAY['sku_direct_labour_allocation_snapshot','sku_production_overhead_allocation_snapshot','sku_qc_allocation_snapshot','sku_materials_stores_allocation_snapshot','sku_admin_finance_overhead_allocation_snapshot','sku_marketing_expense_allocation_snapshot']::text[])) IS DISTINCT FROM '[{"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "id", "not_null": true}, {"type": "date", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "period_start", "not_null": true}, {"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "sku_id", "not_null": true}, {"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "product_id", "not_null": true}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "product_name", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "pack_size", "not_null": false}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "pack_uom", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "admin_overhead_cost_per_sku", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "finance_admin_overhead_cost_per_sku", "not_null": false}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "admin_overhead_allocation_status", "not_null": false}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "finance_admin_overhead_allocation_status", "not_null": false}, {"type": "timestamp with time zone", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "refreshed_at", "not_null": true}, {"type": "date", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "valuation_date", "not_null": false}, {"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "refresh_run_id", "not_null": false}, {"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "allocation_basis_snapshot_id", "not_null": false}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "allocation_basis_source", "not_null": false}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "allocation_resolution_status", "not_null": false}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "allocation_resolution_note", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "resolved_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "resolved_sales_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "resolved_product_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "resolved_product_sales_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "resolved_company_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "resolved_product_allocation_share", "not_null": false}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "admin_overhead_allocation_note", "not_null": false}, {"type": "text", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "finance_admin_overhead_allocation_note", "not_null": false}, {"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "admin_policy_envelope_id", "not_null": false}, {"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "finance_admin_policy_envelope_id", "not_null": false}, {"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "admin_pool_snapshot_id", "not_null": false}, {"type": "bigint", "table": "sku_admin_finance_overhead_allocation_snapshot", "column": "finance_admin_pool_snapshot_id", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "id", "not_null": true}, {"type": "date", "table": "sku_direct_labour_allocation_snapshot", "column": "period_start", "not_null": true}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "sku_id", "not_null": true}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "product_id", "not_null": true}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "product_name", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "product_base_uom", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "pack_size", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "pack_uom", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "sku_base_qty_per_unit", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_pool_amount", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_staff_count", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "sales_units_12m", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "sales_base_qty_12m", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "product_sales_units_12m", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "product_sales_base_qty_12m", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "company_sales_units_12m", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "product_allocation_share", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "product_direct_labour_allocation", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_cost_per_base_uom", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_cost_per_sku", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "allocation_basis_status", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_allocation_status", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_allocation_note", "not_null": false}, {"type": "timestamp with time zone", "table": "sku_direct_labour_allocation_snapshot", "column": "refreshed_at", "not_null": true}, {"type": "date", "table": "sku_direct_labour_allocation_snapshot", "column": "valuation_date", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "refresh_run_id", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "allocation_basis_snapshot_id", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "allocation_basis_source", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "allocation_resolution_status", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "allocation_resolution_note", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "resolved_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "resolved_sales_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "resolved_product_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "resolved_product_sales_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "resolved_company_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "resolved_product_allocation_share", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "policy_id", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "product_workload_snapshot_id", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "standard_batch_count", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_route_intensity", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_workload_units", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "product_workload_share", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "sku_within_product_share", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "allocation_reason_code", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_pool_snapshot_id", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "manufacturing_direct_labour_pool_amount", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "packing_labour_pool_amount", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "manufacturing_direct_labour_allocation", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "packing_labour_allocation", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "manufacturing_direct_labour_cost_per_sku", "not_null": false}, {"type": "numeric", "table": "sku_direct_labour_allocation_snapshot", "column": "packing_labour_cost_per_sku", "not_null": false}, {"type": "bigint", "table": "sku_direct_labour_allocation_snapshot", "column": "packing_labour_workload_snapshot_id", "not_null": false}, {"type": "text", "table": "sku_direct_labour_allocation_snapshot", "column": "direct_labour_component_model_code", "not_null": false}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "id", "not_null": true}, {"type": "date", "table": "sku_marketing_expense_allocation_snapshot", "column": "period_start", "not_null": true}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "sku_id", "not_null": true}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "product_id", "not_null": true}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "product_name", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "pack_size", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "pack_uom", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_expense_cost_per_sku", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_expense_allocation_status", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_expense_allocation_note", "not_null": false}, {"type": "timestamp with time zone", "table": "sku_marketing_expense_allocation_snapshot", "column": "refreshed_at", "not_null": true}, {"type": "date", "table": "sku_marketing_expense_allocation_snapshot", "column": "valuation_date", "not_null": false}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "refresh_run_id", "not_null": false}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "allocation_basis_snapshot_id", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "allocation_basis_source", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "allocation_resolution_status", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "allocation_resolution_note", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "resolved_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "resolved_sales_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "resolved_product_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "resolved_product_sales_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "resolved_company_sales_units", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "resolved_product_allocation_share", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_driver_code", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "eligible_product_signed_billed_value", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "eligible_company_signed_billed_value", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "product_monetary_allocation_share", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "product_marketing_allocation", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "recipient_product_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "sku_base_qty_per_unit", "not_null": false}, {"type": "date", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_lookback_start", "not_null": false}, {"type": "date", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_lookback_end", "not_null": false}, {"type": "timestamp with time zone", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_source_cutoff_at", "not_null": false}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_evidence_row_count", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_evidence_status", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_value_source", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "resolved_product_marketing_sales_value", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "resolved_company_marketing_sales_value", "not_null": false}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_assumption_id", "not_null": false}, {"type": "numeric", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_assumed_sales_value", "not_null": false}, {"type": "text", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_assumption_approval_reference", "not_null": false}, {"type": "date", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_assumption_effective_from", "not_null": false}, {"type": "date", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_assumption_effective_to", "not_null": false}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_policy_id", "not_null": false}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_policy_envelope_id", "not_null": false}, {"type": "bigint", "table": "sku_marketing_expense_allocation_snapshot", "column": "marketing_pool_snapshot_id", "not_null": false}, {"type": "bigint", "table": "sku_materials_stores_allocation_snapshot", "column": "id", "not_null": true}, {"type": "date", "table": "sku_materials_stores_allocation_snapshot", "column": "period_start", "not_null": true}, {"type": "date", "table": "sku_materials_stores_allocation_snapshot", "column": "valuation_date", "not_null": true}, {"type": "bigint", "table": "sku_materials_stores_allocation_snapshot", "column": "refresh_run_id", "not_null": true}, {"type": "bigint", "table": "sku_materials_stores_allocation_snapshot", "column": "workload_snapshot_id", "not_null": true}, {"type": "bigint", "table": "sku_materials_stores_allocation_snapshot", "column": "pool_snapshot_id", "not_null": true}, {"type": "bigint", "table": "sku_materials_stores_allocation_snapshot", "column": "sku_id", "not_null": true}, {"type": "bigint", "table": "sku_materials_stores_allocation_snapshot", "column": "product_id", "not_null": true}, {"type": "text", "table": "sku_materials_stores_allocation_snapshot", "column": "product_name", "not_null": true}, {"type": "numeric", "table": "sku_materials_stores_allocation_snapshot", "column": "pack_size", "not_null": false}, {"type": "text", "table": "sku_materials_stores_allocation_snapshot", "column": "pack_uom", "not_null": false}, {"type": "numeric", "table": "sku_materials_stores_allocation_snapshot", "column": "monthly_sku_units", "not_null": false}, {"type": "numeric", "table": "sku_materials_stores_allocation_snapshot", "column": "unified_workload_units", "not_null": false}, {"type": "numeric", "table": "sku_materials_stores_allocation_snapshot", "column": "company_eligible_workload_units", "not_null": false}, {"type": "numeric", "table": "sku_materials_stores_allocation_snapshot", "column": "workload_share", "not_null": false}, {"type": "numeric", "table": "sku_materials_stores_allocation_snapshot", "column": "frozen_pool_amount", "not_null": true}, {"type": "numeric", "table": "sku_materials_stores_allocation_snapshot", "column": "monthly_sku_allocation_amount", "not_null": false}, {"type": "numeric", "table": "sku_materials_stores_allocation_snapshot", "column": "materials_stores_overhead_cost_per_sku", "not_null": false}, {"type": "text", "table": "sku_materials_stores_allocation_snapshot", "column": "allocation_status", "not_null": true}, {"type": "text", "table": "sku_materials_stores_allocation_snapshot", "column": "allocation_reason_code", "not_null": true}, {"type": "text", "table": "sku_materials_stores_allocation_snapshot", "column": "allocation_note", "not_null": true}, {"type": "timestamp with time zone", "table": "sku_materials_stores_allocation_snapshot", "column": "captured_at", "not_null": true}, {"type": "bigint", "table": "sku_production_overhead_allocation_snapshot", "column": "id", "not_null": true}, {"type": "date", "table": "sku_production_overhead_allocation_snapshot", "column": "period_start", "not_null": true}, {"type": "date", "table": "sku_production_overhead_allocation_snapshot", "column": "valuation_date", "not_null": true}, {"type": "bigint", "table": "sku_production_overhead_allocation_snapshot", "column": "refresh_run_id", "not_null": true}, {"type": "bigint", "table": "sku_production_overhead_allocation_snapshot", "column": "policy_id", "not_null": true}, {"type": "bigint", "table": "sku_production_overhead_allocation_snapshot", "column": "product_workload_snapshot_id", "not_null": true}, {"type": "bigint", "table": "sku_production_overhead_allocation_snapshot", "column": "sku_id", "not_null": true}, {"type": "bigint", "table": "sku_production_overhead_allocation_snapshot", "column": "product_id", "not_null": true}, {"type": "text", "table": "sku_production_overhead_allocation_snapshot", "column": "product_name", "not_null": true}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "pack_size", "not_null": false}, {"type": "text", "table": "sku_production_overhead_allocation_snapshot", "column": "pack_uom", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "sku_base_qty_per_unit", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "monthly_sku_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "monthly_product_base_qty", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "sku_within_product_share", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "production_overhead_pool_amount", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "product_workload_share", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "product_production_overhead_allocation", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "production_overhead_cost_per_base_uom", "not_null": false}, {"type": "numeric", "table": "sku_production_overhead_allocation_snapshot", "column": "production_overhead_cost_per_sku", "not_null": false}, {"type": "text", "table": "sku_production_overhead_allocation_snapshot", "column": "allocation_status", "not_null": true}, {"type": "text", "table": "sku_production_overhead_allocation_snapshot", "column": "allocation_reason_code", "not_null": true}, {"type": "text", "table": "sku_production_overhead_allocation_snapshot", "column": "allocation_note", "not_null": true}, {"type": "timestamp with time zone", "table": "sku_production_overhead_allocation_snapshot", "column": "captured_at", "not_null": true}, {"type": "bigint", "table": "sku_production_overhead_allocation_snapshot", "column": "pool_snapshot_id", "not_null": true}, {"type": "bigint", "table": "sku_qc_allocation_snapshot", "column": "id", "not_null": true}, {"type": "date", "table": "sku_qc_allocation_snapshot", "column": "period_start", "not_null": true}, {"type": "date", "table": "sku_qc_allocation_snapshot", "column": "valuation_date", "not_null": true}, {"type": "bigint", "table": "sku_qc_allocation_snapshot", "column": "refresh_run_id", "not_null": true}, {"type": "bigint", "table": "sku_qc_allocation_snapshot", "column": "product_qc_allocation_snapshot_id", "not_null": true}, {"type": "bigint", "table": "sku_qc_allocation_snapshot", "column": "sales_allocation_basis_snapshot_id", "not_null": true}, {"type": "bigint", "table": "sku_qc_allocation_snapshot", "column": "sku_id", "not_null": true}, {"type": "bigint", "table": "sku_qc_allocation_snapshot", "column": "product_id", "not_null": true}, {"type": "text", "table": "sku_qc_allocation_snapshot", "column": "product_name", "not_null": false}, {"type": "numeric", "table": "sku_qc_allocation_snapshot", "column": "pack_size", "not_null": false}, {"type": "text", "table": "sku_qc_allocation_snapshot", "column": "pack_uom", "not_null": false}, {"type": "text", "table": "sku_qc_allocation_snapshot", "column": "product_base_uom", "not_null": false}, {"type": "numeric", "table": "sku_qc_allocation_snapshot", "column": "sku_base_qty_per_unit", "not_null": false}, {"type": "numeric", "table": "sku_qc_allocation_snapshot", "column": "qc_cost_per_product_base_uom", "not_null": false}, {"type": "numeric", "table": "sku_qc_allocation_snapshot", "column": "quality_control_overhead_cost_per_sku", "not_null": false}, {"type": "text", "table": "sku_qc_allocation_snapshot", "column": "allocation_status", "not_null": true}, {"type": "text", "table": "sku_qc_allocation_snapshot", "column": "allocation_reason_code", "not_null": true}, {"type": "text", "table": "sku_qc_allocation_snapshot", "column": "allocation_note", "not_null": true}, {"type": "timestamp with time zone", "table": "sku_qc_allocation_snapshot", "column": "refreshed_at", "not_null": true}]'::jsonb THEN RAISE EXCEPTION 'C composite column shape drift'; END IF;
 IF (SELECT coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition_md5',md5(pg_get_functiondef(p.oid))) ORDER BY p.oid::regprocedure::text),'[]'::jsonb) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','costing') AND p.prokind='f' AND p.prosrc LIKE '%fn_product_sku_readiness_run_evidence%') IS DISTINCT FROM '[{"signature": "costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)", "definition_md5": "65b40f9ac648ee077641c84eaee18497"}]'::jsonb THEN RAISE EXCEPTION 'C captured textual caller drift'; END IF;
 IF (SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'tags',e.evttags,'enabled',e.evtenabled,'definition_md5',md5(pg_get_functiondef(e.evtfoid))) ORDER BY e.evtname),'[]'::jsonb)::text) FROM pg_event_trigger e WHERE e.evtenabled<>'D') IS DISTINCT FROM '4e2c16f8333e51161dc11c5376fb3296' THEN RAISE EXCEPTION 'C event trigger drift'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION costing.fn_wp04_c_run_assemble(p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint,p_dl costing.sku_direct_labour_allocation_snapshot,p_poh costing.sku_production_overhead_allocation_snapshot,p_qc costing.sku_qc_allocation_snapshot,p_ms costing.sku_materials_stores_allocation_snapshot,p_af costing.sku_admin_finance_overhead_allocation_snapshot,p_mk costing.sku_marketing_expense_allocation_snapshot)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
with dl as (select (p_dl).* where (p_dl).id is not null),
poh as (select (p_poh).* where (p_poh).id is not null),
qc as (select (p_qc).* where (p_qc).id is not null),
ms as (select (p_ms).* where (p_ms).id is not null),
af as (select (p_af).* where (p_af).id is not null),
mk as (select (p_mk).* where (p_mk).id is not null),
scheme as (
 select coalesce(jsonb_agg(jsonb_build_object('region_code',region_code,'raw_status',resolution_status,'effective_status',resolution_status,'resolution_source',policy_source,'reason_code',resolution_status,'note',resolution_note,'evidence_ids',jsonb_build_object('scheme_id',scheme_id,'policy_rule_id',policy_rule_id)) order by region_code),'[]'::jsonb) rows,
        count(*) n,
        bool_or(resolution_status not in ('RESOLVED','DEFAULT_NO_SCHEME')) bad
 from costing.sku_selected_scheme_policy_context_snapshot
 where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id),
regional as (
 select coalesce(jsonb_agg(jsonb_build_object('region_code',region_code,'raw_status',raw_status,'effective_status',effective_status,'resolution_source',regional_basis_source,'reason_code',regional_basis_status,'acceptance_eligible',is_acceptance_eligible,'accepted',is_accepted,'evidence_ids',jsonb_build_object('regional_marketing_snapshot_id',regional_marketing_snapshot_id,'regional_basis_snapshot_id',regional_basis_snapshot_id,'acceptance_id',acceptance_id)) order by region_code),'[]'::jsonb) rows,
        count(*) n,
        bool_or(effective_status='BLOCKED') blocked,
        bool_or(effective_status='REVIEW_REQUIRED') review
 from costing.v_regional_marketing_evidence_review_queue
 where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id)
select jsonb_build_object(
 'snapshot_present',coalesce((select true from dl),false) or coalesce((select true from poh),false) or coalesce((select true from qc),false) or coalesce((select true from ms),false) or coalesce((select true from af),false) or coalesce((select true from mk),false),
 'driver_dependencies',jsonb_build_array(
  jsonb_build_object('dependency_code','DIRECT_LABOUR','label','Direct Labour','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select direct_labour_allocation_status from dl),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from dl),'note',(select direct_labour_allocation_note from dl),'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.sku_direct_labour_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from dl),'policy_id',(select policy_id from dl))),
  jsonb_build_object('dependency_code','PRODUCTION_OVERHEAD','label','Production Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from poh),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from poh),'note',(select allocation_note from poh),'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.sku_production_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from poh),'policy_id',(select policy_id from poh))),
  jsonb_build_object('dependency_code','QUALITY_CONTROL_OVERHEAD','label','Quality Control Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from qc),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from qc),'note',(select allocation_note from qc),'owner_module','COST_SHEET_REVIEW','recommended_ui_route','QC_ACTION_QUEUE','authority','costing.sku_qc_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from qc))),
  jsonb_build_object('dependency_code','MATERIALS_STORES_OVERHEAD','label','Materials / Stores Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from ms),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from ms),'note',(select allocation_note from ms),'owner_module','COST_SHEET_REVIEW','recommended_ui_route','MATERIALS_STORES_ACTION_QUEUE','authority','costing.sku_materials_stores_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from ms))),
  jsonb_build_object('dependency_code','ADMIN_OVERHEAD','label','Administrative Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select admin_overhead_allocation_status from af),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_resolution_status from af),'note',(select admin_overhead_allocation_note from af),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_admin_finance_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from af),'policy_envelope_id',(select admin_policy_envelope_id from af))),
  jsonb_build_object('dependency_code','FINANCE_ADMIN_OVERHEAD','label','Finance/Admin Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select finance_admin_overhead_allocation_status from af),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_resolution_status from af),'note',(select finance_admin_overhead_allocation_note from af),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_admin_finance_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from af),'policy_envelope_id',(select finance_admin_policy_envelope_id from af))),
  jsonb_build_object('dependency_code','MARKETING_EXPENSE','label','Marketing Expense','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select marketing_expense_allocation_status from mk),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select marketing_evidence_status from mk),'note',(select marketing_expense_allocation_note from mk),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_marketing_expense_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from mk),'policy_id',(select marketing_policy_id from mk),'policy_envelope_id',(select marketing_policy_envelope_id from mk)))
 ),
 'scheme_evidence',(select rows from scheme),
 'scheme_status',case when (select n from scheme)=0 then 'UNKNOWN' when coalesce((select bad from scheme),false) then 'BLOCKED' else 'READY' end,
 'regional_marketing_evidence',(select rows from regional),
 'regional_marketing_status',case when (select n from regional)=0 then 'UNKNOWN' when coalesce((select blocked from regional),false) then 'BLOCKED' when coalesce((select review from regional),false) then 'REVIEW_REQUIRED' else 'READY' end
);
$function$;
CREATE OR REPLACE FUNCTION costing.fn_wp04_c_run_cohort(p_sku_ids bigint[],p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
RETURNS TABLE(sku_id bigint,evidence_envelope jsonb) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
with cohort as materialized (select distinct u.sku_id from unnest(p_sku_ids) as u(sku_id))
select c.sku_id,jsonb_build_object('sku_id',c.sku_id,'period_start',p_period_start,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'evidence',
 costing.fn_wp04_c_run_assemble(c.sku_id,p_period_start,p_valuation_date,p_refresh_run_id,dl,poh,qc,ms,af,mk))
from cohort c
left join costing.sku_direct_labour_allocation_snapshot dl on dl.sku_id=c.sku_id and dl.period_start=p_period_start and dl.valuation_date=p_valuation_date and dl.refresh_run_id=p_refresh_run_id
left join costing.sku_production_overhead_allocation_snapshot poh on poh.sku_id=c.sku_id and poh.period_start=p_period_start and poh.valuation_date=p_valuation_date and poh.refresh_run_id=p_refresh_run_id
left join costing.sku_qc_allocation_snapshot qc on qc.sku_id=c.sku_id and qc.period_start=p_period_start and qc.valuation_date=p_valuation_date and qc.refresh_run_id=p_refresh_run_id
left join costing.sku_materials_stores_allocation_snapshot ms on ms.sku_id=c.sku_id and ms.period_start=p_period_start and ms.valuation_date=p_valuation_date and ms.refresh_run_id=p_refresh_run_id
left join costing.sku_admin_finance_overhead_allocation_snapshot af on af.sku_id=c.sku_id and af.period_start=p_period_start and af.valuation_date=p_valuation_date and af.refresh_run_id=p_refresh_run_id
left join costing.sku_marketing_expense_allocation_snapshot mk on mk.sku_id=c.sku_id and mk.period_start=p_period_start and mk.valuation_date=p_valuation_date and mk.refresh_run_id=p_refresh_run_id;
$function$;
CREATE OR REPLACE FUNCTION costing.fn_product_sku_readiness_run_evidence(p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
select c.evidence_envelope->'evidence' from costing.fn_wp04_c_run_cohort(ARRAY[p_sku_id]::bigint[],p_period_start,p_valuation_date,p_refresh_run_id) c;
$function$;
CREATE OR REPLACE FUNCTION costing.fn_wp04_c_enrich(p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint,p_shared_issues jsonb,p_run_envelope jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
declare e jsonb; deps jsonb; ev text; sev text; ctx jsonb; scheme_status text; regional_status text; shared jsonb;
begin
 if jsonb_typeof(p_run_envelope) is distinct from 'object' then raise exception 'C evidence envelope required'; end if;
 if (select count(*) from jsonb_object_keys(p_run_envelope))<>5
 or p_run_envelope->'sku_id' is distinct from coalesce(to_jsonb(p_sku_id),'null'::jsonb)
 or p_run_envelope->'period_start' is distinct from coalesce(to_jsonb(p_period_start),'null'::jsonb)
 or p_run_envelope->'valuation_date' is distinct from coalesce(to_jsonb(p_valuation_date),'null'::jsonb)
 or p_run_envelope->'refresh_run_id' is distinct from coalesce(to_jsonb(p_refresh_run_id),'null'::jsonb)
 or jsonb_typeof(p_run_envelope->'evidence') is distinct from 'object' then raise exception 'C evidence context mismatch'; end if;
 e:=p_run_envelope->'evidence';
 if (select count(*) from jsonb_object_keys(e))<>6
 or jsonb_typeof(e->'scheme_status') is distinct from 'string'
 or jsonb_typeof(e->'regional_marketing_status') is distinct from 'string'
 or jsonb_typeof(e->'snapshot_present') is distinct from 'boolean'
 or jsonb_typeof(e->'driver_dependencies') is distinct from 'array' then raise exception 'C driver evidence shape mismatch'; end if;
 if jsonb_array_length(e->'driver_dependencies')<>7
 or (select jsonb_agg(d->>'dependency_code' order by ord) from jsonb_array_elements(e->'driver_dependencies') with ordinality as x(d,ord))
 is distinct from '["DIRECT_LABOUR","PRODUCTION_OVERHEAD","QUALITY_CONTROL_OVERHEAD","MATERIALS_STORES_OVERHEAD","ADMIN_OVERHEAD","FINANCE_ADMIN_OVERHEAD","MARKETING_EXPENSE"]'::jsonb then raise exception 'C driver evidence coverage mismatch'; end if;
 shared:=p_shared_issues;
 -- The unchanged run-evidence helper always emits both arrays; do not collapse invalid shapes to empty.
 if jsonb_typeof(e->'scheme_evidence') is distinct from 'array'
    or jsonb_typeof(e->'regional_marketing_evidence') is distinct from 'array' then
  raise exception 'Canonical run evidence array shape mismatch';
 end if;
 scheme_status:=case
  when exists(select 1 from jsonb_array_elements(e->'scheme_evidence') x(row)
   where row->>'raw_status' not in ('RESOLVED','RESOLVED_POLICY','DEFAULT_NO_SCHEME')) then 'BLOCKED'
  when jsonb_array_length(e->'scheme_evidence')>0 then 'READY' else 'UNKNOWN' end;
 regional_status:=case
  when exists(select 1 from jsonb_array_elements(e->'regional_marketing_evidence') x(row)
   where row->>'effective_status'='BLOCKED') then 'BLOCKED'
  when exists(select 1 from jsonb_array_elements(e->'regional_marketing_evidence') x(row)
   where row->>'effective_status'='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
  when jsonb_array_length(e->'regional_marketing_evidence')>0 then 'READY' else 'NOT_REQUIRED' end;
 deps:=coalesce(p_base->'dependencies','[]')||coalesce(e->'driver_dependencies','[]')||jsonb_build_array(
 jsonb_build_object('dependency_code','SELECTED_SCHEME_POLICY','label','Selected scheme policy','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',scheme_status,'effective_status',scheme_status,'resolution_source','RUN_SNAPSHOT','reason_code',case when scheme_status='BLOCKED' then 'SCHEME_EVIDENCE_BLOCKED' when scheme_status='UNKNOWN' then 'SCHEME_EVIDENCE_NOT_CAPTURED' end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_selected_scheme_policy_context_snapshot','evidence',e->'scheme_evidence'),
 jsonb_build_object('dependency_code','REGIONAL_MARKETING_EVIDENCE','label','Regional Marketing evidence','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability',case when regional_status='NOT_REQUIRED' then 'NOT_REQUIRED' else 'APPLICABLE' end,'raw_status',regional_status,'effective_status',regional_status,'resolution_source',case when regional_status='NOT_REQUIRED' then 'NO_REVIEW_QUEUE_ITEM' else 'RUN_SNAPSHOT_PLUS_ACCEPTANCE' end,'reason_code',case when regional_status in ('BLOCKED','REVIEW_REQUIRED') then 'REGIONAL_MARKETING_'||regional_status end,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route','REGIONAL_MARKETING_REVIEW','authority','costing.v_regional_marketing_evidence_review_queue','evidence',e->'regional_marketing_evidence'));
 select case when jsonb_array_length(shared)>0 then 'BLOCKED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER')) then 'BLOCKED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='UNKNOWN') then 'UNKNOWN' else 'READY' end into ev;
 sev:=case when p_base#>>'{summary,costing_foundation_status}'='BLOCKED' or ev='BLOCKED' or p_base#>>'{summary,overall_severity}'='BLOCKER' then 'BLOCKER' when ev='REVIEW_REQUIRED' or p_base#>>'{summary,overall_severity}'='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when ev='UNKNOWN' and p_base#>>'{summary,overall_severity}'<>'READY' then 'UNKNOWN' else coalesce(p_base#>>'{summary,overall_severity}','UNKNOWN') end;
 ctx:=jsonb_set(p_base->'context','{evidence_refresh_run_id}',to_jsonb(p_refresh_run_id),true);
 return jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_base,'{context}',ctx,true),'{dependencies}',deps,true),'{shared_issues}',shared,true),'{summary,evidence_quality_status}',to_jsonb(ev),true),'{summary,overall_severity}',to_jsonb(sev),true);
end $function$;
CREATE OR REPLACE FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint,p_shared_issues jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
declare e jsonb;
begin
 select c.evidence_envelope into strict e from costing.fn_wp04_c_run_cohort(ARRAY[p_sku_id]::bigint[],p_period_start,p_valuation_date,p_refresh_run_id) c;
 return costing.fn_wp04_c_enrich(p_base,p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id,p_shared_issues,e);
end
$function$;
CREATE OR REPLACE FUNCTION costing.fn_product_sku_readiness_enrich(p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
begin
 return costing.fn_product_sku_readiness_enrich_with_shared(p_base,p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id,costing.fn_product_sku_readiness_shared_issues(p_valuation_date));
end $function$;
CREATE OR REPLACE FUNCTION costing.fn_wp04_c_live_core(p_sku_id bigint,p_period_start date,p_valuation_date date,p_evidence_run_id bigint,p_route_evidence jsonb,p_shared_issues jsonb,p_run_envelope jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
declare
 v_context_type text:='LIVE_AS_OF'; v_period date:=p_period_start; v_val date:=p_valuation_date;
 v_run bigint:=p_evidence_run_id; v_run_status text:=case when p_evidence_run_id is not null then 'SUCCESS' end;
 v_integrity text:='LIVE_GOVERNED_PERIOD';
 v_sku record; v_bom record; v_route record; v_mrp record; v_sell record; v_batch record; v_sales record; v_control record;
 v_pm text; v_sm text; v_cf text; v_ev text; v_out text; v_sev text; v_dep jsonb:='[]'; v_base jsonb;
begin
 select s.id sku_id,s.product_id,s.pack_size,s.uom,s.is_active sku_is_active,s.is_sample,p.item product_name,p.status product_status,p.uom_base,p.conversion_to_base
 into v_sku from public.product_skus s join public.products p on p.id=s.product_id where s.id=p_sku_id;
 if not found then raise exception 'SKU % not found',p_sku_id; end if;

 v_pm:=case when v_sku.uom_base is not null and btrim(v_sku.uom_base)<>'' and v_sku.conversion_to_base>0 then 'RESOLVED' else 'BLOCKED' end;
 v_sm:=case when v_sku.pack_size>0 and nullif(btrim(v_sku.uom),'') is not null then 'RESOLVED' else 'BLOCKED' end;

  select * into v_bom from public.plm_sku_bom_revision_as_of(p_sku_id,v_val) limit 1;
  select * into v_route from jsonb_to_record(p_route_evidence) x(readiness_status text,effective_route_source text);
  select * into v_mrp from costing.fn_resolve_sku_mrp_as_of(p_sku_id,v_val) limit 1;
  select * into v_sell from costing.fn_resolve_sku_selling_price_policy_as_of(p_sku_id,v_val) limit 1;
  select * into v_batch from public.production_batch_size_ref b where b.product_id=v_sku.product_id and b.is_active and b.effective_from<=v_val and (b.effective_to is null or b.effective_to>=v_val) order by b.effective_from desc,b.id desc limit 1;
  select * into v_sales from costing.fn_resolve_sku_commercial_sales_basis_point(p_sku_id, v_period, v_val) limit 1;
  if v_run is not null then select * into v_control from costing.sku_costing_control_status_snapshot c where c.sku_id=p_sku_id and c.refresh_run_id=v_run limit 1; end if;
  v_dep:=jsonb_build_array(
   jsonb_build_object('dependency_code','PRODUCT_MASTER','label','Product master','scope','PRODUCT','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_pm,'resolution_source','PRODUCT_MASTER','reason_code',case when v_pm='BLOCKED' then 'PRODUCT_BASE_UOM_CONTEXT_INVALID' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','public.products'),
   jsonb_build_object('dependency_code','SKU_MASTER','label','SKU master','scope','SKU','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_sm,'resolution_source','SKU_MASTER','reason_code',case when v_sm='BLOCKED' then 'SKU_PACK_CONTEXT_INVALID' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','public.product_skus'),
   jsonb_build_object('dependency_code','PM_BOM_REVISION','label','Approved PM-BOM revision','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_bom.id is null then 'BLOCKED' else 'RESOLVED' end,'resolution_source',case when v_bom.id is null then 'MISSING' else 'APPROVED_EFFECTIVE_REVISION' end,'reason_code',case when v_bom.id is null then 'PM_BOM_REVISION_MISSING' end,'owner_module','PM_BOM_MANAGER','recommended_ui_route','PM_BOM_MANAGER','authority','public.plm_sku_bom_revision_as_of','evidence_ids',jsonb_build_object('revision_id',v_bom.id)),
   jsonb_build_object('dependency_code','BATCH_SIZE_REFERENCE','label','Batch-size reference','scope','PRODUCT_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_batch.id is null then 'BLOCKED' else 'RESOLVED' end,'resolution_source',case when v_batch.id is null then 'MISSING' else 'EFFECTIVE_REFERENCE' end,'reason_code',case when v_batch.id is null then 'BATCH_SIZE_REFERENCE_MISSING' end,'owner_module','SUPPLY_BATCH_PLAN','recommended_ui_route','BATCH_SIZES','authority','public.production_batch_size_ref','evidence_ids',jsonb_build_object('reference_id',v_batch.id)),
   jsonb_build_object('dependency_code','MANUFACTURING_ROUTE','label','Manufacturing route','scope','PRODUCT_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_route.readiness_status='READY' then 'RESOLVED' else 'BLOCKED' end,'resolution_source',v_route.effective_route_source,'reason_code',case when coalesce(v_route.readiness_status,'')<>'READY' then 'MANUFACTURING_ROUTE_NOT_READY' end,'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.fn_product_process_route_readiness'),
   jsonb_build_object('dependency_code','MRP_POLICY','label','MRP policy','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_mrp.resolution_status='RESOLVED' then 'RESOLVED' else 'BLOCKED' end,'resolution_source',v_mrp.source_type,'reason_code',case when coalesce(v_mrp.resolution_status,'MISSING')<>'RESOLVED' then 'MRP_POLICY_'||coalesce(v_mrp.resolution_status,'MISSING') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','MRP_GOVERNANCE','authority','costing.fn_resolve_sku_mrp_as_of','evidence_ids',jsonb_build_object('policy_id',v_mrp.policy_id)),
   jsonb_build_object('dependency_code','SELLING_PRICE_POLICY','label','Selling-price/GST policy','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_sell.resolution_status='RESOLVED' then 'RESOLVED' else 'BLOCKED' end,'resolution_source','SELLING_PRICE_POLICY','reason_code',case when coalesce(v_sell.resolution_status,'MISSING')<>'RESOLVED' then 'SELLING_POLICY_'||coalesce(v_sell.resolution_status,'MISSING') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.fn_resolve_sku_selling_price_policy_as_of','evidence_ids',jsonb_build_object('policy_id',v_sell.policy_id)),
   jsonb_build_object('dependency_code','COMMON_COMMERCIAL_BASIS','label','Common commercial sales basis','scope','SKU_PERIOD','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',case when v_sales.sku_id is null then 'BLOCKED' when v_sales.commercial_sales_status='OK' then 'READY' when v_sales.commercial_sales_status in ('DEFAULTED','REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'BLOCKED' end,'resolution_source',v_sales.assumption_source,'reason_code',v_sales.commercial_sales_warning,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','COMMERCIAL_SALES_ASSUMPTIONS','authority','costing.v_sku_commercial_sales_basis')
  );
  v_cf:=case when v_pm='BLOCKED' or v_sm='BLOCKED' or v_bom.id is null or v_batch.id is null or coalesce(v_route.readiness_status,'')<>'READY' or coalesce(v_mrp.resolution_status,'')<>'RESOLVED' or coalesce(v_sell.resolution_status,'')<>'RESOLVED' then 'BLOCKED' else 'RESOLVED' end;
  v_ev:=case when v_sales.sku_id is null then 'BLOCKED' when v_sales.commercial_sales_status='OK' then 'READY' when v_sales.commercial_sales_status in ('DEFAULTED','REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'BLOCKED' end;
 v_out:=coalesce(v_control.cost_sheet_status,'UNKNOWN');
 v_sev:=case when v_cf='BLOCKED' or v_ev='BLOCKED' or v_control.control_severity='BLOCKER' then 'BLOCKER' when v_ev='REVIEW_REQUIRED' or v_control.control_severity='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when v_control.control_severity='READY' then 'READY' else 'UNKNOWN' end;
 v_base:=jsonb_build_object(
  'context',jsonb_build_object('context_type',v_context_type,'sku_id',p_sku_id,'product_id',v_sku.product_id,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',case when v_context_type='EXACT_RUN' then v_run else null end,'run_status',v_run_status,'context_integrity_status',v_integrity),
  'lifecycle',case when v_context_type='LIVE_AS_OF' then jsonb_build_object('product_status',v_sku.product_status,'sku_is_active',v_sku.sku_is_active,'sku_is_sample',v_sku.is_sample) else jsonb_build_object('status','UNKNOWN','reason_code','NOT_FROZEN_IN_RUN') end,
  'identity',jsonb_build_object('product_name',v_sku.product_name,'pack_size',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_size else v_sku.pack_size end,'pack_uom',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_uom else v_sku.uom end),
  'summary',jsonb_build_object('product_master_foundation_status',v_pm,'sku_master_foundation_status',v_sm,'costing_foundation_status',v_cf,'evidence_quality_status',v_ev,'costing_outcome_status',v_out,'overall_severity',v_sev),
  'dependencies',v_dep,'shared_issues','[]'::jsonb,
  'downstream_control',case when v_control.sku_id is null then null else jsonb_build_object('first_control_status',v_control.first_control_status,'control_severity',v_control.control_severity,'recommended_ui_route',v_control.recommended_ui_route,'control_note',v_control.control_note,'material_costing_status',v_control.material_costing_status,'pm_costing_status',v_control.pm_costing_status,'manufacturing_cop_status',v_control.manufacturing_cop_status,'internal_loaded_cost_status',v_control.internal_loaded_cost_status,'pricing_bridge_status',v_control.pricing_bridge_status,'selling_price_bridge_status',v_control.selling_price_bridge_status,'cost_sheet_status',v_control.cost_sheet_status,'refresh_run_id',v_control.refresh_run_id) end);
 if v_run is not null then return costing.fn_wp04_c_enrich(v_base,p_sku_id,v_period,v_val,v_run,p_shared_issues,p_run_envelope); end if;
 return v_base;
end $function$;
CREATE OR REPLACE FUNCTION costing.fn_product_sku_readiness_live_core(p_sku_id bigint,p_period_start date,p_valuation_date date,p_evidence_run_id bigint,p_route_evidence jsonb,p_shared_issues jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
declare e jsonb;
begin
 if p_evidence_run_id is not null then
 select c.evidence_envelope into strict e from costing.fn_wp04_c_run_cohort(ARRAY[p_sku_id]::bigint[],p_period_start,p_valuation_date,p_evidence_run_id) c;
 end if;
 return costing.fn_wp04_c_live_core(p_sku_id,p_period_start,p_valuation_date,p_evidence_run_id,p_route_evidence,p_shared_issues,e);
end
$function$;
CREATE OR REPLACE FUNCTION public.rpc_get_product_sku_readiness(p_sku_id bigint, p_period_start date, p_context_type text DEFAULT 'LIVE_AS_OF'::text, p_refresh_run_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare
 v_context_type text:=upper(coalesce(nullif(btrim(p_context_type),''),'LIVE_AS_OF'));
 v_period date; v_val date; v_run bigint; v_run_status text; v_integrity text:='LIVE_GOVERNED_PERIOD';
 v_route_json jsonb; v_shared_json jsonb;
 v_sku record; v_bom record; v_route record; v_mrp record; v_sell record; v_batch record; v_sales record; v_control record;
 v_pm text; v_sm text; v_cf text; v_ev text; v_out text; v_sev text; v_dep jsonb:='[]'; v_base jsonb;
begin
 
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    public.app_has_permission('module:manage-products', 'view')
    or public.app_has_permission('module:costing-control-center', 'view')
  ) then
    raise exception 'Permission denied for module:manage-products or module:costing-control-center (edit=false)';
  end if;

 if p_sku_id is null then raise exception 'SKU ID is required'; end if;
 if v_context_type not in ('LIVE_AS_OF','EXACT_RUN') then raise exception 'Invalid context type %',p_context_type; end if;
 select s.id sku_id,s.product_id,s.pack_size,s.uom,s.is_active sku_is_active,s.is_sample,p.item product_name,p.status product_status,p.uom_base,p.conversion_to_base
 into v_sku from public.product_skus s join public.products p on p.id=s.product_id where s.id=p_sku_id;
 if not found then raise exception 'SKU % not found',p_sku_id; end if;

 if v_context_type='LIVE_AS_OF' then
  if p_period_start is null then raise exception 'Costing period start is required for LIVE_AS_OF'; end if;
  v_period:=date_trunc('month',p_period_start::timestamp)::date;
  select valuation_date into v_val from costing.cost_periods where period_start=v_period;
  if v_val is null then raise exception 'Governed valuation date is missing for period %',v_period; end if;
  if p_refresh_run_id is not null then raise exception 'Refresh run ID is not accepted for LIVE_AS_OF'; end if;
  select id,overall_status into v_run,v_run_status from costing.costing_refresh_run
   where period_start=v_period and valuation_date=v_val and overall_status='SUCCESS'
   order by finished_at desc nulls last,id desc limit 1;
 else
  if p_refresh_run_id is null then raise exception 'Refresh run ID is required for EXACT_RUN'; end if;
  select r.id,r.period_start,r.valuation_date,r.overall_status,
   case when exists(select 1 from costing.costing_refresh_run_stage st where st.refresh_run_id=r.id and (st.period_start is distinct from r.period_start or st.valuation_date is distinct from r.valuation_date)) then 'MISMATCH'
        when r.valuation_context_source='LEGACY_BACKFILL' then 'LEGACY_UNVERIFIED' else 'CONSISTENT' end
  into v_run,v_period,v_val,v_run_status,v_integrity from costing.costing_refresh_run r where r.id=p_refresh_run_id;
  if v_run is null then raise exception 'Refresh run % not found',p_refresh_run_id; end if;
  if p_period_start is not null and date_trunc('month',p_period_start::timestamp)::date<>v_period then raise exception 'Supplied period does not match refresh run context'; end if;
 end if;

 if v_context_type='LIVE_AS_OF' then
  select to_jsonb(x) into v_route_json from costing.fn_product_process_route_readiness(v_val) x where x.product_id=v_sku.product_id limit 1;
  v_shared_json:='[]'::jsonb;
  if v_run is not null then v_shared_json:=costing.fn_product_sku_readiness_shared_issues(v_val); end if;
  return costing.fn_product_sku_readiness_live_core(p_sku_id,v_period,v_val,v_run,v_route_json,v_shared_json);
 end if;
  select * into v_control from costing.sku_costing_control_status_snapshot c where c.sku_id=p_sku_id and c.refresh_run_id=v_run limit 1;
  v_pm:='UNKNOWN'; v_sm:=case when v_control.sku_id is not null and v_control.pack_size>0 and nullif(btrim(v_control.pack_uom),'') is not null then 'RESOLVED' else 'UNKNOWN' end;
  v_cf:=case when v_control.sku_id is null then 'UNKNOWN' when v_control.cost_sheet_status='BLOCKED' then 'BLOCKED' else 'RESOLVED' end;
  v_ev:=case when v_control.sku_id is null then 'UNKNOWN' when v_control.control_severity='BLOCKER' then 'BLOCKED' when v_control.control_severity='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when v_control.control_severity='READY' then 'READY' else 'UNKNOWN' end;
  v_dep:=jsonb_build_array(
   jsonb_build_object('dependency_code','PRODUCT_MASTER','label','Product master','scope','PRODUCT','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status','UNKNOWN','resolution_source','NOT_FROZEN_IN_RUN','reason_code','NOT_FROZEN_IN_RUN','owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','EXACT_RUN_FROZEN_EVIDENCE_ONLY'),
   jsonb_build_object('dependency_code','SKU_PACK_IDENTITY','label','SKU pack identity','scope','SKU_EXACT_RUN','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_sm,'resolution_source',case when v_control.sku_id is null then 'NO_RUN_SNAPSHOT' else 'RUN_CONTROL_SNAPSHOT' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','MRP_POLICY','label','MRP policy','scope','SKU_EXACT_RUN','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_control.mrp_resolution_status='RESOLVED' then 'RESOLVED' when v_control.sku_id is null then 'UNKNOWN' else 'BLOCKED' end,'resolution_source','RUN_CONTROL_SNAPSHOT','owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','MRP_GOVERNANCE','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','SELLING_PRICE_POLICY','label','Selling-price/GST policy','scope','SKU_EXACT_RUN','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_control.selling_policy_resolution_status='RESOLVED' then 'RESOLVED' when v_control.sku_id is null then 'UNKNOWN' else 'BLOCKED' end,'resolution_source','RUN_CONTROL_SNAPSHOT','owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','FINAL_COSTING_CONTROL','label','Final costing control','scope','SKU_EXACT_RUN','dimension','COSTING_OUTCOME','applicability','APPLICABLE','raw_status',coalesce(v_control.cost_sheet_status,'UNKNOWN'),'resolution_source',case when v_control.sku_id is null then 'NO_RUN_SNAPSHOT' else 'RUN_CONTROL_SNAPSHOT' end,'reason_code',v_control.first_control_status,'note',v_control.control_note,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route',v_control.recommended_ui_route,'authority','costing.sku_costing_control_status_snapshot')
  );

 v_out:=coalesce(v_control.cost_sheet_status,'UNKNOWN');
 v_sev:=case when v_cf='BLOCKED' or v_ev='BLOCKED' or v_control.control_severity='BLOCKER' then 'BLOCKER' when v_ev='REVIEW_REQUIRED' or v_control.control_severity='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when v_control.control_severity='READY' then 'READY' else 'UNKNOWN' end;
 v_base:=jsonb_build_object(
  'context',jsonb_build_object('context_type',v_context_type,'sku_id',p_sku_id,'product_id',v_sku.product_id,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',case when v_context_type='EXACT_RUN' then v_run else null end,'run_status',v_run_status,'context_integrity_status',v_integrity),
  'lifecycle',case when v_context_type='LIVE_AS_OF' then jsonb_build_object('product_status',v_sku.product_status,'sku_is_active',v_sku.sku_is_active,'sku_is_sample',v_sku.is_sample) else jsonb_build_object('status','UNKNOWN','reason_code','NOT_FROZEN_IN_RUN') end,
  'identity',jsonb_build_object('product_name',v_sku.product_name,'pack_size',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_size else v_sku.pack_size end,'pack_uom',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_uom else v_sku.uom end),
  'summary',jsonb_build_object('product_master_foundation_status',v_pm,'sku_master_foundation_status',v_sm,'costing_foundation_status',v_cf,'evidence_quality_status',v_ev,'costing_outcome_status',v_out,'overall_severity',v_sev),
  'dependencies',v_dep,'shared_issues','[]'::jsonb,
  'downstream_control',case when v_control.sku_id is null then null else jsonb_build_object('first_control_status',v_control.first_control_status,'control_severity',v_control.control_severity,'recommended_ui_route',v_control.recommended_ui_route,'control_note',v_control.control_note,'material_costing_status',v_control.material_costing_status,'pm_costing_status',v_control.pm_costing_status,'manufacturing_cop_status',v_control.manufacturing_cop_status,'internal_loaded_cost_status',v_control.internal_loaded_cost_status,'pricing_bridge_status',v_control.pricing_bridge_status,'selling_price_bridge_status',v_control.selling_price_bridge_status,'cost_sheet_status',v_control.cost_sheet_status,'refresh_run_id',v_control.refresh_run_id) end);
 if v_run is not null then return costing.fn_product_sku_readiness_enrich(v_base,p_sku_id,v_period,v_val,v_run); end if;
 return v_base;
end $function$
;
CREATE FUNCTION public.rpc_get_readiness_governed_periods(p_before_period_start date DEFAULT NULL,p_limit integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid limit'; end if;
 with candidates as materialized (
  select period_start,valuation_date from costing.cost_periods
  where p_before_period_start is null or period_start<p_before_period_start
  order by period_start desc limit p_limit+1
 ), page as materialized (select * from candidates order by period_start desc limit p_limit)
 select jsonb_build_object('observed_at',statement_timestamp(),'before_period_start',p_before_period_start,'limit',p_limit,
  'rows',coalesce((select jsonb_agg(to_jsonb(p) order by period_start desc) from page p),'[]'::jsonb),
  'returned_count',(select count(*) from page),'has_more',(select count(*)>p_limit from candidates),
  'next_before_period_start',case when (select count(*)>p_limit from candidates) then (select min(period_start) from page) end)
 into result;
 return result;
end $function$;
CREATE FUNCTION public.rpc_get_readiness_product_gaps(p_product_scope text DEFAULT 'ACTIVE_PRODUCTS',p_gap_kind text DEFAULT 'NO_SKU',p_search text DEFAULT NULL,p_after_product_id bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare result jsonb; v_search text:=nullif(btrim(p_search),'');
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_product_scope is null or p_product_scope not in ('ACTIVE_PRODUCTS','ALL_PRODUCTS') then raise exception 'Invalid Product scope'; end if;
 if p_gap_kind is null or p_gap_kind not in ('NO_SKU','ACTIVE_WITHOUT_ACTIVE_SKU') then raise exception 'Invalid gap kind'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_after_product_id<0 then raise exception 'Invalid pagination'; end if;
 if length(v_search)>120 then raise exception 'Search too long'; end if;
 with membership as materialized (
  select p.id as product_id,p.item as product_name,p.status as product_status,
   not exists(select 1 from public.product_skus s where s.product_id=p.id) as no_sku,
   p.status='Active' and not exists(select 1 from public.product_skus s where s.product_id=p.id and s.is_active) as active_without_active_sku
  from public.products p where p_product_scope='ALL_PRODUCTS' or p.status='Active'
 ), matched as materialized (
  select * from membership where (case p_gap_kind when 'NO_SKU' then no_sku else active_without_active_sku end)
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=product_id::text)
 ), candidates as materialized (
  select * from matched where p_after_product_id is null or product_id>p_after_product_id order by product_id limit p_limit+1
 ), page as materialized (select * from candidates order by product_id limit p_limit)
 select jsonb_build_object('assessment_kind','PRODUCT_MEMBERSHIP_GAPS','observed_at',statement_timestamp(),
  'product_scope',p_product_scope,'gap_kind',p_gap_kind,'search',v_search,'after_product_id',p_after_product_id,'limit',p_limit,
  'statistics',jsonb_build_object('product_count',(select count(*) from membership),'no_sku_count',(select count(*) from membership where no_sku),
    'active_without_active_sku_count',(select count(*) from membership where active_without_active_sku)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'product_name',product_name,'product_status',product_status,'gap_kind',p_gap_kind) order by product_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_product_id',case when (select count(*)>p_limit from candidates) then (select max(product_id) from page) end)
 into result;
 return result;
end $function$;
CREATE FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 p_period_start date,p_population_scope text DEFAULT 'OPERATIONAL',p_overall_severities text[] DEFAULT NULL,
 p_dependency_codes text[] DEFAULT NULL,p_owner_modules text[] DEFAULT NULL,p_route_codes text[] DEFAULT NULL,
 p_search text DEFAULT NULL,p_after_sku_id bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare
 v_period date; v_val date; v_run bigint; v_route_map jsonb; v_route_count bigint; v_route_distinct bigint;
 v_shared jsonb:='[]'::jsonb; v_result jsonb; v_context_invalid boolean; v_search text:=nullif(btrim(p_search),'');
 v_values text[]; v_allowed text[]; v_normalized text[]; i integer;
 v_severities text[]; v_codes text[]; v_owners text[]; v_routes text[];
 v_dependency_options constant text[]:=array['PRODUCT_MASTER','SKU_MASTER','PM_BOM_REVISION','BATCH_SIZE_REFERENCE','MANUFACTURING_ROUTE','MRP_POLICY','SELLING_PRICE_POLICY','COMMON_COMMERCIAL_BASIS','DIRECT_LABOUR','PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD','MATERIALS_STORES_OVERHEAD','ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD','MARKETING_EXPENSE','SELECTED_SCHEME_POLICY','REGIONAL_MARKETING_EVIDENCE'];
 v_owner_options constant text[]:=array['MANAGE_PRODUCTS','PM_BOM_MANAGER','SUPPLY_BATCH_PLAN','PRODUCTION_ROUTE_MANAGER','PRICING_POLICY_MANAGER','COST_SHEET_REVIEW','COST_BUILD_MANAGER','COSTING_CONTROL_CENTER'];
 v_route_options constant text[]:=array['MANAGE_PRODUCTS','PM_BOM_MANAGER','BATCH_SIZES','PRODUCTION_ROUTE_MANAGER','MRP_GOVERNANCE','SELLING_SCHEME_POLICIES','COMMERCIAL_SALES_ASSUMPTIONS','QC_ACTION_QUEUE','MATERIALS_STORES_ACTION_QUEUE','DRIVER_GOVERNANCE','REGIONAL_MARKETING_REVIEW'];
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_period_start is null then raise exception 'Costing period start is required for LIVE_AS_OF'; end if;
 if p_population_scope is null or p_population_scope not in ('OPERATIONAL','ALL_EXISTING') then raise exception 'Invalid population scope'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_after_sku_id<0 then raise exception 'Invalid pagination'; end if;
 if length(v_search)>120 then raise exception 'Search too long'; end if;
 for i in 1..4 loop
  v_values:=case i when 1 then p_overall_severities when 2 then p_dependency_codes when 3 then p_owner_modules else p_route_codes end;
  v_allowed:=case i when 1 then array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'] when 2 then v_dependency_options when 3 then v_owner_options else v_route_options end;
  v_normalized:=null;
  if coalesce(cardinality(v_values),0)>0 then
   if array_ndims(v_values)<>1 or cardinality(v_values)>32 then raise exception 'Invalid filter cardinality'; end if;
   if exists(select 1 from unnest(v_values) x(value) where value is null or btrim(value)='' or not (btrim(value)=any(v_allowed))) then raise exception 'Unsupported filter value'; end if;
   select array_agg(value order by value) into v_normalized from (select distinct btrim(value) as value from unnest(v_values) x(value)) n;
  end if;
  if i=1 then v_severities:=v_normalized; elsif i=2 then v_codes:=v_normalized; elsif i=3 then v_owners:=v_normalized; else v_routes:=v_normalized; end if;
 end loop;
 v_period:=date_trunc('month',p_period_start::timestamp)::date;
 select valuation_date into v_val from costing.cost_periods where period_start=v_period;
 if v_val is null then raise exception 'Governed valuation date is missing for period %',v_period; end if;
 select id into v_run from costing.costing_refresh_run where period_start=v_period and valuation_date=v_val and overall_status='SUCCESS'
 order by finished_at desc nulls last,id desc limit 1;
 -- Exactly one route function evaluation; do not fabricate absent Product rows.
 with route_rows as materialized (select * from costing.fn_product_process_route_readiness(v_val))
 select count(*),count(distinct product_id),jsonb_object_agg(product_id::text,to_jsonb(r))
 into v_route_count,v_route_distinct,v_route_map from route_rows r;
 if v_route_count<>v_route_distinct then raise exception 'Nonunique route evidence'; end if;
 if v_run is not null then v_shared:=costing.fn_product_sku_readiness_shared_issues(v_val); end if;
 -- Materialized once before any filters/counts/page; no N calls to public canonical RPC.
 with population as materialized (
  select s.id as sku_id,s.product_id from public.product_skus s join public.products p on p.id=s.product_id
  where p_population_scope='ALL_EXISTING' or (p.status='Active' and s.is_active and not coalesce(s.is_sample,false))
 ), evidence as materialized (
  select e.* from costing.fn_wp04_c_run_cohort(
   case when v_run is not null then coalesce((select array_agg(sku_id order by sku_id) from population),'{}'::bigint[]) else '{}'::bigint[] end,
   v_period,v_val,v_run) e
 ), assessed as materialized (
  select s.sku_id,s.product_id,
   costing.fn_wp04_c_live_core(s.sku_id,v_period,v_val,v_run,v_route_map->(s.product_id::text),v_shared,e.evidence_envelope) as assessment
  from population s left join evidence e on e.sku_id=s.sku_id
 ), validation as materialized (
  select coalesce(bool_or(
  assessment#>>'{context,context_type}' is distinct from 'LIVE_AS_OF'
  or assessment#>>'{context,sku_id}' is distinct from sku_id::text
  or assessment#>>'{context,product_id}' is distinct from product_id::text
  or assessment#>>'{context,period_start}' is distinct from v_period::text
  or assessment#>>'{context,valuation_date}' is distinct from v_val::text
  or assessment#>'{context,refresh_run_id}' is distinct from 'null'::jsonb
  or (v_run is not null and assessment#>>'{context,evidence_refresh_run_id}' is distinct from v_run::text)
  or assessment#>>'{summary,overall_severity}' is null
  or assessment#>>'{summary,overall_severity}' not in ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')),false) as invalid from assessed
 ), r as materialized (
  select sku_id,product_id,assessment,
   assessment#>>'{identity,product_name}' as product_name,
   assessment#>>'{summary,overall_severity}' as severity
  from assessed
 ), incidences as materialized (
  select r.sku_id,'DEPENDENCY'::text as incidence_kind,d->>'dependency_code' as dependency_code,
   null::text as issue_code,d->>'owner_module' as owner_module,d->>'recommended_ui_route' as route_code,
   null::jsonb as shared_issue
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  where d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
  union all
  select r.sku_id,'SHARED',d->>'dependency_code',d->>'issue_code',d->>'owner_module',d->>'recommended_ui_route',d
  from r cross join lateral jsonb_array_elements(r.assessment->'shared_issues') x(d)
  where d->>'status' in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
 ), matched as materialized (
  select * from r where (v_severities is null or severity=any(v_severities))
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=sku_id::text or v_search=product_id::text)
   and ((v_codes is null and v_owners is null and v_routes is null) or exists (
    select 1 from incidences d where d.sku_id=r.sku_id
     and (v_codes is null or d.dependency_code=any(v_codes))
     and (v_owners is null or d.owner_module=any(v_owners))
     and (v_routes is null or d.route_code=any(v_routes))))
 ), candidates as materialized (
  select * from matched where p_after_sku_id is null or sku_id>p_after_sku_id order by sku_id limit p_limit+1
 ), page as materialized (select * from candidates order by sku_id limit p_limit),
 dependency_counts as (select dependency_code,count(distinct sku_id) as affected_sku_count from incidences where dependency_code is not null group by dependency_code),
 owner_counts as (select owner_module,count(distinct sku_id) as affected_sku_count from incidences where owner_module is not null group by owner_module),
 route_counts as (select route_code,count(distinct sku_id) as affected_sku_count from incidences where route_code is not null group by route_code),
 shared_counts as (
  select shared_issue as issue,count(distinct sku_id) as affected_sku_count,
   array_agg(distinct sku_id order by sku_id) as affected_sku_ids
  from incidences where incidence_kind='SHARED' group by shared_issue
 ), severity_counts as materialized (
  select count(*) as population_sku_count,
   count(*) filter(where severity='READY') as ready_count,
   count(*) filter(where severity='REVIEW_REQUIRED') as review_count,
   count(*) filter(where severity='BLOCKER') as blocker_count,
   count(*) filter(where severity='UNKNOWN') as unknown_count from r
 ),
 regional as (
  select distinct r.sku_id,e->>'region_code' as region_code,e->>'raw_status' as raw_status,e->>'effective_status' as effective_status
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  cross join lateral jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
  where d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE'
 ), regional_counts as (select region_code,raw_status,effective_status,count(*) as sku_region_count from regional group by region_code,raw_status,effective_status)
 select jsonb_build_object(
  'context',jsonb_build_object('context_type','LIVE_AS_OF','requested_period_start',p_period_start,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run,'context_integrity_status','LIVE_GOVERNED_PERIOD'),
  'observed_at',statement_timestamp(),'population_scope',p_population_scope,
  'filters',jsonb_build_object('overall_severities',v_severities,'dependency_codes',v_codes,'owner_modules',v_owners,'route_codes',v_routes,'search',v_search),
  'filter_options',jsonb_build_object('overall_severities',array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'],'dependency_codes',v_dependency_options,'owner_modules',v_owner_options,'route_codes',v_route_options),
  'after_sku_id',p_after_sku_id,'limit',p_limit,
  'statistics',jsonb_build_object('population_sku_count',(select population_sku_count from severity_counts),
   'overall_severity_counts',jsonb_build_object('READY',(select ready_count from severity_counts),'REVIEW_REQUIRED',(select review_count from severity_counts),'BLOCKER',(select blocker_count from severity_counts),'UNKNOWN',(select unknown_count from severity_counts)),
   'unresolved_dependency_counts',coalesce((select jsonb_agg(to_jsonb(x) order by dependency_code) from dependency_counts x),'[]'::jsonb),
   'unresolved_owner_counts',coalesce((select jsonb_agg(to_jsonb(x) order by owner_module) from owner_counts x),'[]'::jsonb),
   'unresolved_route_counts',coalesce((select jsonb_agg(to_jsonb(x) order by route_code) from route_counts x),'[]'::jsonb),
   'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
   'unresolved_shared_issue_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'context',jsonb_build_object('context_type','LIVE_AS_OF','period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run),
    'issue',issue,'affected_sku_count',affected_sku_count,'affected_sku_ids',affected_sku_ids) order by issue) from shared_counts),'[]'::jsonb),
   'regional_marketing_counts',coalesce((select jsonb_agg(to_jsonb(x) order by region_code,raw_status,effective_status) from regional_counts x),'[]'::jsonb)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(assessment order by sku_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_sku_id',case when (select count(*)>p_limit from candidates) then (select max(sku_id) from page) end),
 (select invalid from validation)
 into v_result,v_context_invalid;
 if v_context_invalid then raise exception 'Canonical assessment context or severity mismatch'; end if;
 return v_result;
end $function$;
ALTER FUNCTION costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint) OWNER TO postgres;
ALTER FUNCTION costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint) OWNER TO postgres;
ALTER FUNCTION costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.rpc_get_product_sku_readiness(bigint,date,text,bigint) OWNER TO postgres;
ALTER FUNCTION public.rpc_get_readiness_governed_periods(date,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_readiness_governed_periods(date,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_readiness_governed_periods(date,integer) TO authenticated;
ALTER FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) TO authenticated;
ALTER FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) TO authenticated;
DO $identity$
DECLARE e jsonb; a record; acl text[];
BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"signature":"costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot)","body_md5":"fdb75ff20ffd5d37e5103dec6b407f8c","argnames":["p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id","p_dl","p_poh","p_qc","p_ms","p_af","p_mk"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"jsonb","language":"sql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint)","body_md5":"fd3953417095e6c1045c4c508cbab777","argnames":["p_sku_ids","p_period_start","p_valuation_date","p_refresh_run_id","sku_id","evidence_envelope"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"record","language":"sql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":true,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":1000,"support":0,"transforms":null,"argmodes":["i","i","i","i","t","t"],"allargtypes":["bigint[]","date","date","bigint","bigint","jsonb"]},{"signature":"costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)","body_md5":"24120402765a16d9705f8937b4ae3699","argnames":["p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"jsonb","language":"sql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false","service_role:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb)","body_md5":"5174d7a97de4302b40826d207f144cce","argnames":["p_base","p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id","p_shared_issues","p_run_envelope"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)","body_md5":"3e06daca9e83c1d3c8a2ea0a432d88c2","argnames":["p_base","p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id","p_shared_issues"],"defaults_expression":null,"default_count":0,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)","body_md5":"c1f37b9477f239cf87c44901ecd3ca6e","argnames":["p_base","p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id"],"defaults_expression":null,"default_count":0,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false","service_role:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb)","body_md5":"41d34c8869f2153220170cd765880d52","argnames":["p_sku_id","p_period_start","p_valuation_date","p_evidence_run_id","p_route_evidence","p_shared_issues","p_run_envelope"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)","body_md5":"e00e399bace53b8bd906facc754d8584","argnames":["p_sku_id","p_period_start","p_valuation_date","p_evidence_run_id","p_route_evidence","p_shared_issues"],"defaults_expression":null,"default_count":0,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"public.rpc_get_product_sku_readiness(bigint,date,text,bigint)","body_md5":"7c54b0edc159d08647e8df73d51fbe51","argnames":["p_sku_id","p_period_start","p_context_type","p_refresh_run_id"],"defaults_expression":"''LIVE_AS_OF''::text, NULL::bigint","default_count":2,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=public, costing, pg_temp","acl_entries":["authenticated:postgres:EXECUTE:false","postgres:postgres:EXECUTE:false","service_role:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"public.rpc_get_readiness_governed_periods(date,integer)","body_md5":"671e150396f388875735e68818dcb574","argnames":["p_before_period_start","p_limit"],"defaults_expression":"NULL::date, 24","default_count":2,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=public, costing, pg_temp","acl_entries":["authenticated:postgres:EXECUTE:false","postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)","body_md5":"4ae66ab181270cfd41e16d2969d20d58","argnames":["p_product_scope","p_gap_kind","p_search","p_after_product_id","p_limit"],"defaults_expression":"''ACTIVE_PRODUCTS''::text, ''NO_SKU''::text, NULL::text, NULL::bigint, 50","default_count":5,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=public, costing, pg_temp","acl_entries":["authenticated:postgres:EXECUTE:false","postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)","body_md5":"cf6f5703b9d5bf1bef2c28b31cc4fe24","argnames":["p_period_start","p_population_scope","p_overall_severities","p_dependency_codes","p_owner_modules","p_route_codes","p_search","p_after_sku_id","p_limit"],"defaults_expression":"''OPERATIONAL''::text, NULL::text[], NULL::text[], NULL::text[], NULL::text[], NULL::text, NULL::bigint, 50","default_count":8,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=public, costing, pg_temp","acl_entries":["authenticated:postgres:EXECUTE:false","postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null}]'::jsonb) LOOP
  SELECT p.*,l.lanname,pg_get_userbyid(p.proowner) owner_name INTO a FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure(e->>'signature');
  IF NOT FOUND THEN RAISE EXCEPTION 'C candidate missing: %',e->>'signature'; END IF;
  SELECT array_agg(coalesce(r.rolname,'PUBLIC')||':'||g.rolname||':'||x.privilege_type||':'||x.is_grantable::text ORDER BY coalesce(r.rolname,'PUBLIC'),g.rolname,x.privilege_type,x.is_grantable) INTO acl
  FROM aclexplode(coalesce(a.proacl,acldefault('f',a.proowner))) x LEFT JOIN pg_roles r ON r.oid=x.grantee JOIN pg_roles g ON g.oid=x.grantor;
  IF md5(a.prosrc) IS DISTINCT FROM e->>'body_md5' OR a.owner_name IS DISTINCT FROM e->>'owner' OR a.lanname IS DISTINCT FROM e->>'language'
  OR a.prorettype IS DISTINCT FROM to_regtype(e->>'return_type') OR to_jsonb(a.proargnames) IS DISTINCT FROM e->'argnames'
  OR a.pronargdefaults IS DISTINCT FROM (e->>'default_count')::integer OR pg_get_expr(a.proargdefaults,0) IS DISTINCT FROM e->>'defaults_expression'
  OR coalesce(to_jsonb(a.proargmodes),'null'::jsonb) IS DISTINCT FROM coalesce(e->'argmodes','null'::jsonb)
  OR (e ? 'allargtypes' AND a.proallargtypes IS DISTINCT FROM ARRAY(SELECT to_regtype(value)::oid FROM jsonb_array_elements_text(e->'allargtypes')))
  OR (NOT e ? 'allargtypes' AND a.proallargtypes IS NOT NULL)
  OR a.provariadic<>0 OR a.proretset IS DISTINCT FROM (e->>'set_returning')::boolean OR a.prokind<>'f'
  OR a.procost<>100 OR a.prorows IS DISTINCT FROM (e->>'rows')::real OR a.prosupport<>0 OR a.protrftypes IS NOT NULL
  OR a.provolatile<>'s' OR NOT a.prosecdef OR a.proisstrict OR a.proleakproof OR a.proparallel<>'u'
  OR a.proconfig IS DISTINCT FROM ARRAY[e->>'search_path']::text[] OR to_jsonb(acl) IS DISTINCT FROM e->'acl_entries'
  THEN RAISE EXCEPTION 'C candidate identity mismatch: %',e->>'signature'; END IF;
 END LOOP;
END $identity$;
COMMIT;
