// MDC-07 / N3 — Cost Sheet Review cross-links and Action Queue lens independence (no browser, no network).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync as execSyncImpl } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPricingPolicySkuOverviewHref,
  createSchemeComparisonController,
  SCHEME_COMPARISON_LENS_ID,
} from "../../public/shared/js/costing-suite-scheme-comparison.js";
import { createQcActionQueueController } from "../../public/shared/js/costing-suite-qc-action-queue.js";
import { createMaterialsStoresActionQueueController } from "../../public/shared/js/costing-suite-materials-stores-action-queue.js";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { COSTING_NAV_GROUP_CONTRACT, resolveNavGroups } from "../../public/shared/js/costing-nav-groups.js";
import { LENS_REGISTRY } from "../../public/shared/js/costing-suite-registry.js";
import { PRICING_POLICY_WORKSPACES } from "../../public/shared/js/costing-suite-pricing-policy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const JS = "public/shared/js";
const sources = {
  scheme: read(`${JS}/costing-suite-scheme-comparison.js`),
  qc: read(`${JS}/costing-suite-qc-action-queue.js`),
  ms: read(`${JS}/costing-suite-materials-stores-action-queue.js`),
};

const schemeCtrl = createSchemeComparisonController({
  costingFrom: () => { throw new Error("no data access in this test"); },
  fetchAllRows: async () => [],
  text: (v) => String(v ?? "—"),
  formatMoney: (v) => String(v ?? "—"),
  formatPercent: (v) => String(v ?? "—"),
  compactStatusText: (v) => String(v ?? "—"),
  productSkuLabel: (row) => `<strong>${row.product_name}</strong>`,
});
const ROW = { period_start: "2026-09-01", product_id: 3, sku_id: 30, product_name: "Gamma", scheme_name: "S" };

test("Scheme Comparison: link targets PPM SKU Policy Overview with the row's own period/product/SKU", () => {
  const href = buildPricingPolicySkuOverviewHref(ROW);
  const url = new URL(href, "https://x.invalid/public/shared/");
  assert.equal(url.pathname.split("/").pop(), COSTING_ROUTE_CONFIG["pricing-policy-manager"].routePath.split("/").pop());
  assert.equal(url.searchParams.get("workspace"), "sku-overview");
  assert.ok(PRICING_POLICY_WORKSPACES.some((w) => w.id === "sku-overview"), "workspace id is a real PPM workspace");
  assert.equal(url.searchParams.get("period_start"), "2026-09-01");
  assert.equal(url.searchParams.get("product_id"), "3");
  assert.equal(url.searchParams.get("sku_id"), "30");
  assert.equal(url.searchParams.get("lens"), null, "canonical workspace-only URL: no legacy lens/tab keys");
});

test("Scheme Comparison: never infers missing context", () => {
  assert.equal(buildPricingPolicySkuOverviewHref({ ...ROW, period_start: null }), null);
  assert.equal(buildPricingPolicySkuOverviewHref({ ...ROW, period_start: "" }), null);
  assert.equal(buildPricingPolicySkuOverviewHref({ ...ROW, period_start: "Sep 2026" }), null);
  assert.equal(buildPricingPolicySkuOverviewHref({ ...ROW, sku_id: null }), null);
  assert.equal(buildPricingPolicySkuOverviewHref({ ...ROW, sku_id: "" }), null);
  assert.equal(buildPricingPolicySkuOverviewHref(null), null);
  const noProduct = buildPricingPolicySkuOverviewHref({ ...ROW, product_id: null });
  assert.ok(!new URL(noProduct, "https://x.invalid/").searchParams.has("product_id"));
  const tr = schemeCtrl.renderTableRow({ ...ROW, period_start: null }, 'data-row-index="0"');
  assert.ok(!tr.includes("data-sc-ppm-link"), "row without its own period gets no link");
});

test("Scheme Comparison: row keeps 9 cells / headers unchanged; link is an escaped, noopener, new-tab anchor", () => {
  assert.equal(schemeCtrl.getTableHeaders().length, 9);
  assert.equal(schemeCtrl.getTableAlignments().length, 9);
  const tr = schemeCtrl.renderTableRow({ ...ROW, sku_id: '30"><script>x</script>' }, 'data-row-index="0"');
  assert.equal((tr.match(/<td/g) || []).length, 9);
  assert.ok(!tr.includes("<script>"), "attribute value is escaped");
  assert.match(tr, /target="_blank" rel="noopener noreferrer" data-sc-ppm-link="sku-overview"/);
  assert.equal(SCHEME_COMPARISON_LENS_ID, "scheme-comparison");
});

