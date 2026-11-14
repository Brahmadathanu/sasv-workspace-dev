// WP08 G2-1 real-Chromium tests: selection-only URL contract on the four shared Master Data pages, Electron-root and PWA
// serving, 1280 and 390 px, role view/edit/denied, zero writer/preview RPC, Back/Forward, legacy no-param URLs.
//   node --test scripts/wp08-g2-1-navigation/browser.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { launch, startServer, PLATFORMS, MODULES, openSelectionPage, FORBIDDEN_RPC, statusText, view, READINESS_RPC } from "./harness.mjs";

const mod = (key) => MODULES.find((m) => m.key === key);
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

const rpcNames = (calls) => calls.filter((c) => c.kind === "rpc").map((c) => c.name);
function assertNoWrites(calls, external) {
  assert.deepEqual(calls.filter((c) => c.kind === "WRITE"), [], "no table write");
  assert.deepEqual(rpcNames(calls).filter((n) => FORBIDDEN_RPC.test(n)), [], "no writer/preview/rebuild RPC");
  assert.deepEqual(external, [], "no unexpected external request");
}
const productState = (page) => page.evaluate(() => ({
  item: document.getElementById("itemInput").value,
  sku: document.getElementById("skuRegisterBody")?.querySelector('tr[aria-selected="true"]')?.firstChild?.textContent || null,
  skuTitle: document.getElementById("skuEditorTitle")?.textContent || "",
  tabs: Object.fromEntries(["tabProducts", "tabSkus", "tabReadiness"].map((id) => [id, document.getElementById(id)?.getAttribute("aria-selected")])),
  url: location.search,
  histLen: history.length,
}));

