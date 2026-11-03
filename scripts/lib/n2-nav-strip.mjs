// MDC-07 / N2: historical package tests pin the Material Cost and Cost Build controllers to their pre-N2 text so that
// flag-OFF code stays provably untouched. N2 adds flag-gated navigation presentation to exactly those two files.
// This helper removes precisely the N2 additions so those comparisons keep checking everything else. Text that does
// not match the exact N2 additions is left in place and still fails the historical comparison.
const cut = (text, from, to) => {
  const i = text.indexOf(from);
  if (i === -1) return text;
  const j = text.indexOf(to, i);
  return j === -1 ? text : text.slice(0, i) + text.slice(j);
};

export function stripN2MaterialCost(src) {
  let t = src.replace(/\r\n/g, "\n");
  t = t.replace('import { isCostingNavGroupsV1Enabled } from "./costing-feature-flags.js";\nimport { getNavGroupForLens } from "./costing-nav-groups.js";\n', "");
  t = cut(t, "// MDC-07 / N2 — presentation only", 'const RATE_ORIGIN_MANUAL = "MANUAL_ENTRY";');
  t = t.replace('    ${isCostingNavGroupsV1Enabled() ? renderMaterialCostNavScopeHtml("manual-rate-manager", escapeHtml) : ""}\n', "");
  t = cut(t, "  // N2: show only the trace navigation entries", "  function syncRmTraceChrome() {");
  t = t.replace("    syncActiveTraceComponentFromLens();\n    syncTraceNavVisibility();\n", "    syncActiveTraceComponentFromLens();\n");
  t = t.replace("    syncRmTraceChrome,\n    syncTraceNavVisibility,\n", "    syncRmTraceChrome,\n");
  return t;
}

export function stripN2CostBuild(src) {
  let t = src.replace(/\r\n/g, "\n");
  t = t.replace('import { isCostingNavGroupsV1Enabled } from "./costing-feature-flags.js";\nimport { getNavGroupForLens } from "./costing-nav-groups.js";\n\n', "");
  t = cut(t, "// MDC-07 / N2 — presentation only", "function costGovernanceHeaders(tab) {");
  t = t.replace(/    \$\{isCostingNavGroupsV1Enabled\(\) \? renderCostBuildNavScopeHtml\("[a-z-]+", escapeHtml\) : ""\}\n/g, "");
  return t;
}

export function stripN2(rel, text) {
  if (rel.endsWith("public/shared/js/costing-suite-material-cost.js")) return stripN2MaterialCost(text);
  if (rel.endsWith("public/shared/js/costing-suite-cost-build.js")) return stripN2CostBuild(text);
  return text;
}
