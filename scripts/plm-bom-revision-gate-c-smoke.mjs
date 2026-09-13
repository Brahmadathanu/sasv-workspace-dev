/**
 * Gate C — PM costing as-of BOM identity flip static smoke.
 * No network / no DB writes. Does not apply migrations.
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
  "supabase/migrations/20260913120000_plm_bom_revision_costing_asof_flip.sql";
const b1Rel =
  "supabase/migrations/20260913111359_plm_bom_revision_sku1365_user_confirmed_evidence.sql";

assert(existsSync(join(root, migrationRel)), `migration exists: ${migrationRel}`);
assert(existsSync(join(root, b1Rel)), `B.1 parity migration exists: ${b1Rel}`);

const sql = readFileSync(join(root, migrationRel), "utf8");
const b1 = readFileSync(join(root, b1Rel), "utf8");

assert(
  /SOURCE-CONTROL PARITY/.test(b1),
  "B.1 marked SOURCE-CONTROL PARITY",
);
assert(
  /DO NOT reapply to production/i.test(b1),
  "B.1 warns DO NOT reapply",
);
assert(
  /USER_CONFIRMED_PHYSICAL_TRUTH_BASELINE/.test(b1),
  "B.1 uses confirmed change_reason",
);
assert(
  /PLM-PM-BOM-SKU1365-CONFIRMED-20260913/.test(b1),
  "B.1 uses confirmed approval_reference",
);

assert(
  /create or replace function costing\.fn_build_sku_pm_cost_lines_as_of/i.test(
    sql,
  ),
  "replaces fn_build_sku_pm_cost_lines_as_of",
);
assert(
  /plm_sku_requirement_unit_as_of\s*\(\s*p_valuation_date\s*\)/.test(sql),
  "requirements source is plm_sku_requirement_unit_as_of(p_valuation_date)",
);
assert(
  !/from\s+public\.v_sku_plm_requirement_unit\b/i.test(sql),
  "no longer uses v_sku_plm_requirement_unit as requirements source",
);
assert(
  /fn_resolve_material_rates_as_of/.test(sql),
  "still bulk-resolves rates via fn_resolve_material_rates_as_of",
);
assert(
  /NO_EFFECTIVE_PM_BOM_REVISION/.test(sql),
  "contains fail-closed coverage exception prefix",
);
assert(
  /ps\.is_active\s*=\s*true/.test(sql) &&
    /coalesce\(p\.status,\s*''\)\s+ilike\s+'active'/.test(sql),
  "coverage guard uses active costing SKU population filter",
);
assert(
  !/plm_sku_bom_effective\s*\(/.test(sql),
  "does not fall back to plm_sku_bom_effective in costing function",
);
assert(
  /returns table\s*\([\s\S]*acceptance_action_required_summary text\s*\)/i.test(
    sql,
  ),
  "return contract columns remain present",
);
assert(
  !/create or replace view public\.v_sku_plm_requirement_unit/i.test(sql),
  "does not alter current PLM requirement view",
);
assert(
  !/create or replace function public\.plm_sku_bom_effective/i.test(sql),
  "does not alter plm_sku_bom_effective",
);
assert(
  !/create or replace function costing\.fn_build_sku_pm_cost_as_of/i.test(sql),
  "does not replace downstream fn_build_sku_pm_cost_as_of",
);
assert(
  !/create or replace function costing\.fn_build_sku_material_cost_as_of/i.test(
    sql,
  ),
  "does not replace material cost builder",
);
assert(
  !/create or replace function costing\.fn_resolve_material_rates_as_of/i.test(
    sql,
  ),
  "does not redefine rate resolver",
);
assert(!/disable trigger/i.test(sql), "does not disable triggers");
assert(
  /DO NOT apply to production until audited/i.test(sql),
  "Gate C migration header warns not to apply yet",
);

// Ensure only one CREATE OR REPLACE FUNCTION and it is the PM lines builder
const createCount = (
  sql.match(/create or replace function/gi) || []
).length;
assert(createCount === 1, "Gate C migration has exactly one CREATE OR REPLACE FUNCTION");

if (fails.length) {
  console.error("FAIL plm-bom-revision-gate-c-smoke:");
  for (const f of fails) console.error(" -", f);
  process.exit(1);
}
console.log("PASS plm-bom-revision-gate-c-smoke");
