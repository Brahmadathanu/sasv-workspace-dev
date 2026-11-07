// MANUAL probe (not a test): per-call latency of each outcome class in the isolated database, to size the timing side channel (D8).
// Usage: node scripts/cde2-sql-candidate/timing-probe.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPgBin, startCluster } from "./pg-isolated.mjs";
import { realGovernedViewsSql } from "./real-ddl.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "docs/master-data-costing/cde2-sql-candidate");
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const bin = findPgBin(); if (!bin) { console.log("no PostgreSQL"); process.exit(0); }
const c = startCluster(bin); c.createDb("t");
for (const f of [read(path.join(dir, "test/00_stub_schema.sql")), realGovernedViewsSql(root), read(path.join(dir, "test/01_fixtures.sql")),
  read(path.join(dir, "rpc_get_costing_draft_component_evidence_v1.candidate.sql")).replace("v_d3_decided boolean := false;", "v_d3_decided boolean := true;")]) c.run("t", f);
const V = "00000000-0000-4000-8000-000000000001", N = "00000000-0000-4000-8000-000000000003", FN = "public.rpc_get_costing_draft_component_evidence_v1";
const cases = [["ok (full record)", V, "'2026-10-01', 148, 41"], ["missing run", V, "'2026-10-01', 999999, 41"], ["approved run 143", V, "'2026-10-01', 143, 41"], ["historical 80 (out of scope)", V, "'2026-07-01', 80, 41"],
  ["missing SKU", V, "'2026-10-01', 148, 999999"], ["malformed (null)", V, "null, 148, 41"], ["no permission", N, "'2026-10-01', 148, 41"]];
const N_CALLS = 400, rows = [];
for (const [label, uid, args] of cases) {
  const out = c.run("t", `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);
    do $$ declare t0 timestamptz; i int; begin perform ${FN}(${args}); t0 := clock_timestamp(); for i in 1..${N_CALLS} loop perform ${FN}(${args}); end loop;
    raise notice 'AVG_US %', round(extract(epoch from (clock_timestamp() - t0)) * 1e6 / ${N_CALLS}); end $$;`, { allowError: true });
  rows.push([label, /AVG_US (\d+)/.exec(out.err)?.[1] ?? "?"]);
}
console.log("outcome class".padEnd(32) + "avg microseconds per call (" + N_CALLS + " calls, warm, isolated PG16, local socket)");
for (const [l, v] of rows) console.log(l.padEnd(32) + v);
c.stop();
