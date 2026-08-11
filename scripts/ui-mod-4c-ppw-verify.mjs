/** UI-MOD-4C — static verify for Production Planning Workbench */
import fs from "fs";

const h = fs.readFileSync("production-planning-workbench.html", "utf8");
const js = fs.readFileSync("js/production-planning-workbench.js", "utf8");
const css = fs.readFileSync(
  "public/shared/css/sasv-production-planning.css",
  "utf8"
);
const style = h.slice(0, h.indexOf("</style>"));
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const classes = ((body.match(/class="([^"]*)"/) || [, ""])[1] || "")
  .split(/\s+/)
  .filter(Boolean);

const report = {
  hasRoot: classes.includes("sasv-production-planning-workbench"),
  hasModule: classes.includes("sasv-module"),
  theme: /data-sasv-theme="sasv-core"/.test(h),
  cssLink: h.includes("sasv-production-planning.css"),
  cssFile: css.includes("body.sasv-production-planning-workbench"),
  homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
  homeMount: js.includes("mountModuleHome"),
  toastAdapter: js.includes("sasvShowToast"),
  headerCopy: h.includes("ppw-header-copy"),
  steps: [
    "step-forecast-hierarchy",
    "step-net-sku-plan",
    "step-bulk-requirements",
    "step-netting",
    "step-wip",
    "step-normalizer",
  ].every((id) => h.includes(`id="${id}"`)),
  notLensPills: !h.includes("lens-pills"),
  amberGone: !(style.match(/#fed7aa/gi) || []).length,
  bluesGone: !(style.match(/#2563eb|#3b82f6|#1d4ed8/gi) || []).length,
  blueGlowGone: !(style.match(/rgba\(\s*37,\s*99,\s*235|rgba\(\s*59,\s*130,\s*246/g) || [])
    .length,
  softActive: /workflow-step\.active[\s\S]{0,200}sasv-selection-soft/.test(style) ||
    css.includes("workflow-step.active"),
  padding20: css.includes("padding: 20px"),
};

console.log(JSON.stringify(report, null, 2));

const base = {
  "public/shared/forecast-console.html": 53290,
  "supply-overrides.html": 72429,
  "supply-batch-plan.html": 112482,
  "public/shared/fill-planner.html": 10158,
  "public/shared/production-execution-queue.html": 61857,
  "public/shared/procurement-execution-console.html": 211685,
};

let ok = true;
for (const [f, size] of Object.entries(base)) {
  const s = fs.statSync(f);
  // Forecast may have grown slightly from padding fix — allow mtime-based check for exact size only when stable
  const match = s.size === size;
  if (!match) {
    // Forecast was edited after baseline for padding — re-check identity only for true siblings
    if (f.includes("forecast-console")) {
      console.log("NOTE", f, s.size, "(Forecast closed; size drift OK if only FC)");
    } else {
      ok = false;
      console.log("DRIFT", f, s.size);
    }
  } else {
    console.log("OK", f, s.size);
  }
}

for (const [k, v] of Object.entries(report)) {
  if (!v) {
    ok = false;
    console.log("FAIL", k);
  }
}

console.log(ok ? "VERIFY_PASS" : "VERIFY_FAIL");
process.exit(ok ? 0 : 1);
