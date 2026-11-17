// WP11 PM BOM responsive regression (real Chromium, mobile emulation, populated template; network stubbed, nothing written).
//   node --test scripts/pm-bom-responsive/pm-bom-responsive.test.mjs
// Fixture: genuine hosted v393 failure at 390 px - populated template => documentElement.scrollWidth 847 vs clientWidth 390,
// Save/Reload/menus laid out at x=663..992 inside a 358 px clipped panel. The "original CSS" test removes the WP11 rule and MUST overflow,
// proving this suite fails against the defect and passes against the correction.
import test from "node:test";
import assert from "node:assert/strict";
import { launch, startServer } from "../wp08-g2-0-shared-master-data/harness.mjs";

const STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "wp11@example.invalid" };
const TPL = [{ id: 1, code: "100 g_Powder PP Packing" }, { id: 2, code: "10 Kg PET Jar - Natural" }];
const ITEMS = [1,2,3,4].map((i) => ({ id: i, name: "Packing item " + i + " 100 ML x 70 Nos - Carton", code: "I00000" + i }));
function chain(table) {
  const st = { table, single: false };
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res, rej) => Promise.resolve(resolve(st)).then(res, rej);
      if (prop === "maybeSingle" || prop === "single") return () => { st.single = true; return proxy; };
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}
function resolve(st) {
  const ok = (data) => ({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
  switch (st.table) {
    case "plm_tpl_header": return st.single ? ok({ id: 1, code: TPL[0].code, reference_output_qty: 100, reference_output_uom_id: 1, process_loss_pct: 0.02 }) : ok(TPL);
    case "inv_uom": return ok([{ id: 1, code: "g" }, { id: 2, code: "Nos" }]);
    case "inv_class_category": return ok([{ id: 7 }]);
    case "inv_stock_item_class_map": return ok(ITEMS.map((i) => ({ stock_item_id: i.id })));
    case "inv_stock_item": return ok(ITEMS);
    case "rpc:rpc_pm_tpl_list_lines": return ok(ITEMS.map((i) => ({ id: 100 + i.id, stock_item_id: i.id, qty_per_reference_output: i.id, uom_id: 2, wastage_pct: 0.02, is_optional: false, remarks: "" })));
    default: return ok([]);
  }
}
export function createClient() {
  const session = { access_token: "stub", user };
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }), getUser: async () => ({ data: { user }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), refreshSession: async () => ({ data: { session }, error: null }), signOut: async () => ({ error: null }) },
    from: (t) => chain(t),
    rpc: (name) => {
      if (name === "get_user_permissions" || name === "app_get_my_permissions") return Promise.resolve({ data: window.__MOCK_GRANTS, error: null });
      if (name === "app_get_current_user_context") return Promise.resolve({ data: { user_id: user.id, email: user.email, is_authenticated: true }, error: null });
      return chain("rpc:" + name);
    },
    schema() { return client; },
  };
  return client;
}
`;
const WP11_RULE = /\/\* WP11: \.hdr-top is nowrap[\s\S]*?min-width: 0;\s*\}\s*\}\s*(?=@media \(max-width: 640px\))/;
const CONTROLS = ["#qaChip", "#reloadBtn", "#saveBtn"];

let env, server;
async function getEnv(t) {
  if (!env) {
    const l = await launch(); if (!l) { t.skip("Playwright/Chromium not available"); return null; }
    env = l; env.servers = { pwa: await startServer("pwa") }; server = env.servers.pwa;
  }
  return env;
}
test.after(async () => { await env?.close(); server?.close(); });

async function open(width, { stripFix = false, page: file = "manage-pm-bom.html", populate = true } = {}) {
  const context = await env.browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768, deviceScaleFactor: 2 });
  const grants = [{ target: file.includes("rm") ? "module:manage-rm-bom" : file.includes("sp") ? "module:manage-sp-bom" : "module:pm-templates", can_view: true, can_edit: true }];
  await context.addInitScript((g) => { window.__MOCK_GRANTS = g; }, grants);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const url = route.request().url();
    if (/esm\.sh\/@supabase\/supabase-js/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  if (stripFix) await context.route(/manage-pm-bom\.html/, async (route) => {
    const res = await route.fetch(); const body = await res.text();
    assert.match(body, WP11_RULE, "WP11 rule present to be stripped");
    await route.fulfill({ response: res, body: body.replace(WP11_RULE, "") });
  });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${server.address().port}/shared/${file}`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  if (populate) {
    await page.evaluate(() => { const s = document.getElementById("tplPicker"); s.value = "1"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.waitForFunction(() => document.querySelectorAll("#linesBody tr").length >= 4, null, { timeout: 8000 });
    await page.waitForTimeout(500);
  }
  return { page, context, errors };
}
const metrics = (page) => page.evaluate((sels) => {
  const d = document.documentElement; const vw = d.clientWidth;
  const rects = Object.fromEntries(sels.map((s) => { const e = document.querySelector(s); if (!e) return [s, null]; const r = e.getBoundingClientRect(); return [s, { left: r.left, right: r.right, w: r.width }]; }));
  return { vw, innerWidth, scrollWidth: Math.max(d.scrollWidth, document.body.scrollWidth), rows: document.querySelectorAll("#linesBody tr").length, rects };
}, CONTROLS);

for (const width of [390, 768, 1280]) {
  test(`PM BOM populated @${width}: no page-level overflow, header controls inside the viewport, table scrolls internally`, async (t) => {
    if (!(await getEnv(t))) return;
    const { page, context, errors } = await open(width);
    const m = await metrics(page);
    assert.deepEqual(errors, [], "no page errors");
    assert.ok(m.rows >= 4, `populated template (${m.rows} lines)`);
    assert.ok(m.scrollWidth <= m.vw + 1, `scrollWidth ${m.scrollWidth} <= clientWidth ${m.vw}`);
    assert.ok(m.innerWidth <= m.vw + 1, `layout viewport did not widen (${m.innerWidth})`);
    for (const s of CONTROLS) {
      const r = m.rects[s]; assert.ok(r && r.w > 0, `${s} rendered`);
      assert.ok(r.left >= 0 && r.right <= m.vw + 1, `${s} inside viewport: ${r.left}..${r.right} of ${m.vw}`);
    }
    const sc = await page.evaluate(() => { const e = document.getElementById("linesScroll"); if (!e) return null; const before = e.scrollLeft; e.scrollLeft = 120; return { overflowing: e.scrollWidth > e.clientWidth + 1, moved: e.scrollLeft !== before, pageX: scrollX }; });
    assert.ok(sc, "#linesScroll exists");
    if (sc.overflowing) assert.equal(sc.moved, true, "table scrolls internally");
    assert.equal(sc.pageX, 0, "page itself does not scroll horizontally");
    await context.close();
  });
}

test("PM BOM header controls are clickable (not clipped or covered) at 390 px", async (t) => {
  if (!(await getEnv(t))) return;
  const { page, context } = await open(390);
  for (const s of CONTROLS) {
    const hit = await page.evaluate((sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && (top === e || e.contains(top)); }, s);
    assert.equal(hit, true, `${s} is the topmost element at its centre`);
  }
  await context.close();
});

test("MUTATION: with the WP11 rule removed (original v393 CSS) the 390 px populated page overflows - this suite fails against the defect", async (t) => {
  if (!(await getEnv(t))) return;
  const { page, context } = await open(390, { stripFix: true });
  const m = await metrics(page);
  await context.close();
  const bad = m.scrollWidth > m.vw + 1 || m.innerWidth > m.vw + 1 || CONTROLS.some((s) => !m.rects[s] || m.rects[s].right > m.vw + 1);
  assert.ok(bad, `original CSS must reproduce the defect, got ${JSON.stringify(m)}`);
});

for (const file of ["manage-rm-bom.html", "manage-sp-bom.html"]) {
  test(`${file} @390 header evaluated: hdr-top wraps (the PM defect is absent) and no page overflow`, async (t) => {
    if (!(await getEnv(t))) return;
    const { page, context } = await open(390, { page: file, populate: false });
    const r = await page.evaluate(() => { const t = document.querySelector(".panel-header .hdr-top"); const d = document.documentElement; return { wrap: t && getComputedStyle(t).flexWrap, vw: d.clientWidth, sw: d.scrollWidth }; });
    await context.close();
    assert.equal(r.wrap, "wrap");
    assert.ok(r.sw <= r.vw + 1, `scrollWidth ${r.sw} <= ${r.vw}`);
  });
}
