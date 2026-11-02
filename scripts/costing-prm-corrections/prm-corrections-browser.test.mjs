// WP05-P02 browser acceptance (mock backend, real page and controllers). Skips cleanly without Playwright;
// COSTING_DIALOGS_BROWSER_SKIP=1 skips explicitly. No Supabase, no network: every RPC is an in-memory mock.
import test from "node:test";
import assert from "node:assert/strict";
import { launch, openPage, rpcCalls, writeCalls } from "./prm-corrections-harness.mjs";

const SKIP = process.env.COSTING_DIALOGS_BROWSER_SKIP === "1";
let env = null;
test.before(async () => { if (!SKIP) env = await launch(); });
test.after(async () => { await env?.close(); });

async function withPage(t, search, opts, fn) {
  if (SKIP) return t.skip("COSTING_DIALOGS_BROWSER_SKIP=1");
  if (!env) return t.skip("playwright not available");
  const { context, page, errors } = await openPage(env.browser, env.base, search, opts);
  try {
    await fn(page);
    assert.deepEqual(errors, [], "no page errors");
  } finally {
    await context.close();
  }
}

const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; }, sel);
const modalOpen = (page) => page.evaluate(() => !document.getElementById("detailsModal")?.classList.contains("hidden") && Boolean(document.querySelector("#detailsModal [data-prm-prompt-submit], #detailsModal [data-prm-create-family-submit]")));
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.peq-toast, [class*="toast"]')].map((e) => e.textContent.trim()).filter(Boolean));
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const count = async (page, name) => (await rpcCalls(page)).filter((c) => c.name === name).length;

// ---------- C2: Historical Evidence Review ----------
test("C2 flag ON: direct deep link shows the scope controls and preselects family, product and group", async (t) => {
  await withPage(t, "?lens=historical-candidate-review&route_family_id=12&product_id=78&product_group_id=502", {}, async (page) => {
    await page.waitForSelector("#prmCandidateGroups");
    for (const sel of ["#prmCandidateFamily", "#prmCandidateGroups", "#prmCandidateProduct", 'button[data-prm-candidate="family-b"]']) {
      assert.equal(await visible(page, sel), true, `${sel} visible`);
    }
    assert.equal(await page.inputValue("#prmCandidateFamily"), "12");
    assert.equal(await page.inputValue("#prmCandidateProduct"), "78");
    assert.deepEqual(await page.evaluate(() => [...document.getElementById("prmCandidateGroups").selectedOptions].map((o) => o.value)), ["502"]);
    assert.deepEqual(await writeCalls(page), []);
  });
});

test("C2 flag ON: normal navigation via the lens pill shows the controls; selection survives a preview repaint", async (t) => {
  await withPage(t, "?lens=route-readiness", {}, async (page) => {
    await page.waitForSelector('button.pill[data-lens="historical-candidate-review"]');
    await page.click('button.pill[data-lens="historical-candidate-review"]');
    await page.waitForSelector("#prmCandidateGroups");
    assert.equal(await visible(page, "#prmCandidateGroups"), true);
    await page.selectOption("#prmCandidateGroups", ["501"]);
    await page.selectOption("#prmCandidateProduct", "77");
    await page.click('button[data-prm-candidate="family-b"]');
    await page.waitForSelector("[data-prm-create-family]");
    assert.equal(await count(page, "rpc_preview_route_family_candidate"), 1, "one preview call per click");
    assert.deepEqual(await page.evaluate(() => [...document.getElementById("prmCandidateGroups").selectedOptions].map((o) => o.value)), ["501"], "group kept after repaint");
    assert.equal(await page.inputValue("#prmCandidateProduct"), "77");
    assert.equal(await visible(page, "#prmCandidateGroups"), true);
    // leaving the lens hides the shared summary host again
    await page.click('button.pill[data-lens="route-families"]');
    await page.waitForFunction(() => !document.getElementById("prmCandidateGroups"));
  });
});

test("C2 flag OFF parity: controls stay in the hidden summary host exactly as before", async (t) => {
  await withPage(t, "?lens=historical-candidate-review&route_family_id=12&product_id=78", { corrections: false }, async (page) => {
    await page.waitForSelector("#prmCandidateGroups", { state: "attached" });
    assert.equal(await visible(page, "#prmCandidateGroups"), false);
    assert.equal(await page.inputValue("#prmCandidateFamily"), "", "nothing preselected with the flag OFF");
  });
});

