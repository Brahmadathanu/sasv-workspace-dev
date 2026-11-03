// MDC-07 / N2 browser tests (Chromium via Playwright; skipped only when Playwright is unavailable or
// COSTING_NAV_SKIP_BROWSER=1). Real Material Cost / Cost Build pages and shell against an inert recording fake backend:
// no Supabase, no network, no writes. Permissions are supplied per test, so the RM/PM trace behaviour is verified for
// every role combination. The N1 flag is set in the browser's localStorage only.
import test from "node:test";
import assert from "node:assert/strict";
import { launchAudit } from "../costing-responsive/responsive-audit.mjs";

const SKIP = process.env.COSTING_NAV_SKIP_BROWSER === "1";
const FLAG_ON = { COSTING_NAV_GROUPS_V1: "1" };
const MCM = "shared/material-cost-manager.html";
const CBM = "shared/cost-build-manager.html";
const MODULES = ["module:material-cost-manager", "module:cost-build-manager"];
const RM = "role:material-cost-rm-trace";
const PM = "role:material-cost-pm-trace";
const WRITE_RPC = /^rpc_(create|update|upsert|delete|submit|approve|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|cancel|correct|accept|close|save|refresh|request)/;

// Recording fake Supabase. `window.__N2_PERMS` is the get_user_permissions payload.
const STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "audit@example.invalid" };
const session = { access_token: "stub", user };
const result = { data: [], error: null, count: 0 };
globalThis.__calls = [];
function chain(tag) {
  const fn = () => proxy;
  const proxy = new Proxy(fn, {
    get(_t, prop) {
      if (prop === "then") return (res) => Promise.resolve(result).then(res);
      if (prop === "catch" || prop === "finally") return () => proxy;
      return (..._a) => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}
export function createClient() {
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      refreshSession: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (t) => { globalThis.__calls.push({ kind: "from", name: t }); return chain(t); },
    rpc: (name, args) => {
      globalThis.__calls.push({ kind: "rpc", name, args: JSON.parse(JSON.stringify(args ?? {})) });
      if (name === "get_user_permissions") return Promise.resolve({ data: globalThis.__N2_PERMS, error: null });
      return chain(name);
    },
    schema: () => client, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  };
  return client;
}
`;

let env;
const getEnv = async (t) => {
  if (SKIP) { t.skip("COSTING_NAV_SKIP_BROWSER=1"); return null; }
  env ??= await launchAudit();
  if (!env) { t.skip("playwright not available"); return null; }
  return env;
};
test.after(async () => { await env?.close(); });

async function open(e, rel, { storage = {}, targets = [], query = "", width = 1280, perms } = {}) {
  const context = await e.browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err.message).slice(0, 200)));
  const payload = perms ?? [...MODULES, ...targets].map((target) => ({ target, can_view: true, can_edit: false }));
  await page.addInitScript(({ entries, payload: p }) => {
    try { for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v); } catch { /* ignore */ }
    globalThis.__N2_PERMS = p;
  }, { entries: storage, payload });
  await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  await page.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB }));
  await page.goto(`${e.base}/${rel}${query}`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  return { context, page, errors };
}

const nav = (page) => page.evaluate(() => {
  const shown = (el) => !!el && !el.hidden && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
  return {
    pills: Object.fromEntries([...document.querySelectorAll("#lensPills .pill")].map((b) => [b.dataset.lens, shown(b)])),
    pillCount: document.querySelectorAll("#lensPills .pill").length,
    groups: Object.fromEntries([...document.querySelectorAll("#lensPills .cp-nav-group")].map((g) => [g.dataset.navGroup, shown(g)])),
    options: Object.fromEntries([...document.querySelectorAll("#lensSelect option")].map((o) => [o.value, { hidden: o.hidden, disabled: o.disabled }])),
    optgroups: Object.fromEntries([...document.querySelectorAll("#lensSelect optgroup")].map((g) => [g.label, { hidden: g.hidden, disabled: g.disabled }])),
    active: [...document.querySelectorAll("#lensPills .pill.active")].map((b) => b.dataset.lens),
    scopeNotes: [...document.querySelectorAll("[data-nav-scope]")].map((e) => ({ lens: e.dataset.navScope, group: e.dataset.navGroup, text: e.textContent.trim() })),
    bodyText: document.body.innerText,
  };
});
const calls = (page) => page.evaluate(() => globalThis.__calls || []);
const traceCalls = async (page) => (await calls(page)).filter((c) => /trace/i.test(c.name));
const writes = async (page) => (await calls(page)).filter((c) => c.kind === "rpc" && WRITE_RPC.test(c.name));

const CASES = [
  { name: "no trace roles", targets: [], rm: false, pm: false },
  { name: "RM only", targets: [RM], rm: true, pm: false },
  { name: "PM only", targets: [PM], rm: false, pm: true },
  { name: "RM and PM", targets: [RM, PM], rm: true, pm: true },
];

test("flag ON: trace pills, group and select options follow the RM/PM view roles independently (all four role combinations)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const c of CASES) {
    for (const width of [1280, 390]) {
      const { page, context, errors } = await open(e, MCM, { storage: FLAG_ON, targets: c.targets, width });
      const s = await nav(page);
      assert.equal(s.pillCount, 3, `${c.name}: DOM keeps all three destinations (nothing removed from the contract)`);
      if (width > 520) { // the pill strip is replaced by the select at <=520px (existing responsive rule)
        assert.equal(s.pills["manual-rate-manager"], true, `${c.name}: Rates always shown`);
        assert.equal(s.pills["rm-cost-trace"], c.rm, `${c.name}: RM trace pill`);
        assert.equal(s.pills["pm-cost-trace"], c.pm, `${c.name}: PM trace pill`);
        assert.equal(s.groups.traces, c.rm || c.pm, `${c.name}: Traces group heading`);
        assert.equal(s.groups.rates, true);
      }
      assert.deepEqual(s.options["manual-rate-manager"], { hidden: false, disabled: false });
      assert.equal(s.options["rm-cost-trace"].hidden, !c.rm, `${c.name}: RM option`);
      assert.equal(s.options["rm-cost-trace"].disabled, !c.rm);
      assert.equal(s.options["pm-cost-trace"].hidden, !c.pm, `${c.name}: PM option`);
      assert.equal(s.options["pm-cost-trace"].disabled, !c.pm);
      assert.equal(s.optgroups.Traces.hidden, !(c.rm || c.pm), `${c.name}: Traces optgroup`);
      assert.deepEqual(s.active, ["manual-rate-manager"]);
      assert.deepEqual(errors, [], c.name);
      await context.close();
    }
  }
});

test("flag ON: a non-boolean or missing can_view never reveals a trace entry", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const perms = [...MODULES.map((target) => ({ target, can_view: true })), { target: RM, can_view: "true" }, { target: PM, can_view: 1 }];
  const { page, context } = await open(e, MCM, { storage: FLAG_ON, perms });
  const s = await nav(page);
  assert.equal(s.pills["rm-cost-trace"], false);
  assert.equal(s.pills["pm-cost-trace"], false);
  await context.close();
});

test("flag OFF: all trace entries stay visible exactly as before, whatever the roles; no N1/N2 markup", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const storage of [{}, { COSTING_NAV_GROUPS_V1: "0" }, { COSTING_NAV_GROUPS_V1: "true" }]) {
    for (const c of CASES) {
      const { page, context, errors } = await open(e, MCM, { storage, targets: c.targets });
      const s = await nav(page);
      assert.deepEqual(s.pills, { "manual-rate-manager": true, "rm-cost-trace": true, "pm-cost-trace": true }, c.name);
      assert.deepEqual(s.groups, {});
      assert.deepEqual(s.scopeNotes, []);
      assert.equal(await page.locator("[data-nav-hidden]").count(), 0);
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
});

test("flag ON: hiding survives navigation re-renders (switching lenses and back)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { page, context, errors } = await open(e, MCM, { storage: FLAG_ON, targets: [RM] });
  await page.click('#lensPills .pill[data-lens="rm-cost-trace"]');
  await page.waitForTimeout(500);
  let s = await nav(page);
  assert.deepEqual(s.active, ["rm-cost-trace"]);
  assert.equal(s.pills["pm-cost-trace"], false, "PM stays hidden after the shell re-rendered the pills");
  assert.equal(s.pills["rm-cost-trace"], true);
  await page.click('#lensPills .pill[data-lens="manual-rate-manager"]');
  await page.waitForTimeout(500);
  s = await nav(page);
  assert.equal(s.pills["pm-cost-trace"], false);
  assert.equal(s.pills["rm-cost-trace"], true);
  assert.equal(s.groups.traces, true);
  assert.deepEqual(errors, []);
  await context.close();
});

test("deep link to an unauthorised trace: URL/route unchanged, entry shown active, in-page restricted message, and no trace data call (same as flag OFF)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const [lens, message] of [["rm-cost-trace", /Restricted RM contribution detail/], ["pm-cost-trace", /Restricted PM contribution detail/]]) {
    const runs = [];
    for (const storage of [{}, FLAG_ON]) {
      const { page, context, errors } = await open(e, MCM, { storage, targets: [], query: `?lens=${lens}` });
      const s = await nav(page);
      assert.deepEqual(s.active, [lens], `${lens}: still the active destination`);
      assert.equal(s.pills[lens], true);
      assert.match(s.bodyText, message, `${lens}: restricted message shown`);
      assert.deepEqual(await traceCalls(page), [], `${lens}: no trace RPC issued without the role`);
      assert.ok(page.url().includes(`lens=${lens}`));
      assert.deepEqual(errors, []);
      runs.push({ otherTrace: lens === "rm-cost-trace" ? s.pills["pm-cost-trace"] : s.pills["rm-cost-trace"] });
      await context.close();
    }
    assert.equal(runs[0].otherTrace, true, "OFF: other trace visible");
    assert.equal(runs[1].otherTrace, false, "ON: the other, unauthorised trace is hidden");
  }
});

test("authorised trace still loads: with the RM role the RM trace RPC is issued (permission checks unchanged), PM is not", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { page, context } = await open(e, MCM, { storage: FLAG_ON, targets: [RM], query: "?lens=rm-cost-trace" });
  const names = (await traceCalls(page)).map((c) => c.name);
  assert.ok(names.some((n) => /rm_cost_trace/.test(n)), `RM trace RPC issued: ${names}`);
  assert.ok(!names.some((n) => /pm_cost_trace/.test(n)), "no PM trace RPC");
  await context.close();
});

test("backend parity: clicking the same authorised destinations issues the identical read/RPC sequence with the flag ON and OFF, and never writes", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const [targets, lenses] of [[[], ["manual-rate-manager"]], [[RM], ["rm-cost-trace", "manual-rate-manager"]], [[RM, PM], ["rm-cost-trace", "pm-cost-trace", "manual-rate-manager"]]]) {
    const runs = [];
    for (const storage of [{}, FLAG_ON]) {
      const { page, context, errors } = await open(e, MCM, { storage, targets });
      for (const lens of lenses) {
        await page.click(`#lensPills .pill[data-lens="${lens}"]`);
        await page.waitForTimeout(400);
      }
      assert.deepEqual(await writes(page), []);
      assert.deepEqual(errors, []);
      runs.push((await calls(page)).map((c) => `${c.kind}:${c.name}:${JSON.stringify(c.args ?? null)}`));
      await context.close();
    }
    assert.ok(runs[0].length > 0);
    assert.deepEqual(runs[1], runs[0], `roles ${targets.length}: identical sequence`);
  }
});

