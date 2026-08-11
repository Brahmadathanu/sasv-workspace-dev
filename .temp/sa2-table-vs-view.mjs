#!/usr/bin/env node
import fs from "fs";

const types = fs.readFileSync("public/shared/js/types/supabase.ts", "utf8");
const tablesStart = types.indexOf("    Tables: {");
const viewsStart = types.indexOf("    Views: {");
const functionsStart = types.indexOf("    Functions: {");
const tablesBlock = types.slice(tablesStart, viewsStart);
const viewsBlock = types.slice(viewsStart, functionsStart);

const nameRe = /^\s{6}([a-zA-Z0-9_]+):\s*\{/gm;
function names(block) {
  const out = new Set();
  let m;
  while ((m = nameRe.exec(block))) out.add(m[1]);
  return out;
}
const tableNames = names(tablesBlock);
const viewNames = names(viewsBlock);

const scan = JSON.parse(fs.readFileSync(".temp/sa2-table-access-scan.json", "utf8"));
const clientNames = Object.keys(scan.byTable).filter(
  (n) => !n.startsWith("v_") && !n.startsWith("mv_"),
);

const confirmedTables = [];
const confirmedViews = [];
const unknown = [];
for (const n of clientNames.sort()) {
  if (tableNames.has(n)) confirmedTables.push(n);
  else if (viewNames.has(n)) confirmedViews.push(n);
  else unknown.push(n);
}

const dyn = ["sku_forecast_monthly_llt", "sku_forecast_monthly_seasonal"];
for (const n of dyn) {
  if (tableNames.has(n)) confirmedTables.push(n + " (dynamic)");
  else if (viewNames.has(n)) confirmedViews.push(n + " (dynamic)");
  else unknown.push(n + " (dynamic)");
}

console.log(
  JSON.stringify(
    {
      confirmedTables,
      confirmedViewsMisclassifiedAsTables: confirmedViews,
      unknownNotInPublicTypes: unknown,
      publicTableCountInTypes: tableNames.size,
    },
    null,
    2,
  ),
);
