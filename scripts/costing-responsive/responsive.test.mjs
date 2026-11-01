// CW-13: responsive hardening for the six Costing suite pages.
// Static CSS contract tests always run. Browser checks need Playwright (chromium) and are skipped, not failed,
// when it is unavailable; set COSTING_RESPONSIVE_SKIP=1 to skip them explicitly. No network, no Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { PAGES, WIDTHS, audit, measureHtml } from "./responsive-audit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const SKIP_BROWSER = process.env.COSTING_RESPONSIVE_SKIP === "1";
const css = read("public/shared/css/sasv-costing.css");
const block = css.slice(css.indexOf("CW-13: responsive hardening"));

test("harness covers exactly the six Costing suite pages and the five audited widths", () => {
  const routePaths = Object.values(COSTING_ROUTE_CONFIG).map((c) => c.routePath.replace(/^public\//, "")).sort();
  assert.deepEqual(PAGES.map(([, rel]) => rel).sort(), routePaths);
  assert.equal(PAGES.length, 6);
  assert.deepEqual(WIDTHS, [390, 520, 768, 900, 1280]);
  for (const [, rel] of PAGES) assert.ok(fs.existsSync(path.join(root, "public", rel)), rel);
});

test("CW-13 CSS is one appended block, every selector scoped to body.sasv-* Costing pages", () => {
  assert.ok(block.length > 300, "block present");
  assert.ok(css.indexOf("CW-13: responsive hardening") > css.indexOf("UX-F4: restrained worklist"), "appended after earlier blocks");
  const selectors = block.split("\n").filter((l) => /\{\s*$/.test(l) || /,\s*$/.test(l)).filter((l) => !/^\s*(@media|\/\*|\*|=)/.test(l));
  assert.ok(selectors.length >= 4);
  for (const l of selectors) {
    for (const part of l.replace(/\{\s*$/, "").split(",").map((x) => x.trim()).filter(Boolean)) {
      assert.match(part, /^body\.sasv-/, part);
    }
  }
  assert.doesNotMatch(block, /!important/);
  assert.doesNotMatch(block, /overflow-x:\s*hidden/, "never hide page overflow to pass the check");
});

test("narrow header: wraps actions under the title instead of clipping it; tokens only", () => {
  assert.match(block, /@media \(max-width: 520px\) \{[\s\S]*body\.sasv-costing \.page-header \{\s*flex-wrap: wrap;/);
  assert.match(block, /\.page-header > div:first-child \{\s*flex: 1 1 10rem;\s*min-width: 0;/);
  assert.match(block, /\.page-header h1\.sasv-module-title \{\s*white-space: normal;/);
  assert.match(block, /outline: 2px solid var\(--sasv-action-primary\);\s*outline-offset: 2px;/);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,6}\b/, "design tokens, not new literal colours");
});

test("keyboard focus: filter button and Production Route as-of date get a visible outline", () => {
  assert.match(block, /body\.sasv-costing \.peq-filter-btn:focus-visible,\s*body\.sasv-production-route-manager #prmAsOfDate:focus-visible \{/);
});

test("detector self-test: overflow, clipped title and header overlap are really detected (and a clean page is clean)", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const clean = await measureHtml('<div class="page-header"><h1>Short</h1></div><p>ok</p>');
  if (clean.skipped) return t.skip(clean.skipped);
  assert.equal(clean.pageOverflow, false);
  assert.equal(clean.titleClipped, false);
  const wide = await measureHtml('<div style="width:900px;height:20px">wide</div>');
  assert.equal(wide.pageOverflow, true);
  const clipped = await measureHtml('<div class="page-header" style="width:120px"><h1 style="white-space:nowrap;overflow:hidden;width:100px">A very long module title that cannot fit</h1></div>');
  assert.equal(clipped.titleClipped, true);
  const overlap = await measureHtml('<div class="page-header"><h1 style="position:absolute;left:10px;top:10px">Title</h1><div class="header-actions"><button style="position:absolute;left:12px;top:40px;width:60px;height:20px">x</button></div></div>');
  assert.ok(overlap.headerOverlaps.length >= 1);
});

test("browser: six Costing pages at 390/520/768/900/1280 px have no page overflow, clipped title or header overlap", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const res = await audit({ focus: false });
  if (res.skipped) return t.skip(res.skipped);
  assert.equal(res.results.length, PAGES.length * WIDTHS.length);
  const bad = res.results.filter((r) => r.pageOverflow || r.titleClipped || r.headerOverlaps.length || r.pageErrors.length);
  assert.deepEqual(bad.map((r) => `${r.page}@${r.width}: overflow=${r.pageOverflow} clip=${r.titleClipped} overlaps=${r.headerOverlaps.join("|")} errors=${r.pageErrors.join("|")}`), []);
});

test("browser: keyboard focus is visible on every tabbed control (six pages, desktop and phone)", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const res = await audit({ widths: [390, 1280] });
  if (res.skipped) return t.skip(res.skipped);
  const bad = res.results.filter((r) => r.focusProblems.length);
  assert.deepEqual(bad.map((r) => `${r.page}@${r.width}: ${r.focusProblems.map((f) => f.id || f.cls).join(",")}`), []);
});
