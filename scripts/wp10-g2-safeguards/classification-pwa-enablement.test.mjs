// WP10 PWA enablement - offline verification for the four classification master modules.
// Static contract + shell behaviour (injected seams, no network, no live identities) + mocked Chromium layout/state checks.
// None of this is live-role evidence: genuine Editor / View-only / No-access browser acceptance remains a separate gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { computeToken, STAMPED, TOKEN_RE } from './stamp-classification-pwa-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const MODULES = [
  { page: 'manage-categories', js: 'categories', permission: 'module:manage-categories', rpcs: ['create_category', 'rename_category', 'delete_category'] },
  { page: 'manage-subcategories', js: 'subcategories', permission: 'module:manage-subcategories', rpcs: ['create_subcategory', 'rename_subcategory', 'delete_subcategory'] },
  { page: 'manage-product-groups', js: 'product-groups', permission: 'module:manage-product-groups', rpcs: ['create_product_group', 'rename_product_group', 'delete_product_group'] },
  { page: 'manage-subgroups', js: 'subgroups', permission: 'module:manage-subgroups', rpcs: ['create_subgroup', 'rename_subgroup', 'delete_subgroup'] }
];

for (const m of MODULES) {
  test(`${m.page}: canonical PWA route, assets and shell wiring exist`, () => {
    const html = read(`public/shared/${m.page}.html`);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
    assert.ok(html.includes('href="../shared/css/style.css"'));
    assert.match(html, /href="\.\.\/shared\/css\/sasv-classification-masters\.css\?v=[0-9a-f]{10}"/);
    assert.ok(html.includes(`src="js/${m.js}.js"`));
    assert.match(html, /<div id="classificationStatus" role="status" aria-live="polite" hidden><\/div>/);
    assert.ok(html.includes('id="homeIcon"') && /aria-label="Home"/.test(html));
    assert.ok(fs.existsSync(path.join(root, `public/shared/js/${m.js}.js`)));
    const js = read(`public/shared/js/${m.js}.js`);
    assert.ok(js.includes(`startClassificationModule('${m.permission}'`));
    assert.ok(js.includes("from './supabaseClient.js'"), 'must import the shared PWA/Electron client');
    assert.match(js, /from '\.\/classification-master-shell\.js\?v=[0-9a-f]{10}'/);
  });

  test(`${m.page}: legacy root URL is a forwarding stub only (Electron compatibility)`, () => {
    const stub = read(`${m.page}.html`);
    assert.ok(stub.includes(`url=public/shared/${m.page}.html`));
    assert.ok(stub.includes(`location.replace("public/shared/${m.page}.html"`));
    assert.doesNotMatch(stub, /<script[^>]+type="module"|supabase|\.rpc\(/);
    assert.ok(!fs.existsSync(path.join(root, `js/${m.js}.js`)), 'no duplicate root controller');
  });

  test(`${m.page}: mutations are governed RPCs only, never direct base-table DML`, () => {
    const js = read(`public/shared/js/${m.js}.js`);
    for (const op of m.rpcs) assert.ok(js.includes(`rpc_wp10_${op}`), `${op} missing`);
    assert.doesNotMatch(js, /\.(?:insert|update|upsert|delete)\s*\(/, 'no PostgREST write verbs');
    const rpcNames = [...js.matchAll(/\.rpc\('([a-z_0-9]+)'/g)].map(x => x[1]);
    assert.deepEqual([...new Set(rpcNames)].sort(), m.rpcs.map(o => `rpc_wp10_${o}`).sort());
  });

  test(`${m.page}: no row query can run before the canonical View check`, () => {
    const js = read(`public/shared/js/${m.js}.js`);
    assert.doesNotMatch(js, /addEventListener\('DOMContentLoaded',\s*(?:async\s*\(\)\s*=>\s*\{\s*)?(?:await\s+)?(?:Promise\.all\(\[)?\s*(?:loadCategories|renderTable)/);
    assert.doesNotMatch(js, /addEventListener\('DOMContentLoaded',\s*loadCategories\)/);
    assert.doesNotMatch(js, /window\.location\.href\s*=\s*'index\.html'/, 'navigation must be platform-neutral');
  });
}

test('shell: session gate, canonical access, platform-neutral home; no permission logic of its own', () => {
  const shell = read('public/shared/js/classification-master-shell.js');
  assert.ok(shell.includes("from './appBootstrap.js'") && shell.includes("from './master-data-platform.js'"));
  assert.ok(shell.includes('resolveMasterDataLoginPage()') && shell.includes('goMasterDataHome()'));
  assert.ok(shell.includes("from './classification-master-access.js'"));
  assert.doesNotMatch(shell, /supabase\.|\.rpc\(|\.from\(|localStorage|sessionStorage|innerHTML/);
});

test('hub exposure is a registry (data) decision: no client route hard-codes these modules into the hub', () => {
  const hub = read('public/utilities-hub/js/hub-auth.js');
  assert.doesNotMatch(hub, /manage-(?:categories|subcategories|product-groups|subgroups)/);
  const template = read('docs/master-data-costing/WP10_CLASSIFICATION_PWA_REGISTRY_ROUTES_PROPOSED_UNAPPLIED.sql');
  assert.match(template, /UNAPPLIED/);
  for (const m of MODULES) assert.ok(template.includes(`'${m.page}'`) && template.includes(`'public/shared/${m.page}.html'`));
  assert.doesNotMatch(template, /user_permissions|app_permissions|grant |revoke /i, 'registry routes only; no permission or grant changes');
});

// ---- shell behaviour with injected seams (fake DOM) ----
function makeDom() {
  const attrs = {};
  const nodes = { classificationStatus: { hidden: true, textContent: '', dataset: {}, setAttribute(k, v) { this[k] = v; } }, homeIcon: { addEventListener() {} } };
  return {
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: k => attrs[k] ?? null },
    getElementById: id => nodes[id] ?? null,
    attrs, nodes
  };
}
async function loadShell() {
  const source = read('public/shared/js/classification-master-shell.js')
    .replace(/import \{ bootstrapApp \} from '[^']+';/, 'const bootstrapApp = async () => ({ ok: true });')
    .replace(/import \{ goMasterDataHome, resolveMasterDataLoginPage \} from '[^']+';/, 'const goMasterDataHome = () => {}; const resolveMasterDataLoginPage = () => "/utilities-hub/index.html";')
    .replace(/import \{ mountModuleHome \} from '[^']+';/, 'const mountModuleHome = () => {};')
    .replace(/import \{ initializeClassificationAccess \} from '[^']+';/, 'const initializeClassificationAccess = async () => ({ canView: false, canEdit: false });');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
async function run(deps) {
  globalThis.document = makeDom();
  const shell = await loadShell();
  let loads = 0;
  const result = await shell.startClassificationModule('module:manage-categories', async () => { loads++; if (deps.loadThrows) throw new Error('boom'); }, deps);
  const dom = globalThis.document; delete globalThis.document;
  return { result, loads, state: dom.attrs['data-classification-state'], access: dom.attrs['data-wp10-classification-access'], status: dom.nodes.classificationStatus };
}
test('shell: no session -> nothing loads', async () => {
  const r = await run({ bootstrap: async () => ({ ok: false, reason: 'no-session' }), access: async () => { throw new Error('must not be called'); } });
  assert.equal(r.loads, 0); assert.equal(r.result.canView, false);
});
test('shell: session error -> fails closed with error state', async () => {
  const r = await run({ bootstrap: async () => ({ ok: false, reason: 'error' }), access: async () => ({ canView: true, canEdit: true }) });
  assert.equal(r.loads, 0); assert.equal(r.state, 'error'); assert.equal(r.status.hidden, false);
});
test('shell: No-access -> denied state, no load, writers stay locked', async () => {
  const r = await run({ bootstrap: async () => ({ ok: true }), access: async () => ({ canView: false, canEdit: false }) });
  assert.equal(r.loads, 0); assert.equal(r.state, 'denied'); assert.equal(r.access, 'locked');
  assert.equal(r.status.role, 'alert'); assert.match(r.status.textContent, /do not have permission/);
});
test('shell: access-check failure (canView false from guard error) -> denied, no load', async () => {
  const r = await run({ bootstrap: async () => ({ ok: true }), access: async () => ({ canView: false, canEdit: true }) });
  assert.equal(r.loads, 0); assert.equal(r.state, 'denied');
});
for (const [name, edit] of [['View-only', false], ['Editor', true]]) {
  test(`shell: ${name} -> load runs once and state clears`, async () => {
    const r = await run({ bootstrap: async () => ({ ok: true }), access: async () => ({ canView: true, canEdit: edit }) });
    assert.equal(r.loads, 1); assert.equal(r.state, 'ready'); assert.equal(r.status.hidden, true); assert.equal(r.result.canEdit, edit);
  });
}
test('shell: load failure -> error state, no unhandled rejection', async () => {
  const r = await run({ loadThrows: true, bootstrap: async () => ({ ok: true }), access: async () => ({ canView: true, canEdit: false }) });
  assert.equal(r.state, 'error'); assert.equal(r.status.role, 'alert');
});

// ---- mocked Chromium: real HTML + real CSS + real access module, stubbed supabase ----
let chromium = null;
try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch { /* optional locally */ }
const skip = process.env.WP10_G2_BROWSER_SKIP === '1' || !chromium ? 'Chromium unavailable' : false;
let browser;
test.before(async () => { if (!skip) browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); });

async function renderPage(m, width, perm) {
  const html = read(`public/shared/${m.page}.html`).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]+>/g, '');
  const css = read('public/shared/css/sasv-classification-masters.css');
  const access = read('public/shared/js/classification-master-access.js').replace(/import \{ supabase \} from ['"][^'"]+['"];?/, 'const supabase=window.__mockSupabase;') + '\nwindow.__init=initializeClassificationAccess;';
  const shell = read('public/shared/js/classification-master-shell.js')
    .replace(/import \{ bootstrapApp \} from '[^']+';/, 'const bootstrapApp = async () => ({ ok: true });')
    .replace(/import \{ goMasterDataHome, resolveMasterDataLoginPage \} from '[^']+';/, 'const goMasterDataHome = () => {}; const resolveMasterDataLoginPage = () => "/x";')
    .replace(/import \{ mountModuleHome \} from '[^']+';/, 'const mountModuleHome = () => {};')
    .replace(/import \{ initializeClassificationAccess \} from '[^']+';/, access.replace(/export /g, ''));
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.setContent(html.replace('</head>', `<style>${css}</style></head>`));
  await page.evaluate(p => { window.__mockSupabase = { rpc: async (_n, a) => ({ data: p === 'edit' || (p === 'view' && a.p_mode === 'view'), error: null }) }; }, perm);
  await page.evaluate(() => { window.__rows = 0; });
  await page.addScriptTag({ type: 'module', content: `${shell}\nwindow.__start=()=>startClassificationModule('${m.permission}',async()=>{window.__rows++;});` });
  await page.waitForFunction(() => typeof window.__start === 'function');
  await page.evaluate(() => window.__start());
  await page.waitForFunction(() => document.documentElement.getAttribute('data-classification-state') !== 'loading');
  const out = await page.evaluate(() => {
    const vis = sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
    return {
      state: document.documentElement.getAttribute('data-classification-state'),
      rows: window.__rows,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyVisible: vis('.sasv-module-shell section') || vis('.sasv-module-shell .filters'),
      statusVisible: vis('#classificationStatus'),
      writerVisible: vis('.edit-btn') || vis('#addCategoryForm') || vis('#addSubForm') || vis('#addSubGroupForm') || vis('#addSection') || vis('#addNewSubCategory')
    };
  });
  await page.close();
  return out;
}
for (const width of [390, 1280]) for (const m of MODULES) {
  test(`${m.page} @${width}: No-access sees denial only; View-only/Editor load; no horizontal overflow`, { skip }, async () => {
    const none = await renderPage(m, width, 'none');
    assert.equal(none.state, 'denied'); assert.equal(none.rows, 0);
    assert.equal(none.bodyVisible, false, 'restricted content hidden'); assert.equal(none.statusVisible, true);
    assert.ok(none.overflow <= 1, 'no horizontal overflow (denied)');
    const view = await renderPage(m, width, 'view');
    assert.equal(view.state, 'ready'); assert.equal(view.rows, 1); assert.equal(view.writerVisible, false);
    assert.ok(view.overflow <= 1, 'no horizontal overflow (view)');
    const edit = await renderPage(m, width, 'edit');
    assert.equal(edit.state, 'ready'); assert.equal(edit.rows, 1);
    assert.ok(edit.overflow <= 1, 'no horizontal overflow (edit)');
  });
}

// ---- service-worker delivery: public/sw.js is pinned and unchanged; versioned URLs keep helper and page in step ----
test('stamped ?v= token matches the shell and stylesheet content on every importer', () => {
  const token = computeToken();
  let seen = 0;
  for (const f of STAMPED) {
    for (const m of read(f).matchAll(new RegExp(TOKEN_RE.source, 'g'))) { seen++; assert.equal(m[2], token, f + ' has a stale token; run stamp-classification-pwa-version.mjs'); }
  }
  assert.equal(seen, 8, 'four controllers + four pages');
});

test('unchanged SW: an old cached ?v=OLD shell is unreachable from an updated page requesting ?v=NEW', async () => {
  const ORIGIN = 'https://hub.test';
  const store = new Map([[ORIGIN + '/shared/js/classification-master-shell.js?v=0000000000', 'OLD']]);
  const handlers = {};
  const resp = body => ({ ok: true, status: 200, body, clone() { return this; } });
  const ctx = {
    URL, console, Promise, Map, Set, RegExp, Response: class {},
    self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} }, location: { origin: ORIGIN } },
    location: { origin: ORIGIN },
    caches: {
      match: async req => { const k = typeof req === 'string' ? req : req.url; return store.has(k) ? resp(store.get(k)) : undefined; },
      open: async () => ({ put: async (req, res) => { store.set(typeof req === 'string' ? req : req.url, res.body); }, addAll: async () => {} }),
      keys: async () => [], delete: async () => true
    },
    fetch: async req => resp('NET:' + new URL(typeof req === 'string' ? req : req.url).search)
  };
  vm.createContext(ctx);
  vm.runInContext(read('public/sw.js'), ctx);
  const get = async q => { let out; handlers.fetch({ request: { url: ORIGIN + q, method: 'GET', mode: 'cors', headers: { get: () => null } }, respondWith: p => { out = p; } }); return (await out).body; };
  assert.equal(await get('/shared/js/classification-master-shell.js?v=0000000000'), 'OLD', 'old parent keeps its own matching helper');
  assert.equal(await get('/shared/js/classification-master-shell.js?v=' + computeToken()), 'NET:?v=' + computeToken(), 'updated parent fetches the new helper');
});
