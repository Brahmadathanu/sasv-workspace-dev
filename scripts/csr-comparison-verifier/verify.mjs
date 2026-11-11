#!/usr/bin/env node
// #282 offline parity CLI. Usage:
//   node scripts/csr-comparison-verifier/verify.mjs [--baseline-sql FILE] [--candidate-sql FILE] [--periods 2026-11-01,2026-10-01,...] [--limit 2000]
// Both SQL files are single SELECTs using psql variables :'period' and :lim and must return the 63-column contract.
// Exit codes: 0 = every period passes bag parity + strict text parity + order + cap; 1 = parity/contract failure; 2 = DB unavailable or bad input (fail closed).
import { resolve } from "node:path";
import { buildFixture, compare, HERE } from "./lib.mjs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const baselineSql = resolve(opt("--baseline-sql", join(HERE, "sql/baseline-view-read.sql")));
const candidateSql = resolve(opt("--candidate-sql", join(HERE, "sql/candidate-installed-rpc.sql")));
const periods = opt("--periods", "2026-11-01,2026-10-01,2026-09-01,2026-01-01,2026-02-01,2026-03-01,2026-04-01,2026-05-01,2026-06-01,2026-07-01,2027-03-01,2024-01-01").split(",");
const lim = Number(opt("--limit", "2000"));
if (!Number.isInteger(lim) || lim < 1 || lim > 2000) { console.error("invalid --limit"); process.exit(2); }
for (const p of periods) if (!/^\d{4}-\d{2}-01$/.test(p)) { console.error(`invalid period ${p}`); process.exit(2); }

let cluster;
try { cluster = buildFixture(); } catch (e) { console.error(String(e.message || e)); process.exit(2); }
let failed = 0;
try {
  for (const period of periods) {
    let r;
    try { r = compare(cluster, { baselineSql, candidateSql, period, lim, tag: "cli" }); }
    catch (e) { r = { period, pass: false, error: String(e.message || e).split("\n")[0] }; }
    console.log(JSON.stringify(r));
    if (!r.pass) failed++;
  }
} finally { cluster.stop(); }
console.log(failed ? `VERIFIER FAIL: ${failed}/${periods.length} periods failed` : `VERIFIER OK: ${periods.length} periods passed (fixture-only; not a production result)`);
process.exit(failed ? 1 : 0);
