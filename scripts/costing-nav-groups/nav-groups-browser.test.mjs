// MDC-07 / N1 browser tests (Chromium via Playwright; skipped, not failed, only when Playwright is unavailable or
// COSTING_NAV_SKIP_BROWSER=1). The real Costing pages + shell run against an inert fake backend (no Supabase, no
// network, no writes). The flag is set in the browser's localStorage only.
import test from "node:test";
import assert from "node:assert/strict";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { COSTING_NAV_GROUP_CONTRACT } from "../../public/shared/js/costing-nav-groups.js";
import { launchAudit, openAuditPage } from "../costing-responsive/responsive-audit.mjs";

const SKIP = process.env.COSTING_NAV_SKIP_BROWSER === "1";
const FLAG_ON = { COSTING_NAV_GROUPS_V1: "1" };
const CONFIGS = Object.values(COSTING_ROUTE_CONFIG);
const NON_PPM = CONFIGS.filter((c) => c.suiteId !== "pricing-policy");
const WIDTHS = [390, 520, 768, 900, 1280];
const pageOf = (c) => c.routePath.replace(/^public\//, "");

let env;
const getEnv = async (t) => {
  if (SKIP) { t.skip("COSTING_NAV_SKIP_BROWSER=1"); return null; }
  env ??= await launchAudit();
  if (!env) { t.skip("playwright not available"); return null; }
  return env;
};
test.after(async () => { await env?.close(); });

const navState = (page) => page.evaluate(() => ({
  pills: [...document.querySelectorAll("#lensPills .pill")].map((b) => b.dataset.lens),
  active: [...document.querySelectorAll("#lensPills .pill.active")].map((b) => b.dataset.lens),
  groups: [...document.querySelectorAll("#lensPills .cp-nav-group")].map((g) => ({ id: g.dataset.navGroup, label: g.querySelector(".cp-nav-group-heading")?.textContent, lenses: [...g.querySelectorAll(".pill")].map((b) => b.dataset.lens) })),
  optgroups: [...document.querySelectorAll("#lensSelect optgroup")].map((g) => ({ label: g.label, values: [...g.querySelectorAll("option")].map((o) => o.value) })),
  options: [...document.querySelectorAll("#lensSelect option")].map((o) => o.value),
  selectValue: document.getElementById("lensSelect")?.value ?? null,
  crumbs: [...document.querySelectorAll("#cpNavContext .cp-breadcrumb-item")].map((e) => e.textContent),
  chips: [...document.querySelectorAll("#cpNavContext .cp-context-chip")].map((e) => ({ key: e.dataset.contextKey, text: e.textContent.trim() })),
  hasBar: !!document.getElementById("cpNavContext"),
  suiteLabel: document.getElementById("lensSuiteLabel")?.textContent ?? null,
  suiteLabelHidden: document.getElementById("lensSuiteLabel")?.hidden ?? null,
  pillsClass: document.getElementById("lensPills")?.className ?? "",
  flat: document.querySelectorAll("#lensPills .cp-lens-suite-group").length,
}));

test("flag ON: every module page shows its groups, with every allowed lens present once (PPM stays controller-managed)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const c of NON_PPM) {
    const { page, context, errors } = await openAuditPage(e, pageOf(c), { width: 1280, storage: FLAG_ON });
    const s = await navState(page);
    const contract = COSTING_NAV_GROUP_CONTRACT[c.suiteId];
    assert.deepEqual(s.groups.map((g) => g.label), contract.map((g) => g.label), c.moduleKey);
    assert.deepEqual(s.groups.map((g) => g.lenses), contract.map((g) => g.lensIds), c.moduleKey);
    assert.deepEqual([...s.pills].sort(), [...c.allowedLensIds].sort(), `${c.moduleKey}: no destination disappears`);
    assert.equal(s.flat, 0, "flat suite group markup is not emitted");
    assert.deepEqual(s.active, [c.defaultLens], `${c.moduleKey}: default landing destination unchanged`);
    assert.equal(s.hasBar, true);
    assert.equal(s.suiteLabelHidden, true);
    assert.equal(s.crumbs.at(-1), (await page.evaluate((id) => document.querySelector(`#lensPills .pill[data-lens="${id}"]`)?.textContent, c.defaultLens)));
    assert.equal(s.crumbs[0], c.title);
    assert.deepEqual(errors, [], c.moduleKey);
    await context.close();
  }
});

