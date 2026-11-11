// #282 benchmark harness tests: pure statistics + safety rails. No DB needed except the DRY_RUN/execute CLI checks (which fail closed too).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { percentile, summarise, normaliseSamples, analyse, MAX_EXECUTE_SAMPLES } from "./bench-stats.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const cli = (a, env = {}) => spawnSync("node", [join(HERE, "bench.mjs"), ...a], { encoding: "utf8", env: { ...process.env, ...env } });
const mk = (variant, period, temperature, vals) => vals.map((duration) => ({ variant, period, temperature, duration, source: "browser-devtools" }));
const doc = (samples, unit = "ms") => ({ schema: "csr-timing-samples/v1", unit, environment: "test", samples });

test("nearest-rank percentiles: p50/p95 of 1..20 and the n<20 refusal", () => {
  const a = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(percentile(a, 50), 10); assert.equal(percentile(a, 95), 19); assert.equal(percentile(a, 100), 20);
  assert.equal(summarise(a).p95, 19);
  const few = summarise([1, 2, 3, 4, 5]);
  assert.equal(few.p95, null); assert.equal(few.p95Valid, false); assert.equal(few.p50, 3);
});

test("unit is mandatory and never guessed (the 5.75 'seconds?' ambiguity); seconds are converted to ms", () => {
  assert.throws(() => normaliseSamples({ schema: "csr-timing-samples/v1", samples: mk("candidate", "2026-11-01", "warm", [5.75]) }), /unit is required/);
  assert.equal(normaliseSamples(doc(mk("candidate", "2026-11-01", "warm", [5.75]), "s"))[0].ms, 5750);
});

test("input validation: periods, temperature, positive durations, strict keys, sample cap", () => {
  const bad = (s, re) => assert.throws(() => normaliseSamples(doc([s])), re);
  const ok = { variant: "candidate", period: "2026-11-01", temperature: "warm", duration: 1 };
  bad({ ...ok, period: "2026-11-15" }, /period/); bad({ ...ok, temperature: "hot" }, /temperature/); bad({ ...ok, duration: 0 }, /duration/);
  bad({ ...ok, duration: "3" }, /duration/); bad({ ...ok, variant: "x" }, /variant/); bad({ ...ok, rows: 5 }, /unexpected key/);
  assert.throws(() => normaliseSamples({ ...doc([ok]), extra: 1 }), /unexpected top-level/);
  assert.throws(() => normaliseSamples(doc(Array.from({ length: 1001 }, () => ok))), /too many/);
});

