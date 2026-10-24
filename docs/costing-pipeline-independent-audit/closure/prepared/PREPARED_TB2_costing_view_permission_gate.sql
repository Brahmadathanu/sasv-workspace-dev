-- PREPARED (not applied). CI-017/CI-019 (+CI-020 grant hygiene): 35 SECURITY DEFINER costing views in public had no permission gate,
-- so every logged-in account (25) could read costing data through them, including per-employee salary
-- (v_costing_staff_classification_register: 164 rows, 142 with salary).
-- Change (no data, no snapshot touched):
--  1. public.fn_costing_view_allowed(): true for postgres/service_role (refresh jobs, definer RPCs) or a user with VIEW on any costing module
--     (module:costing-control-center | cost-build-manager | cost-sheet-review | material-cost-manager).
--  2. Each of the 35 views is replaced by: select q.* from (<identical live definition>) q where (select public.fn_costing_view_allowed());
--     same columns and types (CREATE OR REPLACE enforces it), still owned by postgres, dependants unaffected.
--     The 5 views already gated by the W1 pattern are left as they are.
--  2b. The same gate on 14 further ungated views: 2 declared security_invoker=false (definer: manual-rate register/history) and
--     12 SECURITY INVOKER views that read costing tables every logged-in user may SELECT (detailed cost sheet, scheme comparison,
--     manual-rate review, option lists). Their live reloptions are kept. Total 49 views gated; 13 already gated are untouched.
--  3. Grant hygiene on all 62 public costing views: anon gets nothing; authenticated keeps SELECT only.
-- Guards: stops if any of the 35 definitions or any ACL differs from the 19 Oct 2026 live baseline (md5 of pg_get_viewdef).

set local search_path = public, extensions, pg_temp;  -- the definitions below are pg_get_viewdef text produced with public on the path

do $g$
declare v_bad text := ''; r record;
begin
  for r in select * from (values
    ('v_cost_sheet_snapshot_sku_monthly_comparison','b20a9206d651ea3361a462fac8b069be'),
    ('v_costing_cost_pool_monthly_summary','69a084f6db0ac51edb349ea8b2d53bd7'),
    ('v_costing_expense_head_mapping_register','ee1c50dbec38630ec99f1980e8eaa4aa'),
    ('v_costing_manual_cost_pool_monthly_summary','9ae12dcf3b565f1c891cc5539451b25b'),
    ('v_costing_manual_cost_pool_provision_register','fc39cbda5ff3b1b22d2c41992c5cd8f4'),
    ('v_costing_manual_rate_live_rm_blockers','b0e223ed7f40f943bd1a6028dbaa30b1'),
    ('v_costing_manual_rate_manager_action_queue','7141d1d4dea5aaa1f026e75833c1316a'),
    ('v_costing_material_review_acceptance_register','dc74fe273d1f2f3f6ec162e06b2d7dfd'),
    ('v_costing_policy_manager_scheme_policy_history','316569f6fae87153320e0713e557c269'),
    ('v_costing_policy_manager_selling_policy_history','c2c2abd129619e5e8d19d8210086a75a'),
    ('v_costing_policy_manager_sku_overview','2c481567614179843f19ad595ddf9051'),
    ('v_costing_pricing_commercial_sales_basis','5be1ad0bd0d6c1642bc3f692d508e577'),
    ('v_costing_pricing_control_dashboard','ba3ff155f476e894389d298e19066775'),
    ('v_costing_pricing_control_integrity_audit','bae285a4810430a028b44afddfb1afd6'),
    ('v_costing_pricing_cost_sheet_line_traceability','a72806461a9f2255b06f8e1a936315e7'),
    ('v_costing_pricing_cost_sheet_rm_line_traceability','dd6b6ead35ed4c1ebfce372c11f82272'),
    ('v_costing_pricing_material_action_drilldown','faeb509a1008723411548ae4b849fd22'),
    ('v_costing_pricing_material_action_queue','63195bfb5d0359c06f0eb06994cc5850'),
    ('v_costing_pricing_material_rate_issue_lines','ca6aac1ce2d7da33fdb30fd7664d9fa2'),
    ('v_costing_pricing_printable_cost_sheet_lines','a6aa37d233414c8f68b01625ee2bdaf7'),
    ('v_costing_pricing_printable_cost_sheet_product_summary','05c70d14e5312436563605f40a0b0aae'),
    ('v_costing_pricing_product_status_summary','a6b4f8db71ff68f45c75c835692b8fb1'),
    ('v_costing_pricing_review_action_item_drilldown','4bb95209c097fbafebd6591f05724ce8'),
    ('v_costing_pricing_review_top_action_items','896e61995f628701dc083f22861917a4'),
    ('v_costing_pricing_review_workbench_summary','1d04e89aff98b43b5485627049c306da'),
    ('v_costing_pricing_selected_scheme_policy','11883004be2817ef9aa9676dec0bb0d8'),
    ('v_costing_pricing_sku_control_status','3f45b751c885ec9b793f0484410ed4b9'),
    ('v_costing_pricing_sku_status_diagnosis','bedc33eb10d56beb663e60c956bb4d61'),
    ('v_costing_pricing_workflow_diagnostics','a3a55d578ebd5cc4f57d11bc7198b34d'),
    ('v_costing_scheme_master_audit','3784aaacc5a97c484cc0c0e2d13052ab'),
    ('v_costing_scheme_policy_selected_overview','a356c25d9f555b98ff93e9759f7db855'),
    ('v_costing_staff_classification_register','9fe5a23ed1a2d2b074aa7ebc5c652449'),
    ('v_costing_staff_cost_pool_summary','090b93ce42ece9a2e2833685b6d1933d'),
    ('v_costing_unclassified_staff_for_costing','7dc5fafd5d45d5745c375811bc7ccc57'),
    ('v_costing_unmapped_expense_heads_for_mapping','754e72cbb0f03e632795ff2c2693b6e2'),
    ('v_costing_expense_allocation_pool_options','b5bbd5a3cb4949063f6ec57ba29d2fa1'),
    ('v_costing_manual_provision_pool_options','bb34444545cf4a90a7b1e78071af7f88'),
    ('v_costing_manual_provision_type_options','ead5f877ef8a8eaff0a32310d2287ba5'),
    ('v_costing_material_manual_rate_history','f4e4a260a219a733cb682a524e7434b1'),
    ('v_costing_material_manual_rate_register','62b58e72c5bb67d091796770e5236915'),
    ('v_costing_material_manual_rate_review','6ddab6d246f48b7764f3a61d4a9d2d5b'),
    ('v_costing_policy_manager_scheme_options','ab7138510246256233d02b6fd8b549d5'),
    ('v_costing_pricing_sku_detailed_cost_sheet','44686d2dc05aa2b407c4536390abe395'),
    ('v_costing_pricing_sku_scheme_comparison','e5cdb5d8f20abce91a708d7243e8dbf9'),
    ('v_costing_pricing_sku_selector','21065c0641a5f2e68984ef72022556bc'),
    ('v_costing_scheme_master_register','6ffbe25985b310a7117e2ab74c4822d2'),
    ('v_costing_scheme_policy_rule_register','79d17cc5170908805332785f9e7c7923'),
    ('v_costing_scheme_policy_scope_options','115a835663ca9d22f86f3367bd243141'),
    ('v_costing_staff_costing_class_options','2f9f4ab0d694e1340bcaa82860cb7fec')
  ) x(v, m) loop
    if to_regclass('public.'||r.v) is null then v_bad := v_bad||' missing:'||r.v;
    elsif md5(pg_get_viewdef(('public.'||r.v)::regclass)) <> r.m then v_bad := v_bad||' changed:'||r.v;
    end if;
  end loop;
  if to_regprocedure('public.app_has_permission(text,text)') is null then v_bad := v_bad||' app_has_permission missing'; end if;
  if v_bad <> '' then raise exception 'TB2_GUARD: live differs from the 19 Oct baseline:%', v_bad; end if;
end $g$;

create or replace function public.fn_costing_view_allowed()
returns boolean language sql stable security invoker set search_path = public, pg_temp as $f$
  select current_user = any (array['postgres','service_role']::name[])
      or public.app_has_permission('module:costing-control-center','view')
      or public.app_has_permission('module:cost-build-manager','view')
      or public.app_has_permission('module:cost-sheet-review','view')
      or public.app_has_permission('module:material-cost-manager','view')
$f$;
comment on function public.fn_costing_view_allowed() is 'CI-017 (closure 2026-10): row gate for SECURITY DEFINER costing views';
revoke all on function public.fn_costing_view_allowed() from public, anon;
grant execute on function public.fn_costing_view_allowed() to authenticated, service_role;

