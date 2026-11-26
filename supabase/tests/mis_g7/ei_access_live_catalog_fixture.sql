-- Isolated test fixture only. Exact live reporting bodies; upstream relations are typed empty shims, not production copies.
CREATE SCHEMA app_private;
CREATE MATERIALIZED VIEW app_private.mv_mis_executive_summary AS SELECT NULL::integer AS mis_summary_id, NULL::date AS report_generated_date, NULL::date AS financial_position_date, NULL::numeric AS payables_sundry_creditors, NULL::numeric AS receivables_sundry_debtors, NULL::numeric AS net_sundry_position, NULL::date AS expense_position_date, NULL::date AS financial_year_start, NULL::numeric AS direct_expenses_fy_position, NULL::numeric AS indirect_expenses_fy_position, NULL::numeric AS total_expenses_fy_position, NULL::date AS sales_position_date, NULL::date AS sales_month_start, NULL::date AS sales_month_end, NULL::numeric AS sales_value_latest_day, NULL::numeric AS sales_value_month_to_date, NULL::numeric AS sales_units_latest_day, NULL::numeric AS sales_units_month_to_date, NULL::numeric AS raw_material_inventory_value, NULL::numeric AS packing_material_inventory_value, NULL::numeric AS consumables_inventory_value, NULL::numeric AS fuel_inventory_value, NULL::numeric AS manufacturing_inventory_value, NULL::numeric AS fg_inventory_value_overall, NULL::numeric AS fg_stock_units_overall, NULL::bigint AS fg_items_below_1_month_cover, NULL::bigint AS fg_items_above_6_month_cover, NULL::bigint AS active_pipeline_batch_count, NULL::bigint AS not_initiated_batch_count, NULL::bigint AS work_in_process_batch_count, NULL::bigint AS finished_goods_bulk_batch_count, NULL::bigint AS bottled_stock_batch_count, NULL::bigint AS overdue_work_in_process_batch_count, NULL::date AS production_report_month_start, NULL::date AS production_report_month_end, NULL::date AS planning_month_start, NULL::text AS planning_period_status, NULL::numeric AS planned_production_base_qty, NULL::numeric AS bulk_produced_base_qty, NULL::numeric AS transferred_to_finished_goods_base_qty, NULL::numeric AS transferred_to_finished_goods_value, NULL::numeric AS bulk_production_achievement_pct, NULL::numeric AS fg_transfer_achievement_pct, NULL::timestamp with time zone AS mv_refreshed_at, NULL::text AS executive_summary_note;
CREATE TABLE public.products (id integer, item text, sub_group_id integer, malayalam_name text, status text, uom_base text, conversion_to_base numeric, is_seasonal boolean, is_llt boolean, manufacture_lead_time_months integer, season_profile_id integer, is_pto boolean);
CREATE TABLE public.tally_expenses_snapshot (id bigint, as_of_date date, expense_group text, head_name text, debit_amount_value numeric, credit_amount_value numeric, net_cb_value numeric, source_key text, inserted_at timestamp with time zone, period_from date, period_to date, window_basis text, export_batch_id bigint);
CREATE TABLE public.tally_group_outstanding_snapshot (id bigint, as_of_date date, group_name text, bill_date_text text, bill_ref text, vendor_name text, opening_amount_value numeric, outstanding_amount_value numeric, source_key text, inserted_at timestamp with time zone);
CREATE TABLE public.v_batch_canonical_in_process_keyed (product_id bigint, product_name text, batch_number text, bmr_id bigint, primary_state text, state_sources text[], batch_uom text, batch_size_declared numeric, process_loss_pct numeric, base_uom_code text, expected_output_base_qty numeric, fg_bulk_on_hand_base_qty numeric, bottled_on_hand_units numeric, transferred_out_base_qty numeric, transferred_out_amount numeric, in_system_base_qty_est numeric, not_initiated_created_at timestamp with time zone, wip_started_on date, wip_due_date date, last_fg_bulk_updated timestamp with time zone, last_transfer_date date, bottled_on_hand_base_qty numeric);
CREATE TABLE public.v_fg_transfer_reconciliation (transfer_date date, product_id bigint, product_name text, batch_code text, tally_breakdown_by_skuid jsonb, tally_breakdown_lines jsonb, tally_breakdown_by_store jsonb, tally_breakdown_by_godown jsonb, tally_total_packs numeric, tally_total_in_base numeric, tally_uom_base_unit text, all_godown_mapped boolean, all_sku_mapped boolean, log_breakdown_by_skuid jsonb, log_breakdown_lines jsonb, log_total_packs numeric, any_dwl_id integer, dwl_row_count bigint, is_product_mapped boolean, all_lines_sku_mapped boolean, log_status text, log_completed_on date, log_uploaded_by text, log_created_at timestamp without time zone, exists_in_tally boolean, exists_in_log boolean, is_exact_breakdown_match boolean, recon_status text, tally_total_amount_raw numeric, tally_amount_per_pack_raw numeric, tally_amount_per_base_raw numeric, tally_total_amount numeric, tally_breakdown_by_store_amount jsonb, tally_breakdown_by_godown_amount jsonb, raw_item_hint text, raw_item_names text[], book_transfer_value_raw numeric, book_transfer_value numeric, mrp_notional_value_raw numeric, mrp_notional_value numeric, mrp_ik_notional_value_raw numeric, mrp_ik_notional_value numeric, mrp_ok_notional_value_raw numeric, mrp_ok_notional_value numeric, valuation_line_count bigint, valuation_ok_line_count bigint, valuation_warning_line_count bigint, price_missing_line_count bigint, sku_unmapped_line_count bigint, pack_count_missing_line_count bigint, price_region_unresolved_line_count bigint, valuation_status text, valuation_breakdown_lines jsonb);
CREATE TABLE public.v_product_bulk_consolidated_effective (product_id bigint, month_start date, need_qty numeric, preferred_batch_size numeric, min_batch_size numeric, max_batch_size numeric, need_after_carry numeric, planned_make_qty numeric, override_delta numeric, final_make_qty numeric, carry_to_next numeric, needs_base_qty boolean, source_rule text);
CREATE TABLE public.v_sales_daily_normalized (sales_date date, sku_id integer, product_id bigint, godown_id integer, region_id integer, qty_units numeric, qty_billed numeric, billed_amount numeric, source_key text, inserted_at timestamp with time zone);
CREATE TABLE public.v_stock_checker (category_id integer, category_name text, sub_category_id integer, sub_category_name text, product_group_id integer, product_group_name text, sub_group_id integer, sub_group_name text, product_id integer, item text, sku_id bigint, pack_size numeric, uom text, stock_ik numeric, stock_kkd numeric, stock_ok numeric, forecast_ik numeric, forecast_kkd numeric, forecast_ok numeric, mos_ik numeric, mos_kkd numeric, mos_ok numeric, mos_overall numeric, mrp_ik numeric(12,2), mrp_ok numeric(12,2), shade_flag boolean, stock_value_ik numeric, stock_value_kkd numeric, stock_value_ok numeric, stock_value_overall numeric, rate_ik numeric, rate_kkd numeric, rate_ok numeric, rate_overall numeric);
CREATE TABLE public.v_stock_current_by_item (source_kind text, inv_stock_item_id bigint, code text, name text, qty_value numeric, avg_rate_value numeric, category_id bigint, category_code text, category_label text, subcategory_id bigint, subcategory_code text, subcategory_label text, group_id bigint, group_code text, group_label text, subgroup_id bigint, subgroup_code text, subgroup_label text);
CREATE VIEW public.v_mis_finance_outstanding_detail WITH (security_invoker=true) AS  WITH latest_snapshot AS (
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
   FROM base;
CREATE VIEW public.v_mis_finance_outstanding_party_summary WITH (security_invoker=true) AS  SELECT report_date,
    group_name,
    mis_group_name,
    party_name,
    count(*) AS bill_count,
    sum(outstanding_amount_tally_value) AS signed_outstanding_tally_value,
    abs(sum(outstanding_amount_tally_value)) AS outstanding_amount_mis_value,
    sum(outstanding_amount_abs_line_value) AS absolute_bill_line_total,
    min(bill_date_text) AS earliest_bill_date_text,
    max(bill_date_text) AS latest_bill_date_text
   FROM v_mis_finance_outstanding_detail
  GROUP BY report_date, group_name, mis_group_name, party_name;
CREATE VIEW public.v_mis_finance_tab_summary WITH (security_invoker=true) AS  WITH grouped AS (
         SELECT v_mis_finance_outstanding_party_summary.report_date,
            v_mis_finance_outstanding_party_summary.mis_group_name,
            sum(v_mis_finance_outstanding_party_summary.signed_outstanding_tally_value) AS signed_total,
            count(*) AS party_count,
            sum(v_mis_finance_outstanding_party_summary.bill_count) AS bill_count
           FROM v_mis_finance_outstanding_party_summary
          GROUP BY v_mis_finance_outstanding_party_summary.report_date, v_mis_finance_outstanding_party_summary.mis_group_name
        )
 SELECT report_date,
    abs(COALESCE(sum(signed_total) FILTER (WHERE mis_group_name = 'Payables — Sundry Creditors'::text), 0::numeric)) AS payables_sundry_creditors,
    abs(COALESCE(sum(signed_total) FILTER (WHERE mis_group_name = 'Receivables — Sundry Debtors'::text), 0::numeric)) AS receivables_sundry_debtors,
    abs(COALESCE(sum(signed_total) FILTER (WHERE mis_group_name = 'Receivables — Sundry Debtors'::text), 0::numeric)) - abs(COALESCE(sum(signed_total) FILTER (WHERE mis_group_name = 'Payables — Sundry Creditors'::text), 0::numeric)) AS net_sundry_position,
    COALESCE(sum(party_count) FILTER (WHERE mis_group_name = 'Payables — Sundry Creditors'::text), 0::numeric) AS payable_party_count,
    COALESCE(sum(party_count) FILTER (WHERE mis_group_name = 'Receivables — Sundry Debtors'::text), 0::numeric) AS receivable_party_count,
    COALESCE(sum(bill_count) FILTER (WHERE mis_group_name = 'Payables — Sundry Creditors'::text), 0::numeric) AS payable_bill_count,
    COALESCE(sum(bill_count) FILTER (WHERE mis_group_name = 'Receivables — Sundry Debtors'::text), 0::numeric) AS receivable_bill_count,
    'Finance tab summary covers only Sundry Creditors and Sundry Debtors, not all liabilities or assets of the manufacturing unit. Values are calculated from signed Tally balances and presented as MIS-positive figures.'::text AS finance_scope_note
   FROM grouped
  GROUP BY report_date;
CREATE VIEW public.v_mis_financial_position WITH (security_invoker=true) AS  WITH latest_snapshot AS (
         SELECT max(tally_group_outstanding_snapshot.as_of_date) AS report_date
           FROM tally_group_outstanding_snapshot
        ), base AS (
         SELECT t.as_of_date,
            t.group_name,
            COALESCE(t.outstanding_amount_value, 0::numeric) AS outstanding_amount_value
           FROM tally_group_outstanding_snapshot t
             JOIN latest_snapshot l ON l.report_date = t.as_of_date
          WHERE t.group_name = ANY (ARRAY['Sundry Creditors'::text, 'Sundry Debtors'::text])
        ), summary AS (
         SELECT base.as_of_date AS report_date,
            abs(sum(base.outstanding_amount_value) FILTER (WHERE base.group_name = 'Sundry Creditors'::text)) AS payables_sundry_creditors,
            abs(sum(base.outstanding_amount_value) FILTER (WHERE base.group_name = 'Sundry Debtors'::text)) AS receivables_sundry_debtors
           FROM base
          GROUP BY base.as_of_date
        )
 SELECT report_date,
    COALESCE(payables_sundry_creditors, 0::numeric) AS payables_sundry_creditors,
    COALESCE(receivables_sundry_debtors, 0::numeric) AS receivables_sundry_debtors,
    COALESCE(receivables_sundry_debtors, 0::numeric) - COALESCE(payables_sundry_creditors, 0::numeric) AS net_sundry_position,
    'Payables — Sundry Creditors = Absolute value of total outstanding_amount_value where group_name is Sundry Creditors for the latest available snapshot date.'::text AS payables_sundry_creditors_note,
    'Receivables — Sundry Debtors = Absolute value of total outstanding_amount_value where group_name is Sundry Debtors for the latest available snapshot date.'::text AS receivables_sundry_debtors_note,
    'Net Sundry Position = Receivables — Sundry Debtors minus Payables — Sundry Creditors. Positive means receivables exceed payables; negative means payables exceed receivables.'::text AS net_sundry_position_note
   FROM summary;
CREATE VIEW public.v_mis_expense_position WITH (security_invoker=true) AS  WITH latest_snapshot AS (
         SELECT max(tally_expenses_snapshot.as_of_date) AS report_date
           FROM tally_expenses_snapshot
        ), fy AS (
         SELECT latest_snapshot.report_date,
                CASE
                    WHEN EXTRACT(month FROM latest_snapshot.report_date) >= 4::numeric THEN make_date(EXTRACT(year FROM latest_snapshot.report_date)::integer, 4, 1)
                    ELSE make_date(EXTRACT(year FROM latest_snapshot.report_date)::integer - 1, 4, 1)
                END AS financial_year_start
           FROM latest_snapshot
        ), base AS (
         SELECT t.as_of_date,
            t.expense_group,
            t.head_name,
            COALESCE(t.net_cb_value, 0::numeric) AS net_cb_value
           FROM tally_expenses_snapshot t
             JOIN latest_snapshot l ON l.report_date = t.as_of_date
          WHERE t.expense_group = ANY (ARRAY['Direct Expenses'::text, 'Indirect Expenses'::text])
        ), summary AS (
         SELECT l.report_date,
            f.financial_year_start,
            sum(b.net_cb_value) FILTER (WHERE b.expense_group = 'Direct Expenses'::text) AS direct_expenses_fy_position,
            sum(b.net_cb_value) FILTER (WHERE b.expense_group = 'Indirect Expenses'::text) AS indirect_expenses_fy_position,
            sum(b.net_cb_value) AS total_expenses_fy_position
           FROM latest_snapshot l
             JOIN fy f ON f.report_date = l.report_date
             LEFT JOIN base b ON b.as_of_date = l.report_date
          GROUP BY l.report_date, f.financial_year_start
        )
 SELECT report_date,
    financial_year_start,
    COALESCE(direct_expenses_fy_position, 0::numeric) AS direct_expenses_fy_position,
    COALESCE(indirect_expenses_fy_position, 0::numeric) AS indirect_expenses_fy_position,
    COALESCE(total_expenses_fy_position, 0::numeric) AS total_expenses_fy_position,
    'Financial Year Expense Position = Expense ledger closing balance as available in Tally expense snapshot for the latest available date in the current financial year.'::text AS total_expenses_fy_position_note,
    'Direct Expenses = Sum of net_cb_value where expense_group is Direct Expenses for the latest available Tally expense snapshot.'::text AS direct_expenses_fy_position_note,
    'Indirect Expenses = Sum of net_cb_value where expense_group is Indirect Expenses for the latest available Tally expense snapshot.'::text AS indirect_expenses_fy_position_note
   FROM summary;
CREATE VIEW public.v_mis_fg_inventory_position WITH (security_invoker=true) AS  WITH base AS (
         SELECT COALESCE(v_stock_checker.stock_ik, 0::numeric) AS stock_ik,
            COALESCE(v_stock_checker.stock_kkd, 0::numeric) AS stock_kkd,
            COALESCE(v_stock_checker.stock_ok, 0::numeric) AS stock_ok,
            COALESCE(v_stock_checker.stock_value_ik, 0::numeric) AS stock_value_ik,
            COALESCE(v_stock_checker.stock_value_kkd, 0::numeric) AS stock_value_kkd,
            COALESCE(v_stock_checker.stock_value_ok, 0::numeric) AS stock_value_ok,
            COALESCE(v_stock_checker.stock_value_overall, 0::numeric) AS stock_value_overall,
            v_stock_checker.mos_overall
           FROM v_stock_checker
        ), summary AS (
         SELECT sum(base.stock_ik) AS fg_stock_units_ik,
            sum(base.stock_kkd) AS fg_stock_units_kkd,
            sum(base.stock_ok) AS fg_stock_units_ok,
            sum(base.stock_ik + base.stock_kkd + base.stock_ok) AS fg_stock_units_overall,
            sum(base.stock_value_ik) AS fg_inventory_value_ik,
            sum(base.stock_value_kkd) AS fg_inventory_value_kkd,
            sum(base.stock_value_ok) AS fg_inventory_value_ok,
            sum(base.stock_value_overall) AS fg_inventory_value_overall,
            count(*) FILTER (WHERE base.mos_overall IS NOT NULL AND base.mos_overall < 1::numeric) AS fg_items_below_1_month_cover,
            count(*) FILTER (WHERE base.mos_overall IS NOT NULL AND base.mos_overall >= 1::numeric AND base.mos_overall <= 3::numeric) AS fg_items_1_to_3_month_cover,
            count(*) FILTER (WHERE base.mos_overall IS NOT NULL AND base.mos_overall > 6::numeric) AS fg_items_above_6_month_cover,
            count(*) AS fg_sku_count
           FROM base
        )
 SELECT round(COALESCE(fg_stock_units_ik, 0::numeric), 2) AS fg_stock_units_ik,
    round(COALESCE(fg_stock_units_kkd, 0::numeric), 2) AS fg_stock_units_kkd,
    round(COALESCE(fg_stock_units_ok, 0::numeric), 2) AS fg_stock_units_ok,
    round(COALESCE(fg_stock_units_overall, 0::numeric), 2) AS fg_stock_units_overall,
    round(COALESCE(fg_inventory_value_ik, 0::numeric), 2) AS fg_inventory_value_ik,
    round(COALESCE(fg_inventory_value_kkd, 0::numeric), 2) AS fg_inventory_value_kkd,
    round(COALESCE(fg_inventory_value_ok, 0::numeric), 2) AS fg_inventory_value_ok,
    round(COALESCE(fg_inventory_value_overall, 0::numeric), 2) AS fg_inventory_value_overall,
    COALESCE(fg_items_below_1_month_cover, 0::bigint) AS fg_items_below_1_month_cover,
    COALESCE(fg_items_1_to_3_month_cover, 0::bigint) AS fg_items_1_to_3_month_cover,
    COALESCE(fg_items_above_6_month_cover, 0::bigint) AS fg_items_above_6_month_cover,
    COALESCE(fg_sku_count, 0::bigint) AS fg_sku_count,
    'Finished Goods Inventory Value = Sum of stock_value_overall from v_stock_checker.'::text AS fg_inventory_value_overall_note,
    'Finished Goods Months of Stock Cover = Current finished goods stock divided by monthly forecasted sales. Items below 1 month cover may require production attention.'::text AS fg_months_of_stock_cover_note,
    'Finished Goods units include available stock from Inside Kerala, Kozhikode Depot, and Outside Kerala godowns as available in v_stock_checker.'::text AS fg_stock_units_note
   FROM summary;
CREATE VIEW public.v_mis_finished_goods_tab_summary WITH (security_invoker=true) AS  SELECT CURRENT_DATE AS report_date,
    count(*) AS sku_count,
    sum(stock_ik) AS stock_units_ik,
    sum(stock_kkd) AS stock_units_kkd,
    sum(stock_ok) AS stock_units_ok,
    sum(COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric) + COALESCE(stock_ok, 0::numeric)) AS stock_units_overall,
    sum(stock_value_ik) AS stock_value_ik,
    sum(stock_value_kkd) AS stock_value_kkd,
    sum(stock_value_ok) AS stock_value_ok,
    sum(stock_value_overall) AS stock_value_overall,
    count(*) FILTER (WHERE (COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric) + COALESCE(stock_ok, 0::numeric)) = 0::numeric) AS zero_stock_sku_count,
    count(*) FILTER (WHERE (COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric) + COALESCE(stock_ok, 0::numeric)) > 0::numeric AND mos_overall < 1::numeric) AS below_1_month_cover_count,
    count(*) FILTER (WHERE (COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric)) > 0::numeric AND mos_overall >= 1::numeric AND mos_overall <= 3::numeric) AS one_to_three_month_cover_count,
    count(*) FILTER (WHERE (COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric) + COALESCE(stock_ok, 0::numeric)) > 0::numeric AND mos_overall > 6::numeric) AS above_6_month_cover_count,
    count(*) FILTER (WHERE shade_flag IS TRUE) AS same_ik_ok_mrp_sku_count,
    'Finished Goods tab covers SKU-level stock, value, forecast, and Months of Stock cover. Filter logic: Zero Stock = no stock in any FG location; Below 1 Month = non-zero stock with MOS below 1; 1 to 3 Months = MOS from 1 to 3; Above 6 Months = MOS above 6; Normal = non-zero stock outside these alert buckets; Same IK/OK MRP = SKUs where Inside Kerala and Outside Kerala MRP are equal. Manufacturing inventory is handled separately.'::text AS finished_goods_scope_note
   FROM v_stock_checker;
