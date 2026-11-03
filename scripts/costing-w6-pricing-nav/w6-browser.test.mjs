// WP06 W6: actual shell-rendered PPM desktop/narrow grouping and legacy deep links (inert backend).
import test from "node:test";
import assert from "node:assert/strict";
import { launchAudit, openAuditPage } from "../costing-responsive/responsive-audit.mjs";
import { COSTING_PPM_NAV_GROUP_CONTRACT } from "../../public/shared/js/costing-nav-groups.js";

let env;
async function getEnv(t) {
  env ??= await launchAudit();
  if (!env) { t.skip("Playwright/Chromium not available"); return null; }
  return env;
}
test.after(async () => { await env?.close(); });
const pagePath = "shared/pricing-policy-manager.html";
const observe = (page) => page.evaluate(() => ({
  tabs: [...document.querySelectorAll("#lensPills [data-pricing-policy-workspace]")].map(x => x.dataset.pricingPolicyWorkspace),
  separators: document.querySelectorAll("#lensPills .cp-pricing-workspace-group-sep").length,
  options: [...document.querySelectorAll("#pricingPolicyWorkspaceSelect option")].map(x=>x.value),
  groups: [...document.querySelectorAll("#pricingPolicyWorkspaceSelect optgroup")].map(x=>({label:x.label,ids:[...x.querySelectorAll("option")].map(y=>y.value)})),
  active: [...document.querySelectorAll("#lensPills [data-pricing-policy-workspace].active")].map(x=>x.dataset.pricingPolicyWorkspace),
  heading: document.getElementById("lensSuiteLabel")?.textContent || "",
}));
const onFlag = { COSTING_NAV_GROUPS_V1: "1" };
const ids = [
  "sku-overview","sku-mrp-policies","product-derivation-policies","mrp-proposals","proposal-decisions",
  "approved-for-application","applied-proposal-history","scheme-master","scheme-rule-register","commercial-sales-assumptions",
];

test("W6 OFF: desktop and narrow shell preserve legacy groups, order and links", async t => {
  const env0=await getEnv(t); if(!env0)return;
  for(const width of [390,1280]) {
    const {page,context,errors}=await openAuditPage(env0,pagePath,{width,storage:{}});
    const value=await observe(page);
    assert.equal(value.tabs.length,10);
    assert.equal(value.separators,2);
    assert.deepEqual(value.groups.map(x=>x.label),["MRP Policy Setup","MRP Change Workflow","Selling & Schemes"]);
    assert.deepEqual(value.options,value.tabs);
    assert.deepEqual(value.active,["sku-overview"]);
    assert.deepEqual(errors,[]);
    await context.close();
  }
});

test("W6 ON: five N1 groups and all ten workspaces render in both shell navigation surfaces",async t=>{
  const env0=await getEnv(t); if(!env0)return;
  for(const width of [390,1280]) {
    const {page,context,errors}=await openAuditPage(env0,pagePath,{width,storage:onFlag});
    const value=await observe(page);
    assert.deepEqual(value.tabs,ids);
    assert.equal(value.separators,4);
    assert.deepEqual(value.options,ids);
    assert.deepEqual(value.groups,COSTING_PPM_NAV_GROUP_CONTRACT.groups.map(g=>({label:g.label,ids:g.workspaceIds})));
    assert.deepEqual(value.active,["sku-overview"]);
    assert.ok(value.heading.includes("SKU policies"));
    assert.deepEqual(errors,[]);
    await context.close();
  }
});

test("W6 ON: direct workspace and legacy lens deep links preserve identity",async t=>{
  const env0=await getEnv(t); if(!env0)return;
  for(const [query,expected] of [
    ["?workspace=scheme-rule-register","scheme-rule-register"],
    ["?workspace=commercial-sales-assumptions","commercial-sales-assumptions"],
    ["?lens=mrp-governance","sku-mrp-policies"],
    ["?lens=policy-manager","sku-overview"],
  ]) {
    const {page,context,errors}=await openAuditPage(env0,pagePath+query,{width:1280,storage:onFlag});
    const value=await observe(page);
    assert.deepEqual(value.active,[expected],query);
    assert.deepEqual(errors,[],query);
    await context.close();
  }
});

