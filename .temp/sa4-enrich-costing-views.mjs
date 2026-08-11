#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", "vendor", ".git", ".temp", "docs"]);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const types = fs.readFileSync("public/shared/js/types/supabase.ts", "utf8");
const viewsStart = types.indexOf("    Views: {");
const functionsStart = types.indexOf("    Functions: {");
const viewsBlock = types.slice(viewsStart, functionsStart);
const VIEW_NAMES = new Set();
let m;
const nameRe = /^\s{6}([a-zA-Z0-9_]+):\s*\{/gm;
while ((m = nameRe.exec(viewsBlock))) VIEW_NAMES.add(m[1]);

const scan = JSON.parse(fs.readFileSync(".temp/sa4-view-access-scan.json", "utf8"));
const active = new Set(scan.activeViews);

// Catch helper wrappers: costingFrom("x"), supabase.from(viewName) with prior assignment
const helperRe =
  /(?:costingFrom|labSupabase\.from|supabase\.from)\(\s*(['"`])([^'"`]+)\1\s*\)/g;
const assignViewRe =
  /(?:const|let|var)\s+\w+\s*=\s*(['"`])(v_[^'"`]+|mv_[^'"`]+|bmr_card_not_initiated|bottled_stock_on_hand|fg_bulk_stock)\1/g;
const mapEntryRe =
  /['"`]([^'"`]+)['"`]\s*:\s*['"`]((?:v_|mv_)[^'"`]+)['"`]/g;

const extra = new Map(); // name -> [{file,line,via}]
function add(name, file, line, via) {
  if (!VIEW_NAMES.has(name) && !name.startsWith("v_") && !name.startsWith("mv_")) return;
  if (!extra.has(name)) extra.set(name, []);
  extra.get(name).push({ file, line, via });
  active.add(name);
}

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("scripts/")) continue;
  const src = fs.readFileSync(file, "utf8");
  let mm;
  helperRe.lastIndex = 0;
  while ((mm = helperRe.exec(src))) {
    const line = src.slice(0, mm.index).split(/\n/).length;
    add(mm[2], rel, line, "helper");
  }
  assignViewRe.lastIndex = 0;
  while ((mm = assignViewRe.exec(src))) {
    const line = src.slice(0, mm.index).split(/\n/).length;
    add(mm[2], rel, line, "const");
  }
  // VIEW_BY_LENS and similar maps
  if (/VIEW_BY_LENS|costingFrom|VIEW_/.test(src)) {
    mapEntryRe.lastIndex = 0;
    while ((mm = mapEntryRe.exec(src))) {
      const line = src.slice(0, mm.index).split(/\n/).length;
      add(mm[2], rel, line, "map");
    }
  }
  // Strings passed as first arg patterns like "v_foo" near costingFrom variable
  const strViews = src.matchAll(/['"`]((?:v_|mv_)[a-z0-9_]+)['"`]/g);
  for (const sm of strViews) {
    const name = sm[1];
    if (!VIEW_NAMES.has(name)) continue;
    // Only if file also calls costingFrom or .from(variable)
    if (!/costingFrom|\.from\(\s*\w+\s*\)/.test(src)) continue;
    if (active.has(name) && scan.byView[name]) continue;
    const line = src.slice(0, sm.index).split(/\n/).length;
    // Heuristic: same file has costingFrom usage
    if (/costingFrom\s*\(/.test(src) || /function costingFrom/.test(src)) {
      add(name, rel, line, "string-in-costing-file");
    }
  }
}

const wave1 = [
  "v_costing_material_manual_rate_review",
  "v_costing_policy_manager_scheme_options",
  "v_costing_pricing_control_dashboard_snapshot",
  "v_costing_pricing_control_integrity_audit_snapshot",
  "v_costing_pricing_material_action_drilldown_snapshot",
  "v_costing_pricing_material_action_queue_snapshot",
  "v_costing_pricing_review_action_item_drilldown_snapshot",
  "v_costing_pricing_review_top_action_items_snapshot",
  "v_costing_pricing_review_workbench_summary_snapshot",
  "v_costing_pricing_sku_control_status_snapshot",
  "v_costing_pricing_sku_detailed_cost_sheet",
  "v_costing_pricing_sku_scheme_comparison",
  "v_costing_scheme_master_register",
  "v_proc_vendor_item_rate_effective",
  "v_product_mrp_adjustment_evidence",
  "v_product_mrp_derivation_current",
  "v_product_mrp_derivation_history",
  "v_product_mrp_proposal_lines",
  "v_product_mrp_proposal_register",
  "v_product_mrp_reference_readiness",
  "v_sku_mrp_effective",
  "v_sku_mrp_policy_history",
];

const out = {
  activeCount: active.size,
  activeViews: [...active].sort(),
  extraOnly: [...active].filter((v) => !scan.activeViews.includes(v)).sort(),
  wave1Status: Object.fromEntries(
    wave1.map((v) => [
      v,
      {
        active: active.has(v),
        hits: (extra.get(v) || []).slice(0, 8),
        inLiteralScan: !!scan.byView[v],
      },
    ]),
  ),
  costingViews: [...active].filter((v) => v.startsWith("v_costing_")).sort(),
  typedZero: [...VIEW_NAMES].filter((v) => !active.has(v)).sort(),
};
fs.writeFileSync(".temp/sa4-view-access-enriched.json", JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      activeCount: out.activeCount,
      extraOnlyCount: out.extraOnly.length,
      costingViewCount: out.costingViews.length,
      wave1Active: wave1.filter((v) => active.has(v)),
      wave1Inactive: wave1.filter((v) => !active.has(v)),
      sampleExtra: out.extraOnly.slice(0, 40),
    },
    null,
    2,
  ),
);
