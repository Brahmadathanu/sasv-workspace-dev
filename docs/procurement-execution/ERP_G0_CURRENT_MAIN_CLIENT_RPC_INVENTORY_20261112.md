# PEC G0 — Current-main client RPC snapshot (2026-11-12)

Canonical entrypoints on `main`:
- `public/shared/procurement-execution-console.html` (five primary lenses)
- `public/shared/js/procurement-execution-console.js` (single shared client source)

Five lenses: `tab-pr`, `tab-action`, `tab-indents`, `tab-vendor-buylist`, `tab-excess`.

Direct literal `.rpc(...)` call sites: **44 occurrences / 43 unique RPC names**. Regex is a direct-literal audit only and excludes dynamic calls / helpers; it is not a user-control-to-RPC matrix.

## Client direct RPC symbols
- `create_pr_from_mrp_plan`
- `get_user_permissions`
- `proc_apply_vendor_to_same_item_lines`
- `proc_clear_vendor_assignment_for_same_item_lines`
- `proc_get_snapshot_refresh_status`
- `proc_indent_accept_excess`
- `proc_indent_add_line`
- `proc_indent_clear_vendor_assignment`
- `proc_indent_close_strict`
- `proc_indent_close_with_override`
- `proc_indent_create`
- `proc_indent_create_from_pr`
- `proc_indent_delete_draft`
- `proc_indent_issue`
- `proc_indent_recommend_and_accept_vendors_step`
- `proc_indent_recommend_vendor`
- `proc_indent_resync_from_pr`
- `proc_indent_set_source_pr`
- `proc_indent_set_status`
- `proc_indent_set_vendor_selection`
- `proc_pec_buylist_material_class_options`
- `proc_pec_buylist_rm_scope_options`
- `proc_pec_excess_acceptance_audit`
- `proc_pec_indent_headers`
- `proc_pec_indent_lines`
- `proc_pec_pr_headers`
- `proc_pec_pr_lines`
- `proc_pec_purchase_excess`
- `proc_pec_sourcing_decisions`
- `proc_pec_vendor_details`
- `proc_pr_add_line`
- `proc_pr_create_revision_from_active`
- `proc_pr_delete_draft`
- `proc_pr_rebuild_from_mrp`
- `proc_pr_set_manual_delta`
- `proc_pr_set_manual_reason`
- `proc_pr_set_status`
- `proc_preview_same_item_vendor_action`
- `proc_procurement_action_queue_paged`
- `proc_request_snapshot_refresh`
- `proc_vendor_lookup`
- `proc_vendorwise_buylist_filtered`
- `proc_vendorwise_buylist_split_items`

## G0 inventory limitations
- This snapshot verifies RPC symbol usage in current `main`, not whether each control is visible, enabled or permission-gated in UI.
- Need DOM per-lens control mapping, standalone export workflow, delegated event bindings, role restrictions, pagination and responsive acceptance before marking G0 complete.
- Master #284 / S4 #305 / draft source correction PR #317; the broad evidence repository is draft docs PR #287.
- No database writes, UI changes or merges performed in this inventory.
