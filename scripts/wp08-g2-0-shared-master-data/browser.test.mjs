// WP08 G2-0 real-Chromium parity tests: Electron-root vs PWA-public serving, 390 and 1280 px, role guards, HOME and login
// navigation, asset resolution, non-mutating boot. Network stubbed (Supabase + jsPDF); no live data, no writers pressed.
//   node --test scripts/wp08-g2-0-shared-master-data/browser.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { launch, startServer, openPage, overflow, mockCalls, MODULES, PLATFORMS } from "./harness.mjs";

let env;
async function getEnv(t) {
  if (!env) {
    const l = await launch();
    if (!l) { t.skip("Playwright/Chromium not available"); return null; }
    env = l;
    env.servers = { electron: await startServer("electron"), pwa: await startServer("pwa") };
  }
  return env;
}
test.after(async () => { await env?.close(); env?.servers.electron.close(); env?.servers.pwa.close(); });

// Measured on the BASE commit (3f47b115, root page, Electron-style serving): PM BOM already overflows to 567 px at a 390 px
// viewport. G2-0 must not make it worse; fixing it is WP11 (UX-P02 narrow-width work), not a G2-0 change.
const BASELINE_OVERFLOW = { "pm-templates@390": 567 };

const WRITER = /^(?:rpc_)?(?:create|update|set|save|delete|approve|submit|activate|deactivate|upsert|insert|clone|publish|supersede)/i;

for (const platform of Object.keys(PLATFORMS)) {
  for (const m of MODULES) {
    for (const width of [390, 1280]) {
      test(`${platform} ${m.key} @${width}: loads every asset, no script errors, no horizontal overflow (edit role)`, async (t) => {
        const e = await getEnv(t); if (!e) return;
        const r = await openPage(e, { platform, moduleDef: m, role: "edit", width });
        assert.deepEqual(r.failed, [], "no 4xx/5xx same-origin response");
        assert.deepEqual(r.errors, [], "no page/console errors");
        const o = await overflow(r.page);
        const allowed = BASELINE_OVERFLOW[`${m.key}@${width}`] ?? o.vw + 1;
        assert.ok(o.scrollWidth <= allowed, `scrollWidth ${o.scrollWidth} <= ${allowed} (viewport ${o.vw}${allowed > o.vw + 1 ? ", pre-existing baseline overflow" : ""})`);
        assert.equal(await r.page.evaluate(() => document.getElementById("homeBtn") !== null), true, "HOME control present");
        await r.context.close();
      });
    }

    test(`${platform} ${m.key}: denied / view / edit role guards (fail-closed, same on both clients)`, async (t) => {
      const e = await getEnv(t); if (!e) return;
      const denied = await openPage(e, { platform, moduleDef: m, role: "denied", width: 1280 });
      const msg = await denied.page.evaluate((id) => { const x = document.getElementById(id); return x && !x.hidden ? x.textContent : ""; }, m.status);
      assert.match(msg, /permission/i, "denied user sees an explicit denial");
      const deniedCalls = (await mockCalls(denied.page)).filter((c) => c.kind === "rpc").map((c) => c.name);
      assert.ok(!deniedCalls.some((n) => WRITER.test(n)), "no writer RPC for a denied user");
      assert.ok(!deniedCalls.includes("rpc_get_rm_items"), "denied user triggers no data read");
      await denied.context.close();

      const view = await openPage(e, { platform, moduleDef: m, role: "view", width: 1280 });
      const edit = await openPage(e, { platform, moduleDef: m, role: "edit", width: 1280 });
      if (m.key === "manage-products") {
        assert.equal(await view.page.evaluate(() => !document.getElementById("viewOnlyBanner").hidden), true, "view-only banner");
        assert.equal(await view.page.evaluate(() => document.getElementById("editToggleBtn").disabled), true, "edit toggle disabled for view");
        assert.equal(await view.page.evaluate(() => document.getElementById("newInlineBtn").disabled), true, "new product disabled for view");
        assert.equal(await edit.page.evaluate(() => document.getElementById("viewOnlyBanner").hidden), true);
        assert.equal(await edit.page.evaluate(() => document.getElementById("newInlineBtn").disabled), false, "new product enabled for edit");
      } else {
        assert.equal(await view.page.evaluate(() => document.body.classList.contains("no-edit")), true, "view-only gets no-edit");
        assert.equal(await edit.page.evaluate(() => document.body.classList.contains("no-edit")), false, "editor does not");
      }
      await view.context.close();
      await edit.context.close();
    });

    test(`${platform} ${m.key}: boot is non-mutating (no writer RPC, no insert/update/delete/upsert) for an editor`, async (t) => {
      const e = await getEnv(t); if (!e) return;
      const r = await openPage(e, { platform, moduleDef: m, role: "edit", width: 1280 });
      const calls = await mockCalls(r.page);
      assert.deepEqual(calls.filter((c) => c.kind === "rpc" && WRITER.test(c.name)).map((c) => c.name), []);
      assert.deepEqual(calls.filter((c) => c.kind === "from" && /^(insert|update|delete|upsert)$/.test(c.method)), []);
      await r.context.close();
    });

    test(`${platform} ${m.key}: HOME goes to the platform launcher; missing session goes to the platform sign-in`, async (t) => {
      const e = await getEnv(t); if (!e) return;
      const cfg = PLATFORMS[platform];
      const r = await openPage(e, { platform, moduleDef: m, role: "view", width: 1280 });
      await r.context.route(`${r.origin}${cfg.home}`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>home</body></html>" }));
      await Promise.all([r.page.waitForURL(`${r.origin}${cfg.home}`, { timeout: 5000 }), r.page.click("#homeBtn")]);
      assert.equal(new URL(r.page.url()).pathname, cfg.home);
      await r.context.close();

      const s = await openPage(e, { platform, moduleDef: m, role: "view", width: 1280, session: false }).catch(() => null);
      // No session: appBootstrap redirects to the platform login target (Electron /login.html, PWA hub sign-in).
      assert.ok(s, "page opened");
      assert.equal(new URL(s.page.url()).pathname, cfg.login);
      await s.context.close();
    });
  }
}

test("PM BOM gate is module:pm-templates only: the wrong key (module:manage-pm-bom) stays denied on both clients", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const pm = MODULES.find((x) => x.key === "pm-templates");
  for (const platform of Object.keys(PLATFORMS)) {
    const wrong = await openPage(e, { platform, moduleDef: pm, role: "wrong-key", width: 1280 });
    assert.match(await wrong.page.evaluate(() => document.getElementById("bomPageStatus").textContent), /permission/i);
    await wrong.context.close();
    const right = await openPage(e, { platform, moduleDef: pm, role: "view", width: 1280 });
    assert.doesNotMatch(await right.page.evaluate(() => document.getElementById("bomPageStatus").textContent), /permission/i);
    await right.context.close();
  }
});