// ---------------- additional W6 acceptance (ON vs OFF parity, journeys, console hygiene) ----------------
const offFlag = {};
const snapshot = (page) => page.evaluate(() => {
  const visible = (s) => { const e = document.querySelector(s); if (!e) return "absent"; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? "visible" : "hidden"; };
  return {
    active: [...document.querySelectorAll("#lensPills [data-pricing-policy-workspace].active")].map((x) => x.dataset.pricingPolicyWorkspace),
    select: document.getElementById("pricingPolicyWorkspaceSelect")?.value ?? null,
    search: location.search,
    period: visible("#costingPeriodSelect"),
    title: document.title,
  };
});
const settle = (page, ms = 500) => page.waitForTimeout(ms);

/** Collects console errors/warnings emitted during page load (the shell only watches pageerror). */
function withConsoleCapture(env0) {
  const messages = [];
  return {
    messages,
    env: {
      ...env0,
      browser: {
        newContext: async (opts) => {
          const context = await env0.browser.newContext(opts);
          context.on("console", (m) => { if (["error", "warning"].includes(m.type())) messages.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
          return context;
        },
      },
    },
  };
}

test("W6 ON and OFF: no console errors or warnings (e.g. nav-metadata validation) while loading every workspace", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const [name, storage] of [["OFF", offFlag], ["ON", onFlag]]) {
    const cap = withConsoleCapture(e);
    for (const id of ids) {
      const { context, errors } = await openAuditPage(cap.env, `${pagePath}?workspace=${id}`, { width: 1280, storage });
      assert.deepEqual(errors, [], `${name} ${id}`);
      await context.close();
    }
    const ours = cap.messages.filter((m) => /pricing-policy|nav metadata|W6|navigation/i.test(m));
    assert.deepEqual(ours, [], `${name}: ${ours.join(" | ")}`);
  }
});

test("W6: every workspace deep link resolves to the same workspace, URL, select value and period control ON and OFF", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const id of ids) {
    const seen = [];
    for (const storage of [offFlag, onFlag]) {
      const { context, page, errors } = await openAuditPage(e, `${pagePath}?workspace=${id}`, { width: 1280, storage });
      seen.push(await snapshot(page));
      assert.deepEqual(errors, [], id);
      await context.close();
    }
    assert.deepEqual(seen[1], seen[0], id);
    assert.deepEqual(seen[1].active, [id]);
  }
});

test("W6: legacy ?lens= / mrp_tab / policy_tab / Area URLs and an unknown workspace land identically ON and OFF", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const queries = [
    "", "?lens=mrp-governance", "?lens=mrp-governance&mrp_tab=mrp-proposals", "?lens=mrp-governance&mrp_tab=applied-proposal-history",
    "?lens=policy-manager", "?lens=policy-manager&policy_tab=scheme-master", "?lens=policy-manager&policy_tab=commercial-sales-assumptions",
    "?lens=mrp-policies", "?lens=mrp-workflow", "?lens=selling-schemes", "?workspace=does-not-exist", "?lens=unknown-lens",
  ];
  for (const q of queries) {
    const seen = [];
    for (const storage of [offFlag, onFlag]) {
      const { context, page, errors } = await openAuditPage(e, `${pagePath}${q}`, { width: 1280, storage });
      seen.push(await snapshot(page));
      assert.deepEqual(errors, [], q);
      await context.close();
    }
    assert.deepEqual(seen[1], seen[0], q || "(no query)");
    assert.equal(seen[1].active.length, 1, q);
  }
});

