// WP05-CL1: closure evidence checks (test-only; no source change). Characterises the CURRENT behaviour of the
// Costing client so that WP05 closure claims are backed by checked-in assertions: the eleven default-OFF flags,
// the six-module route table, the recommended-route resolver (C6), trace-tab fail-closed visibility (C8) and the
// Pricing Policy period-scope facts (S3/C9). Pure imports and the existing controller loader; no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as flags from "../../public/shared/js/costing-feature-flags.js";
import * as prmCorr from "../../public/shared/js/costing-suite-production-route-corrections.js";
import * as prmNav from "../../public/shared/js/costing-suite-production-route-nav-context.js";
import { COSTING_ROUTE_CONFIG, getAllowedLensIdsForRoute, getModuleKeyForLens, ALL_COSTING_LENS_IDS } from "../../public/shared/js/costing-route-config.js";
import { COSTING_SUITE_MODULES, LENS_REGISTRY, isLensPeriodScoped } from "../../public/shared/js/costing-suite-registry.js";
import { resolveRecommendedUiRouteTarget } from "../../public/shared/js/costing-suite-recommended-ui-route.js";
import { loadController } from "../costing-nav-mcm-cbm/load-controller.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const JS = path.join(root, "public/shared/js");

// ---- 1. the eleven flags ----------------------------------------------------------------------------------------
const FLAGS = [
  ["COSTING_RECALC_WITH_DATE_V1", flags.isCostingRecalcWithDateV1Enabled],
  ["COSTING_APPROVAL_SCREEN_V1", flags.isCostingApprovalScreenV1Enabled],
  ["COSTING_LOCK_SCREEN_V1", flags.isCostingLockScreenV1Enabled],
  ["COSTING_RUN_STATUS_V1", flags.isCostingRunStatusV1Enabled],
  ["COSTING_UX_CONSISTENCY_V1", flags.isCostingUxConsistencyV1Enabled],
  ["COSTING_DIALOGS_V1", flags.isCostingDialogsV1Enabled],
  ["COSTING_TABLE_TOOLS_V1", flags.isCostingTableToolsV1Enabled],
  ["COSTING_REVIEW_WORKLIST_V1", flags.isCostingReviewWorklistV1Enabled],
  ["COSTING_NAV_GROUPS_V1", flags.isCostingNavGroupsV1Enabled],
  ["COSTING_PRM_CORRECTIONS_V1", prmCorr.isCostingPrmCorrectionsV1Enabled],
  ["COSTING_PRM_NAV_CONTEXT_V1", prmNav.isCostingPrmNavContextV1Enabled],
];
const only = (name) => ({ getItem: (k) => (k === name ? "1" : null) });

