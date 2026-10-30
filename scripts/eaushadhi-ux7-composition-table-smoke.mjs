/** UX-7 composition table/modal contract: static production checks plus responsive DOM smoke. */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8");
const js = read("public/shared/js/eaushadhi-review-control.js");
const css = read("public/shared/css/sasv-eaushadhi-review.css");
const html = read("public/shared/e-aushadhi-review-control.html");
const helpers = read("public/shared/js/eaushadhi-review-helpers.js");
let passed = 0;
let failed = 0;
function check(ok, label) {
  if (ok) { passed += 1; console.log(`OK ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}`); }
}
function block(start, end) {
  const from = js.indexOf(start);
  const to = js.indexOf(end, from + start.length);
  return from >= 0 && to > from ? js.slice(from, to) : "";
}

const table = block("function compositionTableRowHtml(", "function visibleCompositionRows(");
const render = block("function renderComposition({", "function appendCompositionChunk(");
const nav = block("function compositionModalNavigation(", "function refreshCompositionLineModal(");
const modal = block("function openCompositionLineModal(", "async function loadMyRoles(");
const reload = block("async function reloadSelected(", "async function persistLine(");
const approve = block("async function submitLine(", "function handleCompositionLineChange(");
const reopen = block("async function submitReopen(", "function renderVerifyReviewedBody(");
const globalKeys = block('document.addEventListener("keydown"', "window.addEventListener(");

