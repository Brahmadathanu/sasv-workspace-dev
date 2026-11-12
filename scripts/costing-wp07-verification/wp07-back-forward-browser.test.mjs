// MDC-07 / WP07 closure verification (12 Nov 2026): browser Back/Forward across `?lens=` deep-link loads on the five shell-driven Costing
// modules, flag ON versus flag OFF, at a wide (grouped pills) and a narrow (grouped <select>) viewport. Existing N1/N4/W6 browser tests cover
// deep links, overflow and keyboard; Back/Forward was only covered for the PPM workspaces.
// Finding recorded by this test: the shell does NOT push a history entry for in-page pill/select switches (only PRM replaces the URL's lens);
// that is pre-existing flag-OFF behaviour and is unchanged by N1, so Back/Forward is exercised across separate page loads, as W6 does.
// Mock backend (the same inert harness as the N1 tests): no Supabase, no network, no writes. Skipped only without Playwright or with
// COSTING_NAV_SKIP_BROWSER=1.
import test from "node:test";
import assert from "node:assert/strict";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { launchAudit, openAuditPage } from "../costing-responsive/responsive-audit.mjs";

const SKIP = process.env.COSTING_NAV_SKIP_BROWSER === "1";
const FLAG_ON = { COSTING_NAV_GROUPS_V1: "1" };
const NON_PPM = Object.values(COSTING_ROUTE_CONFIG).filter((c) => c.suiteId !== "pricing-policy");
const pageOf = (c) => c.routePath.replace(/^public\//, "");

let env;
const getEnv = async (t) => {
  if (SKIP) { t.skip("COSTING_NAV_SKIP_BROWSER=1"); return null; }
  env ??= await launchAudit();
  if (!env) { t.skip("playwright not available"); return null; }
  return env;
};
test.after(async () => { await env?.close(); });

const settle = (page) => page.waitForTimeout(500);
const state = (page) => page.evaluate(() => {
  const sel = document.getElementById("lensSelect");
  const narrow = !!sel && sel.getClientRects().length > 0;
  const pill = document.querySelector("#lensPills .pill.active");
  const crumb = document.querySelector('#cpNavContext [aria-current="page"]');
  return {
    shown: narrow ? sel.value : pill?.dataset.lens ?? null,
    activePills: document.querySelectorAll("#lensPills .pill.active").length,
    urlLens: new URLSearchParams(location.search).get("lens"),
    crumb: crumb ? crumb.textContent.trim() : null,
    label: narrow ? sel.selectedOptions[0]?.textContent.trim() : pill?.textContent.trim(),
  };
});

// Two non-default destinations from different positions in the module's lens order.
const targets = (c) => {
  const ids = c.allowedLensIds.filter((id) => id !== c.defaultLens);
  return [ids[0], ids[ids.length - 1]];
};

const runs = {};
for (const [label, storage] of [["OFF", {}], ["ON", FLAG_ON]]) {
  for (const width of [1280, 390]) {
    test(`Back/Forward across lens deep-link loads follows the URL on all five modules, flag ${label}, ${width}px, no page errors`, async (t) => {
      const e = await getEnv(t); if (!e) return;
      for (const c of NON_PPM) {
        const [a, b] = targets(c);
        assert.notEqual(a, b, c.moduleKey);
        const base = pageOf(c);
        const { page, context, errors } = await openAuditPage(e, `${base}?lens=${a}`, { width, storage });
        await page.waitForSelector("#lensPills .pill.active", { state: "attached" }); await settle(page);
        const seq = [];
        const snap = async () => { await settle(page); const s = await state(page); seq.push(s.shown); return s; };
        const s0 = await snap();
        assert.equal(s0.activePills, 1, `${c.moduleKey}: exactly one active destination`);
        await page.goto(`${page.url().replace(/\?.*$/, "")}?lens=${b}`, { waitUntil: "load" });
        await page.waitForSelector("#lensPills .pill.active", { state: "attached" });
        const s1 = await snap();
        await page.goBack({ waitUntil: "load" });
        await page.waitForSelector("#lensPills .pill.active", { state: "attached" });
        const s2 = await snap();
        await page.goForward({ waitUntil: "load" });
        await page.waitForSelector("#lensPills .pill.active", { state: "attached" });
        const s3 = await snap();
        assert.deepEqual(seq, [a, b, a, b], `${c.moduleKey} ${label} ${width}`);
        assert.deepEqual([s1.urlLens, s2.urlLens, s3.urlLens], [b, a, b], `${c.moduleKey}: URL and active destination agree`);
        for (const s of [s0, s1, s2, s3]) assert.equal(s.activePills, 1, `${c.moduleKey}: single active destination after navigation`);
        if (label === "ON") for (const s of [s0, s1, s2, s3]) assert.equal(s.crumb, s.label, `${c.moduleKey}: breadcrumb equals the active destination label`);
        assert.deepEqual(errors, [], c.moduleKey);
        (runs[`${label}${width}`] ??= {})[c.moduleKey] = seq;
        await context.close();
      }
    });
  }
}

test("Back/Forward destinations are identical with the flag ON and OFF at both viewports", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const width of [1280, 390]) {
    assert.ok(runs[`OFF${width}`] && runs[`ON${width}`], `needs the ${width}px OFF and ON runs above`);
    assert.deepEqual(runs[`ON${width}`], runs[`OFF${width}`]);
  }
});