test("W6: click-through of all ten workspaces behaves identically ON and OFF (replaceState: no history entries added); ON follows the five-group order", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const runs = {};
  for (const [name, storage] of [["OFF", offFlag], ["ON", onFlag]]) {
    const { context, page, errors } = await openAuditPage(e, pagePath, { width: 1280, storage });
    const order = await page.evaluate(() => [...document.querySelectorAll("#lensPills [data-pricing-policy-workspace]")].map((x) => x.dataset.pricingPolicyWorkspace));
    const historyBefore = await page.evaluate(() => history.length);
    const clicks = [];
    for (const id of order) {
      await page.click(`#lensPills [data-pricing-policy-workspace="${id}"]`);
      await settle(page, 350);
      clicks.push({ id, ...(await snapshot(page)), heading: await page.evaluate(() => document.getElementById("lensSuiteLabel")?.textContent || "") });
    }
    const historyAfter = await page.evaluate(() => history.length);
    assert.deepEqual(errors, [], name);
    runs[name] = { order, clicks, historyBefore, historyAfter };
    await context.close();
  }
  assert.deepEqual(runs.ON.order, ids);
  for (const run of Object.values(runs)) for (const c of run.clicks) { assert.deepEqual(c.active, [c.id]); assert.equal(c.select, c.id); assert.ok(c.search.includes(`workspace=${c.id}`)); }
  assert.deepEqual(runs.ON.clicks.map((c) => c.id).sort(), runs.OFF.clicks.map((c) => c.id).sort());
  const byId = (rows) => Object.fromEntries(rows.map((c) => [c.id, { search: c.search, period: c.period }]));
  assert.deepEqual(byId(runs.ON.clicks), byId(runs.OFF.clicks));
  // Workspace switching never adds history entries in either mode (existing behaviour preserved).
  assert.equal(runs.ON.historyAfter, runs.ON.historyBefore);
  assert.equal(runs.OFF.historyAfter, runs.OFF.historyBefore);
  // ON heading names the correct approved group for every workspace.
  const groupOf = Object.fromEntries(COSTING_PPM_NAV_GROUP_CONTRACT.groups.flatMap((g) => g.workspaceIds.map((id) => [id, g.label])));
  for (const c of runs.ON.clicks) assert.ok(c.heading.includes(groupOf[c.id]), `${c.id}: ${c.heading}`);
});

test("W6: browser back/forward across separate workspace page loads lands on the same workspaces ON and OFF", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const runs = {};
  for (const [name, storage] of [["OFF", offFlag], ["ON", onFlag]]) {
    const { context, page, errors } = await openAuditPage(e, `${pagePath}?workspace=mrp-proposals`, { width: 1280, storage });
    const seq = [];
    await page.goto(`${page.url().replace(/\?.*$/, "")}?workspace=scheme-master`, { waitUntil: "load" });
    await settle(page, 900); seq.push((await snapshot(page)).active[0]);
    await page.goBack({ waitUntil: "load" }); await settle(page, 900); seq.push((await snapshot(page)).active[0]);
    await page.goForward({ waitUntil: "load" }); await settle(page, 900); seq.push((await snapshot(page)).active[0]);
    assert.deepEqual(errors, [], name);
    runs[name] = seq;
    await context.close();
  }
  assert.deepEqual(runs.OFF, ["scheme-master", "mrp-proposals", "scheme-master"]);
  assert.deepEqual(runs.ON, runs.OFF);
});

test("W6 ON narrow screen: the dropdown has five optgroups in contract order and selecting each option switches workspace (URL and active tab follow)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await openAuditPage(e, pagePath, { width: 390, storage: onFlag });
  const groups = await page.evaluate(() => [...document.querySelectorAll("#pricingPolicyWorkspaceSelect optgroup")].map((g) => ({ label: g.label, ids: [...g.querySelectorAll("option")].map((o) => o.value) })));
  assert.deepEqual(groups, COSTING_PPM_NAV_GROUP_CONTRACT.groups.map((g) => ({ label: g.label, ids: g.workspaceIds })));
  assert.equal(groups.length, 5);
  for (const id of [...ids].reverse()) {
    await page.selectOption("#pricingPolicyWorkspaceSelect", id);
    await settle(page, 400);
    const s = await snapshot(page);
    assert.equal(s.select, id);
    assert.ok(s.search.includes(`workspace=${id}`), `${id} -> ${s.search}`);
  }
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "no horizontal page scroll at 390px");
  await context.close();
});

test("W6 desktop strip: group sizes between separators are 1/2/4/2/1 with the flag ON and 2/4/4 with it OFF", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const [storage, sizes] of [[onFlag, [1, 2, 4, 2, 1]], [offFlag, [2, 4, 4]]]) {
    const { context, page, errors } = await openAuditPage(e, pagePath, { width: 1280, storage });
    const observed = await page.evaluate(() => {
      const out = [0];
      for (const child of document.querySelectorAll("#lensPills .cp-pricing-workspace-group-sep, #lensPills [data-pricing-policy-workspace]")) {
        if (child.classList.contains("cp-pricing-workspace-group-sep")) out.push(0);
        else if (child.hasAttribute("data-pricing-policy-workspace")) out[out.length - 1] += 1;
      }
      return out;
    });
    assert.deepEqual(observed, sizes);
    assert.deepEqual(errors, []);
    await context.close();
  }
});