check(js.includes("function renderCompositionLegacy()"), "existing line-card renderer is retained as the single editor markup source");
check(render.includes("state.compositionLineHtml = new Map"), "line editor markup is reused in the modal");
check(render.includes('search: "", reviewLens: "all", attention: "all"') && render.includes("state.compositionView = activeView"), "modal editor cache survives a row leaving the active filter");
check(render.includes('<table class="data-table composition-table"'), "Composition renders a compact semantic table");
for (const label of ["Line", "Ingredient", "Part used", "Quantity", "Mapping", "Review", "Attention"]) {
  check(render.includes(`<th${label === "Line" || label === "Ingredient" || label === "Review" || label === "Attention" ? "" : ` class=\"composition-col-${label === "Part used" ? "part" : label.toLowerCase()}\"`}>${label}</th>`) || render.includes(`>${label}</th>`), `${label} column is present`);
}
check(table.includes('aria-haspopup="dialog"'), "rows expose their dialog behaviour");
check(table.includes('tabindex="-1"'), "rows participate in roving keyboard focus");
check(table.includes("raw_scientific_name"), "ingredient cell includes botanical/scientific name");
check(table.includes("raw_part_used"), "part-used value is displayed");
check(table.includes("formatRawQuantityDisplay"), "quantity and unit use the existing display helper");
check(table.includes("compositionMappingSummary"), "mapping label comes from the dedicated existing-decision summary");
const mapping = block("function compositionMappingSummary(", "function compositionFilteredLines(");
check(mapping.includes("lineSelectionsComplete(draft)"), "mapping summary uses the existing mapping completeness decision");
check(mapping.includes("referenceMapping?.reference_ready !== true"), "mapping summary uses the existing reference readiness decision");
check(!mapping.toLowerCase().includes("verified"), "mapping labels never imply verification");
check(table.includes("reviewStatusChipClass(row.review_status)"), "Review remains the only verified-status badge");
check(render.includes("filtered.slice(0, state.compositionView.renderedCount)"), "table is progressively rendered");
check(helpers.includes("QUEUE_RENDER_CHUNK = 40"), "progressive chunk size stays 40 rows");
check(js.includes("shouldAppendQueueChunk") && js.includes("appendCompositionChunk()"), "workspace scrolling appends the next table chunk");
check(nav.includes("compositionModalFilteredIds()"), "modal navigation follows the full filtered list");
check(js.includes("compositionModalOrder") && modal.includes("compositionFilteredLines().map"), "modal preserves its opening filtered order by stable line ID");
check(nav.includes("index > 0") && nav.includes("index < ids.length - 1"), "Previous and Next have bounded filtered-order targets");
check(nav.includes("!isVerifiedStatus(row.review_status)"), "Next line needing review skips verified lines");
check(!nav.includes("ids.slice(0,"), "Next line needing review does not wrap backwards");
check(modal.includes("Next line needing review"), "modal contains the requested review navigation button");
check(modal.includes("handleCompositionLineChange") && modal.includes("handleCompositionLineClick"), "modal delegates to shared line handlers");
check((js.match(/handleCompositionLineClick\(event\)/g) || []).length === 2, "tab and modal each invoke the shared click handler once");
check(js.includes("if (handleCompositionLineClick(event)) return;"), "handled tab clicks cannot fall through and double-fire");
check(modal.includes("requestCloseCompositionLineModal"), "close controls use the dirty-exit path");
check(js.includes("flushDebounced(autosaveTimers, `line:${id}`)") && js.includes("waitLineIdle(id)"), "dirty exit flushes and waits for existing autosave");
check(js.includes('okLabel: "Leave without saving"') && js.includes('cancelLabel: "Stay"'), "dirty exit reuses Stay/Leave without saving");
check(approve.includes("focusLineId: lineId") && approve.includes("focusNext: true"), "Approve keeps the same line open and moves focus to Next");
check(!approve.includes("navigateCompositionLineModal"), "Approve never auto-advances");
check(reload.includes("focusCompositionRow(focusLineId") && reload.includes("openCompositionLineModal(focusLineId"), "focusLineId restores the row and opens its modal");
check(!reopen.includes("document.querySelector(`.line-card"), "Reopen no longer directly focuses a removed stacked card");
check(js.includes("state.compositionModalLineId") && js.includes("sourceResolveBackdrop"), "nested-dialog keyboard routing is aware of the line modal");
check(globalKeys.indexOf('$("sourceCorrectBackdrop")') < globalKeys.indexOf("state.compositionModalLineId"), "Correct receives Esc before the parent line modal");
check(globalKeys.indexOf('$("sourceResolveBackdrop")') < globalKeys.indexOf("state.compositionModalLineId"), "Resolve receives Esc before the parent line modal");
check(globalKeys.indexOf("state.reopen.open") < globalKeys.indexOf("state.compositionModalLineId"), "Reopen receives Esc before the parent line modal");
check(js.lastIndexOf("state.postEntryReconcile.open") < js.lastIndexOf('if (state.compositionModalLineId'), "Reconcile receives Esc before the parent line modal");
for (const closer of ["closeSourceCorrect", "closeSourceResolve", "closeReopen", "closePostEntryReconcile"]) {
  const closeBlock = block(`function ${closer}(`, "\n}");
  check(closeBlock.includes("trigger") && closeBlock.includes(".focus"), `${closer} restores focus to its triggering modal button`);
}
check(css.includes(".composition-table-wrap") && css.includes("overflow-x: hidden"), "table wrapper cannot create horizontal scrolling");
check(css.includes(".composition-table") && css.includes("table-layout: fixed"), "table uses a bounded fixed layout");
check(css.includes(".composition-table th") && css.includes("position: sticky"), "table header stays visible in the one workspace scroll area");
check(css.includes("@media (max-width: 980px)") && css.includes(".composition-col-mapping"), "narrow layout removes the mapping summary column");
check(css.includes(".composition-col-part") && css.includes(".composition-col-quantity"), "small layout removes secondary part and quantity columns");
check(css.includes("#sourceCorrectBackdrop:not([hidden])") && css.includes("calc(var(--sasv-z-modal) + 1)"), "nested dialogs stack above the line modal");
check(html.includes('id="workspaceScroll" class="workspace-scroll"'), "the existing workspace scroll container is unchanged");
check(!js.includes("hub-cache-v377") && read("public/sw.js").includes("hub-cache-v376"), "cache remains hub-cache-v376");
check(!js.includes("combined approve") && !modal.includes("Approve all"), "no combined approval action was added");
check(js.includes("isFirstControlledEntryProduct") && js.includes("931"), "controlled product 262/line 931 path remains present");

let require = createRequire(join(root, "package.json"));
let chromium;
try { ({ chromium } = require("playwright-core")); }
catch { require = createRequire(join(root, "..", "daily-worklog-app", "package.json")); ({ chromium } = require("playwright-core")); }
const executablePath = process.env.UX7_BROWSER_PATH || [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find(existsSync);
if (!executablePath) throw new Error("Set UX7_BROWSER_PATH to an installed Chromium browser; no downloads are performed.");
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  for (const [width, height] of [[1366, 768], [600, 768]]) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>${css}</style><body class="sasv-eaushadhi-review"><div id="workspaceScroll" class="workspace-scroll" style="width:100%;height:500px"><div class="composition-table-wrap"><table class="composition-table"><thead><tr><th>Line</th><th>Ingredient</th><th class="composition-col-part">Part used</th><th class="composition-col-quantity">Quantity</th><th class="composition-col-mapping">Mapping</th><th>Review</th><th>Attention</th></tr></thead><tbody><tr class="composition-table-row" tabindex="0"><td>931</td><td><span class="line-ingredient">A deliberately long ingredient name that must wrap</span><span class="line-scientific">Botanical name</span></td><td class="composition-col-part">Whole plant</td><td class="composition-col-quantity">10 milligrams</td><td class="composition-col-mapping">Reference pending</td><td>Pending</td><td>Clear</td></tr></tbody></table></div></div></body>`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}x${height}: Composition table creates no horizontal page scroll`);
    check(await page.locator("#workspaceScroll").evaluate((el) => el.scrollWidth <= el.clientWidth), `${width}x${height}: Composition table creates no horizontal workspace scroll`);
  }
} finally {
  await browser.close();
}

console.log(`UX-7 composition table checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
