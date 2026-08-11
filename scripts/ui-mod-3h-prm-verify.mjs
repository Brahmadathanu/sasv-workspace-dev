/**
 * UI-MOD-3H — static verify for Production Route Manager individual migration.
 */
import fs from "fs";

const path = "public/shared/production-route-manager.html";
const h = fs.readFileSync(path, "utf8");
const css = fs.readFileSync("public/shared/css/sasv-costing.css", "utf8");
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const classes = ((body.match(/class="([^"]*)"/) || [, ""])[1] || "")
  .split(/\s+/)
  .filter(Boolean);

const report = {
  classes,
  hasRoot: classes.includes("sasv-production-route-manager"),
  hasSuite: classes.includes("sasv-costing"),
  hasModule: classes.includes("sasv-module"),
  themeAttr: /data-sasv-theme="sasv-core"/.test(h),
  costingCss: h.includes("sasv-costing.css"),
  modalOverlayHidden: /\.modal-overlay\.hidden\s*\{/.test(h),
  tableWrapTwVisible: /#tableWrap\.tw-visible/.test(h),
  tableWrapDisplayNone: /#tableWrap\s*\{[\s\S]*?display:\s*none/.test(h),
  homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
  refreshEmpty: /id="refreshBtn"[^>]*>\s*<\/button>/.test(h),
  exportEmpty: /id="exportCsv"[^>]*>\s*<\/button>/.test(h),
  nestedSearch: /\n\s{10,}#search\s*\{/.test(h),
  blues2563: (h.match(/#2563eb/gi) || []).length,
  blues1d4: (h.match(/#1d4ed8/gi) || []).length,
  rgba37: (h.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
  peqFilter16: /id="peqFilterBtn"[\s\S]{0,500}?width="16"/.test(h),
  prmCssSection: css.includes("PRODUCTION ROUTE MANAGER"),
  noBareSuiteTableWrap: !/body\.sasv-costing #tableWrap/.test(css),
  csrTableWrapScoped: css.includes("body.sasv-cost-sheet-review #tableWrap"),
  editorPreserved: h.includes("cp-prm-editor-toolbar") && h.includes("cp-prm-step-table"),
  lensesDefault: /data-costing-default-lens="route-readiness"/.test(h),
  entryScript: h.includes("js/production-route-manager-entry.js"),
  parallelCandidateControls: h.includes("cp-prm-candidate-controls"),
  parallelWorkbench: h.includes("cp-workbench-summary"),
};

console.log(JSON.stringify(report, null, 2));

// Sibling baselines at 3H audit start — must not be modified by this gate
const base = {
  "pricing-policy-manager.html": ["2026-08-09T11:03:01.070Z", 214483],
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

const failKeys = [
  "hasRoot",
  "hasSuite",
  "hasModule",
  "themeAttr",
  "costingCss",
  "modalOverlayHidden",
  "tableWrapTwVisible",
  "homeEmpty",
  "refreshEmpty",
  "prmCssSection",
  "noBareSuiteTableWrap",
  "editorPreserved",
  "entryScript",
  "parallelCandidateControls",
  "parallelWorkbench",
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