CREATE VIEW public.v_mis_inventory_position WITH (security_invoker=true) AS  WITH base AS (
         SELECT v_stock_current_by_item.source_kind,
            v_stock_current_by_item.category_label,
            COALESCE(v_stock_current_by_item.qty_value, 0::numeric) AS qty_value,
            COALESCE(v_stock_current_by_item.avg_rate_value, 0::numeric) AS avg_rate_value,
            COALESCE(v_stock_current_by_item.qty_value, 0::numeric) * COALESCE(v_stock_current_by_item.avg_rate_value, 0::numeric) AS stock_value
           FROM v_stock_current_by_item
        ), summary AS (
         SELECT sum(base.stock_value) FILTER (WHERE base.source_kind = 'rm'::text) AS raw_material_inventory_value,
            sum(base.stock_value) FILTER (WHERE base.source_kind = 'plm'::text) AS packing_material_inventory_value,
            sum(base.stock_value) FILTER (WHERE base.source_kind = 'consumable'::text) AS consumables_inventory_value,
            sum(base.stock_value) FILTER (WHERE base.source_kind = 'fuel'::text) AS fuel_inventory_value,
            sum(base.stock_value) AS manufacturing_inventory_value,
            count(*) FILTER (WHERE base.source_kind = 'rm'::text) AS raw_material_item_count,
            count(*) FILTER (WHERE base.source_kind = 'plm'::text) AS packing_material_item_count,
            count(*) FILTER (WHERE base.source_kind = 'consumable'::text) AS consumables_item_count,
            count(*) FILTER (WHERE base.source_kind = 'fuel'::text) AS fuel_item_count,
            count(*) AS manufacturing_inventory_item_count
           FROM base
        )
 SELECT COALESCE(raw_material_inventory_value, 0::numeric) AS raw_material_inventory_value,
    COALESCE(packing_material_inventory_value, 0::numeric) AS packing_material_inventory_value,
    COALESCE(consumables_inventory_value, 0::numeric) AS consumables_inventory_value,
    COALESCE(fuel_inventory_value, 0::numeric) AS fuel_inventory_value,
    COALESCE(manufacturing_inventory_value, 0::numeric) AS manufacturing_inventory_value,
    COALESCE(raw_material_item_count, 0::bigint) AS raw_material_item_count,
    COALESCE(packing_material_item_count, 0::bigint) AS packing_material_item_count,
    COALESCE(consumables_item_count, 0::bigint) AS consumables_item_count,
    COALESCE(fuel_item_count, 0::bigint) AS fuel_item_count,
    COALESCE(manufacturing_inventory_item_count, 0::bigint) AS manufacturing_inventory_item_count,
    'Manufacturing Inventory Value = Sum of Quantity × Average Rate from v_stock_current_by_item for raw material, packing material, consumables, and fuel.'::text AS manufacturing_inventory_value_note,
    'Raw Material Inventory Value = Sum of Quantity × Average Rate where source_kind is rm.'::text AS raw_material_inventory_value_note,
    'Packing Material Inventory Value = Sum of Quantity × Average Rate where source_kind is plm.'::text AS packing_material_inventory_value_note,
    'Consumables Inventory Value = Sum of Quantity × Average Rate where source_kind is consumable.'::text AS consumables_inventory_value_note,
    'Fuel Inventory Value = Sum of Quantity × Average Rate where source_kind is fuel.'::text AS fuel_inventory_value_note
   FROM summary;
