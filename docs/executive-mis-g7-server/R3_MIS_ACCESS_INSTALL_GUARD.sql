-- Read-only catalog guard. Run in same transaction as authorized installation, immediately before mutation.
-- Pinned live catalog at 2026-11-25; not proof that candidate matches original body or is executable.
DO $guard$
DECLARE mismatches text;
BEGIN
WITH expected(kind,identity,fingerprint) AS (VALUES
 ('function','public.get_mis_finance_party_page(text, text, integer, integer)','176ae611778ec33d5102b36afa5e2b8aa715c7227a25282a9803f9c7234636e6'),
 ('function','public.get_mis_finished_goods_sku_page(text, text, integer, integer)','c428b034f4afaa1ff11dc36d4cb7a6d778261d5d8f7055bac252da3208676c0c'),
 ('function','public.get_mis_inventory_item_page(text, text, integer, integer)','52b0748871bde298806d7fced39799cbb6bb90ab65379ca4867a3aec603befd3'),
 ('function','public.get_mis_sales_product_page(text, integer, integer)','a0f73b1e83f88754852f2d2c43a2107cdd00ca9c1449d51d5821ea295ee507d1'),
 ('relation','app_private.mv_mis_executive_summary','f9b24a26b470a7eacee6cad4a5d2972670cb6de130f171610748b5f59f24907e'),
 ('relation','public.mv_mis_executive_summary','0eff56c419540217851f5fe14ffb16356d4c43bce59f8a309eeaae670384c078'),
 ('relation','public.v_mis_batch_pipeline','a4fa589a3bca5efa29765f80a352f8ee8778d97b9177e51df6245de42a602a20'),
 ('relation','public.v_mis_expense_position','363bf500d696dbf3128fdfb2e1502dfb50f7d44cef1ba53ced4f0f5ff2be1c65'),
 ('relation','public.v_mis_fg_inventory_position','f316b2226b884f849060192ec2c52f3401001aff3c48dfabe0379bfd859842bb'),
 ('relation','public.v_mis_finance_outstanding_detail','943e4c01a9f64c39226f2ae6b7b3d56b7602ea6742561bdf1b8f766afed0eabd'),
 ('relation','public.v_mis_finance_outstanding_party_summary','fe39017a5c64aa1e9025ed9bdef79f5bf0a8e4866d751ee477e36c7e9b846b8d'),
 ('relation','public.v_mis_finance_tab_summary','8dbd1e8a20e39e874fc8d3c6fdd0357d573cb87a5901380f6ef3e875d1584c32'),
 ('relation','public.v_mis_financial_position','0cfcd0aae9613245b9c322d0cbc7fb9593a9ffc028dcfbaa8fd937d884dbc0cd'),
 ('relation','public.v_mis_finished_goods_tab_summary','29b10e54b959234ce350e948e0a8ebdd399283cad9e841a1e25da9526fad69ea'),
 ('relation','public.v_mis_inventory_position','4aa17c6082477608372e0b4fc50c97d6d65c06fc60480ff1585987afd14fa130'),
 ('relation','public.v_mis_inventory_tab_summary','b7f4f120b903a5ea51936b96de46698b8dd6fedc1172ce26d674f95f6d034cd7'),
 ('relation','public.v_mis_production_position','2dbe4ce27bcfc8fbd53b981a35975c44a203e590f3f931c496b4dd4a1f944547'),
 ('relation','public.v_mis_production_tab_summary','24b0f076456d7abb954d671ef408afcd4aaa003a8137950024fefbb920afad3a'),
 ('relation','public.v_mis_sales_position','3ce63939726a9219f49224a5e2ef03becf3fced53a2cf2c436a23dd595a78a4d'),
 ('relation','public.v_mis_sales_tab_summary','e66938441032ed391ceb033e1ae1ada3ed0e1d75e7565b088e84f08edb2e8587')
), actual AS (SELECT 'relation' kind,n.nspname||'.'||c.relname identity,encode(sha256(convert_to(jsonb_build_array(pg_get_viewdef(c.oid,true),c.reloptions,c.relacl::text,pg_get_userbyid(c.relowner))::text,'UTF8')),'hex') fingerprint FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname IN ('v_mis_finance_tab_summary','v_mis_production_position','v_mis_finance_outstanding_party_summary','v_mis_financial_position','v_mis_fg_inventory_position','v_mis_production_tab_summary','v_mis_inventory_position','v_mis_sales_tab_summary','v_mis_finance_outstanding_detail','v_mis_sales_position','v_mis_batch_pipeline','v_mis_finished_goods_tab_summary','v_mis_expense_position','v_mis_inventory_tab_summary','mv_mis_executive_summary')) OR (n.nspname='app_private' AND c.relname='mv_mis_executive_summary') UNION ALL SELECT 'function',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')',encode(sha256(convert_to(jsonb_build_array(pg_get_functiondef(p.oid),p.proacl::text,pg_get_userbyid(p.proowner))::text,'UTF8')),'hex') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_mis_finance_party_page','get_mis_finished_goods_sku_page','get_mis_inventory_item_page','get_mis_sales_product_page'))
SELECT string_agg(coalesce(e.identity,a.identity),', ' ORDER BY coalesce(e.identity,a.identity)) INTO mismatches
FROM expected e FULL JOIN actual a USING(kind,identity)
WHERE e.fingerprint IS DISTINCT FROM a.fingerprint;
IF mismatches IS NOT NULL THEN RAISE EXCEPTION 'MIS access catalog drift: %',mismatches; END IF;
END $guard$;
