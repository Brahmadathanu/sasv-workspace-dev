/**
 * Stage 2 PM client API cutover smoke.
 * Proves Manage PM BOM + PM Rebuild use canonical PM public contracts,
 * while physical PLM tables and provenance tokens remain.
 * No network, no Supabase mutations.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
const assert = (cond, msg) => {
  if (!cond) fails.push(msg);
};
const read = (rel) => readFileSync(join(root, rel), "utf8");

const bom = read("js/manage-pm-bom.js");
const rebuild = read("public/shared/js/pm-rebuild-dashboard.js");
const speHtml = read("public/shared/stock-purchase-explorer.html");
const tallyHtml = read("manage-tally-inv-mapping.html");
const pec = read("public/shared/js/procurement-execution-console.js");

const expectedBomRpcs = [
  "rpc_pm_preview_effective",
  "rpc_pm_ovr_list",
  "rpc_pm_ovr_upsert",
  "rpc_pm_ovr_delete",
  "rpc_pm_map_clear",
  "rpc_pm_map_set",
  "rpc_pm_override_counts",
  "rpc_pm_tpl_list_lines",
  "rpc_pm_tpl_upsert_header",
  "rpc_pm_tpl_delete_line",
  "rpc_pm_tpl_upsert_line",
  "rpc_pm_tpl_renumber",
  "rpc_pm_rebuild_skus_for_tpl",
  "rpc_pm_rebuild_all",
];

for (const name of expectedBomRpcs) {
  assert(
    new RegExp(`\\.rpc\\(\\s*["']${name}["']`).test(bom),
    `manage-pm-bom.js calls .rpc("${name}")`,
  );
}

assert(
  !/\.rpc\(\s*["']rpc_plm_/.test(bom),
  "manage-pm-bom.js has no .rpc(rpc_plm_*) calls",
);

assert(
  /\.from\(\s*["']plm_tpl_header["']\)/.test(bom),
  "retains .from(plm_tpl_header)",
);
assert(
  /\.from\(\s*["']plm_sku_pack_map["']\)/.test(bom),
  "retains .from(plm_sku_pack_map)",
);
assert(
  !/\.from\(\s*["']pm_tpl_header["']\)/.test(bom),
  "does not invent .from(pm_tpl_header)",
);
assert(
  !/\.from\(\s*["']pm_sku_pack_map["']\)/.test(bom),
  "does not invent .from(pm_sku_pack_map)",
);

assert(
  /const PM_OVERVIEW_VIEW_CANDIDATES\s*=\s*\[/.test(rebuild),
  "PM_OVERVIEW_VIEW_CANDIDATES is defined",
);
assert(
  !/PLM_OVERVIEW_VIEW_CANDIDATES/.test(rebuild),
  "PLM_OVERVIEW_VIEW_CANDIDATES removed",
);

const candidatesMatch = rebuild.match(
  /const PM_OVERVIEW_VIEW_CANDIDATES\s*=\s*\[([\s\S]*?)\];/,
);
assert(Boolean(candidatesMatch), "PM_OVERVIEW_VIEW_CANDIDATES array found");
if (candidatesMatch) {
  const body = candidatesMatch[1];
  assert(
    /v_mrp_pm_planned_vs_issued_overview/.test(body) &&
      /v_mrp_pm_issue_monthly_enriched/.test(body) &&
      /v_mrp_pm_issue_monthly_allocated/.test(body),
    "PM overview candidates include all three canonical views",
  );
  assert(!/v_mrp_plm_/.test(body), "PM candidates array has no v_mrp_plm_");
}

assert(
  /mrp_pm_rebuild_dry_run_all/.test(rebuild) &&
    /mrp_pm_rebuild_all/.test(rebuild) &&
    /mrp_pm_rebuild_for_item/.test(rebuild),
  "rebuild uses mrp_pm_rebuild_* RPCs",
);
assert(
  !/mrp_plm_rebuild_/.test(rebuild),
  "rebuild has no mrp_plm_rebuild_* client strings",
);

assert(
  /<option value="plm">PM<\/option>/.test(speHtml),
  "SPE retains value=plm",
);
assert(
  /<option value="plm">PM<\/option>/.test(tallyHtml),
  "Tally mapping retains value=plm",
);
assert(/is_plm/.test(pec), "PEC retains is_plm compatibility");
assert(
  /function canonicalMaterialClassCode/.test(pec),
  "PEC retains canonicalMaterialClassCode",
);

assert(
  /\.eq\(\s*["']code["']\s*,\s*["']PM["']\s*\)/.test(bom),
  "manage-pm-bom.js category code remains PM",
);
assert(
  !/\.eq\(\s*["']code["']\s*,\s*["']PLM["']\s*\)/.test(bom),
  "manage-pm-bom.js has no category code PLM query",
);

assert(
  !/Failed to load PLM overview|All PLM items|rebuild PLM allocations/.test(
    rebuild,
  ),
  "rebuild has no visible PLM user strings",
);
assert(
  !/\bpm_tpl_header\b|\bpm_sku_pack_map\b/.test(bom + rebuild),
  "cutover modules do not invent pm_tpl_header / pm_sku_pack_map identifiers",
);

if (fails.length) {
  console.error("pm-api-client-cutover-smoke FAILED:");
  for (const f of fails) console.error(" -", f);
  process.exit(1);
}
console.log("pm-api-client-cutover-smoke OK");
