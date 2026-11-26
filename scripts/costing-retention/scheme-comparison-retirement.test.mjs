import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ALL_COSTING_LENS_IDS, COSTING_ROUTE_CONFIG, getModuleKeyForLens, resolveRetiredLensRedirect, resolveRelocatedPricingPolicyTarget, buildSchemeComparisonRedirectParams, RETIRED_LENS_REDIRECTS }
  from "../../public/shared/js/costing-route-config.js";
import { LENS_REGISTRY } from "../../public/shared/js/costing-suite-registry.js";
import { resolveNavGroups } from "../../public/shared/js/costing-nav-groups.js";
import { RUN_SCOPED_LENSES } from "../../public/shared/js/costing-run-status-badge.js";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("scheme-comparison lens is gone from route config, registry, nav groups and run-scoped lens set", () => {
  assert.equal(COSTING_ROUTE_CONFIG["cost-sheet-review"].allowedLensIds.includes("scheme-comparison"), false);
  assert.equal("scheme-comparison" in LENS_REGISTRY, false);
  assert.equal(ALL_COSTING_LENS_IDS.includes("scheme-comparison"), false);
  assert.equal(getModuleKeyForLens("scheme-comparison"), null);
  assert.equal(RUN_SCOPED_LENSES.has("scheme-comparison"), false);
  const groups = resolveNavGroups("cost-sheet-review", COSTING_ROUTE_CONFIG["cost-sheet-review"].allowedLensIds);
  assert.equal(JSON.stringify(groups).includes("scheme-comparison"), false);
});
test("old deep links get an explicit redirect to SKU Cost Details, never a silent blank view", () => {
  assert.deepEqual(resolveRetiredLensRedirect("scheme-comparison"), { retired: true, from: "scheme-comparison", lens: "sku-cost-sheet" });
  assert.deepEqual(resolveRetiredLensRedirect(" Scheme-Comparison "), { retired: true, from: "scheme-comparison", lens: "sku-cost-sheet" });
  assert.equal(resolveRetiredLensRedirect("sku-cost-sheet").retired, false);
  assert.equal(resolveRetiredLensRedirect(null).retired, false);
  assert.ok(Object.isFrozen(RETIRED_LENS_REDIRECTS));
  // legacy PPM targets also land on the replacement lens, preserving status + period
  const r = resolveRelocatedPricingPolicyTarget({ lens: "scheme-comparison" });
  assert.deepEqual([r.relocated, r.moduleKey, r.lens], [true, "cost-sheet-review", "sku-cost-sheet"]);
  const qp = new URLSearchParams("lens=scheme-comparison&status=blocked,review_required&period_start=2026-11-01&issue=x");
  assert.deepEqual(buildSchemeComparisonRedirectParams(qp), { lens: "sku-cost-sheet", status: ["BLOCKED", "REVIEW_REQUIRED"], period_start: "2026-11-01" });
});
test("shell wires the redirect with an explicit notice; control-center risk drill targets the replacement lens", () => {
  const shell = read("public/shared/js/costing-suite-shell.js");
  assert.match(shell, /resolveRetiredLensRedirect\(lens\)/);
  assert.match(shell, /Scheme Comparison has been retired/);
  const cc = read("public/shared/js/costing-suite-control-center.js");
  assert.equal(/drillToLens\("scheme-comparison"/.test(cc), false);
  assert.match(cc, /drillToLens\("sku-cost-sheet", \{\s*status: \["BLOCKED", "REVIEW_REQUIRED"\]/);
});
test("selected-scheme viability evidence is untouched: cost-sheet scheme drawer tab and the shared snapshot readers remain", () => {
  const shell = read("public/shared/js/costing-suite-shell.js");
  assert.match(shell, /id: "scheme", label: "Scheme Comparison"/, "SKU drawer scheme tab (selected-scheme IK/OK viability evidence) preserved");
  assert.ok(fs.existsSync(new URL("../../public/shared/js/costing-suite-scheme-comparison.js", import.meta.url)), "controller module retained: dead-code removal is a follow-on after browser proof");
});
