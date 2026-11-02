// CW-13: responsive hardening for the six Costing suite pages.
// Static CSS contract tests always run. Browser checks need Playwright (chromium) and are skipped, not failed,
// when it is unavailable; set COSTING_RESPONSIVE_SKIP=1 to skip them explicitly. No network, no Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { LONG_RUN_STATUS_TEXT, PAGES, WIDTHS, audit, launchAudit, measureHtml, openAuditPage } from "./responsive-audit.mjs";
import { describeRunStatusPopover, installRunStatusPopover } from "../../public/shared/js/costing-run-status-popover.js";
import { applyCw07Labels } from "../lib/costing-scope-guard.mjs";
import { applyRunStatusDataset } from "../../public/shared/js/costing-run-status-badge.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const SKIP_BROWSER = process.env.COSTING_RESPONSIVE_SKIP === "1";
const css = read("public/shared/css/sasv-costing.css");
const block = css.slice(css.indexOf("CW-13: responsive hardening"));

test("harness covers exactly the six Costing suite pages and the five audited widths", () => {
  const routePaths = Object.values(COSTING_ROUTE_CONFIG).map((c) => c.routePath.replace(/^public\//, "")).sort();
  assert.deepEqual(PAGES.map(([, rel]) => rel).sort(), routePaths);
  assert.equal(PAGES.length, 6);
  assert.deepEqual(WIDTHS, [320, 390, 520, 768, 900, 1280]);
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

const stripVarFallbacks = (css) => css.replace(/var\((?:[^()]|\([^()]*\))*\)/g, "var()");

test("compact mobile header CSS: same row, smaller title, 32 px targets, wrap only when the title would be squeezed", () => {
  const m = block.match(/@media \(max-width: 520px\) \{\s*\/\* Same-row compact header[\s\S]*?\n\}\n/)[0];
  assert.match(m, /body\.sasv-costing \.page-header \{\s*flex-wrap: wrap;/);
  assert.match(m, /\.page-header > div:first-child \{\s*flex: 1 1 6rem;\s*min-width: 0;/);
  assert.match(m, /\.page-header > div:last-child \{\s*flex: 0 0 auto;\s*flex-wrap: nowrap;/);
  assert.match(m, /\.page-header h1\.sasv-module-title \{\s*font-size: 13px;\s*line-height: 1\.2;\s*white-space: normal;/);
  assert.match(m, /width: 32px;\s*height: 32px;\s*min-width: 32px;/);
  assert.match(m, /body\.sasv-costing\.sc-run-status-btn-ready \.page-header \.sc-run-status \{\s*display: none;/);
  assert.match(m, /body\.sasv-costing \.sc-run-status-btn:not\(\[hidden\]\) \{\s*display: inline-flex;/);
  assert.doesNotMatch(stripVarFallbacks(block), /#[0-9a-fA-F]{3,6}\b/, "design tokens (with fallbacks only inside var()), no new literal colours");
});

test("run-status icon button CSS: hidden by default and above 520 px, status-coded, focus ring, popover bounded", () => {
  assert.match(block, /body\.sasv-costing \.sc-run-status-btn \{\s*display: none;/);
  for (const tone of ["approved", "approved-pending", "draft", "empty"]) assert.match(block, new RegExp(`\\.sc-run-status-btn\\[data-tone="${tone}"\\]`));
  assert.match(block, /\.sc-run-status-btn:focus-visible \{\s*outline: 2px solid var\(--sasv-action-primary\);/);
  assert.match(block, /\.sc-run-status-popover \{\s*position: fixed;[\s\S]*width: min\(92vw, 320px\);\s*max-height: 60vh;\s*overflow: auto;/);
  assert.match(block, /\.sc-run-status-popover\[hidden\] \{\s*display: none;/);
});

test("freshness indicator retired by CSS only: element kept as an inert anchor; Refresh, run-status badge and shell untouched", () => {
  assert.match(block, /body\.sasv-costing #lastRefreshed \{\s*display: none;/);
  for (const [, rel] of PAGES) assert.match(read(`public/${rel}`), /id="lastRefreshed"/, `${rel} keeps the anchor element`);
  const shell = read("public/shared/js/costing-suite-shell.js");
  // CW-07 (cost-sheet terminology) renames one toast label in the shell; its helper is applied to the base text so the
  // shell may differ from the baseline by exactly that rename and nothing else.
  const baseShell = execFileSync("git", ["show", "28cfadb20de3e2f3daf0aadada096f541254819d:public/shared/js/costing-suite-shell.js"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n");
  assert.equal(shell, applyCw07Labels(baseShell), "shell unchanged apart from the CW-07 label rename (no null-safety risk introduced)");
  assert.match(shell, /const runStatusBadge = createRunStatusBadge\(\{ supabase, anchor: lastRefreshed \}\);/, "badge still anchors on the (hidden) element");
  assert.match(shell, /setVisible\(lastRefreshed, true\);/);
  assert.match(shell, /id="refreshBtn"|const refreshBtn = \$\("refreshBtn"\)/);
});

test("entry files load the popover module on all six pages", () => {
  for (const name of ["costing-control-center", "cost-build-manager", "cost-sheet-review", "material-cost-manager", "pricing-policy-manager", "production-route-manager"]) {
    const src = read(`public/shared/js/${name}-entry.js`);
    assert.match(src, /import "\.\/costing-run-status-popover\.js";/, name);
    assert.match(src, new RegExp(`bootstrapCostingSuite\\("${name}"\\);`), name);
  }
});

test("popover content is derived from the badge facts: state word, run ids, valuation dates, explicit not-approved warning", () => {
  const approved = describeRunStatusPopover({ tone: "approved", text: "Approved run 143", title: "Approved run 143. Approved 31 Oct 2026 10:00 IST by Ravi.", runDisplayed: "143", runApproved: "143", valuationApproved: "2026-10-31" });
  assert.equal(approved.state, "APPROVED");
  assert.deepEqual(approved.rows.map((r) => [r.label, r.value]), [["Label", "Approved run 143"], ["Displayed run", "143"], ["Approved run", "143"], ["Approved run valuation date", "2026-10-31"]]);
  assert.equal(approved.warning, "");
  assert.equal(approved.notApproved, false);
  assert.match(approved.buttonLabel, /^Run status: APPROVED\. Approved run 143$/);
  const pending = describeRunStatusPopover({ tone: "approved-pending", text: "Approved 143", runDisplayed: "143", runApproved: "143", runDraft: "148", valuationDraft: "2026-11-01" });
  assert.equal(pending.notApproved, true);
  assert.match(pending.warning, /newer draft run is not approved/i);
  assert.ok(pending.rows.some((r) => r.label === "Newer draft run" && r.value === "148"));
  assert.ok(pending.rows.some((r) => r.label === "Draft run valuation date" && r.value === "2026-11-01"));
  const draft = describeRunStatusPopover({ tone: "draft", text: "DRAFT run 148 - not approved", runDisplayed: "148" });
  assert.equal(draft.state, "DRAFT");
  assert.match(draft.warning, /^Not approved\. Figures are a draft and are not approved for pricing\.$/);
  const empty = describeRunStatusPopover({ tone: "empty", text: "Run status unavailable" });
  assert.equal(empty.notApproved, true);
  assert.match(empty.warning, /No approved run/);
  assert.equal(describeRunStatusPopover({ tone: "something-new", text: "x" }).tone, "draft", "unknown tone is treated as not approved");
  assert.equal(describeRunStatusPopover({}).tone, "empty");
});

test("badge dataset helper writes only data-* values from the governed row and clears absent ones; no DOM text or label change", () => {
  const el = { dataset: { stale: "keep", runDraft: "9", valuationDraft: "old" } };
  applyRunStatusDataset(el, { display_state: "APPROVED_NEWER_DRAFT", displayed_run_id: 143, approved_run_id: 143, newer_draft_run_id: 148, approved_run_valuation_date: "2026-10-31", latest_draft_valuation_date: null });
  assert.deepEqual({ ...el.dataset }, { stale: "keep", displayState: "APPROVED_NEWER_DRAFT", runDisplayed: "143", runApproved: "143", runDraft: "148", valuationApproved: "2026-10-31" });
  applyRunStatusDataset(el, null);
  assert.deepEqual({ ...el.dataset }, { stale: "keep" });
  assert.doesNotThrow(() => applyRunStatusDataset(null, {}));
  assert.doesNotThrow(() => applyRunStatusDataset({}, {}));
  assert.equal(installRunStatusPopover(null, null), null, "no document: no-op");
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

const CHIP_PAGES = ["costing-control-center", "cost-sheet-review"]; // default lens is run-scoped, so the badge exists
const pageRel = (name) => PAGES.find(([n]) => n === name)[1];

test("browser: compact header on all six pages at 320/390/520 px: one row, small title, 32 px targets, no freshness chip, Refresh present, no errors", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const res = await audit({ widths: [320, 390, 520], focus: false });
  if (res.skipped) return t.skip(res.skipped);
  assert.equal(res.results.length, PAGES.length * 3);
  const bad = [];
  for (const r of res.results) {
    const c = r.compact;
    const problems = [];
    if (!c.sameRow) problems.push("title and Home not on one row");
    if (c.titleFontPx > 14) problems.push(`title ${c.titleFontPx}px`);
    if (c.smallestControl < 32) problems.push(`control ${c.smallestControl}px`);
    if (c.headerHeight > 70) problems.push(`header ${c.headerHeight}px`);
    if (c.freshnessShown) problems.push("freshness chip visible");
    if (!c.refreshPresent) problems.push("Refresh missing");
    if (c.chipShown && c.runButtonShown) problems.push("chip and status button both shown");
    if (r.pageErrors.length) problems.push(`errors ${r.pageErrors.join("|")}`);
    if (problems.length) bad.push(`${r.page}@${r.width}: ${problems.join(", ")}`);
  }
  assert.deepEqual(bad, []);
});

test("browser: above 520 px nothing changes except the retired freshness chip: long chip stays, status button hidden (desktop semantics)", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const res = await audit({ widths: [768, 1280], focus: false });
  if (res.skipped) return t.skip(res.skipped);
  for (const r of res.results) {
    assert.equal(r.compact.runButtonShown, false, `${r.page}@${r.width}`);
    assert.equal(r.compact.freshnessShown, false, `${r.page}@${r.width}`);
    assert.equal(r.compact.refreshPresent, true);
    if (CHIP_PAGES.includes(r.page)) assert.equal(r.compact.chipShown, true, `${r.page}@${r.width} keeps the chip`);
  }
});

test("browser: the status icon button replaces the chip on phones for the run-scoped pages; the badge itself stays authoritative", async (t) => {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const res = await audit({ pages: PAGES.filter(([n]) => CHIP_PAGES.includes(n)), widths: [320, 390, 520], focus: false });
  if (res.skipped) return t.skip(res.skipped);
  for (const r of res.results) {
    assert.equal(r.compact.runButtonShown, true, `${r.page}@${r.width}`);
    assert.equal(r.compact.chipShown, false, `${r.page}@${r.width}`);
  }
});

async function withEnv(t, fn) {
  if (SKIP_BROWSER) return t.skip("COSTING_RESPONSIVE_SKIP=1");
  const env = await launchAudit();
  if (!env) return t.skip("playwright not available");
  try {
    await fn(env);
  } finally {
    await env.close();
  }
}

// Drives the REAL badge functions inside the page so the observer sees exactly what the shell would produce.
const applyRow = (page, row) =>
  page.evaluate(async (r) => {
    const m = await import("/shared/js/costing-run-status-badge.js");
    const badge = document.getElementById("costingRunStatusBadge");
    m.applyRunStatusDataset(badge, r);
    if (r) m.applyRunStatusBadge(badge, m.describeRunStatus(r), true);
    else m.applyRunStatusBadge(badge, null, false);
  }, row);

const APPROVED_ROW = { display_state: "APPROVED", display_label: "Approved run 143", displayed_run_id: 143, approved_run_id: 143, approved_at: "2026-10-31T10:00:00Z", approved_by: "Ravi", approved_run_valuation_date: "2026-10-31" };
const DRAFT_ROW = { display_state: "DRAFT", display_label: "DRAFT run 148 - not approved", displayed_run_id: 148, newer_draft_run_id: 148, latest_draft_valuation_date: "2026-11-01" };
const PENDING_ROW = { display_state: "APPROVED_NEWER_DRAFT", display_label: "Approved run 143 (newer DRAFT run 148 - not approved)", displayed_run_id: 143, approved_run_id: 143, newer_draft_run_id: 148, approved_run_valuation_date: "2026-10-31", latest_draft_valuation_date: "2026-11-01" };

test("browser: popover by mouse and keyboard (Enter, Space), Escape restores focus, outside click closes, status updates live", async (t) => {
  await withEnv(t, async (env) => {
    for (const name of CHIP_PAGES) {
      const { context, page, errors } = await openAuditPage(env, pageRel(name), { width: 390 });
      try {
        await page.waitForSelector("#costingRunStatusBtn:not([hidden])", { timeout: 10000 });
        const popVisible = () => page.evaluate(() => !document.getElementById("costingRunStatusPopover").hidden);
        assert.equal(await page.getAttribute("#costingRunStatusBtn", "aria-expanded"), "false");
        assert.equal(await page.getAttribute("#costingRunStatusBtn", "aria-haspopup"), "dialog");
        // Live status update: approved
        await applyRow(page, APPROVED_ROW);
        assert.equal(await page.getAttribute("#costingRunStatusBtn", "data-tone"), "approved");
        assert.match(await page.getAttribute("#costingRunStatusBtn", "aria-label"), /^Run status: APPROVED\. Approved run 143$/);
        await page.focus("#costingRunStatusBtn");
        await page.keyboard.press("Enter");
        assert.equal(await popVisible(), true, "Enter opens");
        assert.equal(await page.getAttribute("#costingRunStatusBtn", "aria-expanded"), "true");
        assert.equal(await page.evaluate(() => document.activeElement?.id), "costingRunStatusPopover", "focus moves into the popover");
        const text = await page.innerText("#costingRunStatusPopover");
        assert.match(text, /APPROVED/);
        assert.match(text, /Displayed run\s+143/);
        assert.match(text, /Approved run valuation date\s+2026-10-31/);
        assert.doesNotMatch(text, /Not approved/i, "no warning for an approved run");
        // Live update while open: newer draft exists -> explicit warning, tone changes
        await applyRow(page, PENDING_ROW);
        await page.waitForFunction(() => document.getElementById("costingRunStatusPopover").textContent.includes("newer draft run is not approved"));
        assert.match(await page.innerText("#costingRunStatusPopover"), /Newer draft run\s+148/);
        await page.keyboard.press("Escape");
        assert.equal(await popVisible(), false, "Escape closes");
        assert.equal(await page.evaluate(() => document.activeElement?.id), "costingRunStatusBtn", "focus restored to the button");
        assert.equal(await page.getAttribute("#costingRunStatusBtn", "aria-expanded"), "false");
        // Draft: Space opens, explicit not-approved warning, outside click closes
        await applyRow(page, DRAFT_ROW);
        assert.equal(await page.getAttribute("#costingRunStatusBtn", "data-tone"), "draft");
        await page.focus("#costingRunStatusBtn");
        await page.keyboard.press("Space");
        assert.equal(await popVisible(), true, "Space opens");
        const draftText = await page.innerText("#costingRunStatusPopover");
        assert.match(draftText, /DRAFT/);
        assert.match(draftText, /Not approved\. Figures are a draft and are not approved for pricing\./);
        assert.match(draftText, /Draft run valuation date\s+2026-11-01/);
        await page.mouse.click(5, 400);
        assert.equal(await popVisible(), false, "outside click closes");
        // Mouse toggle
        await page.click("#costingRunStatusBtn");
        assert.equal(await popVisible(), true);
        await page.click("#costingRunStatusBtn");
        assert.equal(await popVisible(), false);
        // Badge hidden (no status for the lens) hides the button
        await applyRow(page, null);
        await page.waitForSelector("#costingRunStatusBtn", { state: "hidden" });
        assert.deepEqual(errors, [], name);
      } finally {
        await context.close();
      }
    }
  });
});

test("browser: popover stays inside the viewport at 320 px with a long status; crossing 520 px closes it and restores the chip", async (t) => {
  await withEnv(t, async (env) => {
    const { context, page, errors } = await openAuditPage(env, pageRel("cost-sheet-review"), { width: 320 });
    try {
      await page.waitForSelector("#costingRunStatusBtn:not([hidden])");
      await applyRow(page, { ...PENDING_ROW, display_label: LONG_RUN_STATUS_TEXT });
      await page.click("#costingRunStatusBtn");
      const box = await page.evaluate(() => { const r = document.getElementById("costingRunStatusPopover").getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight }; });
      assert.ok(box.left >= 0 && box.right <= box.vw + 0.5 && box.top >= 0 && box.bottom <= box.vh, JSON.stringify(box));
      await page.setViewportSize({ width: 768, height: 900 });
      await page.waitForFunction(() => document.getElementById("costingRunStatusPopover").hidden);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("costingRunStatusBtn")).display), "none");
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".sc-run-status")).display !== "none"), true);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
});

test("browser: worklist flag ON (compact chip) and flag OFF both feed the same button; newer draft run is shown", async (t) => {
  await withEnv(t, async (env) => {
    for (const storage of [{}, { COSTING_REVIEW_WORKLIST_V1: "1" }]) {
      const { context, page, errors } = await openAuditPage(env, pageRel("costing-control-center"), { width: 390, storage });
      try {
        await page.waitForSelector("#costingRunStatusBtn:not([hidden])", { timeout: 10000 });
        await page.evaluate(async (row) => {
          const m = await import("/shared/js/costing-run-status-badge.js");
          const c = await import("/shared/js/costing-ccc-run-context.js");
          const badge = document.getElementById("costingRunStatusBadge");
          m.applyRunStatusDataset(badge, row);
          const info = m.describeRunStatus(row);
          if (new URLSearchParams(location.search).get("compact") === "1") return;
          if (localStorage.getItem("COSTING_REVIEW_WORKLIST_V1") === "1") m.applyCompactRunStatusBadge(badge, c.describeCompactRunBadge(row), info);
          else m.applyRunStatusBadge(badge, info, true);
        }, PENDING_ROW);
        await page.click("#costingRunStatusBtn");
        const text = await page.innerText("#costingRunStatusPopover");
        assert.match(text, /Newer draft run\s+148/, JSON.stringify(storage));
        assert.match(text, /newer draft run is not approved/i);
        assert.equal(await page.evaluate(() => document.body.classList.contains("ccc-compact-header")), Boolean(storage.COSTING_REVIEW_WORKLIST_V1));
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    }
  });
});

test("browser: Refresh remains an operational control and the retired freshness UI leaves no focusable or announced remnant", async (t) => {
  await withEnv(t, async (env) => {
    for (const [name, rel] of PAGES) {
      const { context, page, errors } = await openAuditPage(env, rel, { width: 390 });
      try {
        const info = await page.evaluate(() => {
          const el = document.getElementById("lastRefreshed");
          const r = document.getElementById("refreshBtn");
          return { fresh: el ? { display: getComputedStyle(el).display, rect: el.getBoundingClientRect().width } : null, refresh: r ? { label: r.getAttribute("aria-label"), title: r.title, w: Math.round(r.getBoundingClientRect().width), visible: r.offsetParent !== null } : null };
        });
        assert.equal(info.fresh?.display, "none", `${name}: freshness chip not rendered`);
        assert.equal(info.fresh?.rect, 0);
        assert.ok(info.refresh?.visible, `${name}: Refresh visible`);
        assert.ok(info.refresh.label || info.refresh.title, `${name}: Refresh keeps its accessible name`);
        // Tabbing through the header never lands on the retired chip.
        const seen = [];
        for (let i = 0; i < 8; i += 1) { await page.keyboard.press("Tab"); seen.push(await page.evaluate(() => document.activeElement?.id || "")); }
        assert.ok(!seen.includes("lastRefreshed"), `${name}: ${seen.join(",")}`);
        assert.deepEqual(errors, [], name);
      } finally {
        await context.close();
      }
    }
  });
});
