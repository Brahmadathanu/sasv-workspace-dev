// Reproducible screenshot set of representative populated screens (synthetic data only).
// Usage: node scripts/costing-preview/capture-screenshots.mjs <output-dir>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const out = process.argv[2];
if (!out) throw new Error("output directory required");
mkdirSync(out, { recursive: true });
const server = await createReadOnlyLoopbackServer();
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const SHOTS = [
  ["01-launcher-desktop", "/__preview/", {}],
  ["02-ccc-dashboard-nov-failed-run", "/shared/costing-control-center.html", { flags: ["COSTING_RUN_STATUS_V1"] }],
  ["03-ccc-dashboard-oct-approved-run", "/shared/costing-control-center.html", { period: "2026-10-01" }],
  ["04-ccc-sku-control-status", "/shared/costing-control-center.html?lens=sku-control-status", {}],
  ["05-ccc-sku-detail-modal", "/shared/costing-control-center.html?lens=sku-control-status", { click: "table tbody tr" }],
  ["06-ccc-control-workbench", "/shared/costing-control-center.html?lens=costing-review-workbench", {}],
  ["07-ccc-readiness", "/shared/costing-control-center.html?lens=portfolio-readiness", {}],
  ["08-mcm-manual-rate-manager", "/shared/material-cost-manager.html", {}],
  ["09-cbm-cost-governance", "/shared/cost-build-manager.html", {}],
  ["10-cbm-driver-governance", "/shared/cost-build-manager.html", { click: 'button[data-lens="driver-governance"]' }],
  ["11-ppm-sku-policy-overview-ik-ok", "/shared/pricing-policy-manager.html?workspace=sku-overview", {}],
  ["12-ppm-scheme-master", "/shared/pricing-policy-manager.html?workspace=scheme-master", {}],
  ["13-ppm-mrp-proposals", "/shared/pricing-policy-manager.html?workspace=mrp-proposals", {}],
  ["14-csr-sku-cost-details", "/shared/cost-sheet-review.html", {}],
  ["15-csr-cost-comparison", "/shared/cost-sheet-review.html", { click: 'button[data-lens="cost-comparison"]' }],
  ["16-csr-qc-action-queue", "/shared/cost-sheet-review.html", { click: 'button[data-lens="qc-action-queue"]' }],
  ["17-prm-route-readiness", "/shared/production-route-manager.html", {}],
  ["18-prm-route-families", "/shared/production-route-manager.html", { click: 'button[data-lens="route-families"]' }],
  ["19-prm-unsupported-workload-preview-honest", "/shared/production-route-manager.html", { click: 'button[data-lens="shared-workload-preview"]' }],
  ["20-nav-flat-off", "/shared/costing-control-center.html?lens=sku-control-status", { clip: { x: 0, y: 260, width: 1280, height: 150 } }],
  ["21-nav-only-on", "/shared/costing-control-center.html?lens=sku-control-status", { flags: ["COSTING_NAV_GROUPS_V1"], clip: { x: 0, y: 260, width: 1280, height: 150 } }],
  ["22-mobile-390-cost-comparison", "/shared/cost-sheet-review.html", { width: 390, select: ["#lensSelect", "cost-comparison"] }],
  ["23-mobile-390-ppm-overview", "/shared/pricing-policy-manager.html?workspace=sku-overview", { width: 390 }],
  ["24-mobile-390-launcher", "/__preview/", { width: 390 }],
];
for (const [name, path, o] of SHOTS) {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: o.width ?? 1280, height: o.width ? 844 : 900 }, deviceScaleFactor: 1 });
  await context.addInitScript((list) => { for (const f of list) localStorage.setItem(f, "1"); }, o.flags ?? []);
  const page = await context.newPage();
  await page.goto(base + path);
  await page.waitForTimeout(1700);
  if (o.period) { await page.selectOption("#costingPeriodSelect", o.period); await page.waitForTimeout(1500); }
  if (o.select) { await page.locator(o.select[0]).selectOption(o.select[1]); await page.waitForTimeout(1300); }
  if (o.click) { await page.locator(o.click).first().click(); await page.waitForTimeout(1300); }
  await page.screenshot({ path: out + "/" + name + ".jpg", type: "jpeg", quality: 72, clip: o.clip });
  await context.close();
}
await browser.close();
await new Promise((r) => server.close(r));
console.log("wrote " + SHOTS.length + " screenshots to " + out);