CREATE VIEW public.v_mis_inventory_tab_summary WITH (security_invoker=true) AS  SELECT CURRENT_DATE AS report_date,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'rm'::text) AS raw_material_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'plm'::text) AS packing_material_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'consumable'::text) AS consumables_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'fuel'::text) AS fuel_inventory_value,
    sum(qty_value * avg_rate_value) AS manufacturing_inventory_value,
    count(*) FILTER (WHERE source_kind = 'rm'::text) AS raw_material_item_count,
    count(*) FILTER (WHERE source_kind = 'plm'::text) AS packing_material_item_count,
    count(*) FILTER (WHERE source_kind = 'consumable'::text) AS consumables_item_count,
    count(*) FILTER (WHERE source_kind = 'fuel'::text) AS fuel_item_count,
    count(*) AS total_inventory_item_count,
    'Inventory tab covers manufacturing inventory only: Raw Material, Packing Material, Consumables, and Fuel. Finished Goods inventory is handled separately in the Finished Goods tab.'::text AS inventory_scope_note,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) FILTER (WHERE category_code = 'RM'::text) AS canonical_rm_known_value,
    count(*) FILTER (WHERE category_code = 'RM'::text) AS canonical_rm_item_count,
    count(*) FILTER (WHERE category_code = 'RM'::text AND (qty_value IS NULL OR qty_value <> 0::numeric AND (avg_rate_value IS NULL OR avg_rate_value <= 0::numeric))) AS canonical_rm_valuation_gap_count,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) FILTER (WHERE category_code = 'PM'::text) AS canonical_pm_known_value,
    count(*) FILTER (WHERE category_code = 'PM'::text) AS canonical_pm_item_count,
    count(*) FILTER (WHERE category_code = 'PM'::text AND (qty_value IS NULL OR qty_value <> 0::numeric AND (avg_rate_value IS NULL OR avg_rate_value <= 0::numeric))) AS canonical_pm_valuation_gap_count,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) FILTER (WHERE category_code = 'IND'::text) AS canonical_ind_known_value,
    count(*) FILTER (WHERE category_code = 'IND'::text) AS canonical_ind_item_count,
    count(*) FILTER (WHERE category_code = 'IND'::text AND (qty_value IS NULL OR qty_value <> 0::numeric AND (avg_rate_value IS NULL OR avg_rate_value <= 0::numeric))) AS canonical_ind_valuation_gap_count,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) AS inventory_known_value,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) FILTER (WHERE category_code IS NULL OR (category_code <> ALL (ARRAY['RM'::text, 'PM'::text, 'IND'::text]))) AS unclassified_known_value,
    count(*) FILTER (WHERE category_code IS NULL OR (category_code <> ALL (ARRAY['RM'::text, 'PM'::text, 'IND'::text]))) AS unclassified_item_count,
    count(*) FILTER (WHERE qty_value IS NULL OR qty_value <> 0::numeric AND (avg_rate_value IS NULL OR avg_rate_value <= 0::numeric)) AS valuation_gap_item_count,
    count(*) FILTER (WHERE qty_value = 0::numeric) AS zero_quantity_item_count,
    count(inv_stock_item_id) - count(DISTINCT inv_stock_item_id) AS duplicate_item_row_count,
    count(*) FILTER (WHERE inv_stock_item_id IS NULL) AS missing_item_id_count,
    'Manufacturing inventory: RM Raw Material, PM Packing Material, IND Indirect Materials & Utilities; known values exclude valuation gaps; Finished Goods reported separately.'::text AS canonical_inventory_scope_note
   FROM v_stock_current_by_item;
