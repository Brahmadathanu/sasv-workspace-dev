/** UI-MOD-4D — static verify for Supply Overrides */
import fs from "fs";

const h = fs.readFileSync("supply-overrides.html", "utf8");
const js = fs.readFileSync("js/supply-overrides.js", "utf8");
const css = fs.readFileSync("public/shared/css/sasv-supply-overrides.css", "utf8");
const style = h.slice(0, h.indexOf("</style>"));
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const classes = ((body.match(/class="([^"]*)"/) || [, ""])[1] || "")
  .split(/\s+/)
  .filter(Boolean);

const siblingTouched = [
  "public/shared/forecast-console.html",
  "production-planning-workbench.html",
  "supply-batch-plan.html",
  "public/shared/fill-planner.html",
].map((f) => {
  try {
    const t = fs.readFileSync(f, "utf8");
    return { f, hasSO: t.includes("sasv-supply-overrides") };
  } catch {
    return { f, hasSO: false, missing: true };
  }
});

const report = {
  hasRoot: classes.includes("sasv-supply-overrides"),
  hasModule: classes.includes("sasv-module"),
  hasApp: classes.includes("sasv-module--app"),
  theme: /data-sasv-theme="sasv-core"/.test(h),
  cssLink: h.includes("sasv-supply-overrides.css"),
  cssFile: css.includes("body.sasv-supply-overrides"),
  noDupPadding:
    !/sasv-module--app\.sasv-supply-overrides\s*\{[^}]*padding:\s*20px/.test(css) &&
    !/body\.sasv-module\.sasv-module--app\.sasv-supply-overrides[\s\S]{0,200}padding:\s*20px/.test(
      css,
    ),
  inheritsGutterNote: css.includes("--sasv-module-page-padding"),
  homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
  homeMount: js.includes("mountModuleHome"),
  toastAdapter: js.includes("sasvShowToast"),
  headerCopy: h.includes("so-header-copy"),
  tabs: ["tab-sets-btn", "tab-lines-btn", "tab-reconcile-btn", "tab-active-btn"].every(
    (id) => h.includes(`id="${id}"`),
  ),
  planHeader: h.includes('id="selPlanHeader"') && h.includes('id="planSelectorCard"'),
  applyExport:
    h.includes('id="btnUnifiedApply"') && h.includes('id="btnUnifiedExport"'),
  downloadJsUntouched: fs.existsSync("js/supply-overrides-download.js"),
  localDownload: js.includes("function download(") || /function\s+download\s*\(/.test(js),
  bluesGone: !(style.match(/#2563eb|#3b82f6|#1d4ed8/gi) || []).length,
  amberHomeGone: !(style.match(/#fed7aa|#fdba74/gi) || []).length,
  blueGlowGone: !(style.match(/rgba\(\s*37,\s*99,\s*235|rgba\(\s*59,\s*130,\s*246/g) || [])
    .length,
  softActive: css.includes("sasv-selection-soft") || /tab-btn\[aria-selected="true"\][\s\S]{0,120}sasv-selection-soft/.test(style),
  siblingClean: siblingTouched.every((s) => !s.hasSO),
  siblings: siblingTouched,
};

console.log(JSON.stringify(report, null, 2));
const fail = Object.entries(report).filter(
  ([k, v]) =>
    k !== "siblings" &&
    k !== "localDownload" &&
    k !== "downloadJsUntouched" &&
    v === false,
);
if (fail.length) {
  console.error("FAIL", fail.map(([k]) => k));
  process.exit(1);
}
console.log("VERIFY_PASS");
