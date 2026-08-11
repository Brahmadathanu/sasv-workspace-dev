/**
 * UI-MOD-3G — static verify for Pricing Policy Manager individual migration.
 */
import fs from "fs";

const path = "public/shared/pricing-policy-manager.html";
let h = fs.readFileSync(path, "utf8");

// Surgical fix: un-nest #search if still indented under a media query
if (/\n\s{10,}#search\s*\{/.test(h)) {
  h = h.replace(/\n\s+#search\s*\{/, "\n      #search {");
  fs.writeFileSync(path, h);
  console.log("FIXED nested #search indent");
}

const css = fs.readFileSync("public/shared/css/sasv-costing.css", "utf8");
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const m = body.match(/class="([^"]*)"/);
const classes = m ? m[1].split(/\s+/).filter(Boolean) : [];

const report = {
  classes,
  hasRoot: classes.includes("sasv-pricing-policy-manager"),
  hasSuite: classes.includes("sasv-costing"),
  hasModule: classes.includes("sasv-module"),
  themeAttr: /data-sasv-theme="sasv-core"/.test(h),
  costingCss: h.includes("sasv-costing.css"),
  modalHidden: /\.cost-sheet-modal\.hidden\s*\{/.test(h),
  tableWrapHidden: /#tableWrap\.hidden\s*\{/.test(h),
  loading: h.includes(".cp-loading-mask"),
  homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
  refreshEmpty: /id="refreshBtn"[^>]*>\s*<\/button>/.test(h),
  exportEmpty: /id="exportCsv"[^>]*>\s*<\/button>/.test(h),
  nestedSearch: /\n\s{10,}#search\s*\{/.test(h),
  blues2563: (h.match(/#2563eb/gi) || []).length,
  blues1d4: (h.match(/#1d4ed8/gi) || []).length,
  rgba37: (h.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
  arialPrintOnly:
    (h.match(/Arial/gi) || []).length === 1 &&
    /@media\s+print[\s\S]{0,800}Arial/i.test(h),
  ppmCssSection: css.includes("PRICING POLICY MANAGER"),
  prmPlaceholder: css.includes("Remaining page root"),
  noBareSuiteTableWrap: !/body\.sasv-costing #tableWrap/.test(css),
  csrTableWrapScoped: css.includes("body.sasv-cost-sheet-review #tableWrap"),
  workspaceTabs: (h.match(/cp-pricing-direct-workspace-tab/g) || []).length,
  peqFilter16: /id="peqFilterBtn"[\s\S]{0,500}?width="16"/.test(h),
};

console.log(JSON.stringify(report, null, 2));

// Accepted sibling baselines at 3G audit start (must not be modified by this gate).
// PRM may drift from parallel agents — this gate must not edit it; report only.
const base = {
  "cost-build-manager.html": ["2026-08-09T10:47:59.680Z", 129096],
  "material-cost-manager.html": ["2026-08-09T10:39:07.257Z", 150292],
  "costing-control-center.html": ["2026-08-09T10:31:40.289Z", 134792],
  "cost-sheet-review.html": ["2026-08-09T10:57:47.502Z", 148097],
};

let ok = true;
for (const [f, [mtime, size]] of Object.entries(base)) {
  const s = fs.statSync("public/shared/" + f);
  const match = s.mtime.toISOString() === mtime && s.size === size;
  if (!match) ok = false;
  console.log(match ? "OK" : "DRIFT", f, s.mtime.toISOString(), s.size);
}
{
  const s = fs.statSync("public/shared/production-route-manager.html");
  console.log(
    "PRM_NOTE (not in 3G scope)",
    s.mtime.toISOString(),
    s.size,
    "— do not migrate under 3G"
  );
}

const failKeys = [
  "hasRoot",
  "hasSuite",
  "hasModule",
  "themeAttr",
  "costingCss",
  "modalHidden",
  "tableWrapHidden",
  "loading",
  "homeEmpty",
  "refreshEmpty",
  "ppmCssSection",
  "noBareSuiteTableWrap",
];
for (const k of failKeys) {
  if (!report[k]) {
    ok = false;
    console.log("FAIL", k);
  }
}
if (report.nestedSearch) {
  ok = false;
  console.log("FAIL nestedSearch");
}
if (report.blues2563 || report.blues1d4 || report.rgba37) {
  ok = false;
  console.log("FAIL leftover blues", report.blues2563, report.blues1d4, report.rgba37);
}

console.log(ok ? "VERIFY_PASS" : "VERIFY_FAIL");
process.exit(ok ? 0 : 1);