CREATE VIEW public.v_mis_batch_pipeline WITH (security_invoker=true) AS  WITH base AS (
         SELECT v_batch_canonical_in_process_keyed.product_id,
            v_batch_canonical_in_process_keyed.product_name,
            v_batch_canonical_in_process_keyed.batch_number,
            v_batch_canonical_in_process_keyed.primary_state,
            COALESCE(v_batch_canonical_in_process_keyed.expected_output_base_qty, 0::numeric) AS expected_output_base_qty,
            COALESCE(v_batch_canonical_in_process_keyed.fg_bulk_on_hand_base_qty, 0::numeric) AS fg_bulk_on_hand_base_qty,
            COALESCE(v_batch_canonical_in_process_keyed.bottled_on_hand_base_qty, 0::numeric) AS bottled_on_hand_base_qty,
            COALESCE(v_batch_canonical_in_process_keyed.transferred_out_base_qty, 0::numeric) AS transferred_out_base_qty,
            COALESCE(v_batch_canonical_in_process_keyed.transferred_out_amount, 0::numeric) AS transferred_out_amount,
            v_batch_canonical_in_process_keyed.wip_started_on,
            v_batch_canonical_in_process_keyed.wip_due_date
           FROM v_batch_canonical_in_process_keyed
        ), summary AS (
         SELECT count(*) FILTER (WHERE base.primary_state = 'NOT_INITIATED'::text) AS not_initiated_batch_count,
            count(*) FILTER (WHERE base.primary_state = 'WIP'::text) AS work_in_process_batch_count,
            count(*) FILTER (WHERE base.primary_state = 'FG_BULK'::text) AS finished_goods_bulk_batch_count,
            count(*) FILTER (WHERE base.primary_state = 'BOTTLED'::text) AS bottled_stock_batch_count,
            count(*) FILTER (WHERE base.primary_state = 'TRANSFERRED_ONLY'::text) AS transferred_only_batch_count,
            count(*) FILTER (WHERE base.primary_state = ANY (ARRAY['NOT_INITIATED'::text, 'WIP'::text, 'FG_BULK'::text, 'BOTTLED'::text])) AS active_pipeline_batch_count,
            count(*) AS total_canonical_batch_count,
            round(sum(base.expected_output_base_qty) FILTER (WHERE base.primary_state = 'NOT_INITIATED'::text), 2) AS not_initiated_expected_output_base_qty,
            round(sum(base.expected_output_base_qty) FILTER (WHERE base.primary_state = 'WIP'::text), 2) AS work_in_process_expected_output_base_qty,
            round(sum(base.fg_bulk_on_hand_base_qty) FILTER (WHERE base.primary_state = 'FG_BULK'::text), 2) AS finished_goods_bulk_on_hand_base_qty,
            round(sum(base.bottled_on_hand_base_qty) FILTER (WHERE base.primary_state = 'BOTTLED'::text), 2) AS bottled_stock_on_hand_base_qty,
            round(sum(base.transferred_out_base_qty) FILTER (WHERE base.primary_state = 'TRANSFERRED_ONLY'::text), 2) AS transferred_only_base_qty,
            count(*) FILTER (WHERE base.primary_state = 'WIP'::text AND base.wip_due_date IS NOT NULL AND base.wip_due_date < CURRENT_DATE) AS overdue_work_in_process_batch_count
           FROM base
        )
 SELECT COALESCE(not_initiated_batch_count, 0::bigint) AS not_initiated_batch_count,
    COALESCE(work_in_process_batch_count, 0::bigint) AS work_in_process_batch_count,
    COALESCE(finished_goods_bulk_batch_count, 0::bigint) AS finished_goods_bulk_batch_count,
    COALESCE(bottled_stock_batch_count, 0::bigint) AS bottled_stock_batch_count,
    COALESCE(transferred_only_batch_count, 0::bigint) AS transferred_only_batch_count,
    COALESCE(active_pipeline_batch_count, 0::bigint) AS active_pipeline_batch_count,
    COALESCE(total_canonical_batch_count, 0::bigint) AS total_canonical_batch_count,
    COALESCE(not_initiated_expected_output_base_qty, 0::numeric) AS not_initiated_expected_output_base_qty,
    COALESCE(work_in_process_expected_output_base_qty, 0::numeric) AS work_in_process_expected_output_base_qty,
    COALESCE(finished_goods_bulk_on_hand_base_qty, 0::numeric) AS finished_goods_bulk_on_hand_base_qty,
    COALESCE(bottled_stock_on_hand_base_qty, 0::numeric) AS bottled_stock_on_hand_base_qty,
    COALESCE(transferred_only_base_qty, 0::numeric) AS transferred_only_base_qty,
    COALESCE(overdue_work_in_process_batch_count, 0::bigint) AS overdue_work_in_process_batch_count,
    'Active Pipeline Batches = Count of batches currently in Not Initiated, Work in Process, Finished Goods Bulk, or Bottled Stock stages. Transferred-only batches are excluded from active pipeline.'::text AS active_pipeline_batch_count_note,
    'Total Canonical Batch Count = All batches visible in v_batch_canonical_in_process_keyed, including transferred-only historical batches.'::text AS total_canonical_batch_count_note,
    'Not Initiated = Batch/BMR created or planned but production issue/process has not started.'::text AS not_initiated_note,
    'Work in Process = Batch where raw material issue or production process has started but bulk output is not yet completed.'::text AS work_in_process_note,
    'Finished Goods Bulk = Production completed in bulk form but not fully packed/transferred as saleable finished goods.'::text AS finished_goods_bulk_note,
    'Bottled Stock = Packed or partially packed goods available before final finished goods transfer.'::text AS bottled_stock_note,
    'Transferred Only = Batches identified from finished goods transfer records, generally already transferred to saleable finished goods stock and not part of active pipeline.'::text AS transferred_only_note
   FROM summary;
