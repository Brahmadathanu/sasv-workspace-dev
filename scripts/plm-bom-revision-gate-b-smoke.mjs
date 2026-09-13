/**
 * Gate B — Run-94 PM-BOM evidence bootstrap static smoke.
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
  "supabase/migrations/20260913104301_plm_bom_revision_run94_evidence_bootstrap.sql";
assert(existsSync(join(root, migrationRel)), `migration exists: ${migrationRel}`);
const sql = readFileSync(join(root, migrationRel), "utf8");

assert(/refresh_run_id = 94/.test(sql), "uses Run-94 snapshot");
assert(
  /sku_pm_material_cost_line_snapshot/.test(sql),
  "composition from Run-94 PM line snapshot",
);
assert(/RUN94_EVIDENCE_BASELINE/.test(sql), "ordinary baseline reason");
assert(/RUN94_EVIDENCE_PREDECESSOR/.test(sql), "SKU853 predecessor reason");
assert(/PROSPECTIVE_GLOSSY_REPLACEMENT/.test(sql), "SKU853 successor reason");
assert(/effective_to = date '2026-09-11'/.test(sql), "SKU853 predecessor closes 11-Sep");
assert(/date '2026-09-12'/.test(sql), "SKU853 successor from 12-Sep");
assert(/stock_item_id = 1369/.test(sql), "asserts Matt 1369");
assert(/stock_item_id = 2702/.test(sql), "asserts Glossy 2702");
assert(
  /app\.plm_bom_revision_mutate_context/.test(sql),
  "uses narrow governed mutate context",
);
assert(
  /fn_plm_bom_revision_verify_content_hash/.test(sql),
  "verifies content hashes",
);
assert(
  /plm_bom_revision already populated/.test(sql),
  "fail-closed if already bootstrapped",
);
assert(!/ON CONFLICT DO NOTHING/i.test(sql), "no silent ON CONFLICT replay");
assert(!/fn_build_sku_pm_cost_lines_as_of/.test(sql), "does not flip costing");
assert(
  !/create or replace view public\.v_sku_plm_requirement_unit/i.test(sql),
  "does not alter requirement view",
);
assert(
  !/update public\.plm_bom_header/i.test(sql),
  "does not mutate plm_bom_header",
);
assert(
  !/update public\.plm_sku_pack_map/i.test(sql),
  "does not mutate pack map",
);
assert(
  !/role:pm-bom-revision-approve/.test(sql),
  "does not assign approval role",
);
assert(!/disable trigger/i.test(sql), "does not disable triggers");

const costingTouched =
  /create or replace function costing\.fn_build_sku_pm_cost_lines_as_of/i.test(
    sql,
  );
assert(!costingTouched, "does not replace costing builder");

if (fails.length) {
  console.error("FAIL plm-bom-revision-gate-b-smoke:");
  for (const f of fails) console.error(" -", f);
  process.exit(1);
}
console.log("PASS plm-bom-revision-gate-b-smoke");
