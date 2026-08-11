#!/usr/bin/env node
/**
 * SA-2 discovery helper — read-only scan of client .from("table") usage.
 * Does not modify application code.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

const PRIORITY = new Set([
  "products","product_skus","product_groups","product_group_kinds","categories","sub_categories","sub_groups",
  "sections","subsections","areas","machine_types","plant_machinery","godowns","regions",
  "bmr_details","batch_plan_headers","batch_plan_lines","batch_plan_batches","production_batch_overrides",
  "production_batch_overrides_staging","production_qty_overrides",
  "inv_stock_item","inv_stock_item_alias","inv_stock_item_class_map","inv_class_category","inv_class_subcategory",
  "inv_class_group","inv_class_subgroup","inv_uom","inv_uom_conversion","inv_uom_dimension","inv_rm_form_conversion",
  "rm_bom_header","rm_bom_line","sp_bom_header","sp_bom_line","plm_tpl_header","plm_tpl_line","plm_pack_format",
  "plm_pack_format_line","plm_sku_pack_map","plm_sku_plm_override",
  "mrp_rm_plan_monthly","mrp_rm_plan_detail","mrp_rm_plan_month_runs","mrp_plm_fill_plan_monthly",
  "mrp_rm_issue_lines","mrp_plm_issue_lines","manual_plan_sets","manual_plan_lines",
  "forecast_run","forecast_model_run","sku_forecast_monthly_base","sku_forecast_monthly_llt",
  "sku_forecast_monthly_seasonal","product_llt_upload","product_season_override","season_profile",
  "season_profile_month","season_profile_weight",
  "fg_bulk_stock_ledger","fg_bulk_internal_transfer","sku_stock_snapshot",
  "tally_sales_vreg_snapshot","tally_rm_stock_snapshot","tally_plm_stock_snapshot","tally_purchases_vreg_snapshot",
  "tally_purchase_orders_snapshot","tally_expenses_snapshot","tally_fg_transfer_voucher_lines",
  "etl_config","etl_health_log","etl_presets","import_log",
  "sop_master","sop_revisions","sop_sections","sop_approvals","sop_approval_roles","sop_attachments",
  "sop_events","sop_series","sop_series_counters","sop_review_policies","sop_review_reminders",
  "app_modules","app_module_clients","app_nav_sections","modules","profiles","user_staff_map",
  "user_permissions_canonical_backup_20260126",
]);

const SKIP_DIR = new Set(["node_modules","vendor",".git",".temp","docs","agent-transcripts"]);

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html|ts|tsx)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const FROM_RE = /\.from\(\s*(['"`])([^'"`]+)\1\s*\)/g;
const CHAIN_OPS = /\.(select|insert|update|upsert|delete)\s*\(/gi;

function detectOps(src, fromIndex) {
  // Look ahead ~400 chars for chain methods; also check same statement context
  const window = src.slice(fromIndex, fromIndex + 500);
  const ops = new Set();
  let m;
  const re = /\.(select|insert|update|upsert|delete)\s*\(/gi;
  while ((m = re.exec(window)) !== null) {
    // stop if another .from( appears before this op at a much later point — keep simple
    ops.add(m[1].toUpperCase());
  }
  // also look back for assignment patterns like: let q = supabase.from("x"); ... q.insert
  return [...ops];
}

function lookAheadOps(src, fromIndex) {
  // Find end of statement or next .from
  const slice = src.slice(fromIndex, fromIndex + 800);
  const nextFrom = slice.search(/\.from\s*\(/);
  const window = nextFrom > 0 ? slice.slice(0, nextFrom) : slice;
  const ops = new Set();
  let m;
  const re = /\.(select|insert|update|upsert|delete)\s*\(/gi;
  while ((m = re.exec(window)) !== null) ops.add(m[1].toUpperCase());
  // multiline: variable assigned then used
  return [...ops];
}

const files = walk(ROOT);
const hits = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  // skip scripts smoke tests unless they show runtime patterns — include active app paths
  if (rel.startsWith("scripts/") && rel.includes("smoke")) continue;
  if (rel.startsWith("public/vendor/")) continue;
  let src;
  try { src = fs.readFileSync(file, "utf8"); } catch { continue; }
  let m;
  FROM_RE.lastIndex = 0;
  while ((m = FROM_RE.exec(src)) !== null) {
    const name = m[2];
    const before = src.slice(Math.max(0, m.index - 40), m.index);
    const isStorage = /\.storage\s*$/.test(before.trimEnd()) || /storage\s*\.\s*$/.test(before);
    if (isStorage) continue;
    // skip Array.from / Buffer.from — those don't match .from('quote') after word boundary issue
    // our pattern is .from( so Array.from( wouldn't have quote immediately... Array.from(x) has no quotes
    const ops = lookAheadOps(src, m.index);
    const line = src.slice(0, m.index).split(/\n/).length;
    // extract nearby function name
    const beforeAll = src.slice(0, m.index);
    const fnMatch = beforeAll.match(/(?:async\s+function|function)\s+([A-Za-z0-9_$]+)\s*\(/g);
    const arrowMatch = beforeAll.match(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/g);
    let fn = null;
    if (fnMatch) fn = fnMatch[fnMatch.length - 1].replace(/^.*?([A-Za-z0-9_$]+)\s*\($/, "$1");
    else if (arrowMatch) {
      const last = arrowMatch[arrowMatch.length - 1];
      fn = last.match(/(?:const|let|var)\s+([A-Za-z0-9_$]+)/)?.[1] || null;
    }
    hits.push({
      file: rel,
      line,
      name,
      ops: ops.length ? ops : ["UNKNOWN"],
      fn: fn || "(module/top)",
      priority: PRIORITY.has(name),
      likelyView: name.startsWith("v_") || name.startsWith("mv_"),
    });
  }
}

// Aggregate by table
const byTable = new Map();
for (const h of hits) {
  if (!byTable.has(h.name)) byTable.set(h.name, []);
  byTable.get(h.name).push(h);
}

const tables = [...byTable.keys()].sort();
const priorityHit = [...PRIORITY].filter((t) => byTable.has(t)).sort();
const priorityMiss = [...PRIORITY].filter((t) => !byTable.has(t)).sort();

const writeOps = new Set(["INSERT", "UPDATE", "UPSERT", "DELETE"]);
const writeTables = [];
const selectOnly = [];
for (const t of tables) {
  const allOps = new Set(byTable.get(t).flatMap((h) => h.ops));
  const hasWrite = [...allOps].some((o) => writeOps.has(o));
  const hasSelect = allOps.has("SELECT");
  if (hasWrite) writeTables.push({ table: t, ops: [...allOps].sort(), hits: byTable.get(t).length });
  else if (hasSelect || allOps.has("UNKNOWN")) selectOnly.push({ table: t, ops: [...allOps].sort(), hits: byTable.get(t).length });
}

const out = {
  root: ROOT,
  fileCount: files.length,
  hitCount: hits.length,
  uniqueNames: tables.length,
  priorityHit,
  priorityMiss,
  writeTables,
  selectOnlyLikely: selectOnly,
  byTable: Object.fromEntries(
    [...byTable.entries()].map(([k, v]) => [
      k,
      v.map((h) => ({ file: h.file, line: h.line, fn: h.fn, ops: h.ops, priority: h.priority, likelyView: h.likelyView })),
    ])
  ),
};

const outPath = path.join(ROOT, ".temp", "sa2-table-access-scan.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  hitCount: hits.length,
  uniqueNames: tables.length,
  priorityHitCount: priorityHit.length,
  priorityMissCount: priorityMiss.length,
  writeTableCount: writeTables.length,
  outPath,
  priorityMiss,
  writeTables: writeTables.map((w) => w.table),
}, null, 2));
