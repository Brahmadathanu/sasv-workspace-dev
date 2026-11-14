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

// Post-W6 sanctioned PPM controller changes (WP05, owner-accepted, merged after W6): #263/cf41740 Scheme Master 31-column list projection
// and #306/254a2d8 Scheme History actor display. The historical pin tests compare the controller with a pre-W6 base, so they apply this
// helper first (then stripW6). It reverses exactly those two edits and nothing else; any other edit survives and still fails the pin.
const SCHEME_LIST_SELECT_BLOCK = "  const SCHEME_MASTER_LIST_SELECT = [\n    \"scheme_id\",\n    \"scheme_name\",\n    \"paid_qty\",\n    \"free_qty\",\n    \"total_qty\",\n    \"free_per_paid_ratio\",\n    \"effective_free_discount_percent\",\n    \"is_active\",\n    \"is_system_defined\",\n    \"remarks\",\n    \"approval_reference\",\n    \"direct_policy_count\",\n    \"active_direct_policy_count\",\n    \"hierarchy_rule_count\",\n    \"active_hierarchy_rule_count\",\n    \"replacement_reference_count\",\n    \"active_replacement_reference_count\",\n    \"can_edit_metadata\",\n    \"can_deactivate\",\n    \"can_reactivate\",\n    \"created_at\",\n    \"created_by\",\n    \"updated_at\",\n    \"updated_by\",\n    \"metadata_update_reason\",\n    \"deactivated_at\",\n    \"deactivated_by\",\n    \"deactivation_reason\",\n    \"reactivated_at\",\n    \"reactivated_by\",\n    \"reactivation_reason\",\n  ].join(\",\");\n\n";
const SCHEME_LIST_SELECT_USE = "            // Scheme Master list/detail never consumes the expensive viability snapshot\n            // aggregates; fetching them via * causes recurrent desktop 57014 timeouts.\n            // Keep the view itself and all permitted business/detail fields unchanged.\n            .select(SCHEME_MASTER_LIST_SELECT)\n";
const ACTOR_IMPORT = 'import { formatSchemeMasterAuditActor } from "./costing-suite-scheme-audit-actor.mjs";\n';
const ACTOR_USE = "text(formatSchemeMasterAuditActor(auditRow))";
const ACTOR_PREVIOUS = "text(auditRow.actor || auditRow.event_actor || auditRow.created_by)";

export function stripPostW6ApprovedPricingPolicy(src) {
  let t = src.replace(/\r\n/g, "\n");
  t = once(t, SCHEME_LIST_SELECT_BLOCK, "");
  t = once(t, SCHEME_LIST_SELECT_USE, '            .select("*")\n');
  t = once(t, ACTOR_IMPORT, "");
  t = once(t, ACTOR_USE, ACTOR_PREVIOUS);
  return t;
}

export function stripPostW6Approved(rel, text) {
  return rel.endsWith("public/shared/js/costing-suite-pricing-policy.js") ? stripPostW6ApprovedPricingPolicy(text) : text;
}
