// WP10 PWA enablement - REAL module-resolution smoke for the four classification pages.
// 1) Static: every relative import reachable from each page resolves to a file, and stays inside public/ (what Netlify publishes).
// 2) Browser: the unmodified pages and modules are served from public/ (PWA layout) and from the repo root (Electron layout, incl.
//    the legacy root URL stub); only the external supabase-js CDN module and the supabase network are replaced by in-memory mocks.
// This proves the import graph loads and the real controllers obey the View gate. It is NOT live-role or server-side evidence:
// Stage A still lets authenticated users SELECT these base tables over REST, so the client View gate is a UI control only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = ['categories', 'subcategories', 'product-groups', 'subgroups'];
const CDN = 'https://esm.sh/@supabase/supabase-js@2';

function importsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const specs = [];
  for (const m of src.matchAll(/(?:^|[\n;])\s*(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
  for (const m of src.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1]);
  return specs;
}
function walk(entry) {
  const seen = new Set(); const problems = []; const external = new Set();
  const visit = file => {
    if (seen.has(file)) return; seen.add(file);
    for (const spec of importsOf(file)) {
      if (/^https?:/.test(spec)) { external.add(spec); continue; }
      if (!spec.startsWith('.') && !spec.startsWith('/')) { problems.push(`${path.relative(root, file)}: bare specifier ${spec}`); continue; }
      const target = path.resolve(path.dirname(file), spec.split('?')[0]);
      if (!target.startsWith(path.join(root, 'public') + path.sep)) problems.push(`${path.relative(root, file)}: ${spec} escapes public/ (not published)`);
      else if (!fs.existsSync(target)) problems.push(`${path.relative(root, file)}: ${spec} -> missing ${path.relative(root, target)}`);
      else visit(target);
    }
  };
  visit(entry);
  return { seen, problems, external };
}

for (const p of PAGES) {
  test(`${p}: every import reachable from the page resolves inside public/`, () => {
    const html = fs.readFileSync(path.join(root, `public/shared/manage-${p}.html`), 'utf8');
    const src = html.match(/<script type="module" src="([^"]+)"/)?.[1];
    assert.ok(src, 'module script tag');
    const entry = path.resolve(path.join(root, 'public/shared'), src);
    assert.ok(fs.existsSync(entry), 'controller exists');
    const { seen, problems, external } = walk(entry);
    assert.deepEqual(problems, []);
    for (const need of ['supabaseClient.js', 'classification-master-access.js', 'classification-master-shell.js', 'classification-html-escape.js', 'appBootstrap.js', 'master-data-platform.js'])
      assert.ok([...seen].some(f => f.endsWith(need)), `${need} is in the graph`);
    assert.deepEqual([...external], [CDN], 'only the pinned supabase-js CDN module is external');
  });

  test(`${p}: root legacy stub target and its assets resolve (Electron path)`, () => {
    const stub = fs.readFileSync(path.join(root, `manage-${p}.html`), 'utf8');
    const target = stub.match(/url=([^"]+)"/)[1];
    assert.ok(fs.existsSync(path.join(root, target)), target);
    const page = fs.readFileSync(path.join(root, target), 'utf8');
    for (const css of page.matchAll(/<link rel="stylesheet" href="([^"]+)"/g))
      assert.ok(fs.existsSync(path.resolve(path.dirname(path.join(root, target)), css[1].split('?')[0])), css[1]);
  });
}

// ---- browser smoke ----
let chromium = null;
try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch { /* optional locally */ }
const skip = process.env.WP10_G2_BROWSER_SKIP === '1' || !chromium ? 'Chromium unavailable' : false;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
function serve(dir) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(dir, rel);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}
const CLIENT_STUB = `
const chain = () => { const p = new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? r => { (window.__fromCalls ||= []).push(1); r({ data: [], error: null }); } : () => p), apply: () => p }); return p; };
export function createClient() {
  const c = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'smoke@example.invalid' } } } }),
      getUser: async () => ({ data: { user: { id: 'u1', email: 'smoke@example.invalid' } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    rpc: async (name, args) => ({ data: name === 'app_has_permission' ? !!window.__perm(args) : [], error: null }),
    from: () => { (window.__fromCalls ||= []).push(1); return chain(); },
    schema: () => c
  };
  return c;
}`;
let browser;
test.before(async () => { if (!skip) browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); });

async function open(base, urlPath, perm) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(`${r.status()} ${r.url().replace(base, '')}`); });
  page.on('requestfailed', r => { if (r.url().startsWith(base)) problems.push('failed ' + r.url().replace(base, '')); });
  await page.route(CDN, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: CLIENT_STUB }));
  await page.route(/supabase\.co/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(p => { window.__perm = a => (p === 'edit') || (p === 'view' && a.p_mode === 'view'); }, perm);
  await page.goto(base + urlPath);
  await page.waitForFunction(() => { const s = document.documentElement.getAttribute('data-classification-state'); return s && s !== 'loading'; }, null, { timeout: 15000 });
  const out = await page.evaluate(() => {
    const vis = sel => [...document.querySelectorAll(sel)].some(e => getComputedStyle(e).display !== 'none');
    return {
      url: location.pathname,
      state: document.documentElement.getAttribute('data-classification-state'),
      access: document.documentElement.getAttribute('data-wp10-classification-access'),
      queries: (window.__fromCalls || []).length,
      writers: vis('#addCategoryForm, #addSubForm, #addSubGroupForm, #addSection, #addNewSubCategory, .edit-btn')
    };
  });
  await ctx.close();
  return { ...out, problems };
}

for (const layout of ['pwa', 'electron']) {
  for (const p of PAGES) {
    test(`${p} [${layout} layout]: real modules load; No-access queries nothing; View-only has no writers; Editor has writers`, { skip }, async () => {
      const dir = layout === 'pwa' ? path.join(root, 'public') : root;
      const { server, base } = await serve(dir);
      try {
        const urlPath = layout === 'pwa' ? `/shared/manage-${p}.html` : `/manage-${p}.html`; // electron: legacy root URL forwards
        const none = await open(base, urlPath, 'none');
        assert.deepEqual(none.problems, [], 'no module/404/page errors');
        assert.ok(none.url.endsWith(`/shared/manage-${p}.html`), 'landed on the canonical page: ' + none.url);
        assert.equal(none.state, 'denied'); assert.equal(none.queries, 0, 'No-access must not issue any table query');
        const view = await open(base, urlPath, 'view');
        assert.deepEqual(view.problems, []);
        assert.notEqual(view.state, 'denied'); assert.equal(view.access, 'view'); assert.ok(view.queries >= 1, 'View-only loads rows');
        assert.equal(view.writers, false);
        const edit = await open(base, urlPath, 'edit');
        assert.deepEqual(edit.problems, []);
        assert.equal(edit.access, 'edit'); assert.equal(edit.writers, true);
      } finally { server.close(); }
    });
  }
}
