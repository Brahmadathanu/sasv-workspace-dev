// Issue #380 - Workload Preview must not inherit a selected Product from a tab / pill click.
// Real Production Route Manager page + controllers against the in-memory MOCK backend (no Supabase, no network).
// Every journey runs with the MDC-07 flags OFF (default) and ON (COSTING_NAV_GROUPS_V1 + COSTING_PRM_NAV_CONTEXT_V1).
// Skips cleanly without Playwright. Flags are set in the test browser's localStorage only.
import test from "node:test";
import assert from "node:assert/strict";
import { launch, openPage, rpcCalls, writeCalls } from "../costing-prm-corrections/prm-corrections-harness.mjs";

const SKIP = process.env.COSTING_NAV_SKIP_BROWSER === "1" || process.env.COSTING_DIALOGS_BROWSER_SKIP === "1";
const MODES = { OFF: {}, ON: { COSTING_NAV_GROUPS_V1: "1", COSTING_PRM_NAV_CONTEXT_V1: "1" } };
const WL = "rpc_get_production_route_manager_workload_preview";
let env = null;
test.before(async () => { if (!SKIP) env = await launch(); });
test.after(async () => { await env?.close(); });

async function withPage(t, search, storage, fn, opts = {}) {
  if (SKIP) return t.skip("browser tests skipped");
  if (!env) return t.skip("playwright not available");
  const { context, page, errors } = await openPage(env.browser, env.base, search, { dialogs: true, storage, ...opts });
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
const wlCalls = async (page) => (await rpcCalls(page)).filter((c) => c.name === WL);
const lastWlProduct = async (page) => {
  const c = await wlCalls(page);
  assert.ok(c.length, "Workload Preview RPC was called");
  return c[c.length - 1].args.p_product_id ?? null;
};
const popTo = (page, search) => page.evaluate((s) => { history.pushState({}, "", location.pathname + s); window.dispatchEvent(new PopStateEvent("popstate")); }, search);

for (const [mode, storage] of Object.entries(MODES)) {
  test(`${mode}: Product A (Effective Route Viewer) -> Workload Preview pill is the unfiltered register`, async (t) => {
    await withPage(t, "?lens=effective-route-viewer&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      assert.equal(urlParam(page, "product_id"), "77", "Product A selected");
      await pill(page, "shared-workload-preview", 1200);
      assert.deepEqual(await active(page), ["shared-workload-preview"]);
      assert.equal(await lastWlProduct(page), null, "no Product filter sent");
      assert.equal(urlParam(page, "product_id"), null, "tab click leaves no product_id in the URL");
    });
  });

  test(`${mode}: Workload Preview never re-filters after visiting an identity lens`, async (t) => {
    await withPage(t, "?lens=product-route-assignments&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      await pill(page, "shared-workload-preview");
      assert.equal(await lastWlProduct(page), null);
      await pill(page, "effective-route-viewer", 1200);
      if (mode === "ON") {
        assert.equal(await page.inputValue("#prmEffectiveProduct"), "77", "N4 restores the stored Product for the identity lens");
      }
      await pill(page, "shared-workload-preview");
      assert.equal(await lastWlProduct(page), null, "still unfiltered after visiting an identity lens");
    });
  });

  test(`${mode}: identity lenses keep an explicit product_id across their own pills`, async (t) => {
    await withPage(t, "?lens=product-route-assignments&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      await pill(page, "effective-route-viewer", 1200);
      assert.equal(urlParam(page, "product_id"), "77", "Assignments -> Effective Route Viewer keeps the Product");
      assert.equal(await page.inputValue("#prmEffectiveProduct"), "77");
      await pill(page, "product-route-editor", 1000);
      assert.equal(urlParam(page, "product_id"), "77", "Effective Route Viewer -> Route Editor keeps the Product");
      await pill(page, "product-route-assignments", 1000);
      assert.equal(urlParam(page, "product_id"), "77", "Route Editor -> Assignments keeps the Product");
    });
  });

  test(`${mode}: explicit Workload Preview deep link still filters by that Product (supported contract)`, async (t) => {
    await withPage(t, "?lens=shared-workload-preview&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      assert.deepEqual(await active(page), ["shared-workload-preview"]);
      assert.equal(await lastWlProduct(page), 77);
      assert.equal(urlParam(page, "product_id"), "77", "explicit deep link is left alone");
    });
  });

  test(`${mode}: explicit deep link -> other lens -> Workload Preview pill drops the filter (no stale state.product_id)`, async (t) => {
    await withPage(t, "?lens=shared-workload-preview&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      assert.equal(await lastWlProduct(page), 77);
      await pill(page, "route-readiness", 900);
      await pill(page, "shared-workload-preview", 1200);
      assert.equal(await lastWlProduct(page), null, "an earlier explicit Product must not survive a later tab click");
      assert.equal(urlParam(page, "product_id"), null);
    });
  });

  test(`${mode}: controller resets the filter when a later Workload load has no product_id (history to a plain Workload URL)`, async (t) => {
    await withPage(t, "?lens=shared-workload-preview&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      assert.equal(await lastWlProduct(page), 77);
      await popTo(page, "?lens=route-readiness");
      await settle(page, 900);
      await popTo(page, "?lens=shared-workload-preview");
      await settle(page, 1200);
      assert.equal(await lastWlProduct(page), null, "controller must not reuse the previous load's Product");
    });
  });

  test(`${mode}: Product A -> Product B: Workload Preview follows an explicit deep link only, never the old Product`, async (t) => {
    await withPage(t, "?lens=effective-route-viewer&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      await page.selectOption("#prmEffectiveProduct", "78");
      await settle(page, 900);
      await pill(page, "shared-workload-preview", 1200);
      assert.equal(await lastWlProduct(page), null, "Product B selection is not a Workload filter either");
      await popTo(page, "?lens=shared-workload-preview&product_id=78");
      await settle(page, 1200);
      assert.equal(await lastWlProduct(page), 78, "explicit deep link for Product B -> B, never A");
      const productIds = (await wlCalls(page)).map((c) => c.args.p_product_id ?? null);
      assert.ok(!productIds.includes(77), "Product A was never sent to Workload Preview");
    });
  });

  test(`${mode}: Back / Forward across Workload Preview restores each URL's own filter state`, async (t) => {
    await withPage(t, "?lens=route-readiness", storage, async (page) => {
      await settle(page, 900);
      await popTo(page, "?lens=shared-workload-preview&product_id=77");
      await settle(page, 1200);
      assert.equal(await lastWlProduct(page), 77);
      await popTo(page, "?lens=shared-workload-preview");
      await settle(page, 1200);
      assert.equal(await lastWlProduct(page), null);
      await page.goBack();
      await settle(page, 1500);
      assert.equal(await lastWlProduct(page), 77, "Back to the explicit entry restores its filter");
      await page.goForward();
      await settle(page, 1500);
      assert.equal(await lastWlProduct(page), null, "Forward to the plain entry has no filter");
      await pill(page, "route-readiness", 900);
      await pill(page, "shared-workload-preview", 1200);
      assert.equal(await lastWlProduct(page), null, "a pill click after history moves is still unfiltered");
    });
  });

  test(`${mode}: stale-response protection - a late Workload response of an abandoned explicit load does not leak its Product`, async (t) => {
    await withPage(t, "?lens=route-readiness", storage, async (page) => {
      await settle(page, 900);
      // Delay the first Workload Preview response whatever its first argument is (harness key = rpc name + first arg value).
      await page.evaluate((name) => {
        const rpc = window.__mock.rpc;
        const orig = rpc.push.bind(rpc);
        rpc.push = (entry) => {
          if (entry.name === name) {
            const first = Object.values(entry.args || {})[0];
            window.__mock.cfg.delaysOnce = { ...(window.__mock.cfg.delaysOnce || {}), [name + ":" + first]: 1500 };
          }
          return orig(entry);
        };
      }, WL);
      await popTo(page, "?lens=shared-workload-preview&product_id=77");
      await page.waitForTimeout(150);
      await pill(page, "route-readiness", 0);
      await settle(page, 2400);
      assert.deepEqual(await active(page), ["route-readiness"]);
      await pill(page, "shared-workload-preview", 1200);
      assert.equal(await lastWlProduct(page), null, "abandoned load's Product is not reused");
    });
  });

  test(`${mode}: register / mapping / foundation lenses never receive the selected Product as a hidden filter`, async (t) => {
    const LENSES = ["route-readiness", "shared-workload-preview", "route-family-mapping-review", "route-family-foundation-review", "production-cost-centres", "product-subgroup-mappings", "archived-routes", "route-families"];
    await withPage(t, "?lens=effective-route-viewer&product_id=77", storage, async (page) => {
      await settle(page, 1200);
      for (const lens of LENSES) {
        await pill(page, "effective-route-viewer", 700);
        if (urlParam(page, "product_id") == null) await popTo(page, "?lens=effective-route-viewer&product_id=77");
        await settle(page, 600);
        const before = (await rpcCalls(page)).length;
        await pill(page, lens, 900);
        const calls = (await rpcCalls(page)).slice(before).filter((c) => !/master_options|get_user_permissions/.test(c.name));
        for (const c of calls) {
          const carried = Object.entries(c.args || {}).filter(([k, v]) => /product_id$/.test(k) && v != null && Number(v) === 77);
          assert.deepEqual(carried, [], `${lens}: ${c.name} must not carry Product 77`);
        }
      }
    });
  });
}
