/** UI-MOD-4B.1 — static checks for Forecast basic visual correction */
import fs from "fs";

const h = fs.readFileSync("public/shared/forecast-console.html", "utf8");
const css = fs.readFileSync("public/shared/css/sasv-forecast.css", "utf8");

const report = {
  headerCard: h.includes("header-card"),
  fcCopy: h.includes("fc-header-copy"),
  title: h.includes("sasv-module-title"),
  pageSubDiv: h.includes('class="page-sub"') && !h.includes("<p class=\"page-sub\">"),
  noClamp: !h.includes("clamp(1.1rem"),
  kpiOrder: [
    "tilePairsChip",
    "tileRowsChip",
    "tileCovChip",
    "tileMissLLT",
    "tileMissSeason",
    "tileOvChip",
  ].every((id) => h.includes(`id="${id}"`)),
  forecastTokens: css.includes("--sasv-forecast-kpi-bg"),
  warningBoth:
    css.includes(".kpi.kpi-llt") &&
    css.includes(".kpi.kpi-seas") &&
    css.includes("--sasv-forecast-kpi-warning-bg"),
  seasonalNotDanger: !/kpi-seas[\s\S]{0,120}danger/.test(css),
  titleLeft: /fc-header-copy[\s\S]{0,80}text-align:\s*left/.test(css),
  titleSize: css.includes("font-size: 1.125rem"),
  softLens: css.includes("sasv-selection-soft"),
  lenses: ["runs", "outputs", "exceptions", "overrides", "publish"].every((k) =>
    h.includes(`data-tab="${k}"`)
  ),
  jsUntouchedToast: fs
    .readFileSync("public/shared/js/forecast-console.js", "utf8")
    .includes("sasvShowToast"),
};

console.log(JSON.stringify(report, null, 2));

const siblings = {
  "production-planning-workbench.html": 85098,
  "public/shared/production-execution-queue.html": 61857,
  "public/shared/procurement-execution-console.html": 211685,
  "supply-batch-plan.html": 112482,
};

let ok = true;
for (const [f, size] of Object.entries(siblings)) {
  const s = fs.statSync(f);
  const match = s.size === size;
  if (!match) ok = false;
  console.log(match ? "OK" : "DRIFT", f, s.size);
}

for (const [k, v] of Object.entries(report)) {
  if (!v) {
    ok = false;
    console.log("FAIL", k);
  }
}

console.log(ok ? "VERIFY_PASS" : "VERIFY_FAIL");
process.exit(ok ? 0 : 1);
