# PEC G0 — Canonical client RPC to live server catalogue parity (12 Nov 2026)

**Source:** current `main` `public/shared/js/procurement-execution-console.js` direct literal `.rpc()` names; live Supabase `qhmoqtxpeasamtlxaoak` `pg_proc` signatures and explicit role privileges. **Scope:** source/catalogue, not a real authorized session or a per-control DOM mapping. No DB mutations.

**Result:** **43/43 distinct client RPC names resolve to exactly one public function each**, 0 missing, 0 overloaded among client-used names; all 43 `SECURITY DEFINER`, all 43 executable by authenticated, **0 executable by anon**. `auth_execute` merely means the role may attempt the RPC; each protected business wrapper still runs its own `require_permission` and actual editor/view permission must be tested with real JWTs.

| Client RPC | Live arguments | Security | authenticated EXECUTE | anon EXECUTE |
|---|---|---|---|---|
| `create_pr_from_mrp_plan` | `p_pr_number text, p_effective_from_date date, p_horizon_start_month date, p_horizon_end_month date, p_material_class_id integer, p_generation_filters jsonb, p_notes text` | DEFINER | yes | no |
| `get_user_permissions` | `p_user_id uuid` | DEFINER | yes | no |
| `proc_apply_vendor_to_same_item_lines` | `p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_vendor_id bigint, p_rate_value numeric, p_reason text, p_include_cleared boolean` | DEFINER | yes | no |
| `proc_clear_vendor_assignment_for_same_item_lines` | `p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_reason text, p_include_cleared boolean` | DEFINER | yes | no |
| `proc_get_snapshot_refresh_status` | `p_run_id bigint` | DEFINER | yes | no |
| `proc_indent_accept_excess` | `p_purchase_fact_id bigint, p_accept_qty numeric, p_reason text` | DEFINER | yes | no |
| `proc_indent_add_line` | `p_indent_id bigint, p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_requested_qty numeric, p_reason text` | DEFINER | yes | no |
| `proc_indent_clear_vendor_assignment` | `p_indent_line_id bigint` | DEFINER | yes | no |
| `proc_indent_close_strict` | `p_indent_id bigint` | DEFINER | yes | no |
| `proc_indent_close_with_override` | `p_indent_id bigint, p_reason text` | DEFINER | yes | no |
| `proc_indent_create` | `p_indent_number text, p_indent_date date, p_material_class_id bigint, p_generation_filters jsonb, p_notes text` | DEFINER | yes | no |
| `proc_indent_create_from_pr` | `p_pr_id bigint, p_indent_number text, p_indent_date date, p_notes text, p_allow_duplicate boolean` | DEFINER | yes | no |
| `proc_indent_delete_draft` | `p_indent_id bigint, p_reason text` | DEFINER | yes | no |
| `proc_indent_issue` | `p_indent_id bigint, p_issued_date date` | DEFINER | yes | no |
| `proc_indent_recommend_and_accept_vendors_step` | `p_indent_id bigint, p_limit integer, p_reason text, p_clear_selected_inactive boolean` | DEFINER | yes | no |
| `proc_indent_recommend_vendor` | `p_indent_line_id bigint` | DEFINER | yes | no |
| `proc_indent_resync_from_pr` | `p_indent_id bigint, p_mode text` | DEFINER | yes | no |
| `proc_indent_set_source_pr` | `p_indent_id bigint, p_pr_id bigint, p_note text` | DEFINER | yes | no |
| `proc_indent_set_status` | `p_indent_id bigint, p_status text, p_approved_date date` | DEFINER | yes | no |
| `proc_indent_set_vendor_selection` | `p_indent_line_id bigint, p_selected_vendor_id bigint, p_selected_rate numeric, p_reason text` | DEFINER | yes | no |
| `proc_pec_buylist_material_class_options` | `none` | DEFINER | yes | no |
| `proc_pec_buylist_rm_scope_options` | `none` | DEFINER | yes | no |
| `proc_pec_excess_acceptance_audit` | `none` | DEFINER | yes | no |
| `proc_pec_indent_headers` | `none` | DEFINER | yes | no |
| `proc_pec_indent_lines` | `p_indent_id bigint` | DEFINER | yes | no |
| `proc_pec_pr_headers` | `none` | DEFINER | yes | no |
| `proc_pec_pr_lines` | `p_pr_id bigint` | DEFINER | yes | no |
| `proc_pec_purchase_excess` | `none` | DEFINER | yes | no |
| `proc_pec_sourcing_decisions` | `p_indent_id bigint` | DEFINER | yes | no |
| `proc_pec_vendor_details` | `p_vendor_ids bigint[]` | DEFINER | yes | no |
| `proc_pr_add_line` | `p_pr_id bigint, p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_requested_qty numeric, p_reason text` | DEFINER | yes | no |
| `proc_pr_create_revision_from_active` | `p_pr_id bigint, p_notes text` | DEFINER | yes | no |
| `proc_pr_delete_draft` | `p_pr_id bigint, p_reason text` | DEFINER | yes | no |
| `proc_pr_rebuild_from_mrp` | `p_pr_id bigint, p_mode text` | DEFINER | yes | no |
| `proc_pr_set_manual_delta` | `p_pr_line_id bigint, p_manual_delta_qty numeric, p_manual_reason text` | DEFINER | yes | no |
| `proc_pr_set_manual_reason` | `p_pr_line_id bigint, p_reason text` | DEFINER | yes | no |
| `proc_pr_set_status` | `p_pr_id bigint, p_status text, p_note text` | DEFINER | yes | no |
| `proc_preview_same_item_vendor_action` | `p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_include_cleared boolean` | DEFINER | yes | no |
| `proc_procurement_action_queue_paged` | `p_indent_id bigint, p_priority_band text, p_material_class_id bigint, p_needs text, p_selected_state text, p_group_mode text, p_q text, p_limit integer, p_offset integer` | DEFINER | yes | no |
| `proc_request_snapshot_refresh` | `p_request_source text` | DEFINER | yes | no |
| `proc_vendor_lookup` | `p_q text, p_active_only boolean, p_vendor_type text, p_limit integer` | DEFINER | yes | no |
| `proc_vendorwise_buylist_filtered` | `p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text` | DEFINER | yes | no |
| `proc_vendorwise_buylist_split_items` | `p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text` | DEFINER | yes | no |

**Remaining G0 mapping:** determine actual client call-site-to-control/role and modal association, output fields, feature flags, dispatch timing, export dependencies and live authenticated success. The 43 names do not cover dynamic `.rpc(name)` calls or other database access forms. Canonical client five-lens work remains Claude draft PR #320, dependent on #291 and #301. Server paged-read additions in draft PR #323 use **new** function names and are not reflected in these 43 current-main client symbols.

**Programme:** #284; S4 #305; formal 0/6 gates verified. No inferred completion from ACL data alone.
