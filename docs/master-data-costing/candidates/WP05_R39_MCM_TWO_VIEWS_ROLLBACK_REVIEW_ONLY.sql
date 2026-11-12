-- REVIEW ONLY. No owner permission to execute this rollback on production.
-- Applies only after separately approved R39 production deployment, if needed.
-- Candidate hashes pinned from disposable PostgreSQL 17 full-view execution; refuse any intervening edits.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='45s';
DO $guard$
DECLARE v record;
BEGIN
 FOR v IN SELECT c.relname,c.oid,md5(pg_get_viewdef(c.oid,true)) AS defhash,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,
 COALESCE(array_to_string(c.reloptions,','),'') opts
 FROM pg_class c WHERE c.oid IN ('public.v_costing_material_manual_rate_history'::regclass,'public.v_costing_material_manual_rate_register'::regclass)
 LOOP
 IF v.owner<>'postgres' OR v.acl<>'{postgres=arwdDxtm/postgres,authenticated=r/postgres}'
 OR v.opts<>'security_invoker=false'
 OR (v.relname='v_costing_material_manual_rate_history' AND v.defhash<>'01029a39e47a300aa7860d17b2f39cae')
 OR (v.relname='v_costing_material_manual_rate_register' AND v.defhash<>'38b4262bfae719ca3f736185784fd047')
 THEN RAISE EXCEPTION 'WP05 R39 rollback: unexpected changed view %, abort both',v.relname; END IF;
 END LOOP;
END $guard$;
-- Restore history before register; both are in one transaction.
CREATE OR REPLACE VIEW public.v_costing_material_manual_rate_history WITH (security_invoker=false) AS
 SELECT manual_rate_id,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    rate_value,
    rate_uom_id,
    effective_from,
    effective_to,
    status,
    reason,
    created_at,
    created_by,
    last_updated_at,
    last_updated_by,
    latest_material_issue_code,
    latest_bom_source,
    latest_system_selected_rate,
    latest_system_rate_source,
    latest_system_rate_date,
    rate_origin,
    source_vendor_rate_id,
    source_vendor_id,
    source_vendor_display_name,
    source_rate_value,
    source_uom_id,
    source_uom_code,
    source_valid_from,
    source_valid_to,
    source_min_order_qty,
    source_lead_time_days,
    source_remarks,
    source_adopted_at
   FROM ( WITH latest_item_name AS (
                 SELECT DISTINCT ON (s.stock_item_id) s.stock_item_id,
                    s.stock_item_code,
                    s.stock_item_name,
                    s.material_issue_code,
                    s.bom_source,
                    s.selected_rate,
                    s.rate_source,
                    s.rate_date,
                    s.snapshot_refreshed_at
                   FROM v_costing_pricing_review_top_action_items_snapshot s
                  WHERE s.stock_item_id IS NOT NULL
                  ORDER BY s.stock_item_id, s.snapshot_refreshed_at DESC NULLS LAST
                )
         SELECT mmr.id AS manual_rate_id,
            mmr.stock_item_id,
            COALESCE(lin.stock_item_code, i.code) AS stock_item_code,
            COALESCE(lin.stock_item_name, i.name) AS stock_item_name,
            mmr.rate_value,
            mmr.rate_uom_id,
            mmr.effective_from,
            mmr.effective_to,
            mmr.status,
            mmr.reason,
            mmr.created_at,
            mmr.created_by,
            mmr.last_updated_at,
            mmr.last_updated_by,
            lin.material_issue_code AS latest_material_issue_code,
            lin.bom_source AS latest_bom_source,
            lin.selected_rate AS latest_system_selected_rate,
            lin.rate_source AS latest_system_rate_source,
            lin.rate_date AS latest_system_rate_date,
            mmr.rate_origin,
            mmr.source_vendor_rate_id,
            mmr.source_vendor_id,
            COALESCE(NULLIF(mmr.source_snapshot ->> 'vendor_display_name'::text, ''::text), v.display_name) AS source_vendor_display_name,
            NULLIF(mmr.source_snapshot ->> 'rate_value'::text, ''::text)::numeric AS source_rate_value,
            NULLIF(mmr.source_snapshot ->> 'uom_id'::text, ''::text)::bigint AS source_uom_id,
            NULLIF(mmr.source_snapshot ->> 'uom_code'::text, ''::text) AS source_uom_code,
            NULLIF(mmr.source_snapshot ->> 'valid_from'::text, ''::text)::date AS source_valid_from,
            NULLIF(mmr.source_snapshot ->> 'valid_to'::text, ''::text)::date AS source_valid_to,
            NULLIF(mmr.source_snapshot ->> 'min_order_qty'::text, ''::text)::numeric AS source_min_order_qty,
            NULLIF(mmr.source_snapshot ->> 'lead_time_days'::text, ''::text)::integer AS source_lead_time_days,
            NULLIF(mmr.source_snapshot ->> 'remarks'::text, ''::text) AS source_remarks,
            NULLIF(mmr.source_snapshot ->> 'adopted_at'::text, ''::text)::timestamp with time zone AS source_adopted_at
           FROM costing.material_manual_rates mmr
             LEFT JOIN latest_item_name lin ON lin.stock_item_id = mmr.stock_item_id
             LEFT JOIN inv_stock_item i ON i.id = mmr.stock_item_id
             LEFT JOIN proc_vendor v ON v.vendor_id = mmr.source_vendor_id
          ORDER BY (COALESCE(lin.stock_item_name, i.name)), mmr.stock_item_id, mmr.effective_from DESC, mmr.id DESC) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);
