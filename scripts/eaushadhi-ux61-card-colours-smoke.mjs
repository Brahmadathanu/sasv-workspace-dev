/** UX-6.1 B: production renderDetails and CSS, fixture-only; no RPCs. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { normalizeEntryStatus, isVerifiedStatus } from '../public/shared/js/eaushadhi-review-helpers.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const control = read('public/shared/js/eaushadhi-review-control.js');
const css = read('public/shared/css/sasv-eaushadhi-review.css');
const baseline = (path) => execFileSync('git', ['show', `2f7674d:${path}`], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
let passed = 0, failed = 0;
const check = (ok, label) => { if (ok) { passed++; console.log(`OK ${label}`); } else { failed++; console.error(`FAIL ${label}`); } };
const withoutTint = control
  .replace('${isVerifiedStatus(portalTextStatus) || portalTextEntryLocked() ? " is-locked" : ""}', '')
  .replace('${portalTextEntryLocked() ? " is-locked" : ""}', '');
check(withoutTint.replace(/\r\n/g, '\n') === baseline('public/shared/js/eaushadhi-review-control.js'), 'only the two approved card class expressions changed; all behaviour is preserved');
check(css.replace(/,\r?\nbody\.sasv-eaushadhi-review \.section-card\.is-locked/, '').replace(/\r\n/g, '\n') === baseline('public/shared/css/sasv-eaushadhi-review.css'), 'only is-locked selector added; reference-mapping, Readiness banners and all other colours unchanged');
check(read('public/sw.js').includes('hub-cache-v376'), 'cache remains v376');
// Reuse the existing layout fixture, executing the actual production renderer
// and portalTextEntryLocked predicate with explicit review/workflow states.
const layout = read('scripts/eaushadhi-ux6-layout-smoke.mjs');
const details = (source) => source.slice(source.indexOf('function renderDetails()'), source.indexOf('function renderComposition()'));
const fixtureSource = layout.slice(layout.indexOf('function fixture('), layout.indexOf('function inlineCss('));
const fixture = new Function('details', 'normalizeEntryStatus', 'isVerifiedStatus', `${fixtureSource};return fixture;`)(details, normalizeEntryStatus, isVerifiedStatus);
const inlineCss = (path) => readFileSync(path, 'utf8').replace(/@import\s+["']([^"']+)["'];/g, (_, relative) => inlineCss(resolve(dirname(path), relative)));
let require = createRequire(join(root, 'package.json'));
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { require = createRequire(join(root, '..', 'daily-worklog-app', 'package.json')); ({ chromium } = require('playwright-core')); }
const executablePath = process.env.UX6_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!executablePath) throw new Error('Set UX6_BROWSER_PATH to an installed Chromium browser; no downloads are performed.');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.route('**/*', (route) => route.abort());
  await page.setContent(`<html data-sasv-theme="sasv-core"><head><style>${inlineCss(join(root, 'public/shared/css/style.css'))}\n${css}</style></head><body class="sasv-module sasv-module--app sasv-eaushadhi-review"><div id="tab-details"></div><div id="verifiedReference" class="section-card is-verified">Verified reference</div><div id="plainReference" class="section-card">Plain reference</div></body></html>`);
  const cases = [];
  for (const entryStatus of ['NOT_STARTED', 'ENTERED', 'IN_PROGRESS', 'PORTAL_VERIFIED', 'SUBMITTED', 'NOT_STARTED']) {
    for (const reviewStatus of ['PENDING', 'VERIFIED']) cases.push({ entryStatus, reviewStatus });
  }
  for (const entryStatus of ['NOT_STARTED', 'IN_PROGRESS']) {
    for (const limits of [{ busy: true }, { canWrite: false }, { busy: true, canWrite: false }]) cases.push({ entryStatus, reviewStatus: 'PENDING', ...limits });
  }
  for (const cardState of cases) {
    // Replace the contents of the same tab each time, as renderDetails does;
    // includes completed -> IN_PROGRESS/NOT_STARTED to catch stale classes.
    await page.locator('#tab-details').evaluate((host, html) => { host.innerHTML = html; }, fixture(control, false, true, false, cardState));
    const result = await page.evaluate(() => {
      const text = document.getElementById('portalDiseasesCard');
      const entry = document.getElementById('fldPortalRemarks').closest('.section-card');
      const style = (el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderLeftColor, s.borderLeftWidth]; };
      return { textLocked: text.classList.contains('is-locked'), entryLocked: entry.classList.contains('is-locked'), textStyle: style(text), entryStyle: style(entry), verifiedStyle: style(document.getElementById('verifiedReference')), plainStyle: style(document.getElementById('plainReference')) };
    });
    const complete = ['ENTERED', 'PORTAL_VERIFIED', 'SUBMITTED'].includes(cardState.entryStatus);
    const textLocked = complete || cardState.reviewStatus === 'VERIFIED';
    const label = `${cardState.entryStatus}/${cardState.reviewStatus}${cardState.busy ? '/busy' : ''}${cardState.canWrite === false ? '/permission-limited' : ''}`;
    check(result.textLocked === textLocked && result.entryLocked === complete, `${label}: correct classes after re-render`);
    check(JSON.stringify(result.textStyle) === JSON.stringify(textLocked ? result.verifiedStyle : result.plainStyle), `${label}: Portal Text uses the existing verified or neutral colours`);
    check(JSON.stringify(result.entryStyle) === JSON.stringify(complete ? result.verifiedStyle : result.plainStyle), `${label}: entry fields use workflow-only colours`);
  }
} finally { await browser.close(); }
console.log(`UX-6.1 card-colour checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