CREATE VIEW public.v_mis_production_position AS  WITH report_period AS (
         SELECT CURRENT_DATE AS report_date,
            date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date AS report_month_start,
            (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon -1 days'::interval)::date AS report_month_end
        ), available_plan_month AS (
         SELECT min(v_product_bulk_consolidated_effective.month_start) AS planning_month_start
           FROM v_product_bulk_consolidated_effective
          WHERE v_product_bulk_consolidated_effective.month_start >= (( SELECT report_period.report_month_start
                   FROM report_period))
        ), planned AS (
         SELECT ap.planning_month_start,
            round(sum(COALESCE(p_1.final_make_qty, 0::numeric)), 2) AS planned_production_base_qty
           FROM available_plan_month ap
             LEFT JOIN v_product_bulk_consolidated_effective p_1 ON p_1.month_start = ap.planning_month_start
          GROUP BY ap.planning_month_start
        ), bulk_produced AS (
         SELECT rp_1.report_month_start,
            round(sum(COALESCE(b.expected_output_base_qty, 0::numeric)), 2) AS bulk_produced_base_qty
           FROM report_period rp_1
             LEFT JOIN v_batch_canonical_in_process_keyed b ON b.last_fg_bulk_updated >= rp_1.report_month_start AND b.last_fg_bulk_updated <= rp_1.report_month_end AND (b.primary_state = ANY (ARRAY['FG_BULK'::text, 'BOTTLED'::text, 'TRANSFERRED_ONLY'::text]))
          GROUP BY rp_1.report_month_start
        ), fg_transferred AS (
         SELECT rp_1.report_month_start,
            round(sum(COALESCE(f.tally_total_in_base, 0::numeric)), 2) AS transferred_to_finished_goods_base_qty,
            round(sum(COALESCE(f.tally_total_amount, 0::numeric)), 2) AS transferred_to_finished_goods_value
           FROM report_period rp_1
             LEFT JOIN v_fg_transfer_reconciliation f ON f.transfer_date >= rp_1.report_month_start AND f.transfer_date <= rp_1.report_month_end AND f.exists_in_tally = true
          GROUP BY rp_1.report_month_start
        )
 SELECT rp.report_date,
    rp.report_month_start,
    rp.report_month_end,
    p.planning_month_start,
        CASE
            WHEN p.planning_month_start = rp.report_month_start THEN 'CURRENT_MONTH_PLAN_AVAILABLE'::text
            WHEN p.planning_month_start > rp.report_month_start THEN 'CURRENT_MONTH_PLAN_NOT_AVAILABLE_USING_NEXT_AVAILABLE_PLAN_MONTH'::text
            WHEN p.planning_month_start IS NULL THEN 'NO_PLAN_AVAILABLE'::text
            ELSE 'UNKNOWN'::text
        END AS planning_period_status,
    COALESCE(p.planned_production_base_qty, 0::numeric) AS planned_production_base_qty,
    COALESCE(bp.bulk_produced_base_qty, 0::numeric) AS bulk_produced_base_qty,
    COALESCE(ft.transferred_to_finished_goods_base_qty, 0::numeric) AS transferred_to_finished_goods_base_qty,
    COALESCE(ft.transferred_to_finished_goods_value, 0::numeric) AS transferred_to_finished_goods_value,
        CASE
            WHEN p.planning_month_start = rp.report_month_start THEN round(COALESCE(bp.bulk_produced_base_qty, 0::numeric) - COALESCE(p.planned_production_base_qty, 0::numeric), 2)
            ELSE NULL::numeric
        END AS bulk_production_variance_base_qty,
        CASE
            WHEN p.planning_month_start = rp.report_month_start THEN round(COALESCE(ft.transferred_to_finished_goods_base_qty, 0::numeric) - COALESCE(p.planned_production_base_qty, 0::numeric), 2)
            ELSE NULL::numeric
        END AS fg_transfer_variance_base_qty,
        CASE
            WHEN p.planning_month_start = rp.report_month_start AND COALESCE(p.planned_production_base_qty, 0::numeric) > 0::numeric THEN round(COALESCE(bp.bulk_produced_base_qty, 0::numeric) / p.planned_production_base_qty * 100::numeric, 2)
            ELSE NULL::numeric
        END AS bulk_production_achievement_pct,
        CASE
            WHEN p.planning_month_start = rp.report_month_start AND COALESCE(p.planned_production_base_qty, 0::numeric) > 0::numeric THEN round(COALESCE(ft.transferred_to_finished_goods_base_qty, 0::numeric) / p.planned_production_base_qty * 100::numeric, 2)
            ELSE NULL::numeric
        END AS fg_transfer_achievement_pct,
    'Planned Production = Sum of final_make_qty from v_product_bulk_consolidated_effective for the available planning month. If current month plan is not available, achievement percentage is intentionally not calculated.'::text AS planned_production_note,
    'Planning Period Status explains whether the production plan belongs to the current report month or only to the next available planning month.'::text AS planning_period_status_note,
    'Bulk Produced = Sum of expected_output_base_qty from batches whose last_fg_bulk_updated falls within the current report month and whose state is FG_BULK, BOTTLED, or TRANSFERRED_ONLY.'::text AS bulk_produced_note,
    'Transferred to Finished Goods = Sum of tally_total_in_base from v_fg_transfer_reconciliation where transfer_date falls within the current report month and the transfer exists in Tally.'::text AS transferred_to_finished_goods_note,
    'Bulk Production Achievement % is calculated only when current-month production plan is available.'::text AS bulk_production_achievement_note,
    'Finished Goods Transfer Achievement % is calculated only when current-month production plan is available.'::text AS fg_transfer_achievement_note
   FROM report_period rp
     LEFT JOIN planned p ON true
     LEFT JOIN bulk_produced bp ON bp.report_month_start = rp.report_month_start
     LEFT JOIN fg_transferred ft ON ft.report_month_start = rp.report_month_start;
CREATE VIEW public.v_mis_production_tab_summary AS  SELECT pp.report_date,
    pp.report_month_start,
    pp.report_month_end,
    pp.planning_month_start,
    pp.planning_period_status,
    pp.planned_production_base_qty,
    pp.bulk_produced_base_qty,
    pp.transferred_to_finished_goods_base_qty,
    pp.transferred_to_finished_goods_value,
    pp.bulk_production_variance_base_qty,
    pp.fg_transfer_variance_base_qty,
    pp.bulk_production_achievement_pct,
    pp.fg_transfer_achievement_pct,
    bp.not_initiated_batch_count,
    bp.work_in_process_batch_count,
    bp.finished_goods_bulk_batch_count,
    bp.bottled_stock_batch_count,
    bp.transferred_only_batch_count,
    bp.active_pipeline_batch_count,
    bp.total_canonical_batch_count,
    bp.overdue_work_in_process_batch_count,
    bp.not_initiated_expected_output_base_qty,
    bp.work_in_process_expected_output_base_qty,
    bp.finished_goods_bulk_on_hand_base_qty,
    bp.bottled_stock_on_hand_base_qty,
    bp.transferred_only_base_qty,
    pp.planned_production_note,
    pp.planning_period_status_note,
    pp.bulk_produced_note,
    pp.transferred_to_finished_goods_note,
    pp.bulk_production_achievement_note,
    pp.fg_transfer_achievement_note,
    bp.active_pipeline_batch_count_note,
    bp.total_canonical_batch_count_note,
    bp.not_initiated_note,
    bp.work_in_process_note,
    bp.finished_goods_bulk_note,
    bp.bottled_stock_note,
    bp.transferred_only_note,
    'Production tab covers current-month production plan achievement and operational batch pipeline status. Active Pipeline includes Not Initiated, Work in Process, Finished Goods Bulk, and Bottled Stock. Transferred-only batches are historical/completed transfer records and are excluded from active pipeline.'::text AS production_scope_note
   FROM v_mis_production_position pp
     CROSS JOIN v_mis_batch_pipeline bp;
CREATE VIEW public.v_mis_sales_position WITH (security_invoker=true) AS  WITH latest_sales AS (
         SELECT max(v_sales_daily_normalized.sales_date) AS report_date
           FROM v_sales_daily_normalized
        ), periods AS (
         SELECT latest_sales.report_date,
            date_trunc('month'::text, latest_sales.report_date::timestamp with time zone)::date AS month_start,
            (date_trunc('month'::text, latest_sales.report_date::timestamp with time zone) + '1 mon -1 days'::interval)::date AS month_end
           FROM latest_sales
        ), base AS (
         SELECT s.sales_date,
            COALESCE(s.qty_units, 0::numeric) AS qty_units,
            COALESCE(s.qty_billed, 0::numeric) AS qty_billed,
            COALESCE(s.billed_amount, 0::numeric) AS billed_amount
           FROM v_sales_daily_normalized s
             CROSS JOIN periods p
          WHERE s.sales_date >= p.month_start AND s.sales_date <= p.report_date
        ), summary AS (
         SELECT p.report_date,
            p.month_start,
            p.month_end,
            sum(b.billed_amount) FILTER (WHERE b.sales_date = p.report_date) AS sales_value_latest_day,
            sum(b.qty_units) FILTER (WHERE b.sales_date = p.report_date) AS sales_units_latest_day,
            sum(b.qty_billed) FILTER (WHERE b.sales_date = p.report_date) AS sales_billed_units_latest_day,
            sum(b.billed_amount) AS sales_value_month_to_date,
            sum(b.qty_units) AS sales_units_month_to_date,
            sum(b.qty_billed) AS sales_billed_units_month_to_date,
            count(DISTINCT b.sales_date) AS sales_days_available_in_month
           FROM periods p
             LEFT JOIN base b ON true
          GROUP BY p.report_date, p.month_start, p.month_end
        )
 SELECT report_date,
    month_start,
    month_end,
    round(COALESCE(sales_value_latest_day, 0::numeric), 2) AS sales_value_latest_day,
    round(COALESCE(sales_units_latest_day, 0::numeric), 2) AS sales_units_latest_day,
    round(COALESCE(sales_billed_units_latest_day, 0::numeric), 2) AS sales_billed_units_latest_day,
    round(COALESCE(sales_value_month_to_date, 0::numeric), 2) AS sales_value_month_to_date,
    round(COALESCE(sales_units_month_to_date, 0::numeric), 2) AS sales_units_month_to_date,
    round(COALESCE(sales_billed_units_month_to_date, 0::numeric), 2) AS sales_billed_units_month_to_date,
    COALESCE(sales_days_available_in_month, 0::bigint) AS sales_days_available_in_month,
    'Latest Day Sales Value = Sum of billed_amount from v_sales_daily_normalized for the latest available sales date.'::text AS sales_value_latest_day_note,
    'Month-to-Date Sales Value = Sum of billed_amount from v_sales_daily_normalized from the first day of the month up to the latest available sales date.'::text AS sales_value_month_to_date_note,
    'Sales units are reported from qty_units and billed units from qty_billed. These may differ depending on billing and actual quantity representation in Tally.'::text AS sales_units_note
   FROM summary;
CREATE VIEW public.v_mis_sales_tab_summary WITH (security_invoker=true) AS  WITH latest_sales AS (
         SELECT ( SELECT v_sales_daily_normalized.sales_date
                   FROM v_sales_daily_normalized
                  WHERE v_sales_daily_normalized.sales_date IS NOT NULL
                  ORDER BY v_sales_daily_normalized.sales_date DESC
                 LIMIT 1) AS report_date
        ), periods AS (
         SELECT latest_sales.report_date,
            date_trunc('month'::text, latest_sales.report_date::timestamp with time zone)::date AS month_start,
            latest_sales.report_date AS month_upto_date
           FROM latest_sales
        ), sales_base AS (
         SELECT s_1.sales_date,
            s_1.sku_id,
            s_1.product_id,
            s_1.godown_id,
            s_1.region_id,
            s_1.qty_units,
            s_1.qty_billed,
            s_1.billed_amount,
            s_1.source_key,
            s_1.inserted_at
           FROM v_sales_daily_normalized s_1
             CROSS JOIN periods p_1
          WHERE s_1.sales_date >= p_1.month_start AND s_1.sales_date <= p_1.month_upto_date
        )
 SELECT p.report_date,
    p.month_start,
    p.month_upto_date,
    sum(s.billed_amount) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_value,
    sum(s.qty_units) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_units,
    sum(s.qty_billed) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_billed_units,
    sum(s.billed_amount) AS month_to_date_sales_value,
    sum(s.qty_units) AS month_to_date_sales_units,
    sum(s.qty_billed) AS month_to_date_billed_units,
    count(DISTINCT s.sales_date) AS sales_days_available_in_month,
    count(DISTINCT s.product_id) AS products_sold_month_to_date,
    count(DISTINCT s.sku_id) AS skus_sold_month_to_date,
        CASE
            WHEN count(DISTINCT s.sales_date) > 0 THEN sum(s.billed_amount) / count(DISTINCT s.sales_date)::numeric
            ELSE NULL::numeric
        END AS average_daily_sales_value,
    'Sales tab summary is based on the latest available sales month from v_sales_daily_normalized. Month-to-date values cover sales from month start up to the latest available sales date.'::text AS sales_scope_note
   FROM periods p
     LEFT JOIN sales_base s ON true
  GROUP BY p.report_date, p.month_start, p.month_upto_date;
CREATE VIEW public.mv_mis_executive_summary WITH (security_invoker=true) AS  SELECT mis_summary_id,
    report_generated_date,
    financial_position_date,
    payables_sundry_creditors,
    receivables_sundry_debtors,
    net_sundry_position,
    expense_position_date,
    financial_year_start,
    direct_expenses_fy_position,
    indirect_expenses_fy_position,
    total_expenses_fy_position,
    sales_position_date,
    sales_month_start,
    sales_month_end,
    sales_value_latest_day,
    sales_value_month_to_date,
    sales_units_latest_day,
    sales_units_month_to_date,
    raw_material_inventory_value,
    packing_material_inventory_value,
    consumables_inventory_value,
    fuel_inventory_value,
    manufacturing_inventory_value,
    fg_inventory_value_overall,
    fg_stock_units_overall,
    fg_items_below_1_month_cover,
    fg_items_above_6_month_cover,
    active_pipeline_batch_count,
    not_initiated_batch_count,
    work_in_process_batch_count,
    finished_goods_bulk_batch_count,
    bottled_stock_batch_count,
    overdue_work_in_process_batch_count,
    production_report_month_start,
    production_report_month_end,
    planning_month_start,
    planning_period_status,
    planned_production_base_qty,
    bulk_produced_base_qty,
    transferred_to_finished_goods_base_qty,
    transferred_to_finished_goods_value,
    bulk_production_achievement_pct,
    fg_transfer_achievement_pct,
    mv_refreshed_at,
    executive_summary_note
   FROM app_private.mv_mis_executive_summary;
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
  order by f.outstanding_amount_mis_value desc, f.party_name asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;
CREATE OR REPLACE FUNCTION public.get_mis_finished_goods_sku_page(p_mos_filter text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(category_name text, sub_category_name text, product_group_name text, sub_group_name text, product_id integer, item text, sku_id bigint, pack_size numeric, uom text, stock_ik numeric, stock_kkd numeric, stock_ok numeric, stock_overall numeric, forecast_ik numeric, forecast_kkd numeric, forecast_ok numeric, forecast_overall numeric, mos_ik numeric, mos_kkd numeric, mos_ok numeric, mos_overall numeric, stock_value_ik numeric, stock_value_kkd numeric, stock_value_ok numeric, stock_value_overall numeric, shade_flag boolean, mos_status text, classification text, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with base as (
    select
      category_name,
      sub_category_name,
      product_group_name,
      sub_group_name,
      product_id,
      item,
      sku_id,
      pack_size,
      uom,

      stock_ik,
      stock_kkd,
      stock_ok,
      coalesce(stock_ik, 0) + coalesce(stock_kkd, 0) + coalesce(stock_ok, 0) as stock_overall,

      forecast_ik,
      forecast_kkd,
      forecast_ok,
      coalesce(forecast_ik, 0) + coalesce(forecast_kkd, 0) + coalesce(forecast_ok, 0) as forecast_overall,

      mos_ik,
      mos_kkd,
      mos_ok,
      mos_overall,

      stock_value_ik,
      stock_value_kkd,
      stock_value_ok,
      stock_value_overall,

      shade_flag,

      case
        when coalesce(stock_ik, 0) + coalesce(stock_kkd, 0) + coalesce(stock_ok, 0) = 0
          then 'ZERO_STOCK'
        when mos_overall < 1
          then 'BELOW_1_MONTH'
        when mos_overall >= 1 and mos_overall <= 3
          then 'ONE_TO_THREE_MONTHS'
        when mos_overall > 6
          then 'ABOVE_6_MONTHS'
        else 'NORMAL'
      end as mos_status,

      concat_ws(
        ' › ',
        nullif(category_name, ''),
        nullif(sub_category_name, ''),
        nullif(product_group_name, ''),
        nullif(sub_group_name, '')
      ) as classification

    from public.v_stock_checker
  ),
  filtered as (
    select *
    from base
    where
      (
        p_mos_filter = 'all'
        or (p_mos_filter = 'zero_stock' and mos_status = 'ZERO_STOCK')
        or (p_mos_filter = 'below_1_month' and mos_status = 'BELOW_1_MONTH')
        or (p_mos_filter = 'one_to_three_months' and mos_status = 'ONE_TO_THREE_MONTHS')
        or (p_mos_filter = 'above_6_months' and mos_status = 'ABOVE_6_MONTHS')
        or (p_mos_filter = 'normal' and mos_status = 'NORMAL')
        or (p_mos_filter = 'shaded' and shade_flag is true)
      )
      and (
        coalesce(trim(p_search), '') = ''
        or item ilike '%' || trim(p_search) || '%'
        or sku_id::text ilike '%' || trim(p_search) || '%'
        or category_name ilike '%' || trim(p_search) || '%'
        or sub_category_name ilike '%' || trim(p_search) || '%'
        or product_group_name ilike '%' || trim(p_search) || '%'
        or sub_group_name ilike '%' || trim(p_search) || '%'
        or classification ilike '%' || trim(p_search) || '%'
      )
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.category_name,
    f.sub_category_name,
    f.product_group_name,
    f.sub_group_name,
    f.product_id,
    f.item,
    f.sku_id,
    f.pack_size,
    f.uom,

    f.stock_ik,
    f.stock_kkd,
    f.stock_ok,
    f.stock_overall,

    f.forecast_ik,
    f.forecast_kkd,
    f.forecast_ok,
    f.forecast_overall,

    f.mos_ik,
    f.mos_kkd,
    f.mos_ok,
    f.mos_overall,

    f.stock_value_ik,
    f.stock_value_kkd,
    f.stock_value_ok,
    f.stock_value_overall,

    f.shade_flag,
    f.mos_status,
    f.classification,
    c.total_rows
  from filtered f
  cross join counted c
  order by
    case f.mos_status
      when 'ZERO_STOCK' then 1
      when 'BELOW_1_MONTH' then 2
      when 'NORMAL' then 3
      when 'ONE_TO_THREE_MONTHS' then 4
      when 'ABOVE_6_MONTHS' then 5
      else 6
    end,
    f.stock_value_overall desc nulls last,
    f.item asc,
    f.pack_size asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;
CREATE OR REPLACE FUNCTION public.get_mis_inventory_item_page(p_source_kind text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(source_kind text, source_label text, inv_stock_item_id bigint, code text, item_name text, qty_value numeric, avg_rate_value numeric, stock_value numeric, category_label text, subcategory_label text, group_label text, subgroup_label text, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with base as (
    select
      source_kind,
      category_code,
      case
        when source_kind = 'rm' then 'Raw Material'
        when source_kind = 'plm' then 'Packing Material'
        when source_kind = 'consumable' then 'Consumables'
        when source_kind = 'fuel' then 'Fuel'
        else source_kind
      end as source_label,
      inv_stock_item_id,
      code,
      name as item_name,
      qty_value,
      avg_rate_value,
      CASE WHEN qty_value = 0 THEN 0::numeric WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0 THEN NULL::numeric ELSE qty_value * avg_rate_value END as stock_value,
      category_label,
      subcategory_label,
      group_label,
      subgroup_label
    from public.v_stock_current_by_item
  ),
  filtered as (
    select *
    from base
    where
      (
        p_source_kind = 'all'
        or (p_source_kind IN ('RM','PM','IND') AND category_code = p_source_kind)
        or (p_source_kind NOT IN ('RM','PM','IND') AND source_kind = p_source_kind)
      )
      and (
        coalesce(trim(p_search), '') = ''
        or code ilike '%' || trim(p_search) || '%'
        or item_name ilike '%' || trim(p_search) || '%'
        or category_label ilike '%' || trim(p_search) || '%'
        or subcategory_label ilike '%' || trim(p_search) || '%'
        or group_label ilike '%' || trim(p_search) || '%'
        or subgroup_label ilike '%' || trim(p_search) || '%'
      )
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.source_kind,
    f.source_label,
    f.inv_stock_item_id,
    f.code,
    f.item_name,
    f.qty_value,
    f.avg_rate_value,
    f.stock_value,
    f.category_label,
    f.subcategory_label,
    f.group_label,
    f.subgroup_label,
    c.total_rows
  from filtered f
  cross join counted c
  order by f.stock_value desc nulls last, f.item_name asc, f.inv_stock_item_id asc, f.source_kind asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;
CREATE OR REPLACE FUNCTION public.get_mis_sales_product_page(p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(report_date date, month_start date, month_upto_date date, product_id bigint, product_name text, sku_count bigint, sales_value numeric, sales_units numeric, billed_units numeric, latest_day_sales_value numeric, latest_day_sales_units numeric, average_daily_sales_value numeric, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with latest_sales as (
    select (select sales_date from public.v_sales_daily_normalized where sales_date is not null order by sales_date desc limit 1) as report_date
  ),
  periods as (
    select
      report_date,
      date_trunc('month', report_date)::date as month_start,
      report_date as month_upto_date
    from latest_sales
  ),
  product_sales as (
    select
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      coalesce(pr.item, 'Product ID ' || s.product_id::text) as product_name,
      count(distinct s.sku_id) as sku_count,
      sum(s.billed_amount) as sales_value,
      sum(s.qty_units) as sales_units,
      sum(s.qty_billed) as billed_units,
      sum(s.billed_amount) filter (where s.sales_date = p.report_date) as latest_day_sales_value,
      sum(s.qty_units) filter (where s.sales_date = p.report_date) as latest_day_sales_units,
      case
        when count(distinct s.sales_date) > 0
        then sum(s.billed_amount) / count(distinct s.sales_date)
        else null
      end as average_daily_sales_value
    from public.v_sales_daily_normalized s
    cross join periods p
    left join public.products pr
      on pr.id = s.product_id
    where s.sales_date >= p.month_start
      and s.sales_date <= p.month_upto_date
    group by
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      pr.item
  ),
  filtered as (
    select *
    from product_sales
    where
      coalesce(trim(p_search), '') = ''
      or product_name ilike '%' || trim(p_search) || '%'
      or product_id::text ilike '%' || trim(p_search) || '%'
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.report_date,
    f.month_start,
    f.month_upto_date,
    f.product_id,
    f.product_name,
    f.sku_count,
    f.sales_value,
    f.sales_units,
    f.billed_units,
    f.latest_day_sales_value,
    f.latest_day_sales_units,
    f.average_daily_sales_value,
    c.total_rows
  from filtered f
  cross join counted c
  order by f.sales_value desc nulls last, f.product_name asc, f.product_id asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;
GRANT USAGE ON SCHEMA app_private TO authenticated; GRANT SELECT ON ALL TABLES IN SCHEMA public,app_private TO authenticated;
