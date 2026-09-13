/**
 * Gate A — PLM PM-BOM revision governance static smoke.
 * Asserts migration SQL encodes locked semantics + audit corrections.
 * No network / no DB writes.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
const assert = (cond, msg) => {
  if (!cond) fails.push(msg);
};

const migrationRel =
  "supabase/migrations/20260913093738_plm_bom_revision_governance_gate_a.sql";
const hardeningRel =
  "supabase/migrations/20260913094900_plm_bom_revision_gate_a_function_privilege_hardening.sql";
const approvalRel =
  "supabase/migrations/20260913095639_plm_bom_revision_gate_a_approval_separation.sql";

assert(existsSync(join(root, migrationRel)), `migration exists: ${migrationRel}`);
assert(existsSync(join(root, hardeningRel)), `hardening parity exists: ${hardeningRel}`);
assert(existsSync(join(root, approvalRel)), `approval separation exists: ${approvalRel}`);

const sql = readFileSync(join(root, migrationRel), "utf8");
const hardening = readFileSync(join(root, hardeningRel), "utf8");
const approval = readFileSync(join(root, approvalRel), "utf8");

assert(/create table public\.plm_bom_revision\b/i.test(sql), "creates plm_bom_revision");
assert(
  /create table public\.plm_bom_revision_line\b/i.test(sql),
  "creates plm_bom_revision_line",
);

assert(
  /check \(status = any \(array\['DRAFT'::text, 'APPROVED'::text, 'SUPERSEDED'::text, 'CANCELLED'::text\]\)\)/i.test(
    sql,
  ),
  "status domain DRAFT/APPROVED/SUPERSEDED/CANCELLED",
);

assert(
  /plm_bom_revision_no_governed_overlap/i.test(sql),
  "named governed overlap exclude constraint",
);
assert(
  /where \(status = any \(array\['APPROVED'::text, 'SUPERSEDED'::text\]\)\)/i.test(sql),
  "overlap exclude covers APPROVED + SUPERSEDED",
);
assert(
  /uq_plm_bom_revision_one_open_approved/i.test(sql),
  "one open APPROVED unique index",
);
assert(
  /where \(status = 'APPROVED' and effective_to is null\)/i.test(sql),
  "open-current predicate status=APPROVED and effective_to is null",
);

assert(/content_hash text/i.test(sql), "content_hash column");
assert(/frozen_at timestamptz/i.test(sql), "frozen_at column");
assert(
  /fn_plm_bom_revision_build_content_hash/i.test(sql),
  "deterministic hash builder",
);
assert(
  /fn_plm_bom_revision_verify_content_hash/i.test(sql),
  "hash verify helper",
);

assert(
  /app\.plm_bom_revision_mutate_context/i.test(sql),
  "narrow governed mutate GUC",
);
assert(
  /fn_plm_bom_revision_header_immutable/i.test(sql),
  "header immutability trigger fn",
);
assert(
  /fn_plm_bom_revision_line_immutable/i.test(sql),
  "line immutability trigger fn",
);

assert(
  /rpc_plm_bom_revision_create_draft/i.test(sql),
  "create draft RPC",
);
assert(/rpc_plm_bom_revision_approve/i.test(sql), "approve RPC");
assert(/rpc_plm_bom_revision_cancel/i.test(sql), "cancel RPC");
assert(/rpc_plm_bom_revision_list/i.test(sql), "list RPC");
assert(/rpc_plm_bom_revision_get/i.test(sql), "get RPC");
assert(/rpc_plm_bom_revision_list_lines/i.test(sql), "list lines RPC");

assert(
  /require_permission\(\s*'module:pm-templates'\s*,\s*true\)/i.test(sql),
  "foundation create/cancel require module:pm-templates edit",
);
assert(
  /require_permission\(\s*'module:pm-templates'\s*,\s*false\)/i.test(sql),
  "read RPCs require module:pm-templates view",
);

assert(
  /effective_to = p_effective_from - 1/i.test(sql),
  "approve closes prior with effective_from - 1 day",
);
assert(
  /status = 'SUPERSEDED'/i.test(sql),
  "approve supersedes prior",
);

assert(/plm_sku_bom_revision_as_of/i.test(sql), "as-of header resolver");
assert(/plm_sku_bom_lines_as_of/i.test(sql), "as-of lines resolver");
assert(
  /plm_sku_requirement_unit_as_of/i.test(sql),
  "requirement unit as-of set-returning fn",
);
assert(
  /r\.status in \('APPROVED', 'SUPERSEDED'\)/i.test(sql),
  "as-of statuses APPROVED + SUPERSEDED",
);
assert(
  /AMBIGUOUS_PM_BOM_REVISION/i.test(sql),
  "ambiguous as-of fails closed",
);

assert(
  !/fn_build_sku_pm_cost_lines_as_of/i.test(sql),
  "does not touch costing.fn_build_sku_pm_cost_lines_as_of",
);
assert(
  !/create or replace view public\.v_sku_plm_requirement_unit/i.test(sql),
  "does not replace v_sku_plm_requirement_unit",
);
assert(
  !/create or replace function public\.plm_sku_bom_effective/i.test(sql),
  "does not replace plm_sku_bom_effective",
);
assert(!/run.?94/i.test(sql), "no Run-94 bootstrap");
assert(!/hridayarenjini/i.test(sql), "no Hridayarenjini bootstrap");
assert(
  !/853\b/.test(sql),
  "no SKU 853 hardcoded bootstrap",
);
assert(
  /Additive only\. No bootstrap data/i.test(sql),
  "migration header declares no bootstrap data",
);

const managePm = readFileSync(join(root, "js/manage-pm-bom.js"), "utf8");
assert(
  !/rpc_plm_bom_revision_/i.test(managePm),
  "Gate A does not wire Manage PM BOM UI to revision RPCs",
);

// --- Privilege hardening parity ---
assert(
  /DO NOT apply this migration to production/i.test(hardening),
  "hardening file is parity / do-not-reapply",
);
assert(
  /revoke all on function public\.fn_plm_bom_revision_build_content_hash/i.test(
    hardening,
  ),
  "hardening revokes hash builder from public clients",
);
assert(
  /revoke all on function public\.plm_sku_bom_revision_as_of/i.test(hardening),
  "hardening revokes as-of header resolver from public clients",
);
assert(
  /revoke all on function public\.plm_sku_requirement_unit_as_of/i.test(
    hardening,
  ),
  "hardening revokes requirement as-of from public clients",
);
assert(
  /from public, anon, authenticated/i.test(hardening),
  "hardening revokes PUBLIC/anon/authenticated",
);
assert(
  !/grant execute on function public\.fn_plm_bom_revision_/i.test(hardening),
  "hardening does not re-grant internal helpers to authenticated",
);
assert(
  !/grant execute on function public\.plm_sku_bom_revision_as_of/i.test(
    hardening,
  ),
  "hardening does not re-grant as-of resolvers to authenticated",
);
assert(
  /grant execute on function public\.rpc_plm_bom_revision_create_draft[\s\S]*to authenticated, service_role/i.test(
    hardening,
  ),
  "hardening grants create_draft to authenticated+service_role only",
);
assert(
  /grant execute on function public\.rpc_plm_bom_revision_approve[\s\S]*to authenticated, service_role/i.test(
    hardening,
  ),
  "hardening grants approve to authenticated+service_role only",
);
assert(
  !/grant execute on function public\.rpc_plm_bom_revision_[\w]+[\s\S]*to public/i.test(
    hardening,
  ),
  "hardening never grants RPCs to PUBLIC",
);
assert(
  !/grant execute on function public\.rpc_plm_bom_revision_[\w]+[\s\S]*to anon/i.test(
    hardening,
  ),
  "hardening never grants RPCs to anon",
);

// --- Approval separation ---
assert(
  /role:pm-bom-revision-approve/i.test(approval),
  "registers role:pm-bom-revision-approve",
);
assert(
  /insert into public\.permission_targets/i.test(approval),
  "inserts permission_targets row",
);
assert(
  /'kind',\s*'role'|kind\s*,[\s\S]*'role'/i.test(approval) ||
    /'role',\s*\n\s*'PM BOM Revision/i.test(approval),
  "permission target kind is role",
);
assert(
  /require_permission\(\s*'role:pm-bom-revision-approve'\s*,\s*true\)/i.test(
    approval,
  ),
  "approve RPC requires role:pm-bom-revision-approve",
);
assert(
  !/require_permission\(\s*'module:pm-templates'\s*,\s*true\)/i.test(approval),
  "approve RPC no longer uses module:pm-templates edit",
);
assert(
  !/module:production-route-manager/i.test(approval),
  "does not borrow production-route-manager",
);
assert(
  !/module:costing-control-center/i.test(approval),
  "does not borrow costing-control-center",
);
assert(
  /effective_to = p_effective_from - 1/i.test(approval),
  "approval separation preserves prior close dating",
);
assert(
  /app\.plm_bom_revision_mutate_context/i.test(approval),
  "approval separation preserves governed GUC",
);
assert(
  !/insert into public\.plm_bom_revision\b/i.test(approval),
  "approval separation has no revision seed inserts",
);

// create/cancel still pm-templates edit in foundation
assert(
  /rpc_plm_bom_revision_create_draft[\s\S]*?require_permission\(\s*'module:pm-templates'\s*,\s*true\)/i.test(
    sql,
  ),
  "create_draft still requires module:pm-templates edit",
);
assert(
  /rpc_plm_bom_revision_cancel[\s\S]*?require_permission\(\s*'module:pm-templates'\s*,\s*true\)/i.test(
    sql,
  ),
  "cancel still requires module:pm-templates edit",
);
assert(
  /rpc_plm_bom_revision_list[\s\S]*?require_permission\(\s*'module:pm-templates'\s*,\s*false\)/i.test(
    sql,
  ),
  "list still requires module:pm-templates view",
);
assert(
  /rpc_plm_bom_revision_get[\s\S]*?require_permission\(\s*'module:pm-templates'\s*,\s*false\)/i.test(
    sql,
  ),
  "get still requires module:pm-templates view",
);
assert(
  /rpc_plm_bom_revision_list_lines[\s\S]*?require_permission\(\s*'module:pm-templates'\s*,\s*false\)/i.test(
    sql,
  ),
  "list_lines still requires module:pm-templates view",
);

if (fails.length) {
  console.error("FAIL plm-bom-revision-gate-a-smoke:");
  for (const f of fails) console.error(" -", f);
  process.exit(1);
}
console.log("PASS plm-bom-revision-gate-a-smoke");
