/**
 * Client semantic PM category-code smoke.
 * Asserts repaired modules query canonical PM (not PLM) for category codes,
 * while retaining PLM-era object names and source_kind="plm" channels.
 * No network, no Supabase calls, no database changes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
const assert = (cond, msg) => {
  if (!cond) fails.push(msg);
};

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const bom = read("js/manage-pm-bom.js");
const labEntry = read("public/shared/js/lab-analysis-entry.js");
const labProto = read("public/shared/js/lab-protocol-manager.js");
const labSpec = read("public/shared/js/lab-spec-profile-manager.js");
const explorer = read("public/shared/js/stock-purchase-explorer.js");
const pec = read("public/shared/js/procurement-execution-console.js");
const mrp = read("public/shared/js/mrp-material-board.js");

// ── 1. PM BOM ────────────────────────────────────────────────────────────────
assert(
  /\.from\(\s*["']inv_class_category["']\s*\)[\s\S]{0,200}\.eq\(\s*["']code["']\s*,\s*["']PM["']\s*\)/.test(
    bom,
  ),
  "manage-pm-bom.js loads inv_class_category by code PM",
);
assert(
  !/\.eq\(\s*["']code["']\s*,\s*["']PLM["']\s*\)/.test(bom),
  "manage-pm-bom.js has no .eq(code, PLM)",
);

// ── 2. Lab Analysis Entry ────────────────────────────────────────────────────
assert(
  !/category_code\s*===\s*["']PLM["']/.test(labEntry),
  "lab-analysis-entry.js has no category_code === PLM",
);
assert(
  !/\.eq\(\s*["']category_code["']\s*,\s*["']PLM["']\s*\)/.test(labEntry),
  "lab-analysis-entry.js has no .eq(category_code, PLM)",
);
assert(
  /category_code\s*===\s*["']PM["']/.test(labEntry),
  "lab-analysis-entry.js filters pmItems by category_code === PM",
);
assert(
  /\.eq\(\s*["']category_code["']\s*,\s*["']PM["']\s*\)/.test(labEntry),
  "lab-analysis-entry.js PM readiness uses category_code PM",
);
assert(
  /category_code\s*===\s*["']RM["']/.test(labEntry) &&
    /\.eq\(\s*["']category_code["']\s*,\s*["']RM["']\s*\)/.test(labEntry),
  "lab-analysis-entry.js RM paths remain RM",
);

// ── 3. Lab Protocol Manager ──────────────────────────────────────────────────
assert(
  !/\.eq\(\s*["']category_code["']\s*,\s*["']PLM["']\s*\)/.test(labProto),
  "lab-protocol-manager.js has no .eq(category_code, PLM)",
);
assert(
  /\.eq\(\s*["']category_code["']\s*,\s*["']PM["']\s*\)/.test(labProto),
  "lab-protocol-manager.js PM family query uses category_code PM",
);
assert(
  /\.eq\(\s*["']category_code["']\s*,\s*["']RM["']\s*\)/.test(labProto),
  "lab-protocol-manager.js RM family query remains RM",
);

// ── 4. Lab Spec Profile Manager ──────────────────────────────────────────────
assert(
  !/\.eq\(\s*["']category_code["']\s*,\s*["']PLM["']\s*\)/.test(labSpec),
  "lab-spec-profile-manager.js has no .eq(category_code, PLM)",
);
const pmEqCount = (
  labSpec.match(/\.eq\(\s*["']category_code["']\s*,\s*["']PM["']\s*\)/g) || []
).length;
assert(
  pmEqCount >= 3,
  `lab-spec-profile-manager.js has >=3 PM category_code filters (found ${pmEqCount})`,
);
assert(
  /\.eq\(\s*["']category_code["']\s*,\s*["']RM["']\s*\)/.test(labSpec),
  "lab-spec-profile-manager.js RM category paths remain RM",
);

// ── 5. Stock Purchase Explorer ───────────────────────────────────────────────
assert(
  /plm:\s*["']PM["']/.test(explorer),
  "stock-purchase-explorer maps source_kind plm → category PM",
);
assert(
  !/plm:\s*["']PLM["']/.test(explorer),
  "stock-purchase-explorer no longer maps plm → category PLM",
);
assert(
  /p_source_kind/.test(explorer) && /source_kind/.test(explorer),
  "stock-purchase-explorer still uses source_kind / p_source_kind channel",
);
assert(
  /["']plm["']/.test(explorer) || /\bplm\b/.test(explorer),
  "stock-purchase-explorer retains lowercase plm source-channel token",
);

// ── 6. Class C: PM public RPCs + retained physical PLM tables ────────────────
assert(/rpc_pm_/.test(bom), "manage-pm-bom.js uses rpc_pm_ contracts");
assert(
  !/\.rpc\(\s*["']rpc_plm_/.test(bom),
  "manage-pm-bom.js has no active rpc_plm_ calls",
);
assert(
  /plm_sku_pack_map/.test(bom),
  "manage-pm-bom.js retains plm_sku_pack_map",
);
assert(/plm_tpl_header/.test(bom), "manage-pm-bom.js retains plm_tpl_header");
assert(
  !/\.from\(\s*["']pm_tpl_header["']\)/.test(bom) &&
    !/\.from\(\s*["']pm_sku_pack_map["']\)/.test(bom),
  "manage-pm-bom.js does not invent pm_* physical tables",
);

// ── 7. PEC compatibility retention (read-only) ───────────────────────────────
assert(
  /function canonicalMaterialClassCode/.test(pec) &&
    /code === ["']PLM["']\s*\?\s*["']PM["']/.test(pec),
  "PEC keeps PLM → PM canonical compatibility helper",
);
assert(
  /is_plm/.test(pec),
  "PEC retains is_plm server contract",
);

// ── 8. MRP compatibility retention (read-only) ───────────────────────────────
assert(
  /material_type === ["']PM["']\s*\|\|\s*state\.material_type === ["']PLM["']/.test(
    mrp,
  ) || /material_kind === ["']PM["']\s*\|\|\s*r\.material_kind === ["']PLM["']/.test(mrp),
  "mrp-material-board.js retains PM/PLM compatibility handling",
);

// ── 9. Forbidden vs allowed PLM in repaired modules ──────────────────────────
function hasForbiddenCategoryPlm(src) {
  return (
    /\.eq\(\s*["'](?:category_)?code["']\s*,\s*["']PLM["']\s*\)/.test(src) ||
    /category_code\s*===\s*["']PLM["']/.test(src) ||
    /plm:\s*["']PLM["']/.test(src)
  );
}

assert(!hasForbiddenCategoryPlm(bom), "BOM: no Class A category PLM");
assert(!hasForbiddenCategoryPlm(labEntry), "Lab entry: no Class A category PLM");
assert(!hasForbiddenCategoryPlm(labProto), "Lab protocol: no Class A category PLM");
assert(!hasForbiddenCategoryPlm(labSpec), "Lab spec: no Class A category PLM");
assert(!hasForbiddenCategoryPlm(explorer), "Explorer: no Class A category PLM");

// ── 10. RM unchanged in representative touched modules ───────────────────────
assert(
  /category_code\s*===\s*["']RM["']/.test(labEntry),
  "Lab entry RM filter unchanged",
);
assert(
  /\.eq\(\s*["']category_code["']\s*,\s*["']RM["']\s*\)/.test(labProto),
  "Lab protocol RM filter unchanged",
);
assert(
  /rm:\s*["']RM["']/.test(explorer),
  "Explorer source_kind rm → category RM unchanged",
);
assert(
  /consumable:\s*["']IND["']/.test(explorer) && /fuel:\s*["']IND["']/.test(explorer),
  "Explorer IND mappings for consumable/fuel unchanged",
);

if (fails.length) {
  console.error("pm-category-code-client-smoke FAILED:");
  fails.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("pm-category-code-client-smoke passed");
