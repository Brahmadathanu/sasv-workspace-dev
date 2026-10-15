#!/usr/bin/env node
// Re-verifies the audit's quoted figures. Read-only.
// Mode A (live): DATABASE_URL set (read-only role recommended) -> runs queries/*.sql via psql.
// Mode B (offline): --results <dir> with <query>.json files saved from any read-only SQL runner (e.g. Supabase MCP execute_sql).
// Prints quoted vs observed and exits 1 on any mismatch.
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const here = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2); const ri = args.indexOf("--results");
const resultsDir = ri >= 0 ? path.resolve(args[ri + 1]) : null;
const expected = JSON.parse(fs.readFileSync(path.join(here, "expected.json"), "utf8"));
const get = (o, k) => k.split(".").reduce((a, p) => (a == null ? a : a[p]), o);
let fail = 0, total = 0;
for (const q of Object.keys(expected)) {
  let obs;
  if (resultsDir) obs = JSON.parse(fs.readFileSync(path.join(resultsDir, q + ".json"), "utf8"));
  else {
    if (!process.env.DATABASE_URL) { console.error("Set DATABASE_URL or pass --results <dir>"); process.exit(2); }
    const sql = fs.readFileSync(path.join(here, "queries", q + ".sql"), "utf8");
    const out = execFileSync("psql", [process.env.DATABASE_URL, "-X", "-At", "-v", "ON_ERROR_STOP=1",
      "-c", "set default_transaction_read_only = on;", "-c", sql], { encoding: "utf8" });
    obs = JSON.parse(out.trim().split("\n").pop());
  }
  console.log(`\n== ${q}`);
  for (const [k, [want, label]] of Object.entries(expected[q])) {
    total++; const got = get(obs, k);
    const ok = typeof want === "number" ? Math.abs(Number(got) - want) <= Math.max(0.005, Math.abs(want) * 1e-9) : String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? "OK  " : "DIFF"} ${label.padEnd(42)} quoted=${want}  observed=${got}`);
  }
}
console.log(`\n${total - fail}/${total} quoted figures reproduced${fail ? `, ${fail} differ` : ""}.`);
process.exit(fail ? 1 : 0);
