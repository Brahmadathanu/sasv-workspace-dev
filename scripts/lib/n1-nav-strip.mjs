// MDC-07 / N1: historical package tests pin shared Costing files (shell, feature flags) to the pre-N1 text so that
// flag-OFF code stays provably untouched. N1 adds flag-gated navigation code to exactly those two files. This helper
// removes precisely the N1 additions (and restores the one line N1 turned into a ternary) so those historical
// comparisons keep checking everything else. Anything not matching the exact N1 text is left in place and still fails.
import { stripCde1aShell } from "./cde1a-shell-strip.mjs";

const must = (text, from, to) => {
  const i = text.indexOf(from);
  if (i === -1) return text; // not present (e.g. an older base): nothing to strip
  const j = to === null ? i + from.length : text.indexOf(to, i);
  if (j === -1) return text;
  return text.slice(0, i) + text.slice(j + (to === null ? 0 : 0));
};

export function stripN1Shell(src) {
  let t = stripCde1aShell(src); // CDE-1a additions removed first (see cde1a-shell-strip.mjs)
  t = t.replace('import { isCostingNavGroupsV1Enabled } from "./costing-feature-flags.js";\nimport { resolveNavGroups, renderGroupedNavHtml, renderGroupedSelectHtml } from "./costing-nav-groups.js";\nimport { buildNavContextModel, costingNavContext, renderNavContextHtml } from "./costing-nav-context.js";\n', "");
  t = must(t, "/**\n * N1: grouped navigation is active only when", "function renderLensPillButton(");
  t = t.replace(/    \} else if \(isNavGroupsActive\(\)\) \{\n(?:.*\n)*?(?=    \} else \{\n      lensPills\.innerHTML = activeSuites)/, "");
  t = t.replace("lensSelect.innerHTML = isNavGroupsActive()\n        ? renderGroupedSelectHtml(getActiveNavGroups())\n        : activeSuites", "lensSelect.innerHTML = activeSuites");
  t = t.replace("  updateLensSuiteLabel();\n  refreshNavContextBar();\n}", "  updateLensSuiteLabel();\n}");
  t = t.replace("  if (active) costingPeriodSelect.value = active;\n  refreshNavContextBar();\n}", "  if (active) costingPeriodSelect.value = active;\n}");
  t = t.replace("  // N1: refresh the context chip once the existing handler has updated the active period (no-op when flag OFF).\n  setTimeout(refreshNavContextBar, 0);\n", "");
  t = t.replace("costingNavContext.subscribe(() => refreshNavContextBar());\n\n", "");
  return t;
}

export function stripN1Flags(src) {
  const i = src.indexOf("\n// MDC-07 / N1: grouped Costing navigation");
  return i === -1 ? src : src.slice(0, i);
}

export function stripN1(rel, text) {
  if (rel.endsWith("public/shared/js/costing-suite-shell.js")) return stripN1Shell(text);
  if (rel.endsWith("public/shared/js/costing-feature-flags.js")) return stripN1Flags(text);
  return text;
}
