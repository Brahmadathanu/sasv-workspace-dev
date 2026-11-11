// #273: exact [head text, original text] pairs for the flag-gated scoped Cost Comparison read in costing-suite-shell.js.
// Frozen-diff regression tests (costing-table-tools, costing-nav-groups, costing-responsive, ... via unpersonnel.mjs) restore the
// original text once before comparing with historical bases, so they keep proving that NOTHING ELSE in the shell changed.
const READ_ANCHOR = '    let query = costingFrom(viewName).select("*");\n    if (CURRENT_LENS === "dashboard") {';
const GATED_BLOCK = `    // #273: flag-gated scoped read (default OFF). Flag OFF falls through to the original view read below, untouched.
    if (CURRENT_LENS === "cost-comparison" && isCostingCsrScopedComparisonRpcV1Enabled()) {
      const { rows, truncated, refreshedAt } = await readCostComparisonRows({
        supabase,
        periodStart: ACTIVE_PERIOD_START,
        scopedRpcEnabled: true,
      });
      if (!isRowsLoadCurrent(loadGeneration)) return;
      ALL_ROWS = rows;
      applyFilters();
      LAST_REFRESH_TIME = refreshedAt;
      updateFreshnessIndicator();
      if (truncated) {
        const truncatedMsg =
          "Cost comparison reached the 2000-row limit; some rows may not be shown.";
        setStatus(truncatedMsg, "warning");
        showToast(truncatedMsg, "warning", 6000);
      }
      return;
    }

`;
export const SCOPED_COMPARISON_SHELL_EDITS = [
  // import lines are matched on their own (other frozen-diff tests strip the neighbouring worklist import first)
  [
    'import { isCostingCsrScopedComparisonRpcV1Enabled } from "./costing-feature-flags.js";\nimport { readCostComparisonRows } from "./costing-cost-comparison-read.js";\n',
    "",
  ],
  [`${GATED_BLOCK}${READ_ANCHOR}`, READ_ANCHOR],
];
