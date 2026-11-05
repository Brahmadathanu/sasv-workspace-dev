/**
 * PRM Cost Centres signed-in view-only regression.
 * Static contract tests; no live RPC, production data mutation, browser login or privileged JWT.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
const cc = read("public/shared/js/costing-suite-production-route-cost-centres.js");
const shell = read("public/shared/js/costing-suite-production-route.js");
const rpc = read("public/shared/js/costing-suite-production-route-rpc.js");

const ccConstructor = cc.match(/export function createProductionCostCentresController\(deps = \{\}\) \{([\s\S]*?)\n  const state =/);
assert.ok(ccConstructor, "Cost Centres controller constructor found");
assert.match(ccConstructor[1], /\b\binvoke,\s*governed,\s*showToast,/, "read and write gateways injected");
const shellWiring = shell.match(/costCentres = createProductionCostCentresController\(\{([\s\S]*?)\n  \}\);/);
assert.ok(shellWiring, "production controller supplies Cost Centres dependencies");
assert.match(shellWiring[1], /\binvoke,\s*governed,\s*showToast,/, "caller passes unprivileged read gateway as well as write gate");

const load = cc.match(/async function load\(\{ search = getSearch\(\) \} = \{\}\) \{([\s\S]*?)\n  \}\n\n  async function refreshCostCentresAfterMutation/);
assert.ok(load, "Cost Centre read-list function found");
assert.match(load[1], /await invoke\(\s*RPC\.list,/, "list uses read-capable invoke");
assert.doesNotMatch(load[1], /await governed\(\s*RPC\.list,/, "list cannot use edit gate");
const detail = cc.match(/async function openDetail\(row, \{ replace = false \} = \{\}\) \{([\s\S]*?)\n  \}\n\n  /);
assert.ok(detail, "Cost Centre detail function found");
assert.match(detail[1], /await invoke\(\s*RPC\.detail,/, "detail uses read-capable invoke");
assert.doesNotMatch(detail[1], /await governed\(\s*RPC\.detail,/, "detail cannot use edit gate");
assert.match(detail[1], /const editOk = canEdit\(\);/, "detail action rendering still uses edit permission");

for (const name of ["create","update","validate","approve","inactivate"]) {
  assert.match(cc, new RegExp("await governed\\(\\s*RPC\\." + name + ","),
    name + " mutation continues to use edit gate");
}
assert.match(shell, /async function governed\(name, built, fallback\) \{\s*if \(!canEdit\(\)\)/,
  "governed remains edit gated");
assert.match(shell, /async function invoke\(name, built, fallback\) \{/, "read gateway remains defined");
assert.match(rpc, /rpc_get_production_cost_centres:\s*Object\.freeze/, "Cost Centre read RPC in strict allowlist");
assert.match(rpc, /rpc_get_production_cost_centre_detail:\s*Object\.freeze/, "detail RPC in strict allowlist");
console.log("PASS: PRM Cost Centres list/detail read gateway; five mutations remain edit gated; LF/CRLF neutral");
