// Release-candidate artifact verification against a LOCAL feed (no GitHub, no install, nothing published).
// Runs only when SASV_UPDATER_ARTIFACT_DIST points at an electron-builder `dist` folder (latest.yml + installer):
//   SASV_UPDATER_ARTIFACT_DIST=dist node --test scripts/electron-smoke/updater-artifact-verify.test.mjs
// A simulated 6.1.0 client (the Electron process runs with LOCALAPPDATA and the profile redirected to a temp folder, so an installed
// app's updater cache is never touched) downloads the REAL candidate installer from the local feed and electron-updater verifies its
// sha512; a tampered copy of the same installer must be rejected. electron-updater never installs unless quitAndInstall is called, which this test never does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distEnv = process.env.SASV_UPDATER_ARTIFACT_DIST;
const dist = distEnv ? path.resolve(root, distEnv) : null;
let _electron = null; try { _electron = require('playwright-core')._electron; } catch { /* optional */ }
const skip = !dist || !fs.existsSync(path.join(dist || '', 'latest.yml')) || !_electron ? 'set SASV_UPDATER_ARTIFACT_DIST to a built dist folder' : false;
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const freePort = () => new Promise(res => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

const yml = skip ? '' : fs.readFileSync(path.join(dist, 'latest.yml'), 'utf8');
const feedVersion = (yml.match(/^version:\s*(\S+)/m) || [])[1];
const feedPath = (yml.match(/^path:\s*(\S+)/m) || [])[1];
const feedSha = (yml.match(/^sha512:\s*(\S+)/m) || [])[1];
const installerOnDisk = skip ? null : fs.readdirSync(dist).find(f => /^SASV Workspace Setup .*\.exe$/.test(f));

test('latest.yml matches the candidate: version, file name, size and sha512 of the installer on disk', { skip }, () => {
  assert.equal(feedVersion, pkg.version);
  assert.equal(feedPath, `SASV-Workspace-Setup-${pkg.version}.exe`, 'GitHub stores spaces as dashes; same convention as the published 6.1.0 release');
  assert.ok(installerOnDisk, 'installer present');
  const buf = fs.readFileSync(path.join(dist, installerOnDisk));
  assert.equal(crypto.createHash('sha512').update(buf).digest('base64'), feedSha, 'sha512 in latest.yml equals the installer');
  assert.match(yml, new RegExp(`size:\\s*${buf.length}\\b`));
});

async function run(serveTampered) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sasv-updater-artifact-'));
  const port = await freePort();
  const real = fs.readFileSync(path.join(dist, installerOnDisk));
  const tampered = Buffer.from(real); tampered[tampered.length - 7] ^= 0xff;
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/latest.yml')) { r.setHeader('content-type', 'text/yaml'); return r.end(yml); }
    if (decodeURIComponent(q.url.split('?')[0]) === `/${feedPath}`) { const body = serveTampered ? tampered : real; r.setHeader('content-length', body.length); r.setHeader('content-type', 'application/octet-stream'); return r.end(body); }
    r.statusCode = 404; r.end();
  });
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  // Unpackaged electron-updater reads its config from dev-app-update.yml; point it at a temp file for the local feed instead of touching the repo.
  const devCfg = path.join(tmp, 'dev-app-update.yml'); fs.writeFileSync(devCfg, `provider: generic
url: http://127.0.0.1:${port}
`);
  const env = { ...process.env, SASV_STATIC_PORT: String(await freePort()), NODE_ENV: 'production', LOCALAPPDATA: tmp }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ['.', `--user-data-dir=${path.join(tmp, 'ud')}`], cwd: root, env, timeout: 90000 });
  try {
    await app.firstWindow({ timeout: 90000 });
    return await app.evaluate(async (_e, { port, updaterPath, semverPath, devCfg }) => {
      const { autoUpdater } = process.mainModule.require(updaterPath);
      Object.defineProperty(autoUpdater.app, 'appUpdateConfigPath', { value: devCfg, configurable: true });
      const semver = process.mainModule.require(semverPath);
      autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.forceDevUpdateConfig = true;
      autoUpdater.currentVersion = semver.parse('6.1.0');
      autoUpdater.setFeedURL({ provider: 'generic', url: `http://127.0.0.1:${port}` });
      const check = await autoUpdater.checkForUpdates();
      try { const files = await autoUpdater.downloadUpdate(); return { available: check.isUpdateAvailable, version: check.updateInfo.version, downloaded: Array.isArray(files) && files.length > 0 }; }
      catch (e) { return { available: check.isUpdateAvailable, version: check.updateInfo.version, downloaded: false, error: String(e && e.message).slice(0, 160) }; }
    }, { devCfg, port, updaterPath: path.join(root, 'node_modules', 'electron-updater'), semverPath: createRequire(path.join(root, 'node_modules', 'electron-updater', 'package.json')).resolve('semver') });
  } finally { await app.close().catch(() => {}); await new Promise(r => srv.close(r)); fs.rmSync(tmp, { recursive: true, force: true }); }
}

test('a simulated 6.1.0 client downloads the real candidate installer and its sha512 verifies (not installed)', { skip }, async () => {
  const r = await run(false);
  assert.equal(r.available, true); assert.equal(r.version, pkg.version); assert.equal(r.downloaded, true, JSON.stringify(r));
});
test('a tampered copy of the installer is rejected by the sha512 check', { skip }, async () => {
  const r = await run(true);
  assert.equal(r.available, true); assert.equal(r.downloaded, false); assert.match(String(r.error), /sha512|checksum/i, JSON.stringify(r));
});