test("flag ON: PPM keeps its own workspace navigation (no second navigation system), all 10 workspaces reachable", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const c = COSTING_ROUTE_CONFIG["pricing-policy-manager"];
  const { page, context, errors } = await openAuditPage(e, pageOf(c), { width: 1280, storage: FLAG_ON });
  const s = await navState(page);
  assert.equal(s.groups.length, 0);
  assert.equal(s.hasBar, false);
  assert.ok(!s.pillsClass.includes("cp-nav-groups"));
  assert.equal(await page.locator("#lensPills .cp-pricing-direct-workspace-tab").count(), 10);
  assert.deepEqual(errors, []);
  await context.close();
});

test("flag OFF: markup is the legacy flat suite group; none of the N1 classes or the context bar exist, label visible", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const c of CONFIGS) {
    for (const storage of [{}, { COSTING_NAV_GROUPS_V1: "0" }, { COSTING_NAV_GROUPS_V1: "true" }]) {
      const { page, context, errors } = await openAuditPage(e, pageOf(c), { width: 1280, storage });
      const s = await navState(page);
      assert.equal(s.hasBar, false, c.moduleKey);
      assert.equal(s.groups.length, 0);
      assert.ok(!s.pillsClass.includes("cp-nav-groups"));
      assert.notEqual(s.suiteLabelHidden, true);
      assert.ok((s.suiteLabel || "").startsWith(c.title), `${c.moduleKey}: legacy "Module → Lens" label`);
      assert.equal(s.optgroups.length, 0, "no optgroups when OFF");
      if (c.suiteId !== "pricing-policy") {
        assert.equal(s.flat, 1);
        assert.deepEqual(s.pills, c.allowedLensIds, "legacy flat order is the registry order");
        assert.deepEqual(s.options, c.allowedLensIds);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
});

test("flag ON: all 30 non-PPM lens ids stay reachable by their ?lens= deep link (and 2 PPM legacy lens ids still resolve)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  let n = 0;
  for (const c of NON_PPM) {
    for (const lens of c.allowedLensIds) {
      const { page, context, errors } = await openAuditPage(e, `${pageOf(c)}?lens=${lens}`, { width: 1280, storage: FLAG_ON });
      const s = await navState(page);
      assert.deepEqual(s.active, [lens], `${c.moduleKey} ?lens=${lens}`);
      assert.equal(s.selectValue, lens);
      assert.equal(s.crumbs.length, 3, "module > group > lens");
      assert.deepEqual(errors, [], lens);
      await context.close();
      n++;
    }
  }
  assert.equal(n, 30);
  const ppm = COSTING_ROUTE_CONFIG["pricing-policy-manager"];
  for (const q of ["?lens=mrp-governance", "?lens=policy-manager", "?workspace=scheme-rule-register", "?workspace=commercial-sales-assumptions", "?workspace=applied-proposal-history"]) {
    const { page, context, errors } = await openAuditPage(e, `${pageOf(ppm)}${q}`, { width: 1280, storage: FLAG_ON });
    const ws = q.startsWith("?workspace=") ? q.slice(11) : null;
    if (ws) assert.equal(await page.locator(`.cp-pricing-direct-workspace-tab[data-pricing-policy-workspace="${ws}"][aria-selected="true"]`).count(), 1, q);
    else assert.equal(await page.locator("#lensPills .cp-pricing-direct-workspace-tab").count(), 10, q);
    assert.deepEqual(errors, [], q);
    await context.close();
  }
});

test("flag ON and OFF resolve the same destination for every ?lens= deep link (module landing parity)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const c of NON_PPM) {
    for (const lens of [c.allowedLensIds[0], c.allowedLensIds.at(-1)]) {
      const seen = [];
      for (const storage of [{}, FLAG_ON]) {
        const { page, context } = await openAuditPage(e, `${pageOf(c)}?lens=${lens}`, { width: 1280, storage });
        const s = await navState(page);
        seen.push({ active: s.active, selectValue: s.selectValue, url: new URL(page.url()).search });
        await context.close();
      }
      assert.deepEqual(seen[1], seen[0], `${c.moduleKey} ${lens}`);
    }
  }
});