test("Scheme Comparison stays read-only: no RPC, no write verbs, no storage, still one view read", () => {
  assert.ok(!/\.rpc\(|costingRpc|\.insert\(|\.update\(|\.upsert\(|\.delete\(|localStorage|sessionStorage/.test(sources.scheme));
  assert.equal((sources.scheme.match(/costingFrom\(/g) || []).length, 1);
  assert.match(sources.scheme, /\.eq\("period_start", periodStart\)/);
});

const qcRow = { period_start: "2026-09-01", product_id: 7, sku_id: 70, action_code: "BLOCKED_MISSING_FG_PROTOCOL_MAPPING", product_name: "P" };
const msRow = { period_start: "2026-09-01", product_id: 7, sku_id: 70, action_code: "REVIEW_X", product_name: "P" };
const baseDeps = { costingRpc: async () => ({ data: [], error: null }), showToast() {}, getActivePeriodStart: () => "2026-09-01", getCurrentLens: () => "x" };

test("Action Queues: sibling link only with a navigation function and the row/state period; opposite lens ids", () => {
  const nav = () => true;
  const qc = createQcActionQueueController({ ...baseDeps, navigateToCostingRoute: nav });
  const ms = createMaterialsStoresActionQueueController({ ...baseDeps, navigateToCostingRoute: nav });
  const qcHtml = qc.renderDrawerTab("overview", qcRow);
  const msHtml = ms.renderDrawerTab("overview", msRow);
  assert.match(qcHtml, /data-qc-aq-nav="sibling-queue"/);
  assert.match(msHtml, /data-ms-aq-nav="sibling-queue"/);
  // existing remediation buttons are preserved
  assert.match(qcHtml, /data-qc-aq-nav="protocol"/);
  assert.match(msHtml, /data-ms-aq-nav="rm"|data-ms-aq-nav="pm"|No dedicated navigation route/);
  // no navigation function => no link; no period => no link
  const bare = createQcActionQueueController({ ...baseDeps });
  assert.ok(!bare.renderDrawerTab("overview", qcRow).includes("sibling-queue"));
  assert.ok(!qc.renderDrawerTab("overview", { ...qcRow, period_start: "" }).includes("sibling-queue"));
  assert.ok(!createMaterialsStoresActionQueueController({ ...baseDeps }).renderDrawerTab("overview", msRow).includes("sibling-queue"));
});

test("Action Queues: still two lenses in the same N1 group, two controllers, two RPCs with unchanged param shapes", () => {
  const group = COSTING_NAV_GROUP_CONTRACT["cost-sheet-review"].find((g) => g.id === "action-queues");
  assert.deepEqual(group.lensIds, ["qc-action-queue", "materials-stores-action-queue"]);
  const allowed = COSTING_ROUTE_CONFIG["cost-sheet-review"].allowedLensIds;
  assert.ok(allowed.includes("qc-action-queue") && allowed.includes("materials-stores-action-queue"));
  assert.ok(resolveNavGroups("cost-sheet-review", allowed).some((g) => g.id === "action-queues" && g.lensIds.length === 2));
  assert.notEqual(LENS_REGISTRY["qc-action-queue"].label, LENS_REGISTRY["materials-stores-action-queue"].label);
  assert.match(sources.qc, /costingRpc\("rpc_get_qc_action_queue", \{\n\s+p_period_start: period \|\| null,\n\s+p_action_code: state\.action_code \|\| null,\n\s+p_q: state\.q \|\| null,\n\s+p_limit: state\.limit,\n\s+p_offset: state\.offset,\n\s+\}\)/);
  assert.match(sources.ms, /"rpc_get_materials_stores_action_queue",\n\s+\{\n\s+p_period_start: period \|\| null,\n\s+p_action_code: state\.action_code \|\| null,\n\s+p_q: state\.q \|\| null,\n\s+p_limit: state\.limit,\n\s+p_offset: state\.offset,\n\s+\}/);
  assert.equal((sources.qc.match(/costingRpc\(/g) || []).length, 1);
  assert.equal((sources.ms.match(/costingRpc\(/g) || []).length, 1);
  assert.ok(!/import .*materials-stores-action-queue/.test(sources.qc) && !/import .*qc-action-queue/.test(sources.ms), "controllers do not import each other");
});

test("Sibling navigation calls the shell contract with period only, new tab, existing lens ids (click path: Chromium test)", () => {
  assert.match(sources.qc, /\{ lens: "materials-stores-action-queue", period_start: period \},\n\s+\{ newTab: true \}/);
  assert.match(sources.ms, /\{ lens: "qc-action-queue", period_start: period \},\n\s+\{ newTab: true \}/);
  for (const id of ["materials-stores-action-queue", "qc-action-queue"]) assert.ok(LENS_REGISTRY[id], id);
});

test("File ownership: only the three controllers (plus this package's tests/docs) change versus the base", () => {
  // Permanent squash-merge range of N3 (#134) on main: N1 merge 85a163f -> N3 squash 55acfce. These commits are part of
  // main's history (not feature-branch heads), so a full clone has them; later N2/N4 changes are never attributed to N3.
  // A missing object (shallow clone) is an explicit FAILURE, never a silent skip: run `git fetch --unshallow`.
  const base = "85a163f2bc36476953939bfb637b81f632d6b9b9";
  const packageHead = "55acfcfebeeddf5396c4198e0691a56d9b70162e";
  for (const sha of [base, packageHead]) {
    try {
      execSyncImpl(`git cat-file -e ${sha}^{commit}`, { cwd: root, stdio: "pipe" });
    } catch {
      assert.fail(`historical ownership guard needs commit ${sha} (full git history). Shallow or partial clone? Run: git fetch --unshallow`);
    }
  }
  const changed = execSyncImpl(`git diff --name-only ${base} ${packageHead} -- . ":(exclude)scripts/costing-cross-links" ":(exclude)docs"`, { cwd: root, encoding: "utf8" })
    .split("\n").filter(Boolean);
  assert.ok(changed.length > 0, "N3 historical package diff must not be empty");
  const allowed = new Set([
    `${JS}/costing-suite-scheme-comparison.js`,
    `${JS}/costing-suite-qc-action-queue.js`,
    `${JS}/costing-suite-materials-stores-action-queue.js`,
  ]);
  for (const f of changed) assert.ok(allowed.has(f), `unexpected change: ${f}`);
});
