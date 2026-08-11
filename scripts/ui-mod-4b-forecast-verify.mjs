/**
 * UI-MOD-4B — static verify for Forecast Console pilot migration.
 */
import fs from "fs";

const htmlPath = "public/shared/forecast-console.html";
const jsPath = "public/shared/js/forecast-console.js";
const cssPath = "public/shared/css/sasv-forecast.css";

const h = fs.readFileSync(htmlPath, "utf8");
const js = fs.readFileSync(jsPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const styleSlice = h.slice(0, h.indexOf("</style>"));
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const classes = ((body.match(/class="([^"]*)"/) || [, ""])[1] || "")
  .split(/\s+/)
  .filter(Boolean);

const report = {
  classes,
  hasRoot: classes.includes("sasv-forecast-console"),
  hasModule: classes.includes("sasv-module"),
  themeAttr: /data-sasv-theme="sasv-core"/.test(h),
  forecastCssLink: h.includes("sasv-forecast.css"),
  forecastCssFile: css.includes("body.sasv-forecast-console"),
  homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
  homeMount: js.includes("mountModuleHome"),
  toastImport: /from\s+["']\.\/toast\.js["']/.test(js),
  toastAdapter: /sasvShowToast/.test(js),
  lensKeys: ["runs", "outputs", "exceptions", "overrides", "publish"].every(
    (k) => h.includes(`data-tab="${k}"`)
  ),
  blues2563: (styleSlice.match(/#2563eb/gi) || []).length,
  blues1d4: (styleSlice.match(/#1d4ed8/gi) || []).length,
  rgba37: (styleSlice.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
  amberHomeGone: !styleSlice.includes("#fed7aa"),
  softPill: /pill\.active[\s\S]{0,120}sasv-selection-soft/.test(styleSlice),
  globalTabOverridesUntouched: fs
    .readFileSync("public/shared/css/style.css", "utf8")
    .includes("#tab-overrides .overrides-window-card"),
  scopedTabOverrides: css.includes("body.sasv-forecast-console #tab-overrides"),
  moduleTarget: js.includes('module:forecast-console'),
};

console.log(JSON.stringify(report, null, 2));

const base = {
  "production-planning-workbench.html": ["2025-10-16T15:31:59.626Z", 85098],
  "supply-overrides.html": ["2025-12-27T13:01:26.514Z", 72429],
  "supply-batch-plan.html": ["2026-08-08T10:14:19.536Z", 112482],
  "public/shared/fill-planner.html": ["2026-08-09T10:57:45.758Z", 10158],
  "public/shared/mrp-material-board.html": ["2026-01-08T13:12:06.461Z", 46425],
  "public/shared/production-execution-queue.html": [
    "2026-05-13T09:35:07.430Z",
    61857,
  ],
  "public/shared/procurement-execution-console.html": [
    "2026-07-13T08:23:51.380Z",
    211685,
  ],
  "public/shared/rm-rebuild-dashboard.html": ["2025-12-26T14:26:07.961Z", 6369],
  "public/shared/pricing-policy-manager.html": [
    "2026-08-09T11:03:01.070Z",
    214483,
  ],
};

let ok = true;
for (const [f, [mtime, size]] of Object.entries(base)) {
  const s = fs.statSync(f);
  const match = s.mtime.toISOString() === mtime && s.size === size;
  if (!match) ok = false;
  console.log(match ? "OK" : "DRIFT", f, s.mtime.toISOString(), s.size);
}

const failKeys = [
  "hasRoot",
  "hasModule",
  "themeAttr",
  "forecastCssLink",
  "forecastCssFile",
  "homeEmpty",
  "homeMount",
  "toastImport",
  "toastAdapter",
  "lensKeys",
  "amberHomeGone",
  "softPill",
  "globalTabOverridesUntouched",
  "scopedTabOverrides",
  "moduleTarget",
];
for (const k of failKeys) {
  if (!report[k]) {
    ok = false;
    console.log("FAIL", k);
  }
}
if (report.blues2563 || report.blues1d4 || report.rgba37) {
  ok = false;
  console.log("FAIL leftover blues", report.blues2563, report.blues1d4, report.rgba37);
}

console.log(ok ? "VERIFY_PASS" : "VERIFY_FAIL");
process.exit(ok ? 0 : 1);