test("sensitive data is rejected: JWT-like values and token/cookie/email/authorization keys never get analysed", () => {
  const ok = { variant: "candidate", period: "2026-11-01", temperature: "warm", duration: 1 };
  assert.throws(() => normaliseSamples(doc([{ ...ok, source: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig" }])), /JWT-like/);
  assert.throws(() => normaliseSamples({ ...doc([ok]), environment: undefined, authorization: "Bearer x" }), /sensitive/);
  assert.throws(() => normaliseSamples({ ...doc([ok]), email: "a@b.c" }), /sensitive/);
});

test("gate logic: HOLD without enough samples; cold/warm separate; never emits PASS; Oct non-regression needs both variants", () => {
  const cand = [];
  for (const p of ["2026-11-01", "2026-10-01", "2026-09-01"]) for (const t of ["cold", "warm"]) cand.push(...mk("candidate", p, t, Array.from({ length: 20 }, (_, i) => 1000 + i * 10)));
  let r = analyse(doc(cand));
  assert.equal(r.timingGate, "HOLD"); assert.ok(r.blockers.some((b) => /October non-regression/.test(b)), "no baseline => unproven");
  const base = [];
  for (const t of ["cold", "warm"]) base.push(...mk("baseline", "2026-10-01", t, Array.from({ length: 20 }, (_, i) => 3500 + i * 10)));
  r = analyse(doc([...cand, ...base]));
  assert.equal(r.timingGate, "CANDIDATE_FOR_OWNER_REVIEW"); assert.notEqual(r.timingGate, "PASS");
  assert.deepEqual(r.groups.filter((g) => g.variant === "candidate").map((g) => g.temperature).sort().slice(0, 2), ["cold", "cold"]);
  // 5 samples only => p95 not computed
  r = analyse(doc(mk("candidate", "2026-11-01", "warm", [1, 2, 3, 4, 5])));
  assert.equal(r.groups[0].status, "INSUFFICIENT_SAMPLES"); assert.equal(r.groups[0].p95, null);
  // over target
  const slow = cand.map((s) => (s.period === "2026-11-01" && s.temperature === "warm" ? { ...s, duration: 5750 } : s));
  r = analyse(doc([...slow, ...base]));
  assert.equal(r.timingGate, "HOLD"); assert.ok(r.blockers.some((b) => /2026-11-01 warm: TARGET_NOT_MET/.test(b)));
  // October regression: candidate slower than baseline beyond tolerance
  const octBad = [...cand.filter((s) => s.period !== "2026-10-01"), ...mk("candidate", "2026-10-01", "cold", Array(20).fill(3900)), ...mk("candidate", "2026-10-01", "warm", Array(20).fill(3900)), ...mk("baseline", "2026-10-01", "cold", Array(20).fill(3000)), ...mk("baseline", "2026-10-01", "warm", Array(20).fill(3000))];
  r = analyse(doc(octBad));
  assert.equal(r.octoberNonRegression[0].status, "REGRESSION");
});

test("the real owner observation (Nov 5.75 / Oct 4.08 / Sep 4.37, assumed seconds, n=1 each) stays HOLD with no p95", () => {
  const s = [["2026-11-01", 5.75], ["2026-10-01", 4.08], ["2026-09-01", 4.37]].map(([period, duration]) => ({ variant: "baseline", period, temperature: "warm", duration, source: "browser-devtools" }));
  const r = analyse(doc(s, "s"), { variant: "baseline" });
  assert.equal(r.timingGate, "HOLD"); assert.ok(r.groups.every((g) => g.p95 === null && g.status === "INSUFFICIENT_SAMPLES"));
});

test("safety rails: fixture mode is DRY_RUN by default, bounded, and needs two deliberate opt-ins; source has no network client or credential input", () => {
  let r = cli(["fixture"]);
  assert.equal(r.status, 0); const plan = JSON.parse(r.stdout);
  assert.equal(plan.DRY_RUN, true); assert.match(plan.production, /never contacted/);
  r = cli(["fixture", "--execute"]); assert.equal(JSON.parse(r.stdout).DRY_RUN, true, "--execute alone is not enough");
  r = cli(["fixture", "--samples", String(MAX_EXECUTE_SAMPLES + 1)]); assert.equal(r.status, 2);
  r = cli(["fixture", "--samples", "0"]); assert.equal(r.status, 2);
  const src = ["bench.mjs", "bench-stats.mjs", "lib.mjs", "verify.mjs"].map((f) => readFileSync(join(HERE, f), "utf8").replace(/^\s*\/\/.*$/gm, "")).join("\n"); // comments may name Supabase to say it is NOT contacted
  assert.doesNotMatch(src, /\bfetch\s*\(|https?:\/\/[a-z]|node:https?|node:net["']|supabase\.co|SUPABASE_|createClient|process\.env\.[A-Z_]*(KEY|TOKEN|JWT|PASSWORD)/i);
});

test("ingest CLI: exit 1 (HOLD) for insufficient samples, 2 for rejected input", () => {
  const d = mkdtempSync(join(tmpdir(), "bench-"));
  const f = join(d, "s.json"); writeFileSync(f, JSON.stringify(doc(mk("candidate", "2026-11-01", "warm", [1, 2, 3]))));
  let r = cli(["ingest", f]); assert.equal(r.status, 1); assert.equal(JSON.parse(r.stdout).timingGate, "HOLD");
  writeFileSync(f, JSON.stringify({ schema: "csr-timing-samples/v1", samples: [] })); r = cli(["ingest", f]); assert.equal(r.status, 2);
});

test("fixture --execute (double opt-in, tiny sample) runs only against the local throwaway cluster and labels output non-production", () => {
  const r = cli(["fixture", "--execute", "--samples", "2"], { BENCH_CONFIRM: "FIXTURE_ONLY_NOT_PRODUCTION" });
  assert.equal(r.status, 0, r.stderr); const o = JSON.parse(r.stdout);
  assert.equal(o.evidenceClass, "FIXTURE_NOT_PRODUCTION"); assert.equal(o.cells["candidate 2026-10-01"].n, 2); assert.equal(o.cells["candidate 2026-10-01"].p95, null);
});