CREATE OR REPLACE VIEW public.v_costing_material_manual_rate_register WITH (security_invoker=false) AS
 SELECT manual_rate_id,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    rate_value,
    rate_uom_id,
    effective_from,
    effective_to,
    status,
    reason,
    created_at,
    created_by,
    last_updated_at,
    last_updated_by,
    latest_purchase_rate,
    latest_purchase_date,
    manual_rate_overrides_purchase_rate,
    newer_purchase_rate_available,
    review_message,
    register_status,
    recommended_action,
    rate_origin,
    source_vendor_rate_id,
    source_vendor_id,
    source_vendor_display_name,
    source_rate_value,
    source_uom_id,
    source_uom_code,
    source_valid_from,
    source_valid_to,
    source_min_order_qty,
    source_lead_time_days,
    source_remarks,
    source_adopted_at
   FROM ( SELECT h.manual_rate_id,
            h.stock_item_id,
            h.stock_item_code,
            h.stock_item_name,
            h.rate_value,
            h.rate_uom_id,
            h.effective_from,
            h.effective_to,
            h.status,
            h.reason,
            h.created_at,
            h.created_by,
            h.last_updated_at,
            h.last_updated_by,
            r.latest_purchase_rate,
            r.latest_purchase_date,
            r.manual_rate_overrides_purchase_rate,
            r.newer_purchase_rate_available,
            r.review_message,
                CASE
                    WHEN h.status = 'ACTIVE'::text AND r.manual_rate_overrides_purchase_rate = true THEN 'REVIEW_REQUIRED'::text
                    WHEN h.status = 'ACTIVE'::text AND r.latest_purchase_rate IS NULL THEN 'ACTIVE_NO_PURCHASE_RATE'::text
                    WHEN h.status = 'ACTIVE'::text THEN 'ACTIVE'::text
                    ELSE 'INACTIVE'::text
                END AS register_status,
                CASE
                    WHEN h.status = 'ACTIVE'::text AND r.newer_purchase_rate_available = true THEN 'Review whether governed costing rate should be revised or ended because a newer purchase rate is available.'::text
                    WHEN h.status = 'ACTIVE'::text AND r.manual_rate_overrides_purchase_rate = true THEN 'Review whether governed costing rate should continue because a purchase rate is available.'::text
                    WHEN h.status = 'ACTIVE'::text AND r.latest_purchase_rate IS NULL THEN 'Governed costing rate is active because no purchase rate is available.'::text
                    ELSE 'Governed costing rate is inactive and retained for audit history.'::text
                END AS recommended_action,
            h.rate_origin,
            h.source_vendor_rate_id,
            h.source_vendor_id,
            h.source_vendor_display_name,
            h.source_rate_value,
            h.source_uom_id,
            h.source_uom_code,
            h.source_valid_from,
            h.source_valid_to,
            h.source_min_order_qty,
            h.source_lead_time_days,
            h.source_remarks,
            h.source_adopted_at
           FROM v_costing_material_manual_rate_history h
             LEFT JOIN v_costing_material_manual_rate_review r ON r.stock_item_id = h.stock_item_id) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);

DO $check$
BEGIN
 IF md5(pg_get_viewdef('public.v_costing_material_manual_rate_history'::regclass,true))<>'e827e401cc2bb8ccadf782ee5b98add4'
 OR md5(pg_get_viewdef('public.v_costing_material_manual_rate_register'::regclass,true))<>'8a4c73fd3f4562679af3ed0638fa87e4'
 THEN RAISE EXCEPTION 'WP05 R39 rollback: original definitions not restored'; END IF;
END $check$;
COMMIT;
