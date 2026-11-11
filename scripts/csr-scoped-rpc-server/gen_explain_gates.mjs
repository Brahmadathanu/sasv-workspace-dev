// Prints plain-EXPLAIN (NO ANALYZE) statements for the original public view and the scoped function body with literals
// substituted, for Sep/Oct/Nov 2026. Output is meant for a READ-ONLY gate session; this script runs no SQL.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sql = readFileSync(join(root, "docs/master-data-costing/prepared/PREPARED_20261111_csr_scoped_comparison_rpc.sql"), "utf8").replace(/\r\n/g, "\n");
const m = sql.match(/\bRETURN QUERY\s*\n([\s\S]*?);\s*\nEND;\s*\n\$csr\$;/);
if (!m) throw new Error("function body not found");
const periods = process.argv.slice(2).length ? process.argv.slice(2) : ["2026-09-01", "2026-10-01", "2026-11-01"];
for (const p of periods) {
  if (!/^\d{4}-\d{2}-01$/.test(p)) throw new Error(`period must be first of month: ${p}`);
  const body = m[1].replace(/\bp_period_start\b/g, `DATE '${p}'`).replace(/\bp_limit\b/g, "2000");
  console.log(`-- ${p}: ORIGINAL public view (client shape)\nEXPLAIN (FORMAT JSON, COSTS TRUE)\nSELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start = DATE '${p}' ORDER BY product_name, sku_column_label LIMIT 2000;\n`);
  console.log(`-- ${p}: SCOPED function body (literals substituted; function itself is not installed)\nEXPLAIN (FORMAT JSON, COSTS TRUE)\n${body};\n`);
}
