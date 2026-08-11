import fs from "fs";

const html = fs.readFileSync("public/shared/fill-planner.html", "utf8");
const js = fs.readFileSync("public/shared/js/fill-planner.js", "utf8");
const css = fs.readFileSync("public/shared/css/sasv-fill-planner.css", "utf8");
const chrome = fs.readFileSync(
  "public/shared/js/sasv-module-chrome.js",
  "utf8",
);

const checks = {
  no_clear_btn: !html.includes("fp-clear") && !js.includes("fp-clear"),
  has_fp_product_select: html.includes('id="fp-product"'),
  no_datalist: !html.includes("fp-product-list") && !html.includes("datalist"),
  has_freshness_chip: html.includes('id="fp-updated"') && html.includes("sc-snapshot"),
  freshness_before_home:
    html.indexOf("fp-updated") < html.indexOf('id="homeBtn"'),
  no_metrics_snapshot: !html.includes("fp-stock-updated"),
  enhance_import: js.includes("enhanceSearchableSelect"),
  clear_backspace_opt: chrome.includes("clearSelectedOnBackspace"),
  linked_bulk_clear: js.includes("applyProductClearedSideEffects"),
  calc_fill_plan: js.includes("calc_fill_plan"),
  goHome: js.includes("Platform.goHome"),
  snapshot_chip_fn: js.includes("applySnapshotDateToChip"),
  debounce_220: js.includes("debounceMs: 220"),
  bulk_not_whole_clear:
    !js.includes('elBulk.addEventListener("keydown"') ||
    !/elBulk[\s\S]{0,200}Backspace/.test(js),
};

const fail = Object.values(checks).some((v) => v !== true);
console.log(JSON.stringify(checks, null, 2));
console.log(fail ? "VERIFY_FAIL" : "VERIFY_PASS");
process.exit(fail ? 1 : 0);
