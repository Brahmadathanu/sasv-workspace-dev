// WP08 G2-0 corrective #416: fail-closed writer controls on all four shared Master Data pages, in real Chromium.
// Mutation-sensitive: the same assertions are run against a mutant that re-creates the pre-fix behaviour and MUST fail there.
// Stubbed backend (no Supabase, no production writer is ever invoked); no writer control is pressed in any editor state.
//   node --test scripts/wp08-g2-0-shared-master-data/fail-closed.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launch, startServer, openPage, overflow, mockCalls, MODULES, PLATFORMS, repoRoot } from "./harness.mjs";

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

const WRITER_RPC = /^(?:rpc_)?(?:create|update|set|save|delete|approve|submit|activate|deactivate|upsert|insert|clone|publish|supersede|pm_(?:tpl_upsert|tpl_delete|tpl_renumber|ovr_upsert|ovr_delete|map_set|map_clear|rebuild)|sp_bom_(?:upsert|delete|renumber))|^fn_rm_bom_upsert$/i;

/** Writer/field ids declared in the canonical HTML (the single source the pages ship). */
function declared(moduleDef) {
  const html = fs.readFileSync(path.join(repoRoot, "public/shared", moduleDef.file), "utf8");
  const pick = (kind) => [...html.matchAll(new RegExp(`id="([^"]+)"\\s+data-md-${kind}`, "g"))].map((m) => m[1]);
  return { writers: pick("writer"), fields: pick("field") };
}
const EDIT_EXPECTED_USABLE = { "manage-products": ["newInlineBtn"], "manage-rm-bom": ["saveBtn", "linesEditBtn"], "pm-templates": ["linesEditBtn"], "manage-sp-bom": ["saveBtn", "linesEditBtn"] };

/** In-page measurement: which declared writers/fields can a user actually operate right now? */
async function usable(page, ids) {
  return page.evaluate((all) => {
    const out = { writers: [], fields: [], access: document.documentElement.getAttribute("data-md-access") };
    const rendered = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const operable = (el) => rendered(el) && !el.disabled && !el.closest("[inert]") && getComputedStyle(el).pointerEvents !== "none";
    for (const id of all.writers) { const el = document.getElementById(id); if (el && operable(el)) out.writers.push(id); }
    for (const id of all.fields) { const el = document.getElementById(id); if (el && operable(el) && !el.readOnly) out.fields.push(id); }
    return out;
  }, ids);
}
async function violations(page, moduleDef) {
  const u = await usable(page, declared(moduleDef));
  return { access: u.access, writers: u.writers, fields: u.fields };
}
const writerRpcs = async (page) => (await mockCalls(page)).filter((c) => (c.kind === "rpc" && WRITER_RPC.test(c.name)) || (c.kind === "from" && /^(insert|update|delete|upsert)$/.test(c.method)));

const FAILURES = [
  { name: "denied (no grant row)", opts: { role: "denied" } },
  { name: "session lookup throws", opts: { role: "edit", fail: "session-throw" } },
  { name: "permission RPC returns an error", opts: { role: "edit", fail: "perm-error" } },
  { name: "permission RPC returns a non-array", opts: { role: "edit", fail: "perm-nonarray" } },
  { name: "permission RPC throws", opts: { role: "edit", fail: "perm-throw" } },
  { name: "wrong permission key only (module:manage-pm-bom / pm-templates safety)", opts: { role: "wrong-key" }, only: "pm-templates" },
];