test("C2 mobile 390px: controls visible, no horizontal page scroll", async (t) => {
  await withPage(t, "?lens=historical-candidate-review", { width: 390, height: 800 }, async (page) => {
    await page.waitForSelector("#prmCandidateGroups");
    assert.equal(await visible(page, "#prmCandidateGroups"), true);
    assert.equal(await noHorizontalScroll(page), true);
  });
});

// ---------- C3: governed Route Family creation ----------
async function openFamilyHandoff(page) {
  await page.waitForSelector("#prmCandidateGroups");
  await page.selectOption("#prmCandidateGroups", ["501"]);
  await page.click('button[data-prm-candidate="family-b"]');
  await page.waitForSelector("[data-prm-create-family]");
  await page.click("[data-prm-create-family]");
  await page.waitForSelector("#prmFamilyCode");
}

test("C3 flag ON: Create hands off to the governed modal; code and name are empty and user-supplied; Cancel writes nothing", async (t) => {
  await withPage(t, "?lens=historical-candidate-review", {}, async (page) => {
    await openFamilyHandoff(page);
    assert.equal(await page.inputValue("#prmFamilyCode"), "", "no generated code");
    assert.equal(await page.inputValue("#prmFamilyName"), "");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "prmFamilyCode");
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("#prmCreateFamilyName"))), false, "legacy name-only prompt not used");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("detailsModal")?.classList.contains("hidden"));
    assert.deepEqual(await writeCalls(page), []);
  });
});

test("C3 flag ON: missing/invalid code never calls the RPC; valid input sends exactly the typed code and name", async (t) => {
  await withPage(t, "?lens=historical-candidate-review", {}, async (page) => {
    await openFamilyHandoff(page);
    await page.fill("#prmFamilyName", "Kashayam Regular");
    await page.click("[data-prm-create-family-submit]");
    await page.fill("#prmFamilyCode", "9bad code");
    await page.click("[data-prm-create-family-submit]");
    assert.deepEqual(await writeCalls(page), [], "no write for missing or invalid code");
    assert.equal(await modalOpen(page) || await visible(page, "#prmFamilyCode"), true, "modal stays open");
    await page.fill("#prmFamilyCode", "kashayam_regular");
    await page.click("[data-prm-create-family-submit]");
    await page.waitForFunction(() => document.getElementById("detailsModal")?.classList.contains("hidden") || !document.getElementById("prmFamilyCode"));
    const writes = await writeCalls(page);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].name, "rpc_create_route_family");
    assert.equal(writes[0].args.p_family_code, "KASHAYAM_REGULAR");
    assert.equal(writes[0].args.p_family_name, "Kashayam Regular");
    assert.deepEqual(Object.keys(writes[0].args).sort(), ["p_effective_from", "p_family_code", "p_family_name"]);
  });
});

test("C3 flag ON: a failed creation keeps the dialog open and shows no success message", async (t) => {
  await withPage(t, "?lens=historical-candidate-review", { cfg: { failCreate: true } }, async (page) => {
    await openFamilyHandoff(page);
    await page.fill("#prmFamilyCode", "DUP_CODE");
    await page.fill("#prmFamilyName", "Duplicate");
    await page.click("[data-prm-create-family-submit]");
    await page.waitForFunction(() => (window.__mock.rpc || []).some((c) => c.name === "rpc_create_route_family"));
    await page.waitForTimeout(300);
    assert.equal(await visible(page, "#prmFamilyCode"), true, "dialog still open");
    assert.equal(await page.inputValue("#prmFamilyCode"), "DUP_CODE", "input preserved for correction");
    assert.equal((await toasts(page)).some((x) => /Route Family created/i.test(x)), false, "no success claim");
    assert.equal((await writeCalls(page)).length, 1);
  });
});

test("C3 flag OFF parity: legacy native name prompt is used and no family RPC is issued", async (t) => {
  await withPage(t, "?lens=historical-candidate-review", { corrections: false }, async (page) => {
    await page.waitForSelector("#prmCandidateGroups", { state: "attached" });
    await page.evaluate(() => { document.getElementById("workbenchSummary")?.classList.add("is-visible"); });
    await page.selectOption("#prmCandidateGroups", ["501"]);
    await page.click('button[data-prm-candidate="family-b"]');
    await page.waitForSelector("[data-prm-create-family]");
    let prompted = null;
    page.once("dialog", async (d) => { prompted = d.message(); await d.accept("Typed Name"); });
    await page.click("[data-prm-create-family]");
    await page.waitForTimeout(300);
    assert.match(prompted || "", /Manufacturing Route Family name:/);
    assert.deepEqual(await writeCalls(page), [], "name-only request is rejected client-side (unchanged legacy behaviour)");
  });
});

