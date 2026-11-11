// #273 — pins the CLIENT read path of the Cost Comparison lens so the diagnosis stays checkable offline.
// Source-text contract only: no network, no DB. Establishes (from code) that the client issues exactly one
// un-retried select("*") per load, so the 500 / 200 pattern cannot be client-generated duplicates or retries.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const shell = readFileSync(join(root, "public/shared/js/costing-suite-shell.js"), "utf8").replace(/\r\n/g, "\n");

assert.match(shell, /"cost-comparison": "v_cost_sheet_snapshot_sku_monthly_comparison_governed"/, "lens maps to the governed public view");

const fnStart = shell.indexOf("async function loadRowsForLens(");
const fnEnd = shell.indexOf("function uniqueValues(", fnStart);
assert.ok(fnStart > 0 && fnEnd > fnStart, "loadRowsForLens located");
const fn = shell.slice(fnStart, fnEnd);

assert.match(fn, /costingFrom\(viewName\)\.select\("\*"\)/, "reads every column (63) of the view");
assert.match(fn, /CURRENT_LENS === "cost-comparison"\) \{\s*query = query\.eq\("snapshot_period_start", ACTIVE_PERIOD_START\)/, "single-period equality filter");
assert.match(fn, /\.order\("product_name", \{ ascending: true \}\)\s*\.order\("sku_column_label", \{ ascending: true \}\)/, "order product_name, sku_column_label");
assert.equal((fn.match(/\.limit\(2000\)/g) || []).length, 1, "one limit(2000)");
assert.equal((fn.match(/await query\.limit\(2000\)/g) || []).length, 1, "exactly one network read for the generic lens path");
assert.doesNotMatch(fn, /readWithPgStatementTimeoutRetry|57014|AbortController|\.abortSignal\(/, "no retry / abort wrapper on the generic read (contrast: printable summary has one)");
assert.match(fn, /isRowsLoadCurrent\(loadGeneration\)/, "stale generations are discarded after the response, not cancelled in flight");
console.log("PASS: Cost Comparison client read contract (single select(*) read, no retry/abort, period filter, order, limit 2000)");
