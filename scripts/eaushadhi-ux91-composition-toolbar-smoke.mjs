/** UX-9.1 Composition toolbar, filter drawer and table-scroll contract. */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8");
const html = read("public/shared/e-aushadhi-review-control.html");
const js = read("public/shared/js/eaushadhi-review-control.js");
const css = read("public/shared/css/sasv-eaushadhi-review.css");
let passed = 0;
let failed = 0;
function check(ok, label) {
  if (ok) { passed += 1; console.log(`OK ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}`); }
}

check(html.includes('id="compositionToolbar"') && html.indexOf('id="compositionToolbar"') < html.indexOf('id="workspaceScroll"'), "Composition toolbar is outside the workspace/table scroll content");
check(html.includes('id="compositionFilterBtn"') && html.includes('aria-controls="compositionFilterDrawer"'), "filter button names and controls its drawer");
check(html.includes('id="compositionFilterBadge"') && js.includes("compositionActiveDrawerFilterCount"), "filter badge is backed by lens-only count logic");
check(html.includes('id="compositionFilterDrawer"') && html.includes('id="compositionReviewLenses"') && html.includes('id="compositionAttentionLenses"'), "existing lens IDs move into the drawer");
check(html.includes('id="btnClearCompositionFiltersDrawer"') && !html.includes('id="btnClearCompositionFiltersBar"'), "drawer owns the only toolbar Clear filters action");
check(!html.includes('id="openReferenceDictionaryFromCompositionBtn"') && !js.includes('$("openReferenceDictionaryFromCompositionBtn")'), "Composition Reference Dictionary shortcut and handler are removed");
check(html.includes('aria-describedby="compositionActionHint"') && html.includes('id="compositionActionHint"') && html.includes("composition-info-icon"), "Composition tab exposes the helper through an info tooltip");
check(js.includes("placeCompositionFilterPopover") && js.includes("setCompositionFiltersOpen") && js.includes('event.key === "Escape"'), "drawer has positioned Escape-close behaviour");
check(js.includes('document.addEventListener("pointerdown", onPointer, true)') && js.includes('button.focus()'), "outside click closes drawer and returns funnel focus");
check(js.includes("clear.disabled = !compositionFiltersAreActive(state.compositionView)"), "drawer Clear filters follows search or lens activity");
check(js.includes('event.target.id !== "compositionTableScroll"') && js.includes("appendCompositionChunk()"), "progressive rendering listens to the dedicated table scroller");
check(js.includes("state.compositionView.scrollTop = scroll.scrollTop") && js.includes("compositionScroll"), "table scroll position is captured and restored across reloads");
check(js.includes("focusCompositionRow(returnId, { scroll: false })") && js.includes("preventScroll"), "modal close restores row focus without moving the table scroll");
check(css.includes(".composition-table th") && css.includes("position: sticky") && css.includes("background: var(--sasv-surface-soft)"), "table header remains sticky and opaque");
check(css.includes(".composition-toolbar") && css.includes("flex-wrap: wrap") && css.includes(".composition-toolbar-actions"), "toolbar has an explicit responsive wrap layout");
check(css.includes(".ea-btn--primary") && css.includes(".ea-btn--secondary") && css.includes(".ea-btn--quiet") && css.includes(".ea-btn--danger") && css.includes(".ea-btn--icon"), "scoped button system defines every approved variant");
check(js.includes('id="sourceReferenceBulkClose"') && js.includes("source-reference-bulk-heading"), "bulk header uses a flexible title wrapper with close last");
check(css.includes(".source-reference-bulk-heading") && css.includes("flex: 1 1 auto") && css.includes("min-width: 0"), "bulk heading lets the close button sit at the far right");
check(!js.includes("globalThis.confirm") && js.includes('idPrefix: "sourceReferenceDiscard"'), "discard uses a nested in-page confirmation");
check(js.includes("event.stopImmediatePropagation()") && js.includes('cancelLabel: "Keep editing"'), "nested confirmation captures Escape before the bulk dialog");

