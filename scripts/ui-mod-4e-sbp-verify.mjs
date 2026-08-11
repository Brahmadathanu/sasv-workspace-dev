/** UI-MOD-4E — static verify for Supply Batch Plan */
import fs from "fs";

const h = fs.readFileSync("supply-batch-plan.html", "utf8");
const js = fs.readFileSync("js/supply-batch-plan.js", "utf8");
const css = fs.readFileSync(
  "public/shared/css/sasv-supply-batch-plan.css",
  "utf8",
);
const refs = fs.readFileSync(
  "public/shared/js/supply-batch-size-references.js",
  "utf8",
);
const style = h.slice(0, h.indexOf("</style>"));
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const classes = ((body.match(/class="([^"]*)"/) || [, ""])[1] || "")
  .split(/\s+/)
  .filter(Boolean);

const siblings = [
  "supply-overrides.html",
  "public/shared/forecast-console.html",
  "production-planning-workbench.html",
  "public/shared/fill-planner.html",
].map((f) => {
  try {
    const t = fs.readFileSync(f, "utf8");
    return { f, hasSBP: t.includes("sasv-supply-batch-plan") };
  } catch {
    return { f, hasSBP: false };
  }
});

const report = {
  hasRoot: classes.includes("sasv-supply-batch-plan"),
  hasModule: classes.includes("sasv-module"),
  hasApp: classes.includes("sasv-module--app"),
  theme: /data-sasv-theme="sasv-core"/.test(h),
  cssLink: h.includes("sasv-supply-batch-plan.css"),
  cssFile: css.includes("body.sasv-supply-batch-plan"),
  noDupPadding: !/padding:\s*20px/.test(css.split("table-wrap")[0] || "") &&
    !/sasv-module--app\.sasv-supply-batch-plan[\s\S]{0,200}padding:\s*20px/.test(
      css,
    ),
  gutterNote: css.includes("--sasv-module-page-padding"),
  tableWrapSafety: /table-wrap[\s\S]{0,80}flex:\s*0 1 auto/.test(css),
  tableContainerSafety: /table-container[\s\S]{0,80}flex:\s*0 1 auto/.test(css),
  homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
  homeMount: js.includes("mountModuleHome"),
  toastAdapter: js.includes("sasvShowToast"),
  headerCopy: h.includes("sbp-header-copy"),
  tabs: [
    "tab-btn-build",
    "tab-btn-lines",
    "tab-btn-batches",
    "tab-btn-apply",
    "tab-btn-overrides",
    "tab-btn-batch-sizes",
  ].every((id) => h.includes(`id="${id}"`)),
  planHeader: h.includes('id="bpHeaderSel"'),
  batchSizeRefsImport: js.includes("supply-batch-size-references.js"),
  refsUntouched:
    !refs.includes("sasv-supply-batch-plan") &&
    refs.includes("SUPPLY_BATCH_SIZE_RPC_NAMES"),
  softActive:
    css.includes("sasv-selection-soft") ||
    /tab-btn\[aria-selected="true"\][\s\S]{0,120}sasv-selection-soft/.test(style),
  bluesGone: !(style.match(/#2563eb|#3b82f6|#1d4ed8/gi) || []).length,
  blueGlowGone: !(style.match(/rgba\(\s*37,\s*99,\s*235|rgba\(\s*59,\s*130,\s*246/g) || [])
    .length,
  siblingClean: siblings.every((s) => !s.hasSBP),
  siblings,
};

console.log(JSON.stringify(report, null, 2));
const fail = Object.entries(report).filter(
  ([k, v]) => k !== "siblings" && v === false,
);
if (fail.length) {
  console.error("FAIL", fail.map(([k]) => k));
  process.exit(1);
}
console.log("VERIFY_PASS");