test("inventory: exactly the eleven known COSTING_*_V1 flags exist in public/shared/js (a twelfth must extend this matrix)", () => {
  const found = new Set();
  for (const f of fs.readdirSync(JS).filter((n) => n.endsWith(".js"))) {
    for (const m of fs.readFileSync(path.join(JS, f), "utf8").matchAll(/["'`](COSTING_[A-Z0-9_]+_V\d+)["'`]/g)) found.add(m[1]);
  }
  assert.deepEqual([...found].sort(), FLAGS.map(([n]) => n).sort());
  assert.equal(FLAGS.length, 11);
});

test("every flag: default OFF and ON only for the exact string '1' (all other values, missing storage and throwing storage are OFF)", () => {
  for (const [name, isOn] of FLAGS) {
    assert.equal(isOn({ getItem: () => "1" }), true, `${name} exact 1`);
    for (const v of [null, undefined, "", "0", "true", "TRUE", "yes", " 1", "1 ", "01", 1, true, false, {}]) {
      assert.equal(isOn({ getItem: () => v }), false, `${name} rejects ${JSON.stringify(v)}`);
    }
    assert.equal(isOn({}), false, `${name} storage without getItem`);
    assert.equal(isOn(null), false, `${name} null storage`);
    assert.equal(isOn({ getItem: () => { throw new Error("blocked"); } }), false, `${name} throwing storage`);
    assert.equal(isOn(only("SOMETHING_ELSE")), false, `${name} default OFF`);
  }
});

test("flags are independent: setting one flag's key turns on that flag only (11 x 11 matrix)", () => {
  for (const [name] of FLAGS) {
    const on = FLAGS.filter(([, fn]) => fn(only(name))).map(([n]) => n);
    assert.deepEqual(on, [name]);
  }
});

test("each flag's storage key equals its exported constant name", () => {
  for (const [name] of FLAGS) {
    const seen = [];
    const fn = FLAGS.find(([n]) => n === name)[1];
    fn({ getItem: (k) => { seen.push(k); return null; } });
    assert.deepEqual(seen, [name]);
  }
});

// ---- 2. six Costing modules and lenses --------------------------------------------------------------------------
const SIX = ["costing-control-center", "material-cost-manager", "cost-build-manager", "pricing-policy-manager", "cost-sheet-review", "production-route-manager"];

test("route table: exactly the six Costing modules, each with matching key, module permission target, existing page and valid lenses", () => {
  assert.deepEqual(Object.keys(COSTING_ROUTE_CONFIG).sort(), [...SIX].sort());
  for (const key of SIX) {
    const c = COSTING_ROUTE_CONFIG[key];
    assert.equal(c.moduleKey, key);
    assert.equal(c.permissionTarget, `module:${key}`, `${key} permission target`);
    assert.ok(fs.existsSync(path.join(root, c.routePath)), `${key} page exists: ${c.routePath}`);
    assert.ok(c.allowedLensIds.length > 0);
    assert.ok(c.allowedLensIds.includes(c.defaultLens), `${key} default lens is allowed`);
    for (const lens of c.allowedLensIds) assert.ok(LENS_REGISTRY[lens], `${key}: ${lens} is registered`);
    assert.deepEqual(getAllowedLensIdsForRoute(c), c.allowedLensIds, `${key}: no allowed lens is silently dropped`);
  }
});

test("every registered lens id resolves to exactly one owning module (deep links cannot dangle); legacy PPM aliases map to Pricing Policy", () => {
  const ids = Object.keys(LENS_REGISTRY);
  assert.ok(ids.length >= 31, `lens count ${ids.length}`);
  for (const id of ids) {
    const owners = SIX.filter((k) => COSTING_ROUTE_CONFIG[k].allowedLensIds.includes(id));
    const resolved = getModuleKeyForLens(id);
    assert.ok(resolved, `${id} resolves`);
    if (owners.length) assert.equal(owners.length, 1, `${id} has one owner: ${owners}`);
  }
  for (const legacy of ["mrp-policies", "mrp-workflow", "selling-schemes", "mrp-governance", "policy-manager"]) {
    assert.equal(getModuleKeyForLens(legacy), "pricing-policy-manager", legacy);
  }
  assert.equal(getModuleKeyForLens("not-a-lens"), null);
  assert.equal(getModuleKeyForLens(""), null);
  assert.equal(getModuleKeyForLens("scheme-comparison"), "cost-sheet-review", "SC1 ownership");
});

test("suite registry and lens registry agree: every suite lens is registered and points back to its suite", () => {
  for (const suite of COSTING_SUITE_MODULES) {
    for (const lens of suite.lensIds) {
      assert.ok(LENS_REGISTRY[lens], `${suite.id}: ${lens}`);
      assert.equal(LENS_REGISTRY[lens].suiteId, suite.id, `${lens} suite back-reference`);
    }
  }
  assert.equal(new Set(ALL_COSTING_LENS_IDS).size, ALL_COSTING_LENS_IDS.length, "no lens listed under two suites");
});

// ---- 3. C6: recommended route resolver --------------------------------------------------------------------------
test("C6 recommended routes: navigable targets use existing modules/lenses; COST_APPROVAL_WORKBENCH, COST_REVIEW_WORKBENCH and unknown codes stay non-navigable", () => {
  const ctx = { productId: 7, skuId: 70, periodStart: "2026-10-01" };
  const prm = resolveRecommendedUiRouteTarget("PRODUCTION_ROUTE_MANAGER", ctx);
  assert.deepEqual([prm.navigable, prm.moduleKey, prm.lensId, prm.productId], [true, "production-route-manager", "product-route-assignments", 7]);
  const prmNoProduct = resolveRecommendedUiRouteTarget("PRODUCTION_ROUTE_MANAGER", {});
  assert.deepEqual([prmNoProduct.navigable, prmNoProduct.lensId, prmNoProduct.reason], [true, "route-readiness", "missing-product"]);
  assert.equal(resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", ctx).navigable, false, "no blocking lines: no verified remediation");
  const rm = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", { ...ctx, rmBlockingLineCount: 2 });
  assert.deepEqual([rm.navigable, rm.moduleKey, rm.navigateParams.issue, rm.navigateParams.source], [true, "material-cost-manager", ["MATERIAL_RATE_MANAGER_RM"], ["RM"]]);
  const both = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", { ...ctx, rmBlockingLineCount: 1, pmBlockingLineCount: 3 });
  assert.deepEqual(both.navigateParams.issue, ["MATERIAL_RATE_MANAGER_RM", "MATERIAL_RATE_MANAGER_PM"]);
  const review = resolveRecommendedUiRouteTarget("MATERIAL_RATE_REVIEW", ctx);
  assert.deepEqual([review.navigable, review.moduleKey, review.lensId, review.navigateParams.status], [true, "costing-control-center", "costing-review-workbench", ["REVIEW_REQUIRED"]]);
  for (const code of ["SELLING_PRICE_POLICY_REVIEW", "PRICING_POLICY_REVIEW"]) {
    const t = resolveRecommendedUiRouteTarget(code, { ...ctx, pricingBridgeStatus: "REVIEW_REQUIRED", sellingPriceBridgeStatus: "REVIEW_REQUIRED" });
    assert.deepEqual([t.navigable, t.moduleKey, t.workspaceId, t.navigateParams.status], [true, "pricing-policy-manager", "sku-overview", ["REVIEW_REQUIRED"]], code);
  }
  for (const code of ["COST_APPROVAL_WORKBENCH", "COST_REVIEW_WORKBENCH", "SOMETHING_NEW", "", null, undefined]) {
    const t = resolveRecommendedUiRouteTarget(code, ctx);
    assert.equal(t.navigable, false, String(code));
    assert.equal(t.moduleKey, undefined);
  }
  assert.equal(resolveRecommendedUiRouteTarget(" production_route_manager ", ctx).navigable, true, "code is normalised");
  for (const code of ["PRODUCTION_ROUTE_MANAGER", "MATERIAL_RATE_REVIEW", "PRICING_POLICY_REVIEW"]) {
    const t = resolveRecommendedUiRouteTarget(code, { ...ctx, rmBlockingLineCount: 1 });
    assert.ok(!JSON.stringify(t.navigateParams ?? {}).match(/run/i), `${code}: governed period/ids only, never a run id`);
  }
});

test("every navigable resolver target points at a real module key, lens or workspace", () => {
  const ctx = { productId: 7, skuId: 70, periodStart: "2026-10-01", rmBlockingLineCount: 1, pmBlockingLineCount: 1 };
  for (const code of ["PRODUCTION_ROUTE_MANAGER", "MATERIAL_RATE_MANAGER", "MATERIAL_RATE_REVIEW", "SELLING_PRICE_POLICY_REVIEW", "PRICING_POLICY_REVIEW"]) {
    const t = resolveRecommendedUiRouteTarget(code, ctx);
    assert.ok(COSTING_ROUTE_CONFIG[t.moduleKey], `${code} -> ${t.moduleKey}`);
    if (t.lensId) assert.ok(COSTING_ROUTE_CONFIG[t.moduleKey].allowedLensIds.includes(t.lensId), `${code} lens ${t.lensId} belongs to ${t.moduleKey}`);
  }
});

// ---- 4. C8: trace tab visibility fails closed --------------------------------------------------------------------
const { resolveTraceNavVisibility } = await loadController("costing-suite-material-cost.js");

test("C8 exhaustive: with grouped nav ON a trace entry is visible only with resolved permissions and an exact true view right, or when it is the current lens; flag OFF shows all", () => {
  const bools = [true, false, undefined, "true", 1];
  for (const navGroupsEnabled of [true, false, "1", undefined]) {
    for (const permissionsResolved of bools) {
      for (const canViewRm of bools) {
        for (const canViewPm of bools) {
          for (const currentLens of [undefined, "manual-rate-manager", "rm-cost-trace", "pm-cost-trace"]) {
            const v = resolveTraceNavVisibility({ navGroupsEnabled, permissionsResolved, canViewRm, canViewPm, currentLens });
            if (navGroupsEnabled !== true) {
              assert.deepEqual(v, { "rm-cost-trace": true, "pm-cost-trace": true, tracesGroup: true });
              continue;
            }
            const wantRm = (permissionsResolved === true && canViewRm === true) || currentLens === "rm-cost-trace";
            const wantPm = (permissionsResolved === true && canViewPm === true) || currentLens === "pm-cost-trace";
            assert.deepEqual(v, { "rm-cost-trace": wantRm, "pm-cost-trace": wantPm, tracesGroup: wantRm || wantPm });
          }
        }
      }
    }
  }
  assert.deepEqual(resolveTraceNavVisibility(), { "rm-cost-trace": true, "pm-cost-trace": true, tracesGroup: true });
});

// ---- 5. S3 / C9: Pricing Policy period scope (characterisation, not endorsement) -------------------------------
const ppm = await loadController("costing-suite-pricing-policy.js");

test("S3: there is no PPM workspace named Status; SKU Policy Overview is not period-scoped and Commercial Sales Assumptions is the only period-scoped PPM workspace", () => {
  const ws = ppm.PRICING_POLICY_WORKSPACES;
  assert.ok(Array.isArray(ws) && ws.length > 0);
  assert.equal(ws.filter((w) => /status/i.test(w.id) || /^status$/i.test(w.label)).length, 0);
  assert.equal(ws.find((w) => w.id === "sku-overview").supportsPeriod, false);
  assert.deepEqual(ws.filter((w) => w.supportsPeriod === true).map((w) => w.id), ["commercial-sales-assumptions"]);
});

test("C9 characterisation: registry marks the legacy PPM lenses mrp-governance and policy-manager as NOT period-scoped although the Commercial Sales Assumptions workspace is (open owner item; this pins today's state)", () => {
  assert.equal(isLensPeriodScoped("mrp-governance"), false);
  assert.equal(isLensPeriodScoped("policy-manager"), false);
  const csa = ppm.PRICING_POLICY_WORKSPACES.find((w) => w.id === "commercial-sales-assumptions");
  assert.equal(csa.supportsPeriod, true);
  assert.equal(csa.legacyLensId, "policy-manager", "CSA is reached through the policy-manager lens whose registry metadata says periodScoped:false");
});

test("test-only package: nothing under public/, supabase/ or sql/ differs from the base commit", async () => {
  const { execFileSync } = await import("node:child_process");
  const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const changed = [...git("diff", "--name-only", "195b13c4df32a5fdcf22ee304066e96c1b138481"), ...git("ls-files", "--others", "--exclude-standard")];
  assert.deepEqual(changed.filter((f) => /^(public|supabase|sql)\//.test(f) || /package(-lock)?\.json$/.test(f)), []);
});