let require = createRequire(join(root, "package.json"));
let chromium;
try { ({ chromium } = require("playwright-core")); }
catch { require = createRequire(join(root, "..", "daily-worklog-app", "package.json")); ({ chromium } = require("playwright-core")); }
const executablePath = process.env.UX91_BROWSER_PATH || ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
if (!executablePath) throw new Error("Set UX91_BROWSER_PATH to an installed Chromium browser; no downloads are performed.");
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1.25 });
  for (const width of [1366, 683]) {
    await page.setViewportSize({ width, height: 768 });
    await page.setContent(`<style>:root{--sasv-surface:#fff;--sasv-surface-soft:#f8fafc;--sasv-text:#172033;--sasv-border:#cbd5e1;--sasv-action-primary:#1769aa;--sasv-control-md:36px;--sasv-radius-sm:6px;--sasv-fw-semibold:600}.composition-table-row{height:32px}${css}</style><body class="sasv-eaushadhi-review"><div id="compositionToolbar" class="composition-toolbar"><button id="compositionFilterBtn" class="icon-btn ea-btn ea-btn--icon ea-btn--secondary" aria-expanded="false">F<span id="compositionFilterBadge" class="composition-filter-badge" hidden>0</span></button><div class="search-wrap"><input id="compositionSearch"></div><span id="compositionRowCount">Showing 40 of 80</span><div id="compositionToolbarActions" class="composition-toolbar-actions"><button class="icon-btn with-label ea-btn ea-btn--secondary">Set source reference</button></div><button id="btnVerifyReviewedLines" class="icon-btn with-label ea-btn ea-btn--primary">Approve reviewed lines</button></div><div id="compositionFilterDrawer" class="worklist-filter-popover" hidden><div class="worklist-filter-panel" tabindex="-1"><button id="lens">Pending</button><button id="clear" class="ea-btn ea-btn--quiet">Clear</button></div></div><div id="compositionTableScroll" class="composition-table-wrap" style="height:260px"><table class="composition-table"><thead><tr><th>Line</th><th>Ingredient</th></tr></thead><tbody id="rows"></tbody></table></div><div id="fixtureModal" hidden><button id="fixtureClose">Close</button></div><script>(()=>{const data=Array.from({length:80},(_,i)=>i+1);let shown=40;const rows=document.querySelector('#rows');function paint(){rows.innerHTML=data.slice(0,shown).map(i=>'<tr class="composition-table-row" data-line-id="'+i+'" tabindex="'+(i===1?'0':'-1')+'"><td>'+i+'</td><td>Ingredient '+i+'</td></tr>').join('')}paint();const scroll=document.querySelector('#compositionTableScroll');scroll.addEventListener('scroll',()=>{if(scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-4&&shown<80){const top=scroll.scrollTop;shown=Math.min(80,shown+40);paint();scroll.scrollTop=top}});rows.addEventListener('keydown',e=>{const row=e.target.closest('tr');if(!row)return;const all=[...rows.children];let i=all.indexOf(row);if(e.key==='ArrowDown'&&all[i+1]){e.preventDefault();row.tabIndex=-1;all[i+1].tabIndex=0;all[i+1].focus()}});let returnRow=null;rows.addEventListener('click',e=>{returnRow=e.target.closest('tr');document.querySelector('#fixtureModal').hidden=false});document.querySelector('#fixtureClose').onclick=()=>{const top=scroll.scrollTop;document.querySelector('#fixtureModal').hidden=true;returnRow.focus({preventScroll:true});scroll.scrollTop=top};const filter=document.querySelector('#compositionFilterBtn'),drawer=document.querySelector('#compositionFilterDrawer');filter.onclick=()=>{drawer.hidden=false;filter.setAttribute('aria-expanded','true');drawer.querySelector('button').focus()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden){e.stopPropagation();drawer.hidden=true;filter.setAttribute('aria-expanded','false');filter.focus()}},true);document.addEventListener('pointerdown',e=>{if(!drawer.hidden&&!drawer.contains(e.target)&&!filter.contains(e.target)){drawer.hidden=true;filter.setAttribute('aria-expanded','false');filter.focus()}},true)})();</script></body>`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px at 125%: toolbar/table create no horizontal page scroll`);
    check(await page.locator("#compositionTableScroll").evaluate((el) => el.scrollWidth <= el.clientWidth), `${width}px at 125%: table scroller has no horizontal overflow`);
    check(await page.locator(".composition-table th").first().evaluate((el) => { const s=getComputedStyle(el); return s.position==="sticky"&&s.top==="0px"&&s.backgroundColor!=="rgba(0, 0, 0, 0)"; }), `${width}px at 125%: table header is computed sticky and opaque`);
    check(await page.locator("#compositionToolbar").evaluate((host) => { const items=[...host.children].filter((el)=>getComputedStyle(el).display!=="none").map((el)=>el.getBoundingClientRect()); return items.every((a,i)=>items.every((b,j)=>i===j||a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1)); }), `${width}px at 125%: toolbar actions wrap without overlap`);
    await page.locator("#compositionFilterBtn").click();
    check(await page.locator("#compositionFilterBtn").getAttribute("aria-expanded") === "true", `${width}px: filter drawer opens and updates aria-expanded`);
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => document.activeElement?.id === "compositionFilterBtn" && document.querySelector("#compositionFilterDrawer").hidden), `${width}px: Escape closes drawer and restores funnel focus`);
    await page.locator("#compositionTableScroll").evaluate((el) => { el.scrollTop=el.scrollHeight; el.dispatchEvent(new Event("scroll")); });
    check(await page.locator("#rows tr").count() === 80, `${width}px: progressive scroll appends the next 40 rows`);
    await page.locator('#rows tr[data-line-id="41"]').focus();
    await page.keyboard.press("ArrowDown");
    check(await page.evaluate(() => document.activeElement?.dataset?.lineId === "42"), `${width}px: keyboard row focus advances inside the scroller`);
    await page.locator("#compositionTableScroll").evaluate((el) => { el.scrollTop=120; });
    await page.locator('#rows tr[data-line-id="42"]').click();
    const before = await page.locator("#compositionTableScroll").evaluate((el) => el.scrollTop);
    await page.locator("#fixtureClose").click();
    check(await page.evaluate(() => document.activeElement?.dataset?.lineId === "42"), `${width}px: modal close returns focus to the same row`);
    check(await page.locator("#compositionTableScroll").evaluate((el, top) => el.scrollTop === top, before), `${width}px: modal close preserves table scroll position`);
  }
} finally {
  await browser.close();
}

console.log(`UX-9.1 Composition toolbar checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
