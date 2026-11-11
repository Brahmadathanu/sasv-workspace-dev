#!/usr/bin/env node
// Staging acceptance runner for the scoped Cost Comparison RPC (#273). NOT RUN by this PR. Owner-operated, staging only.
// Reads credentials ONLY from the environment; writes a report with no tokens and no row contents (digests only).
//   STAGING_URL STAGING_ANON_KEY TOKEN_IDV [TOKEN_IDN TOKEN_IDX TOKEN_EDITONLY] STAGING_CONFIRM=I-CONFIRM-THIS-IS-STAGING-NOT-PRODUCTION
//   [PERF_ROUNDS=8] [PERF_GAP_MS=2000] [REPORT=staging-report.json]
// Requests: GET the governed view and POST the scoped RPC only (enforced). Aborts on the first HTTP 5xx.
import { writeFileSync } from "node:fs";
import { assertStagingTarget, makeClient, PERIODS, compareBags, evaluateAuthorization, summarisePerf, THRESHOLDS, VIEW, RPC, expectedColumns } from "./lib.mjs";

const COMPARISON_COLUMNS = expectedColumns();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runAcceptance(env, { fetchImpl = fetch, sleepImpl = sleep } = {}) {
  const { base } = assertStagingTarget(env);
  const c = makeClient({ base, anonKey: env.STAGING_ANON_KEY, fetchImpl });
  const report = { startedAt: new Date().toISOString(), target: new URL(base).host.replace(/^[^.]+/, "<ref>"), view: VIEW, rpc: RPC, steps: {}, verdict: null };
  const abortOn5xx = (r, where) => { if (r.status >= 500) { report.aborted = `HTTP ${r.status} at ${where}`; throw Object.assign(new Error(report.aborted), { report }); } };
  try {
    // 1. real-role authorization (RPC). Real JWTs minted by the owner for staging identities.
    const auth = {};
    for (const [k, t] of [["anon", null], ["idv", env.TOKEN_IDV], ["idn", env.TOKEN_IDN], ["idx", env.TOKEN_IDX], ["edit", env.TOKEN_EDITONLY]]) {
      if (k !== "anon" && !t) continue;
      auth[k] = await c.rpc(PERIODS.nov, t); abortOn5xx(auth[k], `authorization ${k}`); // abort on the FIRST 5xx
    }
    report.steps.authorization = evaluateAuthorization(auth);

    // 2. 63-column parity on real data, ID-V, four periods (bag equality + order + columns)
    report.steps.parity = {};
    for (const [name, period] of Object.entries(PERIODS)) {
      const v = await c.view(period, env.TOKEN_IDV); abortOn5xx(v, `view ${name}`);
      const r = await c.rpc(period, env.TOKEN_IDV); abortOn5xx(r, `rpc ${name}`);
      report.steps.parity[name] = (v.status === 200 && r.status === 200)
        ? { period, ...compareBags(v.json, r.json, COMPARISON_COLUMNS), truncatedAt2000: r.json.length >= 2000 }
        : { period, error: `view ${v.status} / rpc ${r.status}`, bagEqual: false };
    }

    // 3. performance: interleaved view/RPC per period, ID-V, bounded. The first sample after an idle period is the cold sample.
    const rounds = Number(env.PERF_ROUNDS || 8), gap = Number(env.PERF_GAP_MS || 2000);
    if (!(rounds >= 1 && rounds <= 15)) throw new Error("PERF_ROUNDS must be 1..15 (staging protection)");
    report.steps.performance = {};
    for (const [name, period] of Object.entries(PERIODS).filter(([n]) => n !== "absent")) {
      const sv = [], sr = [];
      for (let i = 0; i < rounds; i++) {
        const v = await c.view(period, env.TOKEN_IDV); abortOn5xx(v, `perf view ${name}`); sv.push(v);
        await sleepImpl(gap);
        const r = await c.rpc(period, env.TOKEN_IDV); abortOn5xx(r, `perf rpc ${name}`); sr.push(r);
        await sleepImpl(gap);
      }
      const view = summarisePerf(sv), rpc = summarisePerf(sr);
      report.steps.performance[name] = { view, rpc, rpcNotWorseThanView: rpc.p95 !== null && view.p95 !== null ? rpc.p95 <= view.p95 : null, rpcWithinBudget: rpc.p95 !== null && rpc.p95 <= THRESHOLDS.rpcP95Ms && rpc.failures <= THRESHOLDS.maxFailures };
    }
  } catch (e) { if (!e.report) throw e; }
  const A = report.steps.authorization || [], P = report.steps.parity || {}, F = report.steps.performance || {};
  report.checks = {
    authorizationAllOk: A.length > 0 && A.every((x) => x.ok),
    parityAllBagEqual: Object.keys(P).length === 4 && Object.values(P).every((x) => x.bagEqual && (x.sameOrder ?? true) && (x.sameColumns ?? true) && (x.missingColumns ?? []).length === 0),
    performanceWithinProposedBudget: Object.keys(F).length === 3 && Object.values(F).every((x) => x.rpcWithinBudget),
    performanceOctNotWorseThanView: F.oct ? F.oct.rpcNotWorseThanView === true : false,
  };
  report.verdict = !report.aborted && Object.values(report.checks).every(Boolean) ? "PASS (staging only; not a production approval)" : "FAIL or incomplete: do not apply to production";
  report.requests = c.log.length;
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAcceptance(process.env).then((r) => {
    writeFileSync(process.env.REPORT || "staging-report.json", JSON.stringify(r, null, 2));
    console.log(JSON.stringify({ verdict: r.verdict, checks: r.checks, requests: r.requests, aborted: r.aborted }, null, 2));
    process.exit(r.verdict.startsWith("PASS") ? 0 : 1);
  }).catch((e) => { console.error(e.message); process.exit(2); });
}
