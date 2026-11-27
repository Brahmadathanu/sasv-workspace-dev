-- Reviewed forward candidate: remove inherited access only; no permission assignments or target changes.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $guard$
BEGIN
 IF md5(pg_get_functiondef('public.ei_sales_access()'::regprocedure)) IS DISTINCT FROM 'ed7beaafc6500872e0036e93b611cd64' THEN RAISE EXCEPTION 'Authorization definition drift: ei_sales_access'; END IF;
 IF md5(pg_get_functiondef('public.ei_can_read_sales()'::regprocedure)) IS DISTINCT FROM 'bc7a78fda54177017addccb52fdad71c' THEN RAISE EXCEPTION 'Authorization definition drift: ei_can_read_sales'; END IF;
 IF md5(pg_get_functiondef('app_private.ei_sales_refresh_job_status()'::regprocedure)) IS DISTINCT FROM '1f0a9a1b3c7609ab3b80be2127f51a99' THEN RAISE EXCEPTION 'Authorization definition drift: ei_sales_refresh_job_status'; END IF;
 IF md5(pg_get_viewdef('public.v_sales_item_classification'::regclass,true)) IS DISTINCT FROM '8c2c33711d6dcc954cf249a3c68fbaef' THEN RAISE EXCEPTION 'Classification definition drift'; END IF;
 IF (SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='sales_item_scope' AND policyname='sales_item_scope_read') IS DISTINCT FROM $policy$((auth.uid() IS NOT NULL) AND (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text) AND (COALESCE(app_has_permission('module:sales-item-classification'::text, 'view'::text), false) OR COALESCE(app_has_permission('module:executive-mis-dashboard'::text, 'view'::text), false) OR COALESCE(app_has_permission('module:sales-data-viewer'::text, 'view'::text), false)))$policy$ THEN RAISE EXCEPTION 'Policy drift'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.ei_sales_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE executive boolean; sales boolean;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  executive := coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false);
  sales := executive;
  IF NOT sales THEN RAISE EXCEPTION 'Sales access denied' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('executive',executive,'sales',sales);
END $function$;

CREATE OR REPLACE FUNCTION public.ei_can_read_sales()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 SELECT auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
 AND (coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false));
$function$;

CREATE OR REPLACE FUNCTION app_private.ei_sales_refresh_job_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR
 NOT (coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false))
 THEN RAISE EXCEPTION 'Sales access denied' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('status',CASE WHEN NOT j.active THEN 'DISABLED' WHEN h.runid IS NULL THEN 'NO_RECORDED_RUN' ELSE h.status END,
 'active',j.active,'last_started_at',h.start_time,'last_finished_at',h.end_time)
 INTO result FROM cron.job j LEFT JOIN LATERAL (
 SELECT runid,status,start_time,end_time FROM cron.job_run_details h
 WHERE h.jobid=j.jobid AND h.username=j.username AND h.command=j.command
 ORDER BY h.runid DESC LIMIT 1
 ) h ON true WHERE j.jobid=17 AND j.username='postgres' AND j.command='select public.refresh_sales_monthly();';
 RETURN coalesce(result,jsonb_build_object('status','UNAVAILABLE_JOB_IDENTITY'));
