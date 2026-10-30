/** UX-6.2: scoped CSS, computed styles and contrast; no app bootstrap or RPCs. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const normalize = (s) => s.replace(/\r\n/g, '\n');
const baseline = (path) => execFileSync('git', ['show', `273b11c:${path}`], { cwd: root, encoding: 'utf8' });
const cssPath = 'public/shared/css/sasv-eaushadhi-review.css';
const css = read(cssPath), oldCss = baseline(cssPath);
const marker = '/* UX-6.2:';
const addition = css.slice(css.indexOf(marker));
let passed = 0, failed = 0;
const check = (ok, label) => { if (ok) { passed++; console.log(`OK ${label}`); } else { failed++; console.error(`FAIL ${label}`); } };
check(addition.includes('background: var(--sasv-surface-soft)') && addition.includes('cursor: not-allowed') && addition.includes('user-select: text'), 'UX-6.2 control rule remains intact after later Composition CSS');
check(read('public/shared/js/eaushadhi-review-control.js').includes('function renderCompositionLegacy()'), 'later JavaScript preserves the original disabled/read-only Composition renderer');
check(read('public/sw.js').includes('hub-cache-v376'), 'cache remains v376');
const selector = addition.slice(addition.indexOf('*/') + 2, addition.indexOf('{')).trim();
const selectors = selector.split(/,\r?\n/).map((s) => s.trim());
check(selectors.length === 3 && selectors.every((s) => s.startsWith('body.sasv-eaushadhi-review ')) && (addition.match(/\{/g) || []).length === 1, 'one three-selector rule scoped to the review body');
check(selectors.every((s) => s.includes('.sasv-control') && /:disabled|\[readonly\]/.test(s)), 'every new selector requires a disabled or read-only control');
check(addition.includes('select.sasv-control:disabled'), 'disabled selects are explicitly covered');
check(/opacity:\s*1;/.test(addition) && /user-select:\s*text;/.test(addition) && !/pointer-events\s*:/.test(addition), 'full-opacity text remains selectable without pointer suppression');
const inlineCss = (path) => readFileSync(path, 'utf8').replace(/@import\s+["']([^"']+)["'];/g, (_, relative) => inlineCss(resolve(dirname(path), relative)));
let require = createRequire(join(root, 'package.json'));
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { require = createRequire(join(root, '..', 'daily-worklog-app', 'package.json')); ({ chromium } = require('playwright-core')); }
const executablePath = process.env.UX6_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!executablePath) throw new Error('Set UX6_BROWSER_PATH to an installed Chromium browser; no downloads are performed.');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.route('**/*', (route) => route.abort());
  const enabled = ['inputEnabled', 'textareaEnabled', 'selectEnabled', 'buttonEnabled', 'buttonDisabled', 'mapping'];
  const locked = ['inputDisabled', 'inputReadonly', 'textareaDisabled', 'textareaReadonly', 'selectDisabled', 'modalReadonly'];
  await page.setContent(`<html data-sasv-theme="sasv-core"><head><style>${inlineCss(join(root, 'public/shared/css/style.css'))}\n${oldCss}</style></head><body class="sasv-module sasv-eaushadhi-review"><div class="form-field">
    <input id="inputEnabled" class="sasv-control" value="Editable text">
    <input id="inputDisabled" class="sasv-control" value="Disabled text" disabled>
    <input id="inputReadonly" class="sasv-control" value="Copy this text" readonly>
    <textarea id="textareaEnabled" class="sasv-control">Editable text</textarea>
    <textarea id="textareaDisabled" class="sasv-control" disabled>Disabled text</textarea>
    <textarea id="textareaReadonly" class="sasv-control" readonly>Copy this text</textarea>
    <select id="selectEnabled" class="sasv-control"><option>Editable choice</option></select>
    <select id="selectDisabled" class="sasv-control" disabled><option>Disabled choice</option></select>
    <button id="buttonEnabled" class="sasv-control icon-btn with-label primary">Action</button>
    <button id="buttonDisabled" class="sasv-control icon-btn with-label primary" disabled>Locked action</button>
    <div id="mapping" class="reference-mapping-block">Reference mapping</div>
    </div><div class="sasv-modal"><textarea id="modalReadonly" class="sasv-control" readonly>Modal text</textarea></div></body></html>`);
  const styles = (ids) => page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const el = document.getElementById(id), s = getComputedStyle(el);
    return [id, { background: s.backgroundColor, color: s.color, fill: s.webkitTextFillColor, opacity: s.opacity, border: s.borderColor, cursor: s.cursor, shadow: s.boxShadow, outline: s.outlineStyle, selection: s.userSelect }];
  })), ids);
  const before = await styles(enabled);
  await page.locator('#inputEnabled').focus();
  const focusedBefore = await styles(['inputEnabled']);
  await page.addStyleTag({ content: addition });
  const focusedAfter = await styles(['inputEnabled']);
  check(JSON.stringify(focusedBefore) === JSON.stringify(focusedAfter), 'enabled focused control retains its existing focus ring and colours');
  await page.locator('#inputEnabled').blur();
  const after = await styles(enabled);
  for (const id of enabled) {
    check(JSON.stringify(before[id]) === JSON.stringify(after[id]), `${id}: computed styles unchanged`);
    check(await page.locator(`#${id}`).evaluate((el, selector) => !el.matches(selector), selector), `${id}: no new selector matches`);
  }
  const luminance = (rgb) => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const lockedStyles = await styles(locked);
  for (const id of locked) {
    const s = lockedStyles[id], a = luminance(s.color), b = luminance(s.background);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    check(await page.locator(`#${id}`).evaluate((el, selector) => el.matches(selector), selector), `${id}: locked selector matches`);
    check(ratio >= 4.5 && s.opacity === '1' && s.fill === s.color, `${id}: AA text contrast ${ratio.toFixed(2)}:1 with full opacity`);
    check(s.cursor === 'not-allowed' && s.shadow === 'none' && s.outline === 'none' && s.selection === 'text', `${id}: muted locked state retains text selection and removes focus effects`);
  }
  for (const id of ['inputReadonly', 'textareaReadonly', 'modalReadonly']) {
    await page.locator(`#${id}`).focus();
    const s = (await styles([id]))[id];
    check(s.shadow === 'none' && s.outline === 'none' && s.border === lockedStyles[id].border, `${id}: focused read-only control has no ring or active border`);
    await page.locator(`#${id}`).press('Control+A');
    check(await page.locator(`#${id}`).evaluate((el) => el.selectionStart === 0 && el.selectionEnd === el.value.length), `${id}: text can still be selected for copying`);
  }
  await page.locator('#inputReadonly').evaluate((el) => { el.readOnly = false; el.blur(); });
  check((await styles(['inputReadonly'])).inputReadonly.background === before.inputEnabled.background, 'removing readonly restores the normal enabled background');
  await page.locator('body').evaluate((el) => el.classList.remove('sasv-eaushadhi-review'));
  check(await page.locator('#inputDisabled').evaluate((el, selector) => !el.matches(selector), selector), 'rule does not match controls outside the review body');
} finally { await browser.close(); }
console.log(`UX-6.2 control-style checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
