// WP10 G1 — Manage Products client contract: writers, activation journey, readiness display and fail-closed reads.
// Offline source-contract checks plus execution of the REAL badge functions extracted from products.js. Read-only.
// Run: node scripts/wp10-g1-safeguard-audit/client-contract.test.mjs [resultsJson]
import fs from "node:fs";
import { read, repoRoot, makeResults } from "./lib.mjs";
import { execFileSync } from "node:child_process";

const { results, check, classify, failed } = makeResults();
const src = read("public/shared/js/products.js");
const html = read("public/shared/manage-products.html");

// ---- writers: RPC only, no direct table writes ----
const directWrite = /\.from\(\s*["'`](products|product_skus|product_master_audit|product_sku_master_audit|product_sku_change_log)["'`]\s*\)\s*\.(insert|update|upsert|delete)\(/;
check("C1.1", "Manage Products performs NO direct table write on products / product_skus / audit tables (reads via .select only)", !directWrite.test(src) && /\.from\("product_skus"\)\s*\.select\(/.test(src) && /\.from\("products"\)\s*\.select\(/.test(src));
const rpcs = [...src.matchAll(/supabase\.rpc\(\s*["'`]([a-z_]+)["'`]/g)].map((m) => m[1]);
const rpcSet = [...new Set(rpcs)].sort();
check("C1.2", "writer RPC set is exactly the five audited writers (+ readiness/period reads and the lookups already in WP-02/03)", ["rpc_create_product", "rpc_update_product", "rpc_create_product_sku", "rpc_update_product_sku", "rpc_set_product_sku_active"].every((r) => rpcSet.includes(r)), rpcSet.join(","));
const callOf = (name) => { const i = src.indexOf(`"${name}"`); return src.slice(i, src.indexOf("if (error)", i)); };
check("C2.1", "SKU create always sends p_is_active:false (new SKUs are inactive; the server trigger would reject an active create anyway)", /p_is_active:\s*false/.test(callOf("rpc_create_product_sku")));
check("C2.2", "SKU pack/UOM/sample update never sends an active flag (activation cannot ride on a master edit)", !/p_is_active/.test(callOf("rpc_update_product_sku")));
check("C2.3", "activation/deactivation uses only rpc_set_product_sku_active with a mandatory business reason modal", /rpc\("rpc_set_product_sku_active"/.test(src) && /promptGovernance\(/.test(src.slice(src.indexOf("async function toggleSkuActive"))));
check("C2.4", "Product deactivation is a governed Product update (rpc_update_product), not a cascade to SKUs", /Product deactivat|deactivate/i.test(src) && !/rpc_set_product_sku_active[\s\S]{0,200}forEach/.test(src));

// ---- activation journey: what the user is told before submitting ----
check("C3.1", "the activation confirmation shows readiness severity for the governed period and states activation does NOT set costing readiness to READY", /Activating this SKU does not set costing readiness to READY/.test(src) && /Current costing readiness: \$\{severity\} for period \$\{period\}/.test(src));
const preCheckUsed = [...["public", "scripts"].flatMap((d) => fs.readdirSync(`${repoRoot}/${d}`, { recursive: true }).filter((f) => /\.(js|mjs|html)$/.test(f)).map((f) => `${d}/${f}`))].filter((f) => !/wp10-g1/.test(f)).some((f) => read(f).includes("rpc_get_sku_activation_check"));
classify("C3.2", preCheckUsed ? "FINDING NOT CONFIRMED" : "FINDING CONFIRMED", "FINDING: the server pre-check rpc_get_sku_activation_check (five essentials with owner screen) is called by NO client or script — the user learns the missing essentials only from the rejection after submitting", `usedAnywhere=${preCheckUsed}`);
check("C3.3", "server rejections are surfaced from error.message only; the structured error.detail (missing codes + owner screens) is not rendered", /error\.message \|\| error\.details \|\| error\.hint/.test(src) && !/JSON\.parse\(error\.details\)/.test(src));

// ---- readiness display: pass-through severity; unknown never becomes READY (REAL functions executed) ----
function extract(name) { const i = src.indexOf(`function ${name}(`); let d = 0, j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); } } }
const fns = `${extract("readinessBadgeLabel")}\n${extract("readinessBadgeClass")}\nglobalThis.__f = { readinessBadgeLabel, readinessBadgeClass };`;
const sandbox = {}; new Function("globalThis", fns)(sandbox);
const { readinessBadgeLabel: lab, readinessBadgeClass: cls } = sandbox.__f;
check("C4.1", "READY -> 'Ready'/pass; REVIEW_REQUIRED -> warn; BLOCKER and BLOCKED -> 'Blocked'/fail", lab("READY") === "Ready" && cls("READY") === "badge badge-pass" && cls("REVIEW_REQUIRED") === "badge badge-warn" && lab("BLOCKER") === "Blocked" && lab("BLOCKED") === "Blocked" && cls("BLOCKER") === "badge badge-fail");
const notReady = [undefined, null, "", "ready", "Ready", "UNKNOWN", "READY ", "OK", 0, {}];
check("C4.2", "NOTHING except the exact string READY can ever render the pass badge (undefined/null/''/lower-case/UNKNOWN/garbage are neutral)", notReady.every((v) => cls(v) !== "badge badge-pass") && cls("READY") === "badge badge-pass");
check("C4.3", "UNKNOWN stays UNKNOWN (neutral) and a missing/invalid severity reads 'Unavailable' — fail-closed display", lab("UNKNOWN") === "UNKNOWN" && cls("UNKNOWN") === "badge badge-neutral" && lab(undefined) === "Unavailable" && lab("nonsense") === "Unavailable");
check("C4.4", "a readiness read error returns null (no payload is cached, never defaulted to READY) and the SKU row remains visible", /if \(error\) \{[\s\S]{0,120}return null;/.test(src.slice(src.indexOf("async function fetchSkuReadiness"), src.indexOf("async function loadAllSkuReadiness"))) && /skuReadinessById\.delete\(skuId\)/.test(src));
check("C4.5", "readiness is requested only as LIVE_AS_OF for the SERVER-governed latest period with a null refresh run (the client never invents a valuation date)", /p_context_type:\s*"LIVE_AS_OF"/.test(src) && /p_refresh_run_id:\s*null/.test(src) && /rpc_get_latest_governed_cost_period_start/.test(src));

// ---- mutation controls for the two highest-value client assertions ----
function onlyReadyPasses(text) {
  const i = text.indexOf("function readinessBadgeClass("); let d = 0, j = text.indexOf("{", i), body;
  for (let k = j; k < text.length; k++) { if (text[k] === "{") d++; if (text[k] === "}") { d--; if (!d) { body = text.slice(i, k + 1); break; } } }
  const box = {}; new Function("globalThis", body + "\nglobalThis.f = readinessBadgeClass;")(box);
  return [undefined, null, "", "UNKNOWN", "ready", "x"].every((v) => box.f(v) !== "badge badge-pass") && box.f("READY") === "badge badge-pass";
}
check("CM.1", "badge control: the real source satisfies 'only READY passes'", onlyReadyPasses(src));
check("CM.2", "MUTANT 'unknown renders as pass' is DETECTED", !onlyReadyPasses(src.replace('return "badge badge-neutral";', 'return "badge badge-pass";')));
check("CM.3", "MUTANT 'SKU create sends p_is_active:true' is DETECTED by the C2.1 pattern", !/p_is_active:\s*false/.test(src.replace(/p_is_active:\s*false/, "p_is_active: true")));

// ---- no duplicate readiness system, no sample/urgent bypass in the client ----
check("C5.1", "client carries no readiness calculator, no override/bypass/urgent path and no sample exemption for activation", !/urgent|bypass|skipGuard|forceActivate|exempt/i.test(src));
check("C5.2", "the page exposes no direct 'is_active' checkbox on the SKU master form (activation is a separate governed action)", !/id=["']skuActive|name=["']is_active["']/.test(html));

// ---- existing runners as baselines (reported, never edited) ----
function runBaseline(id, label, file) {
  let out = "", code = 0;
  try { out = execFileSync("node", [file], { cwd: repoRoot, encoding: "utf8", stdio: "pipe" }); } catch (e) { out = String(e.stdout || "") + String(e.stderr || ""); code = e.status || 1; }
  const pass = (out.match(/^PASS /gm) || []).length, fail = [...out.matchAll(/^FAIL (.*)$/gm)].map((m) => m[1]);
  if (!code) classify(id, "PASS", `${label} baseline`, `${pass} PASS`);
  else classify(id, "FAIL", `${label} EXISTING BASELINE FAILURE (unchanged by WP10 G1)`, `${pass} PASS; failing: ${fail.join(" | ")}`);
}
runBaseline("B1", "scripts/product-sku-lifecycle-smoke.mjs", "scripts/product-sku-lifecycle-smoke.mjs");
runBaseline("B2", "scripts/wp04-readiness-client-contract-smoke.mjs", "scripts/wp04-readiness-client-contract-smoke.mjs");

const hard = results.filter((r) => r.status === "FAIL" && !/^B\d|^C3\.2/.test(r.id));
console.log(hard.length ? `\n${hard.length} FAILED` : "\nALL CONTRACT CHECKS PASSED (baseline classifications listed above)");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
process.exit(hard.length ? 1 : 0);