END $function$;
CREATE OR REPLACE VIEW public.v_sales_item_classification WITH (security_invoker=true,security_barrier=true) AS
 WITH authorized AS (
         SELECT auth.uid() IS NOT NULL AND COALESCE(auth.jwt() ->> 'is_anonymous'::text, 'false'::text) <> 'true'::text AND (COALESCE(app_has_permission('module:sales-item-classification'::text, 'view'::text), false) OR COALESCE(app_has_permission('module:executive-mis-dashboard'::text, 'view'::text), false)) AS allowed
        ), aliases AS (
         SELECT sku_aliases.sku_id,
            count(*) AS alias_count,
            jsonb_agg(sku_aliases.alias_text ORDER BY sku_aliases.alias_text) AS aliases
           FROM sku_aliases
          GROUP BY sku_aliases.sku_id
        ), current_scope AS (
         SELECT DISTINCT ON (sales_item_scope.alias_key) sales_item_scope.id,
            sales_item_scope.alias_text,
            sales_item_scope.alias_key,
            sales_item_scope.effective_from,
            sales_item_scope.scope,
            sales_item_scope.inventory_item_id,
            sales_item_scope.reason,
            sales_item_scope.approved_by,
            sales_item_scope.approval_source,
            sales_item_scope.created_at
           FROM sales_item_scope
          WHERE sales_item_scope.effective_from <= CURRENT_DATE
          ORDER BY sales_item_scope.alias_key, sales_item_scope.effective_from DESC, sales_item_scope.id DESC
        )
 SELECT 'SKU:'::text || k.id AS identity_key,
    'CANONICAL_SKU'::text AS identity_type,
    p.id AS product_id,
    k.id AS sku_id,
    p.item AS item_name,
    k.pack_size::text AS pack_size,
    k.uom AS pack_uom,
    k.is_active,
    k.is_sample,
        CASE
            WHEN k.is_sample IS TRUE THEN 'SASV_SAMPLE'::text
            ELSE 'SASV_CANONICAL_PRODUCT'::text
        END AS scope,
    COALESCE(a.alias_count, 0::bigint) AS alias_count,
    COALESCE(a.aliases, '[]'::jsonb) AS aliases,
    NULL::bigint AS classification_id,
    NULL::bigint AS inventory_item_id,
        CASE
            WHEN a.alias_count IS NULL THEN 'NO_TALLY_ALIAS'::text
            WHEN (EXISTS ( SELECT 1
               FROM sku_aliases sa
                 JOIN current_scope c ON c.alias_key = normalize_key(sa.alias_text)
              WHERE sa.sku_id = k.id AND (c.scope <> ALL (ARRAY['UNCLASSIFIED'::text, 'SASV_HISTORICAL_PACK'::text, 'SASV_SAMPLE'::text])))) THEN 'CLASSIFICATION_CONFLICT'::text
            ELSE 'MAPPED'::text
        END AS mapping_state
   FROM product_skus k
     JOIN products p ON p.id = k.product_id
     LEFT JOIN aliases a ON a.sku_id = k.id
     CROSS JOIN authorized z
  WHERE z.allowed
UNION ALL
 SELECT 'PRODUCT:'::text || p.id AS identity_key,
    'PRODUCT_WITHOUT_SKU'::text AS identity_type,
    p.id AS product_id,
    NULL::integer AS sku_id,
    p.item AS item_name,
    NULL::text AS pack_size,
    NULL::text AS pack_uom,
    NULL::boolean AS is_active,
    NULL::boolean AS is_sample,
    'SASV_CANONICAL_PRODUCT'::text AS scope,
    0 AS alias_count,
    '[]'::jsonb AS aliases,
    NULL::bigint AS classification_id,
    NULL::bigint AS inventory_item_id,
    'NO_SKU'::text AS mapping_state
   FROM products p
     CROSS JOIN authorized z
  WHERE z.allowed AND NOT (EXISTS ( SELECT 1
           FROM product_skus k
          WHERE k.product_id = p.id))
UNION ALL
 SELECT 'SCOPE:'::text || c.alias_key AS identity_key,
    'SCOPE_ONLY'::text AS identity_type,
    NULL::integer AS product_id,
    NULL::integer AS sku_id,
    c.alias_text AS item_name,
    NULL::text AS pack_size,
    NULL::text AS pack_uom,
    NULL::boolean AS is_active,
    NULL::boolean AS is_sample,
    c.scope,
    0 AS alias_count,
    jsonb_build_array(c.alias_text) AS aliases,
    c.id AS classification_id,
    c.inventory_item_id,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM sku_aliases a
              WHERE normalize_key(a.alias_text) = c.alias_key)) THEN 'RECONCILE_WITH_SKU'::text
            WHEN c.scope = ANY (ARRAY['SASV_HISTORICAL_PACK'::text, 'SASV_SAMPLE'::text]) THEN 'SKU_PENDING'::text
            WHEN c.scope = 'UNCLASSIFIED'::text THEN 'REVIEW'::text
            ELSE 'CLASSIFIED'::text
        END AS mapping_state
   FROM current_scope c
     CROSS JOIN authorized z
  WHERE z.allowed;
ALTER POLICY sales_item_scope_read ON public.sales_item_scope USING (((auth.uid() IS NOT NULL) AND (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text) AND (COALESCE(app_has_permission('module:sales-item-classification'::text, 'view'::text), false) OR COALESCE(app_has_permission('module:executive-mis-dashboard'::text, 'view'::text), false))));
COMMIT;
