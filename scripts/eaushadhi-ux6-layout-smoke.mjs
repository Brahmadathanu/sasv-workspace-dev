/** UX-6 layout fixture: actual renderDetails markup/CSS; no app bootstrap or network. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');
const control = read('public/shared/js/eaushadhi-review-control.js');
const { normalizeEntryStatus, isVerifiedStatus } = await import('../public/shared/js/eaushadhi-review-helpers.js');
const css = read('public/shared/css/sasv-eaushadhi-review.css');
const baseline = (name) => execFileSync('git', ['show', `aafadc8:${name}`], { cwd: root, encoding: 'utf8' });
const original = baseline('public/shared/js/eaushadhi-review-control.js');
const normalize = (s) => s.replace(/\r\n/g, '\n');
const details = (s) => s.slice(s.indexOf('function renderDetails()'), Math.max(s.indexOf('function renderCompositionLegacy()'), s.indexOf('function renderComposition()')));
let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log(`OK ${label}`); }
  else { failed++; console.error(`FAIL ${label}`); }
}
const withoutCardTint = (source) => source
  .replace('${isVerifiedStatus(portalTextStatus) || portalTextEntryLocked() ? " is-locked" : ""}', '')
  .replace('${portalTextEntryLocked() ? " is-locked" : ""}', '');
const oldDetails = details(original), newDetails = details(control);
// UX-6.1 separately tests the intentional portal-text entry lock. Keep the
// original UX-6 contract for every other part of the control file.
const withoutPortalTextUi = (source) => {
  const start = source.includes('function portalTextEntryLocked()')
    ? source.indexOf('function portalTextEntryLocked()')
    : source.indexOf('function portalTextBlockingReason()');
  return source.slice(0, start) + source.slice(source.indexOf('function stageRow(', start));
};
check(control.includes('function renderCompositionLegacy()') && control.includes('function renderComposition('), 'UX-7 preserves the existing Composition renderer behind the table/modal view');
check(normalize(read('public/shared/e-aushadhi-review-control.html')) === normalize(baseline('public/shared/e-aushadhi-review-control.html')), 'workspaceScroll, header, tabs and scroll structure unchanged');
const tokens = (s, re) => JSON.stringify([...normalize(s).matchAll(re)].map((m) => m[0]).sort());
check(tokens(withoutCardTint(newDetails), /\b(?:id|data-[\w-]+)="[^"]*"/g) === tokens(oldDetails, /\b(?:id|data-[\w-]+)="[^"]*"/g), 'all existing IDs and data attributes preserved');
check(tokens(newDetails, /<button[\s\S]*?<\/button>/g) === tokens(oldDetails, /<button[\s\S]*?<\/button>/g), 'all button markup and decision expressions preserved exactly');
const prefix = (s) => s.slice(0, s.indexOf('  host.innerHTML ='));
check(normalize(prefix(newDetails)) === normalize(prefix(oldDetails)), 'all Details validation and permission decisions unchanged');
check(css.includes('.reference-mapping-block') && css.includes('.workspace-scroll') && css.includes('overflow: auto;'), 'Composition mapping block and the workspace scroll structure remain styled');
check(read('public/sw.js').includes('hub-cache-v376'), 'cache remains v376');

// Render the production template with explicit layout fixtures, not live records.
function fixture(source, locked = false, projection = true, composition = false, cardState = {}) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  const message = 'Saved for review by a colleague. A different Approver must approve this section.';
  const state = {
    detailsDraft: {}, portalFieldsDraft: {}, portalTextDraft: { portalReviewStatus: cardState.reviewStatus || "PENDING" }, review: {},
    queueRow: { entry_status: cardState.entryStatus || "NOT_STARTED" }, busy: cardState.busy === true,
    classificationDraft: {}, classification: {}, classificationOptions: { PRODUCT_TYPE: [], PRODUCT_CATEGORY: [], PRODUCT_SUBTYPE: [] },
    catalogs: { permissionPurposeOptions: [], portalOptions: {} }, portalTextRow: projection ? {} : null, lines: [{}],
    lineDrafts: new Map(), lineSaveStatus: new Map(), lineBaselines: new Map(), resolvedSourceByLine: new Map(), evidence: {},
  };
  const scope = {
    state, Boolean, String, $: () => host,
    isVerifiedStatus: (value) => value == null ? locked : isVerifiedStatus(value),
    portalFieldsEditable: () => !locked && cardState.canWrite !== false && normalizeEntryStatus(state.queueRow.entry_status) === "NOT_STARTED",
    canWrite: () => cardState.canWrite !== false,
    portalTextEntryLocked: !source.includes('function portalTextEntryLocked()') ? () => false : new Function('state', 'normalizeEntryStatus', source.slice(source.indexOf('function portalTextEntryLocked()'), source.indexOf('function portalTextBlockingReason()')) + ';return portalTextEntryLocked();').bind(null, state, normalizeEntryStatus),
    canonicalDiseasesLocked: () => locked, safeText: (s) => String(s || ''),
    escapeHtml: (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    displayText: (s, fallback = '') => s || fallback,
    classificationSuggestionCopy: () => ({ productType: 'A long suggested product type', productCategory: 'A long suggested dosage form', productSubtype: 'No sub type' }),
    classificationScopedOptionsUnloaded: () => true,
    combineApproval: () => ({ ok: false, reason: message, code: 'FOUR_EYES_SAME_PERSON' }),
    portalTextBlockingReason: () => message,
    stageSaverHtml: (stage) => `<p class="muted-note" id="stageSaver-${stage}">${message}</p>`,
    autosaveHtml: (_, id) => `<p class="ea-autosave" id="${id}">Saved for review</p>`,
    chip: (_, text) => `<span class="status-chip neutral">${text}</span>`,
    preEntryReopenButton: ({id, label}) => `<button id="${id}" class="icon-btn with-label">${label}</button>`,
    optionHtml: () => '<option>A long approved product option label</option>',
    classificationOptionHtml: () => '<option>A long approved classification option label</option>',
    classificationSubtypeOptionHtml: () => '<option>No sub type</option>',
    portalShelfmonthOptionsHtml: () => '<option>Approved shelf-life route</option>',
    combinedDeclarationControl: () => '<button type="button">No</button>',
    CLASSIFICATION_OPTIONS_UNLOADED_COPY: 'Options are not loaded. Ask an administrator.',
    CLASSIFICATION_SUBTYPE_INDEPENDENCE_NOTE: 'Portal Sub Type is independent of the category.',
    optionId: (value) => String(value || ''),
    filterCompositionLines: () => [{ source_composition_line_id: 1, raw_ingredient_name: 'Ingredient', referenceMapping: {} }],
    issuesForLine: () => [],
    portalFieldSpecs: () => ['INGREDIENT_TYPE', 'INGREDIENT_FORM', 'PART_USED', 'MEASUREMENT_UNIT'].map((domain) => ({ domain, draftKey: domain })),
    SUGGESTION_FIELD_KEYS: {},
    lineSaveForReviewUi: () => ({ visible: true, enabled: false, label: 'Save for review' }),
    lineVerifyPendingCopy: () => message,
    lineDraftFromRow: () => ({}),
    isFirstControlledEntryProduct: () => false,
  };
  // Other display helpers have empty output; no validation or save path is exercised.
  const context = new Proxy(scope, { has: () => true, get: (o, key) => key === Symbol.unscopables ? undefined : key in o ? o[key] : () => '' });
  const compositionStart = source.includes('function renderCompositionLegacy()') ? source.indexOf('function renderCompositionLegacy()') : source.indexOf('function renderComposition()');
  const compositionEnd = source.includes('function compositionMappingSummary(') ? source.indexOf('function compositionMappingSummary(') : source.indexOf('function compositionPortalExecutionHtml()');
  const render = composition ? source.slice(compositionStart, compositionEnd) : details(source);
  new Function('scope', `with(scope) { return (${render.trim()})(); }`)(context);
  return host.innerHTML;
}
function inlineCss(path) {
  return readFileSync(path, 'utf8').replace(/@import\s+["']([^"']+)["'];/g, (_, relative) => inlineCss(resolve(dirname(path), relative)));
}
let require = createRequire(join(root, 'package.json'));
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { require = createRequire(join(root, '..', 'daily-worklog-app', 'package.json')); ({ chromium } = require('playwright-core')); }
const executablePath = process.env.UX6_BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
if (!executablePath) throw new Error('Set UX6_BROWSER_PATH to an installed Chromium browser; no downloads are performed.');
const browser = await chromium.launch({ executablePath, headless: true });
const { worklistModalHtml, nextActionDecision } = await import(pathToFileURL(join(root, 'public/shared/js/eaushadhi-review-worklist.js')));
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.route('**/*', (route) => route.abort());
  const styles = inlineCss(join(root, 'public/shared/css/style.css')) + '\n' + css;
  async function show(markup, tab = 'details') {
    await page.setContent(`<html data-sasv-theme="sasv-core"><head><style>${styles}</style></head><body class="sasv-module sasv-module--app sasv-eaushadhi-review ea-mode-product"><div id="mainPanel"><section id="workspacePanel"><div class="product-controls"><div class="product-header"><h2>Product fixture</h2></div><div class="workflow-nav">Product Details</div></div><div id="workspaceScroll" class="workspace-scroll"><div id="tab-${tab}" class="tab-panel">${markup}</div></div></section></div></body></html>`);
  }
  for (const [width, height] of [[1366, 768], [1093, 614], [600, 768]]) {
    await page.setViewportSize({ width, height });
    const label = `${width}x${height}`;
    await show(fixture(control));
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#workspaceScroll').scrollWidth <= document.querySelector('#workspaceScroll').clientWidth), `${label}: no horizontal page/workspace overflow`);
    check(await page.locator('.ux6-classification-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length) === (width <= 760 ? 1 : 3), `${label}: Classification responsive column count`);
    check(await page.locator('.ux6-details-pair').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length) === (width <= 760 ? 1 : 2), `${label}: Details pair responsive column count`);
    check(await page.locator('#fldClassNotes').evaluate((el) => !el.closest('.ux6-classification-grid')), `${label}: Classification notes remain below grid`);
    for (const id of ['btnVerifyClassification', 'btnVerifyPortalDiseases', 'btnSavePortalDiseases', 'btnVerifyDetails']) {
      const button = page.locator(`#${id}`);
      await button.scrollIntoViewIfNeeded();
      check(await button.evaluate((el) => {
        const r = el.getBoundingClientRect(), s = document.querySelector('#workspaceScroll').getBoundingClientRect();
        return r.top >= s.top - 1 && r.bottom <= s.bottom + 1 && r.left >= s.left && r.right <= s.right + 1 && r.bottom <= innerHeight;
      }), `${label}: ${id} reachable without clipping`);
    }
    check(await page.locator('#stageSaver-classification').evaluate((el) => el.closest('.ux6-section-actions').contains(document.querySelector('#btnVerifyClassification')) && el.getBoundingClientRect().height > 0), `${label}: classification saver adjacent to action`);
    check(await page.locator('#stageSaver-details').evaluate((el) => el.closest('.ux6-section-actions').contains(document.querySelector('#btnVerifyDetails')) && el.getBoundingClientRect().height > 0), `${label}: Details saver adjacent to action`);
    check(await page.locator('#classificationVerifyHint').evaluate((el) => el.closest('.ux6-section-actions') && el.getBoundingClientRect().height > 0), `${label}: four-eyes reason remains visible in action area`);
    check(await page.locator('#portalDiseasesHint').evaluate((el) => el.closest('.ux6-section-actions') && el.getBoundingClientRect().height > 0), `${label}: Portal Text refusal stays with its actions`);
    check(await page.locator('#portalClassificationCard .status-chip').evaluate((el) => Boolean(el.closest('.ux6-section-head'))), `${label}: stage badge stays in action heading`);
    // Compare DOM focus sequence with actual visual positions, then exercise Tab.
    const ids = await page.locator('#tab-details').evaluate((host) => {
      const els = [...host.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
      const visual = [...els].sort((a, b) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return Math.abs(x.top - y.top) < 2 ? x.left - y.left : x.top - y.top; });
      return { dom: els.map((e) => e.id), visual: visual.map((e) => e.id) };
    });
    check(JSON.stringify(ids.dom) === JSON.stringify(ids.visual), `${label}: DOM focus order follows visual order`);
    await page.locator('#btnVerifyClassification').focus();
    await page.keyboard.press('Tab');
    check(await page.locator('#fldClassProductType').evaluate((el) => el === document.activeElement), `${label}: Tab proceeds from section action to first field`);
    const newHeight = await page.locator('#tab-details').evaluate((el) => el.scrollHeight);
    await show(fixture(original));
    const oldHeight = await page.locator('#tab-details').evaluate((el) => el.scrollHeight);
    if (width > 760) check(newHeight < oldHeight, `${label}: less vertical content than baseline (${newHeight} vs ${oldHeight}px)`);
    await show(fixture(control, true, false));
    check(await page.locator('#btnReopenClassification').count() === 1 && await page.locator('#btnReopenDetails').count() === 1 && await page.locator('#btnSavePortalDiseases').count() === 0, `${label}: locked and unavailable-projection branches retain original controls`);
    check(await page.locator('#btnReopenDetails').evaluate((el) => el.closest('.ux6-section-actions').querySelector('.status-chip')?.textContent === 'Verified'), `${label}: verified Details badge remains next to its action`);
    await show(fixture(control, false, true, true), 'composition');
    const lineSave = page.locator('[data-line-save]');
    await lineSave.scrollIntoViewIfNeeded();
    check(await lineSave.evaluate((el) => {
      const r = el.getBoundingClientRect(), s = document.querySelector('#workspaceScroll').getBoundingClientRect();
      return r.top >= s.top && r.bottom <= s.bottom && r.left >= s.left && r.right <= s.right;
    }), `${label}: Composition line action reachable`);
    check(await page.locator('#workspaceScroll').evaluate((el) => el.scrollWidth <= el.clientWidth), `${label}: Composition notes/actions do not overflow horizontally`);
    // Exercise the unchanged production row-dialog opener, closer and focus trap.
    const row = { product_id: 1, product_name: 'A product with a long descriptive name for the layout check', next_stage: 'details' };
    const roles = { is_approver: true, is_verifier: true, can_edit: true };
    const summary = worklistModalHtml(row, roles);
    const decision = nextActionDecision(row, roles);
    const functionBody = (name, nextName) => control.slice(control.indexOf(`function ${name}(`), control.indexOf(`\n${nextName}`, control.indexOf(`function ${name}(`)));
    await page.evaluate(({ row, roles, summary, decision, functions }) => {
      document.body.insertAdjacentHTML('beforeend', '<button id="fixtureRow">Product row</button>');
      const setup = new Function('row', 'roles', 'summary', 'decision', `
        const state = { worklist: [row], myRoles: roles };
        const $ = (id) => document.getElementById(id);
        const nextActionDecision = () => decision;
        const worklistModalHtml = () => summary;
        const setActionState = (button, value) => { button.disabled = value.enabled === false; };
        const workspaceTabForStage = (value) => value;
        const focusWorklistRow = () => $('fixtureRow').focus();
        ${functions}
        window.ux6OpenSummary = () => openWorklistModal(row.product_id);
        window.ux6OpenSummary();
      `);
      setup(row, roles, summary, decision);
    }, { row, roles, summary, decision, functions: [
      functionBody('modalFocusables', 'function trapModalTab'),
      functionBody('trapModalTab', 'function '),
      functionBody('closeWorklistModal', 'function openWorklistModal'),
      functionBody('openWorklistModal', 'async function loadMyRoles'),
    ].join('\n') });
    check(await page.locator('#worklistModalDialog').evaluate((el) => el.scrollWidth <= el.clientWidth && el.querySelector('.sasv-modal__body').scrollWidth <= el.querySelector('.sasv-modal__body').clientWidth), `${label}: row modal has no horizontal overflow`);
    await page.keyboard.press('Escape');
    check(await page.locator('#worklistModalDialog').count() === 0 && await page.locator('#fixtureRow').evaluate((el) => el === document.activeElement), `${label}: Esc closes row modal and restores row focus`);
    await page.evaluate(() => window.ux6OpenSummary());
    await page.locator('#worklistModalClose').click();
    check(await page.locator('#worklistModalDialog').count() === 0 && await page.locator('#fixtureRow').evaluate((el) => el === document.activeElement), `${label}: Close closes row modal and restores row focus`);
  }
} finally { await browser.close(); }
console.log(`UX-6 layout checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
