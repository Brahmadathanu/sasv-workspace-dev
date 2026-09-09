/**
 * Visible PLM→PM terminology smoke.
 * Asserts user-facing labels/copy say PM while internal plm channels stay intact.
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

const bomHtml = read("manage-pm-bom.html");
const bomJs = read("js/manage-pm-bom.js");
const rebuildHtml = read("public/shared/pm-rebuild-dashboard.html");
const rebuildJs = read("public/shared/js/pm-rebuild-dashboard.js");
const speHtml = read("public/shared/stock-purchase-explorer.html");
const speJs = read("public/shared/js/stock-purchase-explorer.js");
const tallyHtml = read("manage-tally-inv-mapping.html");
const tallyJs = read("js/manage-tally-inv-mapping.js");
const opsHtml = read("public/shared/operations-control.html");

// ── Manage PM BOM ────────────────────────────────────────────────────────────
assert(
  /aria-label="Manage PM BOM Tabs"/.test(bomHtml),
  "manage-pm-bom.html tablist aria uses Manage PM BOM Tabs",
);
assert(
  /aria-label="Select Stock Item \(PM\)"/.test(bomHtml),
  "manage-pm-bom.html combobox aria uses Stock Item (PM)",
);
assert(
  /a PM template/.test(bomHtml),
  "manage-pm-bom.html helper mentions a PM template",
);
assert(
  !/Manage PLM BOM Tabs|Select Stock Item \(PLM\)|a PLM template/.test(bomHtml),
  "manage-pm-bom.html has no user-facing PLM aria/helper strings",
);
assert(
  /"Stock Item \(PM\)"/.test(bomJs) && /Stock Item \(PM\)/.test(bomJs),
  "manage-pm-bom.js export/PDF labels use Stock Item (PM)",
);
assert(
  !/"Stock Item \(PLM\)"|Stock Item \(PLM\)/.test(bomJs),
  "manage-pm-bom.js has no Stock Item (PLM) labels",
);
assert(
  /PM Template/.test(bomJs) && !/PLM Template/.test(bomJs),
  "manage-pm-bom.js export titles use PM Template",
);
assert(
  /pm-template_/.test(bomJs) && !/plm-template_/.test(bomJs),
  "manage-pm-bom.js download filenames use pm-template_",
);

// ── PM Rebuild Dashboard ─────────────────────────────────────────────────────
assert(
  /id="plmFilter"/.test(rebuildHtml),
  "pm-rebuild-dashboard.html keeps id=plmFilter",
);
assert(
  /<label for="plmFilter">PM<\/label>/.test(rebuildHtml),
  "pm-rebuild-dashboard.html label text is PM",
);
assert(
  /aria-label="PM item filter"/.test(rebuildHtml),
  "pm-rebuild-dashboard.html aria uses PM item filter",
);
assert(
  /-- All PM items --/.test(rebuildHtml) &&
    /Search PM or top consumer products/.test(rebuildHtml) &&
    />PM Item</.test(rebuildHtml),
  "pm-rebuild-dashboard.html filter/table copy uses PM",
);
assert(
  !/>PLM<|>PLM Item<|All PLM items|Search PLM/.test(rebuildHtml),
  "pm-rebuild-dashboard.html has no visible PLM filter/table copy",
);
assert(
  /-- All PM items --/.test(rebuildJs) &&
    /Search PM items/.test(rebuildJs) &&
    /All PM items/.test(rebuildJs) &&
    /rebuild PM allocations/.test(rebuildJs),
  "pm-rebuild-dashboard.js user strings use PM",
);
assert(
  !/-- All PLM items --|Search PLM items|All PLM items|rebuild PLM allocations|Failed to load PLM overview|PLM overview view not found/.test(
    rebuildJs,
  ),
  "pm-rebuild-dashboard.js has no user-facing PLM toasts/options",
);
assert(
  /v_mrp_plm_|mrp_plm_rebuild_|PLM_OVERVIEW_VIEW_CANDIDATES|getPlmLabel|#plmFilter|plmFilter/.test(
    rebuildJs,
  ),
  "pm-rebuild-dashboard.js keeps internal plm_* contracts/ids",
);

// ── Stock Purchase Explorer ──────────────────────────────────────────────────
assert(
  /<option value="plm">PM<\/option>/.test(speHtml),
  "stock-purchase-explorer.html option value=plm displays PM",
);
assert(
  !/<option value="plm">PLM<\/option>/.test(speHtml),
  "stock-purchase-explorer.html option label is not PLM",
);
assert(
  /RM\/PM Issues/.test(speJs) && /`RM\/PM /.test(speJs),
  "stock-purchase-explorer.js visible RM/PM Issues copy",
);
assert(
  !/RM\/PLM/.test(speJs),
  "stock-purchase-explorer.js has no RM/PLM visible copy",
);
assert(
  /plm:\s*["']PM["']/.test(speJs),
  "stock-purchase-explorer.js keeps mapSourceKindToCategoryCode plm→PM",
);

// ── Tally Inv Mapping ────────────────────────────────────────────────────────
assert(
  /<option value="plm">PM<\/option>/.test(tallyHtml),
  "manage-tally-inv-mapping.html option value=plm displays PM",
);
assert(
  /function formatSourceKindLabel\s*\(/.test(tallyJs),
  "manage-tally-inv-mapping.js defines formatSourceKindLabel",
);
assert(
  /k === ["']plm["']\s*\)\s*return ["']PM["']/.test(tallyJs) ||
    /=== ["']plm["'][\s\S]{0,40}return ["']PM["']/.test(tallyJs),
  "formatSourceKindLabel maps plm → PM",
);
assert(
  /formatSourceKindLabel\(c\.source_kind\)/.test(tallyJs) &&
    /formatSourceKindLabel\(row\.source_kind\)/.test(tallyJs) &&
    /formatSourceKindLabel\(src\)/.test(tallyJs),
  "coverage title, table cell, and detail chip use formatSourceKindLabel",
);
assert(
  /preferred\s*=\s*\[[\s\S]*["']plm["']/.test(tallyJs),
  "manage-tally-inv-mapping.js keeps preferred order including plm",
);
assert(
  /source-\$\{safe\}|source-\$\{safeSrc\}/.test(tallyJs),
  "manage-tally-inv-mapping.js keeps source-* CSS class wiring",
);

// ── Operations Control ───────────────────────────────────────────────────────
assert(
  /optgroup label="RM \/ PM \/ Fuel \/ Consumables"/.test(opsHtml),
  "operations-control.html optgroup uses RM / PM",
);
assert(
  /<option value="plm_stock">PM Stock Snapshot<\/option>/.test(opsHtml),
  "operations-control.html keeps value=plm_stock with PM label",
);
assert(
  !/RM \/ PLM|PLM Stock Snapshot/.test(opsHtml),
  "operations-control.html has no visible PLM optgroup/label",
);

if (fails.length) {
  console.error("pm-visible-terminology-smoke FAILED:");
  for (const f of fails) console.error(" -", f);
  process.exit(1);
}
console.log("pm-visible-terminology-smoke OK");
