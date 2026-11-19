// Updater compatibility on the real Electron 45 runtime, against a LOCAL generic feed only (no GitHub, no download, no install).
// electron-updater decides purely by semver of the installed version vs the feed's latest.yml, so these cases show how a 6.1.0 client and
// a 6.2.0 client behave when 6.2.0 is (or is not) published. The Electron process runs with LOCALAPPDATA and the user-data dir redirected to a
// temp folder so it can never touch an installed app's updater cache or pending downloads.
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
let _electron = null;
try { _electron = require('playwright-core')._electron; } catch { /* optional */ }
const skip = process.env.SASV_ELECTRON_SMOKE_SKIP === '1' || !_electron || !fs.existsSync(path.join(root, 'node_modules/electron/path.txt')) ? 'Electron binary or playwright-core unavailable' : false;
const freePort = () => new Promise(res => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const manifest = v => `version: ${v}\nfiles:\n  - url: SASV-Workspace-Setup-${v}.exe\n    sha512: ${'A'.repeat(86)}==\n    size: 1000\npath: SASV-Workspace-Setup-${v}.exe\nsha512: ${'A'.repeat(86)}==\nreleaseDate: '2026-11-19T00:00:00.000Z'\n`;

let app, tmp; const servers = [];
test.before(async () => {
  if (skip) return;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sasv-updater-compat-'));
  const env = { ...process.env, SASV_STATIC_PORT: String(await freePort()), NODE_ENV: 'production', LOCALAPPDATA: tmp }; delete env.ELECTRON_RUN_AS_NODE;
  app = await _electron.launch({ args: ['.', `--user-data-dir=${path.join(tmp, 'ud')}`], cwd: root, env, timeout: 90000 });
  await app.firstWindow({ timeout: 90000 });
});
test.after(async () => { for (const s of servers) await new Promise(r => s.close(r)); try { await app?.close(); } catch { /* ignore */ } try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ } });

async function check(installed, feedVersion) {
  const port = await freePort();
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/latest.yml')) { r.setHeader('content-type', 'text/yaml'); r.end(manifest(feedVersion)); } else { r.statusCode = 404; r.end(); } });
  await new Promise(r => srv.listen(port, '127.0.0.1', r)); servers.push(srv);
  return app.evaluate(async (_e, { port, installed, updaterPath, semverPath }) => {
    const { autoUpdater } = process.mainModule.require(updaterPath);
    const semver = process.mainModule.require(semverPath); // the exact semver module electron-updater itself uses
    autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.forceDevUpdateConfig = true; autoUpdater.allowDowngrade = false;
    autoUpdater.currentVersion = semver.parse(installed);
    autoUpdater.setFeedURL({ provider: 'generic', url: `http://127.0.0.1:${port}` });
    const r = await autoUpdater.checkForUpdates();
    return { feed: r.updateInfo.version, isUpdateAvailable: r.isUpdateAvailable === true, downloaded: Boolean(r.downloadPromise) };
  }, { port, installed, updaterPath: path.join(root, 'node_modules', 'electron-updater'), semverPath: require('node:module').createRequire(path.join(root, 'node_modules', 'electron-updater', 'package.json')).resolve('semver') });
}

test(`package.json version is the release candidate (${pkg.version}) and above the published 6.1.0`, () => {
  const [a, b, c] = pkg.version.split('.').map(Number); const [x, y, z] = [6, 1, 0];
  assert.ok(a > x || (a === x && (b > y || (b === y && c > z))), pkg.version);
});
test('a 6.1.0 client is offered this version once it is the published latest (no download, no install)', { skip }, async () => {
  const r = await check('6.1.0', pkg.version); assert.equal(r.feed, pkg.version); assert.equal(r.isUpdateAvailable, true); assert.equal(r.downloaded, false);
});
test('a client already on this version is not offered it again', { skip }, async () => {
  const r = await check(pkg.version, pkg.version); assert.equal(r.isUpdateAvailable, false);
});
test('a client on this version is never moved back to the older 6.1.0 feed (no downgrade)', { skip }, async () => {
  const r = await check(pkg.version, '6.1.0'); assert.equal(r.isUpdateAvailable, false);
});
test('the unchanged 6.1.0 candidate would NOT have been offered to 6.1.0 clients (why the version bump is required)', { skip }, async () => {
  const r = await check('6.1.0', '6.1.0'); assert.equal(r.isUpdateAvailable, false);
});
