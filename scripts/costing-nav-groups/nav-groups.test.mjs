// MDC-07 / N1 unit + source-contract tests (node:test only; no network, no Supabase).
import { unPersonnel } from "../costing-w506-conf-client/unpersonnel.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COSTING_SUITE_MODULES, LENS_REGISTRY } from "../../public/shared/js/costing-suite-registry.js";
import { ALL_COSTING_LENS_IDS, COSTING_ROUTE_CONFIG, getAllowedLensIdsForRoute } from "../../public/shared/js/costing-route-config.js";
import { COSTING_NAV_GROUPS_V1, isCostingNavGroupsV1Enabled } from "../../public/shared/js/costing-feature-flags.js";
import { COSTING_PRM_CORRECTIONS_V1, isCostingPrmCorrectionsV1Enabled } from "../../public/shared/js/costing-suite-production-route-corrections.js";
import { PRICING_POLICY_WORKSPACES } from "../../public/shared/js/costing-suite-pricing-policy.js";
import {
  COSTING_LENS_BASIS,
  COSTING_NAV_GROUP_CONTRACT,
  COSTING_PPM_NAV_GROUP_CONTRACT,
  NAV_BASIS,
  NAV_FALLBACK_GROUP_ID,
  getBasisText,
  renderGroupedNavHtml,
  renderGroupedSelectHtml,
  resolveNavGroups,
  validateNavGroupContract,
} from "../../public/shared/js/costing-nav-groups.js";
import { buildNavContextModel, createNavContextStore, renderNavContextHtml } from "../../public/shared/js/costing-nav-context.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => unPersonnel(rel, fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"));
const SHELL = read("public/shared/js/costing-suite-shell.js");
const store = (v) => ({ getItem: (k) => (k === COSTING_NAV_GROUPS_V1 ? v : null) });

test("flag COSTING_NAV_GROUPS_V1 is default OFF and only the exact value '1' enables it", () => {
  assert.equal(COSTING_NAV_GROUPS_V1, "COSTING_NAV_GROUPS_V1");
  for (const v of [null, undefined, "", "0", "true", "TRUE", "on", " 1", "1 ", "01", "yes"]) assert.equal(isCostingNavGroupsV1Enabled(store(v)), false, String(v));
  assert.equal(isCostingNavGroupsV1Enabled(store("1")), true);
  assert.equal(isCostingNavGroupsV1Enabled({ getItem() { throw new Error("blocked"); } }), false);
  assert.equal(isCostingNavGroupsV1Enabled(undefined), false, "no localStorage in node -> OFF");
});

test("flag is independent of COSTING_PRM_CORRECTIONS_V1 (both directions)", () => {
  assert.notEqual(COSTING_NAV_GROUPS_V1, COSTING_PRM_CORRECTIONS_V1);
  const only = (name) => ({ getItem: (k) => (k === name ? "1" : null) });
  assert.equal(isCostingNavGroupsV1Enabled(only(COSTING_PRM_CORRECTIONS_V1)), false);
  assert.equal(isCostingPrmCorrectionsV1Enabled(only(COSTING_NAV_GROUPS_V1)), false);
});

test("registry invariants unchanged: six modules, 32 lens ids, every id resolves, ids unique", () => {
  assert.equal(COSTING_SUITE_MODULES.length, 6);
  assert.equal(ALL_COSTING_LENS_IDS.length, 32);
  assert.equal(new Set(ALL_COSTING_LENS_IDS).size, 32);
  assert.equal(Object.keys(LENS_REGISTRY).length, 32);
  for (const id of ALL_COSTING_LENS_IDS) assert.ok(LENS_REGISTRY[id], id);
  assert.deepEqual(
    COSTING_SUITE_MODULES.map((m) => `${m.id}:${m.lensIds.length}`),
    ["control-center:4", "material-cost:3", "cost-build:4", "pricing-policy:2", "cost-sheet-review:6", "production-route:13"],
  );
});