for (const platform of Object.keys(PLATFORMS)) {
  for (const m of MODULES) {
    for (const f of FAILURES) {
      if (f.only && f.only !== m.key) continue;
      test(`${platform} ${m.key}: ${f.name} -> no writer control or governed field is operable, no writer RPC`, async (t) => {
        const e = await getEnv(t); if (!e) return;
        const r = await openPage(e, { platform, moduleDef: m, width: 1280, wait: 1200, ...f.opts });
        const v = await violations(r.page, m);
        assert.equal(v.access, "locked", "state is locked");
        assert.deepEqual(v.writers, [], "no operable writer control");
        assert.deepEqual(v.fields, [], "no operable governed field");
        // Programmatic activation of every declared writer must reach nothing.
        await r.page.evaluate((ids) => ids.forEach((id) => document.getElementById(id)?.click()), declared(m).writers);
        await r.page.waitForTimeout(150);
        assert.deepEqual(await writerRpcs(r.page), [], "no writer RPC / table write");
        await r.context.close();
      });
    }

    test(`${platform} ${m.key}: no session -> redirected to the platform sign-in, no data call and no writer RPC`, async (t) => {
      const e = await getEnv(t); if (!e) return;
      const r = await openPage(e, { platform, moduleDef: m, role: "view", session: false, width: 1280, wait: 1200 });
      assert.equal(new URL(r.page.url()).pathname, PLATFORMS[platform].login);
      assert.deepEqual(r.recorded.filter((c) => (c.kind === "rpc" && WRITER_RPC.test(c.name)) || (c.kind === "from" && /^(insert|update|delete|upsert)$/.test(c.method))), []);
      assert.deepEqual(r.recorded.filter((c) => c.kind === "from" || (c.kind === "rpc" && !/^(app_get_|get_user_permissions)/.test(c.name))), [], "no module data read without a session");
      await r.context.close();
    });

    test(`${platform} ${m.key}: pending bootstrap (permission answer delayed 2 s) is locked from first paint, then correct view-only`, async (t) => {
      const e = await getEnv(t); if (!e) return;
      const r = await openPage(e, { platform, moduleDef: m, role: "view", width: 1280, delayPermMs: 2000, wait: 300 });
      const early = await violations(r.page, m);
      assert.equal(early.access, "locked");
      assert.deepEqual(early.writers, []);
      assert.deepEqual(early.fields, []);
      await r.page.waitForTimeout(2300);
      const late = await violations(r.page, m);
      assert.equal(late.access, "view");
      assert.deepEqual(late.writers, [], "view-only: every writer control inert");
      assert.deepEqual(late.fields, [], "view-only: every governed field inert");
      assert.deepEqual(await writerRpcs(r.page), []);
      await r.context.close();
    });

    test(`${platform} ${m.key}: view-only is strictly read-only and still readable; editor keeps governed controls (nothing pressed)`, async (t) => {
      const e = await getEnv(t); if (!e) return;
      const view = await openPage(e, { platform, moduleDef: m, role: "view", width: 1280 });
      const v = await violations(view.page, m);
      assert.equal(v.access, "view");
      assert.deepEqual(v.writers, []);
      assert.deepEqual(v.fields, []);
      await view.page.evaluate((ids) => ids.forEach((id) => document.getElementById(id)?.click()), declared(m).writers);
      assert.deepEqual(await writerRpcs(view.page), []);
      assert.equal(await view.page.evaluate(() => document.getElementById("homeBtn") !== null && !document.getElementById("homeBtn").closest("[inert]")), true, "HOME stays usable");
      await view.context.close();

      const edit = await openPage(e, { platform, moduleDef: m, role: "edit", width: 1280 });
      const ed = await violations(edit.page, m);
      assert.equal(ed.access, "edit");
      for (const id of EDIT_EXPECTED_USABLE[m.key]) assert.ok(ed.writers.includes(id), `${id} usable for an editor`);
      assert.equal(await edit.page.evaluate(() => document.querySelectorAll("[inert]").length), 0, "nothing left inert for an editor");
      assert.equal(await edit.page.evaluate(() => document.querySelectorAll('[data-md-writer][aria-disabled="true"]').length), 0);
      await edit.context.close();
    });

    test(`${platform} ${m.key}: denied state at 390 px keeps writers hidden and adds no new horizontal overflow`, async (t) => {
      const e = await getEnv(t); if (!e) return;
      const r = await openPage(e, { platform, moduleDef: m, role: "denied", width: 390 });
      assert.deepEqual((await violations(r.page, m)).writers, []);
      const o = await overflow(r.page);
      // The viewport meta is present, so the layout width is the device width; the known PM BOM overflow (UX-P05, WP11) is not asserted away.
      assert.equal(await r.page.evaluate(() => document.documentElement.clientWidth), 390);
      if (m.key !== "pm-templates") assert.ok(o.scrollWidth <= o.vw + 1, `scrollWidth ${o.scrollWidth} <= ${o.vw}`);
      await r.context.close();
    });
  }
}

test("viewport meta: all four canonical pages declare width=device-width, initial-scale=1 and render at the device width at 390 px", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const m of MODULES) {
    const html = fs.readFileSync(path.join(repoRoot, "public/shared", m.file), "utf8");
    assert.equal((html.match(/<meta name="viewport" content="width=device-width, initial-scale=1" \/>/g) ?? []).length, 1, m.file);
    const r = await openPage(e, { platform: "pwa", moduleDef: m, role: "view", width: 390 });
    assert.equal(await r.page.evaluate(() => document.documentElement.clientWidth), 390, `${m.key} layout width`);
    await r.context.close();
  }
});

// ---- mutation sensitivity: the observed (pre-fix) behaviour MUST be detected ----------------------------------------------
for (const m of MODULES) {
  test(`MUTATION ${m.key}: with the fail-closed guard removed, the denied-state assertions detect operable writer controls`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const r = await openPage(e, { platform: "pwa", moduleDef: m, role: "denied", width: 1280, mutant: "no-guard" });
    const v = await violations(r.page, m);
    assert.ok(v.writers.length + v.fields.length > 0, `mutant must expose at least one operable writer/field; saw ${JSON.stringify(v)}`);
    assert.notEqual(v.access, "locked");
    await r.context.close();
  });
}

test("MUTATION products: the original defect (+ New product operable on a denied page) is reproduced by the mutant", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const m = MODULES[0];
  const r = await openPage(e, { platform: "pwa", moduleDef: m, role: "denied", width: 1280, mutant: "no-guard" });
  assert.ok((await violations(r.page, m)).writers.includes("newInlineBtn"));
  await r.context.close();
});

test("MUTATION bom: the original defect (Save operable on a denied or view-only BOM page) is reproduced by the mutant", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const key of ["manage-rm-bom", "manage-sp-bom"]) {
    const m = MODULES.find((x) => x.key === key);
    const r = await openPage(e, { platform: "pwa", moduleDef: m, role: "denied", width: 1280, mutant: "no-guard" });
    assert.ok((await violations(r.page, m)).writers.includes("saveBtn"), key);
    await r.context.close();
  }
});
