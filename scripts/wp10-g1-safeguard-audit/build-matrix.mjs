// Generates WP10_G1_EVIDENCE/writer-transition-matrix.csv (one row per writer / direct path). Every cell names its evidence class:
// LIVE-CAPTURED (committed catalog), REPO (migration text), DOC (WP-01..04 records), FIXTURE (isolated PG scenario id), NOT PROVEN (needs catalog question Qn).
// Usage: node scripts/wp10-g1-safeguard-audit/build-matrix.mjs <outCsv>
import fs from "node:fs";
import { toCsvRow } from "./lib.mjs";

const COLS = ["id", "writer_or_path", "client_caller", "client_inputs", "server_authority_evidence", "permission_and_validation", "inactive_creation", "active_creation", "activation", "active_edit_pack_uom_sample", "product_deactivation_interaction", "audit_trail", "direct_table_coverage", "proven_vs_missing"];
const ROWS = [
  { id: "W1", writer_or_path: "rpc_create_product", client_caller: "Manage Products, products.js:1274", client_inputs: "p_item, p_sub_group_id, p_malayalam_name, p_status (Active|Inactive; no preselection), p_uom_base, p_conversion_to_base, p_is_seasonal, p_is_llt, p_manufacture_lead_time_months, p_season_profile_id, p_is_pto, p_reason, p_approval_reference",
    server_authority_evidence: "DOC (WP-03 G1 live audit). Live text NOT in repo or catalog", permission_and_validation: "DOC: manage-products EDIT + authenticated; name/reason/status/subgroup/UOM-pair/lead-time/season-profile validation; normalize_key duplicate rule",
    inactive_creation: "n/a (product level)", active_creation: "A product may be created Active; an Active product with no SKU is accepted (WP-02 G1: 54 such products)", activation: "n/a", active_edit_pack_uom_sample: "n/a", product_deactivation_interaction: "n/a",
    audit_trail: "DOC: public.product_master_audit", direct_table_coverage: "NOT PROVEN (Q4)", proven_vs_missing: "NOT PROVEN live: definition and ACL (Q1)" },
  { id: "W2", writer_or_path: "rpc_update_product (also product deactivation = status Inactive)", client_caller: "Manage Products, products.js:1300,1457", client_inputs: "product id + same master fields",
    server_authority_evidence: "DOC (WP-02/03). Live text NOT captured", permission_and_validation: "DOC: manage-products EDIT",
    inactive_creation: "n/a", active_creation: "n/a", activation: "No SKU activation effect", active_edit_pack_uom_sample: "n/a: subgroup/UOM/season edits reach route and classification via epoch hooks on products/groups (catalog)",
    product_deactivation_interaction: "Inactivation blocked while any SKU is active ONLY by fn_guard_product_inactivation_requires_no_active_skus (DOC WP-02 G1; trigger definition NOT captured). SKU-side triggers do not cover it (FIXTURE F9.1; stand-in F9.2)",
    audit_trail: "DOC: product_master_audit", direct_table_coverage: "NOT PROVEN (Q3, Q4)", proven_vs_missing: "NOT PROVEN live: definition, product-side guard (Q1, Q3)" },
  { id: "W3", writer_or_path: "rpc_create_product_sku", client_caller: "Manage Products SKU lens, products.js:2358", client_inputs: "p_product_id, p_pack_size, p_uom, p_is_active (client ALWAYS false), p_is_sample, p_reason, p_approval_reference",
    server_authority_evidence: "DOC (WP-02 G2). Live text NOT captured; behaviour at trigger level LIVE-CAPTURED", permission_and_validation: "DOC: manage-products EDIT; positive pack; nonblank UOM; reason; duplicate product+pack+UOM rejected",
    inactive_creation: "Allowed with NONE of the five essentials (FIXTURE F1)", active_creation: "REJECTED P0001 listing five labels + owner screens by live trigger trg_sku_activation_completeness_guard, for the RPC and for direct INSERT; sample SKU has no bypass (FIXTURE F2.1-F2.4)",
    activation: "n/a", active_edit_pack_uom_sample: "n/a", product_deactivation_interaction: "n/a", audit_trail: "DOC: product_sku_master_audit CREATE; LIVE trigger: product_sku_change_log INSERT", direct_table_coverage: "Triggers fire for any writer (LIVE-CAPTURED)", proven_vs_missing: "Trigger behaviour PROVEN (live-verbatim); RPC text and ACL NOT PROVEN (Q1, Q2)" },
  { id: "W4", writer_or_path: "rpc_update_product_sku", client_caller: "Manage Products SKU lens, products.js:2404", client_inputs: "p_sku_id, p_pack_size, p_uom, p_is_sample, p_reason, p_approval_reference (no active flag)",
    server_authority_evidence: "DOC (WP-02 G2). Live text NOT captured", permission_and_validation: "DOC: manage-products EDIT; reason required; duplicate identity rejected",
    inactive_creation: "n/a", active_creation: "n/a", activation: "Cannot change activation (no p_is_active)", active_edit_pack_uom_sample: "ALLOWED on an ACTIVE SKU without re-checking the five essentials (already-active boundary, FIXTURE F8.1); recorded by change log with exact changed columns (F8.2); epoch bumped (F8.6)",
    product_deactivation_interaction: "n/a", audit_trail: "DOC: UPDATE audit; LIVE trigger: change log", direct_table_coverage: "Triggers fire for any writer", proven_vs_missing: "Boundary PROVEN at trigger level; RPC text NOT PROVEN (Q1)" },
  { id: "W5", writer_or_path: "rpc_set_product_sku_active", client_caller: "Manage Products SKU lens, products.js:2460", client_inputs: "p_sku_id, p_is_active, p_reason (required), p_approval_reference (optional)",
    server_authority_evidence: "LIVE-CAPTURED; equals repo migration CI-038 (parity test P1.4)", permission_and_validation: "require_permission('module:manage-products', true); auth.uid(); reason required; row lock; same-state rejected (FIXTURE F4.3-F4.4)",
    inactive_creation: "n/a", active_creation: "n/a", activation: "All five essentials required; as-of = greatest(latest cost-period valuation date, current IST date) (CI-038a, test P2.2, FIXTURE F11); approval reference is no bypass (F3); parent must be Active (F5.1); audit ACTIVATE with old/new snapshots (F4.1)",
    active_edit_pack_uom_sample: "n/a", product_deactivation_interaction: "Reactivation under an Inactive product blocked by live parent trigger (F9.3); no cascade from the RPC (P2.6)", audit_trail: "LIVE: product_sku_master_audit ACTIVATE/DEACTIVATE", direct_table_coverage: "n/a (lifecycle path); direct writers hit the same triggers",
    proven_vs_missing: "PROVEN (live-verbatim); EXECUTE ACL NOT captured (Q2)" },
  { id: "D1", writer_or_path: "Direct INSERT/UPDATE on public.product_skus (SQL editor, service role, import)", client_caller: "none in repo (no import/bulk script)", client_inputs: "any column",
    server_authority_evidence: "LIVE-CAPTURED triggers (5 enabled)", permission_and_validation: "table privileges / RLS NOT captured (Q4)", inactive_creation: "Allowed", active_creation: "REJECTED (FIXTURE F2.1)", activation: "false->true: five-essential guard + parent guard (F4.2, F5.1)",
    active_edit_pack_uom_sample: "ALLOWED; PROVEN GAP: re-parenting an ACTIVE SKU to an Active product with no batch size/route is ACCEPTED (F8.3) because the completeness trigger returns early for already-active rows; detected afterwards by epoch -> STALE (F8.4, F8.6)",
    product_deactivation_interaction: "n/a", audit_trail: "change log row with actor NULL; NO lifecycle audit event (FIXTURE F12.1) — visibility of the change log to operators NOT PROVEN (Q4)", direct_table_coverage: "Covered at trigger level for every writer", proven_vs_missing: "Trigger level PROVEN; who may write directly NOT PROVEN (Q4)" },
  { id: "D2", writer_or_path: "Direct UPDATE of public.products.status", client_caller: "none (client uses rpc_update_product)", client_inputs: "status",
    server_authority_evidence: "Product-side guard NOT captured", permission_and_validation: "NOT PROVEN (Q4)", inactive_creation: "n/a", active_creation: "n/a", activation: "n/a", active_edit_pack_uom_sample: "n/a",
    product_deactivation_interaction: "SKU-side triggers do NOT stop it (FIXTURE F9.1); coverage rests wholly on the documented product-side guard", audit_trail: "NOT PROVEN (Q3)", direct_table_coverage: "NOT PROVEN", proven_vs_missing: "NOT PROVEN (Q3, Q4)" },
];
const csv = [COLS.join(","), ...ROWS.map((r) => COLS.map((c) => toCsvRow(r[c] ?? "")).join(","))].join("\n") + "\n";
if (process.argv[2]) fs.writeFileSync(process.argv[2], csv);
console.log(`matrix rows=${ROWS.length}`);
