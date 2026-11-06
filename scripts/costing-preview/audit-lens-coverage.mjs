// R1 audit: drives the REAL six module pages in Chromium against the synthetic client, visits EVERY lens and
// Pricing Policy workspace, and records what each one reads and what it actually renders.
// Output (JSON) is the raw evidence for the coverage matrix; nothing here asserts PASS for an empty screen.
// Usage: node scripts/costing-preview/audit-lens-coverage.mjs [--out file.json] [--shots dir] [--flags nav|off|on] [--width 1280]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const arg = (name, fallback) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : fallback; };
const flagsMode = arg("flags", "off");
const width = Number(arg("width", "1280"));
const shots = arg("shots", "");
const ALL_FLAGS = ["COSTING_RECALC_WITH_DATE_V1", "COSTING_APPROVAL_SCREEN_V1", "COSTING_LOCK_SCREEN_V1", "COSTING_RUN_STATUS_V1",
  "COSTING_UX_CONSISTENCY_V1", "COSTING_DIALOGS_V1", "COSTING_TABLE_TOOLS_V1", "COSTING_REVIEW_WORKLIST_V1", "COSTING_NAV_GROUPS_V1",
  "COSTING_PRM_CORRECTIONS_V1", "COSTING_PRM_NAV_CONTEXT_V1"];
const flags = flagsMode === "on" ? ALL_FLAGS : flagsMode === "nav" ? ["COSTING_NAV_GROUPS_V1"] : [];
const MODULES = ["costing-control-center", "material-cost-manager", "cost-build-manager", "pricing-policy-manager", "cost-sheet-review", "production-route-manager"];
if (shots) mkdirSync(shots, { recursive: true });

export async function auditAll({ base, browser, flags: flagList = flags, width: viewport = width, shotsDir = shots } = {}) {
  const results = [];
  for (const module of MODULES) {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: viewport, height: viewport < 600 ? 844 : 900 } });
    await context.addInitScript((list) => { for (const f of list) localStorage.setItem(f, "1"); }, flagList);
    const page = await context.newPage();
    await page.goto(base + "/shared/" + module + ".html");
    await page.waitForFunction(() => !!window.__costingSyntheticPreview);
    await page.waitForTimeout(1500);
    const targets = await page.evaluate(() => [
      ...[...document.querySelectorAll("button[data-lens]")].map((b) => ({ kind: "lens", id: b.dataset.lens, label: b.textContent.trim() })),
      ...[...document.querySelectorAll("button[data-pricing-policy-workspace]")].map((b) => ({ kind: "workspace", id: b.dataset.pricingPolicyWorkspace, label: b.textContent.trim() })),
    ]);
    const seen = new Set();
    // The first lens renders on load; visit it by id like every other target.
    for (const target of targets) {
      if (seen.has(target.id)) continue; seen.add(target.id);
      const before = await page.evaluate(() => ({
        rpc: window.__costingSyntheticPreview.rpc.length, from: window.__costingSyntheticPreview.from.length,
        unsupported: window.__costingSyntheticPreview.unsupported.length, denied: window.__costingSyntheticPreview.deniedWrites.length,
      }));
      const selector = target.kind === "lens" ? 'button[data-lens="' + target.id + '"]' : 'button[data-pricing-policy-workspace="' + target.id + '"]';
      await page.locator(selector).first().click();
      await page.waitForTimeout(1300);
      const state = await page.evaluate((prior) => {
        const log = window.__costingSyntheticPreview;
        const root = document.querySelector("main, #app, .content, body");
        const text = (root?.innerText || "").replace(/\s+/g, " ");
        const visible = (el) => el.offsetParent !== null;
        const tables = [...document.querySelectorAll("table")].filter(visible);
        const rowCounts = tables.map((t) => t.querySelectorAll("tbody tr").length);
        return {
          reads: [...log.from.slice(prior.from).map((t) => "from:" + t), ...log.rpc.slice(prior.rpc).map((r) => "rpc:" + r.name)],
          unsupported: log.unsupported.slice(prior.unsupported),
          deniedWrites: log.denied?.length ?? log.deniedWrites.slice(prior.denied),
          failureBanner: (text.match(/(Failed to load[^.]*\.?[^.]*\.?|No synthetic fixture[^.]*\.|Unavailable[^.]*\.|Restricted[^.]*\.|Initialization error[^.]*\.)/i) || [null])[0],
          tableCount: tables.length, dataRows: rowCounts.reduce((a, b) => a + b, 0),
          emptyStateText: (text.match(/(No [a-z /-]{3,40} (found|available|to show)|Nothing to show)/i) || [null])[0],
          overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          charCount: text.length,
        };
      }, before);
      if (shotsDir) await page.screenshot({ path: shotsDir + "/" + module + "__" + target.id + "__" + viewport + ".png", fullPage: false });
      results.push({ module, ...target, ...state });
    }
    const permission = await page.evaluate(() => (document.body.innerText.match(/View-only access[^.]*\./i) || [null])[0]);
    results.push({ module, kind: "module", id: "(module)", viewOnlyNotice: permission });
    await context.close();
  }
  return results;
}

if (import.meta.url === "file://" + process.argv[1]) {
  const server = await createReadOnlyLoopbackServer();
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const results = await auditAll({ base, browser });
  const out = arg("out", "");
  if (out) writeFileSync(out, JSON.stringify({ flagsMode, width, results }, null, 2));
  for (const r of results.filter((x) => x.kind !== "module")) {
    console.log([r.module, r.id, "reads=" + r.reads.length, "unsupported=" + r.unsupported.length, "tables=" + r.tableCount, "rows=" + r.dataRows, "banner=" + (r.failureBanner ?? "none").slice(0, 60)].join(" | "));
  }
  await browser.close(); await new Promise((r) => server.close(r));
}
