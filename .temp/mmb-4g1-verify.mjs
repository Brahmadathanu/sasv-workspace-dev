import fs from "fs";

const html = fs.readFileSync("public/shared/mrp-material-board.html", "utf8");
const js = fs.readFileSync("public/shared/js/mrp-material-board.js", "utf8");
const css = fs.readFileSync(
  "public/shared/css/sasv-mrp-material-board.css",
  "utf8",
);

const headerEnd = html.indexOf("</header>");
const stripIdx = html.indexOf("mmbWorkspaceStrip");
const viewTabsIdx = html.indexOf('id="viewTabs"');
const homeIdx = html.indexOf('id="homeBtn"');
const filtersIdx = html.indexOf('id="filters"');

const checks = {
  workspace_strip_exists: stripIdx > 0,
  view_outside_header: viewTabsIdx > headerEnd,
  home_inside_header: homeIdx > 0 && homeIdx < headerEnd,
  strip_before_filters: stripIdx > 0 && stripIdx < filtersIdx,
  no_header_bar_on_card: !html.includes('class="header-card header-bar"'),
  flags_data_key: html.includes('data-key="flags"'),
  td_data_keys: js.includes('data-key="planned_total_qty"'),
  table_cells_no_inline_align: !/data-key="planned_total_qty"[^>]*>/.test(
    js.match(/tr\.innerHTML[\s\S]*?;/)?.[0] || "",
  )
    ? true
    : !/planned_total_qty"[^>]*style=/.test(js),
  no_numeric_mono_page: !/planned_total_qty[\s\S]{0,200}monospace/.test(html),
  css_left_group: css.includes('th[data-key="stock_item_code"]') &&
    css.includes("text-align: left"),
  css_right_net: css.includes('data-key="net_requirement"') &&
    css.includes("text-align: right"),
  css_tabular: css.includes("font-variant-numeric: tabular-nums"),
  css_workspace_strip: css.includes(".mmb-workspace-strip"),
  ids_intact:
    html.includes('id="horizonMonth"') &&
    html.includes('data-view="summary"') &&
    html.includes('data-view="exceptions"') &&
    html.includes('id="kindFilter"'),
};

const fail = Object.values(checks).some((v) => v !== true);
console.log(JSON.stringify(checks, null, 2));
console.log(fail ? "VERIFY_FAIL" : "VERIFY_PASS");
process.exit(fail ? 1 : 0);
