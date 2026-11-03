// MDC-07 / N4 browser journeys: real Production Route Manager page + controllers against the in-memory MOCK backend
// (no Supabase, no network). Skips cleanly without Playwright. Flags are set in the test browser's localStorage only.
import test from "node:test";
import assert from "node:assert/strict";
import { launch, openPage, rpcCalls, writeCalls } from "../costing-prm-corrections/prm-corrections-harness.mjs";
import { COSTING_NAV_GROUP_CONTRACT } from "../../public/shared/js/costing-nav-groups.js";

const SKIP = process.env.COSTING_NAV_SKIP_BROWSER === "1" || process.env.COSTING_DIALOGS_BROWSER_SKIP === "1";
const N1 = { COSTING_NAV_GROUPS_V1: "1" };
const N4 = { COSTING_NAV_GROUPS_V1: "1", COSTING_PRM_NAV_CONTEXT_V1: "1" };
const LENSES = COSTING_NAV_GROUP_CONTRACT["production-route"].flatMap((g) => g.lensIds);
let env = null;
test.before(async () => { if (!SKIP) env = await launch(); });
test.after(async () => { await env?.close(); });

async function withPage(t, search, opts, fn) {
  if (SKIP) return t.skip("browser tests skipped");
  if (!env) return t.skip("playwright not available");
  const { context, page, errors } = await openPage(env.browser, env.base, search, { dialogs: true, ...opts });
  try {
    await page.waitForSelector('#lensPills .pill[data-lens="route-readiness"]');
    await fn(page);
    assert.deepEqual(errors, [], "no page errors");
    assert.deepEqual(await writeCalls(page), [], "navigation never writes");
  } finally {
    await context.close();
  }
}

const settle = (page, ms = 700) => page.waitForTimeout(ms);
const pill = async (page, lens, ms = 700) => { await page.click(`#lensPills .pill[data-lens="${lens}"]`); await settle(page, ms); };
const active = (page) => page.evaluate(() => [...document.querySelectorAll("#lensPills .pill.active")].map((e) => e.dataset.lens));
const chips = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#cpNavContext .cp-context-chip[data-context-key]")].map((e) => [e.dataset.contextKey, e.querySelector(".cp-context-chip-value")?.textContent ?? e.textContent])));
const count = async (page, name, pred = () => true) => (await rpcCalls(page)).filter((c) => c.name === name && pred(c.args)).length;
const detailCalls = (page, id) => count(page, "rpc_get_product_route_detail", (a) => Object.values(a).includes(id));
const popTo = (page, search) => page.evaluate((s) => { history.pushState({}, "", location.pathname + s); window.dispatchEvent(new PopStateEvent("popstate")); }, search);

const EDITOR = "?lens=product-route-editor&product_route_id=9002&product_id=77";