test("route config invariants unchanged: permission targets, default lenses, route paths", () => {
  const snap = Object.fromEntries(Object.entries(COSTING_ROUTE_CONFIG).map(([k, c]) => [k, [c.permissionTarget, c.defaultLens, c.routePath, c.suiteId]]));
  assert.deepEqual(snap, {
    "costing-control-center": ["module:costing-control-center", "dashboard", "public/shared/costing-control-center.html", "control-center"],
    "material-cost-manager": ["module:material-cost-manager", "manual-rate-manager", "public/shared/material-cost-manager.html", "material-cost"],
    "cost-build-manager": ["module:cost-build-manager", "cost-governance", "public/shared/cost-build-manager.html", "cost-build"],
    "pricing-policy-manager": ["module:pricing-policy-manager", "policy-manager", "public/shared/pricing-policy-manager.html", "pricing-policy"],
    "cost-sheet-review": ["module:cost-sheet-review", "sku-cost-sheet", "public/shared/cost-sheet-review.html", "cost-sheet-review"],
    "production-route-manager": ["module:production-route-manager", "route-readiness", "public/shared/production-route-manager.html", "production-route"],
  });
});

test("contract is sound: every lens of every non-PPM module appears in exactly one stable group", () => {
  assert.deepEqual(validateNavGroupContract(), []);
  const grouped = Object.values(COSTING_NAV_GROUP_CONTRACT).flatMap((gs) => gs.flatMap((g) => g.lensIds));
  assert.equal(grouped.length, 30);
  assert.equal(new Set(grouped).size, 30);
  const ppm = COSTING_SUITE_MODULES.find((m) => m.id === "pricing-policy").lensIds;
  assert.deepEqual([...grouped, ...ppm].sort(), [...ALL_COSTING_LENS_IDS].sort(), "30 grouped + 2 controller-managed PPM lenses = all 32");
  for (const gs of Object.values(COSTING_NAV_GROUP_CONTRACT)) for (const g of gs) assert.ok(g.contextLabel, g.id);
});

test("route-config lens order is respected per route: resolved groups cover exactly the allowed lenses", () => {
  for (const config of Object.values(COSTING_ROUTE_CONFIG)) {
    if (config.suiteId === "pricing-policy") continue;
    const allowed = getAllowedLensIdsForRoute(config);
    const groups = resolveNavGroups(config.suiteId, allowed);
    assert.deepEqual(groups.flatMap((g) => g.lensIds).sort(), [...allowed].sort(), config.suiteId);
    assert.ok(!groups.some((g) => g.id === NAV_FALLBACK_GROUP_ID), `${config.suiteId}: nothing falls through to More`);
  }
});

test("Production Route Manager has the five approved groups in order", () => {
  const groups = resolveNavGroups("production-route", COSTING_ROUTE_CONFIG["production-route-manager"].allowedLensIds);
  assert.deepEqual(groups.map((g) => g.label), ["Readiness", "Assign & Map", "Build", "Review", "History"]);
  assert.deepEqual(groups.map((g) => g.lensIds.length), [1, 3, 4, 4, 1]);
  assert.equal(groups[0].lensIds[0], COSTING_ROUTE_CONFIG["production-route-manager"].defaultLens, "default landing is the first group");
  const review = groups[3].lensIds;
  for (const id of ["route-family-mapping-review", "route-family-foundation-review", "historical-candidate-review"]) assert.ok(review.includes(id), `${id} stays an independent lens`);
});

test("other modules follow the approved WP05-A3 assignments", () => {
  const labels = (suite, route) => resolveNavGroups(suite, COSTING_ROUTE_CONFIG[route].allowedLensIds).map((g) => g.label);
  assert.deepEqual(labels("control-center", "costing-control-center"), ["Overview", "Workbench", "SKU Review"]);
  assert.deepEqual(labels("material-cost", "material-cost-manager"), ["Rates", "Traces"]);
  assert.deepEqual(labels("cost-build", "cost-build-manager"), ["Mapping & classification", "Provisions", "Policy approval"]);
  assert.deepEqual(labels("cost-sheet-review", "cost-sheet-review"), ["Review", "Documents", "Action Queues"]);
  const sku = resolveNavGroups("control-center", COSTING_ROUTE_CONFIG["costing-control-center"].allowedLensIds)[2];
  assert.deepEqual(sku.lensIds, ["sku-control-status", "portfolio-readiness"], "two separate lenses, not merged");
  const queues = resolveNavGroups("cost-sheet-review", COSTING_ROUTE_CONFIG["cost-sheet-review"].allowedLensIds)[2];
  assert.deepEqual(queues.lensIds, ["qc-action-queue", "materials-stores-action-queue"]);
});