create or replace view public.v_cost_sheet_snapshot_sku_monthly_comparison as
select q.* from (
SELECT snapshot_period_start,
    product_id,
    product_name,
    category_name,
    subcategory_name,
    group_name,
    sub_group_name,
    sku_id,
    sku_column_label,
    rm_cost,
    pm_cost,
    total_material_cost,
    direct_labour_cost,
    manufacturing_cop,
    internal_loaded_cost,
    mrp_ik,
    mrp_ok,
    selling_price_ik,
    selling_price_ok,
    sales_realisation_ik,
    sales_realisation_ok,
    profit_value_ik,
    profit_value_ok,
    profit_percent_ik,
    profit_percent_ok,
    cop_percent_mrp_ik,
    cop_percent_mrp_ok,
    cost_sheet_status,
    cost_sheet_note,
    snapshot_refreshed_at,
    previous_month_period_start,
    previous_month_manufacturing_cop,
    previous_month_internal_loaded_cost,
    previous_month_selling_price_ik,
    previous_month_selling_price_ok,
    previous_month_profit_value_ik,
    previous_month_profit_value_ok,
    previous_year_period_start,
    previous_year_manufacturing_cop,
    previous_year_internal_loaded_cost,
    previous_year_selling_price_ik,
    previous_year_selling_price_ok,
    previous_year_profit_value_ik,
    previous_year_profit_value_ok,
    manufacturing_cop_mom_change,
    manufacturing_cop_mom_change_percent,
    internal_loaded_cost_mom_change,
    internal_loaded_cost_mom_change_percent,
    profit_value_ik_mom_change,
    profit_value_ok_mom_change,
    manufacturing_cop_yoy_change,
    manufacturing_cop_yoy_change_percent,
    internal_loaded_cost_yoy_change,
    internal_loaded_cost_yoy_change_percent,
    profit_value_ik_yoy_change,
    profit_value_ok_yoy_change
   FROM costing.v_cost_sheet_snapshot_sku_monthly_comparison
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_cost_pool_monthly_summary as
select q.* from (
SELECT c.period_start,
    c.allocation_pool,
    COALESCE(o.allocation_pool_label, c.allocation_pool) AS allocation_pool_label,
    c.staff_pool_amount,
    c.expense_provision_amount,
    c.total_pool_amount,
        CASE
            WHEN (c.allocation_pool = 'DIRECT_LABOUR'::text) THEN 'STAFF_CLASSIFICATION'::text
            WHEN ((c.staff_pool_amount <> (0)::numeric) AND (c.expense_provision_amount <> (0)::numeric) AND (COALESCE(c.manual_provision_amount, (0)::numeric) <> (0)::numeric)) THEN 'STAFF_EXPENSE_AND_MANUAL'::text
            WHEN ((c.staff_pool_amount <> (0)::numeric) AND (COALESCE(c.manual_provision_amount, (0)::numeric) <> (0)::numeric)) THEN 'STAFF_AND_MANUAL'::text
            WHEN ((c.expense_provision_amount <> (0)::numeric) AND (COALESCE(c.manual_provision_amount, (0)::numeric) <> (0)::numeric)) THEN 'EXPENSE_AND_MANUAL'::text
            WHEN (COALESCE(c.manual_provision_amount, (0)::numeric) <> (0)::numeric) THEN 'MANUAL_ONLY'::text
            WHEN ((c.staff_pool_amount <> (0)::numeric) AND (c.expense_provision_amount <> (0)::numeric)) THEN 'STAFF_AND_EXPENSE'::text
            WHEN (c.staff_pool_amount <> (0)::numeric) THEN 'STAFF_ONLY'::text
            WHEN (c.expense_provision_amount <> (0)::numeric) THEN 'EXPENSE_ONLY'::text
            ELSE 'NO_AMOUNT'::text
        END AS pool_source_type,
        CASE
            WHEN (c.total_pool_amount IS NULL) THEN 'REVIEW_REQUIRED'::text
            WHEN (c.total_pool_amount = (0)::numeric) THEN 'REVIEW_REQUIRED'::text
            ELSE 'READY'::text
        END AS pool_status,
    COALESCE(c.manual_provision_amount, (0)::numeric) AS manual_provision_amount
   FROM (costing.v_cost_pool_monthly_combined c
     LEFT JOIN v_costing_expense_allocation_pool_options o ON ((o.allocation_pool = c.allocation_pool)))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_expense_head_mapping_register as
select q.* from (
SELECT m.id,
    m.expense_group,
    m.head_name,
    m.allocation_pool,
    COALESCE(o.allocation_pool_label, m.allocation_pool) AS allocation_pool_label,
    m.include_in_costing,
        CASE
            WHEN ((NOT m.include_in_costing) OR (m.allocation_pool = 'EXCLUDED'::text)) THEN 'EXCLUDED'::text
            WHEN m.is_active THEN 'ACTIVE'::text
            ELSE 'INACTIVE'::text
        END AS mapping_status,
    m.remarks,
    m.is_active,
    m.created_at,
    m.updated_at,
    u.snapshot_count,
    u.first_seen_date,
    u.latest_seen_date,
    u.max_seen_value
   FROM ((costing.expense_head_costing_map m
     LEFT JOIN v_costing_expense_allocation_pool_options o ON ((o.allocation_pool = m.allocation_pool)))
     LEFT JOIN costing.v_unmapped_expense_heads_for_costing u ON (((u.expense_group = m.expense_group) AND (u.head_name = m.head_name))))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_manual_cost_pool_monthly_summary as
select q.* from (
WITH periods AS (
         SELECT (generate_series(('2026-06-01'::date)::timestamp with time zone, (((date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) + '1 year'::interval))::date)::timestamp with time zone, '1 mon'::interval))::date AS period_start
        ), rec AS (
         SELECT p.period_start,
            r.id,
            'RECURRING'::text AS src,
            r.provision_type,
            r.provision_key,
            r.provision_label,
            r.allocation_pool,
            r.monthly_amount AS provision_amount,
            r.source_reference,
            r.approval_reference AS remarks
           FROM (costing.recurring_cost_pool_provision r
             JOIN periods p ON (((p.period_start >= r.effective_from) AND ((r.effective_to IS NULL) OR (p.period_start <= r.effective_to)))))
          WHERE ((r.status = ANY (ARRAY['APPROVED'::text, 'CLOSED'::text])) AND (NOT (EXISTS ( SELECT 1
                   FROM costing.manual_cost_pool_provisions m
                  WHERE (m.is_active AND (m.period_start = p.period_start) AND (m.provision_key = r.provision_key) AND (m.allocation_pool = r.allocation_pool))))))
        ), man AS (
         SELECT m.period_start,
            m.id,
            'PERIOD'::text AS src,
            m.provision_type,
            m.provision_key,
            m.provision_label,
            m.allocation_pool,
            m.provision_amount,
            m.source_reference,
            m.remarks
           FROM costing.manual_cost_pool_provisions m
          WHERE m.is_active
        ), u AS (
         SELECT rec.period_start,
            rec.id,
            rec.src,
            rec.provision_type,
            rec.provision_key,
            rec.provision_label,
            rec.allocation_pool,
            rec.provision_amount,
            rec.source_reference,
            rec.remarks
           FROM rec
        UNION ALL
         SELECT man.period_start,
            man.id,
            man.src,
            man.provision_type,
            man.provision_key,
            man.provision_label,
            man.allocation_pool,
            man.provision_amount,
            man.source_reference,
            man.remarks
           FROM man
        )
 SELECT u.period_start,
    u.allocation_pool,
    COALESCE(o.allocation_pool_label, u.allocation_pool) AS allocation_pool_label,
    sum(u.provision_amount) AS manual_provision_amount,
    count(*) AS active_provision_count,
    jsonb_agg(jsonb_build_object('provision_id', u.id, 'source', u.src, 'provision_type', u.provision_type, 'provision_key', u.provision_key, 'provision_label', u.provision_label, 'provision_amount', u.provision_amount, 'source_reference', u.source_reference, 'remarks', u.remarks) ORDER BY u.provision_type, u.provision_key, u.id) AS provision_details
   FROM (u
     LEFT JOIN v_costing_manual_provision_pool_options o ON ((o.allocation_pool = u.allocation_pool)))
  GROUP BY u.period_start, u.allocation_pool, COALESCE(o.allocation_pool_label, u.allocation_pool)
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_manual_cost_pool_provision_register as
select q.* from (
SELECT p.id AS provision_id,
    p.period_start,
    p.allocation_pool,
    COALESCE(pool_opt.allocation_pool_label, p.allocation_pool) AS allocation_pool_label,
    p.provision_type,
    COALESCE(type_opt.provision_type_label, p.provision_type) AS provision_type_label,
    p.provision_key,
    p.provision_label,
    p.provision_amount,
    p.source_reference,
    p.remarks,
    p.is_active,
        CASE
            WHEN (p.is_active IS NOT TRUE) THEN 'INACTIVE'::text
            WHEN (p.provision_amount = (0)::numeric) THEN 'ZERO_AMOUNT'::text
            ELSE 'ACTIVE'::text
        END AS provision_status,
        CASE
            WHEN (p.is_active IS NOT TRUE) THEN 'Provision is inactive and excluded from costing.'::text
            WHEN (p.provision_amount = (0)::numeric) THEN 'Provision amount is zero. Review whether this row is still required.'::text
            ELSE 'Manual cost pool provision is active.'::text
        END AS provision_note,
    p.created_at,
    p.updated_at
   FROM ((costing.manual_cost_pool_provisions p
     LEFT JOIN v_costing_manual_provision_pool_options pool_opt ON ((pool_opt.allocation_pool = p.allocation_pool)))
     LEFT JOIN v_costing_manual_provision_type_options type_opt ON ((type_opt.provision_type = p.provision_type)))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_manual_rate_live_rm_blockers as
select q.* from (
SELECT NULL::date AS period_start,
    'BLOCKED'::text AS material_line_status,
    'MISSING_REQUIRED_RM_RATE'::text AS material_issue_code,
    string_agg(DISTINCT l.source, ', '::text ORDER BY l.source) AS bom_source,
    l.purchase_stock_item_id AS stock_item_id,
    si.code AS stock_item_code,
    l.purchase_stock_item_name AS stock_item_name,
    NULL::numeric AS selected_rate,
    NULL::text AS rate_source,
    NULL::date AS rate_date,
    count(*) AS affected_line_count,
    count(DISTINCT l.product_id) AS affected_product_count,
    (0)::bigint AS affected_sku_count,
    'Required RM rate is missing. Set manual/policy rate or correct purchase/alias/master mapping.'::text AS recommended_action,
    1 AS priority_sort,
    now() AS snapshot_refreshed_at,
    'SET_MANUAL_RATE'::text AS manager_action_code
   FROM (costing.v_product_rm_standard_cost_line l
     LEFT JOIN inv_stock_item si ON ((si.id = l.purchase_stock_item_id)))
  WHERE ((l.approval_block_flag = true) AND (l.action_required = 'BLOCKING_MISSING_REQUIRED_RATE'::text))
  GROUP BY l.purchase_stock_item_id, l.purchase_stock_item_name, si.code
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_manual_rate_manager_action_queue as
select q.* from (
WITH workbench_rate_actions AS (
         SELECT 'WORKBENCH_RATE_ISSUE'::text AS action_source,
            s.period_start,
            s.material_line_status,
            s.material_issue_code,
            s.bom_source,
            s.stock_item_id,
            s.stock_item_code,
            s.stock_item_name,
            s.selected_rate,
            s.rate_source,
            s.rate_date,
            s.affected_line_count,
            s.affected_product_count,
            s.affected_sku_count,
            s.recommended_action,
            s.priority_sort,
            s.snapshot_refreshed_at,
            NULL::bigint AS manual_rate_id,
            NULL::numeric AS manual_rate_value,
            NULL::date AS manual_rate_effective_from,
            NULL::date AS manual_rate_effective_to,
            NULL::text AS manual_rate_status,
            NULL::numeric AS latest_purchase_rate,
            NULL::date AS latest_purchase_date,
            false AS manual_rate_overrides_purchase_rate,
            false AS newer_purchase_rate_available,
                CASE
                    WHEN (s.material_issue_code = ANY (ARRAY['MISSING_REQUIRED_PM_RATE'::text, 'MISSING_REQUIRED_RM_RATE'::text])) THEN 'SET_MANUAL_RATE'::text
                    WHEN (s.material_issue_code = ANY (ARRAY['PM_MANUAL_RATE_USED'::text, 'RM_MANUAL_RATE_USED'::text])) THEN 'REVIEW_MANUAL_RATE'::text
                    WHEN (s.material_issue_code = ANY (ARRAY['STALE_PM_PURCHASE_RATE'::text, 'STALE_RM_PURCHASE_RATE'::text, 'PM_STOCK_VALUATION_FALLBACK'::text, 'RM_STOCK_VALUATION_FALLBACK'::text])) THEN 'REVIEW_OR_SET_MANUAL_RATE'::text
                    ELSE 'REVIEW_RATE'::text
                END AS manager_action_code
           FROM v_costing_pricing_review_top_action_items_snapshot s
          WHERE (s.material_issue_code = ANY (ARRAY['MISSING_REQUIRED_PM_RATE'::text, 'MISSING_REQUIRED_RM_RATE'::text, 'PM_MANUAL_RATE_USED'::text, 'RM_MANUAL_RATE_USED'::text, 'STALE_PM_PURCHASE_RATE'::text, 'STALE_RM_PURCHASE_RATE'::text, 'PM_STOCK_VALUATION_FALLBACK'::text, 'RM_STOCK_VALUATION_FALLBACK'::text, 'OPTIONAL_PM_RATE_MISSING'::text]))
        ), live_rm_blockers AS (
         SELECT 'LIVE_RM_BLOCKER'::text AS action_source,
            l.period_start,
            l.material_line_status,
            l.material_issue_code,
            l.bom_source,
            l.stock_item_id,
            l.stock_item_code,
            l.stock_item_name,
            l.selected_rate,
            l.rate_source,
            l.rate_date,
            l.affected_line_count,
            l.affected_product_count,
            l.affected_sku_count,
            l.recommended_action,
            l.priority_sort,
            l.snapshot_refreshed_at,
            NULL::bigint AS manual_rate_id,
            NULL::numeric AS manual_rate_value,
            NULL::date AS manual_rate_effective_from,
            NULL::date AS manual_rate_effective_to,
            NULL::text AS manual_rate_status,
            NULL::numeric AS latest_purchase_rate,
            NULL::date AS latest_purchase_date,
            false AS manual_rate_overrides_purchase_rate,
            false AS newer_purchase_rate_available,
            l.manager_action_code
           FROM v_costing_manual_rate_live_rm_blockers l
          WHERE (NOT (EXISTS ( SELECT 1
                   FROM workbench_rate_actions w
                  WHERE ((w.stock_item_id = l.stock_item_id) AND (w.material_issue_code = l.material_issue_code)))))
        ), manual_rate_purchase_alerts AS (
         SELECT 'MANUAL_RATE_PURCHASE_ALERT'::text AS action_source,
            NULL::date AS period_start,
            'REVIEW_REQUIRED'::text AS material_line_status,
                CASE
                    WHEN (r.newer_purchase_rate_available = true) THEN 'MANUAL_RATE_NEWER_PURCHASE_AVAILABLE'::text
                    ELSE 'MANUAL_RATE_OVERRIDES_PURCHASE_RATE'::text
                END AS material_issue_code,
            NULL::text AS bom_source,
            r.stock_item_id,
            r.stock_item_code,
            r.stock_item_name,
            r.manual_rate_value AS selected_rate,
            'MANUAL_RATE'::text AS rate_source,
            r.manual_rate_effective_from AS rate_date,
            NULL::bigint AS affected_line_count,
            NULL::bigint AS affected_product_count,
            NULL::bigint AS affected_sku_count,
            r.review_message AS recommended_action,
                CASE
                    WHEN (r.newer_purchase_rate_available = true) THEN 20
                    ELSE 30
                END AS priority_sort,
            r.manual_rate_last_updated_at AS snapshot_refreshed_at,
            r.manual_rate_id,
            r.manual_rate_value,
            r.manual_rate_effective_from,
            r.manual_rate_effective_to,
            r.manual_rate_status,
            r.latest_purchase_rate,
            r.latest_purchase_date,
            r.manual_rate_overrides_purchase_rate,
            r.newer_purchase_rate_available,
            'REVIEW_CLOSE_MANUAL_RATE'::text AS manager_action_code
           FROM v_costing_material_manual_rate_review r
          WHERE ((r.manual_rate_id IS NOT NULL) AND (r.latest_purchase_rate IS NOT NULL))
        )
 SELECT workbench_rate_actions.action_source,
    workbench_rate_actions.period_start,
    workbench_rate_actions.material_line_status,
    workbench_rate_actions.material_issue_code,
    workbench_rate_actions.bom_source,
    workbench_rate_actions.stock_item_id,
    workbench_rate_actions.stock_item_code,
    workbench_rate_actions.stock_item_name,
    workbench_rate_actions.selected_rate,
    workbench_rate_actions.rate_source,
    workbench_rate_actions.rate_date,
    workbench_rate_actions.affected_line_count,
    workbench_rate_actions.affected_product_count,
    workbench_rate_actions.affected_sku_count,
    workbench_rate_actions.recommended_action,
    workbench_rate_actions.priority_sort,
    workbench_rate_actions.snapshot_refreshed_at,
    workbench_rate_actions.manual_rate_id,
    workbench_rate_actions.manual_rate_value,
    workbench_rate_actions.manual_rate_effective_from,
    workbench_rate_actions.manual_rate_effective_to,
    workbench_rate_actions.manual_rate_status,
    workbench_rate_actions.latest_purchase_rate,
    workbench_rate_actions.latest_purchase_date,
    workbench_rate_actions.manual_rate_overrides_purchase_rate,
    workbench_rate_actions.newer_purchase_rate_available,
    workbench_rate_actions.manager_action_code
   FROM workbench_rate_actions
UNION ALL
 SELECT live_rm_blockers.action_source,
    live_rm_blockers.period_start,
    live_rm_blockers.material_line_status,
    live_rm_blockers.material_issue_code,
    live_rm_blockers.bom_source,
    live_rm_blockers.stock_item_id,
    live_rm_blockers.stock_item_code,
    live_rm_blockers.stock_item_name,
    live_rm_blockers.selected_rate,
    live_rm_blockers.rate_source,
    live_rm_blockers.rate_date,
    live_rm_blockers.affected_line_count,
    live_rm_blockers.affected_product_count,
    live_rm_blockers.affected_sku_count,
    live_rm_blockers.recommended_action,
    live_rm_blockers.priority_sort,
    live_rm_blockers.snapshot_refreshed_at,
    live_rm_blockers.manual_rate_id,
    live_rm_blockers.manual_rate_value,
    live_rm_blockers.manual_rate_effective_from,
    live_rm_blockers.manual_rate_effective_to,
    live_rm_blockers.manual_rate_status,
    live_rm_blockers.latest_purchase_rate,
    live_rm_blockers.latest_purchase_date,
    live_rm_blockers.manual_rate_overrides_purchase_rate,
    live_rm_blockers.newer_purchase_rate_available,
    live_rm_blockers.manager_action_code
   FROM live_rm_blockers
UNION ALL
 SELECT manual_rate_purchase_alerts.action_source,
    manual_rate_purchase_alerts.period_start,
    manual_rate_purchase_alerts.material_line_status,
    manual_rate_purchase_alerts.material_issue_code,
    manual_rate_purchase_alerts.bom_source,
    manual_rate_purchase_alerts.stock_item_id,
    manual_rate_purchase_alerts.stock_item_code,
    manual_rate_purchase_alerts.stock_item_name,
    manual_rate_purchase_alerts.selected_rate,
    manual_rate_purchase_alerts.rate_source,
    manual_rate_purchase_alerts.rate_date,
    manual_rate_purchase_alerts.affected_line_count,
    manual_rate_purchase_alerts.affected_product_count,
    manual_rate_purchase_alerts.affected_sku_count,
    manual_rate_purchase_alerts.recommended_action,
    manual_rate_purchase_alerts.priority_sort,
    manual_rate_purchase_alerts.snapshot_refreshed_at,
    manual_rate_purchase_alerts.manual_rate_id,
    manual_rate_purchase_alerts.manual_rate_value,
    manual_rate_purchase_alerts.manual_rate_effective_from,
    manual_rate_purchase_alerts.manual_rate_effective_to,
    manual_rate_purchase_alerts.manual_rate_status,
    manual_rate_purchase_alerts.latest_purchase_rate,
    manual_rate_purchase_alerts.latest_purchase_date,
    manual_rate_purchase_alerts.manual_rate_overrides_purchase_rate,
    manual_rate_purchase_alerts.newer_purchase_rate_available,
    manual_rate_purchase_alerts.manager_action_code
   FROM manual_rate_purchase_alerts
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_material_review_acceptance_register as
select q.* from (
SELECT acceptance_id,
    period_start,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    material_area,
    action_severity,
    recommended_ui_route,
    issue_codes,
    warning_codes,
    action_required_summary,
    action_note_summary,
    bom_sources,
    material_line_statuses,
    affected_line_count,
    affected_product_count,
    affected_sku_count,
    approval_blocking_line_count,
    approval_blocking_sku_count,
    review_line_count,
    review_sku_count,
    acceptance_scope,
    acceptance_status,
    accepted_by,
    accepted_by_email,
    accepted_at,
    effective_from,
    effective_to,
    source_snapshot_refreshed_at,
    acceptance_reason,
    acceptance_note,
    created_at,
    updated_at,
    current_queue_snapshot_refreshed_at,
    current_queue_action_severity,
    current_queue_affected_sku_count,
    current_queue_row_exists,
    acceptance_register_status
   FROM costing.v_material_review_acceptance_register
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_policy_manager_scheme_policy_history as
select q.* from (
WITH sku_lookup AS (
         SELECT DISTINCT v_costing_policy_manager_sku_overview.sku_id,
            v_costing_policy_manager_sku_overview.product_id,
            v_costing_policy_manager_sku_overview.product_name,
            v_costing_policy_manager_sku_overview.pack_size,
            v_costing_policy_manager_sku_overview.pack_uom,
            v_costing_policy_manager_sku_overview.sku_column_label,
            v_costing_policy_manager_sku_overview.sku_display_name
           FROM v_costing_policy_manager_sku_overview
        ), product_lookup AS (
         SELECT v_costing_policy_manager_sku_overview.product_id,
            max(v_costing_policy_manager_sku_overview.product_name) AS product_name
           FROM v_costing_policy_manager_sku_overview
          GROUP BY v_costing_policy_manager_sku_overview.product_id
        )
 SELECT ssp.id AS policy_id,
    ssp.product_id,
    ssp.sku_id,
    sl.product_id AS sku_product_id,
    COALESCE(sl.product_name, pl.product_name) AS product_name,
    sl.pack_size,
    sl.pack_uom,
    sl.sku_column_label,
        CASE
            WHEN (ssp.sku_id IS NOT NULL) THEN sl.sku_display_name
            WHEN (ssp.product_id IS NOT NULL) THEN pl.product_name
            ELSE NULL::text
        END AS policy_display_name,
        CASE
            WHEN (ssp.sku_id IS NOT NULL) THEN 'SKU_LEVEL'::text
            WHEN (ssp.product_id IS NOT NULL) THEN 'PRODUCT_LEVEL'::text
            ELSE 'GLOBAL_OR_UNKNOWN'::text
        END AS policy_level,
    upper(ssp.region_code) AS region_code,
    sm.id AS scheme_id,
    sm.scheme_name,
    sm.paid_qty,
    sm.free_qty,
    ssp.effective_from,
    ssp.effective_to,
    ssp.is_active,
    ssp.remarks,
    ssp.created_at,
    ssp.updated_at
   FROM (((costing.sku_scheme_policy ssp
     LEFT JOIN sku_lookup sl ON ((sl.sku_id = ssp.sku_id)))
     LEFT JOIN product_lookup pl ON ((pl.product_id = ssp.product_id)))
     JOIN costing.scheme_master sm ON ((sm.id = ssp.scheme_id)))
  ORDER BY COALESCE(sl.product_name, pl.product_name), sl.pack_size, (upper(ssp.region_code)), ssp.effective_from DESC, ssp.id DESC
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_policy_manager_selling_policy_history as
select q.* from (
WITH sku_lookup AS (
         SELECT DISTINCT v_costing_policy_manager_sku_overview.sku_id,
            v_costing_policy_manager_sku_overview.product_id,
            v_costing_policy_manager_sku_overview.product_name,
            v_costing_policy_manager_sku_overview.pack_size,
            v_costing_policy_manager_sku_overview.pack_uom,
            v_costing_policy_manager_sku_overview.sku_column_label,
            v_costing_policy_manager_sku_overview.sku_display_name
           FROM v_costing_policy_manager_sku_overview
        )
 SELECT spp.id AS policy_id,
    spp.sku_id,
    sl.product_id,
    sl.product_name,
    sl.pack_size,
    sl.pack_uom,
    sl.sku_column_label,
    sl.sku_display_name,
    spp.gst_percent,
    spp.ik_discount_percent,
    spp.ok_discount_percent,
    spp.ik_discount_amount,
    spp.ok_discount_amount,
    spp.contingency_percent,
    spp.effective_from,
    spp.effective_to,
    spp.is_active,
    spp.remarks,
    spp.created_at,
    spp.updated_at
   FROM (costing.sku_selling_price_policy spp
     LEFT JOIN sku_lookup sl ON ((sl.sku_id = spp.sku_id)))
  ORDER BY sl.product_name, sl.pack_size, spp.effective_from DESC, spp.id DESC
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_policy_manager_sku_overview as
select q.* from (
SELECT sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    sku_column_label,
    sku_display_name,
    mrp_ik,
    mrp_ok,
    selling_price_policy_id,
    gst_percent,
    ik_discount_percent,
    ok_discount_percent,
    ik_discount_amount,
    ok_discount_amount,
    contingency_percent,
    selling_price_effective_from,
    selling_price_effective_to,
    selling_price_policy_active,
    selling_price_policy_remarks,
    ik_selected_scheme_id,
    ik_selected_scheme_name,
    ik_scheme_paid_qty,
    ik_scheme_free_qty,
    ik_scheme_effective_from,
    ik_scheme_effective_to,
    ik_scheme_policy_active,
    ok_selected_scheme_id,
    ok_selected_scheme_name,
    ok_scheme_paid_qty,
    ok_scheme_free_qty,
    ok_scheme_effective_from,
    ok_scheme_effective_to,
    ok_scheme_policy_active,
    pricing_bridge_status,
    selling_price_bridge_status,
    selling_price_bridge_note,
    refreshed_at,
    ik_policy_source,
    ik_policy_scope,
    ik_policy_rule_id,
    ik_priority_sort,
    ik_apply_mode,
    ik_replace_from_scheme_id,
    ik_policy_source_label,
    ik_remarks,
    ok_policy_source,
    ok_policy_scope,
    ok_policy_rule_id,
    ok_priority_sort,
    ok_apply_mode,
    ok_replace_from_scheme_id,
    ok_policy_source_label,
    ok_remarks
   FROM costing.v_costing_policy_manager_sku_overview
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_commercial_sales_basis as
select q.* from (
SELECT period_start,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    allocation_basis_status,
    actual_sales_units_12m,
    actual_sales_base_qty_12m,
    product_sales_units_12m,
    product_sales_base_qty_12m,
    product_allocation_share,
    lookback_start,
    lookback_end,
    assumption_id,
    manual_assumption_basis,
    manual_assumed_sales_units,
    manual_assumed_sales_value,
    manual_assumption_remarks,
    manual_effective_from,
    manual_effective_to,
    manual_assumption_status,
    commercial_sales_basis,
    commercial_sales_units,
    commercial_sales_value,
    assumption_source,
    commercial_sales_warning,
    commercial_sales_status,
    management_valuation_date,
    default_policy_id,
    default_policy_scenario,
    default_sales_units,
    default_policy_effective_from,
    default_policy_effective_to,
    manual_assumption_approval_reference,
    assumption_resolution_status,
    default_resolution_status
   FROM costing.v_sku_commercial_sales_basis
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_control_dashboard as
select q.* from (
SELECT generated_at,
    total_sku_count,
    blocked_sku_count,
    review_required_sku_count,
    ready_sku_count,
    material_cost_blocked_sku_count,
    material_review_required_sku_count,
    rm_blocker_item_count,
    pm_blocker_item_count,
    rm_review_item_count,
    pm_review_item_count,
    rm_blocker_affected_sku_count,
    pm_blocker_affected_sku_count,
    rm_review_affected_sku_count,
    pm_review_affected_sku_count,
    top_rm_blocker_stock_item_id,
    top_rm_blocker_stock_item_code,
    top_rm_blocker_stock_item_name,
    top_rm_blocker_affected_sku_count,
    top_rm_blocker_affected_product_count,
    top_rm_blocker_affected_line_count,
    top_pm_blocker_stock_item_id,
    top_pm_blocker_stock_item_code,
    top_pm_blocker_stock_item_name,
    top_pm_blocker_affected_sku_count,
    top_pm_blocker_affected_product_count,
    top_pm_blocker_affected_line_count,
    top_rm_review_stock_item_id,
    top_rm_review_stock_item_code,
    top_rm_review_stock_item_name,
    top_rm_review_affected_sku_count,
    top_rm_review_affected_product_count,
    top_rm_review_affected_line_count,
    top_pm_review_stock_item_id,
    top_pm_review_stock_item_code,
    top_pm_review_stock_item_name,
    top_pm_review_affected_sku_count,
    top_pm_review_affected_product_count,
    top_pm_review_affected_line_count,
    overall_control_status,
    overall_control_note
   FROM costing.v_costing_control_dashboard_summary
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_control_integrity_audit as
select q.* from (
SELECT a.check_code,
    a.check_status,
    a.observed_count,
    a.expected_rule,
    a.diagnostic_note
   FROM (costing.costing_control_integrity_audit_snapshot a
     JOIN costing.v_current_successful_costing_refresh_run r ON (((r.period_start = a.period_start) AND (r.valuation_date = a.valuation_date) AND (r.refresh_run_id = a.refresh_run_id))))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_cost_sheet_line_traceability as
select q.* from (
SELECT t.line_trace_id,
    t.period_start,
    t.product_id,
    t.product_name,
    t.sku_id,
    t.sku_column_label,
    t.section_code,
    t.section_title,
    t.line_order,
    t.line_label,
    t.value_numeric,
    t.value_text,
    t.value_type,
        CASE t.line_label
            WHEN 'Direct Labour (DL)'::text THEN 'Direct labour absorbed by the SKU from the frozen monthly Direct Labour pool using the approved Product route-attendance workload driver.'::text
            WHEN 'Production Overhead'::text THEN 'Production overhead absorbed from the frozen monthly Production Overhead pool using the approved rounded-standard-batch Product route-workload driver.'::text
            WHEN 'Quality Control Overhead'::text THEN 'Quality Control overhead absorbed from the frozen monthly QC pool using the governed Product QC workload driver.'::text
            WHEN 'Materials / Stores Overhead'::text THEN 'Materials and Stores overhead absorbed from the frozen monthly pool using the governed SKU RM/PM workload driver.'::text
            WHEN 'Administrative Overhead'::text THEN 'Administration overhead absorbed from the frozen monthly pool using the approved Product sales-unit-share driver.'::text
            WHEN 'Finance Admin Overhead'::text THEN 'Finance/Admin overhead absorbed from the frozen monthly pool using the approved Product sales-unit-share driver.'::text
            WHEN 'Marketing Expense'::text THEN 'Marketing expense absorbed from the one frozen company Marketing pool using signed billed-value evidence, with IK/OK decomposition of that same pool for regional pricing.'::text
            ELSE t.line_description
        END AS line_description,
        CASE t.line_label
            WHEN 'Direct Labour (DL)'::text THEN 'Frozen Direct Labour pool × Product route-attendance workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text
            WHEN 'Production Overhead'::text THEN 'Frozen Production Overhead pool × Product rounded-standard-batch route-workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text
            WHEN 'Quality Control Overhead'::text THEN 'Frozen Quality Control pool × governed Product QC workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text
            WHEN 'Materials / Stores Overhead'::text THEN 'Frozen Materials / Stores pool × governed SKU RM/PM workload share; monthly SKU allocation ÷ governed monthly SKU units.'::text
            WHEN 'Administrative Overhead'::text THEN 'Frozen Administration pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.'::text
            WHEN 'Finance Admin Overhead'::text THEN 'Frozen Finance/Admin pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.'::text
            WHEN 'Marketing Expense'::text THEN 'Frozen Marketing pool × governed signed billed-value Product share, then absorbed to SKU; regional pricing uses the governed IK/OK decomposition of the same pool.'::text
            ELSE t.calculation_basis
        END AS calculation_basis,
        CASE t.line_label
            WHEN 'Direct Labour (DL)'::text THEN 'Source: exact-run Direct Labour Product workload, route-step and SKU allocation snapshots.'::text
            WHEN 'Production Overhead'::text THEN 'Source: exact-run Production Overhead Product workload, route-step and SKU allocation snapshots.'::text
            WHEN 'Quality Control Overhead'::text THEN 'Source: exact-run QC Product workload/allocation and SKU allocation snapshots.'::text
            WHEN 'Materials / Stores Overhead'::text THEN 'Source: canonical exact-run Materials / Stores workload and monetary allocation snapshots.'::text
            WHEN 'Administrative Overhead'::text THEN 'Source: exact-run Administration allocation snapshot with approved envelope and frozen-pool lineage.'::text
            WHEN 'Finance Admin Overhead'::text THEN 'Source: exact-run Finance/Admin allocation snapshot with approved envelope and frozen-pool lineage.'::text
            WHEN 'Marketing Expense'::text THEN 'Source: exact-run Marketing common/regional snapshots with approved policy-envelope and frozen-pool lineage.'::text
            ELSE t.source_note
        END AS source_note,
        CASE t.line_label
            WHEN 'Direct Labour (DL)'::text THEN 'Direct Labour is traced to the approved route-attendance policy, Product workload, standard batch count, frozen pool and exact SKU allocation basis.'::text
            WHEN 'Production Overhead'::text THEN 'Production Overhead is traced to the approved rounded-batch route-workload policy, Product workload, frozen pool and exact SKU allocation basis.'::text
            WHEN 'Quality Control Overhead'::text THEN 'QC is traced to the governed QC workload policy, Product workload/allocation, frozen QC pool and exact SKU absorption basis.'::text
            WHEN 'Materials / Stores Overhead'::text THEN 'Materials / Stores is traced to the governed RM/PM workload policy, frozen pool and exact SKU workload share.'::text
            WHEN 'Administrative Overhead'::text THEN 'Administration is traced to its approved policy envelope, frozen pool and governed Product sales-unit allocation basis.'::text
            WHEN 'Finance Admin Overhead'::text THEN 'Finance/Admin is traced to its approved policy envelope, frozen pool and governed Product sales-unit allocation basis.'::text
            WHEN 'Marketing Expense'::text THEN 'Marketing is traced to the approved signed billed-value policy, frozen company pool and common/regional allocation evidence.'::text
            ELSE t.trace_summary
        END AS trace_summary,
        CASE t.line_label
            WHEN 'Direct Labour (DL)'::text THEN 'Pool × Product workload share → Product DL allocation → exact-run SKU quantity absorption.'::text
            WHEN 'Production Overhead'::text THEN 'Pool × Product rounded-batch route-workload share → Product POH allocation → exact-run SKU quantity absorption.'::text
            WHEN 'Quality Control Overhead'::text THEN 'Pool × Product QC workload share → Product QC allocation → exact-run SKU quantity absorption.'::text
            WHEN 'Materials / Stores Overhead'::text THEN 'Pool × SKU unified RM/PM workload share → monthly SKU allocation ÷ governed monthly SKU units.'::text
            WHEN 'Administrative Overhead'::text THEN 'Pool × Product sales-unit share → Product allocation ÷ Product base quantity × SKU base quantity per unit.'::text
            WHEN 'Finance Admin Overhead'::text THEN 'Pool × Product sales-unit share → Product allocation ÷ Product base quantity × SKU base quantity per unit.'::text
            WHEN 'Marketing Expense'::text THEN 'Company pool × signed billed-value Product share → SKU absorption; IK/OK regional decomposition remains a decomposition of the same company pool.'::text
            ELSE t.trace_formula
        END AS trace_formula,
    t.trace_source_type,
        CASE t.line_label
            WHEN 'Direct Labour (DL)'::text THEN 'costing.sku_direct_labour_allocation_snapshot / costing.product_direct_labour_workload_snapshot'::text
            WHEN 'Production Overhead'::text THEN 'costing.sku_production_overhead_allocation_snapshot / costing.product_production_overhead_workload_snapshot'::text
            WHEN 'Quality Control Overhead'::text THEN 'costing.sku_qc_allocation_snapshot / costing.product_qc_allocation_snapshot'::text
            WHEN 'Materials / Stores Overhead'::text THEN 'costing.sku_materials_stores_workload_snapshot / costing.sku_materials_stores_allocation_snapshot'::text
            WHEN 'Administrative Overhead'::text THEN 'costing.sku_admin_finance_overhead_allocation_snapshot'::text
            WHEN 'Finance Admin Overhead'::text THEN 'costing.sku_admin_finance_overhead_allocation_snapshot'::text
            WHEN 'Marketing Expense'::text THEN 'costing.sku_marketing_expense_allocation_snapshot / costing.sku_regional_marketing_expense_allocation_snapshot'::text
            ELSE t.trace_source_snapshot
        END AS trace_source_snapshot,
    t.source_module_key,
    t.source_lens_id,
    t.source_module_label,
    t.drill_route_module_key,
    t.drill_route_lens_id,
    t.drill_filter_json,
        CASE t.line_label
            WHEN 'Direct Labour (DL)'::text THEN (COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_id', dl.policy_id, 'pool_snapshot_id', dl.direct_labour_pool_snapshot_id, 'frozen_pool_amount', dl.direct_labour_pool_amount, 'product_workload_snapshot_id', dl.product_workload_snapshot_id, 'standard_batch_count', dl.standard_batch_count, 'product_workload_units', dl.direct_labour_workload_units, 'product_workload_share', dl.product_workload_share, 'product_allocation_amount', dl.product_direct_labour_allocation, 'allocation_basis_snapshot_id', dl.allocation_basis_snapshot_id, 'allocation_basis_source', dl.allocation_basis_source, 'allocation_resolution_status', dl.allocation_resolution_status, 'component_status', dl.direct_labour_allocation_status, 'component_note', dl.direct_labour_allocation_note)))
            WHEN 'Production Overhead'::text THEN (COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_id', poh.policy_id, 'pool_snapshot_id', poh.pool_snapshot_id, 'frozen_pool_amount', poh.production_overhead_pool_amount, 'product_workload_snapshot_id', poh.product_workload_snapshot_id, 'product_workload_share', poh.product_workload_share, 'product_allocation_amount', poh.product_production_overhead_allocation, 'component_status', poh.allocation_status, 'component_note', poh.allocation_note)))
            WHEN 'Quality Control Overhead'::text THEN (COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('product_qc_allocation_snapshot_id', qcs.product_qc_allocation_snapshot_id, 'policy_id', qcp.policy_id, 'pool_snapshot_id', qcp.quality_control_pool_snapshot_id, 'frozen_pool_amount', qcp.quality_control_pool_amount, 'product_workload_units', qcp.workload_units, 'company_workload_units', qcp.company_resolved_workload_units, 'product_workload_share', qcp.product_workload_share, 'product_allocation_amount', qcp.product_qc_allocation_amount, 'absorption_basis_source', qcp.absorption_basis_source, 'absorption_basis_status', qcp.absorption_basis_status, 'component_status', qcs.allocation_status, 'component_note', qcs.allocation_note)))
            WHEN 'Materials / Stores Overhead'::text THEN (COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_id', msw.policy_id, 'pool_snapshot_id', msa.pool_snapshot_id, 'frozen_pool_amount', msa.frozen_pool_amount, 'workload_snapshot_id', msa.workload_snapshot_id, 'rm_workload_units', msw.rm_workload_units, 'pm_workload_units', msw.pm_workload_units, 'unified_workload_units', msa.unified_workload_units, 'company_eligible_workload_units', msa.company_eligible_workload_units, 'workload_share', msa.workload_share, 'monthly_sku_allocation_amount', msa.monthly_sku_allocation_amount, 'monthly_driver_source', msw.monthly_driver_source, 'monthly_driver_status', msw.monthly_driver_status, 'component_status', msa.allocation_status, 'component_note', msa.allocation_note)))
            WHEN 'Administrative Overhead'::text THEN (COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_envelope_id', af.admin_policy_envelope_id, 'pool_snapshot_id', af.admin_pool_snapshot_id, 'allocation_basis_snapshot_id', af.allocation_basis_snapshot_id, 'allocation_basis_source', af.allocation_basis_source, 'allocation_resolution_status', af.allocation_resolution_status, 'product_allocation_share', af.resolved_product_allocation_share, 'component_status', af.admin_overhead_allocation_status, 'component_note', af.admin_overhead_allocation_note)))
            WHEN 'Finance Admin Overhead'::text THEN (COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_envelope_id', af.finance_admin_policy_envelope_id, 'pool_snapshot_id', af.finance_admin_pool_snapshot_id, 'allocation_basis_snapshot_id', af.allocation_basis_snapshot_id, 'allocation_basis_source', af.allocation_basis_source, 'allocation_resolution_status', af.allocation_resolution_status, 'product_allocation_share', af.resolved_product_allocation_share, 'component_status', af.finance_admin_overhead_allocation_status, 'component_note', af.finance_admin_overhead_allocation_note)))
            WHEN 'Marketing Expense'::text THEN (COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_id', mk.marketing_policy_id, 'policy_envelope_id', mk.marketing_policy_envelope_id, 'pool_snapshot_id', mk.marketing_pool_snapshot_id, 'allocation_basis_snapshot_id', mk.allocation_basis_snapshot_id, 'allocation_basis_source', mk.allocation_basis_source, 'allocation_resolution_status', mk.allocation_resolution_status, 'product_monetary_allocation_share', mk.product_monetary_allocation_share, 'product_marketing_allocation', mk.product_marketing_allocation, 'marketing_value_source', mk.marketing_value_source, 'marketing_evidence_status', mk.marketing_evidence_status, 'region_code',
            CASE
                WHEN (t.section_code = 'C_IK_PRICING'::text) THEN 'IK'::text
                WHEN (t.section_code = 'D_OK_PRICING'::text) THEN 'OK'::text
                ELSE NULL::text
            END, 'regional_basis_source', rmk.regional_basis_source, 'regional_basis_status', rmk.regional_basis_status, 'product_region_monetary_allocation_share', rmk.product_region_monetary_allocation_share, 'regional_component_status', rmk.marketing_expense_allocation_status, 'component_status', mk.marketing_expense_allocation_status, 'component_note', mk.marketing_expense_allocation_note)))
            ELSE t.evidence_json
        END AS evidence_json,
    t.audit_hint,
    t.control_hint,
    t.refresh_stage_code,
    t.cost_sheet_status,
    t.cost_sheet_note,
    t.evidence_refreshed_at,
    t.refreshed_at,
    t.created_at,
    t.valuation_date,
    t.refresh_run_id,
    t.material_cost_snapshot_id,
    t.selected_scheme_policy_context_id,
    t.scheme_viability_snapshot_id
   FROM (((((((((costing.cost_sheet_line_traceability_snapshot t
     LEFT JOIN costing.sku_direct_labour_allocation_snapshot dl ON (((t.line_label = 'Direct Labour (DL)'::text) AND (dl.refresh_run_id = t.refresh_run_id) AND (dl.valuation_date = t.valuation_date) AND (dl.period_start = t.period_start) AND (dl.sku_id = t.sku_id))))
     LEFT JOIN costing.sku_production_overhead_allocation_snapshot poh ON (((t.line_label = 'Production Overhead'::text) AND (poh.refresh_run_id = t.refresh_run_id) AND (poh.valuation_date = t.valuation_date) AND (poh.period_start = t.period_start) AND (poh.sku_id = t.sku_id))))
     LEFT JOIN costing.sku_qc_allocation_snapshot qcs ON (((t.line_label = 'Quality Control Overhead'::text) AND (qcs.refresh_run_id = t.refresh_run_id) AND (qcs.valuation_date = t.valuation_date) AND (qcs.period_start = t.period_start) AND (qcs.sku_id = t.sku_id))))
     LEFT JOIN costing.product_qc_allocation_snapshot qcp ON ((qcs.product_qc_allocation_snapshot_id = qcp.id)))
     LEFT JOIN costing.sku_materials_stores_allocation_snapshot msa ON (((t.line_label = 'Materials / Stores Overhead'::text) AND (msa.refresh_run_id = t.refresh_run_id) AND (msa.valuation_date = t.valuation_date) AND (msa.period_start = t.period_start) AND (msa.sku_id = t.sku_id))))
     LEFT JOIN costing.sku_materials_stores_workload_snapshot msw ON ((msa.workload_snapshot_id = msw.id)))
     LEFT JOIN costing.sku_admin_finance_overhead_allocation_snapshot af ON (((t.line_label = ANY (ARRAY['Administrative Overhead'::text, 'Finance Admin Overhead'::text])) AND (af.refresh_run_id = t.refresh_run_id) AND (af.valuation_date = t.valuation_date) AND (af.period_start = t.period_start) AND (af.sku_id = t.sku_id))))
     LEFT JOIN costing.sku_marketing_expense_allocation_snapshot mk ON (((t.line_label = 'Marketing Expense'::text) AND (mk.refresh_run_id = t.refresh_run_id) AND (mk.valuation_date = t.valuation_date) AND (mk.period_start = t.period_start) AND (mk.sku_id = t.sku_id))))
     LEFT JOIN costing.sku_regional_marketing_expense_allocation_snapshot rmk ON (((t.line_label = 'Marketing Expense'::text) AND (rmk.refresh_run_id = t.refresh_run_id) AND (rmk.valuation_date = t.valuation_date) AND (rmk.period_start = t.period_start) AND (rmk.sku_id = t.sku_id) AND (rmk.region_code =
        CASE
            WHEN (t.section_code = 'C_IK_PRICING'::text) THEN 'IK'::text
            WHEN (t.section_code = 'D_OK_PRICING'::text) THEN 'OK'::text
            ELSE NULL::text
        END))))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_cost_sheet_rm_line_traceability as
select q.* from (
SELECT line_trace_key,
    period_start,
    product_id,
    product_name,
    sku_id,
    sku_column_label,
    pack_size,
    pack_uom,
    product_base_uom,
    conversion_to_base,
    line_sort,
    bom_source,
    level,
    parent_bom_type,
    consume_stock_item_id,
    consume_stock_item_name,
    purchase_stock_item_id,
    purchase_stock_item_name,
    qty_consume_form_per_base_unit,
    consume_uom_code,
    qty_purchase_form_per_base_unit,
    purchase_uom_code,
    sku_qty_purchase_form,
    form_conversion_applied,
    form_conversion_factor,
    selected_rate,
    rate_source,
    rate_date,
    rm_cost_per_base_unit_line,
    rm_cost_per_sku_line,
    rm_cost_share_percent,
    rate_warning_flag,
    rate_warning_code,
    rate_warning_text,
    action_required,
    approval_block_flag,
    calculation_warning_flag,
    calculation_warning_code,
    explosion_path,
    semi_stock_item_ids,
    semi_stock_item_names,
    expansion_note,
    review_state_label,
    drill_route_module_key,
    drill_route_lens_id,
    drill_filter_json,
    snapshot_refreshed_at,
    valuation_date,
    refresh_run_id,
    product_rm_material_cost_line_snapshot_id,
    sku_rm_material_cost_line_snapshot_id,
    sku_material_cost_snapshot_id
   FROM costing.cost_sheet_rm_line_traceability_snapshot
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_material_action_drilldown as
select q.* from (
SELECT source_line_key,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    material_area,
    action_severity,
    recommended_ui_route,
    action_note,
    bom_source,
    material_line_status,
    material_issue_code,
    warning_code,
    warning_text,
    action_required,
    approval_block_flag,
    product_id,
    product_name,
    product_hierarchy,
    sku_id,
    pack_size,
    pack_uom,
    source_sku_id,
    source_pack_size,
    source_sku_uom,
    drilldown_resolution_type,
    line_no,
    qty_per_reference_output,
    uom_id,
    wastage_pct,
    is_optional,
    selected_rate,
    rate_source,
    rate_date,
    first_control_status,
    sku_control_severity,
    sku_recommended_ui_route,
    sku_control_note,
    material_costing_status,
    rm_costing_status,
    pm_costing_status,
    rm_blocking_line_count,
    pm_blocking_line_count,
    rm_review_rate_line_count,
    pm_review_rate_line_count,
    rm_stale_purchase_rate_line_count,
    pm_stale_purchase_rate_line_count,
    rm_stock_valuation_fallback_line_count,
    pm_stock_valuation_fallback_line_count,
    rm_manual_rate_line_count,
    pm_manual_rate_line_count,
    material_cost_per_sku,
    mrp_ik,
    mrp_ok,
    ik_selling_price,
    ok_selling_price,
    ik_margin_amount_before_scheme,
    ik_margin_percent_before_scheme,
    ok_margin_amount_before_scheme,
    ok_margin_percent_before_scheme,
    resolved_rate_stock_item_id,
    resolved_rate_stock_item_code,
    resolved_rate_stock_item_name,
    resolved_rate_stock_item_default_uom_id,
    form_conversion_applied,
    form_conversion_factor,
    form_conversion_consume_uom_id,
    form_conversion_purchase_uom_id,
    rate_lookup_basis,
    rate_resolution_note
   FROM costing.v_material_costing_action_drilldown
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_material_action_queue as
select q.* from (
SELECT stock_item_id,
    stock_item_code,
    stock_item_name,
    material_area,
    action_severity,
    recommended_ui_route,
    bom_sources,
    material_line_statuses,
    issue_codes,
    warning_codes,
    action_required_summary,
    action_note_summary,
    affected_line_count,
    affected_product_count,
    affected_sku_count,
    approval_blocking_line_count,
    approval_blocking_sku_count,
    review_line_count,
    review_sku_count,
    oldest_rate_date,
    latest_rate_date,
    has_missing_selected_rate,
    has_missing_rate_source,
    has_optional_lines,
    sample_product_name,
    sample_sku_id
   FROM costing.v_material_costing_action_queue
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_material_rate_issue_lines as
select q.* from (
SELECT bom_source,
    product_id,
    product_name,
    product_hierarchy,
    sku_id,
    pack_size,
    sku_uom,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    line_no,
    qty_per_reference_output,
    uom_id,
    wastage_pct,
    is_optional,
    selected_rate,
    rate_source,
    rate_date,
    warning_flag,
    warning_code,
    warning_text,
    action_required,
    approval_block_flag,
    material_line_status,
    material_issue_code,
    resolved_rate_stock_item_id,
    resolved_rate_stock_item_code,
    resolved_rate_stock_item_name,
    resolved_rate_stock_item_default_uom_id,
    form_conversion_applied,
    form_conversion_factor,
    form_conversion_consume_uom_id,
    form_conversion_purchase_uom_id,
    rate_lookup_basis,
    rate_resolution_note
   FROM costing.v_material_rate_issue_lines
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_printable_cost_sheet_lines as
select q.* from (
WITH base AS (
         SELECT d.period_start,
            d.product_id,
            d.product_name,
            pd.category_name,
            pd.subcategory_name,
            pd.group_name,
            pd.sub_group_name,
            pd.product_hierarchy,
            d.sku_id,
            d.pack_size,
            d.pack_uom,
            d.mrp_ik,
            d.mrp_ok,
            m.rm_cost_per_sku,
            m.pm_cost_per_sku,
            d.material_cost_per_sku,
            d.direct_labour_cost_per_sku,
            d.internal_material_conversion_cost_per_sku,
            d.prime_cost_per_sku,
            d.production_overhead_cost_per_sku,
            d.quality_control_overhead_cost_per_sku,
            d.materials_stores_overhead_cost_per_sku,
            d.manufacturing_cop_per_sku,
            d.admin_overhead_cost_per_sku,
            d.finance_admin_overhead_cost_per_sku,
            d.internal_loaded_cost_per_sku,
            d.marketing_expense_cost_per_sku,
            d.pricing_cost_per_sku,
            d.gst_percent,
            d.ik_basic_price,
            d.ok_basic_price,
            d.ik_discount_percent,
            d.ok_discount_percent,
            d.ik_discount_amount,
            d.ok_discount_amount,
            d.ik_selling_price,
            d.ok_selling_price,
            d.contingency_percent,
            d.ik_contingency_value,
            d.ok_contingency_value,
            ikp.scheme_id AS ik_selected_scheme_id,
            ikp.scheme_name AS ik_selected_scheme_name,
            ikp.paid_qty AS ik_paid_qty,
            ikp.free_qty AS ik_free_qty,
            okp.scheme_id AS ok_selected_scheme_id,
            okp.scheme_name AS ok_selected_scheme_name,
            okp.paid_qty AS ok_paid_qty,
            okp.free_qty AS ok_free_qty,
            iksv.ik_scheme_effective_selling_price,
            oksv.ok_scheme_effective_selling_price,
            iksv.ik_net_sales_realisation,
            oksv.ok_net_sales_realisation,
            iksv.ik_margin_amount_after_scheme AS ik_profit_value,
            oksv.ok_margin_amount_after_scheme AS ok_profit_value,
            iksv.ik_margin_percent_after_scheme AS ik_profit_percent,
            oksv.ok_margin_percent_after_scheme AS ok_profit_percent,
                CASE
                    WHEN ((d.ik_selling_price IS NULL) OR (iksv.ik_scheme_effective_selling_price IS NULL)) THEN NULL::numeric
                    ELSE (d.ik_selling_price - iksv.ik_scheme_effective_selling_price)
                END AS ik_scheme_value,
                CASE
                    WHEN ((d.ok_selling_price IS NULL) OR (oksv.ok_scheme_effective_selling_price IS NULL)) THEN NULL::numeric
                    ELSE (d.ok_selling_price - oksv.ok_scheme_effective_selling_price)
                END AS ok_scheme_value,
                CASE
                    WHEN ((m.id IS NULL) OR (ikp.id IS NULL) OR (okp.id IS NULL) OR (iksv.id IS NULL) OR (oksv.id IS NULL)) THEN 'BLOCKED'::text
                    WHEN ((ikp.resolution_status = 'BLOCKED'::text) OR (okp.resolution_status = 'BLOCKED'::text) OR (iksv.scheme_viability_status = 'BLOCKED'::text) OR (oksv.scheme_viability_status = 'BLOCKED'::text)) THEN 'BLOCKED'::text
                    WHEN (d.cost_sheet_status = 'BLOCKED'::text) THEN 'BLOCKED'::text
                    WHEN ((d.cost_sheet_status = 'REVIEW_REQUIRED'::text) OR (iksv.scheme_viability_status = 'REVIEW_REQUIRED'::text) OR (oksv.scheme_viability_status = 'REVIEW_REQUIRED'::text)) THEN 'REVIEW_REQUIRED'::text
                    WHEN ((d.cost_sheet_status = 'READY'::text) AND (iksv.scheme_viability_status = 'READY'::text) AND (oksv.scheme_viability_status = 'READY'::text)) THEN 'READY'::text
                    ELSE 'BLOCKED'::text
                END AS cost_sheet_status,
                CASE
                    WHEN (m.id IS NULL) THEN 'Cost sheet is blocked because the exact material-cost snapshot is missing.'::text
                    WHEN (ikp.id IS NULL) THEN 'Cost sheet is blocked because the frozen IK selected-scheme policy context is missing.'::text
                    WHEN (okp.id IS NULL) THEN 'Cost sheet is blocked because the frozen OK selected-scheme policy context is missing.'::text
                    WHEN (iksv.id IS NULL) THEN 'Cost sheet is blocked because the exact IK Scheme Viability row is missing.'::text
                    WHEN (oksv.id IS NULL) THEN 'Cost sheet is blocked because the exact OK Scheme Viability row is missing.'::text
                    WHEN (ikp.resolution_status = 'BLOCKED'::text) THEN ikp.resolution_note
                    WHEN (okp.resolution_status = 'BLOCKED'::text) THEN okp.resolution_note
                    WHEN (d.cost_sheet_status = 'BLOCKED'::text) THEN d.cost_sheet_note
                    WHEN (iksv.scheme_viability_status = 'BLOCKED'::text) THEN iksv.scheme_viability_note
                    WHEN (oksv.scheme_viability_status = 'BLOCKED'::text) THEN oksv.scheme_viability_note
                    WHEN (d.cost_sheet_status = 'REVIEW_REQUIRED'::text) THEN d.cost_sheet_note
                    WHEN (iksv.scheme_viability_status = 'REVIEW_REQUIRED'::text) THEN iksv.scheme_viability_note
                    WHEN (oksv.scheme_viability_status = 'REVIEW_REQUIRED'::text) THEN oksv.scheme_viability_note
                    WHEN ((d.cost_sheet_status = 'READY'::text) AND (iksv.scheme_viability_status = 'READY'::text) AND (oksv.scheme_viability_status = 'READY'::text)) THEN 'Cost sheet is ready.'::text
                    ELSE 'Cost sheet is blocked because one or more exact-tuple sources or statuses are incomplete.'::text
                END AS cost_sheet_note,
            GREATEST(d.refreshed_at, m.calculated_at, ikp.captured_at, okp.captured_at, iksv.refreshed_at, oksv.refreshed_at) AS refreshed_at,
            d.valuation_date,
            d.refresh_run_id,
            m.id AS material_cost_snapshot_id,
            ikp.id AS ik_selected_scheme_policy_context_id,
            okp.id AS ok_selected_scheme_policy_context_id,
            iksv.id AS ik_scheme_viability_snapshot_id,
            oksv.id AS ok_scheme_viability_snapshot_id,
            ikp.resolution_status AS ik_policy_resolution_status,
            okp.resolution_status AS ok_policy_resolution_status
           FROM ((((((costing.v_sku_detailed_cost_sheet d
             LEFT JOIN costing.sku_material_cost_snapshot m ON (((m.period_start = d.period_start) AND (m.valuation_date = d.valuation_date) AND (m.refresh_run_id = d.refresh_run_id) AND (m.sku_id = d.sku_id))))
             LEFT JOIN v_product_details pd ON ((pd.product_id = (d.product_id)::integer)))
             LEFT JOIN costing.sku_selected_scheme_policy_context_snapshot ikp ON (((ikp.period_start = d.period_start) AND (ikp.valuation_date = d.valuation_date) AND (ikp.refresh_run_id = d.refresh_run_id) AND (ikp.sku_id = d.sku_id) AND (ikp.region_code = 'IK'::text))))
             LEFT JOIN costing.sku_selected_scheme_policy_context_snapshot okp ON (((okp.period_start = d.period_start) AND (okp.valuation_date = d.valuation_date) AND (okp.refresh_run_id = d.refresh_run_id) AND (okp.sku_id = d.sku_id) AND (okp.region_code = 'OK'::text))))
             LEFT JOIN costing.sku_scheme_viability_snapshot iksv ON (((iksv.period_start = d.period_start) AND (iksv.valuation_date = d.valuation_date) AND (iksv.refresh_run_id = d.refresh_run_id) AND (iksv.sku_id = d.sku_id) AND (iksv.scheme_id = ikp.scheme_id))))
             LEFT JOIN costing.sku_scheme_viability_snapshot oksv ON (((oksv.period_start = d.period_start) AND (oksv.valuation_date = d.valuation_date) AND (oksv.refresh_run_id = d.refresh_run_id) AND (oksv.sku_id = d.sku_id) AND (oksv.scheme_id = okp.scheme_id))))
        )
 SELECT b.period_start,
    b.product_id,
    b.product_name,
    b.category_name,
    b.subcategory_name,
    b.group_name,
    b.sub_group_name,
    b.product_hierarchy,
    b.sku_id,
    b.pack_size,
    b.pack_uom,
    concat(b.pack_size, ' ', b.pack_uom) AS sku_column_label,
    x.section_code,
    x.section_title,
    x.line_order,
    x.line_label,
    x.line_description,
    x.calculation_basis,
    x.value_numeric,
    x.value_text,
    x.value_type,
    b.cost_sheet_status,
    b.cost_sheet_note,
    b.refreshed_at,
    x.source_note,
    b.valuation_date,
    b.refresh_run_id,
    b.material_cost_snapshot_id,
    b.ik_selected_scheme_policy_context_id,
    b.ok_selected_scheme_policy_context_id,
    b.ik_scheme_viability_snapshot_id,
    b.ok_scheme_viability_snapshot_id,
    b.ik_policy_resolution_status,
    b.ok_policy_resolution_status
   FROM (base b
     CROSS JOIN LATERAL ( VALUES ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,10,'Raw Material Cost (RM)'::text,'Raw material cost consumed for the SKU pack size.'::text,'Product RM standard cost per base UOM × SKU pack quantity.'::text,b.rm_cost_per_sku,NULL::text,'currency'::text,'Source: exact material cost snapshot / RM BOM rate engine.'::text), ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,20,'Packing & Labelling Material Cost (PM)'::text,'Packing and labelling material cost applicable to the SKU.'::text,'Sum of SKU packing/labelling material requirements × selected material rate.'::text,b.pm_cost_per_sku,NULL::text,'currency'::text,'Source: exact material cost snapshot / PM BOM rate engine.'::text), ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,30,'Total Material Cost'::text,'Total direct material cost for the SKU.'::text,'Raw Material Cost + Packing & Labelling Material Cost.'::text,b.material_cost_per_sku,NULL::text,'currency'::text,'Source: exact SKU material cost snapshot.'::text), ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,40,'Direct Labour (DL)'::text,'Direct labour absorbed by the SKU from the frozen monthly Direct Labour pool using the approved Product route-attendance workload driver.'::text,'Frozen Direct Labour pool × Product route-attendance workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text,b.direct_labour_cost_per_sku,NULL::text,'currency'::text,'Source: exact-run Direct Labour Product workload, route-step and SKU allocation snapshots.'::text), ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,45,'Internal Material Conversion Cost'::text,'Manufacturing conversion burden inherited from approved internally manufactured source materials consumed by this Product.'::text,'Approved internal-material lineage quantity × source Product manufacturing-only conversion burden (manufacturing labour + Production OH + QC + RM-share of Materials/Stores OH), recursively resolved.'::text,b.internal_material_conversion_cost_per_sku,NULL::text,'currency'::text,'Source: exact-run internal material conversion snapshot and approved source-product lineage.'::text), ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,50,'Production Overhead'::text,'Production overhead allocated to the SKU.'::text,'Frozen Production Overhead pool × Product rounded-standard-batch route-workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text,b.production_overhead_cost_per_sku,NULL::text,'currency'::text,'Source: exact-run governed overhead allocation snapshot chain.'::text), ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,60,'Quality Control Overhead'::text,'Quality control overhead allocated to the SKU.'::text,'Frozen Quality Control pool × governed Product QC workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text,b.quality_control_overhead_cost_per_sku,NULL::text,'currency'::text,'Source: exact-run governed overhead allocation snapshot chain.'::text), ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,70,'Materials / Stores Overhead'::text,'Materials and stores handling overhead absorbed by the SKU from the frozen monthly Stores pool.'::text,'Frozen Materials / Stores pool × governed SKU RM/PM workload share; monthly SKU allocation ÷ governed monthly SKU units.'::text,b.materials_stores_overhead_cost_per_sku,NULL::text,'currency'::text,'Source: canonical exact-run Materials / Stores workload and monetary allocation snapshots.'::text), ('A_COP'::text,'PART A: COST OF PRODUCTION'::text,80,'Manufacturing COP'::text,'Manufacturing cost of production for the SKU before administrative, finance and marketing allocations.'::text,'Total Material Cost + Direct Labour + Internal Material Conversion Cost + Production Overhead + Quality Control Overhead + Materials/Stores Overhead.'::text,b.manufacturing_cop_per_sku,NULL::text,'currency'::text,'Source: exact manufacturing COP snapshot.'::text), ('B_INTERNAL_COST'::text,'PART B: INTERNAL LOADED COST'::text,110,'Administrative Overhead'::text,'Administrative overhead allocated to the SKU.'::text,'Frozen Administration pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.'::text,b.admin_overhead_cost_per_sku,NULL::text,'currency'::text,'Source: exact-run Administration allocation snapshot with approved policy-envelope and frozen-pool lineage.'::text), ('B_INTERNAL_COST'::text,'PART B: INTERNAL LOADED COST'::text,120,'Finance Admin Overhead'::text,'Finance and related administrative overhead allocated to the SKU.'::text,'Frozen Finance/Admin pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.'::text,b.finance_admin_overhead_cost_per_sku,NULL::text,'currency'::text,'Source: exact-run Finance/Admin allocation snapshot with approved policy-envelope and frozen-pool lineage.'::text), ('B_INTERNAL_COST'::text,'PART B: INTERNAL LOADED COST'::text,130,'Internal Loaded Cost'::text,'Internal business cost before marketing and pricing-side deductions.'::text,'Manufacturing COP + Administrative Overhead + Finance Admin Overhead.'::text,b.internal_loaded_cost_per_sku,NULL::text,'currency'::text,'Source: exact internal loaded cost snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,210,'MRP: Inside Kerala (MRP IK)'::text,'Maximum retail price applicable for Inside Kerala.'::text,'MRP IK from the frozen Pricing Bridge context.'::text,b.mrp_ik,NULL::text,'currency'::text,'Source: exact Pricing Bridge snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,220,'GST Rate (%)'::text,'GST rate used to derive taxable/basic price.'::text,'GST percent from the frozen Selling Price Bridge context.'::text,b.gst_percent,NULL::text,'percent'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,230,'Basic Price: IK'::text,'Taxable/basic price derived from MRP IK.'::text,'MRP IK ÷ (1 + GST%).'::text,b.ik_basic_price,NULL::text,'currency'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,240,'Discount: IK (%)'::text,'Trade discount percentage applicable for Inside Kerala.'::text,'IK discount percent from the frozen Selling Price Bridge policy.'::text,b.ik_discount_percent,NULL::text,'percent'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,250,'Discount Value: IK'::text,'Discount value deducted from IK basic price.'::text,'IK Basic Price × IK Discount Percentage.'::text,b.ik_discount_amount,NULL::text,'currency'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,260,'Selling Price: IK'::text,'Net billing/selling price for Inside Kerala before contingency, marketing and scheme impact.'::text,'IK Basic Price - IK Discount Value.'::text,b.ik_selling_price,NULL::text,'currency'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,265,'Contingency / Other Expense: IK (%)'::text,'Contingency or other expense percentage applicable for Inside Kerala pricing viability.'::text,'Contingency percent from the frozen Selling Price Bridge policy.'::text,b.contingency_percent,NULL::text,'percent'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,270,'Contingency / Other Expense Value: IK'::text,'Other expense or contingency deducted for pricing viability.'::text,'IK Selling Price × Contingency Percentage.'::text,b.ik_contingency_value,NULL::text,'currency'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,280,'Marketing Expense'::text,'Marketing expense allocation considered in pricing viability.'::text,'Frozen Marketing pool × governed signed billed-value Product share, then absorbed to the exact SKU context; regional pricing uses the governed IK/OK decomposition of the same pool.'::text,b.marketing_expense_cost_per_sku,NULL::text,'currency'::text,'Source: exact-run Marketing common/regional allocation snapshots with approved policy-envelope and frozen-pool lineage.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,290,'Selected Scheme: IK'::text,'Selected scheme policy applicable for this SKU in Inside Kerala.'::text,'Frozen IK selected-scheme policy context for the refresh run.'::text,NULL::numeric,b.ik_selected_scheme_name,'text'::text,'Source: frozen selected-scheme policy context.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,300,'Scheme Value: IK'::text,'Value impact of the selected IK scheme on effective selling price.'::text,'IK Selling Price - frozen IK Scheme Effective Selling Price.'::text,b.ik_scheme_value,NULL::text,'currency'::text,'Source: exact Scheme Viability snapshot.'::text), ('C_IK_PRICING'::text,'PART C: INSIDE KERALA PRICING & SALES REALISATION'::text,310,'Sales Realisation: IK'::text,'Net sales realisation after contingency, marketing expense and selected scheme impact.'::text,'Frozen IK net sales realisation from Scheme Viability.'::text,b.ik_net_sales_realisation,NULL::text,'currency'::text,'Source: exact Scheme Viability snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,410,'MRP: Outside Kerala (MRP OK)'::text,'Maximum retail price applicable for Outside Kerala.'::text,'MRP OK from the frozen Pricing Bridge context.'::text,b.mrp_ok,NULL::text,'currency'::text,'Source: exact Pricing Bridge snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,415,'GST Rate (%)'::text,'GST rate used to derive taxable/basic price.'::text,'GST percent from the frozen Selling Price Bridge context.'::text,b.gst_percent,NULL::text,'percent'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,420,'Basic Price: OK'::text,'Taxable/basic price derived from MRP OK.'::text,'MRP OK ÷ (1 + GST%).'::text,b.ok_basic_price,NULL::text,'currency'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,430,'Discount: OK (%)'::text,'Trade discount percentage applicable for Outside Kerala.'::text,'OK discount percent from the frozen Selling Price Bridge policy.'::text,b.ok_discount_percent,NULL::text,'percent'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,440,'Discount Value: OK'::text,'Discount value deducted from OK basic price.'::text,'OK Basic Price × OK Discount Percentage.'::text,b.ok_discount_amount,NULL::text,'currency'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,450,'Selling Price: OK'::text,'Net billing/selling price for Outside Kerala before contingency, marketing and scheme impact.'::text,'OK Basic Price - OK Discount Value.'::text,b.ok_selling_price,NULL::text,'currency'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,455,'Contingency / Other Expense: OK (%)'::text,'Contingency or other expense percentage applicable for Outside Kerala pricing viability.'::text,'Contingency percent from the frozen Selling Price Bridge policy.'::text,b.contingency_percent,NULL::text,'percent'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,460,'Contingency / Other Expense Value: OK'::text,'Other expense or contingency deducted for pricing viability.'::text,'OK Selling Price × Contingency Percentage.'::text,b.ok_contingency_value,NULL::text,'currency'::text,'Source: exact Selling Price Bridge snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,465,'Marketing Expense'::text,'Marketing expense allocation considered in pricing viability.'::text,'Frozen Marketing pool × governed signed billed-value Product share, then absorbed to the exact SKU context; regional pricing uses the governed IK/OK decomposition of the same pool.'::text,b.marketing_expense_cost_per_sku,NULL::text,'currency'::text,'Source: exact-run Marketing common/regional allocation snapshots with approved policy-envelope and frozen-pool lineage.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,470,'Selected Scheme: OK'::text,'Selected scheme policy applicable for this SKU in Outside Kerala.'::text,'Frozen OK selected-scheme policy context for the refresh run.'::text,NULL::numeric,b.ok_selected_scheme_name,'text'::text,'Source: frozen selected-scheme policy context.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,480,'Scheme Value: OK'::text,'Value impact of the selected OK scheme on effective selling price.'::text,'OK Selling Price - frozen OK Scheme Effective Selling Price.'::text,b.ok_scheme_value,NULL::text,'currency'::text,'Source: exact Scheme Viability snapshot.'::text), ('D_OK_PRICING'::text,'PART D: OUTSIDE KERALA PRICING & SALES REALISATION'::text,490,'Sales Realisation: OK'::text,'Net sales realisation after contingency, marketing expense and selected scheme impact.'::text,'Frozen OK net sales realisation from Scheme Viability.'::text,b.ok_net_sales_realisation,NULL::text,'currency'::text,'Source: exact Scheme Viability snapshot.'::text), ('E_PROFIT'::text,'PART E: PROFIT CALCULATION'::text,510,'Profit Value: IK'::text,'Profit value for Inside Kerala after selected scheme and pricing-side deductions.'::text,'Frozen IK Margin Amount After Scheme.'::text,b.ik_profit_value,NULL::text,'currency'::text,'Source: exact Scheme Viability snapshot.'::text), ('E_PROFIT'::text,'PART E: PROFIT CALCULATION'::text,520,'Profit on Sales Realisation: IK (%)'::text,'IK profit percentage on sales realisation.'::text,'Frozen IK Margin Percentage After Scheme.'::text,b.ik_profit_percent,NULL::text,'percent'::text,'Source: exact Scheme Viability snapshot.'::text), ('E_PROFIT'::text,'PART E: PROFIT CALCULATION'::text,530,'COP Percentage on MRP IK'::text,'Manufacturing COP as a percentage of MRP IK.'::text,'Manufacturing COP ÷ MRP IK × 100.'::text,
                CASE
                    WHEN ((b.manufacturing_cop_per_sku IS NULL) OR (NULLIF(b.mrp_ik, (0)::numeric) IS NULL)) THEN NULL::numeric
                    ELSE ((b.manufacturing_cop_per_sku / NULLIF(b.mrp_ik, (0)::numeric)) * (100)::numeric)
                END,NULL::text,'percent'::text,'Source: exact Manufacturing COP and Pricing Bridge snapshots.'::text), ('E_PROFIT'::text,'PART E: PROFIT CALCULATION'::text,540,'Profit Value: OK'::text,'Profit value for Outside Kerala after selected scheme and pricing-side deductions.'::text,'Frozen OK Margin Amount After Scheme.'::text,b.ok_profit_value,NULL::text,'currency'::text,'Source: exact Scheme Viability snapshot.'::text), ('E_PROFIT'::text,'PART E: PROFIT CALCULATION'::text,550,'Profit on Sales Realisation: OK (%)'::text,'OK profit percentage on sales realisation.'::text,'Frozen OK Margin Percentage After Scheme.'::text,b.ok_profit_percent,NULL::text,'percent'::text,'Source: exact Scheme Viability snapshot.'::text), ('E_PROFIT'::text,'PART E: PROFIT CALCULATION'::text,560,'COP Percentage on MRP OK'::text,'Manufacturing COP as a percentage of MRP OK.'::text,'Manufacturing COP ÷ MRP OK × 100.'::text,
                CASE
                    WHEN ((b.manufacturing_cop_per_sku IS NULL) OR (NULLIF(b.mrp_ok, (0)::numeric) IS NULL)) THEN NULL::numeric
                    ELSE ((b.manufacturing_cop_per_sku / NULLIF(b.mrp_ok, (0)::numeric)) * (100)::numeric)
                END,NULL::text,'percent'::text,'Source: exact Manufacturing COP and Pricing Bridge snapshots.'::text), ('Z_STATUS'::text,'STATUS AND TRACEABILITY'::text,900,'Cost Sheet Status'::text,'Overall costing status for the SKU.'::text,'Derived from the exact material, costing, pricing, selected-policy and Scheme Viability context.'::text,NULL::numeric,b.cost_sheet_status,'text'::text,'Source: exact-tuple Cost Sheet status.'::text), ('Z_STATUS'::text,'STATUS AND TRACEABILITY'::text,910,'Cost Sheet Note'::text,'Diagnostic note explaining whether the cost sheet is ready, blocked or review-required.'::text,'Derived from exact-tuple Cost Sheet diagnostics.'::text,NULL::numeric,b.cost_sheet_note,'text'::text,'Source: exact-tuple Cost Sheet diagnostics.'::text)) x(section_code, section_title, line_order, line_label, line_description, calculation_basis, value_numeric, value_text, value_type, source_note))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_printable_cost_sheet_product_summary as
select q.* from (
WITH product_base AS (
         SELECT s_1.snapshot_period_start AS period_start,
            s_1.valuation_date,
            s_1.refresh_run_id,
            s_1.product_id,
            s_1.product_name,
            max(s_1.category_name) AS category_name,
            max(s_1.subcategory_name) AS subcategory_name,
            max(s_1.group_name) AS group_name,
            max(s_1.sub_group_name) AS sub_group_name,
            max(s_1.product_hierarchy) AS product_hierarchy,
            count(DISTINCT s_1.sku_id) AS sku_count,
            count(*) AS line_count,
            string_agg(DISTINCT s_1.sku_column_label, ', '::text ORDER BY s_1.sku_column_label) AS sku_column_labels,
            max(s_1.refreshed_at) AS refreshed_at,
            max(s_1.snapshot_refreshed_at) AS snapshot_refreshed_at
           FROM (costing.cost_sheet_line_monthly_snapshot s_1
             JOIN costing.v_current_successful_costing_refresh_run r ON (((r.period_start = s_1.snapshot_period_start) AND (r.valuation_date = s_1.valuation_date) AND (r.refresh_run_id = s_1.refresh_run_id))))
          GROUP BY s_1.snapshot_period_start, s_1.valuation_date, s_1.refresh_run_id, s_1.product_id, s_1.product_name
        ), status_by_product AS (
         SELECT s_1.snapshot_period_start AS period_start,
            s_1.valuation_date,
            s_1.refresh_run_id,
            s_1.product_id,
            count(DISTINCT s_1.sku_id) FILTER (WHERE ((s_1.line_label = 'Cost Sheet Status'::text) AND (s_1.value_text = 'BLOCKED'::text))) AS blocked_line_count,
            count(DISTINCT s_1.sku_id) FILTER (WHERE ((s_1.line_label = 'Cost Sheet Status'::text) AND (s_1.value_text = 'REVIEW_REQUIRED'::text))) AS review_required_line_count,
            count(DISTINCT s_1.sku_id) FILTER (WHERE ((s_1.line_label = 'Cost Sheet Status'::text) AND (s_1.value_text = 'READY'::text))) AS ready_line_count,
            max(s_1.value_text) FILTER (WHERE (s_1.line_label = 'Cost Sheet Note'::text)) AS sample_cost_sheet_note
           FROM (costing.cost_sheet_line_monthly_snapshot s_1
             JOIN costing.v_current_successful_costing_refresh_run r ON (((r.period_start = s_1.snapshot_period_start) AND (r.valuation_date = s_1.valuation_date) AND (r.refresh_run_id = s_1.refresh_run_id))))
          WHERE (s_1.line_label = ANY (ARRAY['Cost Sheet Status'::text, 'Cost Sheet Note'::text]))
          GROUP BY s_1.snapshot_period_start, s_1.valuation_date, s_1.refresh_run_id, s_1.product_id
        )
 SELECT b.period_start,
    b.product_id,
    b.product_name,
    b.category_name,
    b.subcategory_name,
    b.group_name,
    b.sub_group_name,
    b.product_hierarchy,
    b.sku_count,
    b.line_count,
    COALESCE(s.blocked_line_count, (0)::bigint) AS blocked_line_count,
    COALESCE(s.review_required_line_count, (0)::bigint) AS review_required_line_count,
    COALESCE(s.ready_line_count, (0)::bigint) AS ready_line_count,
        CASE
            WHEN (COALESCE(s.blocked_line_count, (0)::bigint) > 0) THEN 'BLOCKED'::text
            WHEN (COALESCE(s.review_required_line_count, (0)::bigint) > 0) THEN 'REVIEW_REQUIRED'::text
            WHEN (COALESCE(s.ready_line_count, (0)::bigint) = b.sku_count) THEN 'READY'::text
            ELSE NULL::text
        END AS cost_sheet_status,
        CASE
            WHEN (COALESCE(s.blocked_line_count, (0)::bigint) > 0) THEN 'One or more SKU cost sheets are blocked.'::text
            WHEN (COALESCE(s.review_required_line_count, (0)::bigint) > 0) THEN 'One or more SKU cost sheets require review.'::text
            WHEN (COALESCE(s.ready_line_count, (0)::bigint) = b.sku_count) THEN 'All SKU cost sheets are ready.'::text
            ELSE s.sample_cost_sheet_note
        END AS cost_sheet_note,
    b.sku_column_labels,
    b.refreshed_at,
    b.snapshot_refreshed_at,
    b.valuation_date,
    b.refresh_run_id
   FROM (product_base b
     LEFT JOIN status_by_product s ON (((s.period_start = b.period_start) AND (NOT (s.valuation_date IS DISTINCT FROM b.valuation_date)) AND (NOT (s.refresh_run_id IS DISTINCT FROM b.refresh_run_id)) AND (s.product_id = b.product_id))))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_product_status_summary as
select q.* from (
SELECT period_start,
    product_id,
    product_name,
    sku_count,
    blocked_sku_count,
    review_required_sku_count,
    ready_sku_count,
    product_costing_status,
    refreshed_at
   FROM costing.v_costing_product_status_summary
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_review_action_item_drilldown as
select q.* from (
SELECT material_line_status,
    material_issue_code,
    bom_source,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    product_id,
    product_name,
    product_hierarchy,
    sku_id,
    pack_size,
    sku_uom,
    line_no,
    qty_per_reference_output,
    uom_id,
    wastage_pct,
    is_optional,
    selected_rate,
    rate_source,
    rate_date,
    warning_code,
    warning_text,
    action_required,
    approval_block_flag,
    resolved_rate_stock_item_id,
    resolved_rate_stock_item_code,
    resolved_rate_stock_item_name,
    resolved_rate_stock_item_default_uom_id,
    form_conversion_applied,
    form_conversion_factor,
    form_conversion_consume_uom_id,
    form_conversion_purchase_uom_id,
    rate_lookup_basis,
    rate_resolution_note
   FROM costing.v_costing_review_action_item_drilldown
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_review_top_action_items as
select q.* from (
SELECT material_line_status,
    material_issue_code,
    bom_source,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    selected_rate,
    rate_source,
    rate_date,
    affected_line_count,
    affected_product_count,
    affected_sku_count,
    action_required,
    warning_text,
    recommended_action,
    priority_sort
   FROM costing.v_costing_review_top_action_items
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_review_workbench_summary as
select q.* from (
SELECT material_line_status,
    material_issue_code,
    bom_source,
    issue_line_count,
    affected_product_count,
    affected_sku_count,
    affected_stock_item_count,
    earliest_rate_date,
    latest_rate_date,
    priority_sort
   FROM costing.v_costing_review_workbench_summary
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_selected_scheme_policy as
select q.* from (
SELECT sku_id,
    product_id,
    product_name,
    region_code,
    scheme_id,
    scheme_name,
    paid_qty,
    free_qty,
    effective_from,
    effective_to,
    is_active,
    remarks,
    scheme_free_ratio,
    scheme_realisation_factor,
    policy_rule_id,
    policy_source,
    policy_scope,
    priority_sort,
    apply_mode,
    replace_from_scheme_id,
    category_id,
    category_name,
    sub_category_id,
    subcategory_name,
    product_group_id,
    group_name,
    sub_group_id,
    sub_group_name,
    pack_size,
    pack_uom,
    created_at,
    updated_at
   FROM costing.v_sku_selected_scheme_policy
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_sku_control_status as
select q.* from (
SELECT period_start,
    material_calculated_at,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    first_control_status,
    control_severity,
    recommended_ui_route,
    control_note,
    material_costing_status,
    rm_costing_status,
    pm_costing_status,
    rm_blocking_line_count,
    rm_blocking_stock_item_count,
    pm_blocking_line_count,
    pm_blocking_stock_item_count,
    rm_review_rate_line_count,
    pm_review_rate_line_count,
    rm_stale_purchase_rate_line_count,
    pm_stale_purchase_rate_line_count,
    rm_stock_valuation_fallback_line_count,
    pm_stock_valuation_fallback_line_count,
    rm_manual_rate_line_count,
    pm_manual_rate_line_count,
    material_costing_note,
    prime_costing_status,
    prime_costing_note,
    manufacturing_cop_status,
    manufacturing_cop_note,
    admin_overhead_allocation_status,
    finance_admin_overhead_allocation_status,
    internal_loaded_cost_status,
    internal_loaded_cost_note,
    marketing_expense_allocation_status,
    pricing_bridge_status,
    pricing_bridge_note,
    selling_price_bridge_status,
    cost_sheet_status,
    cost_sheet_note,
    material_cost_per_sku,
    direct_labour_cost_per_sku,
    prime_cost_per_sku,
    manufacturing_cop_per_sku,
    admin_overhead_cost_per_sku,
    finance_admin_overhead_cost_per_sku,
    internal_loaded_cost_per_sku,
    marketing_expense_cost_per_sku,
    pricing_cost_per_sku,
    mrp_ik,
    mrp_ok,
    ik_selling_price,
    ok_selling_price,
    ik_margin_amount_before_scheme,
    ik_margin_percent_before_scheme,
    ok_margin_amount_before_scheme,
    ok_margin_percent_before_scheme
   FROM costing.v_sku_costing_control_status
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_sku_status_diagnosis as
select q.* from (
WITH scheme_summary AS (
         SELECT sc.period_start,
            sc.sku_id,
            count(*) AS scheme_row_count,
            count(*) FILTER (WHERE ((sc.ik_scheme_margin_band = 'ACCEPTABLE'::text) AND (sc.ok_scheme_margin_band = 'ACCEPTABLE'::text))) AS acceptable_scheme_row_count,
            count(*) FILTER (WHERE ((sc.ik_scheme_margin_band = 'LOW_MARGIN'::text) OR (sc.ok_scheme_margin_band = 'LOW_MARGIN'::text))) AS low_margin_scheme_row_count,
            count(*) FILTER (WHERE ((sc.ik_scheme_margin_band = 'LOSS'::text) OR (sc.ok_scheme_margin_band = 'LOSS'::text))) AS loss_scheme_row_count,
            count(*) FILTER (WHERE (sc.scheme_viability_status = 'BLOCKED'::text)) AS blocked_scheme_row_count,
            count(*) FILTER (WHERE (sc.scheme_viability_status = 'REVIEW_REQUIRED'::text)) AS review_required_scheme_row_count,
            max(sc.ik_margin_percent_after_scheme) AS best_ik_margin_percent_after_scheme,
            max(sc.ok_margin_percent_after_scheme) AS best_ok_margin_percent_after_scheme,
            min(sc.ik_margin_percent_after_scheme) AS worst_ik_margin_percent_after_scheme,
            min(sc.ok_margin_percent_after_scheme) AS worst_ok_margin_percent_after_scheme
           FROM v_costing_pricing_sku_scheme_comparison sc
          GROUP BY sc.period_start, sc.sku_id
        ), base AS (
         SELECT pb.period_start,
            pb.sku_id,
            pb.product_id,
            pb.product_name,
            pb.pack_size,
            pb.pack_uom,
            concat(pb.product_name, ' - ', (pb.pack_size)::text, ' ', pb.pack_uom) AS sku_display_name,
            pb.mrp_ik,
            pb.mrp_ok,
            pb.manufacturing_cop_per_sku,
            pb.internal_loaded_cost_per_sku,
            pb.marketing_expense_cost_per_sku,
            pb.pricing_cost_per_sku,
            pb.internal_loaded_cost_status,
            pb.marketing_expense_allocation_status,
            pb.pricing_bridge_status,
            pb.pricing_bridge_note,
            mc.material_costing_status,
            mc.rm_costing_status,
            mc.pm_costing_status,
            mc.rm_blocking_line_count,
            mc.pm_blocking_line_count,
            mc.rm_blocking_stock_item_count,
            mc.pm_blocking_stock_item_count,
            mc.rm_review_rate_line_count,
            mc.pm_review_rate_line_count,
            mc.rm_stale_purchase_rate_line_count,
            mc.pm_stale_purchase_rate_line_count,
            mc.rm_stock_valuation_fallback_line_count,
            mc.pm_stock_valuation_fallback_line_count,
            mc.rm_manual_rate_line_count,
            mc.pm_manual_rate_line_count,
            mc.material_costing_note,
            ilc.manufacturing_cop_status,
            ilc.admin_overhead_allocation_status,
            ilc.finance_admin_overhead_allocation_status,
            ilc.internal_loaded_cost_note,
            COALESCE(ss.scheme_row_count, (0)::bigint) AS scheme_row_count,
            COALESCE(ss.acceptable_scheme_row_count, (0)::bigint) AS acceptable_scheme_row_count,
            COALESCE(ss.low_margin_scheme_row_count, (0)::bigint) AS low_margin_scheme_row_count,
            COALESCE(ss.loss_scheme_row_count, (0)::bigint) AS loss_scheme_row_count,
            COALESCE(ss.blocked_scheme_row_count, (0)::bigint) AS blocked_scheme_row_count,
            COALESCE(ss.review_required_scheme_row_count, (0)::bigint) AS review_required_scheme_row_count,
            ss.best_ik_margin_percent_after_scheme,
            ss.best_ok_margin_percent_after_scheme,
            ss.worst_ik_margin_percent_after_scheme,
            ss.worst_ok_margin_percent_after_scheme
           FROM (((costing.sku_pricing_bridge_snapshot pb
             LEFT JOIN costing.sku_material_cost_snapshot mc ON (((mc.period_start = pb.period_start) AND (mc.sku_id = pb.sku_id))))
             LEFT JOIN costing.sku_internal_loaded_cost_snapshot ilc ON (((ilc.period_start = pb.period_start) AND (ilc.sku_id = pb.sku_id))))
             LEFT JOIN scheme_summary ss ON (((ss.period_start = pb.period_start) AND (ss.sku_id = pb.sku_id))))
        ), diagnosed AS (
         SELECT b.period_start,
            b.sku_id,
            b.product_id,
            b.product_name,
            b.pack_size,
            b.pack_uom,
            b.sku_display_name,
            b.mrp_ik,
            b.mrp_ok,
            b.manufacturing_cop_per_sku,
            b.internal_loaded_cost_per_sku,
            b.marketing_expense_cost_per_sku,
            b.pricing_cost_per_sku,
            b.internal_loaded_cost_status,
            b.marketing_expense_allocation_status,
            b.pricing_bridge_status,
            b.pricing_bridge_note,
            b.material_costing_status,
            b.rm_costing_status,
            b.pm_costing_status,
            b.rm_blocking_line_count,
            b.pm_blocking_line_count,
            b.rm_blocking_stock_item_count,
            b.pm_blocking_stock_item_count,
            b.rm_review_rate_line_count,
            b.pm_review_rate_line_count,
            b.rm_stale_purchase_rate_line_count,
            b.pm_stale_purchase_rate_line_count,
            b.rm_stock_valuation_fallback_line_count,
            b.pm_stock_valuation_fallback_line_count,
            b.rm_manual_rate_line_count,
            b.pm_manual_rate_line_count,
            b.material_costing_note,
            b.manufacturing_cop_status,
            b.admin_overhead_allocation_status,
            b.finance_admin_overhead_allocation_status,
            b.internal_loaded_cost_note,
            b.scheme_row_count,
            b.acceptable_scheme_row_count,
            b.low_margin_scheme_row_count,
            b.loss_scheme_row_count,
            b.blocked_scheme_row_count,
            b.review_required_scheme_row_count,
            b.best_ik_margin_percent_after_scheme,
            b.best_ok_margin_percent_after_scheme,
            b.worst_ik_margin_percent_after_scheme,
            b.worst_ok_margin_percent_after_scheme,
                CASE
                    WHEN (b.pricing_bridge_status = 'BLOCKED'::text) THEN 'BLOCKED'::text
                    WHEN (b.pricing_bridge_status = 'REVIEW_REQUIRED'::text) THEN 'REVIEW_REQUIRED'::text
                    ELSE 'READY'::text
                END AS costing_confidence_status,
                CASE
                    WHEN (b.loss_scheme_row_count > 0) THEN 'NOT_ACCEPTABLE'::text
                    WHEN (b.low_margin_scheme_row_count > 0) THEN 'LOW_MARGIN'::text
                    WHEN (b.acceptable_scheme_row_count > 0) THEN 'ACCEPTABLE'::text
                    WHEN (b.scheme_row_count = 0) THEN 'NOT_EVALUATED'::text
                    ELSE 'REVIEW_REQUIRED'::text
                END AS commercial_viability_status,
                CASE
                    WHEN ((COALESCE(b.rm_blocking_line_count, (0)::bigint) > 0) AND (COALESCE(b.pm_blocking_line_count, (0)::bigint) > 0)) THEN 'MISSING_REQUIRED_RM_AND_PM_RATE'::text
                    WHEN (COALESCE(b.rm_blocking_line_count, (0)::bigint) > 0) THEN 'MISSING_REQUIRED_RM_RATE'::text
                    WHEN (COALESCE(b.pm_blocking_line_count, (0)::bigint) > 0) THEN 'MISSING_REQUIRED_PM_RATE'::text
                    WHEN (b.material_costing_status = 'BLOCKED'::text) THEN 'MATERIAL_COST_BLOCKED'::text
                    WHEN ((COALESCE(b.rm_stale_purchase_rate_line_count, (0)::bigint) > 0) OR (COALESCE(b.pm_stale_purchase_rate_line_count, (0)::bigint) > 0)) THEN 'STALE_PURCHASE_RATE_USED'::text
                    WHEN ((COALESCE(b.rm_stock_valuation_fallback_line_count, (0)::bigint) > 0) OR (COALESCE(b.pm_stock_valuation_fallback_line_count, (0)::bigint) > 0)) THEN 'STOCK_VALUATION_FALLBACK_USED'::text
                    WHEN ((COALESCE(b.rm_manual_rate_line_count, (0)::bigint) > 0) OR (COALESCE(b.pm_manual_rate_line_count, (0)::bigint) > 0)) THEN 'MANUAL_RATE_USED'::text
                    WHEN (b.material_costing_status = 'REVIEW_REQUIRED'::text) THEN 'MATERIAL_RATE_REVIEW_REQUIRED'::text
                    WHEN (b.internal_loaded_cost_status = 'BLOCKED'::text) THEN 'INTERNAL_LOADED_COST_BLOCKED'::text
                    WHEN (b.pricing_bridge_status = 'BLOCKED'::text) THEN 'PRICING_BRIDGE_BLOCKED'::text
                    WHEN (b.loss_scheme_row_count > 0) THEN 'SCHEME_CAUSES_LOSS'::text
                    WHEN (b.low_margin_scheme_row_count > 0) THEN 'SCHEME_LOW_MARGIN'::text
                    WHEN (b.review_required_scheme_row_count > 0) THEN 'SCHEME_CALCULATED_WITH_REVIEW_REQUIRED_COST'::text
                    ELSE 'READY'::text
                END AS primary_diagnostic_code
           FROM base b
        )
 SELECT period_start,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    sku_display_name,
    costing_confidence_status,
    commercial_viability_status,
        CASE
            WHEN (costing_confidence_status = 'BLOCKED'::text) THEN 'COMPLETE_MISSING_COST_DATA'::text
            WHEN (costing_confidence_status = 'REVIEW_REQUIRED'::text) THEN 'REVIEW_COST_INPUTS'::text
            WHEN (commercial_viability_status = 'NOT_ACCEPTABLE'::text) THEN 'REJECT_OR_REPRICE'::text
            WHEN (commercial_viability_status = 'LOW_MARGIN'::text) THEN 'REVIEW_COMMERCIAL_MARGIN'::text
            WHEN (commercial_viability_status = 'ACCEPTABLE'::text) THEN 'COMMERCIALLY_ACCEPTABLE'::text
            ELSE 'REVIEW_REQUIRED'::text
        END AS final_action_status,
        CASE
            WHEN ((primary_diagnostic_code ~~ 'MISSING_REQUIRED_%'::text) OR (primary_diagnostic_code = ANY (ARRAY['MATERIAL_COST_BLOCKED'::text, 'STALE_PURCHASE_RATE_USED'::text, 'STOCK_VALUATION_FALLBACK_USED'::text, 'MANUAL_RATE_USED'::text, 'MATERIAL_RATE_REVIEW_REQUIRED'::text]))) THEN 'MATERIAL_COST'::text
            WHEN (primary_diagnostic_code = ANY (ARRAY['INTERNAL_LOADED_COST_BLOCKED'::text, 'PRICING_BRIDGE_BLOCKED'::text])) THEN 'PRICING_COST_CHAIN'::text
            WHEN (primary_diagnostic_code = ANY (ARRAY['SCHEME_CAUSES_LOSS'::text, 'SCHEME_LOW_MARGIN'::text, 'SCHEME_CALCULATED_WITH_REVIEW_REQUIRED_COST'::text])) THEN 'SCHEME_MARGIN'::text
            ELSE 'READY'::text
        END AS primary_diagnostic_layer,
    primary_diagnostic_code,
        CASE
            WHEN (primary_diagnostic_code = 'MISSING_REQUIRED_RM_AND_PM_RATE'::text) THEN 'Required raw material and packing material rates are missing. Costing cannot be approved until rates are entered.'::text
            WHEN (primary_diagnostic_code = 'MISSING_REQUIRED_RM_RATE'::text) THEN 'Required raw material rate is missing. Costing cannot be approved until RM rates are entered.'::text
            WHEN (primary_diagnostic_code = 'MISSING_REQUIRED_PM_RATE'::text) THEN 'Required packing material rate is missing. Costing cannot be approved until PM rates are entered.'::text
            WHEN (primary_diagnostic_code = 'MATERIAL_COST_BLOCKED'::text) THEN COALESCE(material_costing_note, 'Material cost is blocked and requires correction before costing approval.'::text)
            WHEN (primary_diagnostic_code = 'STALE_PURCHASE_RATE_USED'::text) THEN 'Cost can be calculated, but one or more material rates are based on stale purchase rates.'::text
            WHEN (primary_diagnostic_code = 'STOCK_VALUATION_FALLBACK_USED'::text) THEN 'Cost can be calculated, but one or more material rates are based on stock valuation fallback.'::text
            WHEN (primary_diagnostic_code = 'MANUAL_RATE_USED'::text) THEN 'Cost can be calculated, but one or more material rates use manual rate entries.'::text
            WHEN (primary_diagnostic_code = 'MATERIAL_RATE_REVIEW_REQUIRED'::text) THEN COALESCE(material_costing_note, 'Material cost requires review.'::text)
            WHEN (primary_diagnostic_code = 'SCHEME_CAUSES_LOSS'::text) THEN 'One or more scheme options cause loss.'::text
            WHEN (primary_diagnostic_code = 'SCHEME_LOW_MARGIN'::text) THEN 'One or more scheme options fall into low margin band.'::text
            WHEN (primary_diagnostic_code = 'SCHEME_CALCULATED_WITH_REVIEW_REQUIRED_COST'::text) THEN 'Scheme margin is commercially acceptable, but the underlying costing inputs require review.'::text
            WHEN (primary_diagnostic_code = 'READY'::text) THEN 'Costing and commercial viability are ready.'::text
            ELSE COALESCE(pricing_bridge_note, internal_loaded_cost_note, material_costing_note, 'Review required.'::text)
        END AS primary_diagnostic_note,
        CASE
            WHEN (primary_diagnostic_code = ANY (ARRAY['MISSING_REQUIRED_RM_AND_PM_RATE'::text, 'MISSING_REQUIRED_RM_RATE'::text, 'MISSING_REQUIRED_PM_RATE'::text])) THEN 'Enter missing material rates in Manual Rate Manager or correct purchase/valuation source data.'::text
            WHEN (primary_diagnostic_code = 'MATERIAL_COST_BLOCKED'::text) THEN 'Review the product material costing configuration and complete the missing RM/PM standard cost source before approval.'::text
            WHEN (primary_diagnostic_code = ANY (ARRAY['STALE_PURCHASE_RATE_USED'::text, 'STOCK_VALUATION_FALLBACK_USED'::text, 'MANUAL_RATE_USED'::text, 'MATERIAL_RATE_REVIEW_REQUIRED'::text])) THEN 'Review material rate sources and approve or update rates before final pricing approval.'::text
            WHEN (primary_diagnostic_code = ANY (ARRAY['SCHEME_CAUSES_LOSS'::text, 'SCHEME_LOW_MARGIN'::text])) THEN 'Review scheme policy, MRP, discount, or pricing assumptions.'::text
            WHEN (primary_diagnostic_code = 'SCHEME_CALCULATED_WITH_REVIEW_REQUIRED_COST'::text) THEN 'Commercial scheme result is acceptable, but finalize only after costing review is completed.'::text
            ELSE 'No immediate action required.'::text
        END AS recommended_action,
    material_costing_status,
    rm_costing_status,
    pm_costing_status,
    internal_loaded_cost_status,
    marketing_expense_allocation_status,
    pricing_bridge_status,
    pricing_bridge_note,
    rm_blocking_line_count,
    pm_blocking_line_count,
    rm_blocking_stock_item_count,
    pm_blocking_stock_item_count,
    rm_review_rate_line_count,
    pm_review_rate_line_count,
    rm_stale_purchase_rate_line_count,
    pm_stale_purchase_rate_line_count,
    rm_stock_valuation_fallback_line_count,
    pm_stock_valuation_fallback_line_count,
    rm_manual_rate_line_count,
    pm_manual_rate_line_count,
    material_costing_note,
    scheme_row_count,
    acceptable_scheme_row_count,
    low_margin_scheme_row_count,
    loss_scheme_row_count,
    blocked_scheme_row_count,
    review_required_scheme_row_count,
    best_ik_margin_percent_after_scheme,
    best_ok_margin_percent_after_scheme,
    worst_ik_margin_percent_after_scheme,
    worst_ok_margin_percent_after_scheme,
    mrp_ik,
    mrp_ok,
    manufacturing_cop_per_sku,
    internal_loaded_cost_per_sku,
    marketing_expense_cost_per_sku,
    pricing_cost_per_sku
   FROM diagnosed d
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_workflow_diagnostics as
select q.* from (
SELECT period_start,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    pricing_bridge_status,
    selling_price_bridge_status,
    scheme_viability_status,
    internal_loaded_cost_status,
    manufacturing_cop_status,
    material_cost_per_sku,
    direct_labour_cost_per_sku,
    manufacturing_cop_per_sku,
    internal_loaded_cost_per_sku,
    marketing_expense_cost_per_sku,
    pricing_cost_per_sku,
    pricing_bridge_note,
    selling_price_bridge_note,
    primary_diagnostic_code,
    primary_diagnostic_note,
    refreshed_at,
    valuation_date,
    refresh_run_id
   FROM costing.v_pricing_workflow_diagnostics
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_scheme_master_audit as
select q.* from (
SELECT id AS audit_event_id,
    scheme_id,
    COALESCE((new_snapshot ->> 'scheme_name'::text), (old_snapshot ->> 'scheme_name'::text)) AS scheme_name,
    event_type,
    reason,
    approval_reference,
    actor_user_id,
    event_at,
    NULLIF((old_snapshot ->> 'scheme_name'::text), ''::text) AS old_scheme_name,
    NULLIF((new_snapshot ->> 'scheme_name'::text), ''::text) AS new_scheme_name,
    (NULLIF((old_snapshot ->> 'paid_qty'::text), ''::text))::numeric AS old_paid_qty,
    (NULLIF((new_snapshot ->> 'paid_qty'::text), ''::text))::numeric AS new_paid_qty,
    (NULLIF((old_snapshot ->> 'free_qty'::text), ''::text))::numeric AS old_free_qty,
    (NULLIF((new_snapshot ->> 'free_qty'::text), ''::text))::numeric AS new_free_qty,
    (NULLIF((old_snapshot ->> 'is_active'::text), ''::text))::boolean AS old_is_active,
    (NULLIF((new_snapshot ->> 'is_active'::text), ''::text))::boolean AS new_is_active,
    NULLIF((old_snapshot ->> 'remarks'::text), ''::text) AS old_remarks,
    NULLIF((new_snapshot ->> 'remarks'::text), ''::text) AS new_remarks,
    NULLIF((old_snapshot ->> 'approval_reference'::text), ''::text) AS old_approval_reference,
    NULLIF((new_snapshot ->> 'approval_reference'::text), ''::text) AS new_approval_reference
   FROM costing.scheme_master_audit a
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_scheme_policy_selected_overview as
select q.* from (
SELECT ps.id AS sku_id,
    ps.product_id,
    p.item AS product_name,
    ps.pack_size,
    ps.uom AS pack_uom,
    concat_ws(' - '::text, p.item, concat_ws(' '::text, TRIM(BOTH FROM to_char(ps.pack_size, 'FM999999999.########'::text)), ps.uom)) AS sku_display_name,
    sg.id AS sub_group_id,
    sg.sub_group_name,
    pg.id AS product_group_id,
    pg.group_name,
    sc.id AS sub_category_id,
    sc.subcategory_name,
    c.id AS category_id,
    c.category_name,
    ik.scheme_id AS ik_scheme_id,
    ik.scheme_name AS ik_scheme_name,
    ik.paid_qty AS ik_paid_qty,
    ik.free_qty AS ik_free_qty,
    ik.policy_source AS ik_policy_source,
    ik.policy_scope AS ik_policy_scope,
    ik.policy_rule_id AS ik_policy_rule_id,
    ik.priority_sort AS ik_priority_sort,
    ik.apply_mode AS ik_apply_mode,
    ik.replace_from_scheme_id AS ik_replace_from_scheme_id,
    ik.effective_from AS ik_effective_from,
    ik.effective_to AS ik_effective_to,
    ik.remarks AS ik_remarks,
        CASE
            WHEN ((ik.policy_source = 'HIERARCHY_RULE'::text) AND (ik.policy_scope = 'SKU'::text)) THEN 'SKU Override'::text
            WHEN ((ik.policy_source = 'HIERARCHY_RULE'::text) AND (ik.policy_scope = 'PRODUCT'::text)) THEN 'Product Default'::text
            WHEN ((ik.policy_source = 'HIERARCHY_RULE'::text) AND (ik.policy_scope = 'SUB_GROUP'::text)) THEN 'Sub-group Default'::text
            WHEN ((ik.policy_source = 'HIERARCHY_RULE'::text) AND (ik.policy_scope = 'PRODUCT_GROUP'::text)) THEN 'Product Group Default'::text
            WHEN ((ik.policy_source = 'HIERARCHY_RULE'::text) AND (ik.policy_scope = 'SUB_CATEGORY'::text)) THEN 'Sub-category Default'::text
            WHEN ((ik.policy_source = 'HIERARCHY_RULE'::text) AND (ik.policy_scope = 'CATEGORY'::text)) THEN 'Category Default'::text
            WHEN ((ik.policy_source = 'LEGACY_SKU_POLICY'::text) AND (lower(TRIM(BOTH FROM ik.scheme_name)) = 'no scheme'::text)) THEN 'No Scheme Baseline'::text
            WHEN (ik.policy_source = 'LEGACY_SKU_POLICY'::text) THEN 'Legacy SKU Policy'::text
            ELSE 'Missing'::text
        END AS ik_policy_source_label,
    ok.scheme_id AS ok_scheme_id,
    ok.scheme_name AS ok_scheme_name,
    ok.paid_qty AS ok_paid_qty,
    ok.free_qty AS ok_free_qty,
    ok.policy_source AS ok_policy_source,
    ok.policy_scope AS ok_policy_scope,
    ok.policy_rule_id AS ok_policy_rule_id,
    ok.priority_sort AS ok_priority_sort,
    ok.apply_mode AS ok_apply_mode,
    ok.replace_from_scheme_id AS ok_replace_from_scheme_id,
    ok.effective_from AS ok_effective_from,
    ok.effective_to AS ok_effective_to,
    ok.remarks AS ok_remarks,
        CASE
            WHEN ((ok.policy_source = 'HIERARCHY_RULE'::text) AND (ok.policy_scope = 'SKU'::text)) THEN 'SKU Override'::text
            WHEN ((ok.policy_source = 'HIERARCHY_RULE'::text) AND (ok.policy_scope = 'PRODUCT'::text)) THEN 'Product Default'::text
            WHEN ((ok.policy_source = 'HIERARCHY_RULE'::text) AND (ok.policy_scope = 'SUB_GROUP'::text)) THEN 'Sub-group Default'::text
            WHEN ((ok.policy_source = 'HIERARCHY_RULE'::text) AND (ok.policy_scope = 'PRODUCT_GROUP'::text)) THEN 'Product Group Default'::text
            WHEN ((ok.policy_source = 'HIERARCHY_RULE'::text) AND (ok.policy_scope = 'SUB_CATEGORY'::text)) THEN 'Sub-category Default'::text
            WHEN ((ok.policy_source = 'HIERARCHY_RULE'::text) AND (ok.policy_scope = 'CATEGORY'::text)) THEN 'Category Default'::text
            WHEN ((ok.policy_source = 'LEGACY_SKU_POLICY'::text) AND (lower(TRIM(BOTH FROM ok.scheme_name)) = 'no scheme'::text)) THEN 'No Scheme Baseline'::text
            WHEN (ok.policy_source = 'LEGACY_SKU_POLICY'::text) THEN 'Legacy SKU Policy'::text
            ELSE 'Missing'::text
        END AS ok_policy_source_label
   FROM (((((((product_skus ps
     JOIN products p ON (((p.id)::bigint = ps.product_id)))
     LEFT JOIN sub_groups sg ON ((sg.id = p.sub_group_id)))
     LEFT JOIN product_groups pg ON ((pg.id = sg.product_group_id)))
     LEFT JOIN sub_categories sc ON ((sc.id = pg.sub_category_id)))
     LEFT JOIN categories c ON ((c.id = sc.category_id)))
     LEFT JOIN costing.v_sku_selected_scheme_policy ik ON (((ik.sku_id = ps.id) AND (ik.region_code = 'IK'::text))))
     LEFT JOIN costing.v_sku_selected_scheme_policy ok ON (((ok.sku_id = ps.id) AND (ok.region_code = 'OK'::text))))
  WHERE (COALESCE(ps.is_active, true) = true)
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_staff_classification_register as
select q.* from (
WITH latest_salary AS (
         SELECT DISTINCT ON (c.staff_id) c.staff_id,
            c.period_start AS latest_salary_period_start,
            c.basic_salary,
            c.allowance_amount,
            c.employer_contribution,
            c.other_salary_cost,
            c.total_salary_cost,
            c.source_note AS salary_source_note
           FROM hr.staff_compensation_monthly c
          WHERE (c.is_active = true)
          ORDER BY c.staff_id, c.period_start DESC
        ), latest_active_class AS (
         SELECT DISTINCT ON (cls_1.staff_id) cls_1.id AS classification_id,
            cls_1.staff_id,
            cls_1.costing_class,
            cls_1.allocation_pool,
            cls_1.effective_from,
            cls_1.effective_to,
            cls_1.allocation_weight,
            cls_1.remarks,
            cls_1.is_active,
            cls_1.created_at,
            cls_1.updated_at
           FROM costing.staff_costing_classification cls_1
          WHERE ((cls_1.is_active = true) AND (cls_1.effective_to IS NULL))
          ORDER BY cls_1.staff_id, cls_1.effective_from DESC, cls_1.id DESC
        )
 SELECT s.id AS staff_id,
    s.employee_code,
    s.designation,
    s.is_active AS staff_is_active,
    sal.latest_salary_period_start,
    sal.basic_salary,
    sal.allowance_amount,
    sal.employer_contribution,
    sal.other_salary_cost,
    sal.total_salary_cost,
    sal.salary_source_note,
    cls.classification_id,
    cls.costing_class,
    COALESCE(opt.costing_class_label, cls.costing_class) AS costing_class_label,
    cls.allocation_pool,
    cls.effective_from,
    cls.effective_to,
    cls.allocation_weight,
    cls.remarks,
    cls.is_active AS classification_is_active,
    cls.created_at AS classification_created_at,
    cls.updated_at AS classification_updated_at,
        CASE
            WHEN (s.is_active IS NOT TRUE) THEN 'INACTIVE_STAFF'::text
            WHEN (sal.staff_id IS NULL) THEN 'MISSING_SALARY'::text
            WHEN (cls.classification_id IS NULL) THEN 'UNCLASSIFIED'::text
            WHEN (cls.allocation_pool = 'EXCLUDED'::text) THEN 'EXCLUDED'::text
            ELSE 'CLASSIFIED'::text
        END AS classification_status,
        CASE
            WHEN (s.is_active IS NOT TRUE) THEN 'Staff is inactive in HR master.'::text
            WHEN (sal.staff_id IS NULL) THEN 'No active salary compensation row found for this staff.'::text
            WHEN (cls.classification_id IS NULL) THEN 'No active costing classification found.'::text
            WHEN (cls.allocation_pool = 'EXCLUDED'::text) THEN 'Staff is excluded from product costing.'::text
            ELSE 'Staff costing classification is active.'::text
        END AS classification_note,
    s.full_name AS staff_display_name
   FROM (((hr.staff s
     LEFT JOIN latest_salary sal ON ((sal.staff_id = s.id)))
     LEFT JOIN latest_active_class cls ON ((cls.staff_id = s.id)))
     LEFT JOIN v_costing_staff_costing_class_options opt ON ((opt.costing_class = cls.costing_class)))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_staff_cost_pool_summary as
select q.* from (
SELECT p.period_start,
    p.allocation_pool,
    p.costing_class,
    COALESCE(opt.costing_class_label, p.costing_class) AS costing_class_label,
    p.staff_count,
    p.pool_amount,
    p.staff_details,
        CASE
            WHEN ((p.pool_amount IS NULL) OR (p.pool_amount = (0)::numeric)) THEN 'REVIEW_REQUIRED'::text
            ELSE 'READY'::text
        END AS pool_status
   FROM (costing.v_staff_cost_pool_monthly p
     LEFT JOIN v_costing_staff_costing_class_options opt ON ((opt.costing_class = p.costing_class)))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_unclassified_staff_for_costing as
select q.* from (
SELECT staff_id,
    employee_code,
    designation,
    staff_is_active,
    latest_salary_period_start,
    basic_salary,
    allowance_amount,
    employer_contribution,
    other_salary_cost,
    total_salary_cost,
    salary_source_note,
    classification_id,
    costing_class,
    costing_class_label,
    allocation_pool,
    effective_from,
    effective_to,
    allocation_weight,
    remarks,
    classification_is_active,
    classification_created_at,
    classification_updated_at,
    classification_status,
    classification_note,
    staff_display_name
   FROM v_costing_staff_classification_register r
  WHERE ((staff_is_active = true) AND ((classification_status = ANY (ARRAY['UNCLASSIFIED'::text, 'MISSING_SALARY'::text])) OR (total_salary_cost IS NULL) OR (total_salary_cost = (0)::numeric)))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_unmapped_expense_heads_for_mapping as
select q.* from (
SELECT expense_group,
    head_name,
    snapshot_count,
    first_seen_date,
    latest_seen_date,
    max_seen_value,
        CASE
            WHEN (abs(COALESCE(max_seen_value, (0)::numeric)) >= (1000000)::numeric) THEN 'HIGH'::text
            WHEN (abs(COALESCE(max_seen_value, (0)::numeric)) >= (100000)::numeric) THEN 'MEDIUM'::text
            ELSE 'LOW'::text
        END AS materiality_band,
        CASE
            WHEN ((head_name ~~* '%salary%'::text) OR (head_name ~~* '%allowance%'::text) OR (head_name ~~* '%employer contribution%'::text)) THEN 'Likely staff-cost related. Prefer staff classification route or EXCLUDED if already handled there.'::text
            WHEN (head_name ~~* '%job work%'::text) THEN 'Review carefully. May be DIRECT_LABOUR or PRODUCTION_OVERHEAD depending on nature.'::text
            WHEN ((head_name ~~* '%carriage outward%'::text) OR (head_name ~~* '%postage%'::text) OR (head_name ~~* '%courier%'::text) OR (head_name ~~* '%travelling%'::text) OR (head_name ~~* '%vehicle%'::text)) THEN 'Likely commercial / distribution / marketing support. Review before assigning to MARKETING_EXPENSE.'::text
            WHEN ((head_name ~~* '%rent%'::text) OR (head_name ~~* '%security%'::text) OR (head_name ~~* '%cleaning%'::text) OR (head_name ~~* '%repairs%'::text) OR (head_name ~~* '%maintenance%'::text) OR (head_name ~~* '%electricity%'::text) OR (head_name ~~* '%water%'::text)) THEN 'Likely overhead. Choose production/admin/stores depending on usage.'::text
            WHEN ((head_name ~~* '%audit%'::text) OR (head_name ~~* '%legal%'::text) OR (head_name ~~* '%professional%'::text) OR (head_name ~~* '%insurance%'::text) OR (head_name ~~* '%tax%'::text) OR (head_name ~~* '%charges%'::text) OR (head_name ~~* '%ineligible itc%'::text)) THEN 'Likely finance/admin overhead. Review before mapping.'::text
            WHEN (head_name ~~* '%research%'::text) THEN 'Review separately. May be excluded, admin overhead, or R&D project cost depending on policy.'::text
            WHEN ((head_name ~~* '%round off%'::text) OR (head_name ~~* '%fine%'::text) OR (head_name ~~* '%penalty%'::text)) THEN 'Usually exclude from product costing unless management decides otherwise.'::text
            ELSE 'Review and map to appropriate costing pool or exclude.'::text
        END AS suggested_review_note
   FROM costing.v_unmapped_expense_heads_for_costing u
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_expense_allocation_pool_options with (security_invoker=true) as
select q.* from (
SELECT allocation_pool,
    allocation_pool_label,
    sort_order,
    include_in_costing_default,
    pool_note
   FROM ( VALUES ('DIRECT_LABOUR'::text,'Direct Labour'::text,10,true,'Direct labour pool. Normally staff-classification driven; use for non-staff direct labour only when justified.'::text), ('PRODUCTION_OVERHEAD'::text,'Production Overhead'::text,20,true,'Factory production overhead such as utilities, repairs, factory expenses, cleaning, fuel, and production support.'::text), ('QUALITY_CONTROL_OVERHEAD'::text,'Quality Control Overhead'::text,30,true,'QC/lab testing and quality control support expenses.'::text), ('MATERIALS_STORES_OVERHEAD'::text,'Materials / Stores Overhead'::text,40,true,'Stores, inward freight, packing/forwarding support, material receipt and warehouse-related overhead.'::text), ('ADMIN_OVERHEAD'::text,'Admin Overhead'::text,50,true,'General administrative overhead not directly attributable to production, QC, stores, finance, or marketing.'::text), ('FINANCE_ADMIN_OVERHEAD'::text,'Finance / Admin Overhead'::text,60,true,'Finance cost, bank charges, interest, audit, legal, professional, statutory and finance-admin expenses.'::text), ('MARKETING_EXPENSE'::text,'Marketing Expense'::text,70,true,'Field work, sales promotion, advertisement, discounts, outward commercial support and marketing costs.'::text), ('EXCLUDED'::text,'Excluded from Costing'::text,90,false,'Excluded from costing. Use only when the head is handled elsewhere or should not enter product costing.'::text)) x(allocation_pool, allocation_pool_label, sort_order, include_in_costing_default, pool_note)
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_manual_provision_pool_options with (security_invoker=true) as
select q.* from (
SELECT allocation_pool,
    allocation_pool_label,
    sort_order
   FROM v_costing_expense_allocation_pool_options
  WHERE (allocation_pool <> 'EXCLUDED'::text)
  ORDER BY sort_order, allocation_pool
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_manual_provision_type_options with (security_invoker=true) as
select q.* from (
SELECT provision_type,
    provision_type_label,
    provision_type_note,
    sort_order
   FROM ( VALUES ('HEAD_OFFICE_ALLOCATION'::text,'Head Office Allocation'::text,'Manual allocation of head office administrative or shared overhead to a costing pool.'::text,10), ('MANAGEMENT_ADJUSTMENT'::text,'Management Adjustment'::text,'Management-approved costing adjustment not directly available from staff salary or Tally expense mapping.'::text,20), ('PERIOD_PROVISION'::text,'Period Provision'::text,'Monthly provision entered for costing completeness before final accounts are available.'::text,30), ('REVERSAL_OR_CORRECTION'::text,'Reversal / Correction'::text,'Correction or reversal of a previously entered manual costing provision.'::text,40)) t(provision_type, provision_type_label, provision_type_note, sort_order)
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_material_manual_rate_history with (security_invoker=false) as
select q.* from (
WITH latest_item_name AS (
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
          WHERE (s.stock_item_id IS NOT NULL)
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
    COALESCE(NULLIF((mmr.source_snapshot ->> 'vendor_display_name'::text), ''::text), v.display_name) AS source_vendor_display_name,
    (NULLIF((mmr.source_snapshot ->> 'rate_value'::text), ''::text))::numeric AS source_rate_value,
    (NULLIF((mmr.source_snapshot ->> 'uom_id'::text), ''::text))::bigint AS source_uom_id,
    NULLIF((mmr.source_snapshot ->> 'uom_code'::text), ''::text) AS source_uom_code,
    (NULLIF((mmr.source_snapshot ->> 'valid_from'::text), ''::text))::date AS source_valid_from,
    (NULLIF((mmr.source_snapshot ->> 'valid_to'::text), ''::text))::date AS source_valid_to,
    (NULLIF((mmr.source_snapshot ->> 'min_order_qty'::text), ''::text))::numeric AS source_min_order_qty,
    (NULLIF((mmr.source_snapshot ->> 'lead_time_days'::text), ''::text))::integer AS source_lead_time_days,
    NULLIF((mmr.source_snapshot ->> 'remarks'::text), ''::text) AS source_remarks,
    (NULLIF((mmr.source_snapshot ->> 'adopted_at'::text), ''::text))::timestamp with time zone AS source_adopted_at
   FROM (((costing.material_manual_rates mmr
     LEFT JOIN latest_item_name lin ON ((lin.stock_item_id = mmr.stock_item_id)))
     LEFT JOIN inv_stock_item i ON ((i.id = mmr.stock_item_id)))
     LEFT JOIN proc_vendor v ON ((v.vendor_id = mmr.source_vendor_id)))
  ORDER BY COALESCE(lin.stock_item_name, i.name), mmr.stock_item_id, mmr.effective_from DESC, mmr.id DESC
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_material_manual_rate_register with (security_invoker=false) as
select q.* from (
SELECT h.manual_rate_id,
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
            WHEN ((h.status = 'ACTIVE'::text) AND (r.manual_rate_overrides_purchase_rate = true)) THEN 'REVIEW_REQUIRED'::text
            WHEN ((h.status = 'ACTIVE'::text) AND (r.latest_purchase_rate IS NULL)) THEN 'ACTIVE_NO_PURCHASE_RATE'::text
            WHEN (h.status = 'ACTIVE'::text) THEN 'ACTIVE'::text
            ELSE 'INACTIVE'::text
        END AS register_status,
        CASE
            WHEN ((h.status = 'ACTIVE'::text) AND (r.newer_purchase_rate_available = true)) THEN 'Review whether governed costing rate should be revised or ended because a newer purchase rate is available.'::text
            WHEN ((h.status = 'ACTIVE'::text) AND (r.manual_rate_overrides_purchase_rate = true)) THEN 'Review whether governed costing rate should continue because a purchase rate is available.'::text
            WHEN ((h.status = 'ACTIVE'::text) AND (r.latest_purchase_rate IS NULL)) THEN 'Governed costing rate is active because no purchase rate is available.'::text
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
   FROM (v_costing_material_manual_rate_history h
     LEFT JOIN v_costing_material_manual_rate_review r ON ((r.stock_item_id = h.stock_item_id)))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_material_manual_rate_review with (security_invoker=true) as
select q.* from (
WITH active_manual_rate AS (
         SELECT DISTINCT ON (m.stock_item_id) m.id AS manual_rate_id,
            m.stock_item_id,
            m.rate_value AS manual_rate_value,
            m.effective_from AS manual_rate_effective_from,
            m.effective_to AS manual_rate_effective_to,
            m.reason AS manual_rate_reason,
            m.status AS manual_rate_status,
            m.created_at AS manual_rate_created_at,
            m.last_updated_at AS manual_rate_last_updated_at
           FROM costing.material_manual_rates m
          WHERE ((m.status = 'ACTIVE'::text) AND (m.effective_from <= CURRENT_DATE) AND ((m.effective_to IS NULL) OR (m.effective_to >= CURRENT_DATE)))
          ORDER BY m.stock_item_id, m.effective_from DESC, m.id DESC
        ), latest_purchase_rate AS (
         SELECT p.stock_item_id,
            p.last_rate_value AS latest_purchase_rate,
            p.last_purchase_date AS latest_purchase_date
           FROM v_proc_item_vendor_last_purchase p
          WHERE ((p.last_rate_value IS NOT NULL) AND (p.last_rate_value > (0)::numeric))
        )
 SELECT i.id AS stock_item_id,
    i.code AS stock_item_code,
    i.name AS stock_item_name,
    amr.manual_rate_id,
    amr.manual_rate_value,
    amr.manual_rate_effective_from,
    amr.manual_rate_effective_to,
    amr.manual_rate_reason,
    amr.manual_rate_status,
    amr.manual_rate_created_at,
    amr.manual_rate_last_updated_at,
    lpr.latest_purchase_rate,
    lpr.latest_purchase_date,
        CASE
            WHEN ((amr.manual_rate_id IS NOT NULL) AND (lpr.latest_purchase_rate IS NOT NULL)) THEN true
            ELSE false
        END AS manual_rate_overrides_purchase_rate,
        CASE
            WHEN ((amr.manual_rate_id IS NOT NULL) AND (lpr.latest_purchase_rate IS NOT NULL) AND (lpr.latest_purchase_date >= amr.manual_rate_effective_from)) THEN true
            ELSE false
        END AS newer_purchase_rate_available,
        CASE
            WHEN ((amr.manual_rate_id IS NOT NULL) AND (lpr.latest_purchase_rate IS NOT NULL) AND (lpr.latest_purchase_date >= amr.manual_rate_effective_from)) THEN 'ACTIVE manual rate is overriding a purchase rate dated on or after the manual rate effective date. Review whether the manual rate should be closed.'::text
            WHEN ((amr.manual_rate_id IS NOT NULL) AND (lpr.latest_purchase_rate IS NOT NULL)) THEN 'ACTIVE manual rate is overriding an available purchase rate. Review whether manual rate should continue.'::text
            WHEN ((amr.manual_rate_id IS NOT NULL) AND (lpr.latest_purchase_rate IS NULL)) THEN 'ACTIVE manual rate is being used because no latest purchase rate is available.'::text
            ELSE 'No active manual rate.'::text
        END AS review_message
   FROM ((inv_stock_item i
     LEFT JOIN active_manual_rate amr ON ((amr.stock_item_id = i.id)))
     LEFT JOIN latest_purchase_rate lpr ON ((lpr.stock_item_id = i.id)))
  WHERE (i.active = true)
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_policy_manager_scheme_options with (security_invoker=true) as
select q.* from (
SELECT id AS scheme_id,
    scheme_name,
    paid_qty,
    free_qty,
    is_active,
    remarks
   FROM costing.scheme_master sm
  WHERE (is_active = true)
  ORDER BY paid_qty, free_qty, scheme_name
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_sku_detailed_cost_sheet with (security_invoker=true) as
select q.* from (
SELECT period_start,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    mrp_ik,
    mrp_ok,
    material_cost_per_sku,
    direct_labour_cost_per_sku,
    prime_cost_per_sku,
    production_overhead_cost_per_sku,
    quality_control_overhead_cost_per_sku,
    materials_stores_overhead_cost_per_sku,
    manufacturing_cop_per_sku,
    admin_overhead_cost_per_sku,
    finance_admin_overhead_cost_per_sku,
    internal_loaded_cost_per_sku,
    marketing_expense_cost_per_sku,
    pricing_cost_per_sku,
    gst_percent,
    ik_basic_price,
    ok_basic_price,
    ik_discount_percent,
    ok_discount_percent,
    ik_discount_amount,
    ok_discount_amount,
    ik_selling_price,
    ok_selling_price,
    contingency_percent,
    ik_contingency_value,
    ok_contingency_value,
    ik_margin_amount_before_scheme,
    ik_margin_percent_before_scheme,
    ok_margin_amount_before_scheme,
    ok_margin_percent_before_scheme,
    internal_loaded_cost_status,
    pricing_bridge_status,
    selling_price_bridge_status,
    cost_sheet_status,
    cost_sheet_note,
    refreshed_at,
    valuation_date,
    refresh_run_id
   FROM costing.v_sku_detailed_cost_sheet_current
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_sku_scheme_comparison with (security_invoker=true) as
select q.* from (
SELECT period_start,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    scheme_id,
    scheme_name,
    paid_qty,
    free_qty,
    total_qty,
    ik_selling_price,
    ok_selling_price,
    ik_contingency_value,
    ok_contingency_value,
    marketing_expense_cost_per_sku,
    internal_loaded_cost_per_sku,
    ik_scheme_effective_selling_price,
    ok_scheme_effective_selling_price,
    ik_net_sales_realisation,
    ok_net_sales_realisation,
    ik_margin_amount_after_scheme,
    ok_margin_amount_after_scheme,
    ik_margin_percent_after_scheme,
    ok_margin_percent_after_scheme,
    ik_scheme_margin_band,
    ok_scheme_margin_band,
    scheme_viability_status,
    scheme_viability_note,
    refreshed_at,
    concat(product_name, ' - ', pack_size, ' ', pack_uom) AS sku_display_name,
    valuation_date,
    refresh_run_id,
    scheme_context_source,
    scheme_master_updated_at,
    scheme_is_system_defined,
    scheme_master_context_snapshot_id
   FROM costing.v_sku_scheme_comparison_current
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_pricing_sku_selector with (security_invoker=true) as
select q.* from (
SELECT period_start,
    product_id,
    product_name,
    sku_id,
    pack_size,
    pack_uom,
    sku_display_name,
    cost_sheet_status,
    cost_sheet_note,
    mrp_ik,
    mrp_ok,
    internal_loaded_cost_per_sku,
    pricing_cost_per_sku,
    ik_selling_price,
    ok_selling_price,
    refreshed_at
   FROM costing.v_costing_sku_selector
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_scheme_master_register with (security_invoker=true) as
select q.* from (
SELECT id AS scheme_id,
    scheme_name,
    paid_qty,
    free_qty,
    (paid_qty + free_qty) AS total_qty,
        CASE
            WHEN (paid_qty > (0)::numeric) THEN (free_qty / paid_qty)
            ELSE NULL::numeric
        END AS free_per_paid_ratio,
        CASE
            WHEN ((paid_qty + free_qty) > (0)::numeric) THEN ((free_qty / (paid_qty + free_qty)) * (100)::numeric)
            ELSE NULL::numeric
        END AS effective_free_discount_percent,
    is_active,
    is_system_defined,
    remarks,
    approval_reference,
    ( SELECT count(*) AS count
           FROM costing.sku_scheme_policy p
          WHERE (p.scheme_id = sm.id)) AS direct_policy_count,
    ( SELECT count(*) AS count
           FROM costing.sku_scheme_policy p
          WHERE ((p.scheme_id = sm.id) AND (p.is_active = true))) AS active_direct_policy_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE (r.scheme_id = sm.id)) AS hierarchy_rule_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE ((r.scheme_id = sm.id) AND (r.is_active = true))) AS active_hierarchy_rule_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE (r.replace_from_scheme_id = sm.id)) AS replacement_reference_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE ((r.replace_from_scheme_id = sm.id) AND (r.is_active = true))) AS active_replacement_reference_count,
    ( SELECT count(*) AS count
           FROM costing.sku_scheme_viability_snapshot s
          WHERE (s.scheme_id = sm.id)) AS viability_snapshot_count,
    ( SELECT count(DISTINCT s.period_start) AS count
           FROM costing.sku_scheme_viability_snapshot s
          WHERE (s.scheme_id = sm.id)) AS viability_snapshot_period_count,
    ( SELECT max(s.period_start) AS max
           FROM costing.sku_scheme_viability_snapshot s
          WHERE (s.scheme_id = sm.id)) AS latest_viability_snapshot_period,
    (NOT is_system_defined) AS can_edit_metadata,
    (is_active AND (NOT is_system_defined) AND (NOT (EXISTS ( SELECT 1
           FROM costing.sku_scheme_policy p
          WHERE ((p.scheme_id = sm.id) AND (p.is_active = true))))) AND (NOT (EXISTS ( SELECT 1
           FROM costing.scheme_policy_rules r
          WHERE ((r.scheme_id = sm.id) AND (r.is_active = true))))) AND (NOT (EXISTS ( SELECT 1
           FROM costing.scheme_policy_rules r
          WHERE ((r.replace_from_scheme_id = sm.id) AND (r.is_active = true)))))) AS can_deactivate,
    ((NOT is_active) AND (NOT is_system_defined)) AS can_reactivate,
    created_at,
    created_by,
    updated_at,
    updated_by,
    metadata_update_reason,
    deactivated_at,
    deactivated_by,
    deactivation_reason,
    reactivated_at,
    reactivated_by,
    reactivation_reason
   FROM costing.scheme_master sm
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_scheme_policy_rule_register with (security_invoker=true) as
select q.* from (
SELECT r.id AS policy_rule_id,
    r.policy_scope,
        CASE r.policy_scope
            WHEN 'CATEGORY'::text THEN (r.category_id)::bigint
            WHEN 'SUB_CATEGORY'::text THEN (r.sub_category_id)::bigint
            WHEN 'PRODUCT_GROUP'::text THEN (r.product_group_id)::bigint
            WHEN 'SUB_GROUP'::text THEN (r.sub_group_id)::bigint
            WHEN 'PRODUCT'::text THEN r.product_id
            WHEN 'SKU'::text THEN r.sku_id
            ELSE NULL::bigint
        END AS scope_id,
        CASE r.policy_scope
            WHEN 'CATEGORY'::text THEN c.category_name
            WHEN 'SUB_CATEGORY'::text THEN sc.subcategory_name
            WHEN 'PRODUCT_GROUP'::text THEN pg.group_name
            WHEN 'SUB_GROUP'::text THEN sg.sub_group_name
            WHEN 'PRODUCT'::text THEN p.item
            WHEN 'SKU'::text THEN concat_ws(' - '::text, psku.item, concat_ws(' '::text, TRIM(BOTH FROM to_char(ps.pack_size, 'FM999999999.########'::text)), ps.uom))
            ELSE NULL::text
        END AS scope_name,
    c.id AS category_id,
    c.category_name,
    sc.id AS sub_category_id,
    sc.subcategory_name,
    pg.id AS product_group_id,
    pg.group_name,
    sg.id AS sub_group_id,
    sg.sub_group_name,
    (p.id)::bigint AS product_id,
    p.item AS product_name,
    ps.id AS sku_id,
    ps.pack_size,
    ps.uom AS pack_uom,
    upper(r.region_code) AS region_code,
    r.scheme_id,
    sm.scheme_name,
    sm.paid_qty,
    sm.free_qty,
    r.apply_mode,
    r.replace_from_scheme_id,
    rsm.scheme_name AS replace_from_scheme_name,
    r.effective_from,
    r.effective_to,
    r.is_active,
        CASE
            WHEN ((r.is_active = true) AND (r.effective_from <= CURRENT_DATE) AND ((r.effective_to IS NULL) OR (r.effective_to >= CURRENT_DATE))) THEN 'ACTIVE'::text
            WHEN (r.is_active = false) THEN 'INACTIVE'::text
            WHEN (r.effective_from > CURRENT_DATE) THEN 'FUTURE'::text
            WHEN (r.effective_to < CURRENT_DATE) THEN 'EXPIRED'::text
            ELSE 'UNKNOWN'::text
        END AS rule_status,
    r.remarks,
    r.created_at,
    r.updated_at,
    r.created_by,
    r.updated_by
   FROM (((((((((((((((((((costing.scheme_policy_rules r
     JOIN costing.scheme_master sm ON ((sm.id = r.scheme_id)))
     LEFT JOIN costing.scheme_master rsm ON ((rsm.id = r.replace_from_scheme_id)))
     LEFT JOIN categories c ON ((c.id = r.category_id)))
     LEFT JOIN sub_categories sc ON ((sc.id = r.sub_category_id)))
     LEFT JOIN categories c_from_sc ON ((c_from_sc.id = sc.category_id)))
     LEFT JOIN product_groups pg ON ((pg.id = r.product_group_id)))
     LEFT JOIN sub_categories sc_from_pg ON ((sc_from_pg.id = pg.sub_category_id)))
     LEFT JOIN categories c_from_pg ON ((c_from_pg.id = sc_from_pg.category_id)))
     LEFT JOIN sub_groups sg ON ((sg.id = r.sub_group_id)))
     LEFT JOIN product_groups pg_from_sg ON ((pg_from_sg.id = sg.product_group_id)))
     LEFT JOIN sub_categories sc_from_sg ON ((sc_from_sg.id = pg_from_sg.sub_category_id)))
     LEFT JOIN categories c_from_sg ON ((c_from_sg.id = sc_from_sg.category_id)))
     LEFT JOIN products p ON (((p.id)::bigint = r.product_id)))
     LEFT JOIN sub_groups sg_from_p ON ((sg_from_p.id = p.sub_group_id)))
     LEFT JOIN product_groups pg_from_p ON ((pg_from_p.id = sg_from_p.product_group_id)))
     LEFT JOIN sub_categories sc_from_p ON ((sc_from_p.id = pg_from_p.sub_category_id)))
     LEFT JOIN categories c_from_p ON ((c_from_p.id = sc_from_p.category_id)))
     LEFT JOIN product_skus ps ON ((ps.id = r.sku_id)))
     LEFT JOIN products psku ON (((psku.id)::bigint = ps.product_id)))
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_scheme_policy_scope_options with (security_invoker=true) as
select q.* from (
SELECT 'CATEGORY'::text AS policy_scope,
    (c.id)::bigint AS scope_id,
    c.category_name AS scope_name,
    c.category_name AS display_name,
    (c.id)::bigint AS category_id,
    c.category_name,
    NULL::bigint AS sub_category_id,
    NULL::text AS subcategory_name,
    NULL::bigint AS product_group_id,
    NULL::text AS group_name,
    NULL::bigint AS sub_group_id,
    NULL::text AS sub_group_name,
    NULL::bigint AS product_id,
    NULL::text AS product_name,
    NULL::bigint AS sku_id,
    concat('CATEGORY:', c.id) AS scope_key
   FROM categories c
UNION ALL
 SELECT 'SUB_CATEGORY'::text AS policy_scope,
    (sc.id)::bigint AS scope_id,
    sc.subcategory_name AS scope_name,
    concat_ws(' > '::text, c.category_name, sc.subcategory_name) AS display_name,
    (c.id)::bigint AS category_id,
    c.category_name,
    (sc.id)::bigint AS sub_category_id,
    sc.subcategory_name,
    NULL::bigint AS product_group_id,
    NULL::text AS group_name,
    NULL::bigint AS sub_group_id,
    NULL::text AS sub_group_name,
    NULL::bigint AS product_id,
    NULL::text AS product_name,
    NULL::bigint AS sku_id,
    concat('SUB_CATEGORY:', sc.id) AS scope_key
   FROM (sub_categories sc
     LEFT JOIN categories c ON ((c.id = sc.category_id)))
UNION ALL
 SELECT 'PRODUCT_GROUP'::text AS policy_scope,
    (pg.id)::bigint AS scope_id,
    pg.group_name AS scope_name,
    concat_ws(' > '::text, c.category_name, sc.subcategory_name, pg.group_name) AS display_name,
    (c.id)::bigint AS category_id,
    c.category_name,
    (sc.id)::bigint AS sub_category_id,
    sc.subcategory_name,
    (pg.id)::bigint AS product_group_id,
    pg.group_name,
    NULL::bigint AS sub_group_id,
    NULL::text AS sub_group_name,
    NULL::bigint AS product_id,
    NULL::text AS product_name,
    NULL::bigint AS sku_id,
    concat('PRODUCT_GROUP:', pg.id) AS scope_key
   FROM ((product_groups pg
     LEFT JOIN sub_categories sc ON ((sc.id = pg.sub_category_id)))
     LEFT JOIN categories c ON ((c.id = sc.category_id)))
UNION ALL
 SELECT 'SUB_GROUP'::text AS policy_scope,
    (sg.id)::bigint AS scope_id,
    sg.sub_group_name AS scope_name,
    concat_ws(' > '::text, c.category_name, sc.subcategory_name, pg.group_name, sg.sub_group_name) AS display_name,
    (c.id)::bigint AS category_id,
    c.category_name,
    (sc.id)::bigint AS sub_category_id,
    sc.subcategory_name,
    (pg.id)::bigint AS product_group_id,
    pg.group_name,
    (sg.id)::bigint AS sub_group_id,
    sg.sub_group_name,
    NULL::bigint AS product_id,
    NULL::text AS product_name,
    NULL::bigint AS sku_id,
    concat('SUB_GROUP:', sg.id) AS scope_key
   FROM (((sub_groups sg
     LEFT JOIN product_groups pg ON ((pg.id = sg.product_group_id)))
     LEFT JOIN sub_categories sc ON ((sc.id = pg.sub_category_id)))
     LEFT JOIN categories c ON ((c.id = sc.category_id)))
UNION ALL
 SELECT 'PRODUCT'::text AS policy_scope,
    (p.id)::bigint AS scope_id,
    p.item AS scope_name,
    concat_ws(' > '::text, c.category_name, sc.subcategory_name, pg.group_name, sg.sub_group_name, p.item) AS display_name,
    (c.id)::bigint AS category_id,
    c.category_name,
    (sc.id)::bigint AS sub_category_id,
    sc.subcategory_name,
    (pg.id)::bigint AS product_group_id,
    pg.group_name,
    (sg.id)::bigint AS sub_group_id,
    sg.sub_group_name,
    (p.id)::bigint AS product_id,
    p.item AS product_name,
    NULL::bigint AS sku_id,
    concat('PRODUCT:', p.id) AS scope_key
   FROM ((((products p
     LEFT JOIN sub_groups sg ON ((sg.id = p.sub_group_id)))
     LEFT JOIN product_groups pg ON ((pg.id = sg.product_group_id)))
     LEFT JOIN sub_categories sc ON ((sc.id = pg.sub_category_id)))
     LEFT JOIN categories c ON ((c.id = sc.category_id)))
UNION ALL
 SELECT 'SKU'::text AS policy_scope,
    ps.id AS scope_id,
    concat_ws(' '::text, TRIM(BOTH FROM to_char(ps.pack_size, 'FM999999999.########'::text)), ps.uom) AS scope_name,
    concat_ws(' > '::text, c.category_name, sc.subcategory_name, pg.group_name, sg.sub_group_name, p.item, concat_ws(' '::text, TRIM(BOTH FROM to_char(ps.pack_size, 'FM999999999.########'::text)), ps.uom)) AS display_name,
    (c.id)::bigint AS category_id,
    c.category_name,
    (sc.id)::bigint AS sub_category_id,
    sc.subcategory_name,
    (pg.id)::bigint AS product_group_id,
    pg.group_name,
    (sg.id)::bigint AS sub_group_id,
    sg.sub_group_name,
    (p.id)::bigint AS product_id,
    p.item AS product_name,
    ps.id AS sku_id,
    concat('SKU:', ps.id) AS scope_key
   FROM (((((product_skus ps
     JOIN products p ON (((p.id)::bigint = ps.product_id)))
     LEFT JOIN sub_groups sg ON ((sg.id = p.sub_group_id)))
     LEFT JOIN product_groups pg ON ((pg.id = sg.product_group_id)))
     LEFT JOIN sub_categories sc ON ((sc.id = pg.sub_category_id)))
     LEFT JOIN categories c ON ((c.id = sc.category_id)))
  WHERE (COALESCE(ps.is_active, true) = true)
) q
where (select public.fn_costing_view_allowed());

create or replace view public.v_costing_staff_costing_class_options with (security_invoker=true) as
select q.* from (
SELECT costing_class,
    costing_class_label,
    default_allocation_pool,
    class_note,
    sort_order
   FROM ( VALUES ('DIRECT_LABOUR'::text,'Direct Labour'::text,'DIRECT_LABOUR'::text,'Direct production labour directly supporting manufacturing activity.'::text,10), ('PACKING_LABOUR'::text,'Packing Labour'::text,'DIRECT_LABOUR'::text,'Packing labour currently treated as direct labour for standard costing allocation.'::text,20), ('PRODUCTION_SUPERVISION'::text,'Production Supervision'::text,'PRODUCTION_OVERHEAD'::text,'Production supervisory staff allocated to production overhead.'::text,30), ('QUALITY_CONTROL'::text,'Quality Control'::text,'QUALITY_CONTROL_OVERHEAD'::text,'Quality control and laboratory staff allocated to QC overhead.'::text,40), ('MATERIALS_STORES'::text,'Materials / Stores'::text,'MATERIALS_STORES_OVERHEAD'::text,'Warehouse, stores, inward, materials handling and store support staff.'::text,50), ('GENERAL_ADMIN'::text,'General Admin'::text,'ADMIN_OVERHEAD'::text,'General administrative staff allocated to admin overhead.'::text,60), ('FINANCE_ADMIN'::text,'Finance / Admin'::text,'FINANCE_ADMIN_OVERHEAD'::text,'Accounts, finance and finance-admin support staff.'::text,70), ('EXCLUDED'::text,'Excluded from Costing'::text,'EXCLUDED'::text,'Staff excluded from product costing. Use only where cost is not to be absorbed into product costing.'::text,90)) x(costing_class, costing_class_label, default_allocation_pool, class_note, sort_order)
) q
where (select public.fn_costing_view_allowed());

do $c$
declare v text;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='v' and (c.relname like 'v_costing%' or c.relname like 'v_cost_sheet%') loop
    execute format('revoke all on public.%I from anon', v);
    execute format('revoke insert, update, delete, truncate, references, trigger, maintain on public.%I from authenticated', v);
  end loop;
end $c$;

do $p$
declare n int;
begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
   where s.nspname='public' and c.relkind='v' and (c.relname like 'v_costing%' or c.relname like 'v_cost_sheet%')
     and pg_get_viewdef(c.oid) !~ '(fn_costing_view_allowed|app_has_permission|require_permission)';
  if n <> 0 then raise exception 'TB2_POST: % costing views still ungated', n; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
   where s.nspname='public' and c.relkind='v' and (c.relname like 'v_costing%' or c.relname like 'v_cost_sheet%')
     and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'));
  if n <> 0 then raise exception 'TB2_POST: % views keep anon or write privileges', n; end if;
end $p$;