test("journey ON: Product, Product route version and chips persist across groups and come back to the same version", async (t) => {
  await withPage(t, EDITOR, { storage: N4 }, async (page) => {
    await settle(page, 1200);
    assert.deepEqual(await active(page), ["product-route-editor"]);
    assert.equal(await detailCalls(page, 9002), 1);
    assert.match((await chips(page)).product, /Mock Product \(#77\)/);
    assert.equal((await chips(page)).route, "Product route #9002");
    await pill(page, "effective-route-viewer");      // Build -> Build (other lens)
    assert.equal(await count(page, "rpc_get_effective_product_process_route", (a) => Object.values(a).includes(77)), 1, "Effective Route is opened for the retained Product");
    await pill(page, "route-readiness");             // Readiness group
    await pill(page, "route-families");              // Assign & Map group
    assert.match((await chips(page)).product, /#77/, "context survives register / non-identity lenses");
    await pill(page, "product-route-editor", 1200);  // back to Build
    assert.equal(await detailCalls(page, 9002), 2, "the same route version is re-opened, not a chooser");
    assert.equal((await chips(page)).route, "Product route #9002");
    assert.deepEqual(await active(page), ["product-route-editor"]);
  });
});

test("journey OFF (default): same clicks keep today's behaviour - no version re-open, no stored context", async (t) => {
  await withPage(t, EDITOR, { storage: N1 }, async (page) => {
    await settle(page, 1200);
    assert.equal(await detailCalls(page, 9002), 1);
    assert.equal((await chips(page)).route, undefined, "no Route chip without the N4 flag");
    await pill(page, "effective-route-viewer");
    await pill(page, "product-route-editor", 1200);
    assert.equal(await detailCalls(page, 9002), 1, "legacy behaviour: the version is not restored");
  });
});

test("journey ON: Mapping Review, Foundation Review and Historical Candidate Review stay separate lenses with their own requests and no leaked context or run", async (t) => {
  const EVIDENCE = ["route-family-mapping-review", "route-family-foundation-review", "historical-candidate-review"];
  const sequences = {};
  for (const withContext of [false, true]) {
    await withPage(t, withContext ? EDITOR : "?lens=route-readiness", { storage: N4 }, async (page) => {
      await settle(page, 900);
      const seen = {};
      for (const lens of EVIDENCE) {
        const before = (await rpcCalls(page)).length;
        await pill(page, lens, 900);
        assert.deepEqual(await active(page), [lens], `${lens} reachable on its own pill`);
        seen[lens] = (await rpcCalls(page)).slice(before).map((c) => `${c.name} ${JSON.stringify(c.args)}`);
        assert.equal((await chips(page)).run, undefined, `${lens}: N4 never sets a run chip`);
      }
      sequences[withContext] = seen;
      const basis = await page.evaluate(() => document.querySelector('#cpNavContext [data-context-key="basis"]')?.textContent || "");
      assert.match(basis, /not the current costing run|LIVE_AS_OF|Run-scoped|^$/);
    });
  }
  // The two fixed-historical evidence lenses issue byte-identical requests with and without a stored Product / route.
  for (const lens of ["route-family-mapping-review", "route-family-foundation-review"]) {
    assert.deepEqual(sequences[true][lens].filter((s) => !/get_production_route_master_options/.test(s)), sequences[false][lens].filter((s) => !/get_production_route_master_options/.test(s)), lens);
  }
});

test("journey ON: switching Product through the Product picker drops the previous route version (no stale carry)", async (t) => {
  await withPage(t, EDITOR, { storage: N4 }, async (page) => {
    await settle(page, 1200);
    await popTo(page, "?lens=product-route-editor&product_id=78");   // explicit selection of another Product
    await settle(page, 1200);
    const c = await chips(page);
    assert.match(c.product, /Other Product \(#78\)/);
    assert.equal(c.route, undefined, "the version of Product 77 is gone");
    const before = await detailCalls(page, 9002);
    await pill(page, "effective-route-viewer");
    await pill(page, "product-route-editor", 1200);
    assert.equal(await detailCalls(page, 9002), before, "Product 77's version is never re-opened for Product 78");
    assert.match((await chips(page)).product, /#78/);
  });
});

test("journey ON: choosing another Product in the Effective Route Viewer picker is remembered; emptying the picker clears it", async (t) => {
  await withPage(t, EDITOR, { storage: N4 }, async (page) => {
    await settle(page, 1200);
    await pill(page, "effective-route-viewer", 1000);
    await page.selectOption("#prmEffectiveProduct", "78");
    await settle(page, 900);
    let c = await chips(page);
    assert.match(c.product, /Other Product \(#78\)/);
    assert.equal(c.route, undefined, "Product 77's version does not follow the new Product");
    const before = await detailCalls(page, 9002);
    await pill(page, "route-readiness");
    await pill(page, "effective-route-viewer", 1000);
    assert.equal(await page.inputValue("#prmEffectiveProduct"), "78", "the picker shows the remembered Product, not the stale URL one");
    await pill(page, "product-route-editor", 1200);
    assert.equal(await detailCalls(page, 9002), before, "Product 77's version is not re-opened");
    await pill(page, "effective-route-viewer", 1000);
    await page.selectOption("#prmEffectiveProduct", "");
    await settle(page, 600);
    c = await chips(page);
    assert.equal(c.product, undefined);
    assert.equal(c.family, undefined);
  });
});

test("journey ON: changing Family drops the unrelated Product and Family route (Historical Evidence Review deep links)", async (t) => {
  await withPage(t, "?lens=historical-candidate-review&route_family_id=12&product_id=78", { storage: N4 }, async (page) => {
    await settle(page, 1000);
    let c = await chips(page);
    assert.match(c.family, /#12/);
    assert.match(c.product, /#78/);
    await pill(page, "effective-route-viewer");
    assert.equal(await count(page, "rpc_get_effective_product_process_route", (a) => Object.values(a).includes(78)), 1);
    await popTo(page, "?lens=historical-candidate-review&route_family_id=11");
    await settle(page, 1000);
    c = await chips(page);
    assert.match(c.family, /#11/);
    assert.equal(c.product, undefined, "Product 78 does not belong to the newly selected Family");
    await pill(page, "effective-route-viewer");
    assert.equal(await count(page, "rpc_get_effective_product_process_route", (a) => Object.values(a).includes(78)), 1, "no further Effective Route call for the dropped Product");
  });
});

test("rapid changes: a slow response of an abandoned lens never overwrites the stored context", async (t) => {
  await withPage(t, "?lens=product-route-editor&product_route_id=9100&product_id=78", { storage: N4, cfg: { delays: { "rpc_get_product_route_detail:9002": 1500 } } }, async (page) => {
    await settle(page, 1200);
    assert.match((await chips(page)).product, /#78/);
    await popTo(page, EDITOR);                       // slow load of Product 77 / version 9002 starts
    await page.waitForTimeout(150);
    await pill(page, "route-families", 0);           // user moves on immediately
    await settle(page, 2200);                        // the slow response arrives late
    assert.deepEqual(await active(page), ["route-families"]);
    const c = await chips(page);
    assert.match(c.product, /Other Product \(#78\)/, "context still belongs to the accepted load");
    assert.equal(c.route, "Product route #9100");
  });
});

test("rapid changes: an abandoned hydrated load that resolves late (stale) neither commits nor invalidates the stored version", async (t) => {
  await withPage(t, EDITOR, { storage: N4, cfg: { delaysOnce: {} } }, async (page) => {
    await settle(page, 1200);
    await pill(page, "effective-route-viewer");
    // the NEXT detail request for 9002 (the hydrated re-open) is slow; the user leaves before it answers
    await page.evaluate(() => { window.__mock.cfg.delaysOnce = { "rpc_get_product_route_detail:9002": 1500 }; });
    await page.click('#lensPills .pill[data-lens="product-route-editor"]');
    await page.waitForTimeout(150);
    await page.click('#lensPills .pill[data-lens="route-families"]');
    await settle(page, 2200);
    assert.deepEqual(await active(page), ["route-families"]);
    assert.equal((await chips(page)).route, "Product route #9002", "late stale response did not wipe or change the stored version");
    await pill(page, "product-route-editor", 1200);
    assert.equal((await chips(page)).route, "Product route #9002");
  });
});

test("rapid changes: clicking through every group quickly ends on the last lens with consistent chips", async (t) => {
  await withPage(t, EDITOR, { storage: N4 }, async (page) => {
    await settle(page, 1200);
    for (const lens of ["route-readiness", "product-route-assignments", "effective-route-viewer", "archived-routes", "product-route-editor", "route-families", "effective-route-viewer", "product-route-editor"]) {
      await page.click(`#lensPills .pill[data-lens="${lens}"]`);
      await page.waitForTimeout(40);
    }
    await settle(page, 2000);
    assert.deepEqual(await active(page), ["product-route-editor"]);
    const c = await chips(page);
    assert.match(c.product, /#77/);
    assert.equal(c.route, "Product route #9002");
  });
});

test("all 13 Production Route lens ids still open by ?lens= deep link with N4 ON, with identical destination as OFF", async (t) => {
  assert.equal(LENSES.length, 13);
  for (const lens of LENSES) {
    const seen = [];
    for (const storage of [N1, N4]) {
      await withPage(t, `?lens=${lens}`, { storage }, async (page) => {
        await settle(page, 400);
        seen.push({ active: await active(page), search: new URL(page.url()).search });
      });
    }
    assert.deepEqual(seen[1], seen[0], lens);
    assert.deepEqual(seen[1].active, [lens]);
  }
});

test("RPC contract: a 13-lens click-through with N4 ON and no stored context is identical to OFF, and never writes", async (t) => {
  const runs = [];
  for (const storage of [N1, N4]) {
    await withPage(t, "", { storage }, async (page) => {
      for (const lens of LENSES) await pill(page, lens, 250);
      runs.push(await rpcCalls(page));
    });
  }
  assert.ok(runs[0].length > 0);
  assert.deepEqual(runs[1], runs[0]);
});

test("RPC contract: with a stored Product the ON journey only uses RPC names the OFF journey already uses (read-only)", async (t) => {
  const names = [];
  for (const storage of [N1, N4]) {
    await withPage(t, EDITOR, { storage }, async (page) => {
      await settle(page, 1000);
      for (const lens of LENSES) await pill(page, lens, 250);
      names.push(new Set((await rpcCalls(page)).map((c) => c.name)));
    });
  }
  for (const n of names[1]) assert.ok(names[0].has(n), `new RPC name with N4 ON: ${n}`);
});
