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
const refreshModal = block("function refreshCompositionLineModal(", "function closeCompositionLineModalNow(");
const modal = block("function openCompositionLineModal(", "async function loadMyRoles(");
const legacy = block("function renderCompositionLegacy(", "function compositionMappingSummary(");
const reload = block("async function reloadSelected(", "async function persistLine(");
const approve = block("async function submitLine(", "function handleCompositionLineChange(");
const reopen = block("async function submitReopen(", "function renderVerifyReviewedBody(");
const globalKeyStart = js.lastIndexOf('document.addEventListener("keydown", (event) => {');
const globalKeys = globalKeyStart >= 0 ? js.slice(globalKeyStart, js.indexOf("window.addEventListener(", globalKeyStart)) : "";

check(js.includes("function renderCompositionLegacy()"), "existing line-card renderer is retained as the single editor markup source");
check(render.includes("state.compositionLineHtml = new Map"), "line editor markup is reused in the modal");
check(render.includes('search: "", reviewLens: "all", attention: "all"') && render.includes("state.compositionView = activeView"), "modal editor cache survives a row leaving the active filter");
check(render.includes('<table class="data-table composition-table"'), "Composition renders a compact semantic table");
for (const label of ["Line", "Ingredient", "Part used", "Quantity", "Mapping", "Review", "Attention"]) {
  check(render.includes(`<th${label === "Line" || label === "Ingredient" || label === "Review" || label === "Attention" ? "" : ` class=\"composition-col-${label === "Part used" ? "part" : label.toLowerCase()}\"`}>${label}</th>`) || render.includes(`>${label}</th>`), `${label} column is present`);
}
check(table.includes('aria-haspopup="dialog"'), "rows expose their dialog behaviour");
check(table.includes('tabindex="-1"'), "rows participate in roving keyboard focus");
check(table.includes('class="composition-col-ingredient"') && table.includes('class="composition-col-botanical"') && table.includes("raw_scientific_name"), "ingredient and botanical/scientific names use separate columns");
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
check(modal.includes("compositionLineModalSaveStatus") && modal.includes("compositionLineModalMessage") && modal.includes("compositionLineModalNavigation") && !modal.includes("compositionLineModalDone"), "footer has fixed save, message and navigation regions with no footer Close button");
check(modal.includes("compositionLineModalSummary") && legacy.includes("source-imported-details") && !legacy.includes("Imported source retained for audit") && !css.includes(".composition-line-summary > span:not(.status-chip) + span:not(.status-chip)::before"), "modal uses a separator-free header summary and collapsed imported-source details without repeated audit copy");
check(legacy.includes("Source wording") && legacy.includes("Standard reference work") && legacy.includes("Portal reference") && legacy.includes("Mapping status") && legacy.includes("No reference text was imported for this line."), "reference block uses the approved neutral labels and missing-source wording");
check(legacy.includes("line-action-layout") && legacy.includes("line-footer-message-source") && !legacy.includes("line-action-message") && css.includes("composition-line-footer-message"), "action buttons are stable and their one-line explanation is moved to the footer");
check(js.includes('id="srcCorrectIngredient"') && js.includes('id="srcCorrectScientific"') && js.includes('id="srcCorrectPart"') && js.includes('id="srcCorrectQtyText"'), "Correct source dialog retains the raw working-source values it needs");
check(js.includes("fetchSourceIssueContext(lineId)") && js.includes("ctx.raw_ingredient_name") && js.includes("ctx.raw_scientific_name") && js.includes("ctx.raw_part_used"), "Resolve source issue dialog retains fetched raw source evidence");
check(js.includes('role="status" aria-live="polite"') && css.includes(".ea-autosave.is-saving") && css.includes(".ea-autosave.is-saved") && css.includes(".ea-autosave.is-unsaved"), "line save status exposes Saving, Saved, Error and Unsaved presentation states");
check(modal.includes("handleCompositionLineChange") && modal.includes("handleCompositionLineClick"), "modal delegates to shared line handlers");
check((js.match(/handleCompositionLineClick\(event\)/g) || []).length === 2, "tab and modal each invoke the shared click handler once");
check(js.includes("if (handleCompositionLineClick(event)) return;"), "handled tab clicks cannot fall through and double-fire");
check((modal.match(/requestCloseCompositionLineModal/g) || []).length === 2 && modal.includes("if (event.target === backdrop)") && modal.includes("compositionLineModalClose") && !modal.includes("compositionLineModalDone"), "backdrop and top-right X use the dirty-exit path and footer Close is removed");
check(refreshModal.includes("requestAnimationFrame(() => dialog.focus())") && modal.indexOf("compositionLineModalClose") < modal.indexOf("compositionLineModalBody") && modal.indexOf("compositionLineModalNextReview") > modal.indexOf("compositionLineModalBody") && js.includes('trapModalTab(event, "compositionLineModalDialog")') && js.includes("void requestCloseCompositionLineModal()"), "dialog receives initial focus and the trap spans top-right X through the last navigation button while Esc settles the modal");
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
check(css.includes(".composition-table") && css.includes("table-layout: fixed") && css.includes(".composition-table tbody td") && css.includes("vertical-align: middle"), "table uses a bounded fixed layout with vertically centred body cells");
check(css.includes(".composition-table th") && css.includes("position: sticky"), "table header stays visible in the one workspace scroll area");
check(css.indexOf("@media (max-width: 1100px)") < css.indexOf("@media (max-width: 980px)") && css.includes(".composition-col-botanical") && css.includes(".composition-col-mapping"), "botanical column hides before the mapping summary column at narrow widths");
check(css.includes(".composition-col-part") && css.includes(".composition-col-quantity"), "small layout removes secondary part and quantity columns");
check(css.includes("#sourceCorrectBackdrop:not([hidden])") && css.includes("calc(var(--sasv-z-modal) + 1)") && css.includes(".reference-mapping-value") && !legacy.includes('Mapping status</span>${chip('), "nested dialogs stack correctly and reference mapping status is plain text rather than a chip");
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
  const page = await browser.newPage({ deviceScaleFactor: 1.25 });
  for (const [width, height] of [[1366, 768], [1024, 768], [600, 768]]) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>${css}</style><body class="sasv-eaushadhi-review"><div id="workspaceScroll" class="workspace-scroll" style="width:100%;height:500px"><div class="composition-table-wrap"><table class="composition-table"><thead><tr><th>Line</th><th>Ingredient</th><th class="composition-col-botanical">Botanical name</th><th class="composition-col-part">Part used</th><th class="composition-col-quantity">Quantity</th><th class="composition-col-mapping">Mapping</th><th>Review</th><th>Attention</th></tr></thead><tbody><tr class="composition-table-row" tabindex="0"><td>931</td><td><span class="line-ingredient">A deliberately long ingredient name that must wrap</span></td><td class="composition-col-botanical"><span class="line-scientific">Withania somnifera subspecies longissima botanical fixture</span></td><td class="composition-col-part">Whole plant</td><td class="composition-col-quantity">10 milligrams</td><td class="composition-col-mapping">Reference pending</td><td>Pending</td><td>Clear</td></tr></tbody></table></div><section class="reference-mapping-block"><div><span>Source wording</span><strong>-</strong></div><div><span>Standard reference work</span><strong>Not mapped</strong></div><div><span>Portal reference</span><strong>Not mapped</strong></div><div><span>Mapping status</span><span class="reference-mapping-value">Global reference mapping required</span></div><p class="reference-mapping-guidance">Reference mapping is managed in the Reference Dictionary tab.</p></section><div class="line-action-layout"><div class="line-action-buttons"><button>Save for review</button><button>Approve</button><button>Correct source</button></div></div></div><div class="sasv-modal__footer composition-line-modal-nav"><div class="composition-line-footer-status"><span class="ea-autosave is-saved">✓ Saved</span></div><div class="composition-line-footer-message" title="A different Approver must approve this line.">A different Approver must approve this line.</div><div class="composition-line-footer-navigation"><button>Previous</button><button>Next</button><button>Next line needing review</button></div></div></body>`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}x${height}: Composition table creates no horizontal page scroll`);
    check(await page.locator("#workspaceScroll").evaluate((el) => el.scrollWidth <= el.clientWidth), `${width}x${height}: Composition table creates no horizontal workspace scroll`);
    check(await page.locator(".composition-line-footer-navigation").evaluate((el, narrow) => getComputedStyle(el).flexWrap === (narrow ? "wrap" : "nowrap"), width <= 720), `${width}x${height} at 125%: footer navigation wraps only at narrow width`);
    check(await page.locator(".composition-table tbody .composition-col-botanical").evaluate((el, hidden) => hidden ? getComputedStyle(el).display === "none" : getComputedStyle(el).whiteSpace === "normal" && el.scrollWidth <= el.clientWidth && getComputedStyle(el.querySelector(".line-scientific")).color === getComputedStyle(el.closest("tr").querySelector(".composition-col-part")).color && ["none", "normal"].includes(getComputedStyle(el.querySelector(".line-scientific"), "::before").content), width <= 1100), `${width}x${height} at 125%: botanical text has no stray separator and matches other column text`);
    check(await page.locator(".composition-line-footer-message").evaluate((el) => getComputedStyle(el).whiteSpace === "nowrap" && el.getBoundingClientRect().height <= 24 && !document.querySelector(".line-action-layout .composition-line-footer-message")), `${width}x${height} at 125%: explanation stays one line in the fixed footer and never moves actions`);
  }
} finally {
  await browser.close();
}

console.log(`UX-7 composition table checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