test("resolveNavGroups never loses or invents a destination", () => {
  const allowed = ["dashboard", "sku-control-status", "portfolio-readiness", "costing-review-workbench"];
  const g = resolveNavGroups("control-center", [...allowed, "not-a-lens", "dashboard"]);
  assert.deepEqual(g.flatMap((x) => x.lensIds).sort(), [...allowed].sort());
  // A permission-restricted subset only shrinks groups; empty groups disappear.
  const sub = resolveNavGroups("control-center", ["portfolio-readiness"]);
  assert.deepEqual(sub.map((x) => [x.id, x.lensIds]), [["sku-review", ["portfolio-readiness"]]]);
  // A lens the contract does not know falls into "More" rather than vanishing.
  const synthetic = resolveNavGroups("material-cost", ["manual-rate-manager", "dashboard"]);
  assert.deepEqual(synthetic.at(-1), { id: NAV_FALLBACK_GROUP_ID, label: "More", contextLabel: "", lensIds: ["dashboard"] });
  assert.deepEqual(resolveNavGroups("pricing-policy", ["mrp-governance"]), [], "PPM is controller-managed: no lens groups");
  assert.deepEqual(resolveNavGroups("nope", ["dashboard"]), []);
});

test("PPM: compatible workspace contract covers all 10 workspaces exactly once and is never rendered by the shell", () => {
  assert.equal(COSTING_PPM_NAV_GROUP_CONTRACT.controllerManaged, true);
  assert.equal(COSTING_PPM_NAV_GROUP_CONTRACT.kind, "workspace");
  const ids = COSTING_PPM_NAV_GROUP_CONTRACT.groups.flatMap((g) => g.workspaceIds);
  assert.equal(ids.length, 10);
  assert.deepEqual([...ids].sort(), PRICING_POLICY_WORKSPACES.map((w) => w.id).sort());
  assert.ok(SHELL.includes("isCostingNavGroupsV1Enabled() && !isPricingPolicyManagerRoute()"), "shell excludes the PPM route");
  assert.ok(!/COSTING_PPM_NAV_GROUP_CONTRACT/.test(SHELL), "shell never consumes the PPM contract (W6)");
});

