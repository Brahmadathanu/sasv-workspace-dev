#!/usr/bin/env node
// #282 benchmark harness. DRY_RUN is the default and nothing here can reach a remote database or carry a credential:
//   ingest <file.json>        analyse operator-collected genuine browser/edge timings (schema csr-timing-samples/v1). Read-only, offline.
//   fixture [--samples N]     time baseline vs candidate SQL on the throwaway LOCAL fixture cluster. Prints a plan unless --execute AND
//                             BENCH_CONFIRM=FIXTURE_ONLY_NOT_PRODUCTION are both given; N is bounded (<= 30). Output is fixture-class,
//                             warm only, and is NOT production evidence.
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { analyse, MAX_EXECUTE_SAMPLES, summarise, DEFAULT_OCT_TOLERANCE } from "./bench-stats.mjs";
import { buildFixture, HERE, rd, UID } from "./lib.mjs";

const [mode, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : d; };
const fail = (m, code = 2) => { console.error(m); process.exit(code); };

if (mode === "ingest") {
  const file = rest.find((a) => !a.startsWith("--"));
  if (!file) fail("usage: bench.mjs ingest <samples.json> [--variant candidate] [--oct-tolerance 0.05]");
  let report;
  try { report = analyse(JSON.parse(readFileSync(resolve(file), "utf8")), { variant: opt("--variant", "candidate"), octoberTolerance: Number(opt("--oct-tolerance", DEFAULT_OCT_TOLERANCE)) }); }
  catch (e) { fail(`rejected input: ${e.message}`); }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.timingGate === "HOLD" ? 1 : 0);
} else if (mode === "fixture") {
  const n = Number(opt("--samples", "10"));
  if (!Number.isInteger(n) || n < 1 || n > MAX_EXECUTE_SAMPLES) fail(`--samples must be an integer 1..${MAX_EXECUTE_SAMPLES}`);
  const baselineSql = resolve(opt("--baseline-sql", join(HERE, "sql/baseline-view-read.sql")));
  const candidateSql = resolve(opt("--candidate-sql", join(HERE, "sql/candidate-installed-rpc.sql")));
  const periods = ["2026-11-01", "2026-10-01", "2026-09-01"];
  const execute = rest.includes("--execute") && process.env.BENCH_CONFIRM === "FIXTURE_ONLY_NOT_PRODUCTION";
  if (!execute) {
    console.log(JSON.stringify({ DRY_RUN: true, wouldRun: { target: "throwaway local fixture PostgreSQL (unix socket only)", samplesPerCell: n, periods, variants: { baseline: baselineSql, candidate: candidateSql }, warmupDiscardedPerCell: 1 },
      toExecute: "add --execute and BENCH_CONFIRM=FIXTURE_ONLY_NOT_PRODUCTION", production: "never contacted by this harness" }, null, 2));
    process.exit(0);
  }
  const strip = (f) => rd(f).replace(/^\s*--.*$/gm, "").trim().replace(/;+\s*$/, "");
  const c = buildFixture();
  try {
    const samples = [];
    for (const [variant, file] of [["baseline", baselineSql], ["candidate", candidateSql]]) for (const period of periods) {
      const q = strip(file);
      for (let i = 0; i < n + 1; i++) {
        const out = c.must(`SET fixture.uid='${UID}'; SET fixture.perm='allow';\n\\o /dev/null\n\\timing on\n${q};\n`, { vars: { period, lim: "2000" } });
        const m = /Time:\s*([\d.]+)\s*ms/.exec(out);
        if (!m) throw new Error("could not read psql timing");
        if (i > 0) samples.push({ variant, period, temperature: "warm", duration: Number(m[1]), source: "fixture" });
      }
    }
    const byCell = {};
    for (const s of samples) (byCell[`${s.variant} ${s.period}`] ??= []).push(s.duration);
    console.log(JSON.stringify({ DRY_RUN: false, evidenceClass: "FIXTURE_NOT_PRODUCTION", temperature: "warm only", unit: "ms", cells: Object.fromEntries(Object.entries(byCell).map(([k, v]) => [k, summarise(v)])), note: "p95 is null below 20 samples per cell by design" }, null, 2));
  } finally { c.stop(); }
} else fail("usage: bench.mjs ingest <file> | bench.mjs fixture [--samples N] [--execute]");
