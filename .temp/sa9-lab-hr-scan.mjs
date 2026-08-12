#!/usr/bin/env node
/**
 * SA-9 discovery helper — read-only. Does not modify app or Supabase.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SKIP = new Set([
  "node_modules",
  "vendor",
  ".git",
  ".temp",
  "docs",
  "dist",
  "win-unpacked",
]);

const LAB_FILES_HINT = /lab-|coa-|control-sample|analysis-workspace|product-shelf-life|test-method|staff-directory|workflow-access/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html|ts)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (rel.startsWith("scripts/") && rel.includes("smoke")) return false;
  if (rel.includes("types/supabase")) return false;
  return true;
});

const fromHits = [];
const rpcHits = [];
const schemaHits = [];

const FROM_RE =
  /(labSupabase|hrSupabase|supabase)\s*(?:\n\s*)?(?:\.schema\(\s*['"](lab|hr)['"]\s*\))?\s*\.from\(\s*(['"`])([^'"`]+)\3\s*\)/g;
const FROM_DYN_RE =
  /(labSupabase|hrSupabase)\.from\(\s*([A-Za-z0-9_.]+)\s*\)/g;
const RPC_RE =
  /(labSupabase|hrSupabase|supabase)\s*(?:\n\s*)?(?:\.schema\(\s*['"](lab|hr)['"]\s*\))?\s*\.rpc\(\s*(['"`])([^'"`]+)\3/g;
const SCHEMA_FROM_RE =
  /\.schema\(\s*['"](lab|hr)['"]\s*\)\s*\.from\(\s*(['"`])([^'"`]+)\2\s*\)/g;

function opsAhead(src, idx) {
  const slice = src.slice(idx, idx + 900);
  const nextFrom = slice.search(/\.from\s*\(/);
  const window = nextFrom > 20 ? slice.slice(0, nextFrom) : slice;
  const ops = new Set();
  let m;
  const re = /\.(select|insert|update|upsert|delete)\s*\(/gi;
  while ((m = re.exec(window))) ops.add(m[1].toUpperCase());
  return [...ops];
}

function fnNear(src, idx) {
  const before = src.slice(0, idx);
  const fnMatch = before.match(
    /(?:async\s+function|function)\s+([A-Za-z0-9_$]+)\s*\(/g,
  );
  if (fnMatch) {
    return fnMatch[fnMatch.length - 1].replace(
      /^.*?([A-Za-z0-9_$]+)\s*\($/,
      "$1",
    );
  }
  const arrow = before.match(
    /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/g,
  );
  if (arrow) {
    return arrow[arrow.length - 1].match(/(?:const|let|var)\s+([A-Za-z0-9_$]+)/)?.[1];
  }
  return "(module/top)";
}

function lineOf(src, idx) {
  return src.slice(0, idx).split(/\n/).length;
}

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  let src;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const usesLabHr =
    /labSupabase|hrSupabase|schema\(\s*['"]lab['"]|schema\(\s*['"]hr['"]/.test(
      src,
    );
  if (!usesLabHr && !LAB_FILES_HINT.test(rel)) continue;

  let m;
  FROM_RE.lastIndex = 0;
  const srcNoNl = src; // keep original for line numbers
  while ((m = FROM_RE.exec(srcNoNl))) {
    const client = m[1];
    const schemaArg = m[2] || (client === "labSupabase" ? "lab" : client === "hrSupabase" ? "hr" : "public");
    if (client === "supabase" && !m[2]) continue; // public default — skip unless schema()
    const name = m[4];
    fromHits.push({
      file: rel,
      line: lineOf(src, m.index),
      fn: fnNear(src, m.index),
      client,
      schema: schemaArg,
      name,
      ops: opsAhead(src, m.index),
      dynamic: false,
    });
  }

  SCHEMA_FROM_RE.lastIndex = 0;
  while ((m = SCHEMA_FROM_RE.exec(src))) {
    fromHits.push({
      file: rel,
      line: lineOf(src, m.index),
      fn: fnNear(src, m.index),
      client: "schema()",
      schema: m[1],
      name: m[3],
      ops: opsAhead(src, m.index),
      dynamic: false,
    });
  }

  FROM_DYN_RE.lastIndex = 0;
  while ((m = FROM_DYN_RE.exec(src))) {
    fromHits.push({
      file: rel,
      line: lineOf(src, m.index),
      fn: fnNear(src, m.index),
      client: m[1],
      schema: m[1] === "labSupabase" ? "lab" : "hr",
      name: `DYNAMIC(${m[2]})`,
      ops: opsAhead(src, m.index),
      dynamic: true,
    });
  }

  RPC_RE.lastIndex = 0;
  while ((m = RPC_RE.exec(src))) {
    const client = m[1];
    const schemaArg = m[2] || (client === "labSupabase" ? "lab" : client === "hrSupabase" ? "hr" : "public");
    if (client === "supabase" && !m[2]) continue;
    rpcHits.push({
      file: rel,
      line: lineOf(src, m.index),
      fn: fnNear(src, m.index),
      client,
      schema: schemaArg,
      name: m[4],
    });
  }

  // Also catch labSupabase.rpc(rpcName variable
  const dynRpc = /(labSupabase|hrSupabase)\.rpc\(\s*([A-Za-z0-9_]+)\s*[,)]/g;
  while ((m = dynRpc.exec(src))) {
    rpcHits.push({
      file: rel,
      line: lineOf(src, m.index),
      fn: fnNear(src, m.index),
      client: m[1],
      schema: m[1] === "labSupabase" ? "lab" : "hr",
      name: `DYNAMIC(${m[2]})`,
    });
  }
}

// String literals of special tables/views even without .from immediately
const SPECIAL = [
  "staff","staff_category","staff_status","unit",
  "analysis_record","analysis_status_history","analysis_result","analysis_result_observation",
  "analysis_result_calculation_summary","analysis_reference_exception","analysis_register_counter",
  "coa_counter","coa_issue","coa_issue_line","control_register","control_sample","outsourced_report",
  "product_shelf_life","protocol_category","protocol_category_inv_group_map","protocol_category_product_group_map",
  "protocol_category_test","protocol_subject_map","reference_source_master","rm_lot_counter",
  "spec_line","spec_override","spec_override_audit","spec_profile","spec_profile_inv_group_map",
  "staff_role","staff_role_action_map","staff_role_map","system_config","test_master","test_method",
  "workflow_action_master","protocol_category_pm_subcategory_map",
  "v_current_user_staff_context","v_analysis_header","v_analysis_pending_scrutiny","v_analysis_ready_for_coa",
  "v_analysis_result_entry","v_analysis_result_observation","v_analysis_result_calculation_summary",
  "v_outsourced_report","v_coa_print_header","v_coa_print_lines","v_coa_print_lines_issued",
  "v_coa_issue_line_detail","v_coa_register","v_coa_register_versions","v_coa_render_header",
  "v_coa_render_lines","v_coa_full_render","v_coa_form50_header","v_coa_form50_lines","v_coa_signatory_picker",
  "v_control_register_active","v_control_register_master","v_control_sample_register",
  "v_control_sample_pending_collection","v_control_sample_ready_for_removal","v_control_sample_exempted",
  "v_control_sample_sku_option","v_sample_receipt_fg_batch_picker","v_sample_receipt_fg_picker",
  "v_sample_receipt_rm_picker","v_sample_receipt_staff_picker","v_spec_profile_detail",
  "v_spec_override_register","v_spec_lifecycle_history","v_spec_change_request_history",
  "v_pending_spec_change_requests","v_spec_change_request_review_queue","v_spec_change_request_review_counts",
  "v_protocol_subject_map","v_protocol_usage_preview","v_test_with_default_method",
  "v_rm_pm_item_with_group","v_fg_product_with_group","v_staff_compensation_monthly_manager",
];

const specialRefs = {};
for (const name of SPECIAL) specialRefs[name] = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("scripts/")) continue;
  let src;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!/labSupabase|hrSupabase|schema\(\s*['"]lab|schema\(\s*['"]hr/.test(src) && !LAB_FILES_HINT.test(rel))
    continue;
  for (const name of SPECIAL) {
    const re = new RegExp(`['"\`]${name}['"\`]`, "g");
    let m;
    while ((m = re.exec(src))) {
      specialRefs[name].push({ file: rel, line: lineOf(src, m.index) });
    }
  }
}

function agg(hits, key = "name") {
  const m = new Map();
  for (const h of hits) {
    const k = h.schema + "." + h[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(h);
  }
  return Object.fromEntries([...m.entries()].sort());
}

const out = {
  fromHits,
  rpcHits,
  byRelation: agg(fromHits),
  byRpc: agg(rpcHits),
  uniqueRelations: [...new Set(fromHits.filter((h) => !h.dynamic).map((h) => h.schema + "." + h.name))].sort(),
  uniqueRpcs: [...new Set(rpcHits.filter((h) => !h.name.startsWith("DYNAMIC")).map((h) => h.schema + "." + h.name))].sort(),
  dynamicFrom: fromHits.filter((h) => h.dynamic),
  dynamicRpc: rpcHits.filter((h) => h.name.startsWith("DYNAMIC")),
  specialRefs: Object.fromEntries(
    Object.entries(specialRefs).map(([k, v]) => [k, { count: v.length, files: [...new Set(v.map((x) => x.file))], hits: v.slice(0, 12) }]),
  ),
};

fs.writeFileSync(".temp/sa9-lab-hr-scan.json", JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      fromHitCount: fromHits.length,
      rpcHitCount: rpcHits.length,
      uniqueRelations: out.uniqueRelations,
      uniqueRpcs: out.uniqueRpcs,
      dynamicFrom: out.dynamicFrom,
      dynamicRpcNames: [...new Set(out.dynamicRpc.map((d) => d.file + ":" + d.name))],
    },
    null,
    2,
  ),
);
