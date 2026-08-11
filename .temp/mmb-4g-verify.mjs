import fs from "fs";

const html = fs.readFileSync("public/shared/mrp-material-board.html", "utf8");
const js = fs.readFileSync("public/shared/js/mrp-material-board.js", "utf8");
const css = fs.readFileSync(
  "public/shared/css/sasv-mrp-material-board.css",
  "utf8",
);

const ids = [
  "homeBtn",
  "horizonMonth",
  "viewTabs",
  "kindFilter",
  "textSearch",
  "boardTabs",
  "mrpTable",
  "mrpTableBody",
  "mrpTableContainer",
  "paginator",
  "filters",
  "filterDrawer",
  "itemDetailModal",
  "loadDataBtn",
  "clearFilters",
  "rowCount",
  "mrpGovernanceBanner",
  "modalAllocationBtn",
];

const missing = ids.filter((id) => !html.includes(`id="${id}"`));
const checks = {
  missing_ids: missing,
  body_classes:
    /class="[^"]*sasv-module[^"]*sasv-module--app[^"]*sasv-mrp-material-board/.test(
      html,
    ),
  theme: html.includes('data-sasv-theme="sasv-core"'),
  css_link: html.includes("sasv-mrp-material-board.css"),
  no_amber_home: !html.includes("#fed7aa") && !html.includes("#fdba74"),
  no_arial_body: !/font-family:\s*Arial/.test(html),
  no_shared_ui_link: !html.includes("shared-ui.css"),
  mountModuleHome: js.includes("mountModuleHome"),
  toast_adapter: js.includes("sasvShowToast") && js.includes("function showToast"),
  rpc: js.includes("mrp_material_overview_page"),
  goHome: js.includes("Platform.goHome"),
  table_fill_kept: css.includes("#mrpTableContainer") && css.includes("flex: 1 1 auto"),
  ordinary_wrap_safe: css.includes(".table-wrap") && css.includes("flex: 0 1 auto"),
  no_viewport_dupe: !/page-padding:\s*20px/.test(css),
  title: html.includes("MRP Material Board"),
  modes_preserved:
    html.includes('data-mode="shortage"') &&
    html.includes('data-view="exceptions"'),
};

const fail =
  missing.length > 0 ||
  Object.entries(checks)
    .filter(([k]) => k !== "missing_ids")
    .some(([, v]) => v !== true);

console.log(JSON.stringify(checks, null, 2));
console.log(fail ? "VERIFY_FAIL" : "VERIFY_PASS");
process.exit(fail ? 1 : 0);
