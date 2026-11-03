// WP06 W6: approved five-group presentation, legacy OFF compatibility, and business metadata parity.
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePricingPolicyW6Presentation,
  PRICING_POLICY_WORKSPACE_IDS,
  PRICING_POLICY_DEFAULT_WORKSPACE,
  PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE,
} from "../../public/shared/js/costing-suite-pricing-policy.js";
import { COSTING_PPM_NAV_GROUP_CONTRACT } from "../../public/shared/js/costing-nav-groups.js";

const oldIds = ["sku-mrp-policies", "product-derivation-policies", "mrp-proposals", "proposal-decisions", "approved-for-application", "applied-proposal-history", "sku-overview", "scheme-master", "scheme-rule-register", "commercial-sales-assumptions"];
const expectedGroups = ["sku-policies", "mrp", "mrp-change-workflow", "schemes", "costing-inputs"];

test("W6 OFF preserves the complete legacy three-group workspace strip, order and identities", () => {
  const off = resolvePricingPolicyW6Presentation(false);
  assert.deepEqual(off.groups.map(x => x.id), ["mrp-policy-setup", "mrp-change-workflow", "selling-schemes"]);
  assert.deepEqual(off.workspaces.map(x => x.id), oldIds);
  assert.ok(off.workspaces.every(x => !Object.hasOwn(x, "legacyGroupId")));
  assert.equal(PRICING_POLICY_DEFAULT_WORKSPACE, "sku-overview");
  assert.deepEqual(PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE, {
    "mrp-policies": "sku-mrp-policies",
    "mrp-workflow": "mrp-proposals",
    "selling-schemes": "sku-overview",
  });
  assert.deepEqual([...PRICING_POLICY_WORKSPACE_IDS].sort(), [...oldIds].sort());
});

test("W6 ON exactly consumes the five N1 groups and presents all ten workspaces once", () => {
  const on = resolvePricingPolicyW6Presentation(true);
  assert.deepEqual(on.groups.map(x => x.id), expectedGroups);
  assert.deepEqual(on.groups.map(x => x.label), COSTING_PPM_NAV_GROUP_CONTRACT.groups.map(x => x.label));
  const byGroup = Object.groupBy(on.workspaces, x => x.groupId);
  for (const group of COSTING_PPM_NAV_GROUP_CONTRACT.groups) {
    assert.deepEqual(byGroup[group.id].map(x => x.id), group.workspaceIds);
  }
  assert.deepEqual([...new Set(on.workspaces.map(x => x.id))].sort(), [...oldIds].sort());
});

test("W6 ON changes only display group/order, preserving all metadata and legacy identities", () => {
  const off = resolvePricingPolicyW6Presentation(false);
  const on = resolvePricingPolicyW6Presentation(true);
  const old = new Map(off.workspaces.map(x => [x.id,x]));
  for (const entry of on.workspaces) {
    const original = old.get(entry.id);
    assert.ok(original);
    assert.equal(entry.legacyGroupId, original.groupId);
    const {groupId,legacyGroupId,...rest} = entry;
    const {groupId:ignored,...originalRest} = original;
    assert.deepEqual(rest, originalRest);
  }
  assert.equal(on.workspaces.find(x=>x.id==="commercial-sales-assumptions").supportsPeriod,true);
  assert.deepEqual(on.workspaces.filter(x=>x.supportsPeriod).map(x=>x.id), ["commercial-sales-assumptions"]);
});

test("W6 flag input is boolean strict; non-true retains OFF metadata", () => {
  assert.deepEqual(resolvePricingPolicyW6Presentation("1").groups, resolvePricingPolicyW6Presentation(false).groups);
  assert.deepEqual(resolvePricingPolicyW6Presentation(null).workspaces, resolvePricingPolicyW6Presentation(false).workspaces);
});
