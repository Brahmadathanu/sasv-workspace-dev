// MDC-07 / N2 — Material Cost and Cost Build navigation refinement: pure/source tests (no browser).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadController } from "./load-controller.mjs";
import { COSTING_NAV_GROUP_CONTRACT } from "../../public/shared/js/costing-nav-groups.js";
import { stripN2CostBuild, stripN2MaterialCost } from "../lib/n2-nav-strip.mjs";

const { MCM_NAV_SCOPE_NOTES, MCM_TRACE_NAV_LENS_IDS, renderMaterialCostNavScopeHtml, resolveTraceNavVisibility } = await loadController("costing-suite-material-cost.js");
const { CBM_NAV_SCOPE_NOTES, renderCostBuildNavScopeHtml } = await loadController("costing-suite-cost-build.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const JS = "public/shared/js";
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const N1_HEAD = "85a163f2bc36476953939bfb637b81f632d6b9b9";
const base = (rel) => execFileSync("git", ["show", `${N1_HEAD}:${rel}`], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
const ON = { navGroupsEnabled: true };

test("trace nav visibility: flag OFF shows everything, whatever the permissions", () => {
  for (const perms of [{}, { permissionsResolved: true, canViewRm: false, canViewPm: false }, { permissionsResolved: false }]) {
    assert.deepEqual(resolveTraceNavVisibility({ navGroupsEnabled: false, ...perms }), { "rm-cost-trace": true, "pm-cost-trace": true, tracesGroup: true });
  }
  assert.equal(resolveTraceNavVisibility({ navGroupsEnabled: "1" })["rm-cost-trace"], true, "only boolean true enables the filter (OFF parity)");
});

test("trace nav visibility: fail closed unless the view permission is exactly true and resolved; RM and PM are independent", () => {
  const v = (o) => resolveTraceNavVisibility({ ...ON, currentLens: "manual-rate-manager", ...o });
  assert.deepEqual(v({ permissionsResolved: false, canViewRm: true, canViewPm: true }), { "rm-cost-trace": false, "pm-cost-trace": false, tracesGroup: false });
  assert.deepEqual(v({ permissionsResolved: true, canViewRm: false, canViewPm: false }), { "rm-cost-trace": false, "pm-cost-trace": false, tracesGroup: false });
  assert.deepEqual(v({ permissionsResolved: true, canViewRm: true, canViewPm: false }), { "rm-cost-trace": true, "pm-cost-trace": false, tracesGroup: true });
  assert.deepEqual(v({ permissionsResolved: true, canViewRm: false, canViewPm: true }), { "rm-cost-trace": false, "pm-cost-trace": true, tracesGroup: true });
  assert.deepEqual(v({ permissionsResolved: true, canViewRm: true, canViewPm: true }), { "rm-cost-trace": true, "pm-cost-trace": true, tracesGroup: true });
  for (const truthy of ["true", 1, {}, "1"]) {
    assert.equal(v({ permissionsResolved: true, canViewRm: truthy, canViewPm: truthy })["rm-cost-trace"], false, `non-boolean ${JSON.stringify(truthy)} grants nothing`);
    assert.equal(v({ permissionsResolved: "yes", canViewRm: true })["rm-cost-trace"], false);
  }
});

test("trace nav visibility: the lens the user is on is never hidden (deep link keeps its restricted message)", () => {
  const denied = { ...ON, permissionsResolved: true, canViewRm: false, canViewPm: false };
  assert.equal(resolveTraceNavVisibility({ ...denied, currentLens: "rm-cost-trace" })["rm-cost-trace"], true);
  assert.equal(resolveTraceNavVisibility({ ...denied, currentLens: "rm-cost-trace" })["pm-cost-trace"], false);
  assert.equal(resolveTraceNavVisibility({ ...denied, currentLens: "pm-cost-trace" })["pm-cost-trace"], true);
});

test("trace nav lens ids are exactly the two contract Traces lenses (RM and PM stay separate ids)", () => {
  const traces = COSTING_NAV_GROUP_CONTRACT["material-cost"].find((g) => g.id === "traces");
  assert.deepEqual([...MCM_TRACE_NAV_LENS_IDS], traces.lensIds);
  assert.deepEqual([...MCM_TRACE_NAV_LENS_IDS], ["rm-cost-trace", "pm-cost-trace"]);
});

test("scope notes: group label comes from the N1 contract; each lens keeps its own distinct scope", () => {
  const mcm = renderMaterialCostNavScopeHtml("manual-rate-manager");
  assert.match(mcm, /data-nav-group="rates"/);
  assert.match(mcm, /<strong>Rates<\/strong>/);
  assert.match(mcm, /separate, restricted/);
  assert.equal(renderMaterialCostNavScopeHtml("rm-cost-trace"), "");
  const cbmGroups = Object.fromEntries(COSTING_NAV_GROUP_CONTRACT["cost-build"].flatMap((g) => g.lensIds.map((l) => [l, g])));
  for (const lens of Object.keys(CBM_NAV_SCOPE_NOTES)) {
    const html = renderCostBuildNavScopeHtml(lens);
    assert.ok(html.includes(`data-nav-group="${cbmGroups[lens].id}"`), lens);
    assert.ok(html.includes(`<strong>${cbmGroups[lens].label.replace("&", "&")}</strong>`) || html.includes(cbmGroups[lens].label), lens);
  }
  assert.deepEqual(Object.keys(CBM_NAV_SCOPE_NOTES), ["cost-governance", "staff-governance", "manual-provisions"], "driver-governance has its own controller and is not touched");
  assert.equal(renderCostBuildNavScopeHtml("driver-governance"), "");
  assert.match(CBM_NAV_SCOPE_NOTES["cost-governance"], /expense-head mapping/i);
  assert.match(CBM_NAV_SCOPE_NOTES["cost-governance"], /not a materials rate function, trace evidence or driver-policy approval/i);
  assert.match(CBM_NAV_SCOPE_NOTES["staff-governance"], /separate from expense-head mapping and manual provisions/i);
  assert.match(CBM_NAV_SCOPE_NOTES["manual-provisions"], /separate from expense-head mapping, staff governance and driver-policy approval/i);
  assert.doesNotMatch(MCM_NAV_SCOPE_NOTES["manual-rate-manager"], /expense|staff|provision|driver/i, "Materials Rates note does not blur into Cost Build concepts");
});

test("scope notes escape their inputs", () => {
  assert.doesNotMatch(renderCostBuildNavScopeHtml("cost-governance", () => "&lt;x&gt;"), /<x>/);
});

test("source: stripping the N2 additions reproduces the N1 (85a163f) controllers exactly, so nothing else changed", () => {
  assert.equal(stripN2MaterialCost(read(`${JS}/costing-suite-material-cost.js`)), base(`${JS}/costing-suite-material-cost.js`));
  assert.equal(stripN2CostBuild(read(`${JS}/costing-suite-cost-build.js`)), base(`${JS}/costing-suite-cost-build.js`));
});

test("source: permission functions, RPC names and export roles are byte-identical to N1; no new data access or storage", () => {
  const cur = read(`${JS}/costing-suite-material-cost.js`);
  const old = base(`${JS}/costing-suite-material-cost.js`);
  const fn = (src, name) => {
    const i = src.indexOf(`  function ${name}(`);
    return src.slice(i, src.indexOf("\n  }\n", i) + 5);
  };
  for (const name of ["canAccessRmTrace", "canExportRmTrace", "canAccessPmTrace", "canExportPmTrace", "canAccessActiveTrace", "canExportActiveTrace", "getTracePermissionsSafe"]) {
    assert.ok(fn(cur, name).length > 40, name);
    assert.equal(fn(cur, name), fn(old, name), name);
  }
  const rpcs = (s) => [...s.matchAll(/"(rpc_[a-z0-9_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rpcs(cur), rpcs(old));
  const added = (a, b) => a.split("\n").filter((l) => !b.split("\n").includes(l)).join("\n");
  for (const rel of [`${JS}/costing-suite-material-cost.js`, `${JS}/costing-suite-cost-build.js`]) {
    const add = added(read(rel), base(rel));
    assert.doesNotMatch(add, /costingRpc|costingFrom|supabase|\.rpc\(|fetch\(|localStorage|sessionStorage|new Date|setTimeout|setInterval/, rel);
    assert.doesNotMatch(add, /canEdit|can_edit|canExport|PERM_/, `${rel}: no permission derivation added`);
  }
});

test("source: N2 touches only the two controller files (plus their tests); shared N1 files, shell, registry, route config, CSS, HTML, sw and supabase are untouched", () => {
  // Immutable N2 package range: subsequent N3/N4 changes on main are not N2-owned.
  // Missing Git objects fail the test explicitly rather than silently skipping the guard.
  const n2Head = "ae41de8d6eb98d352528316709394c560ae748b2";
  const all = execFileSync("git", ["diff", "--name-only", N1_HEAD, n2Head], { cwd: root, encoding: "utf8" })
    .split("\n").filter(Boolean);
  assert.ok(all.length > 0, "N2 historical package diff must not be empty");
  const forbidden = [
    /costing-suite-shell\.js$/, /costing-suite-registry\.js$/, /costing-route-config\.js$/, /costing-nav-groups\.js$/,
    /costing-nav-context\.js$/, /costing-feature-flags\.js$/, /\.css$/, /\.html$/, /sw\.js$/, /^supabase\//, /package(-lock)?\.json$/,
    /costing-suite-driver-governance/,
  ];
  for (const f of all) for (const re of forbidden) assert.doesNotMatch(f, re, `forbidden file changed: ${f}`);
  for (const f of all.filter((x) => x.startsWith("public/"))) assert.match(f, /costing-suite-(material-cost|cost-build)\.js$/, f);
});
