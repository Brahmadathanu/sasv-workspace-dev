import fs from "fs";

const html = fs.readFileSync("public/shared/rm-rebuild-dashboard.html", "utf8");
const js = fs.readFileSync("public/shared/js/rm-rebuild-dashboard.js", "utf8");
const css = fs.readFileSync(
  "public/shared/css/sasv-rm-rebuild-dashboard.css",
  "utf8",
);

const ids = [
  "homeBtn",
  "horizonMonth",
  "planEndMonth",
  "rmFilter",
  "filterUnassigned",
  "filterApprox",
  "filterNetNonZero",
  "textSearch",
  "notes",
  "clearFilters",
  "rowCount",
  "dryRunAllBtn",
  "rebuildAllBtn",
  "refreshBtn",
  "rebuildStatus",
  "summaryContainer",
  "rmOverviewTable",
  "rmOverviewBody",
  "dryRunPanel",
  "dryRunHeader",
  "dryRunBody",
];

const missing = ids.filter((id) => !html.includes(`id="${id}"`));
const checks = {
  missing_ids: missing,
  body_classes:
    /class="[^"]*sasv-module[^"]*sasv-module--app[^"]*sasv-rm-rebuild-dashboard/.test(
      html,
    ),
  theme: html.includes('data-sasv-theme="sasv-core"'),
  css_link: html.includes("sasv-rm-rebuild-dashboard.css"),
  no_shared_ui: !html.includes("shared-ui.css"),
  no_arial: !/font-family:\s*Arial/.test(html),
  workspace_strip: html.includes("rmr-workspace-strip"),
  month_in_strip:
    html.indexOf("rmrWorkspaceStrip") < html.indexOf('id="horizonMonth"') &&
    html.indexOf('id="horizonMonth"') < html.indexOf('id="filters"'),
  home_in_header:
    html.indexOf('id="homeBtn"') < html.indexOf("</header>") &&
    html.indexOf('id="homeBtn"') > html.indexOf("<header"),
  mountModuleHome: js.includes("mountModuleHome"),
  platform_home: js.includes("Platform.goHome"),
  toast_import: js.includes('from "./toast.js"'),
  searchable_rm: js.includes("enhanceSearchableSelect"),
  rpc_rebuild: js.includes("mrp_rm_rebuild_all_erp"),
  view_contract: js.includes("v_mrp_rm_planned_vs_issued_overview"),
  data_keys: js.includes('data-key="planned_total_qty"'),
  summary_fill:
    css.includes("#summaryContainer") && css.includes("flex: 1 1 auto"),
  ordinary_wrap_safe:
    css.includes(".table-wrap") && css.includes("flex: 0 1 auto"),
  no_viewport_dupe: !/page-padding:\s*20px/.test(css),
  tabular: css.includes("font-variant-numeric: tabular-nums"),
};

const fail =
  missing.length > 0 ||
  Object.entries(checks)
    .filter(([k]) => k !== "missing_ids")
    .some(([, v]) => v !== true);

console.log(JSON.stringify(checks, null, 2));
console.log(fail ? "VERIFY_FAIL" : "VERIFY_PASS");
process.exit(fail ? 1 : 0);
