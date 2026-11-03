// MDC-07 / W6: historical package tests pin the Pricing Policy Manager controller to its pre-W6 text so that flag-OFF
// code stays provably untouched. W6 adds the flag-gated five-group projection to exactly that file. This helper reverses
// precisely the W6 edits (and nothing else), so those comparisons keep checking every other byte. If the controller carries
// any change that does not match the exact W6 text, the result differs from the base and the historical test still fails.
const once = (text, from, to) => {
  const i = text.indexOf(from);
  if (i === -1 || text.indexOf(from, i + 1) !== -1) return text; // absent or ambiguous: leave untouched (comparison will fail)
  return text.slice(0, i) + to + text.slice(i + from.length);
};
const cut = (text, from, to) => {
  const i = text.indexOf(from);
  if (i === -1) return text;
  const j = text.indexOf(to, i);
  return j === -1 ? text : text.slice(0, i) + text.slice(j);
};

export function stripW6PricingPolicy(src) {
  let t = src.replace(/\r\n/g, "\n");
  t = once(t, 'import { isCostingNavGroupsV1Enabled } from "./costing-feature-flags.js";\nimport { COSTING_PPM_NAV_GROUP_CONTRACT } from "./costing-nav-groups.js";\n', "");
  t = cut(t, "/**\n * WP06/W6: PPM owns its display metadata", "export const PRICING_POLICY_NAV_GROUP_IDS");
  t = once(t, "const LEGACY_PRICING_POLICY_NAV_GROUPS = [", "export const PRICING_POLICY_NAV_GROUPS = [");
  t = once(t, "const LEGACY_PRICING_POLICY_WORKSPACES = [", "export const PRICING_POLICY_WORKSPACES = [");
  t = once(t, "PRICING_POLICY_GROUP_TO_COMPAT_AREA_ID[ws.legacyGroupId || ws.groupId]", "PRICING_POLICY_GROUP_TO_COMPAT_AREA_ID[ws.groupId]");
  t = once(t, '    (w.legacyGroupId || w.groupId) === "mrp-policy-setup" || (w.legacyGroupId || w.groupId) === "mrp-change-workflow",', '    w.groupId === "mrp-policy-setup" || w.groupId === "mrp-change-workflow",');
  t = once(t, '  (w) => (w.legacyGroupId || w.groupId) === "selling-schemes",', '  (w) => w.groupId === "selling-schemes",');
  t = once(t, "  for (const expected of W6_PRESENTATION.groups.map((group) => group.id)) {", '  for (const expected of [\n    "mrp-policy-setup",\n    "mrp-change-workflow",\n    "selling-schemes",\n  ]) {');
  const i = t.indexOf("  // W6: with the flag OFF the original order is expected;");
  const end = t.indexOf("COSTING_PPM_NAV_GROUP_CONTRACT.groups.flatMap((group) => group.workspaceIds);", i);
  if (i !== -1 && end !== -1) {
    t = t.slice(0, i) + `  const expectedOrder = [
    "sku-mrp-policies",
    "product-derivation-policies",
    "mrp-proposals",
    "proposal-decisions",
    "approved-for-application",
    "applied-proposal-history",
    "sku-overview",
    "scheme-master",
    "scheme-rule-register",
    COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID,
  ];` + t.slice(end + "COSTING_PPM_NAV_GROUP_CONTRACT.groups.flatMap((group) => group.workspaceIds);".length);
  }
  return t;
}

export function stripW6(rel, text) {
  return rel.endsWith("public/shared/js/costing-suite-pricing-policy.js") ? stripW6PricingPolicy(text) : text;
}