test("renderers: escape output, keep data-lens/pill classes, label every group, mark the active lens", () => {
  const groups = resolveNavGroups("production-route", COSTING_ROUTE_CONFIG["production-route-manager"].allowedLensIds);
  const html = renderGroupedNavHtml(groups, "product-route-editor");
  assert.equal((html.match(/role="group"/g) || []).length, 5);
  assert.equal((html.match(/data-lens="/g) || []).length, 13);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /data-lens="product-route-editor"[^>]*aria-current="page"/);
  for (const g of groups) assert.match(html, new RegExp(`aria-labelledby="cpNavGroup-${g.id}"[^>]*>.*?id="cpNavGroup-${g.id}">${g.label.replace(/&/, "&amp;")}<`));
  assert.match(html, /<button type="button" class="pill active"/);
  const select = renderGroupedSelectHtml(groups);
  assert.equal((select.match(/<optgroup/g) || []).length, 5);
  assert.equal((select.match(/<option value="/g) || []).length, 13);
  assert.match(select, /<optgroup label="Assign &amp; Map">/);
  assert.equal(renderGroupedNavHtml([{ id: "x", label: "<img onerror=1>", contextLabel: '"', lensIds: ["dashboard"] }], "dashboard").includes("<img"), false);
});

test("context: a chip exists only for a supplied value; nothing is invented or defaulted", () => {
  const m = buildNavContextModel({ moduleTitle: "Production Route Manager", group: { label: "Build" }, lensId: "product-route-editor", context: {} });
  assert.deepEqual(m.breadcrumb, ["Production Route Manager", "Build", "Product Route Editor"]);
  assert.deepEqual(m.chips, []);
  assert.equal(m.basisChip, null);
  const some = buildNavContextModel({ moduleTitle: "T", lensId: "dashboard", periodScoped: true, context: { product: "  Triphala ", family: "", route: null, period: "2026-10-01", run: undefined } });
  assert.deepEqual(some.chips.map((c) => [c.key, c.value]), [["product", "Triphala"], ["period", "2026-10-01"]]);
  // objects/arrays are not coerced into "[object Object]"
  assert.deepEqual(buildNavContextModel({ lensId: "dashboard", context: { product: { a: 1 }, family: [] } }).chips, []);
  // the period chip is limited to period-scoped lenses
  assert.deepEqual(buildNavContextModel({ lensId: "route-readiness", periodScoped: false, context: { period: "2026-10-01" } }).chips, []);
});

test("context: LIVE_AS_OF, run-scoped and fixed-historical bases are distinct and never called current", () => {
  assert.equal(COSTING_LENS_BASIS["portfolio-readiness"], NAV_BASIS.LIVE_AS_OF);
  assert.equal(COSTING_LENS_BASIS["sku-control-status"], NAV_BASIS.RUN_SCOPED);
  for (const id of ["shared-workload-preview", "route-family-mapping-review", "route-family-foundation-review"]) assert.equal(COSTING_LENS_BASIS[id], NAV_BASIS.FIXED_HISTORICAL);
  const texts = Object.values(NAV_BASIS).map(getBasisText);
  assert.equal(new Set(texts).size, 3);
  assert.match(getBasisText("FIXED_HISTORICAL"), /not the current costing run/);
  assert.match(getBasisText("LIVE_AS_OF"), /^LIVE_AS_OF/);
  const hist = buildNavContextModel({ lensId: "shared-workload-preview", context: { run: "80" } });
  assert.deepEqual(hist.chips.map((c) => [c.label, c.value, c.historical]), [["Run (fixed historical)", "80", true]]);
  assert.match(renderNavContextHtml(hist), /Run \(fixed historical\)/);
  const visibleText = renderNavContextHtml(hist).replace(/<[^>]*>/g, " ");
  assert.doesNotMatch(visibleText, /current(?! costing run)/i, "visible text never calls fixed evidence current");
  const live = buildNavContextModel({ lensId: "portfolio-readiness", periodScoped: true, context: { run: "143" } });
  assert.equal(live.chips[0].label, "Run", "a run on a non-historical lens keeps its plain label");
  assert.equal(live.basisChip.basis, "LIVE_AS_OF");
});

test("context store: sanitises, notifies only on change, ignores unknown keys", () => {
  const s = createNavContextStore();
  const seen = [];
  const off = s.subscribe((v) => seen.push(v));
  assert.equal(s.set({ product: "A", bogus: "x" }), true);
  assert.equal(s.set({ product: "A" }), false);
  assert.deepEqual(s.get(), { product: "A" });
  s.set({ basis: "NOT_A_BASIS", run: "9" });
  assert.deepEqual(s.get(), { product: "A", run: "9" });
  s.set({ product: "" });
  assert.deepEqual(s.get(), { run: "9" });
  s.set({ run: "x".repeat(200) });
  assert.ok(s.get().run.length <= 80);
  off();
  s.clear();
  assert.equal(seen.length, 4);
  assert.deepEqual(s.get(), {});
  assert.equal(renderNavContextHtml(null), "");
});

test("context HTML escapes values and exposes breadcrumb + chip landmarks", () => {
  const html = renderNavContextHtml(buildNavContextModel({ moduleTitle: "M", group: { label: "G" }, lensId: "dashboard", periodScoped: true, context: { product: "<b>x</b>" } }));
  assert.match(html, /<nav class="cp-breadcrumb" aria-label="Breadcrumb">/);
  assert.match(html, /<li class="cp-breadcrumb-item" aria-current="page">Dashboard<\/li>/);
  assert.match(html, /aria-label="Current context"/);
  assert.ok(!html.includes("<b>x</b>"));
});

test("source: new modules are presentation-only (no RPC, Supabase, storage, DOM globals, fetch or date/cost maths)", () => {
  for (const rel of ["public/shared/js/costing-nav-groups.js", "public/shared/js/costing-nav-context.js"]) {
    const src = read(rel);
    assert.doesNotMatch(src, /\.rpc\(|supabase|costingRpc|localStorage|fetch\(|document\.|window\.|new Date|Date\.|parseFloat|Number\(/, rel);
    assert.doesNotMatch(src, /\brun\s*(80|82)\b|:\s*"(80|82)"/, `${rel}: no fixed run value embedded`);
  }
});

test("source: shell grouped navigation is flag-gated and the flag-OFF branches are the original code", () => {
  assert.equal((SHELL.match(/isCostingNavGroupsV1Enabled/g) || []).length, 2, "import + the single gate");
  assert.match(SHELL, /\} else if \(isNavGroupsActive\(\)\) \{\n[^\n]*\n\s*lensPills\.classList\.add\("cp-nav-groups"\);/);
  // original flat-pill branch retained verbatim
  assert.ok(SHELL.includes('return `<div class="cp-lens-suite-group" data-suite-id="${text(suite.id)}">${pills}</div>`;'));
  assert.ok(SHELL.includes("lensSelect.innerHTML = isNavGroupsActive()\n        ? renderGroupedSelectHtml(getActiveNavGroups())\n        : activeSuites"));
  // the pill click handler is the unchanged switchLens path (no new lens routing)
  assert.equal((SHELL.match(/btn\.addEventListener\("click", \(\) => switchLens\(btn\.dataset\.lens\)\);/g) || []).length, 2);
  // OFF: refreshNavContextBar does nothing unless a bar exists
  assert.match(SHELL, /if \(!isNavGroupsActive\(\)\) \{\n[^\n]*\n\s*if \(bar\) \{/);
});

test("source: shell data access names are exactly the pre-N1 baseline (no new RPC or table)", () => {
  const names = [...new Set(SHELL.match(/(\.rpc\(|supabase\.from\(|\.from\()\s*"[a-zA-Z0-9_]+"|"rpc_[a-z0-9_]+"|"(get|list|search|resolve|can)_[a-z0-9_]+"/g) || [])].sort();
  assert.deepEqual(names, JSON.parse(read("scripts/costing-nav-groups/shell-rpc-names.baseline.json")));
});

test("source: N1 does not edit registry/route-config semantics or controller files", () => {
  // The registry and route config are consumed, not edited: their lens lists are asserted above; this guards that
  // the nav modules are the only new sources and the flag lives with the other flags.
  const flags = read("public/shared/js/costing-feature-flags.js");
  assert.match(flags, /export const COSTING_NAV_GROUPS_V1 = "COSTING_NAV_GROUPS_V1";/);
  assert.equal(COSTING_SUITE_MODULES.map((m) => m.lensIds.length).reduce((a, b) => a + b, 0), 32);
});

test("CSS: N1 block is append-only, scoped to body.sasv-costing and has no !important / hidden overflow", () => {
  const css = read("public/shared/css/sasv-costing.css");
  // The stylesheet is append-only: later, unrelated blocks (e.g. Issue #208, whose comment mentions the phrase
  // "overflow-x:hidden") follow the N1 block. Bound the N1 block at the next top-level comment so this contract
  // checks only N1's own rules (test-only repair of a pre-existing failure on main, WP05 overnight bulk wave).
  const n1Start = css.indexOf("MDC-07 N1: grouped navigation");
  const n1HeaderEnd = css.indexOf("*/", n1Start) + 2;
  const nextBlock = css.indexOf("\n/*", n1HeaderEnd);
  const block = css.slice(n1Start, nextBlock === -1 ? undefined : nextBlock);
  assert.ok(block.length > 500);
  assert.equal(css.indexOf("MDC-07 N1: grouped navigation") > css.indexOf("CW-13: responsive hardening"), true);
  assert.doesNotMatch(block, /!important|overflow-x:\s*hidden/);
  for (const line of block.split("\n").filter((l) => /\{\s*$/.test(l) && !/^\s*(@media|\/\*|\*)/.test(l))) assert.match(line.trim(), /^body\.sasv-costing /, line);
  assert.match(block, /\.lens-pills\.cp-nav-groups \{[^}]*overflow-x: auto/);
});

test("pages: no HTML edits are needed (nav host elements already exist on all six pages)", () => {
  for (const c of Object.values(COSTING_ROUTE_CONFIG)) {
    const html = read(c.routePath);
    // PPM has no lens select: its workspace navigation is controller-managed (and is not grouped by N1).
    const ids = c.suiteId === "pricing-policy" ? ["lensPills", "lensSuiteLabel"] : ["lensPills", "lensSelect", "lensSuiteLabel"];
    for (const id of ids) assert.ok(html.includes(`id="${id}"`), `${c.moduleKey} ${id}`);
  }
});

// ---- test-integrity: plain source reads keep N1; the historical-comparison strip removes only N1 ----
import { readSourceLf } from "../lib/read-source-lf.mjs";
import { stripN1, stripN1Flags, stripN1Shell } from "../lib/n1-nav-strip.mjs";
import { execFileSync } from "node:child_process";
const SHELL_REL = "public/shared/js/costing-suite-shell.js";
const FLAGS_REL = "public/shared/js/costing-feature-flags.js";
const BASE_N1 = "86f1c18c538eea224fd3ad8198e5527413892474";
const baseText = (rel) => execFileSync("git", ["show", `${BASE_N1}:${rel}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n");

test("readSourceLf only normalises line endings: N1 additions stay visible to normal source-contract reads", () => {
  const shell = readSourceLf(root, SHELL_REL);
  const flags = readSourceLf(root, FLAGS_REL);
  for (const marker of ["isNavGroupsActive", "refreshNavContextBar", "renderGroupedNavHtml", "costing-nav-groups.js"]) assert.ok(shell.includes(marker), marker);
  assert.ok(flags.includes("COSTING_NAV_GROUPS_V1"));
  assert.equal(shell, fs.readFileSync(path.join(root, SHELL_REL), "utf8").replace(/\r\n/g, "\n"), "identical to the raw file apart from CRLF->LF");
  assert.doesNotMatch(fs.readFileSync(path.join(root, "scripts/lib/read-source-lf.mjs"), "utf8"), /n1-nav-strip|stripN1/, "reader has no N1 knowledge");
});

test("legacy comparison strip removes exactly the N1 additions: stripped sources equal the pre-N1 baseline", () => {
  assert.equal(stripN1Shell(unPersonnel(SHELL_REL, readSourceLf(root, SHELL_REL))), baseText(SHELL_REL).split("\n").join("\n"), "shell == pre-N1 shell");
  assert.equal(stripN1Flags(readSourceLf(root, FLAGS_REL)), baseText(FLAGS_REL), "flags == pre-N1 flags");
  assert.equal(stripN1("public/shared/js/costing-suite-registry.js", "x"), "x", "other files untouched");
  assert.equal(stripN1(SHELL_REL, "no n1 here\n"), "no n1 here\n");
});

test("mutation: a change to a protected non-N1 shell/flag section survives the strip, so historical tests still fail", () => {
  const shell = readSourceLf(root, SHELL_REL);
  const pre = baseText(SHELL_REL);
  const mutated = shell.replace("const lensPills = $(\"lensPills\");", "const lensPills = $(\"lensPillsX\");");
  assert.notEqual(mutated, shell);
  assert.notEqual(stripN1Shell(mutated), pre, "mutated non-N1 line is still detected after stripping");
  const mutated2 = shell.replace("  closeDetails();\n  try {\n    await loadRowsForLens();", "  closeDetails();\n  try {\n    await loadRowsForLens(1);");
  assert.notEqual(mutated2, shell);
  assert.notEqual(stripN1Shell(mutated2), pre);
  const flags = readSourceLf(root, FLAGS_REL).replace('=== "1"', '!== "1"');
  assert.notEqual(stripN1Flags(flags), baseText(FLAGS_REL));
  // N1's own code is not protected by the strip (it is removed on purpose); it is pinned by the full-source N1 tests above.
});