// ---------- C1: Product Route Editor and Supersession ----------
test("C1 flag ON: empty editor offers a Product picker; route history lets the user select another version of that Product", async (t) => {
  await withPage(t, "?lens=product-route-editor", {}, async (page) => {
    await page.waitForSelector("#prmProductEditorProduct", { state: "attached" });
    await page.evaluate(() => { const s = document.getElementById("prmProductEditorProduct"); s.value = "77"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    // Product 77 has exactly one current (DRAFT) route, so the existing loader opens it; the history button then
    // offers the other versions.
    await page.waitForSelector('[data-prm-action="product-route-history"]');
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-prm-action="supersede-product"]'))), false, "DRAFT 9003: no Supersede");
    await page.click('[data-prm-action="product-route-history"]');
    await page.waitForSelector("#detailsModal [data-prm-history-table]");
    const ids = await page.evaluate(() => [...document.querySelectorAll("#detailsModal [data-prm-history-row]")].map((r) => r.getAttribute("data-prm-history-open")));
    assert.ok(ids.includes("9001") && ids.includes("9002") && ids.includes("9003"));
    assert.equal(ids.includes("9100"), false, "other Product's routes are never listed");
    await page.click('#detailsModal button[data-prm-history-open="9001"]');
    await page.waitForSelector('[data-prm-action="supersede-product"]');
    assert.match(page.url(), /product_route_id=9001/);
    assert.deepEqual(await writeCalls(page), [], "browsing performs no writes");
  });
});

test("C1 flag OFF parity: no picker in the empty state; Supersede stays always visible on a loaded route", async (t) => {
  await withPage(t, "?lens=product-route-editor", { corrections: false }, async (page) => {
    await page.waitForSelector(".cp-prm-empty-state");
    assert.equal(await page.evaluate(() => Boolean(document.getElementById("prmProductEditorProduct"))), false);
  });
  await withPage(t, "?lens=product-route-editor&product_route_id=9003&product_id=77", { corrections: false }, async (page) => {
    await page.waitForSelector('[data-prm-action="supersede-product"]');
    assert.equal(await count(page, "rpc_get_product_route_history"), 0, "no extra history read with the flag OFF");
  });
});

test("C1 flag ON: Supersede only on an APPROVED route that has a valid same-Product APPROVED replacement", async (t) => {
  await withPage(t, "?lens=product-route-editor&product_route_id=9003&product_id=77", {}, async (page) => {
    await page.waitForSelector('[data-prm-editor="product"]');
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-prm-action="supersede-product"]'))), false, "DRAFT route: no Supersede");
  });
  await withPage(t, "?lens=product-route-editor&product_route_id=9100&product_id=78", {}, async (page) => {
    await page.waitForSelector("[data-prm-supersede-note]");
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-prm-action="supersede-product"]'))), false, "only one approved version: no Supersede");
    assert.match(await page.textContent("[data-prm-supersede-note]"), /no other approved route version/);
  });
  await withPage(t, "?lens=product-route-editor&product_route_id=9001&product_id=77", { cfg: { failHistory: true } }, async (page) => {
    await page.waitForSelector("[data-prm-supersede-note]");
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-prm-action="supersede-product"]'))), false, "history unavailable: eligibility unknown, hidden");
    assert.match(await page.textContent("[data-prm-supersede-note]"), /could not be loaded/);
  });
  await withPage(t, "?lens=product-route-editor&product_route_id=9001&product_id=77", {}, async (page) => {
    await page.waitForSelector('[data-prm-action="supersede-product"]');
  });
});

async function openSupersede(page) {
  await page.waitForSelector('[data-prm-action="supersede-product"]');
  await page.click('[data-prm-action="supersede-product"]');
  await page.waitForSelector("#prmSupersedeNewRouteId");
}

