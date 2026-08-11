import fs from "fs";

const html = fs.readFileSync("public/shared/fill-planner.html", "utf8");
const js = fs.readFileSync("public/shared/js/fill-planner.js", "utf8");
const css = fs.readFileSync("public/shared/css/sasv-fill-planner.css", "utf8");

const ids = [
  "fp-product-input",
  "fp-product-list",
  "fp-bulk",
  "fp-uom",
  "fp-overshoot",
  "fp-run",
  "fp-clear",
  "homeBtn",
  "msg",
  "fp-table",
  "fp-head",
  "fp-body",
  "fp-emg-title",
  "fp-emg-table",
  "fp-emg-body",
  "fp-run-wrap",
  "fp-title",
  "fp-metrics-header",
  "fp-metrics-title",
  "fp-metrics-table",
  "fp-metrics-head",
  "fp-metrics-body",
  "fp-stock-updated",
  "fp-workings",
  "fp-workings-body",
  "fp-workings-copy",
  "fp-workings-autoscroll",
];

const missing = ids.filter((id) => !html.includes(`id="${id}"`));
const checks = {
  missing_ids: missing,
  body_classes: /class="[^"]*sasv-module[^"]*sasv-module--app[^"]*sasv-fill-planner/.test(
    html,
  ),
  theme: html.includes('data-sasv-theme="sasv-core"'),
  css_link: html.includes("sasv-fill-planner.css"),
  datalist: html.includes('datalist id="fp-product-list"'),
  mountModuleHome: js.includes("mountModuleHome"),
  calc_fill_plan: js.includes("calc_fill_plan"),
  goHome: js.includes("Platform.goHome"),
  clearPlanner: js.includes("function clearPlanner"),
  wrapClass: js.includes('className = "fp-table-wrap"'),
  table_wrap_safety: css.includes(".fp-table-wrap") && css.includes("flex: 0 1 auto"),
  no_viewport_dupe: !/page-padding:\s*20px/.test(css),
  no_arial: !/Arial/.test(css) && !/Arial/.test(html),
  no_pill_blue: !/#0a62c3/.test(html) && !/#0a62c3/.test(css),
};

const fail = missing.length || !Object.entries(checks)
  .filter(([k]) => k !== "missing_ids")
  .every(([, v]) => v === true);

console.log(JSON.stringify(checks, null, 2));
console.log(fail ? "VERIFY_FAIL" : "VERIFY_PASS");
process.exit(fail ? 1 : 0);