for (const platform of Object.keys(PLATFORMS)) {
  const P = (name, fn) => test(`${platform}: ${name}`, async (t) => { const e = await getEnv(t); if (e) await fn(e); });

  P("Products: product_id+sku_id+tab=skus selects Product and SKU (view role), read-only", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11&sku_id=501&tab=skus" });
    const s = await productState(r.page);
    assert.equal(s.item, "Alpha"); assert.equal(s.sku, "SKU 501"); assert.equal(s.tabs.tabSkus, "true");
    assert.equal(await statusText(r.page), "");
    assert.deepEqual(r.errors, []); assert.deepEqual(r.failed, []);
    assertNoWrites(await r.calls(), r.external);
    await r.context.close();
  });
  P("Products: tab=readiness with sku opens the SKU readiness detail; tab=readiness alone selects only the tab", async (e) => {
    let r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=12&sku_id=502&tab=readiness" });
    let s = await productState(r.page);
    assert.equal(s.item, "Beta"); assert.equal(s.tabs.tabReadiness, "true"); assert.equal(s.sku, "SKU 502");
    assertNoWrites(await r.calls(), r.external); await r.context.close();
    r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11&tab=readiness" });
    s = await productState(r.page);
    assert.equal(s.item, "Alpha"); assert.equal(s.tabs.tabReadiness, "true"); assert.equal(s.sku, null);
    await r.context.close();
  });
  P("Products: SKU of another Product is refused with a status; the named Product stays selected; no SKU guessed", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11&sku_id=502" });
    const s = await productState(r.page);
    assert.equal(s.item, "Alpha"); assert.equal(s.sku, null);
    assert.match(await statusText(r.page), /SKU 502 does not belong to Product 11/);
    await r.context.close();
  });
  P("Products: unknown / invalid / duplicate / sku-only ids select nothing and explain", async (e) => {
    for (const [q, re] of [
      ["?product_id=999", /Product 999 was not found/],
      ["?product_id=abc", /not a valid identifier/],
      ["?product_id=0", /not a valid identifier/],
      ["?product_id=11&product_id=12", /more than once/],
      ["?sku_id=501", /sku_id needs a valid product_id/],
      ["?product_id=11&tab=bogus", /tab is not recognised/],
    ]) {
      const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: q });
      const s = await productState(r.page);
      if (q.includes("tab=bogus")) assert.equal(s.item, "Alpha", "valid product still selected, bad tab ignored");
      else assert.equal(s.item, "", `${q}: no product selected`);
      assert.equal(s.sku, null, q);
      assert.match(await statusText(r.page), re, q);
      assertNoWrites(await r.calls(), r.external);
      await r.context.close();
    }
  });
  P("Products: legacy no-param URL is unchanged (no status, no selection, URL untouched)", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products") });
    const s = await productState(r.page);
    assert.equal(s.item, ""); assert.equal(s.url, ""); assert.equal(await statusText(r.page), "");
    assert.equal(await r.page.evaluate(() => document.getElementById("mdSelectionStatus")), null);
    await r.context.close();
  });
  P("Products: denied role never reads data from the URL selection", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), role: "denied", suffix: "?product_id=11&sku_id=501" });
    const c = await r.calls();
    assert.deepEqual(c.filter((x) => x.kind === "from" && ["products", "product_skus"].includes(x.table)), []);
    assert.equal((await productState(r.page)).item, "");
    await r.context.close();
  });
  P("Products: in-page selection keeps URL truthful via replaceState (no history growth); legacy URL never rewritten", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11" });
    const before = await productState(r.page);
    await r.page.evaluate(() => document.getElementById("tabSkus").click());
    await r.page.waitForTimeout(150);
    await r.page.locator("#skuRegisterBody tr").first().click();
    await r.page.waitForTimeout(300);
    const after = await productState(r.page);
    assert.match(after.url, /product_id=11/); assert.match(after.url, /sku_id=501/); assert.match(after.url, /tab=skus/);
    assert.equal(after.histLen, before.histLen, "no history churn");
    await r.context.close();
  });
  P("Products: Back/Forward is URL-authoritative; unsaved edit blocks it and restores the URL", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), role: "edit", suffix: "?product_id=11" });
    await r.page.evaluate(() => history.pushState(null, "", location.pathname + "?product_id=12"));
    await r.page.goBack(); await r.page.waitForTimeout(500);
    assert.equal((await productState(r.page)).item, "Alpha");
    await r.page.goForward(); await r.page.waitForTimeout(800);
    assert.equal((await productState(r.page)).item, "Beta", "forward entry applied from URL");
    // dirty state: enter edit mode and change a field, then go back -> blocked
    await r.page.locator("#productRegisterBody tr").nth(1).dblclick(); // opens the Product dialog (existing UI)
    await r.page.waitForTimeout(400);
    await r.page.locator("#editToggleBtn").click();
    await r.page.fill("#itemInput", "Beta changed");
    await r.page.goBack(); await r.page.waitForTimeout(600);
    assert.equal(await r.page.inputValue("#itemInput"), "Beta changed", "unsaved edit was not discarded by Back");
    assertNoWrites(await r.calls(), r.external);
    await r.context.close();
  });
  P("RM BOM: product_id selects the owner product and reads its BOM only", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-rm-bom"), suffix: "?product_id=11" });
    assert.equal(await r.page.inputValue("#productPicker").catch(() => null) ?? await r.page.evaluate(() => document.getElementById("productPicker").value), "11");
    const c = await r.calls();
    assert.ok(c.some((x) => x.kind === "from" && x.table === "rm_bom_header" && x.eq.some(([k, v]) => k === "product_id" && String(v) === "11")), "BOM read for product 11");
    assert.ok(!c.some((x) => x.kind === "from" && x.table === "rm_bom_header" && x.eq.some(([, v]) => String(v) === "12")));
    assert.deepEqual(r.errors, []); assertNoWrites(c, r.external);
    await r.context.close();
  });
  P("RM BOM: unknown / invalid product_id is a no-op with status and never falls back to another product", async (e) => {
    for (const q of ["?product_id=999", "?product_id=1.5", "?product_id=11&product_id=12"]) {
      const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-rm-bom"), suffix: q });
      assert.equal(await r.page.evaluate(() => document.getElementById("productPicker").value), "", q);
      assert.ok(await statusText(r.page), q);
      assert.deepEqual((await r.calls()).filter((x) => x.table === "rm_bom_header"), [], q);
      await r.context.close();
    }
  });
  P("RM BOM: legacy URL baseline (empty picker, no status)", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-rm-bom") });
    assert.equal(await r.page.evaluate(() => document.getElementById("productPicker").value), "");
    assert.equal(await statusText(r.page), "");
    await r.context.close();
  });
  P("SP BOM: owner_item_id selects the SP owner; product_id is NOT an SP identity and is ignored", async (e) => {
    let r = await openSelectionPage(e, { platform, moduleDef: mod("manage-sp-bom"), suffix: "?owner_item_id=901" });
    assert.equal(await r.page.evaluate(() => document.getElementById("productPicker").value), "901");
    const c = await r.calls();
    assert.ok(c.some((x) => x.table === "sp_bom_header" && x.kind === "from"));
    assertNoWrites(c, r.external); await r.context.close();
    r = await openSelectionPage(e, { platform, moduleDef: mod("manage-sp-bom"), suffix: "?product_id=11" });
    assert.equal(await r.page.evaluate(() => document.getElementById("productPicker").value), "");
    assert.match(await statusText(r.page), /product_id is not an SP BOM identity/);
    assert.deepEqual((await r.calls()).filter((x) => x.table === "sp_bom_header"), []);
    await r.context.close();
    r = await openSelectionPage(e, { platform, moduleDef: mod("manage-sp-bom"), suffix: "?owner_item_id=11" });
    assert.equal(await r.page.evaluate(() => document.getElementById("productPicker").value), "", "a product id value is never reinterpreted as an owner");
    assert.match(await statusText(r.page), /not found/);
    await r.context.close();
  });
  P("PM BOM (pm-templates): sku_id selects the Overrides-tab SKU; reads rpc_pm_ovr_list only; no preview/rebuild/template guess", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("pm-templates"), suffix: "?sku_id=501" });
    const c = await r.calls();
    const ovr = c.filter((x) => x.kind === "rpc" && x.name === "rpc_pm_ovr_list");
    assert.ok(ovr.length >= 1 && ovr.every((x) => x.args.p_sku_id === 501), "overrides read for SKU 501 only");
    assert.equal(await r.page.evaluate(() => document.getElementById("ovr_skuPicker").value), "501");
    assert.equal(await r.page.evaluate(() => document.getElementById("tabBtnOverrides").getAttribute("aria-selected")), "true");
    assert.equal(await r.page.evaluate(() => document.getElementById("ovr_previewSkuPicker").value), "", "preview picker untouched");
    assert.deepEqual(rpcNames(c).filter((n) => /preview/.test(n)), []);
    assert.deepEqual(r.errors, []); assertNoWrites(c, r.external);
    await r.context.close();
  });
  P("PM BOM: unknown sku_id / template-id-like value is a no-op with status; legacy URL baseline", async (e) => {
    let r = await openSelectionPage(e, { platform, moduleDef: mod("pm-templates"), suffix: "?sku_id=999" });
    assert.deepEqual((await r.calls()).filter((x) => x.name === "rpc_pm_ovr_list"), []);
    assert.match(await statusText(r.page), /SKU 999 was not found/);
    assert.equal(await r.page.evaluate(() => document.getElementById("tabBtnOverrides").getAttribute("aria-selected")), "false");
    await r.context.close();
    r = await openSelectionPage(e, { platform, moduleDef: mod("pm-templates"), suffix: "?template_id=3&tpl_id=3" });
    assert.equal(await statusText(r.page), "", "template ids are not part of the contract");
    assert.deepEqual((await r.calls()).filter((x) => x.name === "rpc_pm_ovr_list"), []);
    await r.context.close();
    r = await openSelectionPage(e, { platform, moduleDef: mod("pm-templates") });
    assert.equal(await statusText(r.page), "");
    await r.context.close();
  });
  P("denied role on every BOM page: URL selection performs no data reads", async (e) => {
    for (const [key, q] of [["manage-rm-bom", "?product_id=11"], ["manage-sp-bom", "?owner_item_id=901"], ["pm-templates", "?sku_id=501"]]) {
      const r = await openSelectionPage(e, { platform, moduleDef: mod(key), role: "denied", suffix: q });
      const c = await r.calls();
      assert.deepEqual(c.filter((x) => (x.kind === "from" && /bom_header|v_picker|v_sku/.test(x.table)) || x.name === "rpc_pm_ovr_list"), [], key);
      await r.context.close();
    }
  });

  // ───────── Stage C: outbound handoffs ─────────
  const ALL_VIEW = [view("module:manage-rm-bom"), view("module:pm-templates"), view("module:production-route-manager"), view("module:cost-build-manager"), view("module:cost-sheet-review"), view("module:pricing-policy-manager")];
  const readinessLinks = (page) => page.evaluate(() => ({
    related: [...document.querySelectorAll("#skuReadiness .mp-related a")].map((a) => a.getAttribute("href")),
    remediation: [...document.querySelectorAll("#skuReadiness .mp-remediation-item")].map((it) => ({ text: it.querySelector("strong")?.textContent, route: it.querySelector(".mp-remediation-route")?.textContent, href: it.querySelector("a")?.getAttribute("href") || null, note: [...it.querySelectorAll(".mp-remediation-meta")].map((m) => m.textContent).join("|") })),
  }));
  P("Products readiness: Related and remediation links only for proven destinations with verified view permission", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11&sku_id=501&tab=readiness", extraGrants: ALL_VIEW, rpc: READINESS_RPC });
    const l = await readinessLinks(r.page);
    assert.deepEqual(l.related, ["manage-rm-bom.html?product_id=11", "manage-pm-bom.html?sku_id=501", "production-route-manager.html?lens=product-route-assignments&product_id=11"]);
    const by = Object.fromEntries(l.remediation.map((x) => [x.route.replace("Resolve in: ", ""), x]));
    assert.equal(by.PRODUCTION_ROUTE_MANAGER.href, "production-route-manager.html?lens=product-route-assignments&product_id=11");
    assert.equal(by.DRIVER_GOVERNANCE.href, "cost-build-manager.html?lens=driver-governance");
    assert.equal(by.QC_ACTION_QUEUE.href, "cost-sheet-review.html?lens=qc-action-queue&period_start=2026-10-01");
    assert.equal(by.COMMERCIAL_SALES_ASSUMPTIONS.href, "pricing-policy-manager.html?workspace=commercial-sales-assumptions&period_start=2026-10-01");
    assert.match(by.COMMERCIAL_SALES_ASSUMPTIONS.note, /not carried over/);
    for (const code of ["MRP_GOVERNANCE", "SELLING_SCHEME_POLICIES", "BATCH_SIZES", "REGIONAL_MARKETING_REVIEW"]) assert.equal(by[code].href, null, `${code} stays text only`);
    assert.deepEqual(r.errors, []); assertNoWrites(await r.calls(), r.external);
    await r.context.close();
  });
  P("Products readiness: no destination permission -> no links, explanatory text; SP BOM never offered", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11&sku_id=501&tab=readiness", rpc: READINESS_RPC });
    const l = await readinessLinks(r.page);
    assert.deepEqual(l.related, []);
    assert.ok(l.remediation.length >= 8 && l.remediation.every((x) => x.href === null), "no remediation link without destination view permission");
    assert.match(l.remediation.find((x) => /DRIVER_GOVERNANCE/.test(x.route)).note, /do not have permission/);
    await r.context.close();
    const v = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11&sku_id=501&tab=readiness", extraGrants: [{ target: "module:manage-sp-bom", can_view: true, can_edit: true }], rpc: READINESS_RPC });
    assert.deepEqual((await readinessLinks(v.page)).related, [], "SP BOM has no proven Product->owner mapping");
    await v.context.close();
  });
  P("Products readiness: a can_view=false or non-boolean grant never produces a link", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11&sku_id=501&tab=readiness", extraGrants: [{ target: "module:manage-rm-bom", can_view: false, can_edit: true }, { target: "module:pm-templates", can_view: "true", can_edit: true }], rpc: READINESS_RPC });
    assert.deepEqual((await readinessLinks(r.page)).related, []);
    await r.context.close();
  });
  P("Products -> RM BOM handoff: link resolves under this platform's prefix, opens read-only, lands on the same Product", async (e) => {
    const r = await openSelectionPage(e, { platform, moduleDef: mod("manage-products"), suffix: "?product_id=11&sku_id=501&tab=readiness", extraGrants: ALL_VIEW, rpc: READINESS_RPC });
    const href = (await readinessLinks(r.page)).related[0];
    const abs = new URL(href, r.page.url());
    assert.equal(abs.pathname, `${PLATFORMS[platform].pagePrefix}manage-rm-bom.html`);
    const [popup] = await Promise.all([r.context.waitForEvent("page"), r.page.locator('#skuReadiness .mp-related a[href^="manage-rm-bom"]').click()]);
    await popup.waitForLoadState("load"); await popup.waitForTimeout(1200);
    assert.equal(new URL(popup.url()).pathname, abs.pathname);
    assert.equal(await popup.evaluate(() => document.getElementById("productPicker").value), "11");
    assert.equal(await popup.evaluate(() => window.opener), null, "noopener");
    assert.deepEqual((await popup.evaluate(() => window.__CALLS)).filter((c) => c.kind === "WRITE" || (c.kind === "rpc" && /(?:create|update|set|save|delete|approve|submit|activate|upsert|insert|clone|rebuild|preview)/i.test(c.name))), []);
    await r.context.close();
  });
  P("RM BOM -> Product backlink: only with a resolved Product and verified manage-products view; lands on the same Product", async (e) => {
    const links = (page) => page.evaluate(() => [...document.querySelectorAll("#moreMenu a[data-md-backlink]")].map((a) => a.getAttribute("href")));
    let r = await openSelectionPage(e, { platform, moduleDef: mod("manage-rm-bom"), suffix: "?product_id=11", extraGrants: [view("module:manage-products")] });
    assert.deepEqual(await links(r.page), ["manage-products.html?product_id=11"]);
    const abs = new URL("manage-products.html?product_id=11", r.page.url());
    assert.equal(abs.pathname, `${PLATFORMS[platform].pagePrefix}manage-products.html`);
    const popup = await r.context.newPage();
    await popup.goto(abs.href); await popup.waitForTimeout(1200);
    assert.equal(await popup.evaluate(() => document.getElementById("itemInput").value), "Alpha");
    await popup.close(); await r.context.close();
    r = await openSelectionPage(e, { platform, moduleDef: mod("manage-rm-bom"), suffix: "?product_id=11" });
    assert.deepEqual(await links(r.page), [], "no grant -> no backlink");
    await r.context.close();
    r = await openSelectionPage(e, { platform, moduleDef: mod("manage-rm-bom"), suffix: "?product_id=11", extraGrants: [{ target: "module:manage-products", can_view: false, can_edit: false }] });
    assert.deepEqual(await links(r.page), [], "view=false -> no backlink");
    await r.context.close();
    r = await openSelectionPage(e, { platform, moduleDef: mod("manage-rm-bom"), extraGrants: [view("module:manage-products")] });
    assert.deepEqual(await links(r.page), [], "no selected Product -> no backlink");
    await r.context.close();
  });
  for (const width of [1280, 390]) {
    P(`deep-linked pages @${width}: no page errors; horizontal overflow ${width === 390 ? "checked except known PM UX-P05" : "checked"}`, async (e) => {
      for (const [key, q] of [["manage-products", "?product_id=11&sku_id=501&tab=skus"], ["manage-rm-bom", "?product_id=11"], ["manage-sp-bom", "?owner_item_id=901"], ["pm-templates", "?sku_id=501"]]) {
        const r = await openSelectionPage(e, { platform, moduleDef: mod(key), width, suffix: q });
        assert.deepEqual(r.errors, [], key);
        const o = await r.page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
        if (!(key === "pm-templates" && width === 390)) assert.ok(o.sw <= o.vw + 1, `${key}@${width} overflow ${o.sw}>${o.vw}`);
        await r.context.close();
      }
    });
  }
}

// Known, deferred, NOT a pass (WP11 UX-P05): PM BOM overflows horizontally at 390 px on main as well.
test("KNOWN ISSUE WP11/UX-P05 (not a pass): PM BOM 390 px horizontal overflow persists with a deep link", { todo: "WP11 UX-P05: pre-existing PM BOM mobile overflow; not fixed or masked by G2-1" }, async () => {
  assert.fail("recorded as FAIL/deferred, not a pass");
});
