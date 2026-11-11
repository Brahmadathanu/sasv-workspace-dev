// Staging acceptance helpers for the scoped Cost Comparison RPC (#273). Pure functions: no I/O except the injected fetch.
// This package is NOT run by CI and never targets production: see assertStagingTarget().
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION_PROJECT_REF = "qhmoqtxpeasamtlxaoak"; // production Supabase project: refusing it is the point
export const CONFIRM_PHRASE = "I-CONFIRM-THIS-IS-STAGING-NOT-PRODUCTION";
export const VIEW = "v_cost_sheet_snapshot_sku_monthly_comparison_governed";
export const RPC = "rpc_get_cost_sheet_sku_monthly_comparison_scoped";
export const LIMIT = 2000;
export const PERIODS = { sep: "2026-09-01", oct: "2026-10-01", nov: "2026-11-01", absent: "2025-11-01" };

/** Refuse anything that is not an explicit, confirmed, non-production target. Throws with a reason. */
export function assertStagingTarget(env) {
  const url = String(env.STAGING_URL || "");
  if (!url) throw new Error("STAGING_URL is required");
  let u; try { u = new URL(url); } catch { throw new Error("STAGING_URL is not a valid URL"); }
  const local = u.hostname === "127.0.0.1" || u.hostname === "localhost";
  if (u.protocol !== "https:" && !local) throw new Error("STAGING_URL must be https (or loopback for a local stack)");
  if (url.toLowerCase().includes(PRODUCTION_PROJECT_REF)) throw new Error("REFUSED: STAGING_URL contains the production project ref");
  if (env.STAGING_CONFIRM !== CONFIRM_PHRASE) throw new Error(`REFUSED: set STAGING_CONFIRM=${CONFIRM_PHRASE} after confirming the target is not production`);
  for (const k of ["STAGING_ANON_KEY", "TOKEN_IDV"]) if (!env[k]) throw new Error(`${k} is required`);
  for (const k of ["STAGING_ANON_KEY", "TOKEN_IDV", "TOKEN_IDN", "TOKEN_IDX", "TOKEN_EDITONLY"]) {
    if (env[k] && String(env[k]).includes(PRODUCTION_PROJECT_REF)) throw new Error(`REFUSED: ${k} appears to be issued for the production project`);
    // JWTs carry the project ref in their payload ("ref" or "iss"); decode without verifying, only to refuse
    const p = String(env[k] || "").split(".")[1];
    if (p) { try { const j = Buffer.from(p, "base64url").toString("utf8"); if (j.includes(PRODUCTION_PROJECT_REF)) throw new Error(`REFUSED: ${k} payload names the production project`); } catch (e) { if (/REFUSED/.test(e.message)) throw e; } }
  }
  return { base: url.replace(/\/+$/, ""), local };
}

/** Only the two read operations this package needs; anything else throws before any network call. */
export function makeClient({ base, anonKey, fetchImpl = fetch, log = [] }) {
  const allowed = (method, path) =>
    (method === "GET" && path.startsWith(`/rest/v1/${VIEW}?`)) || (method === "POST" && path === `/rest/v1/rpc/${RPC}`);
  async function call(method, path, token, body) {
    if (!allowed(method, path)) throw new Error(`REFUSED request outside the allowlist: ${method} ${path}`);
    const headers = { apikey: anonKey, authorization: `Bearer ${token || anonKey}`, "content-type": "application/json" };
    const t0 = performance.now();
    const res = await fetchImpl(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const ms = performance.now() - t0;
    let json = null; try { json = await res.json(); } catch { /* non-JSON */ }
    log.push({ method, path: path.split("?")[0], status: res.status, ms: Math.round(ms) });
    return { status: res.status, ms, json };
  }
  return {
    log,
    view: (period, token) => call("GET", `/rest/v1/${VIEW}?select=*&snapshot_period_start=eq.${period}&order=product_name.asc,sku_column_label.asc&limit=${LIMIT}`, token),
    rpc: (period, token) => call("POST", `/rest/v1/rpc/${RPC}`, token, { p_period_start: period, p_limit: LIMIT }),
  };
}

const canon = (v) => (v && typeof v === "object" ? (Array.isArray(v) ? v.map(canon) : Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))) : v);
export const rowKey = (r) => JSON.stringify(canon(r));
export const digest = (rows) => createHash("sha256").update(rows.map(rowKey).join("\n")).digest("hex");