test("legacy PPM scheme-comparison URL still redirects to Cost Sheet Review with the flag ON", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const ppm = COSTING_ROUTE_CONFIG["pricing-policy-manager"];
  const { page, context } = await openAuditPage(e, `${pageOf(ppm)}?lens=scheme-comparison`, { width: 1280, storage: FLAG_ON });
  assert.match(page.url(), /cost-sheet-review\.html/);
  assert.equal((await navState(page)).active[0], "scheme-comparison");
  await context.close();
});

test("clicking grouped pills switches lens exactly like the flat pills (breadcrumb, active pill, select, URL for PRM)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const c = COSTING_ROUTE_CONFIG["production-route-manager"];
  const { page, context, errors } = await openAuditPage(e, pageOf(c), { width: 1280, storage: FLAG_ON });
  for (const group of COSTING_NAV_GROUP_CONTRACT["production-route"]) {
    for (const lens of group.lensIds) {
      const before = (await navState(page)).active[0];
      await page.locator(`#lensPills .pill[data-lens="${lens}"]`).click();
      await page.waitForTimeout(150);
      const s = await navState(page);
      assert.deepEqual(s.active, [lens]);
      assert.equal(s.selectValue, lens);
      assert.equal(s.crumbs[1], group.label);
      // Re-clicking the active lens is a no-op in the existing shell (no URL write); a real switch syncs ?lens=.
      if (lens !== before) assert.equal(new URL(page.url()).searchParams.get("lens"), lens);
      assert.equal(s.pills.length, 13);
    }
  }
  assert.deepEqual(errors, []);
  await context.close();
});

test("narrow widths use the lens select with one optgroup per group and all lens ids; choosing an option navigates", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const c = COSTING_ROUTE_CONFIG["production-route-manager"];
  const { page, context } = await openAuditPage(e, pageOf(c), { width: 390, storage: FLAG_ON });
  const s = await navState(page);
  assert.deepEqual(s.optgroups.map((g) => g.label), ["Readiness", "Assign & Map", "Build", "Review", "History"]);
  assert.deepEqual([...s.options].sort(), [...c.allowedLensIds].sort());
  assert.equal(await page.locator("#lensSelect").isVisible(), true);
  assert.equal(await page.locator("#lensPills").isVisible(), false, "pills yield to the select at <=520px (existing responsive behaviour)");
  await page.selectOption("#lensSelect", "archived-routes");
  await page.waitForTimeout(200);
  const after = await navState(page);
  assert.deepEqual(after.active, ["archived-routes"]);
  assert.deepEqual(after.crumbs, [c.title, "History", "Archived Routes"]);
  await context.close();
});

test("responsive: six pages x 390/520/768/900/1280 with the flag ON have no page-level horizontal overflow and no page errors", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const bad = [];
  for (const c of CONFIGS) {
    for (const width of WIDTHS) {
      const { page, context, errors } = await openAuditPage(e, pageOf(c), { width, storage: FLAG_ON });
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const pills = document.getElementById("lensPills");
        const r = pills?.getBoundingClientRect();
        const bar = document.getElementById("cpNavContext")?.getBoundingClientRect();
        return { overflow: de.scrollWidth > de.clientWidth + 1, vw: de.clientWidth, pillsRight: r ? r.right : 0, pillsVisible: !!pills && getComputedStyle(pills).display !== "none", barRight: bar ? bar.right : 0 };
      });
      if (m.overflow) bad.push(`${c.moduleKey}@${width}: page overflow`);
      if (m.pillsVisible && m.pillsRight > m.vw + 1) bad.push(`${c.moduleKey}@${width}: pill strip wider than viewport`);
      if (m.barRight > m.vw + 1) bad.push(`${c.moduleKey}@${width}: context bar wider than viewport`);
      if (errors.length) bad.push(`${c.moduleKey}@${width}: ${errors.join("|")}`);
      await context.close();
    }
  }
  assert.deepEqual(bad, []);
});

test("responsive: the Production Route strip (5 groups, 13 pills) scrolls horizontally inside its own container at 768/900 px", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const c = COSTING_ROUTE_CONFIG["production-route-manager"];
  for (const width of [768, 900]) {
    const { page, context } = await openAuditPage(e, pageOf(c), { width, storage: FLAG_ON });
    const m = await page.evaluate(() => {
      const p = document.getElementById("lensPills");
      const de = document.documentElement;
      const overflowX = getComputedStyle(p).overflowX;
      const scrollable = p.scrollWidth > p.clientWidth;
      p.scrollLeft = p.scrollWidth;
      const last = document.querySelector('#lensPills .pill[data-lens="archived-routes"]').getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      return { overflowX, scrollable, pageOverflow: de.scrollWidth > de.clientWidth + 1, lastVisible: last.right <= pr.right + 1 && last.left >= pr.left - 1, moved: p.scrollLeft > 0 || !scrollable };
    });
    assert.equal(m.overflowX, "auto");
    assert.equal(m.pageOverflow, false, `@${width}`);
    assert.equal(m.lastVisible, true, `@${width}: last group reachable by scrolling`);
    assert.equal(m.moved, true);
    await context.close();
  }
});

