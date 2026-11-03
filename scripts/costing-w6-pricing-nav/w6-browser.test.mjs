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
