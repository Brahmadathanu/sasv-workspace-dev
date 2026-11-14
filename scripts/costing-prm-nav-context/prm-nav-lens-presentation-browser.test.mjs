// Issue #395 (WP07 P8): lens-aware Product / Family / Route chips. Real Production Route Manager page + controllers
// against the in-memory MOCK backend (no Supabase, no network). Flags OFF (default) and ON are set in the test
// browser's localStorage only. Skips cleanly without Playwright.
import test from "node:test";
import assert from "node:assert/strict";
import { launch, openPage, rpcCalls, writeCalls } from "../costing-prm-corrections/prm-corrections-harness.mjs";

const SKIP = process.env.COSTING_NAV_SKIP_BROWSER === "1" || process.env.COSTING_DIALOGS_BROWSER_SKIP === "1";
const OFF = {};
const N1 = { COSTING_NAV_GROUPS_V1: "1" };
const ON = { COSTING_NAV_GROUPS_V1: "1", COSTING_PRM_NAV_CONTEXT_V1: "1" };
const WL = "rpc_get_production_route_manager_workload_preview";
const ERV_RPC = "rpc_get_effective_product_process_route";
const NON_IDENTITY = ["route-readiness", "shared-workload-preview", "route-family-mapping-review", "route-family-foundation-review", "production-cost-centres", "product-subgroup-mappings", "archived-routes", "route-families"];
let env = null;
test.before(async () => { if (!SKIP) env = await launch(); });
test.after(async () => { await env?.close(); });

async function withPage(t, search, storage, fn) {
  if (SKIP) return t.skip("browser tests skipped");
  if (!env) return t.skip("playwright not available");
  const { context, page, errors } = await openPage(env.browser, env.base, search, { dialogs: true, storage });
  try {
    await page.waitForSelector('#lensPills .pill[data-lens="route-readiness"]');
    await fn(page);
    assert.deepEqual(errors, [], "no page errors");
    assert.deepEqual(await writeCalls(page), [], "navigation never writes");
  } finally {
    await context.close();
  }
}

const settle = (page, ms = 800) => page.waitForTimeout(ms);
const pill = async (page, lens, ms = 800) => { await page.click(`#lensPills .pill[data-lens="${lens}"]`); await settle(page, ms); };
const active = (page) => page.evaluate(() => [...document.querySelectorAll("#lensPills .pill.active")].map((e) => e.dataset.lens));
const urlParam = (page, key) => new URL(page.url()).searchParams.get(key);
const chips = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#cpNavContext .cp-context-chip[data-context-key]")]
  .filter((e) => ["product", "family", "route"].includes(e.dataset.contextKey))
  .map((e) => [e.dataset.contextKey, e.querySelector(".cp-context-chip-value")?.textContent ?? e.textContent])));
const wlProducts = async (page) => (await rpcCalls(page)).filter((c) => c.name === WL).map((c) => c.args.p_product_id ?? null);
const popTo = (page, search) => page.evaluate((s) => { history.pushState({}, "", location.pathname + s); window.dispatchEvent(new PopStateEvent("popstate")); }, search);
const delayOnce = (page, rpcName, ms) => page.evaluate(([name, d]) => {
  const rpc = window.__mock.rpc;
  const orig = rpc.push.bind(rpc);
  rpc.push = (entry) => {
    if (entry.name === name) {
      const first = Object.values(entry.args || {})[0];
      window.__mock.cfg.delaysOnce = { ...(window.__mock.cfg.delaysOnce || {}), [name + ":" + first]: d };
    }
    return orig(entry);
  };
}, [rpcName, ms]);
const NONE = {};

for (const [label, storage] of [["OFF (no flags)", OFF], ["OFF (N1 only)", N1]]) {
  test(`${label}: no Product / Family / Route chip anywhere; Workload Preview unfiltered`, async (t) => {
    await withPage(t, "?lens=effective-route-viewer&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      assert.deepEqual(await chips(page), NONE, "no chips on an identity lens");
      await pill(page, "shared-workload-preview", 1200);
      assert.deepEqual(await chips(page), NONE);
      assert.equal((await wlProducts(page)).at(-1), null);
      await pill(page, "effective-route-viewer", 1000);
      assert.deepEqual(await chips(page), NONE);
    });
  });
}