test("Cost Build: flag ON shows a group-labelled scope note per lens; flag OFF shows none; groups unchanged", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const wanted = { "cost-governance": ["mapping-classification", /Expense-head mapping/], "staff-governance": ["mapping-classification", /Staff governance/], "manual-provisions": ["provisions", /Manual provisions/] };
  for (const [lens, [group, re]] of Object.entries(wanted)) {
    const on = await open(e, CBM, { storage: FLAG_ON, query: `?lens=${lens}` });
    const s = await nav(on.page);
    assert.equal(s.scopeNotes.length, 1, lens);
    assert.equal(s.scopeNotes[0].lens, lens);
    assert.equal(s.scopeNotes[0].group, group);
    assert.match(s.scopeNotes[0].text, re);
    assert.deepEqual(Object.keys(s.groups), ["mapping-classification", "provisions", "policy-approval"]);
    assert.ok(Object.values(s.groups).every(Boolean));
    assert.deepEqual(s.active, [lens]);
    assert.deepEqual(on.errors, []);
    await on.context.close();
    const off = await open(e, CBM, { storage: {}, query: `?lens=${lens}` });
    assert.deepEqual((await nav(off.page)).scopeNotes, [], `${lens}: OFF has no note`);
    await off.context.close();
  }
  const dg = await open(e, CBM, { storage: FLAG_ON, query: "?lens=driver-governance" });
  assert.deepEqual((await nav(dg.page)).scopeNotes, [], "Driver Governance (own controller) untouched");
  await dg.context.close();
});

test("Material Cost: Rates scope note on the Manual Rate Manager only when the flag is ON; Traces carry none", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const on = await open(e, MCM, { storage: FLAG_ON, targets: [RM, PM] });
  const s = await nav(on.page);
  assert.equal(s.scopeNotes.length, 1);
  assert.equal(s.scopeNotes[0].group, "rates");
  assert.match(s.scopeNotes[0].text, /^Rates · .*separate, restricted/);
  await on.page.click('#lensPills .pill[data-lens="rm-cost-trace"]');
  await on.page.waitForTimeout(400);
  assert.equal((await nav(on.page)).scopeNotes.length, 0);
  await on.context.close();
  const off = await open(e, MCM, { storage: {}, targets: [RM, PM] });
  assert.deepEqual((await nav(off.page)).scopeNotes, []);
  await off.context.close();
});
