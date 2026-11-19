// Unit tests for electron/security-hardening.js (pure Node, no Electron needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const h = require('../../electron/security-hardening.js');

test('resolveStaticPort: default 3000, test override accepted only for valid unprivileged ports', () => {
  assert.equal(h.resolveStaticPort({}), 3000);
  assert.equal(h.resolveStaticPort({ SASV_STATIC_PORT: '' }), 3000);
  assert.equal(h.resolveStaticPort({ SASV_STATIC_PORT: '43123' }), 43123);
  for (const bad of ['abc', '80', '70000', '3000.5', '-1']) assert.equal(h.resolveStaticPort({ SASV_STATIC_PORT: bad }), 3000, bad);
});

test('isAppUrl: only http://localhost|127.0.0.1 on the app port', () => {
  for (const ok of ['http://localhost:3000/login.html', 'http://127.0.0.1:3000/x?y=1#z']) assert.equal(h.isAppUrl(ok, 3000), true, ok);
  for (const bad of ['https://localhost:3000/', 'http://localhost:3001/', 'http://localhost/', 'http://evil.example:3000/', 'http://localhost.evil.example:3000/', 'file:///C:/x.html', 'javascript:alert(1)', 'not a url', '']) assert.equal(h.isAppUrl(bad, 3000), false, bad);
});

test('resolveModuleUrl: relative and app-origin URLs resolve; everything else is rejected', () => {
  assert.equal(h.resolveModuleUrl('index.html', 3000), 'http://localhost:3000/index.html');
  assert.equal(h.resolveModuleUrl('public/shared/manage-categories.html?x=1', 3000), 'http://localhost:3000/public/shared/manage-categories.html?x=1');
  assert.equal(h.resolveModuleUrl('http://localhost:3000/a.html', 3000), 'http://localhost:3000/a.html');
  for (const bad of ['https://example.com/', 'http://example.com:3000/', 'file:///C:/Windows/win.ini', 'javascript:alert(1)', 'data:text/html,<script>1</script>', 'http://user:pw@localhost:3000/', '//example.com/x', 'http://', '', null, undefined, 42, 'x'.repeat(5000)])
    assert.equal(h.resolveModuleUrl(bad, 3000), null, String(bad).slice(0, 40));
});

test('clampSize bounds values requested over IPC', () => {
  assert.equal(h.clampSize(1200, 800), 1200);
  assert.equal(h.clampSize(99999, 800), 4000);
  assert.equal(h.clampSize(5, 800), 320);
  assert.equal(h.clampSize('abc', 800), 800);
  assert.equal(h.clampSize(undefined, 800), 800);
});

test('classifyWindowOpen: allow app pages, about:blank and app blob: URLs; external https goes out; the rest is denied', () => {
  assert.equal(h.classifyWindowOpen('about:blank', 3000), 'allow');
  assert.equal(h.classifyWindowOpen('http://localhost:3000/public/shared/coa-print.html?id=1', 3000), 'allow');
  assert.equal(h.classifyWindowOpen('blob:http://localhost:3000/1f6c1c1e-0000-4000-8000-000000000000', 3000), 'allow');
  assert.equal(h.classifyWindowOpen('blob:https://evil.example/abc', 3000), 'deny');
  assert.equal(h.classifyWindowOpen('https://example.com/docs', 3000), 'external');
  assert.equal(h.classifyWindowOpen('http://example.com/docs', 3000), 'external');
  for (const bad of ['file:///C:/Windows/win.ini', 'javascript:alert(1)', 'data:text/html,hi', 'ms-settings:privacy', 'smb://host/share', 'garbage']) assert.equal(h.classifyWindowOpen(bad, 3000), 'deny', bad);
});

test('classifyNavigation: app pages stay on the app origin; other windows are not restricted', () => {
  const app = 'http://localhost:3000/index.html';
  assert.equal(h.classifyNavigation(app, 'http://localhost:3000/login.html', 3000), 'allow');
  assert.equal(h.classifyNavigation(app, 'https://example.com/', 3000), 'external');
  assert.equal(h.classifyNavigation(app, 'file:///C:/x.html', 3000), 'block');
  assert.equal(h.classifyNavigation(app, 'javascript:alert(1)', 3000), 'block');
  assert.equal(h.classifyNavigation('file:///C:/prompt.html', 'https://example.com/', 3000), 'allow', 'electron-prompt style windows are untouched');
  assert.equal(h.classifyNavigation('about:blank', 'https://example.com/', 3000), 'allow');
});

test('listenLoopback binds loopback only: reachable on 127.0.0.1, refused on a non-loopback interface address', async () => {
  const os = await import('node:os');
  const lan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
  const free = await new Promise(res => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const servers = await h.listenLoopback((req, res) => { res.end('ok'); }, free);
  try {
    const get = (host) => new Promise(resolve => { const r = http.get({ host, port: free, path: '/', timeout: 2000 }, res => { res.resume(); resolve(res.statusCode); }); r.on('error', e => resolve(e.code)); r.on('timeout', () => { r.destroy(); resolve('TIMEOUT'); }); });
    assert.equal(await get('127.0.0.1'), 200);
    if (lan) assert.notEqual(await get(lan), 200, 'must not be reachable through the LAN address ' + '(redacted)');
  } finally { await Promise.all(servers.map(s => new Promise(r => s.close(r)))); }
});

test('listenLoopback rejects when the IPv4 loopback port is already in use', async () => {
  const blocker = net.createServer();
  await new Promise(r => blocker.listen(0, '127.0.0.1', r));
  const port = blocker.address().port;
  await assert.rejects(h.listenLoopback((req, res) => res.end('x'), port), /EADDRINUSE/);
  blocker.close();
});