test("ON: identity -> Workload Preview clears the chips; Workload stays the unfiltered register (no product_id in URL or RPC)", async (t) => {
  await withPage(t, "?lens=effective-route-viewer&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    const c = await chips(page);
    assert.match(c.product, /Mock Product \(#77\)/);
    await pill(page, "shared-workload-preview", 1200);
    assert.deepEqual(await active(page), ["shared-workload-preview"]);
    assert.deepEqual(await chips(page), NONE, "no Product / Family / Route chip on Workload Preview");
    assert.equal((await wlProducts(page)).at(-1), null, "no Product filter sent");
    assert.equal(urlParam(page, "product_id"), null);
  });
});

test("ON: returning to an identity lens restores the chips and the remembered Product without hidden filtering", async (t) => {
  await withPage(t, "?lens=effective-route-viewer&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    await pill(page, "shared-workload-preview", 1000);
    await pill(page, "route-readiness", 900);
    assert.deepEqual(await chips(page), NONE);
    await pill(page, "effective-route-viewer", 1200);
    assert.match((await chips(page)).product, /#77/, "chips restored");
    assert.equal(await page.inputValue("#prmEffectiveProduct"), "77", "N4 hydration unchanged: Product restored for the identity lens");
    await pill(page, "shared-workload-preview", 1200);
    assert.deepEqual(await chips(page), NONE);
    assert.equal((await wlProducts(page)).at(-1), null, "still no hidden Workload filter");
  });
});

test("ON: every non-identity lens shows no chips and every return to an identity lens restores them", async (t) => {
  await withPage(t, "?lens=effective-route-viewer&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    for (const lens of NON_IDENTITY) {
      await pill(page, "effective-route-viewer", 1100);
      if (!/#77/.test((await chips(page)).product ?? "")) await popTo(page, "?lens=effective-route-viewer&product_id=77");
      await settle(page, 700);
      assert.match((await chips(page)).product ?? "", /#77/, `${lens}: precondition - chips on the identity lens`);
      await pill(page, lens, 1000);
      assert.deepEqual(await chips(page), NONE, `${lens}: chips hidden`);
    }
  });
});

test("ON: product-route-editor route chip is hidden on registers and restored on return", async (t) => {
  await withPage(t, "?lens=product-route-editor&product_route_id=9002&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    assert.equal((await chips(page)).route, "Product route #9002");
    await pill(page, "route-readiness", 900);
    assert.deepEqual(await chips(page), NONE);
    await pill(page, "product-route-editor", 1200);
    assert.equal((await chips(page)).route, "Product route #9002", "same version restored (N4 identity retention)");
    assert.match((await chips(page)).product, /#77/);
  });
});

test("ON: explicit Workload Preview Product deep link filters but shows no remembered identity chip", async (t) => {
  await withPage(t, "?lens=shared-workload-preview&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    assert.equal((await wlProducts(page)).at(-1), 77, "explicit deep link still filters");
    assert.equal(urlParam(page, "product_id"), "77");
    assert.deepEqual(await chips(page), NONE);
  });
});

test("ON: Product A -> Product B never shows A's chips; Workload hides B's", async (t) => {
  await withPage(t, "?lens=effective-route-viewer&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    await page.selectOption("#prmEffectiveProduct", "78");
    await settle(page, 1000);
    const b = await chips(page);
    assert.match(b.product, /Other Product \(#78\)/);
    assert.doesNotMatch(JSON.stringify(b), /Mock Product|#77/);
    await pill(page, "shared-workload-preview", 1200);
    assert.deepEqual(await chips(page), NONE);
    assert.equal((await wlProducts(page)).at(-1), null);
    await pill(page, "effective-route-viewer", 1200);
    const back = await chips(page);
    assert.match(back.product, /#78/);
    assert.doesNotMatch(JSON.stringify(back), /Mock Product|#77/);
  });
});

test("ON: reload and browser history follow the URL's lens for chip presentation", async (t) => {
  await withPage(t, "?lens=effective-route-viewer&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    assert.match((await chips(page)).product, /#77/);
    await popTo(page, "?lens=shared-workload-preview");
    await settle(page, 1200);
    assert.deepEqual(await chips(page), NONE, "history move to Workload clears chips");
    await popTo(page, "?lens=effective-route-viewer&product_id=77");
    await settle(page, 1200);
    assert.match((await chips(page)).product, /#77/, "history move to the identity lens restores chips");
    await page.goto(page.url().replace(/\?.*$/, "?lens=shared-workload-preview"));
    await page.waitForSelector('#lensPills .pill[data-lens="route-readiness"]');
    await settle(page, 1200);
    assert.deepEqual(await chips(page), NONE, "reload on Workload Preview: no chips");
  });
});

test("ON: stale-response protection - a late identity-lens response that was abandoned for a register must not restore chips", async (t) => {
  await withPage(t, "?lens=effective-route-viewer&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    assert.match((await chips(page)).product, /#77/, "precondition: context remembered");
    await pill(page, "route-readiness", 900);
    assert.deepEqual(await chips(page), NONE);
    await delayOnce(page, ERV_RPC, 1800);
    await popTo(page, "?lens=effective-route-viewer&product_id=77");
    await page.waitForTimeout(150);
    await pill(page, "route-readiness", 0);
    await settle(page, 2800); // the abandoned Effective Route Viewer response arrives and is discarded
    assert.deepEqual(await active(page), ["route-readiness"]);
    assert.deepEqual(await chips(page), NONE, "stale identity load presents nothing");
    await pill(page, "shared-workload-preview", 1100);
    assert.deepEqual(await chips(page), NONE);
  });
});

test("ON: stale-response protection - a late Workload response abandoned for an identity lens must not clear the chips", async (t) => {
  await withPage(t, "?lens=effective-route-viewer&product_id=77", ON, async (page) => {
    await settle(page, 1200);
    assert.match((await chips(page)).product, /#77/);
    await delayOnce(page, WL, 1800);
    await pill(page, "shared-workload-preview", 0);
    await page.waitForTimeout(150);
    await pill(page, "effective-route-viewer", 1000);
    await settle(page, 2600); // the abandoned Workload response arrives and is discarded
    assert.deepEqual(await active(page), ["effective-route-viewer"]);
    assert.match((await chips(page)).product ?? "", /#77/, "late stale register response does not clear the identity lens's chips");
  });
});