test("Season Profiles link: Electron resolves to the root page; PWA hides it instead of a dead link", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const m = MODULES[0];
  const el = await openPage(e, { platform: "electron", moduleDef: m, role: "view", width: 1280 });
  const href = await el.page.evaluate(() => document.getElementById("seasonProfilesLink").href);
  assert.equal(new URL(href).pathname, "/manage-season-profiles.html");
  assert.equal((await el.page.request.get(href)).status(), 200);
  await el.context.close();
  const pw = await openPage(e, { platform: "pwa", moduleDef: m, role: "view", width: 1280 });
  assert.equal(await pw.page.evaluate(() => document.getElementById("seasonProfilesLink").hidden), true);
  await pw.context.close();
});

test("BOM export dependency (jsPDF) loads on all three BOM pages on both clients", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const platform of Object.keys(PLATFORMS)) {
    for (const m of MODULES.filter((x) => x.key !== "manage-products")) {
      const r = await openPage(e, { platform, moduleDef: m, role: "edit", width: 1280 });
      assert.equal(await r.page.evaluate(() => typeof window.jspdf?.jsPDF), "function", `${platform} ${m.key}`);
      await r.context.close();
    }
  }
});

test("legacy root URLs: Electron forwards (query + hash preserved); the PWA never had root pages", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const origin = `http://127.0.0.1:${e.servers.electron.address().port}`;
  for (const m of MODULES) {
    const ctx = await e.browser.newContext({ userAgent: PLATFORMS.electron.userAgent });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    const p = await ctx.newPage();
    await p.goto(`${origin}/${m.file}?x=1#h`);
    await p.waitForURL(`${origin}/public/shared/${m.file}?x=1#h`, { timeout: 5000 });
    await ctx.close();
    const pwa = await fetch(`http://127.0.0.1:${e.servers.pwa.address().port}/${m.file}`);
    assert.equal(pwa.status, 404);
  }
});