/** Multiset (bag) comparison: counts duplicates; also compares column sets and order. */
export function compareBags(viewRows, rpcRows, expectedColumns) {
  const bag = (rows) => rows.reduce((m, r) => m.set(rowKey(r), (m.get(rowKey(r)) || 0) + 1), new Map());
  const a = bag(viewRows), b = bag(rpcRows);
  let onlyView = 0, onlyRpc = 0;
  for (const [k, n] of a) onlyView += Math.max(0, n - (b.get(k) || 0));
  for (const [k, n] of b) onlyRpc += Math.max(0, n - (a.get(k) || 0));
  const cols = (rows) => (rows.length ? Object.keys(rows[0]).sort().join(",") : "");
  const missingCols = rows => (rows.length && expectedColumns ? expectedColumns.filter((c) => !(c in rows[0])) : []);
  const sameOrder = viewRows.length === rpcRows.length && viewRows.every((r, i) => rowKey(r) === rowKey(rpcRows[i]));
  return {
    viewCount: viewRows.length, rpcCount: rpcRows.length, onlyView, onlyRpc,
    sameColumns: cols(viewRows) === cols(rpcRows), missingColumns: missingCols(rpcRows), sameOrder,
    bagEqual: onlyView === 0 && onlyRpc === 0 && viewRows.length === rpcRows.length,
    viewDigest: digest(viewRows), rpcDigest: digest(rpcRows),
  };
}

export function percentile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return Math.round(s[i]);
}

/** Authorization expectations for the RPC. Returns [{identity, ok, detail}] */
export function evaluateAuthorization(results) {
  const out = [];
  const denied = (r) => r && r.status >= 400 && !(Array.isArray(r.json) && r.json.length > 0);
  const noRows = (r) => !r || !(Array.isArray(r.json) && r.json.length > 0);
  out.push({ identity: "anon key only (no user JWT)", ok: denied(results.anon), detail: `rpc status ${results.anon?.status}` });
  if (results.idn) out.push({ identity: "ID-N signed-in, no costing permission", ok: denied(results.idn) && noRows(results.idn), detail: `rpc status ${results.idn.status}` });
  if (results.idx) out.push({ identity: "ID-X other-module permission only", ok: denied(results.idx) && noRows(results.idx), detail: `rpc status ${results.idx.status}` });
  if (results.edit) out.push({ identity: "edit flag without view", ok: denied(results.edit) && noRows(results.edit), detail: `rpc status ${results.edit.status}` });
  out.push({ identity: "ID-V view-only", ok: results.idv?.status === 200 && Array.isArray(results.idv.json) && results.idv.json.length > 0, detail: `rpc status ${results.idv?.status}, rows ${results.idv?.json?.length}` });
  return out;
}

export const THRESHOLDS = { rpcP95Ms: 4000, maxFailures: 0 }; // PROPOSED, owner to confirm: half of the 8 s role budget, zero 5xx

export function summarisePerf(samples) {
  const ms = samples.filter((s) => s.status === 200).map((s) => s.ms);
  return { n: samples.length, ok: ms.length, failures: samples.length - ms.length, p50: percentile(ms, 50), p95: percentile(ms, 95), max: ms.length ? Math.round(Math.max(...ms)) : null, first: samples[0] ? Math.round(samples[0].ms) : null };
}

/** The 63 public view columns, parsed from the W1 migration (independent of the client PR). */
export function expectedColumns() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const m = readFileSync(join(root, "supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql"), "utf8").replace(/\r\n/g, "\n");
  const a = m.indexOf("create or replace view public.v_cost_sheet_snapshot_sku_monthly_comparison_governed as");
  const body = m.slice(a, m.indexOf(" from costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed", a));
  const cols = body.slice(body.indexOf("select") + 6).replace(/\n/g, " ").split(",").map((c) => c.trim()).filter(Boolean);
  if (cols.length !== 63) throw new Error(`expected 63 columns in the W1 public view, parsed ${cols.length}`);
  return cols;
}
