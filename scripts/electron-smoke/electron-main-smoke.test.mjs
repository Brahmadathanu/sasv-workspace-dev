// Automated Electron main-process + window smoke test driven by Playwright's Electron support (playwright-core is a project dependency).
// It starts the app UNPACKAGED (`electron .`, so the auto-updater is inactive) with a throw-away --user-data-dir and a random loopback port
// (SASV_STATIC_PORT), so it never touches an installed app's data, session or port 3000. No sign-in, no production calls except the
// login page's own CDN module imports. It verifies Electron/Chromium boot, preload/IPC wiring, the loopback-only static server,
// webSecurity behaviour, window/navigation policy, privileged-IPC URL validation, PDF/DOCX export and the updater's feed handling
// against a LOCAL feed. It is not an authenticated UI acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const electronPkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8'));
let _electron = null;
try { _electron = require('playwright-core')._electron; } catch { /* optional */ }
const binaryReady = fs.existsSync(path.join(root, 'node_modules/electron/path.txt'));
const skip = process.env.SASV_ELECTRON_SMOKE_SKIP === '1' || !_electron || !binaryReady ? 'Electron binary or playwright-core unavailable (run `npx install-electron`)' : false;

const freePort = () => new Promise(res => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const httpGet = (host, port, p = '/', method = 'GET') => new Promise(resolve => {
  const r = http.request({ host, port, path: p, method, timeout: 3000 }, res => { res.resume(); resolve({ status: res.statusCode, headers: res.headers }); });
  r.on('error', e => resolve({ error: e.code })); r.on('timeout', () => { r.destroy(); resolve({ error: 'TIMEOUT' }); }); r.end();
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

let app, win, port, userData; const crossServers = [];
test.before(async () => {
  if (skip) return;
  port = await freePort();
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'sasv-electron-smoke-'));
  const env = { ...process.env, SASV_STATIC_PORT: String(port), NODE_ENV: 'production' }; delete env.ELECTRON_RUN_AS_NODE;
  // SASV_SMOKE_APP=<path to a built app.asar> runs the same checks against the packaged ASAR (still unpackaged mode: the updater stays inactive).
  app = await _electron.launch({ args: [process.env.SASV_SMOKE_APP || '.', `--user-data-dir=${userData}`], cwd: root, env, timeout: 90000 });
  win = await app.firstWindow({ timeout: 90000 });
  await win.waitForURL(/login\.html/, { timeout: 90000 });
  await win.waitForLoadState('load');
});
test.after(async () => {
  for (const s of crossServers) await new Promise(r => s.close(r));
  try { await app?.close(); } catch { /* ignore */ }
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('boots on the expected Electron/Chromium, unpackaged (updater inactive), app version from package.json', { skip }, async () => {
  const info = await app.evaluate(({ app: a }) => ({ electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, packaged: a.isPackaged, version: a.getVersion() }));
  assert.equal(info.electron, electronPkg.version);
  assert.equal(info.packaged, false);
  assert.equal(info.version, pkg.version);
  assert.ok(Number(info.chrome.split('.')[0]) >= 140, 'Chromium ' + info.chrome);
});

test('login page is served from the loopback static server and the preload bridge is present', { skip }, async () => {
  assert.equal(new URL(win.url()).origin, `http://localhost:${port}`);
  const api = await win.evaluate(() => ({ app: typeof window.app?.openModuleUrl, updater: typeof window.electronAPI?.checkForUpdates, sop: typeof window.sopAPI?.exportPdfFromHtml, auth: typeof window.auth?.getUser, ready: document.readyState, nodeLeak: typeof window.require + '/' + typeof window.process }));
  assert.deepEqual(api, { app: 'function', updater: 'function', sop: 'function', auth: 'function', ready: 'complete', nodeLeak: 'undefined/undefined' }, 'context isolation: no Node globals in the page');
});

test('IPC round trips: app version, auth session getter, updater state', { skip }, async () => {
  assert.equal(await win.evaluate(() => window.electronAPI.getAppVersion()), pkg.version);
  assert.equal(await win.evaluate(() => window.auth.getUser()), null, 'no session yet');
  const state = await win.evaluate(() => window.electronAPI.getUpdateState());
  assert.ok(state === null || typeof state === 'object');
  assert.equal(await win.evaluate(() => window.electronAPI.checkForUpdates()), false, 'unpackaged build never contacts the update feed');
});

test('static server: loopback only, no CORS headers, nothing on the LAN address', { skip }, async () => {
  const ok = await httpGet('127.0.0.1', port, '/login.html'); assert.equal(ok.status, 200);
  assert.equal(ok.headers['access-control-allow-origin'], undefined, 'no wildcard CORS');
  assert.equal(ok.headers['x-powered-by'], undefined);
  const pre = await httpGet('127.0.0.1', port, '/login.html', 'OPTIONS'); assert.equal(pre.headers['access-control-allow-origin'], undefined);
  const lan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
  if (lan) { const r = await httpGet(lan, port, '/login.html'); assert.notEqual(r.status, 200, 'LAN address must not serve the app'); }
});

test('webSecurity is on: a cross-origin fetch needs CORS (allowed with it, blocked without it); the CDN module imports of the login page still load', { skip }, async () => {
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.notEqual(prefs.webSecurity, false);
  assert.equal(prefs.contextIsolation, true); assert.equal(prefs.nodeIntegration, false);
  const mk = async (cors) => { const p = await freePort(); const s = http.createServer((q, r) => { if (cors) r.setHeader('Access-Control-Allow-Origin', '*'); r.setHeader('content-type', 'application/json'); r.end('{"ok":true}'); }); await new Promise(r => s.listen(p, '127.0.0.1', r)); crossServers.push(s); return p; };
  const withCors = await mk(true), without = await mk(false);
  assert.equal(await win.evaluate(p => fetch(`http://127.0.0.1:${p}/`).then(r => r.json()).then(j => j.ok, () => 'blocked'), withCors), true, 'a CORS-enabled API (like Supabase) works');
  assert.equal(await win.evaluate(p => fetch(`http://127.0.0.1:${p}/`).then(() => 'allowed', () => 'blocked'), without), 'blocked', 'a non-CORS cross-origin response is blocked');
  const failed = []; win.on('requestfailed', r => failed.push(r.url()));
  await win.reload({ waitUntil: 'load' }); await sleep(1500);
  assert.deepEqual(failed.filter(u => /esm\.sh|cdnjs|jsdelivr|supabase\.co/.test(u)), [], 'login page third-party scripts/modules load under webSecurity');
});

test('window and navigation policy: app/about:blank popups allowed; external https goes to the default browser (stubbed); file:, javascript: and off-origin navigation blocked', { skip }, async () => {
  await app.evaluate(({ shell }) => { globalThis.__ext = []; shell.openExternal = u => { globalThis.__ext.push(String(u)); return Promise.resolve(); }; });
  const count = () => app.windows().length;
  const before = count();
  await win.evaluate(() => { window.open('about:blank'); }); await sleep(800); assert.equal(count(), before + 1, 'about:blank popup allowed');
  await win.evaluate(p => { window.open(`http://localhost:${p}/login.html`); }, port); await sleep(800); assert.equal(count(), before + 2, 'same-origin popup allowed');
  const afterAllowed = count();
  await win.evaluate(() => { window.open('https://example.com/docs'); }); await sleep(600);
  await win.evaluate(() => { window.open('file:///C:/Windows/win.ini'); }); await sleep(600);
  await win.evaluate(() => { window.open('javascript:alert(1)'); }); await sleep(600);
  assert.equal(count(), afterAllowed, 'no new window for external, file: or javascript: targets');
  const ext = await app.evaluate(() => globalThis.__ext);
  assert.deepEqual(ext, ['https://example.com/docs'], 'only the https link was handed to the default browser; file: and javascript: were dropped');
  const url0 = win.url();
  await win.evaluate(() => { location.href = 'https://example.org/away'; }).catch(() => {}); await sleep(1000);
  assert.equal(win.url(), url0, 'top-level navigation off the app origin is blocked');
  assert.ok((await app.evaluate(() => globalThis.__ext)).includes('https://example.org/away'));
  for (const w of app.windows().filter(x => x !== win)) await w.close().catch(() => {});
});

test('privileged open-module-url IPC accepts only app-origin pages and clamps size', { skip }, async () => {
  const before = app.windows().length;
  await win.evaluate(() => { window.app.openModuleUrl('file:///C:/Windows/win.ini'); window.app.openModuleUrl('https://example.com/'); window.app.openModuleUrl('javascript:alert(1)'); window.app.openModuleUrl('http://user:pw@localhost/'); });
  await sleep(1200); assert.equal(app.windows().length, before, 'rejected URLs open nothing');
  const [child] = await Promise.all([app.waitForEvent('window', { timeout: 20000 }), win.evaluate(() => window.app.openModuleUrl('public/shared/manage-categories.html', { width: 99999, height: 1 }))]);
  await child.waitForLoadState('domcontentloaded');
  assert.equal(new URL(child.url()).origin, `http://localhost:${port}`);
  const dims = await child.evaluate(() => ({ w: window.outerWidth, h: window.outerHeight }));
  assert.ok(dims.w <= 4000 && dims.h >= 300, JSON.stringify(dims));
  await child.close().catch(() => {});
});

test('PDF export (offscreen window + printToPDF) and DOCX export (html-to-docx) work on this Electron', { skip }, async () => {
  const pdf = await win.evaluate(() => window.sopAPI.exportPdfFromHtml('Smoke', '<h1>Hello</h1><p>smoke test</p>', {}));
  assert.equal(pdf.ok, true, JSON.stringify(pdf).slice(0, 200));
  assert.equal(Buffer.from(pdf.pdfBase64, 'base64').subarray(0, 4).toString(), '%PDF');
  const docx = await win.evaluate(() => window.sopAPI.exportDocxFromHtml('Smoke', '<h1>Hello</h1><table><tr><td>a</td></tr></table>', {}));
  assert.equal(docx.ok, true, JSON.stringify(docx).slice(0, 200));
  assert.equal(Buffer.from(docx.docxBase64, 'base64').subarray(0, 2).toString(), 'PK');
});

test('updater discovers a newer version from a LOCAL generic feed on this Electron (no download, no install, no GitHub)', { skip }, async () => {
  const feedPort = await freePort();
  const yml = `version: 9.9.9\nfiles:\n  - url: SASV-Workspace-Setup-9.9.9.exe\n    sha512: ${'A'.repeat(86)}==\n    size: 1000\npath: SASV-Workspace-Setup-9.9.9.exe\nsha512: ${'A'.repeat(86)}==\nreleaseDate: '2026-11-19T00:00:00.000Z'\n`;
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/latest.yml')) { r.setHeader('content-type', 'text/yaml'); r.end(yml); } else { r.statusCode = 404; r.end(); } });
  await new Promise(r => srv.listen(feedPort, '127.0.0.1', r)); crossServers.push(srv);
  const result = await app.evaluate(async ({ app: a }, { feed, updaterPath }) => {
    const { autoUpdater } = process.mainModule.require(updaterPath);
    autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.setFeedURL({ provider: 'generic', url: `http://127.0.0.1:${feed}` });
    const out = await autoUpdater.checkForUpdates();
    return { current: a.getVersion(), found: out && out.updateInfo && out.updateInfo.version, downloaded: Boolean(out && out.downloadPromise) };
  }, { feed: feedPort, updaterPath: path.join(root, 'node_modules', 'electron-updater') });
  assert.equal(result.found, '9.9.9'); assert.equal(result.downloaded, false);
});

test('print/report popups: a blob: URL minted by the app origin and about:blank document.write both open; IPv6 loopback (::1) also serves the app when the host has IPv6', { skip }, async () => {
  const before = app.windows().length;
  await win.evaluate(() => { const u = URL.createObjectURL(new Blob(['<h1>print</h1>'], { type: 'text/html' })); window.open(u); }); await sleep(900);
  assert.equal(app.windows().length, before + 1, 'blob: popup from the app origin allowed');
  await win.evaluate(() => { const w = window.open('about:blank'); w.document.write('<h1>report</h1>'); w.document.close(); }); await sleep(900);
  assert.equal(app.windows().length, before + 2, 'about:blank + document.write popup allowed');
  for (const w of app.windows().filter(x => x !== win)) await w.close().catch(() => {});
  const v6 = await new Promise(resolve => { const s = net.connect({ host: '::1', port, timeout: 1500 }, () => { s.destroy(); resolve('connected'); }); s.on('error', e => resolve(e.code)); s.on('timeout', () => { s.destroy(); resolve('TIMEOUT'); }); });
  assert.ok(['connected', 'EADDRNOTAVAIL', 'ECONNREFUSED'].includes(v6), 'IPv6 loopback result: ' + v6);
  if (v6 === 'connected') assert.equal((await httpGet('::1', port, '/login.html')).status, 200);
});

test('port collision: when the port is taken, the app stays up and shows a readable message instead of a blank window or a crash', { skip }, async () => {
  const taken = await freePort(); const blocker = net.createServer(); await new Promise(r => blocker.listen(taken, '127.0.0.1', r));
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sasv-electron-collision-'));
  const env = { ...process.env, SASV_STATIC_PORT: String(taken), NODE_ENV: 'production' }; delete env.ELECTRON_RUN_AS_NODE;
  const a2 = await _electron.launch({ args: [process.env.SASV_SMOKE_APP || '.', `--user-data-dir=${ud}`], cwd: root, env, timeout: 90000 });
  try {
    const w = await a2.firstWindow({ timeout: 60000 });
    await w.waitForFunction(() => document.body && /could not start/i.test(document.body.innerText), null, { timeout: 30000 });
    assert.match(await w.evaluate(() => document.body.innerText), new RegExp(String(taken)));
  } finally { await a2.close().catch(() => {}); blocker.close(); fs.rmSync(ud, { recursive: true, force: true }); }
});
