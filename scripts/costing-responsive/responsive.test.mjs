// CW-13: responsive hardening for the six Costing suite pages.
// Static CSS contract tests always run. Browser checks need Playwright (chromium) and are skipped, not failed,
// when it is unavailable; set COSTING_RESPONSIVE_SKIP=1 to skip them explicitly. No network, no Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { LONG_RUN_STATUS_TEXT, PAGES, WIDTHS, audit, measureHtml } from "./responsive-audit.mjs";

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

test("long run-status chip: Home and the other header actions stay inside the header and the viewport (CW-13 follow-up CSS)", () => {
  assert.match(block, /body\.sasv-costing \.page-header > div:last-child \{\s*min-width: 0;\s*max-width: 100%;\s*\}/);
  assert.match(block, /body\.sasv-costing \.page-header \.sc-run-status:not\(\[data-compact="1"\]\) \{\s*max-width: 100%;\s*min-width: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;/);
  assert.match(block, /@media \(max-width: 900px\) \{\s*body\.sasv-costing \.page-header > div:last-child \{\s*flex: 0 1 auto;\s*flex-wrap: wrap;\s*justify-content: flex-end;/);
  assert.doesNotMatch(block, /overflow-x:\s*hidden|!important/);
});

test("detector self-test: a header whose actions run past the header edge is reported as clipped", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const html = `<div style="padding:0 40px"><div class="page-header" style="display:flex;width:300px"><div><h1>T</h1></div><div class="header-actions" style="display:flex;gap:8px"><button style="width:120px">a</button><span class="sc-run-status" style="white-space:nowrap;width:200px">${LONG_RUN_STATUS_TEXT}</span><button id="homeBtn" style="width:42px">h</button></div></div></div>`;
  const bad = await measureHtml(html);
  if (bad.skipped) return t.skip(bad.skipped);
  assert.ok(bad.clippedActions.length >= 1, JSON.stringify(bad.clippedActions));
  const ok = await measureHtml('<div class="page-header" style="display:flex;width:300px"><div><h1>T</h1></div><div class="header-actions" style="display:flex;gap:8px"><button id="homeBtn" style="width:42px">h</button></div></div>');
  assert.deepEqual(ok.clippedActions, []);
});

test("browser: with a long realistic run-status chip no header action (Home included) is clipped and no page overflows, six pages x five widths", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const res = await audit({ focus: false, stressChip: true });
  if (res.skipped) return t.skip(res.skipped);
  assert.equal(res.results.length, PAGES.length * WIDTHS.length);
  const bad = res.results.filter((r) => r.clippedActions.length || r.pageOverflow || r.headerOverlaps.length);
  assert.deepEqual(bad.map((r) => `${r.page}@${r.width}: clipped=${r.clippedActions.join("|")} overflow=${r.pageOverflow}`), []);
});

test("browser: Home button on Cost Sheet Review is fully visible and clickable-sized at 390 and 520 px (also with the long chip)", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  for (const stressChip of [false, true]) {
    const res = await audit({ pages: PAGES.filter(([n]) => n === "cost-sheet-review"), widths: [390, 520], focus: false, stressChip });
    if (res.skipped) return t.skip(res.skipped);
    for (const r of res.results) {
      assert.deepEqual(r.clippedActions, [], `${r.width}px stress=${stressChip}`);
      assert.equal(r.pageOverflow, false, `${r.width}px stress=${stressChip}`);
    }
  }
});