test("accessibility: groups are labelled role=group, the active pill has aria-current, keyboard Tab/Enter navigates, focus ring is visible", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const c = COSTING_ROUTE_CONFIG["production-route-manager"];
  const { page, context, errors } = await openAuditPage(e, pageOf(c), { width: 1280, storage: FLAG_ON });
  const names = await page.evaluate(() => [...document.querySelectorAll("#lensPills [role=group]")].map((g) => document.getElementById(g.getAttribute("aria-labelledby"))?.textContent));
  assert.deepEqual(names, ["Readiness", "Assign & Map", "Build", "Review", "History"]);
  assert.equal(await page.locator('#lensPills .pill[aria-current="page"]').count(), 1);
  assert.equal(await page.locator('nav[aria-label="Breadcrumb"] [aria-current="page"]').count(), 1);
  await page.locator('#lensPills .pill[data-lens="route-readiness"]').focus();
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { lens: a.dataset.lens, outline: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }; });
  assert.equal(focus.lens, "product-route-assignments", "Tab moves to the next pill in DOM order");
  assert.notEqual(focus.outline, "none");
  assert.ok(focus.width >= 2);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.deepEqual((await navState(page)).active, ["product-route-assignments"]);
  assert.deepEqual(errors, []);
  await context.close();
});

test("context chips: nothing invented; supplied values appear; fixed historical evidence is never presented as current", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const c = COSTING_ROUTE_CONFIG["production-route-manager"];
  const { page, context } = await openAuditPage(e, `${pageOf(c)}?lens=shared-workload-preview`, { width: 1280, storage: FLAG_ON });
  let s = await navState(page);
  assert.deepEqual(s.chips.map((x) => x.key), ["basis"], "no product/family/route/run chip without a supplied value");
  assert.match(s.chips[0].text, /Fixed historical context/);
  assert.match(s.chips[0].text, /not the current costing run/);
  assert.ok(!/\b(80|82)\b/.test(s.chips[0].text), "N1 embeds no fixed run value");
  await page.evaluate(async () => {
    const m = await import("/shared/js/costing-nav-context.js");
    m.costingNavContext.set({ product: "Triphala Churnam", family: "Churnam family", run: "80" });
  });
  s = await navState(page);
  assert.deepEqual(s.chips.map((x) => x.key), ["product", "family", "run", "basis"]);
  assert.match(s.chips.find((x) => x.key === "run").text, /^Run \(fixed historical\)\s+80$/);
  await page.evaluate(async () => { (await import("/shared/js/costing-nav-context.js")).costingNavContext.clear(); });
  assert.deepEqual((await navState(page)).chips.map((x) => x.key), ["basis"]);
  await context.close();

  const ccc = COSTING_ROUTE_CONFIG["costing-control-center"];
  const live = await openAuditPage(e, `${pageOf(ccc)}?lens=portfolio-readiness`, { width: 1280, storage: FLAG_ON });
  s = await navState(live.page);
  assert.match(s.chips.find((x) => x.key === "basis").text, /^LIVE_AS_OF/);
  assert.deepEqual(s.crumbs, ["Costing Control Center", "SKU Review", "Readiness"]);
  await live.context.close();
  const run = await openAuditPage(e, `${pageOf(ccc)}?lens=sku-control-status`, { width: 1280, storage: FLAG_ON });
  s = await navState(run.page);
  assert.match(s.chips.find((x) => x.key === "basis").text, /^Run-scoped/);
  await run.context.close();
  const plain = await openAuditPage(e, `${pageOf(COSTING_ROUTE_CONFIG["material-cost-manager"])}`, { width: 1280, storage: FLAG_ON });
  s = await navState(plain.page);
  assert.ok(!s.chips.some((x) => x.key === "basis"), "a lens with no declared basis shows no basis chip");
  await plain.context.close();
});