test("C1 flag ON: selector lists only same-Product APPROVED, non-archived, other routes; names the old route; Cancel/Escape write nothing", async (t) => {
  await withPage(t, "?lens=product-route-editor&product_route_id=9001&product_id=77", {}, async (page) => {
    await openSupersede(page);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "prmSupersedeNewRouteId");
    const values = await page.evaluate(() => [...document.querySelectorAll("#prmSupersedeNewRouteId option")].map((o) => o.value));
    assert.deepEqual(values, ["", "9002"], "9001 itself, DRAFT 9003, SUPERSEDED 9004, archived 9005 and other-Product 9100 are never offered");
    assert.match(await page.textContent("#detailsModal"), /Route being superseded:.*ID 9001/);
    await page.click("[data-prm-prompt-submit]");
    assert.match(await page.textContent("#prmSupersedeNewRouteIdError"), /Select the replacement route/);
    await page.click("[data-prm-prompt-cancel]");
    await openSupersede(page);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("detailsModal")?.classList.contains("hidden"));
    assert.deepEqual(await writeCalls(page), [], "zero write calls on cancelled actions");
  });
});

test("C1 flag ON: submit sends exactly p_old_product_route_id and p_new_product_route_id, once, and reloads", async (t) => {
  await withPage(t, "?lens=product-route-editor&product_route_id=9001&product_id=77", {}, async (page) => {
    await openSupersede(page);
    await page.focus("#prmSupersedeNewRouteId");
    await page.selectOption("#prmSupersedeNewRouteId", "9002");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("detailsModal")?.classList.contains("hidden"));
    const writes = await writeCalls(page);
    assert.deepEqual(writes, [{ name: "rpc_supersede_product_route", args: { p_old_product_route_id: 9001, p_new_product_route_id: 9002 } }]);
  });
});

test("C1 flag ON: a server rejection keeps the dialog open, shows the server message unmodified and claims no success", async (t) => {
  await withPage(t, "?lens=product-route-editor&product_route_id=9001&product_id=77", { cfg: { rejectSupersede: true } }, async (page) => {
    await openSupersede(page);
    await page.selectOption("#prmSupersedeNewRouteId", "9002");
    await page.click("[data-prm-prompt-submit]");
    await page.waitForFunction(() => document.getElementById("prmSupersedeNewRouteIdError") && !document.getElementById("prmSupersedeNewRouteIdError").hidden);
    assert.equal(await page.textContent("#prmSupersedeNewRouteIdError"), "Both routes must be active approved versions of the same Product");
    assert.equal(await visible(page, "#prmSupersedeNewRouteId"), true, "dialog still open");
    assert.equal((await toasts(page)).some((x) => /superseded\./i.test(x)), false);
    assert.equal((await writeCalls(page)).length, 1);
  });
});

test("C1 mobile 390px: supersede dialog fits and is operable", async (t) => {
  await withPage(t, "?lens=product-route-editor&product_route_id=9001&product_id=77", { width: 390, height: 800 }, async (page) => {
    await openSupersede(page);
    assert.equal(await noHorizontalScroll(page), true);
    const box = await page.evaluate(() => { const r = document.querySelector("#detailsModal [data-prm-prompt-submit]").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    assert.ok(box.l >= 0 && box.r <= box.w, "submit button inside the viewport");
  });
});

test("C1 mobile 390px: the empty-editor Product picker is visible and the page does not scroll sideways", async (t) => {
  await withPage(t, "?lens=product-route-editor", { width: 390, height: 800 }, async (page) => {
    await page.waitForSelector("#prmProductEditorProduct", { state: "attached" });
    assert.equal(await page.evaluate(() => { const r = (document.querySelector(".cp-prm-editor-product-picker .cp-field-label") || document.querySelector('label[for="prmProductEditorProduct"]')).getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth; }), true);
    assert.equal(await noHorizontalScroll(page), true);
  });
});

// ---------- Historical context labels ----------
test("Fixed historical context: labelled on Workload Preview, Mapping Review and Foundation Review (flag ON), absent with flag OFF", async (t) => {
  for (const [lens, runText] of [["shared-workload-preview", /Run 82/], ["route-family-mapping-review", /Run 82/], ["route-family-foundation-review", /Run 82/]]) {
    await withPage(t, `?lens=${lens}`, {}, async (page) => {
      await page.waitForSelector("[data-prm-fixed-historical-context]", { timeout: 15000 });
      const label = await page.textContent("[data-prm-fixed-historical-context]");
      assert.match(label, /Fixed historical context/);
      assert.match(label, /not the current costing run/);
      const area = await page.evaluate(() => document.getElementById("workbenchSummary")?.textContent || "");
      assert.match(area, runText);
    });
    await withPage(t, `?lens=${lens}`, { corrections: false }, async (page) => {
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-prm-fixed-historical-context]"))), false);
    });
  }
});
